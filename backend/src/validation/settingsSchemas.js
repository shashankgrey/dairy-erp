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
  shop_payee_name: z.string().trim().min(1, 'Shop name cannot be empty').max(40, 'Keep the shop name under 40 characters').optional(),
  shop_phone: z.union([
    z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit mobile number'),
    z.literal(''),
  ]).optional(),
  sms_auto_enabled: z.enum(['true', 'false']).optional(),
  sms_auto_day: z.coerce.number().int().min(1, 'Pick a day from 1 to 28').max(28, 'Pick a day from 1 to 28')
    .transform(String).optional(),
  summary_enabled: z.enum(['true', 'false']).optional(),
  summary_phone: z.union([
    z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit mobile number'),
    z.literal(''),
  ]).optional(),
  summary_hour: z.coerce.number().int().min(17, 'Pick a time between 5 PM and 11 PM').max(23, 'Pick a time between 5 PM and 11 PM')
    .transform(String).optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'No settings provided' });

module.exports = { settingsBodySchema };