import { useState, useEffect, useCallback, useMemo } from 'react';
import { Trash2, AlertCircle, RefreshCw, Search } from 'lucide-react';
import api from '../lib/api';
import CustomerAutocomplete from '../components/CustomerAutocomplete';
import ConfirmDialog from '../components/ConfirmDialog';
import ToggleTabs from '../components/ToggleTabs';
import { useApiResource } from '../hooks/useApiResource';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function EntrySkeleton() {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-border-light dark:border-border-dark last:border-0 animate-pulse">
      <div className="space-y-1.5">
        <div className="h-4 w-28 bg-border-light dark:bg-border-dark rounded" />
        <div className="h-3 w-40 bg-border-light dark:bg-border-dark rounded" />
      </div>
      <div className="h-6 w-6 bg-border-light dark:bg-border-dark rounded-lg" />
    </div>
  );
}

export default function Purchases() {
  const [customerMode, setCustomerMode] = useState('permanent');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [walkInName, setWalkInName] = useState('');

  const [productMode, setProductMode] = useState('permanent');
  const [productId, setProductId] = useState('');
  const [customProductName, setCustomProductName] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [customPrice, setCustomPrice] = useState('');

  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState(todayStr());
  const [status, setStatus] = useState(null); // { ok: bool, text: string }
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [entryFilter, setEntryFilter] = useState('');

  const fetchProducts = useCallback(async () => {
    const { data } = await api.get('/products');
    return data;
  }, []);
  const { data: products, error: productsError, reload: loadProducts } = useApiResource(fetchProducts);
  const productList = products ?? [];

  useEffect(() => {
    if (productList.length > 0) {
      setProductId((prev) => prev || productList[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productList]);

  const fetchEntries = useCallback(async () => {
    const { data } = await api.get('/purchases', { params: { date } });
    return data;
  }, [date]);
  const { data: entries, loading, error: entriesError, reload: loadEntries } = useApiResource(fetchEntries);
  const entryList = entries ?? [];

  // Client-side filter -- a single day's entries is always a small,
  // already-loaded list, so there's no need for a backend query param
  // here the way there is for a customer's full (paginated) history.
  const filteredEntries = useMemo(() => {
    const q = entryFilter.trim().toLowerCase();
    if (!q) return entryList;
    return entryList.filter((e) =>
      (e.customer_name || '').toLowerCase().includes(q) ||
      (e.product_name || '').toLowerCase().includes(q)
    );
  }, [entryList, entryFilter]);

  function resetForm() {
    setSelectedCustomer(null);
    setWalkInName('');
    setCustomProductName('');
    setCustomUnit('');
    setCustomPrice('');
    setQuantity('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus(null);

    if (customerMode === 'permanent' && !selectedCustomer) {
      setStatus({ ok: false, text: 'Please select a customer from the suggestions' });
      return;
    }
    if (productMode === 'permanent' && !productId) {
      setStatus({ ok: false, text: 'Please select a product' });
      return;
    }
    if (productMode === 'temporary' && (!customProductName.trim() || !customUnit.trim() || !customPrice)) {
      setStatus({ ok: false, text: 'Please fill in the item name, unit, and price for this one-off item' });
      return;
    }
    if (!quantity || parseFloat(quantity) <= 0) {
      setStatus({ ok: false, text: 'Please enter a valid quantity' });
      return;
    }

    const payload = {
      quantity: parseFloat(quantity),
      purchase_date: date,
      ...(customerMode === 'permanent'
        ? { customer_id: selectedCustomer.id }
        : { walk_in_customer_name: walkInName.trim() || 'Walk-in customer' }),
      ...(productMode === 'permanent'
        ? { product_id: productId }
        : { custom_product_name: customProductName.trim(), custom_unit: customUnit.trim(), unit_price: parseFloat(customPrice) }),
    };

    setSaving(true);
    try {
      await api.post('/purchases', payload);
      setStatus({ ok: true, text: 'Entry saved' });
      resetForm();
      loadEntries();
    } catch (err) {
      console.error('Failed to save entry:', err);
      setStatus({ ok: false, text: err.response?.data?.error || 'Something went wrong' });
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    const id = deleteTarget;
    setDeleteTarget(null);
    try {
      await api.delete(`/purchases/${id}`);
      loadEntries();
    } catch (err) {
      console.error('Failed to delete entry:', err);
      setStatus({ ok: false, text: 'Could not delete this entry.' });
    }
  }

  const totalToday = entryList.reduce((sum, e) => sum + parseFloat(e.total_amount), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Daily Entry</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-5 space-y-4 shadow-[var(--shadow-card)]">
          <h2 className="font-semibold text-sm">Add Entry</h2>

          {productsError && (
            <div className="flex items-center justify-between gap-3 text-sm rounded-lg px-3 py-2 bg-red-50 dark:bg-red-500/10 text-red-600">
              <span>Could not load products.</span>
              <button onClick={loadProducts} className="flex items-center gap-1 font-medium hover:underline shrink-0">
                <RefreshCw size={12} /> Retry
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="block text-sm font-medium text-muted-light dark:text-muted-dark mb-1">Customer</label>
              <div className="mb-2">
                <ToggleTabs
                  value={customerMode}
                  onChange={(v) => { setCustomerMode(v); setSelectedCustomer(null); setWalkInName(''); }}
                  options={[
                    { value: 'permanent', label: 'Permanent' },
                    { value: 'temporary', label: 'One-time / Temporary' },
                  ]}
                />
              </div>
              {customerMode === 'permanent' ? (
                <CustomerAutocomplete
                  onSelect={setSelectedCustomer}
                  selectedLabel={selectedCustomer ? `${selectedCustomer.customer_code} — ${selectedCustomer.full_name}` : ''}
                />
              ) : (
                <input
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  placeholder="Name (optional) — defaults to 'Walk-in customer'"
                  className="w-full px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              )}
              {customerMode === 'temporary' && (
                <p className="text-xs text-muted-light dark:text-muted-dark mt-1">
                  Not saved as a customer record. No outstanding balance is tracked — this sale is treated as paid in full.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-light dark:text-muted-dark mb-1">Product</label>
              <div className="mb-2">
                <ToggleTabs
                  value={productMode}
                  onChange={(v) => { setProductMode(v); setCustomProductName(''); setCustomUnit(''); setCustomPrice(''); }}
                  options={[
                    { value: 'permanent', label: 'Permanent' },
                    { value: 'temporary', label: 'One-off Item' },
                  ]}
                />
              </div>
              {productMode === 'permanent' ? (
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  disabled={!!productsError || productList.length === 0}
                  className="w-full px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
                >
                  {productList.length === 0 && <option value="">No products available</option>}
                  {productList.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (₹{p.default_price}/{p.unit})</option>
                  ))}
                </select>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={customProductName}
                    onChange={(e) => setCustomProductName(e.target.value)}
                    placeholder="Item name"
                    className="col-span-2 px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <input
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                    placeholder="Unit (litre, kg...)"
                    className="px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder="Price per unit (₹)"
                    className="px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              )}
              {productMode === 'temporary' && (
                <p className="text-xs text-muted-light dark:text-muted-dark mt-1">
                  Not tracked in inventory — no stock is deducted for this item.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-light dark:text-muted-dark mb-1">Quantity</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-light dark:text-muted-dark mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {status && (
              <p className={`text-sm rounded-lg px-3 py-2 ${status.ok ? 'text-brand-500 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10' : 'text-red-600 bg-red-50 dark:bg-red-500/10'}`}>
                {status.text}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Entry'}
            </button>
          </form>
        </div>

        <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl overflow-hidden flex flex-col shadow-[var(--shadow-card)]">
          <div className="px-5 py-4 border-b border-border-light dark:border-border-dark space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Entries for {date}</h2>
              <span className="text-sm font-semibold text-brand-500 dark:text-brand-400">₹{totalToday.toLocaleString('en-IN')}</span>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-light dark:text-muted-dark" />
              <input
                value={entryFilter}
                onChange={(e) => setEntryFilter(e.target.value)}
                placeholder="Filter by customer or product..."
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-[420px]">
            {entriesError ? (
              <div className="flex flex-col items-center gap-3 py-8 px-5 text-center">
                <AlertCircle size={22} className="text-[color:var(--color-balance-overdue)]" />
                <p className="text-sm text-muted-light dark:text-muted-dark">{entriesError}</p>
                <button
                  onClick={loadEntries}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-medium hover:bg-brand-600 transition-colors"
                >
                  <RefreshCw size={12} /> Retry
                </button>
              </div>
            ) : loading ? (
              Array.from({ length: 4 }).map((_, i) => <EntrySkeleton key={i} />)
            ) : entryList.length === 0 ? (
              <p className="text-center py-8 text-muted-light dark:text-muted-dark text-sm">No entries yet for this date.</p>
            ) : filteredEntries.length === 0 ? (
              <p className="text-center py-8 text-muted-light dark:text-muted-dark text-sm">No entries match "{entryFilter}".</p>
            ) : (
              filteredEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between px-5 py-3 border-b border-border-light dark:border-border-dark last:border-0 text-sm hover:bg-bg-light dark:hover:bg-white/[0.02] transition-colors">
                  <div>
                    <span className="font-medium">
                      {entry.customer_name}
                      {entry.is_temporary_customer && <span className="ml-1.5 text-xs text-muted-light dark:text-muted-dark">(one-time)</span>}
                    </span>
                    <span className="text-muted-light dark:text-muted-dark ml-2">
                      {entry.quantity} {entry.unit} {entry.product_name}
                      {entry.is_temporary_product && <span className="text-xs"> (one-off)</span>}
                      {' — ₹'}{entry.total_amount}
                    </span>
                  </div>
                  <button onClick={() => setDeleteTarget(entry.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Remove entry?"
          message="If this was linked to a permanent customer/product, their balance/stock will be adjusted back."
          confirmLabel="Remove"
          danger
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}