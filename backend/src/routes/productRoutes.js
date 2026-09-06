const express = require('express');
const router = express.Router();
const {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  addStockMovement,
  getStockHistory,
  listCategories,
} = require('../controllers/productController');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { productBodySchema, stockMovementSchema } = require('../validation/productSchemas');

router.use(requireAuth);

router.get('/categories', listCategories); // must come before '/:id' or it'll be treated as an id
router.get('/', listProducts);
router.get('/:id', getProduct);
router.post('/', validate(productBodySchema), createProduct);
router.put('/:id', validate(productBodySchema), updateProduct);
router.delete('/:id', deleteProduct);
router.post('/:id/stock', validate(stockMovementSchema), addStockMovement);
router.get('/:id/stock-history', getStockHistory);

module.exports = router;