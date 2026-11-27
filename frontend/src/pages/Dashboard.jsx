import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserCheck, ReceiptText, PackageX, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../lib/api';
import { FEATURES } from '../lib/features';
import { useApiResource } from '../hooks/useApiResource';

const qty = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

function StatCard({ icon: Icon, label, value, tint }) {
  return (
    <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-light dark:text-muted-dark">{label}</span>
        <div className={`p-2 rounded-lg ${tint}`}>
          <Icon size={16} />
        </div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-24 bg-border-light dark:bg-border-dark rounded" />
        <div className="h-8 w-8 bg-border-light dark:bg-border-dark rounded-lg" />
      </div>
      <div className="h-7 w-16 bg-border-light dark:bg-border-dark rounded" />
    </div>
  );
}

export default function Dashboard() {
  const fetchToday = useCallback(async () => {
    const { data } = await api.get('/dashboard/today');
    return data;
  }, []);
  const { data: stats, loading, error, reload } = useApiResource(fetchToday);
  const products = stats?.products ?? [];

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <div className="bg-surface-light dark:bg-surface-dark border border-red-200 dark:border-red-500/30 rounded-xl p-6 flex flex-col items-center text-center gap-3">
          <AlertCircle size={28} className="text-[color:var(--color-balance-overdue)]" />
          <p className="text-sm text-muted-light dark:text-muted-dark">{error}</p>
          <button
            onClick={reload}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <Link
          to="/billing"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold"
        >
          <ReceiptText size={16} /> Start billing
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading && !stats ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              icon={Users}
              label="Active Customers"
              value={stats.activeCustomers}
              tint="bg-brand-50 dark:bg-brand-500/10 text-brand-500 dark:text-brand-400"
            />
            <StatCard
              icon={UserCheck}
              label="Customers Served Today"
              value={stats.servedToday}
              tint="bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400"
            />
            <StatCard
              icon={ReceiptText}
              label="Entries Today"
              value={stats.entriesToday}
              tint="bg-brand-50 dark:bg-brand-500/10 text-brand-500 dark:text-brand-400"
            />
            <Link to="/products">
              <StatCard
                icon={PackageX}
                label="Low Stock Products"
                value={stats.lowStockProducts}
                tint="bg-red-50 dark:bg-red-500/10 text-[color:var(--color-balance-overdue)]"
              />
            </Link>
          </>
        )}
      </div>

      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl overflow-hidden shadow-[var(--shadow-card)]">
        <div className="px-5 py-3 border-b border-border-light dark:border-border-dark">
          <h2 className="font-semibold">Today's products</h2>
          <p className="text-xs text-muted-light dark:text-muted-dark">{FEATURES.suppliers ? "What went out, what came in, and what's left." : "What went out today and what's left."}</p>
        </div>
        {loading && !stats ? (
          <div className="p-8 text-center text-sm text-muted-light dark:text-muted-dark">Loading…</div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-light dark:text-muted-dark">No active products yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border-light dark:border-border-dark">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Product</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Sold today</th>
                  {FEATURES.suppliers && <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Received today</th>}
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">In stock</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-border-light dark:border-border-dark last:border-0">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-right font-semibold">{p.soldToday ? `${qty(p.soldToday)} ${p.unit}` : '—'}</td>
                    {FEATURES.suppliers && <td className="px-4 py-3 text-right">{p.receivedToday ? `${qty(p.receivedToday)} ${p.unit}` : '—'}</td>}
                    <td className={`px-4 py-3 text-right ${p.lowStock ? 'text-red-600 font-semibold' : ''}`}>
                      {qty(p.stock)} {p.unit}{p.lowStock ? ' · low' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
