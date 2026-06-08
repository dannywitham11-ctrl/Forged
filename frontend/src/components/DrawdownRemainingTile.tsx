import { useEffect, useState } from 'react'
import { api, Account, fmtUsd, fmtPct } from '../lib/api'

export default function DrawdownRemainingTile({ account }: { account: Account }) {
  const [status, setStatus] = useState<any>(null)
  useEffect(() => {
    let cancelled = false
    api.accounts.propStatus(account.id).then(s => { if (!cancelled) setStatus(s) })
    return () => { cancelled = true }
  }, [account.id])

  if (!status || account.max_drawdown <= 0) return null

  const useBroker = account.broker_balance != null
  const equityShown = useBroker ? (account.broker_balance as number) : status.current_equity

  const cushion = status.distance_to_drawdown
  const pct = status.drawdown_used_pct
  const color = pct > 0.85 ? '#ef4444' : pct > 0.6 ? '#f59e0b' : '#22c55e'
  const targetPct = status.profit_target > 0
    ? Math.min(1, Math.max(0, (status.current_equity - account.starting_balance) / status.profit_target))
    : 0
  const targetReached = status.target_reached
  const blown = status.blown

  return (
    <div className="bg-gradient-to-br from-panel to-panel2/30 border border-border rounded-xl p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-xs text-muted uppercase tracking-wider">Drawdown Remaining</div>
          <div className="text-[10px] text-muted">{account.display_name} · {status.drawdown_mode}</div>
        </div>
        {blown && <span className="text-[10px] uppercase bg-loss/20 text-loss px-1.5 py-0.5 rounded font-semibold">BLOWN</span>}
        {targetReached && !blown && <span className="text-[10px] uppercase bg-win/20 text-win px-1.5 py-0.5 rounded font-semibold">FUNDED</span>}
      </div>
      <div className="flex items-baseline gap-3">
        <div className={`text-4xl font-bold num`} style={{ color }}>
          {fmtUsd(cushion)}
        </div>
        <div className="text-xs text-muted">cushion</div>
      </div>
      <div className="mt-3">
        <div className="h-2.5 bg-panel2 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct * 100}%`, background: color }} />
        </div>
        <div className="flex justify-between text-[11px] text-muted mt-1.5">
          <span className="num">Floor {fmtUsd(status.drawdown_floor)}</span>
          <span className="num">{fmtPct(pct, 0)} of ${account.max_drawdown.toFixed(0)} used</span>
          <span className="num">
            {useBroker ? 'Broker' : 'Equity'} {fmtUsd(equityShown)}
            {useBroker && <span className="text-[9px] uppercase ml-1 text-accent">broker</span>}
          </span>
        </div>
      </div>
      {status.profit_target > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <div className="text-[11px] text-muted mb-1.5 flex justify-between">
            <span>Profit Target Progress</span>
            <span className="num">
              {targetReached
                ? <span className="text-win">{fmtUsd(-status.distance_to_target, { signed: true })} over target ✓</span>
                : <>{fmtUsd(status.distance_to_target)} to go</>}
            </span>
          </div>
          <div className="h-1.5 bg-panel2 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-accent" style={{ width: `${targetPct * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}
