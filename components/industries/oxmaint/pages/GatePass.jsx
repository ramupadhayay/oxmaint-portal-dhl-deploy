'use client'

import { useMemo, useState } from 'react'
import { PageHeader, StatStrip, Toolbar, DataTable, Drawer, Fields, StatusBadge, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { SITES, fmtDate, isPast, daysUntil } from '../lib/data'
import { GATE_PASSES } from '../lib/dataOps'

const { MUTE, SUB, INK } = PALETTE

// Overdue is only a question for something that is still out. A pass that came
// back late came back, and colouring it red for ever would put security on the
// phone about goods that are sitting in the stores.
const isOverdue = (g) => g.status === 'Out' && Boolean(g.expected_return) && isPast(g.expected_return)

export default function GatePass() {
  const { scope, siteName } = useSite()
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [open, setOpen] = useState(null)

  const all = useMemo(() => scope(GATE_PASSES), [scope])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((g) => (
      (type === 'all' || g.type === type) &&
      (status === 'all' || g.status === status) &&
      (!q || [g.pass_number, g.item, g.vendor_name, g.reason, g.issued_by_name].join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, type, status])

  const columns = [
    { key: 'pass_number', label: 'Pass no.', render: (g) => <span style={{ fontWeight: 700, color: '#15227a', whiteSpace: 'nowrap' }}>{g.pass_number}</span> },
    {
      key: 'type', label: 'Type',
      render: (g) => <StatusBadge tone={g.type === 'Returnable' ? 'blue' : 'grey'}>{g.type}</StatusBadge>,
    },
    { key: 'item', label: 'Item' },
    { key: 'quantity', label: 'Qty', align: 'right' },
    { key: 'vendor_name', label: 'Vendor' },
    { key: 'issued_by_name', label: 'Issued by' },
    {
      key: 'issued_date', label: 'Issued', sortValue: (g) => new Date(g.issued_date).getTime(),
      render: (g) => <span style={{ whiteSpace: 'nowrap' }}>{fmtDate(g.issued_date)}</span>,
    },
    {
      key: 'expected_return', label: 'Expected back', sortValue: (g) => (g.expected_return ? new Date(g.expected_return).getTime() : null),
      render: (g) => {
        if (!g.expected_return) return <span style={{ color: MUTE }}>—</span>
        const late = isOverdue(g)
        return (
          <span style={{ whiteSpace: 'nowrap', color: late ? '#b91c1c' : INK, fontWeight: late ? 700 : 500 }}>
            {fmtDate(g.expected_return)}{late && ` · ${Math.abs(daysUntil(g.expected_return))}d late`}
          </span>
        )
      },
    },
    { key: 'status', label: 'Status', render: (g) => <StatusBadge>{g.status}</StatusBadge> },
  ]

  const out = all.filter((g) => g.status === 'Out')

  return (
    <div>
      <PageHeader
        icon={sectionIcon('gate-pass', '#15227a')}
        title="Outward Gate Pass"
        subtitle={`Material leaving the site · ${siteName}`}
      />

      <StatStrip items={[
        { label: 'Passes', value: all.length },
        { label: 'Items out', value: out.reduce((n, g) => n + g.quantity, 0), tone: 'amber' },
        { label: 'Overdue returns', value: all.filter(isOverdue).length, tone: 'red' },
        { label: 'Non-returnable', value: all.filter((g) => g.type === 'Non-returnable').length },
      ]} />

      <Toolbar
        search={search} onSearch={setSearch}
        placeholder="Search pass number, item, vendor, reason…"
        filters={[
          { label: 'Type', value: type, onChange: setType, options: ['Returnable', 'Non-returnable'] },
          { label: 'Status', value: status, onChange: setStatus, options: ['Out', 'Returned', 'Closed'] },
        ]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} shown</span>}
      />

      <DataTable columns={columns} rows={rows} onRowClick={setOpen} empty="No gate passes match these filters." />

      <Drawer open={Boolean(open)} onClose={() => setOpen(null)} title={open?.pass_number} subtitle={open?.item}
        icon={sectionIcon('gate-pass', '#15227a')} width={470}>
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatusBadge>{open.status}</StatusBadge>
              <StatusBadge tone={open.type === 'Returnable' ? 'blue' : 'grey'}>{open.type}</StatusBadge>
            </div>

            {isOverdue(open) && (
              <p style={{
                margin: 0, padding: '9px 12px', fontSize: 12.5, lineHeight: 1.5, borderRadius: 9,
                background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
              }}>
                {Math.abs(daysUntil(open.expected_return))} days past the expected return date. Chase {open.vendor_name}.
              </p>
            )}

            <Fields rows={[
              ['Item', open.item],
              ['Quantity', open.quantity],
              ['Vendor', open.vendor_name],
              ['Issued by', open.issued_by_name],
              ['Issued', fmtDate(open.issued_date)],
              ['Expected back', open.expected_return ? fmtDate(open.expected_return) : 'Not returnable'],
              ['Site', SITES.find((s) => s.site_id === open.site_id)?.site_name],
            ]} />

            <div>
              <h4 style={h4}>Reason</h4>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: SUB }}>{open.reason}</p>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}

const h4 = { margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 }
