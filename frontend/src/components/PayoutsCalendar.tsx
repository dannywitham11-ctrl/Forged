import { useEffect, useMemo, useState } from 'react'
import { api, Account, Payout, ForecastedPayout, fmtUsd } from '../lib/api'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DOW = ['S','M','T','W','T','F','S']

type Item = {
  date: string                  // YYYY-MM-DD
  account_id: number
  account_name: string
  amount: number
  payout_number: number         // ordinal at time of payout
  recorded: boolean
}

export default function PayoutsCalendar({ accounts }: { accounts: Account[] }) {
  const [recorded, setRecorded] = useState<Payout[]>([])
  const [upcoming, setUpcoming] = useState<ForecastedPayout[]>([])

  async function refresh() {
    const [pays, forecast] = await Promise.all([api.payouts.list(), api.plan.forecast()])
    setRecorded(pays); setUpcoming(forecast.all_predicted)
  }
  useEffect(() => { refresh() }, [accounts.length]) // eslint-disable-line

  const items: Item[] = useMemo(() => {
    const acctMap = Object.fromEntries(accounts.map(a => [a.id, a]))
    const recByAcct: Record<number, Payout[]> = {}
    recorded.forEach(p => {
      (recByAcct[p.account_id] ||= []).push(p)
    })
    Object.values(recByAcct).forEach(arr =>
      arr.sort((a, b) => +new Date(a.payout_date) - +new Date(b.payout_date)))

    const rec: Item[] = []
    Object.entries(recByAcct).forEach(([aid, arr]) => {
      arr.forEach((p, i) => {
        rec.push({
          date: p.payout_date.slice(0, 10),
          account_id: Number(aid),
          account_name: shortName(acctMap[Number(aid)]),
          amount: p.amount,
          payout_number: i + 1,
          recorded: true,
        })
      })
    })
    const up: Item[] = upcoming.map(p => ({
      date: p.predicted_date.slice(0, 10),
      account_id: p.account_id,
      account_name: shortName(acctMap[p.account_id]),
      amount: p.amount,
      payout_number: p.payout_number,
      recorded: false,
    }))
    return [...rec, ...up].sort((a, b) => a.date.localeCompare(b.date))
  }, [recorded, upcoming, accounts])

  if (!items.length) {
    return (
      <div className="bg-panel border border-border rounded-lg p-6 text-center text-muted text-sm">
        No payouts recorded or predicted. Record a payout above or apply a prop firm preset to start forecasting.
      </div>
    )
  }

  const months = enumerateMonths(items)
  const totalRecorded = items.filter(i => i.recorded).reduce((s, i) => s + i.amount, 0)
  const totalUpcoming = items.filter(i => !i.recorded).reduce((s, i) => s + i.amount, 0)

  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-semibold">Payouts Calendar</div>
          <div className="text-[11px] text-muted">
            <span className="inline-block w-2 h-2 bg-win rounded-sm mr-1"></span>recorded ·
            <span className="inline-block w-2 h-2 bg-loss/80 rounded-sm mx-1"></span>upcoming
          </div>
        </div>
        <div className="text-right text-xs">
          <div className="num"><span className="text-win">{fmtUsd(totalRecorded)}</span> <span className="text-muted">recorded</span></div>
          <div className="num"><span className="text-loss/80">{fmtUsd(totalUpcoming)}</span> <span className="text-muted">upcoming</span></div>
        </div>
      </div>
      <div className="space-y-6">
        {months.map(m => (
          <MonthGrid key={`${m.year}-${m.month}`} year={m.year} month={m.month} items={items} />
        ))}
      </div>
    </div>
  )
}

function shortName(a?: Account) {
  if (!a) return 'Acct'
  const dn = a.display_name
  // "Apex 50K PA-10" -> "Apex-10"
  const m = dn.match(/^(\w+).*?(PA|EVAL|FUNDED)-(\d+)$/i)
  if (m) return `${m[1]}-${m[3]}`
  return dn.length > 14 ? dn.slice(0, 14) + '…' : dn
}

function MonthGrid({ year, month, items }: { year: number; month: number; items: Item[] }) {
  const first = new Date(year, month, 1)
  const startDow = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const itemsByDate: Record<string, Item[]> = {}
  items.forEach(it => {
    const d = new Date(it.date + 'T00:00:00')
    if (d.getFullYear() === year && d.getMonth() === month) {
      (itemsByDate[it.date] ||= []).push(it)
    }
  })

  const weeks: ((number|null)[])[] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const monthItems = items.filter(it => {
    const d = new Date(it.date + 'T00:00:00')
    return d.getFullYear() === year && d.getMonth() === month
  })
  const monthRec = monthItems.filter(i => i.recorded).reduce((s, i) => s + i.amount, 0)
  const monthUp = monthItems.filter(i => !i.recorded).reduce((s, i) => s + i.amount, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">{MONTH_NAMES[month]} {year}</div>
        <div className="text-xs num">
          <span className="text-win">{fmtUsd(monthRec)}</span>
          <span className="text-muted mx-1">/</span>
          <span className="text-loss/80">{fmtUsd(monthUp)}</span>
          <span className="text-muted ml-1">rec / up</span>
        </div>
      </div>
      <div className="grid gap-1 text-[10px] text-muted mb-1" style={{ gridTemplateColumns: 'repeat(7, minmax(0,1fr)) 100px' }}>
        {DOW.map((d, i) => <div key={i} className="text-center">{d}</div>)}
        <div className="text-right pr-1">Week</div>
      </div>
      <div className="space-y-1">
        {weeks.map((week, wi) => {
          const weekDates = week.filter((d): d is number => d !== null)
            .map(d => `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`)
          const weekItems = weekDates.flatMap(d => itemsByDate[d] || [])
          const wRec = weekItems.filter(i => i.recorded).reduce((s, i) => s + i.amount, 0)
          const wUp = weekItems.filter(i => !i.recorded).reduce((s, i) => s + i.amount, 0)
          return (
            <div key={wi} className="grid gap-1" style={{ gridTemplateColumns: 'repeat(7, minmax(0,1fr)) 100px' }}>
              {week.map((day, di) => {
                if (day === null) return <div key={di} className="min-h-[60px]" />
                const date = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                const dayItems = itemsByDate[date] || []
                return (
                  <div key={di} className="bg-panel2/50 border border-border rounded-sm p-1 min-h-[60px] flex flex-col">
                    <div className="text-[10px] text-muted text-right">{day}</div>
                    <div className="flex flex-wrap gap-0.5 mt-0.5">
                      {dayItems.map((it, ii) => (
                        <span key={ii}
                          title={`${it.account_name} payout #${it.payout_number}: ${fmtUsd(it.amount)} (${it.recorded ? 'recorded' : 'upcoming'})`}
                          className={`text-[9px] leading-tight px-1 py-0.5 rounded font-medium ${
                            it.recorded
                              ? 'bg-win/25 text-win border border-win/40'
                              : 'bg-loss/20 text-loss/90 border border-loss/40'
                          }`}>
                          {it.account_name} P{it.payout_number}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
              <div className="bg-panel2/30 border border-border/60 rounded-sm p-1 text-[10px] flex flex-col justify-center text-right">
                <div className="num text-win">{wRec > 0 ? fmtUsd(wRec) : '—'}</div>
                <div className="num text-loss/80">{wUp > 0 ? fmtUsd(wUp) : '—'}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function enumerateMonths(items: Item[]) {
  if (!items.length) return []
  const dates = items.map(i => new Date(i.date + 'T00:00:00'))
  const min = new Date(Math.min(...dates.map(d => +d)))
  const max = new Date(Math.max(...dates.map(d => +d)))
  const out: { year: number; month: number }[] = []
  const cur = new Date(min.getFullYear(), min.getMonth(), 1)
  const end = new Date(max.getFullYear(), max.getMonth(), 1)
  while (cur <= end) {
    out.push({ year: cur.getFullYear(), month: cur.getMonth() })
    cur.setMonth(cur.getMonth() + 1)
  }
  return out
}
