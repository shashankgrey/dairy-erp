import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../lib/api';

const EMPTY_FORM = { full_name: '', mobile_number: '', address: '', email: '', notes: '' };

export default function SupplierFormModal({ supplier, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (supplier) {
      setForm({
        full_name: supplier.full_name || '',
        mobile_number: supplier.mobile_number || '',
        address: supplier.address || '',
        email: supplier.email || '',
        notes: supplier.notes || '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [supplier]);

  function validate() {
    const errs = {};
    if (!form.full_name.trim()) errs.full_name = 'Name is required';
    if (form.mobile_number && !/^\d{10}$/.test(form.mobile_number.trim())) errs.mobile_number = 'Enter a valid 10-digit mobile number';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email address';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    setSaving(true);
    try {
      if (supplier) {
        await api.put(`/suppliers/${supplier.id}`, form);
      } else {
        await api.post('/suppliers', form);
      }
      onSaved();
    } catch (err) {
      setServerError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function field(name, label, type = 'text', required = false) {
    return (
      <div>
        <label className="block text-sm font-medium text-muted-light dark:text-muted-dark mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input
          type={type}
          value={form[name]}
          onChange={(e) => setForm({ ...form, [name]: e.target.value })}
          className={`w-full px-3 py-2.5 rounded-lg border bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500
            ${errors[name] ? 'border-red-500' : 'border-border-light dark:border-border-dark'}`}
        />
        {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name]}</p>}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light dark:border-border-dark">
          <h2 className="font-semibold">{supplier ? 'Edit Supplier' : 'Add Supplier'}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {field('full_name', 'Name', 'text', true)}
          {field('mobile_number', 'Mobile Number', 'tel')}
          {field('address', 'Address')}
          {field('email', 'Email (optional)', 'email')}

          <div>
            <label className="block text-sm font-medium text-muted-light dark:text-muted-dark mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

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