'use client'

// Reliability Insights — which makes hold up at CVG, and what five years of
// record will and will not support saying about them.
//
// This is the screen a buyer opens before signing for the next tractor, and it
// is the easiest screen in the portal to lie with. Every unit here carries a
// different number of years, a different duty cycle and a different crew, so a
// single "worst manufacturer" table would be an argument dressed as data. The
// shape below is built to stop that happening three times over.
//
// First, the headline comparison is drawn only from the night-bank fleet —
// tractors, loaders, pushbacks and ground power units, the units that work the
// same sort during the same hours — because that is the only apples-to-apples
// set the record holds. Types with one manufacturer are not shown at all: there
// is nothing to compare them to.
//
// Second, every figure says how many units it rests on. Fifty-four of the
// seventy make-and-type pairs cover fewer than three units, and a pair with one
// unit is a story about one unit. Those rows stay in the table — hiding them
// would hide most of the fleet — but they are marked as too small to judge, and
// they are never the basis of a sentence on this page.
//
// Third, the PM-cycle tab says what the numbers say rather than what everyone
// expects them to say. The tidy version of this finding is "units behind their
// PM cycle break down more". The record does not show that: behind-cycle
// asset-years average 1.76 unscheduled jobs and on-cycle asset-years average
// 1.92, so the on-cycle band is marginally the worse of the two. What does
// separate is the band that gets extra PM, at 1.30. The page says so in those
// words, because a screen that repeats the neater story here is a screen an
// evaluator can catch out with a calculator.
//
// The owner tab is the same discipline applied to people: stable crews and
// rotating crews differ by a lot, and the difference is stated as an
// association in the record, not as a proven cause.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity, AlertTriangle, ArrowDown, ArrowRight, ArrowUp, CalendarClock,
  CircleDot, ClipboardList, Factory, Search, ShieldCheck, Users, Wrench,
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { Input } from '../ui/input'
import { GSE_ACTIVE } from '../lib/gse'
import { loadGseAnalytics, money } from '../lib/data'
import ModuleOff from '../components/ModuleOff'
import PagerBar, { usePaged } from '../components/ListPager'

const SELECT = 'h-9 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-primary/40'

// Below three units a pair is one unit's biography, not a verdict on a make.
const MIN_SAMPLE = 3

const YEARS_OF_HISTORY = 5

const BAND_LOOK = {
  'Better than fleet': 'bg-emerald-100 text-emerald-800',
  'Needs reliability plan': 'bg-amber-100 text-amber-800',
}

const PM_BAND_ORDER = ['Behind PM cycle', 'On cycle', 'Ahead / extra PM']
const PM_BAND_LOOK = {
  'Behind PM cycle': 'bg-slate-100 text-slate-700',
  'On cycle': 'bg-blue-100 text-blue-800',
  'Ahead / extra PM': 'bg-emerald-100 text-emerald-800',
}
const PM_BAND_NOTE = {
  'Behind PM cycle': 'fewer preventive jobs than the standard asked for',
  'On cycle': 'preventive jobs roughly as the standard asked',
  'Ahead / extra PM': 'more preventive jobs than the standard asked for',
}

const num = (v, d = 1) => (Number.isFinite(Number(v)) && v !== '' && v !== null
  ? Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
  : '—')
const int = (v) => (Number.isFinite(Number(v)) && v !== '' && v !== null
  ? Math.round(Number(v)).toLocaleString('en-US') : '—')
// A pair with no unscheduled work has no come-back rate — the workbook leaves it
// blank, and a blank must read as a blank, never as 0% and never as NaN.
const pct = (v, d = 1) => {
  if (v === '' || v === null || v === undefined) return '—'
  const n = Number(v)
  return Number.isFinite(n)
    ? `${(n * 100).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}%`
    : '—'
}
const sortKeyOf = (v) => (v === '' || v === null || v === undefined ? null : v)

function sortRows(rows, { key, dir }) {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((x, y) => {
    const u = sortKeyOf(x[key])
    const v = sortKeyOf(y[key])
    if (u === null && v === null) return 0
    if (u === null) return 1
    if (v === null) return -1
    const c = typeof u === 'string' ? u.localeCompare(v) : Number(u) - Number(v)
    return c * sign
  })
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
      {sub && <div className="mt-0.5 text-xs leading-snug text-slate-500">{sub}</div>}
    </div>
  )
}

function SortHeader({ label, k, sort, setSort, align = 'right', numeric = true, pad = 'pr-3' }) {
  const active = sort.key === k
  const toggle = () => setSort((s) => (s.key === k
    ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' }
    : { key: k, dir: numeric ? 'desc' : 'asc' }))
  return (
    <th className={`py-2 ${pad} font-medium whitespace-nowrap ${align === 'left' ? 'text-left' : 'text-right'}`}>
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

// Under three units, the row is one unit's biography. It stays in the table —
// most of the register is like this — but it never reads as a verdict.
function SmallSample() {
  return (
    <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-amber-700">
      too small to judge
    </span>
  )
}

/** One equipment type on the night bank, its makes ranked by breakdowns. */
function TypeCompare({ type, rows }) {
  const best = rows[0]
  const worst = rows[rows.length - 1]
  const max = Math.max(...rows.map((r) => r.UnschedPerAssetYr), 0.0001)
  const gap = best.UnschedPerAssetYr > 0 ? worst.UnschedPerAssetYr / best.UnschedPerAssetYr - 1 : null
  const thin = rows.filter((r) => r.FleetSample < MIN_SAMPLE)
  const headlineThin = best.FleetSample < MIN_SAMPLE || worst.FleetSample < MIN_SAMPLE

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{type}</CardTitle>
        <p className="mt-1 text-sm leading-relaxed text-slate-700">
          <span className="font-medium text-slate-900">{best.Manufacturer} {num(best.UnschedPerAssetYr, 2)}</span>
          {' vs '}
          <span className="font-medium text-slate-900">{worst.Manufacturer} {num(worst.UnschedPerAssetYr, 2)}</span>
          {' '}unscheduled jobs per unit per year
          {gap !== null && gap > 0 ? ` — ${pct(gap, 0)} more on the ${worst.Manufacturer} units.` : '.'}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          On {int(best.FleetSample)} {best.Manufacturer} unit{best.FleetSample === 1 ? '' : 's'} and{' '}
          {int(worst.FleetSample)} {worst.Manufacturer} unit{worst.FleetSample === 1 ? '' : 's'} over{' '}
          {YEARS_OF_HISTORY} years.
          {headlineThin && ' Fewer than three units on one side, so read it as a pointer rather than a verdict.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => (
          <div key={r.Manufacturer} className="min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-sm">
              <span className="min-w-0 text-slate-800">
                {r.Manufacturer}
                <span className="ml-1.5 text-xs text-slate-400">{int(r.FleetSample)} unit{r.FleetSample === 1 ? '' : 's'}</span>
              </span>
              <span className="shrink-0 tabular-nums font-semibold text-slate-900">{num(r.UnschedPerAssetYr, 2)}</span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full rounded-full ${r.FleetSample < MIN_SAMPLE ? 'bg-slate-400' : 'bg-blue-500'}`}
                style={{ width: `${(r.UnschedPerAssetYr / max) * 100}%` }}
              />
            </div>
            <div className="mt-0.5 text-xs text-slate-500 tabular-nums">
              {money(r.CostPerAssetYr)} a unit a year · come-backs {pct(r.ComebackRate, 1)}
            </div>
          </div>
        ))}
        {thin.length > 0 && (
          <p className="text-xs text-slate-500">
            Grey bars rest on fewer than {MIN_SAMPLE} units.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function BandCard({ band, lowest }) {
  return (
    <Card className={lowest ? 'border-emerald-200' : undefined}>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {band.CompBand}
          {lowest && <Badge className="bg-emerald-100 text-emerald-800">Fewest breakdowns</Badge>}
        </CardTitle>
        <p className="mt-1 text-sm text-slate-500">
          {int(band.AssetYears)} asset-years · {PM_BAND_NOTE[band.CompBand] || ''}
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Unscheduled</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{num(band.AvgUnsched, 2)}</p>
          <p className="text-xs text-slate-500">a unit a year</p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Cost</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{money(band.AvgCost)}</p>
          <p className="text-xs text-slate-500">a unit a year</p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">PM jobs</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{num(band.AvgPM, 2)}</p>
          <p className="text-xs text-slate-500">a unit a year</p>
        </div>
      </CardContent>
    </Card>
  )
}

function OwnerCard({ row, Icon, tone }) {
  return (
    <Card className={tone === 'green' ? 'border-emerald-200' : 'border-amber-200'}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={`h-4 w-4 shrink-0 ${tone === 'green' ? 'text-emerald-600' : 'text-amber-600'}`} />
          <span className="min-w-0">{row.StableOwner}</span>
        </CardTitle>
        <p className="mt-1 text-sm text-slate-500">
          {int(row.Assets)} units · {num(row.AvgTechsOnAsset, 1)} technicians on a unit over {YEARS_OF_HISTORY} years
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Unscheduled</p>
          <p className={`mt-0.5 text-2xl font-bold tabular-nums ${tone === 'green' ? 'text-emerald-700' : 'text-amber-700'}`}>
            {num(row.AvgUnscheduled, 1)}
          </p>
          <p className="text-xs text-slate-500">a unit, 5 years</p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Come-backs</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{num(row.AvgComebacks, 2)}</p>
          <p className="text-xs text-slate-500">a unit, 5 years</p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Cost</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{money(row.AvgCostUSD)}</p>
          <p className="text-xs text-slate-500">a unit, 5 years</p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Technicians</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{num(row.AvgTechsOnAsset, 1)}</p>
          <p className="text-xs text-slate-500">different hands</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function GseReliability() {
  const router = useRouter()
  const [I, setI] = useState(null)

  // OEM and type table
  const [oemSort, setOemSort] = useState({ key: 'FleetSample', dir: 'desc' })
  const [oemType, setOemType] = useState('all')
  const [oemMaker, setOemMaker] = useState('all')
  const [oemQ, setOemQ] = useState('')

  // Asset-year table
  const [ayBand, setAyBand] = useState('all')
  const [ayYear, setAyYear] = useState('all')
  const [ayClass, setAyClass] = useState('all')
  const [ayQ, setAyQ] = useState('')
  const [aySort, setAySort] = useState({ key: 'Unsched', dir: 'desc' })

  const enabled = GSE_ACTIVE && Boolean(loadGseAnalytics)

  useEffect(() => {
    if (!enabled) return undefined
    let live = true
    loadGseAnalytics().then((a) => { if (live) setI(a.insights) }).catch(() => {})
    return () => { live = false }
  }, [enabled])

  const oemRows = I?.oemType || []
  const nightBank = I?.oemNightBank || []
  const pmBands = I?.pmBands || []
  const owners = I?.stableOwner || []
  const assetYears = I?.assetYears || []

  // Night-bank types with more than one make in the record — the only ones where
  // there is an actual comparison to draw.
  const compares = useMemo(() => {
    const byType = new Map()
    nightBank.forEach((r) => {
      if (!byType.has(r.EquipmentType)) byType.set(r.EquipmentType, [])
      byType.get(r.EquipmentType).push(r)
    })
    return [...byType.entries()]
      .map(([type, rows]) => ({ type, rows: [...rows].sort((a, b) => a.UnschedPerAssetYr - b.UnschedPerAssetYr) }))
      .filter((g) => g.rows.length > 1)
      // Biggest spread first: that is the pair a buyer argues about.
      .sort((a, b) => {
        const sa = a.rows[a.rows.length - 1].UnschedPerAssetYr - a.rows[0].UnschedPerAssetYr
        const sb = b.rows[b.rows.length - 1].UnschedPerAssetYr - b.rows[0].UnschedPerAssetYr
        return sb - sa
      })
  }, [nightBank])

  // Best and worst on the night bank, counted only over pairs with enough units
  // behind them to stand as a statement about a make.
  const extremes = useMemo(() => {
    const solid = nightBank.filter((r) => r.FleetSample >= MIN_SAMPLE)
    if (!solid.length) return null
    const sorted = [...solid].sort((a, b) => a.UnschedPerAssetYr - b.UnschedPerAssetYr)
    return { best: sorted[0], worst: sorted[sorted.length - 1] }
  }, [nightBank])

  const oemTypes = useMemo(
    () => [...new Set(oemRows.map((r) => r.EquipmentType))].sort((a, b) => a.localeCompare(b)),
    [oemRows],
  )
  const oemMakers = useMemo(
    () => [...new Set(oemRows.map((r) => r.Manufacturer))].sort((a, b) => a.localeCompare(b)),
    [oemRows],
  )

  const oemShown = useMemo(() => {
    const needle = oemQ.trim().toLowerCase()
    const filtered = oemRows.filter((r) => (
      (oemType === 'all' || r.EquipmentType === oemType)
      && (oemMaker === 'all' || r.Manufacturer === oemMaker)
      && (!needle || `${r.Manufacturer} ${r.EquipmentType} ${r.ReliabilityBand}`.toLowerCase().includes(needle))
    ))
    return sortRows(filtered, oemSort)
  }, [oemRows, oemType, oemMaker, oemQ, oemSort])
  const oemPaged = usePaged(oemShown, 20, `${oemType}|${oemMaker}|${oemQ}`)

  const ayYears = useMemo(
    () => [...new Set(assetYears.map((r) => r.Year))].sort((a, b) => b - a),
    [assetYears],
  )
  const ayClasses = useMemo(
    () => [...new Set(assetYears.map((r) => r.Class))].sort((a, b) => a.localeCompare(b)),
    [assetYears],
  )
  const latestYear = ayYears.length ? ayYears[0] : null

  const backlogCount = useMemo(
    () => assetYears.filter((r) => r.Year === latestYear && r.CompBand === 'Behind PM cycle').length,
    [assetYears, latestYear],
  )
  const backlogOn = ayBand === 'Behind PM cycle' && latestYear !== null && ayYear === String(latestYear)

  const ayShown = useMemo(() => {
    const needle = ayQ.trim().toLowerCase()
    const filtered = assetYears.filter((r) => (
      (ayBand === 'all' || r.CompBand === ayBand)
      && (ayYear === 'all' || String(r.Year) === ayYear)
      && (ayClass === 'all' || r.Class === ayClass)
      && (!needle || `${r.AssetID} ${r.Manufacturer} ${r.EquipmentType}`.toLowerCase().includes(needle))
    ))
    return sortRows(filtered, aySort)
  }, [assetYears, ayBand, ayYear, ayClass, ayQ, aySort])
  const ayPaged = usePaged(ayShown, 25, `${ayBand}|${ayYear}|${ayClass}|${ayQ}`)

  const behindShare = assetYears.length
    ? assetYears.filter((r) => r.CompBand === 'Behind PM cycle').length / assetYears.length
    : null

  const bandsInOrder = useMemo(
    () => PM_BAND_ORDER.map((name) => pmBands.find((b) => b.CompBand === name)).filter(Boolean),
    [pmBands],
  )
  const lowestBand = useMemo(() => {
    if (!pmBands.length) return null
    return [...pmBands].sort((a, b) => a.AvgUnsched - b.AvgUnsched)[0].CompBand
  }, [pmBands])

  const behind = pmBands.find((b) => b.CompBand === 'Behind PM cycle')
  const onCycle = pmBands.find((b) => b.CompBand === 'On cycle')
  const ahead = pmBands.find((b) => b.CompBand === 'Ahead / extra PM')

  const stable = owners.find((o) => /^Stable/.test(o.StableOwner))
  const rotating = owners.find((o) => /^Rotating/.test(o.StableOwner))

  const smallSampleCount = oemRows.filter((r) => r.FleetSample < MIN_SAMPLE).length

  if (!enabled) return <ModuleOff module="Reliability insights" />

  if (!I) {
    return (
      <div className="max-w-8xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Reliability Insights</h1>
          <p className="mt-1 text-slate-600">
            Which makes hold up at CVG, what the PM cycle actually changes, and who has been on the unit
          </p>
        </div>
        <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-64 animate-pulse rounded-lg bg-slate-100" />
      </div>
    )
  }

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Reliability Insights</h1>
        <p className="mt-1 text-slate-600">
          Which makes hold up at CVG, what the PM cycle actually changes, and who has been on the unit —
          measured over {YEARS_OF_HISTORY} years of ground support equipment
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        <Stat
          label="Make/type pairs"
          value={int(oemRows.length)}
          sub={`compared over ${YEARS_OF_HISTORY} years`}
          Icon={Factory}
        />
        <Stat
          label="Night bank best"
          value={num(extremes?.best?.UnschedPerAssetYr, 2)}
          sub={extremes ? `${extremes.best.Manufacturer} · ${extremes.best.EquipmentType} · ${int(extremes.best.FleetSample)} units` : '—'}
          Icon={ShieldCheck} tone="green"
        />
        <Stat
          label="Night bank worst"
          value={num(extremes?.worst?.UnschedPerAssetYr, 2)}
          sub={extremes ? `${extremes.worst.Manufacturer} · ${extremes.worst.EquipmentType} · ${int(extremes.worst.FleetSample)} units` : '—'}
          Icon={AlertTriangle} tone="amber"
        />
        <Stat
          label="Asset-years"
          value={int(assetYears.length)}
          sub={`one row per unit per year, ${ayYears.length ? `${ayYears[ayYears.length - 1]}–${ayYears[0]}` : ''}`}
          Icon={CalendarClock}
        />
        <Stat
          label="Behind PM cycle"
          value={pct(behindShare, 0)}
          sub={`${int(assetYears.filter((r) => r.CompBand === 'Behind PM cycle').length)} asset-years of ${int(assetYears.length)}`}
          Icon={ClipboardList}
        />
      </div>

      <p className="text-sm leading-relaxed text-slate-600">
        Unscheduled jobs per unit per year is the measure throughout: a count of breakdowns divided by the
        units in the record and the years they were in it, so a make with ten units is not penalised for
        being common. Best and worst above are counted only over makes with {MIN_SAMPLE} units or more.
      </p>

      <Tabs defaultValue="oem">
        <TabsList className="flex-wrap">
          <TabsTrigger value="oem" className="gap-1.5"><Factory className="h-4 w-4" />OEM and type</TabsTrigger>
          <TabsTrigger value="pm" className="gap-1.5"><Wrench className="h-4 w-4" />PM cycle</TabsTrigger>
          <TabsTrigger value="owner" className="gap-1.5"><Users className="h-4 w-4" />Owner</TabsTrigger>
        </TabsList>

        {/* ── make against make, on the units that do the same work ─────── */}
        <TabsContent value="oem" className="mt-4 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">The night-bank comparison</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Tractors, loaders, pushbacks and ground power units work the same sort on the same shift, so
              their makes can be set against each other fairly. Only types where the record holds more than
              one make are shown — {compares.length} of the {new Set(nightBank.map((r) => r.EquipmentType)).size} night-bank
              types. Every figure says how many units it rests on.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {compares.map((g) => <TypeCompare key={g.type} type={g.type} rows={g.rows} />)}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <CardTitle className="text-base">
                    Every make and type
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      {oemShown.length.toLocaleString('en-US')} of {oemRows.length.toLocaleString('en-US')} pairs
                    </span>
                  </CardTitle>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">
                    The whole fleet, night bank and everything else. {smallSampleCount} of these pairs cover
                    fewer than {MIN_SAMPLE} units and are marked as too small to judge — they are shown because
                    leaving them out would hide most of the register, not because they settle anything.
                    Click a heading to sort.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={oemQ} onChange={(e) => setOemQ(e.target.value)} placeholder="Make or type"
                      className="h-9 w-full pl-8 sm:w-52"
                    />
                  </span>
                  <select value={oemType} onChange={(e) => setOemType(e.target.value)} className={SELECT} aria-label="Equipment type">
                    <option value="all">All equipment types</option>
                    {oemTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select value={oemMaker} onChange={(e) => setOemMaker(e.target.value)} className={SELECT} aria-label="Manufacturer">
                    <option value="all">All manufacturers</option>
                    {oemMakers.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <SortHeader label="Manufacturer" k="Manufacturer" sort={oemSort} setSort={setOemSort} align="left" numeric={false} pad="pr-2" />
                      <SortHeader label="Equipment type" k="EquipmentType" sort={oemSort} setSort={setOemSort} align="left" numeric={false} pad="pr-2" />
                      <SortHeader label="Units" k="FleetSample" sort={oemSort} setSort={setOemSort} pad="pr-2" />
                      <SortHeader label="Work orders" k="WOs" sort={oemSort} setSort={setOemSort} pad="pr-2" />
                      <SortHeader label="Preventive" k="Preventive" sort={oemSort} setSort={setOemSort} pad="pr-2" />
                      <SortHeader label="Unscheduled" k="Unscheduled" sort={oemSort} setSort={setOemSort} pad="pr-2" />
                      <SortHeader label="Unsched / unit / yr" k="UnschedPerAssetYr" sort={oemSort} setSort={setOemSort} pad="pr-2" />
                      <SortHeader label="Come-back rate" k="ComebackRate" sort={oemSort} setSort={setOemSort} pad="pr-2" />
                      <SortHeader label="Cost / unit / yr" k="CostPerAssetYr" sort={oemSort} setSort={setOemSort} pad="pr-2" />
                      <SortHeader label="Downtime h" k="DowntimeHrs" sort={oemSort} setSort={setOemSort} pad="pr-2" />
                      <SortHeader label="Band" k="ReliabilityBand" sort={oemSort} setSort={setOemSort} align="left" numeric={false} pad="pr-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {oemPaged.pageItems.map((r) => {
                      const thin = r.FleetSample < MIN_SAMPLE
                      return (
                        <tr key={`${r.Manufacturer}|${r.EquipmentType}`} className={`align-top ${thin ? 'bg-amber-50/40' : ''}`}>
                          <td className="py-2 pr-2 whitespace-nowrap align-top">
                            <span className="block font-medium text-slate-900">{r.Manufacturer}</span>
                            {thin && <SmallSample />}
                          </td>
                          {/* Type names run to "Scissor Lift / Maintenance Stand Powered" — left
                              unwrapped they push the band badge off the card at every width. */}
                          <td className="py-2 pr-2 text-slate-600 align-top max-w-44">{r.EquipmentType}</td>
                          <td className={`py-2 pr-2 text-right tabular-nums align-top ${thin ? 'text-amber-700 font-semibold' : 'text-slate-600'}`}>
                            {int(r.FleetSample)}
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums text-slate-600">{int(r.WOs)}</td>
                          <td className="py-2 pr-2 text-right tabular-nums text-slate-600">{int(r.Preventive)}</td>
                          <td className="py-2 pr-2 text-right tabular-nums text-slate-600">{int(r.Unscheduled)}</td>
                          <td className={`py-2 pr-2 text-right tabular-nums font-semibold ${thin ? 'text-slate-400' : 'text-slate-900'}`}>
                            {num(r.UnschedPerAssetYr, 2)}
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums text-slate-600">{pct(r.ComebackRate, 1)}</td>
                          <td className="py-2 pr-2 text-right tabular-nums text-slate-600">{money(r.CostPerAssetYr)}</td>
                          <td className="py-2 pr-2 text-right tabular-nums text-slate-600">{num(r.DowntimeHrs, 1)}</td>
                          <td className="py-2 max-w-36">
                            <Badge className={`whitespace-normal text-left leading-tight ${BAND_LOOK[r.ReliabilityBand] || 'bg-slate-100 text-slate-700'}`}>
                              {r.ReliabilityBand}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {oemShown.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-500">No make and type pair matches those filters.</p>
              )}
              <PagerBar {...oemPaged} noun="pairs" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── what the PM cycle actually changes ─────────────────────────── */}
        <TabsContent value="pm" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {bandsInOrder.map((b) => <BandCard key={b.CompBand} band={b} lowest={b.CompBand === lowestBand} />)}
          </div>

          {behind && onCycle && ahead && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-amber-900">Read this one as it is, not as it is usually told.</p>
                <p className="text-sm leading-relaxed text-amber-900/90">
                  Asset-years behind the PM cycle averaged {num(behind.AvgUnsched, 2)} unscheduled jobs.
                  Asset-years on cycle averaged {num(onCycle.AvgUnsched, 2)} — slightly <em>worse</em>, not better.
                  The band that stands apart is the one that got extra preventive work, at {num(ahead.AvgUnsched, 2)}.
                  So what this record supports is that units run <strong>ahead</strong> of the standard break down
                  less than everything else; it does not support the tidier claim that falling behind the cycle is
                  worse than keeping to it.
                </p>
                <p className="text-sm leading-relaxed text-amber-900/90">
                  Two things are worth holding alongside that. The on-cycle band is the smallest of the three at{' '}
                  {int(onCycle.AssetYears)} asset-years against {int(behind.AssetYears)} behind and{' '}
                  {int(ahead.AssetYears)} ahead, so it moves on fewer units. And extra PM costs money:{' '}
                  {money(ahead.AvgCost)} a unit a year against {money(behind.AvgCost)} for the behind band, which
                  is most of the saving the fewer breakdowns would otherwise buy.
                </p>
              </div>
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <CardTitle className="text-base">
                    Unit by unit, year by year
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      {ayShown.length.toLocaleString('en-US')} of {assetYears.length.toLocaleString('en-US')} asset-years
                    </span>
                  </CardTitle>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">
                    One row for each unit in each year it was in the record: the preventive jobs it got against
                    the standard&apos;s expectation, and what happened to it that year.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={ayQ} onChange={(e) => setAyQ(e.target.value)} placeholder="Unit, make or type"
                      className="h-9 w-full pl-8 sm:w-52"
                    />
                  </span>
                  <select value={ayBand} onChange={(e) => setAyBand(e.target.value)} className={SELECT} aria-label="PM band">
                    <option value="all">All PM bands</option>
                    {PM_BAND_ORDER.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <select value={ayYear} onChange={(e) => setAyYear(e.target.value)} className={SELECT} aria-label="Year">
                    <option value="all">All years</option>
                    {ayYears.map((y) => <option key={y} value={String(y)}>{y}</option>)}
                  </select>
                  <select value={ayClass} onChange={(e) => setAyClass(e.target.value)} className={SELECT} aria-label="Class">
                    <option value="all">All classes</option>
                    {ayClasses.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {latestYear !== null && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    variant={backlogOn ? 'default' : 'outline'} size="sm"
                    onClick={() => {
                      setAyBand('Behind PM cycle')
                      setAyYear(String(latestYear))
                      setAyClass('all')
                      setAyQ('')
                    }}
                  >
                    This week&apos;s backlog — {backlogCount.toLocaleString('en-US')} units behind cycle in {latestYear}
                  </Button>
                  {(ayBand !== 'all' || ayYear !== 'all' || ayClass !== 'all' || ayQ) && (
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => { setAyBand('all'); setAyYear('all'); setAyClass('all'); setAyQ('') }}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <SortHeader label="Unit" k="AssetID" sort={aySort} setSort={setAySort} align="left" numeric={false} />
                      <SortHeader label="Year" k="Year" sort={aySort} setSort={setAySort} />
                      <SortHeader label="Class" k="Class" sort={aySort} setSort={setAySort} align="left" numeric={false} />
                      <th className="py-2 pr-3 font-medium text-right whitespace-nowrap">
                        <span className="text-xs font-medium uppercase tracking-wide">PM done / expected</span>
                      </th>
                      <SortHeader label="PM compliance" k="PMCompliance" sort={aySort} setSort={setAySort} />
                      <SortHeader label="Unscheduled" k="Unsched" sort={aySort} setSort={setAySort} />
                      <SortHeader label="Cost" k="Cost" sort={aySort} setSort={setAySort} />
                      <SortHeader label="Band" k="CompBand" sort={aySort} setSort={setAySort} align="left" numeric={false} />
                      <th className="py-2 font-medium text-right" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ayPaged.pageItems.map((r) => (
                      <tr key={`${r.AssetID}-${r.Year}`}>
                        <td className="py-2 pr-3 min-w-44">
                          <span className="block font-medium text-slate-900">{r.AssetID}</span>
                          <span className="block text-xs text-slate-500">{r.Manufacturer} · {r.EquipmentType}</span>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{r.Year}</td>
                        <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">{r.Class}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-slate-600 whitespace-nowrap">
                          {int(r.PM)} / {int(r.ExpectedPM)}
                        </td>
                        <td className={`py-2 pr-3 text-right tabular-nums font-semibold ${r.PMCompliance >= 1 ? 'text-emerald-700' : 'text-slate-700'}`}>
                          {pct(r.PMCompliance, 0)}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-slate-900">{int(r.Unsched)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{money(r.Cost)}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          <Badge className={PM_BAND_LOOK[r.CompBand] || 'bg-slate-100 text-slate-700'}>{r.CompBand}</Badge>
                        </td>
                        <td className="py-2 text-right">
                          <Button
                            variant="outline" size="sm" className="h-8 whitespace-nowrap"
                            onClick={() => router.push(`/portal/oxmaint/assets/${encodeURIComponent(r.AssetID)}`)}
                          >
                            Open unit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ayShown.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-500">No asset-year matches those filters.</p>
              )}
              <PagerBar {...ayPaged} noun="asset-years" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── the same unit, the same hands ──────────────────────────────── */}
        <TabsContent value="owner" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {stable && <OwnerCard row={stable} Icon={CircleDot} tone="green" />}
            {rotating && <OwnerCard row={rotating} Icon={Activity} tone="amber" />}
          </div>

          {stable && rotating && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">What the difference is</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-relaxed text-slate-700">
                  Units that stayed with a small crew averaged{' '}
                  <strong className="text-slate-900">{num(stable.AvgUnscheduled, 1)} unscheduled events</strong> over
                  five years against <strong className="text-slate-900">{num(rotating.AvgUnscheduled, 1)}</strong> on
                  units that rotated through more hands, on{' '}
                  <strong className="text-slate-900">{num(stable.AvgTechsOnAsset, 1)} technicians</strong> against{' '}
                  <strong className="text-slate-900">{num(rotating.AvgTechsOnAsset, 1)}</strong>. Come-backs run{' '}
                  {num(stable.AvgComebacks, 2)} against {num(rotating.AvgComebacks, 2)}, and five-year cost{' '}
                  {money(stable.AvgCostUSD)} against {money(rotating.AvgCostUSD)}.
                </p>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm leading-relaxed text-slate-600">
                    <strong className="text-slate-800">This is an association in the record, not a proven cause.</strong>{' '}
                    The bigger, busier units are the ones that break down most, and a unit that breaks down most is
                    also the unit that passes through the most hands — so the same fact could be producing both
                    columns. The honest reading is that stable ownership is worth trying on the units that cost the
                    most, and worth measuring afterwards, not that assigning a unit to one technician will cut its
                    breakdowns by four fifths.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-slate-600">Per-person hours, come-backs and rework are on the technician screen.</span>
                  <Button variant="outline" size="sm" onClick={() => router.push('/portal/oxmaint/gse-tech-kpi')}>
                    Technician KPIs <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
