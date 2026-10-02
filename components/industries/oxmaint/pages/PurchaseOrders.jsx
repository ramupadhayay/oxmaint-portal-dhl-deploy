'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader, StatStrip, Toolbar, DataTable, StatusBadge, ActionButton, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useRecords, useStore } from '../lib/store'
import { CreateModal } from '../lib/forms'
import { useSite } from '../lib/siteStore'
import { idOf, canReceive, useReceiveOrder } from '../lib/purchaseOrder'
import { PURCHASE_ORDERS, VENDORS, money, fmtDate, isPast } from '../lib/data'

const { MUTE, INK } = PALETTE

export default function PurchaseOrders() {
  const { scope, siteName } = useSite()
  const router = useRouter()
  const { create, notify } = useStore()
  const receiveOrder = useReceiveOrder()
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [vendor, setVendor] = useState('all')

  const merged = useRecords('purchase_order', PURCHASE_ORDERS, idOf)
  const all = useMemo(() => scope(merged), [scope, merged])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((p) => (
      (status === 'all' || p.status === status) &&
      (vendor === 'all' || p.vendor_name === vendor) &&
      (!q || [p.po_number, p.vendor_name, p.raised_by_name].join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, status, vendor])

  const columns = [
    { key: 'po_number', label: 'PO', render: (r) => <span style={{ fontWeight: 700, color: '#15227a' }}>{r.po_number}</span> },
    { key: 'vendor_name', label: 'Vendor' },
    { key: 'line_items', label: 'Lines', align: 'right' },
    { key: 'total_amount', label: 'Value', align: 'right', render: (r) => <span style={{ fontWeight: 700 }}>{money(r.total_amount)}</span> },
    { key: 'created_date', label: 'Raised', sortValue: (r) => new Date(r.created_date).getTime(), render: (r) => fmtDate(r.created_date) },
    {
      key: 'expected_date', label: 'Expected', sortValue: (r) => new Date(r.expected_date).getTime(),
      render: (r) => {
        const late = r.status !== 'Received' && isPast(r.expected_date)
        return <span style={{ color: late ? '#b91c1c' : INK, fontWeight: late ? 700 : 500, whiteSpace: 'nowrap' }}>{fmtDate(r.expected_date)}</span>
      },
    },
    { key: 'raised_by_name', label: 'Raised by' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge>{r.status}</StatusBadge> },
    {
      key: 'receive', label: '', align: 'right', sortable: false,
      render: (r) => (
        <ActionButton size="sm" variant={canReceive(r) ? 'subtle' : 'ghost'}
          disabled={!canReceive(r)}
          onClick={(e) => { e.stopPropagation(); return receiveOrder(r) }}>
          {r.status === 'Received' ? 'Received' : 'Receive'}
        </ActionButton>
      ),
    },
  ]

  const outstanding = all.filter((p) => p.status !== 'Received')

  return (
    <div>
      <PageHeader
        icon={sectionIcon('purchase-orders', '#15227a')}
        title="Purchase Orders"
        subtitle={`${all.length} purchase orders · ${siteName}`}
        right={<ActionButton onClick={() => setCreating(true)}>Raise PO</ActionButton>}
      />

      <StatStrip items={[
        { label: 'Purchase orders', value: all.length },
        { label: 'Awaiting approval', value: all.filter((p) => p.status === 'Pending Approval').length, tone: 'amber' },
        { label: 'Outstanding', value: outstanding.length, tone: 'blue' },
        { label: 'Committed spend', value: money(outstanding.reduce((n, p) => n + (Number(p.total_amount) || 0), 0)) },
        { label: 'Received', value: all.filter((p) => p.status === 'Received').length, tone: 'green' },
        { label: 'Overdue delivery', value: outstanding.filter((p) => isPast(p.expected_date)).length, tone: 'red' },
      ]} />

      <Toolbar
        search={search} onSearch={setSearch}
        placeholder="Search PO number, vendor…"
        filters={[
          { label: 'Status', value: status, onChange: setStatus, options: ['Draft', 'Pending Approval', 'Approved', 'Received'] },
          { label: 'Vendor', value: vendor, onChange: setVendor, options: VENDORS.map((v) => v.vendor_name) },
        ]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} shown</span>}
      />

      <DataTable columns={columns} rows={rows} onRowClick={(r) => router.push(`/portal/oxmaint/purchase-orders/${encodeURIComponent(String(idOf(r)))}`)} empty="No purchase orders match these filters." />

      <CreateModal kind="purchase_order" open={creating} onClose={() => setCreating(false)}
        onSubmit={(values) => create('purchase_order', values)} />
    </div>
  )
}
