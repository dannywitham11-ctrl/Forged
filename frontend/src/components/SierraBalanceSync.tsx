import { useEffect, useState } from 'react'
import { api, fmtUsd } from '../lib/api'

export default function SierraBalanceSync({ onUpdated }: { onUpdated: () => void }) {
  const [mounted, setMounted] = useState<boolean | null>(null)
  const [fileCount, setFileCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function refreshScan() {
    try {
      const r = await api.tradeAccountData.scan()
      setMounted(r.mounted); setFileCount(r.files.length)
    } catch { setMounted(false) }
  }
  useEffect(() => { refreshScan() }, [])

  async function bulkImport() {
    setBusy(true); setErr(null); setResult(null)
    try {
      const r = await api.tradeAccountData.importAll()
      setResult(r); onUpdated()
    } catch (e: any) {
      setErr(String(e.message || e))
    } finally { setBusy(false) }
  }

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setBusy(true); setErr(null); setResult(null)
    const updates: any[] = []; const skips: any[] = []
    for (const f of Array.from(fileList)) {
      try {
        const r = await api.tradeAccountData.importOne(f)
        updates.push({ external_id: r.external_id, previous: r.previous_balance, new: r.new_balance })
      } catch (e: any) {
        skips.push({ name: f.name, reason: String(e.message || e).slice(0, 100) })
      }
    }
    setResult({ updated: updates.length, skipped: skips.length, updates, skips })
    onUpdated()
    setBusy(false)
  }

  return (
    <div className="bg-panel border border-accent/30 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">Sync broker balances from Sierra Chart</div>
          <div className="text-xs text-muted mt-0.5">
            Reads <code className="bg-panel2 px-1 rounded">TradeAccountData_*.data</code> files directly —
            pulls the exact broker-side balance for each account in one click.
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {mounted ? (
            <>
              <span className="text-[11px] text-muted">
                <span className="text-win">●</span> Sierra folder mounted · {fileCount} file{fileCount !== 1 ? 's' : ''}
              </span>
              <button onClick={bulkImport} disabled={busy || fileCount === 0}
                className="bg-accent text-bg text-sm px-3 py-1.5 rounded font-medium hover:opacity-90 disabled:opacity-30">
                {busy ? 'Importing…' : `Import all (${fileCount})`}
              </button>
            </>
          ) : (
            <span className="text-[11px] text-warn">
              <span className="text-warn">●</span> Sierra folder not mounted — upload files individually
            </span>
          )}
          <label className="bg-panel2 border border-border text-text text-sm px-3 py-1.5 rounded font-medium cursor-pointer hover:border-accent/50">
            {busy ? 'Uploading…' : '↑ Upload .data files'}
            <input type="file" multiple accept=".data" className="hidden"
              onChange={(e) => uploadFiles(e.target.files)} disabled={busy} />
          </label>
        </div>
      </div>

      {err && (
        <div className="mt-3 text-xs text-loss bg-loss/10 border border-loss/40 rounded p-2">{err}</div>
      )}

      {result && (
        <div className="mt-3">
          <div className="flex gap-3 text-xs mb-2">
            <span className="text-win"><b>{result.updated}</b> updated</span>
            <span className="text-muted"><b>{result.skipped}</b> skipped</span>
          </div>
          {result.updates && result.updates.length > 0 && (
            <div className="bg-panel2/60 rounded p-2 max-h-48 overflow-auto">
              <table className="w-full text-xs">
                <thead className="text-muted">
                  <tr>
                    <th className="text-left py-0.5">Account</th>
                    <th className="text-right">Was</th>
                    <th className="text-right">Now</th>
                    <th className="text-right">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {result.updates.map((u: any, i: number) => {
                    const delta = u.previous != null ? u.new - u.previous : null
                    return (
                      <tr key={i} className="border-t border-border/40">
                        <td className="py-0.5 num">{u.external_id}</td>
                        <td className="py-0.5 text-right num text-muted">{u.previous != null ? fmtUsd(u.previous) : '—'}</td>
                        <td className="py-0.5 text-right num font-medium">{fmtUsd(u.new)}</td>
                        <td className={`py-0.5 text-right num ${delta == null ? 'text-muted' : delta > 0 ? 'text-win' : delta < 0 ? 'text-loss' : 'text-muted'}`}>
                          {delta == null ? 'new' : fmtUsd(delta, { signed: true })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {result.skips && result.skips.length > 0 && (
            <details className="mt-2 text-xs">
              <summary className="text-muted cursor-pointer">{result.skips.length} skipped</summary>
              <ul className="mt-1 space-y-0.5 text-muted">
                {result.skips.map((s: any, i: number) => (
                  <li key={i}>• <span className="num">{s.name}</span> — {s.reason}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {!mounted && (
        <div className="mt-3 text-[11px] text-muted">
          💡 To enable one-click bulk sync, set <code className="bg-panel2 px-1 rounded">SIERRA_DATA</code> in
          <code className="bg-panel2 px-1 mx-1 rounded">.env</code> to your Sierra Chart folder
          and run <code className="bg-panel2 px-1 mx-1 rounded">docker compose up -d</code>.
        </div>
      )}
    </div>
  )
}
