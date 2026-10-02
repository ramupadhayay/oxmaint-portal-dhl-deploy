'use client'

// Incidents.
//
// Short list on purpose. A hotel does not have many of these and should not —
// what matters is that each one is written down at the time, with what was done
// about it, because the ones that turn into a claim turn up months later and
// the file is the whole defence.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, DataTable, Toolbar, Card,
  StatusBadge, PALETTE,
} from '../lib/kit'
import { INCIDENTS, fmtDate, daysUntil } from '../lib/data'

const { ACCENT, INK, SUB, MUTE } = PALETTE

const sevTone = (s) => (s === 'High' ? 'red' : s === 'Medium' ? 'amber' : 'grey')

export default function Incidents() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')

  const rows = useMemo(() => INCIDENTS.filter((i) => {
    if (status !== 'all' && i.status !== status) return false
    if (q && !`${i.incident_number} ${i.title} ${i.category} ${i.location_name}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }).map((i) => ({ ...i, id: i.incident_id })), [q, status])

  const live = INCIDENTS.filter((i) => i.status !== 'Closed')
  const guest = INCIDENTS.filter((i) => i.category === 'Guest safety')

  const columns = [
    { key: 'incident_number', label: 'Number', render: (r) => <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5, color: ACCENT, fontWeight: 700 }}>{r.incident_number}</span> },
    { key: 'title', label: 'What happened', render: (r) => <span style={{ color: INK }}>{r.title}</span> },
    { key: 'category', label: 'Category', render: (r) => <StatusBadge tone={r.category === 'Guest safety' ? 'red' : 'grey'}>{r.category}</StatusBadge> },
    { key: 'location_name', label: 'Where' },
    { key: 'severity', label: 'Severity', render: (r) => <StatusBadge tone={sevTone(r.severity)}>{r.severity}</StatusBadge> },
    { key: 'reported_date', label: 'Reported', render: (r) => fmtDate(r.reported_date), sortValue: (r) => new Date(r.reported_date).getTime() },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge tone={r.status === 'Closed' ? 'green' : r.status === 'Open' ? 'amber' : 'blue'}>{r.status}</StatusBadge> },
  ]

  return (
    <div>
      <PageHeading
        title="Incidents"
        subtitle="Guest safety, staff injury and property damage, with what was done"
      />

      <StatCards items={[
        { label: 'Recorded', value: INCIDENTS.length, note: 'all time' },
        { label: 'Open', value: live.length, tone: live.length ? 'amber' : 'green', note: live.length ? 'still under review' : 'all closed out' },
        { label: 'Guest safety', value: guest.length, tone: guest.length ? 'red' : 'green', note: 'the ones that become claims' },
        { label: 'High severity', value: INCIDENTS.filter((i) => i.severity === 'High').length, note: 'across the record' },
      ]} />

      <Toolbar
        search={q}
        onSearch={setQ}
        placeholder="Number, description, category or area…"
        filters={[{ label: 'Status', value: status, onChange: setStatus, options: ['Open', 'Under review', 'Closed'] }]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} of {INCIDENTS.length}</span>}
      />

      <DataTable columns={columns} rows={rows} pageSize={12} onRowClick={(r) => router.push(`/portal/hospitality/incidents/${r.incident_id}`)} />


      <Card>
        <p style={{ margin: 0, fontSize: 11.5, color: MUTE, lineHeight: 1.55 }}>
          Illustrative records for the demo. A real incident file has statements, photographs
          and dates that matter legally — this shows the shape of the register, not a
          substitute for the property&rsquo;s own reporting process.
        </p>
      </Card>
    </div>
  )
}
