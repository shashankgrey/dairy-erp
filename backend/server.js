require('dotenv').config();

const { validateEnv } = require('./src/config/env');

validateEnv();

const app = require('./src/app');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(
    `Dairy ERP backend running on http://localhost:${PORT}`
  );
});