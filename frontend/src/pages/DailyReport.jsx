import { useState, useCallback } from 'react';
import { AlertCircle, RefreshCw, Download } from 'lucide-react';
import api from '../lib/api';
import { useApiResource } from '../hooks/useApiResource';
import { generateDailyReportPDF } from '../lib/exportUtils';
import ToggleTabs from '../components/ToggleTabs';
import { FEATURES } from '../lib/features';

const qty = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

function Card({ label, value, note }) {
  return (
    <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-5 shadow-[var(--shadow-card)]">
      <p className="text-sm text-muted-light dark:text-muted-dark">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {note && <p className="text-xs text-muted-light dark:text-muted-dark mt-2">{note}</p>}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-5 animate-pulse">
      <div className="h-4 w-20 bg-border-light dark:bg-border-dark rounded" />
      <div className="h-7 w-28 bg-border-light dark:bg-border-dark rounded mt-2" />
      <div className="h-3 w-24 bg-border-light dark:bg-border-dark rounded mt-3" />
    </div>
  );
}

// Itemized table: per-product totals or per-entry detail.
function DetailTable({ title, columns, rows }) {
  return (
    <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl overflow-hidden shadow-[var(--shadow-card)]">
      <div className="px-5 py-3 border-b border-border-light dark:border-border-dark">
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-light dark:text-muted-dark text-center py-6">No entries for this date.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border-light dark:border-border-dark">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-border-light dark:border-border-dark last:border-0 hover:bg-bg-light dark:hover:bg-white/[0.02] transition-colors">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-2.5">
                      {c.render ? c.render(row) : (row[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function DailyReport() {
  const [date, setDate] = useState(today());
  const [view, setView] = useState('customer'); // 'customer' | 'supplier'

  const fetchReport = useCallback(async () => {
    const { data } = await api.get('/reports/daily', { params: { date } });
    return data;
  }, [date]);

  const { data: report, loading, error, reload: load } = useApiResource(fetchReport);

  // The PDF always has both the customer and supplier sections.
  function handleDownload() {
    if (report) generateDailyReportPDF(report, { suppliers: FEATURES.suppliers });
  }

  const dairy = report?.dairy;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Daily Reports</h1>
          <p className="text-sm text-muted-light dark:text-muted-dark">{FEATURES.suppliers ? 'What went out to customers and what came in from suppliers.' : 'What went out to customers.'}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="p-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={handleDownload}
            disabled={!report}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold disabled:opacity-60"
          >
            <Download size={16} /> Download PDF
          </button>
        </div>
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
      ) : loading || !report || !dairy ? (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-4"><CardSkeleton /><CardSkeleton /></div>
        </div>
      ) : (
        <>
          {FEATURES.suppliers && <ToggleTabs
            value={view}
            onChange={setView}
            options={[
              { value: 'customer', label: 'Customer Activity' },
              { value: 'supplier', label: 'Supplier Activity' },
            ]}
          />}

          {view === 'customer' || !FEATURES.suppliers ? (
            <section className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Card label="Customers served" value={dairy.customersServed} />
                <Card label="Entries" value={report.sales.entries} note={`${dairy.soldByProduct.length} different products`} />
              </div>
              <DetailTable
                title="Sold — total per product"
                rows={dairy.soldByProduct}
                columns={[
                  { key: 'product_name', label: 'Product' },
                  { key: 'quantity', label: 'Quantity', render: (r) => `${qty(r.quantity)} ${r.unit}` },
                  { key: 'customers', label: 'Customers' },
                ]}
              />
              <DetailTable
                title="Who bought what"
                rows={report.sales.items}
                columns={[
                  { key: 'customer_name', label: 'Customer' },
                  { key: 'product_name', label: 'Product' },
                  { key: 'quantity', label: 'Qty', render: (r) => `${qty(r.quantity)} ${r.unit}` },
                ]}
              />
            </section>
          ) : (
            <section className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Card label="Deliveries received" value={report.stockPurchases.entries} />
                <Card label="Products received" value={dairy.receivedByProduct.length} />
              </div>
              <DetailTable
                title="Received — total per product"
                rows={dairy.receivedByProduct}
                columns={[
                  { key: 'product_name', label: 'Product' },
                  { key: 'quantity', label: 'Quantity', render: (r) => `${qty(r.quantity)} ${r.unit}` },
                  { key: 'suppliers', label: 'Suppliers' },
                ]}
              />
              <DetailTable
                title="Who delivered what"
                rows={report.stockPurchases.items}
                columns={[
                  { key: 'supplier_name', label: 'Supplier' },
                  { key: 'product_name', label: 'Product' },
                  { key: 'quantity', label: 'Qty', render: (r) => `${qty(r.quantity)} ${r.unit}` },
                ]}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
