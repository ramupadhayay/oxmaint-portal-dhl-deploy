'use client'

import { useMemo, useState } from 'react'
import {
  PageHeader, Card, Section, StatStrip, DataTable, Drawer, Fields,
  StatusBadge, Priority, PALETTE,
} from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import {
  ASSETS, WORK_ORDERS, PM_SCHEDULES, PARTS, INSPECTIONS, DOCUMENTS, DEMAND_PARTS,
  LOCATIONS, TECHNICIANS, OPEN_STATUS, DOMAIN, isPast, fmtDate, daysUntil,
} from '../lib/data'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN } = PALETTE

const SEVERITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 }

// The advice on a check, in the pack's words where it has them. A GSE shop
// books a mechanic check, not a condition survey, and owns units, not machines.
const FIX = DOMAIN?.auditorFixes || {}

export default function AiAuditor() {
  const { scope, siteName } = useSite()
  const [openId, setOpenId] = useState(null)

  const audit = useMemo(() => {
    const assets = scope(ASSETS)
    const wos = scope(WORK_ORDERS)
    const pms = scope(PM_SCHEDULES)
    const parts = scope(PARTS)
    const insp = scope(INSPECTIONS)
    const docs = scope(DOCUMENTS)
    const demand = scope(DEMAND_PARTS)

    // The location lookup is built from the unfiltered list on purpose. Scoping
    // it would make every cross-site location resolve to undefined and the
    // mismatch check would then flag the whole register — the check exists
    // precisely to find the rows whose location belongs to another site.
    const locationSite = new Map(LOCATIONS.map((l) => [l.functional_location_id, l.site_id]))
    const assetById = new Map(assets.map((a) => [a.asset_id, a]))

    const scheduledAssets = new Set(pms.map((p) => p.asset_id))
    const openByAsset = new Set(wos.filter((w) => OPEN_STATUS.includes(w.status)).map((w) => w.asset_id))
    const inspectedAssets = new Set(insp.map((i) => i.asset_id))
    const documentedAssets = new Set(docs.map((d) => d.asset_id))
    const demandParts = new Set(demand.map((d) => d.part_id))
    const tradelessAccounts = new Set(TECHNICIANS.filter((t) => t.trade === '—').map((t) => t.name))

    const assetRecord = (a, detail) => ({ id: a.asset_id, name: `${a.asset_name} (${a.asset_code})`, detail, asset_id: a.asset_id })

    // Duplicate names are counted within a site rather than across the estate:
    // two sites each having a "Conveyor 03" is normal, one site having two is a
    // technician scanning the wrong QR code.
    const nameGroups = new Map()
    assets.forEach((a) => {
      const key = `${a.site_id}|${a.asset_name}`
      if (!nameGroups.has(key)) nameGroups.set(key, [])
      nameGroups.get(key).push(a)
    })
    const duplicated = [...nameGroups.values()].filter((g) => g.length > 1).flat()

    const checks = [
      {
        id: 'pm-coverage',
        severity: 'High',
        category: 'Preventive maintenance',
        what: 'Assets with no preventive schedule',
        fix: 'Attach a schedule from the asset-type template, or record the asset as run-to-failure so the gap is a decision rather than an oversight.',
        minutes: 8,
        records: assets.filter((a) => !scheduledAssets.has(a.asset_id))
          .map((a) => assetRecord(a, `${a.criticality} criticality · health ${a.health_score}%`)),
      },
      {
        id: 'down-unassigned',
        severity: 'Critical',
        category: 'Work orders',
        what: 'Assets marked down with no open work order',
        fix: 'Raise a breakdown work order against each, or correct the asset status if it is back in service.',
        minutes: 10,
        records: assets.filter((a) => a.status === 'Down' && !openByAsset.has(a.asset_id))
          .map((a) => assetRecord(a, `${a.functional_location_name} · ${a.site_name}`)),
      },
      {
        id: 'failed-insp-no-wo',
        severity: 'High',
        category: 'Inspections',
        what: 'Failed inspections with no follow-up work order',
        fix: 'Convert each failed inspection into a corrective work order so the finding has an owner and a due date.',
        minutes: 12,
        records: insp
          .filter((i) => i.result === 'Fail' && !wos.some((w) => w.asset_id === i.asset_id && new Date(w.created_date) >= new Date(i.scheduled_date)))
          .map((i) => ({ id: i.inspection_id, name: `${i.inspection_number} — ${i.asset_name}`, detail: `${i.inspection_type} · ${i.findings_count} findings · scored ${i.score}%`, asset_id: i.asset_id })),
      },
      {
        id: 'pm-overdue',
        severity: 'High',
        category: 'Preventive maintenance',
        what: 'Preventive schedules past their due date',
        fix: 'Generate the outstanding work orders and re-baseline the schedule, or reduce the frequency if the interval is unachievable.',
        minutes: 6,
        records: pms.filter((p) => isPast(p.next_due))
          .map((p) => ({ id: p.schedule_id, name: p.schedule_name, detail: `${p.asset_name} · ${Math.abs(daysUntil(p.next_due))} days late · ${p.assigned_to_name}`, asset_id: p.asset_id })),
      },
      {
        id: 'location-mismatch',
        severity: 'Medium',
        category: 'Data integrity',
        what: 'Assets whose functional location sits under a different site',
        fix: 'Correct either the site or the location on the asset record — every cost and downtime report rolls up through this pair.',
        minutes: 3,
        records: assets.filter((a) => locationSite.get(a.functional_location_id) && locationSite.get(a.functional_location_id) !== a.site_id)
          .map((a) => assetRecord(a, `Sited at ${a.site_name}, located in ${a.functional_location_name}`)),
      },
      {
        id: 'paused-critical',
        severity: 'High',
        category: 'Preventive maintenance',
        what: 'Paused schedules on high-criticality assets',
        fix: FIX['paused-critical'] || 'Restart the schedule or move the asset off the critical list. A paused plan on a critical machine is an unrecorded risk.',
        minutes: 5,
        records: pms.filter((p) => p.status === 'Paused' && assetById.get(p.asset_id)?.criticality === 'High')
          .map((p) => ({ id: p.schedule_id, name: p.schedule_name, detail: `${p.asset_name} · paused · last generated ${fmtDate(p.last_generated)}`, asset_id: p.asset_id })),
      },
      {
        id: 'poor-health-no-work',
        severity: 'Medium',
        category: 'Reliability',
        what: 'Assets below 60% health with no open work order',
        fix: FIX['poor-health-no-work'] || 'Book a condition survey. A falling health score with nothing planned against it is how a breakdown gets scheduled by the machine instead of by you.',
        minutes: 15,
        records: assets.filter((a) => a.health_score < 60 && !openByAsset.has(a.asset_id))
          .map((a) => assetRecord(a, `Health ${a.health_score}% · last serviced ${fmtDate(a.last_maintenance_date)}`)),
      },
      {
        id: 'breakdown-no-downtime',
        severity: 'Medium',
        category: 'Work orders',
        what: 'Completed breakdown jobs with no downtime recorded',
        fix: 'Add the downtime hours at close-out. Downtime is the number the availability report is built from, and a zero is indistinguishable from a blank.',
        minutes: 4,
        records: wos.filter((w) => w.work_order_type === 'Breakdown' && w.status === 'Completed' && !w.downtime_hours)
          .map((w) => ({ id: w.workorder_id, name: `${w.work_order_number} — ${w.title}`, detail: `${w.asset_name} · closed ${fmtDate(w.completed_date)}`, asset_id: w.asset_id })),
      },
      {
        id: 'duplicate-names',
        severity: 'Medium',
        category: 'Data integrity',
        what: 'Duplicate asset names within the same site',
        fix: FIX['duplicate-names'] || 'Rename so each machine is unique on its own site — otherwise work gets booked against whichever one appeared first in the list.',
        minutes: 4,
        records: duplicated.map((a) => assetRecord(a, `${a.site_name} · code ${a.asset_code}`)),
      },
      {
        id: 'admin-assigned',
        severity: 'Medium',
        category: 'Work orders',
        what: 'Open work assigned to an account with no maintenance trade',
        fix: 'Reassign to a technician. Work parked on an administrator account never reaches a task list on the shop floor.',
        minutes: 3,
        records: wos.filter((w) => OPEN_STATUS.includes(w.status) && tradelessAccounts.has(w.assigned_to_name))
          .map((w) => ({ id: w.workorder_id, name: `${w.work_order_number} — ${w.title}`, detail: `Assigned to ${w.assigned_to_name} · due ${fmtDate(w.due_date)}`, asset_id: w.asset_id })),
      },
      {
        id: 'estimate-overrun',
        severity: 'Low',
        category: 'Planning',
        what: 'Completed jobs that overran their estimate by more than half',
        fix: 'Review the job plans behind these. Estimates that are consistently wrong make the whole backlog forecast wrong.',
        minutes: 6,
        records: wos.filter((w) => w.status === 'Completed' && w.actual_hours != null && w.actual_hours > w.estimated_hours * 1.5)
          .map((w) => ({ id: w.workorder_id, name: `${w.work_order_number} — ${w.title}`, detail: `Estimated ${w.estimated_hours}h, took ${w.actual_hours}h · ${w.asset_name}`, asset_id: w.asset_id })),
      },
      {
        id: 'short-no-demand',
        severity: 'Medium',
        category: 'Inventory',
        what: 'Parts below their reorder point with nothing on order',
        fix: 'Raise a demand line so the shortage reaches purchasing. A reorder point nobody acts on is a number, not a control.',
        minutes: 5,
        records: parts.filter((p) => p.status !== 'In Stock' && !demandParts.has(p.part_id))
          .map((p) => ({ id: p.part_id, name: `${p.part_number} — ${p.part_name}`, detail: `${p.quantity_on_hand} on hand against a minimum of ${p.minimum_quantity} · ${p.vendor_name}` })),
      },
      {
        id: 'never-inspected',
        severity: 'Low',
        category: 'Inspections',
        what: 'Assets never inspected',
        fix: FIX['never-inspected'] || 'Add them to a walk-round route. An asset nobody looks at only reports its condition by failing.',
        minutes: 5,
        records: assets.filter((a) => !inspectedAssets.has(a.asset_id))
          .map((a) => assetRecord(a, `${a.asset_type} · ${a.functional_location_name}`)),
      },
      {
        id: 'no-documents',
        severity: 'Low',
        category: 'Documents',
        what: 'Assets with no manual or drawing attached',
        fix: FIX['no-documents'] || 'Upload the O&M manual and wiring diagram. This is the difference between a two-hour repair and a two-day one at 3am.',
        minutes: 10,
        records: assets.filter((a) => !documentedAssets.has(a.asset_id))
          .map((a) => assetRecord(a, `${a.manufacturer} ${a.model} · serial ${a.serial_number}`)),
      },
      {
        id: 'out-of-warranty',
        severity: 'Low',
        category: 'Commercial',
        what: 'Assets whose warranty has expired',
        fix: 'Confirm each is genuinely out of cover before the next repair is paid for out of the maintenance budget.',
        minutes: 4,
        records: assets.filter((a) => isPast(a.warranty_expiry))
          .map((a) => assetRecord(a, `Warranty ended ${fmtDate(a.warranty_expiry)}`)),
      },
      {
        id: 'missing-identity',
        severity: 'Medium',
        category: 'Data integrity',
        what: 'Assets missing a serial number or purchase date',
        fix: 'Fill both in from the nameplate and the purchase record — warranty claims and depreciation both need them.',
        minutes: 5,
        records: assets.filter((a) => !a.serial_number || !a.purchase_date)
          .map((a) => assetRecord(a, 'Identity fields incomplete')),
      },
      {
        id: 'unassigned-work',
        severity: 'High',
        category: 'Work orders',
        what: 'Work orders with no assignee',
        fix: 'Assign an owner. Unassigned work is the largest single contributor to an ageing backlog.',
        minutes: 2,
        records: wos.filter((w) => OPEN_STATUS.includes(w.status) && !w.assigned_to_name)
          .map((w) => ({ id: w.workorder_id, name: `${w.work_order_number} — ${w.title}`, detail: `${w.asset_name} · due ${fmtDate(w.due_date)}`, asset_id: w.asset_id })),
      },
      {
        id: 'no-preferred-vendor',
        severity: 'Low',
        category: 'Inventory',
        what: 'Parts with no preferred supplier',
        fix: 'Set a preferred supplier so a shortage can turn into a purchase order without someone having to remember who sells it.',
        minutes: 4,
        records: parts.filter((p) => !p.vendor_id)
          .map((p) => ({ id: p.part_id, name: `${p.part_number} — ${p.part_name}`, detail: `${p.category} · ${p.quantity_on_hand} on hand` })),
      },
    ]

    const findings = checks.filter((c) => c.records.length)
      .sort((a, b) => (SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]) || (b.records.length - a.records.length))
    const clear = checks.filter((c) => !c.records.length)

    const affectedAssets = new Set()
    findings.forEach((c) => c.records.forEach((r) => { if (r.asset_id) affectedAssets.add(r.asset_id) }))

    const effortMinutes = findings.reduce((n, c) => n + c.records.length * c.minutes, 0)

    return {
      checks, findings, clear,
      recordsScanned: assets.length + wos.length + pms.length + parts.length + insp.length,
      issues: findings.reduce((n, c) => n + c.records.length, 0),
      affectedAssets: affectedAssets.size,
      totalAssets: assets.length,
      effortHours: Math.round(effortMinutes / 60),
      critical: findings.filter((c) => c.severity === 'Critical' || c.severity === 'High').length,
    }
  }, [scope])

  const open = audit.findings.find((c) => c.id === openId) || null

  return (
    <div>
      <PageHeader
        icon={sectionIcon('ai-auditor', '#15227a')}
        title="AI Auditor"
        subtitle={`${audit.recordsScanned.toLocaleString('en-US')} records examined · ${siteName}`}
        right={<span style={{ fontSize: 11.5, color: MUTE, fontWeight: 600 }}>Recomputed on every load</span>}
      />

      <StatStrip items={[
        { label: 'Issues found', value: audit.issues, tone: audit.issues ? 'amber' : 'green', note: `across ${audit.findings.length} of ${audit.checks.length} checks` },
        { label: 'Serious findings', value: audit.critical, tone: audit.critical ? 'red' : 'green', note: 'rated critical or high' },
        { label: 'Assets affected', value: audit.affectedAssets, note: `of ${audit.totalAssets} on the register` },
        { label: 'Checks clear', value: audit.clear.length, tone: 'green', note: `of ${audit.checks.length} run` },
        { label: 'Estimated effort', value: audit.effortHours, unit: 'h', note: 'modelled, not measured' },
      ]} />

      <Card style={{ marginBottom: 14, padding: '13px 16px', background: '#f8fafc', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ marginTop: 1 }}>{sectionIcon('ai-auditor', ACCENT)}</div>
        <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.55 }}>
          Every finding below is the result of a rule run against your own records — no sampling and no
          model output. The effort figure is the one estimate on this page: it assumes a fixed number of
          minutes to correct each record type, so treat it as an order of magnitude rather than a quote.
        </p>
      </Card>

      <Section title="Findings" right={<span style={{ fontSize: 11.5, color: MUTE }}>select a row for the affected records</span>}>
        <DataTable
          pageSize={12}
          rows={audit.findings}
          onRowClick={(r) => setOpenId(r.id)}
          empty="Nothing to correct — every check came back clear."
          columns={[
            { key: 'severity', label: 'Severity', sortValue: (r) => SEVERITY_ORDER[r.severity], render: (r) => <Priority value={r.severity} /> },
            { key: 'category', label: 'Category', render: (r) => <StatusBadge tone="grey">{r.category}</StatusBadge> },
            { key: 'what', label: 'Finding', render: (r) => <span style={{ fontWeight: 600 }}>{r.what}</span> },
            { key: 'count', label: 'Records', align: 'right', sortValue: (r) => r.records.length, render: (r) => <span style={{ fontWeight: 800, color: INK }}>{r.records.length}</span> },
            {
              key: 'effort', label: 'Effort', align: 'right', sortValue: (r) => r.records.length * r.minutes,
              render: (r) => <span style={{ color: SUB }}>{Math.max(1, Math.round((r.records.length * r.minutes) / 60))} h</span>,
            },
            {
              key: 'fix', label: 'Suggested fix', sortable: false,
              render: (r) => (
                <span style={{ display: 'block', maxWidth: 340, color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.fix}>{r.fix}</span>
              ),
            },
          ]} />
      </Section>

      {audit.clear.length > 0 && (
        <Section title="Checks that came back clear">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 10 }}>
            {audit.clear.map((c) => (
              <div key={c.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '11px 13px', border: `1px solid ${LINE}`, borderRadius: 11, background: '#fcfdfe' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{c.what}</div>
                  <div style={{ fontSize: 11, color: MUTE, marginTop: 2 }}>{c.category} · nothing found</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Drawer
        open={Boolean(open)} onClose={() => setOpenId(null)}
        title={open?.what}
        subtitle={open ? `${open.records.length} records · ${open.category}` : ''}
        icon={sectionIcon('ai-auditor', '#15227a')}
        width={520}
      >
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatusBadge tone={open.severity === 'Critical' || open.severity === 'High' ? 'red' : open.severity === 'Medium' ? 'amber' : 'grey'}>{open.severity}</StatusBadge>
              <StatusBadge tone="grey">{open.category}</StatusBadge>
            </div>

            <div style={{ padding: 13, borderRadius: 11, background: '#f8fafc', border: `1px solid ${LINE}` }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>Suggested fix</div>
              <p style={{ margin: 0, fontSize: 13, color: INK, lineHeight: 1.55 }}>{open.fix}</p>
            </div>

            <Fields rows={[
              ['Records affected', open.records.length],
              ['Estimated effort', `${Math.max(1, Math.round((open.records.length * open.minutes) / 60))} h`],
              ['Per record', `${open.minutes} min (estimate)`],
              ['Assets involved', new Set(open.records.filter((r) => r.asset_id).map((r) => r.asset_id)).size || '—'],
            ]} />

            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Affected records</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {open.records.map((r) => (
                  <div key={r.id} style={{ padding: '9px 0', borderBottom: `1px solid ${LINE}` }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{r.name}</div>
                    <div style={{ fontSize: 11.5, color: MUTE, marginTop: 2 }}>{r.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
