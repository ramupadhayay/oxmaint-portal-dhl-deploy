'use client'

import { useMemo, useState } from 'react'
import { PageHeader, StatStrip, Toolbar, DataTable, Section, HBars, StatusBadge, ActionButton, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { useStock, AdjustStockModal } from '../lib/movements'
import { SEEDED_STOCK_MOVES, SITES, money } from '../lib/data'

const { MUTE, SUB, INK, LINE } = PALETTE

const idOf = (r) => r.part_id || r.recordId

// Stocks and Parts are the same records seen two ways, which is how the product
// works: Parts is the catalogue — what a part *is* — and Stocks is the position
// — how much sits where, and what it is worth. Splitting them is only confusing
// if both screens show the same columns, so this one leads with value and
// coverage rather than with description.
export default function Stocks() {
  const { scope, siteName } = useSite()
  const { levels, movements } = useStock()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [site, setSite] = useState('all')
  const [adjustId, setAdjustId] = useState(null)

  const all = useMemo(() => scope(levels), [scope, levels])
  const adjusting = useMemo(() => levels.find((p) => idOf(p) === adjustId) || null, [levels, adjustId])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((p) => (
      (status === 'all' || p.status === status) &&
      (site === 'all' || SITES.find((s) => s.site_name === site)?.site_id === p.site_id) &&
      (!q || [p.part_name, p.part_number, p.storage_location].join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, status, site])

  const value = all.reduce((n, p) => n + p.total_value, 0)
  const ledger = useMemo(() => scope(movements), [scope, movements])

  const columns = [
    { key: 'part_number', label: 'Part no.', render: (r) => <span style={{ fontWeight: 700, color: '#15227a', whiteSpace: 'nowrap' }}>{r.part_number}</span> },
    { key: 'part_name', label: 'Description' },
    { key: 'storage_location', label: 'Bin' },
    { key: 'site_id', label: 'Site', render: (r) => SITES.find((s) => s.site_id === r.site_id)?.site_name },
    { key: 'quantity_on_hand', label: 'On hand', align: 'right', render: (r) => `${r.quantity_on_hand} ${r.unit}` },
    { key: 'minimum_quantity', label: 'Reorder at', align: 'right', render: (r) => `${r.minimum_quantity} ${r.unit}` },
    {
      key: 'cover', label: 'Cover', align: 'right',
      sortValue: (r) => (r.minimum_quantity ? r.quantity_on_hand / r.minimum_quantity : 99),
      render: (r) => {
        const ratio = r.minimum_quantity ? r.quantity_on_hand / r.minimum_quantity : 99
        const color = ratio === 0 ? '#b91c1c' : ratio < 1 ? '#b45309' : '#047857'
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 90 }}>
            <span style={{ flex: 1, height: 5, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
              <span style={{ display: 'block', width: `${Math.min(100, ratio * 50)}%`, height: '100%', background: color }} />
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color, width: 30 }}>{ratio >= 99 ? '—' : `${Math.round(ratio * 100)}%`}</span>
          </span>
        )
      },
    },
    { key: 'total_value', label: 'Value', align: 'right', render: (r) => <span style={{ fontWeight: 700 }}>{money(r.total_value)}</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge>{r.status}</StatusBadge> },
    {
      key: 'adjust', label: '', align: 'right', sortable: false,
      render: (r) => <ActionButton size="sm" variant="subtle" onClick={() => setAdjustId(idOf(r))}>Adjust</ActionButton>,
    },
  ]

  return (
    <div>
      <PageHeader
        icon={sectionIcon('stocks', '#15227a')}
        title="Stocks"
        subtitle={`Stock position and valuation · ${siteName}`}
      />

      <StatStrip items={[
        { label: 'Stock lines', value: all.length },
        { label: 'Total valuation', value: money(value) },
        { label: 'Below reorder', value: all.filter((p) => p.quantity_on_hand < p.minimum_quantity).length, tone: 'amber' },
        { label: 'Out of stock', value: all.filter((p) => p.quantity_on_hand === 0).length, tone: 'red' },
        { label: 'Units held', value: all.reduce((n, p) => n + p.quantity_on_hand, 0).toLocaleString('en-US') },
        { label: 'Movements', value: ledger.length, tone: ledger.length ? 'blue' : undefined, note: 'issues and receipts booked' },
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(300px, 100%),1fr))', gap: 14, marginBottom: 14 }}>
        <Section title="Valuation by site">
          <HBars unit="" data={SITES.map((s) => ({
            name: s.site_name,
            value: Math.round(all.filter((p) => p.site_id === s.site_id).reduce((n, p) => n + p.total_value, 0)),
          }))} />
          <p style={{ margin: '12px 0 0', fontSize: 11.5, color: MUTE }}>Figures in {money(1).replace(/[\d.,]/g, '')} — stock at cost, not replacement value.</p>
        </Section>
        <Section title="Valuation by category">
          <HBars data={[...new Set(all.map((p) => p.category))].map((c) => ({
            name: c,
            value: Math.round(all.filter((p) => p.category === c).reduce((n, p) => n + p.total_value, 0)),
          })).sort((a, b) => b.value - a.value)} />
        </Section>
      </div>

      <Toolbar
        search={search} onSearch={setSearch}
        placeholder="Search part number, description, bin…"
        filters={[
          { label: 'Status', value: status, onChange: setStatus, options: ['In Stock', 'Low Stock', 'Out of Stock'] },
          { label: 'Site', value: site, onChange: setSite, options: SITES.map((s) => s.site_name) },
        ]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} shown</span>}
      />

      <DataTable columns={columns} rows={rows} empty="No stock lines match these filters." />

      {/* The ledger itself. A valuation that changes with no record of why is the
          thing a stores manager will not sign off. */}
      <Section title="Stock movements" style={{ marginTop: 14 }}
        right={(
          <span style={{ fontSize: 11.5, color: MUTE }}>
            {ledger.length} recorded{SEEDED_STOCK_MOVES.length ? ' · last 90 days, and anything booked here' : ''}
          </span>
        )}>
        {ledger.length ? (
          <div>
            {ledger.slice(0, 10).map((m) => (
              <div key={m.recordId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${LINE}` }}>
                <span style={{ minWidth: 44, textAlign: 'right', fontSize: 12.5, fontWeight: 800, color: m.qty < 0 ? '#b91c1c' : '#047857' }}>
                  {m.qty > 0 ? `+${m.qty}` : m.qty}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.part_name}</span>
                <span style={{ fontSize: 11.5, color: SUB, minWidth: 150 }}>{m.reason}</span>
                <span style={{ fontSize: 11.5, color: MUTE, minWidth: 80, textAlign: 'right' }}>{m.reference || '—'}</span>
                <span style={{ fontSize: 11.5, color: MUTE, minWidth: 96, textAlign: 'right' }}>{m.by_name}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 12.5, color: MUTE }}>
            No stock has moved yet. Complete a work order, receive a purchase order or adjust a bin to see it here.
          </p>
        )}
      </Section>

      <AdjustStockModal part={adjusting} open={Boolean(adjusting)} onClose={() => setAdjustId(null)}
        icon={sectionIcon('stocks', '#15227a')} />
    </div>
  )
}
