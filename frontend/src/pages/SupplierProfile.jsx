import { useCallback, useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, IndianRupee, AlertCircle, RefreshCw, X } from 'lucide-react';
import api from '../lib/api';
import SupplierPaymentModal from '../components/SupplierPaymentModal';
import { useApiResource } from '../hooks/useApiResource';

const today = () => new Date().toISOString().slice(0, 10);
const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

function Ledger({ title, rows, render, emptyMessage = 'No records yet.' }) {
  return (
    <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-semibold mb-3">{title}</h2>
      {rows.length ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="flex justify-between text-sm border-b border-border-light dark:border-border-dark pb-2 last:border-0 last:pb-0">
              {render(row)}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-light dark:text-muted-dark">{emptyMessage}</p>
      )}
    </div>
  );
}

export default function SupplierProfile() {
  const { id } = useParams();
  const [formError, setFormError] = useState('');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const [purchase, setPurchase] = useState({ product_id: '', quantity: '', unit_cost: '', purchase_date: today(), invoice_number: '' });
  const [savingPurchase, setSavingPurchase] = useState(false);

  // Ledger date-range filter -- both purchases and payments already
  // load in full (no pagination), so filtering client-side is correct
  // here, unlike the customer purchase history which is paginated.
  const [ledgerFrom, setLedgerFrom] = useState('');
  const [ledgerTo, setLedgerTo] = useState('');

  const fetchAll = useCallback(async () => {
    const [s, pr, sp, pay] = await Promise.all([
      api.get(`/suppliers/${id}`),
      api.get('/products'),
      api.get(`/suppliers/${id}/purchases`),
      api.get(`/suppliers/${id}/payments`),
    ]);
    return { supplier: s.data, products: pr.data, purchases: sp.data, payments: pay.data };
  }, [id]);

  const { data, error: loadError, reload: load } = useApiResource(fetchAll);
  const supplier = data?.supplier ?? null;
  const products = data?.products ?? [];
  const purchases = data?.purchases ?? [];
  const payments = data?.payments ?? [];

  // Default the purchase form's product to the first available product
  // once the list has loaded, matching the original behavior.
  useEffect(() => {
    if (products.length > 0) {
      setPurchase((x) => (x.product_id ? x : { ...x, product_id: products[0].id }));
    }
  }, [products]);

  function inRange(dateStr) {
    const day = String(dateStr).slice(0, 10);
    if (ledgerFrom && day < ledgerFrom) return false;
    if (ledgerTo && day > ledgerTo) return false;
    return true;
  }

  const filteredPurchases = useMemo(
    () => purchases.filter((p) => inRange(p.purchase_date)),
    [purchases, ledgerFrom, ledgerTo]
  );
  const filteredPayments = useMemo(
    () => payments.filter((p) => inRange(p.payment_date)),
    [payments, ledgerFrom, ledgerTo]
  );
  const hasLedgerFilter = ledgerFrom || ledgerTo;

  function clearLedgerFilter() {
    setLedgerFrom('');
    setLedgerTo('');
  }

  async function savePurchase(e) {
    e.preventDefault();
    setFormError('');
    setSavingPurchase(true);
    try {
      await api.post(`/suppliers/${id}/purchases`, {
        ...purchase,
        quantity: Number(purchase.quantity),
        unit_cost: Number(purchase.unit_cost),
      });
      setPurchase((x) => ({ ...x, quantity: '', unit_cost: '', invoice_number: '' }));
      load();
    } catch (err) {
      console.error('Failed to save stock purchase:', err);
      setFormError(err.response?.data?.error || 'Could not save stock purchase');
    } finally {
      setSavingPurchase(false);
    }
  }

  function handlePaymentSaved() {
    setPaymentModalOpen(false);
    load();
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <Link to="/suppliers" className="inline-flex items-center gap-1.5 text-sm text-muted-light dark:text-muted-dark hover:text-brand-500">
          <ArrowLeft size={16} /> Back to Suppliers
        </Link>
        <div className="bg-surface-light dark:bg-surface-dark border border-red-200 dark:border-red-500/30 rounded-xl p-6 flex flex-col items-center text-center gap-3">
          <AlertCircle size={28} className="text-[color:var(--color-balance-overdue)]" />
          <p className="text-sm text-muted-light dark:text-muted-dark">{loadError}</p>
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

  if (!supplier) {
    return (
      <div className="space-y-4">
        <div className="h-4 w-40 bg-border-light dark:bg-border-dark rounded animate-pulse" />
        <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-6 animate-pulse space-y-3">
          <div className="h-6 w-56 bg-border-light dark:bg-border-dark rounded" />
          <div className="h-4 w-32 bg-border-light dark:bg-border-dark rounded" />
          <div className="h-6 w-40 bg-border-light dark:bg-border-dark rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/suppliers" className="inline-flex items-center gap-1.5 text-sm text-muted-light dark:text-muted-dark hover:text-brand-500">
        <ArrowLeft size={16} /> Back to Suppliers
      </Link>

      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-6 shadow-[var(--shadow-card)] flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold">{supplier.full_name}</h1>
          <p className="text-sm text-muted-light dark:text-muted-dark">
            {supplier.supplier_code} {supplier.mobile_number ? `• ${supplier.mobile_number}` : ''}
          </p>
          <p className="mt-2 text-lg font-bold text-[color:var(--color-balance-owing)]">
            Payable: {money(supplier.outstanding_balance)}
          </p>
        </div>
        <button
          onClick={() => setPaymentModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold"
        >
          <IndianRupee size={14} /> Pay Supplier
        </button>
      </div>

      {formError && (
        <p className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{formError}</p>
      )}

      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-5 shadow-[var(--shadow-card)] max-w-lg">
        <h2 className="font-semibold text-sm mb-4">Record Stock Purchase</h2>
        <form onSubmit={savePurchase} className="space-y-3">
          <select
            value={purchase.product_id}
            onChange={(e) => setPurchase({ ...purchase, product_id: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {products.length === 0 && <option value="">No products available</option>}
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={purchase.quantity}
              onChange={(e) => setPurchase({ ...purchase, quantity: e.target.value })}
              placeholder="Quantity"
              className="px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={purchase.unit_cost}
              onChange={(e) => setPurchase({ ...purchase, unit_cost: e.target.value })}
              placeholder="Cost per unit (₹)"
              className="px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <input
            type="date"
            value={purchase.purchase_date}
            onChange={(e) => setPurchase({ ...purchase, purchase_date: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            value={purchase.invoice_number}
            onChange={(e) => setPurchase({ ...purchase, invoice_number: e.target.value })}
            placeholder="Invoice number (optional)"
            className="w-full px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={savingPurchase || products.length === 0}
            className="w-full py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold disabled:opacity-60"
          >
            {savingPurchase ? 'Saving...' : 'Add Purchase'}
          </button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-light dark:text-muted-dark">Filter ledgers:</span>
        <input
          type="date"
          value={ledgerFrom}
          onChange={(e) => setLedgerFrom(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          title="From date"
        />
        <span className="text-xs text-muted-light dark:text-muted-dark">to</span>
        <input
          type="date"
          value={ledgerTo}
          onChange={(e) => setLedgerTo(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          title="To date"
        />
        {hasLedgerFilter && (
          <button
            onClick={clearLedgerFilter}
            className="inline-flex items-center gap-1 text-xs text-muted-light dark:text-muted-dark hover:text-red-600"
          >
            <X size={13} /> Clear
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Ledger
          title="Stock Purchases"
          rows={filteredPurchases}
          emptyMessage={hasLedgerFilter ? 'No purchases in this date range.' : 'No records yet.'}
          render={(x) => (
            <>
              <span>{new Date(x.purchase_date).toLocaleDateString('en-IN')} • {x.product_name} ({x.quantity} {x.unit})</span>
              <b>{money(x.total_amount)}</b>
            </>
          )}
        />
        <Ledger
          title="Supplier Payments"
          rows={filteredPayments}
          emptyMessage={hasLedgerFilter ? 'No payments in this date range.' : 'No records yet.'}
          render={(x) => (
            <>
              <span>{new Date(x.payment_date).toLocaleDateString('en-IN')} • {x.payment_method.toUpperCase()}</span>
              <b>{money(x.amount)}</b>
            </>
          )}
        />
      </div>

      {paymentModalOpen && (
        <SupplierPaymentModal
          supplier={supplier}
          onClose={() => setPaymentModalOpen(false)}
          onSaved={handlePaymentSaved}
        />
      )}
    </div>
  );
}