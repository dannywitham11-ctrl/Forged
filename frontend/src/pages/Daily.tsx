import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { api, Trade, DailyPnl, Strategy, fmtUsd, fmtDuration, fmtPct } from '../lib/api'
import TradeDetailModal from '../components/TradeDetailModal'

export default function Daily({ accountIds }: { accountIds?: number[] }) {
  const [params, setParams] = useSearchParams()
  const dateParam = params.get('date')
  const [daily, setDaily] = useState<DailyPnl[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.stats({ account_ids: accountIds }),
      api.trades.list({ account_ids: accountIds, limit: 5000 }),
    ]).then(([stats, ts]) => {
      setDaily(stats.daily); setTrades(ts)
    }).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountIds?.join(',')])
  useEffect(() => { api.strategies.list().then(setStrategies) }, [])

  // Auto-select the most recent day if none specified.
  useEffect(() => {
    if (!dateParam && daily.length) {
      setParams({ date: daily[daily.length - 1].date }, { replace: true })
    }
  }, [daily.length, dateParam]) // eslint-disable-line

  const tradesByDate = useMemo(() => {
    const m = new Map<string, Trade[]>()
    trades.forEach(t => {
      const d = t.trade_date.slice(0, 10)
      if (!m.has(d)) m.set(d, [])
      m.get(d)!.push(t)
    })
    return m
  }, [trades])

  const selectedTrades = dateParam ? (tradesByDate.get(dateParam) || []) : []
  const day = daily.find(d => d.date === dateParam)
  const idx = daily.findIndex(d => d.date === dateParam)
  const prev = idx > 0 ? daily[idx - 1] : null
  const next = idx >= 0 && idx < daily.length - 1 ? daily[idx + 1] : null

  if (loading) return <div className="p-6 text-muted">Loading…</div>

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-4 gap-5">
      <aside className="glass-panel hover-lift border border-border rounded-lg p-3 lg:max-h-[80vh] lg:overflow-auto">
        <div className="text-xs uppercase tracking-wider text-muted mb-2 px-1">{daily.length} trading days</div>
        <div className="space-y-0.5">
          {[...daily].reverse().map(d => {
            const active = d.date === dateParam
            const tone = d.net_pnl > 0 ? 'border-l-win' : d.net_pnl < 0 ? 'border-l-loss' : 'border-l-muted'
            return (
              <Link key={d.date} to={`/daily?date=${d.date}`}
                className={`block px-3 py-2 rounded-md text-sm border-l-2 ${tone} ${active ? 'bg-panel2 text-text' : 'text-muted hover:bg-panel2/60 hover:text-text'}`}>
                <div className="flex justify-between">
                  <span className="font-medium">{d.date}</span>
                  <span className={`num ${d.net_pnl > 0 ? 'text-win' : d.net_pnl < 0 ? 'text-loss' : ''}`}>
                    {fmtUsd(d.net_pnl, { signed: true })}
                  </span>
                </div>
                <div className="text-[10px] text-muted">
                  {d.trade_count} trades · {d.win_count}W/{d.loss_count}L
                </div>
              </Link>
            )
          })}
          {!daily.length && <div className="text-sm text-muted px-2 py-4">No trading days yet</div>}
        </div>
      </aside>

      <section className="lg:col-span-3 space-y-4">
        {dateParam && day ? (
          <>
            <div className="bg-gradient-to-br from-panel to-panel2/30 border border-border rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted uppercase tracking-wider">Trading day</div>
                  <div className="text-2xl font-bold mt-1">
                    {new Date(day.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted">Net P&L</div>
                  <div className={`text-3xl font-bold num ${day.net_pnl > 0 ? 'text-win' : day.net_pnl < 0 ? 'text-loss' : ''}`}>
                    {fmtUsd(day.net_pnl, { signed: true })}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs">
                {prev && (
                  <Link to={`/daily?date=${prev.date}`}
                    className="px-3 py-1 rounded bg-panel2 hover:bg-panel2/70 text-muted hover:text-text">
                    ← {prev.date}
                  </Link>
                )}
                {next && (
                  <Link to={`/daily?date=${next.date}`}
                    className="px-3 py-1 rounded bg-panel2 hover:bg-panel2/70 text-muted hover:text-text">
                    {next.date} →
                  </Link>
                )}
                <Link to="/calendar" className="ml-auto text-accent hover:underline">Calendar →</Link>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <DayCard label="Trades" value={String(day.trade_count)} />
              <DayCard label="Wins" value={String(day.win_count)} tone="win" />
              <DayCard label="Losses" value={String(day.loss_count)} tone="loss" />
              <DayCard label="Win Rate"
                value={day.trade_count ? fmtPct(day.win_count / day.trade_count, 0) : '—'} />
              <DayCard label="Contracts"
                value={String(selectedTrades.reduce((a, t) => a + t.quantity, 0))} />
            </div>

            <div className="glass-panel hover-lift border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border text-sm font-semibold">
                Trades on this day
              </div>
              <table className="w-full text-sm">
                <thead className="bg-panel2 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">Time</th>
                    <th className="px-3 py-2 text-left">Symbol</th>
                    <th className="px-3 py-2 text-left">Side</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Entry</th>
                    <th className="px-3 py-2 text-right">Exit</th>
                    <th className="px-3 py-2 text-right">Hold</th>
                    <th className="px-3 py-2 text-right">R</th>
                    <th className="px-3 py-2 text-right">Net P&amp;L</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTrades.length ? selectedTrades.map(t => (
                    <tr key={t.id}
                      onClick={() => setSelectedTrade(t)}
                      className="border-t border-border hover:bg-panel2/60 cursor-pointer">
                      <td className="px-3 py-2 num text-muted">{new Date(t.entry_time).toLocaleTimeString()}</td>
                      <td className="px-3 py-2 font-medium">{t.symbol}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${t.side === 'Long' ? 'bg-win/15 text-win' : 'bg-loss/15 text-loss'}`}>
                          {t.side}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right num">{t.quantity}</td>
                      <td className="px-3 py-2 text-right num">{t.avg_entry_price.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right num">{t.avg_exit_price.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right num text-muted">{fmtDuration(t.duration_seconds)}</td>
                      <td className="px-3 py-2 text-right num text-muted">
                        {t.realized_r != null ? `${t.realized_r >= 0 ? '+' : ''}${t.realized_r.toFixed(2)}` : '—'}
                      </td>
                      <td className={`px-3 py-2 text-right num font-medium ${t.net_pnl > 0 ? 'text-win' : t.net_pnl < 0 ? 'text-loss' : ''}`}>
                        {fmtUsd(t.net_pnl, { signed: true })}
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={9} className="px-3 py-6 text-center text-muted text-sm">No trades on this day</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="glass-panel hover-lift border border-border rounded-lg p-8 text-center text-muted">
            Pick a day from the list to see all its trades.
          </div>
        )}
      </section>

      {selectedTrade && (
        <TradeDetailModal
          trade={selectedTrade}
          strategies={strategies}
          onClose={() => setSelectedTrade(null)}
          onSaved={(t) => {
            setSelectedTrade(t)
            setTrades(prev => prev.map(x => x.id === t.id ? t : x))
          }}
        />
      )}
    </div>
  )
}

function DayCard({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'win'|'loss'|'neutral' }) {
  const c = tone === 'win' ? 'text-win' : tone === 'loss' ? 'text-loss' : 'text-text'
  return (
    <div className="glass-panel hover-lift border border-border rounded-lg p-3">
      <div className="text-[10px] text-muted uppercase tracking-wider">{label}</div>
      <div className={`text-xl font-semibold num mt-1 ${c}`}>{value}</div>
    </div>
  )
}
