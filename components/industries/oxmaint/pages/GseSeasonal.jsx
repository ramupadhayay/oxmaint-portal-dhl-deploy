'use client'

// Seasonal Readiness — is the deicing fleet ready before the weather decides.
//
// Most GSE is worked all year and shows its condition continuously. Deicers are
// not: they sit idle for eight months and then have to work perfectly on the
// first freezing morning, and the department finds out which ones don't at 4am
// with aircraft waiting. The whole point is to move that discovery to October.
//
// So a unit is not "ready" because its status says Available. It is ready when
// it is serviceable AND has been serviced recently enough to be trusted through
// a season — a deicer signed off in March is not ready for November, whatever
// its status field says. That rule is the screen.

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Snowflake, Sun, CalendarClock, AlertTriangle, CheckCircle2, Wrench, ChevronRight,
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { useActions } from '../lib/actions'
import { useStore } from '../lib/store'
import { fleet, seasons, GSE_ACTIVE } from '../lib/gse'
import { fmtDate } from '../lib/data'
import ModuleOff from '../components/ModuleOff'

const SEASON_ICON = { Winter: Snowflake, Summer: Sun }

export default function GseSeasonal() {
  const router = useRouter()
  const { notify } = useStore()
  const { raiseWorkOrder } = useActions()

  const rows = useMemo(() => fleet(), [])
  const list = useMemo(() => seasons(rows), [rows])

  if (!GSE_ACTIVE) return <ModuleOff module="Seasonal readiness" />

  /**
   * Raise the readiness job for a unit that is not ready.
   *
   * Due before the season's own date rather than in a fixed number of days: a
   * job to get a deicer ready for November that is due in December has missed
   * the only point it had.
   */
  const raise = async (unit, season) => {
    const days = Math.max(1, season.daysToTarget - 14)
    const wo = await raiseWorkOrder({
      title: `${season.season} readiness — ${unit.asset_name}`,
      description: `${season.season} readiness service for ${unit.asset_name} (${unit.asset_code}). `
        + `${season.note} Last serviced ${unit._servicedDaysAgo} days ago; must be ready by ${season.readyBy.replace('-', '/')}.`,
      assetId: unit.asset_id,
      type: 'Preventive',
      priority: season.daysToTarget <= 45 ? 'High' : 'Medium',
      dueInDays: days,
      estimatedHours: 6,
      source: `${season.season} readiness campaign`,
    })
    if (wo) notify(`${wo.work_order_number} raised — due ${days} days before the ${season.season.toLowerCase()} deadline.`)
  }

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Seasonal Readiness</h1>
        <p className="text-slate-600 mt-1">
          Equipment that only earns its keep in one season, and whether it will be ready when that
          season arrives
        </p>
      </div>

      {list.length === 0 && (
        <Card><CardContent className="py-12 text-center text-sm text-slate-500">
          This pack defines no seasonal equipment.
        </CardContent></Card>
      )}

      {list.map((s) => {
        const Icon = SEASON_ICON[s.season] || CalendarClock
        const urgent = s.daysToTarget <= 60 && s.notReady > 0
        return (
          <Card key={s.season} className={urgent ? 'border-amber-300' : undefined}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <Icon className="w-5 h-5" />
                {s.season} readiness
                <Badge className={
                  s.pct === 100 ? 'bg-emerald-100 text-emerald-800'
                    : s.pct >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                }>
                  {s.ready} of {s.units.length} ready
                </Badge>
                <span className="ml-auto text-sm font-normal text-slate-500">
                  ready by {fmtDate(s.target)} · {s.daysToTarget} days
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600">{s.note}</p>

              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      s.pct === 100 ? 'bg-emerald-500' : s.pct >= 70 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
                <span className="text-sm font-bold tabular-nums text-slate-900 w-12 text-right">{s.pct}%</span>
              </div>

              {urgent && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-900">
                    {s.notReady} unit{s.notReady === 1 ? '' : 's'} will not be ready and the deadline is{' '}
                    {s.daysToTarget} days away. A readiness service takes a unit off the ramp for a day —
                    booking them now is the difference between a plan and a scramble.
                  </p>
                </div>
              )}

              {s.units.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  No units of this class in the register.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {s.units
                    .slice()
                    .sort((a, b) => Number(a._seasonReady) - Number(b._seasonReady))
                    .map((u) => (
                      <div key={u.asset_id} className="flex flex-wrap items-center gap-3 py-3">
                        <button
                          onClick={() => router.push(`/portal/oxmaint/assets/${encodeURIComponent(u.asset_id)}`)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block text-sm font-medium text-slate-900 truncate">{u.asset_name}</span>
                          <span className="block text-xs text-slate-500">
                            {u.asset_code} · {u.site_name} · {u.functional_location_name}
                          </span>
                        </button>

                        <span className="text-xs text-slate-500 shrink-0 w-32 text-right">
                          serviced {u._servicedDaysAgo > 900 ? 'never' : `${u._servicedDaysAgo}d ago`}
                        </span>

                        {u._seasonReady ? (
                          <Badge className="bg-emerald-100 text-emerald-800 gap-1 shrink-0">
                            <CheckCircle2 className="w-3 h-3" />Ready
                          </Badge>
                        ) : (
                          <>
                            <Badge className="bg-red-100 text-red-800 shrink-0">
                              {u._down ? u.status : 'Service due'}
                            </Badge>
                            <Button
                              size="sm" variant="outline" className="h-8 gap-1.5 shrink-0"
                              onClick={() => raise(u, s)}
                            >
                              <Wrench className="w-3.5 h-3.5" />
                              Raise readiness job
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                </div>
              )}

              {/* The rule, said where it is applied. A reader who disagrees with
                  the verdict deserves to see what produced it. */}
              <p className="text-xs text-slate-500">
                A unit counts as ready when it is serviceable and has been serviced within the last 180
                days. Availability alone is not readiness — a deicer signed off in March is not ready
                for November.
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
