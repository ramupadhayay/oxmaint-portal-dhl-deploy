'use client'

import { useMemo, useState } from 'react'
import { PageHeader, Card, Section, StatStrip, ActionButton, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import {
  ASSETS, WORK_ORDERS, PM_SCHEDULES, PARTS, INSPECTIONS, INCIDENTS,
  KPI, OPEN_STATUS, EPOCH, isPast, daysUntil, money,
  hours,
} from '../lib/data'

const { ACCENT, INK, SUB, MUTE, LINE } = PALETTE

const GROUPS = ['Asset', 'Work Order', 'Inspection', 'Inventory']

// The ones a maintenance manager would put on a dashboard on day one. Everything
// else in the catalogue is opt-in, which is the point of having a catalogue.
const DEFAULT_ON = [
  'open_work_orders', 'overdue_work_orders', 'pm_compliance', 'assets_down',
  'mttr', 'maintenance_cost', 'stock_valuation', 'inspection_pass_rate',
]

export default function Kpis() {
  const { scope, siteName } = useSite()
  const [group, setGroup] = useState('All')
  const [selected, setSelected] = useState(() => new Set(DEFAULT_ON))

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const catalogue = useMemo(() => {
    const assets = scope(ASSETS)
    const wos = scope(WORK_ORDERS)
    const pms = scope(PM_SCHEDULES)
    const parts = scope(PARTS)
    const insp = scope(INSPECTIONS)
    const incidents = scope(INCIDENTS)

    const open = wos.filter((w) => OPEN_STATUS.includes(w.status))
    const done = wos.filter((w) => w.status === 'Completed')
    const planned = wos.filter((w) => w.work_order_type === 'Preventive' || w.work_order_type === 'Inspection')

    const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0)
    const mean = (rows, f, dp = 1) => (rows.length ? Number((rows.reduce((n, r) => n + f(r), 0) / rows.length).toFixed(dp)) : 0)

    // Closure time is measured from raised to completed, not from the due date —
    // a job closed late is still a job that took the time it took, and mixing
    // the two is how "average days to close" ends up negative.
    const closureDays = done
      .filter((w) => w.completed_date)
      .map((w) => (new Date(w.completed_date).getTime() - new Date(w.created_date).getTime()) / 86400000)

    return [
      // ── Asset ──────────────────────────────────────────────────────────
      { id: 'assets_total', group: 'Asset', name: 'Assets registered', value: assets.length, unit: '', def: 'Every asset on the register, whatever its status.' },
      { id: 'assets_operational', group: 'Asset', name: 'Assets operational', value: pct(assets.filter((a) => a.status === 'Operational').length, assets.length), unit: '%', def: 'Share of the register running normally right now.' },
      { id: 'assets_down', group: 'Asset', name: 'Assets down', value: assets.filter((a) => a.status === 'Down').length, unit: '', def: 'Assets stopped and unavailable to production.' },
      { id: 'assets_maintenance', group: 'Asset', name: 'Assets under maintenance', value: assets.filter((a) => a.status === 'Under Maintenance').length, unit: '', def: 'Off line by plan rather than by failure.' },
      { id: 'avg_health', group: 'Asset', name: 'Average health score', value: Math.round(mean(assets, (a) => a.health_score, 0)), unit: '%', def: 'Mean condition index across the register.' },
      { id: 'critical_assets', group: 'Asset', name: 'High-criticality assets', value: assets.filter((a) => a.criticality === 'High').length, unit: '', def: 'Assets whose failure stops production or breaches a duty.' },
      { id: 'iot_coverage', group: 'Asset', name: 'Condition monitoring coverage', value: pct(assets.filter((a) => a.iot_enabled).length, assets.length), unit: '%', def: 'Assets sending live condition data rather than waiting for a round.' },
      { id: 'warranty_soon', group: 'Asset', name: 'Warranty expiring in 90 days', value: assets.filter((a) => !isPast(a.warranty_expiry) && daysUntil(a.warranty_expiry) <= 90).length, unit: '', def: 'Last chance to claim before the cover lapses.' },
      { id: 'out_of_warranty', group: 'Asset', name: 'Assets out of warranty', value: assets.filter((a) => isPast(a.warranty_expiry)).length, unit: '', def: 'Repairs on these come out of the maintenance budget.' },
      { id: 'avg_age', group: 'Asset', name: 'Average asset age', value: mean(assets, (a) => (EPOCH - new Date(a.purchase_date).getTime()) / (86400000 * 365.25)), unit: 'yrs', def: 'Mean time since purchase — the shape of the replacement curve.' },
      { id: 'avg_runtime', group: 'Asset', name: 'Average running hours', value: Math.round(mean(assets, (a) => a.running_hours, 0)), unit: 'h', def: 'Mean hours on the clock across the register.' },

      // ── Work Order ─────────────────────────────────────────────────────
      { id: 'open_work_orders', group: 'Work Order', name: 'Open work orders', value: open.length, unit: '', def: 'Raised and not yet completed or cancelled.' },
      { id: 'overdue_work_orders', group: 'Work Order', name: 'Overdue work orders', value: open.filter((w) => isPast(w.due_date)).length, unit: '', def: 'Still open past the agreed due date.' },
      { id: 'critical_open', group: 'Work Order', name: 'Critical work open', value: open.filter((w) => w.priority === 'Critical').length, unit: '', def: 'Open jobs marked critical — the front of every queue.' },
      { id: 'completion_rate', group: 'Work Order', name: 'Completion rate', value: pct(done.length, wos.length), unit: '%', def: 'Completed as a share of everything raised.' },
      { id: 'pm_compliance', group: 'Work Order', name: 'PM compliance', value: pct(pms.filter((p) => !isPast(p.next_due)).length, pms.length), unit: '%', def: 'Schedules still inside their window.' },
      { id: 'pm_overdue', group: 'Work Order', name: 'Schedules overdue', value: pms.filter((p) => isPast(p.next_due)).length, unit: '', def: 'Preventive work that has already slipped.' },
      { id: 'planned_ratio', group: 'Work Order', name: 'Planned work ratio', value: pct(planned.length, wos.length), unit: '%', def: 'Preventive and inspection work as a share of all jobs. Above 70% is a planned plant.' },
      { id: 'breakdown_share', group: 'Work Order', name: 'Breakdown share', value: pct(wos.filter((w) => w.work_order_type === 'Breakdown').length, wos.length), unit: '%', def: 'Reactive failure work as a share of all jobs.' },
      { id: 'mttr', group: 'Work Order', name: 'Mean time to repair', value: mean(done, (w) => w.actual_hours || 0), unit: 'h', def: 'Average hands-on hours booked to a completed job.' },
      { id: 'avg_close_days', group: 'Work Order', name: 'Average days to close', value: closureDays.length ? Number((closureDays.reduce((n, v) => n + v, 0) / closureDays.length).toFixed(1)) : 0, unit: 'd', def: 'Calendar days from raising a job to closing it.' },
      { id: 'backlog_hours', group: 'Work Order', name: 'Backlog hours', value: open.reduce((n, w) => n + (w.estimated_hours || 0), 0), unit: 'h', def: 'Estimated hours sitting in the open queue.' },
      { id: 'downtime', group: 'Work Order', name: 'Downtime logged', value: hours(wos.reduce((n, w) => n + w.downtime_hours, 0)), unit: 'h', def: 'Production hours lost to maintenance events.' },
      { id: 'maintenance_cost', group: 'Work Order', name: 'Maintenance spend', value: money(wos.reduce((n, w) => n + w.total_cost, 0)), unit: '', def: 'Labour and parts booked against work orders.' },
      { id: 'cost_per_wo', group: 'Work Order', name: 'Average cost per job', value: money(Math.round(wos.reduce((n, w) => n + w.total_cost, 0) / Math.max(1, wos.length))), unit: '', def: 'Total spend divided by jobs raised.' },
      { id: 'estimate_accuracy', group: 'Work Order', name: 'Estimate accuracy', value: pct(done.filter((w) => w.actual_hours != null && w.actual_hours <= w.estimated_hours * 1.25).length, done.filter((w) => w.actual_hours != null).length), unit: '%', def: 'Completed jobs that came in within a quarter of their estimate.' },

      // ── Inspection ─────────────────────────────────────────────────────
      { id: 'inspections_total', group: 'Inspection', name: 'Inspections recorded', value: insp.length, unit: '', def: 'Every inspection on the record, all types.' },
      { id: 'inspection_pass_rate', group: 'Inspection', name: 'Inspection pass rate', value: pct(insp.filter((i) => i.result === 'Pass').length, insp.length), unit: '%', def: 'Clean passes as a share of all inspections.' },
      { id: 'inspections_failed', group: 'Inspection', name: 'Failed inspections', value: insp.filter((i) => i.result === 'Fail').length, unit: '', def: 'Inspections that found the asset unfit as it stood.' },
      { id: 'open_findings', group: 'Inspection', name: 'Open findings', value: insp.reduce((n, i) => n + i.findings_count, 0), unit: '', def: 'Individual defects raised by inspection.' },
      { id: 'avg_inspection_score', group: 'Inspection', name: 'Average inspection score', value: Math.round(mean(insp, (i) => i.score, 0)), unit: '%', def: 'Mean score across every inspection recorded.' },
      { id: 'avg_inspection_time', group: 'Inspection', name: 'Average inspection time', value: Math.round(mean(insp, (i) => i.duration_minutes, 0)), unit: 'min', def: 'How long a round actually takes, on average.' },
      { id: 'open_incidents', group: 'Inspection', name: 'Open incidents', value: incidents.filter((i) => i.status !== 'Closed').length, unit: '', def: 'Safety incidents not yet closed out.' },

      // ── Inventory ──────────────────────────────────────────────────────
      { id: 'parts_lines', group: 'Inventory', name: 'Catalogue lines', value: parts.length, unit: '', def: 'Distinct part numbers held.' },
      { id: 'stock_valuation', group: 'Inventory', name: 'Stock valuation', value: money(Math.round(parts.reduce((n, p) => n + p.total_value, 0))), unit: '', def: 'Quantity on hand at unit cost, across the stores.' },
      { id: 'parts_low', group: 'Inventory', name: 'Lines below reorder point', value: parts.filter((p) => p.status === 'Low Stock').length, unit: '', def: 'Still available, but past the point where an order should be placed.' },
      { id: 'parts_out', group: 'Inventory', name: 'Lines out of stock', value: parts.filter((p) => p.status === 'Out of Stock').length, unit: '', def: 'Nothing on the shelf — the usual reason a job waits.' },
      { id: 'stock_availability', group: 'Inventory', name: 'Stock availability', value: pct(parts.filter((p) => p.status === 'In Stock').length, parts.length), unit: '%', def: 'Share of the catalogue at or above its reorder point.' },
      { id: 'avg_unit_cost', group: 'Inventory', name: 'Average unit cost', value: money(Math.round(parts.reduce((n, p) => n + p.unit_cost, 0) / Math.max(1, parts.length))), unit: '', def: 'Mean cost of a catalogue line.' },
      { id: 'suppliers', group: 'Inventory', name: 'Active suppliers', value: new Set(parts.map((p) => p.vendor_name)).size, unit: '', def: 'Distinct suppliers behind the catalogue.' },
    ]
  }, [scope])

  const shown = group === 'All' ? catalogue : catalogue.filter((k) => k.group === group)

  return (
    <div>
      <PageHeader
        icon={sectionIcon('kpis', '#15227a')}
        title="KPIs"
        subtitle={`${catalogue.length} indicators · ${selected.size} on the dashboard · ${siteName}`}
        right={<ActionButton variant="ghost" onClick={() => setSelected(new Set(DEFAULT_ON))}>Reset to defaults</ActionButton>}
      />

      {/* Deliberately the organisation-wide figures, not the site-filtered ones:
          this strip is the headline the account is measured on, and the cards
          below carry the site cut. The labels say which is which. */}
      <StatStrip items={[
        { label: 'Assets', value: KPI.assets_total, note: `${KPI.assets_down} down · organisation-wide` },
        { label: 'Open work', value: KPI.work_orders_open, tone: 'amber', note: `${KPI.work_orders_overdue} overdue` },
        { label: 'PM compliance', value: KPI.pm_compliance, unit: '%', tone: KPI.pm_compliance >= 85 ? 'green' : 'amber', note: `${KPI.pm_overdue} schedules late` },
        { label: 'MTTR', value: KPI.mttr_hours, unit: 'h', note: `${hours(KPI.downtime_hours)}h downtime` },
        { label: 'Inspection pass rate', value: KPI.inspections_pass_rate, unit: '%', tone: 'green', note: `${KPI.inspections_failed} failed` },
        { label: 'Maintenance spend', value: money(KPI.maintenance_cost), note: 'all work orders' },
      ]} />

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {['All', ...GROUPS].map((g) => (
          <button key={g} onClick={() => setGroup(g)} style={{
            padding: '7px 14px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
            borderRadius: 9, border: `1px solid ${group === g ? ACCENT : LINE}`,
            background: group === g ? ACCENT : '#fff', color: group === g ? '#fff' : SUB,
          }}>
            {g}
            <span style={{ marginLeft: 6, opacity: 0.75, fontWeight: 600 }}>
              {g === 'All' ? catalogue.length : catalogue.filter((k) => k.group === g).length}
            </span>
          </button>
        ))}
      </div>

      <Card style={{ marginBottom: 14, padding: '13px 16px', background: '#f8fafc', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ marginTop: 1 }}>{sectionIcon('kpis', ACCENT)}</div>
        <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.55 }}>
          Every value here is counted from the live record at the moment the page loads — none of them are
          stored or typed in. Switch a KPI on to pin it to your dashboard; the selection is yours and does
          not change what anyone else sees.
        </p>
      </Card>

      {(group === 'All' ? GROUPS : [group]).map((g) => {
        const rows = shown.filter((k) => k.group === g)
        if (!rows.length) return null
        return (
          <Section key={g} title={`${g} indicators`}
            right={<span style={{ fontSize: 11.5, color: MUTE }}>{rows.filter((r) => selected.has(r.id)).length} of {rows.length} on the dashboard</span>}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(268px,1fr))', gap: 12 }}>
              {rows.map((k) => {
                const on = selected.has(k.id)
                return (
                  <div key={k.id} style={{
                    border: `1px solid ${on ? '#c7d2fe' : LINE}`, borderRadius: 12, padding: '13px 14px',
                    background: on ? '#f8faff' : '#fff', display: 'flex', flexDirection: 'column', gap: 7,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: INK, lineHeight: 1.35 }}>{k.name}</span>
                      <Toggle on={on} onChange={() => toggle(k.id)} label={k.name} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                      <span style={{ fontSize: 23, fontWeight: 800, color: INK, lineHeight: 1 }}>{k.value}</span>
                      {k.unit && <span style={{ fontSize: 12, fontWeight: 600, color: SUB }}>{k.unit}</span>}
                    </div>
                    <p style={{ margin: 0, fontSize: 11.5, color: MUTE, lineHeight: 1.45 }}>{k.def}</p>
                  </div>
                )
              })}
            </div>
          </Section>
        )
      })}
    </div>
  )
}

function Toggle({ on, onChange, label }) {
  return (
    <button type="button" onClick={onChange} role="switch" aria-checked={on} aria-label={`Show ${label} on the dashboard`}
      style={{
        width: 34, height: 19, borderRadius: 999, flexShrink: 0, cursor: 'pointer', padding: 0,
        border: `1px solid ${on ? ACCENT : '#cbd5e1'}`, background: on ? ACCENT : '#e2e8f0',
        position: 'relative', transition: 'background .15s',
      }}>
      <span style={{
        position: 'absolute', top: 1.5, left: on ? 16 : 1.5, width: 14, height: 14, borderRadius: '50%',
        background: '#fff', transition: 'left .15s', boxShadow: '0 1px 2px rgba(15,23,42,0.25)',
      }} />
    </button>
  )
}
