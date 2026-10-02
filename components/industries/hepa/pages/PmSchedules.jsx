'use client'

// The PM calendar.
//
// Every filter on the registry carries a test interval — quarterly or
// semi-annual — and a date its certification runs out. Put together that is a
// preventive maintenance plan, and it is the screen a planner opens on a Monday
// to see what the week owes.
//
// The interval is the workbook's. What is derived is where each one falls
// against today and what that makes it: overdue, due soon, or scheduled. Those
// are the same three states the notification screen escalates on, computed once
// in the data layer so the two can never disagree.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, DataTable, Toolbar, Section, HBars, PALETTE,
} from '../lib/kit'
import { PM_SCHEDULES, CLEANROOMS, THRESHOLDS, pct } from '../lib/data'
import { DateCell, DueIn, Status, Id, Derived } from '../lib/ui'

const { INK, SUB, MUTE, LINE } = PALETTE

const stateTone = (s) => (s === 'Overdue' ? 'red' : s === 'Due soon' ? 'amber' : s === 'Scheduled' ? 'grey' : 'grey')

export default function PmSchedules() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [freq, setFreq] = useState('all')
  const [state, setState] = useState('all')
  const [room, setRoom] = useState('all')

  const rows = useMemo(() => PM_SCHEDULES.filter((p) => {
    if (freq !== 'all' && p.frequency !== freq) return false
    if (state !== 'all' && p.state !== state) return false
    if (room !== 'all' && p.cleanroomId !== room) return false
    if (q && !`${p.scheduleId} ${p.filterId} ${p.cleanroomName} ${p.task} ${p.assignedTo || ''}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }).map((p) => ({ ...p, id: p.scheduleId })), [q, freq, state, room])

  const counts = ['Overdue', 'Due soon', 'Scheduled'].map((name) => ({
    name, value: PM_SCHEDULES.filter((p) => p.state === name).length,
    color: name === 'Overdue' ? '#dc2626' : name === 'Due soon' ? '#d97706' : '#94a3b8',
  }))

  // The next fortnight, day by day. A planner's question is "what lands this
  // week", which a status column answers only indirectly.
  const upcoming = useMemo(() => PM_SCHEDULES
    .filter((p) => p.dueIn != null && p.dueIn >= 0 && p.dueIn <= 60)
    .sort((a, b) => a.dueIn - b.dueIn), [])

  const overdue = counts[0].value

  const columns = [
    { key: 'scheduleId', label: 'Schedule', render: (r) => <Id strong>{r.scheduleId}</Id> },
    { key: 'task', label: 'Task', render: (r) => <span><strong style={{ color: INK, fontSize: 12 }}>DOP/PAO integrity test</strong><span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{r.cleanroomName} · {r.isoClass}</span></span> },
    { key: 'filterId', label: 'Asset', render: (r) => <Id>{r.filterId}</Id> },
    { key: 'frequency', label: 'Every', render: (r) => <span>{r.frequency}<span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{r.everyDays} days</span></span> },
    { key: 'lastDoneOn', label: 'Last done', render: (r) => <span><DateCell shifted={r.lastDoneOn} original={r.lastDoneWorkbook} /><span style={{ display: 'block', fontSize: 10.5 }}>{r.lastResult ? <Status>{r.lastResult}</Status> : null}</span></span>, sortValue: (r) => r.lastDoneOn || '' },
    { key: 'nextDueOn', label: 'Next due', render: (r) => <DateCell shifted={r.nextDueOn} original={r.nextDueWorkbook} bold /> },
    { key: 'dueIn', label: 'Lead', render: (r) => <DueIn days={r.dueIn} />, sortValue: (r) => r.dueIn ?? 9999 },
    { key: 'compliance', label: 'Pass rate', align: 'right', render: (r) => (r.compliance == null ? '—' : <span style={{ fontWeight: 700, color: r.compliance === 1 ? '#047857' : r.compliance >= 0.5 ? '#b45309' : '#b91c1c' }}>{pct(r.compliance)}<span style={{ fontSize: 10.5, color: MUTE, fontWeight: 500 }}> of {r.completions}</span></span>), sortValue: (r) => r.compliance ?? -1 },
    { key: 'assignedTo', label: 'Last by', render: (r) => r.assignedTo || <span style={{ color: MUTE }}>—</span> },
    { key: 'state', label: 'Status', render: (r) => <Status>{r.state === 'Overdue' ? 'Overdue' : r.state === 'Due soon' ? 'Pending' : 'Scheduled'}</Status>, sortValue: (r) => r.dueIn ?? 9999 },
  ]

  return (
    <div>
      <PageHeading
        title="PM Schedules"
        subtitle={`Every filter's testing plan — the interval it is certified on, when it was last done, and when it comes round again. A schedule inside ${THRESHOLDS.notificationLeadDays.value} days notifies; past its date it escalates.`}
      />

      <StatCards items={[
        { label: 'Schedules', value: PM_SCHEDULES.length, icon: 'list', note: 'one per registered filter' },
        { label: 'Overdue', value: overdue, icon: 'alert', tone: overdue ? 'red' : 'green', note: 'past the certification date' },
        { label: 'Due soon', value: counts[1].value, icon: 'clock', tone: counts[1].value ? 'amber' : 'green', note: `within ${THRESHOLDS.notificationLeadDays.value} days` },
        { label: 'Scheduled', value: counts[2].value, icon: 'tick', note: 'inside their interval' },
        { label: 'Quarterly', value: PM_SCHEDULES.filter((p) => p.frequency === 'Quarterly').length, icon: 'chart', note: `${PM_SCHEDULES.filter((p) => p.frequency === 'Semi-Annual').length} semi-annual` },
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14, marginBottom: 14 }}>
        <Section title="Where the plan stands" right={<Derived />} style={{ marginBottom: 0 }}>
          <HBars data={counts} />
          <p style={styles.foot}>
            The interval on each schedule is the workbook&apos;s. Where it falls
            against today is worked out here, using the same{' '}
            {THRESHOLDS.notificationLeadDays.value}-day lead time the notification
            screen escalates on — so the two cannot disagree.
          </p>
        </Section>

        <Section title="Coming up" right={<span style={{ fontSize: 11.5, color: MUTE }}>next 60 days</span>} style={{ marginBottom: 0 }}>
          {upcoming.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upcoming.slice(0, 6).map((p) => (
                <div key={p.scheduleId} style={styles.row}
                  onClick={() => router.push(`/portal/hepa/filters/${p.filterId}`)}>
                  <span style={{ ...styles.days, ...(p.dueIn <= THRESHOLDS.notificationLeadDays.value ? styles.daysSoon : null) }}>
                    {p.dueIn}d
                  </span>
                  <span style={{ minWidth: 0, flex: '1 1 150px' }}>
                    <strong style={{ fontSize: 12, color: INK }}>{p.cleanroomName}</strong>
                    <span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>
                      <Id>{p.filterId}</Id> · {p.frequency}
                    </span>
                  </span>
                  <span style={{ fontSize: 11, color: MUTE, whiteSpace: 'nowrap' }}>{p.assignedTo || 'unassigned'}</span>
                </div>
              ))}
              {upcoming.length > 6 && (
                <span style={{ fontSize: 11.5, color: MUTE, paddingLeft: 2 }}>
                  and {upcoming.length - 6} more inside 60 days.
                </span>
              )}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 12.5, color: MUTE, lineHeight: 1.6 }}>
              Nothing falls due in the next 60 days. {overdue} schedules are
              already past their date and come first.
            </p>
          )}
        </Section>
      </div>

      <Toolbar
        search={q}
        onSearch={setQ}
        placeholder="Schedule, filter, cleanroom or technician…"
        filters={[
          { label: 'Frequency', value: freq, onChange: setFreq, options: [...new Set(PM_SCHEDULES.map((p) => p.frequency))] },
          { label: 'Status', value: state, onChange: setState, options: ['Overdue', 'Due soon', 'Scheduled'] },
          { label: 'Cleanroom', value: room, onChange: setRoom, options: CLEANROOMS.map((c) => c.cleanroomId) },
        ]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} of {PM_SCHEDULES.length}</span>}
      />

      <DataTable
        columns={columns}
        rows={rows}
        pageSize={14}
        empty="No schedule matches these filters."
        onRowClick={(r) => router.push(`/portal/hepa/filters/${r.filterId}`)}
      />

      <p style={{ fontSize: 11.5, color: MUTE, margin: '12px 2px 0', paddingTop: 12, borderTop: `1px solid ${LINE}`, lineHeight: 1.55 }}>
        Pass rate is per schedule — how many of that filter&apos;s own tests passed.
        The site-wide figure stays the workbook&apos;s own, on the Overview.
      </p>
    </div>
  )
}

const styles = {
  row: {
    display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap', cursor: 'pointer',
    padding: '8px 11px', borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 9, background: '#fcfdfe',
  },
  days: {
    minWidth: 38, textAlign: 'center', fontSize: 11.5, fontWeight: 700,
    color: '#475569', background: '#f1f5f9', borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`,
    borderRadius: 7, padding: '3px 6px', flexShrink: 0,
  },
  daysSoon: { color: '#b45309', background: '#fffbeb', borderColor: '#fde68a' },
  foot: {
    margin: '13px 0 0', paddingTop: 11, borderTop: `1px solid ${LINE}`,
    fontSize: 11.5, color: MUTE, lineHeight: 1.55,
  },
}
