import { fmtUsd } from '../lib/api'

export default function AvgWinLossCard({
  avgWin, avgLoss, payoffRatio,
}: { avgWin: number; avgLoss: number; payoffRatio: number }) {
  // avgLoss is negative
  const winMag = Math.abs(avgWin)
  const lossMag = Math.abs(avgLoss)
  const max = Math.max(winMag, lossMag, 1)
  const wPct = (winMag / max) * 100
  const lPct = (lossMag / max) * 100
  const rr = payoffRatio === 0 ? '—' : `${payoffRatio.toFixed(2)}R`
  const tone = payoffRatio >= 2 ? 'win' : payoffRatio >= 1 ? 'warn' : 'loss'

  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="flex items-baseline justify-between">
        <div className="text-xs text-muted uppercase tracking-wider">Avg Win / Loss</div>
        <div className={`text-[11px] font-medium num ${tone === 'win' ? 'text-win' : tone === 'warn' ? 'text-warn' : 'text-loss'}`}>
          RR {rr}
        </div>
      </div>
      <div className="mt-3 space-y-2.5">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted">Avg Win</span>
            <span className="text-win num font-semibold">{fmtUsd(avgWin)}</span>
          </div>
          <div className="h-2 bg-panel2 rounded-sm overflow-hidden">
            <div className="h-full bg-win/80" style={{ width: `${wPct}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted">Avg Loss</span>
            <span className="text-loss num font-semibold">-{fmtUsd(lossMag)}</span>
          </div>
          <div className="h-2 bg-panel2 rounded-sm overflow-hidden">
            <div className="h-full bg-loss/80" style={{ width: `${lPct}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}
