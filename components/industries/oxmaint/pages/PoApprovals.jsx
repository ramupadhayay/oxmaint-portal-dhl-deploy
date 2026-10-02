'use client'

// PO approvals — the purchasing queue, separated from the purchase order list
// because the two answer different questions.
//
// Purchase Orders answers "what have we ordered". This answers "what is waiting
// on me", which is a much shorter list and the only one an approver wants to
// open. Approving here writes the decision through the record store, so the
// change shows on the purchase order list too.

import { useMemo, useState } from 'react'
import {
  PageHeader, StatStrip, Toolbar, DataTable, Drawer, Fields, StatusBadge,
  ActionButton, PALETTE,
} from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { useRecords, useStore } from '../lib/store'
import { PURCHASE_ORDERS, VENDORS, money, fmtDate, daysUntil } from '../lib/data'

const { MUTE, SUB, INK, LINE } = PALETTE

const idOf = (p) => p.purchase_order_id || p.recordId

// Above this, a second signature is needed. Showing the threshold on screen is
// the difference between "why is this one different" and an obvious rule.
const SECOND_SIGNATURE = 5000

export default function PoApprovals() {
  const { scope, siteName } = useSite()
  const { update } = useStore()
  const [search, setSearch] = useState('')
  const [vendor, setVendor] = useState('all')
  const [openId, setOpenId] = useState(null)

  const merged = useRecords('purchase_order', PURCHASE_ORDERS, idOf)
  const all = useMemo(() => scope(merged), [scope, merged])

  const pending = useMemo(() => all.filter((p) => p.status === 'Pending Approval' || p.status === 'Draft'), [all])
  const open = useMemo(() => merged.find((p) => idOf(p) === openId) || null, [merged, openId])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return pending.filter((p) => (
      (vendor === 'all' || p.vendor_name === vendor) &&
      (!q || [p.po_number, p.vendor_name, p.raised_by_name].join(' ').toLowerCase().includes(q))
    ))
  }, [pending, search, vendor])

  const decide = (status) => {
    if (!open) return
    update('purchase_order', idOf(open), { ...open, status })
    setOpenId(null)
  }

  const columns = [
    { key: 'po_number', label: 'PO', render: (r) => <span style={{ fontWeight: 700, color: '#15227a' }}>{r.po_number}</span> },
    { key: 'vendor_name', label: 'Vendor' },
    { key: 'line_items', label: 'Lines', align: 'right' },
    { key: 'total_amount', label: 'Value', align: 'right', render: (r) => <span style={{ fontWeight: 700 }}>{money(r.total_amount)}</span> },
    {
      key: 'tier', label: 'Authority', sortValue: (r) => r.total_amount,
      render: (r) => <StatusBadge tone={r.total_amount >= SECOND_SIGNATURE ? 'amber' : 'grey'}>
        {r.total_amount >= SECOND_SIGNATURE ? 'Two signatures' : 'Single signature'}
      </StatusBadge>,
    },
    { key: 'raised_by_name', label: 'Raised by' },
    { key: 'created_date', label: 'Waiting since', sortValue: (r) => new Date(r.created_date).getTime(),
      render: (r) => <span style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.created_date)} <span style={{ fontSize: 10.5, color: MUTE }}>({Math.abs(daysUntil(r.created_date))}d)</span></span> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge>{r.status}</StatusBadge> },
  ]

  return (
    <div>
      <PageHeader
        icon={sectionIcon('po-approvals', '#15227a')}
        title="PO Approvals"
        subtitle={`Purchase orders waiting on a decision · ${siteName}`}
      />

      <StatStrip items={[
        { label: 'Awaiting decision', value: pending.length, tone: pending.length ? 'amber' : 'green' },
        { label: 'Value held', value: money(pending.reduce((n, p) => n + (p.total_amount || 0), 0)) },
        { label: 'Need two signatures', value: pending.filter((p) => p.total_amount >= SECOND_SIGNATURE).length },
        { label: 'Approved', value: all.filter((p) => p.status === 'Approved').length, tone: 'green' },
        { label: 'Received', value: all.filter((p) => p.status === 'Received').length },
      ]} />

      <Toolbar
        search={search} onSearch={setSearch}
        placeholder="Search PO number, vendor, requester…"
        filters={[{ label: 'Vendor', value: vendor, onChange: setVendor, options: VENDORS.map((v) => v.vendor_name) }]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} shown</span>}
      />

      <DataTable columns={columns} rows={rows} onRowClick={(r) => setOpenId(idOf(r))}
        empty="Nothing is waiting for approval." />

      <Drawer
        open={Boolean(open)} onClose={() => setOpenId(null)}
        title={open?.po_number} subtitle={open?.vendor_name}
        icon={sectionIcon('po-approvals', '#15227a')}
        footer={open && (open.status === 'Pending Approval' || open.status === 'Draft') ? (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <ActionButton variant="danger" onClick={() => decide('Rejected')}>Reject</ActionButton>
            <ActionButton variant="success" onClick={() => decide('Approved')}>Approve</ActionButton>
          </div>
        ) : null}
      >
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <StatusBadge>{open.status}</StatusBadge>
            {open.total_amount >= SECOND_SIGNATURE && (
              <p style={{ margin: 0, padding: '9px 12px', fontSize: 12.5, lineHeight: 1.5, borderRadius: 9, background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309' }}>
                Above the {money(SECOND_SIGNATURE)} threshold — this needs a second approver before the order can be placed.
              </p>
            )}
            <Fields rows={[
              ['Vendor', open.vendor_name],
              ['Line items', open.line_items],
              ['Value', money(open.total_amount)],
              ['Payment terms', VENDORS.find((v) => v.vendor_id === open.vendor_id)?.payment_terms],
              ['Raised by', open.raised_by_name],
              ['Raised on', fmtDate(open.created_date)],
              ['Expected', fmtDate(open.expected_date)],
            ]} />
          </div>
        )}
      </Drawer>
    </div>
  )
}
