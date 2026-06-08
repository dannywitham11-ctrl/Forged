import { ResponsiveContainer, AreaChart, Area, YAxis, Tooltip } from 'recharts'
import { EquityPoint, fmtUsd, fmtPct } from '../lib/api'

export default function HeroCard({
  netPnl, currentEquity, startingBalance, returnPct, curve,
  brokerPnl, usesBroker, brokerCovered, brokerTotal,
  aggregateDD,
}: {
  netPnl: number; currentEquity: number; startingBalance: number; returnPct: number
  curve: EquityPoint[]
  brokerPnl?: number | null; usesBroker?: boolean
  brokerCovered?: number; brokerTotal?: number
  aggregateDD?: { cushion: number; cap: number; count: number; blownCount: number } | null
}) {
  // When broker balance is authoritative, "real" P&L = broker - starting. Trade
  // P&L (netPnl) is shown alongside as the journaled value.
  const realPnl = usesBroker && brokerPnl != null ? brokerPnl : netPnl
  const tone = realPnl > 0 ? 'win' : realPnl < 0 ? 'loss' : 'muted'
  const data = curve.map((p, i) => ({ idx: i, equity: p.equity }))
  const stroke = tone === 'win' ? '#22c55e' : tone === 'loss' ? '#ef4444' : '#7b8aa8'
  const gradId = `heroGrad-${tone}`
  const equityColor = realPnl > 0 ? 'text-win' : realPnl < 0 ? 'text-loss' : 'text-text'

  return (
    <div className="bg-gradient-to-br from-panel to-panel2/40 border border-border rounded-xl p-5 relative overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-xs text-muted uppercase tracking-wider">
              {usesBroker ? 'Account Balance' : 'Equity'}
            </div>
            {usesBroker && (
              <span className="text-[9px] uppercase tracking-wider bg-accent/15 text-accent px-1.5 py-0.5 rounded">
                broker
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-6 flex-wrap">
            <div className={`text-4xl font-bold num ${equityColor}`}>
              {fmtUsd(currentEquity)}
            </div>
            {aggregateDD && aggregateDD.count > 0 && (
              <DrawdownSummary dd={aggregateDD} />
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-4 text-xs flex-wrap">
            <div>
              <span className="text-muted">P&L </span>
              <span className={`num font-medium ${realPnl > 0 ? 'text-win' : realPnl < 0 ? 'text-loss' : 'text-text'}`}>
                {fmtUsd(realPnl, { signed: true })}
              </span>
            </div>
            {startingBalance > 0 && (
              <div>
                <span className="text-muted">Return </span>
                <span className={`num font-medium ${returnPct >= 0 ? 'text-win' : 'text-loss'}`}>
                  {returnPct >= 0 ? '+' : ''}{fmtPct(returnPct, 2)}
                </span>
              </div>
            )}
            <div>
              <span className="text-muted">Start </span>
              <span className="num font-medium">{fmtUsd(startingBalance)}</span>
            </div>
          </div>
          {usesBroker && brokerPnl != null && Math.abs(brokerPnl - netPnl) > 1 && (
            <div className="text-[10px] text-muted mt-2 italic">
              Trade-journaled P&L: {fmtUsd(netPnl, { signed: true })}.
              Broker shows {fmtUsd(brokerPnl, { signed: true })} —
              diff of {fmtUsd(brokerPnl - netPnl, { signed: true })} is fees / adjustments outside the trade log.
            </div>
          )}
          {!usesBroker && brokerTotal && brokerCovered != null && brokerTotal > 0 && (brokerCovered ?? 0) < brokerTotal && (
            <div className="text-[10px] text-warn mt-2">
              {brokerCovered}/{brokerTotal} selected accounts have a broker balance set —
              showing trade-computed equity. Set the rest on /accounts to see authoritative balance.
            </div>
          )}
        </div>
      </div>
      {data.length > 1 && (
        <div className="mt-4 h-24 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Tooltip
                contentStyle={{ background: '#121826', border: '1px solid #222b3d', borderRadius: 6, fontSize: 11 }}
                formatter={(v: number) => [fmtUsd(v), 'Equity']}
                labelFormatter={() => ''}
              />
              <Area type="monotone" dataKey="equity" stroke={stroke} strokeWidth={2} fill={`url(#${gradId})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function DrawdownSummary({ dd }: { dd: { cushion: number; cap: number; count: number; blownCount: number } }) {
  const usedPct = dd.cap > 0 ? Math.max(0, Math.min(1, 1 - dd.cushion / dd.cap)) : 0
  const tone = usedPct > 0.85 ? 'text-loss' : usedPct > 0.6 ? 'text-warn' : 'text-win'
  return (
    <div className="border-l border-border pl-6">
      <div className="text-xs text-muted uppercase tracking-wider mb-1">Drawdown Remaining</div>
      <div className={`text-3xl font-bold num ${tone}`}>{fmtUsd(dd.cushion)}</div>
      <div className="text-[11px] text-muted num mt-1">
        of {fmtUsd(dd.cap)} · {dd.count} active{dd.blownCount > 0 && <span className="text-loss"> · {dd.blownCount} blown</span>}
      </div>
    </div>
  )
}
