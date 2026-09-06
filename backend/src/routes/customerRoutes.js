const express = require('express');
const router = express.Router();
const {
  listCustomers,
  getCustomer,
  getPurchaseHistory,
  getMonthlyBill,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  restoreCustomer,
} = require('../controllers/customerController');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { customerBodySchema, monthlyBillQuerySchema, purchaseHistoryQuerySchema } = require('../validation/customerSchemas');

router.use(requireAuth);

router.get('/', listCustomers);
router.get('/:id', getCustomer);
router.get('/:id/purchases', validate(purchaseHistoryQuerySchema, 'query'), getPurchaseHistory);
router.get('/:id/bill', validate(monthlyBillQuerySchema, 'query'), getMonthlyBill);
router.post('/', validate(customerBodySchema), createCustomer);
router.put('/:id', validate(customerBodySchema), updateCustomer);
router.post('/:id/restore', restoreCustomer);
router.delete('/:id', deleteCustomer);

module.exports = router;