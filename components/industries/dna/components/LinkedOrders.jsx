'use client'

// Purchase orders that name a given record.
//
// Every order carries a "Raised for" line, and three of the fifteen name a
// record this portal already holds — a loom fault, an annual calibration, an
// asset a backup pump was bought for. Resolving those means a work order can
// show what was ordered because of it without procurement being a separate
// island, which is the whole difference between a set of tables and a system.
//
// Renders nothing when there are no matches, rather than an empty section. A
// heading over a blank table reads as a feature that is broken; absence reads
// correctly as "nothing was ordered for this".

import { useMemo } from 'react'
import { DataTable, StatusBadge } from '../lib/kit'
import { Section } from '../lib/kit'
import { Ref, TwoLine } from './cells'
import { usePurchaseOrderStore } from '../lib/store'
import { purchaseOrders as sourceOrders, derivePurchaseOrder, money, fmtDate } from '../lib/data'

export const PO_TONE = {
  Draft: 'grey',
  'Pending Approval': 'amber',
  Approved: 'blue',
  Ordered: 'blue',
  'Partially Received': 'amber',
  Received: 'green',
  Cancelled: 'grey',
}

export function PoTable({ rows, router }) {
  return (
    <DataTable
      rows={rows}
      pageSize={10}
      onRowClick={(p) => router.push(`/portal/dna/purchase-orders/${p.poNo}`)}
      empty=""
      columns={[
        { key: 'poNo', label: 'PO', width: 96, render: (p) => <Ref>{p.poNo}</Ref> },
        { key: 'partName', label: 'Part', render: (p) => <TwoLine top={p.partName} bottom={p.vendor} /> },
        {
          key: 'qtyOrdered', label: 'Qty', width: 78, align: 'right',
          render: (p) => <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{p.qtyOrdered}</span>,
        },
        {
          key: 'totalCost', label: 'Value', width: 100, align: 'right',
          render: (p) => <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{money(p.totalCost)}</span>,
        },
        { key: 'orderDate', label: 'Raised', width: 116, render: (p) => <span style={{ fontSize: 12 }}>{fmtDate(p.orderDate)}</span> },
        { key: 'status', label: 'Status', width: 148, render: (p) => <StatusBadge tone={PO_TONE[p.status]}>{p.status}</StatusBadge> },
      ]}
    />
  )
}

/**
 * @param ids   record ids to look for — a work order and its asset, say
 * @param label section heading, minus the count this adds
 */
export default function LinkedOrders({ ids = [], router, label }) {
  // Orders raised in the portal are searched alongside the workbook's, because
  // this is the half of the relation that makes the create form worth having:
  // picking WO-2004 in the form is what puts the order on WO-2004's page, and
  // reading only the static list would leave that half broken.
  const { created } = usePurchaseOrderStore()
  const all = useMemo(
    () => [...created.map((po) => derivePurchaseOrder(po, { shiftDates: false })), ...sourceOrders],
    [created]
  )

  // De-duplicated: a work order and the asset it names can both be mentioned by
  // the same order, and it should appear once.
  const seen = new Map()
  ids.filter(Boolean).forEach((id) => {
    all.filter((po) => po._refs.includes(id)).forEach((po) => seen.set(po.poNo, po))
  })
  const rows = [...seen.values()]

  if (!rows.length) return null

  return (
    <Section title={`${label} (${rows.length})`}>
      <PoTable rows={rows} router={router} />
    </Section>
  )
}
