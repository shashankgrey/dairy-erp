import { useState } from 'react';
import { X } from 'lucide-react';
import api from '../lib/api';

export default function StockUpdateModal({ product, onClose, onSaved }) {
  const [movementType, setMovementType] = useState('restock');
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!quantity || parseFloat(quantity) <= 0) {
      setError('Enter a quantity greater than 0');
      return;
    }

    setSaving(true);
    try {
      await api.post(`/products/${product.id}/stock`, {
        movement_type: movementType,
        quantity: parseFloat(quantity),
        expiry_date: movementType === 'restock' && expiryDate ? expiryDate : null,
        notes: notes || null,
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light dark:border-border-dark">
          <h2 className="font-semibold">Update Stock — {product.name}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-sm text-muted-light dark:text-muted-dark">
            Currently in stock: <span className="font-semibold text-text-light dark:text-text-dark">{product.available_stock} {product.unit}</span>
          </p>

          <div>
            <label className="block text-sm font-medium text-muted-light dark:text-muted-dark mb-1">Action</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'restock', label: 'Fresh Stock' },
                { value: 'disposal', label: 'Dispose' },
                { value: 'adjustment', label: 'Adjust' },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setMovementType(opt.value)}
                  className={`py-2 rounded-lg text-sm font-medium border ${
                    movementType === opt.value
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'border-border-light dark:border-border-dark hover:bg-brand-50 dark:hover:bg-white/5'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-light dark:text-muted-dark mb-1">
              Quantity ({product.unit}) {movementType === 'adjustment' && '— enter the difference, e.g. -2 to reduce'}
            </label>
            <input
              type="number"
              step="0.1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {movementType === 'restock' && (
            <div>
              <label className="block text-sm font-medium text-muted-light dark:text-muted-dark mb-1">Expiry Date (optional)</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-muted-light dark:text-muted-dark mb-1">Notes (optional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={movementType === 'disposal' ? 'e.g. Spoiled, past expiry' : 'e.g. Morning delivery'}
              className="w-full px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border-light dark:border-border-dark font-medium">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold disabled:opacity-60">
              {saving ? 'Saving...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}