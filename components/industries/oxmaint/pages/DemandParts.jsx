'use client'

import { useCallback, useMemo, useState } from 'react'
import { PageHeader, StatStrip, Toolbar, DataTable, StatusBadge, ActionButton, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { useRecords, useStore } from '../lib/store'
import { useStock } from '../lib/movements'
import {
  DEMAND_PARTS, PURCHASE_ORDERS, VENDORS, USER,
  between, daysFrom, fmtDate, daysUntil, isPast, money,
} from '../lib/data'

const { MUTE, INK, SUB } = PALETTE

const poIdOf = (r) => r.purchase_order_id || r.recordId

// What the seeded demand list said about each part. Kept only for the dates and
// job references it carries — the quantities come from the live stock position
// now, because a demand line still asking for a part that was received this
// morning is exactly the kind of stale figure this screen exists to kill.
const SEEDED = new Map(DEMAND_PARTS.map((d) => [d.part_id, d]))

const nextPoNumber = (existing) => {
  // Continue the seeded sequence rather than restarting it, so a raised order
  // does not collide with PO-4100..PO-4115 already on the list.
  const highest = existing.reduce((max, p) => {
    const n = Number(String(p.po_number || '').replace(/\D/g, ''))
    return Number.isFinite(n) && n > max ? n : max
  }, 4115)
  return `PO-${highest + 1}`
}

export default function DemandParts() {
  const { scope, siteName } = useSite()
  const { create, notify } = useStore()
  const { levels, movements } = useStock()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const orders = useRecords('purchase_order', PURCHASE_ORDERS, poIdOf)

  // A part is "on order" when an order that has not yet landed carries a line
  // for it. Reading that from the orders themselves rather than from a flag on
  // the demand line is what stops the two screens disagreeing.
  const onOrder = useMemo(() => {
    const out = new Set()
    orders.filter((o) => o.status !== 'Received' && o.status !== 'Cancelled')
      .forEach((o) => (o.lines || []).forEach((l) => out.add(l.part_id)))
    return out
  }, [orders])

  // The job that last drew the part down, so a line can say what caused it.
  const lastIssue = useMemo(() => {
    const out = new Map()
    movements.forEach((m) => {
      if (m.qty < 0 && m.reference && !out.has(m.part_id)) out.set(m.part_id, m.reference)
    })
    return out
  }, [movements])

  const demand = useMemo(() => levels
    .filter((p) => p.quantity_on_hand < p.minimum_quantity)
    .map((p) => {
      const id = p.part_id || p.recordId
      const seeded = SEEDED.get(id)
      const required = Math.max(1, p.minimum_quantity * 2 - p.quantity_on_hand)
      return {
        demand_id: seeded?.demand_id || `dp_${id}`,
        part_id: id,
        part_name: p.part_name,
        part_number: p.part_number,
        unit: p.unit,
        unit_cost: p.unit_cost,
        on_hand: p.quantity_on_hand,
        minimum_quantity: p.minimum_quantity,
        required_quantity: required,
        line_value: Number((required * (Number(p.unit_cost) || 0)).toFixed(2)),
        required_by: seeded?.required_by || daysFrom(between(`dpd-${id}`, 2, 24)),
        work_order_number: lastIssue.get(id) || seeded?.work_order_number || '—',
        vendor_id: p.vendor_id,
        vendor_name: p.vendor_name,
        site_id: p.site_id,
        // Nothing can be ordered from a part with no preferred vendor, so it
        // sits in Sourcing until purchasing finds one.
        status: onOrder.has(id) ? 'Ordered' : p.vendor_name ? 'Requested' : 'Sourcing',
      }
    }), [levels, onOrder, lastIssue])

  const all = useMemo(() => scope(demand), [scope, demand])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((d) => (
      (status === 'all' || d.status === status) &&
      (!q || [d.part_name, d.part_number, d.work_order_number, d.vendor_name].join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, status])

  const raisePo = useCallback(async (row) => {
    const vendor = VENDORS.find((v) => v.vendor_id === row.vendor_id)
    if (!vendor) {
      notify(`${row.part_name} has no preferred vendor — set one on the part before ordering.`, 'error')
      return
    }
    const po = await create('purchase_order', {
      po_number: nextPoNumber([...orders, ...PURCHASE_ORDERS]),
      vendor_id: vendor.vendor_id,
      vendor_name: vendor.vendor_name,
      status: 'Pending Approval',
      line_items: 1,
      lines: [{
        part_id: row.part_id,
        part_name: row.part_name,
        part_number: row.part_number,
        unit: row.unit,
        quantity: row.required_quantity,
        unit_cost: row.unit_cost,
        line_value: row.line_value,
      }],
      total_amount: row.line_value,
      created_date: daysFrom(0),
      expected_date: daysFrom(vendor.lead_time_days),
      raised_by_name: USER.name,
      site_id: row.site_id,
      raised_from: `Demand for ${row.part_name}`,
    })
    if (!po) return
    notify(`${po.po_number} raised — ${row.required_quantity} ${row.unit} of ${row.part_name} from ${vendor.vendor_name}, expected ${fmtDate(daysFrom(vendor.lead_time_days))}.`)
  }, [create, notify, orders])

  const columns = [
    { key: 'part_number', label: 'Part no.', render: (r) => <span style={{ fontWeight: 700, color: '#15227a', whiteSpace: 'nowrap' }}>{r.part_number}</span> },
    { key: 'part_name', label: 'Description' },
    { key: 'work_order_number', label: 'For WO', render: (r) => <span style={{ color: r.work_order_number === '—' ? MUTE : INK }}>{r.work_order_number}</span> },
    { key: 'on_hand', label: 'On hand', align: 'right', render: (r) => <span style={{ color: r.on_hand === 0 ? '#b91c1c' : INK, fontWeight: r.on_hand === 0 ? 700 : 500 }}>{r.on_hand}</span> },
    { key: 'required_quantity', label: 'Required', align: 'right', render: (r) => <span style={{ fontWeight: 700 }}>{r.required_quantity}</span> },
    { key: 'line_value', label: 'Est. value', align: 'right', render: (r) => money(r.line_value) },
    {
      key: 'required_by', label: 'Required by', sortValue: (r) => new Date(r.required_by).getTime(),
      render: (r) => (
        <span style={{ whiteSpace: 'nowrap', color: isPast(r.required_by) ? '#b91c1c' : INK }}>
          {fmtDate(r.required_by)} <span style={{ fontSize: 10.5, color: MUTE }}>({daysUntil(r.required_by)}d)</span>
        </span>
      ),
    },
    { key: 'vendor_name', label: 'Vendor', render: (r) => r.vendor_name || <span style={{ color: MUTE }}>None set</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge>{r.status}</StatusBadge> },
    {
      key: 'raise', label: '', align: 'right', sortable: false,
      render: (r) => (
        <ActionButton size="sm" variant={r.status === 'Ordered' ? 'ghost' : 'subtle'}
          disabled={r.status === 'Ordered' || !r.vendor_id}
          onClick={() => raisePo(r)}>
          {r.status === 'Ordered' ? 'On order' : 'Raise PO'}
        </ActionButton>
      ),
    },
  ]

  const toOrder = all.filter((d) => d.status !== 'Ordered')

  return (
    <div>
      <PageHeader
        icon={sectionIcon('demand-parts', '#15227a')}
        title="Demand Parts"
        subtitle={`Parts below their reorder point · ${siteName}`}
        right={<ActionButton onClick={() => {}}>Raise demand</ActionButton>}
      />

      <StatStrip items={[
        { label: 'Demand lines', value: all.length },
        { label: 'Requested', value: all.filter((d) => d.status === 'Requested').length, tone: 'amber' },
        { label: 'Sourcing', value: all.filter((d) => d.status === 'Sourcing').length, tone: 'blue' },
        { label: 'Ordered', value: all.filter((d) => d.status === 'Ordered').length, tone: 'green' },
        { label: 'Needed this week', value: all.filter((d) => daysUntil(d.required_by) <= 7).length, tone: 'red' },
        { label: 'Left to order', value: money(toOrder.reduce((n, d) => n + d.line_value, 0)) },
      ]} />

      <Toolbar
        search={search} onSearch={setSearch}
        placeholder="Search part, work order, vendor…"
        filters={[{ label: 'Status', value: status, onChange: setStatus, options: ['Requested', 'Sourcing', 'Ordered'] }]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} shown</span>}
      />

      <p style={{ margin: '0 0 12px', fontSize: 11.5, color: SUB }}>
        Every part whose stock has fallen below its reorder point, counted live. The required quantity brings it
        back to twice the minimum, so consuming a part on a work order puts it on this list immediately.
      </p>

      <DataTable columns={columns} rows={rows} pageSize={14}
        empty="Nothing is below its reorder point. Complete a work order that draws stock to see demand appear here." />
    </div>
  )
}
