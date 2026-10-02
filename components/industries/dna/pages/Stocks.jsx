'use client'

// Inventory > Stocks — what the stores is holding, and what it is worth.
//
// Parts and Stocks are two views of one catalogue in the product, and the split
// is a real one rather than a duplicated table. Parts answers "what do we stock
// and what fits what" — a catalogue you look a part up in. Stocks answers "how
// much is on the shelf, where, and what is it tying up" — the view a stores
// controller and a finance manager share.
//
// So this screen leads with money and location and leaves the compatibility
// lists to Parts. What it cannot show is movement: the workbook has quantities
// but no issue or receipt history, so there is no consumption trend here and
// none is implied.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Section, DataTable, Toolbar, StatusBadge } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, DeptChip, TwoLine, Meter, Note, Bars, Fact } from '../components/cells'
import { useDept } from '../lib/deptStore'
import {
  parts, PART_CATEGORIES, partsBelowReorder, partsApproaching, inventoryValue,
  locName, money,
} from '../lib/data'

const STATE_TONE = {
  'Out of stock': 'red',
  'Below reorder point': 'red',
  'Approaching reorder': 'amber',
  'In stock': 'green',
}

export default function Stocks() {
  const router = useRouter()
  const { scope, deptName } = useDept()
  const [search, setSearch] = useState('')
  const [storeroom, setStoreroom] = useState('all')
  const [state, setState] = useState('all')

  const all = useMemo(() => scope(parts), [scope])
  const storerooms = [...new Set(parts.map((p) => p.storeroom))].filter(Boolean)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((p) => (
      (storeroom === 'all' || p.storeroom === storeroom) &&
      (state === 'all' || p._state === state) &&
      (!q || [p.partNo, p.name, p.category, p.supplier].join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, storeroom, state])

  const value = Number(all.reduce((s, p) => s + p._value, 0).toFixed(2))
  const low = all.filter((p) => p._state === 'Below reorder point' || p._state === 'Out of stock')
  const out = all.filter((p) => p._state === 'Out of stock')
  const units = all.reduce((s, p) => s + (p.qtyOnHand || 0), 0)

  // Where the money is sitting. A stores controller reads this before deciding
  // which shelf to count first.
  const byStoreroom = useMemo(() => storerooms.map((sr) => ({
    name: locName(sr),
    value: Math.round(all.filter((p) => p.storeroom === sr).reduce((s, p) => s + p._value, 0)),
  })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value), [all, storerooms])

  const dearest = [...all].sort((a, b) => b._value - a._value).slice(0, 8)

  return (
    <div>
      <PageHeading
        title="Stocks"
        subtitle={`Holding, valuation and cover by storeroom across the catalogue. ${deptName}.`}
      />

      <StatCards items={[
        { label: 'Stock value', value: money(value), note: `${all.length} catalogue lines` },
        { label: 'Units on hand', value: units, note: 'Across every line', icon: 'asset' },
        { label: 'Out of stock', value: out.length, tone: out.length ? 'destructive' : 'success', note: out.map((p) => p.partNo).join(', ') || 'None' },
        { label: 'Below reorder', value: low.length, tone: low.length ? 'warning' : 'success', note: 'Requisition due' },
        { label: 'Storerooms', value: storerooms.length, note: 'Holding locations', icon: 'site' },
      ]} />

      <Note tone="grey">
        Quantities are a snapshot. The workbook carries no issue or receipt history, so there is
        no consumption trend on this screen and none is implied — movement tracking is a live
        feature rather than something this dataset can show.
      </Note>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14 }}>
        <Section title="Value by storeroom">
          <Bars data={byStoreroom} />
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 10 }}>US dollars, qty on hand × unit cost.</p>
        </Section>
        <Section title="Value by category">
          <Bars
            data={PART_CATEGORIES.map((c) => ({
              name: c,
              value: Math.round(all.filter((p) => p.category === c).reduce((s, p) => s + p._value, 0)),
            })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value)}
          />
        </Section>
      </div>

      <Section title="Holding">
        <Toolbar
          search={search} onSearch={setSearch}
          placeholder="Search part, category or supplier…"
          filters={[
            { label: 'Storeroom', value: storeroom, onChange: setStoreroom, options: storerooms },
            { label: 'Stock', value: state, onChange: setState, options: ['In stock', 'Approaching reorder', 'Below reorder point', 'Out of stock'] },
          ]}
        />

        <DataTable
          rows={rows}
          pageSize={15}
          onRowClick={() => router.push('/portal/dna/parts')}
          empty="No stock matches these filters."
          columns={[
            { key: 'partNo', label: 'Part No.', width: 106, render: (p) => <Ref>{p.partNo}</Ref> },
            { key: 'name', label: 'Part', render: (p) => <TwoLine top={p.name} bottom={p.category} /> },
            { key: 'storeroom', label: 'Storeroom', width: 96, render: (p) => <DeptChip code={p.storeroom} name={p._storeroomName} /> },
            {
              key: 'qtyOnHand', label: 'On hand', width: 132, align: 'right',
              sortValue: (p) => p._headroom,
              render: (p) => (
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {p.qtyOnHand}<span style={{ fontWeight: 500, color: '#94a3b8' }}> / {p.reorderPoint}</span>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <Meter
                      value={p.qtyOnHand}
                      max={Math.max(p.reorderPoint * 3, p.qtyOnHand, 1)}
                      tone={p._state === 'In stock' ? '#047857' : p._state === 'Approaching reorder' ? '#b45309' : '#b91c1c'}
                      height={5}
                    />
                  </div>
                </div>
              ),
            },
            { key: 'unitCost', label: 'Unit cost', width: 100, align: 'right', render: (p) => <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{money(p.unitCost)}</span> },
            {
              key: '_value', label: 'Holding value', width: 120, align: 'right',
              render: (p) => <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12.5, fontWeight: 700 }}>{money(p._value)}</span>,
            },
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

      <Section title="Where the value is concentrated" right={<span style={{ fontSize: 11.5, color: '#94a3b8' }}>top eight lines by holding value</span>}>
        <Bars data={dearest.map((p) => ({ name: `${p.partNo} ${p.name}`, value: Math.round(p._value) }))} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10, marginTop: 14 }}>
          <Fact label="Top eight" value={money(dearest.reduce((s, p) => s + p._value, 0))} sub={`${Math.round((dearest.reduce((s, p) => s + p._value, 0) / (value || 1)) * 100)}% of total holding`} />
          <Fact label="Remaining lines" value={all.length - dearest.length} sub={money(value - dearest.reduce((s, p) => s + p._value, 0))} />
        </div>
      </Section>
    </div>
  )
}
