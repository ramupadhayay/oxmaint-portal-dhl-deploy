'use client'

// RCM Reliability.
//
// Where a pack carries a reliability analysis, this screen is that analysis and
// the decisions that follow from it. Where a pack does not, the screen keeps the
// generic FMEA table it always had — the second half of this file.
//
// The screen answers four questions in the order a reliability engineer asks
// them. What are we carrying (the counts). What is the worst of it (risk bands
// and the table, sorted). Which machines does it sit on (the units, named and
// linked, not a number). And what do we do about it — which is a button that
// writes a work order or a schedule, not a recommendation to write one later.
//
// Consequence, not the risk number, decides the kind of answer: a hidden
// failure is tested for, a safety consequence needs a task that works or a
// design change, a production consequence is an economic call. The screen says
// which of those each line is.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Boxes, ListChecks, ShieldAlert, EyeOff, AlertTriangle, Clock } from 'lucide-react'
import {
  PageHeader, StatStrip, Toolbar, DataTable, Drawer, Fields, Section, StatusBadge,
  ActionButton, PALETTE,
} from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { useStore, useRecords } from '../lib/store'
import { useActions } from '../lib/actions'
import { RCM } from '../lib/dataMaint'
import { USER, ASSETS, SITES, LOCATIONS, daysFrom } from '../lib/data'
import {
  RCM_ACTIVE, CONSEQUENCES, CONSEQUENCE_TONE, STRATEGY_TONE, RCM_LIBRARIES,
  DEFAULT_LIBRARY_KEY, useRcm, scheduleFor, sourceFor, registerEntry,
} from '../lib/rcm'
import ComponentPhotos from './ComponentPhotos'

const { SUB, MUTE, INK, LINE } = PALETTE

const rpnColour = (rpn) => (rpn > 200 ? '#b91c1c' : rpn > 100 ? '#b45309' : '#047857')
const BANDS = { High: 'RPN above 200', Medium: 'RPN 101–200', Low: 'RPN 100 or below' }
const bandOf = (rpn) => (rpn > 200 ? 'High' : rpn > 100 ? 'Medium' : 'Low')

/**
 * Which analysis is on screen.
 *
 * A build whose pack carries its own opens on it. Every build also carries the
 * industry libraries, so a reliability conversation about a tyre plant can be
 * had on whichever portal is already open — no second deployment, no container
 * per industry. A build with no analysis of its own keeps the generic FMEA it
 * always had as its first option, and the libraries sit beside it.
 */
export default function Rcm() {
  const [libraryKey, setLibraryKey] = useState(DEFAULT_LIBRARY_KEY)

  const options = [
    ...(RCM_ACTIVE ? [] : [{ key: 'plant', label: 'This plant', own: true }]),
    ...RCM_LIBRARIES,
  ]
  const picker = options.length > 1 ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
      <span style={{ fontSize: 11.5, color: MUTE }}>Analysis</span>
      {options.map((o) => (
        <Tab key={o.key} on={libraryKey === o.key} onClick={() => setLibraryKey(o.key)}>
          {o.label}{o.own ? '' : ' · reference'}
        </Tab>
      ))}
    </div>
  ) : null

  return libraryKey === 'plant' && !RCM_ACTIVE
    ? <LegacyFmea picker={picker} />
    : <RcmAnalysis libraryKey={libraryKey} picker={picker} />
}

// ── the analysis, where the pack carries one ───────────────────────────────

function RcmAnalysis({ libraryKey, picker }) {
  const router = useRouter()
  const { scope, siteName, siteId } = useSite()
  const { rows, stages, totals, library } = useRcm(scope, libraryKey)
  const { raiseWorkOrder } = useActions()
  const { create, notify } = useStore()
  const assets = useRecords('asset', ASSETS, (a) => a.asset_id || a.recordId)

  const [view, setView] = useState('modes')
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState('all')
  const [consequence, setConsequence] = useState('all')
  const [strategy, setStrategy] = useState('all')
  const [band, setBand] = useState('all')
  const [busy, setBusy] = useState('')

  // A mode opens at its own address rather than in a side panel.
  const openMode = (m) => router.push(`/portal/oxmaint/rcm-reliability/${encodeURIComponent(m.slug)}`)

  const stageNames = useMemo(() => stages.map((s) => s.label), [stages])
  const strategies = useMemo(() => [...new Set(rows.map((r) => r.strategy))].sort(), [rows])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => (
      (stage === 'all' || r.stageLabel === stage) &&
      (consequence === 'all' || r.consequence === consequence) &&
      (strategy === 'all' || r.strategy === strategy) &&
      (band === 'all' || bandOf(r.rpn) === band) &&
      (!q || [r.kind, r.mode, r.fn, r.ff, r.effect, r.product, r.task, r.signal]
        .filter(Boolean).join(' ').toLowerCase().includes(q))
    ))
  }, [rows, search, stage, consequence, strategy, band])

  // ── the two things this screen can do about a mode ───────────────────────
  //
  // Both write a real record against a real unit. A screen that ends at
  // "recommended task" leaves the work where it found it.

  const unitFor = (mode) => mode.unitList?.[0]?.asset || null

  const raise = async (mode) => {
    const unit = unitFor(mode)
    if (!unit) {
      notify('No unit of this equipment is on this site, so there is nothing to raise the job against.', 'error')
      return
    }
    setBusy(mode.id)
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
    setBusy('')
    if (wo) notify(`${wo.work_order_number} raised on ${unit.asset_code} — ${mode.task.slice(0, 60)}.`)
  }

  const schedule = async (mode) => {
    const unit = unitFor(mode)
    if (!unit) {
      notify('No unit of this equipment is on this site to schedule against.', 'error')
      return
    }
    const plan = scheduleFor(mode)
    setBusy(mode.id)
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
    setBusy('')
    if (rec) {
      notify(`Schedule created on ${unit.asset_code} — ${everyText(plan)}.`)
    }
  }

  // The step before both of them, where this plant has none of the equipment
  // the analysis is about. See `registerEntry` for why the analysis is a better
  // source for the register entry than a blank form.
  const register = async (mode) => {
    const site = SITES.find((s) => s.site_id === siteId) || SITES[0]
    if (!site) {
      notify('This build has no site to register the machine against.', 'error')
      return
    }
    const here = LOCATIONS.filter((l) => l.site_id === site.site_id)
    const location = here.find((l) => String(l.name || '').toLowerCase().includes(String(mode.stageLabel || '').toLowerCase().split(' ')[0]))
      || here[0] || null
    setBusy(mode.id)
    const saved = await create('asset', registerEntry(mode, { site, location, existing: assets }))
    setBusy('')
    if (saved) notify(`${saved.asset_code} added to the register at ${site.site_name} — this mode can now be worked.`)
  }

  const columns = [
    {
      key: 'kind', label: 'Equipment', width: 186,
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.kind}</div>
          <div style={{ fontSize: 11, color: MUTE }}>
            {r.stageLabel} · {r.units > 0
              ? `${r.units} ${r.units === 1 ? 'unit' : 'units'}`
              : 'not in this register'}
          </div>
        </div>
      ),
    },
    {
      key: 'mode', label: 'Function and how it fails',
      render: (r) => (
        <div style={{ maxWidth: 320 }}>
          <div style={{ fontSize: 11, color: MUTE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.fn}>
            {r.fn}
          </div>
          <div style={{ fontWeight: 600, lineHeight: 1.35 }}>{r.mode}</div>
        </div>
      ),
    },
    {
      key: 'consequence', label: 'Consequence', width: 116,
      render: (r) => <StatusBadge tone={CONSEQUENCE_TONE[r.consequence]}>{r.consequence}</StatusBadge>,
    },
    {
      key: 'signal', label: 'Seen by', width: 172,
      render: (r) => (r.signal ? (
        <div style={{ maxWidth: 164 }}>
          <div style={{ fontSize: 12, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.signal}>
            {r.signal}
          </div>
          <div style={{ fontSize: 10.5, color: r.consequence === 'Hidden' ? '#6d28d9' : r.monitored ? '#047857' : '#b45309' }}>
            {r.consequence === 'Hidden'
              ? 'trend supports the test'
              : r.monitored ? 'monitored here' : 'signal not fitted'}
          </div>
        </div>
      ) : (
        <span style={{ fontSize: 12, color: MUTE }}>
          {r.consequence === 'Hidden' ? 'test only' : 'inspection only'}
        </span>
      )),
    },
    {
      key: 'rpn', label: 'Risk', align: 'right', width: 74,
      render: (r) => (
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: rpnColour(r.rpn) }}>{r.rpn}</div>
          <div style={{ fontSize: 10, color: MUTE }}>{r.severity}·{r.occurrence}·{r.detectability}</div>
        </div>
      ),
    },
    {
      key: 'fleetHours', label: 'Hours at risk', align: 'right', width: 98,
      sortValue: (r) => r.fleetHours,
      render: (r) => (r.fleetHours > 0 ? (
        <div>
          <div style={{ fontWeight: 700, color: INK }}>{r.fleetHours} h</div>
          <div style={{ fontSize: 10, color: MUTE }}>a year, modelled</div>
        </div>
      ) : <span style={{ fontSize: 11.5, color: MUTE }}>lets work through</span>),
    },
    {
      key: 'strategy', label: 'Task type', width: 128,
      render: (r) => <StatusBadge tone={STRATEGY_TONE[r.strategy]}>{r.strategy}</StatusBadge>,
    },
    {
      key: 'grief', label: 'Grief', width: 118,
      render: (r) => r.grief
        ? <StatusBadge tone={r.grief === 'Material' ? 'amber' : r.grief === 'Workmanship' ? 'violet' : r.grief === 'Vendor part' ? 'blue' : 'grey'}>{r.grief}</StatusBadge>
        : <span style={{ fontSize: 11.5, color: MUTE }}>—</span>,
    },
    {
      // Where the plant has the machine, the action is the job. Where it does
      // not, a greyed-out button teaches the reader nothing — the action is the
      // step that has to happen first.
      key: 'act', label: '', width: 112, sortable: false,
      render: (r) => (
        <span onClick={(e) => e.stopPropagation()}>
          <ActionButton
            variant="subtle" disabled={busy === r.id}
            onClick={() => (r.units === 0 ? register(r) : raise(r))}
          >
            {busy === r.id ? 'Working…' : r.units === 0 ? 'Add machine' : 'Raise job'}
          </ActionButton>
        </span>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        icon={sectionIcon('rcm-reliability', '#15227a')}
        title="RCM Reliability"
        subtitle={library?.own
          ? `${totals.equipment} critical equipment types · ${totals.modes} failure modes · ${siteName}`
          : `${library?.label} reference analysis · ${totals.equipment} equipment types · ${totals.modes} failure modes`}
      />

      {picker}

      {/* The banner that used to stand here said the library was a reference
          one and that the estate holds none of the equipment. Both facts are
          still on the screen — the subtitle names it a reference analysis, the
          picker labels it, and every row says "not in this register" — so the
          block was three lines of page saying what the page already said. */}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(186px,1fr))', gap: 12, marginBottom: 14 }}>
        <Kpi label="Critical equipment" value={totals.equipment} Icon={Boxes}
          note={totals.units > 0
            ? `${totals.units} ${totals.units === 1 ? 'unit' : 'units'} on this site`
            : 'none of them in this register'} />
        <Kpi label="Failure modes" value={totals.modes} Icon={ListChecks}
          note={`${totals.conditionBased} answered by a condition task`} />
        <Kpi label="Safety & environment" value={totals.safety} tone="#b45309" Icon={ShieldAlert}
          note="need a task that works, or a design change" />
        <Kpi label="Hidden failures" value={totals.hidden} tone="#6d28d9" Icon={EyeOff}
          note="no warning at all — found only by test" />
        <Kpi label="Breakdowns, 12 mo" value={totals.failures} Icon={AlertTriangle}
          tone={totals.failures ? '#b91c1c' : '#047857'}
          note="booked against the analysed equipment" />
        <Kpi label="Hours at risk a year" value={totals.exposureHours} tone="#15227a" Icon={Clock}
          note={`modelled · ${totals.coveredHours} h of it already watched`} />
      </div>

      <Section title="Where the risk sits" right={<span style={{ fontSize: 11.5, color: MUTE }}>click a band to filter the table</span>}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {['High', 'Medium', 'Low'].map((b) => {
            const count = b === 'High' ? totals.highRpn : b === 'Medium' ? totals.mediumRpn : totals.lowRpn
            const colour = b === 'High' ? '#b91c1c' : b === 'Medium' ? '#b45309' : '#047857'
            const on = band === b
            return (
              <button
                key={b} type="button"
                onClick={() => { setBand(on ? 'all' : b); setView('modes') }}
                style={{
                  flex: '1 1 180px', textAlign: 'left', cursor: 'pointer', padding: '11px 13px',
                  borderRadius: 10, background: on ? '#f8fafc' : '#fff',
                  border: `1px solid ${on ? colour : LINE}`, boxShadow: on ? `inset 0 0 0 1px ${colour}22` : 'none',
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 800, color: colour }}>{count}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{b} risk</div>
                <div style={{ fontSize: 11, color: MUTE }}>{BANDS[b]}</div>
              </button>
            )
          })}
          <div style={{ flex: '1 1 180px', padding: '11px 13px', borderRadius: 10, border: `1px solid ${LINE}`, background: '#fff' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: totals.signalUnfitted ? '#b45309' : '#047857' }}>
              {totals.signalUnfitted}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>Signal not fitted</div>
            <div style={{ fontSize: 11, color: MUTE }}>The machine can be read; this plant is not reading it</div>
          </div>
        </div>
      </Section>

      {/* The sensor conversation, in four numbers. Which modes something is
          already watching, which the machine could report and nobody is
          reading, which need a person on a route, and which are only ever
          proven by a test. */}
      <Section title="Where the condition signals are" right={<span style={{ fontSize: 11.5, color: MUTE }}>what a sensor could catch, and what it would take</span>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
          <Coverage label="Watched today" value={totals.monitored} tone="#047857"
            note="A live signal on an instrumented unit" total={totals.modes} />
          <Coverage label="Signal exists, not fitted" value={totals.signalUnfitted} tone="#b45309"
            note="The machine can be read; this plant is not reading it" total={totals.modes} />
          <Coverage label="Inspection only" value={totals.blind} tone="#64748b"
            note="No condition signal — found by a person, on a route" total={totals.modes} />
          <Coverage label="Tested, not watched" value={totals.failureFinding} tone="#6d28d9"
            note="Hidden failures: proven by a function test" total={totals.modes} />
        </div>
      </Section>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Tab on={view === 'modes'} onClick={() => setView('modes')}>Failure modes · {rows.length}</Tab>
        <Tab on={view === 'equipment'} onClick={() => setView('equipment')}>By equipment · {totals.equipment}</Tab>
        <Tab on={view === 'photos'} onClick={() => setView('photos')}>Component photos</Tab>
      </div>

      {view === 'photos' ? (
        <ComponentPhotos />
      ) : view === 'modes' ? (
        <>
          <Toolbar
            search={search} onSearch={setSearch}
            placeholder="Search equipment, failure mode, effect or task…"
            filters={[
              { label: 'Process', value: stage, onChange: setStage, options: stageNames },
              { label: 'Consequence', value: consequence, onChange: setConsequence, options: CONSEQUENCES },
              { label: 'Task type', value: strategy, onChange: setStrategy, options: strategies },
              { label: 'Risk', value: band, onChange: setBand, options: ['High', 'Medium', 'Low'] },
            ]}
            right={<span style={{ fontSize: 11.5, color: MUTE }}>{shown.length} of {rows.length} modes</span>}
          />

          <DataTable
            columns={columns} rows={shown} onRowClick={openMode} pageSize={14}
            empty="No failure modes match these filters."
          />
        </>
      ) : (
        <EquipmentView
          stages={stages}
          busy={busy}
          onOpenMode={openMode}
          onRegister={register}
          onShowModes={(kind) => { setSearch(kind); setView('modes') }}
          onOpenAsset={(asset) => router.push(`/portal/oxmaint/assets/${encodeURIComponent(asset.asset_id || asset.recordId)}`)}
        />
      )}

    </div>
  )
}

/**
 * The same analysis read by machine rather than by risk.
 *
 * A reliability engineer sorts by risk; a plant manager walks the line. This is
 * the second walk: each process stage, the equipment in it, what it has cost
 * this year, and the worst three things that can happen to it.
 */
function EquipmentView({ stages, busy, onOpenMode, onRegister, onShowModes, onOpenAsset }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {stages.map((s) => (
        <Section key={s.key} title={s.label} right={<span style={{ fontSize: 11.5, color: MUTE }}>{s.modes} failure modes</span>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(310px,1fr))', gap: 12 }}>
            {s.equipment.map((e) => {
              const hours = Math.round(e.modes.reduce((n, m) => n + m.fleetHours, 0))
              const worst = e.modes[0]
              return (
                <div key={e.kind} style={{ border: `1px solid ${LINE}`, borderRadius: 11, padding: '13px 14px', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{e.kind}</span>
                    <span style={{ fontSize: 11.5, color: MUTE }}>
                      {e.units > 0 ? `${e.units} ${e.units === 1 ? 'unit' : 'units'}` : 'not in this register'}
                    </span>
                    {e.failures > 0 && <StatusBadge tone="red">{e.failures} breakdown{e.failures === 1 ? '' : 's'}</StatusBadge>}
                  </div>
                  <p style={{ margin: '4px 0 9px', fontSize: 12, color: SUB, lineHeight: 1.5 }}>{e.purpose}</p>

                  <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: MUTE, marginBottom: 9 }}>
                    <span><b style={{ color: INK }}>{e.modes.length}</b> modes</span>
                    <span><b style={{ color: rpnColour(worst?.rpn || 0) }}>{worst?.rpn || 0}</b> worst RPN</span>
                    <span><b style={{ color: INK }}>{hours} h</b> a year at risk</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {e.modes.slice(0, 3).map((m) => (
                      <button
                        key={m.id} type="button" onClick={() => onOpenMode(m)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', width: '100%',
                          padding: '6px 9px', borderRadius: 8, border: `1px solid ${LINE}`, background: '#f8fafc', cursor: 'pointer',
                        }}
                      >
                        <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.mode}
                        </span>
                        <StatusBadge tone={CONSEQUENCE_TONE[m.consequence]}>{m.consequence}</StatusBadge>
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <ActionButton size="sm" variant="subtle" onClick={() => onShowModes(e.kind)}>
                      All {e.modes.length} modes
                    </ActionButton>
                    {e.modes[0]?.unitList?.[0]?.asset ? (
                      <ActionButton size="sm" variant="ghost" onClick={() => onOpenAsset(e.modes[0].unitList[0].asset)}>
                        Open {e.modes[0].unitList[0].asset.asset_code}
                      </ActionButton>
                    ) : worst && (
                      <ActionButton size="sm" disabled={busy === worst.id} onClick={() => onRegister(worst)}>
                        {busy === worst.id ? 'Adding…' : 'Add to the register'}
                      </ActionButton>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      ))}
    </div>
  )
}

// Said once here rather than repeated in every drawer: the reason a task type
// follows from a consequence is the whole argument of RCM, and a reader seeing
// "Failure-finding" for the first time is owed it.
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

function Coverage({ label, value, note, tone, total }) {
  const pct = total ? Math.round((value / total) * 100) : 0
  return (
    <div style={{ padding: '11px 13px', borderRadius: 10, border: `1px solid ${LINE}`, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: tone }}>{value}</span>
        <span style={{ fontSize: 11.5, color: MUTE }}>of {total} · {pct}%</span>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: INK, marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: MUTE, marginTop: 2, lineHeight: 1.45 }}>{note}</div>
    </div>
  )
}

/**
 * One measure, with the icon that says which kind it is.
 *
 * Six of these sit in a row, so they are built to the same height whatever the
 * caption runs to — a row of cards that step up and down reads as six unrelated
 * things rather than one set. The tint is the tone at eight per cent, which is
 * enough to group the urgent ones and not enough to shout.
 */
function Kpi({ label, value, note, tone = INK, Icon }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2, minHeight: 104,
      border: `1px solid ${LINE}`, borderRadius: 12, padding: '13px 15px', background: '#fff',
      boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
    }}>
      {/* Fixed height, and the caption never wraps: a caption that runs to two
          lines in one card pushes that card's number down and the row stops
          reading as one set of measures. */}
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
          fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase',
          letterSpacing: 0.4, lineHeight: 1.3, whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{label}</span>
      </div>
      <div style={{
        fontSize: 28, fontWeight: 800, color: tone, lineHeight: 1.1, marginTop: 4,
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      {note && (
        <div style={{ fontSize: 11, color: MUTE, marginTop: 'auto', paddingTop: 4, lineHeight: 1.45 }}>{note}</div>
      )}
    </div>
  )
}

function Figure({ label, value, note, tone }) {
  return (
    <div style={{ flex: '1 1 150px', padding: '11px 13px', borderRadius: 10, background: '#f8fafc', border: `1px solid ${LINE}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: tone, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: MUTE, marginTop: 2, lineHeight: 1.4 }}>{note}</div>
    </div>
  )
}

function Tab({ on, onClick, children }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        padding: '8px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        border: `1px solid ${on ? '#15227a' : LINE}`,
        background: on ? '#15227a' : '#fff',
        color: on ? '#fff' : SUB,
      }}
    >
      {children}
    </button>
  )
}

// ── the generic table, for a pack with no analysis of its own ──────────────

const LEGACY_STRATEGY_TONE = {
  Redesign: 'red',
  'Condition-based': 'blue',
  'Time-based': 'green',
  'Run to failure': 'grey',
}

function LegacyFmea({ picker }) {
  const { scope, siteName } = useSite()
  const [open, setOpen] = useState(null)

  // Sorted here rather than left to the table's default, because the order is
  // the finding: the worst failure mode in the plant is the first line of the
  // report, and a table that opens on asset name buries it.
  const all = useMemo(() => [...scope(RCM)].sort((a, b) => b.rpn - a.rpn), [scope])

  const assets = new Set(all.map((r) => r.asset_id)).size
  const highRpn = all.filter((r) => r.rpn > 200).length
  const runToFailure = all.filter((r) => r.strategy === 'Run to failure').length
  const avgMtbf = all.length ? Math.round(all.reduce((n, r) => n + r.mtbf_days, 0) / all.length) : 0

  const columns = [
    { key: 'asset_name', label: 'Asset', render: (r) => (
      <div>
        <div style={{ fontWeight: 600 }}>{r.asset_name}</div>
        <div style={{ fontSize: 11, color: MUTE }}>{r.asset_code}</div>
      </div>
    ) },
    { key: 'failure_mode', label: 'Failure mode', render: (r) => (
      <span style={{ display: 'block', maxWidth: 200, fontWeight: 600 }}>{r.failure_mode}</span>
    ) },
    { key: 'effect', label: 'Effect', render: (r) => (
      <span style={{ display: 'block', maxWidth: 250, color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.effect}>{r.effect}</span>
    ) },
    { key: 'detection', label: 'Detection', render: (r) => (
      <span style={{ display: 'block', maxWidth: 210, color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.detection}>{r.detection}</span>
    ) },
    {
      key: 'severity', label: 'S / O / D', align: 'center', sortValue: (r) => r.severity,
      render: (r) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          <Score value={r.severity} title="Severity" />
          <Score value={r.occurrence} title="Occurrence" />
          <Score value={r.detectability} title="Detectability" />
        </div>
      ),
    },
    {
      key: 'rpn', label: 'RPN', align: 'right',
      render: (r) => <span style={{ fontSize: 14, fontWeight: 800, color: rpnColour(r.rpn) }}>{r.rpn}</span>,
    },
    { key: 'mtbf_days', label: 'MTBF', align: 'right', render: (r) => `${r.mtbf_days} d` },
    { key: 'strategy', label: 'Strategy', render: (r) => <StatusBadge tone={LEGACY_STRATEGY_TONE[r.strategy]}>{r.strategy}</StatusBadge> },
  ]

  return (
    <div>
      <PageHeader
        icon={sectionIcon('rcm-reliability', '#15227a')}
        title="RCM Reliability"
        subtitle={`Failure mode and effects analysis across ${assets} critical assets · ${siteName}`}
      />

      {picker}

      <StatStrip items={[
        { label: 'Assets analysed', value: assets },
        { label: 'RPN above 200', value: highRpn, tone: highRpn ? 'red' : 'green' },
        { label: 'Run to failure', value: runToFailure },
        { label: 'Average MTBF', value: avgMtbf, unit: 'days', tone: 'blue' },
      ]} />

      <Section title="How the risk priority number is read">
        <p style={{ margin: 0, fontSize: 13, color: SUB, lineHeight: 1.6 }}>
          RPN is severity multiplied by occurrence multiplied by detectability — how bad the failure is,
          how often it happens, and how hard it is to see coming — so anything above 200 is unacceptable
          and is answered by removing the failure mode rather than scheduling around it.
        </p>
      </Section>

      <DataTable columns={columns} rows={all} onRowClick={setOpen} pageSize={12}
        empty="No failure modes recorded for this site." />

      <Drawer
        open={Boolean(open)} onClose={() => setOpen(null)}
        title={open?.failure_mode}
        subtitle={open ? `${open.asset_name} (${open.asset_code})` : null}
        icon={sectionIcon('rcm-reliability', '#15227a')}
        width={500}
      >
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatusBadge tone={LEGACY_STRATEGY_TONE[open.strategy]}>{open.strategy}</StatusBadge>
              <StatusBadge>{open.criticality}</StatusBadge>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 11, background: '#f8fafc', border: `1px solid ${LINE}` }}>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 }}>RPN</div>
                <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1, color: rpnColour(open.rpn) }}>{open.rpn}</div>
              </div>
              <div style={{ fontSize: 12.5, color: SUB }}>
                {open.severity} severity × {open.occurrence} occurrence × {open.detectability} detectability
              </div>
            </div>

            <Fields rows={[
              ['Asset', `${open.asset_name} (${open.asset_code})`],
              ['Criticality', open.criticality],
              ['Failure mode', open.failure_mode],
              ['Effect', open.effect],
              ['Detection method', open.detection],
              ['Severity', `${open.severity} of 10`],
              ['Occurrence', `${open.occurrence} of 8`],
              ['Detectability', `${open.detectability} of 8`],
              ['Failures recorded', `${open.failures_recorded} in the last 12 months`],
              ['MTBF', `${open.mtbf_days} days`],
              ['Strategy', open.strategy],
            ]} />
          </div>
        )}
      </Drawer>
    </div>
  )
}

function Score({ value, title }) {
  return (
    <span title={title} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 21, height: 21, borderRadius: 6, fontSize: 11.5, fontWeight: 700,
      color: INK, background: '#f1f5f9', border: `1px solid ${LINE}`,
    }}>{value}</span>
  )
}
