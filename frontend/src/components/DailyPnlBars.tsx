import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ReferenceLine } from 'recharts'
import { DailyPnl, fmtUsd } from '../lib/api'

export default function DailyPnlBars({ data }: { data: DailyPnl[] }) {
  return (
    <div className="bg-panel border border-border rounded-lg p-4 h-72">
      <div className="text-sm font-semibold mb-2">Daily Net P&amp;L</div>
      <ResponsiveContainer width="100%" height="88%">
        <BarChart data={data} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="#1a2233" vertical={false} />
          <XAxis dataKey="date" stroke="#7b8aa8" fontSize={11} tickLine={false} axisLine={false}
            tickFormatter={(d) => d.slice(5)} />
          <YAxis stroke="#7b8aa8" fontSize={11} tickFormatter={(v) => fmtUsd(v)} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: '#1a2233' }}
            contentStyle={{ background: '#121826', border: '1px solid #222b3d', borderRadius: 6, fontSize: 12 }}
            formatter={(v: number, _n, p: any) => [fmtUsd(v, { signed: true }), `${p.payload.trade_count} trades`]}
          />
          <ReferenceLine y={0} stroke="#444" />
          <Bar dataKey="net_pnl" radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.net_pnl > 0 ? '#22c55e' : d.net_pnl < 0 ? '#ef4444' : '#7b8aa8'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
