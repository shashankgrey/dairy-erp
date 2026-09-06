const express = require('express');
const router = express.Router();
const { createPayment, listPaymentsForCustomer, deletePayment } = require('../controllers/paymentController');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { paymentBodySchema } = require('../validation/paymentSchemas');

router.use(requireAuth);

router.post('/', validate(paymentBodySchema), createPayment);
router.get('/customer/:customerId', listPaymentsForCustomer);
router.delete('/:id', deletePayment);

module.exports = router;