import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts'
import { EquityPoint, fmtUsd } from '../lib/api'

export default function EquityCurve({ data }: { data: EquityPoint[] }) {
  const chartData = data.map((d, i) => ({
    idx: i + 1,
    equity: d.equity,
    label: new Date(d.t).toLocaleDateString(),
  }))
  return (
    <div className="bg-panel border border-border rounded-lg p-4 h-80">
      <div className="text-sm font-semibold mb-2">Equity Curve</div>
      <ResponsiveContainer width="100%" height="90%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6ee7b7" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#6ee7b7" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1a2233" vertical={false} />
          <XAxis dataKey="idx" stroke="#7b8aa8" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#7b8aa8" fontSize={11} tickFormatter={(v) => fmtUsd(v)} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: '#121826', border: '1px solid #222b3d', borderRadius: 6, fontSize: 12 }}
            labelFormatter={(v) => `Trade #${v}`}
            formatter={(v: number) => [fmtUsd(v), 'Equity']}
          />
          <ReferenceLine y={0} stroke="#444" strokeDasharray="3 3" />
          <Area type="monotone" dataKey="equity" stroke="#6ee7b7" strokeWidth={2} fill="url(#eqGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
