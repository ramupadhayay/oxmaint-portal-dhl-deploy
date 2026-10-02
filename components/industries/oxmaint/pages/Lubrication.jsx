'use client'

// Lubrication — the round, not the register.
//
// A list of greasing points with a next-due date is a report. What a lube
// technician actually does is walk a route with a grease gun and sign each
// point off, so the runner below is the screen and the table underneath is what
// it leaves behind: completing a point stamps its next due date, which is why
// the overdue figure at the top falls as the round is worked through.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw, Droplet, AlertTriangle, CalendarClock, Route as RouteIcon, CheckCircle2, Play,
} from 'lucide-react'
import {
  DataTable, Drawer, Fields, Section, StatusBadge, ActionButton, PALETTE,
} from '../lib/kit'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import { Progress } from '../ui/progress'
import { Card, CardContent } from '../ui/card'
import { Tabs as ShadTabs, TabsList, TabsTrigger } from '../ui/tabs'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../ui/select'
import StatTiles from '../components/StatTiles'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { useRecords, useStore } from '../lib/store'
import { useActions } from '../lib/actions'
import { USER, fmtDate, isPast, daysUntil, daysFrom } from '../lib/data'
import { LUBE_POINTS, LUBE_ROUTES, ROUTE_OWNER } from '../lib/dataMaint'

const { SUB, MUTE, INK, LINE, GREEN, AMBER, RED, ACCENT } = PALETTE

const idOf = (p) => p.lube_id || p.recordId
const runIdOf = (r) => r.run_id || r.recordId

const LUBRICANTS = [...new Set(LUBE_POINTS.map((p) => p.lubricant))].sort()

// Three outcomes, and only one of them moves a date. Skipped leaves the point
// exactly where it was — the round moves on, the point stays due. Blocked is a
// fault in its own right: a grease nipple you cannot reach is not a tick you
// missed, it is a job for a fitter.
const OUTCOMES = [['done', 'Done', GREEN], ['skipped', 'Skipped', AMBER], ['blocked', 'Blocked', RED]]

const label = (p) => `${p.asset_code} · ${p.point_name}`

export default function Lubrication() {
  const { scope, siteName } = useSite()
  const { create, update, notify } = useStore()
  const { raiseWorkOrder } = useActions()

  const [search, setSearch] = useState('')
  const [route, setRoute] = useState('all')
  const [lubricant, setLubricant] = useState('all')
  const [tab, setTab] = useState('all')
  const [openId, setOpenId] = useState(null)

  const [runner, setRunner] = useState(null)
  const [marks, setMarks] = useState({})
  const [notes, setNotes] = useState({})
  const [raise, setRaise] = useState({})
  const [roundNote, setRoundNote] = useState('')

  const merged = useRecords('lube_point', LUBE_POINTS, idOf)
  const runs = useRecords('lube_run', [], runIdOf)

  const all = useMemo(() => scope(merged), [scope, merged])
  const open = useMemo(() => all.find((p) => idOf(p) === openId) || null, [all, openId])

  const overdue = all.filter((p) => isPast(p.next_due))
  const dueSoon = all.filter((p) => !isPast(p.next_due) && daysUntil(p.next_due) <= 7)

  // The tabs are the three states a lube round is planned around: everything,
  // what has slipped, and what is about to. A point that is neither is not a
  // decision anybody is making today.
  const byTab = { all, overdue, soon: dueSoon }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (byTab[tab] || all).filter((p) => (
      (route === 'all' || p.route === route) &&
      (lubricant === 'all' || p.lubricant === lubricant) &&
      (!q || [p.asset_name, p.asset_code, p.point_name, p.lubricant, p.assigned_to_name].join(' ').toLowerCase().includes(q))
    ))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, overdue, dueSoon, tab, search, route, lubricant])

  const routesInScope = LUBE_ROUTES.filter((r) => all.some((p) => p.route === r))

  const recentRuns = useMemo(() => scope(runs), [scope, runs])
  const doneToday = recentRuns
    .filter((r) => daysUntil(r.run_date) === 0)
    .reduce((n, r) => n + (r.points_done || 0), 0)

  const points = runner?.points || []
  const answered = points.filter((p) => marks[idOf(p)]).length
  const blocked = points.filter((p) => marks[idOf(p)] === 'blocked')
  const progress = points.length ? Math.round((answered / points.length) * 100) : 0

  const startRun = (name, list, technician) => {
    setOpenId(null)
    setRunner({ route: name, points: list, technician })
    setMarks({})
    setNotes({})
    setRaise({})
    setRoundNote('')
  }

  const submitRun = async () => {
    const done = points.filter((p) => marks[idOf(p)] === 'done')
    const skipped = points.filter((p) => marks[idOf(p)] === 'skipped')
    const today = daysFrom(0)

    await create('lube_run', {
      route: runner.route,
      site_id: points[0]?.site_id || '',
      technician_name: runner.technician,
      signed_by_name: USER.name,
      run_date: today,
      points_total: points.length,
      points_done: done.length,
      points_skipped: skipped.length,
      points_blocked: blocked.length,
      done_points: done.map(label),
      // The exceptions in full. "2 skipped" is not a handover; which two, and
      // why, is the only part of a round the next shift needs.
      exceptions: [...skipped, ...blocked].map((p) => ({
        point: label(p),
        outcome: marks[idOf(p)],
        note: notes[idOf(p)] || '',
      })),
      notes: roundNote,
      status: 'Completed',
    })

    await Promise.all(done.map((p) => update('lube_point', idOf(p), {
      last_done: today,
      next_due: daysFrom(p.interval_days),
      status: 'Scheduled',
    })))

    const wanted = blocked.filter((p) => raise[idOf(p)] !== false)
    for (const p of wanted) {
      await raiseWorkOrder({
        title: `${p.point_name} unreachable on ${p.asset_name}`,
        description: `${p.point_name} could not be lubricated on the ${runner.route} round. `
          + `${notes[idOf(p)] || 'No further detail recorded.'} `
          + `The point takes ${p.quantity} of ${p.lubricant} every ${p.interval_days} days.`,
        assetId: p.asset_id,
        type: 'Corrective',
        dueInDays: 5,
        estimatedHours: 1,
        source: `Lubrication route ${runner.route}`,
      })
    }

    setRunner(null)
    notify(wanted.length
      ? `Round recorded. ${done.length} points stamped, ${wanted.length} work order${wanted.length > 1 ? 's' : ''} raised.`
      : `Round recorded. ${done.length} of ${points.length} points stamped.`)
  }

  const columns = [
    { key: 'asset_name', label: 'Asset', render: (r) => (
      <div>
        <div style={{ fontWeight: 600 }}>{r.asset_name}</div>
        <div style={{ fontSize: 11, color: MUTE }}>{r.asset_code}</div>
      </div>
    ) },
    { key: 'point_name', label: 'Point' },
    { key: 'lubricant', label: 'Lubricant' },
    { key: 'quantity', label: 'Qty', align: 'right' },
    { key: 'interval_days', label: 'Interval', align: 'right', render: (r) => `${r.interval_days} d` },
    { key: 'last_done', label: 'Last done', sortValue: (r) => new Date(r.last_done).getTime(), render: (r) => fmtDate(r.last_done) },
    {
      key: 'next_due', label: 'Next due', sortValue: (r) => new Date(r.next_due).getTime(),
      render: (r) => {
        const late = isPast(r.next_due)
        return (
          <span style={{ whiteSpace: 'nowrap', color: late ? '#b91c1c' : INK, fontWeight: late ? 700 : 500 }}>
            {fmtDate(r.next_due)}
            {late && <span style={{ fontSize: 10.5, marginLeft: 5 }}>{Math.abs(daysUntil(r.next_due))}d late</span>}
          </span>
        )
      },
    },
    { key: 'assigned_to_name', label: 'Assigned to' },
  ]

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Lubrication</h1>
          <p className="text-slate-600 mt-1 text-sm md:text-base">
            {all.length} lubrication points on {routesInScope.length} route
            {routesInScope.length === 1 ? '' : 's'} · {siteName}
          </p>
        </div>
        <Button
          variant="outline" className="h-10 px-4 gap-2"
          onClick={() => { setSearch(''); setRoute('all'); setLubricant('all'); setTab('all') }}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </motion.div>

      <StatTiles
        rows={all}
        storageKey="oxLubricationSummaryCards"
        cards={[
          { id: 'points', title: 'Lubrication points', icon: Droplet, color: 'bg-indigo-500', description: 'In scope', total: true, value: all.length },
          { id: 'overdue', title: 'Overdue', icon: AlertTriangle, color: 'bg-red-500', description: 'Past the next-due date', value: overdue.length },
          { id: 'soon', title: 'Due this week', icon: CalendarClock, color: 'bg-amber-500', description: 'Within seven days', value: dueSoon.length },
          { id: 'routes', title: 'Routes', icon: RouteIcon, color: 'bg-blue-500', description: 'Walked with a grease gun', value: routesInScope.length },
          { id: 'today', title: 'Points done today', icon: CheckCircle2, color: 'bg-green-500', description: 'Stamped on a round', value: doneToday },
        ]}
      />

      {/* The routes come before the register, because the round is the work and
          the register is what it leaves behind. */}
      <div>
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Routes</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {routesInScope.map((r) => (
            <RouteCard
              key={r} route={r} points={all.filter((p) => p.route === r)}
              onRun={() => startRun(r, all.filter((p) => p.route === r), ROUTE_OWNER[r])}
            />
          ))}
        </div>
      </div>

      <ShadTabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3 h-12">
          {[
            { key: 'all', label: 'All points', Icon: Droplet, n: all.length },
            { key: 'overdue', label: 'Overdue', Icon: AlertTriangle, n: overdue.length },
            { key: 'soon', label: 'Due this week', Icon: CalendarClock, n: dueSoon.length },
          ].map(({ key, label: text, Icon, n }) => (
            <TabsTrigger key={key} value={key} className="flex items-center gap-2">
              <Icon className="w-4 h-4" />
              {text}
              {n > 0 && <Badge variant="secondary">{n}</Badge>}
            </TabsTrigger>
          ))}
        </TabsList>
      </ShadTabs>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search asset, point, lubricant or technician…"
          className="h-10 sm:max-w-md"
        />
        <Select value={route} onValueChange={setRoute}>
          <SelectTrigger className="h-10 sm:w-48"><SelectValue placeholder="All routes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All routes</SelectItem>
            {LUBE_ROUTES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={lubricant} onValueChange={setLubricant}>
          <SelectTrigger className="h-10 sm:w-48"><SelectValue placeholder="All lubricants" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All lubricants</SelectItem>
            {LUBRICANTS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-500 sm:ml-auto">{rows.length} shown</span>
      </div>

      <DataTable columns={columns} rows={rows} onRowClick={(r) => setOpenId(idOf(r))} pageSize={12}
        empty="No lubrication points match these filters." />

      {recentRuns.length > 0 && (
        <Section title="Rounds recorded" style={{ marginTop: 14 }}>
          {recentRuns.slice(0, 8).map((r) => (
            <div key={runIdOf(r)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${LINE}` }}>
              <StatusBadge tone={r.points_blocked ? 'red' : r.points_skipped ? 'amber' : 'green'}>
                {r.points_done}/{r.points_total}
              </StatusBadge>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.route}</span>
              {r.points_skipped > 0 && <span style={{ fontSize: 11.5, color: '#b45309', fontWeight: 700 }}>{r.points_skipped} skipped</span>}
              {r.points_blocked > 0 && <span style={{ fontSize: 11.5, color: '#b91c1c', fontWeight: 700 }}>{r.points_blocked} blocked</span>}
              <span style={{ fontSize: 11.5, color: SUB, minWidth: 108, textAlign: 'right' }}>{r.technician_name}</span>
              <span style={{ fontSize: 11.5, color: MUTE, minWidth: 88, textAlign: 'right' }}>{fmtDate(r.run_date)}</span>
            </div>
          ))}
        </Section>
      )}

      <Drawer
        open={Boolean(open)} onClose={() => setOpenId(null)}
        title={open?.point_name}
        subtitle={open ? `${open.asset_name} (${open.asset_code})` : null}
        icon={sectionIcon('lubrication', '#15227a')}
        footer={open ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <ActionButton onClick={() => startRun(open.route, [open], open.assigned_to_name)}>Lubricate this point</ActionButton>
          </div>
        ) : null}
      >
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatusBadge>{isPast(open.next_due) ? 'Overdue' : open.status}</StatusBadge>
              <StatusBadge tone="grey">{`Every ${open.interval_days} days`}</StatusBadge>
            </div>

            <Fields rows={[
              ['Asset', `${open.asset_name} (${open.asset_code})`],
              ['Site', open.site_name],
              ['Point', open.point_name],
              ['Lubricant', open.lubricant],
              ['Quantity', open.quantity],
              ['Interval', `${open.interval_days} days`],
              ['Route', open.route],
              ['Assigned to', open.assigned_to_name],
              ['Last done', fmtDate(open.last_done)],
              ['Next due', fmtDate(open.next_due)],
            ]} />
          </div>
        )}
      </Drawer>

      <Drawer
        open={Boolean(runner)} onClose={() => setRunner(null)}
        title={runner?.route}
        subtitle={runner ? `${points.length} point${points.length === 1 ? '' : 's'} · ${runner.technician}` : null}
        icon={sectionIcon('lubrication', '#15227a')}
        width={540}
        footer={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11.5, color: answered === points.length ? GREEN : MUTE, fontWeight: 700 }}>
              {answered} of {points.length} signed{blocked.length ? ` · ${blocked.length} blocked` : ''}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <ActionButton variant="ghost" onClick={() => setRunner(null)}>Cancel</ActionButton>
              <ActionButton variant={blocked.length ? 'danger' : 'success'} disabled={answered < points.length} onClick={submitRun}>
                {answered < points.length ? `${points.length - answered} left` : 'Sign off round'}
              </ActionButton>
            </div>
          </div>
        }
      >
        {runner && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 5 }}>
                <span style={{ color: SUB, fontWeight: 600 }}>Progress</span>
                <span style={{ fontWeight: 800, color: progress === 100 ? GREEN : AMBER }}>{progress}%</span>
              </div>
              <div style={{ height: 6, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? GREEN : AMBER, transition: 'width .2s' }} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11.5, color: MUTE }}>A clean round takes one press. Points you have already answered keep their answer.</span>
              <div style={{ marginLeft: 'auto' }}>
                <ActionButton size="sm" variant="subtle"
                  onClick={() => setMarks((prev) => Object.fromEntries(points.map((p) => [idOf(p), prev[idOf(p)] || 'done'])))}>
                  Mark all done
                </ActionButton>
              </div>
            </div>

            <div>
              {points.map((p, i) => {
                const id = idOf(p)
                const outcome = marks[id]
                const late = isPast(p.next_due)
                return (
                  <div key={id} style={{ padding: '10px 0', borderBottom: `1px solid ${LINE}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 10.5, color: MUTE, fontWeight: 700, minWidth: 18 }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{p.point_name}</div>
                        <div style={{ fontSize: 11, color: MUTE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.asset_name} · {p.quantity} {p.lubricant}
                          {late && <span style={{ color: '#b91c1c', fontWeight: 700 }}> · {Math.abs(daysUntil(p.next_due))}d late</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {OUTCOMES.map(([val, text, colour]) => (
                          <button key={val} onClick={() => setMarks((prev) => ({ ...prev, [id]: val }))}
                            style={{
                              padding: '4px 9px', fontSize: 10.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                              borderRadius: 7, border: `1px solid ${outcome === val ? colour : LINE}`,
                              background: outcome === val ? colour : '#fff',
                              color: outcome === val ? '#fff' : SUB,
                            }}>{text}</button>
                        ))}
                      </div>
                    </div>

                    {outcome && outcome !== 'done' && (
                      <div style={{ marginTop: 8, paddingLeft: 28, display: 'flex', flexDirection: 'column', gap: 7 }}>
                        <input
                          value={notes[id] || ''}
                          onChange={(e) => setNotes((prev) => ({ ...prev, [id]: e.target.value }))}
                          placeholder={outcome === 'blocked' ? 'What is in the way?' : 'Why was it skipped?'}
                          style={noteInput}
                        />
                        {outcome === 'blocked' && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: SUB, cursor: 'pointer' }}>
                            <input
                              type="checkbox" checked={raise[id] !== false}
                              onChange={() => setRaise((prev) => ({ ...prev, [id]: prev[id] === false }))}
                              style={{ width: 14, height: 14, accentColor: ACCENT, cursor: 'pointer' }}
                            />
                            Raise a corrective work order against {p.asset_name}
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div>
              <label style={miniLabel}>Round notes</label>
              <textarea rows={3} value={roundNote} onChange={(e) => setRoundNote(e.target.value)}
                placeholder="Anything the next shift should know"
                style={{ ...noteInput, resize: 'vertical' }} />
            </div>

            <p style={{ margin: 0, padding: '9px 12px', fontSize: 12.5, lineHeight: 1.5, borderRadius: 9, background: '#f8fafc', border: `1px solid ${LINE}`, color: SUB }}>
              Signing off stamps today onto every point marked done and books its next visit.
              Skipped and blocked points keep the date they already had.
            </p>
          </div>
        )}
      </Drawer>
    </div>
  )
}

// A route, and how far behind it is.
//
// "On schedule" is the percentage of its points that are not yet overdue, which
// is the figure that decides whether this round is worth walking today. The card
// tints when it slips below three quarters, and its button turns primary the
// moment anything on it is late — the one route that needs doing should not look
// like the three that do not.
function RouteCard({ route, points, onRun }) {
  const late = points.filter((p) => isPast(p.next_due)).length
  const pct = points.length ? Math.round(((points.length - late) / points.length) * 100) : 100
  const tone = pct >= 90 ? 'text-green-600' : pct >= 75 ? 'text-amber-600' : 'text-red-600'

  return (
    <Card className={`border ${pct < 75 ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
      <CardContent className="p-4">
        <div className="font-semibold text-sm text-slate-900">{route}</div>
        <div className="text-xs text-slate-500 mt-0.5">{ROUTE_OWNER[route]}</div>

        <div className="flex items-baseline gap-1.5 mt-3 mb-2">
          <span className={`text-2xl font-bold leading-none ${tone}`}>{pct}%</span>
          <span className="text-xs font-medium text-slate-600">on schedule</span>
        </div>

        <Progress value={pct} className="h-1.5" />

        <div className="flex items-center justify-between mt-2.5 text-xs">
          <span className="text-slate-600">{points.length} points</span>
          <span className={late ? 'text-red-600 font-semibold' : 'text-slate-400'}>{late} overdue</span>
        </div>

        <Button
          size="sm" variant={late ? 'default' : 'outline'} onClick={onRun}
          className="w-full mt-3 h-8 text-xs gap-1.5"
        >
          <Play className="w-3.5 h-3.5" />
          Run route
        </Button>
      </CardContent>
    </Card>
  )
}

const miniLabel = { display: 'block', fontSize: 10, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }
const noteInput = {
  width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 12.5,
  border: `1px solid ${LINE}`, borderRadius: 8, background: '#fff', color: INK,
  fontFamily: 'inherit', outline: 'none',
}
