import { fmtPct } from '../lib/api'

export default function WinRateCard({
  title, rate, wins, losses, breakevens = 0, subLabel = 'trades',
}: {
  title: string; rate: number; wins: number; losses: number; breakevens?: number; subLabel?: string
}) {
  const total = wins + losses + breakevens
  const winPct = total ? wins / total : 0
  const lossPct = total ? losses / total : 0
  const bePct = total ? breakevens / total : 0
  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="text-xs text-muted uppercase tracking-wider">{title}</div>
      <div className="mt-2 flex items-baseline gap-3">
        <div className="text-3xl font-bold num">{fmtPct(rate, 1)}</div>
        <div className="text-xs text-muted num">{total} {subLabel}</div>
      </div>
      <div className="mt-3 h-2 bg-panel2 rounded-full overflow-hidden flex">
        <div className="bg-win/80 h-full" style={{ width: `${winPct * 100}%` }} />
        {bePct > 0 && <div className="bg-muted/40 h-full" style={{ width: `${bePct * 100}%` }} />}
        <div className="bg-loss/80 h-full" style={{ width: `${lossPct * 100}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-[11px]">
        <span className="text-win num">{wins}W</span>
        {breakevens > 0 && <span className="text-muted num">{breakevens}BE</span>}
        <span className="text-loss num">{losses}L</span>
      </div>
    </div>
  )
}
