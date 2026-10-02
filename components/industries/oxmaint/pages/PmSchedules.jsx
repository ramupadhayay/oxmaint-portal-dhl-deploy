'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  RefreshCw, Plus, Search, CalendarClock, CheckCircle, PauseCircle,
  AlertTriangle, Repeat, Gauge,
} from 'lucide-react'
import { Button } from '../ui/button'
import StatTiles from '../components/StatTiles'
import PmScheduleCard from '../components/PmScheduleCard'
import PagerBar, { usePaged } from '../components/ListPager'
import { useRecords, useStore } from '../lib/store'
import { CreateModal } from '../lib/forms'
import { useSite } from '../lib/siteStore'
import { idOf, live, isOverdue, generatedToday, usePmGenerate, usePmAssets } from '../lib/pmSchedule'
import { PM_SCHEDULES, daysUntil } from '../lib/data'

/**
 * The summary tiles, built around the register they have to judge against.
 *
 * A function rather than a constant because "overdue" needs the live asset
 * hours, and a module-scope array closes over nothing. StatTiles calls
 * `match(row)` with one argument, so the register is closed over here instead
 * of being threaded through a component every other page also uses.
 */
const pmCards = (assets) => [
  { id: 'total', title: 'Total Schedules', icon: CalendarClock, color: 'bg-slate-500', description: 'All schedules in this site scope', total: true },
  { id: 'active', title: 'Active', icon: CheckCircle, color: 'bg-green-600', description: 'Raising work as they fall due', match: (p) => p.status === 'Active' },
  { id: 'overdue', title: 'Overdue', icon: AlertTriangle, color: 'bg-red-600', description: 'Past due and nothing raised', match: (p) => isOverdue(p, assets) },
  { id: 'due_week', title: 'Due This Week', icon: CalendarClock, color: 'bg-amber-600', description: 'Falling due within seven days', match: (p) => live(p) && !isOverdue(p, assets) && daysUntil(p.next_due) <= 7 },
  { id: 'meter', title: 'Meter Based', icon: Gauge, color: 'bg-blue-600', description: 'Triggered by running hours, not the calendar', match: (p) => p.frequency_type === 'Meter' },
  { id: 'time', title: 'Time Based', icon: Repeat, color: 'bg-cyan-600', description: 'Triggered by the calendar', match: (p) => p.frequency_type === 'Time' },
  { id: 'paused', title: 'Paused', icon: PauseCircle, color: 'bg-slate-600', description: 'Held, raising nothing', match: (p) => p.status === 'Paused' },
]

export default function PMSchedules() {
  const { scope, siteName } = useSite()
  const router = useRouter()
  const { create, notify } = useStore()
  const generate = usePmGenerate()
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [due, setDue] = useState('all')
  // Which summary tile is narrowing the grid, if any.
  const [card, setCard] = useState(null)

  const merged = useRecords('pm_schedule', PM_SCHEDULES, idOf)
  const all = useMemo(() => scope(merged), [scope, merged])
  // The register as it stands, so hours logged on the Meters screen count here
  // rather than after a rebuild.
  const assets = usePmAssets()
  const cards = useMemo(() => pmCards(assets), [assets])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((p) => {
      const overdue = isOverdue(p, assets)
      const soon = !overdue && daysUntil(p.next_due) <= 7
      if (due === 'Overdue' && !overdue) return false
      if (due === 'Due this week' && !soon) return false
      if (due === 'Upcoming' && (overdue || soon)) return false
      return (status === 'all' || p.status === status) &&
        (!q || [p.schedule_name, p.asset_name, p.assigned_to_name].join(' ').toLowerCase().includes(q))
    })
  }, [all, search, status, due, assets])

  const overdueCount = all.filter((p) => isOverdue(p, assets)).length
  const compliance = all.length ? Math.round(((all.length - overdueCount) / all.length) * 100) : 100

  // The tile filter sits on top of the toolbar's.
  const cardMatch = cards.find((c) => c.id === card)?.match
  const shown = cardMatch ? rows.filter(cardMatch) : rows
  // A card per schedule is a lot of card. One page at a time.
  const paged = usePaged(shown, 24, `${search}|${status}|${due}|${card}`)

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:justify-between md:items-start lg:items-center gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">PM Schedules</h1>
          <p className="text-slate-600 mt-1">Preventive maintenance, and what it raises next</p>
        </div>
        <div className="flex w-full flex-nowrap items-center gap-3 overflow-x-auto pb-1 lg:w-auto lg:overflow-visible lg:pb-0">
          <Button variant="outline" className="h-10 px-4 gap-2"
            onClick={() => { setSearch(''); setStatus('all'); setDue('all'); setCard(null); notify('Filters cleared.') }}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button className="h-10 px-4 gap-2" onClick={() => router.push('/portal/oxmaint/pm-schedules-create')}>
            <Plus className="w-4 h-4" />
            New Schedule
          </Button>
        </div>
      </motion.div>

      <StatTiles
        rows={all} activeCard={card} onCardClick={setCard}
        storageKey="oxPmSummaryCards"
        cards={cards}
      />

      <div className="bg-white border border-slate-200/60 rounded-lg shadow-sm p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1 min-w-[220px] basis-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search schedule, asset, technician…"
              className="w-full h-10 pl-9 pr-3 rounded-md border border-slate-200 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
            />
          </div>
          {[
            { label: 'Status', value: status, set: setStatus, options: ['Active', 'Paused'] },
            { label: 'Due', value: due, set: setDue, options: ['Overdue', 'Due this week', 'Upcoming'] },
          ].map((f) => (
            <select key={f.label} value={f.value} onChange={(e) => f.set(e.target.value)}
              className="h-10 px-3 shrink-0 w-[160px] rounded-md border border-slate-200 text-sm bg-white outline-none focus:border-primary/40">
              <option value="all">{f.label}: All</option>
              {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}
          <span className="text-sm text-slate-500 whitespace-nowrap">{shown.length} shown</span>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="bg-white border border-slate-200/60 rounded-lg shadow-sm p-12 text-center">
          <CalendarClock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-800 mb-1">No schedules found</h3>
          <p className="text-sm text-slate-500">No preventive schedules match these filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paged.pageItems.map((p, n) => (
            <PmScheduleCard
              key={idOf(p)} schedule={p} index={n} assets={assets}
              onView={(x) => router.push(`/portal/oxmaint/pm-schedules/${encodeURIComponent(String(idOf(x)))}`)}
              onGenerate={generate}
              generatedToday={generatedToday(p)}
            />
          ))}
        </div>
      )}
      {shown.length > 0 && <PagerBar {...paged} noun="schedules" />}

      <CreateModal kind="pm_schedule" open={creating} onClose={() => setCreating(false)}
        onSubmit={(values) => create('pm_schedule', values)} />
    </div>
  )
}
