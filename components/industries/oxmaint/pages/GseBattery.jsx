'use client'

// eGSE & Battery — the electric fleet, and whether it will last the shift.
//
// Electrification changes what a GSE shop worries about. A diesel tug that is
// low on fuel is a five-minute problem; a traction battery at 71% state of
// health is a unit that will not finish a night bank in January, and there is no
// five-minute fix. The failure is gradual and invisible until the shift it
// isn't, which is exactly the kind of thing a maintenance system is supposed to
// see coming.
//
// So state of health leads, charge is secondary, and the replacement list is a
// plan rather than an alarm — a battery at 68% needs a purchase order months
// before it needs a technician.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, BatteryCharging, TrendingDown, Leaf, AlertTriangle } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { fleet, GSE_ACTIVE } from '../lib/gse'
import { SITES, DOMAIN } from '../lib/data'
import ModuleOff from '../components/ModuleOff'

const VERDICT_LOOK = {
  Healthy: 'bg-emerald-100 text-emerald-800',
  Monitor: 'bg-blue-100 text-blue-800',
  'Plan replacement': 'bg-amber-100 text-amber-800',
  Replace: 'bg-red-100 text-red-800',
}

export default function GseBattery() {
  const router = useRouter()
  const [site, setSite] = useState('all')

  const rows = useMemo(() => fleet(), [])
  const scoped = useMemo(
    () => (site === 'all' ? rows : rows.filter((a) => a.site_id === site)),
    [rows, site],
  )

  if (!GSE_ACTIVE) return <ModuleOff module="eGSE and battery health" />

  const powered = scoped.filter((a) => a._powered)
  const electric = powered.filter((a) => a._electric)
  const diesel = powered.length - electric.length
  const pct = powered.length ? Math.round((electric.length / powered.length) * 100) : 0

  const graded = electric
    .map((a) => ({ ...a, b: a._battery }))
    .filter((a) => a.b)
    .sort((a, b) => a.b.soh - b.b.soh)

  const replace = graded.filter((a) => a.b.verdict === 'Replace')
  const plan = graded.filter((a) => a.b.verdict === 'Plan replacement')
  const avg = graded.length
    ? Math.round(graded.reduce((n, a) => n + a.b.soh, 0) / graded.length)
    : 0
  const lowCharge = graded.filter((a) => a.b.charge < 50)

  // Which classes are being electrified, and how far each has got. A single
  // fleet-wide percentage hides that the tugs are nearly done and the loaders
  // have not started.
  const byClass = [...new Set(powered.map((a) => a.asset_type))]
    .map((kind) => {
      const units = powered.filter((a) => a.asset_type === kind)
      const e = units.filter((a) => a._electric).length
      return { kind, total: units.length, electric: e, pct: units.length ? Math.round((e / units.length) * 100) : 0 }
    })
    .filter((c) => (DOMAIN?.electricKinds || []).includes(c.kind))
    .sort((a, b) => b.pct - a.pct)

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">eGSE &amp; Battery</h1>
          <p className="text-slate-600 mt-1">
            The electric fleet, its battery health, and what needs ordering before it needs fixing
          </p>
        </div>
        <select
          value={site} onChange={(e) => setSite(e.target.value)}
          className="h-10 px-3 rounded-md border border-slate-200 text-sm bg-white outline-none focus:border-primary/40"
        >
          <option value="all">All stations</option>
          {SITES.map((s) => <option key={s.site_id} value={s.site_id}>{s.site_name}</option>)}
        </select>
      </div>

      {replace.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-900">
              {replace.length} battery pack{replace.length === 1 ? '' : 's'} below 68% state of health
            </p>
            <p className="text-sm text-red-800 mt-0.5">
              These units will not hold a full shift in cold weather. A pack is a lead-time item — this
              is a purchase decision, not a work order.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label="Electric units" value={electric.length} sub={`${pct}% of powered fleet`} Icon={Zap} tone="green" />
        <Stat label="Still diesel" value={diesel} sub="in electrifiable classes and out" Icon={Leaf} />
        <Stat label="Average state of health" value={`${avg}%`} sub="across the electric fleet" Icon={TrendingDown} tone={avg < 80 ? 'amber' : 'green'} />
        <Stat label="Plan replacement" value={plan.length} sub="68–74% — order ahead" Icon={BatteryCharging} tone={plan.length ? 'amber' : null} />
        <Stat label="Below 50% charge" value={lowCharge.length} sub="right now" Icon={BatteryCharging} tone={lowCharge.length ? 'amber' : null} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Battery condition
                <span className="ml-auto text-sm font-normal text-slate-500">weakest first</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {graded.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No electric units on this station.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {graded.map((a) => (
                    <button
                      key={a.asset_id}
                      onClick={() => router.push(`/portal/oxmaint/assets/${encodeURIComponent(a.asset_id)}`)}
                      className="w-full py-3 text-left hover:bg-slate-50 -mx-2 px-2 rounded"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-slate-900 truncate">{a.asset_name}</span>
                          <span className="block text-xs text-slate-500">
                            {a.asset_code} · {a.site_name} · {a.b.years}y · {a.b.cycles.toLocaleString('en-US')} cycles
                          </span>
                        </span>
                        <Badge className={`shrink-0 ${VERDICT_LOOK[a.b.verdict]}`}>{a.b.verdict}</Badge>
                        <span className="shrink-0 w-28">
                          <span className="flex items-center justify-end gap-2">
                            <span className="text-sm font-bold tabular-nums text-slate-900">{a.b.soh}%</span>
                            <span className="text-xs text-slate-400">SoH</span>
                          </span>
                          <span className="mt-1 block h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                            <span
                              className={`block h-full rounded-full ${
                                a.b.soh >= 85 ? 'bg-emerald-500' : a.b.soh >= 75 ? 'bg-blue-500'
                                  : a.b.soh >= 68 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${a.b.soh}%` }}
                            />
                          </span>
                        </span>
                        <span className="shrink-0 w-16 text-right">
                          <span className={`text-sm tabular-nums ${a.b.charge < 50 ? 'text-amber-700 font-semibold' : 'text-slate-600'}`}>
                            {a.b.charge}%
                          </span>
                          <span className="block text-xs text-slate-400">charge</span>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Electrification by class</CardTitle></CardHeader>
            <CardContent>
              {byClass.length === 0 ? (
                <p className="text-sm text-slate-500">No classes are being electrified on this station.</p>
              ) : (
                <div className="space-y-3">
                  {byClass.map((c) => (
                    <div key={c.kind}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate text-slate-700">{c.kind}</span>
                        <span className="shrink-0 tabular-nums text-slate-500">
                          {c.electric}/{c.total}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${c.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>How state of health is read</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <Line tone="bg-emerald-500" t="85% and above" b="Healthy — full shift, no action." />
              <Line tone="bg-blue-500" t="75–84%" b="Monitor — still covers a shift, watch the trend." />
              <Line tone="bg-amber-500" t="68–74%" b="Plan replacement — raise the order now, packs are lead-time items." />
              <Line tone="bg-red-500" t="Below 68%" b="Replace — will not hold a cold-weather night bank." />
              <p className="pt-2 text-xs text-slate-500">
                Derived from each unit's age and cycle count rather than drawn at random, so a
                six-month-old tug cannot report a worn-out pack.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
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
  const ring = tone === 'amber' ? 'border-amber-200' : tone === 'green' ? 'border-emerald-200' : 'border-slate-200/60'
  const ink = tone === 'amber' ? 'text-amber-700' : tone === 'green' ? 'text-emerald-700' : 'text-slate-900'
  return (
    <div className={`bg-white border rounded-lg shadow-sm p-4 ${ring}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-1.5 text-2xl font-bold tabular-nums ${ink}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  )
}
