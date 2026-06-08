import { useEffect, useState } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { api, Account } from './lib/api'
import MultiAccountSelect, { AccountFilters } from './components/MultiAccountSelect'
import Dashboard from './pages/Dashboard'
import Trades from './pages/Trades'
import Daily from './pages/Daily'
import Calendar from './pages/Calendar'
import Upload from './pages/Upload'
import Accounts from './pages/Accounts'
import Strategies from './pages/Strategies'
import Payouts from './pages/Payouts'
import PropFirms from './pages/PropFirms'
import Costs from './pages/Costs'
import Plan from './pages/Plan'
import MarketData from './pages/MarketData'

const FILTERS_KEY = 'tz_account_filters'
const SELECTION_KEY = 'tz_account_selection'
const SELECTION_INIT_KEY = 'tz_selection_initialized_v1'

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem(SELECTION_KEY)
      if (stored) return JSON.parse(stored)
    } catch {}
    return []
  })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [filters, setFilters] = useState<AccountFilters>(() => {
    try {
      const stored = localStorage.getItem(FILTERS_KEY)
      if (stored) return { hideBlown: true, hidePassedEvals: false, ...JSON.parse(stored) }
    } catch {}
    // Default: hide blown (matches the "only show what I can trade" intent).
    return { hideBlown: true, hidePassedEvals: false }
  })
  const loc = useLocation()

  async function refreshAccounts() {
    try { setAccounts(await api.accounts.list()) } catch (e) { console.error(e) }
  }
  useEffect(() => { refreshAccounts() }, [])
  useEffect(() => { setMobileMenuOpen(false) }, [loc.pathname])
  useEffect(() => {
    try { localStorage.setItem(FILTERS_KEY, JSON.stringify(filters)) } catch {}
  }, [filters])
  useEffect(() => {
    try { localStorage.setItem(SELECTION_KEY, JSON.stringify(selectedAccounts)) } catch {}
  }, [selectedAccounts])

  // First-time default: select all PA / funded accounts (skip blown). Runs once.
  useEffect(() => {
    if (accounts.length === 0) return
    if (localStorage.getItem(SELECTION_INIT_KEY)) return
    const paIds = accounts
      .filter(a => (a.account_type === 'pa' || a.account_type === 'funded') && a.status !== 'blown')
      .map(a => a.id)
    if (paIds.length > 0) {
      setSelectedAccounts(paIds)
    }
    localStorage.setItem(SELECTION_INIT_KEY, '1')
  }, [accounts.length]) // eslint-disable-line

  // Prune deleted account IDs from the saved selection (preserve the "None" sentinel [-1]).
  useEffect(() => {
    if (accounts.length === 0) return
    const valid = new Set(accounts.map(a => a.id))
    setSelectedAccounts(prev => {
      if (prev.length === 1 && prev[0] === -1) return prev
      const pruned = prev.filter(id => valid.has(id))
      return pruned.length === prev.length ? prev : pruned
    })
  }, [accounts])

  // IDs the rest of the app queries on: explicit selection ∩ always-on filters.
  const visibleAccountIds = new Set(
    accounts.filter(a => {
      if (filters.hideBlown && a.status === 'blown') return false
      if (filters.hidePassedEvals && a.account_type === 'eval' && a.target_reached) return false
      return true
    }).map(a => a.id)
  )

  let effectiveIds: number[] | undefined
  if (selectedAccounts.length === 1 && selectedAccounts[0] === -1) {
    effectiveIds = [-1]   // explicit "None"
  } else if (selectedAccounts.length === 0) {
    // "All within filter": send the explicit list if filters are active so the
    // backend excludes hidden accounts; otherwise undefined = all.
    const hasActiveFilter = filters.hideBlown || filters.hidePassedEvals
    effectiveIds = hasActiveFilter ? Array.from(visibleAccountIds) : undefined
  } else {
    // Explicit selection — intersect with visible set so hidden ones can't sneak in.
    effectiveIds = selectedAccounts.filter(id => visibleAccountIds.has(id))
    if (effectiveIds.length === 0) effectiveIds = [-1]
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text">
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)} />
      )}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 md:w-56 shrink-0 border-r border-border bg-panel flex flex-col
        transition-transform duration-200
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-lg font-bold tracking-tight">Forge<span className="text-accent">.local</span></div>
            <div className="text-xs text-muted mt-0.5">Multi-account trading journal</div>
          </div>
          <button onClick={() => setMobileMenuOpen(false)}
            className="md:hidden text-muted hover:text-text text-2xl leading-none p-1">×</button>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          <SideLink to="/" label="Dashboard" icon="◎" />
          <SideLink to="/daily" label="Daily" icon="☼" />
          <SideLink to="/trades" label="Trades" icon="≡" />
          <SideLink to="/calendar" label="Calendar" icon="▦" />
          <SideLink to="/strategies" label="Strategies" icon="✦" />
          <SideLink to="/plan" label="Plan" icon="◉" />
          <SideLink to="/prop-firms" label="Prop Firms" icon="◆" />
          <SideLink to="/payouts" label="Payouts" icon="$" />
          <SideLink to="/costs" label="Costs & Net" icon="∑" />
          <SideLink to="/accounts" label="Accounts" icon="◬" />
          <SideLink to="/upload" label="Upload" icon="↑" />
          <SideLink to="/market-data" label="Market Data" icon="≋" />
        </nav>
        <div className="p-3 border-t border-border text-[11px] text-muted">
          {accounts.length} account{accounts.length !== 1 && 's'}
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-14 border-b border-border bg-panel/95 backdrop-blur flex items-center px-3 sm:px-6 gap-2 sm:gap-4">
          <button onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-2 -ml-2 text-muted hover:text-text"
            aria-label="Open menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="text-sm text-muted truncate">{titleFor(loc.pathname)}</div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted hidden sm:inline">Accounts</span>
            <MultiAccountSelect
              accounts={accounts}
              selected={selectedAccounts}
              onChange={setSelectedAccounts}
              filters={filters}
              onFiltersChange={setFilters}
            />
          </div>
        </header>
        <div className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard accountIds={effectiveIds} accounts={accounts} />} />
            <Route path="/daily" element={<Daily accountIds={effectiveIds} />} />
            <Route path="/trades" element={<Trades accountIds={effectiveIds} />} />
            <Route path="/calendar" element={<Calendar accountIds={effectiveIds} />} />
            <Route path="/strategies" element={<Strategies />} />
            <Route path="/plan" element={<Plan />} />
            <Route path="/prop-firms" element={<PropFirms accounts={accounts} onChange={refreshAccounts} />} />
            <Route path="/payouts" element={<Payouts accounts={accounts} />} />
            <Route path="/costs" element={<Costs accounts={accounts} />} />
            <Route path="/upload" element={<Upload onUploaded={refreshAccounts} />} />
            <Route path="/market-data" element={<MarketData />} />
            <Route path="/accounts" element={<Accounts accounts={accounts} onChange={refreshAccounts} />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

function SideLink({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink to={to} end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
          isActive ? 'bg-panel2 text-text font-medium' : 'text-muted hover:bg-panel2 hover:text-text'
        }`}>
      <span className="w-4 text-center text-accent/80">{icon}</span>
      {label}
    </NavLink>
  )
}

function titleFor(pathname: string) {
  if (pathname === '/') return 'Dashboard'
  return pathname.slice(1).replace(/^./, c => c.toUpperCase())
}
