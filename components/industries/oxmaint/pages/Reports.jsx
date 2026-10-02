'use client'

import { useMemo, useState } from 'react'
import { PageHeader, StatStrip, Card, Section, BarPairs, HBars, Donut, DataTable, StatusBadge, ActionButton, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { managementReportPdf } from '../lib/pdfReports'
import { TONE } from '../lib/pdf'
import { useSite } from '../lib/siteStore'
import {
  WORK_ORDERS, ASSETS, PM_SCHEDULES, PARTS, INSPECTIONS, TECHNICIANS,
  TREND, OPEN_STATUS, isPast, money, BY_STATUS, fmtDate,
} from '../lib/data'

const { MUTE, SUB, INK, LINE } = PALETTE

const TABS = ['Maintenance', 'Cost', 'Reliability', 'Compliance']

export default function Reports() {
  const { scope, siteName } = useSite()
  const [tab, setTab] = useState('Maintenance')

  const d = useMemo(() => {
    const wos = scope(WORK_ORDERS)
    const assets = scope(ASSETS)
    const done = wos.filter((w) => w.status === 'Completed')
    const live = wos.filter((w) => OPEN_STATUS.includes(w.status))

    // Cost by asset type, largest first — the standard "where is the money
    // going" cut, and the one that makes a maintenance budget conversation
    // possible at all.
    const byType = [...new Set(assets.map((a) => a.asset_type))].map((t) => {
      const ids = new Set(assets.filter((a) => a.asset_type === t).map((a) => a.asset_id))
      const own = wos.filter((w) => ids.has(w.asset_id))
      return {
        name: t,
        value: own.reduce((n, w) => n + w.total_cost, 0),
        orders: own.length,
        downtime: own.reduce((n, w) => n + w.downtime_hours, 0),
      }
    }).sort((a, b) => b.value - a.value)

    const byPerson = TECHNICIANS.map((t) => {
      const mine = wos.filter((w) => w.assigned_to_name === t.name)
      const closed = mine.filter((w) => w.status === 'Completed')
      return {
        name: t.name, role: t.role,
        assigned: mine.filter((w) => OPEN_STATUS.includes(w.status)).length,
        completed: closed.length,
        hours: closed.reduce((n, w) => n + (w.actual_hours || 0), 0),
        avg: closed.length ? Number((closed.reduce((n, w) => n + (w.actual_hours || 0), 0) / closed.length).toFixed(1)) : 0,
      }
    }).filter((p) => p.assigned || p.completed)

    return {
      wos, assets, done, live, byType, byPerson,
      cost: wos.reduce((n, w) => n + w.total_cost, 0),
      downtime: wos.reduce((n, w) => n + w.downtime_hours, 0),
      mttr: done.length ? Number((done.reduce((n, w) => n + (w.actual_hours || 0), 0) / done.length).toFixed(1)) : 0,
      pms: scope(PM_SCHEDULES),
      insp: scope(INSPECTIONS),
      parts: scope(PARTS),
    }
  }, [scope])

  // Built from `d`, the same object the tab renders from, so the document and
  // the screen cannot disagree. window.print() took the sidebar and the chat
  // launcher with it and produced something nobody would file.
  const exportPdf = () => {
    const overdue = d.live.filter((w) => isPast(w.due_date))
    const packs = {
      Maintenance: {
        stats: [
          { label: 'Work orders', value: String(d.wos.length) },
          { label: 'Completed', value: String(d.done.length), tone: TONE.ok },
          { label: 'Open', value: String(d.live.length), tone: TONE.warn },
          { label: 'Overdue', value: String(overdue.length), tone: overdue.length ? TONE.bad : TONE.ok },
          { label: 'Completion', value: `${d.wos.length ? Math.round((d.done.length / d.wos.length) * 100) : 0}%` },
        ],
        sections: [
          { title: 'Raised vs completed by month',
            columns: [
              { header: 'Month', width: 2, value: (r) => r.month },
              { header: 'Raised', width: 1, align: 'right', value: (r) => String(r.raised) },
              { header: 'Completed', width: 1, align: 'right', value: (r) => String(r.completed) },
              { header: 'Downtime (h)', width: 1.4, align: 'right', value: (r) => String(r.downtime_hours) },
            ], rows: TREND },
          { title: 'Open work by priority',
            columns: [
              { header: 'Priority', width: 2, value: (r) => r.name },
              { header: 'Count', width: 1, align: 'right', value: (r) => String(r.value) },
            ], rows: BY_STATUS(d.live, 'priority') },
        ],
      },
      Cost: {
        stats: [
          { label: 'Total spend', value: money(d.cost) },
          { label: 'Avg per WO', value: money(Math.round(d.cost / Math.max(1, d.wos.length))) },
          { label: 'Stock value', value: money(Math.round(d.parts.reduce((n, p) => n + p.total_value, 0))) },
          { label: 'Downtime', value: `${d.downtime} h` },
        ],
        sections: [
          { title: 'Cost by asset type',
            note: 'Spend is the sum of work order cost against assets of that type.',
            columns: [
              { header: 'Asset type', width: 3, value: (r) => r.name },
              { header: 'Work orders', width: 1.2, align: 'right', value: (r) => String(r.orders) },
              { header: 'Downtime (h)', width: 1.2, align: 'right', value: (r) => String(r.downtime) },
              { header: 'Spend', width: 1.4, align: 'right', value: (r) => money(r.value) },
            ], rows: d.byType },
        ],
      },
      Reliability: {
        stats: [
          { label: 'MTTR', value: `${d.mttr} h` },
          { label: 'Downtime', value: `${d.downtime} h` },
          { label: 'Assets down', value: String(d.assets.filter((a) => a.status === 'Down').length), tone: TONE.bad },
          { label: 'Avg health', value: `${d.assets.length ? Math.round(d.assets.reduce((n, a) => n + a.health_score, 0) / d.assets.length) : 0}%` },
        ],
        sections: [
          { title: 'Technician workload',
            columns: [
              { header: 'Technician', width: 3, value: (r) => r.name },
              { header: 'Role', width: 2, value: (r) => r.role },
              { header: 'Open', width: 1, align: 'right', value: (r) => String(r.assigned) },
              { header: 'Completed', width: 1.2, align: 'right', value: (r) => String(r.completed) },
              { header: 'Hours', width: 1, align: 'right', value: (r) => `${r.hours} h` },
            ], rows: d.byPerson },
        ],
      },
      Compliance: {
        stats: [
          { label: 'PM compliance', value: `${d.pms.length ? Math.round((d.pms.filter((p) => !isPast(p.next_due)).length / d.pms.length) * 100) : 100}%`, tone: TONE.ok },
          { label: 'PM overdue', value: String(d.pms.filter((p) => isPast(p.next_due)).length), tone: TONE.bad },
          { label: 'Inspections', value: String(d.insp.length) },
          { label: 'Pass rate', value: `${d.insp.length ? Math.round((d.insp.filter((i) => i.result === 'Pass').length / d.insp.length) * 100) : 0}%` },
        ],
        sections: [
          { title: 'Overdue preventive maintenance',
            columns: [
              { header: 'Schedule', width: 4, value: (r) => r.schedule_name },
              { header: 'Asset', width: 2.4, value: (r) => r.asset_name },
              { header: 'Assigned to', width: 2, value: (r) => r.assigned_to_name },
              { header: 'Was due', width: 1.6, value: (r) => fmtDate(r.next_due) },
            ], rows: d.pms.filter((p) => isPast(p.next_due)) },
        ],
      },
    }
    const p = packs[tab]
    managementReportPdf({ title: `${tab} Report`, subtitle: siteName, stats: p.stats, sections: p.sections })
  }

  return (
    <div>
      <PageHeader
        icon={sectionIcon('reports', '#15227a')}
        title="Reports"
        subtitle={`Maintenance analytics · ${siteName}`}
        right={<ActionButton variant="ghost" onClick={exportPdf}>Export PDF</ActionButton>}
      />

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '7px 14px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
            borderRadius: 9, border: `1px solid ${tab === t ? '#15227a' : LINE}`,
            background: tab === t ? '#15227a' : '#fff', color: tab === t ? '#fff' : SUB,
          }}>{t}</button>
        ))}
      </div>

      {tab === 'Maintenance' && (
        <>
          <StatStrip items={[
            { label: 'Work orders', value: d.wos.length },
            { label: 'Completed', value: d.done.length, tone: 'green' },
            { label: 'Open', value: d.live.length, tone: 'amber' },
            { label: 'Overdue', value: d.live.filter((w) => isPast(w.due_date)).length, tone: 'red' },
            { label: 'Completion rate', value: d.wos.length ? Math.round((d.done.length / d.wos.length) * 100) : 0, unit: '%' },
          ]} />
          <Section title="Raised vs completed — 12 months">
            <BarPairs data={TREND} keys={['raised', 'completed']} labels={['Raised', 'Completed']} />
          </Section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(320px, 100%),1fr))', gap: 14 }}>
            <Section title="By type"><Donut data={BY_STATUS(d.wos, 'work_order_type')} /></Section>
            <Section title="By status"><Donut data={BY_STATUS(d.wos)} /></Section>
          </div>
        </>
      )}

      {tab === 'Cost' && (
        <>
          <StatStrip items={[
            { label: 'Total spend', value: money(d.cost) },
            { label: 'Avg per work order', value: money(Math.round(d.cost / Math.max(1, d.wos.length))) },
            { label: 'Stock valuation', value: money(Math.round(d.parts.reduce((n, p) => n + p.total_value, 0))) },
            { label: 'Downtime hours', value: d.downtime, unit: 'h' },
          ]} />
          <Section title="Maintenance cost by month">
            <BarPairs data={TREND} keys={['cost']} labels={['Cost']} colors={['#15227a']} />
          </Section>
          <Section title="Cost by asset type">
            <DataTable pageSize={10} rows={d.byType} columns={[
              { key: 'name', label: 'Asset type', render: (r) => <span style={{ fontWeight: 600 }}>{r.name}</span> },
              { key: 'orders', label: 'Work orders', align: 'right' },
              { key: 'downtime', label: 'Downtime', align: 'right', render: (r) => `${r.downtime} h` },
              { key: 'value', label: 'Spend', align: 'right', render: (r) => <span style={{ fontWeight: 700 }}>{money(r.value)}</span> },
              {
                key: 'share', label: 'Share', align: 'right', sortValue: (r) => r.value,
                render: (r) => `${d.cost ? Math.round((r.value / d.cost) * 100) : 0}%`,
              },
            ]} />
          </Section>
        </>
      )}

      {tab === 'Reliability' && (
        <>
          <StatStrip items={[
            { label: 'MTTR', value: d.mttr, unit: 'h' },
            { label: 'Downtime', value: d.downtime, unit: 'h' },
            { label: 'Assets down', value: d.assets.filter((a) => a.status === 'Down').length, tone: 'red' },
            { label: 'Breakdown work', value: d.wos.filter((w) => w.work_order_type === 'Breakdown').length, tone: 'amber' },
            { label: 'Avg health score', value: d.assets.length ? Math.round(d.assets.reduce((n, a) => n + a.health_score, 0) / d.assets.length) : 0, unit: '%' },
          ]} />
          <Section title="Downtime by month">
            <BarPairs data={TREND} keys={['downtime_hours']} labels={['Downtime (h)']} colors={['#ef4444']} />
          </Section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(320px, 100%),1fr))', gap: 14 }}>
            <Section title="Downtime by asset type — worst ten">
              <HBars unit=" h" data={d.byType.slice().sort((a, b) => b.downtime - a.downtime).slice(0, 10).map((t) => ({ name: t.name, value: t.downtime }))} color="#ef4444" />
            </Section>
            <Section title="Assets by criticality"><Donut data={BY_STATUS(d.assets, 'criticality')} /></Section>
          </div>
          <Section title="Technician workload">
            <DataTable pageSize={10} rows={d.byPerson} columns={[
              { key: 'name', label: 'Technician', render: (r) => <span style={{ fontWeight: 600 }}>{r.name}</span> },
              { key: 'role', label: 'Role' },
              { key: 'assigned', label: 'Open', align: 'right' },
              { key: 'completed', label: 'Completed', align: 'right' },
              { key: 'hours', label: 'Hours', align: 'right', render: (r) => `${r.hours} h` },
              { key: 'avg', label: 'Avg per job', align: 'right', render: (r) => (r.avg ? `${r.avg} h` : '—') },
            ]} />
          </Section>
        </>
      )}

      {tab === 'Compliance' && (
        <>
          <StatStrip items={[
            { label: 'PM compliance', value: d.pms.length ? Math.round((d.pms.filter((p) => !isPast(p.next_due)).length / d.pms.length) * 100) : 100, unit: '%', tone: 'green' },
            { label: 'PM overdue', value: d.pms.filter((p) => isPast(p.next_due)).length, tone: 'red' },
            { label: 'Inspections', value: d.insp.length },
            { label: 'Inspection pass rate', value: d.insp.length ? Math.round((d.insp.filter((i) => i.result === 'Pass').length / d.insp.length) * 100) : 0, unit: '%' },
            { label: 'Open findings', value: d.insp.reduce((n, i) => n + i.findings_count, 0), tone: 'amber' },
          ]} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(320px, 100%),1fr))', gap: 14 }}>
            <Section title="Inspection results"><Donut data={BY_STATUS(d.insp, 'result')} colors={['#10b981', '#ef4444', '#f59e0b']} /></Section>
            <Section title="Inspections by type"><HBars data={BY_STATUS(d.insp, 'inspection_type')} /></Section>
          </div>
          <Section title="Overdue preventive maintenance">
            <DataTable pageSize={10}
              rows={d.pms.filter((p) => isPast(p.next_due))}
              empty="Nothing overdue — every schedule is inside its window."
              columns={[
                { key: 'schedule_name', label: 'Schedule', render: (r) => <span style={{ fontWeight: 600 }}>{r.schedule_name}</span> },
                { key: 'asset_name', label: 'Asset' },
                { key: 'assigned_to_name', label: 'Assigned to' },
                { key: 'next_due', label: 'Was due', sortValue: (r) => new Date(r.next_due).getTime(), render: (r) => <span style={{ color: '#b91c1c', fontWeight: 700 }}>{new Date(r.next_due).toLocaleDateString('en-GB')}</span> },
                { key: 'status', label: 'Status', render: (r) => <StatusBadge>Overdue</StatusBadge> },
              ]} />
          </Section>
        </>
      )}
    </div>
  )
}
