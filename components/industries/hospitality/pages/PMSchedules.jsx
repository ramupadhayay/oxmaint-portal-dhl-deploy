'use client'

// The PM library — everything that repeats, and how often.
//
// The suite rotation sits at the top of this list rather than only on its own
// board, because it is a PM schedule like the rest and by far the largest: 98
// suites at 45 minutes is more standing work than every round below it put
// together. A library that omitted it would understate the department's load by
// most of it.

import { useMemo, useState } from 'react'
import {
  PageHeading, StatCards, DataTable, Toolbar, Section, HBars, StatusBadge, PALETTE,
} from '../lib/kit'
import { PM_SCHEDULES, SUITE_COUNT, SUITE_PM, CYCLE_DAYS, fmtDate, daysUntil } from '../lib/data'

const { ACCENT, INK, SUB, MUTE } = PALETTE

// Minutes a month, so schedules on different intervals can be compared at all.
// A daily ten-minute round is four hours a month; a monthly twenty-minute one is
// twenty minutes. Ranking by duration alone would put them the wrong way round.
const monthlyMinutes = (s) =>
  s.schedule_id === 'pms_rotation'
    ? Math.round((SUITE_COUNT * SUITE_PM.minutes * 30) / CYCLE_DAYS)
    : Math.round((s.minutes * 30) / s.every_days)

export default function PMSchedules() {
  const [q, setQ] = useState('')
  const [freq, setFreq] = useState('all')

  const rows = useMemo(() => PM_SCHEDULES.filter((s) => {
    if (freq !== 'all' && s.frequency !== freq) return false
    if (q && !`${s.schedule_name} ${s.scope} ${s.owner}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }).map((s) => ({ ...s, id: s.schedule_id, load: monthlyMinutes(s) })), [q, freq])

  const totalLoad = PM_SCHEDULES.reduce((n, s) => n + monthlyMinutes(s), 0)
  const complianceCount = PM_SCHEDULES.filter((s) => s.compliance).length

  const columns = [
    { key: 'schedule_name', label: 'Schedule', render: (r) => <strong style={{ color: INK }}>{r.schedule_name}</strong> },
    { key: 'frequency', label: 'Frequency', render: (r) => <StatusBadge tone={r.frequency === 'Daily' ? 'blue' : r.frequency === 'Weekly' ? 'violet' : 'grey'}>{r.frequency}</StatusBadge> },
    { key: 'scope', label: 'Scope', render: (r) => <span style={{ color: SUB }}>{r.scope}</span> },
    { key: 'tasks', label: 'Tasks', align: 'center' },
    { key: 'minutes', label: 'Each', align: 'right', render: (r) => `${r.minutes}m` },
    { key: 'load', label: 'Per month', align: 'right', render: (r) => `${Math.floor(r.load / 60)}h ${String(r.load % 60).padStart(2, '0')}m` },
    { key: 'compliance', label: 'Compliance', render: (r) => (r.compliance ? <StatusBadge tone="blue">{r.compliance}</StatusBadge> : '—') },
    { key: 'next_due', label: 'Next', render: (r) => (daysUntil(r.next_due) <= 0 ? 'Today' : fmtDate(r.next_due)), sortValue: (r) => new Date(r.next_due).getTime() },
  ]

  const bars = [...PM_SCHEDULES]
    .map((s) => ({ name: s.schedule_name.length > 38 ? s.schedule_name.slice(0, 36) + '…' : s.schedule_name, value: Math.round(monthlyMinutes(s) / 6) / 10 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

  return (
    <div>
      <PageHeading
        title="PM Schedules"
        subtitle="What repeats, how often, and what it costs the department each month"
      />

      <StatCards items={[
        { label: 'Schedules', value: PM_SCHEDULES.length, note: `${complianceCount} carry a compliance log` },
        { label: 'Monthly load', value: `${Math.round(totalLoad / 60)}h`, note: 'planned preventive work' },
        { label: 'Suite rotation', value: `${SUITE_COUNT}`, note: `every ${CYCLE_DAYS} days · ${SUITE_PM.minutes}m each` },
        { label: 'Due today', value: PM_SCHEDULES.filter((s) => daysUntil(s.next_due) <= 0).length, note: 'on the schedule now' },
      ]} />

      <Toolbar
        search={q}
        onSearch={setQ}
        placeholder="Schedule, scope or owner…"
        filters={[{ label: 'Frequency', value: freq, onChange: setFreq, options: ['Daily', 'Weekly', 'Monthly', 'Quarterly'] }]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} of {PM_SCHEDULES.length}</span>}
      />

      <DataTable columns={columns} rows={rows} pageSize={12} />

      <Section
        title="Where the month goes"
        right={<span style={{ fontSize: 11.5, color: MUTE }}>Hours a month, largest first</span>}
      >
        <HBars data={bars} unit="h" />
        <p style={{ margin: '14px 0 0', fontSize: 11.5, color: MUTE, lineHeight: 1.5 }}>
          Compared per month rather than per visit, because a ten-minute daily round is
          four hours a month and a twenty-minute monthly one is twenty minutes. Ranked
          by how long each takes, they would come out the wrong way round.
        </p>
      </Section>
    </div>
  )
}
