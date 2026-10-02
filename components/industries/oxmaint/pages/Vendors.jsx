'use client'

import { useMemo, useState } from 'react'
import { PageHeader, StatStrip, Toolbar, DataTable, Drawer, Fields, StatusBadge, ActionButton, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useRecords, useStore } from '../lib/store'
import { CreateModal } from '../lib/forms'
import { VENDORS, PARTS, PURCHASE_ORDERS, money, fmtDate } from '../lib/data'

const { MUTE, INK } = PALETTE

const idOf = (r) => r.vendor_id || r.recordId

export default function Vendors() {
  const { create } = useStore()
  const [creating, setCreating] = useState(false)
  const seededPlusStored = useRecords('vendor', VENDORS, idOf)
  const [search, setSearch] = useState('')
  const [terms, setTerms] = useState('all')
  const [open, setOpen] = useState(null)

  // Vendors are organisation-level, not site-level, so this page deliberately
  // ignores the site filter — a supplier does not belong to one plant.
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return seededPlusStored.filter((v) => (
      (terms === 'all' || v.payment_terms === terms) &&
      (!q || [v.vendor_name, v.contact_name, v.email].join(' ').toLowerCase().includes(q))
    )).map((v) => ({
      ...v,
      parts_supplied: PARTS.filter((p) => p.vendor_id === v.vendor_id).length,
      open_pos: PURCHASE_ORDERS.filter((p) => p.vendor_id === v.vendor_id && p.status !== 'Received').length,
    }))
  }, [seededPlusStored, search, terms])

  const columns = [
    { key: 'vendor_name', label: 'Vendor', render: (r) => <span style={{ fontWeight: 700, color: '#15227a' }}>{r.vendor_name}</span> },
    { key: 'contact_name', label: 'Contact' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'payment_terms', label: 'Terms' },
    { key: 'lead_time_days', label: 'Lead time', align: 'right', render: (r) => `${r.lead_time_days} days` },
    { key: 'parts_supplied', label: 'Parts', align: 'right' },
    { key: 'open_pos', label: 'Open POs', align: 'right', render: (r) => (r.open_pos ? <span style={{ fontWeight: 700, color: '#b45309' }}>{r.open_pos}</span> : '—') },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge>{r.status}</StatusBadge> },
  ]

  return (
    <div>
      <PageHeader
        icon={sectionIcon('vendors', '#15227a')}
        title="Vendors"
        subtitle={`${VENDORS.length} suppliers · organisation-wide`}
        right={<ActionButton onClick={() => setCreating(true)}>Add vendor</ActionButton>}
      />

      <StatStrip items={[
        { label: 'Vendors', value: VENDORS.length },
        { label: 'Active', value: VENDORS.filter((v) => v.status === 'Active').length, tone: 'green' },
        { label: 'Avg lead time', value: Math.round(VENDORS.reduce((n, v) => n + v.lead_time_days, 0) / VENDORS.length), unit: 'days' },
        { label: 'Open purchase orders', value: PURCHASE_ORDERS.filter((p) => p.status !== 'Received').length, tone: 'amber' },
      ]} />

      <Toolbar
        search={search} onSearch={setSearch}
        placeholder="Search vendor, contact, email…"
        filters={[{ label: 'Terms', value: terms, onChange: setTerms, options: ['Net 30', 'Net 45', 'Net 60'] }]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} shown</span>}
      />

      <DataTable columns={columns} rows={rows} onRowClick={setOpen} pageSize={10} empty="No vendors match these filters." />

      <Drawer open={Boolean(open)} onClose={() => setOpen(null)} title={open?.vendor_name} subtitle={open?.contact_name}
        icon={sectionIcon('vendors', '#15227a')} width={470}>
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <StatusBadge>{open.status}</StatusBadge>
            <Fields rows={[
              ['Contact', open.contact_name],
              ['Email', open.email],
              ['Phone', open.phone],
              ['Payment terms', open.payment_terms],
              ['Lead time', `${open.lead_time_days} days`],
              ['Parts supplied', open.parts_supplied],
            ]} />
            <div>
              <h4 style={h4}>Purchase orders</h4>
              {PURCHASE_ORDERS.filter((p) => p.vendor_id === open.vendor_id).map((p) => (
                <div key={p.purchase_order_id} style={row}>
                  <span style={{ fontWeight: 700, color: '#15227a', minWidth: 68 }}>{p.po_number}</span>
                  <span style={{ flex: 1, color: INK }}>{money(p.total_amount)}</span>
                  <span style={{ fontSize: 11.5, color: '#94a3b8' }}>{fmtDate(p.expected_date)}</span>
                  <StatusBadge>{p.status}</StatusBadge>
                </div>
              ))}
            </div>
          </div>
        )}
      </Drawer>

      <CreateModal kind="vendor" open={creating} onClose={() => setCreating(false)}
        onSubmit={(values) => create('vendor', values)} />
    </div>
  )
}

const h4 = { margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4 }
const row = { display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12 }
