const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Each user has a token_version. Changing the password bumps it, which
// signs out every device still holding an older login (important when
// the whole shop shares one login). The version is cached for a minute
// so normal requests don't hit the database every time.
const versionCache = new Map(); // userId -> { v, at }
const CACHE_MS = 60 * 1000;

async function currentTokenVersion(userId) {
  const hit = versionCache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.v;
  const r = await pool.query('SELECT token_version FROM users WHERE id = $1', [userId]);
  const v = r.rows.length ? r.rows[0].token_version : null; // null = user deleted
  versionCache.set(userId, { v, at: Date.now() });
  return v;
}

function forgetTokenVersion(userId) {
  versionCache.delete(userId);
}

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  try {
    const v = await currentTokenVersion(payload.id);
    // Logins issued before this feature carry no version: treat as 0.
    if (v === null || (payload.tv ?? 0) !== v) {
      return res.status(401).json({ error: 'Please log in again.' });
    }
  } catch (err) {
    return next(err);
  }
  req.user = payload;
  next();
}

module.exports = { requireAuth, forgetTokenVersion };
