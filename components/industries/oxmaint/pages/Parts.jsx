'use client'

import { useMemo, useState } from 'react'
import { PageHeader, StatStrip, Toolbar, DataTable, Drawer, Fields, StatusBadge, ActionButton, Section, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useStore } from '../lib/store'
import { useStock, AdjustStockModal, MovementList } from '../lib/movements'
import { CreateModal } from '../lib/forms'
import { useSite } from '../lib/siteStore'
import { PARTS, SITES, money } from '../lib/data'

const { MUTE } = PALETTE

const idOf = (r) => r.part_id || r.recordId

export default function Parts() {
  const { scope, siteName } = useSite()
  const { create } = useStore()
  // The catalogue with the stock ledger applied — quantity, status and value all
  // recomputed together, so a part consumed on a work order reads as consumed
  // here rather than as its opening balance with a fresh status beside it.
  const { levels, movementsFor } = useStock()

  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState('all')
  const [openId, setOpenId] = useState(null)
  const [adjustId, setAdjustId] = useState(null)

  const all = useMemo(() => scope(levels), [scope, levels])
  const categories = useMemo(() => [...new Set(PARTS.map((p) => p.category))].sort(), [])

  // Both panels resolve their part from the live list rather than holding a
  // snapshot, so an adjustment moves the number under the drawer that made it.
  const open = useMemo(() => levels.find((p) => idOf(p) === openId) || null, [levels, openId])
  const adjusting = useMemo(() => levels.find((p) => idOf(p) === adjustId) || null, [levels, adjustId])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((p) => (
      (status === 'all' || p.status === status) &&
      (category === 'all' || p.category === category) &&
      (!q || [p.part_name, p.part_number, p.storage_location, p.vendor_name].join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, status, category])

  const columns = [
    { key: 'part_number', label: 'Part no.', render: (r) => <span style={{ fontWeight: 700, color: '#15227a', whiteSpace: 'nowrap' }}>{r.part_number}</span> },
    { key: 'part_name', label: 'Description' },
    { key: 'category', label: 'Category' },
    { key: 'storage_location', label: 'Bin' },
    {
      key: 'quantity_on_hand', label: 'On hand', align: 'right',
      render: (r) => (
        <span style={{ fontWeight: 700, color: r.quantity_on_hand === 0 ? '#b91c1c' : r.quantity_on_hand < r.minimum_quantity ? '#b45309' : '#0f172a' }}>
          {r.quantity_on_hand} <span style={{ fontWeight: 500, color: MUTE, fontSize: 11 }}>{r.unit}</span>
          {r.movement_net !== 0 && (
            <span style={{ fontWeight: 700, fontSize: 10.5, marginLeft: 5, color: r.movement_net < 0 ? '#b91c1c' : '#047857' }}>
              {r.movement_net > 0 ? `+${r.movement_net}` : r.movement_net}
            </span>
          )}
        </span>
      ),
    },
    { key: 'minimum_quantity', label: 'Min', align: 'right' },
    { key: 'unit_cost', label: 'Unit cost', align: 'right', render: (r) => money(r.unit_cost) },
    { key: 'total_value', label: 'Value', align: 'right', render: (r) => money(r.total_value) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge>{r.status}</StatusBadge> },
    {
      key: 'adjust', label: '', align: 'right', sortable: false,
      render: (r) => (
        <ActionButton size="sm" variant="subtle" onClick={(e) => { e.stopPropagation(); setAdjustId(idOf(r)) }}>Adjust</ActionButton>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        icon={sectionIcon('parts', '#15227a')}
        title="Parts"
        subtitle={`${all.length} parts in the catalogue · ${siteName}`}
        right={<ActionButton onClick={() => setCreating(true)}>Add part</ActionButton>}
      />

      <StatStrip items={[
        { label: 'Parts', value: all.length },
        { label: 'In stock', value: all.filter((p) => p.status === 'In Stock').length, tone: 'green' },
        { label: 'Low stock', value: all.filter((p) => p.status === 'Low Stock').length, tone: 'amber' },
        { label: 'Out of stock', value: all.filter((p) => p.status === 'Out of Stock').length, tone: 'red' },
        { label: 'Stock value', value: money(all.reduce((n, p) => n + p.total_value, 0)) },
      ]} />

      <Toolbar
        search={search} onSearch={setSearch}
        placeholder="Search part number, description, bin, vendor…"
        filters={[
          { label: 'Status', value: status, onChange: setStatus, options: ['In Stock', 'Low Stock', 'Out of Stock'] },
          { label: 'Category', value: category, onChange: setCategory, options: categories },
        ]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} shown</span>}
      />

      <DataTable columns={columns} rows={rows} onRowClick={(r) => setOpenId(idOf(r))} empty="No parts match these filters." />

      <Drawer open={Boolean(open)} onClose={() => setOpenId(null)} title={open?.part_name} subtitle={open?.part_number}
        icon={sectionIcon('parts', '#15227a')}
        footer={open ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
            <span style={{ fontSize: 11.5, color: MUTE }}>
              {open.quantity_on_hand} {open.unit} on hand · reorder at {open.minimum_quantity}
            </span>
            <div style={{ marginLeft: 'auto' }}>
              <ActionButton onClick={() => setAdjustId(idOf(open))}>Adjust stock</ActionButton>
            </div>
          </div>
        ) : null}>
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <StatusBadge>{open.status}</StatusBadge>
            {open.quantity_on_hand < open.minimum_quantity && (
              <p style={{
                margin: 0, padding: '9px 12px', fontSize: 12.5, lineHeight: 1.5, borderRadius: 9,
                background: open.quantity_on_hand === 0 ? '#fef2f2' : '#fffbeb',
                border: `1px solid ${open.quantity_on_hand === 0 ? '#fecaca' : '#fde68a'}`,
                color: open.quantity_on_hand === 0 ? '#b91c1c' : '#b45309',
              }}>
                {open.quantity_on_hand === 0
                  ? `Out of stock. Reorder point is ${open.minimum_quantity} ${open.unit}.`
                  : `Below reorder point — ${open.quantity_on_hand} of ${open.minimum_quantity} ${open.unit} on hand.`}
              </p>
            )}
            <Fields rows={[
              ['Category', open.category],
              ['Unit', open.unit],
              ['On hand', `${open.quantity_on_hand} ${open.unit}`],
              ['Minimum', `${open.minimum_quantity} ${open.unit}`],
              ['Reorder point', `${open.reorder_point} ${open.unit}`],
              ['Storage bin', open.storage_location],
              ['Site', SITES.find((s) => s.site_id === open.site_id)?.site_name],
              ['Preferred vendor', open.vendor_name],
              ['Unit cost', money(open.unit_cost)],
              ['Stock value', money(open.total_value)],
            ]} />

            <Section title="Recent movements" style={{ marginBottom: 0 }}
              right={<span style={{ fontSize: 11.5, color: MUTE }}>opening {open.opening_quantity} {open.unit}</span>}>
              <MovementList rows={movementsFor(idOf(open))}
                empty="Nothing has moved against this part yet." />
            </Section>
          </div>
        )}
      </Drawer>

      <AdjustStockModal part={adjusting} open={Boolean(adjusting)} onClose={() => setAdjustId(null)}
        icon={sectionIcon('parts', '#15227a')} />

      <CreateModal kind="part" open={creating} onClose={() => setCreating(false)}
        onSubmit={(values) => create('part', values)} />
    </div>
  )
}
