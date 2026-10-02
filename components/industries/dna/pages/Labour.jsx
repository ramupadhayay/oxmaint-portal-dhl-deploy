'use client'

// Inventory > Labour — hours booked against jobs.
//
// Labour sits under Inventory in the product because it is a consumable like any
// other: a job draws down parts and it draws down hours, and both are costed
// against the same work order.
//
// This screen shows the hours and stops there. The workbook has no hourly rate
// for anybody, so labour cost is not derivable — and a costed labour report with
// an invented rate is worse than no report, because the number is exactly the
// kind a finance manager takes away and repeats. The screen says so where the
// cost column would be, rather than leaving a reader to wonder why it is missing.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Section, DataTable, Toolbar, StatusBadge } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, DeptChip, TwoLine, Meter, Note, Bars, Variance } from '../components/cells'
import { useDept } from '../lib/deptStore'
import { users, workOrders, TEAMS, hrs } from '../lib/data'

export default function Labour() {
  const router = useRouter()
  const { scope, deptName } = useDept()
  const [search, setSearch] = useState('')
  const [team, setTeam] = useState('all')

  const roster = useMemo(() => scope(users), [scope])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return roster.filter((u) => (
      (team === 'all' || u.team === team) &&
      (!q || [u.userId, u.name, u.role, u.team].join(' ').toLowerCase().includes(q))
    ))
  }, [roster, search, team])

  const booked = useMemo(() => workOrders.filter((w) => w.actualHrs !== null), [])
  const totalHours = Number(booked.reduce((s, w) => s + w.actualHrs, 0).toFixed(1))
  const estimatedOpen = Number(
    workOrders.filter((w) => w._open).reduce((s, w) => s + (w.aiEstimateHrs || 0), 0).toFixed(1)
  )
  const maxHours = Math.max(1, ...roster.map((u) => u._hoursLogged))

  // Hours by the kind of work they went into — the split a manager reads to see
  // whether the schedule is holding.
  const byType = useMemo(() => {
    const m = new Map()
    booked.forEach((w) => m.set(w.type, (m.get(w.type) || 0) + w.actualHrs))
    return [...m.entries()].map(([name, value]) => ({ name, value: Number(value.toFixed(1)) })).sort((a, b) => b.value - a.value)
  }, [booked])

  return (
    <div>
      <PageHeading
        title="Labour"
        subtitle={`Hours booked against completed jobs, by technician and by work type. ${deptName}.`}
      />

      <StatCards items={[
        { label: 'Hours booked', value: hrs(totalHours), note: `across ${booked.length} completed jobs`, icon: 'clock' },
        { label: 'People with hours', value: roster.filter((u) => u._hoursLogged > 0).length, note: `of ${roster.length} on the roster`, icon: 'people' },
        { label: 'Open work estimated', value: hrs(estimatedOpen), note: 'Still to be done' },
        { label: 'Average job', value: booked.length ? hrs(totalHours / booked.length) : '—', note: 'Actual, completed only' },
        { label: 'Labour cost', value: 'Not costed', tone: 'warning', note: 'No hourly rate in the source' },
      ]} />

      <Note tone="warn">
        <b>No cost column.</b> The workbook gives every technician a role, a shift and a skill
        list, but no hourly rate — so hours are real and money is not derivable. A costed labour
        report built on a made-up rate is the kind of figure that gets quoted back later, which
        is why there is none here.
      </Note>

      <Section title="Hours by technician">
        <Toolbar
          search={search} onSearch={setSearch}
          placeholder="Search name, role or team…"
          filters={[{ label: 'Team', value: team, onChange: setTeam, options: TEAMS }]}
        />

        <DataTable
          rows={rows}
          pageSize={12}
          empty="Nobody matches these filters."
          columns={[
            { key: 'userId', label: 'ID', width: 76, render: (u) => <Ref>{u.userId}</Ref> },
            { key: 'name', label: 'Technician', width: 178, render: (u) => <TwoLine top={u.name} bottom={u.role} /> },
            { key: 'department', label: 'Dept', width: 76, render: (u) => <DeptChip code={u.department} name={u._departmentName} /> },
            { key: 'team', label: 'Team', width: 178 },
            {
              key: '_hoursLogged', label: 'Hours booked', width: 150, align: 'right',
              render: (u) => (
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{hrs(u._hoursLogged)}</div>
                  <div style={{ marginTop: 4 }}>
                    <Meter value={u._hoursLogged} max={maxHours} tone={u._hoursLogged ? '#15227a' : '#cbd5e1'} height={5} />
                  </div>
                </div>
              ),
            },
            {
              key: '_completed', label: 'Jobs done', width: 96, align: 'right',
              render: (u) => <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{u._completed}</span>,
            },
            {
              key: '_open', label: 'Still open', width: 116, align: 'right',
              render: (u) => (u._open
                ? <span style={{ fontSize: 12 }}>{u._open} · {hrs(u._openHours)}</span>
                : <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>),
            },
          ]}
        />
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14 }}>
        <Section title="Hours by work type">
          <Bars data={byType} unit=" h" />
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 10, lineHeight: 1.55 }}>
            Actual hours on completed jobs only. Open work is estimated, not booked, and is kept
            out so the two are never added together.
          </p>
        </Section>

        <Section title="Booked against estimated" right={<span style={{ fontSize: 11.5, color: '#94a3b8' }}>completed jobs</span>}>
          <DataTable
            rows={booked}
            pageSize={8}
            onRowClick={(w) => router.push(`/portal/dna/work-orders/${w.woNo}`)}
            empty=""
            columns={[
              { key: 'woNo', label: 'WO', width: 92, render: (w) => <Ref>{w.woNo}</Ref> },
              { key: 'assignedTo', label: 'By', width: 132 },
              { key: 'aiEstimateHrs', label: 'Est.', width: 72, align: 'right', render: (w) => <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{hrs(w.aiEstimateHrs)}</span> },
              { key: 'actualHrs', label: 'Booked', width: 80, align: 'right', render: (w) => <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 700 }}>{hrs(w.actualHrs)}</span> },
              { key: '_variance', label: 'Variance', width: 92, align: 'right', render: (w) => <Variance hours={w._variance} /> },
            ]}
          />
        </Section>
      </div>
    </div>
  )
}
