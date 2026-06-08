import { useEffect, useState } from 'react'
import { api, FullStats } from '../lib/api'
import PnLCalendar from '../components/PnLCalendar'

export default function Calendar({ accountIds }: { accountIds?: number[] }) {
  const [stats, setStats] = useState<FullStats | null>(null)
  useEffect(() => { api.stats({ account_ids: accountIds }).then(setStats) }, [accountIds?.join(',')]) // eslint-disable-line
  if (!stats) return <div className="p-6 text-muted">Loading…</div>
  return <div className="p-6"><PnLCalendar data={stats.daily} /></div>
}
