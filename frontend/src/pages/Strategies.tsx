import { useEffect, useState } from 'react'
import { api, Strategy } from '../lib/api'

const PRESET_COLORS = ['#6ee7b7', '#60a5fa', '#f59e0b', '#a78bfa', '#f472b6', '#22d3ee', '#fb7185', '#facc15']

export default function Strategies() {
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', color: PRESET_COLORS[0] })

  async function refresh() { setStrategies(await api.strategies.list()) }
  useEffect(() => { refresh() }, [])

  async function create() {
    if (!form.name.trim()) return
    await api.strategies.create(form)
    setForm({ name: '', description: '', color: PRESET_COLORS[0] })
    setCreating(false); refresh()
  }
  async function remove(id: number) {
    if (!confirm('Delete this strategy? Trades will keep their data but lose the strategy tag.')) return
    await api.strategies.delete(id); refresh()
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Strategies</h2>
          <div className="text-xs text-muted">Define playbooks and assign trades to them.</div>
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)}
            className="bg-accent text-bg px-3 py-1.5 rounded text-sm hover:opacity-90">+ New Strategy</button>
        )}
      </div>

      {creating && (
        <div className="bg-panel border border-border rounded-lg p-4 mb-4 space-y-3">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Strategy name (e.g. ORB Long, Mean Reversion)"
            className="w-full bg-panel2 border border-border rounded px-3 py-2 text-sm" />
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            rows={2} placeholder="Description / playbook rules"
            className="w-full bg-panel2 border border-border rounded px-3 py-2 text-sm font-sans" />
          <div className="flex items-center gap-2">
            <div className="text-xs text-muted">Color:</div>
            <div className="flex gap-1.5">
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setForm({ ...form, color: c })}
                  className={`w-6 h-6 rounded-full ${form.color === c ? 'ring-2 ring-offset-2 ring-offset-panel ring-text' : ''}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setCreating(false)} className="text-sm text-muted px-3 py-1.5">Cancel</button>
            <button onClick={create} className="bg-accent text-bg px-3 py-1.5 rounded text-sm">Create</button>
          </div>
        </div>
      )}

      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        {strategies.length ? (
          <div className="divide-y divide-border">
            {strategies.map(s => (
              <div key={s.id} className="p-4 flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{s.name}</div>
                  {s.description && <div className="text-xs text-muted">{s.description}</div>}
                </div>
                <button onClick={() => remove(s.id)} className="text-xs text-loss/80 hover:text-loss">Delete</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-muted">No strategies yet. Create one to start tracking which playbook each trade came from.</div>
        )}
      </div>
    </div>
  )
}
