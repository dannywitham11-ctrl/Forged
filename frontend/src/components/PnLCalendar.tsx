import { Link } from 'react-router-dom'
import { DailyPnl, fmtUsd } from '../lib/api'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DOW = ['S','M','T','W','T','F','S']

export default function PnLCalendar({ data }: { data: DailyPnl[] }) {
  if (!data.length) {
    return (
      <div className="bg-panel border border-border rounded-lg p-4">
        <div className="text-sm font-semibold mb-2">Daily P&amp;L</div>
        <div className="text-sm text-muted">No trades yet.</div>
      </div>
    )
  }
  const byDate = new Map<string, DailyPnl>()
  data.forEach(d => byDate.set(d.date, d))
  const dates = data.map(d => new Date(d.date + 'T00:00:00'))
  const min = new Date(Math.min(...dates.map(d => +d)))
  const max = new Date(Math.max(...dates.map(d => +d)))
  const months = enumerateMonths(min, max)

  const maxAbs = Math.max(1, ...data.map(d => Math.abs(d.net_pnl)))

  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="text-sm font-semibold mb-3">Daily P&amp;L Calendar</div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {months.map((m) => (
          <MonthGrid key={`${m.year}-${m.month}`} year={m.year} month={m.month} byDate={byDate} maxAbs={maxAbs} />
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted mt-4">
        <span className="inline-block w-3 h-3 bg-loss/80 rounded-sm"></span> loss
        <span className="inline-block w-3 h-3 bg-panel2 rounded-sm"></span> none
        <span className="inline-block w-3 h-3 bg-win/80 rounded-sm"></span> win
      </div>
    </div>
  )
}

function MonthGrid({ year, month, byDate, maxAbs }:{ year:number; month:number; byDate: Map<string, DailyPnl>; maxAbs:number }) {
  const first = new Date(year, month, 1)
  const startDow = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: ({ day: number; date: string; pnl?: DailyPnl } | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    cells.push({ day: d, date, pnl: byDate.get(date) })
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const monthlyTotal = cells.reduce((acc, c) => acc + (c?.pnl?.net_pnl || 0), 0)

  return (
    <div className="bg-panel2/60 rounded-md p-3 border border-border">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">{MONTH_NAMES[month]} {year}</div>
        <div className={`text-xs num ${monthlyTotal > 0 ? 'text-win' : monthlyTotal < 0 ? 'text-loss' : 'text-muted'}`}>
          {fmtUsd(monthlyTotal, { signed: true })}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[10px] text-muted mb-1">
        {DOW.map((d,i) => <div key={i} className="text-center">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c) return <div key={i} className="aspect-square" />
          if (!c.pnl) {
            return (
              <div key={i} className="aspect-square rounded-sm bg-panel2 flex items-start justify-end p-1 text-[10px] text-muted">
                {c.day}
              </div>
            )
          }
          const v = c.pnl.net_pnl
          const intensity = Math.min(1, Math.abs(v) / maxAbs)
          const bg = v > 0
            ? `rgba(34,197,94,${0.2 + 0.6 * intensity})`
            : v < 0
              ? `rgba(239,68,68,${0.2 + 0.6 * intensity})`
              : '#1a2233'
          return (
            <Link key={i} to={`/daily?date=${c.date}`}
              title={`${c.date}: ${fmtUsd(v, { signed: true })} (${c.pnl.trade_count} trades) — click to open`}
              className="aspect-square rounded-sm flex flex-col p-1 text-[10px] hover:ring-1 hover:ring-accent transition"
              style={{ background: bg }}>
              <div className="text-right text-white/70 text-[10px]">{c.day}</div>
              <div className="mt-auto num font-medium text-white">{shortMoney(v)}</div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function shortMoney(v: number) {
  const a = Math.abs(v)
  if (a >= 1000) return `${v < 0 ? '-' : ''}$${(a/1000).toFixed(1)}k`
  return `${v < 0 ? '-' : ''}$${a.toFixed(0)}`
}

function enumerateMonths(min: Date, max: Date) {
  const out: { year: number; month: number }[] = []
  const cur = new Date(min.getFullYear(), min.getMonth(), 1)
  const end = new Date(max.getFullYear(), max.getMonth(), 1)
  while (cur <= end) {
    out.push({ year: cur.getFullYear(), month: cur.getMonth() })
    cur.setMonth(cur.getMonth() + 1)
  }
  return out
}
