'use client'

// Purchasing > Demand Parts — what needs ordering, and why.
//
// This is the procurement half of "parts inventory management" on the customer's
// list, and it is the screen that only works because the catalogue now has real
// shortages in it. Three lines are at or below their reorder point, and each of
// them ties to a fault or a schedule already live elsewhere in the portal: the
// loom reed serves the three air-jet looms and one of those is down, the FR
// finish chemical feeds the range with an open critical zone fault, and the
// compressor filter is what next month's PM consumes.
//
// That is the demo moment worth building toward — not "here is a table of
// parts", but "the system worked out what to buy, and here is the job each one
// is holding up".
//
// Quantity to order is the reorder quantity the sheet already carries, not a
// calculated economic order quantity. There is no consumption history to compute
// one from, and a made-up EOQ would be a number nobody could reproduce.

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Section, DataTable, StatusBadge } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, DeptChip, TwoLine, Note, Fact, Meter } from '../components/cells'
import { useDept } from '../lib/deptStore'
import { parts, workOrders, pmSchedules, assets, money, posForPart } from '../lib/data'

export default function DemandParts() {
  const router = useRouter()
  const { scope, deptName } = useDept()

  const scoped = useMemo(() => scope(parts), [scope])

  // Anything at or below its trigger, with the work each one is blocking found
  // through the assets it fits.
  const demand = useMemo(() => scoped
    .filter((p) => p._state === 'Below reorder point' || p._state === 'Out of stock')
    .map((p) => {
      const jobs = workOrders.filter((w) => p.compatible.includes(w.assetId) && w._open)
      const pms = pmSchedules.filter((s) => p.compatible.includes(s.assetId) && s._daysToDue !== null && s._daysToDue <= 30)
      const down = assets.filter((a) => p.compatible.includes(a.assetId) && a.status === 'Down')
      const orders = posForPart(p.partNo).filter((o) => o._open)
      return {
        ...p,
        _orders: orders,
        _onOrder: orders.reduce((s, o) => s + o._outstanding, 0),
        _orderQty: p.reorderQty || 0,
        _orderValue: Number(((p.reorderQty || 0) * (p.unitCost || 0)).toFixed(2)),
        _shortBy: Math.max(0, (p.reorderPoint || 0) - (p.qtyOnHand || 0)),
        _jobs: jobs,
        _pms: pms,
        _down: down,
        _urgent: down.length > 0 || jobs.some((w) => ['Critical', 'High'].includes(w.priority)),
      }
    })
    .sort((a, b) => (b._urgent - a._urgent) || (a.qtyOnHand - b.qtyOnHand)), [scoped])

  const approaching = scoped.filter((p) => p._state === 'Approaching reorder')
  const totalValue = demand.reduce((s, p) => s + p._orderValue, 0)
  const suppliers = [...new Set(demand.map((p) => p.supplier))]

  return (
    <div>
      <PageHeading
        title="Demand Parts"
        subtitle={`Lines at or below their reorder point, the work each one is holding up, and what the requisition comes to. ${deptName}.`}
      />

      <StatCards items={[
        { label: 'Lines to order', value: demand.length, tone: demand.length ? 'warning' : 'success', note: demand.length ? 'Below reorder point' : 'Nothing outstanding', icon: 'list' },
        { label: 'Requisition value', value: money(totalValue), tone: totalValue ? 'warning' : 'success' },
        { label: 'Suppliers involved', value: suppliers.length, note: suppliers.join(', ') || '—', icon: 'people' },
        { label: 'Blocking live work', value: demand.filter((p) => p._urgent).length, tone: demand.some((p) => p._urgent) ? 'destructive' : 'success', note: 'Asset down or high priority' },
        { label: 'Approaching next', value: approaching.length, note: approaching.map((p) => p.partNo).join(', ') || 'None', icon: 'clock' },
      ]} />

      {demand.length === 0 ? (
        <Note tone="good">
          Nothing is at or below its reorder point. {approaching.length} line
          {approaching.length === 1 ? '' : 's'} sit one unit above — those are what a stores
          controller watches next.
        </Note>
      ) : (
        <Note tone="warn">
          <b>{demand.length} lines need ordering, {money(totalValue)} in total.</b>{' '}
          {demand.filter((p) => p._urgent).length} of them are holding up work that is already
          open — the detail below names which job.
          {demand.some((p) => !p._orders.length) && (
            <> <b>{demand.filter((p) => !p._orders.length).length} have no purchase order raised
            against them at all.</b></>
          )}
        </Note>
      )}

      <Section title="Requisition">
        <DataTable
          rows={demand}
          pageSize={15}
          empty="Nothing needs ordering for this department."
          columns={[
            { key: 'partNo', label: 'Part No.', width: 106, render: (p) => <Ref>{p.partNo}</Ref> },
            { key: 'name', label: 'Part', render: (p) => <TwoLine top={p.name} bottom={p.category} /> },
            { key: 'storeroom', label: 'Storeroom', width: 96, render: (p) => <DeptChip code={p.storeroom} name={p._storeroomName} /> },
            {
              key: 'qtyOnHand', label: 'On hand', width: 124, align: 'right',
              sortValue: (p) => p.qtyOnHand,
              render: (p) => (
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: p.qtyOnHand === 0 ? '#b91c1c' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                    {p.qtyOnHand}<span style={{ fontWeight: 500, color: '#94a3b8' }}> / {p.reorderPoint}</span>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <Meter value={p.qtyOnHand} max={Math.max(p.reorderPoint, 1)} tone="#b91c1c" height={5} />
                  </div>
                </div>
              ),
            },
            {
              key: '_orderQty', label: 'Order', width: 82, align: 'right',
              render: (p) => <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{p._orderQty}</span>,
            },
            { key: 'unitCost', label: 'Unit', width: 92, align: 'right', render: (p) => <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{money(p.unitCost)}</span> },
            {
              key: '_orderValue', label: 'Line value', width: 112, align: 'right',
              render: (p) => <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12.5, fontWeight: 700 }}>{money(p._orderValue)}</span>,
            },
            { key: 'supplier', label: 'Supplier', width: 150 },
            {
              key: '_onOrder', label: 'On order', width: 168,
              sortValue: (p) => p._onOrder,
              render: (p) => (p._orders.length
                ? (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#b45309' }}>{p._onOrder} on the way</div>
                    <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2 }}>
                      {p._orders.map((o) => `${o.poNo} (${o.status})`).join(', ')}
                    </div>
                  </div>
                )
                : <span style={{ fontSize: 11.5, fontWeight: 700, color: '#b91c1c' }}>Nothing raised</span>),
            },
            {
              key: '_state', label: 'Stock', width: 152,
              render: (p) => <StatusBadge tone="red">{p._state}</StatusBadge>,
            },
          ]}
        />

        {demand.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, padding: '13px 4px 0', borderTop: '1px solid #eef1f6', marginTop: 12 }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>{demand.length} lines · {suppliers.length} suppliers</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{money(totalValue)}</span>
          </div>
        )}
      </Section>

      {demand.length > 0 && (
        <Section title="What each shortage is holding up">
          <div style={{ display: 'grid', gap: 12 }}>
            {demand.map((p) => (
              <div key={p.partNo} style={{ padding: '14px 16px', border: '1px solid #e4e9f0', borderLeft: `3px solid ${p._urgent ? '#b91c1c' : '#b45309'}`, borderRadius: 11, background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <div style={{ display: 'flex', gap: 9, alignItems: 'baseline' }}>
                    <Ref>{p.partNo}</Ref>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{p.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {p._urgent && <StatusBadge tone="red">Blocking live work</StatusBadge>}
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>{money(p._orderValue)}</span>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: '#475569', marginTop: 7, lineHeight: 1.55 }}>
                  {p.qtyOnHand === 0 ? 'Out of stock' : `${p.qtyOnHand} left against a reorder point of ${p.reorderPoint}`}
                  {' · '}order {p._orderQty} from {p.supplier}
                  {p.compatible.length ? ` · fits ${p.compatible.length} asset${p.compatible.length === 1 ? '' : 's'}` : ''}
                </div>

                {(p._down.length > 0 || p._jobs.length > 0 || p._pms.length > 0) && (
                  <div style={{ marginTop: 11, display: 'grid', gap: 6 }}>
                    {p._down.map((a) => (
                      <button key={a.assetId} onClick={() => router.push(`/portal/dna/assets/${a.assetId}`)} style={rowBtn}>
                        <StatusBadge tone="red">Down</StatusBadge>
                        <span style={{ fontSize: 12, color: '#0f172a' }}>{a.name} — {a.assetId}</span>
                      </button>
                    ))}
                    {p._jobs.map((w) => (
                      <button key={w.woNo} onClick={() => router.push(`/portal/dna/work-orders/${w.woNo}`)} style={rowBtn}>
                        <StatusBadge tone={w.priority === 'Critical' ? 'red' : 'amber'}>{w.woNo}</StatusBadge>
                        <span style={{ fontSize: 12, color: '#0f172a' }}>{w.title}</span>
                      </button>
                    ))}
                    {p._pms.map((s) => (
                      <button key={s.pmId} onClick={() => router.push(`/portal/dna/pm-schedules/${s.pmId}`)} style={rowBtn}>
                        <StatusBadge tone="violet">{s.pmId}</StatusBadge>
                        <span style={{ fontSize: 12, color: '#0f172a' }}>{s.task} — due in {s._daysToDue} days</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {approaching.length > 0 && (
        <Section title="Approaching the reorder point">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
            {approaching.map((p) => (
              <Fact
                key={p.partNo}
                label={p.partNo}
                value={`${p.qtyOnHand} of ${p.reorderPoint}`}
                sub={`${p.name} · ${p.supplier}`}
              />
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

const rowBtn = {
  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
  padding: '7px 9px', borderRadius: 8, border: '1px solid #eef1f6',
  background: '#f8fafc', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
}
