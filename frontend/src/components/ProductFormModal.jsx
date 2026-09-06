import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../lib/api';

const EMPTY_FORM = { name: '', unit: '', default_price: '', category: '', supplier: '', low_stock_threshold: '5', status: 'active' };

export default function ProductFormModal({ product, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        unit: product.unit,
        default_price: product.default_price,
        category: product.category || '',
        supplier: product.supplier || '',
        low_stock_threshold: product.low_stock_threshold,
        status: product.status || 'active',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [product]);

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Product name is required';
    if (!form.unit.trim()) errs.unit = 'Unit is required (e.g. litre, kg)';
    if (!form.default_price || parseFloat(form.default_price) <= 0) errs.default_price = 'Enter a price greater than 0';
    if (form.low_stock_threshold !== '' && parseFloat(form.low_stock_threshold) < 0) errs.low_stock_threshold = 'Cannot be negative';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        ...form,
        default_price: parseFloat(form.default_price),
        low_stock_threshold: form.low_stock_threshold === '' ? 5 : parseFloat(form.low_stock_threshold),
      };
      if (product) {
        await api.put(`/products/${product.id}`, payload);
      } else {
        delete payload.status; // status only applies to edits, new products always start active
        await api.post('/products', payload);
      }
      onSaved();
    } catch (err) {
      setServerError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function field(name, label, type = 'text', placeholder = '') {
    return (
      <div>
        <label className="block text-sm font-medium text-muted-light dark:text-muted-dark mb-1">{label}</label>
        <input
          type={type}
          step={type === 'number' ? '0.01' : undefined}
          min={type === 'number' ? '0' : undefined}
          value={form[name]}
          onChange={(e) => setForm({ ...form, [name]: e.target.value })}
          placeholder={placeholder}
          className={`w-full px-3 py-2.5 rounded-lg border bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 ${errors[name] ? 'border-red-500' : 'border-border-light dark:border-border-dark'}`}
        />
        {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name]}</p>}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light dark:border-border-dark">
          <h2 className="font-semibold">{product ? 'Edit Product' : 'Add Product'}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {field('name', 'Product Name', 'text', 'Milk')}

          <div className="grid grid-cols-2 gap-3">
            {field('category', 'Category', 'text', 'Dairy')}
            {field('unit', 'Unit', 'text', 'litre, kg...')}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field('default_price', 'Price (₹)', 'number')}
            {field('low_stock_threshold', 'Low Stock Alert Below', 'number')}
          </div>

          {field('supplier', 'Supplier', 'text', 'Local Farm Co-op')}

          {product && (
            <div>
              <label className="block text-sm font-medium text-muted-light dark:text-muted-dark mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="active">Active</option>
                <option value="discontinued">Discontinued</option>
              </select>
            </div>
          )}

          {serverError && (
            <p className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{serverError}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border-light dark:border-border-dark font-medium">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold disabled:opacity-60">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}