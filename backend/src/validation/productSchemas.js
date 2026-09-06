const { z } = require('zod');

// Kept as a plain string + refine (rather than z.enum) so the error
// message stays under our control regardless of Zod version, matching
// the exact wording the frontend/backend already used.
const statusField = z.string()
  .refine((v) => ['active', 'discontinued'].includes(v), {
    message: 'status must be active or discontinued',
  })
  .optional();

const movementTypeField = z.string()
  .refine((v) => ['restock', 'disposal', 'adjustment'].includes(v), {
    message: "movement_type must be 'restock', 'disposal', or 'adjustment'",
  });

// Shared by create and update.
const productBodySchema = z.object({
  name: z.string().trim().min(1, 'Product name is required'),
  unit: z.string().trim().min(1, 'Unit is required (e.g. litre, kg)'),
  default_price: z.coerce.number().positive('default_price must be greater than 0'),
  category: z.string().trim().optional().nullable(),
  supplier: z.string().trim().optional().nullable(),
  low_stock_threshold: z.coerce.number().nonnegative('low_stock_threshold cannot be negative').optional(),
  status: statusField,
});

const stockMovementSchema = z.object({
  movement_type: movementTypeField,
  quantity: z.coerce.number().refine((v) => v !== 0, { message: 'quantity is required and cannot be 0' }),
  expiry_date: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

module.exports = { productBodySchema, stockMovementSchema };