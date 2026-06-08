import { useEffect, useState } from 'react'
import { api, Trade, Strategy, fmtUsd, fmtDuration } from '../lib/api'
import TradeDetailModal from '../components/TradeDetailModal'

export default function Trades({ accountIds }: { accountIds?: number[] }) {
  const [trades, setTrades] = useState<Trade[]>([])
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'wins' | 'losses'>('all')
  const [strategyFilter, setStrategyFilter] = useState<number | undefined>(undefined)
  const [mistakeFilter, setMistakeFilter] = useState(false)
  const [selected, setSelected] = useState<Trade | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const res = await api.trades.list({
        account_ids: accountIds,
        win_only: filter === 'all' ? undefined : filter,
        strategy_id: strategyFilter,
        has_mistakes: mistakeFilter || undefined,
        limit: 2000,
      })
      setTrades(res)
    } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [accountIds?.join(','), filter, strategyFilter, mistakeFilter]) // eslint-disable-line
  useEffect(() => { api.strategies.list().then(setStrategies) }, [])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="text-sm text-muted">{trades.length} trades</div>
        <div className="flex gap-3 items-center flex-wrap">
          <select value={strategyFilter ?? ''} onChange={e => setStrategyFilter(e.target.value ? Number(e.target.value) : undefined)}
            className="bg-panel2 border border-border rounded px-2 py-1 text-xs">
            <option value="">All strategies</option>
            {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label className="text-xs flex items-center gap-1.5 text-muted">
            <input type="checkbox" checked={mistakeFilter} onChange={e => setMistakeFilter(e.target.checked)}
              className="accent-loss" />
            With mistakes only
          </label>
          <div className="flex gap-1 bg-panel border border-border rounded-md p-1 text-xs">
            {(['all','wins','losses'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded ${filter === f ? 'bg-panel2 text-text' : 'text-muted hover:text-text'}`}>{f}</button>
            ))}
          </div>
        </div>
      </div>

      {loading ? <div className="text-muted">Loading…</div> : (
        <div className="overflow-auto bg-panel border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-panel2 text-xs uppercase text-muted">
              <tr>
                <Th>Date</Th><Th>Symbol</Th><Th>Side</Th>
                <Th className="text-right">Qty</Th>
                <Th className="text-right">Entry</Th>
                <Th className="text-right">Exit</Th>
                <Th className="text-right">R</Th>
                <Th className="text-right">Net P&L</Th>
                <Th className="text-right">Hold</Th>
                <Th className="text-right">★</Th>
                <Th>Tags</Th>
              </tr>
            </thead>
            <tbody>
              {trades.map(t => (
                <tr key={t.id} onClick={() => setSelected(t)}
                  className="border-t border-border hover:bg-panel2/60 cursor-pointer">
                  <Td>{new Date(t.entry_time).toLocaleString()}</Td>
                  <Td className="font-medium">{t.symbol}</Td>
                  <Td>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${t.side === 'Long' ? 'bg-win/15 text-win' : 'bg-loss/15 text-loss'}`}>
                      {t.side}
                    </span>
                  </Td>
                  <Td className="text-right num">{t.quantity}</Td>
                  <Td className="text-right num">{t.avg_entry_price.toFixed(2)}</Td>
                  <Td className="text-right num">{t.avg_exit_price.toFixed(2)}</Td>
                  <Td className="text-right num text-muted">
                    {t.realized_r != null ? `${t.realized_r >= 0 ? '+' : ''}${t.realized_r.toFixed(2)}` : '—'}
                  </Td>
                  <Td className={`text-right num font-medium ${t.net_pnl > 0 ? 'text-win' : t.net_pnl < 0 ? 'text-loss' : ''}`}>
                    {fmtUsd(t.net_pnl, { signed: true })}
                  </Td>
                  <Td className="text-right num text-muted">{fmtDuration(t.duration_seconds)}</Td>
                  <Td className="text-right text-warn">{t.rating ? '★'.repeat(t.rating) : ''}</Td>
                  <Td className="text-xs text-muted">
                    {t.mistakes && <span className="text-loss/80 mr-1">!{t.mistakes.split(',')[0].trim()}</span>}
                    {t.tags && <span>{t.tags.split(',')[0].trim()}</span>}
                  </Td>
                </tr>
              ))}
              {!trades.length && <tr><td colSpan={11} className="px-4 py-8 text-center text-muted">No trades</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <TradeDetailModal
          trade={selected}
          strategies={strategies}
          onClose={() => setSelected(null)}
          onSaved={(t) => { setSelected(t); setTrades(prev => prev.map(x => x.id === t.id ? t : x)) }}
        />
      )}
    </div>
  )
}

function Th({ children, className = '' }: { children: any; className?: string }) {
  return <th className={`px-3 py-2 text-left font-medium ${className}`}>{children}</th>
}
function Td({ children, className = '' }: { children: any; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>
}
