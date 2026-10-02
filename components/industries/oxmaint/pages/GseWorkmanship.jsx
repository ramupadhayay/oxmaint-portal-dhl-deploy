'use client'

// Workmanship — how quiet a unit stays after each maintainer closes it.
//
// This is the most dangerous screen in the portal to get wrong. A per-person
// quality page is one careless sort away from being a league table with a name
// at the bottom, and a shop that reads it that way stops typing honest comments
// within a week — which destroys the very measure the page exists to show.
//
// So the shape is deliberate. The measure is not speed and not volume: it is
// whether the unit came back. Come-backs are counted over the person's own
// unscheduled closes, because a PM cannot come back, and beside them sits the
// median number of days to the next unplanned event on the units they touched —
// the one figure that cannot be gamed by closing fast. The workbook's own
// caution about what the bands do and do not mean is quoted directly above the
// table rather than paraphrased, and the band wording is the sheet's wording:
// "Watch" is a coaching queue, not a verdict.
//
// The comments tab is the other half of the same argument. Every figure here is
// only computable because someone typed meter hours, pad millimetres and a
// come-back flag instead of "fixed unit"; the tab shows the 94 comments the
// record actually holds, and puts a real one beside the thin one so the
// difference is visible rather than asserted. Where a comment names a job that
// is still in the live register it opens it; where it does not, it stays text,
// because a dead link in front of an evaluator is worse than no link.
//
// The band projection is the plan's target and is labelled as such on the face
// of the table. 2026 is measured from five years of record; 2028 and 2031 are
// what the mentor model is committed to, and they are never drawn as history.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, RotateCcw, CalendarClock, Award, ArrowUp, ArrowDown, ArrowRight,
  MessageSquare, Target, Search, Quote, FileText, ChevronDown, ChevronRight,
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Input } from '../ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { GSE_ACTIVE } from '../lib/gse'
import { loadGseAnalytics, WORK_ORDERS, money, fmtDate, VOICE_INSIGHTS } from '../lib/data'
import ModuleOff from '../components/ModuleOff'
import PagerBar, { usePaged } from '../components/ListPager'

const EMPTY = []
const PAGE_SIZE = 20
const SELECT = 'h-10 px-3 rounded-md border border-slate-200 text-sm bg-white outline-none focus:border-primary/40 max-w-full'

// The literal counter-example the workbook names, kept as one constant so the
// quoted sentence and the comparison card cannot drift apart.
const THIN_NOTE = 'fixed unit'

const ratio = (n, d) => (d > 0 ? n / d : null)
const pct = (v, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? '—'
  : `${(v * 100).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}%`)
const num = (v, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? '—'
  : v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }))
const int = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)).toLocaleString('en-US') : '—')

// The workbook cites itself by tab. Inside the portal those are the wrong names
// for the right things — the reader is looking at the records, not at the
// spreadsheet they were loaded from — so a quoted sentence keeps its wording
// and loses the tab number.
const SOURCE_NAMES = {
  Tech_Voice_CVG: 'the comments on this screen',
  Workmanship_Quality: 'the bands on this screen',
  KPI_Trajectory: 'the KPI trajectory',
  Work_Orders: 'the work orders',
  Assumptions: 'the planning assumptions',
}
const prettySources = (text) => String(text || '').replace(/\b\d{2}_([A-Za-z0-9_]+)/g, (whole, name) => (
  SOURCE_NAMES[name] || name.replace(/_/g, ' ')
))

const fmtWhen = (iso) => {
  const t = iso ? new Date(iso) : null
  if (!t || Number.isNaN(t.getTime())) return '—'
  return `${fmtDate(iso)} · ${t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

// Band tone. Green for the standard others copy, amber for the coaching queue,
// slate for the middle — never red, because none of these is a failure.
const bandTone = (band) => (/^Excellent/i.test(band) ? 'green' : /^(Watch|Coach)/i.test(band) ? 'amber' : 'slate')
const BAND_BADGE = {
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  slate: 'bg-slate-100 text-slate-700',
}
const BAND_TEXT = { green: 'text-emerald-700', amber: 'text-amber-700', slate: 'text-slate-600' }

const PEOPLE_COLUMNS = [
  { key: 'rank', label: '#', align: 'left', asc: true },
  { key: 'name', label: 'Maintainer', align: 'left', asc: true },
  { key: 'wos', label: 'Work orders' },
  { key: 'unscheduled', label: 'Unscheduled' },
  { key: 'comebackRate', label: 'Come-backs' },
  { key: 'reworkRate', label: 'Rework' },
  { key: 'pmShare', label: 'PM share' },
  { key: 'medianDays', label: 'Days to next unscheduled' },
  { key: 'assets', label: 'Assets' },
  { key: 'band', label: 'Band', align: 'left', asc: true },
]

export default function GseWorkmanship() {
  const router = useRouter()
  const [A, setA] = useState(null)
  const [tab, setTab] = useState('people')
  const [sort, setSort] = useState({ key: 'rank', dir: 'asc' })
  const [open, setOpen] = useState(null)

  // comment filters
  const [lifecycle, setLifecycle] = useState('all')
  const [comeback, setComeback] = useState('all')
  const [person, setPerson] = useState('all')
  const [q, setQ] = useState('')

  const enabled = GSE_ACTIVE && Boolean(loadGseAnalytics)

  useEffect(() => {
    if (!enabled) return undefined
    let live = true
    loadGseAnalytics().then((r) => { if (live) setA(r) }).catch(() => {})
    return () => { live = false }
  }, [enabled])

  const plan = A?.plan || null
  const insights = A?.insights || null

  // One row per maintainer: the workbook's workmanship line, joined to the
  // five-year outcome table for the rank, PM share and the cost behind it.
  const people = useMemo(() => {
    const byId = new Map((insights?.technicians || EMPTY).map((t) => [t.UserID, t]))
    return (plan?.workmanship || EMPTY).map((w) => {
      const t = byId.get(w.UserID) || null
      return {
        id: w.UserID,
        rank: t?.Rank ?? null,
        name: w.Name,
        role: w.Role,
        wos: w.WOs_5yr,
        unscheduled: w.Unscheduled,
        comebacks: w.Comebacks,
        comebackRate: Number.isFinite(w.ComebackRate) ? w.ComebackRate : ratio(w.Comebacks, w.Unscheduled),
        rework: w.Rework,
        reworkRate: Number.isFinite(w.ReworkRate) ? w.ReworkRate : ratio(w.Rework, w.WOs_5yr),
        pmShare: Number.isFinite(t?.PMShare) ? t.PMShare : null,
        medianDays: Number.isFinite(w.MedianDaysToNextUnsched) ? w.MedianDaysToNextUnsched : null,
        assets: w.AssetsTouched,
        band: w.Band,
        use: w['How the system uses this in 2027–2031'] || '',
        cost: Number.isFinite(t?.CostUSD) ? t.CostUSD : null,
        downtime: Number.isFinite(t?.DowntimeHrs) ? t.DowntimeHrs : null,
        preventive: t?.Preventive ?? null,
      }
    })
  }, [plan, insights])

  const sortedPeople = useMemo(() => {
    const { key, dir } = sort
    const sign = dir === 'asc' ? 1 : -1
    return [...people].sort((x, y) => {
      const u = x[key]
      const v = y[key]
      // Blanks sink to the bottom whichever way the column is sorted.
      if (u === null && v === null) return 0
      if (u === null) return 1
      if (v === null) return -1
      const c = typeof u === 'string' ? u.localeCompare(v) : u - v
      return c * sign || x.name.localeCompare(y.name)
    })
  }, [people, sort])

  // Six years per person, oldest first, keyed for the expanded trend.
  const yearsById = useMemo(() => {
    const m = new Map()
    ;(insights?.technicianYears || EMPTY).forEach((y) => {
      if (!m.has(y.UserID)) m.set(y.UserID, [])
      m.get(y.UserID).push(y)
    })
    m.forEach((list) => list.sort((a, b) => a.Year - b.Year))
    return m
  }, [insights])

  // The band strings exactly as the sheet writes them, best first.
  const bandWords = useMemo(() => {
    const order = { green: 0, slate: 1, amber: 2 }
    return [...new Set(people.map((p) => p.band))].sort((a, b) => order[bandTone(a)] - order[bandTone(b)])
  }, [people])

  const voice = plan?.techVoice || EMPTY
  const names = useMemo(
    () => [...new Set(voice.map((v) => v.Name))].sort((a, b) => a.localeCompare(b)),
    [voice],
  )
  const lifecycles = useMemo(() => [...new Set(voice.map((v) => v.Lifecycle))], [voice])

  const comments = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return voice
      .filter((v) => lifecycle === 'all' || v.Lifecycle === lifecycle)
      .filter((v) => comeback === 'all' || v.Comeback === comeback)
      .filter((v) => person === 'all' || v.Name === person)
      .filter((v) => !needle || [
        v.NoteText, v.WorkOrderID, v.AssetID, v.EquipmentType, v.FailureCode,
        v.Name, v.Role, v.NoteType, v.KPI_this_note_feeds,
      ].some((f) => String(f || '').toLowerCase().includes(needle)))
      .sort((x, y) => String(y.NoteTime).localeCompare(String(x.NoteTime)))
  }, [voice, lifecycle, comeback, person, q])

  const paged = usePaged(comments, PAGE_SIZE, `${lifecycle}|${comeback}|${person}|${q}`)

  // Jobs still in the live register. A comment naming one of these opens it;
  // the rest stay as plain text rather than as links into a 404.
  const liveJobs = useMemo(
    () => new Set((WORK_ORDERS || EMPTY).map((w) => w.work_order_number).filter(Boolean)),
    [],
  )

  // The richest comment the record holds, picked by length rather than by hand,
  // so it stays a real example if the data is reloaded.
  const richest = useMemo(
    () => voice.reduce((best, v) => (!best || String(v.NoteText).length > String(best.NoteText).length ? v : best), null),
    [voice],
  )

  // The sheet's own two sentences, found by keyword. If either is missing from
  // the record, nothing is rendered in its place — an invented caution would be
  // worse than none.
  const bandCaution = useMemo(
    () => (plan?.notes?.workmanship || EMPTY).filter((t) => /does not mean/i.test(t)),
    [plan],
  )
  const thinNoteLine = useMemo(
    () => (plan?.notes?.voice || EMPTY).filter((t) => /thin note/i.test(t)),
    [plan],
  )
  const projectionCaption = useMemo(
    () => (plan?.notes?.workmanship || EMPTY).filter((t) => /mentor model/i.test(t)),
    [plan],
  )

  if (!enabled) return <ModuleOff module="Workmanship" />

  if (!plan || !insights) {
    return (
      <div className="max-w-8xl mx-auto p-6 space-y-6">
        <Header />
        <VoicePeriodCard />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-100" />)}
        </div>
        <div className="h-96 animate-pulse rounded-lg bg-slate-100" />
      </div>
    )
  }

  // ── the four figures at the top ──
  const totalUnscheduled = people.reduce((n, p) => n + (p.unscheduled || 0), 0)
  const totalComebacks = people.reduce((n, p) => n + (p.comebacks || 0), 0)
  const totalWos = people.reduce((n, p) => n + (p.wos || 0), 0)
  const fleetComeback = ratio(totalComebacks, totalUnscheduled)
  // Lowest come-back rate, with the most unscheduled closes behind it where two
  // people tie — a clean record over forty jobs says more than one over four.
  const quietest = [...people].sort((x, y) => (x.comebackRate - y.comebackRate) || (y.unscheduled - x.unscheduled))[0] || null
  const medians = people.map((p) => p.medianDays).filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  const medianDays = medians.length
    ? (medians.length % 2 ? medians[(medians.length - 1) / 2] : (medians[medians.length / 2 - 1] + medians[medians.length / 2]) / 2)
    : null

  const bandCounts = (plan.bandProjection || EMPTY).map((b) => ({
    ...b,
    people: people.filter((p) => String(p.band).toLowerCase().startsWith(String(b.Band).toLowerCase())).length,
  }))

  const toggleSort = (c) => setSort((s) => (s.key === c.key
    ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
    : { key: c.key, dir: c.asc ? 'asc' : 'desc' }))

  const openJob = (id) => router.push(`/portal/oxmaint/work-orders/${encodeURIComponent(id)}`)

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <Header />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Maintainers scored" value={int(people.length)}
          sub={`${int(totalWos)} work orders closed over 5 years`} Icon={Users}
        />
        <Stat
          label="Lowest come-back rate" value={pct(quietest?.comebackRate, 1)}
          sub={quietest ? `${quietest.name} · ${int(quietest.comebacks)} of ${int(quietest.unscheduled)} unscheduled closes` : '—'}
          Icon={Award} tone="green"
        />
        <Stat
          label="Come-back rate" value={pct(fleetComeback)}
          sub={`${int(totalComebacks)} of ${int(totalUnscheduled)} unscheduled closes, whole shop`}
          Icon={RotateCcw}
        />
        <Stat
          label="Days to next unscheduled" value={num(medianDays)}
          sub="median across the maintainers, after a close" Icon={CalendarClock}
        />
      </div>

      <VoicePeriodCard />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full sm:w-[34rem] grid-cols-3 h-auto sm:h-11">
          <TabsTrigger value="people" className="flex items-center gap-1.5 h-9"><Users className="w-4 h-4" /> People</TabsTrigger>
          <TabsTrigger value="comments" className="flex items-center gap-1.5 h-9"><MessageSquare className="w-4 h-4" /> Comments</TabsTrigger>
          <TabsTrigger value="plan" className="flex items-center gap-1.5 h-9"><Target className="w-4 h-4" /> Where it goes</TabsTrigger>
        </TabsList>

        {/* ── People ──────────────────────────────────────────────────── */}
        <TabsContent value="people" className="space-y-6 mt-4">
          {bandCaution.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 flex items-start gap-3">
              <Quote className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              <div className="min-w-0 space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  How to read the bands, in the workbook&apos;s own words
                </p>
                {bandCaution.map((t) => (
                  <p key={t.slice(0, 40)} className="text-sm leading-relaxed text-slate-700">{prettySources(t)}</p>
                ))}
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <Users className="w-5 h-5" />
                By maintainer
                <span className="ml-auto text-sm font-normal text-slate-500">
                  {int(people.length)} people · 5 years · click a row for their six-year trend
                </span>
              </CardTitle>
              <p className="text-sm text-slate-500">
                Come-back rate is over that person&apos;s own unscheduled closes, because a preventive job
                cannot come back. Days to next unscheduled is the median gap before the next unplanned
                event on the units they touched. Every heading sorts; the default order is the one the
                five-year record puts them in.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* The three bands in the sheet's exact words, once, where they
                  cannot be missed — the column itself only has room for the
                  first word. */}
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {bandWords.map((b) => {
                  const tone = bandTone(b)
                  const [head, tail] = String(b).split(' — ')
                  return (
                    <span key={b} className="inline-flex items-center gap-2 text-xs text-slate-600">
                      <Badge className={BAND_BADGE[tone]}>{head}</Badge>
                      {tail ? `— ${tail}` : null}
                    </span>
                  )
                })}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      {PEOPLE_COLUMNS.map((c) => (
                        <th
                          key={c.key}
                          className={`py-2 pr-3 font-medium whitespace-nowrap ${c.align === 'left' ? 'text-left' : 'text-right'}`}
                        >
                          <button
                            type="button" onClick={() => toggleSort(c)}
                            className={`inline-flex items-center gap-1 border-0 bg-transparent p-0 text-xs font-medium uppercase tracking-wide text-inherit hover:text-slate-900 ${sort.key === c.key ? 'text-slate-900' : ''}`}
                            aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                          >
                            {c.label}
                            {sort.key === c.key && (sort.dir === 'asc'
                              ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedPeople.map((p) => {
                      const isOpen = open === p.id
                      const tone = bandTone(p.band)
                      const bandHead = String(p.band).split(' — ')[0]
                      return [
                        <tr
                          key={p.id}
                          className={`cursor-pointer align-top ${isOpen ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                          onClick={() => setOpen(isOpen ? null : p.id)}
                          aria-expanded={isOpen}
                        >
                          <td className="py-2.5 pr-3 tabular-nums text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              {p.rank === null ? '—' : p.rank}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 min-w-44">
                            <span className="block font-medium text-slate-900">{p.name}</span>
                            <span className="block text-xs text-slate-500">{p.role}</span>
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">{int(p.wos)}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-slate-600">{int(p.unscheduled)}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums whitespace-nowrap">
                            {int(p.comebacks)}
                            <span className={`ml-1 text-xs ${p.comebackRate > (fleetComeback ?? 0) ? 'text-amber-700' : 'text-slate-400'}`}>
                              ({pct(p.comebackRate, 1)})
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums whitespace-nowrap text-slate-600">
                            {int(p.rework)}
                            <span className="ml-1 text-xs text-slate-400">({pct(p.reworkRate, 1)})</span>
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-slate-600">{pct(p.pmShare, 0)}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums font-medium text-slate-900">{num(p.medianDays)}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-slate-600">{int(p.assets)}</td>
                          <td className="py-2.5 pr-3">
                            <Badge className={BAND_BADGE[tone]} title={p.band}>{bandHead}</Badge>
                          </td>
                        </tr>,
                        isOpen ? (
                          <tr key={`${p.id}-detail`} className="bg-slate-50">
                            <td colSpan={PEOPLE_COLUMNS.length} className="p-0">
                              <div className="sticky left-0 w-[86vw] max-w-4xl p-4">
                                <PersonPanel person={p} years={yearsById.get(p.id) || EMPTY} />
                              </div>
                            </td>
                          </tr>
                        ) : null,
                      ]
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Comments ────────────────────────────────────────────────── */}
        <TabsContent value="comments" className="space-y-6 mt-4">
          {thinNoteLine.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 flex items-start gap-3">
              <Quote className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              <div className="min-w-0 space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Why the wording matters, in the workbook&apos;s own words
                </p>
                {thinNoteLine.map((t) => (
                  <p key={t.slice(0, 40)} className="text-sm leading-relaxed text-slate-700">{prettySources(t)}</p>
                ))}
              </div>
            </div>
          )}

          {richest && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-red-700">A thin note</p>
                <p className="mt-2 font-mono text-sm text-red-900 break-words">&ldquo;{THIN_NOTE}&rdquo;</p>
                <p className="mt-3 text-xs leading-relaxed text-red-900/80">
                  No meter, no part, no cause, no come-back flag. Nothing on this screen can be computed
                  from it — not the come-back rate, not the band, not the airline audit packet.
                </p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                  What CVG technicians type
                </p>
                <p className="mt-2 text-sm leading-relaxed text-emerald-900 break-words">{richest.NoteText}</p>
                <p className="mt-3 text-xs text-emerald-900/80">
                  {richest.Name} · {richest.Role} · {fmtWhen(richest.NoteTime)}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {splitKpis(richest.KPI_this_note_feeds).map((k) => (
                    <Badge key={k} className="bg-emerald-100 text-emerald-800">{k}</Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Comments on the record
                <span className="ml-auto text-sm font-normal text-slate-500">
                  {int(comments.length)} of {int(voice.length)} shown
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <div className="relative w-full sm:w-72 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <Input
                    value={q} onChange={(e) => setQ(e.target.value)} className="pl-9"
                    placeholder="Search notes, jobs, units, codes" aria-label="Search comments"
                  />
                </div>
                <select value={lifecycle} onChange={(e) => setLifecycle(e.target.value)} className={SELECT} aria-label="Lifecycle">
                  <option value="all">All lifecycles</option>
                  {lifecycles.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <select value={comeback} onChange={(e) => setComeback(e.target.value)} className={SELECT} aria-label="Come-back">
                  <option value="all">Come-back or not</option>
                  <option value="Yes">Come-backs only</option>
                  <option value="No">Not a come-back</option>
                </select>
                <select value={person} onChange={(e) => setPerson(e.target.value)} className={SELECT} aria-label="Person">
                  <option value="all">Everyone</option>
                  {names.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              {paged.pageItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No comment matches these filters.</p>
              ) : (
                <ul className="list-none space-y-3">
                  {paged.pageItems.map((v) => {
                    const live = liveJobs.has(v.WorkOrderID)
                    return (
                      <li key={v.VoiceID} className="rounded-lg border border-slate-200 bg-white p-4 min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="font-medium text-slate-900">{v.Name}</span>
                          <span className="text-xs text-slate-500">{v.Role}</span>
                          <span className="ml-auto text-xs tabular-nums text-slate-500 whitespace-nowrap">{fmtWhen(v.NoteTime)}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                          <span className="text-slate-700">{v.EquipmentType}</span>
                          <span aria-hidden>·</span>
                          <span className="font-mono">{v.AssetID}</span>
                          <span aria-hidden>·</span>
                          <span>{v.FailureCode}</span>
                          <span aria-hidden>·</span>
                          {live ? (
                            <button
                              type="button" onClick={() => openJob(v.WorkOrderID)}
                              className="inline-flex items-center gap-1 border-0 bg-transparent p-0 font-mono text-xs text-primary hover:underline"
                            >
                              <FileText className="w-3 h-3" />
                              {v.WorkOrderID}
                            </button>
                          ) : (
                            <span className="font-mono">{v.WorkOrderID}</span>
                          )}
                          {v.Comeback === 'Yes' && (
                            <Badge className="bg-amber-100 text-amber-800">Come-back</Badge>
                          )}
                          <Badge variant="outline" className="text-slate-600">{v.Lifecycle}</Badge>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-slate-700 break-words">{v.NoteText}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">Feeds</span>
                          {splitKpis(v.KPI_this_note_feeds).map((k) => (
                            <Badge key={k} className="bg-slate-100 text-slate-700">{k}</Badge>
                          ))}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}

              <PagerBar {...paged} noun="comments" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Where it goes ───────────────────────────────────────────── */}
        <TabsContent value="plan" className="space-y-6 mt-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-medium text-amber-900">2026 is measured. 2028 and 2031 are targets.</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-900/90">
              The 2026 column is the come-back rate computed from five years of closed work. The 2028 and
              2031 columns are what the five-year plan commits each band to — not a second history, and
              never summed with the measured figures on the other tabs.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <Target className="w-5 h-5" />
                Come-back rate by band
                <span className="ml-auto text-sm font-normal text-slate-500">plan targets</span>
              </CardTitle>
              {projectionCaption.map((t) => (
                <p key={t.slice(0, 40)} className="text-sm text-slate-500">{prettySources(t)}</p>
              ))}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3 font-medium text-left">Band</th>
                      <th className="py-2 pr-3 font-medium text-right whitespace-nowrap">People now</th>
                      <th className="py-2 pr-3 font-medium text-right">
                        2026
                        <span className="block font-normal normal-case text-[10px] text-slate-400">measured</span>
                      </th>
                      <th className="py-2 pr-3 font-medium text-right">
                        2028
                        <span className="block font-normal normal-case text-[10px] text-slate-400">target</span>
                      </th>
                      <th className="py-2 pr-3 font-medium text-right">
                        2031
                        <span className="block font-normal normal-case text-[10px] text-slate-400">target</span>
                      </th>
                      <th className="py-2 font-medium text-left w-full">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bandCounts.map((b) => {
                      const tone = bandTone(b.Band)
                      return (
                        <tr key={b.Band}>
                          <td className="py-2.5 pr-3 whitespace-nowrap">
                            <Badge className={BAND_BADGE[tone]}>{b.Band}</Badge>
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-slate-600">{int(b.people)}</td>
                          <td className={`py-2.5 pr-3 text-right tabular-nums font-semibold ${BAND_TEXT[tone]}`}>{pct(Number(b['2026A']), 1)}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-slate-600">{pct(Number(b['2028']), 1)}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-slate-900 font-medium">{pct(Number(b['2031']), 1)}</td>
                          <td className="py-2.5 text-slate-600 min-w-56">{b.Note}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                People now counts the {int(people.length)} maintainers on the People tab in each band today.
                The band rates are the plan&apos;s own projection under the 2027 mentor model, held here as
                targets with the 2026 measurement beside them so the gap stays visible.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Where these figures go next</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">
                Hours, wrench time and load per person sit on the Technician KPIs screen; the come-back
                target this page feeds is one line of the station&apos;s five-year plan.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" size="sm" onClick={() => router.push('/portal/oxmaint/gse-tech-kpi')}>
                  Technician KPIs <ArrowRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => router.push('/portal/oxmaint/gse-next-five')}>
                  Next Five Years <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function VoicePeriodCard() {
  const report = VOICE_INSIGHTS?.workmanship
  if (!report) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Current-period workmanship
          <span className="ml-auto text-sm font-normal text-slate-500">
            Voice register · 7 / 14 / 30 day windows
          </span>
        </CardTitle>
        <p className="text-sm text-slate-500">
          {report.how_to_read} {report.honesty}
          {' '}Watch / Coach is a mentoring queue, not a league table.
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="pb-2 pr-3">Technician</th>
              <th className="pb-2 pr-3 text-right">Closed</th>
              <th className="pb-2 pr-3 text-right">Score</th>
              <th className="pb-2 pr-3">Band</th>
              <th className="pb-2 pr-3 text-right">Reopen 14d</th>
              <th className="pb-2 pr-3 text-right">Bounce</th>
              <th className="pb-2 pr-3 text-right">Near PM</th>
              <th className="pb-2 pr-3 text-right">Rework</th>
              <th className="pb-2 text-right">First-time fix</th>
            </tr>
          </thead>
          <tbody>
            {report.technicians.map((t) => (
              <tr key={t.tech_id} className="border-t border-slate-100">
                <td className="py-2 pr-3">
                  <div className="font-medium text-slate-900">{t.name}</div>
                  <div className="text-xs text-slate-500">{t.tech_id} · {t.role}</div>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{t.closed}</td>
                <td className="py-2 pr-3 text-right tabular-nums font-semibold">{t.workmanship_score}</td>
                <td className="py-2 pr-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${BAND_BADGE[bandTone(t.band)]}`}>
                    {t.band}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{t.reopen_14}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{t.bounce_back}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{t.near_pm}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{t.rework}</td>
                <td className="py-2 text-right tabular-nums">{pct(t.first_time_fix_rate, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Workmanship</h1>
      <p className="text-slate-600 mt-1">
        How quiet a unit stays after each maintainer closes it — come-backs, rework and the days to the
        next unplanned event, over five years at CVG
      </p>
    </div>
  )
}

// "Come-back quality, SAP stock traceability" is two measures, not one label.
const splitKpis = (text) => String(text || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

// The expanded row: six years of that person's own work, and the sentence the
// five-year plan attaches to their band.
function PersonPanel({ person, years }) {
  const maxUnsched = Math.max(0, ...years.map((y) => y.Unscheduled || 0))
  const maxRate = Math.max(0, ...years.map((y) => (Number.isFinite(y.ComebackRate) ? y.ComebackRate : 0)))
  const tone = bandTone(person.band)
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_18rem] items-start gap-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-slate-900">Six years of their own work</span>
          <span className="text-xs text-slate-500">bars scaled to this person</span>
        </div>
        {years.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No year-by-year record for this maintainer.</p>
        ) : (
          <>
            <div className="mt-3 flex items-stretch gap-1.5">
              {years.map((y) => (
                <div
                  key={y.Year} className="flex-1 min-w-0 flex flex-col items-center"
                  title={`${y.Year}: ${int(y.WorkOrders)} work orders, ${int(y.Unscheduled)} unscheduled, ${int(y.Comebacks)} come-backs (${pct(y.ComebackRate, 0)}), ${pct(y.PMShare, 0)} PM`}
                >
                  <span className={`text-[10px] tabular-nums ${y.ComebackRate > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                    {pct(y.ComebackRate, 0)}
                  </span>
                  <div className="mt-1 h-16 w-full flex items-end justify-center gap-1">
                    <span
                      className="w-3.5 rounded-t bg-blue-500"
                      style={{ height: `${maxUnsched ? ((y.Unscheduled || 0) / maxUnsched) * 100 : 0}%`, minHeight: 2 }}
                    />
                    <span
                      className="w-3.5 rounded-t bg-amber-500"
                      style={{ height: `${maxRate ? ((y.ComebackRate || 0) / maxRate) * 100 : 0}%`, minHeight: 2 }}
                    />
                  </div>
                  <span className="mt-1 text-[11px] tabular-nums text-slate-600">{y.Year}</span>
                  <span className="text-[10px] tabular-nums text-slate-400">{int(y.Unscheduled)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />Unscheduled closes</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />Come-back rate</span>
            </div>
          </>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Five years: {int(person.wos)} work orders
          {person.preventive === null ? '' : ` · ${int(person.preventive)} preventive`}
          {person.cost === null ? '' : ` · ${money(person.cost)}`}
          {person.downtime === null ? '' : ` · ${num(person.downtime)} h downtime`}
          {' · '}{int(person.assets)} units touched
        </p>
      </div>

      <div className={`rounded-lg border p-4 min-w-0 ${tone === 'green' ? 'border-emerald-200 bg-emerald-50' : tone === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Band</p>
        <p className={`mt-0.5 text-sm font-medium ${BAND_TEXT[tone]}`}>{person.band}</p>
        <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          How the system uses this in 2027–2031
        </p>
        <p className="mt-0.5 text-sm leading-relaxed text-slate-700">{prettySources(person.use) || '—'}</p>
      </div>
    </div>
  )
}

function Stat({ label, value, sub, Icon, tone }) {
  const ring = tone === 'amber' ? 'border-amber-200' : tone === 'green' ? 'border-emerald-200' : 'border-slate-200/60'
  const ink = tone === 'amber' ? 'text-amber-700' : tone === 'green' ? 'text-emerald-700' : 'text-slate-900'
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
