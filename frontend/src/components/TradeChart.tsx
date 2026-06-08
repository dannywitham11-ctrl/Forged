import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts'
import { Trade, Execution } from '../lib/api'

/* Visualizes a trade:
   - Y axis: price
   - running High / Low bands from fill prices
   - line of fill prices over time, markers per execution (sized by qty)
   - dashed lines at avg entry / avg exit */
export default function TradeChart({ trade, executions }: { trade: Trade; executions: Execution[] }) {
  if (executions.length === 0) return null

  const sorted = [...executions].sort((a, b) => +new Date(a.fill_time) - +new Date(b.fill_time))
  const t0 = +new Date(sorted[0].fill_time)
  const data = sorted.map((e, i) => ({
    idx: i,
    t: Math.round((+new Date(e.fill_time) - t0) / 1000),
    label: new Date(e.fill_time).toLocaleTimeString(),
    price: e.fill_price,
    side: e.side,
    qty: e.quantity,
    open_close: e.open_close,
  }))
  // Approximate the band from the running min/max of fill prices.
  let hiAcc = -Infinity, loAcc = Infinity
  const dataWithBand = data.map(d => {
    hiAcc = Math.max(hiAcc, d.price)
    loAcc = Math.min(loAcc, d.price)
    return { ...d, hi: hiAcc, lo: loAcc }
  })

  const avgEntry = trade.avg_entry_price
  const avgExit = trade.avg_exit_price
  const isLong = trade.side === 'Long'

  return (
    <div className="bg-panel glass-panel hover-lift border border-border rounded-lg p-4 h-72">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">Trade Chart</div>
        <div className="text-[10px] text-muted">
          Approximated from fill prices (Sierra doesn't export intra-trade tick data)
        </div>
      </div>
      <ResponsiveContainer width="100%" height="86%">
        <ComposedChart data={dataWithBand} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="#1a2233" vertical={false} />
          <XAxis dataKey="idx" stroke="#7b8aa8" fontSize={10}
            tickFormatter={(v) => dataWithBand[v]?.label?.split(':').slice(0,2).join(':') || ''}
            tickLine={false} axisLine={false} />
          <YAxis stroke="#7b8aa8" fontSize={10} domain={['auto', 'auto']}
            tickFormatter={v => v.toFixed(2)} tickLine={false} axisLine={false} width={60} />
          <Tooltip
            contentStyle={{ background: '#121826', border: '1px solid #222b3d', borderRadius: 6, fontSize: 11 }}
            labelFormatter={(v) => dataWithBand[Number(v)]?.label || ''}
            formatter={(v: number, name: string, p: any) => {
              if (name === 'price') return [v.toFixed(2), `${p.payload.side} ${p.payload.qty} (${p.payload.open_close || 'fill'})`]
              if (name === 'hi') return [v.toFixed(2), 'Running high']
              if (name === 'lo') return [v.toFixed(2), 'Running low']
              return [v, name]
            }}
          />
          <Area type="monotone" dataKey="hi" stroke="#22c55e" strokeWidth={1} fill="transparent" dot={false} isAnimationActive={false} />
          <Area type="monotone" dataKey="lo" stroke="#ef4444" strokeWidth={1} fill="transparent" dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="price" stroke="#6ee7b7" strokeWidth={2}
            dot={(props: any) => {
              const { cx, cy, payload } = props
              const isEntry = payload.open_close === 'Open' || (payload.open_close === '' && i_is_open(payload, isLong))
              const color = isEntry ? (isLong ? '#22c55e' : '#ef4444') : (isLong ? '#ef4444' : '#22c55e')
              const r = Math.min(8, 3 + payload.qty)
              return <circle cx={cx} cy={cy} r={r} fill={color} stroke="#0b0f17" strokeWidth={1} key={cx} />
            }}
            isAnimationActive={false} />
          <ReferenceLine y={avgEntry} stroke="#7b8aa8" strokeDasharray="4 4"
            label={{ value: `Avg entry ${avgEntry.toFixed(2)}`, position: 'insideTopLeft', fontSize: 10, fill: '#7b8aa8' }} />
          <ReferenceLine y={avgExit} stroke="#f59e0b" strokeDasharray="4 4"
            label={{ value: `Avg exit ${avgExit.toFixed(2)}`, position: 'insideBottomLeft', fontSize: 10, fill: '#f59e0b' }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function i_is_open(p: any, isLong: boolean) {
  // Heuristic for entries when open_close isn't set.
  if (isLong) return p.side === 'Buy'
  return p.side === 'Sell'
}
