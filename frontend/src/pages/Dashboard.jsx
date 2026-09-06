import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, AlertCircle, IndianRupee, TrendingUp, PackageX, Wallet, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

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
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function loadDashboard() {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get('/dashboard/stats'),
      api.get('/dashboard/purchase-trend?days=14'),
    ])
      .then(([statsRes, trendRes]) => {
        setStats(statsRes.data);
        setTrend(trendRes.data);
      })
      .catch((err) => {
        console.error('Dashboard load failed:', err);
        setError('Could not load dashboard data. Check that the backend is running.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <div className="bg-surface-light dark:bg-surface-dark border border-red-200 dark:border-red-500/30 rounded-xl p-6 flex flex-col items-center text-center gap-3">
          <AlertCircle size={28} className="text-[color:var(--color-balance-overdue)]" />
          <p className="text-sm text-muted-light dark:text-muted-dark">{error}</p>
          <button
            onClick={loadDashboard}
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
      <h1 className="text-xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              icon={Users}
              label="Active Customers"
              value={stats.activeCustomers}
              tint="bg-brand-50 dark:bg-brand-500/10 text-brand-500 dark:text-brand-400"
            />
            <StatCard
              icon={AlertCircle}
              label="Customers Owing"
              value={stats.customersOwing}
              tint="bg-amber-50 dark:bg-amber-500/10 text-[color:var(--color-balance-owing)]"
            />
            <StatCard
              icon={IndianRupee}
              label="Total Outstanding"
              value={`₹${Number(stats.totalOutstanding ?? 0).toLocaleString('en-IN')}`}
              tint="bg-red-50 dark:bg-red-500/10 text-[color:var(--color-balance-overdue)]"
            />
            <StatCard
              icon={Wallet}
              label="Owed to Suppliers"
              value={`₹${Number(stats.totalPayable ?? 0).toLocaleString('en-IN')}`}
              tint="bg-amber-50 dark:bg-amber-500/10 text-[color:var(--color-balance-owing)]"
            />
            <StatCard
              icon={TrendingUp}
              label="This Month's Revenue"
              value={`₹${Number(stats.thisMonthRevenue ?? 0).toLocaleString('en-IN')}`}
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

      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-semibold text-muted-light dark:text-muted-dark mb-4">
          Purchases — last 14 days
        </h2>
        {loading ? (
          <div className="h-[260px] flex items-center justify-center text-sm text-muted-light dark:text-muted-dark">
            Loading chart...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => d.slice(5)}
                tick={{ fontSize: 12 }}
                stroke="currentColor"
                opacity={0.5}
              />
              <YAxis tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} />
              <Tooltip
                formatter={(value) => [`₹${value}`, 'Revenue']}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid var(--color-border-light)',
                  background: 'var(--color-surface-light)',
                  color: 'var(--color-text-light)',
                  fontSize: 13,
                }}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="var(--color-brand-500)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}