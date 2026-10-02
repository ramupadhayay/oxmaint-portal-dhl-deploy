'use client'

// Logbook Routes — the operator round, taken rather than reported.
//
// The cards used to show what a round had found. They now show what the last
// round entered here found, because the round is taken on this screen: the
// operator types each reading and the row tells him there and then whether it is
// inside limits. That is the whole value of a logbook round — the judgement is
// made at the machine, by the person standing in front of it, not by whoever
// reads the sheet the next morning.

import { useMemo, useState } from 'react'
import {
  PageHeader, StatStrip, Card, Section, DataTable, Drawer, StatusBadge,
  ActionButton, Bar, PALETTE,
} from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { useRecords, useStore } from '../lib/store'
import { useActions } from '../lib/actions'
import { ASSETS, USER, DOMAIN, fmtDate, daysUntil, isPast, daysFrom, seed, pick, between } from '../lib/data'
import { LOG_ROUTES } from '../lib/dataOps'

const { MUTE, SUB, INK, LINE, GREEN, AMBER, RED, BLUE, ACCENT } = PALETTE

const idOf = (r) => r.route_id || r.recordId
const runIdOf = (r) => r.run_id || r.recordId

const barColour = (pct) => (pct === 100 ? GREEN : pct >= 60 ? BLUE : pct > 0 ? AMBER : MUTE)

// "Next due" is the only date on this card that an operator acts on, so it is
// written the way he would say it rather than as a calendar date.
const dueLabel = (iso) => {
  const d = daysUntil(iso)
  if (d === 0) return 'Due today'
  if (d === 1) return 'Due tomorrow'
  return d < 0 ? `Overdue by ${Math.abs(d)} days` : `Due in ${d} days`
}

// What is actually read on a round, with the limits the reading is judged
// against. Two bands, not one: outside the normal range is a warning the
// operator notes and watches, outside the trip band is a failure that stops
// being his problem and becomes maintenance's. The vibration figures are the
// ISO 10816 zone boundaries, which is the one parameter on this list an
// audience will check.
const DEFAULT_PARAM_TYPES = [
  { param: 'Bearing temperature', short: 'Bearing temp', unit: '°C', lo: 40, hi: 75, failLo: 25, failHi: 90, dp: 0 },
  { param: 'Discharge pressure', short: 'Discharge press', unit: 'bar', lo: 5.5, hi: 8.5, failLo: 4.2, failHi: 9.6, dp: 1 },
  { param: 'Motor current', short: 'Motor current', unit: 'A', lo: 18, hi: 32, failLo: 11, failHi: 38, dp: 1 },
  { param: 'Tank level', short: 'Tank level', unit: '%', lo: 35, hi: 85, failLo: 15, failHi: 92, dp: 0 },
  { param: 'Vibration', short: 'Vibration', unit: 'mm/s', lo: 0, hi: 4.5, failLo: 0, failHi: 7.1, dp: 1 },
  { param: 'Flow', short: 'Flow', unit: 'm³/h', lo: 45, hi: 90, failLo: 28, failHi: 106, dp: 0 },
]

// A pack reads its own parameters, in its own units — a ramp round reads
// hydraulic pressure in psi and GPU output in hertz, not bearing temperatures.
const PARAM_TYPES = DOMAIN?.routeReadings?.length ? DOMAIN.routeReadings : DEFAULT_PARAM_TYPES

const RESULT_TONE = { Normal: GREEN, Warning: AMBER, Failed: RED }

const judge = (pt, raw) => {
  if (raw === '' || raw === undefined || raw === null) return null
  const v = Number(raw)
  if (!Number.isFinite(v)) return null
  if (v < pt.failLo || v > pt.failHi) return 'Failed'
  if (v < pt.lo || v > pt.hi) return 'Warning'
  return 'Normal'
}

// The round's reading points. A route says how many points it has; this is what
// they are. Each one is a named parameter on a real asset at that site, so a
// failed reading can raise a work order against something that exists rather
// than against a tag nobody can find.
const pointsFor = (route) => {
  const pool = ASSETS.filter((a) => a.site_id === route.site_id)
  const from = pool.length ? pool : ASSETS
  return Array.from({ length: route.points }, (_, i) => {
    const k = `${idOf(route)}-pt${i}`
    const type = pick(k + 'ty', PARAM_TYPES)
    // Strided rather than drawn, so a round walks past a spread of the plant
    // instead of reading the same compressor eleven times.
    const asset = from[(i * 3) % from.length]
    return {
      ...type,
      id: k,
      asset_id: asset.asset_id,
      asset_name: asset.asset_name,
      asset_code: asset.asset_code,
      tag: `${asset.asset_code} ${type.short}`,
    }
  })
}

// A plausible instrument value for a point. Most of the plant is inside limits
// on any given round — a prefill that threw up failures everywhere would say
// the plant is broken rather than that the screen works.
const instrumentValue = (pt) => {
  const band = seed(pt.id + 'band')
  // The overshoot is taken from the parameter's own span rather than from a
  // flat percentage. A tank drawn 14% over its high-level trip reads 108% full,
  // which is not a fault condition — it is an impossible number.
  const span = pt.failHi - pt.lo
  if (band > 0.94) return between(pt.id + 'f', pt.failHi + span * 0.01, pt.failHi + span * 0.08, pt.dp)
  if (band > 0.82) return between(pt.id + 'w', pt.hi + span * 0.02, pt.failHi - span * 0.02, pt.dp)
  return between(pt.id + 'n', pt.lo + (pt.hi - pt.lo) * 0.1, pt.hi - (pt.hi - pt.lo) * 0.08, pt.dp)
}

function Chip({ children, tone }) {
  const c = tone === 'red'
    ? { fg: '#b91c1c', bg: '#fef2f2', bd: '#fecaca' }
    : { fg: '#b45309', bg: '#fffbeb', bd: '#fde68a' }
  return (
    <span style={{
      display: 'inline-block', padding: '2.5px 8px', borderRadius: 7, fontSize: 11, fontWeight: 600,
      color: c.fg, background: c.bg, border: `1px solid ${c.bd}`, whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

export default function LogbookRoutes() {
  const { scope, siteName } = useSite()
  const { create, update, notify } = useStore()
  const { raiseWorkOrder } = useActions()

  const [runner, setRunner] = useState(null)
  const [readings, setReadings] = useState({})
  const [raise, setRaise] = useState({})
  const [roundNote, setRoundNote] = useState('')

  const merged = useRecords('logbook_route', LOG_ROUTES, idOf)
  const runs = useRecords('logbook_run', [], runIdOf)
  const all = useMemo(() => scope(merged), [scope, merged])

  const failed = all.reduce((n, r) => n + r.failed_params.length, 0)
  const avg = all.length ? Math.round(all.reduce((n, r) => n + r.completion_pct, 0) / all.length) : 0
  const recentRuns = useMemo(() => scope(runs), [scope, runs])
  const runsToday = recentRuns.filter((r) => daysUntil(r.run_date) === 0)

  const points = runner?.points || []
  const entered = points.filter((p) => judge(p, readings[p.id]))
  const failures = points.filter((p) => judge(p, readings[p.id]) === 'Failed')
  const warnings = points.filter((p) => judge(p, readings[p.id]) === 'Warning')
  const progress = points.length ? Math.round((entered.length / points.length) * 100) : 0

  const startRound = (route) => {
    setRunner({ route, points: pointsFor(route) })
    setReadings({})
    setRaise({})
    setRoundNote('')
  }

  const fillFromInstruments = () => {
    // Most of these points are already instrumented and trending; typing
    // thirty-odd values a machine already knows is the part of a paper round
    // this product exists to remove. Every field stays editable afterwards.
    setReadings((prev) => Object.fromEntries(points.map((p) => [p.id, prev[p.id] || String(instrumentValue(p))])))
  }

  const submitRound = async () => {
    const route = runner.route
    const today = daysFrom(0)
    const completion = Math.round((entered.length / points.length) * 100)
    const failedTags = failures.map((p) => p.tag)
    const warningTags = warnings.map((p) => p.tag)

    await create('logbook_run', {
      route_id: idOf(route),
      route_name: route.route_name,
      shift: route.shift,
      site_id: route.site_id,
      operator_name: route.assigned_to_name,
      recorded_by_name: USER.name,
      run_date: today,
      points_total: points.length,
      points_read: entered.length,
      completion_pct: completion,
      failed_count: failures.length,
      warning_count: warnings.length,
      normal_count: entered.length - failures.length - warnings.length,
      readings: entered.map((p) => ({
        tag: p.tag,
        asset_name: p.asset_name,
        parameter: p.param,
        value: Number(readings[p.id]),
        unit: p.unit,
        normal_range: `${p.lo}–${p.hi} ${p.unit}`,
        result: judge(p, readings[p.id]),
      })),
      notes: roundNote,
      status: completion === 100 ? 'Completed' : 'In Progress',
    })

    await update('logbook_route', idOf(route), {
      last_run: today,
      completion_pct: completion,
      failed_params: failedTags,
      warning_params: warningTags,
      // A finished round books the next one. Left alone, a route completed this
      // morning would still be reported as due today for the rest of the day.
      next_due: completion === 100 ? daysFrom(1) : route.next_due,
      status: completion === 100 ? 'Completed'
        : isPast(route.next_due) ? 'Overdue'
          : completion > 0 ? 'In Progress' : 'Scheduled',
    })

    const wanted = failures.filter((p) => raise[p.id] !== false)
    for (const p of wanted) {
      const value = Number(readings[p.id])
      await raiseWorkOrder({
        title: `${p.param} out of limits on ${p.asset_name}`,
        description: `${p.param} read ${value} ${p.unit} on the ${route.route_name} (${route.shift} shift). `
          + `Normal is ${p.lo}–${p.hi} ${p.unit} and the trip band is ${p.failLo}–${p.failHi} ${p.unit}. `
          + `${roundNote || 'No further detail recorded by the operator.'}`,
        assetId: p.asset_id,
        type: 'Corrective',
        priority: 'High',
        dueInDays: 2,
        estimatedHours: 3,
        source: `Logbook route ${route.route_name}`,
      })
    }

    setRunner(null)
    notify(wanted.length
      ? `Round recorded. ${failures.length} failed, ${wanted.length} work order${wanted.length > 1 ? 's' : ''} raised.`
      : `Round recorded. ${entered.length} of ${points.length} points read.`)
  }

  const columns = [
    { key: 'route_name', label: 'Route', render: (r) => <span style={{ fontWeight: 700, color: '#15227a' }}>{r.route_name}</span> },
    { key: 'shift', label: 'Shift' },
    { key: 'points', label: 'Points', align: 'right' },
    { key: 'assigned_to_name', label: 'Operator' },
    {
      key: 'completion_pct', label: 'Complete', align: 'right',
      render: (r) => <span style={{ fontWeight: 700, color: barColour(r.completion_pct) }}>{r.completion_pct}%</span>,
    },
    {
      key: 'failed', label: 'Failed', align: 'right', sortValue: (r) => r.failed_params.length,
      render: (r) => (r.failed_params.length
        ? <span style={{ fontWeight: 700, color: '#b91c1c' }}>{r.failed_params.length}</span>
        : <span style={{ color: MUTE }}>—</span>),
    },
    {
      key: 'warning', label: 'Warning', align: 'right', sortValue: (r) => r.warning_params.length,
      render: (r) => (r.warning_params.length
        ? <span style={{ fontWeight: 700, color: '#b45309' }}>{r.warning_params.length}</span>
        : <span style={{ color: MUTE }}>—</span>),
    },
    { key: 'last_run', label: 'Last run', sortValue: (r) => new Date(r.last_run).getTime(), render: (r) => fmtDate(r.last_run) },
    {
      key: 'next_due', label: 'Next due', sortValue: (r) => new Date(r.next_due).getTime(),
      render: (r) => (
        <span style={{ whiteSpace: 'nowrap', color: isPast(r.next_due) ? '#b91c1c' : INK, fontWeight: isPast(r.next_due) ? 700 : 500 }}>
          {fmtDate(r.next_due)}
        </span>
      ),
    },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge>{r.status}</StatusBadge> },
  ]

  return (
    <div>
      <PageHeader
        icon={sectionIcon('logbook-routes', '#15227a')}
        title="Logbook Routes"
        subtitle={`Operator rounds and reading points · ${siteName}`}
      />

      <StatStrip items={[
        { label: 'Routes', value: all.length },
        { label: 'Due today', value: all.filter((r) => daysUntil(r.next_due) === 0).length, tone: 'blue' },
        { label: 'Failed parameters', value: failed, tone: failed ? 'red' : 'green' },
        { label: 'Average completion', value: avg, unit: '%' },
        { label: 'Rounds taken today', value: runsToday.length, tone: runsToday.length ? 'green' : undefined },
      ]} />

      {all.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(340px, 100%),1fr))', gap: 14, marginBottom: 14 }}>
          {all.map((r) => (
            <Card key={idOf(r)}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: INK }}>{r.route_name}</h3>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: MUTE }}>{r.shift} shift · {r.points} reading points</p>
                </div>
                <StatusBadge>{r.status}</StatusBadge>
              </div>

              <div style={{ marginBottom: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                  <span style={{ color: SUB, fontWeight: 600 }}>Round complete</span>
                  <span style={{ fontWeight: 800, color: barColour(r.completion_pct) }}>{r.completion_pct}%</span>
                </div>
                <Bar pct={r.completion_pct} color={barColour(r.completion_pct)} />
                <p style={{ margin: '6px 0 0', fontSize: 11.5, color: MUTE }}>
                  {Math.round((r.completion_pct / 100) * r.points)} of {r.points} points read
                </p>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 13, minHeight: 22 }}>
                {r.failed_params.map((p, i) => <Chip key={`${p}-f${i}`} tone="red">{p}</Chip>)}
                {r.warning_params.map((p, i) => <Chip key={`${p}-w${i}`} tone="amber">{p}</Chip>)}
                {!r.failed_params.length && !r.warning_params.length && (
                  <span style={{ fontSize: 11.5, color: GREEN, fontWeight: 600 }}>All parameters inside limits</span>
                )}
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                paddingTop: 11, borderTop: `1px solid ${LINE}`, fontSize: 12,
              }}>
                <span style={{ color: SUB }}>{r.assigned_to_name}</span>
                <span style={{ fontWeight: 700, color: isPast(r.next_due) ? RED : SUB }}>{dueLabel(r.next_due)}</span>
              </div>

              <div style={{ marginTop: 11 }}>
                <ActionButton size="sm" full variant={isPast(r.next_due) || daysUntil(r.next_due) === 0 ? 'primary' : 'subtle'}
                  onClick={() => startRound(r)}>Start round</ActionButton>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card><div style={{ padding: '34px 0', textAlign: 'center', color: MUTE, fontSize: 12.5 }}>No rounds are set up at {siteName}.</div></Card>
      )}

      <Section title="All routes">
        <DataTable columns={columns} rows={all} pageSize={10} onRowClick={startRound}
          empty="No rounds are set up at this site." />
      </Section>

      {recentRuns.length > 0 && (
        <Section title="Rounds recorded">
          {recentRuns.slice(0, 8).map((r) => (
            <div key={runIdOf(r)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${LINE}` }}>
              <StatusBadge tone={r.failed_count ? 'red' : r.warning_count ? 'amber' : 'green'}>
                {r.points_read}/{r.points_total}
              </StatusBadge>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.route_name}</span>
              {r.failed_count > 0 && <span style={{ fontSize: 11.5, color: '#b91c1c', fontWeight: 700 }}>{r.failed_count} failed</span>}
              {r.warning_count > 0 && <span style={{ fontSize: 11.5, color: '#b45309', fontWeight: 700 }}>{r.warning_count} warning</span>}
              <span style={{ fontSize: 11.5, color: SUB, minWidth: 108, textAlign: 'right' }}>{r.operator_name}</span>
              <span style={{ fontSize: 11.5, color: MUTE, minWidth: 88, textAlign: 'right' }}>{fmtDate(r.run_date)}</span>
            </div>
          ))}
        </Section>
      )}

      <Drawer
        open={Boolean(runner)} onClose={() => setRunner(null)}
        title={runner?.route.route_name}
        subtitle={runner ? `${runner.route.shift} shift · ${runner.route.assigned_to_name}` : null}
        icon={sectionIcon('logbook-routes', '#15227a')}
        width={560}
        footer={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: failures.length ? RED : entered.length === points.length ? GREEN : MUTE }}>
              {entered.length} of {points.length} read
              {failures.length ? ` · ${failures.length} failed` : warnings.length ? ` · ${warnings.length} warning` : ''}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <ActionButton variant="ghost" onClick={() => setRunner(null)}>Cancel</ActionButton>
              <ActionButton variant={failures.length ? 'danger' : 'success'} disabled={!entered.length} onClick={submitRound}>
                {failures.length ? `Submit — ${failures.length} failed` : 'Submit round'}
              </ActionButton>
            </div>
          </div>
        }
      >
        {runner && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 5 }}>
                <span style={{ color: SUB, fontWeight: 600 }}>Round complete</span>
                <span style={{ fontWeight: 800, color: progress === 100 ? GREEN : AMBER }}>{progress}%</span>
              </div>
              <div style={{ height: 6, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? GREEN : AMBER, transition: 'width .2s' }} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11.5, color: MUTE }}>A partial round is still worth recording.</span>
              <div style={{ marginLeft: 'auto' }}>
                <ActionButton size="sm" variant="subtle" onClick={fillFromInstruments}>Fill from instruments</ActionButton>
              </div>
            </div>

            <div>
              {points.map((p, i) => {
                const raw = readings[p.id] ?? ''
                const result = judge(p, raw)
                const colour = result ? RESULT_TONE[result] : LINE
                return (
                  <div key={p.id} style={{ padding: '9px 0', borderBottom: `1px solid ${LINE}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 10.5, color: MUTE, fontWeight: 700, minWidth: 18 }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.param}
                        </div>
                        <div style={{ fontSize: 11, color: MUTE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.asset_code} · {p.asset_name} · normal {p.lo}–{p.hi} {p.unit}
                        </div>
                      </div>
                      <input
                        type="number" inputMode="decimal" step="any" value={raw}
                        onChange={(e) => setReadings((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        placeholder="—"
                        style={{
                          width: 78, boxSizing: 'border-box', padding: '6px 8px', fontSize: 12.5, fontWeight: 700,
                          textAlign: 'right', border: `1px solid ${result ? colour : LINE}`, borderRadius: 8,
                          color: result ? colour : INK, background: '#fff', fontFamily: 'inherit', outline: 'none',
                        }}
                      />
                      <span style={{ fontSize: 11, color: MUTE, minWidth: 34 }}>{p.unit}</span>
                      <span style={{
                        minWidth: 58, textAlign: 'center', fontSize: 10.5, fontWeight: 700,
                        color: result ? colour : '#cbd5e1',
                      }}>{result || 'Not read'}</span>
                    </div>

                    {result === 'Failed' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 7, paddingLeft: 28, fontSize: 11.5, color: SUB, cursor: 'pointer' }}>
                        <input
                          type="checkbox" checked={raise[p.id] !== false}
                          onChange={() => setRaise((prev) => ({ ...prev, [p.id]: prev[p.id] === false }))}
                          style={{ width: 14, height: 14, accentColor: ACCENT, cursor: 'pointer' }}
                        />
                        Raise a corrective work order against {p.asset_name}
                      </label>
                    )}
                  </div>
                )
              })}
            </div>

            <div>
              <label style={miniLabel}>Round notes</label>
              <textarea rows={3} value={roundNote} onChange={(e) => setRoundNote(e.target.value)}
                placeholder={failures.length ? 'What did you see at the machine?' : 'Anything worth recording'}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12.5, resize: 'vertical',
                  border: `1px solid ${LINE}`, borderRadius: 9, background: '#fff', color: INK,
                  fontFamily: 'inherit', outline: 'none',
                }} />
            </div>

            {failures.length > 0 && (
              <p style={{ margin: 0, padding: '9px 12px', fontSize: 12.5, lineHeight: 1.5, borderRadius: 9, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
                {failures.length} reading{failures.length > 1 ? 's are' : ' is'} outside the trip band. Submitting records
                the round and raises the corrective work ticked above.
              </p>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}

const miniLabel = { display: 'block', fontSize: 10, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }
