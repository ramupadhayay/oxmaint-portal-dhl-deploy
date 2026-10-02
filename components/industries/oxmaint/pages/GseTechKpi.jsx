'use client'

// Technician KPIs — where the shop's hours go, measured the way the workbook
// measures them.
//
// A labour screen is easy to make unfair. Hours alone reward whoever was rostered
// most; jobs closed rewards whoever picked the quick ones; a ranking with a name at
// the bottom tells a supervisor nothing they can act on. So this screen leads with
// the team against the station's own planning assumptions — 65% wrench time and a
// come-back rate under 10% — and only then lists people, sortable by any column
// rather than ranked by one.
//
// Wrench time is recorded hours on jobs ÷ scheduled shift hours on the days the
// person logged time, so a part-time apprentice is not measured against a full
// roster. Come-backs are counted on work orders the person was assigned and
// divided by their unscheduled assignments, because a PM cannot come back. Peer
// index is hours ÷ the mean hours of the people shown, as the workbook's KPI tab
// does it (1.00 = team average) — a measure of load, not of merit.
//
// Twelve months is the default window because that is the team that exists now;
// five years is there to reconcile against the workbook, and matches it exactly.

import { useEffect, useMemo, useState } from 'react'
import {
  Clock, RotateCcw, AlertTriangle, DollarSign, Users, ArrowUp, ArrowDown, Loader2,
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { GSE_ACTIVE } from '../lib/gse'
import { loadGseAnalytics, money } from '../lib/data'
import ModuleOff from '../components/ModuleOff'

const ROLES = ['GSE Supervisor', 'Lead Technician', 'GSE Technician', 'Apprentice Technician']
const SHIFTS = ['Days', 'Swing', 'Nights']
const SELECT = 'h-10 px-3 rounded-md border border-slate-200 text-sm bg-white outline-none focus:border-primary/40'

const ratio = (n, d) => (d > 0 ? n / d : null)
const pct = (v, d = 1) => (v === null || !Number.isFinite(v) ? '—'
  : `${(v * 100).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}%`)
const num = (v, d = 1) => (v === null || !Number.isFinite(v) ? '—'
  : v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }))

// Green at or above target, amber within five points under it, red below that.
const wrenchTone = (v, target) => (v === null ? 'slate' : v >= target ? 'green' : v >= target - 0.05 ? 'amber' : 'red')
const TONE_TEXT = { green: 'text-emerald-700', amber: 'text-amber-700', red: 'text-red-700', slate: 'text-slate-400' }
const TONE_BAR = { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', slate: 'bg-slate-300' }

const COLUMNS = [
  { key: 'name', label: 'Name', align: 'left' },
  { key: 'role', label: 'Role', align: 'left' },
  { key: 'shift', label: 'Shift', align: 'left' },
  { key: 'hours', label: 'Hours' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'wrench', label: 'Wrench time' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'perJob', label: 'Hours / job' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'comebacks', label: 'Come-backs' },
  { key: 'rework', label: 'Rework' },
  { key: 'p1', label: 'P1 jobs' },
  { key: 'peer', label: 'Peer index' },
]

export default function GseTechKpi() {
  const [a, setA] = useState(null)
  const [win, setWin] = useState('m12')
  const [role, setRole] = useState('all')
  const [shift, setShift] = useState('all')
  const [sort, setSort] = useState({ key: 'wrench', dir: 'desc' })

  const enabled = GSE_ACTIVE && Boolean(loadGseAnalytics)

  useEffect(() => {
    if (!enabled) return
    let live = true
    loadGseAnalytics().then((r) => { if (live) setA(r) })
    return () => { live = false }
  }, [enabled])

  // People in the window. Anyone with no hours in it (a leaver, on the
  // twelve-month view) is left out rather than shown as a row of zeros that would
  // also drag the peer average down.
  const people = useMemo(() => (a?.labourKpi || [])
    .map((p) => ({ ...p, w: p[win] }))
    .filter((p) => p.w && (p.w.hours > 0 || p.w.assigned > 0)), [a, win])

  const shown = useMemo(() => {
    const list = people
      .filter((p) => role === 'all' || p.role === role)
      .filter((p) => shift === 'all' || p.shift === shift)
    const mean = list.length ? list.reduce((n, p) => n + p.w.hours, 0) / list.length : 0
    return list.map((p) => ({
      ...p,
      hours: p.w.hours,
      scheduled: p.w.scheduled,
      wrench: ratio(p.w.hours, p.w.scheduled),
      jobs: p.w.jobs,
      perJob: ratio(p.w.hours, p.w.jobs),
      assigned: p.w.assigned,
      comebacks: p.w.comebacks,
      comebackRate: ratio(p.w.comebacks, p.w.unscheduledAssigned),
      rework: p.w.rework,
      p1: p.w.p1,
      peer: mean > 0 ? p.w.hours / mean : null,
    }))
  }, [people, role, shift])

  const sorted = useMemo(() => {
    const { key, dir } = sort
    const sign = dir === 'asc' ? 1 : -1
    return [...shown].sort((x, y) => {
      const u = x[key]
      const v = y[key]
      // Blanks sink to the bottom whichever way the column is sorted.
      if (u === null && v === null) return 0
      if (u === null) return 1
      if (v === null) return -1
      const c = typeof u === 'string' ? u.localeCompare(v) : u - v
      return c * sign || x.name.localeCompare(y.name)
    })
  }, [shown, sort])

  if (!enabled) return <ModuleOff module="Technician KPIs" />

  if (!a) {
    return (
      <div className="max-w-8xl mx-auto p-6 space-y-6">
        <Header />
        <div className="flex items-center gap-2 py-16 justify-center text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading labour history…
        </div>
      </div>
    )
  }

  const { targets } = a
  const sum = (k) => shown.reduce((n, p) => n + (p.w[k] || 0), 0)
  const teamWrench = ratio(sum('hours'), sum('scheduled'))
  const teamComeback = ratio(sum('comebacks'), sum('unscheduledAssigned'))
  const reworkShare = ratio(sum('rework'), sum('assigned'))
  const wrenchGap = teamWrench === null ? null : Math.round((teamWrench - targets.wrenchTime) * 1000) / 10
  const windowLabel = win === 'm12' ? 'last 12 months' : '5 years'

  const byShift = SHIFTS.map((s) => {
    const group = shown.filter((p) => p.shift === s)
    const g = (k) => group.reduce((n, p) => n + (p.w[k] || 0), 0)
    return {
      shift: s,
      people: group.length,
      hours: g('hours'),
      wrench: ratio(g('hours'), g('scheduled')),
      comeback: ratio(g('comebacks'), g('unscheduledAssigned')),
    }
  })

  const toggleSort = (key) => setSort((s) => (s.key === key
    ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
    : { key, dir: ['name', 'role', 'shift'].includes(key) ? 'asc' : 'desc' }))

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <Header />
        <div className="inline-flex rounded-md border border-slate-200 bg-white p-1 w-fit">
          {[['m12', 'Last 12 months'], ['y5', '5 years']].map(([k, label]) => (
            <Button
              key={k} size="sm" variant={win === k ? 'default' : 'ghost'} className="h-8"
              aria-pressed={win === k} onClick={() => setWin(k)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Team wrench time" value={pct(teamWrench)}
          sub={wrenchGap === null ? `target ${pct(targets.wrenchTime, 0)}`
            : `${num(Math.abs(wrenchGap))} pts ${wrenchGap >= 0 ? 'above' : 'below'} the ${pct(targets.wrenchTime, 0)} target`}
          Icon={Clock} tone={teamWrench === null ? null : teamWrench >= targets.wrenchTime ? 'green' : 'amber'}
        />
        <Stat
          label="Come-back rate" value={pct(teamComeback)}
          sub={`${sum('comebacks').toLocaleString('en-US')} of ${sum('unscheduledAssigned').toLocaleString('en-US')} unscheduled jobs · target under ${pct(targets.comebackRate, 0)}`}
          Icon={RotateCcw} tone={teamComeback === null ? null : teamComeback <= targets.comebackRate ? 'green' : 'amber'}
        />
        <Stat
          label="Rework-flagged jobs" value={sum('rework').toLocaleString('en-US')}
          sub={`${pct(reworkShare)} of ${sum('assigned').toLocaleString('en-US')} assigned`}
          Icon={AlertTriangle}
        />
        <Stat
          label="Labour" value={`${num(sum('hours'), 0)} h`}
          sub={`${money(sum('cost'))} · ${windowLabel}`}
          Icon={DollarSign}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <Users className="w-5 h-5" />
            By person
            <span className="ml-auto text-sm font-normal text-slate-500">
              {shown.length} {shown.length === 1 ? 'person' : 'people'} · {windowLabel}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <select value={role} onChange={(e) => setRole(e.target.value)} className={SELECT}>
              <option value="all">All roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={shift} onChange={(e) => setShift(e.target.value)} className={SELECT}>
              <option value="all">All shifts</option>
              {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <p className="text-xs text-slate-500">
            Wrench time = recorded hours on jobs ÷ scheduled shift hours on the days worked. Come-back
            rate is over unscheduled jobs assigned. Peer index 1.00 = average hours of the people shown.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  {COLUMNS.map((c) => (
                    <th key={c.key} className={`py-2 pr-3 font-medium whitespace-nowrap ${c.align === 'left' ? 'text-left' : 'text-right'}`}>
                      <button
                        type="button" onClick={() => toggleSort(c.key)}
                        className={`inline-flex items-center gap-1 border-0 bg-transparent p-0 text-xs font-medium uppercase tracking-wide text-inherit hover:text-slate-900 ${sort.key === c.key ? 'text-slate-900' : ''}`}
                        aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                      >
                        {c.label}
                        {sort.key === c.key && (sort.dir === 'asc'
                          ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                      </button>
                    </th>
                  ))}
                  <th className="py-2 font-medium text-left whitespace-nowrap">20 quarters</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((p) => {
                  const tone = wrenchTone(p.wrench, targets.wrenchTime)
                  return (
                    <tr key={p.user_id}>
                      <td className="py-2.5 pr-3 font-medium text-slate-900 whitespace-nowrap">{p.name}</td>
                      <td className="py-2.5 pr-3 text-slate-600 whitespace-nowrap">{p.role}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{p.shift}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{num(p.hours)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-slate-600">{num(p.scheduled)}</td>
                      <td className="py-2.5 pr-3 text-right">
                        <span className={`block tabular-nums font-semibold ${TONE_TEXT[tone]}`}>{pct(p.wrench)}</span>
                        <span className="relative mt-1 ml-auto block h-1.5 w-20 rounded-full bg-slate-200">
                          <span className={`block h-full rounded-full ${TONE_BAR[tone]}`} style={{ width: `${Math.min(100, (p.wrench || 0) * 100)}%` }} />
                          <span className="absolute -top-0.5 h-2.5 w-px bg-slate-700" style={{ left: `${targets.wrenchTime * 100}%` }} title="target" />
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{p.jobs.toLocaleString('en-US')}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-slate-600">{num(p.perJob, 2)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{p.assigned.toLocaleString('en-US')}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums whitespace-nowrap">
                        {p.comebacks.toLocaleString('en-US')}
                        <span className={`ml-1 text-xs ${p.comebackRate !== null && p.comebackRate > targets.comebackRate ? 'text-amber-700' : 'text-slate-400'}`}>
                          ({pct(p.comebackRate, 0)})
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{p.rework.toLocaleString('en-US')}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{p.p1.toLocaleString('en-US')}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{num(p.peer, 2)}</td>
                      <td className="py-2.5"><Spark quarters={p.quarters} target={targets.wrenchTime} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {sorted.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">Nobody matches these filters in this window.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>By shift</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {byShift.map((s) => {
              const tone = wrenchTone(s.wrench, targets.wrenchTime)
              return (
                <div key={s.shift} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{s.shift}</span>
                    <Badge className="bg-slate-100 text-slate-700">{s.people} {s.people === 1 ? 'person' : 'people'}</Badge>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div><dt className="text-xs text-slate-500">Hours</dt><dd className="tabular-nums font-medium">{num(s.hours, 0)}</dd></div>
                    <div><dt className="text-xs text-slate-500">Wrench</dt><dd className={`tabular-nums font-medium ${TONE_TEXT[tone]}`}>{pct(s.wrench)}</dd></div>
                    <div><dt className="text-xs text-slate-500">Come-backs</dt><dd className="tabular-nums font-medium">{pct(s.comeback)}</dd></div>
                  </dl>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Technician KPIs</h1>
      <p className="text-slate-600 mt-1">
        Wrench time, come-backs and load across the GSE team, against the station's planning targets
      </p>
    </div>
  )
}

// Wrench time per quarter, 0–100%, with the target as a dashed line. Quarters
// with no scheduled hours are skipped rather than drawn as zero.
function Spark({ quarters, target }) {
  const W = 100
  const H = 24
  const n = quarters?.length || 0
  if (!n) return <span className="text-slate-400">—</span>
  const x = (i) => (n === 1 ? W / 2 : (i / (n - 1)) * W)
  const y = (v) => H - Math.max(0, Math.min(1, v)) * H
  const pts = quarters
    .map((q, i) => (q.scheduled > 0 ? [x(i), y(q.hours / q.scheduled)] : null))
    .filter(Boolean)
  if (!pts.length) return <span className="text-slate-400">—</span>
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block overflow-visible" aria-label="Quarterly wrench time">
      <line x1="0" x2={W} y1={y(target)} y2={y(target)} stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />
      <polyline points={pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')} fill="none" stroke="#2563eb" strokeWidth="1.5" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="1.8" fill="#2563eb" />
    </svg>
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
