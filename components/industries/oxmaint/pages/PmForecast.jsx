'use client'

// PM Forecast — the planner's next thirteen weeks.
//
// The PM register is a list of schedules; this is a plan. It answers the three
// questions a planner actually has on a Monday: what lands this week, whether
// the shop can take it, and what has to be pulled forward or pushed.
//
// Hours and calendar are treated as one queue, because on this fleet they are.
// A meter schedule is projected from the unit's own usage and the row says so —
// a projected date is a forecast, not a promise, and printing it as though it
// were a due date would be the screen lying about what it knows. Schedules that
// cannot be projected are listed apart, with the reason.
//
// The capacity line is the planner's own two numbers: how many of the crew are
// on planned work, and how many hours each gives it. Nobody else can know that,
// so nothing here pretends to.
//
// Raising a job from a week does exactly what the register's own button does —
// the work order is created and the schedule rolls forward — so the forecast
// and the register can never disagree about what has been raised.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarClock, AlertTriangle, Gauge, Clock, HelpCircle, Plus, ChevronRight,
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { useStore, useRecords } from '../lib/store'
import { PM_SCHEDULES, fmtDate, hours as fmtHours } from '../lib/data'
import { idOf, usePmAssets, usePmGenerate, frequencyLabel, generatedToday } from '../lib/pmSchedule'
import { useForecast, HORIZON_DAYS } from '../lib/pmForecast'
import PagerBar, { usePaged } from '../components/ListPager'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shortDay = (ms) => {
  const d = new Date(ms)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

const CHART_H = 92

// The next round number above a figure, so the axis reads 25 h rather than
// 21.3 h — and halves cleanly for the middle gridline.
function niceCeil(n) {
  const step = n <= 10 ? 2 : n <= 50 ? 10 : n <= 200 ? 50 : n <= 1000 ? 100 : 500
  return Math.max(step, Math.ceil(n / step) * step)
}

const TRIGGER_LOOK = {
  meter: 'bg-violet-100 text-violet-800',
  time: 'bg-blue-100 text-blue-800',
}

// A figure, and where it is a list you can open, the tile is the way in — the
// planner's first move is always "show me those", and a number they have to go
// and find again is a number they read twice.
function Stat({ label, value, sub, Icon, tone, onClick, active }) {
  const ring = active ? 'border-slate-900 ring-1 ring-slate-900'
    : tone === 'red' ? 'border-red-200' : tone === 'amber' ? 'border-amber-200' : 'border-slate-200/60'
  const ink = tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700' : 'text-slate-900'
  const body = (
    <CardContent className="p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${ink}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </CardContent>
  )
  if (!onClick) return <Card className={ring}>{body}</Card>
  return (
    <Card className={`${ring} cursor-pointer transition hover:border-slate-400`}>
      <button type="button" onClick={onClick} aria-pressed={Boolean(active)} className="block w-full border-0 bg-transparent p-0 text-left">
        {body}
      </button>
    </Card>
  )
}

export default function PmForecast() {
  const router = useRouter()
  const { notify } = useStore()
  const schedules = useRecords('pm_schedule', PM_SCHEDULES, idOf)
  const assets = usePmAssets()
  const generate = usePmGenerate()

  // Null until the planner types: the field then shows the crew the register
  // knows about rather than an empty box with a grey hint in it.
  const [techs, setTechs] = useState(null)
  const [perTech, setPerTech] = useState(null)
  // Opens where the planner's attention belongs: what is already late, or the
  // first week that actually holds something.
  const [bucket, setBucket] = useState(null)
  const [trigger, setTrigger] = useState('all')
  const [who, setWho] = useState('all')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)

  const f = useForecast(schedules, assets, { techs, hoursPerTech: perTech })

  const assignees = useMemo(
    () => [...new Set(f.rows.map((r) => r.schedule.assigned_to_name).filter(Boolean))].sort(),
    [f.rows],
  )

  const opening = f.overdue.length ? 'overdue' : `w${Math.max(0, f.weeks.findIndex((w) => w.rows.length))}`
  const bucketKey = bucket ?? opening

  const selected = useMemo(() => {
    if (bucketKey === 'overdue') return { label: 'Overdue now', rows: f.overdue }
    if (bucketKey === 'unplaced') return { label: 'Not placed', rows: f.unplaced }
    const w = f.weeks[Number(String(bucketKey).slice(1))] || f.weeks[0]
    return { label: `Week of ${shortDay(w.start)}`, week: w, rows: w.rows }
  }, [bucketKey, f])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return selected.rows.filter((r) => (
      (trigger === 'all' || r.by === trigger)
      && (who === 'all' || r.schedule.assigned_to_name === who)
      && (!needle || `${r.schedule.schedule_name} ${r.schedule.asset_name} ${r.schedule.asset_code}`.toLowerCase().includes(needle))
    ))
  }, [selected, trigger, who, q])

  const paged = usePaged(shown, 20, `${bucketKey}|${trigger}|${who}|${q}`)

  // The bars are scaled to the busiest week, not to capacity: a shop with 800
  // hours a week and a 14-hour week would otherwise draw thirteen flat lines.
  // The capacity line is only drawn when it is on the same scale; when it towers
  // over the work, the sentence under the chart says so instead.
  const busiest = Math.max(1, ...f.weeks.map((w) => w.hours))
  const capacityOnScale = f.perWeek > 0 && f.perWeek <= busiest * 1.6
  // The top of the chart: the capacity line when it is close enough to be worth
  // drawing, otherwise the busiest week with a little air above it.
  const scaleTop = capacityOnScale ? f.perWeek : niceCeil(busiest * 1.1)
  const ticks = useMemo(() => {
    const at = (hrs, capacity = false) => ({ hours: Math.round(hrs * 10) / 10, y: Math.round((hrs / scaleTop) * CHART_H), capacity })
    const list = [at(0), at(scaleTop / 2), at(scaleTop)]
    if (capacityOnScale) list.push(at(f.perWeek, true))
    return list
  }, [scaleTop, capacityOnScale, f.perWeek])

  // Month headings across the thirteen weeks, each as wide as the weeks it owns.
  const months = useMemo(() => {
    const out = []
    f.weeks.forEach((w) => {
      const d = new Date(w.start)
      const label = `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`
      const last = out[out.length - 1]
      if (last && last.label === label) last.span += 1
      else out.push({ label, span: 1 })
    })
    return out
  }, [f.weeks])

  // The mix of work in the horizon, by the name the schedules share.
  const mix = useMemo(() => {
    const counts = new Map()
    f.due90.forEach((r) => {
      const name = String(r.schedule.schedule_name || '').split(' — ')[0].trim() || 'Service'
      counts.set(name, (counts.get(name) || 0) + 1)
    })
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [f.due90])

  const raiseOne = async (row) => {
    setBusy(true)
    await generate(row.schedule)
    setBusy(false)
  }

  // Everything in the week the filters are showing. Confirmed first, because it
  // writes a work order per row and rolls every schedule it touches.
  const raiseWeek = async () => {
    const todo = shown.filter((r) => !r.jobOpen && !generatedToday(r.schedule))
    if (!todo.length) {
      notify('Nothing here to raise — each of these already has a job open or was generated today.', 'error')
      return
    }
    if (typeof window !== 'undefined'
      && !window.confirm(`Raise ${todo.length} work order${todo.length > 1 ? 's' : ''} for ${selected.label.toLowerCase()}? Each schedule rolls forward to its next date.`)) return
    setBusy(true)
    let made = 0
    for (const r of todo) {
      // eslint-disable-next-line no-await-in-loop
      const wo = await generate(r.schedule)
      if (wo) made += 1
    }
    setBusy(false)
    notify(`${made} of ${todo.length} work orders raised for ${selected.label.toLowerCase()}.`)
  }

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">PM Forecast</h1>
          <p className="mt-1 text-slate-600">
            What preventive work lands in the next {HORIZON_DAYS} days, on hours and on the calendar,
            and whether the shop can take it
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push('/portal/oxmaint/pm-schedules')}>
          PM Schedules
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <Stat
          label="Overdue now" value={f.overdue.length} sub="past due on hours or date" Icon={AlertTriangle}
          tone={f.overdue.length ? 'red' : undefined}
          onClick={f.overdue.length ? () => setBucket('overdue') : undefined} active={bucketKey === 'overdue'}
        />
        <Stat label="Next 7 days" value={f.due7.length} sub="services falling due" Icon={CalendarClock} />
        <Stat label="Next 30 days" value={f.due30.length} sub={`${fmtHours(f.hours30)} h of work`} Icon={Clock} />
        <Stat
          label="Hours-led" value={f.meterLed} sub={trigger === 'meter' ? 'showing these only' : 'reach hours before their date'}
          Icon={Gauge}
          onClick={() => setTrigger(trigger === 'meter' ? 'all' : 'meter')} active={trigger === 'meter'}
        />
        <Stat
          label="Not placed" value={f.unplaced.length} sub="usage or reading missing" Icon={HelpCircle}
          tone={f.unplaced.length ? 'amber' : undefined}
          onClick={f.unplaced.length ? () => setBucket('unplaced') : undefined} active={bucketKey === 'unplaced'}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="text-base">Thirteen weeks</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Estimated hours a week against what the crew can take. Click a week to work through it.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="fc-techs" className="text-xs">Crew on planned work</Label>
                <Input
                  id="fc-techs" inputMode="numeric" className="h-9 w-28 tabular-nums"
                  value={techs ?? String(f.crew)}
                  onChange={(e) => setTechs(e.target.value.replace(/[^0-9]/g, ''))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fc-hours" className="text-xs">Hours each a week</Label>
                <Input
                  id="fc-hours" inputMode="numeric" className="h-9 w-28 tabular-nums"
                  value={perTech ?? '40'}
                  onChange={(e) => setPerTech(e.target.value.replace(/[^0-9]/g, ''))}
                />
              </div>
              <p className="pb-2 text-sm text-slate-500">
                = <span className="font-medium text-slate-800 tabular-nums">{fmtHours(f.perWeek)} h</span> a week
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Hours up the side, weeks along the bottom, months named above them.
              A week with nothing in it shows as an empty column rather than as a
              box that looks like it might hold something. */}
          <div className="overflow-x-auto">
            <div className="min-w-[660px]">
              <div className="flex gap-1.5 pl-10">
                {months.map((m) => (
                  <div key={m.label} className="min-w-0 text-xs font-medium text-slate-500" style={{ flex: m.span }}>
                    <span className="block truncate border-b border-slate-200 pb-1">{m.label}</span>
                  </div>
                ))}
              </div>

              <div className="relative mt-2 flex gap-1.5 pl-10">
                {ticks.map((t) => (
                  <span key={`${t.hours}-${t.capacity}`} className="pointer-events-none absolute left-0 right-0 flex items-center" style={{ bottom: 22 + t.y }}>
                    <span className="w-10 shrink-0 pr-2 text-right text-[10px] tabular-nums text-slate-400">{fmtHours(t.hours)} h</span>
                    <span className={`h-px flex-1 ${t.capacity ? 'border-t border-dashed border-slate-400' : 'bg-slate-100'}`} />
                  </span>
                ))}

                {f.weeks.map((w) => {
                  const over = w.hours > w.capacity
                  const h = w.hours > 0 ? Math.max(4, Math.round((w.hours / scaleTop) * CHART_H)) : 0
                  const on = bucketKey === `w${w.index}`
                  return (
                    <button
                      key={w.index} type="button" onClick={() => setBucket(`w${w.index}`)}
                      title={`${w.rows.length} service${w.rows.length === 1 ? '' : 's'} · ${fmtHours(w.hours)} h · week of ${shortDay(w.start)}`}
                      className={`group relative flex flex-1 min-w-[40px] flex-col items-center justify-end gap-1 rounded-md border-0 p-0 pb-0.5 ${on ? 'bg-slate-100' : 'bg-transparent hover:bg-slate-50'}`}
                    >
                      <span className={`text-[11px] font-semibold tabular-nums ${over ? 'text-red-700' : on ? 'text-slate-900' : 'text-slate-500'}`}>
                        {w.rows.length || <span className="text-slate-300">·</span>}
                      </span>
                      <span className="flex w-full items-end" style={{ height: CHART_H }}>
                        <span
                          className={`w-full rounded-t transition-colors ${over ? 'bg-red-500' : on ? 'bg-slate-900' : 'bg-blue-500 group-hover:bg-blue-600'}`}
                          style={{ height: h }}
                        />
                      </span>
                      <span className={`text-[10px] tabular-nums ${on ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>
                        {new Date(w.start).getUTCDate()}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />Planned hours</span>
            {f.weeks.some((w) => w.hours > w.capacity) && (
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-500" />Over the crew&apos;s hours</span>
            )}
            <span>
              {capacityOnScale
                ? 'Dashed line is the crew’s hours for a week.'
                : `Busiest week is ${fmtHours(busiest)} h — well inside the crew's ${fmtHours(f.perWeek)} h a week, so the capacity line sits above this chart.`}
            </span>
          </div>

          {/* What the ninety days are made of. A planner reading "nine services"
              still has to ask which nine — this answers it in one line. */}
          {mix.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-500">Next {HORIZON_DAYS} days:</span>
              {mix.map((m) => (
                <Badge key={m.name} variant="outline" className="font-normal">
                  {m.name} <span className="ml-1 tabular-nums text-slate-500">{m.count}</span>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-base">
                {selected.label}
                {selected.week && (
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    {shortDay(selected.week.start)} – {shortDay(selected.week.end)}
                  </span>
                )}
              </CardTitle>
              <div className="mt-1.5 flex flex-wrap items-center gap-3">
                <span className="text-sm text-slate-500">
                  {shown.length} {shown.length === 1 ? 'service' : 'services'}
                  {selected.week ? ` · ${fmtHours(selected.week.hours)} h of the crew's ${fmtHours(selected.week.capacity)} h` : ''}
                </span>
                {selected.week && selected.week.capacity > 0 && (
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className={`block h-full rounded-full ${selected.week.load > 1 ? 'bg-red-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min(100, Math.round(selected.week.load * 100))}%` }}
                      />
                    </span>
                    <span className="text-xs tabular-nums text-slate-500">
                      {Math.round(selected.week.load * 100)}% of the week
                    </span>
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={q} onChange={(e) => setQ(e.target.value)} placeholder="Schedule or unit"
                className="h-9 w-full sm:w-56"
              />
              <select
                value={trigger} onChange={(e) => setTrigger(e.target.value)}
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
              >
                <option value="all">Hours and calendar</option>
                <option value="meter">Hours-led</option>
                <option value="time">Calendar-led</option>
              </select>
              <select
                value={who} onChange={(e) => setWho(e.target.value)}
                className="h-9 max-w-[180px] rounded-md border border-slate-200 bg-white px-2 text-sm"
              >
                <option value="all">Anyone</option>
                {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <Button size="sm" className="gap-1.5" onClick={raiseWeek} disabled={busy || !shown.length}>
                <Plus className="h-4 w-4" />
                Raise these
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {shown.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Nothing falls here.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3 font-medium">Service</th>
                      <th className="py-2 px-3 font-medium">Falls due</th>
                      <th className="py-2 px-3 font-medium">On</th>
                      <th className="py-2 px-3 font-medium text-right">Hours left</th>
                      <th className="py-2 px-3 font-medium text-right">Est.</th>
                      <th className="py-2 px-3 font-medium">Assigned</th>
                      <th className="py-2 pl-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.pageItems.map((r) => {
                      const p = r.schedule
                      const meter = r.state.byMeter
                      return (
                        <tr key={idOf(p)} className="border-b border-slate-100 align-top">
                          <td className="py-2 pr-3">
                            <button
                              type="button"
                              className="border-0 bg-transparent p-0 text-left font-medium text-slate-900 hover:underline"
                              onClick={() => router.push(`/portal/oxmaint/pm-schedules/${encodeURIComponent(idOf(p))}`)}
                            >
                              {p.schedule_name}
                            </button>
                            <span className="block text-xs text-slate-500">
                              <button
                                type="button" className="border-0 bg-transparent p-0 text-inherit hover:underline"
                                onClick={() => router.push(`/portal/oxmaint/assets/${encodeURIComponent(p.asset_id)}`)}
                              >
                                {p.asset_name}
                              </button>
                              {p.asset_code ? ` · ${p.asset_code}` : ''} · {frequencyLabel(p)}
                            </span>
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            {r.overdue ? (
                              <>
                                <span className="font-medium text-red-700">Due now</span>
                                {r.lateDays > 0 && (
                                  <span className="block text-xs text-slate-500">
                                    {r.lateDays >= 730
                                      ? `${(r.lateDays / 365).toFixed(1)} years late`
                                      : r.lateDays >= 60
                                        ? `${Math.round(r.lateDays / 30)} months late`
                                        : `${r.lateDays} ${r.lateDays === 1 ? 'day' : 'days'} late`}
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                <span className="text-slate-900">{fmtDate(new Date(r.at).toISOString())}</span>
                                {r.by === 'meter' && <span className="block text-xs text-slate-500">projected</span>}
                              </>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {r.by && (
                              <Badge className={TRIGGER_LOOK[r.by]}>{r.by === 'meter' ? 'Hours' : 'Calendar'}</Badge>
                            )}
                            {r.both && <span className="block text-xs text-slate-500">both, same week</span>}
                            {r.meterNote && <span className="block text-xs text-amber-700">{r.meterNote}</span>}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-slate-600">
                            {/* Past the interval reads as hours over, not as a
                                negative number of hours left. */}
                            {meter && !meter.unknown
                              ? (meter.hoursRemaining < 0
                                ? <span className="text-red-700">{Math.abs(meter.hoursRemaining).toLocaleString('en-US')} h over</span>
                                : `${Number(meter.hoursRemaining).toLocaleString('en-US')} h`)
                              : '—'}
                            {r.perDay > 0 && (
                              <span className="block text-xs text-slate-400">{Math.round(r.perDay * 10) / 10} h/day</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-slate-600">{r.hours ? `${fmtHours(r.hours)} h` : '—'}</td>
                          <td className="py-2 px-3 text-slate-600">{p.assigned_to_name || '—'}</td>
                          <td className="py-2 pl-3 text-right">
                            {r.jobOpen ? (
                              <Badge variant="outline">Job open</Badge>
                            ) : generatedToday(p) ? (
                              <Badge variant="outline">Raised today</Badge>
                            ) : (
                              <Button size="sm" variant="outline" disabled={busy} onClick={() => raiseOne(r)}>
                                Raise job
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <PagerBar {...paged} noun="services" />
            </>
          )}
          {bucketKey === 'unplaced' && shown.length > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              These are hour-based schedules with no usage to project from — the meter has never been read, or
              the unit has no run-rate on record. Log a reading on Meters &amp; Utilisation and they take their
              place in the weeks above.
            </p>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
        Dates on the calendar side are the schedule&apos;s own. Dates on the hours side are projected from how
        hard each unit is worked — {f.rows.filter((r) => r.perDay > 0).length} units have a run-rate on record —
        so they move as readings come in. Raising a job here does the same thing as raising it from the
        register: the work order is created and the schedule rolls forward.
      </p>
    </div>
  )
}
