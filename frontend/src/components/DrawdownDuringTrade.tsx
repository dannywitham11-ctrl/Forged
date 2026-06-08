import { ResponsiveContainer, Area, Line, ComposedChart, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts'
import { Trade, Execution, fmtUsd } from '../lib/api'

/* Unrealized P&L over the life of the trade, with the running worst (MAE) and best
   (MFE) at each fill. Approximated from per-execution prices + the trade's MAE/MFE. */
export default function DrawdownDuringTrade({ trade, executions }: { trade: Trade; executions: Execution[] }) {
  if (executions.length === 0) return null
  const sorted = [...executions].sort((a, b) => +new Date(a.fill_time) - +new Date(b.fill_time))
  const sideSign = trade.side === 'Long' ? 1 : -1
  const pv = trade.point_value
  const qty = trade.quantity
  const avgEntry = trade.avg_entry_price

  let worstSoFar = 0
  let bestSoFar = 0
  const data = sorted.map((e, i) => {
    const unrealized = (e.fill_price - avgEntry) * sideSign * pv * qty
    if (unrealized < worstSoFar) worstSoFar = unrealized
    if (unrealized > bestSoFar) bestSoFar = unrealized
    return {
      idx: i,
      t: new Date(e.fill_time).toLocaleTimeString(),
      unrealized: Math.round(unrealized * 100) / 100,
      mae: Math.round(worstSoFar * 100) / 100,
      mfe: Math.round(bestSoFar * 100) / 100,
    }
  })

  const finalMae = trade.mae_pnl ?? worstSoFar
  const finalMfe = trade.mfe_pnl ?? bestSoFar

  return (
    <div className="bg-panel border border-border rounded-lg p-4 h-72">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">Trade Drawdown Tracker</div>
        <div className="text-[10px] text-muted">
          Unrealized P&amp;L over the trade's life · MFE {fmtUsd(finalMfe, { signed: true })} · MAE {fmtUsd(finalMae, { signed: true })}
        </div>
      </div>
      <ResponsiveContainer width="100%" height="86%">
        <ComposedChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="ddGradWin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="ddGradLoss" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.35} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1a2233" vertical={false} />
          <XAxis dataKey="idx" stroke="#7b8aa8" fontSize={10}
            tickFormatter={(v) => data[v]?.t?.split(':').slice(0,2).join(':') || ''}
            tickLine={false} axisLine={false} />
          <YAxis stroke="#7b8aa8" fontSize={10}
            tickFormatter={v => fmtUsd(v)} tickLine={false} axisLine={false} width={70} />
          <Tooltip
            contentStyle={{ background: '#121826', border: '1px solid #222b3d', borderRadius: 6, fontSize: 11 }}
            labelFormatter={(v) => data[Number(v)]?.t || ''}
            formatter={(v: number, n: string) => [fmtUsd(v, { signed: true }), n === 'unrealized' ? 'Unrealized' : n === 'mae' ? 'Running MAE' : 'Running MFE']}
          />
          <ReferenceLine y={0} stroke="#444" strokeDasharray="3 3" />
          <Area type="monotone" dataKey="unrealized" stroke="#6ee7b7" strokeWidth={2}
            fill="url(#ddGradWin)" isAnimationActive={false} />
          <Line type="monotone" dataKey="mae" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 3"
            dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="mfe" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="4 3"
            dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
