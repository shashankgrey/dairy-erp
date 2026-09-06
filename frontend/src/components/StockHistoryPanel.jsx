import { useState, useEffect } from 'react';
import { X, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../lib/api';

const TYPE_LABELS = {
  restock: { label: 'Fresh Stock', color: 'text-[color:var(--color-balance-clear)]' },
  disposal: { label: 'Disposed', color: 'text-[color:var(--color-balance-overdue)]' },
  adjustment: { label: 'Adjustment', color: 'text-[color:var(--color-balance-owing)]' },
};

export default function StockHistoryPanel({ product, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    setError(null);
    api.get(`/products/${product.id}/stock-history`)
      .then((res) => setHistory(res.data))
      .catch((err) => {
        console.error('Failed to load stock history:', err);
        setError('Could not load stock history.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [product.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light dark:border-border-dark">
          <h2 className="font-semibold">Stock History — {product.name}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <p className="text-center py-8 text-muted-light dark:text-muted-dark text-sm">Loading...</p>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-8 px-5 text-center">
              <AlertCircle size={22} className="text-[color:var(--color-balance-overdue)]" />
              <p className="text-sm text-muted-light dark:text-muted-dark">{error}</p>
              <button
                onClick={load}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-medium hover:bg-brand-600 transition-colors"
              >
                <RefreshCw size={12} /> Retry
              </button>
            </div>
          ) : history.length === 0 ? (
            <p className="text-center py-8 text-muted-light dark:text-muted-dark text-sm">No stock movements recorded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border-light dark:border-border-dark sticky top-0 bg-surface-light dark:bg-surface-dark">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Qty</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Notes</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => {
                  const meta = TYPE_LABELS[h.movement_type];
                  const qty = parseFloat(h.quantity);
                  return (
                    <tr key={h.id} className="border-b border-border-light dark:border-border-dark last:border-0">
                      <td className="px-4 py-2.5 text-muted-light dark:text-muted-dark">
                        {new Date(h.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td className={`px-4 py-2.5 font-medium ${meta.color}`}>{meta.label}</td>
                      <td className={`px-4 py-2.5 font-medium ${meta.color}`}>{qty > 0 ? '+' : ''}{qty} {product.unit}</td>
                      <td className="px-4 py-2.5 text-muted-light dark:text-muted-dark">{h.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}