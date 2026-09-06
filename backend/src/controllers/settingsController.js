const pool = require('../config/db');

// Known settings and their defaults, so the frontend never has to
// handle a missing key -- a fresh install with an empty settings
// table still gets a complete, predictable shape back.
const DEFAULTS = {
  shop_upi_id: '',
  shop_payee_name: '',
};

async function getSettings(req, res) {
  const result = await pool.query('SELECT key, value FROM settings');
  const settings = { ...DEFAULTS };
  for (const row of result.rows) {
    settings[row.key] = row.value;
  }
  res.json(settings);
}

// body/query is already guaranteed to only contain recognized keys
// with valid formats here by validate(settingsBodySchema).
async function updateSettings(req, res) {
  const entries = Object.entries(req.body);
  for (const [key, value] of entries) {
    await pool.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value]
    );
  }

  const result = await pool.query('SELECT key, value FROM settings');
  const settings = { ...DEFAULTS };
  for (const row of result.rows) {
    settings[row.key] = row.value;
  }
  res.json(settings);
}

module.exports = { getSettings, updateSettings };