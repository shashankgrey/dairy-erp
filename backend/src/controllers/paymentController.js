const pool = require('../config/db');

// customer_id/amount/payment_method are already guaranteed valid here
// by the validate(paymentBodySchema) middleware -- this only needs to
// handle the DB-dependent business logic (customer exists, balance check).
async function createPayment(req, res) {
  const { customer_id, amount, payment_date, payment_method = 'cash', notes } = req.body;

  const customer = await pool.query('SELECT outstanding_balance FROM customers WHERE id = $1', [customer_id]);
  if (customer.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
  if (Number(amount) > Number(customer.rows[0].outstanding_balance)) {
    return res.status(400).json({ error: 'Payment cannot be greater than the customer outstanding balance' });
  }

  const result = await pool.query(
    `INSERT INTO payments (customer_id, amount, payment_date, payment_method, notes)
     VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5) RETURNING *`,
    [customer_id, amount, payment_date || null, payment_method, notes || null]
  );
  res.status(201).json(result.rows[0]);
}

async function listPaymentsForCustomer(req, res) {
  const result = await pool.query(
    'SELECT * FROM payments WHERE customer_id = $1 ORDER BY payment_date DESC, id DESC',
    [req.params.customerId]
  );
  res.json(result.rows);
}

async function deletePayment(req, res) {
  await pool.query('DELETE FROM payments WHERE id = $1', [req.params.id]);
  res.json({ success: true });
}

module.exports = { createPayment, listPaymentsForCustomer, deletePayment };