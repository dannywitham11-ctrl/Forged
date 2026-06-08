import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, PlanSummary, TradingPlaybook, UserSettings, PropFirm, fmtUsd } from '../lib/api'

const ACCOUNT_GROUPS = ['pa', 'eval', 'all']

export default function Plan() {
  const [summary, setSummary] = useState<PlanSummary | null>(null)
  const [playbooks, setPlaybooks] = useState<TradingPlaybook[]>([])
  const [firms, setFirms] = useState<PropFirm[]>([])
  const [editingSettings, setEditingSettings] = useState(false)
  const [creatingPlaybook, setCreatingPlaybook] = useState(false)
  const [editingPlaybook, setEditingPlaybook] = useState<number | null>(null)

  async function refresh() {
    const [s, pbs, fs] = await Promise.all([api.plan.summary(), api.playbooks.list(), api.propFirms.list()])
    setSummary(s); setPlaybooks(pbs); setFirms(fs)
  }
  useEffect(() => { refresh() }, [])

  if (!summary) return <div className="p-6 text-muted">Loading…</div>

  return (
    <div className="p-6 space-y-6">
      <section className="bg-gradient-to-br from-panel to-panel2/30 border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted">Account Purchase Plan</div>
            <div className="text-sm font-semibold mt-0.5">Build a portfolio of funded accounts</div>
          </div>
          <button onClick={() => setEditingSettings(true)}
            className="text-xs text-accent hover:underline">Edit goals →</button>
        </div>
        {editingSettings ? (
          <SettingsEditor settings={summary.settings} firms={firms} playbooks={playbooks}
            onCancel={() => setEditingSettings(false)}
            onSave={async (data) => { await api.settings.update(data); setEditingSettings(false); refresh() }} />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Tile label="Target # PA accounts" value={String(summary.settings.target_pa_count || 0)} />
              <Tile label="Currently needed" value={String(summary.purchase_suggestion.needed)}
                tone={summary.purchase_suggestion.needed > 0 ? 'warn' : 'win'} />
              <Tile label="Monthly Budget" value={fmtUsd(summary.settings.monthly_budget)} />
              <Tile label="Monthly recurring (after)" value={fmtUsd(summary.purchase_suggestion.monthly_recurring_after)} />
              <Tile label="Affordable now" value={String(summary.purchase_suggestion.affordable_now)} tone="win" />
              <Tile label="Next purchase est." value={summary.purchase_suggestion.next_purchase_date
                ? new Date(summary.purchase_suggestion.next_purchase_date).toLocaleDateString() : '—'} />
              <Tile label="Preferred Firm" value={summary.purchase_suggestion.suggested_firm_key || '—'} />
              <Tile label="Preferred Plan" value={summary.purchase_suggestion.suggested_plan_key || '—'} />
            </div>
            {summary.purchase_suggestion.notes.length > 0 && (
              <ul className="text-xs text-muted space-y-1">
                {summary.purchase_suggestion.notes.map((n, i) => <li key={i}>• {n}</li>)}
              </ul>
            )}
          </>
        )}
      </section>

      <section className={`glass-panel hover-lift border rounded-lg p-5 ${summary.dd_alert_breached ? 'border-loss/60' : 'border-border'}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold">Drawdown Protection</div>
            <div className="text-xs text-muted">
              Alert threshold {fmtUsd(summary.settings.dd_alert_threshold)} ·
              today's aggregate P&L <span className={`num ${summary.aggregate_dd_today < 0 ? 'text-loss' : summary.aggregate_dd_today > 0 ? 'text-win' : 'text-muted'}`}>
                {fmtUsd(summary.aggregate_dd_today, { signed: true })}
              </span>
              {summary.dd_alert_breached && <span className="ml-2 text-loss font-semibold">⚠ BREACHED</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StricterCard title="PA Playbook" sug={summary.stricter_pa_suggestion} current={summary.pa_playbook} />
          <StricterCard title="Eval Playbook" sug={summary.stricter_eval_suggestion} current={summary.eval_playbook} />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold">Trading Playbooks</div>
            <div className="text-xs text-muted">Define contracts / stop / target for groups of accounts (PA, Eval, custom).</div>
          </div>
          {!creatingPlaybook && (
            <button onClick={() => setCreatingPlaybook(true)}
              className="bg-accent text-bg px-3 py-1.5 rounded text-sm">+ New Playbook</button>
          )}
        </div>
        {creatingPlaybook && (
          <PlaybookEditor pb={null}
            onSave={async (d) => { await api.playbooks.create(d); setCreatingPlaybook(false); refresh() }}
            onCancel={() => setCreatingPlaybook(false)} />
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          {playbooks.map(pb => editingPlaybook === pb.id ? (
            <PlaybookEditor key={pb.id} pb={pb}
              onSave={async (d) => { await api.playbooks.update(pb.id, d); setEditingPlaybook(null); refresh() }}
              onCancel={() => setEditingPlaybook(null)}
              onDelete={async () => { if (!confirm('Delete?')) return; await api.playbooks.delete(pb.id); setEditingPlaybook(null); refresh() }} />
          ) : (
            <div key={pb.id} className="glass-panel hover-lift border border-border rounded-lg p-4">
              <div className="flex items-baseline justify-between">
                <div className="font-semibold">{pb.name}</div>
                <span className="text-[10px] uppercase bg-panel2 px-1.5 py-0.5 rounded text-muted">{pb.account_group}</span>
              </div>
              {pb.description && <div className="text-xs text-muted mt-1">{pb.description}</div>}
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <Mini label="Contracts" value={String(pb.contracts)} />
                <Mini label="Stop" value={`${pb.stop_ticks}t`} />
                <Mini label="Target" value={`${pb.target_ticks}t`} />
                <Mini label="RR" value={(pb.target_ticks / pb.stop_ticks).toFixed(2) + 'R'} />
                {pb.max_trades_per_day > 0 && <Mini label="Max trades/day" value={String(pb.max_trades_per_day)} />}
                {pb.max_loss_per_day > 0 && <Mini label="Max loss/day" value={fmtUsd(pb.max_loss_per_day)} />}
              </div>
              <button onClick={() => setEditingPlaybook(pb.id)} className="text-xs text-accent mt-3 hover:underline">Edit</button>
            </div>
          ))}
          {!playbooks.length && !creatingPlaybook && (
            <div className="glass-panel hover-lift border border-border rounded-lg p-6 text-center text-sm text-muted md:col-span-2 lg:col-span-3">
              No playbooks yet. Create one and assign it to your PA or Eval group in the goals editor above.
            </div>
          )}
        </div>
      </section>

      {(() => {
        const live = summary.etas.filter(e => e.status !== 'blown' && e.status !== 'closed')
        const evals = live.filter(e => e.account_type === 'eval' || e.account_type === 'personal')
        const fundedPA = live.filter(e => e.account_type === 'pa' || e.account_type === 'funded')
        return (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <EtaSection
              title="Evals — Time to Funded"
              subtitle="Distance to profit target at recent daily P&L"
              accent="amber"
              rows={evals}
              kind="eval"
            />
            <EtaSection
              title="Funded / PA — Time to Payout"
              subtitle="Distance to next min / max payout"
              accent="green"
              rows={fundedPA}
              kind="funded"
            />
          </div>
        )
      })()}

      <div className="text-xs text-muted text-center">
        Predictions use your recent 10-day average daily P&L. Forecasts respect min-trading-day requirements and payout spacing rules.
        Refine with realistic playbooks (Trading Playbooks above) and adjust your <Link to="/accounts" className="text-accent hover:underline">account configs</Link> for accuracy.
      </div>
    </div>
  )
}

function EtaSection({ title, subtitle, accent, rows, kind }: {
  title: string; subtitle: string; accent: 'amber'|'green'; rows: any[]; kind: 'eval'|'funded'
}) {
  const headerColor = accent === 'amber' ? 'border-warn/40 bg-warn/5' : 'border-win/40 bg-win/5'
  return (
    <div className={`border rounded-lg overflow-hidden ${headerColor}`}>
      <div className="px-4 py-3 border-b border-border">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-[11px] text-muted">{subtitle}</div>
      </div>
      <div className="overflow-x-auto bg-panel">
        <table className="w-full text-sm">
          <thead className="bg-panel2 text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2 text-left">Account</th>
              <th className="px-3 py-2 text-right">Equity</th>
              <th className="px-3 py-2 text-right">Avg/day</th>
              {kind === 'eval' ? (
                <th className="px-3 py-2 text-right">→ Funded</th>
              ) : (
                <>
                  <th className="px-3 py-2 text-right">→ Min Payout</th>
                  <th className="px-3 py-2 text-right">→ Max Payout</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map(e => (
              <tr key={e.account_id} className="border-t border-border">
                <td className="px-3 py-2">
                  <div className="font-medium">{e.display_name}</div>
                  <div className="text-[10px] text-muted">
                    {e.prop_firm || e.account_type}
                    <span className={`ml-2 uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      e.status === 'blown' ? 'bg-loss/20 text-loss' :
                      e.status === 'funded' || e.status === 'paid_out' ? 'bg-win/20 text-win' :
                      'bg-panel2 text-muted'}`}>{e.status}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right num">
                  {fmtUsd(e.current_equity)}
                  {e.uses_broker_balance && (
                    <span className="ml-1 text-[9px] uppercase tracking-wider bg-accent/15 text-accent px-1 py-0.5 rounded">broker</span>
                  )}
                </td>
                <td className={`px-3 py-2 text-right num ${e.recent_avg_daily_pnl > 0 ? 'text-win' : e.recent_avg_daily_pnl < 0 ? 'text-loss' : 'text-muted'}`}>
                  {fmtUsd(e.recent_avg_daily_pnl, { signed: true })}
                </td>
                {kind === 'eval' ? (
                  <td className="px-3 py-2 text-right text-xs">
                    <EtaCell days={e.days_to_funded} date={e.eta_funded_date} blocked={e.blocked_reason} />
                  </td>
                ) : (
                  <>
                    <td className="px-3 py-2 text-right text-xs">
                      <EtaCell days={e.days_to_min_payout} date={e.eta_min_payout_date} blocked={e.blocked_reason}
                        sub={fmtUsd(e.min_payout_amount)} />
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      <EtaCell days={e.days_to_max_payout} date={e.eta_max_payout_date} blocked={e.blocked_reason}
                        sub={fmtUsd(e.max_payout_amount)} />
                    </td>
                  </>
                )}
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={kind === 'eval' ? 4 : 5} className="px-3 py-6 text-center text-muted">
                {kind === 'eval' ? 'No eval accounts. Mark an account type as "eval" to track time-to-funded.' : 'No funded/PA accounts yet.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Tile({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'win'|'loss'|'warn'|'neutral' }) {
  const c = tone === 'win' ? 'text-win' : tone === 'loss' ? 'text-loss' : tone === 'warn' ? 'text-warn' : 'text-text'
  return (
    <div className="glass-panel hover-lift border border-border rounded-lg p-3">
      <div className="text-[10px] text-muted uppercase tracking-wider">{label}</div>
      <div className={`num font-semibold mt-1 ${c}`}>{value}</div>
    </div>
  )
}
function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-muted uppercase">{label}</div>
      <div className="num font-semibold">{value}</div>
    </div>
  )
}
function EtaCell({ days, date, blocked, sub }: { days: number | null; date: string | null; blocked: string | null; sub?: string }) {
  if (blocked) return <span className="text-loss">{blocked}</span>
  if (days == null) return <span className="text-muted">—</span>
  if (days === 0) return <span className="text-win">today</span>
  return (
    <div>
      <div className="num text-text">{days}d</div>
      {date && <div className="text-[10px] text-muted">{new Date(date).toLocaleDateString()}</div>}
      {sub && <div className="text-[10px] text-muted">{sub}</div>}
    </div>
  )
}

function StricterCard({ title, sug, current }: { title: string; sug: any; current: any }) {
  if (!current) {
    return (
      <div className="bg-panel2/40 border border-border rounded-lg p-4">
        <div className="text-xs font-semibold mb-1">{title}</div>
        <div className="text-xs text-muted">No playbook assigned. Create one below and link it in the goals editor.</div>
      </div>
    )
  }
  return (
    <div className={`border rounded-lg p-4 ${sug.triggered ? 'border-loss/40 bg-loss/5' : 'border-border bg-panel2/40'}`}>
      <div className="text-xs font-semibold mb-2">{title}: <span className="text-accent">{current.name}</span></div>
      <div className="grid grid-cols-3 gap-2 text-xs mb-2">
        <Mini label="Current contracts" value={String(current.contracts)} />
        <Mini label="Stop" value={`${current.stop_ticks}t`} />
        <Mini label="Target" value={`${current.target_ticks}t (${(current.target_ticks/current.stop_ticks).toFixed(1)}R)`} />
      </div>
      {sug.triggered ? (
        <div className="mt-3 pt-3 border-t border-loss/30">
          <div className="text-xs font-semibold text-loss">Suggested stricter setup →</div>
          <div className="grid grid-cols-3 gap-2 text-xs mt-2">
            <Mini label="Contracts" value={String(sug.suggested_contracts)} />
            <Mini label="Stop" value={`${sug.suggested_stop_ticks}t`} />
            <Mini label="Target" value={`${sug.suggested_target_ticks}t`} />
          </div>
          <div className="text-[11px] text-muted mt-2">{sug.explanation}</div>
        </div>
      ) : (
        <div className="text-[11px] text-muted mt-2">Drawdown alert not breached — keep trading the current playbook.</div>
      )}
    </div>
  )
}

function SettingsEditor({ settings, firms, playbooks, onSave, onCancel }: {
  settings: UserSettings; firms: PropFirm[]; playbooks: TradingPlaybook[];
  onSave: (d: any) => void; onCancel: () => void
}) {
  const [f, setF] = useState({ ...settings })
  const firm = firms.find(x => x.key === f.preferred_firm_key)
  return (
    <div className="bg-panel2/40 border border-accent/40 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Target # PA accounts">
          <input type="number" value={f.target_pa_count || 0} onChange={e => setF({ ...f, target_pa_count: parseInt(e.target.value) || 0 })}
            className="w-full mt-1 bg-bg border border-border rounded px-2 py-1.5 text-sm num" />
        </Field>
        <Field label="Monthly Budget $">
          <input type="number" step="0.01" value={f.monthly_budget || 0} onChange={e => setF({ ...f, monthly_budget: parseFloat(e.target.value) || 0 })}
            className="w-full mt-1 bg-bg border border-border rounded px-2 py-1.5 text-sm num" />
        </Field>
        <Field label="DD Alert Threshold $ (negative)">
          <input type="number" step="0.01" value={f.dd_alert_threshold || 0} onChange={e => setF({ ...f, dd_alert_threshold: parseFloat(e.target.value) || 0 })}
            className="w-full mt-1 bg-bg border border-border rounded px-2 py-1.5 text-sm num" />
        </Field>
        <Field label="Timezone (for date bucketing)">
          <select value={f.timezone || 'UTC'} onChange={e => setF({ ...f, timezone: e.target.value })}
            className="w-full mt-1 bg-bg border border-border rounded px-2 py-1.5 text-sm">
            <option value="UTC">UTC</option>
            <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
            <option value="Australia/Adelaide">Australia/Adelaide (ACST/ACDT)</option>
            <option value="Australia/Perth">Australia/Perth (AWST)</option>
            <option value="America/New_York">America/New_York (ET)</option>
            <option value="America/Chicago">America/Chicago (CT)</option>
            <option value="America/Los_Angeles">America/Los_Angeles (PT)</option>
            <option value="Europe/London">Europe/London</option>
            <option value="Europe/Berlin">Europe/Berlin</option>
            <option value="Asia/Tokyo">Asia/Tokyo</option>
            <option value="Asia/Singapore">Asia/Singapore</option>
          </select>
        </Field>
        <Field label="Date By">
          <select value={f.date_by || 'exit'} onChange={e => setF({ ...f, date_by: e.target.value as any })}
            className="w-full mt-1 bg-bg border border-border rounded px-2 py-1.5 text-sm">
            <option value="exit">Exit time (broker convention)</option>
            <option value="entry">Entry time</option>
          </select>
        </Field>
        <Field label="Default Firm (auto-applied to new imports)">
          <select value={f.preferred_firm_key || ''} onChange={e => setF({ ...f, preferred_firm_key: e.target.value || null, preferred_plan_key: null })}
            className="w-full mt-1 bg-bg border border-border rounded px-2 py-1.5 text-sm">
            <option value="">—</option>
            {firms.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
        </Field>
        <Field label="Default Plan">
          <select value={f.preferred_plan_key || ''} onChange={e => setF({ ...f, preferred_plan_key: e.target.value || null })}
            disabled={!firm}
            className="w-full mt-1 bg-bg border border-border rounded px-2 py-1.5 text-sm">
            <option value="">—</option>
            {firm?.plans.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="PA Playbook">
          <select value={f.pa_playbook_id || ''} onChange={e => setF({ ...f, pa_playbook_id: e.target.value ? Number(e.target.value) : null })}
            className="w-full mt-1 bg-bg border border-border rounded px-2 py-1.5 text-sm">
            <option value="">—</option>
            {playbooks.map(pb => <option key={pb.id} value={pb.id}>{pb.name}</option>)}
          </select>
        </Field>
        <Field label="Eval Playbook">
          <select value={f.eval_playbook_id || ''} onChange={e => setF({ ...f, eval_playbook_id: e.target.value ? Number(e.target.value) : null })}
            className="w-full mt-1 bg-bg border border-border rounded px-2 py-1.5 text-sm">
            <option value="">—</option>
            {playbooks.map(pb => <option key={pb.id} value={pb.id}>{pb.name}</option>)}
          </select>
        </Field>
      </div>
      <div className="text-[11px] text-muted bg-panel/50 border border-border rounded p-2">
        💡 When set, the default firm + plan is applied automatically to every new account created from a Sierra upload.
        Existing accounts aren't touched — use the bulk-apply button on the Prop Firms page to update those in one shot.
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="text-muted text-sm px-3 py-1.5">Cancel</button>
        <button onClick={() => onSave(f)} className="bg-accent text-bg px-4 py-1.5 rounded text-sm font-medium">Save</button>
      </div>
    </div>
  )
}

function PlaybookEditor({ pb, onSave, onCancel, onDelete }: {
  pb: TradingPlaybook | null; onSave: (d: any) => void; onCancel: () => void; onDelete?: () => void
}) {
  const [f, setF] = useState({
    name: pb?.name || '', description: pb?.description || '',
    account_group: pb?.account_group || 'pa',
    contracts: pb?.contracts ?? 4, stop_ticks: pb?.stop_ticks ?? 10, target_ticks: pb?.target_ticks ?? 30,
    risk_dollars: pb?.risk_dollars ?? 0,
    max_trades_per_day: pb?.max_trades_per_day ?? 0, max_loss_per_day: pb?.max_loss_per_day ?? 0,
  })
  return (
    <div className="glass-panel hover-lift border border-accent/40 rounded-lg p-4 space-y-3 md:col-span-2 lg:col-span-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Name"><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })}
          className="w-full mt-1 bg-bg border border-border rounded px-2 py-1.5 text-sm" /></Field>
        <Field label="Account Group">
          <select value={f.account_group} onChange={e => setF({ ...f, account_group: e.target.value })}
            className="w-full mt-1 bg-bg border border-border rounded px-2 py-1.5 text-sm">
            {ACCOUNT_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="Description"><input value={f.description} onChange={e => setF({ ...f, description: e.target.value })}
          className="w-full mt-1 bg-bg border border-border rounded px-2 py-1.5 text-sm" /></Field>
        <Field label="Contracts"><input type="number" value={f.contracts} onChange={e => setF({ ...f, contracts: parseInt(e.target.value) || 0 })}
          className="w-full mt-1 bg-bg border border-border rounded px-2 py-1.5 text-sm num" /></Field>
        <Field label="Stop Ticks"><input type="number" value={f.stop_ticks} onChange={e => setF({ ...f, stop_ticks: parseInt(e.target.value) || 0 })}
          className="w-full mt-1 bg-bg border border-border rounded px-2 py-1.5 text-sm num" /></Field>
        <Field label="Target Ticks"><input type="number" value={f.target_ticks} onChange={e => setF({ ...f, target_ticks: parseInt(e.target.value) || 0 })}
          className="w-full mt-1 bg-bg border border-border rounded px-2 py-1.5 text-sm num" /></Field>
        <Field label="Max Trades / day"><input type="number" value={f.max_trades_per_day} onChange={e => setF({ ...f, max_trades_per_day: parseInt(e.target.value) || 0 })}
          className="w-full mt-1 bg-bg border border-border rounded px-2 py-1.5 text-sm num" /></Field>
        <Field label="Max Loss / day $"><input type="number" step="0.01" value={f.max_loss_per_day} onChange={e => setF({ ...f, max_loss_per_day: parseFloat(e.target.value) || 0 })}
          className="w-full mt-1 bg-bg border border-border rounded px-2 py-1.5 text-sm num" /></Field>
      </div>
      <div className="flex justify-between gap-2">
        {onDelete && <button onClick={onDelete} className="text-loss/80 text-sm px-3 py-1.5">Delete</button>}
        <div className="ml-auto flex gap-2">
          <button onClick={onCancel} className="text-muted text-sm px-3 py-1.5">Cancel</button>
          <button onClick={() => onSave(f)} className="bg-accent text-bg px-4 py-1.5 rounded text-sm font-medium">Save</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: any }) {
  return <div><label className="text-xs text-muted">{label}</label>{children}</div>
}
