import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Phone, MapPin, Mail, FileText, ChevronLeft, ChevronRight, IndianRupee, Trash2, AlertCircle, RefreshCw, X } from 'lucide-react';
import api from '../lib/api';
import BalanceBadge from '../components/BalanceBadge';
import PaymentModal from '../components/PaymentModal';
import MonthlyBillCard from '../components/MonthlyBillCard';
import ConfirmDialog from '../components/ConfirmDialog';
import { useApiResource } from '../hooks/useApiResource';

const PAGE_SIZE = 15;

export default function CustomerProfile() {
  const { id } = useParams();
  const [payments, setPayments] = useState([]);
  const [page, setPage] = useState(1);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Purchase history filters
  const [products, setProducts] = useState([]);
  const [filterProductId, setFilterProductId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchCustomer = useCallback(async () => {
    const { data } = await api.get(`/customers/${id}`);
    return data;
  }, [id]);
  const { data: customer, error: customerError, reload: loadCustomer } = useApiResource(fetchCustomer);

  const loadPayments = useCallback(() => {
    api.get(`/payments/customer/${id}`)
      .then((res) => setPayments(res.data))
      .catch((err) => console.error('Failed to load payments:', err));
  }, [id]);

  useEffect(() => { loadPayments(); }, [loadPayments]);

  // Products list for the purchase-history filter dropdown -- a simple
  // one-time fetch, same low-key pattern as the categories fetch on
  // the Products page (no dedicated loading/error UI, it's just a
  // filter control).
  useEffect(() => {
    api.get('/products')
      .then((res) => setProducts(res.data))
      .catch((err) => console.error('Failed to load products for filter:', err));
  }, []);

  const fetchPurchases = useCallback(async () => {
    const { data } = await api.get(`/customers/${id}/purchases`, {
      params: {
        page,
        limit: PAGE_SIZE,
        product_id: filterProductId || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      },
    });
    return data;
  }, [id, page, filterProductId, fromDate, toDate]);
  const { data: purchaseResult, loading: purchasesLoading } = useApiResource(fetchPurchases);
  const purchases = purchaseResult?.data ?? [];
  const pagination = purchaseResult?.pagination ?? { page: 1, totalPages: 1, total: 0 };

  // Reset to page 1 whenever a filter changes (not when page itself changes)
  useEffect(() => { setPage(1); }, [filterProductId, fromDate, toDate]);

  const hasActiveFilters = filterProductId || fromDate || toDate;

  function clearFilters() {
    setFilterProductId('');
    setFromDate('');
    setToDate('');
  }

  function handlePaymentSaved() {
    setPaymentModalOpen(false);
    loadCustomer();
    loadPayments();
  }

  async function handleDeletePayment() {
    const paymentId = deleteTarget;
    setDeleteTarget(null);
    try {
      await api.delete(`/payments/${paymentId}`);
      loadCustomer();
      loadPayments();
    } catch (err) {
      console.error('Failed to delete payment:', err);
    }
  }

  if (customerError) {
    return (
      <div className="space-y-4">
        <Link to="/customers" className="inline-flex items-center gap-1.5 text-sm text-muted-light dark:text-muted-dark hover:text-brand-500">
          <ArrowLeft size={16} /> Back to Customers
        </Link>
        <div className="bg-surface-light dark:bg-surface-dark border border-red-200 dark:border-red-500/30 rounded-xl p-6 flex flex-col items-center text-center gap-3">
          <AlertCircle size={28} className="text-[color:var(--color-balance-overdue)]" />
          <p className="text-sm text-muted-light dark:text-muted-dark">{customerError}</p>
          <button
            onClick={loadCustomer}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="space-y-4">
        <div className="h-4 w-40 bg-border-light dark:bg-border-dark rounded animate-pulse" />
        <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-6 animate-pulse space-y-4">
          <div className="h-6 w-56 bg-border-light dark:bg-border-dark rounded" />
          <div className="h-4 w-40 bg-border-light dark:bg-border-dark rounded" />
          <div className="h-4 w-full bg-border-light dark:bg-border-dark rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/customers" className="inline-flex items-center gap-1.5 text-sm text-muted-light dark:text-muted-dark hover:text-brand-500">
        <ArrowLeft size={16} /> Back to Customers
      </Link>

      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold">{customer.full_name}</h1>
              <span className="font-mono text-xs text-muted-light dark:text-muted-dark px-2 py-0.5 rounded bg-bg-light dark:bg-bg-dark">
                {customer.customer_code}
              </span>
              {!customer.active && (
                <span className="text-xs px-2 py-0.5 rounded bg-red-50 dark:bg-red-500/10 text-red-600">Archived</span>
              )}
            </div>
            <p className="text-xs text-muted-light dark:text-muted-dark">
              Customer since {new Date(customer.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <BalanceBadge amount={customer.outstanding_balance} />
            <button
              onClick={() => setPaymentModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold"
            >
              <IndianRupee size={14} /> Record Payment
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 text-sm">
          <div className="flex items-center gap-2 text-muted-light dark:text-muted-dark">
            <Phone size={15} /> {customer.mobile_number}
          </div>
          {customer.email && (
            <div className="flex items-center gap-2 text-muted-light dark:text-muted-dark">
              <Mail size={15} /> {customer.email}
            </div>
          )}
          {customer.address && (
            <div className="flex items-center gap-2 text-muted-light dark:text-muted-dark sm:col-span-2">
              <MapPin size={15} /> {customer.address}
            </div>
          )}
          {customer.notes && (
            <div className="flex items-start gap-2 text-muted-light dark:text-muted-dark sm:col-span-2">
              <FileText size={15} className="mt-0.5 shrink-0" /> {customer.notes}
            </div>
          )}
        </div>
      </div>

      <MonthlyBillCard customerId={id} />

      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl overflow-hidden shadow-[var(--shadow-card)]">
        <div className="px-5 py-4 border-b border-border-light dark:border-border-dark">
          <h2 className="font-semibold text-sm">Payment History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border-light dark:border-border-dark">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Notes</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-muted-light dark:text-muted-dark">No payments recorded yet.</td></tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="border-b border-border-light dark:border-border-dark last:border-0 hover:bg-bg-light dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-muted-light dark:text-muted-dark">{new Date(p.payment_date).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3 font-medium text-[color:var(--color-balance-clear)]">₹{p.amount}</td>
                    <td className="px-4 py-3 text-muted-light dark:text-muted-dark">{p.notes || '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setDeleteTarget(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600" title="Delete payment">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl overflow-hidden shadow-[var(--shadow-card)]">
        <div className="px-5 py-4 border-b border-border-light dark:border-border-dark space-y-3">
          <h2 className="font-semibold text-sm">Purchase History</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterProductId}
              onChange={(e) => setFilterProductId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Products</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              title="From date"
            />
            <span className="text-xs text-muted-light dark:text-muted-dark">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              title="To date"
            />
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-xs text-muted-light dark:text-muted-dark hover:text-red-600"
              >
                <X size={13} /> Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border-light dark:border-border-dark">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Product</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Rate</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Amount</th>
              </tr>
            </thead>
            <tbody>
              {purchasesLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-border-light dark:border-border-dark last:border-0 animate-pulse">
                    <td className="px-4 py-3"><div className="h-4 w-20 bg-border-light dark:bg-border-dark rounded" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-28 bg-border-light dark:bg-border-dark rounded" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-12 bg-border-light dark:bg-border-dark rounded" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-14 bg-border-light dark:bg-border-dark rounded" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-16 bg-border-light dark:bg-border-dark rounded" /></td>
                  </tr>
                ))
              ) : purchases.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-muted-light dark:text-muted-dark">
                  {hasActiveFilters ? 'No purchases match these filters.' : 'No purchases recorded yet.'}
                </td></tr>
              ) : (
                purchases.map((p) => (
                  <tr key={p.id} className="border-b border-border-light dark:border-border-dark last:border-0 hover:bg-bg-light dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-muted-light dark:text-muted-dark">
                      {new Date(p.purchase_date).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3">{p.product_name}</td>
                    <td className="px-4 py-3">{p.quantity} {p.unit}</td>
                    <td className="px-4 py-3">₹{p.unit_price}</td>
                    <td className="px-4 py-3 font-medium">₹{p.total_amount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!purchasesLoading && pagination.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border-light dark:border-border-dark text-sm text-muted-light dark:text-muted-dark">
            <span>
              Showing {(pagination.page - 1) * PAGE_SIZE + 1}–{Math.min(pagination.page * PAGE_SIZE, pagination.total)} of {pagination.total}
            </span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-1.5 rounded-lg border border-border-light dark:border-border-dark disabled:opacity-40">
                <ChevronLeft size={16} />
              </button>
              <span>Page {pagination.page} of {pagination.totalPages}</span>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)} className="p-1.5 rounded-lg border border-border-light dark:border-border-dark disabled:opacity-40">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {paymentModalOpen && (
        <PaymentModal
          customer={customer}
          onClose={() => setPaymentModalOpen(false)}
          onSaved={handlePaymentSaved}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete payment?"
          message="This will increase the customer's outstanding balance back by this amount."
          confirmLabel="Delete"
          danger
          onConfirm={handleDeletePayment}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}