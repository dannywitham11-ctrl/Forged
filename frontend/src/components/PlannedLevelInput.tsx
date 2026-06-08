type Mode = 'price' | 'ticks' | null

export default function PlannedLevelInput({
  label, mode, value, onChange,
}: {
  label: string
  mode: Mode
  value: number | null
  onChange: (mode: Mode, value: number | null) => void
}) {
  return (
    <div>
      <label className="text-xs text-muted">{label}</label>
      <div className="flex gap-1 mt-1">
        <div className="flex bg-panel2 border border-border rounded overflow-hidden text-xs">
          <ModeBtn active={mode === 'price'} onClick={() => onChange('price', value)}>Price</ModeBtn>
          <ModeBtn active={mode === 'ticks'} onClick={() => onChange('ticks', value)}>Ticks</ModeBtn>
        </div>
        <input
          type="number"
          step="any"
          value={value ?? ''}
          placeholder={mode === 'ticks' ? 'e.g. 20' : 'e.g. 27450.25'}
          onChange={(e) => {
            const v = e.target.value === '' ? null : parseFloat(e.target.value)
            onChange(mode ?? 'price', Number.isNaN(v as number) ? null : v)
          }}
          className="flex-1 bg-panel2 border border-border rounded px-2 py-1 text-sm num focus:outline-none focus:border-accent"
        />
        {(value !== null || mode !== null) && (
          <button onClick={() => onChange(null, null)}
            className="text-[10px] text-muted hover:text-loss px-2">Clear</button>
        )}
      </div>
    </div>
  )
}

function ModeBtn({ active, onClick, children }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 ${active ? 'bg-accent text-bg font-medium' : 'text-muted hover:text-text'}`}
    >{children}</button>
  )
}
