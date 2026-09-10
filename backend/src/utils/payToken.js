const crypto = require('crypto');

// Generates a short, non-guessable token tied to a customer ID, using
// JWT_SECRET as the signing key. This is what makes the public /pay
// page safe to expose without login: a raw sequential customer ID in
// the URL would let anyone enumerate other customers' names and
// amounts just by incrementing the number. The token can't be
// forged or guessed without knowing JWT_SECRET, and doesn't require
// storing anything new in the database -- it's recomputed and
// verified on the fly.
function generatePayToken(customerId) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(String(customerId))
    .digest('hex')
    .slice(0, 16);
}

function verifyPayToken(customerId, token) {
  if (!token) return false;
  const expected = Buffer.from(generatePayToken(customerId));
  const given = Buffer.from(String(token));
  if (expected.length !== given.length) return false;
  return crypto.timingSafeEqual(expected, given);
}

module.exports = { generatePayToken, verifyPayToken };