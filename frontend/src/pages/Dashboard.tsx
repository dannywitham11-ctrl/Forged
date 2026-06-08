import { useEffect, useState } from 'react'
import { Account, FullStats, api, fmtUsd, fmtPct, fmtDuration } from '../lib/api'
import HeroCard from '../components/HeroCard'
import WinRateCard from '../components/WinRateCard'
import ProfitFactorCard from '../components/ProfitFactorCard'
import AvgWinLossCard from '../components/AvgWinLossCard'
import MetricTile from '../components/MetricTile'
import EquityCurve from '../components/EquityCurve'
import DrawdownChart from '../components/DrawdownChart'
import DailyPnlBars from '../components/DailyPnlBars'
import PnLCalendar from '../components/PnLCalendar'
import BreakdownBars from '../components/BreakdownBars'
import PnlDistribution from '../components/PnlDistribution'
import RecentTrades from '../components/RecentTrades'
import InsightScoreCard from '../components/InsightScoreCard'
import PropFirmPanel from '../components/PropFirmPanel'
import DrawdownRemainingTile from '../components/DrawdownRemainingTile'
import AccountDrawdownChart from '../components/AccountDrawdownChart'

type AggDD = { cushion: number; cap: number; count: number; blownCount: number }

export default function Dashboard({ accountIds, accounts }: { accountIds?: number[]; accounts: Account[] }) {
  const [stats, setStats] = useState<FullStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [aggDD, setAggDD] = useState<AggDD | null>(null)

  useEffect(() => {
    setLoading(true); setErr(null)
    api.stats({ account_ids: accountIds })
      .then(setStats)
      .catch(e => setErr(String(e)))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountIds?.join(',')])

  // Aggregate drawdown cushion across visible prop accounts (parallel per-account
  // prop-status calls — fine for the handful of accounts a dashboard usually shows).
  const visibleAccountsRaw = accountIds
    ? accounts.filter(a => accountIds.includes(a.id))
    : accounts
  const propAccountIdsKey = visibleAccountsRaw
    .filter(a => a.max_drawdown > 0)
    .map(a => a.id).sort((x, y) => x - y).join(',')

  useEffect(() => {
    let cancelled = false
    const propAccts = visibleAccountsRaw.filter(a => a.max_drawdown > 0)
    if (propAccts.length === 0) { setAggDD(null); return }
    Promise.all(propAccts.map(a => api.accounts.propStatus(a.id).catch(() => null)))
      .then(results => {
        if (cancelled) return
        let cushion = 0, cap = 0, count = 0, blownCount = 0
        results.forEach((r, i) => {
          if (!r) return
          if (r.blown) { blownCount++; return }
          cushion += r.distance_to_drawdown
          cap += propAccts[i].max_drawdown
          count++
        })
        setAggDD({ cushion, cap, count, blownCount })
      })
    return () => { cancelled = true }
  }, [propAccountIdsKey]) // eslint-disable-line

  if (loading) return <div className="p-6 text-muted">Loading…</div>
  if (err) return <div className="p-6 text-loss">Failed to load: {err}</div>
  if (!stats) return <div className="p-6 text-muted">No data</div>

  const c = stats.cards

  if (c.trade_count === 0) {
    return (
      <div className="p-6">
        <div className="bg-panel border border-border rounded-lg p-8 text-center">
          <div className="text-lg font-medium mb-1">No trades yet</div>
          <div className="text-muted text-sm">Upload a Sierra Chart Trade Activity Log on the Upload page to get started.</div>
        </div>
      </div>
    )
  }

  const streakLabel = c.current_streak > 0
    ? `${c.current_streak}W current`
    : c.current_streak < 0
      ? `${Math.abs(c.current_streak)}L current`
      : 'no streak'

  const visibleAccounts = visibleAccountsRaw
  const singleAccount = visibleAccounts.length === 1 ? visibleAccounts[0] : null

  return (
    <div className="p-6 space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <HeroCard
            netPnl={c.net_pnl}
            currentEquity={c.current_equity}
            startingBalance={c.starting_balance}
            returnPct={c.return_pct}
            curve={stats.equity_curve}
            brokerPnl={c.broker_pnl}
            usesBroker={c.uses_broker_balance}
            brokerCovered={c.broker_accounts_covered}
            brokerTotal={c.broker_accounts_total}
            aggregateDD={aggDD}
          />
        </div>
        <div className="lg:col-span-2">
          <InsightScoreCard data={stats.insight} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <WinRateCard title="Trade Win %" rate={c.win_rate}
          wins={c.win_count} losses={c.loss_count} breakevens={c.breakeven_count} subLabel="trades" />
        <ProfitFactorCard value={c.profit_factor} />
        <WinRateCard title="Day Win %" rate={c.day_win_rate}
          wins={c.winning_days} losses={c.losing_days} breakevens={c.breakeven_days} subLabel="days" />
        <AvgWinLossCard avgWin={c.avg_win} avgLoss={c.avg_loss} payoffRatio={c.payoff_ratio} />
      </div>

      {singleAccount && singleAccount.max_drawdown > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <DrawdownRemainingTile account={singleAccount} />
          <div className="lg:col-span-2">
            <AccountDrawdownChart accountId={singleAccount.id} />
          </div>
        </div>
      )}

      <PropFirmPanel accounts={visibleAccounts} />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <MetricTile label="Max Drawdown" value={fmtUsd(c.max_drawdown)}
          sub={c.max_drawdown_pct ? `${fmtPct(c.max_drawdown_pct, 1)} from peak` : 'from peak'} tone="loss" />
        <MetricTile label="Expectancy" value={fmtUsd(c.expectancy, { signed: true })}
          sub={`${c.expectancy_r >= 0 ? '+' : ''}${c.expectancy_r.toFixed(2)}R / trade`}
          tone={c.expectancy > 0 ? 'win' : 'loss'} />
        <MetricTile label="Avg Daily P&L" value={fmtUsd(c.avg_daily_pnl, { signed: true })}
          sub={`${c.trading_days} days · ${c.avg_trades_per_day.toFixed(1)}/day`}
          tone={c.avg_daily_pnl > 0 ? 'win' : 'loss'} />
        <MetricTile label="Largest Win" value={fmtUsd(c.largest_win, { signed: true })} tone="win" />
        <MetricTile label="Largest Loss" value={fmtUsd(c.largest_loss, { signed: true })} tone="loss" />
        <MetricTile label="Best Day" value={fmtUsd(c.largest_winning_day, { signed: true })} tone="win" />
        <MetricTile label="Worst Day" value={fmtUsd(c.largest_losing_day, { signed: true })} tone="loss" />
        <MetricTile label="Max Streak" value={`${c.max_consec_wins}W / ${c.max_consec_losses}L`} sub={streakLabel} />
        <MetricTile label="Avg Win Day" value={fmtUsd(c.avg_winning_day, { signed: true })} tone="win" />
        <MetricTile label="Avg Loss Day" value={fmtUsd(c.avg_losing_day, { signed: true })} tone="loss" />
        <MetricTile label="Avg Hold (Win)" value={fmtDuration(c.avg_winner_hold_seconds)} tone="win" />
        <MetricTile label="Avg Hold (Loss)" value={fmtDuration(c.avg_loser_hold_seconds)} tone="loss" />
        <MetricTile label="Contracts" value={String(c.total_contracts)} sub={`${c.avg_daily_volume.toFixed(1)}/day`} />
        <MetricTile label="Commissions" value={fmtUsd(c.total_commissions)} tone="loss" />
        <MetricTile label="Planned RR (avg)" value={c.avg_planned_rr != null ? `${c.avg_planned_rr.toFixed(2)}R` : '—'}
          sub={`${((c.plan_adherence ?? 0) * 100).toFixed(0)}% planned`} />
        <MetricTile label="Realized R (avg)" value={c.avg_realized_r != null ? `${c.avg_realized_r >= 0 ? '+' : ''}${c.avg_realized_r.toFixed(2)}R` : '—'}
          sub={c.avg_rating ? `${c.avg_rating.toFixed(1)}★ avg` : 'no ratings'}
          tone={(c.avg_realized_r ?? 0) > 0 ? 'win' : (c.avg_realized_r ?? 0) < 0 ? 'loss' : 'neutral'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2"><EquityCurve data={stats.equity_curve} /></div>
        <DrawdownChart data={stats.drawdown_curve} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2"><DailyPnlBars data={stats.daily} /></div>
        <PnlDistribution data={stats.pnl_distribution} />
      </div>

      <RecentTrades accountIds={accountIds} limit={8} />

      <PnLCalendar data={stats.daily} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BreakdownBars title="By Symbol" rows={stats.by_symbol} />
        <BreakdownBars title="By Side" rows={stats.by_side} />
        <BreakdownBars title="By Strategy" rows={stats.by_strategy} />
        <BreakdownBars title="By Mistake" rows={stats.by_mistake} />
        <BreakdownBars title="By Day of Week" rows={stats.by_dow} />
        <BreakdownBars title="By Hour of Day (entry)" rows={stats.by_hour} />
      </div>
    </div>
  )
}
