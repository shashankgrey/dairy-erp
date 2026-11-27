const { z } = require('zod');

// Purchases support two independent "permanent vs temporary" toggles:
//   - customer: either a real customer_id, or a walk_in_customer_name
//   - product: either a real product_id, or a custom_product_name +
//     custom_unit + unit_price (since there's no catalog price to fall
//     back on for a one-off item)
// superRefine lets us express these cross-field rules with the exact
// same error messages the controller used to produce by hand.
const purchaseBodySchema = z.object({
  customer_id: z.coerce.number().int().positive().optional().nullable(),
  walk_in_customer_name: z.string().trim().optional().nullable(),
  product_id: z.coerce.number().int().positive().optional().nullable(),
  custom_product_name: z.string().trim().optional().nullable(),
  custom_unit: z.string().trim().optional().nullable(),
  quantity: z.coerce.number().positive('quantity must be greater than 0'),
  purchase_date: z.string().trim().min(1, 'purchase_date is required'),
  unit_price: z.coerce.number().positive('unit_price must be greater than 0').optional().nullable(),
}).superRefine((data, ctx) => {
  if (!data.customer_id && !data.walk_in_customer_name) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['customer_id'],
      message: 'Select a customer or enter a name for a one-time customer',
    });
  }
  if (!data.product_id && !data.custom_product_name) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['product_id'],
      message: 'Select a product or enter a name for a one-off item',
    });
  }
  if (!data.product_id) {
    if (data.unit_price == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['unit_price'],
        message: 'unit_price is required for a one-off item',
      });
    }
    if (!data.custom_unit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['custom_unit'],
        message: 'A unit (e.g. litre, kg, piece) is required for a one-off item',
      });
    }
  }
});

// ---- Tap-to-bill: a whole basket for one customer in one save ----
const dateString = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Please use a valid date');
const billQuantity = z.coerce.number()
  .refine((v) => Math.round(v * 100) >= 1, { message: 'Quantity must be at least 0.01' })
  .refine((v) => v <= 10000, { message: 'That quantity is too large' });

const billBodySchema = z.object({
  customer_id: z.coerce.number().int().positive().optional().nullable(),
  walk_in_customer_name: z.string().trim().optional().nullable(),
  purchase_date: dateString,
  items: z.array(z.object({
    product_id: z.coerce.number().int().positive(),
    quantity: billQuantity,
  })).min(1, 'Add at least one item to the bill').max(60, 'Too many items in one bill'),
}).superRefine((d, ctx) => {
  if (!d.customer_id && !d.walk_in_customer_name) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customer_id'], message: 'Select a customer first' });
  }
});

const lastBillQuerySchema = z.object({
  customer_id: z.coerce.number().int().positive(),
  before: dateString,
});

const undoBillSchema = z.object({
  purchase_ids: z.array(z.coerce.number().int().positive()).min(1, 'Nothing to undo').max(60),
});

module.exports = { purchaseBodySchema, billBodySchema, lastBillQuerySchema, undoBillSchema };