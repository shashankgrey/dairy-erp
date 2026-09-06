import { useState, useEffect, useCallback } from 'react';
import { Save, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../lib/api';
import { useApiResource } from '../hooks/useApiResource';

export default function Settings() {
  const fetchSettings = useCallback(async () => {
    const { data } = await api.get('/settings');
    return data;
  }, []);

  const { data: settings, loading, error, reload: load } = useApiResource(fetchSettings);

  const [upiId, setUpiId] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  // Populate the form once settings load, without clobbering whatever
  // the user is actively typing on a later re-fetch.
  useEffect(() => {
    if (settings) {
      setUpiId(settings.shop_upi_id || '');
      setPayeeName(settings.shop_payee_name || '');
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
      await api.put('/settings', {
        shop_upi_id: upiId.trim(),
        shop_payee_name: payeeName.trim(),
      });
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
          Configure how payment reminders work.
        </p>
      </div>

      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-semibold text-sm mb-1">UPI Payment Details</h2>
        <p className="text-xs text-muted-light dark:text-muted-dark mb-4">
          When set, WhatsApp payment reminders will include a tap-to-pay link
          for GPay, PhonePe, or any UPI app, pre-filled with the customer's
          exact amount owed.
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
                Payee / Shop Name
              </label>
              <input
                value={payeeName}
                onChange={(e) => setPayeeName(e.target.value)}
                placeholder="Your Dairy Shop"
                className="w-full px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-xs text-muted-light dark:text-muted-dark mt-1">
                Shown to the customer as who they're paying.
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
    </div>
  );
}