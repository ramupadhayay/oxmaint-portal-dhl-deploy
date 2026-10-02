'use client'

import { useMemo, useState } from 'react'
import { PageHeader, StatStrip, Toolbar, DataTable, Drawer, Fields, StatusBadge, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { SITES, fmtDate, hours } from '../lib/data'
import { MAINT_LOG } from '../lib/dataOps'

const { MUTE, SUB, INK, LINE } = PALETTE

const countParts = (rows) => rows.reduce((n, r) => n + r.parts_used.reduce((m, p) => m + p.qty, 0), 0)

export default function MaintenanceLogbook() {
  const { scope, siteName } = useSite()
  const [search, setSearch] = useState('')
  const [technician, setTechnician] = useState('all')
  const [status, setStatus] = useState('all')
  const [open, setOpen] = useState(null)

  const all = useMemo(() => scope(MAINT_LOG), [scope])
  // Built from the visible rows, not from the master list: a technician who has
  // no work at the selected site should not be offered as a filter that returns
  // an empty table.
  const technicians = useMemo(() => [...new Set(all.map((r) => r.technician_name))].sort(), [all])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((r) => (
      (technician === 'all' || r.technician_name === technician) &&
      (status === 'all' || r.status === status) &&
      (!q || [r.work_order_number, r.asset_name, r.technician_name, r.work_done].join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, technician, status])

  const columns = [
    {
      key: 'work_order_number', label: 'Work order',
      render: (r) => <span style={{ fontWeight: 700, color: '#15227a', whiteSpace: 'nowrap' }}>{r.work_order_number}</span>,
    },
    { key: 'asset_name', label: 'Asset' },
    { key: 'technician_name', label: 'Technician' },
    {
      key: 'date', label: 'Date', sortValue: (r) => new Date(r.date).getTime(),
      render: (r) => <span style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</span>,
    },
    { key: 'hours', label: 'Hours', align: 'right', render: (r) => `${r.hours} h` },
    {
      key: 'parts', label: 'Parts', align: 'right', sortValue: (r) => r.parts_used.length,
      render: (r) => (r.parts_used.length ? r.parts_used.length : <span style={{ color: MUTE }}>—</span>),
    },
    {
      key: 'status', label: 'Status',
      render: (r) => <StatusBadge tone={r.status === 'Signed off' ? 'green' : 'amber'}>{r.status}</StatusBadge>,
    },
  ]

  return (
    <div>
      <PageHeader
        icon={sectionIcon('maintenance-logbook', '#15227a')}
        title="Maintenance Logbook"
        subtitle={`Job records against completed work · ${siteName}`}
      />

      <StatStrip items={[
        { label: 'Entries', value: all.length },
        { label: 'Hours logged', value: hours(all.reduce((n, r) => n + (Number(r.hours) || 0), 0)), unit: 'h' },
        { label: 'Awaiting sign-off', value: all.filter((r) => r.status === 'Awaiting sign-off').length, tone: 'amber' },
        { label: 'Parts consumed', value: countParts(all) },
      ]} />

      <Toolbar
        search={search} onSearch={setSearch}
        placeholder="Search work order, asset, technician, work done…"
        filters={[
          { label: 'Technician', value: technician, onChange: setTechnician, options: technicians },
          { label: 'Status', value: status, onChange: setStatus, options: ['Signed off', 'Awaiting sign-off'] },
        ]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} shown</span>}
      />

      <DataTable columns={columns} rows={rows} onRowClick={setOpen} empty="No job records match these filters." />

      <Drawer open={Boolean(open)} onClose={() => setOpen(null)} title={open?.work_order_number} subtitle={open?.asset_name}
        icon={sectionIcon('maintenance-logbook', '#15227a')} width={480}>
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <StatusBadge tone={open.status === 'Signed off' ? 'green' : 'amber'}>{open.status}</StatusBadge>

            <Fields rows={[
              ['Technician', open.technician_name],
              ['Date', fmtDate(open.date)],
              ['Hours booked', `${open.hours} h`],
              ['Site', SITES.find((s) => s.site_id === open.site_id)?.site_name],
            ]} />

            <div>
              <h4 style={h4}>Work done</h4>
              <p style={body}>{open.work_done}</p>
            </div>

            <div>
              <h4 style={h4}>Findings</h4>
              <p style={body}>{open.findings}</p>
            </div>

            <div>
              <h4 style={h4}>Parts used</h4>
              {open.parts_used.length ? open.parts_used.map((p) => (
                <div key={p.part_name} style={partRow}>
                  <span style={{ flex: 1, color: INK }}>{p.part_name}</span>
                  <span style={{ fontWeight: 700, color: '#15227a' }}>&times; {p.qty}</span>
                </div>
              )) : <p style={{ ...body, color: MUTE }}>No parts were drawn from stores for this job.</p>}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}

const h4 = { margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 }
const body = { margin: 0, fontSize: 13, lineHeight: 1.6, color: SUB }
const partRow = { display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0', borderBottom: `1px solid ${LINE}`, fontSize: 12.5 }
