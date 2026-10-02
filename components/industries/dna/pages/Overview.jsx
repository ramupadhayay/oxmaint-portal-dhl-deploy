'use client'

// The plant at a glance, and the only screen that reads across every sheet.
//
// Its numbers are counted from the data rather than written down. The covering
// document's own summary table claimed 21 assets, 10 PM tasks and 15 parts
// against a workbook holding 26, 13 and 18 — restating a figure is how that
// happens, and counting is what stops it happening again here.
//
// The capability strip at the bottom exists because three of the customer's
// stated interests are not data: the Android and Apple apps, real-time
// messaging, and training and support. The workbook says to raise those live
// rather than preload them. Naming them on the screen means the demo does not
// quietly skip an item on their own list.

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Section, DataTable, StatusBadge } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, DeptChip, TwoLine, DueDate, Note, Bars, Fact } from '../components/cells'
import { useDept } from '../lib/deptStore'
import {
  ORG, workOrders, openWorkOrders, overdueWorkOrders, unassignedWork,
  pmSchedules, overduePM, pmCompliance, assets, parts, partsBelowReorder,
  partsApproaching, inventoryValue, downtimeHours, unplannedHours, downtimeBy,
  estimateStats, money, ANCHOR, OFFSET_DAYS,
  openPurchaseOrders, poCommitted, posForPart,
} from '../lib/data'

const CAPABILITIES = [
  ['Mobile app — Android & iOS', 'Shown live in the platform. Technicians close jobs, attach photos and scan assets from the floor.'],
  ['Real-time messaging', 'Shown live. Messages attach to the work order, so the thread stays with the job rather than in a chat app.'],
  ['Training & support', 'A services conversation, not a data table — onboarding, admin training and the support plan.'],
]

export default function Overview() {
  const router = useRouter()
  const { scope, deptName } = useDept()
  const go = (key) => router.push(`/portal/dna/${key}`)

  const wos = useMemo(() => scope(workOrders), [scope])
  const open = wos.filter((w) => w._open)
  const overdue = wos.filter((w) => w._overdue)
  const myAssets = useMemo(() => scope(assets), [scope])
  const myPm = useMemo(() => pmSchedules.filter((p) => scope([{ locationCode: p._asset?.locationCode }]).length), [scope])

  const down = myAssets.filter((a) => a.status === 'Down')

  const stats = [
    { label: 'Assets', value: myAssets.length, note: `${down.length} down · ${myAssets.filter((a) => a.status === 'Standby').length} standby`, tone: down.length ? 'amber' : undefined, to: 'assets', icon: 'asset' },
    { label: 'Open work orders', value: open.length, note: `${unassignedWork.length} unassigned`, to: 'work-orders', icon: 'wrench' },
    { label: 'Overdue', value: overdue.length, tone: overdue.length ? 'destructive' : 'success', note: overdue.length ? overdue.map((w) => w.woNo).join(', ') : 'Nothing past its date', to: 'work-orders', icon: 'clock' },
    { label: 'PM compliance', value: `${pmCompliance}%`, tone: pmCompliance >= 90 ? 'success' : 'warning', note: `${overduePM.length} of ${pmSchedules.length} overdue`, to: 'pm-schedules', icon: 'tick' },
    { label: 'Unplanned downtime', value: `${unplannedHours}`, unit: 'h', note: `of ${downtimeHours} h logged`, tone: 'warning', to: 'downtime', icon: 'wave' },
  ]

  const upcoming = [...open].sort((a, b) => (a._daysToDue ?? 999) - (b._daysToDue ?? 999)).slice(0, 7)
  const duePm = [...pmSchedules].sort((a, b) => (a._daysToDue ?? 999) - (b._daysToDue ?? 999)).slice(0, 6)

  return (
    <div>
      <PageHeading
        title="Overview"
        subtitle={`${ORG.name} — ${ORG.siteName}. Work, schedules, stock and downtime across the spinning, weaving, dyeing, FR finishing, testing and utilities line — ${deptName}.`}
      />

      <StatCards items={stats} onCardClick={go} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 14 }}>
        <Section
          title="What needs attention"
          right={<button onClick={() => go('work-orders')} style={link}>All work orders →</button>}
        >
          <DataTable
            rows={upcoming}
            pageSize={7}
            onRowClick={(w) => router.push(`/portal/dna/work-orders/${w.woNo}`)}
            empty="No open work for this department."
            columns={[
              { key: 'woNo', label: 'WO', width: 96, render: (w) => <Ref>{w.woNo}</Ref> },
              { key: 'title', label: 'Job', render: (w) => <TwoLine top={w.title} bottom={`${w._assetName} · ${w.type}`} /> },
              { key: 'locationCode', label: 'Dept', width: 76, render: (w) => <DeptChip code={w.locationCode} name={w._locationName} /> },
              { key: 'dueDate', label: 'Due', width: 118, sortValue: (w) => w._daysToDue, render: (w) => <DueDate value={w.dueDate} days={w._daysToDue} /> },
              { key: 'assignedTo', label: 'Assigned', width: 130, render: (w) => (w.assignedTo === 'Unassigned' ? <span style={{ color: '#b45309', fontWeight: 700, fontSize: 11.5 }}>Unassigned</span> : w.assignedTo) },
              { key: 'status', label: 'Status', width: 110, render: (w) => <StatusBadge>{w.status}</StatusBadge> },
            ]}
          />
        </Section>

        <div>
          <Section title="PM schedule" right={<button onClick={() => go('pm-schedules')} style={link}>All →</button>}>
            {duePm.map((p) => (
              <div key={p.pmId} style={row}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a', lineHeight: 1.35 }}>{p.task}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{p._assetName} · {p.frequency}</div>
                  </div>
                  <StatusBadge tone={p._status === 'Overdue' ? 'red' : p._status === 'Due today' ? 'amber' : p._status === 'Due soon' ? 'blue' : 'green'}>
                    {p._status}
                  </StatusBadge>
                </div>
              </div>
            ))}
          </Section>

          <Section title="Downtime by category" right={<button onClick={() => go('downtime')} style={link}>Log →</button>}>
            <Bars data={downtimeBy('category')} unit=" h" colors={['#b45309', '#15227a', '#64748b']} />
          </Section>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
        <Section title="Parts & inventory" right={<button onClick={() => go('parts')} style={link}>Inventory →</button>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
            <Fact label="Stock value" value={money(inventoryValue)} sub={`${parts.length} catalogue lines`} />
            <Fact label="Below reorder" value={partsBelowReorder.length} sub={partsBelowReorder.length ? 'Raise a requisition' : 'Nothing to reorder'} />
            <Fact label="Approaching" value={partsApproaching.length} sub={partsApproaching.map((p) => p.partNo).join(', ') || '—'} />
            <Fact label="On order" value={money(poCommitted)} sub={`${openPurchaseOrders.length} open purchase orders`} />
          </div>
          {partsBelowReorder.length > 0 && (
            <Note tone={partsBelowReorder.some((p) => !posForPart(p.partNo).some((o) => o._open)) ? 'warn' : 'grey'}>
              {partsBelowReorder.filter((p) => !posForPart(p.partNo).some((o) => o._open)).length} of the{' '}
              {partsBelowReorder.length} shortages have no purchase order raised against them.
            </Note>
          )}
        </Section>

        <Section title="AI time estimates" right={<button onClick={() => go('ai-estimates')} style={link}>Detail →</button>}>
          {estimateStats ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
                <Fact label="Mean error" value={`${estimateStats.meanAbsError} h`} sub={`across ${estimateStats.sample} completed jobs`} />
                <Fact label="Exact" value={`${estimateStats.exact} of ${estimateStats.sample}`} sub={`${estimateStats.over} over · ${estimateStats.under} under`} />
                <Fact label="Total bias" value={`${estimateStats.biasHrs > 0 ? '+' : ''}${estimateStats.biasHrs} h`} sub={`${estimateStats.totalActual} h actual vs ${estimateStats.totalEstimated} h estimated`} />
              </div>
              <Note>
                Only completed jobs carry an actual duration, so this compares
                <b> {estimateStats.sample} of {estimateStats.ofTotal}</b> work orders. Worth saying
                out loud before the accuracy figure is quoted.
              </Note>
            </>
          ) : <Note tone="grey">No completed work orders carry both an estimate and an actual.</Note>}
        </Section>
      </div>

      <Section title="Also on the platform" right={<span style={{ fontSize: 11.5, color: '#94a3b8' }}>Shown live, not preloaded</span>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
          {CAPABILITIES.map(([title, body]) => (
            <div key={title} style={{ padding: '13px 15px', border: '1px solid #e4e9f0', borderRadius: 11, background: '#fff' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{title}</div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 6, lineHeight: 1.55 }}>{body}</div>
            </div>
          ))}
        </div>
      </Section>

      {ANCHOR && OFFSET_DAYS !== 0 && (
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 16, lineHeight: 1.6 }}>
          Dates are shown {OFFSET_DAYS > 0 ? `${OFFSET_DAYS} days later than` : `${Math.abs(OFFSET_DAYS)} days earlier than`} the
          workbook, so the demo opens on a live-looking week. The stored values are the sheet&apos;s own —
          see Data &amp; Notes.
        </p>
      )}
    </div>
  )
}

const link = { background: 'none', border: 'none', color: '#15227a', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }
const row = { padding: '11px 0', borderBottom: '1px solid #eef1f6' }
