'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader, Card, StatStrip, Section, Donut, BarPairs, HBars, StatusBadge, Priority, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import CmmsCard from '../components/CmmsCard'
import { useSite } from '../lib/siteStore'
import {
  ORG, ASSETS, WORK_ORDERS, PM_SCHEDULES, PARTS, INSPECTIONS, SITES,
  TREND, OPEN_STATUS, isPast, fmtDate, daysUntil, money, BY_STATUS,
  hours,
} from '../lib/data'

const { SUB, MUTE, LINE, INK } = PALETTE

export default function Dashboard() {
  const router = useRouter()
  const { scope, siteName } = useSite()

  // Everything on this page is recounted against the site filter rather than
  // read from a precomputed total. A headline that ignores the filter while the
  // table below it obeys is the fastest way to lose an audience's trust.
  const d = useMemo(() => {
    const assets = scope(ASSETS)
    const wos = scope(WORK_ORDERS)
    const pms = scope(PM_SCHEDULES)
    const parts = scope(PARTS)
    const insp = scope(INSPECTIONS)

    const open = wos.filter((w) => OPEN_STATUS.includes(w.status))
    const done = wos.filter((w) => w.status === 'Completed')
    const overdue = open.filter((w) => isPast(w.due_date))

    return {
      assets, wos, pms, parts, insp, open, done, overdue,
      assetsDown: assets.filter((a) => a.status === 'Down').length,
      pmOverdue: pms.filter((p) => isPast(p.next_due)).length,
      pmCompliance: pms.length ? Math.round((pms.filter((p) => !isPast(p.next_due)).length / pms.length) * 100) : 100,
      lowParts: parts.filter((p) => p.status !== 'In Stock').length,
      invValue: Math.round(parts.reduce((n, p) => n + p.total_value, 0)),
      cost: wos.reduce((n, w) => n + w.total_cost, 0),
      mttr: done.length ? Number((done.reduce((n, w) => n + (w.actual_hours || 0), 0) / done.length).toFixed(1)) : 0,
      downtime: wos.reduce((n, w) => n + w.downtime_hours, 0),
      failedInsp: insp.filter((i) => i.result === 'Fail').length,
    }
  }, [scope])

  const go = (k) => router.push('/portal/oxmaint/' + k)

  // The soonest work that is actually actionable — overdue first, then by due
  // date. This is the list a supervisor opens the product to see.
  const attention = useMemo(() => (
    [...d.open].sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).slice(0, 7)
  ), [d.open])

  const upcomingPM = useMemo(() => (
    [...d.pms].sort((a, b) => new Date(a.next_due) - new Date(b.next_due)).slice(0, 6)
  ), [d.pms])

  return (
    <div>
      <PageHeader
        icon={sectionIcon('dashboard', '#15227a')}
        title="Dashboard"
        subtitle={`${ORG.organization_name} · ${siteName} · live maintenance position`}
        right={<span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: SUB, fontWeight: 600 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />Live data
        </span>}
      />

      <CmmsCard />

      <StatStrip items={[
        { label: 'Open work orders', value: d.open.length, note: `${d.wos.length} raised in total` },
        { label: 'Overdue', value: d.overdue.length, tone: d.overdue.length ? 'red' : 'green', note: 'past due and still open' },
        { label: 'PM compliance', value: d.pmCompliance, unit: '%', tone: d.pmCompliance >= 85 ? 'green' : 'amber', note: `${d.pmOverdue} schedules overdue` },
        { label: 'Assets down', value: d.assetsDown, tone: d.assetsDown ? 'red' : 'green', note: `of ${d.assets.length} assets` },
        { label: 'MTTR', value: d.mttr, unit: 'h', note: `${hours(d.downtime)}h downtime logged` },
        { label: 'Maintenance cost', value: money(d.cost), note: 'across all work orders' },
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(330px, 100%),1fr))', gap: 14, marginBottom: 14 }}>
        <Section title="Work orders by status">
          <Donut data={BY_STATUS(d.wos)} />
        </Section>
        <Section title="Assets by status">
          <Donut data={BY_STATUS(d.assets)} colors={['#10b981', '#f59e0b', '#ef4444']} />
        </Section>
      </div>

      <Section title="Raised vs completed — last 12 months"
        right={<span style={{ fontSize: 11.5, color: MUTE }}>work orders per month</span>}>
        <BarPairs data={TREND} keys={['raised', 'completed']} labels={['Raised', 'Completed']} />
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(320px, 100%),1fr))', gap: 14, marginBottom: 14 }}>
        <Section title="Work orders by priority">
          <HBars data={BY_STATUS(d.open, 'priority').sort((a, b) => ['Critical', 'High', 'Medium', 'Low'].indexOf(a.name) - ['Critical', 'High', 'Medium', 'Low'].indexOf(b.name))
            .map((r) => ({ ...r, color: { Critical: '#ef4444', High: '#f59e0b', Medium: '#3b82f6', Low: '#94a3b8' }[r.name] }))} />
        </Section>
        <Section title="Assets by site">
          <HBars data={SITES
            .filter((s) => d.assets.some((a) => a.site_id === s.site_id))
            .map((s) => ({ name: s.site_name, value: d.assets.filter((a) => a.site_id === s.site_id).length }))} />
        </Section>
        <Section title="Inventory">
          <HBars data={[
            { name: 'In stock', value: d.parts.filter((p) => p.status === 'In Stock').length, color: '#10b981' },
            { name: 'Low stock', value: d.parts.filter((p) => p.status === 'Low Stock').length, color: '#f59e0b' },
            { name: 'Out of stock', value: d.parts.filter((p) => p.status === 'Out of Stock').length, color: '#ef4444' },
          ]} />
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
            <span style={{ color: SUB }}>Stock valuation</span>
            <span style={{ fontWeight: 800, color: INK }}>{money(d.invValue)}</span>
          </div>
        </Section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(390px, 100%),1fr))', gap: 14 }}>
        <Section title="Needs attention"
          right={<button onClick={() => go('work-orders')} style={linkBtn}>All work orders →</button>}>
          {attention.length ? attention.map((w) => (
            <button key={w.workorder_id} onClick={() => go('work-orders')} style={rowBtn}>
              <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {w.work_order_number} · {w.title}
                </span>
                <span style={{ display: 'block', fontSize: 11, color: MUTE, marginTop: 2 }}>
                  {w.asset_name} · {w.assigned_to_name}
                </span>
              </span>
              <Priority value={w.priority} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: isPast(w.due_date) ? '#b91c1c' : SUB, whiteSpace: 'nowrap', minWidth: 74, textAlign: 'right' }}>
                {isPast(w.due_date) ? `${Math.abs(daysUntil(w.due_date))}d late` : `in ${daysUntil(w.due_date)}d`}
              </span>
            </button>
          )) : <Empty>No open work orders at {siteName}.</Empty>}
        </Section>

        <Section title="Upcoming maintenance"
          right={<button onClick={() => go('pm-schedules')} style={linkBtn}>All schedules →</button>}>
          {upcomingPM.length ? upcomingPM.map((p) => (
            <button key={p.schedule_id} onClick={() => go('pm-schedules')} style={rowBtn}>
              <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.schedule_name}</span>
                <span style={{ display: 'block', fontSize: 11, color: MUTE, marginTop: 2 }}>{p.asset_name} · every {p.frequency_value} {p.frequency_unit.toLowerCase()}</span>
              </span>
              <StatusBadge>{isPast(p.next_due) ? 'Overdue' : p.status}</StatusBadge>
              <span style={{ fontSize: 11.5, color: SUB, whiteSpace: 'nowrap', minWidth: 78, textAlign: 'right' }}>{fmtDate(p.next_due)}</span>
            </button>
          )) : <Empty>No schedules at {siteName}.</Empty>}
        </Section>
      </div>
    </div>
  )
}

function Empty({ children }) {
  return <div style={{ padding: '26px 0', textAlign: 'center', color: MUTE, fontSize: 12.5 }}>{children}</div>
}

const rowBtn = {
  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
  padding: '9px 4px', background: 'none', border: 'none', borderBottom: `1px solid ${LINE}`,
  cursor: 'pointer', fontFamily: 'inherit',
}

const linkBtn = { background: 'none', border: 'none', color: '#15227a', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
