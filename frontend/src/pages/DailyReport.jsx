import { useState, useCallback } from 'react';
import { AlertCircle, RefreshCw, Download } from 'lucide-react';
import api from '../lib/api';
import { useApiResource } from '../hooks/useApiResource';
import { generateDailyReportPDF } from '../lib/exportUtils';
import ToggleTabs from '../components/ToggleTabs';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);

function Card({ label, value, note }) {
  return (
    <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-5 shadow-[var(--shadow-card)]">
      <p className="text-sm text-muted-light dark:text-muted-dark">{label}</p>
      <p className="text-2xl font-bold mt-1">{money(value)}</p>
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

// Itemized breakdown table used under each summary section (sales,
// collections, stock purchases, supplier payments) -- shows real
// names/amounts instead of just the aggregate total above it.
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

  function methods(items) {
    const parts = Object.entries(items)
      .filter(([, amount]) => amount)
      .map(([method, amount]) => `${method.toUpperCase()} ${money(amount)}`);
    return parts.length ? parts.join(' • ') : 'No payments';
  }

  // The PDF always contains the full report (both customer and
  // supplier sections) regardless of which tab is active on screen --
  // it's a complete document, not a screenshot of the current view.
  function handleDownload() {
    if (report) generateDailyReportPDF(report);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Daily Reports</h1>
          <p className="text-sm text-muted-light dark:text-muted-dark">Customer collections and supplier activity in one place.</p>
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
      ) : loading || !report ? (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-4"><CardSkeleton /><CardSkeleton /></div>
          <div className="grid sm:grid-cols-3 gap-4"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
        </div>
      ) : (
        <>
          <ToggleTabs
            value={view}
            onChange={setView}
            options={[
              { value: 'customer', label: 'Customer Activity' },
              { value: 'supplier', label: 'Supplier Activity' },
            ]}
          />

          {view === 'customer' ? (
            <section className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Card label="Sales" value={report.sales.total} note={`${report.sales.entries} sale entries`} />
                <Card label="Collections" value={report.collections.total} note={methods(report.collections.byMethod)} />
              </div>
              <DetailTable
                title="Sales — who bought what"
                rows={report.sales.items}
                columns={[
                  { key: 'customer_name', label: 'Customer' },
                  { key: 'product_name', label: 'Product' },
                  { key: 'quantity', label: 'Qty', render: (r) => `${r.quantity} ${r.unit}` },
                  { key: 'unit_price', label: 'Rate', render: (r) => money(r.unit_price) },
                  { key: 'total_amount', label: 'Amount', render: (r) => money(r.total_amount) },
                ]}
              />
              <DetailTable
                title="Collections — who paid"
                rows={report.collections.items}
                columns={[
                  { key: 'customer_name', label: 'Customer' },
                  { key: 'payment_method', label: 'Method', render: (r) => r.payment_method.toUpperCase() },
                  { key: 'amount', label: 'Amount', render: (r) => money(r.amount) },
                  { key: 'notes', label: 'Notes' },
                ]}
              />
            </section>
          ) : (
            <section className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Card label="Stock Purchased" value={report.stockPurchases.total} note={`${report.stockPurchases.entries} supplier purchase entries`} />
                <Card label="Supplier Payments" value={report.supplierPayments.total} note={methods(report.supplierPayments.byMethod)} />
              </div>
              <DetailTable
                title="Stock Purchases — what came in"
                rows={report.stockPurchases.items}
                columns={[
                  { key: 'supplier_name', label: 'Supplier' },
                  { key: 'product_name', label: 'Product' },
                  { key: 'quantity', label: 'Qty', render: (r) => `${r.quantity} ${r.unit}` },
                  { key: 'unit_cost', label: 'Cost/Unit', render: (r) => money(r.unit_cost) },
                  { key: 'total_amount', label: 'Amount', render: (r) => money(r.total_amount) },
                ]}
              />
              <DetailTable
                title="Supplier Payments — who we paid"
                rows={report.supplierPayments.items}
                columns={[
                  { key: 'supplier_name', label: 'Supplier' },
                  { key: 'payment_method', label: 'Method', render: (r) => r.payment_method.toUpperCase() },
                  { key: 'amount', label: 'Amount', render: (r) => money(r.amount) },
                  { key: 'reference_number', label: 'Reference' },
                ]}
              />
            </section>
          )}

          <section>
            <h2 className="font-semibold mb-3">Current money position</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              <Card label="Customer Receivables" value={report.receivables} />
              <Card label="Supplier Payables" value={report.payables} />
              <Card label="Net Receivable" value={report.netReceivable} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}