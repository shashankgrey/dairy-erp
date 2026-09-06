const pool = require('../config/db');

async function listSuppliers(req, res) {
  const { search = '', status = 'active' } = req.query;
  const conditions = [];
  const params = [];
  if (status === 'active') conditions.push('s.active = true');
  if (status === 'archived') conditions.push('s.active = false');
  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    conditions.push(`(s.full_name ILIKE $${params.length} OR s.mobile_number ILIKE $${params.length} OR s.supplier_code ILIKE $${params.length})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT s.*, COALESCE(sp.total_purchased, 0) AS total_purchased, COALESCE(pay.total_paid, 0) AS total_paid
     FROM suppliers s
     LEFT JOIN (SELECT supplier_id, SUM(total_amount) AS total_purchased FROM supplier_purchases GROUP BY supplier_id) sp ON sp.supplier_id = s.id
     LEFT JOIN (SELECT supplier_id, SUM(amount) AS total_paid FROM supplier_payments GROUP BY supplier_id) pay ON pay.supplier_id = s.id
     ${where} ORDER BY s.full_name`, params
  );
  res.json(result.rows);
}

async function getSupplier(req, res) {
  const result = await pool.query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Supplier not found' });
  res.json(result.rows[0]);
}

// full_name/mobile_number/email are already guaranteed valid here by
// the validate(supplierBodySchema) middleware.
async function createSupplier(req, res) {
  const { full_name, mobile_number, address, email, notes } = req.body;
  const result = await pool.query(
    `INSERT INTO suppliers (full_name, mobile_number, address, email, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [full_name, mobile_number || null, address || null, email || null, notes || null]
  );
  res.status(201).json(result.rows[0]);
}

async function updateSupplier(req, res) {
  const { full_name, mobile_number, address, email, notes } = req.body;
  const result = await pool.query(
    `UPDATE suppliers SET full_name = $1, mobile_number = $2, address = $3, email = $4, notes = $5 WHERE id = $6 RETURNING *`,
    [full_name, mobile_number || null, address || null, email || null, notes || null, req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Supplier not found' });
  res.json(result.rows[0]);
}

async function listSupplierPurchases(req, res) {
  const result = await pool.query(
    `SELECT sp.*, p.name AS product_name, p.unit FROM supplier_purchases sp JOIN products p ON p.id = sp.product_id
     WHERE sp.supplier_id = $1 ORDER BY sp.purchase_date DESC, sp.id DESC`, [req.params.id]
  );
  res.json(result.rows);
}

// product_id/quantity/unit_cost are already guaranteed valid here by
// the validate(supplierPurchaseBodySchema) middleware -- this only
// needs to handle the DB-dependent checks (supplier/product exist).
async function createSupplierPurchase(req, res) {
  const { product_id, quantity, unit_cost, purchase_date, expiry_date, invoice_number, notes } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const supplier = await client.query('SELECT id FROM suppliers WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!supplier.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Supplier not found' }); }
    const product = await client.query('SELECT id FROM products WHERE id = $1', [product_id]);
    if (!product.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Product not found' }); }
    const result = await client.query(
      `INSERT INTO supplier_purchases (supplier_id, product_id, quantity, unit_cost, purchase_date, expiry_date, invoice_number, notes)
       VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE), $6, $7, $8) RETURNING *`,
      [req.params.id, product_id, quantity, unit_cost, purchase_date || null, expiry_date || null, invoice_number || null, notes || null]
    );
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

async function listSupplierPayments(req, res) {
  const result = await pool.query('SELECT * FROM supplier_payments WHERE supplier_id = $1 ORDER BY payment_date DESC, id DESC', [req.params.id]);
  res.json(result.rows);
}

// amount/payment_method are already guaranteed valid here by the
// validate(supplierPaymentBodySchema) middleware -- this only needs to
// handle the DB-dependent balance check.
async function createSupplierPayment(req, res) {
  const { amount, payment_date, payment_method = 'cash', reference_number, notes } = req.body;
  const supplier = await pool.query('SELECT outstanding_balance FROM suppliers WHERE id = $1', [req.params.id]);
  if (!supplier.rows.length) return res.status(404).json({ error: 'Supplier not found' });
  if (Number(amount) > Number(supplier.rows[0].outstanding_balance)) return res.status(400).json({ error: 'Payment cannot be greater than the supplier payable balance' });
  const result = await pool.query(
    `INSERT INTO supplier_payments (supplier_id, amount, payment_date, payment_method, reference_number, notes)
     VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5, $6) RETURNING *`,
    [req.params.id, amount, payment_date || null, payment_method, reference_number || null, notes || null]
  );
  res.status(201).json(result.rows[0]);
}

module.exports = { listSuppliers, getSupplier, createSupplier, updateSupplier, listSupplierPurchases, createSupplierPurchase, listSupplierPayments, createSupplierPayment };