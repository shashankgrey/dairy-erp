const pool = require('../config/db');

async function listPurchasesByDate(req, res) {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const result = await pool.query(
    `SELECT p.*,
            COALESCE(c.full_name, p.walk_in_customer_name) AS customer_name,
            c.customer_code,
            (c.id IS NULL) AS is_temporary_customer,
            COALESCE(pr.name, p.custom_product_name) AS product_name,
            COALESCE(pr.unit, p.custom_unit) AS unit,
            (pr.id IS NULL) AS is_temporary_product
     FROM purchases p
     LEFT JOIN customers c ON c.id = p.customer_id
     LEFT JOIN products pr ON pr.id = p.product_id
     WHERE p.purchase_date = $1
     ORDER BY p.id DESC`,
    [date]
  );
  res.json(result.rows);
}

// customer/product presence, quantity, purchase_date, and the
// temporary-product unit_price/custom_unit requirement are already
// guaranteed here by validate(purchaseBodySchema) -- this only needs
// to handle the DB-dependent business logic: product existence and
// stock availability, neither of which a schema can check on its own.
async function createPurchase(req, res) {
  const {
    customer_id, walk_in_customer_name,
    product_id, custom_product_name, custom_unit,
    quantity, purchase_date, unit_price,
  } = req.body;

  let price = unit_price;
  if (product_id) {
    const product = await pool.query('SELECT default_price, available_stock, unit, name FROM products WHERE id = $1', [product_id]);
    if (product.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    if (parseFloat(product.rows[0].available_stock) < parseFloat(quantity)) {
      return res.status(400).json({
        error: `Insufficient stock: only ${product.rows[0].available_stock} ${product.rows[0].unit} of ${product.rows[0].name} available`,
      });
    }
    if (price == null) price = product.rows[0].default_price;
  }

  const result = await pool.query(
    `INSERT INTO purchases
       (customer_id, walk_in_customer_name, product_id, custom_product_name, custom_unit, quantity, unit_price, purchase_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      customer_id || null, customer_id ? null : (walk_in_customer_name || 'Walk-in customer'),
      product_id || null, product_id ? null : custom_product_name, product_id ? null : custom_unit,
      quantity, price, purchase_date,
    ]
  );
  res.status(201).json(result.rows[0]);
}

async function deletePurchase(req, res) {
  await pool.query('DELETE FROM purchases WHERE id = $1', [req.params.id]);
  res.json({ success: true });
}

// Saves a whole basket in ONE transaction: either every line is recorded
// against the customer (and their balance goes up via the existing DB
// triggers) or nothing is. Prices always come from the product catalogue.
async function createBill(req, res) {
  const { customer_id, walk_in_customer_name, purchase_date, items } = req.body;

  // Merge duplicate product lines so stock is checked on the real total.
  const merged = new Map();
  for (const it of items) {
    merged.set(it.product_id, Math.round(((merged.get(it.product_id) || 0) + Number(it.quantity)) * 100) / 100);
  }
  const productIds = [...merged.keys()];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let customerName = walk_in_customer_name || 'Walk-in customer';
    if (customer_id) {
      const c = await client.query('SELECT id, full_name FROM customers WHERE id = $1 AND active = true', [customer_id]);
      if (c.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'This customer could not be found. Please pick them again.' });
      }
      customerName = c.rows[0].full_name;
    }

    // Lock in id order so two bills at once cannot deadlock.
    const found = await client.query(
      'SELECT id, name, unit, default_price, available_stock, status FROM products WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE',
      [productIds]
    );
    const byId = new Map(found.rows.map((p) => [p.id, p]));

    for (const id of productIds) {
      const p = byId.get(id);
      const qty = merged.get(id);
      if (!p) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'One of the products no longer exists. Please refresh and try again.' });
      }
      if (p.status !== 'active') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `${p.name} is not active any more. Remove it from the bill.` });
      }
      if (parseFloat(p.available_stock) < qty) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Not enough stock: only ${p.available_stock} ${p.unit} of ${p.name} left`,
        });
      }
    }

    const purchaseIds = [];
    let total = 0;
    for (const id of productIds) {
      const p = byId.get(id);
      const qty = merged.get(id);
      const r = await client.query(
        `INSERT INTO purchases (customer_id, walk_in_customer_name, product_id, quantity, unit_price, purchase_date)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [customer_id || null, customer_id ? null : customerName, id, qty, p.default_price, purchase_date]
      );
      purchaseIds.push(r.rows[0].id);
      total += qty * parseFloat(p.default_price);
    }

    let outstanding = null;
    if (customer_id) {
      const b = await client.query('SELECT outstanding_balance FROM customers WHERE id = $1', [customer_id]);
      outstanding = b.rows[0].outstanding_balance;
    }

    await client.query('COMMIT');
    res.status(201).json({
      customer_name: customerName,
      item_count: productIds.length,
      total: Math.round(total * 100) / 100,
      outstanding_balance: outstanding,
      purchase_ids: purchaseIds,
    });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* already closed */ }
    throw err;
  } finally {
    client.release();
  }
}

// "Same as last time": the customer's most recent earlier day of buying.
async function getLastBill(req, res) {
  const { customer_id, before } = req.query;
  const day = await pool.query(
    `SELECT to_char(MAX(purchase_date), 'YYYY-MM-DD') AS d FROM purchases
     WHERE customer_id = $1 AND purchase_date < $2 AND product_id IS NOT NULL`,
    [customer_id, before]
  );
  const d = day.rows[0].d;
  if (!d) return res.json({ date: null, items: [] });
  const items = await pool.query(
    `SELECT product_id, SUM(quantity) AS quantity FROM purchases
     WHERE customer_id = $1 AND purchase_date = $2::date AND product_id IS NOT NULL
     GROUP BY product_id ORDER BY product_id`,
    [customer_id, d]
  );
  res.json({ date: d, items: items.rows.map((r) => ({ product_id: r.product_id, quantity: Number(r.quantity) })) });
}

// Undo a bill that was just saved. Only works for a few minutes, and only
// for the whole bill at once, so a mistake can be fixed on the spot without
// opening older entries. The DELETE triggers put the stock back and take
// the amount off the customer's balance.
const UNDO_MINUTES = 10;
async function undoBill(req, res) {
  const ids = [...new Set(req.body.purchase_ids)];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rows = await client.query(
      `SELECT id, customer_id, walk_in_customer_name,
              created_at > NOW() - make_interval(mins => $2) AS recent
       FROM purchases WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE`,
      [ids, UNDO_MINUTES]
    );
    if (rows.rows.length !== ids.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'This bill was already undone or removed.' });
    }
    if (rows.rows.some((r) => !r.recent)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Undo only works within ${UNDO_MINUTES} minutes. Remove it from Daily Entry instead.` });
    }
    const owners = new Set(rows.rows.map((r) => r.customer_id ?? `walkin:${r.walk_in_customer_name}`));
    if (owners.size !== 1) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'These entries are not from one bill.' });
    }
    await client.query('DELETE FROM purchases WHERE id = ANY($1::int[])', [ids]);
    const customerId = rows.rows[0].customer_id;
    let outstanding = null;
    if (customerId) {
      const b = await client.query('SELECT outstanding_balance FROM customers WHERE id = $1', [customerId]);
      outstanding = b.rows[0]?.outstanding_balance ?? null;
    }
    await client.query('COMMIT');
    res.json({ undone: ids.length, outstanding_balance: outstanding });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { listPurchasesByDate, createPurchase, deletePurchase, createBill, getLastBill, undoBill };