import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, PackagePlus, History, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../lib/api';
import ProductFormModal from '../components/ProductFormModal';
import StockUpdateModal from '../components/StockUpdateModal';
import StockHistoryPanel from '../components/StockHistoryPanel';
import ConfirmDialog from '../components/ConfirmDialog';
import { useApiResource } from '../hooks/useApiResource';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const STATUS_STYLES = {
  active: 'bg-brand-50 dark:bg-brand-500/10 text-brand-500 dark:text-brand-400',
  discontinued: 'bg-red-50 dark:bg-red-500/10 text-red-600',
};

function SkeletonRow() {
  return (
    <tr className="border-b border-border-light dark:border-border-dark last:border-0 animate-pulse">
      <td className="px-4 py-3"><div className="h-4 w-28 bg-border-light dark:bg-border-dark rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-20 bg-border-light dark:bg-border-dark rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 bg-border-light dark:bg-border-dark rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-14 bg-border-light dark:bg-border-dark rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-16 bg-border-light dark:bg-border-dark rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-20 bg-border-light dark:bg-border-dark rounded" /></td>
      <td className="px-4 py-3"><div className="h-5 w-16 bg-border-light dark:bg-border-dark rounded-full" /></td>
      <td className="px-4 py-3"><div className="h-4 w-16 bg-border-light dark:bg-border-dark rounded ml-auto" /></td>
    </tr>
  );
}

export default function Products() {
  const [categories, setCategories] = useState([]);

  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [stockModalProduct, setStockModalProduct] = useState(null);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [notice, setNotice] = useState(null);

  const fetchProducts = useCallback(async () => {
    const { data } = await api.get('/products', {
      params: { search, category, status, lowStockOnly: lowStockOnly ? 'true' : 'false' },
    });
    return data;
  }, [search, category, status, lowStockOnly]);

  const { data: products, loading, error, reload: load } = useApiResource(fetchProducts);

  useEffect(() => {
    api.get('/products/categories')
      .then((res) => setCategories(res.data))
      .catch((err) => console.error('Failed to load categories:', err));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  function openAdd() {
    setEditingProduct(null);
    setFormModalOpen(true);
  }

  function openEdit(product) {
    setEditingProduct(product);
    setFormModalOpen(true);
  }

  function handleFormSaved() {
    setFormModalOpen(false);
    load();
  }

  function handleStockSaved() {
    setStockModalProduct(null);
    load();
  }

  async function handleConfirmDelete() {
    const product = deleteTarget;
    setDeleteTarget(null);
    try {
      await api.delete(`/products/${product.id}`);
      setNotice({ type: 'info', text: `${product.name} was deleted.` });
      load();
    } catch (err) {
      console.error('Failed to delete product:', err);
      setNotice({ type: 'error', text: err.response?.data?.error || 'Could not delete this product.' });
    }
  }

  const productList = products ?? [];
  const lowStockCount = productList.filter((p) => p.is_low_stock).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">Products</h1>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold"
        >
          <Plus size={16} /> Add Product
        </button>
      </div>

      {notice && (
        <div
          className={`text-sm rounded-lg px-4 py-2.5 ${
            notice.type === 'error'
              ? 'bg-red-50 dark:bg-red-500/10 text-red-600'
              : 'bg-brand-50 dark:bg-brand-500/10 text-brand-500 dark:text-brand-400'
          }`}
        >
          {notice.text}
        </div>
      )}

      {lowStockCount > 0 && !lowStockOnly && (
        <button
          onClick={() => setLowStockOnly(true)}
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-[color:var(--color-balance-owing)] text-sm text-left hover:brightness-95 dark:hover:brightness-110 transition-[filter]"
        >
          <AlertTriangle size={16} />
          {lowStockCount} product{lowStockCount > 1 ? 's are' : ' is'} running low on stock — click to view
        </button>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-light dark:text-muted-dark" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or supplier..."
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
          />
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-sm"
        >
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-sm"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="discontinued">Discontinued</option>
        </select>

        <label className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-sm cursor-pointer">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
          Low stock only
        </label>
      </div>

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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Expiry</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                ) : productList.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-muted-light dark:text-muted-dark">
                    No products found{search && ` for "${search}"`}.
                  </td></tr>
                ) : (
                  productList.map((p) => (
                    <tr key={p.id} className="border-b border-border-light dark:border-border-dark last:border-0 hover:bg-bg-light dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-muted-light dark:text-muted-dark">{p.category || '—'}</td>
                      <td className="px-4 py-3 text-muted-light dark:text-muted-dark">{p.supplier || '—'}</td>
                      <td className="px-4 py-3">₹{p.default_price}</td>
                      <td className="px-4 py-3">
                        <span className={p.is_low_stock ? 'text-[color:var(--color-balance-overdue)] font-semibold' : ''}>
                          {p.available_stock} {p.unit}
                        </span>
                        {p.is_low_stock && <AlertTriangle size={13} className="inline ml-1 text-[color:var(--color-balance-overdue)]" />}
                      </td>
                      <td className="px-4 py-3 text-muted-light dark:text-muted-dark">
                        {p.expiry_date ? new Date(p.expiry_date).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[p.status]}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setStockModalProduct(p)} className="p-2 rounded-lg hover:bg-brand-50 dark:hover:bg-white/5" title="Update stock">
                            <PackagePlus size={15} />
                          </button>
                          <button onClick={() => setHistoryProduct(p)} className="p-2 rounded-lg hover:bg-brand-50 dark:hover:bg-white/5" title="Stock history">
                            <History size={15} />
                          </button>
                          <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-brand-50 dark:hover:bg-white/5" title="Edit">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => setDeleteTarget(p)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600" title="Delete">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {formModalOpen && (
        <ProductFormModal product={editingProduct} onClose={() => setFormModalOpen(false)} onSaved={handleFormSaved} />
      )}
      {stockModalProduct && (
        <StockUpdateModal product={stockModalProduct} onClose={() => setStockModalProduct(null)} onSaved={handleStockSaved} />
      )}
      {historyProduct && (
        <StockHistoryPanel product={historyProduct} onClose={() => setHistoryProduct(null)} />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete product?"
          message={`Delete ${deleteTarget.name}? This only works if it has no purchase history — otherwise you'll need to discontinue it instead.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}