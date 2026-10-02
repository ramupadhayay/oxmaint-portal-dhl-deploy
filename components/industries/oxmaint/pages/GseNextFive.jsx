'use client'

// Next Five Years — 2026 measured, 2027–2031 committed to.
//
// Every other screen in this portal shows what happened. This one shows what is
// meant to happen next, and it is the screen an RFP is actually decided on: not
// "can the software store a work order", but "what is different at CVG in 2029,
// and who owns it".
//
// THE ONE RULE HERE. The 2026 column is measured from five years of record. The
// 2027–2031 columns are targets. They are never drawn in the same ink, never
// summed with history, and every table on this page says which is which — a
// portal that shows a 2031 figure as though it were data has invented four
// years of maintenance, and an evaluator who spots that stops believing the
// other twelve screens too.
//
// The workbook's own sentence for the room is quoted at the top rather than
// paraphrased: it is the honest framing, and it came from the customer's side.

import { useEffect, useMemo, useState } from 'react'
import {
  TrendingDown, TrendingUp, Target, CalendarRange, Layers, ListChecks, Route, User,
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { GSE_ACTIVE } from '../lib/gse'
import { loadGseAnalytics, money } from '../lib/data'
import ModuleOff from '../components/ModuleOff'

const YEARS = ['2027', '2028', '2029', '2030', '2031']
const BASE = '2026A_baseline'

// The workbook cites itself by tab — "32_Tech_Voice_CVG", "09_Meter_Readings".
// Inside the portal those are the wrong names for the right things: the reader
// is looking at the records, not at the spreadsheet they were loaded from.
const SOURCE_NAMES = {
  Tech_Voice_CVG: 'technician comments',
  Workmanship_Quality: 'workmanship bands',
  PM_Standards: 'the PM standards',
  Meter_Readings: 'meter readings',
  Work_Orders: 'work orders',
  WO_Labor: 'labour records',
  WO_Parts: 'parts issued',
  WO_Notes: 'job notes',
  Parts_Master: 'the parts master',
  Parts_Kits: 'parts kits',
  Purchase_Orders: 'purchase orders',
  PO_Lines: 'purchase order lines',
  Inventory_Counts: 'cycle counts',
  Warranty_Claims: 'warranty claims',
  OOS_Log: 'the out-of-service log',
  Fleet_Snapshot: 'the fleet snapshot',
  Assumptions: 'the planning assumptions',
  Assets: 'the asset register',
  Users: 'the user list',
  Manuals: 'the manuals',
  SAP_Org: 'the SAP organisation',
  SAP_GoodsMovements: 'goods movements',
  S4HANA_P2P: 'the procure-to-pay threads',
  KPI_Trajectory: 'the KPI trajectory',
  Next5Yr_Story: 'the five-year story',
  CMMS_Value_Map: 'this page',
}

const prettySources = (text) => String(text || '').replace(/\b\d{2}_([A-Za-z0-9_]+)/g, (whole, name) => (
  SOURCE_NAMES[name] || name.replace(/_/g, ' ')
))

// Each KPI carries its own unit, and a share written as 0.0765 is not a number
// anyone reads off a wall.
function fmt(value, unit) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  // Rounded on the number, not on its binary shadow: 0.0765 is 7.7%, and the
  // rest of the portal already says 7.7%.
  if (unit === 'share') return `${(Math.round(n * 1000) / 10).toFixed(1)}%`
  if (unit === 'USD / year') return money(n)
  if (unit === 'days' || unit === 'minutes' || unit === 'hours') return n.toLocaleString('en-US', { maximumFractionDigits: 1 })
  return n.toLocaleString('en-US', { maximumFractionDigits: 1 })
}

const unitLabel = (unit) => (unit === 'share' || unit === 'USD / year' ? '' : ` ${unit}`)

/** The slope of one KPI, baseline first, drawn in its own range. */
function Spark({ points, better }) {
  const nums = points.filter((p) => Number.isFinite(p))
  if (nums.length < 2) return null
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const span = max - min || 1
  const w = 96
  const h = 24
  const step = w / (points.length - 1)
  const y = (v) => h - 2 - ((v - min) / span) * (h - 4)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${y(p).toFixed(1)}`).join(' ')
  // Green is improvement, whichever direction that is for this KPI.
  const improving = better === 'Down' ? points[points.length - 1] < points[0] : points[points.length - 1] > points[0]
  const stroke = improving ? '#059669' : '#dc2626'
  return (
    <svg width={w} height={h} className="overflow-visible">
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="0" cy={y(points[0])} r="2" fill="#94a3b8" />
      <circle cx={w} cy={y(points[points.length - 1])} r="2.5" fill={stroke} />
    </svg>
  )
}

function Headline({ row }) {
  if (!row) return null
  const from = Number(row[BASE])
  const to = Number(row['2031'])
  const down = row.Better === 'Down'
  const Icon = down ? TrendingDown : TrendingUp
  return (
    <Card>
      <CardContent className="p-4">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          <Icon className="h-3.5 w-3.5 text-emerald-600" />
          {/* The whole name: two of these measures are called MTTR and they are
              not the same thing. */}
          <span className="min-w-0">{String(row.KPI).replace(' — ', ' · ')}</span>
        </p>
        <p className="mt-1 flex flex-wrap items-baseline gap-2">
          <span className="text-lg font-semibold tabular-nums text-slate-400 line-through decoration-slate-300">
            {fmt(from, row.Unit)}
          </span>
          <span className="text-2xl font-bold tabular-nums text-slate-900">{fmt(to, row.Unit)}</span>
          <span className="text-xs text-slate-500">{unitLabel(row.Unit).trim()}</span>
        </p>
        <p className="mt-0.5 text-xs text-slate-500">2026 measured &rarr; 2031 target</p>
      </CardContent>
    </Card>
  )
}

function Field({ label, children }) {
  if (!children) return null
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm text-slate-700">{children}</p>
    </div>
  )
}

export default function GseNextFive() {
  const [A, setA] = useState(null)
  const [open, setOpen] = useState(null)

  useEffect(() => {
    if (!GSE_ACTIVE || !loadGseAnalytics) return undefined
    let live = true
    loadGseAnalytics().then((a) => { if (live) setA(a) }).catch(() => {})
    return () => { live = false }
  }, [])

  const plan = A?.plan
  const kpis = plan?.kpi || []

  // The line the workbook asks to be said in the room, and the one that keeps
  // the targets honest. Taken from the sheet rather than written here.
  const framing = useMemo(
    () => (plan?.notes?.kpi || []).filter((t) => /planned outcome|say this in the room/i.test(t)),
    [plan],
  )

  const headlines = useMemo(() => {
    const pick = (needle) => kpis.find((k) => String(k.KPI).toLowerCase().includes(needle))
    return [pick('elapsed oos'), pick('come-back rate'), pick('mtbf'), pick('audit packet')].filter(Boolean)
  }, [kpis])

  if (!GSE_ACTIVE || !loadGseAnalytics) return <ModuleOff module="The next five years" />

  if (!plan) {
    return (
      <div className="max-w-8xl mx-auto p-6">
        <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
      </div>
    )
  }

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Next Five Years</h1>
        <p className="mt-1 text-slate-600">
          What changes at CVG between go-live and 2031 — the target, the year it lands, and who owns it
        </p>
      </div>

      {/* Said first, in the customer's own words. */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm font-medium text-amber-900">2026 is measured. 2027–2031 are targets.</p>
        {framing.map((t) => (
          <p key={t.slice(0, 40)} className="mt-1 text-sm leading-relaxed text-amber-900/90">{t}</p>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {headlines.map((row) => <Headline key={row.KPI} row={row} />)}
      </div>

      <Tabs defaultValue="trajectory">
        <TabsList className="flex-wrap">
          <TabsTrigger value="trajectory" className="gap-1.5"><Target className="h-4 w-4" />Trajectory</TabsTrigger>
          <TabsTrigger value="years" className="gap-1.5"><CalendarRange className="h-4 w-4" />Year by year</TabsTrigger>
          <TabsTrigger value="changes" className="gap-1.5"><Layers className="h-4 w-4" />What changes</TabsTrigger>
          <TabsTrigger value="value" className="gap-1.5"><ListChecks className="h-4 w-4" />Requirement to outcome</TabsTrigger>
          <TabsTrigger value="playbook" className="gap-1.5"><Route className="h-4 w-4" />Playbook</TabsTrigger>
        </TabsList>

        {/* ── the numbers ───────────────────────────────────────────────── */}
        <TabsContent value="trajectory" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                KPI trajectory
                <span className="ml-2 text-sm font-normal text-slate-500">{kpis.length} measures · click one for what moves it</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3 font-medium">Measure</th>
                      <th className="py-2 px-3 font-medium text-right">2026<span className="block font-normal normal-case text-[10px] text-slate-400">measured</span></th>
                      {YEARS.map((y) => (
                        <th key={y} className="py-2 px-3 font-medium text-right">
                          {y}
                          {y === '2027' && <span className="block font-normal normal-case text-[10px] text-slate-400">target</span>}
                        </th>
                      ))}
                      <th className="py-2 px-3 font-medium text-right">Slope</th>
                      <th className="py-2 pl-3 font-medium">Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpis.map((k) => {
                      const points = [Number(k[BASE]), ...YEARS.map((y) => Number(k[y]))]
                      const isOpen = open === k.KPI
                      return (
                        <tr
                          key={k.KPI}
                          className={`border-b border-slate-100 align-top ${isOpen ? 'bg-slate-50' : 'cursor-pointer hover:bg-slate-50'}`}
                          onClick={() => setOpen(isOpen ? null : k.KPI)}
                        >
                          <td className="py-2 pr-3">
                            <span className="block font-medium text-slate-900">{k.KPI}</span>
                            <span className="block text-xs text-slate-500">
                              {k.Unit} · {k.Better === 'Down' ? 'lower is better' : 'higher is better'}
                            </span>
                            {isOpen && (
                              <span className="mt-2 block rounded-md bg-white p-2 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200">
                                <span className="font-medium text-slate-800">What moves it: </span>{k['What moves it']}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-semibold text-slate-900">{fmt(k[BASE], k.Unit)}</td>
                          {YEARS.map((y) => (
                            <td key={y} className="py-2 px-3 text-right tabular-nums text-slate-600">{fmt(k[y], k.Unit)}</td>
                          ))}
                          <td className="py-2 px-3">
                            <span className="flex items-center justify-end gap-2">
                              <Spark points={points} better={k.Better} />
                              <span className={`text-xs tabular-nums ${Number(k['2031 vs 2026']) < 0 ? 'text-emerald-700' : 'text-emerald-700'}`}>
                                {Number.isFinite(Number(k['2031 vs 2026']))
                                  ? `${Number(k['2031 vs 2026']) > 0 ? '+' : ''}${(Number(k['2031 vs 2026']) * 100).toFixed(0)}%`
                                  : ''}
                              </span>
                            </span>
                          </td>
                          <td className="py-2 pl-3 text-slate-600">{k.Owner}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                The 2026 column is computed from the five-year record in this portal. The 2027–2031 columns are
                targets with a named owner, not a second history. Two measures are called MTTR here and mean
                different things: <span className="font-medium text-slate-700">elapsed out-of-service hours</span> is
                how long the unit was off the ramp, which is what the 7.2-hour baseline counts; the Dashboard&apos;s
                MTTR is <span className="font-medium text-slate-700">wrench time booked on the job</span>. The gap
                between them is waiting — on a part, a lead, or a loaner — and closing it is most of this plan.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── the years ─────────────────────────────────────────────────── */}
        <TabsContent value="years" className="mt-4 space-y-4">
          {plan.story.map((y) => (
            <Card key={y.Year}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{y.Year}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                <Field label="On the ramp">{y['What changes on the ramp']}</Field>
                <Field label="People">{y.People}</Field>
                <Field label="Stock / SAP">{y['Stock / SAP']}</Field>
                <Field label="KPI move this year">{prettySources(y['KPI move this year'])}</Field>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── the four lenses, and the growth the plan assumes ───────────── */}
        <TabsContent value="changes" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {plan.lenses.map((l) => (
              <Card key={l.Lens}>
                <CardHeader className="pb-3"><CardTitle className="text-base">{l.Lens}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-md border border-red-200 bg-red-50 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-red-700">Without the new system</p>
                    <p className="mt-0.5 text-sm text-red-900">{l['Without the new system']}</p>
                  </div>
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">With CMMS and S/4HANA</p>
                    <p className="mt-0.5 text-sm text-emerald-900">{l['With CMMS + S/4']}</p>
                  </div>
                  {l['Evidence in this file'] && (
                    <p className="text-xs text-slate-500">
                      <span className="font-medium text-slate-700">Evidence: </span>{prettySources(l['Evidence in this file'])}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                What the plan assumes about growth
                <span className="ml-2 text-sm font-normal text-slate-500">context, not a target</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3 font-medium">Item</th>
                      <th className="py-2 px-3 font-medium text-right">2026</th>
                      <th className="py-2 px-3 font-medium text-right">2031</th>
                      <th className="py-2 pl-3 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.growth.map((g) => {
                      const share = Number(g['2026']) <= 1 && Number(g['2031']) <= 1
                      const big = Number(g['2026']) > 100000
                      const show = (v) => (share ? `${Math.round(Number(v) * 100)}%` : big ? money(Number(v)) : Number(v).toLocaleString('en-US'))
                      return (
                        <tr key={g.Item} className="border-b border-slate-100">
                          <td className="py-2 pr-3 text-slate-900">{g.Item}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-slate-600">{show(g['2026'])}</td>
                          <td className="py-2 px-3 text-right tabular-nums font-medium text-slate-900">{show(g['2031'])}</td>
                          <td className="py-2 pl-3 text-slate-500">{g.Note}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── requirement → what gets typed → KPI → outcome ──────────────── */}
        <TabsContent value="value" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                From the requirement to the outcome
                <span className="ml-2 text-sm font-normal text-slate-500">{plan.valueMap.length} requirements</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3 font-medium">Requirement</th>
                      <th className="py-2 px-3 font-medium">What a technician types</th>
                      <th className="py-2 px-3 font-medium">Measure it enables</th>
                      <th className="py-2 px-3 font-medium">2026</th>
                      <th className="py-2 px-3 font-medium">2031 target</th>
                      <th className="py-2 pl-3 font-medium">SAP object</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.valueMap.map((v) => (
                      <tr key={v['Customer note']} className="border-b border-slate-100 align-top">
                        <td className="py-2 pr-3 font-medium text-slate-900">{v['Customer note']}</td>
                        <td className="py-2 px-3 text-slate-600">{prettySources(v['What techs now type'])}</td>
                        <td className="py-2 px-3 text-slate-600">{v['KPI it enables']}</td>
                        <td className="py-2 px-3 text-slate-600">{v['2026A']}</td>
                        <td className="py-2 px-3 font-medium text-slate-900">{v['2031 target']}</td>
                        <td className="py-2 pl-3 font-mono text-xs text-slate-500">{v['SAP object']}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── what to do on Monday ───────────────────────────────────────── */}
        <TabsContent value="playbook" className="mt-4 space-y-4">
          {plan.playbook.map((a) => (
            <Card key={a.Insight?.slice(0, 40)}>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{a.Horizon}</Badge>
                  <span className="flex items-center gap-1.5 text-sm text-slate-600">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    {a.Owner}
                  </span>
                </div>
                <p className="text-sm text-slate-700">{prettySources(a.Insight)}</p>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Action</p>
                  <p className="mt-0.5 text-sm text-slate-900">{prettySources(a.Action)}</p>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
                  {a['SAP handle'] && <span><span className="font-medium text-slate-700">SAP: </span><span className="font-mono">{a['SAP handle']}</span></span>}
                  {a['Looks-for metric'] && <span><span className="font-medium text-slate-700">Watch: </span>{a['Looks-for metric']}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
