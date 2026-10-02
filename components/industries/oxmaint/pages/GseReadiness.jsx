'use client'

// Fleet Readiness — can the ramp be covered right now.
//
// Every CMMS opens on a percentage. A GSE shop cannot use one: 94% serviceable
// is a comfortable number that hides the only fact that matters, which is that
// two of three container loaders are down and the third cannot load three
// aircraft at once. So this screen counts by equipment class, worst first, and
// says a class is critical when what is left will not cover the ramp — however
// good the estate-wide figure looks.
//
// Underneath: what is actually holding each unit off the ramp, with the open
// job against it, because "down" without a reason is something a manager has to
// go and ask about.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, CheckCircle2, Plane, Wrench, Gauge, Zap, ChevronRight,
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { fleet, readiness, blockers, pmCompliance, GSE_ACTIVE } from '../lib/gse'
import { SITES, DOMAIN, fmtDate } from '../lib/data'
import ModuleOff from '../components/ModuleOff'

export default function GseReadiness() {
  const router = useRouter()
  const [site, setSite] = useState('all')

  const rows = useMemo(() => fleet(), [])
  const scoped = useMemo(
    () => (site === 'all' ? rows : rows.filter((a) => a.site_id === site)),
    [rows, site],
  )
  const classes = useMemo(() => readiness(scoped), [scoped])
  const held = useMemo(() => blockers(scoped), [scoped])
  const pm = useMemo(() => pmCompliance(), [])

  if (!GSE_ACTIVE) return <ModuleOff module="Fleet readiness" />

  const total = scoped.length
  const down = scoped.filter((a) => a._down).length
  const ready = total - down
  const pct = total ? Math.round((ready / total) * 100) : 100
  const critical = classes.filter((c) => c.critical)
  const powered = scoped.filter((a) => a._powered).length

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Fleet Readiness</h1>
          <p className="text-slate-600 mt-1">
            What the ramp can be covered with right now — counted by equipment class, not by estate
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={site} onChange={(e) => setSite(e.target.value)}
            className="h-10 px-3 rounded-md border border-slate-200 text-sm bg-white outline-none focus:border-primary/40"
          >
            <option value="all">All stations</option>
            {SITES.map((s) => <option key={s.site_id} value={s.site_id}>{s.site_name}</option>)}
          </select>
        </div>
      </div>

      {/* The headline a ramp manager needs before any percentage. */}
      {critical.length > 0 ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-900">
                {critical.length} equipment {critical.length === 1 ? 'class is' : 'classes are'} at or below cover
              </p>
              <p className="text-sm text-red-800 mt-0.5">
                {critical.map((c) => `${c.kind} (${c.ready} of ${c.total} ready)`).join(' · ')}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-900">
            Every equipment class has serviceable units. Nothing on this station is down to its last unit.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label="Fleet in scope" value={total} sub={`${powered} powered`} Icon={Plane} />
        <Stat label="Ready for the ramp" value={ready} sub={`${pct}% of fleet`} Icon={CheckCircle2} tone="green" />
        <Stat label="Out of service" value={down} sub="held by open work" Icon={Wrench} tone={down ? 'red' : null} />
        <Stat label="Classes short" value={classes.filter((c) => c.short).length} sub="below 80% cover" Icon={AlertTriangle} tone={classes.some((c) => c.short) ? 'amber' : null} />
        <Stat label="PM compliance" value={`${pm.pct}%`} sub={`${pm.overdue} of ${pm.total} overdue`} Icon={Gauge} tone={pm.pct < 90 ? 'amber' : 'green'} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Cover by equipment class
            <span className="ml-auto text-sm font-normal text-slate-500">worst first</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {classes.map((c) => (
              <div
                key={c.kind}
                className={`rounded-lg border p-3 ${
                  c.critical ? 'border-red-300 bg-red-50/50'
                    : c.short ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1 text-sm font-semibold text-slate-900">
                    {c.kind}
                    {!c.powered && <span className="ml-2 text-xs font-normal text-slate-400">non-powered</span>}
                  </span>
                  {c.critical && <Badge className="bg-red-100 text-red-800">Down to {c.ready}</Badge>}
                  <span className="text-sm text-slate-600 tabular-nums shrink-0">
                    {c.ready} / {c.total} ready
                  </span>
                  <span className={`text-sm font-bold tabular-nums w-12 text-right shrink-0 ${
                    c.pct >= 90 ? 'text-emerald-700' : c.pct >= 80 ? 'text-amber-700' : 'text-red-700'
                  }`}>{c.pct}%</span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      c.pct >= 90 ? 'bg-emerald-500' : c.pct >= 80 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${c.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            What is holding units off the ramp
            <span className="ml-auto text-sm font-normal text-slate-500">{held.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {held.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Nothing is out of service on this station.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {held.slice(0, 14).map(({ asset, jobs }) => (
                <button
                  key={asset.asset_id}
                  onClick={() => router.push(`/portal/oxmaint/assets/${encodeURIComponent(asset.asset_id)}`)}
                  className="w-full flex flex-wrap items-center gap-3 py-3 text-left hover:bg-slate-50 -mx-2 px-2 rounded"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900 truncate">
                      {asset.asset_name}
                      {asset._electric && <Zap className="inline w-3.5 h-3.5 ml-1.5 text-blue-500" />}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {asset.asset_code} · {asset.site_name} · {asset.functional_location_name}
                    </span>
                  </span>
                  <Badge className="bg-red-100 text-red-800 shrink-0">{asset.status}</Badge>
                  <span className="text-xs text-slate-500 shrink-0 w-28 text-right">
                    {jobs.length
                      ? `${jobs.length} open job${jobs.length === 1 ? '' : 's'}`
                      : 'no job raised'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
          {/* A unit that is down with no job against it is the reason this
              column exists: it is out of service and nobody has been asked to
              fix it. */}
          {held.some(({ jobs }) => jobs.length === 0) && (
            <p className="mt-3 text-xs text-amber-700">
              {held.filter(({ jobs }) => jobs.length === 0).length} unit(s) are out of service with no
              work order raised against them.
            </p>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-slate-400">
        {DOMAIN?.subtitle} · estate as at {fmtDate(new Date().toISOString())}
      </p>
    </div>
  )
}

function Stat({ label, value, sub, Icon, tone }) {
  const ring = tone === 'red' ? 'border-red-200' : tone === 'amber' ? 'border-amber-200'
    : tone === 'green' ? 'border-emerald-200' : 'border-slate-200/60'
  const ink = tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700'
    : tone === 'green' ? 'text-emerald-700' : 'text-slate-900'
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
