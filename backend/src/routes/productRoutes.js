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
const asyncHandler = require('../middleware/asyncHandler');

router.use(requireAuth);

router.get('/categories', asyncHandler(listCategories)); // must come before '/:id' or it'll be treated as an id
router.get('/', asyncHandler(listProducts));
router.get('/:id', asyncHandler(getProduct));
router.post('/', validate(productBodySchema), asyncHandler(createProduct));
router.put('/:id', validate(productBodySchema), asyncHandler(updateProduct));
router.delete('/:id', asyncHandler(deleteProduct));
router.post('/:id/stock', validate(stockMovementSchema), asyncHandler(addStockMovement));
router.get('/:id/stock-history', asyncHandler(getStockHistory));

module.exports = router;