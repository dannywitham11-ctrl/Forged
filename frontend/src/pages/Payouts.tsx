import { useEffect, useState } from 'react'
import { api, Account, Payout, PropStatus, fmtUsd } from '../lib/api'
import PayoutForecastWidget from '../components/PayoutForecast'
import PayoutsCalendar from '../components/PayoutsCalendar'

export default function Payouts({ accounts }: { accounts: Account[] }) {
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [statuses, setStatuses] = useState<Record<number, PropStatus>>({})
  const [creating, setCreating] = useState(false)

  // Only PA / funded accounts that aren't blown can take payouts.
  const payoutAccounts = accounts.filter(a =>
    (a.account_type === 'pa' || a.account_type === 'funded') && a.status !== 'blown' && a.status !== 'closed'
  )

  const [form, setForm] = useState({
    account_id: payoutAccounts[0]?.id || 0,
    payout_date: new Date().toISOString().slice(0, 10),
    amount: 0,
    notes: '',
  })

  async function refresh() {
    setPayouts(await api.payouts.list())
    Promise.all(payoutAccounts.map(a => api.accounts.propStatus(a.id))).then(rows => {
      const m: Record<number, PropStatus> = {}
      rows.forEach(r => { m[r.account_id] = r })
      setStatuses(m)
    })
  }
  useEffect(() => { refresh() }, [payoutAccounts.map(a => a.id).join(',')]) // eslint-disable-line

  async function create() {
    if (!form.account_id || !form.amount) return
    await api.payouts.create({
      account_id: form.account_id,
      payout_date: new Date(form.payout_date).toISOString(),
      amount: form.amount,
      notes: form.notes || undefined,
    })
    setForm({ ...form, amount: 0, notes: '' }); setCreating(false); refresh()
  }
  async function remove(id: number) {
    if (!confirm('Delete this payout?')) return
    await api.payouts.delete(id); refresh()
  }

  const acctMap = Object.fromEntries(accounts.map(a => [a.id, a]))
  const visibleAccountIds = new Set(payoutAccounts.map(a => a.id))
  const visiblePayouts = payouts.filter(p => visibleAccountIds.has(p.account_id))
  const totalPaid = visiblePayouts.reduce((acc, p) => acc + p.amount, 0)
  const totalByAccount = visiblePayouts.reduce((acc, p) => {
    acc[p.account_id] = (acc[p.account_id] || 0) + p.amount
    return acc
  }, {} as Record<number, number>)

  return (
    <div className="p-6 space-y-6">
      <PayoutForecastWidget />

      <PayoutsCalendar accounts={accounts} />

      <div>
        <div className="text-sm font-semibold mb-3">Upcoming Payouts</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.values(statuses).filter(s => s.payout_max_for_next > 0 || s.payout_min > 0).map(s => (
            <div key={s.account_id} className={`glass-panel hover-lift border rounded-lg p-4 ${s.eligible_for_payout ? 'border-accent/60' : 'border-border'}`}>
              <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                <div className="text-sm font-medium">{acctMap[s.account_id]?.display_name}</div>
                <div className="flex gap-1.5">
                  {s.is_final_payout && <span className="text-[10px] uppercase bg-warn/20 text-warn px-1.5 py-0.5 rounded">FINAL TIER</span>}
                  {s.eligible_for_payout && <span className="text-[10px] uppercase bg-accent/20 text-accent px-1.5 py-0.5 rounded">Ready</span>}
                </div>
              </div>
              <div className="text-xs text-muted">
                {s.prop_firm} · {s.account_type} · payout #{s.next_payout_number}
                {s.max_payouts > 0 && ` of ${s.max_payouts}`}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[10px] text-muted uppercase">Est. Date</div>
                  <div className="font-semibold">{s.predicted_next_payout_date ? new Date(s.predicted_next_payout_date).toLocaleDateString() : '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted uppercase">Next Payout Amount</div>
                  <div className="font-semibold num text-accent">{fmtUsd(s.payout_amount_for_next)}</div>
                  <div className="text-[9px] text-muted">cap {fmtUsd(s.payout_max_for_next)} · min {fmtUsd(s.payout_min)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted uppercase">
                    {s.is_final_payout ? 'Required Post-Balance (final)' : 'Required Post-Balance'}
                  </div>
                  <div className="num">{fmtUsd(s.safety_net_balance)}</div>
                  <div className="text-[9px] text-muted">
                    start + firm SN{s.is_final_payout ? '' : ` + buffer ${fmtUsd(s.extra_safety_buffer)}`}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted uppercase">Distance to Payout</div>
                  <div className="num">{fmtUsd(s.distance_to_next_payout)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted uppercase">Avg/day (recent)</div>
                  <div className={`num ${s.avg_daily_pnl_recent > 0 ? 'text-win' : s.avg_daily_pnl_recent < 0 ? 'text-loss' : 'text-muted'}`}>
                    {fmtUsd(s.avg_daily_pnl_recent, { signed: true })}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted uppercase">Trading days</div>
                  <div className="num">{s.trading_days_used}{s.min_trading_days_before_payout > 0 ? `/${s.min_trading_days_before_payout}` : ''}</div>
                </div>
              </div>
              {s.eligibility_reason && (
                <div className="text-[10px] text-warn mt-2">⚠ {s.eligibility_reason}</div>
              )}
            </div>
          ))}
        </div>
        {!Object.values(statuses).filter(s => s.payout_max_for_next > 0 || s.payout_min > 0).length && (
          <div className="glass-panel hover-lift border border-border rounded-lg p-4 text-sm text-muted">
            {payoutAccounts.length === 0
              ? 'No active PA / funded accounts. Mark an account type as "pa" or "funded" to see payouts here.'
              : 'Apply a prop firm preset on an account to see payout predictions here.'}
          </div>
        )}
      </div>

      {Object.keys(totalByAccount).length > 0 && (
        <div>
          <div className="text-sm font-semibold mb-2">Total Payouts</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="glass-panel hover-lift border border-accent/40 rounded-lg p-3">
              <div className="text-[10px] text-muted uppercase tracking-wider">All accounts</div>
              <div className="text-2xl font-bold text-win num">{fmtUsd(totalPaid)}</div>
              <div className="text-[10px] text-muted">{payouts.length} payouts</div>
            </div>
            {Object.entries(totalByAccount).map(([aid, total]) => {
              const count = payouts.filter(p => p.account_id === Number(aid)).length
              return (
                <div key={aid} className="glass-panel hover-lift border border-border rounded-lg p-3">
                  <div className="text-[10px] text-muted uppercase tracking-wider truncate">{acctMap[Number(aid)]?.display_name}</div>
                  <div className="text-xl font-semibold text-win num">{fmtUsd(total)}</div>
                  <div className="text-[10px] text-muted">{count} payout{count !== 1 ? 's' : ''}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">Recorded Payouts <span className="text-muted">· total {fmtUsd(totalPaid)}</span></div>
          {!creating && (
            <button onClick={() => setCreating(true)}
              className="bg-accent text-bg px-3 py-1.5 rounded text-sm">+ Record Payout</button>
          )}
        </div>
        {creating && (
          <div className="glass-panel hover-lift border border-border rounded-lg p-4 mb-3 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs text-muted">Account</label>
              <select value={form.account_id} onChange={e => setForm({ ...form, account_id: Number(e.target.value) })}
                className="w-full mt-1 bg-panel2 border border-border rounded px-2 py-1.5 text-sm">
                {accounts.map(a => <option key={a.id} value={a.id}>{a.display_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted">Date</label>
              <input type="date" value={form.payout_date} onChange={e => setForm({ ...form, payout_date: e.target.value })}
                className="w-full mt-1 bg-panel2 border border-border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted">Amount $</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                className="w-full mt-1 bg-panel2 border border-border rounded px-2 py-1.5 text-sm num" />
            </div>
            <div className="flex gap-2">
              <button onClick={create} className="bg-accent text-bg px-3 py-1.5 rounded text-sm flex-1">Save</button>
              <button onClick={() => setCreating(false)} className="text-muted text-sm px-3">Cancel</button>
            </div>
            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Notes (optional)" className="md:col-span-4 bg-panel2 border border-border rounded px-2 py-1.5 text-sm" />
          </div>
        )}
        <div className="glass-panel hover-lift border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-panel2 text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Account</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-left">Notes</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {payouts.map(p => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2">{new Date(p.payout_date).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{acctMap[p.account_id]?.display_name || p.account_id}</td>
                  <td className="px-3 py-2 text-right num text-win font-medium">{fmtUsd(p.amount)}</td>
                  <td className="px-3 py-2 text-muted text-xs">{p.notes || ''}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => remove(p.id)} className="text-xs text-loss/80 hover:text-loss">Delete</button>
                  </td>
                </tr>
              ))}
              {!payouts.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted">No payouts recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
