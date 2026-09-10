const pool = require('../config/db');
const { verifyPayToken } = require('../utils/payToken');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pageShell(bodyHtml, headExtra = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Dairy ERP</title>
${headExtra}
<style>
  body {
    font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
    background: #F5F7F6;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 24px;
    box-sizing: border-box;
  }
  .card {
    background: #FFFFFF;
    border-radius: 16px;
    padding: 32px 24px;
    max-width: 420px;
    width: 100%;
    text-align: center;
    box-shadow: 0 4px 20px rgba(15,23,20,0.08);
  }
  .logo { font-size: 40px; margin-bottom: 8px; }
  h1 { font-size: 18px; color: #1E2A28; margin: 0 0 4px; }
  .amount { font-size: 32px; font-weight: 700; color: #0F5E4C; margin: 16px 0; }
  .to { color: #5B6B68; font-size: 14px; margin-bottom: 24px; }
  .pay-btn {
    display: block;
    background: #0F5E4C;
    color: #fff;
    text-decoration: none;
    font-weight: 600;
    font-size: 16px;
    padding: 14px;
    border-radius: 10px;
    margin-bottom: 16px;
  }
  .pay-btn:active { background: #0C4C3E; }
  .fallback {
    font-size: 12px;
    color: #5B6B68;
    background: #F5F7F6;
    border-radius: 8px;
    padding: 10px;
    word-break: break-all;
  }
</style>
</head>
<body>
  <div class="card">${bodyHtml}</div>
</body>
</html>`;
}

function renderErrorPage(res, message, status = 404) {
  res.status(status).send(pageShell(`
    <div class="logo">🥛</div>
    <h1>Dairy ERP</h1>
    <p style="color:#5B6B68;">${escapeHtml(message)}</p>
  `));
}

// GET /pay/:id/:token -- public, no login. Only reveals the customer's
// own name and amount owed, and only when the token matches -- never
// the customer's phone number, address, purchase history, or anything
// about other customers.
async function renderPayPage(req, res) {
  const { id, token } = req.params;

  if (!/^\d+$/.test(id) || !verifyPayToken(id, token)) {
    return renderErrorPage(res, 'This payment link is no longer valid.');
  }

  const customerResult = await pool.query(
    'SELECT full_name, outstanding_balance, active FROM customers WHERE id = $1',
    [id]
  );

  if (customerResult.rows.length === 0 || !customerResult.rows[0].active) {
    return renderErrorPage(res, 'This payment link is no longer valid.');
  }

  const customer = customerResult.rows[0];
  const amount = Number(customer.outstanding_balance);

  if (amount <= 0) {
    return res.send(pageShell(`
      <div class="logo">🎉</div>
      <h1>All paid up!</h1>
      <p style="color:#5B6B68;">Hi ${escapeHtml(customer.full_name)}, you have no outstanding balance right now. Thank you!</p>
    `));
  }

  const settingsResult = await pool.query('SELECT key, value FROM settings');
  const settings = {};
  for (const row of settingsResult.rows) settings[row.key] = row.value;

  if (!settings.shop_upi_id) {
    return renderErrorPage(res, 'Online payment is not set up yet. Please pay in person or contact the shop.', 200);
  }

  const payeeName = settings.shop_payee_name || 'Dairy Shop';

  const upiParams = new URLSearchParams({
    pa: settings.shop_upi_id,
    pn: payeeName,
    am: amount.toFixed(2),
    cu: 'INR',
    tn: `Payment from ${customer.full_name}`,
  });
  const upiLink = `upi://pay?${upiParams.toString()}`;

  const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const pageUrl = `${baseUrl}/pay/${id}/${token}`;
  const imageUrl = `${baseUrl}/pay-preview.png`;

  const title = `Pay ₹${amount.toLocaleString('en-IN')} to ${payeeName}`;
  const description = `Hi ${customer.full_name}, tap to pay your outstanding balance via GPay, PhonePe, or any UPI app.`;

  const headExtra = `
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:url" content="${pageUrl}" />
    <meta property="og:type" content="website" />
  `;

  res.send(pageShell(`
    <div class="logo">🥛</div>
    <h1>Dairy ERP</h1>
    <div class="to">Payment request for ${escapeHtml(customer.full_name)}</div>
    <div class="amount">₹${amount.toLocaleString('en-IN')}</div>
    <a class="pay-btn" href="${upiLink}">Pay Now with UPI</a>
    <div class="fallback">If the button doesn't open your payment app, pay manually to UPI ID: <strong>${escapeHtml(settings.shop_upi_id)}</strong></div>
  `, headExtra));
}

module.exports = { renderPayPage };