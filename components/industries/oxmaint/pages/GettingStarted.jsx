'use client'

// Getting Started — the landing page, laid out the way the product lays it out.
//
// This was a twelve-step setup checklist. That is a different screen for a
// different moment: a checklist is for an empty account on day one, and by the
// time anyone sees this there are 126 assets and 84 work orders on the system.
// The real page is a welcome — the mark, a greeting, then a card per module
// summarising where that module stands and a way into it.
//
// The numbers are all counted from the live records, so this page and the
// dashboard cannot disagree.

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Section, StatusBadge, ActionButton, Bar, HBars, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { useRecords, useOrgBranding } from '../lib/store'
import { OxmaintMark } from '../components/Logo'
import {
  ORG, USER, ASSETS, WORK_ORDERS, PM_SCHEDULES, PARTS, INSPECTIONS, TECHNICIANS,
  SITES, OPEN_STATUS, isPast, daysUntil, fmtDate, money,
} from '../lib/data'

const { MUTE, SUB, INK, LINE, ACCENT, GREEN, AMBER, RED, BLUE } = PALETTE

const idOf = (w) => w.workorder_id || w.recordId

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function GettingStarted() {
  const router = useRouter()
  const { scope, siteName } = useSite()
  const { logoUrl } = useOrgBranding()
  const go = (k) => router.push('/portal/oxmaint/' + k)

  const wos = useRecords('work_order', WORK_ORDERS, idOf)

  const d = useMemo(() => {
    const w = scope(wos)
    const open = w.filter((x) => OPEN_STATUS.includes(x.status))
    const done = w.filter((x) => x.status === 'Completed')
    const assets = scope(ASSETS)
    const pms = scope(PM_SCHEDULES)
    const parts = scope(PARTS)
    const insp = scope(INSPECTIONS)
    return {
      open, done, assets, pms, parts, insp,
      overdue: open.filter((x) => isPast(x.due_date)),
      critical: open.filter((x) => x.priority === 'Critical'),
      down: assets.filter((a) => a.status === 'Down'),
      pmOverdue: pms.filter((p) => isPast(p.next_due)),
      pmSoon: pms.filter((p) => !isPast(p.next_due) && daysUntil(p.next_due) <= 7),
      short: parts.filter((p) => p.status !== 'In Stock'),
      failed: insp.filter((i) => i.result === 'Fail'),
      cost: w.reduce((n, x) => n + (x.total_cost || 0), 0),
      value: Math.round(parts.reduce((n, p) => n + p.total_value, 0)),
    }
  }, [scope, wos])

  const pmCompliance = d.pms.length ? Math.round(((d.pms.length - d.pmOverdue.length) / d.pms.length) * 100) : 100
  const completion = (d.open.length + d.done.length) ? Math.round((d.done.length / (d.open.length + d.done.length)) * 100) : 0
  const passRate = d.insp.length ? Math.round(((d.insp.length - d.failed.length) / d.insp.length) * 100) : 100

  return (
    <div>
      {/* Welcome */}
      <div style={{ textAlign: 'center', padding: '18px 0 26px' }}>
        {logoUrl
          ? <img src={logoUrl} alt="" style={{ height: 58, width: 'auto', maxWidth: 200, objectFit: 'contain' }} />
          : <OxmaintMark size={58} />}
        <h1 style={{ margin: '14px 0 0', fontSize: 25, fontWeight: 800, color: INK, letterSpacing: -0.4 }}>
          {greeting()}, {USER.name.split(' ')[0]}
        </h1>
        <p style={{ margin: '7px auto 0', fontSize: 13.5, color: SUB, maxWidth: 560, lineHeight: 1.6 }}>
          This is {ORG.organization_name} on Oxmaint — {d.assets.length} assets, {d.open.length} jobs
          open and {d.pms.length} preventive schedules running at {siteName}. Everything below is
          counted from your own records.
        </p>
      </div>

      {/* Where things stand */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(300px, 100%),1fr))', gap: 14, marginBottom: 14 }}>
        <ModuleCard
          icon={sectionIcon('work-orders', ACCENT)} title="Work Orders"
          head={d.open.length} headLabel="open now"
          tone={d.overdue.length ? 'amber' : 'green'}
          lines={[
            [`${d.overdue.length} overdue`, d.overdue.length ? RED : GREEN],
            [`${d.critical.length} critical`, d.critical.length ? AMBER : SUB],
            [`${d.done.length} completed · ${money(d.cost)} spent`, SUB],
          ]}
          barLabel="Completion rate" barPct={completion}
          onOpen={() => go('work-orders')}
        />

        <ModuleCard
          icon={sectionIcon('pm-schedules', ACCENT)} title="Preventive Maintenance"
          head={`${pmCompliance}%`} headLabel="compliance"
          tone={pmCompliance >= 85 ? 'green' : 'amber'}
          lines={[
            [`${d.pms.length} schedules running`, SUB],
            [`${d.pmOverdue.length} overdue`, d.pmOverdue.length ? RED : GREEN],
            [`${d.pmSoon.length} due within seven days`, AMBER],
          ]}
          barLabel="On schedule" barPct={pmCompliance}
          onOpen={() => go('pm-schedules')}
        />

        <ModuleCard
          icon={sectionIcon('assets', ACCENT)} title="Assets"
          head={d.assets.length} headLabel="on the register"
          tone={d.down.length ? 'red' : 'green'}
          lines={[
            [`${d.assets.filter((a) => a.status === 'Operational').length} operational`, GREEN],
            [`${d.assets.filter((a) => a.status === 'Under Maintenance').length} under maintenance`, AMBER],
            [`${d.down.length} down`, d.down.length ? RED : SUB],
          ]}
          barLabel="Availability"
          barPct={d.assets.length ? Math.round((d.assets.filter((a) => a.status === 'Operational').length / d.assets.length) * 100) : 100}
          onOpen={() => go('assets')}
        />

        <ModuleCard
          icon={sectionIcon('inspections', ACCENT)} title="Inspections"
          head={`${passRate}%`} headLabel="pass rate"
          tone={passRate >= 85 ? 'green' : 'amber'}
          lines={[
            [`${d.insp.length} inspections recorded`, SUB],
            [`${d.failed.length} failed`, d.failed.length ? RED : GREEN],
            [`${d.insp.reduce((n, i) => n + i.findings_count, 0)} findings open`, AMBER],
          ]}
          barLabel="Passing" barPct={passRate}
          onOpen={() => go('inspections')}
        />

        <ModuleCard
          icon={sectionIcon('parts', ACCENT)} title="Inventory"
          head={money(d.value)} headLabel="stock at cost"
          tone={d.short.length ? 'amber' : 'green'}
          lines={[
            [`${d.parts.length} part lines`, SUB],
            [`${d.parts.filter((p) => p.status === 'Low Stock').length} below reorder`, AMBER],
            [`${d.parts.filter((p) => p.status === 'Out of Stock').length} out of stock`, d.parts.some((p) => p.status === 'Out of Stock') ? RED : GREEN],
          ]}
          barLabel="In stock"
          barPct={d.parts.length ? Math.round(((d.parts.length - d.short.length) / d.parts.length) * 100) : 100}
          onOpen={() => go('parts')}
        />

        <ModuleCard
          icon={sectionIcon('members', ACCENT)} title="Team"
          head={TECHNICIANS.length} headLabel={`of ${ORG.max_users} seats`}
          tone="green"
          lines={[
            [`${TECHNICIANS.filter((t) => t.role === 'Technician').length} technicians`, SUB],
            [`${SITES.length} sites`, SUB],
            [`${d.open.filter((w) => !w.assigned_to_name).length} jobs unassigned`, d.open.some((w) => !w.assigned_to_name) ? AMBER : GREEN],
          ]}
          barLabel="Seats used" barPct={Math.round((TECHNICIANS.length / ORG.max_users) * 100)}
          onOpen={() => go('members')}
        />
      </div>

      {/* Where to start */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(330px, 100%),1fr))', gap: 14 }}>
        <Section title="What to look at first" style={{ margin: 0 }}>
          {[
            d.critical.length && [`${d.critical.length} critical jobs are open`, 'These are the ones that stop production.', 'work-orders'],
            d.overdue.length && [`${d.overdue.length} work orders are past their due date`, 'Reassign or reschedule before the backlog sets.', 'work-orders'],
            d.pmOverdue.length && [`${d.pmOverdue.length} preventive schedules have slipped`, 'PM compliance is what keeps the breakdown count down.', 'pm-schedules'],
            d.short.length && [`${d.short.length} parts are at or below their reorder point`, 'Short parts are the usual reason a job waits.', 'parts'],
            d.failed.length && [`${d.failed.length} inspections failed`, 'Each one should become a corrective work order.', 'inspections'],
          ].filter(Boolean).map(([title, why, to]) => (
            <button key={title} onClick={() => go(to)} style={rowBtn}>
              <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: INK }}>{title}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: MUTE, marginTop: 2 }}>{why}</span>
              </span>
              <span style={{ fontSize: 15, color: ACCENT }}>&rsaquo;</span>
            </button>
          ))}
        </Section>

        <Section title="Main features" style={{ margin: 0 }}>
          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: SUB, lineHeight: 1.55 }}>
            The modules this organisation has switched on.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(148px,1fr))', gap: 8 }}>
            {[
              ['work-orders', 'Work Orders'], ['pm-schedules', 'PM Schedules'], ['assets', 'Assets'],
              ['checklists', 'Checklists'], ['parts', 'Inventory'], ['permits', 'Work Permits'],
              ['compliance', 'Compliance'], ['synapse', 'Synapse AI'], ['reports', 'Reports'],
            ].map(([key, label]) => (
              <button key={key} onClick={() => go(key)} style={featureBtn}>
                {sectionIcon(key, ACCENT)}
                <span style={{ fontSize: 11.5, fontWeight: 600, color: INK }}>{label}</span>
              </button>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Help and support" style={{ marginTop: 14 }}
        right={<ActionButton variant="ghost" onClick={() => go('help')}>Open support</ActionButton>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
          {[
            ['Resources', 'Guides for every module, written for the people doing the work.'],
            ['Raise a ticket', 'Something not behaving? Send it with the context attached.'],
            ['FAQ', 'The questions that come up in the first week.'],
          ].map(([t, s]) => (
            <button key={t} onClick={() => go('help')} style={helpBtn}>
              <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: INK, marginBottom: 3 }}>{t}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: MUTE, lineHeight: 1.5 }}>{s}</span>
            </button>
          ))}
        </div>
      </Section>
    </div>
  )
}

function ModuleCard({ icon, title, head, headLabel, tone, lines, barLabel, barPct, onOpen }) {
  const barColor = barPct >= 85 ? GREEN : barPct >= 60 ? AMBER : RED
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, marginBottom: 13 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: '#e8ecff', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{title}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: INK, lineHeight: 1 }}>{head}</span>
            <span style={{ fontSize: 11.5, color: MUTE }}>{headLabel}</span>
          </div>
        </div>
        <StatusBadge tone={tone}>{tone === 'green' ? 'Healthy' : tone === 'amber' ? 'Watch' : 'Action'}</StatusBadge>
      </div>

      <div style={{ marginBottom: 13 }}>
        {lines.map(([text, color]) => (
          <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: SUB }}>{text}</span>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
          <span style={{ color: MUTE, fontWeight: 600 }}>{barLabel}</span>
          <span style={{ fontWeight: 800, color: barColor }}>{barPct}%</span>
        </div>
        <Bar pct={barPct} color={barColor} />
      </div>

      <ActionButton size="sm" variant="subtle" full onClick={onOpen}>Open {title}</ActionButton>
    </Card>
  )
}

const rowBtn = {
  display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '10px 2px',
  background: 'none', border: 'none', borderBottom: `1px solid ${LINE}`, cursor: 'pointer', fontFamily: 'inherit',
}
const featureBtn = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 11px', textAlign: 'left',
  background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
}
const helpBtn = {
  display: 'block', width: '100%', padding: '13px 14px', textAlign: 'left',
  background: '#fcfdfe', border: `1px solid ${LINE}`, borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit',
}
