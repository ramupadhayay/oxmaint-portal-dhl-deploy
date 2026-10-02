'use client'

// Inspections — the ones somebody outside the department signs.
//
// Distinct from the suite PM on purpose. A suite PM is the department checking
// its own work; these are the brand, the fire marshal, the health department
// and the elevator inspector checking it for them, and missing one closes a
// pool or fails an audit rather than annoying a guest.
//
// Sorted by what is soonest, because that is the only order that answers the
// question anybody opens this screen with.

import { useMemo } from 'react'
import {
  PageHeading, StatCards, DataTable, Section, Card, StatusBadge, PALETTE,
} from '../lib/kit'
import { INSPECTIONS, fmtDate, daysUntil } from '../lib/data'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, AMBER, RED } = PALETTE

const dueTone = (d) => (d < 0 ? 'red' : d <= 30 ? 'amber' : d <= 90 ? 'blue' : 'grey')

export default function Inspections() {
  const rows = useMemo(() => [...INSPECTIONS]
    .map((x) => ({ ...x, id: x.inspection_id, due_in: daysUntil(x.next_date) }))
    .sort((a, b) => a.due_in - b.due_in), [])

  const overdue = rows.filter((r) => r.due_in < 0)
  const soon = rows.filter((r) => r.due_in >= 0 && r.due_in <= 90)
  const findings = rows.reduce((n, r) => n + r.findings, 0)

  const columns = [
    { key: 'name', label: 'Inspection', render: (r) => <strong style={{ color: INK }}>{r.name}</strong> },
    { key: 'inspector', label: 'Signed by', render: (r) => <span style={{ color: SUB }}>{r.inspector}</span> },
    { key: 'frequency', label: 'Frequency', render: (r) => <StatusBadge tone="grey">{r.frequency}</StatusBadge> },
    { key: 'last_date', label: 'Last', render: (r) => fmtDate(r.last_date), sortValue: (r) => new Date(r.last_date).getTime() },
    {
      key: 'result',
      label: 'Result',
      render: (r) => <StatusBadge tone={r.result === 'Pass' ? 'green' : r.result === 'Fail' ? 'red' : 'amber'}>{r.result}</StatusBadge>,
    },
    { key: 'findings', label: 'Findings', align: 'center', render: (r) => (r.findings ? <span style={{ color: '#b45309', fontWeight: 700 }}>{r.findings}</span> : '—') },
    {
      key: 'due_in',
      label: 'Next due',
      render: (r) => (
        <StatusBadge tone={dueTone(r.due_in)}>
          {r.due_in < 0 ? `${-r.due_in} days late` : r.due_in === 0 ? 'today' : `${r.due_in} days`}
        </StatusBadge>
      ),
    },
  ]

  return (
    <div>
      <PageHeading
        title="Inspections"
        subtitle="Brand, fire, health and the certificates the property runs on"
      />

      <StatCards items={[
        { label: 'Tracked', value: rows.length, note: 'external inspections' },
        { label: 'Overdue', value: overdue.length, tone: overdue.length ? 'red' : 'green', note: overdue.length ? 'past their date' : 'all current' },
        { label: 'Due in 90 days', value: soon.length, tone: soon.length ? 'amber' : undefined, note: 'worth preparing for' },
        { label: 'Open findings', value: findings, tone: findings ? 'amber' : 'green', note: 'from the last round' },
      ]} />

      {rows.filter((r) => r.due_in <= 60).length > 0 && (
        <Section
          title="Coming up"
          right={<span style={{ fontSize: 11.5, color: MUTE }}>The next sixty days</span>}
        >
          {rows.filter((r) => r.due_in <= 60).map((r) => (
            <div key={r.inspection_id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 2px',
              borderBottom: `1px solid ${LINE}`, flexWrap: 'wrap',
            }}>
              <span style={{ flex: '1 1 240px', minWidth: 0, fontSize: 13, fontWeight: 600, color: INK }}>{r.name}</span>
              <span style={{ fontSize: 11.5, color: MUTE }}>{r.inspector}</span>
              <StatusBadge tone={dueTone(r.due_in)}>
                {r.due_in < 0 ? `${-r.due_in} days late` : fmtDate(r.next_date)}
              </StatusBadge>
            </div>
          ))}
        </Section>
      )}

      <DataTable columns={columns} rows={rows} pageSize={12} />

      <Card>
        <p style={{ margin: 0, fontSize: 11.5, color: MUTE, lineHeight: 1.55 }}>
          The bodies and frequencies here are the ones a select-service extended-stay
          property is generally subject to. A specific property&rsquo;s obligations come from
          its own permits and its brand agreement, and should be confirmed against those
          rather than taken from this list.
        </p>
      </Card>
    </div>
  )
}
