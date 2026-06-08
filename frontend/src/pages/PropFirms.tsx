import { useEffect, useState } from 'react'
import { api, PropFirm, PropFirmPlan, Account, fmtUsd } from '../lib/api'

const DD_MODES = ['none', 'static', 'trailing_eod', 'trailing_realtime']

type BulkMode = 'single' | 'all_unassigned' | 'all_evals' | 'all_pas' | 'all'

export default function PropFirms({ accounts, onChange }: { accounts: Account[]; onChange: () => void }) {
  const [firms, setFirms] = useState<PropFirm[]>([])
  const [addingFirm, setAddingFirm] = useState(false)
  const [editingFirm, setEditingFirm] = useState<number | null>(null)
  const [addingPlanFor, setAddingPlanFor] = useState<number | null>(null)
  const [editingPlan, setEditingPlan] = useState<number | null>(null)
  const [openPlan, setOpenPlan] = useState<{ firm: string; plan: string } | null>(null)
  const [pickAcct, setPickAcct] = useState<number | null>(null)
  const [bulkMode, setBulkMode] = useState<BulkMode>('single')

  async function refresh() { setFirms(await api.propFirms.list()) }
  useEffect(() => { refresh() }, [])

  async function applyTo(acctId: number, firm: string, plan: string) {
    await api.accounts.applyPreset(acctId, firm, plan)
    onChange(); setOpenPlan(null); setPickAcct(null)
    alert('Preset applied — go to Accounts to verify or tweak.')
  }

  async function bulkApply(firmKey: string, planKey: string, mode: BulkMode) {
    const filter: any = { firm_key: firmKey, plan_key: planKey, exclude_blown: true, exclude_closed: true }
    if (mode === 'all_unassigned') filter.only_unassigned = true
    if (mode === 'all_evals') filter.account_type = 'eval'
    if (mode === 'all_pas') filter.account_type = 'pa'
    const count = countTargets(accounts, mode)
    if (count === 0) { alert('No matching accounts.'); return }
    if (!confirm(`Apply this preset to ${count} account${count !== 1 ? 's' : ''}? Existing settings will be overwritten.`)) return
    const r = await api.accounts.bulkApplyPreset(filter)
    setOpenPlan(null); onChange()
    alert(`Applied to ${r.updated} account${r.updated !== 1 ? 's' : ''}.`)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="bg-panel border border-border rounded-lg p-4 flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="text-sm font-semibold mb-1">Prop Firms</div>
          <div className="text-xs text-muted">
            Pre-seeded with Apex Intraday, Apex EOD, TakeProfit Trader, Lucid Trading, and TopStep.
            Edit any value, add your own firms or plans, or click <em>Apply to account →</em> to push a plan onto one of your accounts.
            All values are stored in your local DB — overwrites are persistent.
          </div>
        </div>
        <button onClick={() => setAddingFirm(true)}
          className="bg-accent text-bg px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap">+ Add Firm</button>
      </div>

      {addingFirm && (
        <FirmEditor firm={null}
          onSave={async (data) => { await api.propFirms.create(data); setAddingFirm(false); refresh() }}
          onCancel={() => setAddingFirm(false)} />
      )}

      {firms.map(firm => (
        <div key={firm.id} className="bg-panel border border-border rounded-lg overflow-hidden">
          {editingFirm === firm.id ? (
            <FirmEditor firm={firm}
              onSave={async (data) => { await api.propFirms.update(firm.id, data); setEditingFirm(null); refresh() }}
              onCancel={() => setEditingFirm(null)} />
          ) : (
            <div className="p-4 border-b border-border flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold">{firm.label}</div>
                  {firm.is_custom && <span className="text-[10px] uppercase tracking-wider bg-accent/20 text-accent px-1.5 py-0.5 rounded">custom</span>}
                </div>
                <div className="text-xs text-muted mt-0.5">
                  {firm.default_drawdown_mode.replace('_', ' ')} drawdown ·
                  consistency {Math.round(firm.default_consistency_rule_pct * 100)}% ·
                  min {firm.default_min_trading_days_before_payout} trading days ·
                  min payout {fmtUsd(firm.default_payout_min)}
                  {firm.verified_at && <span className="ml-2 opacity-50">verified {firm.verified_at}</span>}
                </div>
                {firm.notes && <div className="text-[11px] text-warn/80 mt-1">{firm.notes}</div>}
              </div>
              <div className="flex gap-2 shrink-0">
                {firm.website && <a href={firm.website} target="_blank" rel="noreferrer"
                  className="text-xs text-accent hover:underline">website ↗</a>}
                <button onClick={() => setEditingFirm(firm.id)} className="text-xs text-muted hover:text-text">Edit</button>
                {firm.is_custom && (
                  <button onClick={async () => {
                    if (!confirm(`Delete ${firm.label} and all its plans?`)) return
                    await api.propFirms.delete(firm.id); refresh()
                  }} className="text-xs text-loss/80 hover:text-loss">Delete</button>
                )}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
            {firm.plans.map(p => {
              const isOpen = openPlan?.firm === firm.key && openPlan?.plan === p.key
              if (editingPlan === p.id) {
                return <PlanEditor key={p.id} plan={p}
                  onSave={async (data) => { await api.propFirms.updatePlan(p.id, data); setEditingPlan(null); refresh() }}
                  onDelete={async () => {
                    if (!confirm(`Delete plan ${p.label}?`)) return
                    await api.propFirms.deletePlan(p.id); setEditingPlan(null); refresh()
                  }}
                  onCancel={() => setEditingPlan(null)} />
              }
              const caps = p.payout_caps ? p.payout_caps.split(',').map(s => s.trim()) : []
              return (
                <div key={p.id} className={`border rounded-lg p-3 ${isOpen ? 'border-accent/60 bg-panel2/40' : 'border-border bg-panel2/20'}`}>
                  <div className="flex items-baseline justify-between">
                    <div className="font-semibold">{p.label}</div>
                    <div className="text-xs num text-muted">{fmtUsd(p.account_size)}</div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                    <Row label="Profit Target" value={fmtUsd(p.profit_target)} />
                    <Row label="Max Drawdown" value={fmtUsd(p.max_drawdown)} />
                    <Row label="Safety Net" value={`+${fmtUsd(p.safety_net_amount)}`} />
                    <Row label="Contracts" value={`${p.contracts_micro} micro / ${p.contracts_mini} mini`} />
                    <Row label="Payout Caps" value={caps.join(' / ') || '—'} mono />
                    <Row label="Eval Sub" value={`${fmtUsd(p.eval_cost_monthly)}/mo`} />
                    <Row label="Activation" value={fmtUsd(p.activation_fee)} />
                    <Row label="Reset" value={fmtUsd(p.reset_fee)} />
                    {p.drawdown_mode_override && <Row label="DD Mode (override)" value={p.drawdown_mode_override} />}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => {
                      setOpenPlan({ firm: firm.key, plan: p.key })
                      setPickAcct(accounts[0]?.id ?? null)
                      setBulkMode('single')
                    }}
                      className="text-xs bg-accent text-bg px-3 py-1 rounded font-medium hover:opacity-90">
                      Apply →
                    </button>
                    <button onClick={() => setEditingPlan(p.id)}
                      className="text-xs text-muted hover:text-text px-2">Edit</button>
                  </div>
                  {isOpen && (
                    <div className="mt-3 pt-3 border-t border-border space-y-2">
                      <div className="text-[11px] text-muted">Apply to…</div>
                      <div className="grid grid-cols-2 gap-1">
                        {([
                          ['single', `1 account`, 1],
                          ['all_unassigned', `Unassigned`, accounts.filter(a => !a.prop_firm_key && a.status !== 'blown').length],
                          ['all_evals', `All evals`, accounts.filter(a => a.account_type === 'eval' && a.status !== 'blown').length],
                          ['all_pas', `All PA / funded`, accounts.filter(a => (a.account_type === 'pa' || a.account_type === 'funded') && a.status !== 'blown').length],
                          ['all', `Every non-blown`, accounts.filter(a => a.status !== 'blown').length],
                        ] as Array<[BulkMode, string, number]>).map(([key, label, count]) => (
                          <button key={key} onClick={() => setBulkMode(key)} disabled={count === 0}
                            className={`text-xs px-2 py-1 rounded border text-left ${
                              bulkMode === key
                                ? 'bg-accent/15 border-accent/60 text-accent'
                                : 'bg-bg border-border text-muted hover:text-text'
                            } disabled:opacity-30`}>
                            <div className="font-medium">{label}</div>
                            <div className="text-[10px] opacity-70">{count} account{count !== 1 ? 's' : ''}</div>
                          </button>
                        ))}
                      </div>
                      {bulkMode === 'single' && (
                        <select value={pickAcct ?? ''} onChange={e => setPickAcct(Number(e.target.value))}
                          className="w-full bg-bg border border-border rounded px-2 py-1 text-sm">
                          {accounts.map(a => <option key={a.id} value={a.id}>{a.display_name}</option>)}
                        </select>
                      )}
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => {
                          if (bulkMode === 'single') {
                            if (pickAcct) applyTo(pickAcct, firm.key, p.key)
                          } else {
                            bulkApply(firm.key, p.key, bulkMode)
                          }
                        }}
                          disabled={bulkMode === 'single' && !pickAcct}
                          className="text-xs bg-accent text-bg px-3 py-1.5 rounded font-medium disabled:opacity-30">
                          {bulkMode === 'single' ? 'Apply' : 'Bulk Apply'}
                        </button>
                        <button onClick={() => setOpenPlan(null)} className="text-xs text-muted px-2">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {addingPlanFor === firm.id ? (
              <PlanEditor plan={null}
                onSave={async (data) => { await api.propFirms.addPlan(firm.id, data); setAddingPlanFor(null); refresh() }}
                onCancel={() => setAddingPlanFor(null)} />
            ) : (
              <button onClick={() => setAddingPlanFor(firm.id)}
                className="border-2 border-dashed border-border rounded-lg p-3 text-sm text-muted hover:border-accent/40 hover:text-text transition">
                + Add Plan
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function countTargets(accounts: Account[], mode: BulkMode): number {
  const live = accounts.filter(a => a.status !== 'blown')
  if (mode === 'single') return 1
  if (mode === 'all_unassigned') return live.filter(a => !a.prop_firm_key).length
  if (mode === 'all_evals') return live.filter(a => a.account_type === 'eval').length
  if (mode === 'all_pas') return live.filter(a => a.account_type === 'pa' || a.account_type === 'funded').length
  return live.length
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <div className="text-muted">{label}</div>
      <div className={`text-right ${mono ? 'num text-[10px]' : ''}`}>{value}</div>
    </>
  )
}

function FirmEditor({ firm, onSave, onCancel }: { firm: PropFirm | null; onSave: (d: any) => void; onCancel: () => void }) {
  const [f, setF] = useState({
    key: firm?.key || '',
    label: firm?.label || '',
    website: firm?.website || '',
    default_drawdown_mode: firm?.default_drawdown_mode || 'trailing_realtime',
    default_consistency_rule_pct: firm?.default_consistency_rule_pct ?? 0.3,
    default_min_trading_days_before_payout: firm?.default_min_trading_days_before_payout ?? 5,
    default_payout_min: firm?.default_payout_min ?? 500,
    notes: firm?.notes || '',
    verified_at: firm?.verified_at || '2026-01',
  })
  return (
    <div className="bg-panel2/40 border border-accent/40 rounded-lg p-5 space-y-3">
      <div className="text-sm font-semibold">{firm ? `Edit ${firm.label}` : 'Add Firm'}</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Key (unique)"><input value={f.key} onChange={e => setF({ ...f, key: e.target.value })}
          className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm" /></Field>
        <Field label="Label"><input value={f.label} onChange={e => setF({ ...f, label: e.target.value })}
          className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm" /></Field>
        <Field label="Website"><input value={f.website} onChange={e => setF({ ...f, website: e.target.value })}
          className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm" /></Field>
        <Field label="Default DD Mode">
          <select value={f.default_drawdown_mode} onChange={e => setF({ ...f, default_drawdown_mode: e.target.value })}
            className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm">
            {DD_MODES.map(m => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Consistency %">
          <input type="number" step="0.01" value={f.default_consistency_rule_pct * 100}
            onChange={e => setF({ ...f, default_consistency_rule_pct: (parseFloat(e.target.value) || 0) / 100 })}
            className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm num" />
        </Field>
        <Field label="Min Trading Days">
          <input type="number" value={f.default_min_trading_days_before_payout}
            onChange={e => setF({ ...f, default_min_trading_days_before_payout: parseInt(e.target.value) || 0 })}
            className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm num" />
        </Field>
        <Field label="Min Payout $">
          <input type="number" step="0.01" value={f.default_payout_min}
            onChange={e => setF({ ...f, default_payout_min: parseFloat(e.target.value) || 0 })}
            className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm num" />
        </Field>
        <Field label="Verified at">
          <input value={f.verified_at} onChange={e => setF({ ...f, verified_at: e.target.value })}
            placeholder="2026-01" className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm" />
        </Field>
      </div>
      <div>
        <label className="text-xs text-muted">Notes</label>
        <textarea value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} rows={2}
          className="w-full mt-1 bg-bg border border-border rounded px-2 py-1.5 text-sm font-sans" />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="text-muted text-sm px-3 py-1.5">Cancel</button>
        <button onClick={() => onSave(f)} className="bg-accent text-bg px-4 py-1.5 rounded text-sm font-medium">Save</button>
      </div>
    </div>
  )
}

function PlanEditor({ plan, onSave, onCancel, onDelete }: { plan: PropFirmPlan | null; onSave: (d: any) => void; onCancel: () => void; onDelete?: () => void }) {
  const [p, setP] = useState({
    key: plan?.key || '',
    label: plan?.label || '',
    account_size: plan?.account_size ?? 50000,
    profit_target: plan?.profit_target ?? 3000,
    max_drawdown: plan?.max_drawdown ?? 2500,
    drawdown_mode_override: plan?.drawdown_mode_override || '',
    safety_net_amount: plan?.safety_net_amount ?? 0,
    payout_caps: plan?.payout_caps ?? '',
    max_payouts: plan?.max_payouts ?? 0,
    contracts_micro: plan?.contracts_micro ?? 0,
    contracts_mini: plan?.contracts_mini ?? 0,
    eval_cost_monthly: plan?.eval_cost_monthly ?? 0,
    activation_fee: plan?.activation_fee ?? 0,
    reset_fee: plan?.reset_fee ?? 0,
    notes: plan?.notes ?? '',
  })
  return (
    <div className="bg-panel2/40 border border-accent/40 rounded-lg p-3 md:col-span-2 xl:col-span-3 space-y-3">
      <div className="text-sm font-semibold">{plan ? `Edit ${plan.label}` : 'Add Plan'}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Field label="Key"><Input v={p.key} on={v => setP({ ...p, key: v })} /></Field>
        <Field label="Label"><Input v={p.label} on={v => setP({ ...p, label: v })} /></Field>
        <Field label="Account Size $"><NumI v={p.account_size} on={v => setP({ ...p, account_size: v })} /></Field>
        <Field label="Profit Target $"><NumI v={p.profit_target} on={v => setP({ ...p, profit_target: v })} /></Field>
        <Field label="Max Drawdown $"><NumI v={p.max_drawdown} on={v => setP({ ...p, max_drawdown: v })} /></Field>
        <Field label="Safety Net $"><NumI v={p.safety_net_amount} on={v => setP({ ...p, safety_net_amount: v })} /></Field>
        <Field label="DD Mode Override">
          <select value={p.drawdown_mode_override} onChange={e => setP({ ...p, drawdown_mode_override: e.target.value })}
            className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm">
            <option value="">use firm default</option>
            {DD_MODES.map(m => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Max # Payouts (0=∞)"><NumI v={p.max_payouts} on={v => setP({ ...p, max_payouts: v })} int /></Field>
        <Field label="Contracts Micro"><NumI v={p.contracts_micro} on={v => setP({ ...p, contracts_micro: v })} int /></Field>
        <Field label="Contracts Mini"><NumI v={p.contracts_mini} on={v => setP({ ...p, contracts_mini: v })} int /></Field>
        <Field label="Eval Sub $/mo"><NumI v={p.eval_cost_monthly} on={v => setP({ ...p, eval_cost_monthly: v })} /></Field>
        <Field label="Activation $"><NumI v={p.activation_fee} on={v => setP({ ...p, activation_fee: v })} /></Field>
        <Field label="Reset $"><NumI v={p.reset_fee} on={v => setP({ ...p, reset_fee: v })} /></Field>
      </div>
      <Field label="Payout Caps (CSV, last value repeats)">
        <Input v={p.payout_caps} on={v => setP({ ...p, payout_caps: v })} placeholder="2000,2000,2000,2000,2500,3000" />
      </Field>
      <div className="flex justify-between gap-2">
        {onDelete && <button onClick={onDelete} className="text-loss/80 text-sm px-3 py-1.5">Delete</button>}
        <div className="ml-auto flex gap-2">
          <button onClick={onCancel} className="text-muted text-sm px-3 py-1.5">Cancel</button>
          <button onClick={() => onSave(p)} className="bg-accent text-bg px-4 py-1.5 rounded text-sm font-medium">Save</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: any }) {
  return <div><label className="text-xs text-muted">{label}</label>{children}</div>
}
function Input({ v, on, placeholder }: { v: string; on: (v: string) => void; placeholder?: string }) {
  return <input value={v} onChange={e => on(e.target.value)} placeholder={placeholder}
    className="w-full mt-1 bg-bg border border-border rounded px-2 py-1.5 text-sm" />
}
function NumI({ v, on, int }: { v: any; on: (v: number) => void; int?: boolean }) {
  return <input type="number" step={int ? 1 : 0.01} value={v ?? 0}
    onChange={e => on(int ? parseInt(e.target.value) || 0 : parseFloat(e.target.value) || 0)}
    className="w-full mt-1 bg-bg border border-border rounded px-2 py-1.5 text-sm num" />
}
