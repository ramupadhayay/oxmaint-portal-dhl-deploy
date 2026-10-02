'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeader, Card, Section, StatStrip, DataTable, StatusBadge, Priority,
  Bar, ActionButton, PALETTE,
} from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { useStore } from '../lib/store'
import { useActions } from '../lib/actions'
import {
  ASSETS, WORK_ORDERS, PM_SCHEDULES, PARTS, INSPECTIONS, VENDORS, DEMAND_PARTS,
  OPEN_STATUS, isPast, fmtDate, daysUntil, daysFrom, between, pick, SUPERVISOR_NAME, PLANNER_NAME,
} from '../lib/data'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, AMBER, RED } = PALETTE

// ── one screen, several entries ───────────────────────────────────────────
//
// The product gives each of these its own route in the sidebar, and this build
// had them behind one entry with tabs. The tabs were already the product's own
// sub-modules, so the content did not need writing — it needed addressing. Each
// entry opens its tab, and walking to the next one moves the tab rather than
// leaving the reader on the screen they have just navigated away from.
const TABS = ['Cognitive Agent', 'P-2-P', 'Tasks', 'Workflow']

const TAB_FOR_SECTION = {
  synapse: 'Cognitive Agent',
  'synapse-p2p': 'P-2-P',
  'synapse-tasks': 'Tasks',
  'synapse-workflow': 'Workflow',
}

export default function Synapse({ section }) {
  const { scope, siteName } = useSite()
  const [tab, setTab] = useState(TAB_FOR_SECTION[section] || 'Cognitive Agent')

  // Walking from one entry to the next moves the tab. Without it the route
  // changes and the screen does not, which reads as a menu item that does
  // nothing.
  useEffect(() => {
    const wanted = TAB_FOR_SECTION[section]
    if (wanted) setTab(wanted)
  }, [section])
  const [handled, setHandled] = useState({})
  const router = useRouter()
  const { raiseWorkOrder } = useActions()
  const { notify } = useStore()

  const d = useMemo(() => {
    const assets = scope(ASSETS)
    const wos = scope(WORK_ORDERS)
    const pms = scope(PM_SCHEDULES)
    const parts = scope(PARTS)
    const insp = scope(INSPECTIONS)
    const demand = scope(DEMAND_PARTS)

    const open = wos.filter((w) => OPEN_STATUS.includes(w.status))
    const openByAsset = new Set(open.map((w) => w.asset_id))
    const leadTime = new Map(VENDORS.map((v) => [v.vendor_name, v.lead_time_days]))

    const breakdownsByAsset = new Map()
    wos.filter((w) => w.work_order_type === 'Breakdown').forEach((w) => {
      breakdownsByAsset.set(w.asset_id, (breakdownsByAsset.get(w.asset_id) || 0) + 1)
    })

    // Risk is a weighted sum of four things the record already knows. It is
    // stated in full on the screen because a score nobody can reproduce is a
    // score nobody acts on — and this is a ranking, not a prediction of a date.
    const scored = assets.map((a) => {
      const breakdowns = breakdownsByAsset.get(a.asset_id) || 0
      const sinceService = Math.abs(daysUntil(a.last_maintenance_date))
      const critWeight = { High: 14, Medium: 7, Low: 0 }[a.criticality] ?? 0
      const raw = (100 - a.health_score) * 0.5 + breakdowns * 9 + sinceService * 0.25 + critWeight
      const risk = Math.max(0, Math.min(100, Math.round(raw)))
      return {
        ...a,
        breakdowns,
        since_service: sinceService,
        risk,
        band: risk >= 60 ? 'High' : risk >= 40 ? 'Medium' : 'Low',
        window_days: Math.max(3, Math.round(75 - risk * 0.9)),
        has_open_work: openByAsset.has(a.asset_id),
      }
    }).sort((a, b) => b.risk - a.risk)

    // Repeat work: the same job title raised against the same asset more than
    // once. This is the cheapest signal in a CMMS that a fix did not hold.
    const repeatMap = new Map()
    wos.forEach((w) => {
      const key = `${w.asset_id}|${w.title}`
      if (!repeatMap.has(key)) repeatMap.set(key, [])
      repeatMap.get(key).push(w)
    })
    const repeats = [...repeatMap.values()].filter((g) => g.length > 1)

    const risingFailure = scored.filter((a) => a.breakdowns >= 2)
    const partsAtRisk = demand.filter((p) => daysUntil(p.required_by) < (leadTime.get(p.vendor_name) ?? 0))
    const downNoWork = assets.filter((a) => a.status === 'Down' && !openByAsset.has(a.asset_id))
    const failedInsp = insp.filter((i) => i.result === 'Fail')
    const overduePM = pms.filter((p) => isPast(p.next_due))

    const busy = new Map()
    open.forEach((w) => busy.set(w.assigned_to_name, (busy.get(w.assigned_to_name) || 0) + 1))
    const pmAtRisk = pms.filter((p) => !isPast(p.next_due) && daysUntil(p.next_due) <= 7 && (busy.get(p.assigned_to_name) || 0) >= 4)

    // Suggested tasks come from records that are already wrong, not from a
    // forecast — every one of them can be traced back to a row on another page.
    const tasks = [
      ...overduePM.map((p) => ({
        id: `t-pm-${p.schedule_id}`,
        title: `Issue the overdue schedule: ${p.schedule_name}`,
        asset: p.asset_name,
        asset_id: p.asset_id,
        type: 'Preventive',
        source: `PM schedule ${Math.abs(daysUntil(p.next_due))} days past due`,
        owner: p.assigned_to_name,
        priority: Math.abs(daysUntil(p.next_due)) > 5 ? 'High' : 'Medium',
        hours: p.estimated_hours,
        due: daysFrom(between(`syn-pm-${p.schedule_id}`, 1, 6)),
      })),
      ...failedInsp.map((i) => ({
        id: `t-in-${i.inspection_id}`,
        title: `Raise corrective work for ${i.findings_count} findings on ${i.asset_name}`,
        asset: i.asset_name,
        asset_id: i.asset_id,
        type: 'Corrective',
        source: `${i.inspection_number} failed at ${i.score}%`,
        owner: i.inspector_name,
        priority: i.score < 50 ? 'Critical' : 'High',
        hours: between(`syn-in-${i.inspection_id}`, 2, 8),
        due: daysFrom(between(`syn-ind-${i.inspection_id}`, 1, 5)),
      })),
      ...downNoWork.map((a) => ({
        id: `t-dn-${a.asset_id}`,
        title: `Open a breakdown job for ${a.asset_name}`,
        asset: a.asset_name,
        asset_id: a.asset_id,
        type: 'Corrective',
        source: 'Asset marked down with nothing raised against it',
        owner: pick(`syn-own-${a.asset_id}`, [SUPERVISOR_NAME, PLANNER_NAME]),
        priority: 'Critical',
        hours: between(`syn-dn-${a.asset_id}`, 3, 10),
        due: daysFrom(1),
      })),
    ]

    return {
      assets, wos, pms, parts, insp, open, scored, repeats,
      risingFailure, partsAtRisk, downNoWork, failedInsp, overduePM, pmAtRisk, tasks,
      lowStock: parts.filter((p) => p.status !== 'In Stock'),
    }
  }, [scope])

  // Accepting a suggestion raises the work order it describes, against the unit
  // it came from. Recording the decision and leaving the job unraised was the
  // gap between this screen and the rest of the portal: every other screen that
  // says "do this" can do it.
  const act = async (id, state) => {
    if (handled[id]) return
    if (state !== 'accepted') {
      setHandled((prev) => ({ ...prev, [id]: { state } }))
      return
    }
    const task = d.tasks.find((t) => t.id === id)
    if (!task) return
    setHandled((prev) => ({ ...prev, [id]: { state: 'accepting' } }))
    const wo = await raiseWorkOrder({
      title: task.title.replace(/^(Issue the overdue schedule|Open a breakdown job for|Raise corrective work for)\s*:?\s*/i, (m) => m).slice(0, 120),
      description: `${task.title}. Raised from the maintenance assistant: ${task.source}.`,
      assetId: task.asset_id,
      type: task.type || 'Corrective',
      priority: task.priority,
      dueInDays: Math.max(1, daysUntil(task.due) || 1),
      assignedTo: task.owner,
      estimatedHours: task.hours,
      source: 'Maintenance assistant suggestion',
      sourceId: id,
    })
    setHandled((prev) => ({ ...prev, [id]: { state: wo ? 'accepted' : 'failed', wo: wo?.work_order_number } }))
    if (wo) notify(`${wo.work_order_number} raised — ${task.asset}.`)
  }

  return (
    <div>
      <PageHeader
        icon={sectionIcon('synapse', '#15227a')}
        title="Synapse AI"
        subtitle={`Maintenance intelligence over your own record · ${siteName}`}
        right={<span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: SUB, fontWeight: 600 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN }} />On-prem model
        </span>}
      />

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '7px 14px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
            borderRadius: 9, border: `1px solid ${tab === t ? ACCENT : LINE}`,
            background: tab === t ? ACCENT : '#fff', color: tab === t ? '#fff' : SUB,
          }}>{t}</button>
        ))}
      </div>

      {tab === 'Cognitive Agent' && <CognitiveAgent d={d} />}
      {tab === 'P-2-P' && <PredictToPrevent d={d} />}
      {tab === 'Tasks' && (
        <Tasks
          d={d} handled={handled} act={act}
          onOpenWorkOrder={(number) => router.push(`/portal/oxmaint/work-orders/${encodeURIComponent(number)}`)}
        />
      )}
      {tab === 'Workflow' && <Workflow d={d} />}
    </div>
  )
}

// ── Cognitive Agent ───────────────────────────────────────────────────────
function CognitiveAgent({ d }) {
  const observations = [
    {
      key: 'rising',
      count: d.risingFailure.length,
      unit: d.risingFailure.length === 1 ? 'asset' : 'assets',
      headline: 'show a rising failure pattern',
      body: 'Two or more breakdown jobs raised against the same machine. That is the point at which the machine is telling you something the schedule is not.',
      names: d.risingFailure.slice(0, 4).map((a) => `${a.asset_name} — ${a.breakdowns} breakdowns`),
      tone: d.risingFailure.length ? 'red' : 'green',
    },
    {
      key: 'repeat',
      count: d.repeats.length,
      unit: d.repeats.length === 1 ? 'job' : 'jobs',
      headline: 'have been raised more than once on the same asset',
      body: 'The same task, the same machine, twice. Either the repair did not hold or the underlying cause was never addressed.',
      names: d.repeats.slice(0, 4).map((g) => `${g[0].asset_name} — ${g[0].title} (${g.length}×)`),
      tone: d.repeats.length ? 'amber' : 'green',
    },
    {
      key: 'down',
      count: d.downNoWork.length,
      unit: d.downNoWork.length === 1 ? 'asset is' : 'assets are',
      headline: 'down with nothing raised against them',
      body: 'A stopped machine that nobody has been assigned to is losing production quietly, and it will not appear on any backlog report.',
      names: d.downNoWork.slice(0, 4).map((a) => `${a.asset_name} — ${a.site_name}`),
      tone: d.downNoWork.length ? 'red' : 'green',
    },
    {
      key: 'parts',
      count: d.partsAtRisk.length,
      unit: d.partsAtRisk.length === 1 ? 'part' : 'parts',
      headline: 'cannot arrive before the work that needs them',
      body: 'Required-by date compared against the supplier lead time on the record. These jobs will stall at the stores unless the order goes today.',
      names: d.partsAtRisk.slice(0, 4).map((p) => `${p.part_name} — needed ${fmtDate(p.required_by)}, ${p.vendor_name}`),
      tone: d.partsAtRisk.length ? 'amber' : 'green',
    },
    {
      key: 'pm',
      count: d.pmAtRisk.length,
      unit: d.pmAtRisk.length === 1 ? 'schedule' : 'schedules',
      headline: 'are likely to be missed this week',
      body: 'Due within seven days and assigned to somebody already carrying four or more open jobs. Nothing has gone wrong yet, which is the point.',
      names: d.pmAtRisk.slice(0, 4).map((p) => `${p.schedule_name} — ${p.assigned_to_name}, due ${fmtDate(p.next_due)}`),
      tone: d.pmAtRisk.length ? 'amber' : 'green',
    },
    {
      key: 'stock',
      count: d.lowStock.length,
      unit: 'lines',
      headline: 'are at or below their reorder point',
      body: 'Most repair delay is waiting for a part rather than doing the work. This is the list that turns into that delay.',
      names: d.lowStock.slice(0, 4).map((p) => `${p.part_name} — ${p.quantity_on_hand} on hand, minimum ${p.minimum_quantity}`),
      tone: d.lowStock.length ? 'amber' : 'green',
    },
  ]

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#e8ecff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {sectionIcon('synapse', ACCENT)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: INK, marginBottom: 5 }}>What the agent does</div>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: SUB, lineHeight: 1.6, maxWidth: 760 }}>
              The agent reads the same records the rest of the portal shows — assets, work orders,
              schedules, inspections and stock — and looks for the combinations a person would spot if
              they had time to read all of them at once. It runs on the plant model held on site; nothing
              leaves the estate, and every observation below can be traced back to named records.
            </p>
            <p style={{ margin: 0, fontSize: 12.5, color: MUTE, lineHeight: 1.55, maxWidth: 760 }}>
              It does not invent facts and it does not act on its own. Where a figure is modelled rather
              than counted, the screen says so.
            </p>
          </div>
        </div>
      </Card>

      <Section title="What it is seeing right now">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(330px, 100%),1fr))', gap: 12 }}>
          {observations.map((o) => (
            <div key={o.key} style={{
              border: `1px solid ${LINE}`, borderRadius: 12, padding: 15,
              borderLeftWidth: 3, borderLeftStyle: 'solid',
              borderLeftColor: o.tone === 'red' ? RED : o.tone === 'amber' ? AMBER : GREEN,
              background: '#fcfdfe',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: INK, lineHeight: 1 }}>{o.count}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{o.unit} {o.headline}</span>
              </div>
              <p style={{ margin: '0 0 11px', fontSize: 12.5, color: SUB, lineHeight: 1.5 }}>{o.body}</p>
              {o.names.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 10, borderTop: `1px solid ${LINE}` }}>
                  {/* Keyed by position: asset names repeat across the register,
                      so two evidence lines can read identically. */}
                  {o.names.map((n, i) => (
                    <span key={`${o.key}-${i}`} style={{ fontSize: 11.5, color: MUTE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n}</span>
                  ))}
                </div>
              ) : (
                <div style={{ paddingTop: 10, borderTop: `1px solid ${LINE}`, fontSize: 11.5, color: GREEN, fontWeight: 600 }}>Nothing found at this site.</div>
              )}
            </div>
          ))}
        </div>
      </Section>
    </>
  )
}

// ── Predict to Prevent ────────────────────────────────────────────────────
function PredictToPrevent({ d }) {
  const high = d.scored.filter((a) => a.band === 'High')
  const medium = d.scored.filter((a) => a.band === 'Medium')
  const soon = d.scored.filter((a) => a.window_days <= 30)

  return (
    <>
      <StatStrip items={[
        { label: 'Assets scored', value: d.scored.length, note: 'every asset in scope' },
        { label: 'High risk', value: high.length, tone: high.length ? 'red' : 'green', note: 'score of 60 or above' },
        { label: 'Medium risk', value: medium.length, tone: 'amber', note: 'score 40 to 59' },
        { label: 'Suggested within 30 days', value: soon.length, note: 'modelled intervention window' },
        { label: 'Already covered', value: d.scored.filter((a) => a.band !== 'Low' && a.has_open_work).length, tone: 'green', note: 'at-risk assets with work already open' },
      ]} />

      <Card style={{ marginBottom: 14, padding: '13px 16px', background: '#fffbeb', border: '1px solid #fde68a' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#b45309', marginBottom: 4 }}>This is a ranking, not a forecast</div>
        <p style={{ margin: 0, fontSize: 12.5, color: '#92400e', lineHeight: 1.55 }}>
          The score is a weighted sum of four values already on the record: condition
          (100 − health score, weighted 0.5), breakdown history (9 points per breakdown job), time since
          the last service (0.25 points per day) and criticality (High 14, Medium 7, Low 0). The
          intervention window is derived from the score alone. It tells you what to look at first — it
          does not tell you when a machine will fail.
        </p>
      </Card>

      <Section title="Assets ranked by modelled risk">
        <DataTable
          pageSize={14}
          rows={d.scored}
          empty="No assets in scope."
          columns={[
            { key: 'asset_name', label: 'Asset', render: (r) => (
              <span>
                <span style={{ display: 'block', fontWeight: 600 }}>{r.asset_name}</span>
                <span style={{ display: 'block', fontSize: 11, color: MUTE }}>{r.asset_code} · {r.site_name}</span>
              </span>
            ) },
            { key: 'criticality', label: 'Criticality', render: (r) => <Priority value={r.criticality} />, sortValue: (r) => ({ High: 0, Medium: 1, Low: 2 }[r.criticality]) },
            { key: 'health_score', label: 'Health', align: 'right', render: (r) => `${r.health_score}%` },
            { key: 'breakdowns', label: 'Breakdowns', align: 'right' },
            { key: 'since_service', label: 'Since service', align: 'right', render: (r) => `${r.since_service} d` },
            {
              key: 'risk', label: 'Risk', align: 'right',
              render: (r) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 118, justifyContent: 'flex-end' }}>
                  <span style={{ width: 62 }}>
                    <Bar pct={r.risk} color={r.band === 'High' ? RED : r.band === 'Medium' ? AMBER : GREEN} />
                  </span>
                  <span style={{ fontWeight: 800, color: INK, minWidth: 22 }}>{r.risk}</span>
                </span>
              ),
            },
            { key: 'band', label: 'Band', render: (r) => <StatusBadge tone={r.band === 'High' ? 'red' : r.band === 'Medium' ? 'amber' : 'green'}>{r.band}</StatusBadge> },
            { key: 'window_days', label: 'Suggested window', align: 'right', render: (r) => `${r.window_days} d` },
            { key: 'has_open_work', label: 'Work open', align: 'center', sortValue: (r) => (r.has_open_work ? 0 : 1), render: (r) => (r.has_open_work ? <StatusBadge tone="green">Yes</StatusBadge> : <span style={{ color: MUTE }}>—</span>) },
          ]} />
      </Section>
    </>
  )
}

// ── Tasks ─────────────────────────────────────────────────────────────────
function Tasks({ d, handled, act, onOpenWorkOrder }) {
  const stateOf = (id) => handled[id]?.state
  const accepted = Object.values(handled).filter((v) => v?.state === 'accepted').length
  const dismissed = Object.values(handled).filter((v) => v?.state === 'dismissed').length
  const outstanding = d.tasks.filter((t) => !handled[t.id])

  return (
    <>
      <StatStrip items={[
        { label: 'Suggested tasks', value: d.tasks.length, note: 'derived from records already out of tolerance' },
        { label: 'From overdue schedules', value: d.overduePM.length, tone: 'amber' },
        { label: 'From failed inspections', value: d.failedInsp.length, tone: 'red' },
        { label: 'Accepted', value: accepted, tone: 'green' },
        { label: 'Dismissed', value: dismissed },
      ]} />

      <Card style={{ marginBottom: 14, padding: '13px 16px', background: '#f8fafc' }}>
        <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.55 }}>
          Nothing here is a guess. Each suggestion points at a schedule that has already slipped, an
          inspection that has already failed, or an asset that is already stopped. Accepting one raises
          the work order against that unit, assigned as suggested, and hands you the number.
        </p>
      </Card>

      <Section title={`Outstanding suggestions (${outstanding.length})`}>
        {d.tasks.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {d.tasks.map((t) => {
              const entry = handled[t.id]
              const state = entry?.state
              return (
                <div key={t.id} style={{
                  display: 'flex', gap: 13, alignItems: 'flex-start', padding: '13px 14px',
                  border: `1px solid ${LINE}`, borderRadius: 12,
                  background: state === 'accepted' ? '#f0fdf4' : state === 'dismissed' ? '#f8fafc' : '#fff',
                  opacity: state === 'dismissed' ? 0.62 : 1,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                      <Priority value={t.priority} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{t.title}</span>
                      {state === 'accepting' && <StatusBadge tone="grey">Raising…</StatusBadge>}
                      {state === 'failed' && <StatusBadge tone="red">Could not raise</StatusBadge>}
                      {state === 'dismissed' && <StatusBadge tone="grey">Dismissed</StatusBadge>}
                      {state === 'accepted' && (
                        <StatusBadge tone="green">{entry.wo ? `Raised ${entry.wo}` : 'Accepted'}</StatusBadge>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: SUB, marginBottom: 3 }}>{t.source}</div>
                    <div style={{ fontSize: 11.5, color: MUTE }}>
                      {t.asset} · suggested owner {t.owner} · {t.hours} h · by {fmtDate(t.due)}
                    </div>
                  </div>
                  {!state && (
                    <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                      <ActionButton size="sm" variant="ghost" onClick={() => act(t.id, 'dismissed')}>Dismiss</ActionButton>
                      <ActionButton size="sm" variant="subtle" onClick={() => act(t.id, 'accepted')}>Accept and raise</ActionButton>
                    </div>
                  )}
                  {state === 'accepted' && entry.wo && (
                    <div style={{ flexShrink: 0 }}>
                      <ActionButton size="sm" variant="ghost" onClick={() => onOpenWorkOrder(entry.wo)}>Open {entry.wo}</ActionButton>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ padding: '30px 0', textAlign: 'center', color: MUTE, fontSize: 12.5 }}>
            Nothing to suggest — no overdue schedules, failed inspections or unattended stoppages at this site.
          </div>
        )}
      </Section>
    </>
  )
}

// ── Workflow ──────────────────────────────────────────────────────────────
function Workflow({ d }) {
  const rules = [
    {
      name: 'Critical work escalation',
      trigger: 'A work order is raised at critical priority',
      action: 'Notify the site supervisor and post to the maintenance channel within five minutes',
      status: 'Active',
      matches: d.open.filter((w) => w.priority === 'Critical').length,
      matchLabel: 'open critical jobs would fire this rule today',
    },
    {
      name: 'Overdue schedule escalation',
      trigger: 'A preventive schedule passes its due date',
      action: 'Raise the work order automatically and copy the planner',
      status: 'Active',
      matches: d.overduePM.length,
      matchLabel: 'schedules currently past due',
    },
    {
      name: 'Failed inspection to corrective job',
      trigger: 'An inspection is closed with a Fail result',
      action: 'Create a corrective work order carrying the findings across, assigned to the inspecting trade',
      status: 'Active',
      matches: d.failedInsp.length,
      matchLabel: 'failed inspections on the record',
    },
    {
      name: 'Reorder point breach',
      trigger: 'Stock on hand drops to or below the reorder point',
      action: 'Create a demand line against the preferred supplier and flag it to purchasing',
      status: 'Active',
      matches: d.lowStock.length,
      matchLabel: 'lines at or below their reorder point',
    },
    {
      name: 'Unattended stoppage',
      trigger: 'An asset status changes to Down',
      action: 'Open a breakdown work order and start the downtime clock',
      status: 'Active',
      matches: d.downNoWork.length,
      matchLabel: 'stopped assets with nothing raised against them',
    },
    {
      name: 'Repeat failure review',
      trigger: 'The same job is raised twice against one asset',
      action: 'Open a root cause analysis and hold the asset for reliability review',
      status: 'Active',
      matches: d.repeats.length,
      matchLabel: 'repeat jobs in the current record',
    },
    {
      name: 'Close-out completeness',
      trigger: 'A work order is completed without actual hours',
      action: 'Hold the job in review and return it to the technician',
      status: 'Draft',
      matches: d.wos.filter((w) => w.status === 'Completed' && w.actual_hours == null).length,
      matchLabel: 'completed jobs missing hours',
    },
  ]

  return (
    <>
      <StatStrip items={[
        { label: 'Rules configured', value: rules.length },
        { label: 'Active', value: rules.filter((r) => r.status === 'Active').length, tone: 'green' },
        { label: 'In draft', value: rules.filter((r) => r.status === 'Draft').length },
        { label: 'Records they would touch', value: rules.reduce((n, r) => n + r.matches, 0), tone: 'amber', note: 'against the current data' },
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(340px, 100%),1fr))', gap: 12 }}>
        {rules.map((r) => (
          <Card key={r.name}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 11 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{r.name}</span>
              <StatusBadge tone={r.status === 'Active' ? 'green' : 'grey'}>{r.status}</StatusBadge>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <RuleLine label="When" text={r.trigger} colour={AMBER} />
              <RuleLine label="Then" text={r.action} colour={ACCENT} />
            </div>

            <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${LINE}`, display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: r.matches ? INK : MUTE }}>{r.matches}</span>
              <span style={{ fontSize: 11.5, color: MUTE }}>{r.matchLabel}</span>
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}

function RuleLine({ label, text, colour }) {
  return (
    <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
      <span style={{
        fontSize: 10, fontWeight: 700, color: colour, textTransform: 'uppercase', letterSpacing: 0.5,
        minWidth: 34, paddingTop: 2,
      }}>{label}</span>
      <span style={{ fontSize: 12.5, color: SUB, lineHeight: 1.5 }}>{text}</span>
    </div>
  )
}
