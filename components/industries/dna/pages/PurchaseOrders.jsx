'use client'

// Purchasing > Purchase Orders — the procurement side of parts inventory.
//
// Fifteen orders across the whole lifecycle, Draft through Received, and the
// point of the screen is not the list: it is that every order says what it was
// raised for, and those references resolve. An order for a VFD drive opens onto
// the loom fault it is spare stock for; an igniter kit onto the annual
// calibration that consumes it.
//
// The two panels above the table are the ones a stores controller actually acts
// on. A shortage with an order already placed is a different problem from a
// shortage nobody has raised anything for, and on this dataset the difference is
// live: the loom reed has an order sitting in Draft, and the FR finish chemical
// — feeding a range with an open critical fault — has nothing on order at all.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Section, DataTable, Toolbar, StatusBadge, ActionButton } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, TwoLine, DueDate, Note, Bars, Fact, Meter } from '../components/cells'
import { useDept } from '../lib/deptStore'
import { usePurchaseOrderStore } from '../lib/store'
import AddPurchaseOrderModal from '../components/AddPurchaseOrderModal'
import {
  purchaseOrders as sourceOrders, PO_STATUSES, PO_OPEN_STATUSES,
  partsBelowReorder, derivePurchaseOrder, money, fmtDate,
} from '../lib/data'

// Draft and Pending Approval are the two a planner can unblock today; the rest
// are waiting on somebody else.
const STATUS_TONE = {
  Draft: 'grey',
  'Pending Approval': 'amber',
  Approved: 'blue',
  Ordered: 'blue',
  'Partially Received': 'amber',
  Received: 'green',
  Cancelled: 'grey',
}

export default function PurchaseOrders() {
  const router = useRouter()
  const { deptName } = useDept()
  const { created, create } = usePurchaseOrderStore()
  const [raising, setRaising] = useState(false)
  // The part a "Raise order" button on a shortage card opens the form with.
  const [seedPart, setSeedPart] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [vendor, setVendor] = useState('all')

  // Orders raised in the portal, given the same derived fields the workbook rows
  // carry — through the same function, so the two cannot drift. Dates are not
  // shifted: an order raised in a meeting is already dated today, and anchoring
  // it the way a workbook row is anchored would file a new order in the past.
  const addedRows = useMemo(
    () => created.map((po) => derivePurchaseOrder(po, { shiftDates: false })),
    [created]
  )

  // Everything below reads this rather than the import, so a new order counts
  // towards committed spend, closes a shortage and appears in the charts without
  // any of them needing to know it was not in the workbook.
  const all = useMemo(() => [...addedRows, ...sourceOrders], [addedRows])

  const openOrders = all.filter((p) => p._open)
  const lateOrders = all.filter((p) => p._late)
  const committed = Number(openOrders.reduce((s, p) => s + (p.totalCost || 0), 0).toFixed(2))

  const vendors = [...new Set(all.map((p) => p.vendor))].filter(Boolean).sort()
  const statuses = [...new Set([...PO_STATUSES, ...PO_OPEN_STATUSES])]

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((p) => (
      (status === 'all' || p.status === status) &&
      (vendor === 'all' || p.vendor === vendor) &&
      (!q || [p.poNo, p.partNo, p.partName, p.vendor, p.requestedBy, p.linkedTo].join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, status, vendor])

  const awaitingApproval = all.filter((p) => p.status === 'Draft' || p.status === 'Pending Approval')
  const received = all.filter((p) => p.status === 'Received')
  const receivedValue = received.reduce((s, p) => s + (p.totalCost || 0), 0)

  // The two states a shortage can be in. This is the pairing the screen exists
  // for, and it is computed rather than described so it stays true as the data
  // changes — including when the change is an order raised a moment ago, which
  // moves a part from the right-hand panel to the left.
  const shortages = partsBelowReorder.map((p) => ({
    part: p,
    orders: all.filter((o) => o.partNo === p.partNo && o._open),
  }))
  const covered = shortages.filter((s) => s.orders.length)
  const uncovered = shortages.filter((s) => !s.orders.length)

  const raise = (partNo = '') => { setSeedPart(partNo); setRaising(true) }

  return (
    <div>
      <PageHeading
        title="Purchase Orders"
        subtitle={`Orders against the parts catalogue, Draft through Received, and what each one was raised for. ${deptName}.`}
        right={<ActionButton onClick={() => raise('')}>Raise purchase order</ActionButton>}
      />

      <AddPurchaseOrderModal
        open={raising}
        onClose={() => setRaising(false)}
        onCreate={create}
        created={created}
        partNo={seedPart}
      />

      <StatCards items={[
        { label: 'Purchase orders', value: all.length, note: `${received.length} received`, icon: 'list' },
        { label: 'Open', value: openOrders.length, note: 'Not yet received or cancelled', icon: 'clock' },
        { label: 'Committed spend', value: money(committed), tone: 'warning', note: 'Value of open orders' },
        { label: 'Awaiting a decision', value: awaitingApproval.length, tone: awaitingApproval.length ? 'warning' : 'success', note: 'Draft or pending approval' },
        { label: 'Past expected date', value: lateOrders.length, tone: lateOrders.length ? 'destructive' : 'success', note: lateOrders.map((p) => p.poNo).join(', ') || 'None late' },
      ]} />

      {uncovered.length > 0 && (
        <Note tone="warn">
          <b>{uncovered.length} of {shortages.length} shortages have no order raised against them:</b>{' '}
          {uncovered.map((s) => `${s.part.partNo} ${s.part.name}`).join(' · ')}. The other
          {covered.length === 1 ? ' one is' : ` ${covered.length} are`} on order — see below for
          what state each is in.
        </Note>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14 }}>
        <Section
          title="Shortages already on order"
          right={<button onClick={() => router.push('/portal/dna/demand-parts')} style={link}>Demand parts →</button>}
        >
          {covered.length ? covered.map(({ part, orders }) => (
            <div key={part.partNo} style={{ ...card, borderLeftColor: '#b45309' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <Ref>{part.partNo}</Ref>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>{part.name}</span>
                </div>
                <span style={{ fontSize: 11.5, color: '#64748b' }}>
                  {part.qtyOnHand} of {part.reorderPoint} on hand
                </span>
              </div>
              {orders.map((o) => (
                <button key={o.poNo} onClick={() => router.push(`/portal/dna/purchase-orders/${o.poNo}`)} style={rowBtn}>
                  <StatusBadge tone={STATUS_TONE[o.status]}>{o.status}</StatusBadge>
                  <span style={{ fontSize: 12, color: '#0f172a' }}>
                    {o.poNo} — {o._outstanding} of {o.qtyOrdered} still to arrive
                  </span>
                </button>
              ))}
            </div>
          )) : <Note tone="grey">No shortage currently has an order against it.</Note>}
        </Section>

        <Section title="Shortages with nothing on order">
          {uncovered.length ? uncovered.map(({ part }) => (
            <div key={part.partNo} style={{ ...card, borderLeftColor: '#b91c1c' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <Ref>{part.partNo}</Ref>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>{part.name}</span>
                </div>
                <StatusBadge tone="red">{part._state}</StatusBadge>
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 6, lineHeight: 1.5 }}>
                {part.qtyOnHand} of {part.reorderPoint} on hand · would cost{' '}
                {money((part.reorderQty || 0) * (part.unitCost || 0))} to reorder {part.reorderQty} from {part.supplier}
              </div>
              <div style={{ marginTop: 9 }}>
                <ActionButton variant="ghost" onClick={() => raise(part.partNo)}>Raise order</ActionButton>
              </div>
            </div>
          )) : <Note tone="good">Every shortage has an order against it.</Note>}
        </Section>
      </div>

      <Section title="Order register">
        <Toolbar
          search={search} onSearch={setSearch}
          placeholder="Search order, part, vendor or reason…"
          filters={[
            { label: 'Status', value: status, onChange: setStatus, options: statuses },
            { label: 'Vendor', value: vendor, onChange: setVendor, options: vendors },
          ]}
        />

        <DataTable
          rows={rows}
          pageSize={15}
          onRowClick={(p) => router.push(`/portal/dna/purchase-orders/${p.poNo}`)}
          empty="No orders match these filters."
          columns={[
            { key: 'poNo', label: 'PO', width: 96, render: (p) => <Ref>{p.poNo}</Ref> },
            {
              key: 'partName', label: 'Part',
              render: (p) => <TwoLine top={p.partName} bottom={p.partNo} />,
            },
            { key: 'vendor', label: 'Vendor', width: 168 },
            {
              key: 'qtyOrdered', label: 'Qty', width: 116, align: 'right',
              render: (p) => (
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {p.qtyReceived ? `${p.qtyReceived} / ${p.qtyOrdered}` : p.qtyOrdered}
                  </div>
                  {p.status === 'Partially Received' && (
                    <div style={{ marginTop: 4 }}>
                      <Meter value={p.qtyReceived} max={p.qtyOrdered} tone="#b45309" height={5} />
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'totalCost', label: 'Value', width: 108, align: 'right',
              render: (p) => <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12.5, fontWeight: 600 }}>{money(p.totalCost)}</span>,
            },
            { key: 'orderDate', label: 'Raised', width: 116, render: (p) => <span style={{ fontSize: 12 }}>{fmtDate(p.orderDate)}</span> },
            {
              key: 'expectedDate', label: 'Expected', width: 120,
              sortValue: (p) => p._daysToExpected ?? 9999,
              render: (p) => (p.expectedDate
                ? <DueDate value={p.expectedDate} days={p._daysToExpected} done={!p._open} />
                : <span style={{ fontSize: 11.5, color: '#94a3b8', fontStyle: 'italic' }}>Not yet placed</span>),
            },
            { key: 'requestedBy', label: 'Raised by', width: 148 },
            {
              key: 'linkedTo', label: 'Raised for', width: 210,
              render: (p) => <span style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.45 }}>{p.linkedTo}</span>,
            },
            { key: 'status', label: 'Status', width: 148, render: (p) => <StatusBadge tone={STATUS_TONE[p.status]}>{p.status}</StatusBadge> },
          ]}
        />
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14 }}>
        <Section title="Orders by status">
          <Bars data={statuses.map((s) => ({ name: s, value: all.filter((p) => p.status === s).length })).filter((d) => d.value).sort((a, b) => b.value - a.value)} />
        </Section>
        <Section title="Committed spend by vendor" right={<span style={{ fontSize: 11.5, color: '#94a3b8' }}>open orders only</span>}>
          <Bars
            data={vendors.map((v) => ({
              name: v,
              value: Math.round(openOrders.filter((p) => p.vendor === v).reduce((s, p) => s + (p.totalCost || 0), 0)),
            })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value)}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 14 }}>
            <Fact label="Open" value={money(committed)} sub={`${openOrders.length} orders in flight`} />
            <Fact label="Received to date" value={money(receivedValue)} sub={`${received.length} orders closed out`} />
          </div>
        </Section>
      </div>
    </div>
  )
}

const link = { background: 'none', border: 'none', color: '#15227a', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }
const card = { padding: '13px 15px', border: '1px solid #e4e9f0', borderLeft: '3px solid', borderRadius: 11, background: '#fff', marginBottom: 10 }
const rowBtn = {
  display: 'flex', alignItems: 'center', gap: 9, width: '100%', marginTop: 9,
  padding: '7px 9px', borderRadius: 8, border: '1px solid #eef1f6',
  background: '#f8fafc', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
}
