import { useCallback, useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Check, AlertCircle, RefreshCw, RotateCcw, Settings as SettingsIcon } from 'lucide-react';
import api from '../lib/api';
import { useApiResource } from '../hooks/useApiResource';

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM'
}

// Builds a standard NPCI UPI deep link. Any UPI app (GPay, PhonePe,
// Paytm, BHIM) recognizes this scheme and opens straight to a
// pre-filled payment screen when tapped from a phone.
function buildUpiLink(customer, settings) {
  if (!settings?.shop_upi_id) return null;
  const amount = Number(customer.outstanding_balance).toFixed(2);
  const params = new URLSearchParams({
    pa: settings.shop_upi_id,
    pn: settings.shop_payee_name || 'Dairy Shop',
    am: amount,
    cu: 'INR',
    tn: `Payment from ${customer.full_name}`,
  });
  return `upi://pay?${params.toString()}`;
}

function buildMessage(customer, settings) {
  const amount = Number(customer.outstanding_balance).toLocaleString('en-IN');
  let msg = `Hi ${customer.full_name}, this is a reminder from Dairy ERP that your outstanding balance is ₹${amount}. Kindly clear the payment at your earliest convenience.`;

  const upiLink = buildUpiLink(customer, settings);
  if (upiLink) {
    msg += `\n\nPay now: ${upiLink}`;
    // Plain-text fallback -- upi:// links don't always render as
    // tappable inside WhatsApp depending on the phone/app version, so
    // the UPI ID itself is included as a manual backup.
    msg += `\n(If the link above doesn't open, pay manually to UPI ID: ${settings.shop_upi_id})`;
  }

  msg += '\n\nThank you!';
  return msg;
}

function buildWhatsAppLink(customer, settings) {
  const phone = `91${customer.mobile_number}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildMessage(customer, settings))}`;
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border-light dark:border-border-dark last:border-0 animate-pulse">
      <td className="px-4 py-3"><div className="h-4 w-32 bg-border-light dark:bg-border-dark rounded mb-1" /><div className="h-3 w-20 bg-border-light dark:bg-border-dark rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-20 bg-border-light dark:bg-border-dark rounded" /></td>
      <td className="px-4 py-3"><div className="h-6 w-28 bg-border-light dark:bg-border-dark rounded" /></td>
    </tr>
  );
}

export default function Reminders() {
  const monthKey = currentMonthKey();
  const storageKey = `reminders_sent_${monthKey}`;

  const [sentIds, setSentIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'));
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify([...sentIds]));
  }, [sentIds, storageKey]);

  const fetchOwing = useCallback(async () => {
    const { data } = await api.get('/customers', {
      params: { status: 'active', balance: 'owing', sortBy: 'outstanding_balance', sortOrder: 'desc', limit: 1000 },
    });
    return data.data;
  }, []);
  const { data: customers, loading, error, reload: load } = useApiResource(fetchOwing);
  const customerList = customers ?? [];

  const fetchSettings = useCallback(async () => {
    const { data } = await api.get('/settings');
    return data;
  }, []);
  const { data: settings } = useApiResource(fetchSettings);
  const upiConfigured = !!settings?.shop_upi_id;

  const { withMobile, withoutMobile } = useMemo(() => {
    const withMobile = [];
    const withoutMobile = [];
    for (const c of customerList) {
      (c.mobile_number ? withMobile : withoutMobile).push(c);
    }
    return { withMobile, withoutMobile };
  }, [customerList]);

  const sentCount = withMobile.filter((c) => sentIds.has(c.id)).length;

  function markSent(id) {
    setSentIds((prev) => new Set(prev).add(id));
  }

  function unmarkSent(id) {
    setSentIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleSend(customer) {
    window.open(buildWhatsAppLink(customer, settings), '_blank', 'noopener,noreferrer');
    markSent(customer.id);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Payment Reminders</h1>
        <p className="text-sm text-muted-light dark:text-muted-dark">
          Every active customer with an outstanding balance, ready to remind over WhatsApp.
        </p>
      </div>

      {settings && !upiConfigured && (
        <div className="flex items-center justify-between gap-3 text-sm rounded-lg px-4 py-2.5 bg-amber-50 dark:bg-amber-500/10 text-[color:var(--color-balance-owing)]">
          <span>No UPI ID set up yet — reminders will go out without a tap-to-pay link.</span>
          <Link to="/settings" className="inline-flex items-center gap-1.5 font-semibold hover:underline shrink-0">
            <SettingsIcon size={14} /> Set up now
          </Link>
        </div>
      )}

      {!loading && !error && withMobile.length > 0 && (
        <div className="text-sm rounded-lg px-4 py-2.5 bg-brand-50 dark:bg-brand-500/10 text-brand-500 dark:text-brand-400">
          {sentCount} of {withMobile.length} reminded this month.
        </div>
      )}

      {!loading && !error && withoutMobile.length > 0 && (
        <div className="text-sm rounded-lg px-4 py-2.5 bg-amber-50 dark:bg-amber-500/10 text-[color:var(--color-balance-owing)]">
          {withoutMobile.length} customer{withoutMobile.length > 1 ? 's' : ''} owe money but have no mobile number on file, so they can't be reminded here: {withoutMobile.map((c) => c.full_name).join(', ')}.
        </div>
      )}

      {error ? (
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
      ) : (
        <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl overflow-hidden shadow-[var(--shadow-card)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border-light dark:border-border-dark">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Owes</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                ) : withMobile.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-10 text-muted-light dark:text-muted-dark">
                    No customers with an outstanding balance right now. 🎉
                  </td></tr>
                ) : (
                  withMobile.map((c) => {
                    const sent = sentIds.has(c.id);
                    return (
                      <tr key={c.id} className="border-b border-border-light dark:border-border-dark last:border-0 hover:bg-bg-light dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <Link to={`/customers/${c.id}`} className="font-medium hover:text-brand-500 hover:underline">
                            {c.full_name}
                          </Link>
                          <div className="text-xs text-muted-light dark:text-muted-dark">{c.mobile_number}</div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-[color:var(--color-balance-owing)]">
                          ₹{Number(c.outstanding_balance).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3">
                          {sent ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-500/10 text-brand-500 dark:text-brand-400 text-xs font-semibold">
                                <Check size={13} /> Reminded
                              </span>
                              <button
                                onClick={() => unmarkSent(c.id)}
                                className="p-1.5 rounded-lg hover:bg-bg-light dark:hover:bg-white/5 text-muted-light dark:text-muted-dark"
                                title="Undo"
                              >
                                <RotateCcw size={13} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleSend(c)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold"
                            >
                              <MessageCircle size={13} /> Send via WhatsApp
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}