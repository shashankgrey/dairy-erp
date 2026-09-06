import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Search, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../lib/api';
import SupplierFormModal from '../components/SupplierFormModal';
import { useApiResource } from '../hooks/useApiResource';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

function SkeletonRow() {
  return (
    <tr className="border-b border-border-light dark:border-border-dark last:border-0 animate-pulse">
      <td className="p-3"><div className="h-4 w-32 bg-border-light dark:bg-border-dark rounded mb-1" /><div className="h-3 w-20 bg-border-light dark:bg-border-dark rounded" /></td>
      <td className="p-3"><div className="h-4 w-16 bg-border-light dark:bg-border-dark rounded" /></td>
      <td className="p-3"><div className="h-4 w-16 bg-border-light dark:bg-border-dark rounded" /></td>
      <td className="p-3"><div className="h-4 w-16 bg-border-light dark:bg-border-dark rounded" /></td>
      <td className="p-3"><div className="h-4 w-8 bg-border-light dark:bg-border-dark rounded ml-auto" /></td>
    </tr>
  );
}

export default function Suppliers() {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput);
  const [status, setStatus] = useState('active');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);

  const fetchSuppliers = useCallback(async () => {
    const { data } = await api.get('/suppliers', { params: { search, status } });
    return data;
  }, [search, status]);

  const { data: suppliers, loading, error, reload: load } = useApiResource(fetchSuppliers);
  const supplierList = suppliers ?? [];

  function openAdd() {
    setEditingSupplier(null);
    setModalOpen(true);
  }

  function openEdit(supplier) {
    setEditingSupplier(supplier);
    setModalOpen(true);
  }

  function handleSaved() {
    setModalOpen(false);
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold">Suppliers</h1>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold"
        >
          <Plus size={16} /> Add Supplier
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-light dark:text-muted-dark" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search suppliers..."
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-sm"
        >
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </select>
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
                  <th className="p-3 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Supplier</th>
                  <th className="p-3 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Purchased</th>
                  <th className="p-3 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Paid</th>
                  <th className="p-3 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Payable</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : supplierList.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-light dark:text-muted-dark">
                    No suppliers found{search && ` for "${search}"`}.
                  </td></tr>
                ) : (
                  supplierList.map((s) => (
                    <tr key={s.id} className={`border-b border-border-light dark:border-border-dark last:border-0 hover:bg-bg-light dark:hover:bg-white/[0.02] transition-colors ${!s.active ? 'opacity-50' : ''}`}>
                      <td className="p-3">
                        <Link className="font-semibold text-brand-500 dark:text-brand-400 hover:underline" to={`/suppliers/${s.id}`}>
                          {s.full_name}
                        </Link>
                        <div className="text-xs text-muted-light dark:text-muted-dark">
                          {s.supplier_code} {s.mobile_number ? `• ${s.mobile_number}` : ''}
                          {!s.active && ' • Archived'}
                        </div>
                      </td>
                      <td className="p-3">{money(s.total_purchased)}</td>
                      <td className="p-3">{money(s.total_paid)}</td>
                      <td className="p-3 font-semibold text-[color:var(--color-balance-owing)]">{money(s.outstanding_balance)}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-end">
                          <button onClick={() => openEdit(s)} className="p-2 rounded-lg hover:bg-brand-50 dark:hover:bg-white/5" title="Edit">
                            <Pencil size={15} />
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

      {modalOpen && (
        <SupplierFormModal
          supplier={editingSupplier}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}