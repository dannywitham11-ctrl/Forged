import { useEffect, useRef, useState } from 'react'
import { Account } from '../lib/api'

export type AccountFilters = {
  hideBlown: boolean
  hidePassedEvals: boolean
}

export default function MultiAccountSelect({
  accounts, selected, onChange, filters, onFiltersChange,
}: {
  accounts: Account[]
  selected: number[]                            // [] means "all" (within filter set)
  onChange: (ids: number[]) => void
  filters: AccountFilters
  onFiltersChange: (f: AccountFilters) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const visibleAccounts = accounts.filter(a => {
    if (filters.hideBlown && a.status === 'blown') return false
    if (filters.hidePassedEvals && (a.account_type === 'eval') && a.target_reached) return false
    return true
  })
  const visibleIds = new Set(visibleAccounts.map(a => a.id))

  // selected may contain now-hidden ids — those are dropped from the effective set.
  const effectiveSelected = selected.filter(id => visibleIds.has(id))
  const isAll = effectiveSelected.length === 0 || effectiveSelected.length === visibleAccounts.length

  const fundedCount = accounts.filter(a => a.account_type === 'pa' || a.account_type === 'funded').length
  const evalCount = accounts.filter(a => a.account_type === 'eval').length
  const blownCount = accounts.filter(a => a.status === 'blown').length
  const passedCount = accounts.filter(a => a.account_type === 'eval' && a.target_reached).length

  const label = (() => {
    if (visibleAccounts.length === 0) return 'No accounts (filters hide all)'
    if (isAll) {
      let l = `All ${visibleAccounts.length}`
      const hidden = accounts.length - visibleAccounts.length
      if (hidden > 0) l += ` (${hidden} hidden)`
      return l
    }
    if (effectiveSelected.length === 1) {
      return accounts.find(a => a.id === effectiveSelected[0])?.display_name || '1 account'
    }
    return `${effectiveSelected.length} of ${visibleAccounts.length}`
  })()

  function toggle(id: number) {
    const isAllNow = selected.length === 0
    let base = isAllNow ? visibleAccounts.map(a => a.id) : selected.filter(x => visibleIds.has(x))
    if (base.includes(id)) {
      const next = base.filter(x => x !== id)
      onChange(next.length === visibleAccounts.length ? [] : next)
    } else {
      const next = [...base, id]
      onChange(next.length === visibleAccounts.length ? [] : next)
    }
  }

  function selectByType(types: string[]) {
    const ids = visibleAccounts.filter(a => types.includes(a.account_type)).map(a => a.id)
    onChange(ids.length === 0 ? [-1] : ids.length === visibleAccounts.length ? [] : ids)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="bg-panel2 border border-border rounded px-3 py-1 text-sm flex items-center gap-2 min-w-[200px] justify-between hover:border-accent/50"
      >
        <span className="truncate">{label}</span>
        <span className="text-muted shrink-0">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-80 bg-panel border border-border rounded-md shadow-lg z-50 max-h-[80vh] overflow-auto">
          <div className="p-2 border-b border-border flex flex-wrap gap-1.5 text-xs">
            <Chip onClick={() => onChange([])}>All ({visibleAccounts.length})</Chip>
            <Chip onClick={() => selectByType(['pa', 'funded'])} disabled={fundedCount === 0}>
              Funded ({fundedCount})
            </Chip>
            <Chip onClick={() => selectByType(['eval'])} disabled={evalCount === 0}>
              Evals ({evalCount})
            </Chip>
            <Chip onClick={() => onChange([-1])}>None</Chip>
          </div>
          <div className="p-2 border-b border-border space-y-1.5">
            <Toggle
              checked={filters.hideBlown}
              onChange={v => onFiltersChange({ ...filters, hideBlown: v })}
              label={`Hide blown accounts`}
              count={blownCount}
            />
            <Toggle
              checked={filters.hidePassedEvals}
              onChange={v => onFiltersChange({ ...filters, hidePassedEvals: v })}
              label="Hide evals that hit profit target"
              count={passedCount}
            />
          </div>
          <div>
            {visibleAccounts.map(a => {
              const checked = selected.length === 0 || selected.includes(a.id)
              const equity = a.current_equity != null ? a.current_equity.toFixed(0) : null
              return (
                <label key={a.id}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-panel2/80 cursor-pointer border-t border-border/60">
                  <input type="checkbox" checked={checked} onChange={() => toggle(a.id)}
                    className="accent-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{a.display_name}</span>
                      <StatusPill a={a} />
                    </div>
                    <div className="text-[10px] text-muted truncate">
                      {a.account_type}
                      {a.prop_firm ? ` · ${a.prop_firm}` : ''}
                      {equity ? ` · $${equity}` : ''}
                      {a.trade_count != null ? ` · ${a.trade_count} trades` : ''}
                    </div>
                  </div>
                </label>
              )
            })}
            {!visibleAccounts.length && (
              <div className="px-3 py-3 text-sm text-muted">
                {accounts.length ? 'All accounts are hidden by the active filters.' : 'No accounts yet.'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Chip({ onClick, disabled, children }: any) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="px-2 py-1 rounded bg-panel2 border border-border hover:border-accent/40 hover:text-text text-muted disabled:opacity-30 disabled:hover:border-border">
      {children}
    </button>
  )
}

function Toggle({ checked, onChange, label, count }: { checked: boolean; onChange: (v: boolean) => void; label: string; count?: number }) {
  return (
    <label className="flex items-center gap-2 text-xs cursor-pointer text-muted hover:text-text">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="accent-loss shrink-0" />
      <span className="flex-1">{label}</span>
      {count != null && count > 0 && (
        <span className="bg-panel2 px-1.5 py-0.5 rounded text-[10px] num">{count}</span>
      )}
    </label>
  )
}

function StatusPill({ a }: { a: Account }) {
  if (a.status === 'blown') return <span className="text-[9px] uppercase bg-loss/20 text-loss px-1 rounded">blown</span>
  if (a.target_reached && a.account_type === 'eval') return <span className="text-[9px] uppercase bg-win/20 text-win px-1 rounded">passed</span>
  if (a.status === 'funded' || a.status === 'paid_out') return <span className="text-[9px] uppercase bg-win/20 text-win px-1 rounded">funded</span>
  return null
}
