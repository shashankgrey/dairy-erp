// Fails fast at startup if required environment variables are missing,
// instead of letting the app start successfully and then fail later
// with a confusing error buried inside a request (e.g. jwt.sign()
// throwing "secretOrPrivateKey must have a value" on the first login
// attempt, with no indication that JWT_SECRET was the problem).

const REQUIRED = ['JWT_SECRET'];
const RECOMMENDED = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];

function validateEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key] || !process.env[key].trim());
  if (missing.length > 0) {
    console.error('\nMissing required environment variable(s):');
    missing.forEach((key) => console.error(`   - ${key}`));
    console.error('\nAdd these to backend\\.env before starting the server.\n');
    process.exit(1);
  }

  // Cloud Postgres (Neon, Render, etc.) uses a single DATABASE_URL
  // instead of the discrete DB_* variables -- only warn about missing
  // discrete vars when DATABASE_URL isn't set as the alternative.
  if (!process.env.DATABASE_URL) {
    const usingDefaults = RECOMMENDED.filter((key) => !process.env[key] || !process.env[key].trim());
    if (usingDefaults.length > 0) {
      console.warn('\nUsing built-in defaults for:', usingDefaults.join(', '));
      console.warn('(fine for local dev, but set these explicitly -- or set DATABASE_URL -- for anything else)\n');
    }
  }
}

module.exports = { validateEnv };