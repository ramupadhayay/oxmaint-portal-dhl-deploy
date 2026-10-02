'use client'

// Work orders — the reactive half of the department's day.
//
// Closeable rather than read-only. A backlog you can only look at is a report;
// the point of the schedule upstairs is that the jobs on it come off it, and
// that has to be true here too. Status changes are stored records keyed by the
// seeded work order's own id, so a seeded job can be closed without copying the
// whole property into the database first.

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, DataTable, Toolbar, StatusBadge, Priority, ActionButton, PALETTE,
} from '../lib/kit'
import { useRecords, useStore } from '../lib/store'
import { WORK_ORDERS, OPEN_STATUS, USER, fmtDate, isPast, daysUntil, money } from '../lib/data'

const { ACCENT, INK, SUB, MUTE, RED } = PALETTE

const idOf = (w) => w.workorder_id || w.recordId

export default function WorkOrders() {
  const router = useRouter()
  const store = useStore()
  const update = store?.update
  const ready = Boolean(store?.ready)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState('all')

  const merged = useRecords('hosp_work_order', WORK_ORDERS, idOf)

  const rows = useMemo(() => merged.filter((w) => {
    if (status !== 'all' && w.status !== status) return false
    if (priority !== 'all' && w.priority !== priority) return false
    if (q && !`${w.work_order_number} ${w.title} ${w.asset_name} ${w.assigned_to_name}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }).map((w) => ({ ...w, id: idOf(w) })), [merged, q, status, priority])


  const live = merged.filter((w) => OPEN_STATUS.includes(w.status))
  const overdue = live.filter((w) => isPast(w.due_date))

  // Closing writes the seeded id, so the merge replaces the seeded row rather
  // than adding a second one beside it.
  const setStatusOf = useCallback((w, next) => {
    if (!ready || !update) return
    update('hosp_work_order', idOf(w), {
      recordId: idOf(w),
      status: next,
      completed_date: next === 'Completed' ? new Date().toISOString() : null,
      closed_by: USER.name,
    })
  }, [ready, update])

  const columns = [
    { key: 'work_order_number', label: 'Number', render: (r) => <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5, color: ACCENT, fontWeight: 700 }}>{r.work_order_number}</span> },
    { key: 'title', label: 'Job', render: (r) => <span style={{ color: INK }}>{r.title}</span> },
    { key: 'asset_name', label: 'Asset', render: (r) => <span style={{ color: SUB }}>{r.asset_name}</span> },
    { key: 'priority', label: 'Priority', render: (r) => <Priority value={r.priority} /> },
    { key: 'assigned_to_name', label: 'Assigned' },
    {
      key: 'due_date',
      label: 'Due',
      sortValue: (r) => new Date(r.due_date).getTime(),
      render: (r) => {
        const late = OPEN_STATUS.includes(r.status) && isPast(r.due_date)
        return <span style={{ color: late ? RED : SUB, fontWeight: late ? 700 : 500 }}>{fmtDate(r.due_date)}</span>
      },
    },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge>{r.status}</StatusBadge> },
  ]

  return (
    <div>
      <PageHeading
        title="Work Orders"
        subtitle="Guest requests, breakdowns and the jobs the rotation raises"
        right={(
          <ActionButton
            onClick={() => router.push('/portal/hospitality/work-orders/new')}
            icon={(
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            )}
          >New work order</ActionButton>
        )}
      />

      <StatCards items={[
        { label: 'Open', value: live.length, note: `${merged.length} raised in total` },
        { label: 'Overdue', value: overdue.length, tone: overdue.length ? 'red' : 'green', note: overdue.length ? 'past their due date' : 'nothing late' },
        { label: 'Critical', value: live.filter((w) => w.priority === 'Critical').length, tone: 'red', note: 'open and critical' },
        { label: 'Due this week', value: live.filter((w) => daysUntil(w.due_date) >= 0 && daysUntil(w.due_date) <= 7).length, note: 'next seven days' },
      ]} />

      <Toolbar
        search={q}
        onSearch={setQ}
        placeholder="Number, job, asset or person…"
        filters={[
          { label: 'Status', value: status, onChange: setStatus, options: ['Open', 'In Progress', 'On Hold', 'Completed', 'Cancelled'] },
          { label: 'Priority', value: priority, onChange: setPriority, options: ['Critical', 'High', 'Medium', 'Low'] },
        ]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} of {merged.length}</span>}
      />

      <DataTable columns={columns} rows={rows} pageSize={13} onRowClick={(r) => router.push(`/portal/hospitality/work-orders/${idOf(r)}`)} />

    </div>
  )
}
