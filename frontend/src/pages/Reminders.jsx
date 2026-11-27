import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Send, AlertCircle, RefreshCw, CheckCircle2, CalendarClock, FlaskConical, Settings as SettingsIcon, Copy, Check, Moon } from 'lucide-react';
import api from '../lib/api';
import { useApiResource } from '../hooks/useApiResource';
import ConfirmDialog from '../components/ConfirmDialog';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const when = (ts) => new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const sentThisMonth = (c) => c.last_sms_status === 'sent' || c.last_sms_status === 'test';

function CopyTemplate({ text, note }) {
  const [copied, setCopied] = useState(false);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-light dark:text-muted-dark">Template for DLT registration</summary>
      <div className="mt-2 flex items-start gap-2">
        <code className="flex-1 block rounded-lg bg-bg-light dark:bg-white/5 px-3 py-2 text-xs break-words">{text}</code>
        <button
          onClick={() => navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}
          className="p-2 rounded-lg border border-border-light dark:border-border-dark"
          title="Copy"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-light dark:text-muted-dark">{note}</p>
    </details>
  );
}

const hourLabel = (h) => `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'PM' : 'AM'}`;

// Nightly SMS to the owner with the day's numbers.
function OwnerSummaryCard({ summary, onChanged }) {
  const [enabled, setEnabled] = useState(summary.enabled);
  const [phone, setPhone] = useState(summary.phone);
  const [hour, setHour] = useState(summary.hour);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  useEffect(() => {
    setEnabled(summary.enabled);
    setPhone(summary.phone);
    setHour(summary.hour);
  }, [summary.enabled, summary.phone, summary.hour]);

  async function save(next) {
    setBusy(true);
    setNote(null);
    try {
      await api.put('/settings', {
        summary_enabled: next.enabled ? 'true' : 'false',
        summary_phone: next.phone,
        summary_hour: next.hour,
      });
      setEnabled(next.enabled);
      setHour(next.hour);
      setNote({ ok: true, text: 'Saved.' });
      onChanged();
    } catch (err) {
      setNote({ ok: false, text: err.response?.data?.error || 'Could not save.' });
    } finally {
      setBusy(false);
    }
  }

  async function sendNow() {
    setBusy(true);
    setNote(null);
    try {
      const { data } = await api.post('/sms/summary/send');
      setNote(data.ok
        ? { ok: true, text: data.status === 'test' ? 'Recorded (test mode, not sent).' : 'Sent to the owner.' }
        : { ok: false, text: data.error || 'Could not send.' });
      onChanged();
    } catch (err) {
      setNote({ ok: false, text: err.response?.data?.error || 'Could not send.' });
    } finally {
      setBusy(false);
    }
  }

  const phoneOk = /^[6-9]\d{9}$/.test(phone);

  return (
    <div className={`${card} p-5 space-y-3`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Moon size={20} className="mt-0.5 text-brand-500 dark:text-brand-400" />
          <div>
            <h2 className="font-semibold">Daily summary to the owner</h2>
            <p className="text-sm text-muted-light dark:text-muted-dark">One SMS every night with the day's numbers, so the owner knows how the day went without opening the app.</p>
          </div>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          disabled={busy || (!enabled && !phoneOk)}
          onClick={() => save({ enabled: !enabled, phone, hour })}
          className={`relative w-14 h-8 rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-green-600' : 'bg-border-light dark:bg-border-dark'}`}
          title={!phoneOk ? 'Enter the owner mobile number first' : enabled ? 'Turn off' : 'Turn on'}
        >
          <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${enabled ? 'left-7' : 'left-1'}`} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Send to</span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
          onBlur={() => { if (phone !== summary.phone && (phoneOk || phone === '')) save({ enabled: enabled && phoneOk, phone, hour }); }}
          inputMode="numeric"
          placeholder="Owner mobile number"
          className="w-44 px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark"
        />
        <span>at</span>
        <select
          value={hour}
          disabled={busy}
          onChange={(e) => save({ enabled, phone, hour: Number(e.target.value) })}
          className="px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark"
        >
          {[17, 18, 19, 20, 21, 22, 23].map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
        </select>
        <span>every night.</span>
      </div>
      {phone && !phoneOk && <p className="text-xs text-red-600">Enter a 10-digit mobile number.</p>}

      <div className="rounded-2xl rounded-tl-sm bg-bg-light dark:bg-white/5 px-4 py-3 text-sm max-w-md">{summary.preview}</div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={sendNow}
          disabled={busy || !phoneOk}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border-light dark:border-border-dark hover:border-brand-500 text-sm font-medium disabled:opacity-40"
        >
          <Send size={14} /> Send today's summary now
        </button>
        {summary.last && (
          <span className="text-xs text-muted-light dark:text-muted-dark">
            Last: {summary.last.day.split('-').reverse().join('-')} · {summary.last.status === 'failed' ? `failed (${summary.last.error})` : summary.last.status === 'test' ? 'test' : 'sent'}
          </span>
        )}
        {note && <span className={`text-sm ${note.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600'}`}>{note.text}</span>}
      </div>

      {summary.missingConfig?.length > 0 && (
        <p className="text-xs text-red-600">Live sending also needs {summary.missingConfig.join(', ')} set on the server.</p>
      )}
      <CopyTemplate text={summary.templateText} note="Register this as a second template (Service Implicit). Its ID goes in FAST2SMS_SUMMARY_TEMPLATE_ID." />
    </div>
  );
}

const card = 'bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-[var(--shadow-card)]';

function ModeBanner({ mode, missing }) {
  if (missing?.length) {
    return (
      <div className="flex items-start gap-3 rounded-xl px-4 py-3 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-sm">
        <AlertCircle size={18} className="mt-0.5 shrink-0" />
        <span>SMS is switched on but not set up yet (missing {missing.join(', ')} on the server). Messages will fail until this is fixed.</span>
      </div>
    );
  }
  if (mode === 'test') {
    return (
      <div className="flex items-start gap-3 rounded-xl px-4 py-3 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 text-sm">
        <FlaskConical size={18} className="mt-0.5 shrink-0" />
        <span><b>Test mode.</b> Reminders are recorded here but no SMS is actually sent and nothing is charged.</span>
      </div>
    );
  }
  if (mode === 'quick') {
    return (
      <div className="flex items-start gap-3 rounded-xl px-4 py-3 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 text-sm">
        <FlaskConical size={18} className="mt-0.5 shrink-0" />
        <span><b>Trial sending.</b> Real SMS are sent at the higher trial rate (about ₹7 each). Use only for a few test messages.</span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-xl px-4 py-3 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 text-sm">
      <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
      <span><b>SMS is live.</b> Reminders go to customers' phones.</span>
    </div>
  );
}

function ResultNotice({ result, onClose }) {
  if (!result) return null;
  const ok = !result.error && !result.failed;
  let text = result.error;
  if (!text) {
    if (result.nothingToSend) text = 'Everyone who owes has already been reminded this month.';
    else {
      const done = result.mode === 'test' ? result.test : result.sent;
      text = `${done} reminder${done === 1 ? '' : 's'} ${result.mode === 'test' ? 'recorded (test mode, not sent)' : 'sent'}.`;
      if (result.failed) text += ` ${result.failed} failed: ${result.failures.map((f) => `${f.name} (${f.error})`).join(', ')}`;
    }
  }
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm ${
        ok ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
      }`}
      role="status"
    >
      <span>{text}</span>
      <button onClick={onClose} className="text-xs underline shrink-0">Close</button>
    </div>
  );
}

export default function Reminders() {
  const fetchOverview = useCallback(async () => {
    const { data } = await api.get('/sms');
    return data;
  }, []);
  const { data, loading, error, reload } = useApiResource(fetchOverview);

  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoDay, setAutoDay] = useState(1);
  const [savingAuto, setSavingAuto] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (data) {
      setAutoEnabled(data.auto.enabled);
      setAutoDay(data.auto.day);
    }
  }, [data]);

  async function saveAuto(enabled, day) {
    setSavingAuto(true);
    try {
      await api.put('/settings', { sms_auto_enabled: enabled ? 'true' : 'false', sms_auto_day: day });
      setAutoEnabled(enabled);
      setAutoDay(day);
    } catch (err) {
      setResult({ error: err.response?.data?.error || 'Could not save the automatic SMS setting.' });
    } finally {
      setSavingAuto(false);
    }
  }

  async function sendAll() {
    setConfirmAll(false);
    setSendingAll(true);
    setResult(null);
    try {
      const { data: r } = await api.post('/sms/send-all', {});
      setResult(r);
      reload();
    } catch (err) {
      setResult({ error: err.response?.data?.error || 'Could not send the reminders.' });
    } finally {
      setSendingAll(false);
    }
  }

  async function sendOne(c) {
    setSendingId(c.id);
    setResult(null);
    try {
      const { data: r } = await api.post(`/sms/send/${c.id}`);
      setResult(r);
      reload();
    } catch (err) {
      setResult({ error: err.response?.data?.error || `Could not send to ${c.full_name}.` });
    } finally {
      setSendingId(null);
    }
  }


  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">SMS Reminders</h1>
        <div className={`${card} border-red-200 dark:border-red-500/30 p-6 flex flex-col items-center text-center gap-3`}>
          <AlertCircle size={28} className="text-[color:var(--color-balance-overdue)]" />
          <p className="text-sm text-muted-light dark:text-muted-dark">{error}</p>
          <button onClick={reload} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600">
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-7 w-48 bg-border-light dark:bg-border-dark rounded" />
        <div className="h-24 bg-border-light dark:bg-border-dark rounded-xl" />
        <div className="h-64 bg-border-light dark:bg-border-dark rounded-xl" />
      </div>
    );
  }

  const customers = data.customers;
  const reachable = customers.filter((c) => c.valid_mobile);
  const pending = reachable.filter((c) => !sentThisMonth(c));
  const noMobile = customers.filter((c) => !c.valid_mobile);
  const totalDue = customers.reduce((s, c) => s + c.outstanding_balance, 0);
  const isTest = data.mode === 'test';

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">SMS Reminders</h1>
          <p className="text-sm text-muted-light dark:text-muted-dark">
            {customers.length} customer{customers.length === 1 ? '' : 's'} owe {money(totalDue)} in total.
          </p>
        </div>
        <button
          onClick={() => setConfirmAll(true)}
          disabled={sendingAll || pending.length === 0}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold disabled:opacity-50"
        >
          <Send size={18} />
          {sendingAll ? 'Sending…' : pending.length ? `Send SMS to all (${pending.length})` : 'Everyone reminded this month'}
        </button>
      </div>

      <ModeBanner mode={data.mode} missing={data.missingConfig} />
      <ResultNotice result={result} onClose={() => setResult(null)} />

      {/* automatic monthly sending */}
      <div className={`${card} p-5 space-y-3`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <CalendarClock size={20} className="mt-0.5 text-brand-500 dark:text-brand-400" />
            <div>
              <h2 className="font-semibold">Send automatically every month</h2>
              <p className="text-sm text-muted-light dark:text-muted-dark">
                Everyone who owes money gets one SMS on the chosen day. Nobody needs to press anything.
              </p>
            </div>
          </div>
          <button
            role="switch"
            aria-checked={autoEnabled}
            disabled={savingAuto}
            onClick={() => saveAuto(!autoEnabled, autoDay)}
            className={`relative w-14 h-8 rounded-full transition-colors disabled:opacity-60 ${autoEnabled ? 'bg-green-600' : 'bg-border-light dark:bg-border-dark'}`}
            title={autoEnabled ? 'Turn off' : 'Turn on'}
          >
            <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${autoEnabled ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span>Send on day</span>
          <select
            value={autoDay}
            disabled={savingAuto}
            onChange={(e) => saveAuto(autoEnabled, Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark"
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <span>of every month (India time).</span>
        </div>

        <p className="text-sm text-muted-light dark:text-muted-dark">
          {!autoEnabled
            ? 'Automatic sending is off.'
            : data.auto.ranAt
              ? `This month: already sent automatically on ${when(data.auto.ranAt)} to ${data.auto.count} customer${data.auto.count === 1 ? '' : 's'}.`
              : `This month: will go out on day ${autoDay} (or as soon as the app is next online after that).`}
        </p>
      </div>

      {/* customers */}
      <div className={`${card} overflow-hidden`}>
        <div className="px-5 py-3 border-b border-border-light dark:border-border-dark flex items-center justify-between">
          <h2 className="font-semibold">Customers who owe</h2>
          <span className="text-xs text-muted-light dark:text-muted-dark">{reachable.length - pending.length} of {reachable.length} reminded this month</span>
        </div>
        {customers.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-light dark:text-muted-dark">Nobody owes anything right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border-light dark:border-border-dark">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Customer</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Owes</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">This month</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b border-border-light dark:border-border-dark last:border-0">
                    <td className="px-4 py-3">
                      <Link to={`/customers/${c.id}`} className="font-medium hover:underline">{c.full_name}</Link>
                      <div className={`text-xs ${c.valid_mobile ? 'text-muted-light dark:text-muted-dark' : 'text-red-600'}`}>
                        {c.valid_mobile ? c.mobile_number : `No valid mobile (${c.mobile_number || 'none'})`}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{money(c.outstanding_balance)}</td>
                    <td className="px-4 py-3">
                      {c.last_sms_status === 'sent' && <span className="text-green-600 dark:text-green-400">Sent {when(c.last_sms_at)}</span>}
                      {c.last_sms_status === 'test' && <span className="text-amber-700 dark:text-amber-300">Test {when(c.last_sms_at)}</span>}
                      {c.last_sms_status === 'failed' && <span className="text-red-600">Failed {when(c.last_sms_at)}</span>}
                      {!c.last_sms_status && <span className="text-muted-light dark:text-muted-dark">Not yet</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => sendOne(c)}
                        disabled={!c.valid_mobile || sendingId === c.id || sendingAll}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-light dark:border-border-dark hover:border-brand-500 text-sm font-medium disabled:opacity-40"
                      >
                        <MessageSquare size={14} /> {sendingId === c.id ? 'Sending…' : sentThisMonth(c) ? 'Send again' : 'Send'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {noMobile.length > 0 && (
          <p className="px-5 py-3 text-xs text-red-600 border-t border-border-light dark:border-border-dark">
            {noMobile.length} customer{noMobile.length === 1 ? '' : 's'} can't get an SMS until a correct 10-digit mobile number is saved.
          </p>
        )}
      </div>

      {/* message preview */}
      <div className={`${card} p-5 space-y-3`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-semibold">What the customer receives</h2>
          <Link to="/settings" className="inline-flex items-center gap-1.5 text-sm text-brand-500 dark:text-brand-400 hover:underline">
            <SettingsIcon size={14} /> Change shop name / UPI
          </Link>
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-bg-light dark:bg-white/5 px-4 py-3 text-sm max-w-md">{data.preview}</div>
        <CopyTemplate
          text={data.templateText}
          note="Register this exact text (as a Service Implicit template). If you change the shop name, register the new text too."
        />
      </div>

      {data.summary && <OwnerSummaryCard summary={data.summary} onChanged={reload} />}

      {/* history */}
      {data.log.length > 0 && (
        <div className={`${card} overflow-hidden`}>
          <div className="px-5 py-3 border-b border-border-light dark:border-border-dark">
            <h2 className="font-semibold">Recent SMS</h2>
          </div>
          <div className="divide-y divide-border-light dark:divide-border-dark text-sm">
            {data.log.map((l) => (
              <div key={l.id} className="px-5 py-2.5 flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">
                  {l.full_name || 'Deleted customer'} · {money(l.amount)}
                  <span className="text-xs text-muted-light dark:text-muted-dark"> · {l.trigger === 'auto' ? 'automatic' : 'by hand'}</span>
                </span>
                <span className={`shrink-0 text-xs ${l.status === 'failed' ? 'text-red-600' : l.status === 'test' ? 'text-amber-700 dark:text-amber-300' : 'text-green-600 dark:text-green-400'}`}
                  title={l.error || ''}>
                  {l.status === 'failed' ? 'Failed' : l.status === 'test' ? 'Test' : 'Sent'} · {when(l.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmAll && (
        <ConfirmDialog
          title="Send SMS reminders?"
          message={`${pending.length} customer${pending.length === 1 ? '' : 's'} who haven't been reminded this month will get an SMS with the amount they owe.${isTest ? ' (Test mode: nothing is actually sent.)' : ''}`}
          confirmLabel={`Send ${pending.length} SMS`}
          onConfirm={sendAll}
          onCancel={() => setConfirmAll(false)}
        />
      )}
    </div>
  );
}
