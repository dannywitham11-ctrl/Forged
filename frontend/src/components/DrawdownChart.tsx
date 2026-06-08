import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { DrawdownPoint, fmtUsd } from '../lib/api'

export default function DrawdownChart({ data }: { data: DrawdownPoint[] }) {
  const chartData = data.map((d, i) => ({ idx: i + 1, dd: d.drawdown }))
  return (
    <div className="bg-panel border border-border rounded-lg p-4 h-64">
      <div className="text-sm font-semibold mb-2">Drawdown</div>
      <ResponsiveContainer width="100%" height="88%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.5} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1a2233" vertical={false} />
          <XAxis dataKey="idx" stroke="#7b8aa8" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#7b8aa8" fontSize={11} tickFormatter={(v) => fmtUsd(v)} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: '#121826', border: '1px solid #222b3d', borderRadius: 6, fontSize: 12 }}
            formatter={(v: number) => [fmtUsd(v), 'Drawdown']}
            labelFormatter={(v) => `Trade #${v}`}
          />
          <Area type="monotone" dataKey="dd" stroke="#ef4444" strokeWidth={2} fill="url(#ddGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
