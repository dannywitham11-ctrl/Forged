import { useEffect, useState } from 'react'
import { api, Trade, Execution, Strategy, fmtUsd, fmtDuration } from '../lib/api'
import StarRating from './StarRating'
import PlannedLevelInput from './PlannedLevelInput'
import MistakeTagInput from './MistakeTagInput'
import TagInput from './TagInput'
import TradeChart from './TradeChart'
import DrawdownDuringTrade from './DrawdownDuringTrade'
import AttachmentGallery from './AttachmentGallery'
import CandleChart from './CandleChart'
import TradeLegs from './TradeLegs'

export default function TradeDetailModal({
  trade, strategies, onClose, onSaved,
}: {
  trade: Trade
  strategies: Strategy[]
  onClose: () => void
  onSaved: (t: Trade) => void
}) {
  const [t, setT] = useState<Trade>(trade)
  const [executions, setExecutions] = useState<Execution[]>([])
  const [saving, setSaving] = useState(false)
  const [attachRefreshKey, setAttachRefreshKey] = useState(0)
  const [pasteHint, setPasteHint] = useState('')

  useEffect(() => { setT(trade); api.trades.executions(trade.id).then(setExecutions) }, [trade.id]) // eslint-disable-line

  async function save() {
    setSaving(true)
    try {
      const updated = await api.trades.update(t.id, {
        notes: t.notes ?? '', tags: t.tags ?? '', mistakes: t.mistakes ?? '',
        rating: t.rating, strategy_id: t.strategy_id,
        planned_target_mode: t.planned_target_mode, planned_target_value: t.planned_target_value,
        planned_stop_mode: t.planned_stop_mode, planned_stop_value: t.planned_stop_value,
      } as any)
      onSaved(updated)
    } finally { setSaving(false) }
  }

  async function uploadImage(file: File) {
    setPasteHint('Uploading…')
    try {
      await api.trades.uploadAttachment(t.id, file, 'screenshot')
      setAttachRefreshKey(k => k + 1)
      setPasteHint(`Attached ${file.name || 'screenshot'} ✓`)
      setTimeout(() => setPasteHint(''), 2500)
    } catch (e: any) {
      setPasteHint(`Upload failed: ${e.message || e}`)
    }
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) {
          const stamp = new Date().toISOString().replace(/[:.]/g, '-')
          const named = new File([file], `paste_${stamp}.png`, { type: file.type })
          await uploadImage(named)
        }
        return
      }
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    for (const f of files) await uploadImage(f)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-auto" onClick={onClose}>
      <div className="bg-panel glass-panel hover-lift border border-border rounded-lg w-full max-w-5xl my-8" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-lg font-semibold">{t.symbol}</div>
              <span className={`text-xs px-2 py-0.5 rounded ${t.side === 'Long' ? 'bg-win/15 text-win' : 'bg-loss/15 text-loss'}`}>
                {t.side} × {t.quantity}
              </span>
              <span className={`text-xs num font-medium ${t.net_pnl > 0 ? 'text-win' : t.net_pnl < 0 ? 'text-loss' : ''}`}>
                {fmtUsd(t.net_pnl, { signed: true })}
              </span>
              {t.realized_r != null && (
                <span className="text-xs num text-muted">
                  {t.realized_r >= 0 ? '+' : ''}{t.realized_r.toFixed(2)}R realized
                </span>
              )}
            </div>
            <div className="text-xs text-muted mt-1 num">
              {new Date(t.entry_time).toLocaleString()} → {new Date(t.exit_time).toLocaleString()}
              <span className="ml-2">({fmtDuration(t.duration_seconds)})</span>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-text text-xl leading-none">✕</button>
        </div>

        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm border-b border-border">
          <Field label="Avg Entry" value={t.avg_entry_price.toFixed(2)} />
          <Field label="Avg Exit" value={t.avg_exit_price.toFixed(2)} />
          <Field label="Gross" value={fmtUsd(t.gross_pnl, { signed: true })} />
          <Field label="Commissions" value={fmtUsd(t.commissions + t.fees)} />
          <Field label="MFE ($)" value={t.mfe_pnl != null ? fmtUsd(t.mfe_pnl) : '—'} cls="text-win/80" />
          <Field label="MAE ($)" value={t.mae_pnl != null ? fmtUsd(t.mae_pnl) : '—'} cls="text-loss/80" />
          <Field label="Planned Risk" value={t.planned_risk ? fmtUsd(t.planned_risk) : '—'} cls="text-loss/80" />
          <Field label="Planned RR" value={t.planned_rr != null ? `${t.planned_rr.toFixed(2)}R` : '—'} />
        </div>

        <div className="p-5 border-b border-border space-y-4">
          <CandleChart trade={t} executions={executions} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TradeChart trade={t} executions={executions} />
            <DrawdownDuringTrade trade={t} executions={executions} />
          </div>
        </div>

        <div className="p-5 border-b border-border">
          <TradeLegs trade={t} executions={executions} />
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-border">
          <div>
            <label className="text-xs text-muted">Strategy</label>
            <select value={t.strategy_id ?? ''} onChange={e => setT({ ...t, strategy_id: e.target.value ? Number(e.target.value) : null })}
              className="w-full mt-1 bg-panel2 border border-border rounded px-2 py-1.5 text-sm">
              <option value="">— None —</option>
              {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted">Rating</label>
            <div className="mt-2"><StarRating value={t.rating} onChange={v => setT({ ...t, rating: v })} size={22} /></div>
          </div>
          <PlannedLevelInput label="Planned Profit Target"
            mode={t.planned_target_mode} value={t.planned_target_value}
            onChange={(mode, value) => setT({ ...t, planned_target_mode: mode, planned_target_value: value })} />
          <PlannedLevelInput label="Planned Stop Loss"
            mode={t.planned_stop_mode} value={t.planned_stop_value}
            onChange={(mode, value) => setT({ ...t, planned_stop_mode: mode, planned_stop_value: value })} />
        </div>

        <div className="p-5 border-b border-border space-y-4">
          <TagInput value={t.tags ?? ''} onChange={v => setT({ ...t, tags: v })} />
          <MistakeTagInput value={t.mistakes ?? ''} onChange={v => setT({ ...t, mistakes: v })} />
        </div>

        <div className="p-5 border-b border-border space-y-3"
          onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted">Notes <span className="opacity-60">· paste a screenshot or drop a file</span></label>
              {pasteHint && <span className="text-[11px] text-accent">{pasteHint}</span>}
            </div>
            <textarea value={t.notes ?? ''} onChange={e => setT({ ...t, notes: e.target.value })}
              onPaste={handlePaste} rows={5}
              placeholder="What happened? What did you learn? Paste a screenshot here."
              className="w-full mt-1 bg-panel2 border border-border rounded px-3 py-2 text-sm font-sans focus:outline-none focus:border-accent" />
          </div>
          <div>
            <div className="text-xs text-muted mb-2">Attachments</div>
            <AttachmentGallery tradeId={t.id} refreshKey={attachRefreshKey} />
            <div className="mt-2 flex items-center gap-2">
              <label className="text-[11px] text-accent hover:underline cursor-pointer">
                + Add image
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f) }} />
              </label>
            </div>
          </div>
        </div>

        <div className="p-5 border-b border-border">
          <div className="text-sm font-semibold mb-2">Executions ({executions.length})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted uppercase">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Time</th>
                  <th className="px-3 py-2 text-left font-medium">Side</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Price</th>
                  <th className="px-3 py-2 text-left font-medium">Order</th>
                  <th className="px-3 py-2 text-left font-medium">O/C</th>
                </tr>
              </thead>
              <tbody>
                {executions.map(e => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-3 py-2">{new Date(e.fill_time).toLocaleTimeString()}</td>
                    <td className={`px-3 py-2 ${e.side === 'Buy' ? 'text-win' : 'text-loss'}`}>{e.side}</td>
                    <td className="px-3 py-2 text-right num">{e.quantity}</td>
                    <td className="px-3 py-2 text-right num">{e.fill_price.toFixed(2)}</td>
                    <td className="px-3 py-2 text-muted">{e.order_type}</td>
                    <td className="px-3 py-2 text-muted">{e.open_close}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-5 flex justify-end gap-2">
          <button onClick={onClose} className="text-muted text-sm px-3 py-2">Close</button>
          <button onClick={save} disabled={saving}
            className="bg-accent text-bg font-medium px-4 py-2 rounded text-sm hover:opacity-90 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, cls = '' }: { label: string; value: string; cls?: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted uppercase tracking-wider">{label}</div>
      <div className={`num font-semibold ${cls}`}>{value}</div>
    </div>
  )
}
