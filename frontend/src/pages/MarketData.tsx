import { useEffect, useState } from 'react'
import { api, MarketDataSummaryRow } from '../lib/api'

const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '1d']

export default function MarketData() {
  const [summary, setSummary] = useState<MarketDataSummaryRow[]>([])
  const [symbol, setSymbol] = useState('')
  const [timeframe, setTimeframe] = useState('1m')
  const [divisor, setDivisor] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)
  const [sierra, setSierra] = useState<any>(null)

  async function refresh() {
    setSummary(await api.marketData.summary())
    api.marketData.sierraFiles().then(setSierra).catch(() => setSierra(null))
  }
  useEffect(() => { refresh() }, [])

  async function uploadFile(file: File) {
    if (!symbol.trim()) { setErr('Set the Symbol field first.'); return }
    setBusy(true); setErr(null); setResult(null)
    try {
      const isScid = file.name.toLowerCase().endsWith('.scid')
      const r = isScid
        ? await api.marketData.uploadScid(file, symbol.trim(), timeframe)
        : await api.marketData.upload(file, symbol.trim(), timeframe,
            divisor.trim() ? parseFloat(divisor) : undefined)
      setResult(r); refresh()
    } catch (e: any) {
      setErr(String(e.message || e))
    } finally { setBusy(false) }
  }

  async function importSierra(filename: string) {
    if (!symbol.trim()) { setErr('Set the Symbol field first.'); return }
    setBusy(true); setErr(null); setResult(null)
    try {
      const r = await api.marketData.sierraImport(filename, symbol.trim(), timeframe)
      setResult(r); refresh()
    } catch (e: any) {
      setErr(String(e.message || e))
    } finally { setBusy(false) }
  }

  async function tryYahoo(s: MarketDataSummaryRow) {
    setBusy(true); setErr(null); setResult(null)
    try {
      const r = await api.marketData.yahooFetch(s.symbol, s.timeframe, 7)
      setResult(r); refresh()
    } catch (e: any) {
      setErr(String(e.message || e))
    } finally { setBusy(false) }
  }

  async function del(s: MarketDataSummaryRow) {
    if (!confirm(`Delete all ${s.bar_count} ${s.timeframe} bars for ${s.symbol}?`)) return
    await api.marketData.deleteSymbol(s.symbol, s.timeframe); refresh()
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="bg-panel border border-border rounded-lg p-4">
        <div className="text-sm font-semibold mb-1">Market Data — OHLC bar cache</div>
        <div className="text-xs text-muted leading-relaxed">
          Three ways to load real candle data so the trade chart shows actual market action:
          <ol className="mt-2 space-y-1 list-decimal list-inside">
            <li><b className="text-accent">Bind-mount your Sierra Data folder (recommended for large files)</b> —
              the container reads <code className="bg-bg px-1 mx-0.5 rounded">.scid</code> files directly from disk.
              No upload, no size limit, multi-GB files are instant. See "Sierra Data folder" panel below.
            </li>
            <li><b>Upload .scid</b> — pick any <code className="bg-bg px-1 mx-0.5 rounded">{`{symbol}.scid`}</code>
              from your <code className="bg-bg px-1 mx-0.5 rounded">SierraChart/Data/</code> folder.
              Streams to disk and parses record-by-record, so even big files work, but the upload itself can be slow over Wi-Fi.
            </li>
            <li><b>Upload bar CSV</b> — Right-click a Sierra chart →
              <em> Chart Studies → Bar Data Spreadsheet → Save to File</em>. Useful for non-Sierra sources.
            </li>
          </ol>
          <div className="mt-3 text-warn text-[11px]">
            ⚠ Got a 1+ GB .scid? Use the bind-mount — it skips upload entirely. Set
            <code className="bg-bg px-1 mx-1 rounded">SIERRA_DATA</code> in <code className="bg-bg px-1 mx-1 rounded">.env</code>
            and run <code className="bg-bg px-1 mx-1 rounded">docker compose up -d</code>.
          </div>
        </div>
      </div>

      <div className="bg-panel border border-border rounded-lg p-5 space-y-3">
        <div className="text-sm font-semibold">Upload bars</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted">Symbol (must match Sierra)</label>
            <input value={symbol} onChange={e => setSymbol(e.target.value)}
              placeholder="MNQM6.CME"
              className="w-full mt-1 bg-panel2 border border-border rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted">Aggregate to timeframe</label>
            <select value={timeframe} onChange={e => setTimeframe(e.target.value)}
              className="w-full mt-1 bg-panel2 border border-border rounded px-2 py-1.5 text-sm">
              {TIMEFRAMES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted">CSV price ÷ divisor (blank = auto)</label>
            <input value={divisor} onChange={e => setDivisor(e.target.value)}
              placeholder="1 or 100"
              className="w-full mt-1 bg-panel2 border border-border rounded px-2 py-1.5 text-sm num" />
            <div className="text-[10px] text-muted mt-0.5">.scid files always use native prices (ignored)</div>
          </div>
          <div className="flex items-end">
            <label className="bg-accent text-bg font-medium px-3 py-1.5 rounded text-sm cursor-pointer hover:opacity-90 inline-block w-full text-center">
              {busy ? 'Uploading…' : 'Choose .scid or .csv'}
              <input type="file" accept=".scid,.csv,.tsv,.txt" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f) }} />
            </label>
          </div>
        </div>
        {err && <div className="text-xs text-loss bg-loss/10 border border-loss/40 rounded p-2">{err}</div>}
        {result && (
          <div className="text-xs bg-win/10 border border-win/40 rounded p-3 space-y-1">
            <div className="text-win font-medium">Upload OK</div>
            {result.parsed != null && (
              <div>Parsed <b>{result.parsed}</b> bars · inserted <b>{result.inserted}</b> · skipped <b>{result.skipped_duplicates}</b> dupes
                {result.price_divisor && <> · divisor <b>{result.price_divisor}</b></>}</div>
            )}
            {result.earliest && <div className="text-muted">Range: {new Date(result.earliest).toLocaleString()} → {new Date(result.latest).toLocaleString()}</div>}
            {(result.notes || []).map((n: string, i: number) => <div key={i} className="text-muted">· {n}</div>)}
          </div>
        )}
      </div>

      <div>
        <div className="text-sm font-semibold mb-2">Sierra Data folder</div>
        {!sierra?.mounted ? (
          <div className="bg-panel border border-border rounded-lg p-4 text-xs text-muted leading-relaxed">
            <div className="text-text font-medium mb-1">Not mounted (optional)</div>
            To browse and bulk-import directly from your Sierra Chart Data folder, add this to
            <code className="bg-bg px-1 mx-1 rounded">.env</code> and restart:
            <pre className="mt-2 bg-bg p-2 rounded text-[11px] overflow-x-auto">SIERRA_DATA=/absolute/path/to/SierraChart/Data</pre>
            Then run <code className="bg-bg px-1 mx-1 rounded">docker compose up -d</code>.
            The folder is mounted read-only — your files won't be touched.
          </div>
        ) : (
          <div className="bg-panel border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2 text-xs text-muted border-b border-border">
              Mounted: <code className="text-text">{sierra.path}</code> · {sierra.files.length} .scid files
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-panel2 text-xs uppercase text-muted sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">File</th>
                    <th className="px-3 py-2 text-right">Size</th>
                    <th className="px-3 py-2 text-left">Modified</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {sierra.files.map((f: any) => (
                    <tr key={f.filename} className="border-t border-border">
                      <td className="px-3 py-1.5 num text-xs">{f.filename}</td>
                      <td className="px-3 py-1.5 text-right num text-xs text-muted">{(f.size_bytes / 1024 / 1024).toFixed(1)} MB</td>
                      <td className="px-3 py-1.5 text-xs text-muted">{new Date(f.modified * 1000).toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-right">
                        <button onClick={() => {
                          if (!symbol.trim()) {
                            const guess = f.filename.replace(/\.scid$/i, '')
                            setSymbol(guess + '.CME')
                          }
                          importSierra(f.filename)
                        }} className="text-xs text-accent hover:underline">Import as {timeframe}</button>
                      </td>
                    </tr>
                  ))}
                  {!sierra.files.length && (
                    <tr><td colSpan={4} className="px-3 py-6 text-center text-muted">No .scid files in mounted folder</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="text-sm font-semibold mb-2">Cached bars</div>
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-panel2 text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2 text-left">Symbol</th>
                <th className="px-3 py-2 text-left">Timeframe</th>
                <th className="px-3 py-2 text-right">Bars</th>
                <th className="px-3 py-2 text-left">Range</th>
                <th className="px-3 py-2 text-left">Sources</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {summary.map(s => (
                <tr key={`${s.symbol}-${s.timeframe}`} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{s.symbol}</td>
                  <td className="px-3 py-2">{s.timeframe}</td>
                  <td className="px-3 py-2 text-right num">{s.bar_count.toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs text-muted num">
                    {new Date(s.earliest).toLocaleString()} → {new Date(s.latest).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">{s.sources.join(', ') || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => tryYahoo(s)} disabled={busy}
                      className="text-xs text-accent hover:underline mr-3">+ Yahoo</button>
                    <button onClick={() => del(s)}
                      className="text-xs text-loss/80 hover:text-loss">Delete</button>
                  </td>
                </tr>
              ))}
              {!summary.length && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted">No bars cached yet — upload above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
