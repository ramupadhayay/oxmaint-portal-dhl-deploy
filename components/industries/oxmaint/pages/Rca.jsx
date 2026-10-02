'use client'

// Root Cause Analysis — why a failure happened, and what stops it repeating.
//
// The register is drawn as the product draws it: the two judgements first
// (has this happened before, was the asset in an acceptable state), then the
// cause category as the heading. The failure itself is deliberately not the
// title — a wall of analyses read by their failures is a wall of symptoms.
//
// The five-whys chain and the corrective actions live in the record rather than
// on the card, because they are what you read once you have decided which
// analysis to open.

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw, Download, Plus, Search, SlidersHorizontal, X, Activity,
  Shield, Calendar, AlertCircle, Cog,
} from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Card, CardContent } from '../ui/card'
import { Input } from '../ui/input'
import { Checkbox } from '../ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select'
import RcaCard from '../components/RcaCard'
import { Drawer, Fields, StatusBadge, PALETTE } from '../lib/kit'
import { Pager } from '../lib/reminderKit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { useRecords, useStore } from '../lib/store'
import { CreateModal } from '../lib/forms'
import {
  WORK_ORDERS, INSPECTIONS, TECHNICIANS, fmtDate, daysFrom, pick, money,
} from '../lib/data'

const { ACCENT, INK, MUTE, LINE, RED } = PALETTE

// The product's own six. An analysis filed under a category the product does not
// have is an analysis its filters cannot find, so the enum is copied rather than
// invented — the descriptive theme this portal writes lives alongside it.
const CATEGORIES = [
  'Environment Impact', 'Parts Damaged', 'Run to Failure',
  'Lack of maintenance', 'Operator/Employee Negligence', 'Other',
]

const METHODS = ['5 Whys', 'Fishbone']
const STATUSES = ['Open', 'In Review', 'Closed']

// Eight causal stories, each ending in a systemic cause rather than a person.
// Written out in full rather than assembled from fragments: a five-level chain
// stitched together at random reads as five unrelated sentences, and the whole
// value of a 5-Whys is that each line follows from the one above it.
const CHAINS = [
  {
    theme: 'Lubrication',
    rootCauseCategory: 'Lack of maintenance',
    levels: [
      { because: 'The bearing was running without an adequate oil film.', category: 'Machine' },
      { because: 'The grease in the housing had broken down and lost its load-carrying capacity.', category: 'Material' },
      { because: 'The lubrication interval came from the manufacturer default rather than the duty this machine actually runs.', category: 'Method' },
      { because: 'Nobody revisited the interval when the line moved to a three-shift pattern.', category: 'People' },
      { because: 'Lubrication intervals are not reviewed when the production pattern changes.', category: 'Method' },
    ],
    actions: [
      { what: 'Shorten the lubrication interval on this asset and its sister units to match the current duty.', days: 10 },
      { what: 'Add an oil sample to the quarterly service and trend the result.', days: 20 },
      { what: 'Review every lubrication route against the current shift pattern.', days: 35 },
    ],
  },
  {
    theme: 'Contamination',
    rootCauseCategory: 'Lack of maintenance',
    levels: [
      { because: 'Abrasive particles reached the running surfaces.', category: 'Material' },
      { because: 'The filter element was well past its change-out point.', category: 'Machine' },
      { because: 'The filter change was on the schedule, but the schedule was deferred twice.', category: 'Method' },
      { because: 'Each deferral was approved on the day without anyone checking what the task protected against.', category: 'People' },
      { because: 'There is no rule setting out which preventive tasks may be deferred and which may not.', category: 'Method' },
    ],
    actions: [
      { what: 'Fit the correct filter and take a fluid sample before returning the machine to service.', days: 3 },
      { what: 'Mark filtration tasks as non-deferrable in the schedule.', days: 14 },
      { what: 'Report deferred preventive work to the maintenance manager weekly.', days: 21 },
    ],
  },
  {
    theme: 'Alignment',
    rootCauseCategory: 'Parts Damaged',
    levels: [
      { because: 'The coupling was running outside its alignment tolerance.', category: 'Machine' },
      { because: 'The machine was refitted after the last repair without a laser alignment check.', category: 'Method' },
      { because: 'The job card did not call for an alignment check on reassembly.', category: 'Method' },
      { because: 'The job card was written from memory rather than from the manufacturer procedure.', category: 'People' },
      { because: 'Standard job plans are not held against the asset type.', category: 'Method' },
    ],
    actions: [
      { what: 'Realign the drive train and record the readings against the asset.', days: 5 },
      { what: 'Add an alignment step with a stated tolerance to the job plan for this asset type.', days: 21 },
      { what: 'Build standard job plans for the ten most critical asset types.', days: 60 },
    ],
  },
  {
    theme: 'Overload',
    rootCauseCategory: 'Environment Impact',
    levels: [
      { because: 'The motor drew current above its rated load for a sustained period.', category: 'Machine' },
      { because: 'The driven equipment was running against a partly blocked discharge.', category: 'Machine' },
      { because: 'The blockage built up between cleaning intervals.', category: 'Method' },
      { because: 'The cleaning interval was set when the plant ran a cleaner feedstock.', category: 'Environment' },
      { because: 'Changes in what the plant processes are not fed back into the maintenance strategy.', category: 'Method' },
    ],
    actions: [
      { what: 'Clear the discharge and inspect the impeller for wear.', days: 2 },
      { what: 'Halve the cleaning interval and review the result after two months.', days: 14 },
      { what: 'Add a maintenance review step to the process change procedure.', days: 45 },
    ],
  },
  {
    theme: 'Instrumentation',
    rootCauseCategory: 'Other',
    levels: [
      { because: 'The protection trip did not act at its set point.', category: 'Machine' },
      { because: 'The transmitter had drifted outside its calibration tolerance.', category: 'Measurement' },
      { because: 'The instrument was overdue for calibration.', category: 'Method' },
      { because: 'It is not on the calibration register, so nothing chased it.', category: 'Measurement' },
      { because: 'The instrument register was never reconciled against the asset register.', category: 'Method' },
    ],
    actions: [
      { what: 'Calibrate the transmitter and prove the trip at its set point.', days: 4 },
      { what: 'Add every protective instrument on this line to the calibration register.', days: 30 },
      { what: 'Reconcile the instrument register against the asset register.', days: 60 },
    ],
  },
  {
    theme: 'Wear to failure',
    rootCauseCategory: 'Run to Failure',
    levels: [
      { because: 'A wear part reached the end of its life in service rather than on a plan.', category: 'Machine' },
      { because: 'No condition limit was recorded for the part, so wear was only found on failure.', category: 'Measurement' },
      { because: 'Inspections recorded a pass or a fail but never a measurement.', category: 'Method' },
      { because: 'The inspection form has no field for a measured value.', category: 'Measurement' },
      { because: 'Inspection forms were built to evidence compliance, not to trend condition.', category: 'Method' },
    ],
    actions: [
      { what: 'Replace the worn part and record the measurement taken at fitting.', days: 7 },
      { what: 'Add measured values with limits to the inspection form for this asset type.', days: 25 },
      { what: 'Trend six months of measurements and set a replacement threshold.', days: 40 },
    ],
  },
  {
    theme: 'Return to service',
    rootCauseCategory: 'Operator/Employee Negligence',
    levels: [
      { because: 'The seal faces ran dry.', category: 'Machine' },
      { because: 'The seal flush was isolated during the last intervention and never restored.', category: 'People' },
      { because: 'The return-to-service check did not include the seal flush.', category: 'Method' },
      { because: 'Return-to-service checks are informal and vary between technicians.', category: 'People' },
      { because: 'There is no standard return-to-service checklist for rotating equipment.', category: 'Method' },
    ],
    actions: [
      { what: 'Replace the seal and prove the flush before restart.', days: 2 },
      { what: 'Write a return-to-service checklist for rotating equipment.', days: 21 },
      { what: 'Make the checklist a required attachment on close-out for this asset class.', days: 35 },
    ],
  },
  {
    theme: 'Temporary defeat',
    rootCauseCategory: 'Operator/Employee Negligence',
    levels: [
      { because: 'The machine was started with a protective device inhibited.', category: 'Machine' },
      { because: 'The inhibit was applied while tracing a fault and never removed.', category: 'People' },
      { because: 'There is no log of temporary inhibits.', category: 'Method' },
      { because: 'A temporary defeat was treated as part of the fault-finding job rather than a controlled change.', category: 'People' },
      { because: 'Temporary modifications sit outside the change control process.', category: 'Method' },
    ],
    actions: [
      { what: 'Remove the inhibit and prove the protection before the next run.', days: 1 },
      { what: 'Open a register of temporary defeats with a mandatory review date.', days: 20 },
      { what: 'Bring temporary modifications into the change control process.', days: 50 },
    ],
  },
]

const numberOf = (id) => Number(String(id).replace(/\D/g, '')) || 0

const idOf = (r) => r.rca_id || r.recordId

// Cost impact is derived, not stored: what the job itself booked, plus an hour
// of unplanned downtime against the plant rate. A breakdown still being worked
// has no downtime figure yet — that is only known once it is finished — so the
// estimate falls back to the hours planned for it rather than printing the bare
// fixed cost against every open job.
const HOURLY_DOWNTIME = 1200
const PER_FINDING = 450

const breakdownCost = (w) => w.total_cost
  + (w.downtime_hours ? w.downtime_hours * HOURLY_DOWNTIME : w.estimated_hours * HOURLY_DOWNTIME)

export default function Rca() {
  const { scope } = useSite()
  const { create, notify } = useStore()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [recurringOnly, setRecurringOnly] = useState(false)
  const [condition, setCondition] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(9)
  const [openId, setOpenId] = useState(null)
  const [creating, setCreating] = useState(false)

  const seeded = useMemo(() => {
    const failed = scope(INSPECTIONS).filter((i) => i.result === 'Fail')
    const breakdowns = scope(WORK_ORDERS).filter((w) => w.work_order_type === 'Breakdown')

    const build = (key, base) => {
      const chain = pick(key + 'ch', CHAINS)
      return {
        ...base,
        rca_id: key,
        method: pick(key + 'm', METHODS),
        theme: chain.theme,
        root_cause_category: chain.rootCauseCategory,
        levels: chain.levels,
        // The root cause is the last why, and the ones above it are what let it
        // reach the plant. Read off the chain rather than stored twice.
        root_cause_description: chain.levels[chain.levels.length - 1].because,
        contributing_factors: chain.levels.slice(1, -1).map((l) => l.because).join(' '),
        actions: chain.actions.map((a, n) => ({
          ...a,
          action_id: `${key}-a${n}`,
          owner: pick(`${key}-ao${n}`, TECHNICIANS).name,
          due: daysFrom(a.days),
          status: n === 0 ? 'In Progress' : 'Open',
        })),
      }
    }

    // The reference is derived from the source record rather than from a running
    // count, so RCA-1042 stays RCA-1042 when the site filter changes the list.
    const fromInspections = failed.map((i) => build(`rca-i-${i.inspection_id}`, {
      reference: `RCA-${1000 + numberOf(i.inspection_id)}`,
      asset_id: i.asset_id,
      asset_name: i.asset_name,
      site_id: i.site_id,
      site_name: i.site_name,
      problem: `${i.inspection_type} failed on ${i.asset_name} — ${i.findings_count} ${i.findings_count === 1 ? 'finding' : 'findings'} raised`,
      owner: i.inspector_name,
      raised: i.scheduled_date,
      source: `Inspection ${i.inspection_number} · scored ${i.score}%`,
      inspection_number: i.inspection_number,
      // Three findings is where this register stops calling an asset acceptable.
      asset_condition_satisfactory: i.findings_count < 3,
      estimated_cost_impact: i.findings_count * PER_FINDING + 200,
      status: pick(`rca-is-${i.inspection_id}`, ['Open', 'Open', 'In Review', 'Closed']),
    }))

    const fromBreakdowns = breakdowns.map((w) => build(`rca-w-${w.workorder_id}`, {
      reference: `RCA-${2000 + numberOf(w.workorder_id)}`,
      asset_id: w.asset_id,
      asset_name: w.asset_name,
      site_id: w.site_id,
      site_name: w.site_name,
      problem: w.title,
      owner: w.assigned_to_name,
      raised: w.created_date,
      // Downtime is only recorded once the job is finished. Printing "0 h
      // downtime" beside a five-figure cost impact reads as a contradiction,
      // so an unfinished job cites the hours planned for it instead.
      source: `Breakdown ${w.work_order_number} · ${w.downtime_hours
        ? `${w.downtime_hours} h downtime` : `${w.estimated_hours} h planned`}`,
      work_order_number: w.work_order_number,
      // A breakdown is by definition an asset that did not stay in service.
      asset_condition_satisfactory: false,
      estimated_cost_impact: breakdownCost(w),
      // A breakdown analysis cannot be more finished than the job it came from.
      status: w.status === 'Completed' || w.status === 'Cancelled' ? 'Closed'
        : w.status === 'In Progress' ? 'In Review' : 'Open',
    }))

    const list = [...fromBreakdowns, ...fromInspections]
      .sort((a, b) => new Date(b.raised) - new Date(a.raised))

    // Recurrence is a property of the register, not of the row, so it is only
    // knowable once the whole list exists — which is why it is stamped here
    // rather than inside build().
    const perAsset = new Map()
    list.forEach((r) => perAsset.set(r.asset_name, (perAsset.get(r.asset_name) || 0) + 1))
    return list.map((r) => ({ ...r, is_recurring_issue: perAsset.get(r.asset_name) > 1 }))
  }, [scope])

  const merged = useRecords('rca', seeded, idOf)
  const all = useMemo(() => scope(merged), [scope, merged])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((r) => (
      (category === 'all' || r.root_cause_category === category)
      && (status === 'all' || r.status === status)
      && (!recurringOnly || r.is_recurring_issue)
      && (condition === null || r.asset_condition_satisfactory === condition)
      && (!q || [r.reference, r.asset_name, r.problem, r.owner, r.theme, r.root_cause_category,
        r.root_cause_description].filter(Boolean).join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, category, status, recurringOnly, condition])

  // Any narrowing puts the reader on a page that may no longer exist.
  useEffect(() => { setPage(1) }, [search, category, status, recurringOnly, condition, pageSize])

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const paged = rows.slice((page - 1) * pageSize, page * pageSize)

  const open = all.find((r) => idOf(r) === openId) || null

  const activeFilters = [
    search && { label: `Search "${search}"`, clear: () => setSearch('') },
    category !== 'all' && { label: `Category: ${category}`, clear: () => setCategory('all') },
    status !== 'all' && { label: `Status: ${status}`, clear: () => setStatus('all') },
    recurringOnly && { label: 'Recurring: Yes', clear: () => setRecurringOnly(false) },
    condition !== null && {
      label: `Asset condition: ${condition ? 'Satisfactory' : 'Unsatisfactory'}`,
      clear: () => setCondition(null),
    },
  ].filter(Boolean)

  const clearAll = () => {
    setSearch(''); setCategory('all'); setStatus('all')
    setRecurringOnly(false); setCondition(null)
  }

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Root Cause Analysis</h1>
          <p className="text-slate-600 mt-1 text-sm md:text-base">
            Investigate why failures happened, and record what will stop them repeating
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <Button variant="outline" className="h-10 px-4 gap-2"
            onClick={() => { clearAll(); notify('Filters cleared.') }}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button variant="outline" className="h-10 px-4 gap-2" onClick={() => exportCsv(rows)}>
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button className="h-10 px-4 gap-2" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" />
            Create RCA
          </Button>
        </div>
      </motion.div>

      <Card className="shadow-sm border border-slate-200/60">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reference, asset, problem, cause…"
                className="pl-10 h-10 border-slate-300"
              />
            </div>

            <Button variant="outline" className="h-10 px-4 gap-2"
              onClick={() => setShowFilters((v) => !v)}>
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {activeFilters.length > 0 && (
                <Badge variant="secondary" className="ml-1 bg-primary text-white">
                  {activeFilters.length}
                </Badge>
              )}
            </Button>

            {activeFilters.length > 0 && (
              <Button variant="outline"
                className="h-10 px-4 gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={clearAll}>
                <X className="w-4 h-4" />
                Clear
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between text-sm text-slate-600 mb-4">
            <span>
              Showing <span className="font-semibold text-slate-800">{rows.length}</span> of{' '}
              <span className="font-semibold text-slate-800">{all.length}</span> RCAs
            </span>
            {rows.length !== all.length && (
              <span className="font-semibold text-[#15227a]">{all.length - rows.length} filtered out</span>
            )}
          </div>

          {activeFilters.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <span className="text-sm text-slate-600">Active filters:</span>
              {activeFilters.map((f) => (
                <Badge key={f.label} variant="secondary"
                  className="bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer gap-1"
                  onClick={f.clear}>
                  {f.label}
                  <X className="w-3 h-3" />
                </Badge>
              ))}
            </div>
          )}

          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              className="border-t border-slate-200 pt-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Root cause category
                  </label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Status
                  </label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <AlertCircle className="w-4 h-4 text-slate-700" />
                  <span className="text-sm font-medium text-slate-700">Recurring issue</span>
                  <Checkbox checked={recurringOnly} onCheckedChange={(v) => setRecurringOnly(v === true)} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Cog className="w-4 h-4" />
                    Asset condition
                  </label>
                  <div className="flex items-center gap-2">
                    {/* Pressing the badge that is already on clears it: the pair
                        is a three-state filter, and there is otherwise no way
                        back to "either". */}
                    <Badge
                      className={`text-sm px-2 py-1 cursor-pointer ${condition === true
                        ? 'text-green-800 bg-green-200' : 'text-slate-400 bg-slate-100'}`}
                      onClick={() => setCondition(condition === true ? null : true)}
                    >
                      Satisfactory
                    </Badge>
                    <Badge
                      className={`text-sm px-2 py-1 cursor-pointer ${condition === false
                        ? 'text-red-800 bg-red-200' : 'text-slate-400 bg-slate-100'}`}
                      onClick={() => setCondition(condition === false ? null : false)}
                    >
                      Unsatisfactory
                    </Badge>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 shadow-none">
          <CardContent className="text-center py-12">
            <Activity className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-400 mb-4">
              No root cause analyses match these filters
            </h3>
            <Button className="gap-2 mx-auto" onClick={() => setCreating(true)}>
              <Plus className="w-4 h-4" />
              Create RCA
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paged.map((r, n) => (
            <RcaCard key={idOf(r)} rca={r} index={n} onView={() => setOpenId(idOf(r))} />
          ))}
        </div>
      )}

      <Pager
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        total={rows.length}
        itemType="root cause analyses"
        onPage={setPage}
        onPageSize={(n) => { setPageSize(n); setPage(1) }}
      />

      <CreateModal kind="rca" open={creating} onClose={() => setCreating(false)}
        onSubmit={(values) => create('rca', values)} />

      <Drawer
        open={Boolean(open)} onClose={() => setOpenId(null)}
        title={open?.reference}
        subtitle={open?.problem}
        icon={sectionIcon('rca', '#15227a')}
        width={560}
      >
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatusBadge>{open.status}</StatusBadge>
              <StatusBadge tone="violet">{open.method}</StatusBadge>
              <StatusBadge tone="grey">{open.root_cause_category}</StatusBadge>
              {open.is_recurring_issue && <StatusBadge tone="red">Recurring</StatusBadge>}
            </div>

            <Fields rows={[
              ['Asset', open.asset_name],
              ['Site', open.site_name],
              ['Owner', open.owner],
              ['Raised', fmtDate(open.raised)],
              ['Source record', open.source],
              ['Asset condition', open.asset_condition_satisfactory ? 'Satisfactory' : 'Unsatisfactory'],
              ['Estimated cost impact', money(open.estimated_cost_impact)],
              ['Corrective actions', open.actions?.length ?? 0],
            ]} />

            {open.method === 'Fishbone' && (
              <p style={{ margin: 0, fontSize: 12, color: MUTE, lineHeight: 1.5 }}>
                Charted on a fishbone in the review meeting. The chain below is the same evidence read
                as five whys, with the fishbone category kept against each level.
              </p>
            )}

            {open.levels?.length > 0 && (
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>Five whys</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {open.levels.map((lv, i) => {
                    const question = i === 0 ? open.problem : open.levels[i - 1].because
                    const last = i === open.levels.length - 1
                    return (
                      <div key={lv.because} style={{ display: 'flex', gap: 11, alignItems: 'stretch' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: '50%', flexShrink: 0, fontSize: 11, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: last ? RED : '#e8ecff', color: last ? '#fff' : ACCENT,
                          }}>{i + 1}</div>
                          {!last && <div style={{ width: 2, flex: 1, minHeight: 14, background: LINE }} />}
                        </div>
                        <div style={{ paddingBottom: last ? 0 : 14, minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 11.5, color: MUTE, lineHeight: 1.45 }}>
                            Why — {question}
                          </div>
                          <div style={{ fontSize: 13, color: INK, fontWeight: 600, lineHeight: 1.5, marginTop: 3 }}>
                            Because {lv.because.charAt(0).toLowerCase()}{lv.because.slice(1)}
                          </div>
                          <div style={{ marginTop: 5 }}>
                            <StatusBadge tone={last ? 'red' : 'grey'}>{last ? `Root cause · ${lv.category}` : lv.category}</StatusBadge>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {open.actions?.length > 0 && (
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Corrective actions</div>
                {open.actions.map((a) => (
                  <div key={a.action_id} style={{ padding: '10px 0', borderBottom: `1px solid ${LINE}` }}>
                    <div style={{ fontSize: 12.5, color: INK, fontWeight: 600, lineHeight: 1.45 }}>{a.what}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                      <StatusBadge>{a.status}</StatusBadge>
                      <span style={{ fontSize: 11.5, color: MUTE }}>{a.owner} · due {fmtDate(a.due)}</span>
                    </div>
                  </div>
                ))}
              </div>
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
 * filters, and a file that ignores them is a file whose numbers do not match the
 * page the reader was looking at when they asked for it.
 */
function exportCsv(rows) {
  const head = ['Reference', 'Category', 'Root cause', 'Analysis method', 'Recurring',
    'Asset condition', 'Asset', 'Site', 'Owner', 'Status', 'Cost impact', 'Raised']
  const cell = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const body = rows.map((r) => [
    r.reference, r.root_cause_category, r.root_cause_description, r.method,
    r.is_recurring_issue ? 'Yes' : 'No',
    r.asset_condition_satisfactory ? 'Satisfactory' : 'Unsatisfactory',
    r.asset_name, r.site_name, r.owner, r.status, r.estimated_cost_impact, r.raised,
  ].map(cell).join(','))

  const blob = new Blob([[head.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'root-cause-analyses.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
