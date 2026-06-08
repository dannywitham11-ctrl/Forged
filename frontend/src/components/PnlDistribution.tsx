import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts'
import { PnlBucket } from '../lib/api'

export default function PnlDistribution({ data }: { data: PnlBucket[] }) {
  return (
    <div className="bg-panel border border-border rounded-lg p-4 h-64">
      <div className="text-sm font-semibold mb-2">Trade P&amp;L Distribution</div>
      <ResponsiveContainer width="100%" height="88%">
        <BarChart data={data}>
          <CartesianGrid stroke="#1a2233" vertical={false} />
          <XAxis dataKey="bucket" stroke="#7b8aa8" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke="#7b8aa8" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: '#1a2233' }}
            contentStyle={{ background: '#121826', border: '1px solid #222b3d', borderRadius: 6, fontSize: 12 }}
            formatter={(v: number, _n, p: any) => [`${v} trades`, `$${p.payload.low} → $${p.payload.high}`]}
            labelFormatter={() => ''}
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.high <= 0 ? '#ef4444' : d.low >= 0 ? '#22c55e' : '#7b8aa8'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
