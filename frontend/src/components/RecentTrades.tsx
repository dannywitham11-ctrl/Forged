import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, Trade, fmtUsd, fmtDuration } from '../lib/api'

export default function RecentTrades({ accountIds, limit = 8 }: { accountIds?: number[]; limit?: number }) {
  const [trades, setTrades] = useState<Trade[]>([])
  useEffect(() => {
    api.trades.list({ account_ids: accountIds, limit }).then(setTrades)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountIds?.join(','), limit])
  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">Recent Trades</div>
        <Link to="/trades" className="text-xs text-accent hover:underline">View all →</Link>
      </div>
      {!trades.length ? <div className="text-sm text-muted">No trades</div> : (
        <table className="w-full text-xs">
          <thead className="text-muted uppercase">
            <tr>
              <th className="text-left py-1.5 font-medium">When</th>
              <th className="text-left font-medium">Symbol</th>
              <th className="text-left font-medium">Side</th>
              <th className="text-right font-medium">Qty</th>
              <th className="text-right font-medium">Hold</th>
              <th className="text-right font-medium">R</th>
              <th className="text-right font-medium">Net P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {trades.map(t => (
              <tr key={t.id} className="border-t border-border/70">
                <td className="py-1.5 text-muted">{new Date(t.entry_time).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                <td className="font-medium">{t.symbol}</td>
                <td>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${t.side === 'Long' ? 'bg-win/15 text-win' : 'bg-loss/15 text-loss'}`}>
                    {t.side}
                  </span>
                </td>
                <td className="text-right num">{t.quantity}</td>
                <td className="text-right num text-muted">{fmtDuration(t.duration_seconds)}</td>
                <td className="text-right num text-muted">
                  {t.realized_r != null ? `${t.realized_r >= 0 ? '+' : ''}${t.realized_r.toFixed(2)}R` : '—'}
                </td>
                <td className={`text-right num font-medium ${t.net_pnl > 0 ? 'text-win' : t.net_pnl < 0 ? 'text-loss' : ''}`}>
                  {fmtUsd(t.net_pnl, { signed: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
