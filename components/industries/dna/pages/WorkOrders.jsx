'use client'

// The work order backlog — the customer's first stated interest.
//
// One table, every status. The alternative, a screen per status, is how a
// backlog stops being a backlog: a supervisor wants the whole queue sorted by
// what is late, not four tabs they have to add up themselves.
//
// Overdue is computed against live work only. A completed job that ran past its
// date was late once; counting it now would make the overdue figure larger than
// the open backlog, which is the kind of number that gets noticed in a demo and
// undermines every other one on the screen.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Section, DataTable, Toolbar, StatusBadge, Priority, ActionButton } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, DeptChip, TwoLine, DueDate, Variance, Note, Bars } from '../components/cells'
import { useDept } from '../lib/deptStore'
import { useWorkOrderStore } from '../lib/store'
import AddWorkOrderModal from '../components/AddWorkOrderModal'
import { workOrders, WO_STATUSES, WO_TYPES, WO_PRIORITIES, hrs, assets, locName, daysUntil, OPEN_STATUSES } from '../lib/data'

export default function WorkOrders() {
  const router = useRouter()
  const { scope, deptName } = useDept()
  const { created, create } = useWorkOrderStore()
  const [raising, setRaising] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [type, setType] = useState('all')
  const [priority, setPriority] = useState('all')

  // Jobs raised in the portal, given the derived fields the workbook rows carry
  // so every column, filter and count below works on them without a special
  // case. Nothing is zero-filled: a job raised a minute ago genuinely has no
  // actual duration, and `_variance` stays null so the AI screen's sample size
  // does not quietly grow by one.
  const addedRows = useMemo(() => created.map((w) => {
    const asset = assets.find((a) => a.assetId === w.assetId) || null
    const days = daysUntil(w.dueDate)
    return {
      ...w,
      _asset: asset,
      _assetName: asset?.name || w.assetId,
      _locationName: locName(w.locationCode),
      _assignee: null,
      _open: OPEN_STATUSES.includes(w.status),
      _daysToDue: days,
      _overdue: OPEN_STATUSES.includes(w.status) && days !== null && days < 0,
      _variance: null,
    }
  }), [created])

  const all = useMemo(() => scope([...addedRows, ...workOrders]), [scope, addedRows])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((w) => (
      (status === 'all' || w.status === status) &&
      (type === 'all' || w.type === type) &&
      (priority === 'all' || w.priority === priority) &&
      (!q || [w.woNo, w.title, w._assetName, w.assetId, w.assignedTo, w.requestedBy, w.description]
        .join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, status, type, priority])

  const open = all.filter((w) => w._open)
  const overdue = all.filter((w) => w._overdue)
  const unassigned = open.filter((w) => w.assignedTo === 'Unassigned')
  const openHours = open.reduce((s, w) => s + (w.aiEstimateHrs || 0), 0)

  const byType = WO_TYPES.map((t) => ({ name: t, value: all.filter((w) => w.type === t).length }))
    .sort((a, b) => b.value - a.value)

  return (
    <div>
      <PageHeading
        title="Work Orders"
        subtitle={`Every job across the plant — corrective, preventive, inspection and emergency — with the AI duration estimate against what it actually took. ${deptName}.`}
        right={<ActionButton onClick={() => setRaising(true)}>Raise work order</ActionButton>}
      />

      <AddWorkOrderModal
        open={raising}
        onClose={() => setRaising(false)}
        onCreate={create}
        created={created}
      />

      <StatCards items={[
        { label: 'Total work orders', value: all.length, note: `${all.filter((w) => w.status === 'Completed').length} completed`, icon: 'wrench' },
        { label: 'Open', value: open.length, note: `${hrs(openHours)} estimated`, icon: 'clock' },
        { label: 'Overdue', value: overdue.length, tone: overdue.length ? 'destructive' : 'success', note: overdue.length ? overdue.map((w) => w.woNo).join(', ') : 'None past its date' },
        { label: 'Unassigned', value: unassigned.length, tone: unassigned.length ? 'warning' : 'success', note: 'Waiting on a planner' },
        { label: 'Critical & high', value: all.filter((w) => ['Critical', 'High'].includes(w.priority) && w._open).length, tone: 'warning', note: 'Open only' },
      ]} />

      <Section title="Backlog">
        <Toolbar
          search={search} onSearch={setSearch}
          placeholder="Search job, asset, requester or description…"
          filters={[
            { label: 'Status', value: status, onChange: setStatus, options: WO_STATUSES },
            { label: 'Type', value: type, onChange: setType, options: WO_TYPES },
            { label: 'Priority', value: priority, onChange: setPriority, options: WO_PRIORITIES },
          ]}
        />

        <DataTable
          rows={rows}
          pageSize={15}
          onRowClick={(w) => router.push(`/portal/dna/work-orders/${w.woNo}`)}
          empty="No work orders match these filters."
          columns={[
            { key: 'woNo', label: 'WO', width: 96, render: (w) => <Ref>{w.woNo}</Ref> },
            { key: 'title', label: 'Job', render: (w) => <TwoLine top={w.title} bottom={`${w._assetName} · ${w.assetId}`} /> },
            { key: 'locationCode', label: 'Dept', width: 76, render: (w) => <DeptChip code={w.locationCode} name={w._locationName} /> },
            { key: 'type', label: 'Type', width: 108 },
            { key: 'priority', label: 'Priority', width: 100, render: (w) => <Priority value={w.priority} /> },
            {
              key: 'dueDate', label: 'Due', width: 118,
              sortValue: (w) => w._daysToDue ?? 9999,
              render: (w) => <DueDate value={w.dueDate} days={w._daysToDue} done={!w._open} />,
            },
            {
              key: 'assignedTo', label: 'Assigned', width: 130,
              render: (w) => (w.assignedTo === 'Unassigned'
                ? <span style={{ color: '#b45309', fontWeight: 700, fontSize: 11.5 }}>Unassigned</span>
                : <span style={{ fontSize: 12 }}>{w.assignedTo}</span>),
            },
            {
              key: 'aiEstimateHrs', label: 'AI est.', width: 84, align: 'right',
              render: (w) => <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{w.aiEstimateHrs !== null ? `${w.aiEstimateHrs.toFixed(1)} h` : '—'}</span>,
            },
            {
              key: '_variance', label: 'vs actual', width: 96, align: 'right',
              sortValue: (w) => (w._variance === null ? 9999 : Math.abs(w._variance)),
              render: (w) => <Variance hours={w._variance} />,
            },
            { key: 'status', label: 'Status', width: 112, render: (w) => <StatusBadge>{w.status}</StatusBadge> },
          ]}
        />
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
        <Section title="By type">
          <Bars data={byType} />
        </Section>
        <Section title="By status">
          <Bars
            data={WO_STATUSES.map((s) => ({ name: s, value: all.filter((w) => w.status === s).length })).sort((a, b) => b.value - a.value)}
            colors={['#047857', '#15227a', '#b45309', '#64748b']}
          />
        </Section>
      </div>

      <Note tone="grey">
        Every job here names a real asset in the register — the workbook has no dangling
        references, so any work order can be followed through to the machine and the parts
        that fit it.
      </Note>
    </div>
  )
}
