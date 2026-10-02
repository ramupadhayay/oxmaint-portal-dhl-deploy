'use client'

// Parts Kits & Sourcing — what a job takes off the shelf, and whether the
// cheaper part is actually cheaper.
//
// Two questions a GSE stores lead is asked every month, and both go wrong when
// answered from a price list alone.
//
// Kits first. A 250-hour PM is not one part, it is five, and the job stalls on
// whichever of the five ran out. So each kit is shown as its lines against live
// stock, with the number of complete kits the shelf can build and the line that
// limits it named — "we have plenty of oil filters" is no comfort when the fuel
// filter is the short line. Annual spend is projected from how often the kit
// actually went onto a job in the last twelve months, not from a PM plan.
//
// Then sourcing. The workbook's planning assumption is that 28% of part lines go
// aftermarket; five years of history says the station is nowhere near that. The
// gap is only worth closing where the cheaper part lasts. A filter at 60% of the
// price that is changed twice as often is not a saving, so parts are compared on
// cost per day of life (unit cost ÷ median days between installs on the same
// unit) and on early failures per 100 installs, and each gets a verdict:
//
//   - OEM only          no aftermarket price, or it is not cheaper
//   - Needs a trial     fewer than 5 aftermarket lines or 3 life samples — the
//                       price saving is shown, but there is no evidence yet
//   - Aftermarket pays  cheaper per day of life, and early failures no more than
//                       2 per 100 installs above OEM
//   - Stay with OEM     everything else: cheaper to buy, dearer to run
//
// Where OEM has no life history to compare against, the aftermarket part is
// judged on unit price (it is cheaper by then) plus the failure test.
//
// Read-only: the only live figure is stock on hand, read from the ledger.

import { useEffect, useMemo, useState } from 'react'
import {
  Package, Boxes, AlertTriangle, TrendingDown, Search, Scale, DollarSign, Loader2,
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { Input } from '../ui/input'
import { GSE_ACTIVE } from '../lib/gse'
import { loadGseAnalytics, money, ORG } from '../lib/data'
import { useStock } from '../lib/movements'
import ModuleOff from '../components/ModuleOff'
import PagerBar, { usePaged } from '../components/ListPager'

const KIT_TYPES = ['PM', 'Repair', 'Seasonal', 'Inspection']
const TYPE_LOOK = {
  PM: 'bg-blue-100 text-blue-800',
  Repair: 'bg-red-100 text-red-800',
  Seasonal: 'bg-violet-100 text-violet-800',
  Inspection: 'bg-slate-100 text-slate-700',
}

const VERDICTS = ['Aftermarket pays', 'Needs a trial', 'Stay with OEM', 'OEM only']
const VERDICT_LOOK = {
  'Aftermarket pays': 'bg-emerald-100 text-emerald-800',
  'Needs a trial': 'bg-blue-100 text-blue-800',
  'Stay with OEM': 'bg-amber-100 text-amber-800',
  'OEM only': 'bg-slate-100 text-slate-700',
}

const SELECT = 'h-10 px-3 rounded-md border border-slate-200 text-sm bg-white outline-none focus:border-primary/40'

// Unit prices need their cents; `money` rounds to whole dollars, which is right
// for totals and wrong for a $3.85 grease cartridge.
const price = (n) => (Number.isFinite(Number(n)) && n !== null
  ? `${ORG.currency_symbol}${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  : '—')
const pct = (n, d = 0) => (Number.isFinite(n) ? `${(n * 100).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })}%` : '—')
const int = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—')

// Early failures per 100 installs; null when the source was never fitted.
const failRate = (s) => (s?.lines ? (s.earlyFailures / s.lines) * 100 : null)
// Unit cost per day of life; null without a median life.
const perDay = (cost, s) => (cost > 0 && s?.medianLifeDays ? cost / s.medianLifeDays : null)

function verdictOf(p) {
  const oem = Number(p.oem_unit_cost) || 0
  const alt = Number(p.alt_unit_cost) || 0
  if (!alt || alt >= oem) return 'OEM only'
  if ((p.alt?.lines || 0) < 5 || (p.alt?.lifeSamples || 0) < 3) return 'Needs a trial'
  const oemDay = perDay(oem, p.oem)
  const altDay = perDay(alt, p.alt)
  // No OEM life history: the aftermarket part is already cheaper per unit.
  const cheaperToRun = oemDay === null ? true : altDay !== null && altDay < oemDay
  const oemFail = failRate(p.oem) ?? 0
  const altFail = failRate(p.alt) ?? 0
  return cheaperToRun && altFail <= oemFail + 2 ? 'Aftermarket pays' : 'Stay with OEM'
}

export default function GsePartsKits() {
  const [a, setA] = useState(null)
  const [tab, setTab] = useState('kits')
  const [kitType, setKitType] = useState('all')
  const [category, setCategory] = useState('all')
  const [verdict, setVerdict] = useState('all')
  const [q, setQ] = useState('')
  const { levels } = useStock()

  const enabled = GSE_ACTIVE && Boolean(loadGseAnalytics)

  useEffect(() => {
    if (!enabled) return
    let live = true
    loadGseAnalytics().then((r) => { if (live) setA(r) })
    return () => { live = false }
  }, [enabled])

  // Live quantity per part. The kit line carries the opening balance, which is
  // only the fallback — a filter issued this morning must show as gone.
  const stockOf = useMemo(() => {
    const m = new Map()
    ;(levels || []).forEach((p) => m.set(p.part_id || p.recordId, Number(p.quantity_on_hand) || 0))
    return m
  }, [levels])

  const kits = useMemo(() => (a?.kits || []).map((k) => {
    const lines = k.lines.map((l) => {
      const onHand = stockOf.has(l.part_id) ? stockOf.get(l.part_id) : Number(l.on_hand) || 0
      const alt = Number(l.alt_unit_cost) || Number(l.oem_unit_cost) || 0
      return {
        ...l,
        onHand,
        builds: l.qty > 0 ? Math.floor(onHand / l.qty) : Infinity,
        short: onHand < l.qty,
        oemLine: l.qty * (Number(l.oem_unit_cost) || 0),
        altLine: l.qty * alt,
      }
    })
    const oem = lines.reduce((n, l) => n + l.oemLine, 0)
    const alt = lines.reduce((n, l) => n + l.altLine, 0)
    const limiting = lines.reduce((m, l) => (m === null || l.builds < m.builds ? l : m), null)
    return {
      ...k, lines, oem, alt,
      saving: oem ? (oem - alt) / oem : 0,
      buildable: limiting && Number.isFinite(limiting.builds) ? limiting.builds : 0,
      limiting,
      annualOem: k.issued12m * oem,
      annualAlt: k.issued12m * alt,
    }
  }), [a, stockOf])

  const shownKits = useMemo(
    () => (kitType === 'all' ? kits : kits.filter((k) => k.type === kitType)),
    [kits, kitType],
  )

  const parts = useMemo(() => (a?.partUsage || []).map((p) => {
    const oem = Number(p.oem_unit_cost) || 0
    const alt = Number(p.alt_unit_cost) || 0
    return {
      ...p,
      verdict: verdictOf(p),
      diff: alt && oem ? (alt - oem) / oem : null,
      oemFail: failRate(p.oem),
      altFail: failRate(p.alt),
      oemDay: perDay(oem, p.oem),
      altDay: perDay(alt, p.alt),
      spend12m: (p.oem?.qty12m || 0) * oem + (p.alt?.qty12m || 0) * (alt || oem),
      saving12m: alt && alt < oem ? (oem - alt) * (p.oem?.qty12m || 0) : 0,
    }
  }), [a])

  const categories = useMemo(
    () => [...new Set(parts.map((p) => p.category).filter(Boolean))].sort(),
    [parts],
  )

  const filteredParts = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return parts
      .filter((p) => category === 'all' || p.category === category)
      .filter((p) => verdict === 'all' || p.verdict === verdict)
      .filter((p) => !needle
        || `${p.part_number} ${p.part_name} ${p.vendor_name} ${p.alt_vendor_name}`.toLowerCase().includes(needle))
      .sort((x, y) => VERDICTS.indexOf(x.verdict) - VERDICTS.indexOf(y.verdict) || y.saving12m - x.saving12m)
  }, [parts, category, verdict, q])

  const paged = usePaged(filteredParts, 15, `${category}|${verdict}|${q}`)

  if (!enabled) return <ModuleOff module="Parts kits and sourcing" />

  if (!a) {
    return (
      <div className="max-w-8xl mx-auto p-6 space-y-6">
        <Header />
        <div className="flex items-center gap-2 py-16 justify-center text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading five years of parts history…
        </div>
      </div>
    )
  }

  const { stats, targets } = a
  const share = stats.partLines ? stats.aftermarketLines / stats.partLines : 0
  const gapPts = Math.round((targets.aftermarketShare - share) * 100)
  const spend12m = parts.reduce((n, p) => n + p.spend12m, 0)
  const pays = parts.filter((p) => p.verdict === 'Aftermarket pays')
  const modeledSaving = pays.reduce((n, p) => n + p.saving12m, 0)
  const verdictCount = Object.fromEntries(VERDICTS.map((v) => [v, parts.filter((p) => p.verdict === v).length]))

  const kitsShort = kits.filter((k) => k.buildable === 0)
  const annualKitOem = kits.reduce((n, k) => n + k.annualOem, 0)
  const annualKitAlt = kits.reduce((n, k) => n + k.annualAlt, 0)

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <Header />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full sm:w-96 grid-cols-2 h-11">
          <TabsTrigger value="kits" className="flex items-center gap-2">
            <Boxes className="w-4 h-4" /> Kits
          </TabsTrigger>
          <TabsTrigger value="sourcing" className="flex items-center gap-2">
            <Scale className="w-4 h-4" /> OEM vs aftermarket
          </TabsTrigger>
        </TabsList>

        {/* ── Kits ─────────────────────────────────────────────────────── */}
        <TabsContent value="kits" className="space-y-6 mt-4">
          {kitsShort.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-red-900">
                  {kitsShort.length} kit{kitsShort.length === 1 ? '' : 's'} cannot be built from stock right now
                </p>
                <p className="text-sm text-red-800 mt-0.5">
                  {kitsShort.map((k) => `${k.name} (short: ${k.limiting?.part_number})`).join(' · ')}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Kits defined" value={kits.length} sub={`${int(kits.reduce((n, k) => n + k.issued12m, 0))} issues in 12 months`} Icon={Boxes} />
            <Stat label="Not buildable" value={kitsShort.length} sub="at least one short line" Icon={AlertTriangle} tone={kitsShort.length ? 'red' : 'green'} />
            <Stat label="Annual kit spend" value={money(annualKitOem)} sub="OEM, at the 12-month issue rate" Icon={DollarSign} />
            <Stat label="If aftermarket" value={money(annualKitAlt)} sub={`${money(annualKitOem - annualKitAlt)} less a year`} Icon={TrendingDown} tone="green" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select value={kitType} onChange={(e) => setKitType(e.target.value)} className={SELECT}>
              <option value="all">All kit types</option>
              {KIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="text-sm text-slate-500">{shownKits.length} of {kits.length} kits</span>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {shownKits.map((k) => <KitCard key={k.id} k={k} />)}
          </div>
        </TabsContent>

        {/* ── OEM vs aftermarket ───────────────────────────────────────── */}
        <TabsContent value="sourcing" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat
              label="Aftermarket share" value={pct(share)}
              sub={`${int(stats.aftermarketLines)} of ${int(stats.partLines)} part lines over 5 years — planning assumes ${pct(targets.aftermarketShare)}, a gap of ${gapPts} points`}
              Icon={Scale} tone={share < targets.aftermarketShare ? 'amber' : 'green'}
            />
            <Stat
              label="Parts spend, 12 months" value={money(spend12m)}
              sub={`${parts.length} parts, quantities used at current unit prices`}
              Icon={DollarSign}
            />
            <Stat
              label="Modeled saving" value={money(modeledSaving)}
              sub={`a year, switching the ${pays.length} part${pays.length === 1 ? '' : 's'} where aftermarket pays`}
              Icon={TrendingDown} tone="green"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <Package className="w-5 h-5" />
                Part by part
                <span className="ml-auto flex flex-wrap gap-1.5">
                  {VERDICTS.map((v) => (
                    <Badge key={v} className={VERDICT_LOOK[v]}>{v}: {verdictCount[v]}</Badge>
                  ))}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search part or vendor" className="pl-9" />
                </div>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={SELECT}>
                  <option value="all">All categories</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={verdict} onChange={(e) => setVerdict(e.target.value)} className={SELECT}>
                  <option value="all">All verdicts</option>
                  {VERDICTS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3 font-medium">Part</th>
                      <th className="py-2 pr-3 font-medium text-right">OEM unit</th>
                      <th className="py-2 pr-3 font-medium text-right">Aftermarket unit</th>
                      <th className="py-2 pr-3 font-medium text-right">Price diff</th>
                      <th className="py-2 pr-3 font-medium text-right whitespace-nowrap">Lines 5y<br /><span className="normal-case">OEM / AM</span></th>
                      <th className="py-2 pr-3 font-medium text-right whitespace-nowrap">Median life, days<br /><span className="normal-case">OEM / AM</span></th>
                      <th className="py-2 pr-3 font-medium text-right whitespace-nowrap">Early fails /100<br /><span className="normal-case">OEM / AM</span></th>
                      <th className="py-2 pr-3 font-medium text-right whitespace-nowrap">Cost per day<br /><span className="normal-case">OEM / AM</span></th>
                      <th className="py-2 font-medium">Verdict</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paged.pageItems.map((p) => (
                      <tr key={p.part_id} className="align-top">
                        <td className="py-2.5 pr-3 min-w-48">
                          <span className="block font-medium text-slate-900">{p.part_name}</span>
                          <span className="block text-xs text-slate-500">{p.part_number} · {p.category || 'Uncategorised'}</span>
                        </td>
                        <td className="py-2.5 pr-3 text-right whitespace-nowrap">
                          <span className="block tabular-nums text-slate-900">{price(p.oem_unit_cost)}</span>
                          <span className="block text-xs text-slate-500">{p.vendor_name || '—'}</span>
                        </td>
                        <td className="py-2.5 pr-3 text-right whitespace-nowrap">
                          <span className="block tabular-nums text-slate-900">{p.alt_unit_cost ? price(p.alt_unit_cost) : '—'}</span>
                          <span className="block text-xs text-slate-500">
                            {p.alt_unit_cost ? (p.alt_vendor_name || '—') : ''}
                            {p.alt_unit_cost && p.vendor_name && p.vendor_name === p.alt_vendor_name
                              ? <span className="block text-slate-400">same supplier, two price lines</span> : null}
                          </span>
                        </td>
                        <td className={`py-2.5 pr-3 text-right tabular-nums ${p.diff !== null && p.diff < 0 ? 'text-emerald-700' : 'text-slate-600'}`}>
                          {p.diff === null ? '—' : `${p.diff > 0 ? '+' : ''}${pct(p.diff)}`}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700 whitespace-nowrap">
                          {int(p.oem?.lines || 0)} / {int(p.alt?.lines || 0)}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700 whitespace-nowrap">
                          <Life s={p.oem} /> / <Life s={p.alt} />
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700 whitespace-nowrap">
                          {rate(p.oemFail)} / <span className={p.altFail !== null && p.oemFail !== null && p.altFail > p.oemFail + 2 ? 'text-red-700 font-semibold' : ''}>{rate(p.altFail)}</span>
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700 whitespace-nowrap">
                          {p.oemDay === null ? '—' : price(p.oemDay)} / {p.altDay === null ? '—' : price(p.altDay)}
                        </td>
                        <td className="py-2.5">
                          <Badge className={VERDICT_LOOK[p.verdict]}>{p.verdict}</Badge>
                          {p.saving12m > 0 && (p.verdict === 'Aftermarket pays' || p.verdict === 'Needs a trial') && (
                            <span className="block mt-1 text-xs text-slate-500 whitespace-nowrap">
                              {money(p.saving12m)}/yr on price
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredParts.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-500">No parts match these filters.</p>
              )}
              <PagerBar {...paged} noun="parts" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>How the verdict is reached</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <Line tone="bg-slate-400" t="OEM only" b="no aftermarket price on file, or it is not cheaper." />
              <Line tone="bg-blue-500" t="Needs a trial" b="cheaper, but fewer than 5 aftermarket lines or 3 life samples — not enough history to trust." />
              <Line tone="bg-emerald-500" t="Aftermarket pays" b="lower cost per day of life, and early failures no more than 2 per 100 installs above OEM." />
              <Line tone="bg-amber-500" t="Stay with OEM" b="cheaper to buy but shorter-lived or less reliable once fitted." />
              <p className="pt-2 text-xs text-slate-500">
                Median life is the days between successive installs of the part on the same unit, credited
                to the source of the part that was replaced. An early failure is a replacement on an
                unscheduled job inside warranty and typical life. The modeled saving is the price
                difference times the OEM quantity used in the last 12 months, for “Aftermarket pays” parts only.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Parts Kits &amp; Sourcing</h1>
      <p className="text-slate-600 mt-1">
        What each job kit takes off the shelf, and where the aftermarket part earns its place
      </p>
    </div>
  )
}

function KitCard({ k }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-start gap-2">
          <span className="min-w-0 flex-1">
            <span className="block text-base text-slate-900">{k.name}</span>
            <span className="block text-xs font-normal text-slate-500 mt-0.5">
              {k.id} · issued to {int(k.issued12m)} jobs in 12 months · {int(k.issued5y)} in 5 years
            </span>
          </span>
          <Badge className={TYPE_LOOK[k.type] || TYPE_LOOK.Inspection}>{k.type}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">Part</th>
                <th className="py-2 pr-3 font-medium text-right">Qty</th>
                <th className="py-2 pr-3 font-medium text-right whitespace-nowrap">On hand</th>
                <th className="py-2 pr-3 font-medium text-right">OEM</th>
                <th className="py-2 font-medium text-right whitespace-nowrap">Aftermarket</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {k.lines.map((l) => (
                <tr key={l.part_id} className={l.short ? 'bg-red-50' : ''}>
                  <td className="py-2 pr-3 min-w-40">
                    <span className="block text-slate-900">{l.part_name}</span>
                    <span className="block text-xs text-slate-500">{l.part_number}</span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">{int(l.qty)} <span className="text-xs text-slate-400">{l.unit}</span></td>
                  <td className={`py-2 pr-3 text-right tabular-nums ${l.short ? 'text-red-700 font-semibold' : 'text-slate-700'}`}>{int(l.onHand)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{price(l.oemLine)}</td>
                  <td className={`py-2 text-right tabular-nums ${l.altLine < l.oemLine ? 'text-emerald-700' : 'text-slate-700'}`}>{price(l.altLine)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 font-semibold text-slate-900">
                <td className="py-2 pr-3" colSpan={3}>Kit total</td>
                <td className="py-2 pr-3 text-right tabular-nums">{price(k.oem)}</td>
                <td className="py-2 text-right tabular-nums text-emerald-700">{price(k.alt)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className={`rounded-md border p-3 ${k.buildable === 0 ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}>
            <div className="text-xs text-slate-500">Kits buildable from stock</div>
            <div className={`text-xl font-bold tabular-nums ${k.buildable === 0 ? 'text-red-700' : 'text-slate-900'}`}>{int(k.buildable)}</div>
            <div className="text-xs text-slate-500 truncate" title={k.limiting?.part_name}>
              limited by {k.limiting?.part_number || '—'}
            </div>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Aftermarket saving</div>
            <div className="text-xl font-bold tabular-nums text-slate-900">{pct(k.saving)}</div>
            <div className="text-xs text-slate-500">{price(k.oem - k.alt)} a kit</div>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Est. annual spend</div>
            <div className="text-xl font-bold tabular-nums text-slate-900">{money(k.annualOem)}</div>
            <div className="text-xs text-slate-500">{money(k.annualAlt)} if aftermarket</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Life({ s }) {
  if (!s?.medianLifeDays) return <span className="text-slate-400">—</span>
  return (
    <span>
      {int(s.medianLifeDays)}<span className="text-xs text-slate-400"> (n={int(s.lifeSamples)})</span>
    </span>
  )
}

function rate(v) {
  return v === null ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
}

function Line({ tone, t, b }) {
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${tone}`} />
      <span><strong className="text-slate-900">{t}</strong> — {b}</span>
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
