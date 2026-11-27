const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { forgetTokenVersion } = require('../middleware/auth');

// How long a login lasts before it asks again. 30 days by default so the
// shop tablet doesn't ask every morning; Log out still ends it at once.
const LOGIN_DURATION = process.env.JWT_EXPIRES_IN || '30d';

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, tv: user.token_version ?? 0 },
    process.env.JWT_SECRET,
    { expiresIn: LOGIN_DURATION }
  );
}

// email/password presence is already guaranteed here by
// validate(loginSchema) -- this only needs to handle the DB-dependent
// lookup and credential check.
async function login(req, res) {
  const { email, password } = req.body;

  const result = await pool.query('SELECT * FROM users WHERE lower(email) = lower($1)', [email.trim()]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) return res.status(401).json({ error: 'Invalid email or password' });

  const token = signToken(user);

  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
}

// name/email/password are already guaranteed valid here (including the
// new minimum password length) by validate(createUserSchema).
async function createUser(req, res) {
  const { name, email, password } = req.body;

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'A user with this email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
    [name, email, passwordHash]
  );
  res.status(201).json(result.rows[0]);
}

// POST /api/auth/change-password
// A wrong current password answers 400, not 401: a 401 would make the
// app treat it as an expired login and throw the owner out.
async function changePassword(req, res) {
  const { current_password, new_password, new_email } = req.body;
  const r = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const user = r.rows[0];
  if (!user) return res.status(404).json({ error: 'Account not found' });

  const ok = await bcrypt.compare(current_password, user.password_hash);
  if (!ok) return res.status(400).json({ error: 'Current password is not correct' });

  const email = new_email && new_email !== user.email ? new_email : user.email;
  if (email !== user.email) {
    const taken = await pool.query('SELECT 1 FROM users WHERE email = $1 AND id <> $2', [email, user.id]);
    if (taken.rows.length) return res.status(409).json({ error: 'That email is already used by another account' });
  }

  const hash = await bcrypt.hash(new_password, 10);
  const u = await pool.query(
    `UPDATE users SET password_hash = $1, email = $2, token_version = token_version + 1
     WHERE id = $3 RETURNING id, name, email, token_version`,
    [hash, email, user.id]
  );
  forgetTokenVersion(user.id);
  const updated = u.rows[0];
  // A fresh login for this device; every other device is signed out.
  res.json({ token: signToken(updated), user: { id: updated.id, name: updated.name, email: updated.email } });
}

module.exports = { login, createUser, changePassword };