'use client'

import { useMemo } from 'react'
import { PageHeader, StatStrip, Section, DataTable, BarPairs, HBars, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { WORK_ORDERS, money } from '../lib/data'
import { FINANCIALS } from '../lib/dataOps'

const { MUTE, SUB, INK, GREEN, RED } = PALETTE

function Variance({ value }) {
  const over = value > 0
  return (
    <span style={{ fontWeight: 700, color: over ? RED : GREEN, whiteSpace: 'nowrap' }}>
      {over ? '+' : '−'}{money(Math.abs(value))}
    </span>
  )
}

export default function Financial() {
  const spend = FINANCIALS.reduce((n, m) => n + m.total, 0)
  const budget = FINANCIALS.reduce((n, m) => n + m.budget, 0)
  const variance = spend - budget

  const split = useMemo(() => {
    const lines = [
      ['Labour', FINANCIALS.reduce((n, m) => n + m.labour, 0)],
      ['Parts and materials', FINANCIALS.reduce((n, m) => n + m.parts, 0)],
      ['Contractors', FINANCIALS.reduce((n, m) => n + m.contractor, 0)],
    ]
    const total = lines.reduce((n, [, v]) => n + v, 0) || 1
    // The bar is drawn from the share and the money is carried in the label:
    // HBars measures its width from the value, so a formatted string in that
    // field would leave every bar at zero width.
    return lines.map(([name, value]) => ({ name: `${name} — ${money(value)}`, value: Math.round((value / total) * 100) }))
  }, [])

  const columns = [
    { key: 'month', label: 'Month', render: (m) => <span style={{ fontWeight: 700, color: INK }}>{m.month}</span> },
    { key: 'labour', label: 'Labour', align: 'right', render: (m) => money(m.labour) },
    { key: 'parts', label: 'Parts', align: 'right', render: (m) => money(m.parts) },
    { key: 'contractor', label: 'Contractor', align: 'right', render: (m) => money(m.contractor) },
    { key: 'total', label: 'Total', align: 'right', render: (m) => <span style={{ fontWeight: 700 }}>{money(m.total)}</span> },
    { key: 'budget', label: 'Budget', align: 'right', render: (m) => <span style={{ color: SUB }}>{money(m.budget)}</span> },
    {
      key: 'variance', label: 'Variance', align: 'right', sortValue: (m) => m.total - m.budget,
      render: (m) => <Variance value={m.total - m.budget} />,
    },
  ]

  return (
    <div>
      <PageHeader
        icon={sectionIcon('financial', '#15227a')}
        title="Financial Management"
        subtitle="Maintenance spend against budget · organisation-wide · 12 months"
      />

      <StatStrip items={[
        { label: 'Spend YTD', value: money(spend) },
        { label: 'Budget', value: money(budget) },
        {
          label: 'Variance', value: money(Math.abs(variance)),
          tone: variance > 0 ? 'red' : 'green',
          note: variance > 0 ? 'over budget' : 'under budget',
        },
        {
          label: 'Cost per work order',
          // The ledger is organisation-level, so the divisor has to be too.
          // Dividing group spend by one site's work orders would invent a cost
          // per job three times the truth.
          value: money(Math.round(spend / Math.max(1, WORK_ORDERS.length))),
          note: `${WORK_ORDERS.length} work orders`,
        },
      ]} />

      <Section title="Spend against budget"
        right={<span style={{ fontSize: 11.5, color: MUTE }}>budget phased evenly across the year</span>}>
        <BarPairs data={FINANCIALS} keys={['total', 'budget']} labels={['Actual', 'Budget']} />
      </Section>

      <Section title="Where the money goes">
        <HBars data={split} unit="%" />
      </Section>

      <Section title="Monthly ledger">
        <DataTable columns={columns} rows={FINANCIALS} pageSize={12} empty="No months in the ledger." />
      </Section>
    </div>
  )
}
