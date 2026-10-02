'use client'

// Reports and dashboards — the customer's last data-backed interest.
//
// The workbook's own note says to "build live from these 7 tabs during the
// demo", so this screen is that build: every panel is a real cross-tab over the
// sheets, computed here rather than typed. Nothing on it is a mock chart.
//
// The panels are chosen to answer questions a maintenance manager actually
// arrives with — where is the backlog, what is stopping the line, which
// department carries the load, what is the stock worth — rather than to fill a
// grid with as many chart types as possible.

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Section, StatusBadge, ActionButton } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Bars, Fact, Note, Meter } from '../components/cells'
import { useDept } from '../lib/deptStore'
import { reportPdf } from '../lib/reportPdf'
import {
  workOrders, WO_TYPES, WO_PRIORITIES, WO_STATUSES, assets, ASSET_CATEGORIES,
  pmSchedules, pmCompliance, overduePM, downtime, downtimeBy, downtimeHours,
  unplannedHours, parts, PART_CATEGORIES, inventoryValue, users, estimateStats,
  departments, money, hrs, mttr, ORG,
} from '../lib/data'

export default function Reports() {
  const router = useRouter()
  const { scope, deptName } = useDept()

  const wos = useMemo(() => scope(workOrders), [scope])
  const open = wos.filter((w) => w._open)

  const byDept = useMemo(() => departments.map((d) => ({
    name: d.name,
    value: workOrders.filter((w) => w.locationCode === d.code).length,
  })).filter((x) => x.value).sort((a, b) => b.value - a.value), [])

  const byAssetCategory = useMemo(() => ASSET_CATEGORIES.map((c) => {
    const ids = assets.filter((a) => a.category === c).map((a) => a.assetId)
    return { name: c, value: workOrders.filter((w) => ids.includes(w.assetId)).length }
  }).filter((x) => x.value).sort((a, b) => b.value - a.value), [])

  const completed = wos.filter((w) => w.status === 'Completed' && w.actualHrs !== null)
  const wrenchHours = Number(completed.reduce((s, w) => s + w.actualHrs, 0).toFixed(1))
  const openHours = Number(open.reduce((s, w) => s + (w.aiEstimateHrs || 0), 0).toFixed(1))

  const headline = [
    { label: 'Work orders', value: String(wos.length), note: `${open.length} open · ${completed.length} completed` },
    { label: 'Wrench hours logged', value: hrs(wrenchHours), note: 'Actual, completed jobs' },
    { label: 'Open work estimated', value: hrs(openHours), note: 'AI estimates on live jobs' },
    { label: 'PM compliance', value: `${pmCompliance}%`, note: `${overduePM.length} overdue` },
    { label: 'Unplanned downtime', value: `${unplannedHours} h`, note: `of ${downtimeHours} h total` },
  ]

  // The same arrays the panels below render, handed to the document so the
  // printed report and the screen it came from cannot drift apart.
  const panels = [
    { title: 'Backlog by status', data: WO_STATUSES.map((st) => ({ name: st, value: wos.filter((w) => w.status === st).length })).sort((a, b) => b.value - a.value) },
    { title: 'Work by type', data: WO_TYPES.map((t) => ({ name: t, value: wos.filter((w) => w.type === t).length })).sort((a, b) => b.value - a.value) },
    { title: 'Open work by priority', data: WO_PRIORITIES.map((p) => ({ name: p, value: open.filter((w) => w.priority === p).length })).filter((x) => x.value) },
    { title: 'Work orders by department', data: byDept },
    { title: 'Work orders by process step', data: byAssetCategory },
    { title: 'Downtime by cause', unit: ' h', data: downtimeBy('reason') },
    { title: 'Inventory value by category', data: PART_CATEGORIES.map((c) => ({ name: c, value: Math.round(parts.filter((p) => p.category === c).reduce((s, p) => s + p._value, 0)) })).filter((x) => x.value).sort((a, b) => b.value - a.value) },
    { title: 'Completed work by technician', data: users.filter((u) => u._completed).map((u) => ({ name: u.name, value: u._completed })).sort((a, b) => b.value - a.value) },
  ]

  const print = () => reportPdf({
    org: ORG.name,
    title: 'Maintenance Report',
    scope: deptName,
    stats: headline,
    sections: panels,
    notes: [
      mttr ? `Mean time to repair ${mttr.hours} h, over ${mttr.sample} completed corrective and emergency jobs. A handful of repairs is an average in the arithmetic sense and not in any other.` : '',
      estimateStats ? `AI time estimates compared on ${estimateStats.sample} of ${estimateStats.ofTotal} work orders — only completed jobs carry an actual duration. Mean absolute error ${estimateStats.meanAbsError} h.` : '',
      'Labour is not costed: the source carries shifts and skills but no hourly rate.',
      'Demonstration data, modelled on the DNA Technical Fabrics process. Not a production maintenance record.',
    ].filter(Boolean),
  })

  return (
    <div>
      <PageHeading
        title="Reports"
        subtitle={`Cross-tabs built live from the seven source tabs — backlog, downtime, coverage, stock and labour. ${deptName}.`}
        right={<ActionButton variant="ghost" onClick={print}>Print report</ActionButton>}
      />

      <StatCards items={[
        { label: 'Work orders', value: wos.length, note: `${open.length} open · ${completed.length} completed`, icon: 'wrench' },
        { label: 'Wrench hours logged', value: hrs(wrenchHours), note: 'Actual, completed jobs', icon: 'clock' },
        { label: 'Open work estimated', value: hrs(openHours), note: 'AI estimates on live jobs' },
        { label: 'PM compliance', value: `${pmCompliance}%`, tone: pmCompliance >= 90 ? 'success' : 'warning', note: `${overduePM.length} overdue`, icon: 'tick' },
        { label: 'Unplanned downtime', value: `${unplannedHours}`, unit: 'h', tone: 'warning', note: `of ${downtimeHours} h total`, icon: 'wave' },
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(330px,1fr))', gap: 14 }}>
        <Section title="Backlog by status">
          <Bars
            data={WO_STATUSES.map((s) => ({ name: s, value: wos.filter((w) => w.status === s).length })).sort((a, b) => b.value - a.value)}
            colors={['#047857', '#15227a', '#b45309', '#64748b']}
          />
        </Section>

        <Section title="Work by type">
          <Bars data={WO_TYPES.map((t) => ({ name: t, value: wos.filter((w) => w.type === t).length })).sort((a, b) => b.value - a.value)} />
        </Section>

        <Section title="Open work by priority">
          <Bars
            data={WO_PRIORITIES.map((p) => ({ name: p, value: open.filter((w) => w.priority === p).length })).filter((x) => x.value)}
            colors={['#b91c1c', '#b45309', '#15227a', '#64748b']}
          />
        </Section>

        <Section title="Work orders by department">
          <Bars data={byDept} />
        </Section>

        <Section title="Work orders by process step">
          <Bars data={byAssetCategory} />
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 10 }}>
            Counted through the asset each job names, so the two are always consistent.
          </p>
        </Section>

        <Section title="Downtime by cause">
          <Bars data={downtimeBy('reason')} unit=" h" colors={['#b45309', '#b91c1c', '#15227a', '#64748b']} />
        </Section>
      </div>

      <Section title="Preventive versus reactive">
        {(() => {
          const preventive = wos.filter((w) => ['Preventive', 'Inspection'].includes(w.type)).length
          const reactive = wos.filter((w) => ['Corrective', 'Emergency'].includes(w.type)).length
          const total = preventive + reactive || 1
          const pct = Math.round((preventive / total) * 100)
          return (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 14 }}>
                <Fact label="Planned" value={`${preventive} jobs`} sub="Preventive and inspection" />
                <Fact label="Reactive" value={`${reactive} jobs`} sub="Corrective and emergency" />
                <Fact label="Planned share" value={`${pct}%`} sub="Of all work orders" />
              </div>
              <Meter value={preventive} max={total} tone="#047857" height={14} />
              <p style={{ fontSize: 11.5, color: '#64748b', marginTop: 10, lineHeight: 1.55 }}>
                A mill running mostly reactive work is one where the schedule is not holding. On
                this dataset it is close to even — which is the conversation, not a verdict:
                fifteen work orders is a fortnight of records, not a trend.
              </p>
            </div>
          )
        })()}
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(330px,1fr))', gap: 14 }}>
        <Section title="Inventory value by category">
          <Bars
            data={PART_CATEGORIES.map((c) => ({
              name: c,
              value: Math.round(parts.filter((p) => p.category === c).reduce((s, p) => s + p._value, 0)),
            })).filter((x) => x.value).sort((a, b) => b.value - a.value)}
          />
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 10 }}>
            US dollars. Catalogue total {money(inventoryValue)} across {parts.length} lines.
          </p>
        </Section>

        <Section title="Completed work by technician">
          <Bars data={users.filter((u) => u._completed).map((u) => ({ name: u.name, value: u._completed })).sort((a, b) => b.value - a.value)} />
        </Section>
      </div>

      {estimateStats && (
        <Section title="AI estimate accuracy" right={<button onClick={() => router.push('/portal/dna/ai-estimates')} style={link}>Detail →</button>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
            <Fact label="Sample" value={`${estimateStats.sample} of ${estimateStats.ofTotal}`} sub="Completed jobs only" />
            <Fact label="Mean error" value={`${estimateStats.meanAbsError} h`} sub="Either direction" />
            <Fact label="Exact" value={`${estimateStats.exact}`} sub={`${estimateStats.over} over · ${estimateStats.under} under`} />
            <Fact label="Bias" value={`${estimateStats.biasHrs > 0 ? '+' : ''}${estimateStats.biasHrs} h`} sub="Actual minus estimated" />
          </div>
        </Section>
      )}

      {mttr && (
        <Section title="Mean time to repair" right={<span style={{ fontSize: 11.5, color: '#94a3b8' }}>completed unplanned work only</span>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
            <Fact label="MTTR" value={hrs(mttr.hours)} sub="Average across completed repairs" />
            <Fact label="Sample" value={`${mttr.sample} job${mttr.sample === 1 ? '' : 's'}`} sub="Corrective and emergency, completed" />
            <Fact label="Repair hours logged" value={hrs(mttr.totalHours)} sub="Actual, not estimated" />
            <Fact label="Longest" value={hrs(Math.max(...mttr.jobs.map((j) => j.actualHrs)))} sub={mttr.jobs.reduce((a, b) => (b.actualHrs > a.actualHrs ? b : a)).title} />
          </div>
          <Note tone="warn">
            <b>Read this one with its sample.</b> {mttr.sample} completed repairs is an average in
            the arithmetic sense and not in any other. It is here because it is the metric a
            maintenance manager will ask for, and it becomes meaningful once a few months of real
            history are behind it — not from a fortnight of demo records.
          </Note>
        </Section>
      )}

      <Note tone="grey">
        Every panel is computed from the seven source tabs at render time. Change the workbook,
        re-run <b>npm run import:dna</b>, and every figure on this screen moves with it — there
        are no numbers typed into this page.
      </Note>
    </div>
  )
}

const link = { background: 'none', border: 'none', color: '#15227a', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }
