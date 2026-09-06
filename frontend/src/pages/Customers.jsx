import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import api from '../lib/api';
import BalanceBadge from '../components/BalanceBadge';
import CustomerFormModal from '../components/CustomerFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { exportCustomersToExcel } from '../lib/exportUtils';
import { useApiResource } from '../hooks/useApiResource';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const PAGE_SIZE = 10;

function SkeletonRow() {
  return (
    <tr className="border-b border-border-light dark:border-border-dark last:border-0 animate-pulse">
      <td className="px-4 py-3"><div className="h-4 w-16 bg-border-light dark:bg-border-dark rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-32 bg-border-light dark:bg-border-dark rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 bg-border-light dark:bg-border-dark rounded" /></td>
      <td className="px-4 py-3"><div className="h-5 w-16 bg-border-light dark:bg-border-dark rounded-full" /></td>
      <td className="px-4 py-3"><div className="h-4 w-12 bg-border-light dark:bg-border-dark rounded ml-auto" /></td>
    </tr>
  );
}

export default function Customers() {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput);
  const [status, setStatus] = useState('active');
  const [balance, setBalance] = useState('all');
  const [sortBy, setSortBy] = useState('full_name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [confirmState, setConfirmState] = useState(null); // { type: 'delete'|'restore', customer }
  const [notice, setNotice] = useState(null);
  const [exporting, setExporting] = useState(false);

  const fetchCustomers = useCallback(async () => {
    const { data } = await api.get('/customers', {
      params: { search, status, balance, sortBy, sortOrder, page, limit: PAGE_SIZE },
    });
    return data; // { data: [...], pagination: {...} }
  }, [search, status, balance, sortBy, sortOrder, page]);

  const { data: result, loading, error, reload: load } = useApiResource(fetchCustomers);
  const customers = result?.data ?? [];
  const pagination = result?.pagination ?? { page: 1, totalPages: 1, total: 0 };

  useEffect(() => { setPage(1); }, [search, status, balance, sortBy, sortOrder]);

  // Auto-dismiss transient notices
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  function toggleSort(column) {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const { data } = await api.get('/customers', {
        params: { search, status, balance, sortBy, sortOrder, page: 1, limit: 1000 },
      });
      exportCustomersToExcel(data.data);
    } catch (err) {
      console.error('Export failed:', err);
      setNotice({ type: 'error', text: 'Export failed. Please try again.' });
    } finally {
      setExporting(false);
    }
  }

  function openAdd() {
    setEditingCustomer(null);
    setModalOpen(true);
  }

  function openEdit(customer) {
    setEditingCustomer(customer);
    setModalOpen(true);
  }

  function handleSaved() {
    setModalOpen(false);
    load();
  }

  function requestDelete(customer) {
    setConfirmState({ type: 'delete', customer });
  }

  function requestRestore(customer) {
    setConfirmState({ type: 'restore', customer });
  }

  async function handleConfirm() {
    const { type, customer } = confirmState;
    setConfirmState(null);
    try {
      if (type === 'delete') {
        const { data } = await api.delete(`/customers/${customer.id}`);
        if (data.archived) {
          setNotice({
            type: 'info',
            text: `${customer.full_name} has purchase history, so they were archived instead of deleted.`,
          });
        } else {
          setNotice({ type: 'info', text: `${customer.full_name} was deleted.` });
        }
      } else if (type === 'restore') {
        await api.post(`/customers/${customer.id}/restore`);
        setNotice({ type: 'info', text: `${customer.full_name} was restored.` });
      }
      load();
    } catch (err) {
      console.error('Action failed:', err);
      setNotice({ type: 'error', text: err.response?.data?.error || 'Something went wrong.' });
    }
  }

  function SortHeader({ column, label }) {
    const active = sortBy === column;
    return (
      <th
        className="px-4 py-3 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase cursor-pointer select-none"
        onClick={() => toggleSort(column)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {active && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
        </span>
      </th>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">Customers</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border-light dark:border-border-dark hover:bg-brand-50 dark:hover:bg-white/5 text-sm font-semibold disabled:opacity-60"
          >
            <FileSpreadsheet size={16} /> {exporting ? 'Exporting...' : 'Export Excel'}
          </button>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold"
          >
            <Plus size={16} /> Add Customer
          </button>
        </div>
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

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-light dark:text-muted-dark" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, code, or mobile..."
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

        <select
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-sm"
        >
          <option value="all">All Balances</option>
          <option value="owing">Owing</option>
          <option value="clear">Clear</option>
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
                  <SortHeader column="customer_code" label="Code" />
                  <SortHeader column="full_name" label="Name" />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Mobile</th>
                  <SortHeader column="outstanding_balance" label="Balance" />
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                ) : customers.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-10 text-muted-light dark:text-muted-dark">
                    No customers found{search && ` for "${search}"`}.
                  </td></tr>
                ) : (
                  customers.map((c) => (
                    <tr key={c.id} className={`border-b border-border-light dark:border-border-dark last:border-0 hover:bg-bg-light dark:hover:bg-white/[0.02] transition-colors ${!c.active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-muted-light dark:text-muted-dark">{c.customer_code}</td>
                      <td className="px-4 py-3 font-medium">
                        <Link to={`/customers/${c.id}`} className="hover:text-brand-500 hover:underline">
                          {c.full_name}
                        </Link>
                        {!c.active && <span className="ml-2 text-xs text-muted-light dark:text-muted-dark">(archived)</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-light dark:text-muted-dark">{c.mobile_number}</td>
                      <td className="px-4 py-3"><BalanceBadge amount={c.outstanding_balance} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {c.active ? (
                            <>
                              <button onClick={() => openEdit(c)} className="p-2 rounded-lg hover:bg-brand-50 dark:hover:bg-white/5" title="Edit">
                                <Pencil size={15} />
                              </button>
                              <button onClick={() => requestDelete(c)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600" title="Delete">
                                <Trash2 size={15} />
                              </button>
                            </>
                          ) : (
                            <button onClick={() => requestRestore(c)} className="p-2 rounded-lg hover:bg-brand-50 dark:hover:bg-white/5" title="Restore">
                              <RotateCcw size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && pagination.total > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border-light dark:border-border-dark text-sm text-muted-light dark:text-muted-dark">
              <span>
                Showing {(pagination.page - 1) * PAGE_SIZE + 1}–{Math.min(pagination.page * PAGE_SIZE, pagination.total)} of {pagination.total}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="p-1.5 rounded-lg border border-border-light dark:border-border-dark disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                <span>Page {pagination.page} of {pagination.totalPages}</span>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                  className="p-1.5 rounded-lg border border-border-light dark:border-border-dark disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {modalOpen && (
        <CustomerFormModal
          customer={editingCustomer}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {confirmState && confirmState.type === 'delete' && (
        <ConfirmDialog
          title="Remove customer?"
          message={`Remove ${confirmState.customer.full_name}? If they have purchase history, they'll be archived instead of deleted.`}
          confirmLabel="Remove"
          danger
          onConfirm={handleConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}

      {confirmState && confirmState.type === 'restore' && (
        <ConfirmDialog
          title="Restore customer?"
          message={`Restore ${confirmState.customer.full_name}?`}
          confirmLabel="Restore"
          onConfirm={handleConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}