const express = require('express');
const router = express.Router();
const controller = require('../controllers/supplierController');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { supplierBodySchema, supplierPurchaseBodySchema, supplierPaymentBodySchema } = require('../validation/supplierSchemas');

router.use(requireAuth);
router.get('/', controller.listSuppliers);
router.post('/', validate(supplierBodySchema), controller.createSupplier);
router.get('/:id', controller.getSupplier);
router.put('/:id', validate(supplierBodySchema), controller.updateSupplier);
router.get('/:id/purchases', controller.listSupplierPurchases);
router.post('/:id/purchases', validate(supplierPurchaseBodySchema), controller.createSupplierPurchase);
router.get('/:id/payments', controller.listSupplierPayments);
router.post('/:id/payments', validate(supplierPaymentBodySchema), controller.createSupplierPayment);
module.exports = router;