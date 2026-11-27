const express = require('express');
const router = express.Router();
const { listPurchasesByDate, createPurchase, deletePurchase, createBill, getLastBill, undoBill } = require('../controllers/purchaseController');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { purchaseBodySchema, billBodySchema, lastBillQuerySchema, undoBillSchema } = require('../validation/purchaseSchemas');
const asyncHandler = require('../middleware/asyncHandler');

router.use(requireAuth);
router.get('/', asyncHandler(listPurchasesByDate));
router.get('/last-bill', validate(lastBillQuerySchema, 'query'), asyncHandler(getLastBill));
router.post('/bill', validate(billBodySchema), asyncHandler(createBill));
router.post('/bill/undo', validate(undoBillSchema), asyncHandler(undoBill));
router.post('/', validate(purchaseBodySchema), asyncHandler(createPurchase));
router.delete('/:id', asyncHandler(deletePurchase));
module.exports = router;