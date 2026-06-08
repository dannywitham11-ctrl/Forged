import { useState } from 'react'
import { api } from '../lib/api'

export default function DangerZone({ onReset }: { onReset: () => void }) {
  const [open, setOpen] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const PHRASE = 'delete everything'

  async function go() {
    setBusy(true); setResult(null)
    try {
      const r = await api.admin.resetEverything()
      setResult(
        `Deleted: ${r.deleted_accounts} accounts · ${r.deleted_trades} trades · ${r.deleted_executions} executions · ` +
        `${r.deleted_uploads} uploads · ${r.deleted_strategies} strategies · ${r.deleted_playbooks} playbooks · ` +
        `${r.deleted_payouts} payouts · ${r.deleted_costs} costs · ${r.deleted_attachments} attachments · ` +
        `${r.files_removed} files removed`
      )
      setPhrase(''); setOpen(false); onReset()
    } catch (e: any) {
      setResult(`Failed: ${e.message || e}`)
    } finally { setBusy(false) }
  }

  return (
    <div className="bg-panel border border-loss/40 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-loss">Danger Zone</div>
          <div className="text-xs text-muted mt-0.5">
            Permanently wipe all your trading data: accounts, trades, executions, uploads, strategies,
            playbooks, payouts, costs, and attachments. Prop firm presets are preserved.
          </div>
        </div>
        {!open && (
          <button onClick={() => setOpen(true)}
            className="bg-loss/20 border border-loss/50 text-loss hover:bg-loss/30 text-sm px-3 py-1.5 rounded whitespace-nowrap">
            Reset Everything…
          </button>
        )}
      </div>
      {open && (
        <div className="mt-3 pt-3 border-t border-loss/30 space-y-3">
          <div className="text-xs text-loss">
            Type <code className="bg-bg px-1 py-0.5 rounded text-text">{PHRASE}</code> to confirm. This cannot be undone.
          </div>
          <div className="flex gap-2">
            <input value={phrase} onChange={e => setPhrase(e.target.value)}
              placeholder={PHRASE}
              className="flex-1 bg-panel2 border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-loss" />
            <button onClick={go}
              disabled={phrase.trim().toLowerCase() !== PHRASE || busy}
              className="bg-loss text-white font-medium px-4 py-2 rounded text-sm disabled:opacity-30">
              {busy ? 'Wiping…' : 'WIPE'}
            </button>
            <button onClick={() => { setOpen(false); setPhrase('') }}
              className="text-muted text-sm px-3">Cancel</button>
          </div>
        </div>
      )}
      {result && <div className="mt-3 text-xs text-muted">{result}</div>}
    </div>
  )
}
