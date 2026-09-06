// Small segmented-control style toggle, used wherever a page needs to
// switch between two or more views without a full route change (e.g.
// Daily Entry's permanent/temporary customer-and-product toggle,
// Daily Report's customer/supplier view toggle).
export default function ToggleTabs({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-lg border border-border-light dark:border-border-dark p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            value === opt.value
              ? 'bg-brand-500 text-white'
              : 'text-muted-light dark:text-muted-dark hover:bg-brand-50 dark:hover:bg-white/5'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}