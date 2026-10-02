'use client'

// The stockroom.
//
// Small on purpose. A hotel this size does not run a warehouse — it runs a
// cupboard in the mechanical room holding the dozen things that stop a suite
// being sold: a PTAC filter, a shower cartridge, a fill valve. What matters is
// not the value of it but whether the one part tonight's job needs is on the
// shelf, so the screen leads with what has run out.

import { useMemo, useState } from 'react'
import {
  PageHeading, StatCards, DataTable, Toolbar, StatusBadge, PALETTE,
} from '../lib/kit'
import { PARTS, money } from '../lib/data'

const { ACCENT, INK, SUB, MUTE, RED } = PALETTE

export default function Parts() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')

  const rows = useMemo(() => PARTS.filter((p) => {
    if (status !== 'all' && p.status !== status) return false
    if (q && !`${p.part_name} ${p.part_number} ${p.vendor_name}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }).map((p) => ({ ...p, id: p.part_id, value: p.quantity_on_hand * p.unit_cost })), [q, status])

  const out = PARTS.filter((p) => p.status === 'Out of Stock')
  const low = PARTS.filter((p) => p.status === 'Low Stock')
  const value = PARTS.reduce((n, p) => n + p.quantity_on_hand * p.unit_cost, 0)

  const columns = [
    { key: 'part_name', label: 'Part', render: (r) => <strong style={{ color: INK }}>{r.part_name}</strong> },
    { key: 'part_number', label: 'Number', render: (r) => <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5, color: SUB }}>{r.part_number}</span> },
    {
      key: 'quantity_on_hand',
      label: 'On hand',
      align: 'right',
      render: (r) => <span style={{ fontWeight: 700, color: r.quantity_on_hand === 0 ? RED : INK }}>{r.quantity_on_hand}</span>,
    },
    { key: 'min_quantity', label: 'Min', align: 'right', render: (r) => <span style={{ color: MUTE }}>{r.min_quantity}</span> },
    { key: 'unit_cost', label: 'Unit', align: 'right', render: (r) => money(r.unit_cost) },
    { key: 'value', label: 'Value', align: 'right', render: (r) => money(Math.round(r.value)) },
    { key: 'vendor_name', label: 'Vendor' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge>{r.status}</StatusBadge> },
  ]

  return (
    <div>
      <PageHeading
        title="Parts"
        subtitle="What is on the shelf in the mechanical room"
      />

      <StatCards items={[
        { label: 'Line items', value: PARTS.length },
        { label: 'Out of stock', value: out.length, tone: out.length ? 'red' : 'green', note: out.length ? 'reorder now' : 'nothing empty' },
        { label: 'Low stock', value: low.length, tone: low.length ? 'amber' : undefined, note: 'below minimum' },
        { label: 'Stock value', value: money(Math.round(value)), note: 'at unit cost' },
      ]} />

      <Toolbar
        search={q}
        onSearch={setQ}
        placeholder="Part, number or vendor…"
        filters={[{ label: 'Status', value: status, onChange: setStatus, options: ['In Stock', 'Low Stock', 'Out of Stock'] }]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} of {PARTS.length}</span>}
      />

      <DataTable columns={columns} rows={rows} pageSize={12} />
    </div>
  )
}
