'use client'

// Inventory > Vendors — who supplies what, built from the catalogue.
//
// The workbook has no vendor sheet. It has a Supplier column on every part, and
// seventeen distinct names in it: the loom OEMs, the chemical houses, the
// electrical brands. That is enough to answer the questions this screen exists
// for — who do we buy from, what do they cover, and what is a shortage going to
// cost with them — without a vendor register having been supplied.
//
// What it deliberately does not show is lead time, payment terms or contact
// details. None of those are in the source, and a supplier screen with an
// invented "5 day lead time" against a real company name is a specific kind of
// wrong: it reads as fact and it is checkable.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Section, DataTable, Toolbar, StatusBadge } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, TwoLine, Note, Bars, Fact } from '../components/cells'
import { useDept } from '../lib/deptStore'
import { parts, money, purchaseOrders } from '../lib/data'

export default function Vendors() {
  const router = useRouter()
  const { scope, deptName } = useDept()
  const [search, setSearch] = useState('')
  const [risk, setRisk] = useState('all')

  const scoped = useMemo(() => scope(parts), [scope])

  // A vendor is a grouping of the parts that name it, so the figures can never
  // disagree with the catalogue they are counted from.
  const vendors = useMemo(() => {
    const m = new Map()
    scoped.forEach((p) => {
      if (!p.supplier) return
      if (!m.has(p.supplier)) m.set(p.supplier, [])
      m.get(p.supplier).push(p)
    })
    return [...m.entries()].map(([name, lines]) => {
      const short = lines.filter((p) => p._state === 'Below reorder point' || p._state === 'Out of stock')
      return {
        name,
        lines,
        lineCount: lines.length,
        value: Number(lines.reduce((s, p) => s + p._value, 0).toFixed(2)),
        short: short.length,
        // What a requisition with this vendor would come to right now.
        outstanding: Number(short.reduce((s, p) => s + (p.reorderQty || 0) * (p.unitCost || 0), 0).toFixed(2)),
        categories: [...new Set(lines.map((p) => p.category))],
        assets: [...new Set(lines.flatMap((p) => p.compatible))],
        // What has actually been bought from them, as opposed to what they
        // could supply — the difference between a catalogue entry and a
        // trading relationship.
        orders: purchaseOrders.filter((po) => po.vendor === name),
        openOrders: purchaseOrders.filter((po) => po.vendor === name && po._open),
      }
    }).sort((a, b) => b.value - a.value)
  }, [scoped])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return vendors.filter((v) => (
      (risk === 'all'
        || (risk === 'Has a shortage' && v.short > 0)
        || (risk === 'Sole source' && v.lineCount === 1)
        || (risk === 'All supplied' && v.short === 0)) &&
      (!q || [v.name, ...v.categories, ...v.lines.map((p) => p.name)].join(' ').toLowerCase().includes(q))
    ))
  }, [vendors, search, risk])

  const withShortage = vendors.filter((v) => v.short > 0)
  const totalOutstanding = withShortage.reduce((s, v) => s + v.outstanding, 0)
  const soleSource = vendors.filter((v) => v.lineCount === 1)

  return (
    <div>
      <PageHeading
        title="Vendors"
        subtitle={`Suppliers behind the parts catalogue, what each covers, and what is currently owing to them. ${deptName}.`}
      />

      <StatCards items={[
        { label: 'Suppliers', value: vendors.length, note: 'Named on the catalogue', icon: 'people' },
        { label: 'Catalogue value', value: money(vendors.reduce((s, v) => s + v.value, 0)), note: 'Held across all suppliers' },
        { label: 'With a shortage', value: withShortage.length, tone: withShortage.length ? 'warning' : 'success', note: withShortage.map((v) => v.name).join(', ') || 'None' },
        { label: 'Open requisition', value: money(totalOutstanding), tone: totalOutstanding ? 'warning' : 'success', note: 'If every shortage were ordered' },
        { label: 'Single-line suppliers', value: soleSource.length, note: 'One part each' },
      ]} />

      <Note tone="grey">
        Built from the Supplier column on the parts catalogue — the workbook has no vendor
        register. Lead times, payment terms and contacts are therefore not shown: none of them
        were supplied, and inventing them against real company names would read as fact.
      </Note>

      <Section title="Supplier list">
        <Toolbar
          search={search} onSearch={setSearch}
          placeholder="Search supplier, category or part…"
          filters={[{ label: 'Filter', value: risk, onChange: setRisk, options: ['Has a shortage', 'Sole source', 'All supplied'] }]}
        />

        <DataTable
          rows={rows}
          pageSize={20}
          empty="No suppliers match these filters."
          columns={[
            {
              key: 'name', label: 'Supplier',
              render: (v) => <TwoLine top={v.name} bottom={v.categories.join(' · ')} />,
            },
            {
              key: 'lineCount', label: 'Lines', width: 82, align: 'right',
              render: (v) => <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v.lineCount}</span>,
            },
            {
              key: 'assets', label: 'Assets covered', width: 120, align: 'right',
              sortValue: (v) => v.assets.length,
              render: (v) => <span style={{ fontSize: 12, color: '#475569', fontVariantNumeric: 'tabular-nums' }}>{v.assets.length || '—'}</span>,
            },
            {
              key: 'value', label: 'Stock held', width: 120, align: 'right',
              render: (v) => <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12.5, fontWeight: 600 }}>{money(v.value)}</span>,
            },
            {
              key: 'short', label: 'Short', width: 90, align: 'right',
              render: (v) => (v.short
                ? <span style={{ color: '#b91c1c', fontWeight: 700, fontSize: 12.5 }}>{v.short}</span>
                : <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>),
            },
            {
              key: 'outstanding', label: 'To order', width: 116, align: 'right',
              render: (v) => (v.outstanding
                ? <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12.5, fontWeight: 700, color: '#b45309' }}>{money(v.outstanding)}</span>
                : <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>),
            },
            {
              key: 'orders', label: 'Orders', width: 120, align: 'right',
              sortValue: (v) => v.orders.length,
              render: (v) => (v.orders.length
                ? <span style={{ fontSize: 12 }}>{v.orders.length}{v.openOrders.length ? ` · ${v.openOrders.length} open` : ''}</span>
                : <span style={{ fontSize: 12, color: '#cbd5e1' }}>—</span>),
            },
            {
              key: 'status', label: 'Status', width: 130, sortable: false,
              render: (v) => <StatusBadge tone={v.short ? 'amber' : 'green'}>{v.short ? 'Order due' : 'Supplied'}</StatusBadge>,
            },
          ]}
        />
      </Section>

      {withShortage.length > 0 && (
        <Section
          title="Suppliers to contact"
          right={<button onClick={() => router.push('/portal/dna/demand-parts')} style={link}>Demand parts →</button>}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
            {withShortage.map((v) => (
              <div key={v.name} style={{ padding: '14px 16px', border: '1px solid #e4e9f0', borderLeft: '3px solid #b45309', borderRadius: 11, background: '#fff' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{v.name}</div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>{v.categories.join(' · ')}</div>
                <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                  {v.lines.filter((p) => p._state !== 'In stock' && p._state !== 'Approaching reorder').map((p) => (
                    <div key={p.partNo} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11.5 }}>
                      <span style={{ color: '#334155' }}><Ref>{p.partNo}</Ref> {p.name}</span>
                      <span style={{ color: '#b45309', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        order {p.reorderQty}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 11, paddingTop: 10, borderTop: '1px solid #eef1f6', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#64748b' }}>Requisition value</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{money(v.outstanding)}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Stock held by supplier">
        <Bars data={vendors.slice(0, 10).map((v) => ({ name: v.name, value: Math.round(v.value) }))} />
      </Section>
    </div>
  )
}

const link = { background: 'none', border: 'none', color: '#15227a', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }
