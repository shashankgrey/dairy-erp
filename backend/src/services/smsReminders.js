const pool = require('../config/db');
const { sendSms, smsMode } = require('../utils/fast2sms');

// The shop's clock is India time, whatever timezone the server runs in.
function istParts(date = new Date()) {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const iso = ist.toISOString();
  return { day: ist.getUTCDate(), period: iso.slice(0, 7), today: iso.slice(0, 10) };
}

// Indian mobile -> 10 digits starting 6-9, or null.
function normalizeMobile(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

async function getSmsSettings(db = pool) {
  const r = await db.query(
    `SELECT key, value FROM settings WHERE key IN
     ('shop_payee_name','shop_upi_id','shop_phone','sms_auto_enabled','sms_auto_day')`
  );
  const s = Object.fromEntries(r.rows.map((x) => [x.key, x.value]));
  const day = parseInt(s.sms_auto_day, 10);
  return {
    shopName: (s.shop_payee_name || '').trim() || 'Sri Sai Esha Dairy Products',
    upiId: (s.shop_upi_id || '').trim(),
    shopPhone: (s.shop_phone || '').trim(),
    autoEnabled: s.sms_auto_enabled === 'true',
    autoDay: day >= 1 && day <= 28 ? day : 1,
  };
}

const fmtAmount = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
function fmtDate(isoDay) {
  const [y, m, d] = isoDay.split('-');
  return `${d}-${m}-${y}`;
}

// The 4 variables, in the exact order of the DLT template below.
function buildVariables(customer, settings, today) {
  const payTo = settings.upiId ? `UPI ${settings.upiId}` : settings.shopPhone || 'the shop';
  return [String(customer.full_name).slice(0, 30), fmtAmount(customer.outstanding_balance), fmtDate(today), payTo.slice(0, 30)];
}

// Register this exact text on the DLT portal (with {#var#} placeholders).
function templateText(settings) {
  return `Dear {#var#}, your dairy bill of Rs.{#var#} is pending as on {#var#}. Kindly pay to {#var#}. Thank you - ${settings.shopName}`;
}

function renderText(settings, vars) {
  let i = 0;
  return templateText(settings).replace(/\{#var#\}/g, () => vars[i++]);
}

// Active customers who owe money, with when they were last texted this month.
async function owingCustomers(period, db = pool) {
  const r = await db.query(
    `SELECT c.id, c.full_name, c.mobile_number, c.outstanding_balance,
            last.created_at AS last_sms_at, last.status AS last_sms_status
     FROM customers c
     LEFT JOIN LATERAL (
       SELECT created_at, status FROM sms_reminders s
       WHERE s.customer_id = c.id AND s.period = $1
       ORDER BY s.id DESC LIMIT 1
     ) last ON true
     WHERE c.active AND c.outstanding_balance > 0
     ORDER BY c.outstanding_balance DESC`,
    [period]
  );
  return r.rows.map((c) => ({ ...c, mobile: normalizeMobile(c.mobile_number) }));
}

// Sends one by one (a shop has tens of customers, not thousands) and
// records every attempt, so a failure for one never stops the rest.
async function sendReminders(customers, trigger, { now = new Date(), db = pool } = {}) {
  const { period, today } = istParts(now);
  const settings = await getSmsSettings(db);
  const mode = smsMode();
  const summary = { mode, sent: 0, test: 0, failed: 0, skipped: 0, failures: [] };

  for (const c of customers) {
    const mobile = normalizeMobile(c.mobile_number);
    if (!mobile) { summary.skipped += 1; continue; }
    const variables = buildVariables(c, settings, today);
    const text = renderText(settings, variables);
    const result = await sendSms({ mobile, text, variables });
    await db.query(
      `INSERT INTO sms_reminders (customer_id, mobile, amount, message, status, error, provider_request_id, trigger, period, mode)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [c.id, mobile, c.outstanding_balance, text, result.status, result.error || null, result.requestId || null, trigger, period, mode]
    );
    summary[result.status] += 1;
    if (!result.ok) summary.failures.push({ name: c.full_name, error: result.error });
  }
  return summary;
}

// Monthly automatic run. Safe to call as often as you like (every few
// minutes from the server, or from an outside cron): it only sends once
// per month, on or after the chosen day, and an advisory lock stops two
// server instances from sending at the same moment.
const AUTO_LOCK_KEY = 74201;
async function runAutoIfDue({ now = new Date() } = {}) {
  const settings = await getSmsSettings();
  if (!settings.autoEnabled) return { ran: false, reason: 'Automatic SMS is turned off' };
  const { day, period } = istParts(now);
  if (day < settings.autoDay) return { ran: false, reason: `Waiting for day ${settings.autoDay}` };

  const client = await pool.connect();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [AUTO_LOCK_KEY]);
    if (!lock.rows[0].ok) return { ran: false, reason: 'Another run is in progress' };
    try {
      const done = await client.query(
        `SELECT 1 FROM sms_reminders WHERE trigger = 'auto' AND period = $1 LIMIT 1`, [period]
      );
      if (done.rows.length) return { ran: false, reason: 'Already sent this month' };
      const customers = (await owingCustomers(period, client)).filter((c) => c.mobile);
      if (!customers.length) {
        // Record that the month was handled even with nobody owing.
        await client.query(
          `INSERT INTO sms_reminders (status, trigger, period, mode, message) VALUES ('test','auto',$1,$2,'No customers owed money')`,
          [period, smsMode()]
        );
        return { ran: true, summary: { sent: 0, test: 0, failed: 0, skipped: 0 } };
      }
      const summary = await sendReminders(customers, 'auto', { now, db: client });
      console.log(`[sms] automatic reminders for ${period}:`, JSON.stringify(summary));
      return { ran: true, summary };
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [AUTO_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

function startAutoScheduler() {
  const tick = () => {
    runAutoIfDue().catch((err) => console.error('[sms] automatic run failed:', err.message));
    require('./dailySummary').runSummaryIfDue()
      .catch((err) => console.error('[sms] daily summary failed:', err.message));
  };
  setTimeout(tick, 60 * 1000); // shortly after start-up (Render wakes from sleep)
  setInterval(tick, 15 * 60 * 1000);
}

module.exports = {
  istParts, normalizeMobile, getSmsSettings, buildVariables, templateText, renderText,
  owingCustomers, sendReminders, runAutoIfDue, startAutoScheduler,
};
