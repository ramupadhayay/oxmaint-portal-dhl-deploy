'use client'

// Requests — where a hotel's work actually starts.
//
// In a plant a request comes from an operator and joins a queue. Here it comes
// from the front desk with a guest standing there, or from housekeeping finding
// something while turning a room, and those are not the same urgency. The
// source column is the one that matters, so it is the one the screen sorts and
// colours by.
//
// Converting a request raises a work order and records the link. That is the
// whole triage loop, and it is the reason this screen is not just a list.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, DataTable, Toolbar, StatusBadge, Priority, ActionButton, PALETTE,
} from '../lib/kit'
import { useRecords } from '../lib/store'
import { REQUESTS, USER, fmtDate, daysUntil } from '../lib/data'

const { ACCENT, INK, SUB, MUTE, RED } = PALETTE

const idOf = (r) => r.request_id || r.recordId
const isGuest = (r) => String(r.source).startsWith('Front desk')

export default function Requests() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [source, setSource] = useState('all')

  const merged = useRecords('hosp_request', REQUESTS, idOf)

  const rows = useMemo(() => merged.filter((r) => {
    if (status !== 'all' && r.status !== status) return false
    if (source !== 'all' && r.source !== source) return false
    if (q && !`${r.request_number} ${r.title} ${r.source} ${r.suite_number || ''}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }).map((r) => ({ ...r, id: idOf(r) })), [merged, q, status, source])


  const waiting = merged.filter((r) => r.status === 'Open')
  const guestWaiting = waiting.filter(isGuest)

  const columns = [
    { key: 'request_number', label: 'Number', render: (r) => <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5, color: ACCENT, fontWeight: 700 }}>{r.request_number}</span> },
    { key: 'title', label: 'Reported', render: (r) => <span style={{ color: INK }}>{r.title}</span> },
    {
      key: 'source',
      label: 'Source',
      render: (r) => <StatusBadge tone={isGuest(r) ? 'red' : 'grey'}>{r.source}</StatusBadge>,
    },
    { key: 'suite_number', label: 'Suite', align: 'center', render: (r) => r.suite_number || '—' },
    { key: 'priority', label: 'Priority', render: (r) => <Priority value={r.priority} /> },
    { key: 'raised_date', label: 'Raised', render: (r) => fmtDate(r.raised_date), sortValue: (r) => new Date(r.raised_date).getTime() },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge tone={r.status === 'Converted' ? 'green' : r.status === 'Open' ? 'amber' : 'grey'}>{r.status}</StatusBadge> },
  ]

  return (
    <div>
      <PageHeading
        title="Requests"
        subtitle="What the front desk and housekeeping send through, before it is a work order"
        right={(
          <ActionButton
            onClick={() => router.push('/portal/hospitality/requests/new')}
            icon={(
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            )}
          >New request</ActionButton>
        )}
      />

      <StatCards items={[
        { label: 'Waiting', value: waiting.length, tone: waiting.length ? 'amber' : 'green', note: 'not yet triaged' },
        { label: 'Guest waiting', value: guestWaiting.length, tone: guestWaiting.length ? 'red' : 'green', note: 'someone is in the building' },
        { label: 'Converted', value: merged.filter((r) => r.status === 'Converted').length, note: 'became work orders' },
        { label: 'Total raised', value: merged.length, note: 'all sources' },
      ]} />

      <Toolbar
        search={q}
        onSearch={setQ}
        placeholder="Number, report, suite or source…"
        filters={[
          { label: 'Status', value: status, onChange: setStatus, options: ['Open', 'Converted', 'Closed', 'Rejected'] },
          { label: 'Source', value: source, onChange: setSource, options: [...new Set(merged.map((r) => r.source))] },
        ]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} of {merged.length}</span>}
      />

      <DataTable columns={columns} rows={rows} pageSize={13} onRowClick={(r) => router.push(`/portal/hospitality/requests/${idOf(r)}`)} />

    </div>
  )
}
