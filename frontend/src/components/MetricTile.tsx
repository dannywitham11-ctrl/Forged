type Tone = 'neutral' | 'win' | 'loss' | 'warn'

export default function MetricTile({
  label, value, sub, tone = 'neutral',
}: { label: string; value: string; sub?: string; tone?: Tone }) {
  const color =
    tone === 'win' ? 'text-win' :
    tone === 'loss' ? 'text-loss' :
    tone === 'warn' ? 'text-warn' : 'text-text'
  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="text-[11px] text-muted uppercase tracking-wider">{label}</div>
      <div className={`mt-1.5 text-xl font-semibold num ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted mt-1 num">{sub}</div>}
    </div>
  )
}
