const { Pool } = require('pg');
require('dotenv').config();

// Cloud Postgres providers (Neon, Render, Supabase, etc.) give you a
// single connection string instead of separate host/user/password --
// DATABASE_URL is the near-universal env var name for that. Falls back
// to the original discrete-variable config for local development,
// so nothing changes for your current local setup.
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // required by most hosted Postgres providers
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'dairy_erp',
    });

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error on idle client', err);
});

module.exports = pool;