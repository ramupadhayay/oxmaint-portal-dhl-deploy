'use client'

// One failure mode, on its own page.
//
// This was a 560px drawer, and a drawer is the wrong container for it: the
// record is a function, a functional failure, a mechanism, two kinds of effect,
// a detection method, a signal, a warning time, a task, an interval, the units
// it applies to and the jobs already raised against it. Put that in a side
// panel and the reader scrolls a column the width of a phone while the screen
// behind them sits empty.
//
// It is also a record a person sends to somebody. A drawer has no address; this
// page does, so a reliability engineer can put the curing press bladder mode in
// an email and the person who opens it lands on the analysis rather than on a
// list to search.

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Wrench, CalendarClock, Gauge, Clock, AlertTriangle, Boxes, PlusCircle } from 'lucide-react'
import {
  PageHeader, Section, DataTable, Fields, StatusBadge, ActionButton, PALETTE,
} from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { useStore, useRecords } from '../lib/store'
import { useActions } from '../lib/actions'
import { USER, WORK_ORDERS, ASSETS, SITES, LOCATIONS, daysFrom, fmtDate } from '../lib/data'
import {
  CONSEQUENCE_TONE, STRATEGY_TONE, useRcm, scheduleFor, sourceFor, libraryKeyFromSlug, registerEntry,
  everyText,
} from '../lib/rcm'

const { SUB, MUTE, INK, LINE } = PALETTE
const woIdOf = (w) => w.workorder_id || w.recordId
const rpnColour = (rpn) => (rpn > 200 ? '#b91c1c' : rpn > 100 ? '#b45309' : '#047857')

// Why a task type follows from a consequence — the whole argument of RCM, and
// the reader who has just arrived on this page from a link is owed it.
const WHY = {
  'Failure-finding': 'The failure is hidden — nothing shows until the protection is called on — so the only '
    + 'useful task is to test that it still works.',
  'Condition-based': 'The mode gives warning on a signal that can be read, so the work is done when the '
    + 'warning appears rather than on a date.',
  'Time-based': 'There is warning but nothing to read it with, so the work is scheduled inside the warning time.',
  'Run to failure': 'No effective warning and a consequence the plant can absorb — planned spares and a '
    + 'quick repair beat paying for a task that finds nothing.',
  Redesign: 'No task answers this one at an acceptable risk, which makes it an engineering change rather '
    + 'than a maintenance interval.',
}

export default function RcmMode() {
  const router = useRouter()
  const { id } = useParams()
  const slug = decodeURIComponent(String(id || ''))
  const { scope, siteId } = useSite()
  const { rows, library } = useRcm(scope, libraryKeyFromSlug(slug))
  const { raiseWorkOrder } = useActions()
  const { create, notify } = useStore()
  const workOrders = useRecords('work_order', WORK_ORDERS, woIdOf)
  const assets = useRecords('asset', ASSETS, (a) => a.asset_id || a.recordId)
  const [busy, setBusy] = useState(false)

  const mode = rows.find((r) => r.slug === slug) || null

  // Jobs already raised for this mode, so the page answers "has anyone done
  // anything about this" without the reader going to the work order list and
  // searching for a sentence.
  const raised = useMemo(() => {
    if (!mode) return []
    const source = sourceFor(mode)
    return workOrders
      .filter((w) => w.raised_from === source)
      .sort((a, b) => String(b.created_date || '').localeCompare(String(a.created_date || '')))
  }, [workOrders, mode])

  if (!mode) {
    return (
      <div className="max-w-8xl mx-auto p-6">
        <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: 48, textAlign: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: INK }}>That failure mode is not in this analysis</h3>
          <p style={{ margin: '6px 0 14px', fontSize: 13, color: SUB }}>
            The link may be from another library, or from a build whose plant does not carry this equipment.
          </p>
          <ActionButton onClick={() => router.push('/portal/oxmaint/rcm-reliability')}>
            Back to the analysis
          </ActionButton>
        </div>
      </div>
    )
  }

  const unit = mode.unitList?.[0]?.asset || null
  const plan = scheduleFor(mode)

  const raise = async () => {
    if (!unit) {
      notify('No unit of this equipment is on this site, so there is nothing to raise the job against.', 'error')
      return
    }
    setBusy(true)
    const wo = await raiseWorkOrder({
      title: `${mode.kind} — ${mode.task}`.slice(0, 120),
      description: `${mode.fn}. Failure mode: ${mode.mode} — ${mode.effect}. `
        + `Consequence: ${mode.consequence}. Task: ${mode.task} (${mode.interval}).`
        + (mode.signal ? ` Condition signal: ${mode.signal}.` : ''),
      assetId: unit.asset_id || unit.recordId,
      asset: unit,
      type: mode.consequence === 'Hidden' ? 'Inspection' : 'Preventive',
      priority: mode.consequence === 'Safety' || mode.rpn > 200 ? 'High' : 'Medium',
      dueInDays: mode.checkEveryDays || 7,
      estimatedHours: 2,
      source: sourceFor(mode),
    })
    setBusy(false)
    if (wo) notify(`${wo.work_order_number} raised on ${unit.asset_code} — ${mode.task.slice(0, 60)}.`)
  }

  const schedule = async () => {
    if (!unit) {
      notify('No unit of this equipment is on this site to schedule against.', 'error')
      return
    }
    setBusy(true)
    const days = plan.unit === 'Months' ? plan.value * 30 : plan.value * 7
    const rec = await create('pm_schedule', {
      schedule_id: `pms_rcm_${Date.now().toString(36)}`,
      schedule_name: `${mode.kind} — ${mode.task}`.slice(0, 110),
      asset_id: unit.asset_id || unit.recordId,
      asset_name: unit.asset_name,
      asset_code: unit.asset_code,
      site_id: unit.site_id,
      site_name: unit.site_name,
      frequency_type: 'Time',
      frequency_value: plan.value,
      frequency_unit: plan.unit,
      meter_interval: 0,
      meter_at_last: 0,
      last_generated: null,
      next_due: daysFrom(days),
      assigned_to_name: USER.name,
      estimated_hours: 2,
      status: 'Active',
      raised_from: sourceFor(mode),
    })
    setBusy(false)
    if (rec) notify(`Schedule created on ${unit.asset_code} — ${everyText(plan)}.`)
  }

  // The first step where the plant has none of this equipment written down.
  // The analysis already knows what the machine is and how critical it is, so
  // the register entry is made from it rather than typed into a form again —
  // and the two actions above go live the moment it exists.
  const register = async () => {
    const site = SITES.find((s) => s.site_id === siteId) || SITES[0]
    if (!site) {
      notify('This build has no site to register the machine against.', 'error')
      return
    }
    const here = LOCATIONS.filter((l) => l.site_id === site.site_id)
    const location = here.find((l) => String(l.name || '').toLowerCase().includes(String(mode.stageLabel || '').toLowerCase().split(' ')[0]))
      || here[0] || null
    setBusy(true)
    const saved = await create('asset', registerEntry(mode, { site, location, existing: assets }))
    setBusy(false)
    if (saved) {
      notify(`${saved.asset_code} added to the register at ${site.site_name} — the tasks below can now be raised against it.`)
    }
  }

  return (
    <div className="max-w-8xl mx-auto p-6">
      <button
        type="button" onClick={() => router.push('/portal/oxmaint/rcm-reliability')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12, padding: '5px 10px',
          borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: SUB,
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}
      >
        <ArrowLeft size={13} /> {library?.own ? 'Reliability analysis' : `${library?.label} analysis`}
      </button>

      <PageHeader
        icon={sectionIcon('rcm-reliability', '#15227a')}
        title={mode.mode}
        subtitle={`${mode.kind} · ${mode.stageLabel} · ${mode.units > 0 ? `${mode.units} ${mode.units === 1 ? 'unit' : 'units'} on this site` : 'not in this register'}`}
        right={(
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {unit ? (
              <>
                <ActionButton disabled={busy} onClick={raise}>
                  {busy ? 'Working…' : 'Raise the work order'}
                </ActionButton>
                <ActionButton variant="subtle" disabled={busy} onClick={schedule}>
                  Add to the PM schedule
                </ActionButton>
              </>
            ) : (
              <ActionButton disabled={busy} onClick={register}>
                {busy ? 'Adding…' : 'Add this machine to the register'}
              </ActionButton>
            )}
          </div>
        )}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <StatusBadge tone={CONSEQUENCE_TONE[mode.consequence]}>{mode.consequence} consequence</StatusBadge>
        <StatusBadge tone={STRATEGY_TONE[mode.strategy]}>{mode.strategy}</StatusBadge>
        <StatusBadge tone="grey">{mode.criticality} criticality</StatusBadge>
        {mode.monitored && <StatusBadge tone="green">Monitored here</StatusBadge>}
        {mode.signalUnfitted && <StatusBadge tone="amber">Signal not fitted</StatusBadge>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12, marginBottom: 14 }}>
        <Figure label="Risk priority" value={mode.rpn} tone={rpnColour(mode.rpn)} Icon={Gauge}
          note={`${mode.severity} severity × ${mode.occurrence} occurrence × ${mode.detectability} detectability`} />
        <Figure label="One stop costs" value={`${mode.stopHours} h`} tone={INK} Icon={Clock}
          note={mode.eventsPerYear > 0
            ? `${mode.eventsPerYear} events a year per unit, modelled`
            : 'what a stop on this machine costs — this mode does not cause one'} />
        <Figure label="Hours a year at risk" value={mode.fleetHours > 0 ? `${mode.fleetHours} h` : '—'} tone={INK} Icon={AlertTriangle}
          note={mode.fleetHours > 0
            ? `across ${mode.units || 1} ${mode.units === 1 ? 'unit' : 'units'} · modelled`
            : 'nothing stops — the cost of this one is the defect that got out'} />
        <Figure label="Breakdowns, 12 mo" value={mode.failures} Icon={Boxes}
          tone={mode.failures ? '#b91c1c' : '#047857'}
          note={mode.failures ? 'booked on these units — occurrence was raised' : 'none booked on these units'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 14, alignItems: 'start' }}>
        <Section title="What fails, and what it costs">
          <Fields columns={1} rows={[
            ['Function', mode.fn],
            ['Functional failure', mode.ff],
            ['Failure mode', mode.mode],
            ['Effect on the plant', mode.effect],
            ['Effect on the product', mode.product],
            ['Equipment purpose', mode.purpose],
          ]} />
        </Section>

        <Section title="What finds it">
          <Fields columns={1} rows={[
            ['Detection', mode.detection],
            ['Condition signal', mode.signal || 'None — this one is found by inspection or by test'],
            ['Fitted here', mode.signal
              ? (mode.monitored
                ? `Yes — ${mode.unitsInstrumented} of ${mode.units} units instrumented`
                : 'No — the signal exists on this machine but no unit here is instrumented')
              : '—'],
            ['Warning time (P-F)', mode.pf > 0 ? `${mode.pf} days` : 'No warning — the failure is sudden or hidden'],
            ['Check no less often than', mode.checkEveryDays > 0
              ? `Every ${mode.checkEveryDays} days — half the warning, so it is not missed between checks`
              : 'Not applicable'],
          ]} />
        </Section>
      </div>

      <Section title="What we do about it" right={<span style={{ fontSize: 11.5, color: MUTE }}>{mode.strategy}</span>}>
        <Fields columns={1} rows={[
          ['Task', mode.task],
          ['Interval', mode.interval],
          ['Why this task', WHY[mode.strategy]],
          ['If scheduled from here', `${everyText(plan).replace(/^e/, 'E')} — ${plan.why}`],
        ]} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <ActionButton disabled={busy || !unit} onClick={raise}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Wrench size={13} /> Raise the work order
            </span>
          </ActionButton>
          <ActionButton variant="subtle" disabled={busy || !unit} onClick={schedule}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <CalendarClock size={13} /> Add to the PM schedule
            </span>
          </ActionButton>
          {!unit && (
            <ActionButton disabled={busy} onClick={register}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <PlusCircle size={13} /> Add this machine to the register
              </span>
            </ActionButton>
          )}
        </div>
        {!unit && (
          <p style={{ margin: '9px 0 0', fontSize: 11.5, color: MUTE }}>
            This register holds no {mode.kind.toLowerCase()}, so there is no unit to raise the work against yet.
            Adding one writes it in with the criticality and the purpose the analysis already gives it.
          </p>
        )}
      </Section>

      {raised.length > 0 && (
        <Section title={`Raised from this mode (${raised.length})`} right={<span style={{ fontSize: 11.5, color: MUTE }}>newest first</span>}>
          <DataTable
            rows={raised} pageSize={6}
            onRowClick={(w) => router.push(`/portal/oxmaint/work-orders/${encodeURIComponent(woIdOf(w))}`)}
            empty=""
            columns={[
              { key: 'work_order_number', label: 'Work order', width: 120, render: (w) => <span style={{ fontWeight: 700, color: '#15227a' }}>{w.work_order_number}</span> },
              { key: 'asset_code', label: 'Asset', width: 160 },
              { key: 'status', label: 'Status', width: 130, render: (w) => <StatusBadge>{w.status}</StatusBadge> },
              { key: 'assigned_to_name', label: 'Assigned to' },
              { key: 'due_date', label: 'Due', width: 110, render: (w) => fmtDate(w.due_date) },
            ]}
          />
        </Section>
      )}

      <Section
        title={`The units this applies to (${mode.unitList?.length || 0})`}
        right={<span style={{ fontSize: 11.5, color: MUTE }}>worst first · click one to open it</span>}
      >
        <DataTable
          rows={mode.unitList || []} pageSize={8}
          onRowClick={({ asset }) => router.push(`/portal/oxmaint/assets/${encodeURIComponent(asset.asset_id || asset.recordId)}`)}
          empty="No unit of this equipment type is in this register."
          columns={[
            { key: 'code', label: 'Asset', width: 170, sortValue: (u) => u.asset.asset_code, render: (u) => <span style={{ fontWeight: 700, color: '#15227a' }}>{u.asset.asset_code}</span> },
            { key: 'name', label: 'Name', render: (u) => u.asset.asset_name },
            { key: 'where', label: 'Location', render: (u) => <span style={{ color: SUB }}>{u.asset.functional_location_name || u.asset.site_name}</span> },
            { key: 'status', label: 'Status', width: 140, render: (u) => <StatusBadge tone={u.asset.status === 'Down' ? 'red' : u.asset.status === 'Under Maintenance' ? 'amber' : 'green'}>{u.asset.status}</StatusBadge> },
            {
              key: 'iot', label: 'Instrumented', width: 120,
              render: (u) => (u.asset.iot_enabled
                ? <StatusBadge tone="blue">Yes</StatusBadge>
                : <span style={{ fontSize: 11.5, color: MUTE }}>No</span>),
            },
            {
              key: 'failures', label: 'Breakdowns', align: 'right', width: 110,
              sortValue: (u) => u.failures,
              render: (u) => (u.failures > 0
                ? <span style={{ fontWeight: 700, color: '#b91c1c' }}>{u.failures}</span>
                : <span style={{ color: MUTE }}>—</span>),
            },
          ]}
        />
      </Section>
    </div>
  )
}

function Figure({ label, value, note, tone, Icon }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: 104,
      padding: '13px 15px', borderRadius: 12, background: '#fff',
      border: `1px solid ${LINE}`, boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 24 }}>
        {Icon && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 24, height: 24, borderRadius: 7, background: `${tone}14`, color: tone, flexShrink: 0,
          }}>
            <Icon size={14} strokeWidth={2.2} />
          </span>
        )}
        <span style={{
          fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: tone, lineHeight: 1.1, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: MUTE, marginTop: 'auto', paddingTop: 4, lineHeight: 1.45 }}>{note}</div>
    </div>
  )
}
