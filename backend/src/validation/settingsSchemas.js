const { z } = require('zod');

// Partial updates are allowed (send only the keys you're changing),
// but at least one recognized key must be present. UPI VPA format:
// alphanumeric/dot/hyphen/underscore, an @, then the handle (bank/app
// code) -- matches the standard NPCI UPI ID pattern, e.g. shop@okhdfcbank.
const settingsBodySchema = z.object({
  shop_upi_id: z.union([
    z.string().trim().regex(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/, 'Enter a valid UPI ID (e.g. yourshop@okhdfcbank)'),
    z.literal(''),
  ]).optional(),
  shop_payee_name: z.string().trim().min(1, 'Payee name cannot be empty').optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'No settings provided' });

module.exports = { settingsBodySchema };