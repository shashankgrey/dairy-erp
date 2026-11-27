// Thin Fast2SMS client. Three modes, chosen by SMS_MODE:
//   test  (default) -- nothing is sent; the message is only recorded.
//                      Safe for local dev and staging.
//   quick -- Fast2SMS "Quick SMS" route. No DLT needed, ~Rs.7/SMS.
//            Only for trying a few real messages before DLT approval.
//   dlt   -- the real, cheap route (~Rs.0.25/SMS). Needs the DLT-approved
//            sender ID and template ID in FAST2SMS_SENDER_ID /
//            FAST2SMS_TEMPLATE_ID.
const API_URL = 'https://www.fast2sms.com/dev/bulkV2';

function smsMode() {
  const m = (process.env.SMS_MODE || 'test').trim().toLowerCase();
  return ['test', 'quick', 'dlt'].includes(m) ? m : 'test';
}

// What is missing for the current mode to actually work.
function missingConfig(mode = smsMode(), templateEnv = 'FAST2SMS_TEMPLATE_ID') {
  if (mode === 'test') return [];
  const need = ['FAST2SMS_API_KEY'];
  if (mode === 'dlt') need.push('FAST2SMS_SENDER_ID', templateEnv);
  return need.filter((k) => !process.env[k] || !process.env[k].trim());
}

// DLT variables are pipe-separated, so a value must never contain '|'.
const clean = (v) => String(v ?? '').replace(/\|/g, '/').trim();

// Returns { ok, status: 'sent'|'failed'|'test', requestId?, error? }.
// templateEnv: which env var holds the DLT template ID (reminder vs summary).
async function sendSms({ mobile, text, variables, templateEnv = 'FAST2SMS_TEMPLATE_ID' }) {
  const mode = smsMode();
  if (mode === 'test') return { ok: true, status: 'test' };

  const missing = missingConfig(mode, templateEnv);
  if (missing.length) return { ok: false, status: 'failed', error: `SMS not configured: ${missing.join(', ')}` };

  const body = mode === 'dlt'
    ? {
        route: 'dlt',
        sender_id: process.env.FAST2SMS_SENDER_ID.trim(),
        message: process.env[templateEnv].trim(),
        variables_values: variables.map(clean).join('|'),
        flash: 0,
        numbers: mobile,
      }
    : { route: 'q', message: text, flash: 0, numbers: mobile };

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { authorization: process.env.FAST2SMS_API_KEY.trim(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.return === true) {
      return { ok: true, status: 'sent', requestId: data.request_id || null };
    }
    const msg = Array.isArray(data.message) ? data.message.join(' ') : data.message;
    return { ok: false, status: 'failed', error: msg || `Fast2SMS error (HTTP ${res.status})` };
  } catch (err) {
    return { ok: false, status: 'failed', error: err.name === 'TimeoutError' ? 'Fast2SMS did not respond in time' : err.message };
  }
}

module.exports = { sendSms, smsMode, missingConfig };
