// Run with: npm run migrate   (or: node src/config/migrate.js)
// The server also does this by itself every time it starts.
const pool = require('./db');
const { applySchema } = require('./applySchema');

async function migrate() {
  try {
    await applySchema();
    console.log('✓ Schema applied successfully');
  } catch (err) {
    console.error('✗ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
