'use client'

// Stores Health — two million dollars of parts, and whether the right ones are
// on the shelf tonight.
//
// The Parts screen answers "what do we stock". A stores manager is asked
// something harder at 01:40 on a night bank: is the item that just stopped a
// pushback an A-class line we should never have been short of, and where is the
// money actually sitting. So this screen leads with class and availability
// rather than with a catalogue.
//
// ABC is the customer's own classification: 235 A-class lines carry 80% of the
// value, and a miss on one of those is a unit off the ramp while 84 C-class
// lines sit there being tidy. The screen ranks risk that way.
//
// A note on the stock split: free stock here equals the on-hand figure, and
// blocked stock is held over and above it rather than carved out of it — ten
// units across ten lines. That is how the record reads, so that is how it is
// shown; quietly subtracting it would make every quantity on this page disagree
// with the one on the Parts screen.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Boxes, DollarSign, AlertTriangle, PackageX, Layers, TrendingUp, Search, Ban,
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { Input } from '../ui/input'
import { GSE_ACTIVE } from '../lib/gse'
import { loadGseAnalytics, money, fmtDate } from '../lib/data'
import { useStock } from '../lib/movements'
import ModuleOff from '../components/ModuleOff'
import PagerBar, { usePaged } from '../components/ListPager'

const ABC_LOOK = {
  A: 'bg-red-100 text-red-800',
  B: 'bg-amber-100 text-amber-800',
  C: 'bg-slate-100 text-slate-700',
}

const STORE_NAMES = {
  '0001': 'Shop North',
  '0002': 'Shop South',
  '0003': 'Snow barn',
  '0004': 'Electric / charger',
}

const nativeSelect = 'h-9 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function Stat({ label, value, sub, Icon, tone }) {
  const ring = tone === 'red' ? 'border-red-200' : tone === 'amber' ? 'border-amber-200' : 'border-slate-200/60'
  const ink = tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700' : 'text-slate-900'
  return (
    <Card className={ring}>
      <CardContent className="p-4">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {label}
        </p>
        <p className={`mt-1 text-2xl font-bold tabular-nums ${ink}`}>{value}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
      </CardContent>
    </Card>
  )
}

/** A labelled bar in a list — value, share of the whole, and the bar itself. */
function BarRow({ label, sub, value, share, tone = 'bg-blue-500' }) {
  return (
    <div className="py-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm text-slate-800">
          {label}
          {sub && <span className="ml-2 text-xs text-slate-500">{sub}</span>}
        </span>
        <span className="text-sm tabular-nums font-medium text-slate-900">{money(value)}</span>
      </div>
      <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${Math.max(1, Math.round(share * 100))}%` }} />
      </span>
    </div>
  )
}

export default function GseStores() {
  const router = useRouter()
  const { levels } = useStock()
  const [A, setA] = useState(null)
  const [abcFilter, setAbcFilter] = useState('all')
  const [store, setStore] = useState('all')
  const [risk, setRisk] = useState('all')
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!GSE_ACTIVE || !loadGseAnalytics) return undefined
    let live = true
    loadGseAnalytics().then((a) => { if (live) setA(a) }).catch(() => {})
    return () => { live = false }
  }, [])

  // The live position, with the class and store SAP holds it under.
  const rows = useMemo(() => levels.map((p) => {
    const qty = Number(p.quantity_on_hand) || 0
    // Valued at standard cost, which is what Parts and Stocks carry. The moving
    // average sits a few thousand dollars above it across the catalogue, and two
    // screens quoting two totals for the same shelf is how a stores manager
    // stops trusting both.
    const cost = Number(p.unit_cost) || Number(p.moving_avg_price) || 0
    const reorder = Number(p.reorder_point) || 0
    return {
      ...p,
      qty,
      value: Math.round(qty * cost * 100) / 100,
      reorder,
      blocked: Number(p.blocked_qty) || 0,
      inspection: Number(p.quality_insp_qty) || 0,
      short: qty === 0 ? 'out' : qty <= reorder ? 'low' : null,
    }
  }), [levels])

  const totals = useMemo(() => {
    const value = rows.reduce((n, r) => n + r.value, 0)
    const byClass = {}
    rows.forEach((r) => {
      const k = r.abc_class || '—'
      const g = byClass[k] || (byClass[k] = { skus: 0, value: 0, low: 0, out: 0 })
      g.skus += 1
      g.value += r.value
      if (r.short === 'low') g.low += 1
      if (r.short === 'out') g.out += 1
    })
    const byCategory = {}
    rows.forEach((r) => { byCategory[r.category] = (byCategory[r.category] || 0) + r.value })
    const byStore = {}
    rows.forEach((r) => {
      const k = r.storage_location || '—'
      const g = byStore[k] || (byStore[k] = { skus: 0, value: 0 })
      g.skus += 1
      g.value += r.value
    })
    return {
      value,
      byClass,
      byCategory: Object.entries(byCategory).map(([k, v]) => ({ k, v })).sort((x, y) => y.v - x.v),
      byStore: Object.entries(byStore).map(([k, g]) => ({ k, ...g })).sort((x, y) => y.value - x.value),
      low: rows.filter((r) => r.short === 'low').length,
      out: rows.filter((r) => r.short === 'out').length,
      aAtRisk: rows.filter((r) => r.abc_class === 'A' && r.short).length,
      blockedLines: rows.filter((r) => r.blocked > 0).length,
      blockedUnits: rows.reduce((n, r) => n + r.blocked, 0),
      units: rows.reduce((n, r) => n + r.qty, 0),
    }
  }, [rows])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((r) => (
      (abcFilter === 'all' || r.abc_class === abcFilter)
      && (store === 'all' || r.storage_location === store)
      && (risk === 'all'
        || (risk === 'low' && r.short === 'low')
        || (risk === 'out' && r.short === 'out')
        || (risk === 'a-risk' && r.abc_class === 'A' && r.short)
        || (risk === 'blocked' && r.blocked > 0))
      && (!needle || `${r.part_number} ${r.part_name} ${r.vendor_name} ${r.sap_material}`.toLowerCase().includes(needle))
    )).sort((x, y) => (Boolean(y.short) - Boolean(x.short)) || y.value - x.value)
  }, [rows, abcFilter, store, risk, q])

  const paged = usePaged(shown, 25, `${abcFilter}|${store}|${risk}|${q}`)

  const path = A?.insights?.stockPath || []
  const target2031 = useMemo(() => {
    const row = (A?.plan?.growth || []).find((g) => /stores value/i.test(g.Item))
    return row ? Number(row['2031']) : null
  }, [A])

  if (!GSE_ACTIVE || !loadGseAnalytics) return <ModuleOff module="Stores health" />

  const aClass = totals.byClass.A || { skus: 0, value: 0 }

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Stores Health</h1>
          <p className="mt-1 text-slate-600">
            Where the two million dollars sits, and which lines would stop a unit tonight
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push('/portal/oxmaint/stocks')}>
          Stock position
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <Stat label="On hand" value={money(totals.value)} sub={`${rows.length} lines · ${totals.units.toLocaleString('en-US')} units`} Icon={DollarSign} />
        <Stat
          label="A-class" value={money(aClass.value)}
          sub={`${aClass.skus} lines · ${totals.value ? Math.round((aClass.value / totals.value) * 100) : 0}% of the money`}
          Icon={Layers}
        />
        <Stat
          label="A-class at risk" value={totals.aAtRisk}
          sub="at or below reorder point" Icon={AlertTriangle}
          tone={totals.aAtRisk ? 'red' : undefined}
        />
        <Stat label="Below reorder" value={totals.low} sub={`${totals.out} out of stock`} Icon={PackageX} tone={totals.low ? 'amber' : undefined} />
        <Stat
          label="Blocked stock" value={`${totals.blockedUnits} units`}
          sub={`${totals.blockedLines} lines held outside free stock`} Icon={Ban}
        />
      </div>

      <Tabs defaultValue="availability">
        <TabsList className="flex-wrap">
          <TabsTrigger value="availability" className="gap-1.5"><AlertTriangle className="h-4 w-4" />Availability</TabsTrigger>
          <TabsTrigger value="value" className="gap-1.5"><Layers className="h-4 w-4" />Where the money sits</TabsTrigger>
          <TabsTrigger value="path" className="gap-1.5"><TrendingUp className="h-4 w-4" />Five-year stock path</TabsTrigger>
        </TabsList>

        {/* ── what would stop a unit ─────────────────────────────────────── */}
        <TabsContent value="availability" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-base">
                    Stock lines
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      {shown.length.toLocaleString('en-US')} of {rows.length} · {money(shown.reduce((n, r) => n + r.value, 0))}
                    </span>
                  </CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    Short lines first, then by value. Every line is planned on reorder point, so a line at or
                    below its point is one the buyer should already be on.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Part, vendor or material" className="h-9 w-full pl-8 sm:w-56" />
                  </span>
                  <select value={risk} onChange={(e) => setRisk(e.target.value)} className={nativeSelect}>
                    <option value="all">Everything</option>
                    <option value="a-risk">A-class at risk</option>
                    <option value="low">At or below reorder</option>
                    <option value="out">Out of stock</option>
                    <option value="blocked">Blocked stock</option>
                  </select>
                  <select value={abcFilter} onChange={(e) => setAbcFilter(e.target.value)} className={nativeSelect}>
                    <option value="all">All classes</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                  </select>
                  <select value={store} onChange={(e) => setStore(e.target.value)} className={nativeSelect}>
                    <option value="all">All stores</option>
                    {totals.byStore.map((s) => (
                      <option key={s.k} value={s.k}>{s.k} — {STORE_NAMES[s.k] || 'Store'}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3 font-medium">Part</th>
                      <th className="py-2 px-3 font-medium">Class</th>
                      <th className="py-2 px-3 font-medium">Store</th>
                      <th className="py-2 px-3 font-medium text-right">On hand</th>
                      <th className="py-2 px-3 font-medium text-right">Reorder at</th>
                      <th className="py-2 px-3 font-medium text-right">Value</th>
                      <th className="py-2 px-3 font-medium">Vendor</th>
                      <th className="py-2 pl-3 font-medium">Counted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.pageItems.map((r) => (
                      <tr key={r.part_id || r.recordId} className={`border-b border-slate-100 ${r.short === 'out' ? 'bg-red-50' : ''}`}>
                        <td className="py-2 pr-3">
                          <span className="block text-slate-900">{r.part_name}</span>
                          <span className="block font-mono text-xs text-slate-500">
                            {r.part_number}
                            {r.sap_material ? ` · ${r.sap_material}` : ''}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <Badge className={ABC_LOOK[r.abc_class] || ''}>{r.abc_class || '—'}</Badge>
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-mono text-xs text-slate-700">{r.storage_location}</span>
                          <span className="block text-xs text-slate-500">{STORE_NAMES[r.storage_location] || ''}</span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className={`tabular-nums ${r.short ? 'font-semibold text-red-700' : 'text-slate-900'}`}>
                            {r.qty.toLocaleString('en-US')} {r.unit}
                          </span>
                          {r.blocked > 0 && <span className="block text-xs text-amber-700">{r.blocked} blocked</span>}
                          {r.inspection > 0 && <span className="block text-xs text-amber-700">{r.inspection} in inspection</span>}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-slate-600">{r.reorder.toLocaleString('en-US')}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-medium text-slate-900">{money(r.value)}</td>
                        <td className="py-2 px-3 text-slate-600">{r.vendor_name}</td>
                        <td className="py-2 pl-3 whitespace-nowrap text-xs text-slate-500">
                          {r.last_count_date ? fmtDate(r.last_count_date) : 'Not counted'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PagerBar {...paged} noun="lines" />
              <p className="mt-2 text-xs text-slate-500">
                Free stock is the on-hand figure. Blocked stock is held over and above it, so it is shown on the
                line rather than taken off the count — ten units across {totals.blockedLines} lines today.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── where the money sits ───────────────────────────────────────── */}
        <TabsContent value="value" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {['A', 'B', 'C'].map((k) => {
              const g = totals.byClass[k] || { skus: 0, value: 0, low: 0, out: 0 }
              const share = totals.value ? g.value / totals.value : 0
              return (
                <Card key={k}>
                  <CardContent className="p-4">
                    <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      <Badge className={ABC_LOOK[k]}>{k}</Badge>
                      {k === 'A' ? 'Stops a unit' : k === 'B' ? 'Plan it' : 'Keep a few'}
                    </p>
                    <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{money(g.value)}</p>
                    <p className="text-xs text-slate-500">
                      {g.skus} lines · {Math.round(share * 100)}% of the money
                    </p>
                    <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <span className="block h-full rounded-full bg-blue-500" style={{ width: `${Math.round(share * 100)}%` }} />
                    </span>
                    {(g.low || g.out) > 0 && (
                      <p className="mt-2 text-xs text-red-700">{g.low + g.out} of these are at or below their reorder point</p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">By category</CardTitle></CardHeader>
              <CardContent>
                {totals.byCategory.map((c) => (
                  <BarRow key={c.k} label={c.k} value={c.v} share={c.v / (totals.byCategory[0]?.v || 1)} />
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">By store</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Storage locations on plant CVG1.</p>
              </CardHeader>
              <CardContent>
                {totals.byStore.map((s) => (
                  <BarRow
                    key={s.k} label={`${s.k} — ${STORE_NAMES[s.k] || 'Store'}`} sub={`${s.skus} lines`}
                    value={s.value} share={s.value / (totals.byStore[0]?.value || 1)} tone="bg-slate-700"
                  />
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── five years of stock value ──────────────────────────────────── */}
        <TabsContent value="path" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Stock value, month by month
                <span className="ml-2 text-sm font-normal text-slate-500">{path.length} months on plant CVG1</span>
              </CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                From the 2021 ramp to the two million the store carries today. The dashed line is the level the
                business holds it against.
              </p>
            </CardHeader>
            <CardContent>
              {path.length > 0 && (() => {
                const vals = path.map((m) => Number(m.StockValueUSD) || 0)
                const anchor = Number(path[path.length - 1].YoYAnchorUSD) || 0
                const top = Math.max(...vals, anchor) * 1.05
                return (
                  <>
                    <div className="overflow-x-auto">
                      <div className="relative flex min-w-[680px] items-end gap-[3px] pl-12" style={{ height: 150 }}>
                        <span className="absolute left-0 right-0 flex items-center" style={{ bottom: Math.round((anchor / top) * 130) }}>
                          <span className="w-12 shrink-0 pr-2 text-right text-[10px] tabular-nums text-slate-400">{money(anchor)}</span>
                          <span className="h-px flex-1 border-t border-dashed border-slate-400" />
                        </span>
                        {path.map((m) => {
                          const v = Number(m.StockValueUSD) || 0
                          const y = new Date(m.Month).getUTCFullYear()
                          const mo = new Date(m.Month).getUTCMonth()
                          return (
                            <span
                              key={m.Month} className="flex-1 rounded-t bg-blue-500"
                              style={{ height: Math.max(2, Math.round((v / top) * 130)) }}
                              title={`${MONTHS[mo]} ${y} · ${money(v)} · ${m.Note}`}
                            />
                          )
                        })}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span>
                        {(() => {
                          const first = path[0]
                          const last = path[path.length - 1]
                          return `${MONTHS[new Date(first.Month).getUTCMonth()]} ${new Date(first.Month).getUTCFullYear()} ${money(first.StockValueUSD)} → ${MONTHS[new Date(last.Month).getUTCMonth()]} ${new Date(last.Month).getUTCFullYear()} ${money(last.StockValueUSD)}`
                        })()}
                      </span>
                      {target2031 && (
                        <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-900">
                          The plan carries this to {money(target2031)} by 2031 on electric A-items — a target, not a
                          measured figure
                        </span>
                      )}
                    </div>
                  </>
                )
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
