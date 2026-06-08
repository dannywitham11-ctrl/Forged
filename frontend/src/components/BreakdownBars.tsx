import { BreakdownRow, fmtUsd } from '../lib/api'

export default function BreakdownBars({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  if (!rows.length) {
    return (
      <div className="bg-panel border border-border rounded-lg p-4">
        <div className="text-sm font-semibold mb-2">{title}</div>
        <div className="text-sm text-muted">No data.</div>
      </div>
    )
  }
  const max = Math.max(1, ...rows.map(r => Math.abs(r.net_pnl)))
  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="text-sm font-semibold mb-3">{title}</div>
      <div className="space-y-1.5">
        {rows.map(r => {
          const w = Math.round(Math.abs(r.net_pnl) / max * 100)
          const isWin = r.net_pnl > 0
          return (
            <div key={r.key} className="text-xs">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-muted">{r.key} <span className="text-[10px] opacity-60">({r.trade_count})</span></span>
                <span className={`num ${isWin ? 'text-win' : r.net_pnl < 0 ? 'text-loss' : 'text-muted'}`}>
                  {fmtUsd(r.net_pnl, { signed: true })}
                </span>
              </div>
              <div className="h-2 bg-panel2 rounded-sm overflow-hidden flex">
                <div className={`h-full ${isWin ? 'bg-win/70' : 'bg-loss/70'}`} style={{ width: `${w}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
