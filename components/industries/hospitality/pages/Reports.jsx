'use client'

// Reports — the year, rather than the day.
//
// Everything else in this portal is about now. This is the screen a General
// Manager opens before a budget conversation, so it answers the two questions
// that conversation is actually about: is the backlog growing, and where does
// the money go.

import { useMemo } from 'react'
import {
  PageHeading, StatCards, Section, Card, BarPairs, HBars, Donut, PALETTE,
} from '../lib/kit'
import {
  MONTHS, WORK_ORDERS, ASSETS, SUITES, KPI, PM_SCHEDULES,
  isOpen, money,
} from '../lib/data'

const { ACCENT, INK, SUB, MUTE, GREEN } = PALETTE

export default function Reports() {
  const backlogTrend = useMemo(() => {
    // Cumulative raised minus completed, month by month. The level is what
    // matters, not either bar on its own — a month that raises eighty and closes
    // seventy-eight looks healthy and still adds two to the pile.
    let carried = 0
    return MONTHS.map((m) => {
      carried += m.raised - m.completed
      return { name: m.month, value: Math.max(0, carried) }
    })
  }, [])

  const byType = useMemo(() => {
    const m = {}
    WORK_ORDERS.forEach((w) => { m[w.work_order_type] = (m[w.work_order_type] || 0) + 1 })
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [])

  const costByAssetType = useMemo(() => {
    const m = {}
    WORK_ORDERS.forEach((w) => {
      const a = ASSETS.find((x) => x.asset_id === w.asset_id)
      const key = a?.asset_type || 'Other'
      m[key] = (m[key] || 0) + w.total_cost
    })
    return Object.entries(m)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [])

  const totalCost = MONTHS.reduce((n, m) => n + m.cost, 0)
  const perSuite = Math.round(totalCost / SUITES.length)
  const raised = MONTHS.reduce((n, m) => n + m.raised, 0)
  const completed = MONTHS.reduce((n, m) => n + m.completed, 0)

  return (
    <div>
      <PageHeading
        title="Reports"
        subtitle="Twelve months of work and what it cost"
      />

      <StatCards items={[
        { label: 'Raised', value: raised, note: 'work orders, 12 months' },
        { label: 'Completed', value: completed, tone: completed >= raised * 0.95 ? 'green' : 'amber', note: `${Math.round((completed / raised) * 100)}% of raised` },
        { label: 'Spend', value: money(totalCost), note: '12 months, parts and labour' },
        { label: 'Cost per suite', value: money(perSuite), note: 'per available suite, per year' },
      ]} />

      <Section
        title="Raised against completed"
        right={<span style={{ fontSize: 11.5, color: MUTE }}>Monthly, last twelve</span>}
      >
        <BarPairs
          data={MONTHS}
          keys={['raised', 'completed']}
          labels={['Raised', 'Completed']}
          colors={[ACCENT, GREEN]}
          height={200}
        />
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
        <Section
          title="Backlog carried"
          right={<span style={{ fontSize: 11.5, color: MUTE }}>Cumulative, month end</span>}
        >
          <HBars data={backlogTrend} color="#b45309" />
          <p style={{ margin: '13px 0 0', fontSize: 11.5, color: MUTE, lineHeight: 1.55 }}>
            Raised minus completed, carried forward. A month that closes almost everything
            it opens still adds to this — which is why the two bars above look fine while
            the pile grows.
          </p>
        </Section>

        <Section title="Work by type" right={<span style={{ fontSize: 11.5, color: MUTE }}>All raised</span>}>
          <Donut data={byType} size={150} thickness={24} />
        </Section>
      </div>

      <Section
        title="Where the money goes"
        right={<span style={{ fontSize: 11.5, color: MUTE }}>Total cost by asset type</span>}
      >
        <HBars data={costByAssetType.map((d) => ({ ...d, value: Math.round(d.value) }))} />
        <p style={{ margin: '13px 0 0', fontSize: 11.5, color: MUTE, lineHeight: 1.55 }}>
          Summed from the work orders raised against each type. In-suite equipment carries
          more of this than plant does, simply because there are {SUITES.length} of each rather
          than one — the per-unit cost tells the opposite story and both are worth reading.
        </p>
      </Section>

      <Card>
        <p style={{ margin: 0, fontSize: 11.5, color: MUTE, lineHeight: 1.55 }}>
          Modelled figures over a modelled year. The shape is what a property of this size
          and type produces; the amounts are not this property&rsquo;s accounts and should not be
          quoted as them. {PM_SCHEDULES.length} PM schedules and {KPI.assets_total} assets sit behind them.
        </p>
      </Card>
    </div>
  )
}
