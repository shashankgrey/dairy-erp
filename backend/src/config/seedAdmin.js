// Run with: node src/config/seedAdmin.js
const bcrypt = require('bcryptjs');
const pool = require('./db');
require('dotenv').config();

async function seed() {
  const name = process.env.SEED_ADMIN_NAME || 'Admin';
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@dairy.local';
  const password = process.env.SEED_ADMIN_PASSWORD || 'admin123';

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    console.log(`Account already exists for ${email} -- skipping.`);
    await pool.end();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)',
    [name, email, passwordHash]
  );
  console.log(`Account created: ${email}`);
  await pool.end();
}

seed();