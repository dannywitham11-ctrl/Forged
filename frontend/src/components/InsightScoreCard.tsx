import { InsightScore } from '../lib/api'

export default function InsightScoreCard({ data }: { data: InsightScore }) {
  const color = data.score >= 80 ? '#22c55e' : data.score >= 65 ? '#84cc16' : data.score >= 50 ? '#f59e0b' : '#ef4444'
  const circumference = 2 * Math.PI * 42
  const offset = circumference * (1 - data.score / 100)

  return (
    <div className="bg-gradient-to-br from-panel via-panel to-panel2/30 border border-border rounded-xl p-5 relative overflow-hidden">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-xs text-muted uppercase tracking-wider">Insight Score</div>
          <div className="text-[11px] text-muted mt-0.5">composite performance index</div>
        </div>
        <span className="text-[10px] text-muted bg-panel2 px-2 py-0.5 rounded-full">v1</span>
      </div>
      <div className="flex items-center gap-5">
        <div className="relative shrink-0">
          <svg width="110" height="110" viewBox="0 0 110 110">
            <circle cx="55" cy="55" r="42" fill="none" stroke="#222b3d" strokeWidth="8" />
            <circle cx="55" cy="55" r="42" fill="none" stroke={color}
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 55 55)"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-bold num" style={{ color }}>{data.score.toFixed(0)}</div>
            <div className="text-xs text-muted -mt-0.5">{data.grade}</div>
          </div>
        </div>
        <div className="flex-1 space-y-1.5">
          {data.components.map(c => {
            const barColor = c.score >= 80 ? '#22c55e' : c.score >= 65 ? '#84cc16' : c.score >= 50 ? '#f59e0b' : '#ef4444'
            return (
              <div key={c.key} className="text-[11px]">
                <div className="flex justify-between mb-0.5">
                  <span className="text-muted">{c.label} <span className="opacity-60 text-[10px]">{c.value_display}</span></span>
                  <span className="num text-text">{c.score.toFixed(0)}</span>
                </div>
                <div className="h-1.5 bg-panel2 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${c.score}%`, background: barColor }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="text-[11px] text-muted mt-3 pt-3 border-t border-border">{data.summary}</div>
    </div>
  )
}
