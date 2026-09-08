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
const asyncHandler = require('../middleware/asyncHandler');

router.use(requireAuth);

router.get('/', asyncHandler(listCustomers));
router.get('/:id', asyncHandler(getCustomer));
router.get('/:id/purchases', validate(purchaseHistoryQuerySchema, 'query'), asyncHandler(getPurchaseHistory));
router.get('/:id/bill', validate(monthlyBillQuerySchema, 'query'), asyncHandler(getMonthlyBill));
router.post('/', validate(customerBodySchema), asyncHandler(createCustomer));
router.put('/:id', validate(customerBodySchema), asyncHandler(updateCustomer));
router.post('/:id/restore', asyncHandler(restoreCustomer));
router.delete('/:id', asyncHandler(deleteCustomer));

module.exports = router;