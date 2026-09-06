const { z } = require('zod');

const METHODS = ['cash', 'upi', 'bank', 'other'];

const paymentMethodField = z.string()
  .refine((v) => METHODS.includes(v), {
    message: 'payment_method must be cash, upi, bank, or other',
  })
  .optional();

// Shared by create and update. Mirrors the customer schema's format
// rules (10-digit mobile, valid email) since SupplierFormModal already
// enforces these client-side -- this closes the same gap we found and
// fixed for suppliers before: nothing previously stopped a non-browser
// client from sending a malformed mobile number or email.
const supplierBodySchema = z.object({
  full_name: z.string().trim().min(1, 'Supplier name is required'),
  mobile_number: z.union([
    z.string().trim().regex(/^\d{10}$/, 'Mobile number must be exactly 10 digits'),
    z.literal(''),
  ]).optional().nullable(),
  address: z.string().trim().optional().nullable(),
  email: z.union([
    z.string().trim().email('Enter a valid email address'),
    z.literal(''),
  ]).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

// POST /:id/purchases -- recording stock received from a supplier.
const supplierPurchaseBodySchema = z.object({
  product_id: z.coerce.number().int().positive('product_id is required'),
  quantity: z.coerce.number().positive('Quantity must be positive'),
  unit_cost: z.coerce.number().nonnegative('Unit cost cannot be negative'),
  purchase_date: z.string().trim().optional().nullable(),
  expiry_date: z.string().trim().optional().nullable(),
  invoice_number: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

// POST /:id/payments -- paying a supplier down.
const supplierPaymentBodySchema = z.object({
  amount: z.coerce.number().positive('A positive payment amount is required'),
  payment_date: z.string().trim().optional().nullable(),
  payment_method: paymentMethodField,
  reference_number: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

module.exports = { supplierBodySchema, supplierPurchaseBodySchema, supplierPaymentBodySchema };