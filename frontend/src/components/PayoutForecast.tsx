import { useEffect, useState } from 'react'
import { api, PayoutForecast, fmtUsd } from '../lib/api'

export default function PayoutForecastWidget() {
  const [data, setData] = useState<PayoutForecast | null>(null)
  useEffect(() => { api.plan.forecast().then(setData) }, [])
  if (!data) return null
  return (
    <div className="bg-gradient-to-br from-panel to-panel2/30 border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted">Forecast</div>
          <div className="text-sm font-semibold mt-0.5">
            Expected payouts over the next 6 months
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted uppercase">6-month total</div>
          <div className="text-2xl font-bold text-accent num">{fmtUsd(data.total_next_6_months)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-2">
        {data.buckets.map(b => (
          <div key={b.label} className="bg-panel border border-border rounded-md p-2.5">
            <div className="text-[10px] text-muted uppercase tracking-wider">{b.label}</div>
            <div className={`num font-semibold mt-1 ${b.total > 0 ? 'text-win' : 'text-muted'}`}>
              {b.total > 0 ? fmtUsd(b.total) : '—'}
            </div>
            <div className="text-[10px] text-muted mt-0.5">{b.payouts.length} payout{b.payouts.length !== 1 ? 's' : ''}</div>
          </div>
        ))}
      </div>

      {data.all_predicted.length > 0 && (
        <div className="mt-4">
          <details>
            <summary className="text-xs text-muted cursor-pointer hover:text-text">
              View all {data.all_predicted.length} projected payouts
            </summary>
            <div className="mt-2 max-h-64 overflow-auto bg-panel/50 border border-border rounded">
              <table className="w-full text-xs">
                <thead className="text-muted uppercase bg-panel2 sticky top-0">
                  <tr>
                    <th className="px-3 py-1.5 text-left">Date</th>
                    <th className="px-3 py-1.5 text-left">Account</th>
                    <th className="px-3 py-1.5 text-right">Payout #</th>
                    <th className="px-3 py-1.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.all_predicted.map((p, i) => (
                    <tr key={i} className="border-t border-border/70">
                      <td className="px-3 py-1 num text-muted">{new Date(p.predicted_date).toLocaleDateString()}</td>
                      <td className="px-3 py-1">{p.account_name}</td>
                      <td className="px-3 py-1 text-right num">#{p.payout_number}</td>
                      <td className="px-3 py-1 text-right num text-win">{fmtUsd(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
      <div className="text-[10px] text-muted mt-3">
        Projections assume recent average daily P&L holds, account caps + safety nets are respected,
        and min-trading-day / spacing rules are enforced.
      </div>
    </div>
  )
}
