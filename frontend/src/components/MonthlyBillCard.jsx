import { useState } from 'react';
import { FileDown } from 'lucide-react';
import api from '../lib/api';
import { generateBillPDF } from '../lib/exportUtils';

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function MonthlyBillCard({ customerId }) {
  const [monthValue, setMonthValue] = useState(currentMonthValue());
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerate() {
    setError('');
    setBill(null);
    const [year, month] = monthValue.split('-');

    setLoading(true);
    try {
      const { data } = await api.get(`/customers/${customerId}/bill`, { params: { year, month } });
      setBill(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not generate the bill');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-5">
      <h2 className="font-semibold text-sm mb-4">Monthly Bill</h2>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-sm font-medium text-muted-light dark:text-muted-dark mb-1">Month</label>
          <input
            type="month"
            value={monthValue}
            onChange={(e) => setMonthValue(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
          />
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-4 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold disabled:opacity-60"
        >
          {loading ? 'Generating...' : 'Generate Bill'}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {bill && (
        <div>
          {bill.items.length === 0 ? (
            <p className="text-sm text-muted-light dark:text-muted-dark">No purchases found for this month.</p>
          ) : (
            <>
              <table className="w-full text-sm mb-4">
                <thead>
                  <tr className="border-b border-border-light dark:border-border-dark">
                    <th className="text-left py-2 text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Product</th>
                    <th className="text-left py-2 text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Qty</th>
                    <th className="text-left py-2 text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Rate</th>
                    <th className="text-left py-2 text-xs font-semibold text-muted-light dark:text-muted-dark uppercase">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.items.map((item, i) => (
                    <tr key={i} className="border-b border-border-light dark:border-border-dark last:border-0">
                      <td className="py-2">{item.product}</td>
                      <td className="py-2">{item.quantity} {item.unit}</td>
                      <td className="py-2">₹{item.avg_price}</td>
                      <td className="py-2 font-medium">₹{item.subtotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <p className="font-bold text-base">Total: ₹{bill.total}</p>
                  <p className="text-muted-light dark:text-muted-dark">Paid this month: ₹{bill.paidThisMonth}</p>
                </div>
                <button
                  onClick={() => generateBillPDF(bill)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border-light dark:border-border-dark hover:bg-brand-50 dark:hover:bg-white/5 text-sm font-semibold"
                >
                  <FileDown size={16} /> Download PDF
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}