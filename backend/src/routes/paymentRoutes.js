const express = require('express');
const router = express.Router();
const { createPayment, listPaymentsForCustomer, deletePayment } = require('../controllers/paymentController');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { paymentBodySchema } = require('../validation/paymentSchemas');
const asyncHandler = require('../middleware/asyncHandler');

router.use(requireAuth);

router.post('/', validate(paymentBodySchema), asyncHandler(createPayment));
router.get('/customer/:customerId', asyncHandler(listPaymentsForCustomer));
router.delete('/:id', asyncHandler(deletePayment));

module.exports = router;