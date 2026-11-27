const fs = require('fs');
const path = require('path');
const pool = require('./db');

// Brings the database up to date with schema.sql. Every statement in it
// is safe to run again (CREATE ... IF NOT EXISTS, ADD COLUMN IF NOT
// EXISTS, CREATE OR REPLACE), so this runs on every server start: a new
// column can never be missing on staging or production because someone
// forgot to run the migration. The lock stops two starting servers from
// applying it at the same moment.
const SCHEMA_LOCK = 74200;

async function applySchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [SCHEMA_LOCK]);
    await client.query(sql);
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [SCHEMA_LOCK]).catch(() => {});
    client.release();
  }
}

module.exports = { applySchema };
