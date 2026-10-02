'use client'

// Inspection Reminders — the forward view of inspection work.
//
// Inspection Reports is the record of what has been done. This is the opposite
// question: what is coming, and what has already slipped. They are deliberately
// separate screens because a completed inspection and a due one are read at
// different times by different people, and merging them puts the thing you need
// to act on underneath four hundred things you do not.
//
// The two screens meet at the runner. Starting a reminder here files a real
// inspection report on the other screen and rolls this row forward by its own
// frequency, which is the only thing that makes a reminder list worth keeping.
//
// The shape is the product's: three summary cards, an overdue band, and three
// tabs — what is running, what is next, and what has been stopped. The tabs say
// Paused rather than Archived because that is this register's own word for a
// reminder nobody is being chased by, and putting the product's word on a flag
// that means something else is how a screen starts lying quietly.

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw, Download, Plus, ClipboardList, CheckCircle, PauseCircle,
  ListChecks, CalendarClock, Search, X, Wrench, Bell,
} from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Card, CardContent } from '../ui/card'
import { Input } from '../ui/input'
import { Switch } from '../ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select'
// Aliased: this file already imports a Tabs of its own from the inline-styled kit.
import { Tabs as ShadTabs, TabsList, TabsTrigger } from '../ui/tabs'
import StatTiles from '../components/StatTiles'
import { ReminderCard, NextDueCard } from '../components/ReminderCard'
import {
  Drawer, Fields, StatusBadge, ActionButton, PALETTE,
} from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { useRecords, useStore } from '../lib/store'
import { CreateModal } from '../lib/forms'
import {
  InspectionRunner, itemCount, frequencyFor, FREQUENCY_DAYS, nextInspectionNumber,
} from '../lib/inspectionItems'
import {
  ASSETS, TECHNICIANS, fmtDate, isPast, daysUntil, pick, between, daysFrom,
  INSPECTION_TYPES,
} from '../lib/data'
import { AlertBand } from '../lib/productKit'
import { Pager } from '../lib/reminderKit'

const { MUTE } = PALETTE

const idOf = (r) => r.reminder_id || r.inspection_id || r.recordId

// The org-level switch is one row rather than a per-reminder setting, and this
// portal's store has no settings kind. It is written under the inspection kind
// with neither an inspection_number nor a next_due, which is precisely what
// makes both registers ignore it — Inspection Reports skips rows with no
// number, and `asReminder` below drops rows with nothing due.
const SETTING_ID = 'inspection-auto-wo'

// Reminders are generated from the inspection types already in use and the
// assets they apply to, so the forward schedule is consistent with the history
// behind it rather than being a second, unrelated list.
const REMINDERS = ASSETS.filter((a) => a.criticality !== 'Low').slice(0, 30).map((a, i) => {
  const k = `rem-${i}`
  const due = daysFrom(between(k + 'd', -14, 60))
  return {
    reminder_id: `rem_${String(i + 1).padStart(3, '0')}`,
    inspection_type: pick(k + 't', INSPECTION_TYPES),
    asset_id: a.asset_id,
    asset_name: a.asset_name,
    asset_code: a.asset_code,
    site_id: a.site_id,
    site_name: a.site_name,
    frequency: pick(k + 'f', ['Daily', 'Weekly', 'Monthly', 'Quarterly']),
    assigned_to_name: pick(k + 'as', TECHNICIANS).name,
    last_completed: daysFrom(-between(k + 'lc', 3, 120)),
    next_due: due,
    notify_days_before: pick(k + 'n', [1, 3, 7]),
    status: pick(k + 's', ['Active', 'Active', 'Active', 'Paused']),
  }
})

// This screen and Inspection Reports write into the same record kind. A run
// filed as a report must not come back here as a reminder with no due date, and
// an inspection booked from the New reminder button must — so the test is
// whether the row is still ahead of somebody.
const asReminder = (r) => {
  if (r.next_due) return r
  if (r.status !== 'Scheduled' || !r.scheduled_date) return null
  const asset = ASSETS.find((a) => a.asset_id === r.asset_id)
  return {
    ...r,
    next_due: r.scheduled_date,
    frequency: r.frequency || frequencyFor(r.inspection_type),
    assigned_to_name: r.assigned_to_name || r.inspector_name || '',
    asset_code: r.asset_code || asset?.asset_code || '',
    site_name: r.site_name || asset?.site_name || '',
    notify_days_before: r.notify_days_before || 1,
    last_completed: r.last_completed || null,
    status: 'Active',
  }
}

export default function InspectionReminder() {
  const { scope } = useSite()
  const { create, update, records, ready, notify } = useStore()

  const [tab, setTab] = useState('active')
  const [cardFilter, setCardFilter] = useState('total')
  const [search, setSearch] = useState('')
  const [freq, setFreq] = useState('all')
  const [due, setDue] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [open, setOpen] = useState(null)
  const [creating, setCreating] = useState(false)
  const [running, setRunning] = useState(null)

  const merged = useRecords('inspection', REMINDERS, idOf)
  const all = useMemo(() => scope(merged.map(asReminder).filter(Boolean)), [scope, merged])

  const stored = records?.inspection || []
  const setting = stored.find((r) => r.recordId === SETTING_ID)
  const autoWorkOrder = Boolean(setting?.autoWorkOrder)

  const active = all.filter((r) => r.status !== 'Paused')
  const paused = all.filter((r) => r.status === 'Paused')
  const overdue = active.filter((r) => isPast(r.next_due))

  // Everything still ahead of somebody, soonest first — the product's Next Due
  // tab is a queue, not a register, so it is ordered by when rather than by id.
  const nextDue = useMemo(() => active
    .map((r) => ({ ...r, _daysAway: daysUntil(r.next_due) }))
    .sort((a, b) => a._daysAway - b._daysAway), [active])

  const base = tab === 'paused' ? paused
    : cardFilter === 'paused' ? paused
      : cardFilter === 'active' ? active
        : tab === 'active' ? active : all

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return base.filter((r) => {
      const late = isPast(r.next_due)
      const soon = !late && daysUntil(r.next_due) <= 7
      if (due === 'Overdue' && !late) return false
      if (due === 'Due this week' && !soon) return false
      if (due === 'Upcoming' && (late || soon)) return false
      return (freq === 'all' || r.frequency === freq)
        && (!q || [r.inspection_type, r.asset_name, r.asset_code, r.assigned_to_name, r.site_name]
          .filter(Boolean).join(' ').toLowerCase().includes(q))
    })
  }, [base, search, freq, due])

  // Any narrowing puts the reader on a page that may no longer exist.
  useEffect(() => { setPage(1) }, [tab, cardFilter, search, freq, due, pageSize])

  const source = tab === 'next-due' ? nextDue : rows
  const totalPages = Math.max(1, Math.ceil(source.length / pageSize))
  const paged = source.slice((page - 1) * pageSize, page * pageSize)

  const filtersOn = freq !== 'all' || due !== 'all'
  const isDue = (r) => isPast(r.next_due) || daysUntil(r.next_due) <= 7

  const subject = running && {
    key: idOf(running),
    label: running.asset_name,
    inspection_type: running.inspection_type,
    asset_id: running.asset_id,
    asset_name: running.asset_name,
    inspector_name: running.assigned_to_name,
  }

  const completeRun = async (summary) => {
    const days = FREQUENCY_DAYS[running.frequency] || FREQUENCY_DAYS[frequencyFor(running.inspection_type)]

    // Rolled forward first. If only one of the two writes survives, the one
    // worth keeping is the reminder — it is what the plant works from tomorrow.
    await update('inspection', idOf(running), {
      last_completed: daysFrom(0),
      next_due: daysFrom(days),
    })

    const reference = nextInspectionNumber(records?.inspection || [])
    await create('inspection', {
      ...summary,
      inspection_number: reference,
      inspection_type: running.inspection_type,
      scheduled_date: daysFrom(0),
      completed_date: daysFrom(0),
      status: 'Completed',
      from_reminder: idOf(running),
    })
    return reference
  }

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Inspection Reminders</h1>
          <p className="text-slate-600 mt-1 text-sm md:text-base">
            Manage and schedule your inspection reminder interval efficiently.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <Button variant="outline" className="h-10 px-4 gap-2"
            onClick={() => { setSearch(''); setFreq('all'); setDue('all'); setCardFilter('total'); notify('Filters cleared.') }}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button variant="outline" className="h-10 px-4 gap-2" onClick={() => exportCsv(source)}>
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button className="h-10 px-4 gap-2" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" />
            Create Reminder
          </Button>
        </div>
      </motion.div>

      {/* Org-level rather than per-reminder: the rule applies to every round
          this site walks, so it is one switch above the list. */}
      <Card className="shadow-sm border border-slate-200/60">
        <CardContent className="p-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[280px]">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Wrench className="w-4 h-4 text-slate-500" />
              Auto-create Work Order for failed inspections
            </div>
            <p className="text-sm text-slate-600 mt-1">
              When enabled, completing an inspection with failed or out-of-spec items automatically
              creates a work order for those items.
            </p>
          </div>
          <Switch
            checked={autoWorkOrder}
            disabled={!ready}
            onCheckedChange={(checked) => update('inspection', SETTING_ID, {
              setting: 'auto_wo_failed_inspection', autoWorkOrder: checked,
            })}
          />
        </CardContent>
      </Card>

      {/* Contextual to the running side of the register. Hidden on Paused, where
          "Active: 26 / Paused: 4" beside a list of four is a misleading pair. */}
      {tab !== 'paused' && (
        <StatTiles
          rows={all}
          activeCard={cardFilter === 'total' ? null : cardFilter}
          onCardClick={(k) => setCardFilter(k || 'total')}
          storageKey="oxReminderSummaryCards"
          cards={[
            { id: 'total', title: 'Total Reminders', icon: ClipboardList, color: 'bg-slate-500', description: 'Every reminder on this register', total: true, value: all.length },
            { id: 'active', title: 'Active', icon: CheckCircle, color: 'bg-green-600', description: 'Running and raising inspections', value: active.length, match: (r) => r.status === 'Active' },
            { id: 'paused', title: 'Paused', icon: PauseCircle, color: 'bg-slate-600', description: 'Held, raising nothing', value: paused.length, match: (r) => r.status === 'Paused' },
          ]}
        />
      )}

      {overdue.length > 0 && (
        <AlertBand
          tone="red"
          title={`${overdue.length} Overdue Inspection Reminder${overdue.length > 1 ? 's' : ''}`}
          onClick={() => { setTab('active'); setDue('Overdue') }}
        >
          {overdue.length > 1 ? 'These rounds require' : 'This round requires'} immediate attention to
          maintain compliance. Every one of them is against an asset this site has already decided is
          not low criticality.
        </AlertBand>
      )}

      {/* Paused, not Archived. The product's third tab says Archived; this
          register's own word for a reminder nobody is being chased by is
          Paused, and it is the word the rows themselves carry. Putting the
          product's label over this register's flag would be a screen naming a
          state its data does not have. */}
      <ShadTabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3 h-12">
          {[
            { key: 'active', label: 'Active', Icon: ListChecks, count: active.length },
            { key: 'next-due', label: 'Next Due', Icon: CalendarClock, count: nextDue.length },
            { key: 'paused', label: 'Paused', Icon: PauseCircle, count: paused.length },
          ].map(({ key, label, Icon, count }) => (
            <TabsTrigger key={key} value={key} className="flex items-center gap-2">
              <Icon className="w-4 h-4" />
              {label}
              <Badge variant="secondary">{count}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </ShadTabs>

      {/* Next Due is a queue ordered by date, so it carries no filters of its
          own — narrowing a queue by frequency answers a question nobody asked
          of it. Filters belong to the register tabs. */}
      {tab !== 'next-due' && (
        <Card className="shadow-sm border border-slate-200/60">
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search inspection, asset, technician…"
                  className="pl-10 h-10 border-slate-300"
                />
              </div>

              <Select value={freq} onValueChange={setFreq}>
                <SelectTrigger className="h-10 w-[180px]">
                  <SelectValue placeholder="All Frequencies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Frequencies</SelectItem>
                  {['Daily', 'Weekly', 'Monthly', 'Quarterly'].map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={due} onValueChange={setDue}>
                <SelectTrigger className="h-10 w-[180px]">
                  <SelectValue placeholder="Any time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any time</SelectItem>
                  {['Overdue', 'Due this week', 'Upcoming'].map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(filtersOn || search) && (
                <Button
                  variant="outline"
                  className="h-10 px-4 gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => { setSearch(''); setFreq('all'); setDue('all') }}
                >
                  <X className="w-4 h-4" />
                  Clear
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>
                Showing <span className="font-semibold text-slate-800">{source.length}</span> of{' '}
                <span className="font-semibold text-slate-800">{all.length}</span> inspection reminders
              </span>
              {source.length !== all.length && (
                <span className="font-semibold text-[#15227a]">{all.length - source.length} filtered out</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {source.length === 0 ? (
        <Card className="shadow-sm border border-slate-200/60">
          <CardContent className="p-12 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
              {tab === 'paused'
                ? <PauseCircle className="w-7 h-7 text-slate-400" />
                : <Bell className="w-7 h-7 text-slate-400" />}
            </div>
            <h3 className="text-lg font-semibold text-slate-800">
              {tab === 'next-due' ? 'No Upcoming Reminders'
                : tab === 'paused' ? 'No Paused Reminders' : 'No Reminders Found'}
            </h3>
            <p className="text-sm text-slate-600 max-w-md">
              {tab === 'next-due'
                ? 'There are no inspection reminders due in the near future.'
                : tab === 'paused'
                  ? 'Every reminder on this register is running.'
                  : 'Try adjusting your search terms to find what you’re looking for.'}
            </p>
            {tab === 'active' && (
              <Button className="mt-1 gap-2" onClick={() => setCreating(true)}>
                <Plus className="w-4 h-4" />
                Add First Reminder
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        // One column. A reminder card carries three facts across its width, and
        // squeezing two side by side wraps every one of them onto its own line.
        <div className="grid gap-4 grid-cols-1">
          {paged.map((r, n) => (tab === 'next-due'
            ? <NextDueCard key={idOf(r)} reminder={r} index={n} onView={() => setOpen(r)} />
            : (
              <ReminderCard
                key={idOf(r)} reminder={r} index={n}
                onView={() => setOpen(r)} onStart={() => setRunning(r)}
              />
            )))}
        </div>
      )}

      <Pager
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        total={source.length}
        itemType={tab === 'next-due' ? 'next due inspection reminders' : 'inspection reminders'}
        onPage={setPage}
        onPageSize={(n) => { setPageSize(n); setPage(1) }}
      />

      <CreateModal kind="inspection" open={creating} onClose={() => setCreating(false)}
        onSubmit={(values) => create('inspection', values)} />

      <InspectionRunner
        open={Boolean(running)}
        onClose={() => setRunning(null)}
        subject={subject}
        onSubmit={completeRun}
      />

      <Drawer open={Boolean(open)} onClose={() => setOpen(null)} title={open?.inspection_type} subtitle={open?.asset_name}
        icon={sectionIcon('reminder', '#15227a')}
        footer={open && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11.5, color: MUTE }}>
              {itemCount(open.inspection_type)} items · every {FREQUENCY_DAYS[open.frequency] || 30} days
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <ActionButton variant="ghost" onClick={() => setOpen(null)}>Close</ActionButton>
              <ActionButton variant={isDue(open) ? 'primary' : 'ghost'}
                onClick={() => { setOpen(null); setRunning(open) }}>
                Start now
              </ActionButton>
            </div>
          </div>
        )}>
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <StatusBadge>{isPast(open.next_due) ? 'Overdue' : open.status}</StatusBadge>
              <StatusBadge tone="grey">{open.frequency}</StatusBadge>
            </div>
            <Fields rows={[
              ['Asset', `${open.asset_name} (${open.asset_code || '—'})`],
              ['Site', open.site_name],
              ['Frequency', open.frequency],
              ['Assigned to', open.assigned_to_name],
              ['Last completed', fmtDate(open.last_completed)],
              ['Next due', fmtDate(open.next_due)],
              ['Notify', `${open.notify_days_before} day${open.notify_days_before > 1 ? 's' : ''} before`],
              ['Checklist', `${itemCount(open.inspection_type)} items`],
            ]} />
            {isPast(open.next_due) && (
              <p style={{ margin: 0, padding: '9px 12px', fontSize: 12.5, lineHeight: 1.5, borderRadius: 9, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
                {Math.abs(daysUntil(open.next_due))} days late. Starting it now files the report against {open.asset_name} and moves the next due date on by
                {' '}{FREQUENCY_DAYS[open.frequency] || 30} days.
              </p>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}

/**
 * Export.
 *
 * What is on screen, not the whole register — the button sits beside the
 * filters, and a file that ignores them is a file whose numbers do not match
 * the page the reader was looking at when they asked for it.
 */
function exportCsv(rows) {
  const head = ['Inspection', 'Reference', 'Frequency', 'Status', 'Assigned To', 'Site', 'Asset', 'Last Completed', 'Next Due']
  const cell = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const body = rows.map((r) => [
    r.inspection_type, r.reminder_id || r.recordId,
    `${r.frequency} — every ${FREQUENCY_DAYS[r.frequency] || 30} days`,
    r.status, r.assigned_to_name, r.site_name, `${r.asset_name} (${r.asset_code || ''})`,
    r.last_completed, r.next_due,
  ].map(cell).join(','))

  const blob = new Blob([[head.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'inspection-reminders.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
