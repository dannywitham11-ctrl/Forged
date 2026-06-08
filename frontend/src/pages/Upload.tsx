import { useEffect, useState } from 'react'
import { api } from '../lib/api'

type ExportFormat = 'sierra' | 'ninjatrader' | 'motivewave'

const FORMAT_LABELS: Record<string, string> = {
  sierra: 'Sierra Chart',
  ninjatrader: 'NinjaTrader',
  motivewave: 'MotiveWave',
}

export default function Upload({ onUploaded }: { onUploaded: () => void }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [recent, setRecent] = useState<any[]>([])
  const [helpFor, setHelpFor] = useState<ExportFormat>('sierra')

  async function loadRecent() {
    try { setRecent(await api.uploads()) } catch {}
  }
  useEffect(() => { loadRecent() }, [])

  async function doUpload(file: File) {
    setBusy(true); setErr(null); setResult(null)
    try {
      const r = await api.upload(file)
      setResult(r); onUploaded(); loadRecent()
    } catch (e: any) {
      setErr(String(e.message || e))
    } finally { setBusy(false) }
  }

  async function doUploadMany(files: FileList) {
    for (const f of Array.from(files)) {
      await doUpload(f)
    }
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false)
          if (e.dataTransfer.files?.length) doUploadMany(e.dataTransfer.files)
        }}
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          dragOver ? 'border-accent bg-accent/5' : 'border-border bg-panel'
        }`}
      >
        <div className="text-lg font-medium mb-1">Drop your trade export here</div>
        <div className="text-sm text-muted mb-4">
          Sierra Chart Trade Activity Log, NinjaTrader Executions CSV, or MotiveWave Executions CSV — format auto-detected
        </div>
        <label className="inline-block">
          <span className="bg-accent text-bg font-medium px-4 py-2 rounded text-sm cursor-pointer hover:opacity-90">
            {busy ? 'Uploading…' : 'Choose file(s)'}
          </span>
          <input type="file" accept=".txt,.csv,.tsv" className="hidden" multiple
            onChange={(e) => { if (e.target.files?.length) doUploadMany(e.target.files) }} />
        </label>
      </div>

      {err && <div className="p-3 bg-loss/15 border border-loss/40 text-loss text-sm rounded">{err}</div>}
      {result && (
        <div className="p-4 bg-win/10 border border-win/40 rounded">
          <div className="font-medium text-win flex items-center gap-2">
            Upload complete
            {result.detected_format && (
              <span className="text-[10px] uppercase tracking-wider bg-accent/20 text-accent px-1.5 py-0.5 rounded">
                {(FORMAT_LABELS[result.detected_format] || 'Sierra Chart')} detected
              </span>
            )}
          </div>
          <div className="text-sm mt-2 text-muted">
            Parsed <b className="text-text">{result.parsed_rows}</b> rows ·
            Inserted <b className="text-text">{result.inserted_executions}</b> fills ·
            Skipped <b className="text-text">{result.skipped_duplicates}</b> duplicates ·
            Built <b className="text-text">{result.trades_built}</b> trades
          </div>
          {result.accounts_touched?.length > 0 && (
            <div className="text-xs text-muted mt-1">Accounts touched: {result.accounts_touched.join(', ')}</div>
          )}
        </div>
      )}

      <div className="glass-panel hover-lift border border-border rounded-lg overflow-hidden">
        <div className="flex border-b border-border">
          <button onClick={() => setHelpFor('sierra')}
            className={`px-4 py-2.5 text-sm border-r border-border transition ${
              helpFor === 'sierra' ? 'bg-panel2 text-text font-medium' : 'text-muted hover:text-text'}`}>
            Sierra Chart
          </button>
          <button onClick={() => setHelpFor('ninjatrader')}
            className={`px-4 py-2.5 text-sm border-r border-border transition ${
              helpFor === 'ninjatrader' ? 'bg-panel2 text-text font-medium' : 'text-muted hover:text-text'}`}>
            NinjaTrader
          </button>
          <button onClick={() => setHelpFor('motivewave')}
            className={`px-4 py-2.5 text-sm border-r border-border transition ${
              helpFor === 'motivewave' ? 'bg-panel2 text-text font-medium' : 'text-muted hover:text-text'}`}>
            MotiveWave
          </button>
        </div>
        <div className="p-4 text-xs text-muted leading-relaxed">
          {helpFor === 'sierra' ? (
            <div className="space-y-2">
              <div className="text-text font-medium">How to export from Sierra Chart</div>
              <ol className="list-decimal list-inside space-y-1 ml-1">
                <li>Sierra Chart menu → <b className="text-text">Trade</b> → <b className="text-text">Activity Log…</b></li>
                <li>Set date range (or "All") and Activity Type = <code className="bg-bg px-1 rounded">Fills</code></li>
                <li>Click <b className="text-text">Export</b> → save as <code className="bg-bg px-1 rounded">.txt</code> (tab-separated)</li>
                <li>Drop the file above</li>
              </ol>
              <div className="mt-3 text-[11px]">
                The Sierra format has columns like <code className="bg-bg px-1 rounded">FillExecutionServiceID, InternalOrderID, ParentInternalOrderID, OpenClose, …</code>.
                Trades are built using <b>order-ID matching</b> (one opener + its closers = one trade) so multi-TP setups and scale-ins are reconstructed correctly.
              </div>
              <div className="mt-2 text-[11px]">
                <b className="text-text">Tip:</b> For bar/candle data on the trade chart, also upload your <code className="bg-bg px-1 rounded">.scid</code> files
                on the <a href="/market-data" className="text-accent hover:underline">Market Data</a> page.
                For broker balance reconciliation, use the Sierra Sync button on <a href="/accounts" className="text-accent hover:underline">Accounts</a>
                to read <code className="bg-bg px-1 rounded">TradeAccountData_*.data</code> files.
              </div>
            </div>
          ) : helpFor === 'ninjatrader' ? (
            <div className="space-y-2">
              <div className="text-text font-medium">How to export from NinjaTrader</div>
              <ol className="list-decimal list-inside space-y-1 ml-1">
                <li>NinjaTrader → <b className="text-text">Control Center</b> → <b className="text-text">Trade Performance</b> tab</li>
                <li>Select the <b className="text-text">Executions</b> sub-tab (not Trades or Orders)</li>
                <li>Pick your account(s) and date range</li>
                <li>Right-click in the grid → <b className="text-text">Grid → Export…</b> → save as CSV</li>
                <li>Drop the file above (filename usually looks like <code className="bg-bg px-1 rounded">NinjaTrader Grid YYYY-MM-DD HH-MM AM-e.csv</code>)</li>
              </ol>
              <div className="mt-3 text-[11px]">
                Why Executions and not Trades/Orders: Executions gives one row per fill with per-fill commission,
                <code className="bg-bg px-1 rounded">E/X</code> markers (Entry/Exit), and connection info — everything needed to rebuild round-trip trades, scale-ins, and multi-TP correctly.
                Trades grouping loses fill detail; Orders rows hide partials.
              </div>
              <div className="mt-2 text-[11px]">
                <b className="text-text">First-time setup:</b> after the first upload, your account auto-appears as
                <code className="bg-bg px-1 rounded">{`{Connection}-{AccountNum}`}</code> (e.g. <code className="bg-bg px-1 rounded">Tradovate-Personal-1234567</code>).
                On <a href="/prop-firms" className="text-accent hover:underline">Prop Firms</a> → apply the
                <b className="text-text">Tradovate</b> preset to set the standard $0.39/side micro / $1.49/side standard commissions.
              </div>
              <div className="mt-2 text-[11px]">
                <b className="text-text">Symbol normalization:</b> NT writes <code className="bg-bg px-1 rounded">MES 06-26</code>,
                we convert to Sierra-style <code className="bg-bg px-1 rounded">MESM6.CME</code> internally so trades on the same instrument from both platforms aggregate cleanly.
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-text font-medium">How to export from MotiveWave</div>
              <ol className="list-decimal list-inside space-y-1 ml-1">
                <li>Open your <b className="text-text">Trading / Account</b> workspace (connected to your broker).</li>
                <li>Find the <b className="text-text">Executions</b> table (a.k.a. <b className="text-text">Order History</b> / <b className="text-text">Trade History</b>) — the one with one row per fill: time, instrument, buy/sell, qty, price.</li>
                <li><b className="text-text">Right-click</b> the table → <b className="text-text">Export</b> / <b className="text-text">Export to CSV</b> (some versions put it under the panel's menu icon or the <b className="text-text">File</b> menu).</li>
                <li>Save it as <code className="bg-bg px-1 rounded">.csv</code> and drop it above.</li>
              </ol>
              <div className="mt-3 text-[11px]">
                Forge reads MotiveWave exports with <b>flexible column detection</b> — it looks for date/time, instrument, side, quantity, price, and account columns under their common names. Trades are rebuilt by walking the position to zero (MotiveWave exports don't include Sierra's order-pairing metadata), which still handles scale-ins and multiple exits.
              </div>
              <div className="mt-2 text-[11px]">
                <b className="text-text">If it imports 0 rows</b>, your export's column names are just unusual — send the header row and we'll add them. Prices should be plain decimals (no integer-tick scaling like Sierra uses).
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold mb-2">Recent uploads</div>
        <div className="glass-panel hover-lift border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted bg-panel2">
              <tr>
                <th className="px-3 py-2 text-left">File</th>
                <th className="px-3 py-2 text-right">Rows</th>
                <th className="px-3 py-2 text-right">Inserted</th>
                <th className="px-3 py-2 text-right">Skipped</th>
                <th className="px-3 py-2 text-left">When</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(u => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-3 py-2 truncate max-w-[300px]" title={u.filename}>{u.filename}</td>
                  <td className="px-3 py-2 text-right num">{u.row_count}</td>
                  <td className="px-3 py-2 text-right num">{u.inserted_executions}</td>
                  <td className="px-3 py-2 text-right num text-muted">{u.skipped_duplicates}</td>
                  <td className="px-3 py-2 text-muted">{new Date(u.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {!recent.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted">No uploads yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
