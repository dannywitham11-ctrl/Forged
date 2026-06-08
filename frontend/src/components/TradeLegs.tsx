import { Trade, Execution, fmtUsd } from '../lib/api'

/* Break a trade into its entry leg(s) and individual exit legs (TP1, TP2, stop).
   Per-leg P&L is computed from the trade's avg entry price. */
export default function TradeLegs({ trade, executions }: { trade: Trade; executions: Execution[] }) {
  if (executions.length === 0) return null

  const sorted = [...executions].sort((a, b) => +new Date(a.fill_time) - +new Date(b.fill_time))
  const isLong = trade.side === 'Long'
  const entries = sorted.filter(e => (isLong ? e.side === 'Buy' : e.side === 'Sell'))
  const exits   = sorted.filter(e => (isLong ? e.side === 'Sell' : e.side === 'Buy'))
  if (entries.length === 0 || exits.length === 0) return null

  const totalEntryQty = entries.reduce((s, e) => s + e.quantity, 0)
  const totalExitQty = exits.reduce((s, e) => s + e.quantity, 0)

  const sideSign = isLong ? 1 : -1
  const pv = trade.point_value
  const exitLegs = exits.map((e, i) => {
    const pnl = (e.fill_price - trade.avg_entry_price) * sideSign * pv * e.quantity
    return {
      idx: i + 1, exec: e, pnl,
      label: exits.length === 1 ? 'Exit' : (i === exits.length - 1 ? `Final exit` : `TP${i + 1}`),
      pct: (e.quantity / totalExitQty) * 100,
    }
  })

  const isMultiTp = exits.length > 1

  return (
    <div className="space-y-3">
      <div className="bg-panel2/40 border border-border rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wider text-muted">
            Entry {entries.length > 1 && <span className="text-text">· {entries.length} fills (scaled in)</span>}
          </div>
          <div className="text-xs num">
            <span className="text-muted">{totalEntryQty} contracts @</span>
            <span className="ml-1 font-semibold">{trade.avg_entry_price.toFixed(2)}</span>
          </div>
        </div>
        {entries.length > 1 && (
          <table className="w-full text-xs">
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-border/60">
                  <td className="py-1 text-muted">{new Date(e.fill_time).toLocaleTimeString()}</td>
                  <td className="py-1 text-right num">{e.quantity}c</td>
                  <td className="py-1 text-right num">@{e.fill_price.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={`border rounded-lg p-3 ${isMultiTp ? 'border-accent/40 bg-accent/5' : 'border-border bg-panel2/40'}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wider text-muted">
            {isMultiTp ? `Exit · ${exits.length} legs` : 'Exit'}
          </div>
          <div className="text-xs num">
            <span className="text-muted">{totalExitQty} contracts · avg</span>
            <span className="ml-1 font-semibold">{trade.avg_exit_price.toFixed(2)}</span>
          </div>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted">
              <th className="text-left font-medium">Leg</th>
              <th className="text-left font-medium">Time</th>
              <th className="text-right font-medium">Qty</th>
              <th className="text-right font-medium">Price</th>
              <th className="text-right font-medium">% of size</th>
              <th className="text-right font-medium">Leg P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {exitLegs.map(l => (
              <tr key={l.exec.id} className="border-t border-border/60">
                <td className="py-1.5">
                  <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    l.pnl > 0 ? 'bg-win/15 text-win' : l.pnl < 0 ? 'bg-loss/15 text-loss' : 'bg-panel2 text-muted'
                  }`}>{l.label}</span>
                </td>
                <td className="py-1.5 text-muted">{new Date(l.exec.fill_time).toLocaleTimeString()}</td>
                <td className="py-1.5 text-right num">{l.exec.quantity}c</td>
                <td className="py-1.5 text-right num">{l.exec.fill_price.toFixed(2)}</td>
                <td className="py-1.5 text-right num text-muted">{l.pct.toFixed(0)}%</td>
                <td className={`py-1.5 text-right num font-medium ${l.pnl > 0 ? 'text-win' : l.pnl < 0 ? 'text-loss' : ''}`}>
                  {fmtUsd(l.pnl, { signed: true })}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-border">
              <td colSpan={5} className="pt-2 text-right text-muted text-xs">Trade gross</td>
              <td className={`pt-2 text-right num font-semibold ${trade.gross_pnl > 0 ? 'text-win' : trade.gross_pnl < 0 ? 'text-loss' : ''}`}>
                {fmtUsd(trade.gross_pnl, { signed: true })}
              </td>
            </tr>
            {trade.commissions + trade.fees > 0 && (
              <>
                <tr>
                  <td colSpan={5} className="text-right text-muted text-xs">Commissions</td>
                  <td className="text-right num text-loss/80">
                    -{fmtUsd(trade.commissions + trade.fees)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={5} className="text-right text-muted text-xs font-semibold">Net P&amp;L</td>
                  <td className={`text-right num font-bold ${trade.net_pnl > 0 ? 'text-win' : trade.net_pnl < 0 ? 'text-loss' : ''}`}>
                    {fmtUsd(trade.net_pnl, { signed: true })}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
        {isMultiTp && (
          <div className="text-[10px] text-muted mt-2 italic">
            Per-leg P&amp;L computed from the trade's average entry price ({trade.avg_entry_price.toFixed(2)}).
          </div>
        )}
      </div>
    </div>
  )
}
