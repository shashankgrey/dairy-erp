const pool = require('../config/db');

// GET /api/products?search=&category=&status=&lowStockOnly=true
async function listProducts(req, res) {
  const {
    search = '',
    category = '',
    status = '',
    lowStockOnly = 'false'
  } = req.query;

  const conditions = [];
  const params = [];

  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    conditions.push(`
      (
        name ILIKE $${params.length}
        OR supplier ILIKE $${params.length}
      )
    `);
  }

  if (category.trim()) {
    params.push(category.trim());
    conditions.push(`category = $${params.length}`);
  }

  if (status.trim()) {
    params.push(status.trim());
    conditions.push(`status = $${params.length}`);
  }

  if (lowStockOnly === 'true') {
    conditions.push(
      'available_stock <= low_stock_threshold'
    );
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const result = await pool.query(
    `
    SELECT
      *,
      (available_stock <= low_stock_threshold) AS is_low_stock
    FROM products
    ${whereClause}
    ORDER BY name
    `,
    params
  );

  res.json(result.rows);
}


// GET /api/products/:id
async function getProduct(req, res) {
  const result = await pool.query(
    `
    SELECT
      *,
      (available_stock <= low_stock_threshold) AS is_low_stock
    FROM products
    WHERE id = $1
    `,
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      error: 'Product not found'
    });
  }

  res.json(result.rows[0]);
}


// POST /api/products
// name/unit/default_price/status are already guaranteed valid here by
// the validate(productBodySchema) middleware.
async function createProduct(req, res) {
  const {
    name,
    unit,
    default_price,
    category,
    supplier,
    low_stock_threshold,
    status
  } = req.body;

  const result = await pool.query(
    `
    INSERT INTO products (
      name,
      unit,
      default_price,
      category,
      supplier,
      low_stock_threshold,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
    `,
    [
      name,
      unit,
      default_price,
      category || null,
      supplier || null,
      low_stock_threshold ?? 5,
      status || 'active'
    ]
  );

  res.status(201).json(result.rows[0]);
}


// PUT /api/products/:id
async function updateProduct(req, res) {
  const {
    name,
    unit,
    default_price,
    category,
    supplier,
    low_stock_threshold,
    status
  } = req.body;

  const result = await pool.query(
    `
    UPDATE products
    SET
      name = $1,
      unit = $2,
      default_price = $3,
      category = $4,
      supplier = $5,
      low_stock_threshold = $6,
      status = COALESCE($7, status)
    WHERE id = $8
    RETURNING *
    `,
    [
      name,
      unit,
      default_price,
      category || null,
      supplier || null,
      low_stock_threshold ?? 5,
      status || null,
      req.params.id
    ]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      error: 'Product not found'
    });
  }

  res.json(result.rows[0]);
}


// DELETE /api/products/:id
async function deleteProduct(req, res) {
  const hasPurchases = await pool.query(
    `
    SELECT 1
    FROM purchases
    WHERE product_id = $1
    LIMIT 1
    `,
    [req.params.id]
  );

  if (hasPurchases.rows.length > 0) {
    return res.status(409).json({
      error:
        'Cannot delete a product that has purchase history. Set its status to Discontinued instead.'
    });
  }

  const result = await pool.query(
    `
    DELETE FROM products
    WHERE id = $1
    RETURNING *
    `,
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      error: 'Product not found'
    });
  }

  res.json({
    success: true
  });
}


// POST /api/products/:id/stock
// body:
// {
//   movement_type: 'restock' | 'disposal' | 'adjustment',
//   quantity,
//   expiry_date?,
//   notes?
// }
// movement_type/quantity are already guaranteed valid here by the
// validate(stockMovementSchema) middleware -- this only needs to
// handle the business rule (can't reduce stock below zero).
async function addStockMovement(req, res) {
  const client = await pool.connect();

  try {
    const {
      movement_type,
      quantity,
      expiry_date,
      notes
    } = req.body;

    let signedQuantity = Math.abs(Number(quantity));

    if (movement_type === 'disposal') {
      signedQuantity = -signedQuantity;
    }

    if (movement_type === 'adjustment') {
      signedQuantity = Number(quantity);
    }

    await client.query('BEGIN');

    const product = await client.query(
      `
      SELECT *
      FROM products
      WHERE id = $1
      FOR UPDATE
      `,
      [req.params.id]
    );

    if (product.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        error: 'Product not found'
      });
    }

    const currentStock = Number(
      product.rows[0].available_stock
    );

    const newStock =
      currentStock + signedQuantity;

    if (newStock < 0) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        error:
          'Cannot reduce stock below zero'
      });
    }

    const movement = await client.query(
      `
      INSERT INTO stock_movements (
        product_id,
        movement_type,
        quantity,
        expiry_date,
        notes
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        req.params.id,
        movement_type,
        signedQuantity,
        expiry_date || null,
        notes || null
      ]
    );

    // The stock_movements database trigger applies the change atomically.
    const updated = await client.query('SELECT * FROM products WHERE id = $1', [req.params.id]);

    await client.query('COMMIT');

    res.json({
      movement: movement.rows[0],
      product: updated.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error; // forwarded to the central errorHandler
  } finally {
    client.release();
  }
}


// GET /api/products/:id/stock-history
async function getStockHistory(req, res) {
  const result = await pool.query(
    `
    SELECT *
    FROM stock_movements
    WHERE product_id = $1
    ORDER BY created_at DESC
    `,
    [req.params.id]
  );

  res.json(result.rows);
}


// GET /api/products/categories
async function listCategories(req, res) {
  const result = await pool.query(
    `
    SELECT DISTINCT category
    FROM products
    WHERE category IS NOT NULL
      AND category <> ''
    ORDER BY category
    `
  );

  res.json(
    result.rows.map(row => row.category)
  );
}


module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  addStockMovement,
  getStockHistory,
  listCategories
};