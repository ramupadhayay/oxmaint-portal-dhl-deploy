'use client'

// Vendors and contractors.
//
// At a property with two technicians, a good deal of the work is not done by
// them: the elevator, the fire panel and the pool are contracted, and the parts
// come from three or four suppliers. Lead time is the column that matters —
// a part four days out is a suite out of service for four days.

import { useMemo, useState } from 'react'
import {
  PageHeading, StatCards, DataTable, Toolbar, StatusBadge, PALETTE,
} from '../lib/kit'
import { VENDORS, PARTS } from '../lib/data'

const { ACCENT, INK, SUB, MUTE, AMBER } = PALETTE

export default function Vendors() {
  const [q, setQ] = useState('')

  const rows = useMemo(() => VENDORS.filter((v) =>
    !q || `${v.vendor_name} ${v.contact_name} ${v.email}`.toLowerCase().includes(q.toLowerCase())
  ).map((v) => ({
    ...v,
    id: v.vendor_id,
    parts: PARTS.filter((p) => p.vendor_name === v.vendor_name).length,
  })), [q])

  const slowest = [...VENDORS].sort((a, b) => b.lead_time_days - a.lead_time_days)[0]
  const avgLead = Math.round(VENDORS.reduce((n, v) => n + v.lead_time_days, 0) / VENDORS.length)

  const columns = [
    { key: 'vendor_name', label: 'Vendor', render: (r) => <strong style={{ color: INK }}>{r.vendor_name}</strong> },
    { key: 'contact_name', label: 'Contact' },
    { key: 'email', label: 'Email', render: (r) => <span style={{ color: SUB, fontSize: 12 }}>{r.email}</span> },
    { key: 'phone', label: 'Phone', render: (r) => <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5, color: SUB }}>{r.phone}</span> },
    {
      key: 'lead_time_days',
      label: 'Lead time',
      align: 'right',
      render: (r) => <span style={{ fontWeight: 700, color: r.lead_time_days > 10 ? AMBER : INK }}>{r.lead_time_days} d</span>,
    },
    { key: 'parts', label: 'Parts supplied', align: 'center' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge>{r.status}</StatusBadge> },
  ]

  return (
    <div>
      <PageHeading
        title="Vendors"
        subtitle="Suppliers and the contractors who cover what the department does not"
      />

      <StatCards items={[
        { label: 'Vendors', value: VENDORS.length, note: 'all active' },
        { label: 'Average lead time', value: `${avgLead} d`, note: 'from order to shelf' },
        { label: 'Longest lead', value: `${slowest.lead_time_days} d`, tone: 'amber', note: slowest.vendor_name },
        { label: 'Parts covered', value: PARTS.length, note: 'across the stockroom' },
      ]} />

      <Toolbar
        search={q}
        onSearch={setQ}
        placeholder="Vendor, contact or email…"
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} of {VENDORS.length}</span>}
      />

      <DataTable columns={columns} rows={rows} pageSize={12} />
    </div>
  )
}
