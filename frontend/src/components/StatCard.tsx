type Tone = 'neutral' | 'win' | 'loss'

export default function StatCard({
  label, value, sub, tone = 'neutral',
}: { label: string; value: string; sub?: string; tone?: Tone }) {
  const color = tone === 'win' ? 'text-win' : tone === 'loss' ? 'text-loss' : 'text-text'
  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="text-xs text-muted uppercase tracking-wider">{label}</div>
      <div className={`mt-2 text-2xl font-semibold num ${color}`}>{value}</div>
      {sub && <div className="text-xs text-muted mt-1 num">{sub}</div>}
    </div>
  )
}
