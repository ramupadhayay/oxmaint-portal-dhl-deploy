'use client'

// One suite, on its own page.
//
// The list used to answer this in a 470px drawer, and a suite is the one record
// in this portal that a drawer cannot hold: six assets, eighteen checkpoints,
// its place in a 91-day rotation and whatever has been raised against it. A
// person asked "what is going on with 214" wants all four at once, and wants to
// be able to send the answer to somebody — which a panel sliding over a table
// cannot be.
//
// Everything rotational is read from `useSuites`, never the generated SUITES.
// A PM ticked on today's schedule moves this suite's last and next dates, and a
// record page that still said Overdue after somebody had just recorded the PM
// would be the same bug the rotation board had: the record reaches the store and
// the screen goes on drawing the state it first rendered.

import { useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Section, Card, Fields, DataTable,
  StatusBadge, ActionButton, HBars, PALETTE,
} from '../lib/kit'
import { useRecords, useStore } from '../lib/store'
import { useSuites, useRotation, useWorkOrders } from '../lib/live'
import {
  SUITE_ASSETS, SUITE_PM, CYCLE_DAYS, USER, fmtDate, isOpen,
} from '../lib/data'

const { ACCENT, INK, SUB, MUTE, GREEN, RED } = PALETTE

// Hoisted for the same reason live.jsx hoists its own: `useRecords` memoises on
// its arguments, so a fresh `[]` and a fresh arrow per render recompute the
// merge every render and hand back a new array that invalidates the memos below.
const NONE = []
const byRecordId = (r) => r.recordId

// The five kitchen appliances, named rather than counted off the end of the
// list. A suite's sixth asset is the PTAC, which a limited-service room has too
// — it is these five that make the extended-stay estate twice the size, so they
// are the five the page counts.
const KITCHEN = new Set(['Guest Refrigerator', 'Dishwasher', 'Microwave', 'Cooktop', 'Garbage Disposal'])

// Read off the checklist rather than written out. DailySchedule lists its five
// groups by hand and a checklist that gained a sixth would silently not show it.
const PM_GROUPS = [...new Set(SUITE_PM.checklist.map((c) => c.group))]

// Must match Checklists.jsx exactly. The ticks shown here are that screen's
// records, read back — a second key scheme would render an empty checklist
// beside a walked one and look like the ticks had been lost.
const checkId = (suiteNumber, item) => `chk_${suiteNumber}_${item.replace(/\W+/g, '').slice(0, 24)}`

const dayKey = (iso) => iso.slice(0, 10)

const stateTone = (s) => (
  s === 'Overdue' ? 'red' : s === 'Due today' ? 'amber' : s === 'Done this cycle' ? 'green' : 'grey'
)

export default function SuiteView({ section, id }) {
  const router = useRouter()
  const suites = useSuites()
  const rotation = useRotation(suites)
  const workOrders = useWorkOrders()
  const { update, ready } = useStore()
  const runs = useRecords('hosp_checklist_run', NONE, byRecordId)

  // The URL carries the suite number, because that is what everyone at the
  // property calls it. A link built from a table row carries `ste_214` instead,
  // so both are accepted rather than one of them 404ing.
  const suite = useMemo(
    () => suites.find((s) => s.suite_number === String(id) || s.suite_id === String(id)) || null,
    [suites, id]
  )

  const assets = useMemo(
    () => (suite ? SUITE_ASSETS.filter((a) => a.suite_number === suite.suite_number) : []),
    [suite]
  )

  // Live work orders, so one closed on the schedule this morning shows closed
  // here rather than still open against the suite.
  const wos = useMemo(
    () => (suite ? workOrders.filter((w) => w.suite_number === suite.suite_number) : []),
    [workOrders, suite]
  )

  const doneChecks = useMemo(
    () => new Set(runs.filter((r) => r.done).map((r) => r.recordId)),
    [runs]
  )

  const recordPm = useCallback(() => {
    if (!suite || !ready || !update) return
    const now = new Date().toISOString()
    // The same record id DailySchedule writes, on purpose. A PM recorded here
    // and the same PM ticked on the schedule are one event, and two ids would
    // make the rotation count it twice.
    const pmId = `spm_${suite.suite_number}_${dayKey(now)}`
    update('hosp_suite_pm', pmId, {
      recordId: pmId,
      suite_number: suite.suite_number,
      completed_date: now,
      checkpoints: SUITE_PM.checklist.length,
      title: `Suite ${suite.suite_number} — quarterly PM`,
      completed_by: USER.name,
    })
  }, [suite, ready, update])

  if (!suite) return <NotHere reference={id} router={router} />

  const openWos = wos.filter(isOpen)
  const kitchen = assets.filter((a) => KITCHEN.has(a.asset_type))
  const late = suite.state === 'Overdue'
  const checksDone = SUITE_PM.checklist.filter((c) => doneChecks.has(checkId(suite.suite_number, c.item))).length

  const assetColumns = [
    { key: 'asset_type', label: 'Asset', render: (r) => <strong style={{ color: INK }}>{r.asset_type}</strong> },
    { key: 'asset_code', label: 'Code', render: (r) => <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5, color: SUB }}>{r.asset_code}</span> },
    { key: 'manufacturer', label: 'Make' },
    { key: 'criticality', label: 'Criticality', render: (r) => <StatusBadge tone={r.criticality === 'High' ? 'red' : r.criticality === 'Medium' ? 'amber' : 'grey'}>{r.criticality}</StatusBadge> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge>{r.status}</StatusBadge> },
    { key: 'health_score', label: 'Health', align: 'right', render: (r) => `${r.health_score}%` },
  ]

  const woColumns = [
    { key: 'work_order_number', label: 'Number', render: (r) => <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5, color: ACCENT, fontWeight: 700 }}>{r.work_order_number}</span> },
    { key: 'title', label: 'Job', render: (r) => <span style={{ color: INK }}>{r.title}</span> },
    { key: 'priority', label: 'Priority' },
    { key: 'assigned_to_name', label: 'Assigned' },
    { key: 'due_date', label: 'Due', render: (r) => fmtDate(r.due_date), sortValue: (r) => new Date(r.due_date).getTime() },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge>{r.status}</StatusBadge> },
  ]

  return (
    <div>
      <PageHeading
        title={`Suite ${suite.suite_number}`}
        subtitle={`${suite.suite_type} · Floor ${suite.floor} · ${suite.occupied ? 'occupied' : 'vacant'}${suite.pet_friendly ? ' · pet friendly' : ''}`}
        back={{ label: 'Suites', onClick: () => router.push('/portal/hospitality/suites') }}
        right={(
          suite.completed_today ? (
            <StatusBadge tone="green">PM recorded today</StatusBadge>
          ) : (
            // Disabled until the store's first fetch answers. A write before
            // then is dropped when that load replaces the record map, with no
            // error anywhere — see the note at the top of DailySchedule.
            <ActionButton onClick={recordPm} disabled={!ready}>
              Record the quarterly PM
            </ActionButton>
          )
        )}
      />

      <StatCards items={[
        {
          label: late ? 'Days late' : suite.state === 'Due today' ? 'Due' : 'Due in',
          value: late ? suite.overdue_days : suite.state === 'Due today' ? 'Today' : suite.due_in_days,
          unit: late ? 'days' : suite.state === 'Due today' ? '' : 'days',
          tone: late ? 'red' : suite.state === 'Due today' ? 'amber' : 'green',
          note: fmtDate(suite.next_pm_date),
        },
        {
          label: 'Rotation slot',
          value: suite.rotation_slot + 1,
          unit: `of ${rotation.total}`,
          note: `day ${suite.cycle_day} of the ${CYCLE_DAYS}-day cycle`,
        },
        {
          label: 'Assets in suite',
          value: assets.length,
          note: `${kitchen.length} of them kitchen appliances`,
          tone: assets.some((a) => a.status === 'Down') ? 'red' : undefined,
        },
        {
          label: 'Open work orders',
          value: openWos.length,
          tone: openWos.length ? 'amber' : 'green',
          note: `${wos.length} raised against this suite`,
        },
      ]} />

      <div style={styles.two}>
        <Section title="Where it is in the rotation" style={{ marginBottom: 0 }}>
          <Fields rows={[
            ['State', <StatusBadge key="s" tone={stateTone(suite.state)}>{suite.state}</StatusBadge>],
            ['Last PM', fmtDate(suite.last_pm_date)],
            ['Next due', fmtDate(suite.next_pm_date)],
            ['Occupancy', suite.occupied ? 'Occupied' : 'Vacant'],
            ['Suite type', suite.suite_type],
            ['Pet friendly', suite.pet_friendly ? 'Yes' : 'No'],
          ]} />

          <CycleTrack
            position={rotation.cyclePosition}
            days={rotation.cycleDays}
            day={suite.cycle_day}
            late={late}
          />

          <p style={{ margin: '12px 0 0', fontSize: 11.5, color: MUTE, lineHeight: 1.55 }}>
            {late
              ? `Carried on the catch-up queue until it is walked. The cycle is ${CYCLE_DAYS} days over ${rotation.total} suites, so a day missed is roughly ${rotation.perDay} suites to make up.`
              : `Its slot is its place in the building, not a shuffled queue — the suites either side of it come up on the same days, so the walk is a corridor rather than the whole property.`}
          </p>
        </Section>

        <Section
          title={`The ${SUITE_PM.checklist.length}-point PM`}
          right={<span style={{ fontSize: 11.5, color: MUTE }}>{SUITE_PM.minutes} min · {checksDone} of {SUITE_PM.checklist.length} ticked</span>}
          style={{ marginBottom: 0 }}
        >
          {/* Checkpoints per system, because the shape of this bar *is* the
              argument: the kitchen alone carries more of the PM than HVAC and
              safety together, which is why an extended-stay suite takes 45
              minutes where a limited-service room takes twenty. */}
          <HBars
            data={PM_GROUPS.map((g) => ({
              name: g,
              value: SUITE_PM.checklist.filter((c) => c.group === g).length,
              color: g === 'Kitchen' ? ACCENT : '#94a3b8',
            }))}
          />

          <div style={{ marginTop: 14 }}>
            {PM_GROUPS.map((group) => (
              <div key={group} style={{ marginBottom: 11 }}>
                <div style={styles.groupLabel}>{group}</div>
                {SUITE_PM.checklist.filter((c) => c.group === group).map((c) => {
                  const done = doneChecks.has(checkId(suite.suite_number, c.item))
                  return (
                    <div key={c.item} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '3px 0' }}>
                      <span style={{ ...styles.tick, borderColor: done ? GREEN : '#cbd5e1', background: done ? GREEN : '#fff' }}>
                        {done ? '✓' : ''}
                      </span>
                      <span style={{ fontSize: 12.5, color: done ? MUTE : SUB, lineHeight: 1.45, textDecoration: done ? 'line-through' : 'none' }}>
                        {c.item}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Read-only on purpose. The checkpoints are walked on Checklists,
              which is built for one hand on a phone in a suite; showing them
              here without the walking screen's controls keeps one place where a
              tick is recorded and one story about what was done. */}
          <button onClick={() => router.push('/portal/hospitality/checklists')} style={styles.linkBtn}>
            Walk the checklist →
          </button>
        </Section>
      </div>

      <Section
        title="Assets in this suite"
        right={<span style={{ fontSize: 11.5, color: MUTE }}>{assets.length} — the kitchen is {kitchen.length} of them</span>}
      >
        <DataTable
          columns={assetColumns}
          rows={assets.map((a) => ({ ...a, id: a.asset_id }))}
          pageSize={8}
          onRowClick={(r) => router.push(`/portal/hospitality/assets/${r.asset_id}`)}
          empty="No assets registered against this suite."
        />
      </Section>

      <Section
        title="Work orders raised against this suite"
        right={<span style={{ fontSize: 11.5, color: MUTE }}>{openWos.length} still open</span>}
      >
        <DataTable
          columns={woColumns}
          rows={wos.map((w) => ({ ...w, id: w.workorder_id || w.recordId }))}
          pageSize={8}
          onRowClick={(r) => router.push(`/portal/hospitality/work-orders/${r.workorder_id || r.recordId}`)}
          empty="Nothing has been raised against this suite."
        />
      </Section>
    </div>
  )
}

// Where today sits in the cycle, and where this suite sits. Two markers on one
// track: the gap between them is the whole question — a suite behind the marker
// that has not been walked is the definition of the catch-up queue.
function CycleTrack({ position, days, day, late }) {
  const pct = (n) => `${Math.max(0, Math.min(100, (n / days) * 100))}%`
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ position: 'relative', height: 10, background: '#f1f5f9', borderRadius: 999 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct(position), background: '#dbeafe', borderRadius: 999 }} />
        <div style={{ position: 'absolute', left: pct(day), top: -3, width: 3, height: 16, marginLeft: -1.5, borderRadius: 2, background: late ? RED : ACCENT }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: MUTE }}>
        <span>day 0</span>
        <span>today is day {position} · this suite is day {day}</span>
        <span>day {days}</span>
      </div>
    </div>
  )
}

function NotHere({ reference, router }) {
  return (
    <Card style={{ maxWidth: 560 }}>
      <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: INK }}>Nothing here with that reference</h1>
      <p style={{ margin: '8px 0 0', fontSize: 13, color: SUB, lineHeight: 1.6 }}>
        <code style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{String(reference)}</code> is not a
        suite at this property. The suites run 101–133, 201–233 and 301–332.
      </p>
      <div style={{ marginTop: 16 }}>
        <ActionButton onClick={() => router.push('/portal/hospitality/suites')}>Back to the suites</ActionButton>
      </div>
    </Card>
  )
}

const styles = {
  two: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 14, marginBottom: 14, alignItems: 'start' },
  groupLabel: {
    fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase',
    letterSpacing: 0.4, marginBottom: 4,
  },
  tick: {
    width: 15, height: 15, flexShrink: 0, marginTop: 2, borderRadius: 4,
    border: '1.5px solid #cbd5e1', color: '#fff', fontSize: 10, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  linkBtn: {
    marginTop: 6, padding: '5px 11px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
    background: '#fff', border: `1px solid ${ACCENT}33`, color: ACCENT, borderRadius: 7, cursor: 'pointer',
  },
}
