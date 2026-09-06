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

module.exports = { listPurchasesByDate, createPurchase, deletePurchase };