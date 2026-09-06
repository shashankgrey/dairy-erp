const { z } = require('zod');

// Shared by both create and update -- this is the single source of
// truth for what a valid customer looks like, matching what the
// frontend's CustomerFormModal already validates client-side. Previously
// the backend only checked that full_name/mobile_number were non-empty,
// so a non-browser client could send a malformed mobile number or email
// straight through.
const customerBodySchema = z.object({
  full_name: z.string().trim().min(1, 'Full name is required'),
  mobile_number: z.string().trim().regex(/^\d{10}$/, 'Mobile number must be exactly 10 digits'),
  address: z.string().trim().optional().nullable(),
  email: z.union([
    z.string().trim().email('Enter a valid email address'),
    z.literal(''),
  ]).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

const monthlyBillQuerySchema = z.object({
  year: z.coerce.number().int().min(2000, 'Enter a valid year').max(2100, 'Enter a valid year'),
  month: z.coerce.number().int().min(1, 'Month must be between 1 and 12').max(12, 'Month must be between 1 and 12'),
});

// GET /:id/purchases -- all fields optional, since the base "no
// filters" case (just page/limit) must keep working exactly as before.
const purchaseHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  product_id: z.coerce.number().int().positive().optional(),
  from_date: z.string().trim().optional(),
  to_date: z.string().trim().optional(),
});

module.exports = { customerBodySchema, monthlyBillQuerySchema, purchaseHistoryQuerySchema };