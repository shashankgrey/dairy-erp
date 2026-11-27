const pool = require('../config/db');
const { smsMode, missingConfig } = require('../utils/fast2sms');
const svc = require('../services/smsReminders');
const summarySvc = require('../services/dailySummary');

// GET /api/sms -- everything the Reminders page needs in one call.
async function getOverview(req, res) {
  const { period, today } = svc.istParts();
  const [settings, customers, autoRun, log, summary] = await Promise.all([
    svc.getSmsSettings(),
    svc.owingCustomers(period),
    pool.query(
      `SELECT MIN(created_at) AS at, COUNT(*) FILTER (WHERE status IN ('sent','test') AND customer_id IS NOT NULL) AS n
       FROM sms_reminders WHERE trigger = 'auto' AND period = $1`, [period]
    ),
    pool.query(
      `SELECT s.id, s.created_at, s.status, s.error, s.trigger, s.amount, s.mode, c.full_name
       FROM sms_reminders s LEFT JOIN customers c ON c.id = s.customer_id
       WHERE s.customer_id IS NOT NULL
       ORDER BY s.id DESC LIMIT 30`
    ),
    summarySvc.getSummaryOverview(),
  ]);
  const mode = smsMode();
  const sample = customers[0] || { full_name: 'Ramesh', outstanding_balance: 1240 };
  res.json({
    mode,
    missingConfig: missingConfig(mode),
    period,
    auto: {
      enabled: settings.autoEnabled,
      day: settings.autoDay,
      ranAt: autoRun.rows[0].at,
      count: Number(autoRun.rows[0].n),
    },
    templateText: svc.templateText(settings),
    preview: svc.renderText(settings, svc.buildVariables(sample, settings, today)),
    customers: customers.map((c) => ({
      id: c.id,
      full_name: c.full_name,
      mobile_number: c.mobile_number,
      valid_mobile: !!c.mobile,
      outstanding_balance: Number(c.outstanding_balance),
      last_sms_at: c.last_sms_at,
      last_sms_status: c.last_sms_status,
    })),
    log: log.rows,
    summary,
  });
}

// POST /api/sms/send-all { include_already_sent?: boolean }
async function sendAll(req, res) {
  const { period } = svc.istParts();
  let customers = (await svc.owingCustomers(period)).filter((c) => c.mobile);
  if (!req.body.include_already_sent) {
    customers = customers.filter((c) => !['sent', 'test'].includes(c.last_sms_status));
  }
  if (!customers.length) return res.json({ mode: smsMode(), sent: 0, test: 0, failed: 0, skipped: 0, failures: [], nothingToSend: true });
  res.json(await svc.sendReminders(customers, 'manual'));
}

// POST /api/sms/send/:customerId
async function sendOne(req, res) {
  const { period } = svc.istParts();
  const id = Number(req.params.customerId);
  const c = (await svc.owingCustomers(period)).find((x) => x.id === id);
  if (!c) return res.status(404).json({ error: 'This customer does not owe anything right now.' });
  if (!c.mobile) return res.status(400).json({ error: `${c.full_name} does not have a valid mobile number.` });
  res.json(await svc.sendReminders([c], 'single'));
}

// POST /api/sms/cron -- optional outside trigger (e.g. cron-job.org),
// protected by the CRON_SECRET header instead of a login.
async function cron(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.get('x-cron-secret') !== secret) return res.status(401).json({ error: 'Unauthorized' });
  const [reminders, summary] = await Promise.all([svc.runAutoIfDue(), summarySvc.runSummaryIfDue()]);
  res.json({ reminders, summary });
}

// POST /api/sms/summary/send -- send today's summary right now (also a
// handy test). Re-sends even if tonight's already went out.
async function sendSummaryNow(req, res) {
  const { today } = svc.istParts();
  const r = await summarySvc.sendSummary(today, { force: true });
  if (!r.ok && r.error && !r.status) return res.status(400).json({ error: r.error });
  res.json(r);
}

module.exports = { getOverview, sendAll, sendOne, cron, sendSummaryNow };
