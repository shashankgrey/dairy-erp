const pool = require('../config/db');

// GET /api/reports/daily?date=2026-08-14
// Returns both the existing aggregate totals (unchanged, so nothing
// that already depends on this shape breaks) AND itemized line-level
// detail for each section -- who bought what, who paid what, which
// supplier was restocked, which supplier was paid -- so the report can
// show real names/amounts instead of just totals, and be exported.
async function dailyReport(req, res) {
  const date = req.query.date || new Date().toISOString().slice(0, 10);

  const [
    sales,
    collections,
    stockPurchases,
    supplierPayments,
    receivable,
    payable,
    salesItems,
    collectionItems,
    stockPurchaseItems,
    supplierPaymentItems,
  ] = await Promise.all([
    pool.query(`SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS entries FROM purchases WHERE purchase_date = $1`, [date]),
    pool.query(`SELECT COALESCE(SUM(amount), 0) AS total, payment_method, COUNT(*) AS entries FROM payments WHERE payment_date = $1 GROUP BY payment_method`, [date]),
    pool.query(`SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS entries FROM supplier_purchases WHERE purchase_date = $1`, [date]),
    pool.query(`SELECT COALESCE(SUM(amount), 0) AS total, payment_method, COUNT(*) AS entries FROM supplier_payments WHERE payment_date = $1 GROUP BY payment_method`, [date]),
    pool.query(`SELECT COALESCE(SUM(outstanding_balance), 0) AS total FROM customers WHERE active`),
    pool.query(`SELECT COALESCE(SUM(outstanding_balance), 0) AS total FROM suppliers WHERE active`),

    // Itemized: each customer sale for the day
    pool.query(
      `SELECT
         COALESCE(c.full_name, p.walk_in_customer_name) AS customer_name,
         COALESCE(pr.name, p.custom_product_name) AS product_name,
         COALESCE(pr.unit, p.custom_unit) AS unit,
         p.quantity,
         p.unit_price,
         p.total_amount
       FROM purchases p
       LEFT JOIN customers c ON c.id = p.customer_id
       LEFT JOIN products pr ON pr.id = p.product_id
       WHERE p.purchase_date = $1
       ORDER BY p.id`,
      [date]
    ),

    // Itemized: each customer payment received
    pool.query(
      `SELECT c.full_name AS customer_name, pay.amount, pay.payment_method, pay.notes
       FROM payments pay
       JOIN customers c ON c.id = pay.customer_id
       WHERE pay.payment_date = $1
       ORDER BY pay.id`,
      [date]
    ),

    // Itemized: each supplier restock
    pool.query(
      `SELECT s.full_name AS supplier_name, pr.name AS product_name, sp.quantity, pr.unit, sp.unit_cost, sp.total_amount
       FROM supplier_purchases sp
       JOIN suppliers s ON s.id = sp.supplier_id
       JOIN products pr ON pr.id = sp.product_id
       WHERE sp.purchase_date = $1
       ORDER BY sp.id`,
      [date]
    ),

    // Itemized: each supplier payment made
    pool.query(
      `SELECT s.full_name AS supplier_name, sp.amount, sp.payment_method, sp.reference_number
       FROM supplier_payments sp
       JOIN suppliers s ON s.id = sp.supplier_id
       WHERE sp.payment_date = $1
       ORDER BY sp.id`,
      [date]
    ),
  ]);

  const methodTotals = (rows) => rows.reduce((totals, row) => ({ ...totals, [row.payment_method]: Number(row.total) }), { cash: 0, upi: 0, bank: 0, other: 0 });
  const collectionByMethod = methodTotals(collections.rows);
  const supplierPaymentByMethod = methodTotals(supplierPayments.rows);

  res.json({
    date,
    sales: {
      total: Number(sales.rows[0].total),
      entries: Number(sales.rows[0].entries),
      items: salesItems.rows,
    },
    collections: {
      total: Object.values(collectionByMethod).reduce((a, b) => a + b, 0),
      byMethod: collectionByMethod,
      items: collectionItems.rows,
    },
    stockPurchases: {
      total: Number(stockPurchases.rows[0].total),
      entries: Number(stockPurchases.rows[0].entries),
      items: stockPurchaseItems.rows,
    },
    supplierPayments: {
      total: Object.values(supplierPaymentByMethod).reduce((a, b) => a + b, 0),
      byMethod: supplierPaymentByMethod,
      items: supplierPaymentItems.rows,
    },
    receivables: Number(receivable.rows[0].total),
    payables: Number(payable.rows[0].total),
    netReceivable: Number(receivable.rows[0].total) - Number(payable.rows[0].total),
  });
}

module.exports = { dailyReport };