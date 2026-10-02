'use client'

// Parts inventory — 18 lines, with the reorder logic the customer asked to see.
//
// One thing has to be said plainly on this screen: in the supplied workbook,
// nothing is below its reorder point. The sheet describes itself as carrying
// reorder thresholds "to demo inventory/stock alerts", and there is no shortage
// in it to raise one.
//
// Rather than invent a stock-out to make the alert light up, the bands report
// what is actually there. Three lines sit exactly one unit above their trigger —
// the slasher drive belt, the 15HP VFD and the compactor hydraulic pump — and
// those are the rows a stores controller is genuinely watching. If a shortage is
// added to the sheet later, the top band fills on its own; nothing here needs
// changing for it to work.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Section, DataTable, Toolbar, StatusBadge } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, DeptChip, TwoLine, Meter, Note, Bars } from '../components/cells'
import { useDept } from '../lib/deptStore'
import {
  parts, PART_CATEGORIES, partsBelowReorder, partsApproaching, inventoryValue, money,
} from '../lib/data'

const STATE_TONE = {
  'Out of stock': 'red',
  'Below reorder point': 'red',
  'Approaching reorder': 'amber',
  'In stock': 'green',
}

export default function Parts() {
  const router = useRouter()
  const { scope, deptName } = useDept()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [state, setState] = useState('all')

  const all = useMemo(() => scope(parts), [scope])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((p) => (
      (category === 'all' || p.category === category) &&
      (state === 'all' || p._state === state) &&
      (!q || [p.partNo, p.name, p.category, p.supplier, p.compatibleRaw].join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, category, state])

  const low = all.filter((p) => p._state === 'Below reorder point' || p._state === 'Out of stock')
  const near = all.filter((p) => p._state === 'Approaching reorder')
  const value = Number(all.reduce((s, p) => s + p._value, 0).toFixed(2))
  const suppliers = [...new Set(all.map((p) => p.supplier))].filter(Boolean)

  // What a requisition would cost if every approaching line were topped up.
  const topUpCost = near.reduce((s, p) => s + (p.reorderQty || 0) * (p.unitCost || 0), 0)

  return (
    <div>
      <PageHeading
        title="Parts Inventory"
        subtitle={`Spares and consumables with reorder points, storeroom and supplier — from loom reeds to FR finishing chemicals. ${deptName}.`}
      />

      <StatCards items={[
        { label: 'Catalogue lines', value: all.length, note: `${PART_CATEGORIES.length} categories`, icon: 'asset' },
        { label: 'Stock value', value: money(value), note: 'Qty on hand × unit cost' },
        { label: 'Below reorder', value: low.length, tone: low.length ? 'destructive' : 'success', note: low.length ? 'Raise a requisition' : 'Nothing to reorder' },
        { label: 'Approaching reorder', value: near.length, tone: near.length ? 'warning' : 'success', note: near.map((p) => p.partNo).join(', ') || 'None', icon: 'clock' },
        { label: 'Suppliers', value: suppliers.length, note: 'Across the catalogue', icon: 'people' },
      ]} />

      {low.length === 0 && (
        <Note tone="good">
          <b>No line is below its reorder point in the supplied data.</b> The three approaching
          rows are one unit above theirs — {near.map((p) => `${p.partNo} ${p.name} (${p.qtyOnHand} of ${p.reorderPoint})`).join(' · ')}.
          Topping all three up would cost {money(topUpCost)}.
        </Note>
      )}

      <Section title="Catalogue">
        <Toolbar
          search={search} onSearch={setSearch}
          placeholder="Search part, supplier or compatible asset…"
          filters={[
            { label: 'Category', value: category, onChange: setCategory, options: PART_CATEGORIES },
            { label: 'Stock', value: state, onChange: setState, options: ['In stock', 'Approaching reorder', 'Below reorder point', 'Out of stock'] },
          ]}
        />

        <DataTable
          rows={rows}
          pageSize={15}
          empty="No parts match these filters."
          columns={[
            { key: 'partNo', label: 'Part No.', width: 106, render: (p) => <Ref>{p.partNo}</Ref> },
            { key: 'name', label: 'Part', render: (p) => <TwoLine top={p.name} bottom={p.category} /> },
            {
              key: 'compatibleRaw', label: 'Fits', width: 150,
              render: (p) => (p._assets.length
                ? <span style={{ fontSize: 11.5, color: '#475569' }}>{p._assets.length} asset{p._assets.length === 1 ? '' : 's'}</span>
                : <span style={{ fontSize: 11.5, color: '#94a3b8', fontStyle: 'italic' }}>{p.compatibleRaw || '—'}</span>),
            },
            { key: 'storeroom', label: 'Storeroom', width: 92, render: (p) => <DeptChip code={p.storeroom} name={p._storeroomName} /> },
            {
              key: 'qtyOnHand', label: 'On hand', width: 128, align: 'right',
              sortValue: (p) => p._headroom,
              render: (p) => (
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {p.qtyOnHand}
                    <span style={{ fontWeight: 500, color: '#94a3b8' }}> / {p.reorderPoint}</span>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <Meter
                      value={p.qtyOnHand}
                      max={Math.max(p.reorderPoint * 3, p.qtyOnHand)}
                      tone={p._state === 'In stock' ? '#047857' : p._state === 'Approaching reorder' ? '#b45309' : '#b91c1c'}
                      height={5}
                    />
                  </div>
                </div>
              ),
            },
            { key: 'reorderQty', label: 'Reorder', width: 82, align: 'right', render: (p) => <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{p.reorderQty}</span> },
            { key: 'unitCost', label: 'Unit', width: 88, align: 'right', render: (p) => <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{money(p.unitCost)}</span> },
            { key: '_value', label: 'Value', width: 96, align: 'right', render: (p) => <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{money(p._value)}</span> },
            { key: 'supplier', label: 'Supplier', width: 160 },
            {
              key: '_incoming', label: 'On order', width: 106, align: 'right',
              render: (p) => (p._incoming
                ? <span style={{ fontSize: 12, fontWeight: 700, color: '#b45309', fontVariantNumeric: 'tabular-nums' }}>+{p._incoming}</span>
                : <span style={{ fontSize: 12, color: '#cbd5e1' }}>—</span>),
            },
            { key: '_state', label: 'Stock', width: 152, render: (p) => <StatusBadge tone={STATE_TONE[p._state]}>{p._state}</StatusBadge> },
          ]}
        />
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
        <Section title="Value by category">
          <Bars
            unit=""
            data={PART_CATEGORIES.map((c) => ({
              name: c,
              value: Math.round(all.filter((p) => p.category === c).reduce((s, p) => s + p._value, 0)),
            })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value)}
          />
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 10 }}>US dollars, qty on hand × unit cost.</p>
        </Section>
        <Section title="Lines by storeroom">
          <Bars
            data={[...new Set(all.map((p) => p.storeroom))]
              .map((s) => ({ name: all.find((p) => p.storeroom === s)?._storeroomName || s, value: all.filter((p) => p.storeroom === s).length }))
              .sort((a, b) => b.value - a.value)}
          />
        </Section>
      </div>
    </div>
  )
}
