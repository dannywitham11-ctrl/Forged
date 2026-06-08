export default function ProfitFactorCard({ value }: { value: number }) {
  // 0..3+ on a semicircular gauge. <1 losing, 1-1.5 marginal, 1.5-2 good, 2+ great.
  const display = value === 0 ? '—' : value.toFixed(2)
  const pct = Math.min(1, value / 3)
  const tone = value < 1 ? 'loss' : value < 1.5 ? 'warn' : 'win'
  const color = tone === 'loss' ? '#ef4444' : tone === 'warn' ? '#f59e0b' : '#22c55e'
  const label = tone === 'loss' ? 'Losing' : tone === 'warn' ? 'Marginal' : value >= 2 ? 'Great' : 'Good'

  // SVG arc geometry
  const r = 38
  const cx = 56
  const cy = 50
  const startAngle = -180
  const endAngle = 0
  const span = endAngle - startAngle
  const valueAngle = startAngle + pct * span
  const polar = (a: number) => {
    const rad = (a * Math.PI) / 180
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
  }
  const [sx, sy] = polar(startAngle)
  const [vx, vy] = polar(valueAngle)
  const [ex, ey] = polar(endAngle)
  const arcBg = `M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`
  const arcVal = `M ${sx} ${sy} A ${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 1 ${vx} ${vy}`

  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="text-xs text-muted uppercase tracking-wider">Profit Factor</div>
      <div className="mt-2 flex items-center gap-3">
        <div className="relative">
          <svg width="112" height="60" viewBox="0 0 112 60">
            <path d={arcBg} fill="none" stroke="#222b3d" strokeWidth="6" strokeLinecap="round" />
            {value > 0 && <path d={arcVal} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" />}
          </svg>
        </div>
        <div className="flex-1">
          <div className="text-3xl font-bold num" style={{ color }}>{display}</div>
          <div className="text-[11px] text-muted">{label}</div>
        </div>
      </div>
      <div className="mt-1 text-[11px] text-muted">gross wins ÷ |gross losses|</div>
    </div>
  )
}
