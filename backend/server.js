require('dotenv').config();

const { validateEnv } = require('./src/config/env');

validateEnv();

const app = require('./src/app');
const { applySchema } = require('./src/config/applySchema');
const { startAutoScheduler } = require('./src/services/smsReminders');

const PORT = process.env.PORT || 4000;

async function start() {
  // Update the database first, so new code never meets an old schema.
  try {
    await applySchema();
    console.log('✓ Database schema is up to date');
  } catch (err) {
    // Stop here: Render then keeps the previous working version live
    // instead of switching to one that would fail on every request.
    console.error('✗ Could not update the database schema:', err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Dairy ERP backend running on http://localhost:${PORT}`);
    startAutoScheduler();
  });
}

start();
