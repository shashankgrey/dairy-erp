const { z } = require('zod');

// Deliberately loose: login shouldn't reject a real existing account
// just because its email looks unusual. A malformed email simply won't
// match any user and correctly falls through to "Invalid email or
// password" already -- no need for format validation on this path.
const loginSchema = z.object({
  email: z.string().trim().min(1, 'email and password are required'),
  password: z.string().min(1, 'email and password are required'),
});

// This is the account-creation path, so stricter rules are appropriate
// here. Note: this adds a minimum password length (6 chars) that did
// NOT exist in the original controller -- previously password: "a"
// would have succeeded. Flagging this as new, not a pre-existing rule.
const createUserSchema = z.object({
  name: z.string().trim().min(1, 'name, email and password are required'),
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

module.exports = { loginSchema, createUserSchema };