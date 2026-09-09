const pool = require('../config/db');

async function getStats(req, res) {
  const [customers, outstanding, thisMonth, lowStock, payable] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE active) AS active,
        COUNT(*) FILTER (
          WHERE outstanding_balance > 0 AND active
        ) AS owing
      FROM customers
    `),

    pool.query(`
      SELECT COALESCE(SUM(outstanding_balance), 0) AS total
      FROM customers
      WHERE active
    `),

    pool.query(`
      SELECT
        COALESCE(SUM(total_amount), 0) AS revenue,
        COUNT(*) AS entries
      FROM purchases
      WHERE purchase_date >= date_trunc('month', CURRENT_DATE)
    `),

    pool.query(`
      SELECT COUNT(*) AS count
      FROM products
      WHERE status = 'active'
        AND available_stock <= low_stock_threshold
    `),

    // Supplier payable
    pool.query(`
      SELECT COALESCE(SUM(outstanding_balance), 0) AS total
      FROM suppliers
      WHERE active
    `),
  ]);

  res.json({
    activeCustomers: parseInt(customers.rows[0].active),
    customersOwing: parseInt(customers.rows[0].owing),
    totalOutstanding: parseFloat(outstanding.rows[0].total),
    thisMonthRevenue: parseFloat(thisMonth.rows[0].revenue),
    thisMonthEntries: parseInt(thisMonth.rows[0].entries),
    lowStockProducts: parseInt(lowStock.rows[0].count),
    totalPayable: parseFloat(payable.rows[0].total),
  });
}


// Daily purchase totals for the last N days
// Feeds the dashboard chart
async function getPurchaseTrend(req, res) {
  const days = Math.min(
    90,
    Math.max(7, parseInt(req.query.days) || 14)
  );

  const result = await pool.query(
    `
      SELECT
        purchase_date::text AS date,
        COALESCE(SUM(total_amount), 0) AS total
      FROM purchases
      WHERE purchase_date >= CURRENT_DATE - $1::int
      GROUP BY purchase_date
      ORDER BY purchase_date
    `,
    [days]
  );

  // Fill missing days with 0 so the chart doesn't have gaps
  const map = new Map(
    result.rows.map(r => [r.date, parseFloat(r.total)])
  );

  const series = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);

    const key = d.toISOString().split('T')[0];

    series.push({
      date: key,
      total: map.get(key) || 0,
    });
  }

  res.json(series);
}

module.exports = {
  getStats,
  getPurchaseTrend,
};