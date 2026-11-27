import { useState, useEffect, useCallback } from 'react';
import { Save, AlertCircle, RefreshCw, KeyRound, Eye, EyeOff } from 'lucide-react';
import api from '../lib/api';
import { useApiResource } from '../hooks/useApiResource';
import { useAuth } from '../context/AuthContext';


// Change the shop's (shared) login. Other devices using the old password
// are signed out; this one stays logged in.
function ChangePasswordCard() {
  const { user, updateSession } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [email, setEmail] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit = current && next.length >= 8 && next === confirm && !busy;

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setNote(null);
    try {
      const { data } = await api.post('/auth/change-password', {
        current_password: current,
        new_password: next,
        new_email: email.trim(),
      });
      updateSession(data.token, data.user);
      setCurrent(''); setNext(''); setConfirm(''); setEmail('');
      setNote({ ok: true, text: 'Password changed. Other phones and tablets will need to log in again with the new password.' });
    } catch (err) {
      const msg = err.response?.data?.error || 'Could not change the password.';
      setNote({ ok: false, text: msg.replace(/^[a-z_]+: /, '') });
    } finally {
      setBusy(false);
    }
  }

  const input = 'w-full px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500';
  const label = 'block text-sm font-medium text-muted-light dark:text-muted-dark mb-1';

  return (
    <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-semibold text-sm mb-1 flex items-center gap-2"><KeyRound size={16} /> Login and password</h2>
      <p className="text-xs text-muted-light dark:text-muted-dark mb-4">
        Logged in as <b>{user?.email}</b>. Changing the password signs out every other phone and tablet.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="cur-pw" className={label}>Current password</label>
          <input id="cur-pw" type={show ? 'text' : 'password'} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={input} />
        </div>
        <div>
          <label htmlFor="new-pw" className={label}>New password</label>
          <div className="relative">
            <input id="new-pw" type={show ? 'text' : 'password'} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={`${input} pr-12`} />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-1 top-1/2 -translate-y-1/2 p-2" aria-label={show ? 'Hide passwords' : 'Show passwords'}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <p className={`text-xs mt-1 ${next && next.length < 8 ? 'text-red-600' : 'text-muted-light dark:text-muted-dark'}`}>At least 8 characters.</p>
        </div>
        <div>
          <label htmlFor="confirm-pw" className={label}>Type the new password again</label>
          <input id="confirm-pw" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
          {mismatch && <p className="text-xs mt-1 text-red-600">The two passwords don't match.</p>}
        </div>
        <div>
          <label htmlFor="new-email" className={label}>New login email (optional)</label>
          <input id="new-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={user?.email} className={input} />
        </div>
        {note && (
          <p className={`text-sm rounded-lg px-3 py-2 ${note.ok ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-500 dark:text-brand-400' : 'bg-red-50 dark:bg-red-500/10 text-red-600'}`}>
            {note.text}
          </p>
        )}
        <button type="submit" disabled={!canSubmit} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold disabled:opacity-60">
          <KeyRound size={16} /> {busy ? 'Changing…' : 'Change password'}
        </button>
      </form>
    </div>
  );
}

export default function Settings() {
  const fetchSettings = useCallback(async () => {
    const { data } = await api.get('/settings');
    return data;
  }, []);

  const { data: settings, loading, error, reload: load } = useApiResource(fetchSettings);

  const [upiId, setUpiId] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  // Populate the form once settings load, without clobbering whatever
  // the user is actively typing on a later re-fetch.
  useEffect(() => {
    if (settings) {
      setUpiId(settings.shop_upi_id || '');
      setPayeeName(settings.shop_payee_name || '');
      setShopPhone(settings.shop_phone || '');
    }
  }, [settings]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function handleSubmit(e) {
    e.preventDefault();
    setNotice(null);
    setSaving(true);
    try {
      const body = { shop_upi_id: upiId.trim(), shop_phone: shopPhone.trim() };
      if (payeeName.trim()) body.shop_payee_name = payeeName.trim();
      await api.put('/settings', body);
      setNotice({ type: 'success', text: 'Settings saved.' });
    } catch (err) {
      const message = err.response?.data?.error || 'Could not save settings.';
      setNotice({ type: 'error', text: message });
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Settings</h1>
        <div className="bg-surface-light dark:bg-surface-dark border border-red-200 dark:border-red-500/30 rounded-xl p-6 flex flex-col items-center text-center gap-3">
          <AlertCircle size={28} className="text-[color:var(--color-balance-overdue)]" />
          <p className="text-sm text-muted-light dark:text-muted-dark">{error}</p>
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-muted-light dark:text-muted-dark">
          Shop details used in the SMS reminders.
        </p>
      </div>

      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-semibold text-sm mb-1">Shop details</h2>
        <p className="text-xs text-muted-light dark:text-muted-dark mb-4">
          These appear in the SMS reminder: the shop name signs the message,
          and customers are told to pay to the UPI ID (or the phone number if
          no UPI ID is set).
        </p>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-10 bg-border-light dark:bg-border-dark rounded-lg" />
            <div className="h-10 bg-border-light dark:bg-border-dark rounded-lg" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-light dark:text-muted-dark mb-1">
                Shop UPI ID
              </label>
              <input
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="yourshop@okhdfcbank"
                className="w-full px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-light dark:text-muted-dark mb-1">
                Shop name
              </label>
              <input
                value={payeeName}
                onChange={(e) => setPayeeName(e.target.value)}
                placeholder="Sri Sai Esha Dairy Products"
                className="w-full px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-xs text-muted-light dark:text-muted-dark mt-1">
                Changing this changes the SMS text, so the DLT template must be registered again.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-light dark:text-muted-dark mb-1">
                Shop phone number
              </label>
              <input
                value={shopPhone}
                onChange={(e) => setShopPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                inputMode="numeric"
                placeholder="10-digit mobile number"
                className="w-full px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-xs text-muted-light dark:text-muted-dark mt-1">
                Used in the SMS only if there is no UPI ID.
              </p>
            </div>

            {notice && (
              <p className={`text-sm rounded-lg px-3 py-2 ${
                notice.type === 'error'
                  ? 'bg-red-50 dark:bg-red-500/10 text-red-600'
                  : 'bg-brand-50 dark:bg-brand-500/10 text-brand-500 dark:text-brand-400'
              }`}>
                {notice.text}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold disabled:opacity-60"
            >
              <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        )}
      </div>

      <ChangePasswordCard />
    </div>
  );
}
