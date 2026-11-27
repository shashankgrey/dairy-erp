const pool = require('../config/db');
const { sendSms, smsMode, missingConfig } = require('../utils/fast2sms');
const { istParts, getSmsSettings, normalizeMobile } = require('./smsReminders');

const TEMPLATE_ENV = 'FAST2SMS_SUMMARY_TEMPLATE_ID';
const num = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

async function getSummarySettings(db = pool) {
  const r = await db.query(
    `SELECT key, value FROM settings WHERE key IN ('summary_enabled','summary_phone','summary_hour')`
  );
  const s = Object.fromEntries(r.rows.map((x) => [x.key, x.value]));
  const hour = parseInt(s.summary_hour, 10);
  return {
    enabled: s.summary_enabled === 'true',
    phone: (s.summary_phone || '').trim(),
    hour: hour >= 17 && hour <= 23 ? hour : 21,
  };
}

// The day's numbers. Milk is counted in litres, from products whose
// name or category says milk -- so curd, paneer etc. are not mixed in.
async function getDayFigures(day, db = pool) {
  const r = await db.query(
    `SELECT
       (SELECT COUNT(DISTINCT COALESCE(customer_id::text, walk_in_customer_name))
          FROM purchases WHERE purchase_date = $1) AS customers,
       (SELECT COALESCE(SUM(p.quantity), 0)
          FROM purchases p JOIN products pr ON pr.id = p.product_id
         WHERE p.purchase_date = $1
           AND (pr.name ILIKE '%milk%' OR pr.category ILIKE '%milk%')
           AND pr.unit ILIKE 'l%') AS milk_litres,
       (SELECT COALESCE(SUM(total_amount), 0) FROM purchases WHERE purchase_date = $1) AS sales,
       (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payment_date = $1) AS collected`,
    [day]
  );
  const f = r.rows[0];
  return {
    customers: Number(f.customers),
    milkLitres: Number(f.milk_litres),
    sales: Number(f.sales),
    collected: Number(f.collected),
  };
}

function fmtDay(isoDay) {
  const [y, m, d] = isoDay.split('-');
  return `${d}-${m}-${y}`;
}

// Variables, in the exact order of the DLT template below.
function summaryVariables(day, f) {
  return [fmtDay(day), String(f.customers), num(f.milkLitres), num(f.sales), num(f.collected)];
}

function summaryTemplateText(shopName) {
  return `Daily summary {#var#}: {#var#} customers, milk sold {#var#} L, sales Rs.{#var#}, collected Rs.{#var#}. - ${shopName}`;
}

function renderSummary(shopName, vars) {
  let i = 0;
  return summaryTemplateText(shopName).replace(/\{#var#\}/g, () => vars[i++]);
}

// Sends (or re-sends, when force=true) the summary for one day.
async function sendSummary(day, { force = false } = {}) {
  const [settings, summary] = await Promise.all([getSmsSettings(), getSummarySettings()]);
  const mobile = normalizeMobile(summary.phone);
  if (!mobile) return { ok: false, error: 'Add the owner mobile number for the daily summary first.' };

  // Claim the day first, so two servers / two ticks can never both send.
  const claim = force
    ? await pool.query(
        `INSERT INTO daily_summaries (summary_date, mobile, status, mode) VALUES ($1, $2, 'sending', $3)
         ON CONFLICT (summary_date) DO UPDATE SET status = 'sending', mobile = $2, mode = $3, error = NULL, created_at = NOW()
         RETURNING summary_date`,
        [day, mobile, smsMode()]
      )
    : await pool.query(
        `INSERT INTO daily_summaries (summary_date, mobile, status, mode) VALUES ($1, $2, 'sending', $3)
         ON CONFLICT (summary_date) DO NOTHING RETURNING summary_date`,
        [day, mobile, smsMode()]
      );
  if (!claim.rows.length) return { ok: false, already: true, error: 'Already sent for this day.' };

  const figures = await getDayFigures(day);
  const variables = summaryVariables(day, figures);
  const text = renderSummary(settings.shopName, variables);
  const result = await sendSms({ mobile, text, variables, templateEnv: TEMPLATE_ENV });
  await pool.query(
    `UPDATE daily_summaries SET status = $2, message = $3, error = $4 WHERE summary_date = $1`,
    [day, result.status, text, result.error || null]
  );
  return { ok: result.ok, status: result.status, error: result.error, text, figures };
}

// Called every few minutes by the scheduler. Sends today's summary once,
// after the chosen hour (India time). If the server was asleep all
// evening, it does not send yesterday's numbers the next morning.
async function runSummaryIfDue({ now = new Date() } = {}) {
  const summary = await getSummarySettings();
  if (!summary.enabled) return { ran: false, reason: 'Daily summary is turned off' };
  const { today } = istParts(now);
  const istHour = new Date(now.getTime() + 5.5 * 3600 * 1000).getUTCHours();
  if (istHour < summary.hour) return { ran: false, reason: `Waiting for ${summary.hour}:00` };
  const r = await sendSummary(today);
  if (r.already) return { ran: false, reason: 'Already sent today' };
  if (r.ok) console.log(`[sms] daily summary for ${today}: ${r.status}`);
  else console.error(`[sms] daily summary for ${today} failed: ${r.error}`);
  return { ran: true, result: r };
}

async function getSummaryOverview() {
  const [settings, summary, last] = await Promise.all([
    getSmsSettings(),
    getSummarySettings(),
    pool.query(`SELECT summary_date::text AS day, status, error, created_at FROM daily_summaries ORDER BY summary_date DESC LIMIT 1`),
  ]);
  const { today } = istParts();
  const figures = await getDayFigures(today);
  return {
    ...summary,
    templateText: summaryTemplateText(settings.shopName),
    preview: renderSummary(settings.shopName, summaryVariables(today, figures)),
    missingConfig: missingConfig(smsMode(), TEMPLATE_ENV),
    last: last.rows[0] || null,
  };
}

module.exports = { getDayFigures, sendSummary, runSummaryIfDue, getSummaryOverview, summaryTemplateText };
