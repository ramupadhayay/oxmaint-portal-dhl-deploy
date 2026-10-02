'use client'

// Work orders — the maintenance view of the same records.
//
// A HEPA integrity test is not only a compliance record; it is a job somebody
// was dispatched to do, against an order number that already exists in SAP. So
// this screen is the register a planner works from, built from the client's own
// PM01/PM02/PM04 orders rather than from a second set invented for it.
//
// One thing is derived and marked: SAP hands over the order and its type but
// not whether it is finished, so the status is read from the certification
// record the job produced — locked and audit-ready means done. That is the only
// honest way to close a work order here, and the column says where it came from.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, DataTable, Toolbar, Section, Donut, Priority, PALETTE,
} from '../lib/kit'
import {
  WORK_ORDERS, CLEANROOMS, filterById, workOrderStatus, workOrderPriority,
} from '../lib/data'

import { useDocuments } from '../lib/lifecycle'
import { useCreatedOrders } from '../lib/ops'
import { DateCell, DueIn, Status, Id, Derived } from '../lib/ui'
import { Action, Glyph } from '../lib/productKit'
import WorkOrderSummary, { WO_CARDS } from '../components/WorkOrderSummary'

const { INK, SUB, MUTE, LINE } = PALETTE

const ORDER_CLASS = {
  PM01: 'Corrective — raised against a fault',
  PM02: 'Replacement — filter change with validation',
  PM04: 'Preventive — scheduled test or check',
}

export default function WorkOrders() {
  const router = useRouter()
  // Live, so a record signed on Approvals closes its work order here without a
  // reload — the two screens are the same rows read two ways.
  const documents = useDocuments()
  // Orders raised in this portal, merged in beside the imported ones. Marked
  // rather than blended: a row that has not been to SAP should not look like
  // one that came from it.
  const created = useCreatedOrders()

  const [q, setQ] = useState('')
  const [cls, setCls] = useState('all')
  const [state, setState] = useState('all')
  const [room, setRoom] = useState('all')
  const [tab, setTab] = useState('all')
  const [cut, setCut] = useState('total')

  const all = useMemo(() => [
    ...created.map((w) => ({
      ...w,
      id: w.recordId,
      // An order raised here carries its own status; it has no certification
      // record behind it yet to read one from.
      status: w.status || 'Open',
      priority: w.priority || 'Medium',
      stage: null,
    })),
    ...WORK_ORDERS.map((w) => {
      const doc = documents.find((d) => d.documentRef === w.documentRef) || null
      const f = filterById(w.filterId)
      return {
        ...w,
        id: w.workOrderId,
        status: workOrderStatus(doc),
        priority: workOrderPriority(f),
        stage: doc?.stage || null,
      }
    }),
  ], [documents, created])

  // The tab strip the product puts over the list, and the card cut above it.
  // They narrow independently: a reader can be on Overdue and still click
  // Critical, which is how somebody finds the one order that is both.
  const TABS = [
    ['all', 'All', () => true],
    ['open', 'Open', (w) => w.status === 'Open'],
    ['inprogress', 'In Progress', (w) => w.status === 'In Progress'],
    ['completed', 'Completed', (w) => w.status === 'Completed'],
    ['overdue', 'Overdue', (w) => w.status !== 'Completed' && (w.dueIn ?? 0) < 0],
    ['approvals', 'Approvals', (w) => w.status === 'Pending Approval'],
  ]

  const rows = useMemo(() => all.filter((w) => {
    if (cls !== 'all' && w.orderClass !== cls) return false
    if (state !== 'all' && w.status !== state) return false
    if (room !== 'all' && w.cleanroomId !== room) return false
    if (!(TABS.find(([k]) => k === tab) || TABS[0])[2](w)) return false
    if (!(WO_CARDS.find((c) => c.id === cut) || WO_CARDS[0]).keep(w)) return false
    if (q) {
      const hay = `${w.workOrderId} ${w.filterId} ${w.sapEquipmentId} ${w.cleanroomName} ${w.workOrderType} ${w.technicianName || ''}`
      if (!hay.toLowerCase().includes(q.toLowerCase())) return false
    }
    return true
  }), [all, q, cls, state, room, tab, cut])

  const byStatus = ['Open', 'In Progress', 'Pending Approval', 'Completed', 'Reopened']
    .map((name) => ({ name, value: all.filter((w) => w.status === name).length }))
    .filter((s) => s.value)

  const open = all.filter((w) => w.status !== 'Completed').length
  const critical = all.filter((w) => w.priority === 'Critical').length
  const overdue = all.filter((w) => w.status !== 'Completed' && (w.dueIn ?? 0) < 0).length

  const columns = [
    {
      key: 'workOrderId',
      label: 'Order',
      render: (r) => (
        <span style={{ lineHeight: 1.35 }}>
          <Id strong>{r.workOrderId}</Id>
          {r.raisedHere && <span style={{ display: 'block', fontSize: 9.5, fontWeight: 700, color: '#6d28d9' }}>RAISED HERE</span>}
        </span>
      ),
    },
    {
      key: 'workOrderType',
      label: 'Type',
      render: (r) => (
        <span style={{ lineHeight: 1.35 }}>
          <span style={styles.cls}>{r.orderClass}</span>
          <span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>
            {String(r.workOrderType).replace(/^PM\d+ - /, '')}
          </span>
        </span>
      ),
    },
    { key: 'filterId', label: 'Asset', render: (r) => <span><Id strong>{r.filterId}</Id><span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{r.cleanroomName} · {r.isoClass}</span></span> },
    { key: 'priority', label: 'Priority', render: (r) => <Priority value={r.priority} />, sortValue: (r) => ({ Critical: 0, High: 1, Medium: 2, Low: 3 }[r.priority]) },
    { key: 'status', label: 'Status', render: (r) => <Status>{r.status}</Status> },
    { key: 'technicianName', label: 'Technician', render: (r) => (r.technicianName ? <span>{r.technicianName}<span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{r.technicianId}</span></span> : <span style={{ color: MUTE }}>unassigned</span>) },
    { key: 'raisedOn', label: 'Raised', render: (r) => <DateCell shifted={r.raisedOn} original={r.raisedOnWorkbook} /> },
    { key: 'dueIn', label: 'Due', render: (r) => <DueIn days={r.dueIn} />, sortValue: (r) => r.dueIn ?? 9999 },
    { key: 'documentRef', label: 'Certification', render: (r) => <Id>{r.documentRef}</Id> },
  ]

  return (
    <div>
      <PageHeading
        title="Work Orders"
        subtitle="Manage and track maintenance work orders across your organization"
        right={(
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Action icon="refresh" onClick={() => { setQ(''); setCls('all'); setState('all'); setRoom('all'); setTab('all'); setCut('total') }}>
              Refresh
            </Action>
            <Action icon="zap" onClick={() => router.push('/portal/hepa/work-orders/new?quick=1')}>Quick WO</Action>
            <Action icon="plus" primary onClick={() => router.push('/portal/hepa/work-orders/new')}>
              Create Work Order
            </Action>
          </div>
        )}
      />

      <WorkOrderSummary orders={all} cut={cut} onCut={setCut} />

      {/* The product's tab strip. Counts on the tab, because a tab that reads
          zero is one nobody needs to click. */}
      <div style={styles.tabRow}>
        {TABS.map(([key, label, keep]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ ...styles.tab, ...(tab === key ? styles.tabOn : null) }}>
            {label}
            <span style={styles.tabCount}>{all.filter(keep).length}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14, marginBottom: 14 }}>
        <Section title="By status" right={<Derived />} style={{ marginBottom: 0 }}>
          <Donut data={byStatus} colors={['#d97706', '#2563eb', '#7c3aed', '#16a34a', '#dc2626']} />
          <p style={styles.foot}>
            SAP supplies the order and its type; it does not say whether the job
            is finished. Status here is read from the certification record the
            job produced — <strong style={{ color: INK }}>Completed</strong> means
            that record is locked and audit-ready.
          </p>
        </Section>

        <Section title="Order types" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(ORDER_CLASS).map(([code, what]) => {
              const n = all.filter((w) => w.orderClass === code).length
              return (
                <div key={code} style={styles.classRow}>
                  <span style={styles.cls}>{code}</span>
                  <span style={{ fontSize: 12, color: SUB, flex: 1, minWidth: 0 }}>{what}</span>
                  <strong style={{ fontSize: 13, color: INK }}>{n}</strong>
                </div>
              )
            })}
          </div>
          <p style={styles.foot}>
            The client&apos;s own SAP order classes, carried through unchanged. A
            preventive order is the scheduled test; a corrective one was raised
            because something was found.
          </p>
        </Section>
      </div>

      <Toolbar
        search={q}
        onSearch={setQ}
        placeholder="Order number, filter, equipment id, technician…"
        filters={[
          { label: 'Class', value: cls, onChange: setCls, options: Object.keys(ORDER_CLASS) },
          { label: 'Status', value: state, onChange: setState, options: byStatus.map((s) => s.name) },
          { label: 'Cleanroom', value: room, onChange: setRoom, options: CLEANROOMS.map((c) => c.cleanroomId) },
        ]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} of {all.length}</span>}
      />

      <DataTable
        columns={columns}
        rows={rows}
        pageSize={14}
        empty="No work order matches these filters."
        onRowClick={(r) => router.push(`/portal/hepa/work-orders/${r.workOrderId}`)}
      />

      <p style={{ fontSize: 11.5, color: MUTE, margin: '12px 2px 0', paddingTop: 12, borderTop: `1px solid ${LINE}`, lineHeight: 1.55 }}>
        Priority is derived too: a filter that failed its integrity test is
        Critical, one carrying a pressure breach or past its certification date
        is High. Nothing on this screen sets a priority field by hand.
      </p>
    </div>
  )
}

const styles = {
  tabRow: {
    display: 'flex', gap: 0, marginBottom: 14, padding: 3, borderRadius: 10,
    background: '#f1f5f9', width: 'fit-content', flexWrap: 'wrap',
  },
  tab: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 15px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
    border: 'none', borderRadius: 8, background: 'transparent', color: '#64748b',
  },
  tabOn: { background: '#fff', color: '#15227a', boxShadow: '0 1px 2px rgba(15,23,42,.08)' },
  tabCount: {
    fontSize: 10.5, fontWeight: 800, padding: '1px 7px', borderRadius: 999,
    background: '#e2e8f0', color: '#475569', fontVariantNumeric: 'tabular-nums',
  },
  raise: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', border: 'none',
    borderRadius: 9, background: '#15227a', color: '#fff', cursor: 'pointer',
  },
  cls: {
    display: 'inline-block', fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3,
    color: '#15227a', background: '#eef2ff', borderStyle: 'solid', borderWidth: 1, borderColor: '#c7d2fe',
    borderRadius: 6, padding: '1px 7px', whiteSpace: 'nowrap',
  },
  classRow: {
    display: 'flex', alignItems: 'center', gap: 11,
    padding: '9px 12px', borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 9, background: '#fcfdfe',
  },
  foot: {
    margin: '13px 0 0', paddingTop: 11, borderTop: `1px solid ${LINE}`,
    fontSize: 11.5, color: MUTE, lineHeight: 1.55,
  },
}
