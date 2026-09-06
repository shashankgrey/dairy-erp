const express = require('express');
const router = express.Router();
const { listPurchasesByDate, createPurchase, deletePurchase } = require('../controllers/purchaseController');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { purchaseBodySchema } = require('../validation/purchaseSchemas');

router.use(requireAuth);
router.get('/', listPurchasesByDate);
router.post('/', validate(purchaseBodySchema), createPurchase);
router.delete('/:id', deletePurchase);
module.exports = router;