import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, Account, PropFirm, fmtUsd } from '../lib/api'
import DangerZone from '../components/DangerZone'
import SierraBalanceSync from '../components/SierraBalanceSync'

const ACCOUNT_TYPES = ['personal', 'eval', 'pa', 'funded']
const DRAWDOWN_MODES = ['none', 'static', 'trailing_eod', 'trailing_realtime']
const ACCOUNT_STATUSES = ['active', 'passed_eval', 'funded', 'blown', 'paid_out', 'closed']
const PAYOUT_PREFS = ['max', 'min', 'custom']

const HIDE_BLOWN_KEY = 'accounts.hideBlown'

export default function Accounts({ accounts, onChange }: { accounts: Account[]; onChange: () => void }) {
  const [editing, setEditing] = useState<number | null>(null)
  const [form, setForm] = useState<Partial<Account>>({})
  const [firms, setFirms] = useState<PropFirm[]>([])
  const [hideBlown, setHideBlown] = useState<boolean>(() => {
    const v = localStorage.getItem(HIDE_BLOWN_KEY)
    return v === null ? true : v === '1'
  })

  useEffect(() => { api.propFirms.list().then(setFirms) }, [])
  useEffect(() => { localStorage.setItem(HIDE_BLOWN_KEY, hideBlown ? '1' : '0') }, [hideBlown])

  const blownCount = accounts.filter(a => a.status === 'blown').length
  const visibleAccounts = hideBlown ? accounts.filter(a => a.status !== 'blown') : accounts

  function beginEdit(a: Account) {
    setEditing(a.id); setForm({ ...a })
  }
  async function save(id: number) {
    await api.accounts.update(id, form)
    setEditing(null); onChange()
  }
  async function applyPreset(id: number, firmKey: string, planKey: string) {
    if (!planKey) return
    await api.accounts.applyPreset(id, firmKey, planKey)
    setEditing(null); onChange()
  }
  async function markBlown(id: number) {
    if (!confirm('Mark this account as blown?')) return
    await api.accounts.markBlown(id); onChange()
  }
  async function resetStatus(id: number) {
    await api.accounts.resetStatus(id); onChange()
  }
  async function deleteAccount(a: Account) {
    const msg = `Delete account "${a.display_name}" and ALL its trades, executions, payouts, and costs?\n\nThis cannot be undone.`
    if (!confirm(msg)) return
    await api.accountDelete(a.id); onChange()
  }
  async function regenerateName(a: Account) {
    await api.accounts.regenerateName(a.id); onChange()
  }

  return (
    <div className="p-6 space-y-5">
      <SierraBalanceSync onUpdated={onChange} />

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted">
          Accounts are auto-created from the Sierra <code className="text-text bg-panel2 px-1 rounded text-xs">TradeAccount</code> column.
          <code className="text-text bg-panel2 px-1 mx-1 rounded text-xs">PA-…</code> = funded,
          <code className="text-text bg-panel2 px-1 mx-1 rounded text-xs">APEX-…</code> = eval (auto-classified).
          Apply a preset from the <Link to="/prop-firms" className="text-accent hover:underline">Prop Firms</Link> page.
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setHideBlown(v => !v)}
            title={hideBlown ? 'Click to show blown accounts' : 'Click to hide blown accounts'}
            className={`text-xs px-2.5 py-1 rounded border transition-colors whitespace-nowrap ${
              hideBlown
                ? 'bg-accent/15 border-accent/40 text-accent hover:bg-accent/25'
                : 'bg-panel2 border-border text-muted hover:text-text'
            }`}>
            {hideBlown ? 'Show blown' : 'Hide blown'}
            {blownCount > 0 && <span className="ml-1 opacity-70">({blownCount})</span>}
          </button>
          <button onClick={async () => {
            const r = await api.accounts.reclassifyAll()
            alert(`Reclassified ${r.updated} account(s) based on external_id prefix.`)
            onChange()
          }} className="text-xs text-accent hover:underline whitespace-nowrap">↻ Re-classify all</button>
        </div>
      </div>

      <div className="space-y-3">
        {visibleAccounts.map(a => editing === a.id ? (
          <EditCard key={a.id} firms={firms} form={form} setForm={setForm}
            onCancel={() => setEditing(null)} onSave={() => save(a.id)}
            onApplyPreset={(fk, pk) => applyPreset(a.id, fk, pk)} />
        ) : (
          <SummaryCard key={a.id} a={a}
            onEdit={() => beginEdit(a)}
            onMarkBlown={() => markBlown(a.id)}
            onReset={() => resetStatus(a.id)}
            onDelete={() => deleteAccount(a)}
            onRegenerateName={() => regenerateName(a)}
            onChange={onChange} />
        ))}
        {!accounts.length && (
          <div className="glass-panel hover-lift border border-border rounded-lg p-6 text-center text-muted">
            No accounts yet — upload a Sierra export to create one.
          </div>
        )}
        {accounts.length > 0 && !visibleAccounts.length && (
          <div className="glass-panel hover-lift border border-border rounded-lg p-6 text-center text-muted">
            All {blownCount} account{blownCount === 1 ? '' : 's'} are blown and hidden.{' '}
            <button onClick={() => setHideBlown(false)} className="text-accent hover:underline">Show them</button>.
          </div>
        )}
      </div>

      <div className="pt-6 mt-6 border-t border-border">
        <DangerZone onReset={onChange} />
      </div>
    </div>
  )
}

function statusColor(s: string) {
  if (s === 'blown') return 'bg-loss/20 text-loss'
  if (s === 'funded' || s === 'paid_out') return 'bg-win/20 text-win'
  if (s === 'passed_eval') return 'bg-accent/20 text-accent'
  return 'bg-panel2 text-muted'
}

function SummaryCard({ a, onEdit, onMarkBlown, onReset, onDelete, onRegenerateName, onChange }: { a: Account; onEdit: () => void; onMarkBlown: () => void; onReset: () => void; onDelete: () => void; onRegenerateName: () => void; onChange: () => void }) {
  const isProp = a.account_type !== 'personal'
  const equity = a.current_equity ?? a.starting_balance
  const pnl = a.realized_pnl ?? 0
  const pnlPct = a.starting_balance > 0 ? (pnl / a.starting_balance) : 0
  const blown = a.status === 'blown'

  return (
    <div className={`glass-panel hover-lift border rounded-lg p-4 ${blown ? 'border-loss/40' : 'border-border'}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-base font-semibold">{a.display_name}</div>
            <span className="text-[10px] uppercase tracking-wider bg-panel2 px-1.5 py-0.5 rounded">{a.account_type}</span>
            {a.prop_firm && <span className="text-[10px] text-muted">{a.prop_firm}</span>}
            <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${statusColor(a.status)}`}>{a.status}</span>
          </div>
          <div className="text-[11px] text-muted mt-0.5 num">
            {a.external_id} · {a.broker || 'Sierra Chart'}
            {a.prop_firm_plan_key && <span className="ml-2">preset: {a.prop_firm_plan_key}</span>}
            {a.trade_count != null && <span className="ml-2">· {a.trade_count} trades</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] text-muted uppercase tracking-wider">Current Balance</div>
          <div className={`text-2xl font-bold num ${blown ? 'text-loss' : pnl > 0 ? 'text-win' : pnl < 0 ? 'text-loss' : 'text-text'}`}>
            {fmtUsd(equity)}
          </div>
          <div className="text-[11px] num">
            <span className={pnl > 0 ? 'text-win' : pnl < 0 ? 'text-loss' : 'text-muted'}>
              {fmtUsd(pnl, { signed: true })}
            </span>
            {a.starting_balance > 0 && (
              <span className={`ml-1 ${pnl > 0 ? 'text-win' : pnl < 0 ? 'text-loss' : 'text-muted'}`}>
                ({pnl >= 0 ? '+' : ''}{(pnlPct * 100).toFixed(2)}%)
              </span>
            )}
          </div>
          {a.total_payouts_received != null && a.total_payouts_received > 0 && (
            <div className="text-[10px] text-muted num">paid out {fmtUsd(a.total_payouts_received)}</div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap justify-end basis-full md:basis-auto">
          <button onClick={onRegenerateName} className="text-xs text-muted hover:text-text" title="Re-parse external ID into a friendly name">↻ Rename</button>
          {blown
            ? <button onClick={onReset} className="text-xs text-muted hover:text-text">Un-blow</button>
            : <button onClick={onMarkBlown} className="text-xs text-loss/80 hover:text-loss">Mark blown</button>}
          <button onClick={onEdit} className="text-xs text-accent hover:underline">Edit</button>
          <button onClick={onDelete} className="text-xs text-loss/80 hover:text-loss">Delete</button>
        </div>
      </div>
      <div className="mt-3 p-3 rounded bg-panel2/40 border border-border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <div className="text-[10px] text-muted uppercase tracking-wider">Computed (from trades)</div>
            <div className="num font-semibold">{fmtUsd(a.current_equity ?? a.starting_balance)}</div>
            <div className="text-[10px] text-muted mt-0.5">
              start ${a.starting_balance.toFixed(0)} + offset ${(a.starting_balance_offset || 0).toFixed(0)} + pnl
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted uppercase tracking-wider">Broker Balance</div>
            <BrokerBalanceInput accountId={a.id} value={a.broker_balance ?? null}
              updatedAt={a.broker_balance_updated_at} onSaved={onChange} />
          </div>
          <div>
            <div className="text-[10px] text-muted uppercase tracking-wider">Drift</div>
            <div className={`num font-semibold ${
              a.broker_drift == null ? 'text-muted' :
              Math.abs(a.broker_drift) < 5 ? 'text-win' :
              Math.abs(a.broker_drift) < 50 ? 'text-warn' : 'text-loss'
            }`}>
              {a.broker_drift == null ? '—' : fmtUsd(a.broker_drift, { signed: true })}
            </div>
            {a.broker_drift != null && Math.abs(a.broker_drift) >= 50 && a.broker_balance != null && (
              <button onClick={async () => {
                // Absorb the drift into starting_balance_offset so computed = broker going forward.
                const newOffset = (a.starting_balance_offset || 0) - a.broker_drift!
                await api.accounts.update(a.id, {
                  starting_balance_offset: newOffset,
                  reconciliation_note: (a.reconciliation_note || '') +
                    (a.reconciliation_note ? ' | ' : '') +
                    `Absorbed $${(-a.broker_drift!).toFixed(2)} drift on ${new Date().toLocaleDateString()}`,
                } as any)
                onChange()
              }} className="text-[10px] text-accent hover:underline mt-0.5">
                Absorb into offset →
              </button>
            )}
          </div>
          <div>
            <div className="text-[10px] text-muted uppercase tracking-wider">Pre-export Offset</div>
            <input type="number" step="0.01" defaultValue={a.starting_balance_offset ?? 0}
              onBlur={async (e) => {
                const v = parseFloat(e.target.value) || 0
                await api.accounts.update(a.id, { starting_balance_offset: v } as any)
                onChange()
              }}
              className="w-full bg-bg border border-border rounded px-2 py-1 text-sm num focus:outline-none focus:border-accent" />
            <div className="text-[10px] text-muted mt-0.5">P&amp;L before our data starts</div>
          </div>
        </div>
        {a.reconciliation_note && (
          <div className="text-[10px] text-muted mt-2 italic border-t border-border pt-2">
            note: {a.reconciliation_note}
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
        <Cell label="Starting" value={fmtUsd(a.starting_balance)} />
        <Cell label="Comm/side" value={fmtUsd(a.commission_per_side)} />
        {isProp && <>
          <Cell label="Profit Target" value={a.profit_target ? fmtUsd(a.profit_target) : '—'}
            sub={a.target_reached ? '✓ hit' : ''} />
          <Cell label="Max DD" value={a.max_drawdown ? `${fmtUsd(a.max_drawdown)} (${a.drawdown_mode})` : '—'}
            sub={blown && a.blown_date ? `breached ${new Date(a.blown_date).toLocaleDateString()}` : ''} />
          <Cell label="Safety Net" value={a.safety_net_amount ? `+${fmtUsd(a.safety_net_amount)}` : '—'}
            sub={a.extra_safety_buffer ? `+${fmtUsd(a.extra_safety_buffer)} buffer` : ''} />
          <Cell label="Payout Caps" value={a.payout_caps || '—'} />
          <Cell label="Max Payouts" value={a.max_payouts ? String(a.max_payouts) : 'unlimited'} />
          <Cell label="Min Days" value={String(a.min_trading_days_before_payout || 0)} />
          <Cell label="Consistency" value={a.consistency_rule_pct ? `${Math.round(a.consistency_rule_pct * 100)}%` : '—'} />
          <Cell label="Contracts" value={`${a.contracts_micro_max || 0} micro / ${a.contracts_mini_max || 0} mini`} />
          <Cell label="Payout Pref" value={a.payout_preference} />
        </>}
      </div>
    </div>
  )
}

function EditCard({ firms, form, setForm, onCancel, onSave, onApplyPreset }: {
  firms: PropFirm[]; form: Partial<Account>; setForm: (f: Partial<Account>) => void;
  onCancel: () => void; onSave: () => void; onApplyPreset: (fk: string, pk: string) => void
}) {
  const [presetFirm, setPresetFirm] = useState<string>(form.prop_firm_key || '')
  const [presetPlan, setPresetPlan] = useState<string>(form.prop_firm_plan_key || '')
  const isProp = form.account_type && form.account_type !== 'personal'
  const selectedFirm = firms.find(f => f.key === presetFirm)

  return (
    <div className="glass-panel hover-lift border border-accent/40 rounded-lg p-5 space-y-4">
      <div className="bg-panel2/40 border border-border rounded-lg p-3 flex flex-col md:flex-row md:items-end gap-3">
        <div className="flex-1">
          <label className="text-xs text-muted">Quick-apply prop firm preset</label>
          <div className="flex gap-2 mt-1">
            <select value={presetFirm} onChange={e => { setPresetFirm(e.target.value); setPresetPlan('') }}
              className="bg-bg border border-border rounded px-2 py-1.5 text-sm">
              <option value="">— Firm —</option>
              {firms.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            <select value={presetPlan} onChange={e => setPresetPlan(e.target.value)}
              disabled={!selectedFirm}
              className="flex-1 bg-bg border border-border rounded px-2 py-1.5 text-sm">
              <option value="">— Plan —</option>
              {selectedFirm?.plans.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
        </div>
        <button onClick={() => presetFirm && presetPlan && onApplyPreset(presetFirm, presetPlan)}
          disabled={!presetFirm || !presetPlan}
          className="bg-accent text-bg px-3 py-1.5 rounded text-sm font-medium disabled:opacity-40">
          Apply Preset
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Input label="Display Name" value={form.display_name || ''} onChange={v => setForm({ ...form, display_name: v })} />
        <Select label="Type" value={form.account_type || 'personal'} options={ACCOUNT_TYPES}
          onChange={v => setForm({ ...form, account_type: v })} />
        <Select label="Status" value={form.status || 'active'} options={ACCOUNT_STATUSES}
          onChange={v => setForm({ ...form, status: v as any })} />
        <NumInput label="Starting Balance" value={form.starting_balance} onChange={v => setForm({ ...form, starting_balance: v })} />
        <NumInput label="Commission / side" value={form.commission_per_side} onChange={v => setForm({ ...form, commission_per_side: v })} />
        <NumInput label="Fees / side" value={form.fees_per_side} onChange={v => setForm({ ...form, fees_per_side: v })} />
      </div>

      {isProp && (
        <>
          <div className="pt-3 border-t border-border space-y-3">
            <div className="text-xs text-muted uppercase tracking-wider">Drawdown & Target</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <NumInput label="Profit Target $" value={form.profit_target} onChange={v => setForm({ ...form, profit_target: v })} />
              <NumInput label="Max Drawdown $" value={form.max_drawdown} onChange={v => setForm({ ...form, max_drawdown: v })} />
              <Select label="Drawdown Mode" value={form.drawdown_mode || 'none'} options={DRAWDOWN_MODES}
                onChange={v => setForm({ ...form, drawdown_mode: v })} />
              <NumInput label="Trailing DD Cap (offset from start)" value={form.trailing_drawdown_cap}
                onChange={v => setForm({ ...form, trailing_drawdown_cap: v })} />
              <NumInput label="Max Daily Loss $" value={form.max_loss_per_day} onChange={v => setForm({ ...form, max_loss_per_day: v })} />
            </div>
          </div>

          <div className="pt-3 border-t border-border space-y-3">
            <div className="text-xs text-muted uppercase tracking-wider">Safety Net & Payouts</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <NumInput label="Firm Safety Net $ (above start)" value={form.safety_net_amount}
                onChange={v => setForm({ ...form, safety_net_amount: v })} />
              <NumInput label="Extra Safety Buffer $ (your cushion)" value={form.extra_safety_buffer}
                onChange={v => setForm({ ...form, extra_safety_buffer: v })} />
              <NumInput label="Min Payout $" value={form.payout_min}
                onChange={v => setForm({ ...form, payout_min: v })} />
              <div className="md:col-span-2">
                <label className="text-xs text-muted">Payout Caps (comma-separated, last value applies to all subsequent)</label>
                <input value={form.payout_caps || ''} onChange={e => setForm({ ...form, payout_caps: e.target.value })}
                  placeholder="e.g. 2000,2000,2000,2000,2500,3000"
                  className="w-full mt-1 bg-panel2 border border-border rounded px-2 py-1.5 text-sm num" />
              </div>
              <NumInput label="Max # Payouts (0 = unlimited)" value={form.max_payouts} integer
                onChange={v => setForm({ ...form, max_payouts: v })} />
              <NumInput label="Min Trading Days before payout" value={form.min_trading_days_before_payout} integer
                onChange={v => setForm({ ...form, min_trading_days_before_payout: v })} />
              <NumInput label="Min Days Between Payouts" value={form.min_days_between_payouts} integer
                onChange={v => setForm({ ...form, min_days_between_payouts: v })} />
              <div>
                <label className="text-xs text-muted">Consistency Rule %</label>
                <input type="number" step="0.01" value={(form.consistency_rule_pct ?? 0) * 100}
                  onChange={e => setForm({ ...form, consistency_rule_pct: (parseFloat(e.target.value) || 0) / 100 })}
                  className="w-full mt-1 bg-panel2 border border-border rounded px-2 py-1.5 text-sm num" />
                <div className="text-[10px] text-muted mt-0.5">Apex = 30 · TopStep = 50 · 0 = disabled</div>
              </div>
              <Select label="Payout Preference" value={form.payout_preference || 'max'} options={PAYOUT_PREFS}
                onChange={v => setForm({ ...form, payout_preference: v as any })} />
              {form.payout_preference === 'custom' && (
                <NumInput label="Custom Payout Amount $" value={form.payout_preference_amount}
                  onChange={v => setForm({ ...form, payout_preference_amount: v })} />
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-border space-y-3">
            <div className="text-xs text-muted uppercase tracking-wider">Contract Limits</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <NumInput label="Max Micro Contracts" value={form.contracts_micro_max} integer
                onChange={v => setForm({ ...form, contracts_micro_max: v })} />
              <NumInput label="Max Mini Contracts" value={form.contracts_mini_max} integer
                onChange={v => setForm({ ...form, contracts_mini_max: v })} />
            </div>
          </div>
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="text-sm text-muted px-3 py-1.5">Cancel</button>
        <button onClick={onSave} className="bg-accent text-bg text-sm px-4 py-1.5 rounded font-medium">Save</button>
      </div>
    </div>
  )
}

function BrokerBalanceInput({ accountId, value, updatedAt, onSaved }: {
  accountId: number
  value: number | null
  updatedAt: string | null | undefined
  onSaved: () => void
}) {
  const [text, setText] = useState<string>(value == null ? '' : String(value))
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSent = useRef<string>(value == null ? '' : String(value))

  // Sync local text when the prop changes (parent refresh) — but not mid-typing.
  useEffect(() => {
    const next = value == null ? '' : String(value)
    if (next !== lastSent.current) {
      setText(next)
      lastSent.current = next
    }
  }, [value])

  function scheduleSave(next: string) {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const trimmed = next.trim()
      const parsed = trimmed === '' ? null : parseFloat(trimmed)
      if (parsed !== null && Number.isNaN(parsed)) return  // ignore "-" mid-typing
      setStatus('saving')
      await api.accounts.update(accountId, { broker_balance: parsed } as any)
      lastSent.current = next
      setStatus('saved')
      onSaved()
      setTimeout(() => setStatus('idle'), 1200)
    }, 400)
  }

  return (
    <>
      <input type="number" step="0.01" value={text}
        placeholder="enter from broker"
        onChange={e => { setText(e.target.value); scheduleSave(e.target.value) }}
        className="w-full bg-bg border border-border rounded px-2 py-1 text-sm num focus:outline-none focus:border-accent" />
      <div className="text-[10px] text-muted mt-0.5 flex items-center justify-between">
        <span>{updatedAt ? `updated ${new Date(updatedAt).toLocaleString()}` : ''}</span>
        {status === 'saving' && <span className="text-accent">saving…</span>}
        {status === 'saved' && <span className="text-win">saved</span>}
      </div>
    </>
  )
}

function Cell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] text-muted uppercase tracking-wider">{label}</div>
      <div className="num font-medium">{value}</div>
      {sub && <div className="text-[10px] text-muted num">{sub}</div>}
    </div>
  )
}
function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-muted">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)}
        className="w-full mt-1 bg-panel2 border border-border rounded px-2 py-1.5 text-sm" />
    </div>
  )
}
function NumInput({ label, value, onChange, integer }: { label: string; value: any; onChange: (v: number) => void; integer?: boolean }) {
  return (
    <div>
      <label className="text-xs text-muted">{label}</label>
      <input type="number" step={integer ? 1 : 0.01} value={value ?? 0}
        onChange={e => onChange(integer ? parseInt(e.target.value) || 0 : parseFloat(e.target.value) || 0)}
        className="w-full mt-1 bg-panel2 border border-border rounded px-2 py-1.5 text-sm num" />
    </div>
  )
}
function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-muted">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full mt-1 bg-panel2 border border-border rounded px-2 py-1.5 text-sm">
        {options.map(o => <option key={o} value={o}>{o || '— none —'}</option>)}
      </select>
    </div>
  )
}
