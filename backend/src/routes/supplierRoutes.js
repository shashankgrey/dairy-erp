const express = require('express');
const router = express.Router();
const controller = require('../controllers/supplierController');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { supplierBodySchema, supplierPurchaseBodySchema, supplierPaymentBodySchema } = require('../validation/supplierSchemas');
const asyncHandler = require('../middleware/asyncHandler');

router.use(requireAuth);
router.get('/', asyncHandler(controller.listSuppliers));
router.post('/', validate(supplierBodySchema), asyncHandler(controller.createSupplier));
router.get('/:id', asyncHandler(controller.getSupplier));
router.put('/:id', validate(supplierBodySchema), asyncHandler(controller.updateSupplier));
router.get('/:id/purchases', asyncHandler(controller.listSupplierPurchases));
router.post('/:id/purchases', validate(supplierPurchaseBodySchema), asyncHandler(controller.createSupplierPurchase));
router.get('/:id/payments', asyncHandler(controller.listSupplierPayments));
router.post('/:id/payments', validate(supplierPaymentBodySchema), asyncHandler(controller.createSupplierPayment));
module.exports = router;