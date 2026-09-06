const pool = require('../config/db');

async function getStats(req, res) {
  try {
    const customers = await pool.query(
      "SELECT COUNT(*) FILTER (WHERE active) AS active, COUNT(*) FILTER (WHERE outstanding_balance > 0 AND active) AS owing FROM customers"
    );

    const outstanding = await pool.query(
      "SELECT COALESCE(SUM(outstanding_balance), 0) AS total FROM customers WHERE active"
    );

    const payable = await pool.query(
      "SELECT COALESCE(SUM(outstanding_balance), 0) AS total FROM suppliers WHERE active"
    );

    const thisMonth = await pool.query(
      "SELECT COALESCE(SUM(total_amount), 0) AS revenue, COUNT(*) AS entries FROM purchases WHERE purchase_date >= date_trunc('month', CURRENT_DATE)"
    );

    // Stock management is not currently available in the products table.
    const lowStock = await pool.query(
      "SELECT COUNT(*) AS count FROM products WHERE status = 'active' AND available_stock <= low_stock_threshold"
    );

    res.json({
      activeCustomers: parseInt(customers.rows[0].active),
      customersOwing: parseInt(customers.rows[0].owing),
      totalOutstanding: parseFloat(outstanding.rows[0].total),
      totalPayable: parseFloat(payable.rows[0].total),
      thisMonthRevenue: parseFloat(thisMonth.rows[0].revenue),
      thisMonthEntries: parseInt(thisMonth.rows[0].entries),
      lowStockProducts: parseInt(lowStock.rows[0].count),
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      error: 'Failed to load dashboard statistics'
    });
  }
}

async function getPurchaseTrend(req, res) {
  try {
    const days = Math.min(
      90,
      Math.max(7, parseInt(req.query.days) || 14)
    );

    const result = await pool.query(
      "SELECT purchase_date::text AS date, COALESCE(SUM(total_amount), 0) AS total FROM purchases WHERE purchase_date >= CURRENT_DATE - $1::int GROUP BY purchase_date ORDER BY purchase_date",
      [days]
    );

    const map = new Map(
      result.rows.map(row => [
        row.date,
        parseFloat(row.total)
      ])
    );

    const series = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);

      const key = d.toISOString().split('T')[0];

      series.push({
        date: key,
        total: map.get(key) || 0
      });
    }

    res.json(series);
  } catch (error) {
    console.error('Purchase trend error:', error);
    res.status(500).json({
      error: 'Failed to load purchase trend'
    });
  }
}

module.exports = {
  getStats,
  getPurchaseTrend
};
