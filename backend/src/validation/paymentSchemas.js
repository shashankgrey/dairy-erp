const { z } = require('zod');

const METHODS = ['cash', 'upi', 'bank', 'other'];

const paymentMethodField = z.string()
  .refine((v) => METHODS.includes(v), {
    message: 'payment_method must be cash, upi, bank, or other',
  })
  .optional();

const paymentBodySchema = z.object({
  customer_id: z.coerce.number().int().positive('customer_id and amount are required'),
  amount: z.coerce.number().positive('amount must be greater than 0'),
  payment_date: z.string().trim().optional().nullable(),
  payment_method: paymentMethodField,
  notes: z.string().trim().optional().nullable(),
});

module.exports = { paymentBodySchema };