import { useEffect, useState } from 'react'
import { api, Account, AccountCost, EconomicsSummary, fmtUsd, fmtPct } from '../lib/api'

const CATEGORIES = [
  { key: 'eval_monthly', label: 'Eval Subscription (monthly)' },
  { key: 'activation', label: 'PA Activation Fee' },
  { key: 'reset', label: 'Reset Fee' },
  { key: 'data_feed', label: 'Data Feed' },
  { key: 'platform', label: 'Platform / Sierra Chart' },
  { key: 'other', label: 'Other' },
]

type CostForm = {
  account_id: string
  category: string
  amount: number
  cost_date: string
  description: string
  is_recurring: boolean
  recurring_end_date: string
}

function emptyForm(): CostForm {
  return {
    account_id: '',
    category: 'eval_monthly',
    amount: 0,
    cost_date: new Date().toISOString().slice(0, 10),
    description: '',
    is_recurring: false,
    recurring_end_date: '',
  }
}

function fromCost(c: AccountCost): CostForm {
  return {
    account_id: c.account_id ? String(c.account_id) : '',
    category: c.category,
    amount: c.amount,
    cost_date: c.cost_date.slice(0, 10),
    description: c.description || '',
    is_recurring: c.is_recurring,
    recurring_end_date: c.recurring_end_date ? c.recurring_end_date.slice(0, 10) : '',
  }
}

function toPayload(f: CostForm) {
  return {
    account_id: f.account_id ? Number(f.account_id) : undefined,
    category: f.category,
    amount: f.amount,
    cost_date: new Date(f.cost_date).toISOString(),
    description: f.description || undefined,
    is_recurring: f.is_recurring,
    recurring_end_date: f.is_recurring && f.recurring_end_date
      ? new Date(f.recurring_end_date).toISOString()
      : null,
  }
}

export default function Costs({ accounts }: { accounts: Account[] }) {
  const [costs, setCosts] = useState<AccountCost[]>([])
  const [econ, setEcon] = useState<EconomicsSummary | null>(null)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<CostForm>(emptyForm())

  async function refresh() {
    const [c, e] = await Promise.all([api.costs.list(), api.economics()])
    setCosts(c); setEcon(e)
  }
  useEffect(() => { refresh() }, [])

  function startCreate() {
    setForm(emptyForm()); setEditingId(null); setCreating(true)
  }
  function startEdit(c: AccountCost) {
    setForm(fromCost(c)); setCreating(false); setEditingId(c.id)
  }
  function cancel() {
    setCreating(false); setEditingId(null); setForm(emptyForm())
  }

  async function save() {
    if (!form.amount) return
    if (editingId != null) {
      const payload = toPayload(form)
      await api.costs.update(editingId, {
        account_id: payload.account_id ?? null,
        category: payload.category,
        amount: payload.amount,
        cost_date: payload.cost_date,
        description: payload.description ?? null,
        is_recurring: payload.is_recurring,
        recurring_end_date: payload.recurring_end_date,
      })
    } else {
      await api.costs.create(toPayload(form))
    }
    cancel(); refresh()
  }
  async function remove(id: number) {
    if (!confirm('Delete this cost?')) return
    await api.costs.delete(id); refresh()
  }

  const acctMap = Object.fromEntries(accounts.map(a => [a.id, a]))

  return (
    <div className="p-6 space-y-6">
      {econ && (
        <div className={`bg-gradient-to-br border rounded-xl p-5 ${econ.is_profitable
          ? 'from-win/10 to-panel border-win/40'
          : 'from-loss/10 to-panel border-loss/40'}`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted">Net Real Money</div>
              <div className="text-[10px] text-muted">payouts received − account costs spent</div>
            </div>
            <div className={`text-3xl font-bold num ${econ.is_profitable ? 'text-win' : 'text-loss'}`}>
              {fmtUsd(econ.net_real_pnl, { signed: true })}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Card label="Total Costs" value={fmtUsd(econ.total_costs)} tone="loss" />
            <Card label="Payouts Received" value={fmtUsd(econ.total_payouts_received)} tone="win" />
            <Card label="Paper P&L (funded)" value={fmtUsd(econ.paper_pnl_active_accounts)} />
            <Card label={econ.is_profitable ? 'Profitable!' : 'To Break-Even'}
              value={econ.is_profitable ? '✓' : fmtUsd(econ.amount_to_break_even)} />
          </div>
          {!econ.is_profitable && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted">Path to break-even</span>
                <span className="num">{fmtPct(econ.break_even_progress_pct, 0)}</span>
              </div>
              <div className="h-2 bg-panel2 rounded-full overflow-hidden">
                <div className="h-full bg-win/70" style={{ width: `${econ.break_even_progress_pct * 100}%` }} />
              </div>
              {econ.days_to_break_even && (
                <div className="text-xs text-muted mt-2 num">
                  Est. {econ.days_to_break_even} days to break-even at recent payout rate
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4 text-xs">
            <div className="text-muted">Active: <span className="text-text num">{econ.active_accounts}</span></div>
            <div className="text-muted">Funded: <span className="text-text num">{econ.funded_accounts}</span></div>
            <div className="text-muted">Blown: <span className="text-loss num">{econ.blown_accounts}</span></div>
          </div>
        </div>
      )}

      {econ && econ.per_account.length > 0 && (
        <div>
          <div className="text-sm font-semibold mb-2">Per-Account Economics</div>
          <div className="bg-panel border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-panel2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Account</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Starting</th>
                  <th className="px-3 py-2 text-right">Equity</th>
                  <th className="px-3 py-2 text-right">Realized P&L</th>
                  <th className="px-3 py-2 text-right">Paid Out</th>
                  <th className="px-3 py-2 text-right">Costs</th>
                  <th className="px-3 py-2 text-right">Net Real</th>
                </tr>
              </thead>
              <tbody>
                {econ.per_account.map(a => (
                  <tr key={a.account_id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="font-medium">{a.display_name}</div>
                      <div className="text-[10px] text-muted">{a.prop_firm || a.account_type}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        a.status === 'blown' ? 'bg-loss/20 text-loss' :
                        a.status === 'funded' || a.status === 'paid_out' ? 'bg-win/20 text-win' :
                        'bg-panel2 text-muted'}`}>{a.status}</span>
                    </td>
                    <td className="px-3 py-2 text-right num">{fmtUsd(a.starting_balance)}</td>
                    <td className="px-3 py-2 text-right num">{fmtUsd(a.current_equity)}</td>
                    <td className={`px-3 py-2 text-right num ${a.realized_pnl > 0 ? 'text-win' : a.realized_pnl < 0 ? 'text-loss' : ''}`}>
                      {fmtUsd(a.realized_pnl, { signed: true })}
                    </td>
                    <td className="px-3 py-2 text-right num text-win">{fmtUsd(a.total_paid_out)}</td>
                    <td className="px-3 py-2 text-right num text-loss">{fmtUsd(a.total_costs)}</td>
                    <td className={`px-3 py-2 text-right num font-semibold ${a.net_real > 0 ? 'text-win' : a.net_real < 0 ? 'text-loss' : ''}`}>
                      {fmtUsd(a.net_real, { signed: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold">Cost Ledger</div>
            <div className="text-xs text-muted">Log every dollar spent — eval subs, activations, resets, data feeds. Toggle "Repeating monthly" for subscriptions; the total accrues from the start date.</div>
          </div>
          {!creating && editingId == null && (
            <button onClick={startCreate}
              className="bg-accent text-bg px-3 py-1.5 rounded text-sm">+ Log Cost</button>
          )}
        </div>
        {(creating || editingId != null) && (
          <CostFormEditor
            accounts={accounts}
            form={form}
            setForm={setForm}
            onSave={save}
            onCancel={cancel}
            mode={editingId != null ? 'edit' : 'create'}
          />
        )}
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-panel2 text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2 text-left">Start / Date</th>
                <th className="px-3 py-2 text-left">Account</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {costs.map(c => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-2 num text-muted">
                    {new Date(c.cost_date).toLocaleDateString()}
                    {c.is_recurring && c.recurring_end_date && (
                      <div className="text-[10px]">→ {new Date(c.recurring_end_date).toLocaleDateString()}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">{c.account_id ? (acctMap[c.account_id]?.display_name || c.account_id) : <span className="text-muted">—</span>}</td>
                  <td className="px-3 py-2 text-muted">
                    {CATEGORIES.find(x => x.key === c.category)?.label || c.category}
                    {c.is_recurring && (
                      <span className="ml-1.5 text-[9px] uppercase tracking-wider bg-accent/20 text-accent px-1 py-0.5 rounded">↻ monthly</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted text-xs">{c.description || ''}</td>
                  <td className="px-3 py-2 text-right num text-loss">
                    {fmtUsd(c.effective_total)}
                    {c.is_recurring && (
                      <div className="text-[10px] text-muted">
                        {fmtUsd(c.amount)}/mo × {c.cycles_elapsed}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right space-x-3">
                    <button onClick={() => startEdit(c)} className="text-xs text-accent hover:underline">Edit</button>
                    <button onClick={() => remove(c.id)} className="text-xs text-loss/80 hover:text-loss">Delete</button>
                  </td>
                </tr>
              ))}
              {!costs.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted">No costs logged yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {econ && Object.keys(econ.cost_breakdown).length > 0 && (
        <div>
          <div className="text-sm font-semibold mb-2">Cost Breakdown</div>
          <div className="bg-panel border border-border rounded-lg p-4">
            <div className="space-y-2">
              {Object.entries(econ.cost_breakdown).sort((a,b) => b[1] - a[1]).map(([k, v]) => {
                const pct = (v / econ.total_costs) * 100
                return (
                  <div key={k}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted">{CATEGORIES.find(c => c.key === k)?.label || k}</span>
                      <span className="num">{fmtUsd(v)} <span className="text-muted">({pct.toFixed(0)}%)</span></span>
                    </div>
                    <div className="h-1.5 bg-panel2 rounded-full overflow-hidden">
                      <div className="h-full bg-loss/70" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CostFormEditor({ accounts, form, setForm, onSave, onCancel, mode }: {
  accounts: Account[]
  form: CostForm
  setForm: (f: CostForm) => void
  onSave: () => void
  onCancel: () => void
  mode: 'create' | 'edit'
}) {
  return (
    <div className="bg-panel border border-border rounded-lg p-4 mb-3 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div>
          <label className="text-xs text-muted">Account (optional)</label>
          <select value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })}
            className="w-full mt-1 bg-panel2 border border-border rounded px-2 py-1.5 text-sm">
            <option value="">— Unattached —</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.display_name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted">Category</label>
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
            className="w-full mt-1 bg-panel2 border border-border rounded px-2 py-1.5 text-sm">
            {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted">{form.is_recurring ? 'Start date' : 'Date'}</label>
          <input type="date" value={form.cost_date} onChange={e => setForm({ ...form, cost_date: e.target.value })}
            className="w-full mt-1 bg-panel2 border border-border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-muted">{form.is_recurring ? 'Amount $ / month' : 'Amount $'}</label>
          <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
            className="w-full mt-1 bg-panel2 border border-border rounded px-2 py-1.5 text-sm num" />
        </div>
        <div className="flex gap-2 items-end">
          <button onClick={onSave} className="bg-accent text-bg px-3 py-1.5 rounded text-sm flex-1">
            {mode === 'edit' ? 'Save changes' : 'Save'}
          </button>
          <button onClick={onCancel} className="text-muted text-sm px-3">Cancel</button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
          <input type="checkbox" checked={form.is_recurring}
            onChange={e => setForm({ ...form, is_recurring: e.target.checked })}
            className="accent-accent" />
          Repeating monthly
        </label>
        {form.is_recurring && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted">End date (optional)</label>
            <input type="date" value={form.recurring_end_date}
              onChange={e => setForm({ ...form, recurring_end_date: e.target.value })}
              className="bg-panel2 border border-border rounded px-2 py-1 text-sm" />
            {form.recurring_end_date && (
              <button onClick={() => setForm({ ...form, recurring_end_date: '' })}
                className="text-xs text-muted hover:text-text">clear</button>
            )}
          </div>
        )}
      </div>
      <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
        placeholder="Description (optional)"
        className="w-full bg-panel2 border border-border rounded px-2 py-1.5 text-sm" />
    </div>
  )
}

function Card({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'win'|'loss'|'neutral' }) {
  const c = tone === 'win' ? 'text-win' : tone === 'loss' ? 'text-loss' : 'text-text'
  return (
    <div className="bg-panel/50 border border-border rounded-lg p-3">
      <div className="text-[10px] text-muted uppercase tracking-wider">{label}</div>
      <div className={`num font-semibold mt-1 text-xl ${c}`}>{value}</div>
    </div>
  )
}
