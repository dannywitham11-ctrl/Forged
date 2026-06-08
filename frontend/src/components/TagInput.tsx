import { useState } from 'react'

// Curated default tags grouped for browsability. Pickers are flat — groups are for visual cue only.
const PRESET_TAGS = [
  // Quality
  'A+', 'A', 'B', 'C',
  // Setups
  'Setup', 'Reversal', 'Breakout', 'Pullback', 'Continuation', 'Range', 'Trend',
  'Failed move', 'Retest', 'Liquidity grab', 'Stop run',
  // Structure (SMC / price action)
  'BOS', 'CHoCH', 'OB respect', 'FVG fill', 'EQH', 'EQL', 'Fib',
  // Levels
  'Support', 'Resistance', 'VWAP', 'PDH', 'PDL', 'PDC',
  // Patterns
  'Hammer', 'Engulfing', 'Pin bar', 'Double top', 'Double bottom',
  // Style
  'Scalp', 'Swing', 'Intraday', 'Runner', 'Manual', 'Auto',
  // Sessions
  'Open', 'Lunch', 'PM', 'Overnight', 'Pre-market',
  'London open', 'NY open', 'NY close', 'Asia',
  // News
  'News', 'FOMC', 'CPI', 'NFP', 'PPI', 'GDP', 'PMI', 'Earnings',
  // Orderflow / DOM
  'Absorption', 'Imbalance', 'Iceberg', 'Sweep', 'Stacked DOM', 'Spoofing',
  'Delta divergence', 'Cumulative delta', 'Aggressive buyers', 'Aggressive sellers',
  'POC respect', 'POC reject', 'Value area', 'VAH', 'VAL', 'Naked POC',
  'Single print', 'Auction failure', 'Big print', 'Block trade',
  'Footprint imbalance', 'Bid stack', 'Offer stack', 'Liquidity void',
  'Stop hunt', 'Run on stops', 'Trapped longs', 'Trapped shorts',
  // Options flow
  'Call sweep', 'Put sweep', 'Unusual options', 'Gamma squeeze',
  '0DTE', 'Weeklies', 'Pinning', 'Max pain', 'Gex flip',
  'Whale block', 'Hedging flow', 'Dealer positioning', 'Vanna',
  'Vol crush', 'Vol spike', 'IV expansion',
]

export default function TagInput({
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
      <div className="text-xs text-muted mb-1.5">Tags</div>
      <div className="flex flex-wrap gap-1.5">
        {PRESET_TAGS.map(t => (
          <button key={t} type="button" onClick={() => toggle(t)}
            className={`text-[11px] px-2 py-0.5 rounded-full border ${has(t)
              ? 'bg-accent/20 border-accent/50 text-accent'
              : 'border-border text-muted hover:border-accent/40 hover:text-text'}`}
          >{t}</button>
        ))}
        {tags.filter(t => !PRESET_TAGS.includes(t)).map(t => (
          <span key={t} className="text-[11px] px-2 py-0.5 rounded-full border bg-accent/20 border-accent/50 text-accent flex items-center gap-1">
            {t}
            <button onClick={() => toggle(t)} className="opacity-70 hover:opacity-100">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-1 mt-2">
        <input value={custom} onChange={e => setCustom(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addCustom()}
          placeholder="Add custom tag…"
          className="flex-1 bg-panel2 border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-accent" />
        <button onClick={addCustom} className="text-xs text-accent px-2 hover:underline">Add</button>
      </div>
    </div>
  )
}
