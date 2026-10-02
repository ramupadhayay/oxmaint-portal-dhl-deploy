'use client'

// The measures, with what each one is actually counting.
//
// A KPI screen that shows numbers without their definitions is a screen people
// argue over. "PM compliance 91%" means nothing until you know it is schedules
// not yet past due, over all schedules — and once you know that, you also know
// what it does not capture, which is the more useful half.

import { PageHeading, StatCards, Section, Card, StatusBadge, PALETTE } from '../lib/kit'
import { KPI, SUITE_COUNT, CYCLE_DAYS, SUITE_PM, money } from '../lib/data'
import { ROTATION } from '../lib/schedule'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, AMBER, RED } = PALETTE

const GROUPS = [
  {
    title: 'The rotation',
    note: 'The department’s largest standing commitment',
    items: [
      { label: 'Suites on the cycle', value: SUITE_COUNT, def: `Every suite gets a ${SUITE_PM.checklist.length}-point PM every ${CYCLE_DAYS} days.` },
      { label: 'Done this cycle', value: `${ROTATION.done}`, unit: `/ ${ROTATION.total}`, tone: ROTATION.done >= ROTATION.expected ? 'green' : 'amber', def: `Against ${ROTATION.expected} the plan calls for by day ${ROTATION.cyclePosition}. Measured against the plan to date, not the whole cycle.` },
      { label: 'Slipped', value: ROTATION.overdue, tone: ROTATION.overdue ? 'red' : 'green', def: 'Suites whose rotation date has passed without the PM being done. These carry to the top of the daily schedule.' },
      { label: 'Suites per day', value: ROTATION.perDay, def: `${SUITE_COUNT} suites ÷ ${CYCLE_DAYS} days. The number the schedule is built around.` },
    ],
  },
  {
    title: 'Work orders',
    note: 'Reactive work and how fast it closes',
    items: [
      { label: 'Open', value: KPI.work_orders_open, def: 'Status Open, In Progress or On Hold. Cancelled and Completed are excluded.' },
      { label: 'Overdue', value: KPI.work_orders_overdue, tone: KPI.work_orders_overdue ? 'amber' : 'green', def: 'Open work past its due date. A subset of open — a cancelled job cannot be late.' },
      { label: 'Critical open', value: KPI.work_orders_critical, tone: KPI.work_orders_critical ? 'red' : 'green', def: 'Priority Critical and still open.' },
      { label: 'Completion rate', value: `${KPI.completion_rate}%`, def: 'Completed ÷ all raised, over the whole record. Not a rolling window.' },
      { label: 'Mean time to repair', value: `${KPI.mttr_hours} h`, def: 'Average actual hours across completed work orders. Hours worked, not elapsed time — a job waiting on a part does not inflate it.' },
    ],
  },
  {
    title: 'Preventive',
    note: 'Whether the planned work is keeping up',
    items: [
      { label: 'PM compliance', value: `${KPI.pm_compliance}%`, tone: KPI.pm_compliance >= 90 ? 'green' : 'amber', def: `Schedules not yet past due ÷ all ${KPI.pm_total} schedules. It says nothing about how well each was done.` },
      { label: 'Schedules overdue', value: KPI.pm_overdue, tone: KPI.pm_overdue ? 'amber' : 'green', def: 'Schedules whose next due date has passed.' },
      { label: 'Inspections due in 90 days', value: KPI.inspections_due_90, def: 'External inspections — brand, fire, health, elevator — coming up inside a quarter.' },
    ],
  },
  {
    title: 'The estate',
    note: 'What there is and what is out',
    items: [
      { label: 'Assets', value: KPI.assets_total, def: `${SUITE_COUNT} suites of in-suite equipment plus the plant behind them.` },
      { label: 'Down', value: KPI.assets_down, tone: KPI.assets_down ? 'red' : 'green', def: 'Not available. In a suite that usually means the room cannot be sold.' },
      { label: 'Suites occupied', value: KPI.suites_occupied, unit: `/ ${KPI.suites_total}`, def: 'Occupancy at this moment. It sets how many suites can actually be entered today.' },
      { label: 'Guest requests waiting', value: KPI.requests_open, tone: KPI.requests_open ? 'amber' : 'green', def: 'Raised and not yet triaged into a work order.' },
    ],
  },
  {
    title: 'Stores and cost',
    note: 'What the department spends and holds',
    items: [
      { label: 'Stock value', value: money(KPI.inventory_value), def: 'Quantity on hand × unit cost, across every line.' },
      { label: 'Out of stock', value: KPI.parts_out, tone: KPI.parts_out ? 'red' : 'green', def: 'Lines at zero. Each one is a job that cannot finish today.' },
      { label: 'Maintenance cost', value: money(KPI.maintenance_cost), def: 'Summed across every work order in the record, parts and labour together.' },
      { label: 'Open incidents', value: KPI.open_incidents, tone: KPI.open_incidents ? 'amber' : 'green', def: 'Incidents not yet closed out.' },
    ],
  },
]

export default function Kpis() {
  return (
    <div>
      <PageHeading
        title="KPIs"
        subtitle="Every measure with the arithmetic behind it"
      />

      <StatCards items={[
        { label: 'Rotation', value: `${ROTATION.coverage}%`, tone: ROTATION.done >= ROTATION.expected ? 'green' : 'amber', note: `day ${ROTATION.cyclePosition} of ${CYCLE_DAYS}` },
        { label: 'PM compliance', value: `${KPI.pm_compliance}%`, tone: KPI.pm_compliance >= 90 ? 'green' : 'amber', note: `${KPI.pm_total} schedules` },
        { label: 'Open work', value: KPI.work_orders_open, note: `${KPI.work_orders_overdue} overdue` },
        { label: 'MTTR', value: `${KPI.mttr_hours} h`, note: 'hours worked per job' },
      ]} />

      {GROUPS.map((g) => (
        <Section key={g.title} title={g.title} right={<span style={{ fontSize: 11.5, color: MUTE }}>{g.note}</span>}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {g.items.map((it) => (
              <div key={it.label} style={{
                display: 'flex', gap: 14, alignItems: 'flex-start',
                padding: '11px 2px', borderBottom: `1px solid ${LINE}`, flexWrap: 'wrap',
              }}>
                <div style={{ minWidth: 150, flex: '0 0 auto' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 }}>{it.label}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 3 }}>
                    <span style={{
                      fontSize: 21, fontWeight: 800, lineHeight: 1,
                      color: it.tone === 'green' ? GREEN : it.tone === 'amber' ? AMBER : it.tone === 'red' ? RED : INK,
                    }}>{it.value}</span>
                    {it.unit && <span style={{ fontSize: 12, color: SUB, fontWeight: 600 }}>{it.unit}</span>}
                  </div>
                </div>
                <p style={{ margin: 0, flex: '1 1 260px', fontSize: 12.5, color: SUB, lineHeight: 1.55 }}>{it.def}</p>
              </div>
            ))}
          </div>
        </Section>
      ))}

      <Card>
        <p style={{ margin: 0, fontSize: 11.5, color: MUTE, lineHeight: 1.55 }}>
          Every figure here is computed from the portal&rsquo;s own records. None of it is
          benchmarked against an industry average, because a benchmark drawn from a
          different property type would be a comparison, not a measure.
        </p>
      </Card>
    </div>
  )
}
