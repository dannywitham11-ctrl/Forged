import { useEffect, useState } from 'react'
import { api, TradeAttachment } from '../lib/api'

export default function AttachmentGallery({ tradeId, refreshKey = 0 }: { tradeId: number; refreshKey?: number }) {
  const [items, setItems] = useState<TradeAttachment[]>([])
  const [lightbox, setLightbox] = useState<TradeAttachment | null>(null)

  async function refresh() { setItems(await api.trades.listAttachments(tradeId)) }
  useEffect(() => { refresh() }, [tradeId, refreshKey])

  async function remove(id: number) {
    if (!confirm('Delete this attachment?')) return
    await api.trades.deleteAttachment(id); refresh()
  }

  if (!items.length) return (
    <div className="text-xs text-muted">
      No attachments yet. Paste a screenshot directly into the notes textarea, or drop a file below.
    </div>
  )
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {items.map(a => (
          <div key={a.id} className="relative group bg-panel2 border border-border rounded overflow-hidden">
            {a.mime_type?.startsWith('image/') ? (
              <img src={a.url} alt={a.filename}
                onClick={() => setLightbox(a)}
                className="w-full h-28 object-cover cursor-zoom-in" />
            ) : (
              <a href={a.url} target="_blank" rel="noreferrer"
                className="flex items-center justify-center h-28 text-xs text-accent hover:underline">
                {a.filename}
              </a>
            )}
            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
              <a href={a.url} download={a.filename}
                className="bg-bg/80 backdrop-blur text-[10px] text-text px-1.5 py-0.5 rounded">↓</a>
              <button onClick={() => remove(a.id)}
                className="bg-bg/80 backdrop-blur text-[10px] text-loss px-1.5 py-0.5 rounded">×</button>
            </div>
            <div className="text-[10px] text-muted truncate px-1 py-0.5">{a.kind}</div>
          </div>
        ))}
      </div>
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox.url} alt={lightbox.filename}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white text-3xl leading-none">×</button>
        </div>
      )}
    </>
  )
}
