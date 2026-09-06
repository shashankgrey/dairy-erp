import { AlertTriangle, X } from 'lucide-react';

// Reusable replacement for window.confirm(), styled to match the app's
// existing modal conventions (CustomerFormModal, PaymentModal, etc).
// Usage: render conditionally with a state object, pass onConfirm/onCancel.
export default function ConfirmDialog({
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light dark:border-border-dark">
          <div className="flex items-center gap-2">
            {danger && (
              <AlertTriangle size={18} className="text-[color:var(--color-balance-overdue)]" />
            )}
            <h2 className="font-semibold text-sm">{title}</h2>
          </div>
          <button onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm text-muted-light dark:text-muted-dark">{message}</p>

          <div className="flex gap-3 pt-5">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-lg border border-border-light dark:border-border-dark font-medium text-sm"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 py-2.5 rounded-lg text-white font-semibold text-sm transition-colors ${
                danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-500 hover:bg-brand-600'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}