import { useEffect, useState } from 'react'
import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend } from 'recharts'
import { api, fmtUsd } from '../lib/api'

type Pt = { t: string; equity: number; dd_floor: number; cushion: number; event: string; delta: number }

export default function AccountDrawdownChart({ accountId }: { accountId: number }) {
  const [data, setData] = useState<Pt[] | null>(null)
  const [meta, setMeta] = useState<{ starting: number; dd: number; target: number; mode: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    api.accounts.ddCurve(accountId).then(r => {
      if (cancelled) return
      setData(r.points)
      setMeta({ starting: r.starting_balance, dd: r.max_drawdown,
                target: r.profit_target, mode: r.drawdown_mode })
    })
    return () => { cancelled = true }
  }, [accountId])

  if (!data || !meta) return null
  if (data.length === 0 || meta.dd === 0) {
    return (
      <div className="bg-panel border border-border rounded-lg p-4 h-64 flex items-center justify-center">
        <div className="text-sm text-muted text-center">
          {meta.dd === 0 ? 'No drawdown configured on this account.' : 'No trades yet.'}
          <div className="text-xs opacity-60 mt-1">Apply a prop firm preset on the Prop Firms page.</div>
        </div>
      </div>
    )
  }

  const chartData = data.map((p, i) => ({
    idx: i, ...p,
    label: new Date(p.t).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
  }))
  const minVal = Math.min(...data.map(p => p.dd_floor)) - 200
  const maxVal = Math.max(...data.map(p => p.equity), meta.starting + meta.target) + 200

  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">Drawdown Curve · {meta.mode}</div>
        <div className="text-[10px] text-muted">
          DD ${meta.dd.toFixed(0)} · Target ${meta.target.toFixed(0)} · Start ${meta.starting.toFixed(0)}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ left: 10, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="cushionGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1a2233" vertical={false} />
          <XAxis dataKey="idx" stroke="#7b8aa8" fontSize={10}
            tickFormatter={(v) => chartData[v]?.label?.split(',')[0] || ''}
            tickLine={false} axisLine={false} />
          <YAxis stroke="#7b8aa8" fontSize={10} domain={[minVal, maxVal]}
            tickFormatter={(v) => fmtUsd(v)} tickLine={false} axisLine={false} width={70} />
          <Tooltip
            contentStyle={{ background: '#121826', border: '1px solid #222b3d', borderRadius: 6, fontSize: 11 }}
            labelFormatter={(v) => chartData[Number(v)]?.label || ''}
            formatter={(val: number, name: string) => {
              if (name === 'Equity') return [fmtUsd(val), 'Equity']
              if (name === 'DD Floor') return [fmtUsd(val), 'DD Floor']
              if (name === 'Cushion') return [fmtUsd(val), 'Cushion']
              return [val, name]
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
          <ReferenceLine y={meta.starting} stroke="#7b8aa8" strokeDasharray="4 4"
            label={{ value: `Start $${meta.starting.toFixed(0)}`, position: 'insideTopLeft', fontSize: 10, fill: '#7b8aa8' }} />
          {meta.target > 0 && (
            <ReferenceLine y={meta.starting + meta.target} stroke="#22c55e" strokeDasharray="4 4"
              label={{ value: `Target $${(meta.starting + meta.target).toFixed(0)}`, position: 'insideTopLeft', fontSize: 10, fill: '#22c55e' }} />
          )}
          <Area type="stepAfter" dataKey="equity" name="Equity" stroke="#6ee7b7" strokeWidth={2}
            fill="url(#cushionGrad)" isAnimationActive={false} />
          <Line type="stepAfter" dataKey="dd_floor" name="DD Floor" stroke="#ef4444" strokeWidth={2}
            strokeDasharray="3 2" dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="text-[10px] text-muted mt-2">
        Green area = your equity above the trailing drawdown floor. When the green disappears, the account is blown.
      </div>
    </div>
  )
}
