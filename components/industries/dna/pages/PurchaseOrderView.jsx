'use client'

// One purchase order, opened in full.
//
// The page exists to close the loop that a register cannot: an order names a
// part, the part fits machines, and the "Raised for" line often names the job or
// the schedule that caused it. All three are resolved here, so a reader arriving
// from the loom fault can see the VFD drive that was ordered for it, and a
// reader arriving from the order can walk back the other way.
//
// The stock position is on the page for the same reason. An order for a part
// that is already out of stock reads differently from one topping up a full
// shelf, and the number that settles it belongs beside the order rather than one
// screen away.

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Section, DataTable, StatusBadge } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { Ref, TwoLine, Note, Fact, Meter } from '../components/cells'
import LinkedOrders, { PoTable, PO_TONE } from '../components/LinkedOrders'
import { usePurchaseOrderStore } from '../lib/store'
import {
  purchaseOrders as sourceOrders, parts, assets, workOrders, pmSchedules,
  derivePurchaseOrder, money, fmtDate, locName,
} from '../lib/data'

export default function PurchaseOrderView({ id }) {
  const router = useRouter()
  const back = () => router.push('/portal/dna/purchase-orders')
  const { created, ready } = usePurchaseOrderStore()

  // An order raised in the demo has to open like any other. Derived through the
  // same function as the workbook's rows, so this page does not need to know
  // which kind it is looking at.
  const all = useMemo(
    () => [...created.map((po) => derivePurchaseOrder(po, { shiftDates: false })), ...sourceOrders],
    [created]
  )

  const po = all.find((x) => x.poNo === id)
  // Orders raised in the portal arrive one request after the page does, so
  // until that answers an unknown reference is "loading", not "no such order".
  if (!po) {
    return (
      <PageHeading
        back={{ label: 'Purchase Orders', onClick: back }}
        title={ready ? 'No purchase order with that reference' : 'Loading…'}
        subtitle={ready ? `Nothing in the register is filed under “${id}”.` : ''}
      />
    )
  }

  const part = parts.find((p) => p.partNo === po.partNo) || null
  const fits = part ? part._assets : []
  const forPart = part ? all.filter((o) => o.partNo === part.partNo) : []
  const siblings = forPart.filter((o) => o.poNo !== po.poNo)
  // Counted over the merged list rather than read off the part, whose figure is
  // computed once at module load and knows nothing about an order raised a
  // minute ago.
  const incoming = forPart.reduce((s, o) => s + o._incoming, 0)

  // Each id the Raised for line mentions, resolved to the record it names.
  const linked = po._refs.map((ref) => {
    if (/^WO-/.test(ref)) {
      const row = workOrders.find((w) => w.woNo === ref)
      return row && { ref, kind: 'Work order', label: row.title, href: `/portal/dna/work-orders/${ref}` }
    }
    if (/^PM-/.test(ref)) {
      const row = pmSchedules.find((x) => x.pmId === ref)
      return row && { ref, kind: 'PM schedule', label: row.task, href: `/portal/dna/pm-schedules/${ref}` }
    }
    if (/^AST-/.test(ref)) {
      const row = assets.find((a) => a.assetId === ref)
      return row && { ref, kind: 'Asset', label: row.name, href: `/portal/dna/assets/${ref}` }
    }
    if (/^PO-/.test(ref)) {
      const row = all.find((o) => o.poNo === ref)
      return row && { ref, kind: 'Purchase order', label: row.partName, href: `/portal/dna/purchase-orders/${ref}` }
    }
    return null
  }).filter(Boolean)

  // The one inconsistency in the supplied table, surfaced rather than smoothed
  // over: PO-3014 says it duplicates PO-3011, but the two are for different
  // parts and PO-3011 was raised nineteen days later. Reported here because a
  // reader who checks will find it, and a portal that quietly hid it would be
  // the less trustworthy of the two.
  const dupTarget = po._refs.find((r) => /^PO-/.test(r))
  const dup = dupTarget ? all.find((o) => o.poNo === dupTarget) : null
  const dupMismatch = dup && (dup.partNo !== po.partNo || dup.orderDate > po.orderDate)

  return (
    <div>
      <PageHeading
        back={{ label: 'Purchase Orders', onClick: back }}
        title={po.partName}
        subtitle={`${po.poNo} · ${po.vendor} · raised by ${po.requestedBy}`}
        right={<StatusBadge tone={PO_TONE[po.status]}>{po.status}</StatusBadge>}
      />

      {po._addedInPortal && (
        <Note tone="grey">
          Raised in this portal rather than supplied in the workbook. It sits in the register
          alongside the fifteen sample orders and survives a refresh.
        </Note>
      )}

      {po._late && (
        <Note tone="warn">
          <b>{Math.abs(po._daysToExpected)} days past its expected delivery date</b> and still{' '}
          {po.status.toLowerCase()}.
        </Note>
      )}

      {po.status === 'Partially Received' && (
        <Note tone="warn">
          <b>{po.qtyReceived} of {po.qtyOrdered} received.</b> {po._outstanding} still outstanding.
        </Note>
      )}

      <Section title="Order">
        <Grid rows={[
          ['Purchase order', <Ref key="r">{po.poNo}</Ref>],
          ['Part', <span key="p"><Ref>{po.partNo}</Ref> {po.partName}</span>],
          ['Vendor', po.vendor],
          ['Quantity ordered', String(po.qtyOrdered)],
          ['Quantity received', po.qtyReceived ? `${po.qtyReceived} of ${po.qtyOrdered}` : 'None yet'],
          ['Unit cost', money(po.unitCost)],
          ['Total', <b key="t">{money(po.totalCost)}</b>],
          ['Raised', fmtDate(po.orderDate)],
          ['Raised by', po.requestedBy],
          ['Expected delivery', po.expectedDate ? fmtDate(po.expectedDate) : 'Not yet placed'],
          ['Received', po.receivedDate ? fmtDate(po.receivedDate) : '—'],
          ['Status', <StatusBadge key="s" tone={PO_TONE[po.status]}>{po.status}</StatusBadge>],
        ]} />

        {po.status === 'Partially Received' && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#64748b', marginBottom: 6 }}>
              <span>Delivered</span>
              <span>{po.qtyReceived} of {po.qtyOrdered}</span>
            </div>
            <Meter value={po.qtyReceived} max={po.qtyOrdered} tone="#b45309" height={10} />
          </div>
        )}
      </Section>

      <Section title="Raised for">
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#334155', lineHeight: 1.6 }}>{po.linkedTo}</p>

        {linked.length ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {linked.map((l) => (
              <button key={l.ref} onClick={() => router.push(l.href)} style={refBtn}>
                <StatusBadge tone="blue">{l.kind}</StatusBadge>
                <span style={{ fontSize: 12.5, color: '#0f172a' }}>{l.ref} — {l.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <Note tone="grey">
            This order names no other record — routine replenishment rather than work raised
            against a specific job.
          </Note>
        )}

        {dupMismatch && (
          <Note tone="warn">
            <b>This reference does not hold up.</b> The order says it duplicates {dup.poNo}, but
            that order is for {dup.partName} ({dup.partNo}) rather than {po.partName}
            {dup.orderDate > po.orderDate ? `, and was raised after this one` : ''}. Reported as
            supplied rather than corrected — the source says what it says.
          </Note>
        )}
      </Section>

      {part && (
        <Section title="Stock position">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
            <Fact label="On hand" value={`${part.qtyOnHand} of ${part.reorderPoint}`} sub={part._state} />
            <Fact label="On the way" value={String(incoming)} sub={incoming ? 'Across every open order' : 'Nothing outstanding'} />
            <Fact label="Storeroom" value={part._storeroomName} sub={part.storeroom} />
            <Fact label="Holding value" value={money(part._value)} sub={`${money(part.unitCost)} each`} />
          </div>

          {fits.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
                Keeps {fits.length} machine{fits.length === 1 ? '' : 's'} running
              </div>
              <div style={{ display: 'grid', gap: 7 }}>
                {fits.map((a) => (
                  <button key={a.assetId} onClick={() => router.push(`/portal/dna/assets/${a.assetId}`)} style={refBtn}>
                    <StatusBadge tone={a.status === 'Down' ? 'red' : a.status === 'Standby' ? 'blue' : 'green'}>{a.status}</StatusBadge>
                    <span style={{ fontSize: 12.5, color: '#0f172a' }}>{a.assetId} — {a.name}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>{locName(a.locationCode)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {siblings.length > 0 && (
        <Section title={`Other orders for this part (${siblings.length})`}>
          <PoTable rows={siblings} router={router} />
        </Section>
      )}
    </div>
  )
}

function Grid({ rows }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 0 }}>
      {rows.map(([k, v], i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '9px 0', borderBottom: '1px solid #eef1f6' }}>
          <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600, flexShrink: 0 }}>{k}</span>
          <span style={{ fontSize: 12.5, color: '#0f172a', textAlign: 'right', minWidth: 0 }}>{v}</span>
        </div>
      ))}
    </div>
  )
}

const refBtn = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
  padding: '8px 10px', borderRadius: 8, border: '1px solid #eef1f6',
  background: '#f8fafc', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
}
