import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Account, PropStatus, api, fmtUsd, fmtPct } from '../lib/api'

export default function PropFirmPanel({ accounts }: { accounts: Account[] }) {
  const propAccounts = accounts.filter(a => a.account_type !== 'personal' && (a.max_drawdown > 0 || a.prop_firm_key))
  const [statuses, setStatuses] = useState<Record<number, PropStatus>>({})

  useEffect(() => {
    let cancelled = false
    Promise.all(propAccounts.map(a => api.accounts.propStatus(a.id))).then(rows => {
      if (cancelled) return
      const m: Record<number, PropStatus> = {}
      rows.forEach(r => { m[r.account_id] = r })
      setStatuses(m)
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propAccounts.map(a => `${a.id}:${a.payout_preference}:${a.extra_safety_buffer}`).join(',')])

  if (!propAccounts.length) {
    return (
      <div className="bg-panel border border-border rounded-lg p-4">
        <div className="text-sm font-semibold mb-1">Prop Firm Tracking</div>
        <div className="text-xs text-muted">
          On the <Link to="/prop-firms" className="text-accent hover:underline">Prop Firms</Link> page,
          pick an Apex or TopStep plan and apply it to one of your accounts to get drawdown, payouts,
          consistency rule, and contract limits configured automatically.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {propAccounts.map(a => {
        const s = statuses[a.id]
        if (!s) return (
          <div key={a.id} className="bg-panel border border-border rounded-lg p-4 text-sm text-muted">
            Loading {a.display_name}…
          </div>
        )
        return <AccountStatus key={a.id} account={a} s={s} />
      })}
    </div>
  )
}

function AccountStatus({ account, s }: { account: Account; s: PropStatus }) {
  const ddPct = s.drawdown_used_pct
  const ddColor = ddPct > 0.85 ? '#ef4444' : ddPct > 0.6 ? '#f59e0b' : '#22c55e'
  const targetPct = s.profit_target > 0
    ? Math.min(1, Math.max(0, (s.current_equity - s.starting_balance) / s.profit_target))
    : 0
  const consistencyPct = s.largest_day_pct_of_total
  const consistencyColor = !s.consistency_compliant ? '#ef4444' : consistencyPct > s.consistency_rule_pct * 0.75 ? '#f59e0b' : '#22c55e'

  return (
    <div className={`bg-panel border rounded-lg p-4 ${s.blown ? 'border-loss/60' : 'border-border'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-semibold">{account.display_name}</div>
            <span className="text-[10px] uppercase tracking-wider bg-panel2 px-1.5 py-0.5 rounded">
              {s.account_type}
            </span>
            {s.prop_firm && <span className="text-[10px] text-muted">{s.prop_firm}</span>}
            {s.blown && <span className="text-[10px] uppercase tracking-wider bg-loss/20 text-loss px-1.5 py-0.5 rounded">BLOWN</span>}
            {s.target_reached && !s.blown && <span className="text-[10px] uppercase tracking-wider bg-win/20 text-win px-1.5 py-0.5 rounded">TARGET HIT</span>}
            {s.eligible_for_payout && <span className="text-[10px] uppercase tracking-wider bg-accent/20 text-accent px-1.5 py-0.5 rounded">PAYOUT READY</span>}
            {!s.consistency_compliant && s.consistency_rule_pct > 0 && (
              <span className="text-[10px] uppercase tracking-wider bg-loss/20 text-loss px-1.5 py-0.5 rounded">CONSISTENCY FAIL</span>
            )}
          </div>
          <div className="text-[11px] text-muted mt-0.5">
            Equity <span className="num text-text">{fmtUsd(s.current_equity)}</span>
            <span className="mx-1">·</span>
            P&L <span className={`num ${s.realized_pnl > 0 ? 'text-win' : s.realized_pnl < 0 ? 'text-loss' : ''}`}>
              {fmtUsd(s.realized_pnl, { signed: true })}
            </span>
            <span className="mx-1">·</span>
            HWM <span className="num text-text">{fmtUsd(s.high_water_mark)}</span>
            {s.total_payouts > 0 && <>
              <span className="mx-1">·</span>
              Paid out <span className="num text-text">{fmtUsd(s.total_payouts)}</span>
            </>}
          </div>
        </div>
      </div>

      {account.max_drawdown > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-muted">Drawdown ({s.drawdown_mode})</span>
            <span className="num">
              <span className="text-text">{fmtUsd(s.distance_to_drawdown)} cushion</span>
              <span className="text-muted"> · floor {fmtUsd(s.drawdown_floor)}</span>
            </span>
          </div>
          <div className="h-2.5 bg-panel2 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${ddPct * 100}%`, background: ddColor }} />
          </div>
          <div className="text-[10px] text-muted mt-1">{fmtPct(ddPct, 0)} of {fmtUsd(account.max_drawdown)} consumed</div>
        </div>
      )}

      {s.profit_target > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-muted">Profit Target</span>
            <span className="num">
              {s.target_reached
                ? <span className="text-win">Hit ({fmtUsd(-s.distance_to_target, { signed: true })} over)</span>
                : <><span className="text-text">{fmtUsd(s.distance_to_target)}</span> <span className="text-muted">to go</span></>}
            </span>
          </div>
          <div className="h-2.5 bg-panel2 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-accent" style={{ width: `${targetPct * 100}%` }} />
          </div>
        </div>
      )}

      {s.consistency_rule_pct > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-muted">
              {Math.round(s.consistency_rule_pct * 100)}% Consistency Rule
              {s.consistency_compliant
                ? <span className="text-win ml-1">· OK</span>
                : <span className="text-loss ml-1">· VIOLATED</span>}
            </span>
            <span className="num">
              <span className="text-text">{fmtPct(consistencyPct, 0)}</span>
              <span className="text-muted"> of P&L on best day ({fmtUsd(s.largest_day_pnl)})</span>
            </span>
          </div>
          <div className="h-2 bg-panel2 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, consistencyPct * 100 / s.consistency_rule_pct)}%`, background: consistencyColor }} />
          </div>
          {s.max_profit_today_to_stay_consistent != null && s.consistency_compliant && (
            <div className="text-[10px] text-muted mt-1">
              Max safe profit today to stay consistent: <span className="num text-text">{fmtUsd(s.max_profit_today_to_stay_consistent)}</span>
            </div>
          )}
          {s.extra_profit_needed_to_fix_consistency != null && s.extra_profit_needed_to_fix_consistency > 0 && (
            <div className="text-[10px] text-loss mt-1">
              Need <span className="num">{fmtUsd(s.extra_profit_needed_to_fix_consistency)}</span> more total profit to satisfy consistency before next payout.
            </div>
          )}
        </div>
      )}

      {(s.payout_max_for_next > 0 || s.payout_min > 0) && (
        <div className="bg-panel2/50 border border-border rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold">
              Payout #{s.next_payout_number}
              {s.max_payouts > 0 && <span className="text-muted font-normal"> / {s.max_payouts} max</span>}
            </div>
            <div className="text-[10px] text-muted uppercase">{s.payout_preference}</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
            <Cell label="Planned amount" value={fmtUsd(s.payout_amount_for_next)} tone="accent" />
            <Cell label="Cap (this payout #)" value={fmtUsd(s.payout_max_for_next)} sub={`min ${fmtUsd(s.payout_min)}`} />
            <Cell label="Safety net" value={fmtUsd(s.safety_net_balance)} sub={`+${fmtUsd(s.extra_safety_buffer)} buffer`} />
            <Cell label="Above safety net" value={fmtUsd(s.available_above_safety_net, { signed: true })}
              tone={s.available_above_safety_net >= s.payout_amount_for_next ? 'win' : 'loss'} />
            <Cell label="Distance to payout" value={fmtUsd(s.distance_to_next_payout)} />
            <Cell label="Trading days" value={`${s.trading_days_used}/${s.min_trading_days_before_payout || '—'}`}
              tone={s.min_trading_days_before_payout > 0 && s.trading_days_used >= s.min_trading_days_before_payout ? 'win' : 'neutral'} />
            <Cell label="Predicted date"
              value={s.predicted_next_payout_date ? new Date(s.predicted_next_payout_date).toLocaleDateString() : '—'}
              sub={s.days_needed_for_next != null ? `~${s.days_needed_for_next} days` : 'no recent profit'} />
            <Cell label="Avg/day (recent)" value={fmtUsd(s.avg_daily_pnl_recent, { signed: true })}
              tone={s.avg_daily_pnl_recent > 0 ? 'win' : s.avg_daily_pnl_recent < 0 ? 'loss' : 'neutral'} />
          </div>
          {s.eligibility_reason && (
            <div className="text-[10px] text-warn mt-2">⚠ {s.eligibility_reason}</div>
          )}
        </div>
      )}

      {s.max_loss_per_day > 0 && (
        <div className="text-[11px] text-muted">
          Daily P&L today: <span className={`num ${s.daily_pnl_today > 0 ? 'text-win' : s.daily_pnl_today < 0 ? 'text-loss' : ''}`}>
            {fmtUsd(s.daily_pnl_today, { signed: true })}
          </span>
          <span className="mx-1">·</span>
          Daily loss limit cushion: <span className="num text-text">{fmtUsd(s.distance_to_daily_loss)}</span>
        </div>
      )}
    </div>
  )
}

function Cell({ label, value, sub, tone = 'neutral' }: { label: string; value: string; sub?: string; tone?: 'win'|'loss'|'neutral'|'accent' }) {
  const c = tone === 'win' ? 'text-win' : tone === 'loss' ? 'text-loss' : tone === 'accent' ? 'text-accent' : 'text-text'
  return (
    <div>
      <div className="text-[10px] text-muted uppercase tracking-wider">{label}</div>
      <div className={`num font-semibold ${c}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted num">{sub}</div>}
    </div>
  )
}
