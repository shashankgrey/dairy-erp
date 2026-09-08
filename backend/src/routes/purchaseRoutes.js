const express = require('express');
const router = express.Router();
const { listPurchasesByDate, createPurchase, deletePurchase } = require('../controllers/purchaseController');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { purchaseBodySchema } = require('../validation/purchaseSchemas');
const asyncHandler = require('../middleware/asyncHandler');

router.use(requireAuth);
router.get('/', asyncHandler(listPurchasesByDate));
router.post('/', validate(purchaseBodySchema), asyncHandler(createPurchase));
router.delete('/:id', asyncHandler(deletePurchase));
module.exports = router;