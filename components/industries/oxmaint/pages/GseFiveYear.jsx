'use client'

// Five-Year Performance — the station's maintenance history read back as a
// handful of trends, the way the workbook's dashboard tabs present it.
//
// Five years of work orders is too much to read and too little to argue with
// if it is only ever summed. A single total hides that a year was partial, that
// downtime climbs every winter, or that a cheap-to-buy dolly has cost more in
// repairs than it did new. So every figure that exists month by month can be
// narrowed to one calendar year, and the first and last years say how many
// months they hold rather than looking like a collapse or a spike.
//
// Figures that only exist as five-year totals — the fleet by type and maker,
// unscheduled work by system, out-of-service reasons, vendor spend — are labelled
// "5 years" and do not move with the year selector. Pretending they filter would
// be worse than showing them whole.
//
// The out-of-service log leads with ramp control notification, not hours,
// because that is the question an airline audit asks of it: when a unit came off
// the line, was the ramp told? Wrench time, the come-back rate and aftermarket
// share are measured against the station's own planning assumptions, never
// against an industry figure the station did not choose.
//
// Read-only. Per-person labour, warranty claims and part sourcing each have a
// screen of their own; this one links to them rather than repeating them.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Wrench, RotateCcw, AlertTriangle, Clock, DollarSign, ClipboardList, Truck, Zap,
  Gauge, Users, Moon, Package, Boxes, ShoppingCart, ShieldCheck, Scale, Loader2,
  ArrowUp, ArrowDown, ArrowRight, Activity, Layers,
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { GSE_ACTIVE } from '../lib/gse'
import { loadGseAnalytics, money, ORG } from '../lib/data'
import ModuleOff from '../components/ModuleOff'

const SELECT = 'h-10 px-3 rounded-md border border-slate-200 text-sm bg-white outline-none focus:border-primary/40'
const YEARS_OF_HISTORY = 5

const ratio = (n, d) => (d > 0 ? n / d : null)
const pct = (v, d = 1) => (v === null || !Number.isFinite(v) ? '—'
  : `${(v * 100).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}%`)
const num = (v, d = 0) => (v === null || !Number.isFinite(v) ? '—'
  : v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }))
const int = (v) => (Number.isFinite(v) ? Math.round(v).toLocaleString('en-US') : '—')
// A loss reads as −$19,872, not $-19,872.
const signedMoney = (v) => (Number.isFinite(v) ? `${v < 0 ? '−' : v > 0 ? '+' : ''}${money(Math.abs(v))}` : '—')
// Chart labels only — the tooltip carries the exact figure.
const shortMoney = (v) => {
  if (!Number.isFinite(v)) return '—'
  if (Math.abs(v) >= 1e6) return `${ORG.currency_symbol}${(v / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 })}M`
  if (Math.abs(v) >= 1e3) return `${ORG.currency_symbol}${Math.round(v / 1e3).toLocaleString('en-US')}k`
  return money(v)
}
const yearLabel = (y) => (y.months < 12 ? `${y.year} (${y.months} mo)` : String(y.year))

// Round a chart maximum up to a readable step (1, 1.5, 2, 2.5 … 10 × a power of ten).
const niceMax = (v) => {
  if (!(v > 0)) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  const f = v / p
  return ([1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => f <= s) || 10) * p
}

const STATUS_LOOK = {
  'In Service': 'bg-emerald-100 text-emerald-800',
  'Out of Service': 'bg-red-100 text-red-800',
  'PM Due': 'bg-amber-100 text-amber-800',
  'Seasonal Storage': 'bg-slate-100 text-slate-700',
}
const OPEN_STATES = [
  ['QA Review', 'bg-blue-500'],
  ['In Progress', 'bg-emerald-500'],
  ['Parts Hold', 'bg-amber-500'],
  ['Assigned', 'bg-violet-500'],
]

const GROUP_COLUMNS = [
  { key: 'units', label: 'Units', fmt: int },
  { key: 'acquisition', label: 'Acquisition', fmt: money },
  { key: 'avgCost', label: 'Avg unit cost', fmt: money },
  { key: 'maintenance', label: 'Maintenance 5y', fmt: money },
  { key: 'maintPct', label: '% of acquisition', fmt: (v) => pct(v) },
  { key: 'perUnitYear', label: 'Per unit / yr', fmt: money },
  { key: 'downtime', label: 'Downtime h', fmt: int },
  { key: 'unscheduled', label: 'Unscheduled', fmt: int },
]

export default function GseFiveYear() {
  const router = useRouter()
  const [a, setA] = useState(null)
  const [tab, setTab] = useState('work')
  const [year, setYear] = useState('all')
  const [typeSort, setTypeSort] = useState({ key: 'maintenance', dir: 'desc' })
  const [makerSort, setMakerSort] = useState({ key: 'maintenance', dir: 'desc' })
  const [allTypes, setAllTypes] = useState(false)
  const [allMakers, setAllMakers] = useState(false)
  const [allReasons, setAllReasons] = useState(false)

  const enabled = GSE_ACTIVE && Boolean(loadGseAnalytics)

  useEffect(() => {
    if (!enabled) return
    let live = true
    loadGseAnalytics().then((r) => { if (live) setA(r) })
    return () => { live = false }
  }, [enabled])

  const fy = a?.fiveYear || null

  // Every monthly field summed over the selected period.
  const period = useMemo(() => {
    if (!fy) return null
    const ms = year === 'all' ? fy.months : fy.months.filter((m) => m.year === Number(year))
    const s = { monthCount: ms.length }
    ms.forEach((m) => Object.entries(m).forEach(([k, v]) => {
      if (typeof v === 'number' && k !== 'year') s[k] = (s[k] || 0) + v
    }))
    return s
  }, [fy, year])

  const withRatios = (rows) => rows.map((r) => ({
    ...r,
    avgCost: ratio(r.acquisition, r.units),
    maintPct: ratio(r.maintenance, r.acquisition),
    perUnitYear: r.units > 0 ? r.maintenance / r.units / YEARS_OF_HISTORY : null,
  }))
  const byType = useMemo(() => sortRows(withRatios(fy?.fleet.byType || []), typeSort), [fy, typeSort])
  const byMaker = useMemo(() => sortRows(withRatios(fy?.fleet.byManufacturer || []), makerSort), [fy, makerSort])

  if (!enabled) return <ModuleOff module="Five-year performance" />

  if (!fy || !period) {
    return (
      <div className="max-w-8xl mx-auto p-6 space-y-6">
        <Header />
        <div className="flex items-center gap-2 py-16 justify-center text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading five years of history…
        </div>
      </div>
    )
  }

  const targets = a.targets || {}
  const { fleet, work, labour, parts, represented } = fy
  const selYear = year === 'all' ? null : fy.years.find((y) => y.year === Number(year))
  const periodLabel = selYear ? yearLabel(selYear) : '5 years'
  const range = `${fy.months[0]?.label} – ${fy.months[fy.months.length - 1]?.label}`

  // ── Work & downtime ──
  const workOrders = period.preventive + period.unscheduled
  const comebackRate = ratio(period.comebacks, period.unscheduled)
  const notNotifiedShare = ratio(period.oosNotNotified, period.oosEvents)
  const closedNow = work.statusNow.Closed || 0
  const openNow = Object.entries(work.statusNow).reduce((n, [k, v]) => (k === 'Closed' ? n : n + v), 0)
  const systemMaxCost = Math.max(0, ...work.bySystem.map((s) => s.cost))
  const systems = [...work.bySystem].sort((x, y) => y.cost - x.cost)
  const reasonsNotNotified = work.oosReasons.reduce((n, r) => n + r.notNotified, 0)
  const reasonsEvents = work.oosReasons.reduce((n, r) => n + r.events, 0)
  const reasonRate = ratio(reasonsNotNotified, reasonsEvents)
  const reasons = allReasons ? work.oosReasons : work.oosReasons.slice(0, 12)

  // ── Labour ──
  const wrench = ratio(period.labourHours, period.scheduledHours)
  const nightShare = ratio(period.nightHours, period.labourHours)

  // ── Fleet ──
  const classTotals = Object.entries(represented?.classTotals || {})
    .filter(([k, v]) => !/total/i.test(k) && v > 0)
  const fullFleet = classTotals.reduce((n, [, v]) => n + v, 0)

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <Header range={range} />
        {tab !== 'fleet' && (
          <select value={year} onChange={(e) => setYear(e.target.value)} className={`${SELECT} w-fit`} aria-label="Period">
            <option value="all">All five years</option>
            {fy.years.map((y) => <option key={y.year} value={y.year}>{yearLabel(y)}</option>)}
          </select>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full lg:w-[44rem] grid-cols-2 lg:grid-cols-4 h-auto lg:h-11">
          <TabsTrigger value="work" className="flex items-center gap-2 h-9"><Wrench className="w-4 h-4" /> Work &amp; downtime</TabsTrigger>
          <TabsTrigger value="fleet" className="flex items-center gap-2 h-9"><Truck className="w-4 h-4" /> Fleet</TabsTrigger>
          <TabsTrigger value="labour" className="flex items-center gap-2 h-9"><Users className="w-4 h-4" /> Labour</TabsTrigger>
          <TabsTrigger value="parts" className="flex items-center gap-2 h-9"><Package className="w-4 h-4" /> Parts</TabsTrigger>
        </TabsList>

        {/* ── Work & downtime ─────────────────────────────────────────── */}
        <TabsContent value="work" className="space-y-6 mt-4">
          {period.oosEvents > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-900">
                  Ramp control not notified on {int(period.oosNotNotified)} of {int(period.oosEvents)} out-of-service
                  entries ({pct(notNotifiedShare, 0)}) · {periodLabel}
                </p>
                <p className="text-sm text-amber-800 mt-0.5">
                  An airline audit asks whether the ramp was told each time a unit came off the line.
                  These entries have no record that it was.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4">
            <Stat label="Work orders" value={int(workOrders)} sub={`${int(period.preventive)} preventive · ${int(period.unscheduled)} unscheduled`} Icon={ClipboardList} />
            <Stat
              label="Come-back rate" value={pct(comebackRate)}
              sub={`${int(period.comebacks)} of ${int(period.unscheduled)} unscheduled · standard ≤ ${pct(targets.comebackRate ?? 0.1, 0)}`}
              Icon={RotateCcw} tone={comebackRate === null ? null : comebackRate <= (targets.comebackRate ?? 0.1) ? 'green' : 'amber'}
            />
            <Stat label="Out of service" value={int(period.oosEvents)} sub={`events · ${num(period.oosHours)} h off the line`} Icon={AlertTriangle} />
            <Stat label="Downtime" value={`${num(period.downtime)} h`} sub={`on work orders · ${periodLabel}`} Icon={Clock} />
            <Stat label="Work order cost" value={money(period.woCost)} sub={`${money(period.labourCost)} labour · ${money(period.partsCost)} parts`} Icon={DollarSign} />
            <Stat label="Open work" value={int(openNow)} sub="work orders not yet closed, as of now" Icon={Activity} tone={openNow ? 'amber' : 'green'} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  Work orders by year
                  <span className="ml-auto text-sm font-normal text-slate-500">label = work order cost</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <YearBars
                  years={fy.years} sel={selYear?.year}
                  series={[
                    { key: 'preventive', label: 'Preventive', cls: 'bg-blue-500' },
                    { key: 'unscheduled', label: 'Unscheduled', cls: 'bg-amber-500' },
                  ]}
                  top={(y) => shortMoney(y.woCost)}
                  tip={(y) => `${yearLabel(y)}: ${int(y.preventive)} preventive, ${int(y.unscheduled)} unscheduled, ${money(y.woCost)}`}
                />
                <Legend items={[['Preventive', 'bg-blue-500'], ['Unscheduled', 'bg-amber-500']]} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Unscheduled share by year</CardTitle>
                <p className="text-sm text-slate-500">Unscheduled ÷ all work orders, with preventive jobs per unscheduled job.</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {fy.years.map((y) => {
                    const total = y.preventive + y.unscheduled
                    const share = ratio(y.unscheduled, total)
                    const pm = ratio(y.preventive, y.unscheduled)
                    return (
                      <div key={y.year} className={selYear && selYear.year !== y.year ? 'opacity-40' : ''} title={`${yearLabel(y)}: ${int(y.unscheduled)} of ${int(total)} work orders unscheduled`}>
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-slate-700 whitespace-nowrap">{yearLabel(y)}</span>
                          <span className="tabular-nums text-slate-500 whitespace-nowrap">
                            <strong className="text-slate-900 font-semibold">{pct(share, 0)}</strong>
                            {' · '}PM {pm === null ? '—' : num(pm, 1)} : 1
                          </span>
                        </div>
                        <div className="mt-1 h-2 w-full rounded-full bg-blue-100 overflow-hidden">
                          <div className="h-full rounded-full bg-amber-500" style={{ width: `${(share || 0) * 100}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                Month by month
                <span className="ml-auto text-sm font-normal text-slate-500">{range}{selYear ? ` · ${selYear.year} shaded` : ''}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <MonthLine months={fy.months} field="downtime" title="Downtime hours" stroke="#dc2626" fmt={(v) => `${num(v, 1)} h`} sel={selYear?.year} />
              <MonthLine months={fy.months} field="unscheduled" title="Unscheduled work orders" stroke="#d97706" fmt={int} sel={selYear?.year} />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <Layers className="w-5 h-5" />
                  Unscheduled work by system
                  <span className="ml-auto text-sm font-normal text-slate-500">5 years</span>
                </CardTitle>
                <p className="text-sm text-slate-500">Highest cost first. P1 = jobs raised at top priority.</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-2 pr-3 font-medium text-left">System</th>
                        <th className="py-2 pr-3 font-medium text-right">Jobs</th>
                        <th className="py-2 pr-3 font-medium text-right">Cost</th>
                        <th className="py-2 pr-3 font-medium text-right whitespace-nowrap">Downtime h</th>
                        <th className="py-2 font-medium text-right">P1</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {systems.map((s) => (
                        <tr key={s.system}>
                          <td className="py-2 pr-3 text-slate-900 whitespace-nowrap">{s.system}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{int(s.unscheduled)}</td>
                          <td className="py-2 pr-3 text-right">
                            <span className="block tabular-nums">{money(s.cost)}</span>
                            <span className="mt-1 ml-auto block h-1.5 w-20 rounded-full bg-slate-200 overflow-hidden">
                              <span className="block h-full rounded-full bg-amber-500" style={{ width: `${systemMaxCost ? (s.cost / systemMaxCost) * 100 : 0}%` }} />
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{num(s.downtime, 1)}</td>
                          <td className="py-2 text-right tabular-nums">{int(s.p1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Out of service by reason
                  <span className="ml-auto text-sm font-normal text-slate-500">5 years</span>
                </CardTitle>
                <p className="text-sm text-slate-500">
                  Not notified = no record that ramp control was told. {pct(reasonRate, 0)} across all reasons;
                  rates above that are shown in amber.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-2 pr-3 font-medium text-left">Reason</th>
                        <th className="py-2 pr-3 font-medium text-right">Events</th>
                        <th className="py-2 pr-3 font-medium text-right">Hours</th>
                        <th className="py-2 font-medium text-right whitespace-nowrap">Not notified</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reasons.map((r) => {
                        const share = ratio(r.notNotified, r.events)
                        return (
                          <tr key={r.reason}>
                            <td className="py-2 pr-3 text-slate-900 min-w-44">{r.reason}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{int(r.events)}</td>
                            <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{num(r.hours)}</td>
                            <td className="py-2 text-right tabular-nums whitespace-nowrap">
                              {int(r.notNotified)}
                              <span className={`ml-1 text-xs ${share !== null && reasonRate !== null && share > reasonRate ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}>
                                ({pct(share, 0)})
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {work.oosReasons.length > 12 && (
                  <Button variant="ghost" size="sm" onClick={() => setAllReasons((v) => !v)}>
                    {allReasons ? 'Show top 12' : `Show all ${work.oosReasons.length} reasons`}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                Workflow status now
                <span className="ml-auto text-sm font-normal text-slate-500">{int(closedNow)} closed · {int(openNow)} open</span>
              </CardTitle>
              <p className="text-sm text-slate-500">Where the work orders that are not closed are sitting today.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex h-3 w-full rounded-full bg-slate-200 overflow-hidden">
                {OPEN_STATES.map(([k, cls]) => (
                  <div key={k} className={cls} style={{ width: `${openNow ? ((work.statusNow[k] || 0) / openNow) * 100 : 0}%` }} title={`${k}: ${int(work.statusNow[k] || 0)}`} />
                ))}
              </div>
              <Legend items={OPEN_STATES.map(([k, cls]) => [`${k} ${int(work.statusNow[k] || 0)}`, cls])} />
              <p className="text-xs text-slate-500">
                {int(work.airlineAuditPack)} entries are held in the airline audit pack.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Fleet ───────────────────────────────────────────────────── */}
        <TabsContent value="fleet" className="space-y-6 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Units" value={int(fleet.units)} sub="in the asset register" Icon={Truck} />
            <Stat label="Acquisition value" value={money(fleet.acquisition)} sub={`${money(ratio(fleet.acquisition, fleet.units))} a unit on average`} Icon={DollarSign} />
            <Stat label="In service" value={int(fleet.status['In Service'] || 0)} sub={pct(ratio(fleet.status['In Service'] || 0, fleet.units), 0) + ' of units'} Icon={ShieldCheck} tone="green" />
            <Stat label="Out of service" value={int(fleet.status['Out of Service'] || 0)} sub="right now" Icon={AlertTriangle} tone={fleet.status['Out of Service'] ? 'red' : null} />
            <Stat label="PM due" value={int(fleet.status['PM Due'] || 0)} sub="right now" Icon={Wrench} tone={fleet.status['PM Due'] ? 'amber' : null} />
            <Stat label="Seasonal storage" value={int(fleet.status['Seasonal Storage'] || 0)} sub="stood down for the season" Icon={Boxes} />
            <Stat label="Electric units" value={int(fleet.electric)} sub={`${pct(ratio(fleet.electric, fleet.units), 0)} of units`} Icon={Zap} />
            <Stat label="Average hour meter" value={`${int(fleet.avgHoursMeter)} h`} sub="units with a meter" Icon={Gauge} />
          </div>

          {fullFleet > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              The register holds {int(fleet.units)} units, a working sample of the full CVG fleet of{' '}
              <strong className="text-slate-900">{int(fullFleet)} units</strong>
              {' '}({classTotals.map(([k, v]) => `${k} ${int(v)}`).join(' · ')})
              {represented.replacementValue ? <>, estimated replacement value <strong className="text-slate-900">{money(represented.replacementValue)}</strong></> : null}.
              Figures on this tab are for the {int(fleet.units)} registered units.
            </div>
          )}

          <GroupTable
            title="By equipment type" rows={byType} sort={typeSort} setSort={setTypeSort}
            nameLabel="Type" showClass all={allTypes} setAll={setAllTypes}
          />
          <GroupTable
            title="By manufacturer" rows={byMaker} sort={makerSort} setSort={setMakerSort}
            nameLabel="Manufacturer" all={allMakers} setAll={setAllMakers}
          />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <GroupBars title="By class" rows={fleet.byClass} />
            <GroupBars title="By power source" rows={fleet.byPower} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                Top {fleet.topUnits.length} units by maintenance cost
                <span className="ml-auto text-sm font-normal text-slate-500">5 years</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3 font-medium text-left">Unit</th>
                      <th className="py-2 pr-3 font-medium text-left">Status</th>
                      <th className="py-2 pr-3 font-medium text-right">Acquisition</th>
                      <th className="py-2 pr-3 font-medium text-right whitespace-nowrap">Maintenance 5y</th>
                      <th className="py-2 pr-3 font-medium text-right whitespace-nowrap">Downtime h</th>
                      <th className="py-2 pr-3 font-medium text-right">WOs</th>
                      <th className="py-2 pr-3 font-medium text-right">Unscheduled</th>
                      <th className="py-2 font-medium text-right">Come-backs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fleet.topUnits.map((u) => (
                      <tr
                        key={u.AssetID} className="cursor-pointer hover:bg-slate-50"
                        onClick={() => router.push(`/portal/oxmaint/assets/${encodeURIComponent(u.AssetID)}`)}
                      >
                        <td className="py-2.5 pr-3 min-w-52">
                          <span className="block font-medium text-primary">{u.asset_name || u.AssetID}</span>
                          <span className="block text-xs text-slate-500">{u.AssetID} · {u.EquipmentType} · {u.Manufacturer}</span>
                        </td>
                        <td className="py-2.5 pr-3"><Badge className={STATUS_LOOK[u.Status] || STATUS_LOOK['Seasonal Storage']}>{u.Status}</Badge></td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-slate-600">{money(u.acquisition)}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums font-semibold text-slate-900">{money(u.maintenance)}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{num(u.downtime, 1)}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{int(u.workOrders)}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{int(u.unscheduled)}</td>
                        <td className="py-2.5 text-right tabular-nums">{int(u.comebacks)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Labour ──────────────────────────────────────────────────── */}
        <TabsContent value="labour" className="space-y-6 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Labour hours" value={`${num(period.labourHours)} h`} sub={`recorded on jobs · ${periodLabel}`} Icon={Clock} />
            <Stat label="Labour cost" value={money(period.labourCost)} sub={`${money(ratio(period.labourCost, period.labourHours))} an hour on average`} Icon={DollarSign} />
            <Stat
              label="Wrench time" value={pct(wrench)}
              sub={`${num(period.labourHours)} of ${num(period.scheduledHours)} scheduled h · target ${pct(targets.wrenchTime ?? 0.65, 0)}`}
              Icon={Wrench} tone={wrench === null ? null : wrench >= (targets.wrenchTime ?? 0.65) ? 'green' : 'amber'}
            />
            <Stat
              label="Night share" value={pct(nightShare)}
              sub={`${num(period.nightHours)} h on nights · planning assumes ${pct(labour.nightBankShare, 0)}`}
              Icon={Moon}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                Labour hours by year
                <span className="ml-auto text-sm font-normal text-slate-500">label = wrench time</span>
              </CardTitle>
              <p className="text-sm text-slate-500">Wrench time = hours recorded on jobs ÷ scheduled shift hours.</p>
            </CardHeader>
            <CardContent>
              <YearBars
                years={fy.years} sel={selYear?.year}
                series={[{ key: 'labourHours', label: 'Hours', cls: 'bg-blue-500' }]}
                top={(y) => pct(ratio(y.labourHours, y.scheduledHours), 0)}
                topTone={(y) => (ratio(y.labourHours, y.scheduledHours) ?? 0) >= (targets.wrenchTime ?? 0.65) ? 'text-emerald-700' : 'text-amber-700'}
                tip={(y) => `${yearLabel(y)}: ${num(y.labourHours)} h of ${num(y.scheduledHours)} scheduled, ${money(y.labourCost)}`}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <LabourTable title="By role" rows={labour.byRole} target={targets.wrenchTime ?? 0.65} />
            <LabourTable title="By shift" rows={labour.byShift} target={targets.wrenchTime ?? 0.65} note="Someone who worked more than one shift is counted under each." />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span>Per-person hours, wrench time and come-backs are on the Technician KPIs screen.</span>
            <Button variant="outline" size="sm" onClick={() => router.push('/portal/oxmaint/gse-tech-kpi')}>
              Technician KPIs <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </TabsContent>

        {/* ── Parts ───────────────────────────────────────────────────── */}
        <TabsContent value="parts" className="space-y-6 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Active SKUs" value={int(parts.activeSkus)} sub="stocked parts" Icon={Boxes} />
            <Stat label="On-hand value" value={money(parts.onHandValue)} sub="at unit cost, now" Icon={Package} />
            <Stat
              label="Issued to work orders" value={money(period.partsIssueSpend)}
              sub={selYear ? `${selYear.year} · ${money(parts.woPartsSpend)} over 5 years` : '5 years'} Icon={Wrench}
            />
            <Stat label="PO spend" value={money(period.poSpend)} sub={`${int(period.poCount)} purchase orders · ${periodLabel}`} Icon={ShoppingCart} />
            <Stat label="Warranty credits" value={money(parts.warrantyCredits)} sub="received · 5 years" Icon={ShieldCheck} />
            <Stat label="Count variance" value={signedMoney(parts.countVariance)} sub="cycle counts vs book · 5 years" Icon={Scale} tone={parts.countVariance < 0 ? 'red' : null} />
            <Stat label="Open PO value" value={money(parts.openPoValue)} sub="ordered, not yet received" Icon={ClipboardList} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Parts issued vs PO spend by year</CardTitle>
                <p className="text-sm text-slate-500">Issued = parts cost on work orders. PO spend = purchase orders raised.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <PairBars
                  years={fy.years} sel={selYear?.year}
                  a={{ key: 'partsIssueSpend', label: 'Issued', cls: 'bg-blue-500' }}
                  b={{ key: 'poSpend', label: 'PO spend', cls: 'bg-slate-400' }}
                />
                <Legend items={[['Issued to work orders', 'bg-blue-500'], ['PO spend', 'bg-slate-400']]} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  On-hand value by category
                  <span className="ml-auto text-sm font-normal text-slate-500">now</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BarList
                  rows={parts.onHandByCategory.map((c) => ({
                    key: c.category, label: c.category, value: c.value,
                    text: money(c.value), note: `${int(c.skus)} SKU${c.skus === 1 ? '' : 's'}`,
                  }))}
                  cls="bg-blue-500"
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                Issue spend by vendor
                <span className="ml-auto text-sm font-normal text-slate-500">5 years</span>
              </CardTitle>
              <p className="text-sm text-slate-500">
                Unclaimed early failures = parts that failed early on an unscheduled job with no warranty claim raised.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3 font-medium text-left">Vendor</th>
                      <th className="py-2 pr-3 font-medium text-right">Lines</th>
                      <th className="py-2 pr-3 font-medium text-right">Spend</th>
                      <th className="py-2 pr-3 font-medium text-right whitespace-nowrap">Aftermarket lines</th>
                      <th className="py-2 font-medium text-right whitespace-nowrap">Unclaimed early failures</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parts.byVendor.map((v) => (
                      <tr key={v.vendor}>
                        <td className="py-2 pr-3 text-slate-900 min-w-48">{v.vendor}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{int(v.lines)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums font-medium">{money(v.spend)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-slate-600">
                          {int(v.aftermarketLines)}
                          <span className="ml-1 text-xs text-slate-400">({pct(ratio(v.aftermarketLines, v.lines), 0)})</span>
                        </td>
                        <td className={`py-2 text-right tabular-nums ${v.earlyFailuresUnclaimed ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}>
                          {int(v.earlyFailuresUnclaimed)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" size="sm" onClick={() => router.push('/portal/oxmaint/gse-warranty')}>
                  Warranty Recovery <ArrowRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => router.push('/portal/oxmaint/gse-parts-kits')}>
                  Parts Kits &amp; Sourcing <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Header({ range }) {
  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Five-Year Performance</h1>
      <p className="text-slate-600 mt-1">
        Work, downtime, fleet cost, labour and parts at the CVG superhub{range ? `, ${range}` : ''}
      </p>
    </div>
  )
}

function sortRows(rows, { key, dir }) {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((x, y) => {
    const u = x[key]
    const v = y[key]
    if ((u === null || u === undefined) && (v === null || v === undefined)) return 0
    if (u === null || u === undefined) return 1
    if (v === null || v === undefined) return -1
    const c = typeof u === 'string' ? u.localeCompare(v) : u - v
    return c * sign || String(x.key).localeCompare(String(y.key))
  })
}

function SortHeader({ label, k, sort, setSort, align = 'right' }) {
  const active = sort.key === k
  const toggle = () => setSort((s) => (s.key === k
    ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' }
    : { key: k, dir: ['key', 'class'].includes(k) ? 'asc' : 'desc' }))
  return (
    <th className={`py-2 pr-3 font-medium whitespace-nowrap ${align === 'left' ? 'text-left' : 'text-right'}`}>
      <button
        type="button" onClick={toggle}
        className={`inline-flex items-center gap-1 border-0 bg-transparent p-0 text-xs font-medium uppercase tracking-wide text-inherit hover:text-slate-900 ${active ? 'text-slate-900' : ''}`}
        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
      >
        {label}
        {active && (sort.dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
      </button>
    </th>
  )
}

function GroupTable({ title, rows, sort, setSort, nameLabel, showClass, all, setAll }) {
  const LIMIT = 12
  const shown = all ? rows : rows.slice(0, LIMIT)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {title}
          <span className="ml-auto text-sm font-normal text-slate-500">{rows.length} groups · maintenance over 5 years</span>
        </CardTitle>
        <p className="text-sm text-slate-500">
          Maintenance = work order cost. Per unit / yr = maintenance ÷ units ÷ 5. Click a heading to sort.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <SortHeader label={nameLabel} k="key" sort={sort} setSort={setSort} align="left" />
                {showClass && <SortHeader label="Class" k="class" sort={sort} setSort={setSort} align="left" />}
                {GROUP_COLUMNS.map((c) => <SortHeader key={c.key} label={c.label} k={c.key} sort={sort} setSort={setSort} />)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((r) => (
                <tr key={r.key}>
                  <td className="py-2 pr-3 text-slate-900 min-w-48">{r.key}</td>
                  {showClass && <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">{r.class}</td>}
                  {GROUP_COLUMNS.map((c) => (
                    <td
                      key={c.key}
                      className={`py-2 pr-3 text-right tabular-nums whitespace-nowrap ${c.key === 'maintPct' && r.maintPct > 1 ? 'text-amber-700 font-semibold' : c.key === 'maintenance' ? 'text-slate-900 font-medium' : 'text-slate-600'}`}
                    >
                      {c.fmt(r[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > LIMIT && (
          <Button variant="ghost" size="sm" onClick={() => setAll((v) => !v)}>
            {all ? `Show top ${LIMIT}` : `Show all ${rows.length}`}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function GroupBars({ title, rows }) {
  const sorted = [...rows].sort((x, y) => y.units - x.units)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {title}
          <span className="ml-auto text-sm font-normal text-slate-500">units · 5-yr maintenance</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <BarList
          rows={sorted.map((r) => ({
            key: r.key, label: r.key, value: r.units,
            text: `${int(r.units)} units`,
            sub: `${money(r.acquisition)} acquired · ${money(r.maintenance)} maintenance · ${num(r.downtime)} h down`,
          }))}
          cls="bg-blue-500"
        />
      </CardContent>
    </Card>
  )
}

function LabourTable({ title, rows, target, note }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {title}
          <span className="ml-auto text-sm font-normal text-slate-500">5 years</span>
        </CardTitle>
        {note && <p className="text-sm text-slate-500">{note}</p>}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium text-left">{title.replace('By ', '')}</th>
                <th className="py-2 pr-3 font-medium text-right">People</th>
                <th className="py-2 pr-3 font-medium text-right">Hours</th>
                <th className="py-2 pr-3 font-medium text-right">Cost</th>
                <th className="py-2 pr-3 font-medium text-right">Scheduled</th>
                <th className="py-2 pr-3 font-medium text-right whitespace-nowrap">Wrench</th>
                <th className="py-2 font-medium text-right whitespace-nowrap">Avg rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const w = ratio(r.hours, r.scheduled)
                return (
                  <tr key={r.key}>
                    <td className="py-2 pr-3 text-slate-900 whitespace-nowrap">{r.key}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{int(r.people)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{num(r.hours)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{money(r.cost)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{num(r.scheduled)}</td>
                    <td className={`py-2 pr-3 text-right tabular-nums font-semibold ${w === null ? 'text-slate-400' : w >= target ? 'text-emerald-700' : 'text-amber-700'}`}>{pct(w)}</td>
                    <td className="py-2 text-right tabular-nums text-slate-600 whitespace-nowrap">{money(ratio(r.cost, r.hours))}/h</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// Vertical bars, one column per calendar year, segments stacked bottom-up.
function YearBars({ years, sel, series, top, topTone, tip }) {
  const totals = years.map((y) => series.reduce((n, s) => n + (y[s.key] || 0), 0))
  const max = Math.max(0, ...totals)
  return (
    <div className="flex items-stretch gap-1 xl:gap-3">
      {years.map((y, i) => (
        <div key={y.year} className={`flex-1 min-w-0 flex flex-col items-center ${sel && sel !== y.year ? 'opacity-40' : ''}`} title={tip(y)}>
          <span className={`text-[10px] xl:text-[11px] font-semibold tabular-nums whitespace-nowrap ${topTone ? topTone(y) : 'text-slate-700'}`}>{top(y)}</span>
          <div className="mt-1 h-40 w-full max-w-14 flex flex-col justify-end">
            <div className="w-full flex flex-col-reverse rounded-t overflow-hidden" style={{ height: `${max ? (totals[i] / max) * 100 : 0}%` }}>
              {series.map((s) => (
                <div key={s.key} className={s.cls} style={{ height: `${totals[i] ? ((y[s.key] || 0) / totals[i]) * 100 : 0}%` }} />
              ))}
            </div>
          </div>
          <span className="mt-1.5 text-xs font-medium text-slate-700 tabular-nums">{y.year}</span>
          <span className="text-[10px] text-slate-400 whitespace-nowrap">{y.months < 12 ? `${y.months} mo` : ' '}</span>
        </div>
      ))}
    </div>
  )
}

// Two horizontal bars per year on a shared scale, value at the end of each.
function PairBars({ years, sel, a, b }) {
  const max = Math.max(0, ...years.flatMap((y) => [y[a.key] || 0, y[b.key] || 0]))
  const bar = (y, s) => (
    <div className="flex items-center gap-2" title={`${yearLabel(y)} · ${s.label}: ${money(y[s.key] || 0)}`}>
      <div className="flex-1 min-w-0 h-2.5">
        <div className={`h-full rounded-full ${s.cls}`} style={{ width: `${max ? ((y[s.key] || 0) / max) * 100 : 0}%` }} />
      </div>
      <span className="w-20 shrink-0 text-right text-xs tabular-nums text-slate-600">{money(y[s.key] || 0)}</span>
    </div>
  )
  return (
    <div className="space-y-3">
      {years.map((y) => (
        <div key={y.year} className={`grid grid-cols-[4.5rem_1fr] items-center gap-2 ${sel && sel !== y.year ? 'opacity-40' : ''}`}>
          <span className="text-sm text-slate-700 leading-tight">
            {y.year}
            {y.months < 12 && <span className="block text-[10px] text-slate-400">{y.months} mo</span>}
          </span>
          <div className="space-y-1 min-w-0">{bar(y, a)}{bar(y, b)}</div>
        </div>
      ))}
    </div>
  )
}

function BarList({ rows, cls }) {
  const max = Math.max(0, ...rows.map((r) => r.value))
  return (
    <div className={rows.some((r) => r.sub) ? 'space-y-3' : 'space-y-2.5'}>
      {rows.map((r) => (
        <div key={r.key} title={`${r.label}: ${r.text}${r.note ? ` · ${r.note}` : ''}${r.sub ? ` · ${r.sub}` : ''}`}>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-slate-700">
              {r.label}{r.note && <span className="ml-1.5 text-xs text-slate-400">{r.note}</span>}
            </span>
            <span className="shrink-0 tabular-nums font-medium text-slate-900">{r.text}</span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
            <div className={`h-full rounded-full ${cls}`} style={{ width: `${max ? (r.value / max) * 100 : 0}%` }} />
          </div>
          {r.sub && <div className="mt-0.5 text-xs text-slate-500">{r.sub}</div>}
        </div>
      ))}
    </div>
  )
}

// One monthly series as an area line. The SVG stretches to the card; axis
// labels are HTML so they stay legible at any width.
function MonthLine({ months, field, title, stroke, fmt, sel }) {
  const W = 600
  const H = 120
  const n = months.length
  const vals = months.map((m) => Number(m[field]) || 0)
  const max = niceMax(Math.max(0, ...vals))
  const step = n > 1 ? W / (n - 1) : W
  const x = (i) => (n > 1 ? i * step : W / 2)
  const y = (v) => H - (v / max) * H
  const line = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const peak = vals.reduce((best, v, i) => (v > vals[best] ? i : best), 0)
  const selIdx = sel ? months.map((m, i) => (m.year === sel ? i : -1)).filter((i) => i >= 0) : []
  // A tick at each January; the first month is labelled too unless a January
  // follows closely enough for the two labels to collide.
  const firstJan = months.findIndex((m) => m.m.endsWith('-01'))
  const ticks = months.map((m, i) => ({ i, m }))
    .filter(({ m, i }) => m.m.endsWith('-01') || (i === 0 && (firstJan < 0 || firstJan > 8)))

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-slate-900">{title}</span>
        <span className="text-xs text-slate-500">peak {fmt(vals[peak])} in {months[peak]?.label}</span>
      </div>
      <div className="mt-2 flex gap-2">
        <div className="relative w-9 shrink-0 h-32 text-[10px] text-slate-400 tabular-nums">
          <span className="absolute right-0 -top-1.5">{num(max)}</span>
          <span className="absolute right-0 top-1/2 -translate-y-1/2">{num(max / 2)}</span>
          <span className="absolute right-0 -bottom-1.5">0</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="relative h-32">
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible" aria-label={title}>
              {[0, 0.5, 1].map((f) => (
                <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="#e2e8f0" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              ))}
              {selIdx.length > 0 && (
                <rect x={Math.max(0, x(selIdx[0]) - step / 2)} width={Math.min(W, x(selIdx[selIdx.length - 1]) + step / 2) - Math.max(0, x(selIdx[0]) - step / 2)} y="0" height={H} fill="#dbeafe" opacity="0.6" />
              )}
              <polygon points={`0,${H} ${line} ${W},${H}`} fill={stroke} opacity="0.1" />
              <polyline points={line} fill="none" stroke={stroke} strokeWidth="1.75" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              {vals.map((v, i) => (
                <rect key={months[i].m} x={x(i) - step / 2} width={step} y="0" height={H} fill="transparent">
                  <title>{`${months[i].label}: ${fmt(v)}`}</title>
                </rect>
              ))}
            </svg>
          </div>
          <div className="relative h-4 mt-1 text-[10px] text-slate-400">
            {ticks.map(({ i, m }) => (
              <span
                key={m.m} className="absolute whitespace-nowrap"
                style={{ left: `${n > 1 ? (i / (n - 1)) * 100 : 50}%`, transform: i === 0 ? 'none' : 'translateX(-50%)' }}
              >
                {i === 0 && !m.m.endsWith('-01') ? m.label : m.year}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Legend({ items }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {items.map(([label, cls]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-sm ${cls}`} />{label}
        </span>
      ))}
    </div>
  )
}

function Stat({ label, value, sub, Icon, tone }) {
  const ring = tone === 'red' ? 'border-red-200' : tone === 'amber' ? 'border-amber-200'
    : tone === 'green' ? 'border-emerald-200' : 'border-slate-200/60'
  const ink = tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700'
    : tone === 'green' ? 'text-emerald-700' : 'text-slate-900'
  return (
    <div className={`bg-white border rounded-lg shadow-sm p-4 min-w-0 ${ring}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-1.5 text-2xl font-bold tabular-nums ${ink}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  )
}
