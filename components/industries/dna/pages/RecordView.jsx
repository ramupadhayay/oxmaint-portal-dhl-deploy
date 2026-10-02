'use client'

// One work order, one asset or one PM schedule, opened in full.
//
// Three record types share this file because they are read the same way: a
// detail sheet, then everything that hangs off it. A work order shows the asset
// and the parts that fit it; an asset shows its jobs, schedules, downtime and
// spares; a schedule shows the machine and its history.
//
// That cross-linking is the point of the screen. The customer's list asks for
// assets, work orders, PM, parts and downtime as five separate things, and what
// a CMMS actually gives them is one graph — the demo lands when a loom is opened
// from a downtime record and its overdue job, its schedule and its reeds are all
// already there.

import { useRouter } from 'next/navigation'
import { Section, DataTable, StatusBadge, Priority, ActionButton } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { Ref, DeptChip, TwoLine, DueDate, Criticality, Variance, Note, Meter, Fact } from '../components/cells'
import {
  workOrders, assets, pmSchedules, parts, downtime, fmtDate, money, hrs, ORG,
} from '../lib/data'
import LinkedOrders from '../components/LinkedOrders'
import PurchaseOrderView from './PurchaseOrderView'
import { workOrderPdf } from '../lib/workOrderPdf'

const STATUS_TONE = { Running: 'green', Standby: 'blue', Down: 'red' }
const PM_TONE = { Overdue: 'red', 'Due today': 'amber', 'Due soon': 'blue', Scheduled: 'green' }

export default function RecordView({ section, id }) {
  const router = useRouter()
  const back = () => router.push(`/portal/dna/${section}`)

  if (section === 'work-orders') return <WorkOrderView id={id} back={back} router={router} />
  if (section === 'assets') return <AssetView id={id} back={back} router={router} />
  if (section === 'pm-schedules') return <PmView id={id} back={back} router={router} />
  if (section === 'purchase-orders') return <PurchaseOrderView id={id} />
  return <NotFound what="record" id={id} back={back} />
}

// ── work order ───────────────────────────────────────────────────────────
function WorkOrderView({ id, back, router }) {
  const w = workOrders.find((x) => x.woNo === id)
  if (!w) return <NotFound what="work order" id={id} back={back} />

  const asset = assets.find((a) => a.assetId === w.assetId)
  const fits = parts.filter((p) => p.compatible.includes(w.assetId))
  const stops = downtime.filter((d) => d.assetId === w.assetId)

  return (
    <div>
      <PageHeading
        back={{ label: 'Work Orders', onClick: back }}
        title={w.title}
        subtitle={`${w.type} · ${w.woNo} · raised by ${w.requestedBy}`}
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Priority value={w.priority} />
            <StatusBadge>{w.status}</StatusBadge>
            <ActionButton
              variant="ghost"
              onClick={() => workOrderPdf(w, {
                org: ORG,
                asset,
                parts: fits,
                schedule: pmSchedules.find((p) => p.assetId === w.assetId),
              })}
            >
              Job sheet
            </ActionButton>
          </div>
        }
      />

      {w._overdue && (
        <Note tone="warn">
          <b>{Math.abs(w._daysToDue)} days past its due date</b> and still {w.status.toLowerCase()}.
        </Note>
      )}

      <Section title="Job detail">
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#334155', lineHeight: 1.6 }}>{w.description}</p>
        <Grid rows={[
          ['Work order', <Ref key="r">{w.woNo}</Ref>],
          ['Type', w.type],
          ['Priority', <Priority key="p" value={w.priority} />],
          ['Status', <StatusBadge key="s">{w.status}</StatusBadge>],
          ['Asset', asset
            ? <button key="a" onClick={() => router.push(`/portal/dna/assets/${asset.assetId}`)} style={linkBtn}>{asset.name} — {asset.assetId} →</button>
            : w.assetId],
          ['Department', <span key="d" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><DeptChip code={w.locationCode} name={w._locationName} />{w._locationName}</span>],
          ['Requested by', w.requestedBy],
          ['Assigned to', w.assignedTo === 'Unassigned'
            ? <span key="u" style={{ color: '#b45309', fontWeight: 700 }}>Unassigned</span>
            : w.assignedTo],
          ['Raised', fmtDate(w.dateRequested)],
          ['Due', <DueDate key="dd" value={w.dueDate} days={w._daysToDue} done={!w._open} />],
          ['Completed', w.dateCompleted ? fmtDate(w.dateCompleted) : '—'],
        ]} />
      </Section>

      <Section title="Time">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
          <Fact label="AI estimate" value={w.aiEstimateHrs !== null ? hrs(w.aiEstimateHrs) : '—'} sub="Predicted before the job started" />
          <Fact label="Actual" value={w.actualHrs !== null ? hrs(w.actualHrs) : 'Not yet recorded'} sub={w.actualHrs === null ? 'Job is still open' : 'Logged on completion'} />
          <Fact
            label="Variance"
            value={w._variance === null ? '—' : w._variance === 0 ? 'Exact' : `${w._variance > 0 ? '+' : '−'}${Math.abs(w._variance).toFixed(1)} h`}
            sub={w._variance === null ? 'Nothing to compare yet' : w._variance === 0 ? 'Estimate matched' : w._variance > 0 ? 'Ran longer than estimated' : 'Came in short'}
          />
        </div>
        {w._variance !== null && w.aiEstimateHrs > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 58px', gap: 10, alignItems: 'center' }}>
              <span style={miniLabel}>AI est.</span>
              <Meter value={w.aiEstimateHrs} max={Math.max(w.aiEstimateHrs, w.actualHrs)} tone="#94a3b8" height={10} />
              <span style={miniFig}>{hrs(w.aiEstimateHrs)}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 58px', gap: 10, alignItems: 'center', marginTop: 6 }}>
              <span style={miniLabel}>Actual</span>
              <Meter value={w.actualHrs} max={Math.max(w.aiEstimateHrs, w.actualHrs)} tone={w._variance === 0 ? '#047857' : '#b45309'} height={10} />
              <span style={miniFig}>{hrs(w.actualHrs)}</span>
            </div>
          </div>
        )}
      </Section>

      {fits.length > 0 && (
        <Section title={`Parts that fit this asset (${fits.length})`}>
          <PartsTable rows={fits} />
        </Section>
      )}

      {stops.length > 0 && (
        <Section title={`Downtime on this asset (${stops.length})`}>
          <DowntimeTable rows={stops} />
        </Section>
      )}

      <LinkedOrders ids={[w.woNo, w.assetId]} router={router} label="Purchase orders raised for this job" />
    </div>
  )
}

// ── asset ────────────────────────────────────────────────────────────────
function AssetView({ id, back, router }) {
  const a = assets.find((x) => x.assetId === id)
  if (!a) return <NotFound what="asset" id={id} back={back} />

  const jobs = workOrders.filter((w) => w.assetId === a.assetId)
  const pms = pmSchedules.filter((p) => p.assetId === a.assetId)
  const fits = parts.filter((p) => p.compatible.includes(a.assetId))
  const stops = downtime.filter((d) => d.assetId === a.assetId)

  return (
    <div>
      <PageHeading
        back={{ label: 'Asset Register', onClick: back }}
        title={a.name}
        subtitle={`${a.category} · ${a.manufacturer} ${a.model} · ${a._locationName}`}
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Criticality value={a.criticality} />
            <StatusBadge tone={STATUS_TONE[a.status]}>{a.status}</StatusBadge>
          </div>
        }
      />

      {a.status === 'Down' && (
        <Note tone="warn">
          <b>This machine is down.</b>{' '}
          {jobs.filter((w) => w._open).length
            ? `${jobs.filter((w) => w._open).map((w) => w.woNo).join(', ')} is open against it.`
            : 'No open work order is recorded against it — worth raising one.'}
        </Note>
      )}

      {!pms.length && !jobs.length && (
        <Note tone="warn">
          This asset carries no PM schedule and no work order. That may be deliberate — a standby
          unit or a lab instrument — but it is a coverage gap worth a decision.
        </Note>
      )}

      <Section title="Nameplate">
        <Grid rows={[
          ['Asset ID', <Ref key="r">{a.assetId}</Ref>],
          ['Category', a.category],
          ['Manufacturer', a.manufacturer],
          ['Model', a.model],
          ['Serial number', <span key="s" style={{ fontFamily: 'ui-monospace, monospace' }}>{a.serial}</span>],
          ['Installed', fmtDate(a.installDate)],
          ['Department', <span key="d" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><DeptChip code={a.locationCode} name={a._locationName} />{a._locationName}</span>],
          ['Criticality', <Criticality key="c" value={a.criticality} />],
          ['Status', <StatusBadge key="st" tone={STATUS_TONE[a.status]}>{a.status}</StatusBadge>],
        ]} />
      </Section>

      <Section title="At a glance">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <Fact label="Work orders" value={jobs.length} sub={`${jobs.filter((w) => w._open).length} open`} />
          <Fact label="PM schedules" value={pms.length} sub={pms.filter((p) => p._status === 'Overdue').length ? `${pms.filter((p) => p._status === 'Overdue').length} overdue` : 'In date'} />
          <Fact label="Downtime" value={hrs(a._downtimeHrs)} sub={`${stops.length} event${stops.length === 1 ? '' : 's'}`} />
          <Fact label="Spares held" value={fits.length} sub={fits.length ? money(fits.reduce((s, p) => s + p._value, 0)) : 'None catalogued'} />
        </div>
      </Section>

      {jobs.length > 0 && (
        <Section title={`Work orders (${jobs.length})`}>
          <DataTable
            rows={jobs}
            pageSize={10}
            onRowClick={(w) => router.push(`/portal/dna/work-orders/${w.woNo}`)}
            empty=""
            columns={[
              { key: 'woNo', label: 'WO', width: 96, render: (w) => <Ref>{w.woNo}</Ref> },
              { key: 'title', label: 'Job', render: (w) => <TwoLine top={w.title} bottom={w.type} /> },
              { key: 'dueDate', label: 'Due', width: 118, sortValue: (w) => w._daysToDue ?? 9999, render: (w) => <DueDate value={w.dueDate} days={w._daysToDue} done={!w._open} /> },
              { key: 'assignedTo', label: 'Assigned', width: 132 },
              { key: '_variance', label: 'vs est.', width: 90, align: 'right', render: (w) => <Variance hours={w._variance} /> },
              { key: 'status', label: 'Status', width: 110, render: (w) => <StatusBadge>{w.status}</StatusBadge> },
            ]}
          />
        </Section>
      )}

      {pms.length > 0 && (
        <Section title={`PM schedules (${pms.length})`}>
          <DataTable
            rows={pms}
            pageSize={10}
            onRowClick={(p) => router.push(`/portal/dna/pm-schedules/${p.pmId}`)}
            empty=""
            columns={[
              { key: 'pmId', label: 'PM', width: 84, render: (p) => <Ref>{p.pmId}</Ref> },
              { key: 'task', label: 'Task', render: (p) => <TwoLine top={p.task} bottom={p.checklist} /> },
              { key: 'frequency', label: 'Frequency', width: 110 },
              { key: 'nextDue', label: 'Next due', width: 120, sortValue: (p) => p._daysToDue ?? 9999, render: (p) => <DueDate value={p.nextDue} days={p._daysToDue} /> },
              { key: 'team', label: 'Team', width: 170 },
              { key: '_status', label: 'Status', width: 112, render: (p) => <StatusBadge tone={PM_TONE[p._status]}>{p._status}</StatusBadge> },
            ]}
          />
        </Section>
      )}

      {fits.length > 0 && (
        <Section title={`Spares that fit (${fits.length})`}>
          <PartsTable rows={fits} />
        </Section>
      )}

      {stops.length > 0 && (
        <Section title={`Downtime history (${stops.length})`}>
          <DowntimeTable rows={stops} />
        </Section>
      )}

      <LinkedOrders ids={[a.assetId]} router={router} label="Purchase orders naming this asset" />
    </div>
  )
}

// ── PM schedule ──────────────────────────────────────────────────────────
function PmView({ id, back, router }) {
  const p = pmSchedules.find((x) => x.pmId === id)
  if (!p) return <NotFound what="PM schedule" id={id} back={back} />

  const asset = assets.find((a) => a.assetId === p.assetId)
  const jobs = workOrders.filter((w) => w.assetId === p.assetId && w.type === 'Preventive')

  return (
    <div>
      <PageHeading
        back={{ label: 'PM Schedules', onClick: back }}
        title={p.task}
        subtitle={`${p.frequency} · ${p.pmId} · ${p.team}`}
        right={<StatusBadge tone={PM_TONE[p._status]}>{p._status}</StatusBadge>}
      />

      {p._status === 'Overdue' && (
        <Note tone="warn">
          <b>{Math.abs(p._daysToDue)} days past due.</b> Last completed {fmtDate(p.lastDone)}.
        </Note>
      )}

      <Section title="Schedule">
        <Grid rows={[
          ['Reference', <Ref key="r">{p.pmId}</Ref>],
          ['Asset', asset
            ? <button key="a" onClick={() => router.push(`/portal/dna/assets/${asset.assetId}`)} style={linkBtn}>{asset.name} — {asset.assetId} →</button>
            : p.assetId],
          ['Department', <span key="d" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><DeptChip code={asset?.locationCode} name={p._locationName} />{p._locationName}</span>],
          ['Frequency', p.frequency],
          ['Last done', fmtDate(p.lastDone)],
          ['Next due', <DueDate key="n" value={p.nextDue} days={p._daysToDue} />],
          ['Estimated duration', hrs(p.estimateHrs)],
          ['Assigned team', p.team],
        ]} />
      </Section>

      <Section title="Checklist">
        <div style={{ display: 'grid', gap: 8 }}>
          {p.checklist.split(',').map((step) => step.trim()).filter(Boolean).map((step) => (
            <div key={step} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 13px', border: '1px solid #e4e9f0', borderRadius: 9, background: '#fff' }}>
              <span style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px solid #cbd5e1', flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: '#334155' }}>{step}</span>
            </div>
          ))}
        </div>
        <Note tone="grey">
          The workbook supplies the checklist as one summary line per schedule, split here into its
          steps. No completion history was supplied, so nothing is ticked.
        </Note>
      </Section>

      {jobs.length > 0 && (
        <Section title={`Preventive work on this asset (${jobs.length})`}>
          <DataTable
            rows={jobs}
            pageSize={10}
            onRowClick={(w) => router.push(`/portal/dna/work-orders/${w.woNo}`)}
            empty=""
            columns={[
              { key: 'woNo', label: 'WO', width: 96, render: (w) => <Ref>{w.woNo}</Ref> },
              { key: 'title', label: 'Job' },
              { key: 'dueDate', label: 'Due', width: 118, render: (w) => <DueDate value={w.dueDate} days={w._daysToDue} done={!w._open} /> },
              { key: '_variance', label: 'vs est.', width: 90, align: 'right', render: (w) => <Variance hours={w._variance} /> },
              { key: 'status', label: 'Status', width: 110, render: (w) => <StatusBadge>{w.status}</StatusBadge> },
            ]}
          />
        </Section>
      )}

      <LinkedOrders ids={[p.pmId, p.assetId]} router={router} label="Purchase orders raised for this schedule" />
    </div>
  )
}

// ── shared ───────────────────────────────────────────────────────────────
function PartsTable({ rows }) {
  return (
    <DataTable
      rows={rows}
      pageSize={10}
      empty=""
      columns={[
        { key: 'partNo', label: 'Part', width: 106, render: (p) => <Ref>{p.partNo}</Ref> },
        { key: 'name', label: 'Description', render: (p) => <TwoLine top={p.name} bottom={p.supplier} /> },
        { key: 'storeroom', label: 'Storeroom', width: 92, render: (p) => <DeptChip code={p.storeroom} name={p._storeroomName} /> },
        { key: 'qtyOnHand', label: 'On hand', width: 96, align: 'right', render: (p) => <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{p.qtyOnHand} / {p.reorderPoint}</span> },
        { key: 'unitCost', label: 'Unit', width: 88, align: 'right', render: (p) => money(p.unitCost) },
        { key: '_state', label: 'Stock', width: 152, render: (p) => <StatusBadge tone={p._state === 'In stock' ? 'green' : p._state === 'Approaching reorder' ? 'amber' : 'red'}>{p._state}</StatusBadge> },
      ]}
    />
  )
}

function DowntimeTable({ rows }) {
  return (
    <DataTable
      rows={rows}
      pageSize={10}
      empty=""
      columns={[
        { key: 'logId', label: 'Log', width: 84, render: (d) => <Ref>{d.logId}</Ref> },
        { key: 'start', label: 'Started', width: 152, render: (d) => <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{d.start}</span> },
        { key: 'hours', label: 'Duration', width: 96, align: 'right', render: (d) => <span style={{ fontWeight: 700 }}>{hrs(d.hours)}</span> },
        { key: 'reason', label: 'Reason' },
        { key: 'category', label: 'Category', width: 118, render: (d) => <StatusBadge tone={d._planned ? 'green' : d.category === 'Electrical' ? 'blue' : 'amber'}>{d.category}</StatusBadge> },
        { key: 'reportedBy', label: 'Reported by', width: 148 },
      ]}
    />
  )
}

// A label/value sheet, in as many columns as the width allows.
//
// The column gap is not decoration. Each row is `space-between` — label pushed
// left, value pushed right — so with no gutter the value at the right edge of
// one column landed flush against the label at the left edge of the next, and
// the sheet read "WO-2001Type", "EmergencyPriority", "CriticalStatus". Two
// correct rows touching look like one wrong one.
//
// Only the column gap is opened up. A row gap would break the run of bottom
// borders that makes each column read as a list.
function Grid({ rows }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', columnGap: 32, rowGap: 0 }}>
      {rows.map(([k, v], i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          gap: 14, padding: '9px 0',
          borderBottomStyle: 'solid', borderBottomWidth: 1, borderBottomColor: '#eef1f6',
        }}>
          <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600, flexShrink: 0 }}>{k}</span>
          <span style={{ fontSize: 12.5, color: '#0f172a', textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span>
        </div>
      ))}
    </div>
  )
}

function NotFound({ what, id, back }) {
  return (
    <PageHeading
      back={{ label: 'Back', onClick: back }}
      title={`No ${what} with that reference`}
      subtitle={`Nothing in the demo dataset is filed under “${id}”. The reference may belong to a record outside this sample, or it may have been mistyped.`}
    />
  )
}

const linkBtn = { background: 'none', border: 'none', color: '#15227a', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0, textAlign: 'right' }
const miniLabel = { fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#94a3b8' }
const miniFig = { fontSize: 12, fontWeight: 700, color: '#0f172a', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
