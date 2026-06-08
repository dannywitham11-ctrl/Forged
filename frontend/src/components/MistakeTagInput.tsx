import { useState } from 'react'

// Expanded preset list of common trading mistakes.
const PRESET_MISTAKES = [
  // Discipline
  'FOMO', 'Revenge', 'Tilt', 'Boredom trade', 'Forced trade', 'Hope trade',
  // Sizing & risk
  'Oversized', 'Wrong size', 'Doubled down', 'No stop', 'Moved stop', 'Held loser',
  // Plan/execution
  'No plan', 'Skipped setup', 'Skipped stop', 'Skipped target', 'Hesitated', 'Chased',
  'Late entry', 'Early entry', 'Early exit', 'Cut winner', 'Scaled out early',
  'Added to loser', 'Scaled in losing',
  // Direction & context
  'Against trend', 'Counter-trend', 'Wrong direction', 'No edge', 'No invalidation',
  // Conditions
  'News play', 'Pre-news', 'Post-loss', 'Out of session', 'Low liquidity',
  'Overtrading', 'Traded tired', 'Distracted', 'Bag held', 'Held overnight',
  // Orderflow / DOM
  'Faded big order', 'Fought absorption', 'Front-ran the print',
  'Ignored sweep', 'Against delta', 'Counter-imbalance', 'Counter-POC',
  'Traded thin tape', 'Took spoofed bid', 'Took spoofed offer',
  'Missed liquidity void', 'Caught in stop run', 'Fought aggressive flow',
  // Options flow
  'Counter-flow', 'Faded unusual flow', 'Ignored 0DTE gamma', 'Pinning trap',
  'Late on sweep', 'Counter to dealer', 'Vol mispricing',
]

export default function MistakeTagInput({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  const [custom, setCustom] = useState('')
  const tags = value ? value.split(',').map(s => s.trim()).filter(Boolean) : []
  const has = (t: string) => tags.includes(t)
  function toggle(t: string) {
    const next = has(t) ? tags.filter(x => x !== t) : [...tags, t]
    onChange(next.join(', '))
  }
  function addCustom() {
    const t = custom.trim()
    if (!t || has(t)) return
    onChange([...tags, t].join(', '))
    setCustom('')
  }
  return (
    <div>
      <div className="text-xs text-muted mb-1.5">Mistakes</div>
      <div className="flex flex-wrap gap-1.5">
        {PRESET_MISTAKES.map(t => (
          <button key={t} type="button" onClick={() => toggle(t)}
            className={`text-[11px] px-2 py-0.5 rounded-full border ${has(t)
              ? 'bg-loss/20 border-loss/50 text-loss'
              : 'border-border text-muted hover:border-loss/40 hover:text-text'}`}
          >{t}</button>
        ))}
        {tags.filter(t => !PRESET_MISTAKES.includes(t)).map(t => (
          <span key={t} className="text-[11px] px-2 py-0.5 rounded-full border bg-loss/20 border-loss/50 text-loss flex items-center gap-1">
            {t}
            <button onClick={() => toggle(t)} className="opacity-70 hover:opacity-100">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-1 mt-2">
        <input value={custom} onChange={e => setCustom(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addCustom()}
          placeholder="Add custom mistake…"
          className="flex-1 bg-panel2 border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-accent" />
        <button onClick={addCustom} className="text-xs text-accent px-2 hover:underline">Add</button>
      </div>
    </div>
  )
}
