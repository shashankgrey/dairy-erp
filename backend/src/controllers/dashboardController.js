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

// Dairy-only dashboard: counts and quantities, no rupee figures.
// Per product (never summed across units): sold today, received today,
// and stock left.
async function getDairyToday(req, res) {
  const [counts, products] = await Promise.all([
    pool.query(`
      SELECT
        (SELECT COUNT(*) FROM customers WHERE active) AS active_customers,
        (SELECT COUNT(DISTINCT COALESCE(customer_id::text, walk_in_customer_name))
           FROM purchases WHERE purchase_date = CURRENT_DATE) AS served_today,
        (SELECT COUNT(*) FROM purchases WHERE purchase_date = CURRENT_DATE) AS entries_today,
        (SELECT COUNT(*) FROM products WHERE status = 'active'
           AND available_stock <= low_stock_threshold) AS low_stock
    `),
    pool.query(`
      SELECT pr.id, pr.name, pr.unit, pr.available_stock, pr.low_stock_threshold,
             COALESCE(s.qty, 0) AS sold_today,
             COALESCE(r.qty, 0) AS received_today
      FROM products pr
      LEFT JOIN (SELECT product_id, SUM(quantity) AS qty FROM purchases
                 WHERE purchase_date = CURRENT_DATE GROUP BY product_id) s ON s.product_id = pr.id
      LEFT JOIN (SELECT product_id, SUM(quantity) AS qty FROM supplier_purchases
                 WHERE purchase_date = CURRENT_DATE GROUP BY product_id) r ON r.product_id = pr.id
      WHERE pr.status = 'active'
      ORDER BY COALESCE(s.qty, 0) DESC, pr.name
    `),
  ]);
  const c = counts.rows[0];
  res.json({
    activeCustomers: Number(c.active_customers),
    servedToday: Number(c.served_today),
    entriesToday: Number(c.entries_today),
    lowStockProducts: Number(c.low_stock),
    products: products.rows.map((p) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      stock: Number(p.available_stock),
      lowStock: Number(p.available_stock) <= Number(p.low_stock_threshold),
      soldToday: Number(p.sold_today),
      receivedToday: Number(p.received_today),
    })),
  });
}

module.exports = {
  getStats,
  getPurchaseTrend,
  getDairyToday,
};