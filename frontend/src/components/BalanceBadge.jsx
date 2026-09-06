// Consistent balance-status pill used everywhere a customer's balance appears
// (list, profile, dashboard). Color communicates status at a glance:
// green = clear/credit, amber = owing a modest amount, red = owing a lot.
export default function BalanceBadge({ amount }) {
  const value = parseFloat(amount);
  let colorClass, label;

  if (value <= 0) {
    colorClass = 'bg-[color:var(--color-balance-clear)]/10 text-[color:var(--color-balance-clear)]';
    label = value < 0 ? `₹${Math.abs(value).toLocaleString('en-IN')} credit` : 'Clear';
  } else if (value < 1000) {
    colorClass = 'bg-[color:var(--color-balance-owing)]/10 text-[color:var(--color-balance-owing)]';
    label = `₹${value.toLocaleString('en-IN')}`;
  } else {
    colorClass = 'bg-[color:var(--color-balance-overdue)]/10 text-[color:var(--color-balance-overdue)]';
    label = `₹${value.toLocaleString('en-IN')}`;
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${colorClass}`}>
      {label}
    </span>
  );
}