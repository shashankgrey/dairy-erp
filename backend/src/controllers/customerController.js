const pool = require('../config/db');
const { generatePayToken } = require('../utils/payToken');

const SORTABLE_COLUMNS = [
  'full_name',
  'customer_code',
  'outstanding_balance',
  'total_amount',
  'created_at',
];

// GET /api/customers?search=&page=1&limit=20&sortBy=full_name&sortOrder=asc&status=active|archived|all&balance=owing|clear
async function listCustomers(req, res) {
  const {
    search = '',
    page = 1,
    limit = 20,
    sortBy = 'full_name',
    sortOrder = 'asc',
    status = 'active',
    balance = 'all',
  } = req.query;

  const sortColumn = SORTABLE_COLUMNS.includes(sortBy)
    ? sortBy
    : 'full_name';

  const sortDir = sortOrder.toLowerCase() === 'desc'
    ? 'DESC'
    : 'ASC';

  const pageNum = Math.max(1, parseInt(page) || 1);

  // Allow up to 1000 records so Excel export can retrieve all normal customer lists.
  const requestedLimit = parseInt(limit) || 20;
  const pageSize = Math.min(1000, Math.max(1, requestedLimit));

  const offset = (pageNum - 1) * pageSize;

  const conditions = [];
  const params = [];

  // Status filter
  if (status === 'active') {
    conditions.push('c.active = true');
  } else if (status === 'archived') {
    conditions.push('c.active = false');
  }

  // Balance filter
  if (balance === 'owing') {
    conditions.push('c.outstanding_balance > 0');
  } else if (balance === 'clear') {
    conditions.push('c.outstanding_balance <= 0');
  }

  // Search filter
  if (search.trim()) {
    params.push(`%${search.trim()}%`);

    conditions.push(`
      (
        c.full_name ILIKE $${params.length}
        OR c.mobile_number ILIKE $${params.length}
        OR c.customer_code ILIKE $${params.length}
      )
    `);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  // Count customers
  const countResult = await pool.query(
    `SELECT COUNT(*)
     FROM customers c
     ${whereClause}`,
    params
  );

  const total = parseInt(countResult.rows[0].count);

  // Pagination parameters
  params.push(pageSize, offset);

  /*
   * Get customers along with:
   *
   * total_amount = total value of all purchases
   * total_paid   = total value of all payments
   *
   * COALESCE ensures customers with no purchases/payments get 0.
   */
  const dataResult = await pool.query(
    `SELECT
        c.*,

        COALESCE(p.total_amount, 0) AS total_amount,

        COALESCE(pay.total_paid, 0) AS total_paid

     FROM customers c

     LEFT JOIN (
       SELECT
         customer_id,
         SUM(total_amount) AS total_amount
       FROM purchases
       GROUP BY customer_id
     ) p
       ON p.customer_id = c.id

     LEFT JOIN (
       SELECT
         customer_id,
         SUM(amount) AS total_paid
       FROM payments
       GROUP BY customer_id
     ) pay
       ON pay.customer_id = c.id

     ${whereClause}

     ORDER BY ${sortColumn} ${sortDir}

     LIMIT $${params.length - 1}
     OFFSET $${params.length}`,
    params
  );

  // Each customer gets a signed, non-guessable public pay-page link
  // (see utils/payToken.js) -- used by the Reminders page so the
  // WhatsApp message can link to a real page instead of a raw upi://
  // link, without exposing a sequential/enumerable customer ID.
  const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const rowsWithPayLink = dataResult.rows.map((row) => ({
    ...row,
    pay_url: `${baseUrl}/pay/${row.id}/${generatePayToken(row.id)}`,
  }));

  res.json({
    data: rowsWithPayLink,
    pagination: {
      page: pageNum,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}


// GET /api/customers/:id -- full profile
async function getCustomer(req, res) {
  const result = await pool.query(
    'SELECT * FROM customers WHERE id = $1',
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      error: 'Customer not found',
    });
  }

  res.json(result.rows[0]);
}


// GET /api/customers/:id/purchases -- purchase history, most recent
// first. product_id/from_date/to_date are optional filters (already
// guaranteed to be well-formed by validate(purchaseHistoryQuerySchema)).
async function getPurchaseHistory(req, res) {
  const {
    page = 1,
    limit = 20,
    product_id,
    from_date,
    to_date,
  } = req.query;

  const pageNum = Math.max(1, parseInt(page) || 1);

  const pageSize = Math.min(
    1000,
    Math.max(1, parseInt(limit) || 20)
  );

  const offset = (pageNum - 1) * pageSize;

  const conditions = ['p.customer_id = $1'];
  const params = [req.params.id];

  if (product_id) {
    params.push(product_id);
    conditions.push(`p.product_id = $${params.length}`);
  }
  if (from_date) {
    params.push(from_date);
    conditions.push(`p.purchase_date >= $${params.length}`);
  }
  if (to_date) {
    params.push(to_date);
    conditions.push(`p.purchase_date <= $${params.length}`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM purchases p ${whereClause}`,
    params
  );

  const total = parseInt(countResult.rows[0].count);

  const dataParams = [...params, pageSize, offset];

  const result = await pool.query(
    `SELECT
        p.*,
        pr.name AS product_name,
        pr.unit
     FROM purchases p
     JOIN products pr
       ON pr.id = p.product_id
     ${whereClause}
     ORDER BY p.purchase_date DESC, p.id DESC
     LIMIT $${dataParams.length - 1}
     OFFSET $${dataParams.length}`,
    dataParams
  );

  res.json({
    data: result.rows,
    pagination: {
      page: pageNum,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}


// POST /api/customers
// full_name/mobile_number/email format are already guaranteed valid
// here by the validate(customerBodySchema) middleware.
async function createCustomer(req, res) {
  const {
    full_name,
    mobile_number,
    address,
    email,
    notes,
  } = req.body;

  const existing = await pool.query(
    'SELECT * FROM customers WHERE mobile_number = $1',
    [mobile_number]
  );

  if (existing.rows.length > 0) {
    const match = existing.rows[0];

    if (match.active) {
      return res.status(409).json({
        error: `This mobile number is already registered to ${match.full_name}`,
      });
    }

    // Restore archived customer instead of blocking.
    const restored = await pool.query(
      `UPDATE customers
       SET
         active = true,
         full_name = $1,
         address = $2,
         email = $3,
         notes = $4
       WHERE id = $5
       RETURNING *`,
      [
        full_name,
        address || null,
        email || null,
        notes || null,
        match.id,
      ]
    );

    return res.status(201).json({
      ...restored.rows[0],
      restored: true,
    });
  }

  const result = await pool.query(
    `INSERT INTO customers (
       full_name,
       mobile_number,
       address,
       email,
       notes
     )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      full_name,
      mobile_number,
      address || null,
      email || null,
      notes || null,
    ]
  );

  res.status(201).json({
    ...result.rows[0],
    restored: false,
  });
}


// PUT /api/customers/:id
async function updateCustomer(req, res) {
  const {
    full_name,
    mobile_number,
    address,
    email,
    notes,
  } = req.body;

  const conflict = await pool.query(
    `SELECT id, full_name
     FROM customers
     WHERE mobile_number = $1
       AND id != $2`,
    [
      mobile_number,
      req.params.id,
    ]
  );

  if (conflict.rows.length > 0) {
    return res.status(409).json({
      error: `This mobile number is already registered to ${conflict.rows[0].full_name}`,
    });
  }

  const result = await pool.query(
    `UPDATE customers
     SET
       full_name = $1,
       mobile_number = $2,
       address = $3,
       email = $4,
       notes = $5
     WHERE id = $6
     RETURNING *`,
    [
      full_name,
      mobile_number,
      address || null,
      email || null,
      notes || null,
      req.params.id,
    ]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      error: 'Customer not found',
    });
  }

  res.json(result.rows[0]);
}


// DELETE /api/customers/:id
// Archive if they have purchase history, hard-delete otherwise.
async function deleteCustomer(req, res) {
  const hasPurchases = await pool.query(
    `SELECT 1
     FROM purchases
     WHERE customer_id = $1
     LIMIT 1`,
    [req.params.id]
  );

  if (hasPurchases.rows.length > 0) {
    await pool.query(
      'UPDATE customers SET active = false WHERE id = $1',
      [req.params.id]
    );

    return res.json({
      success: true,
      archived: true,
    });
  }

  await pool.query(
    'DELETE FROM customers WHERE id = $1',
    [req.params.id]
  );

  res.json({
    success: true,
    archived: false,
  });
}


// POST /api/customers/:id/restore
async function restoreCustomer(req, res) {
  await pool.query(
    'UPDATE customers SET active = true WHERE id = $1',
    [req.params.id]
  );

  res.json({
    success: true,
  });
}


// GET /api/customers/:id/bill?year=2026&month=8
// year/month are already guaranteed to be valid integers here by the
// validate(monthlyBillQuerySchema, 'query') middleware.
async function getMonthlyBill(req, res) {
  const { year, month } = req.query;

  const customer = await pool.query(
    'SELECT * FROM customers WHERE id = $1',
    [req.params.id]
  );

  if (customer.rows.length === 0) {
    return res.status(404).json({
      error: 'Customer not found',
    });
  }

  const items = await pool.query(
    `SELECT
        pr.name AS product,
        pr.unit,
        SUM(p.quantity) AS quantity,

        -- Weighted average price in case
        -- the rate changed during the month.
        ROUND(
          SUM(p.total_amount) / SUM(p.quantity),
          2
        ) AS avg_price,

        SUM(p.total_amount) AS subtotal

     FROM purchases p

     JOIN products pr
       ON pr.id = p.product_id

     WHERE p.customer_id = $1
       AND EXTRACT(YEAR FROM p.purchase_date) = $2
       AND EXTRACT(MONTH FROM p.purchase_date) = $3

     GROUP BY
       pr.id,
       pr.name,
       pr.unit

     ORDER BY pr.name`,
    [
      req.params.id,
      year,
      month,
    ]
  );

  const paymentsResult = await pool.query(
    `SELECT
        COALESCE(SUM(amount), 0) AS total
     FROM payments
     WHERE customer_id = $1
       AND EXTRACT(YEAR FROM payment_date) = $2
       AND EXTRACT(MONTH FROM payment_date) = $3`,
    [
      req.params.id,
      year,
      month,
    ]
  );

  const total = items.rows.reduce(
    (sum, i) => sum + parseFloat(i.subtotal),
    0
  );

  res.json({
    customer: customer.rows[0],
    year,
    month,
    items: items.rows,
    total: Math.round(total * 100) / 100,
    paidThisMonth: parseFloat(
      paymentsResult.rows[0].total
    ),
  });
}


module.exports = {
  getMonthlyBill,
  listCustomers,
  getCustomer,
  getPurchaseHistory,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  restoreCustomer,
};