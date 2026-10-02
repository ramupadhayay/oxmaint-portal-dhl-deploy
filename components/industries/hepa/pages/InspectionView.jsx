'use client'

// One inspection's record.
//
// The product's own page, in the product's order: the header card with the
// reference, its state and every action that applies to it; the five facts a
// reviewer asks for first; the asset, the room conditions, the checklist and
// the notes; then three stacked sections — Inspection Results, Root Cause
// Analysis, and the MTTR workflow — each of which draws a dashed panel saying
// what is missing when it holds nothing.
//
// Those empty panels are the part worth keeping. A round that has not been
// walked has no results and most rounds never need an analysis; hiding the
// section would leave a reviewer looking for the analysis wondering where it
// went, and the product answers that by saying there is none.
//
// A page rather than a drawer. This is linkable, opens in a second tab and
// closes with the back button, all three of which somebody does in a review.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeading, PALETTE } from '../lib/kit'
import {
  FactCards, InfoBlock, EmptyPanel, Action, Pill, Glyph, SearchBar, TONE,
} from '../lib/productKit'
import { FILTER_VIEW, USER, fmtDate } from '../lib/data'
import { useStore } from '../lib/store'
import { INSPECTION_REPORTS, INSPECTORS, roundById, checklistOutline } from '../lib/data/inspections'
import { templateById, templateForRound } from '../lib/checklists'

const { INK, SUB, MUTE, LINE } = PALETTE

const RESULT_TONE = { Pass: 'slate', 'Pass with observations': 'amber', Fail: 'red' }
const STATUS_TONE = {
  Completed: 'slate', 'Open finding': 'red', 'In Progress': 'amber',
  Scheduled: 'amber', Overdue: 'red',
}
const PRIORITY_TONE = { Critical: 'red', High: 'red', Medium: 'amber', Low: 'slate' }

// The categories a sterile facility files a root cause under. Not a generic
// list: these are the five an EU GMP Annex 1 investigation has to choose
// between, and the choice is what decides who owns the corrective action.
const RCA_CATEGORIES = [
  'Equipment failure',
  'Facility / HVAC',
  'Personnel practice',
  'Procedure inadequate',
  'Material or component',
]
const RCA_METHODS = ['5 Whys', 'Fishbone', 'Fault tree', 'Is / Is not']

export default function InspectionView({ id }) {
  const router = useRouter()
  const store = useStore()

  const stored = store?.records?.hepa_inspection || []

  // A round walked in the portal rewrites the row it came from, so the stored
  // version wins over the seeded one rather than opening as a second record
  // with the same reference.
  const record = useMemo(() => {
    const seeded = INSPECTION_REPORTS.find((r) => r.reportId === id) || null
    const saved = stored.find((r) => r.reportId === id || r.recordId === id) || null
    if (!seeded && !saved) return null
    return { ...(seeded || {}), ...(saved || {}) }
  }, [id, stored])

  if (!record) {
    return (
      <div>
        <PageHeading
          title="Something went wrong"
          subtitle={`Nothing on the register carries the reference ${id}.`}
          back={{ label: 'Back', onClick: () => router.push('/portal/hepa/inspections') }}
        />
        <EmptyPanel title="Inspection not found">
          It may have been raised in another portal, or the reference may be mistyped.
          Please try again, or go back to the register.
        </EmptyPanel>
      </div>
    )
  }

  return <Record record={record} store={store} router={router} />
}

function Record({ record, store, router }) {
  const [rcaOpen, setRcaOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const round = roundById(record.roundId)
  const checklist = (record.checklistId ? templateById(record.checklistId) : null)
    || templateForRound(record.roundId)
  const filter = record.filterId ? FILTER_VIEW.find((f) => f.filterId === record.filterId) : null
  const walked = Boolean(record._walked)
  const results = record.results || []
  const rca = record.rca || null

  // Corrective work raised off this round, so a finding turned into a job can
  // be told apart from one nobody acted on.
  const orders = (store?.records?.hepa_work_order || [])
    .filter((w) => w.fromInspection === record.reportId)

  // The store keys on recordId, and a round has two kinds of those. One raised
  // in the portal carries the id the database gave it; a seeded row patched for
  // the first time is stored under its own reference, which is what makes the
  // merge rule work. Patching a created round under its reference instead of
  // its record id inserted a second, near-empty row that then won the merge and
  // blanked the record — so the id is asked for rather than assumed.
  const key = record.recordId || record.reportId

  const saveRca = async (payload) => {
    setBusy(true)
    const saved = await store.update('hepa_inspection', key, {
      reportId: record.reportId,
      rca: payload,
    })
    setBusy(false)
    if (saved) setRcaOpen(false)
  }

  const startable = record.status === 'Scheduled' || record.status === 'Overdue'

  return (
    <div>
      <PageHeading
        title={record.reportId}
        subtitle={record.round}
        back={{ label: 'Back', onClick: () => router.push('/portal/hepa/inspections') }}
        right={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {startable && (
              <button
                onClick={() => router.push(`/portal/hepa/inspections/new?round=${encodeURIComponent(record.reportId)}`)}
                style={styles.start}>
                <Glyph name="play" size={13} color="#fff" />
                Start Inspection
              </button>
            )}
            <Action icon="pulse" disabled={Boolean(rca)} onClick={() => setRcaOpen((v) => !v)}>
              {rca ? 'RCA Created' : 'Root Cause Analysis'}
            </Action>
            <Action icon="download" onClick={() => downloadReport(record, results)}>Download Report</Action>
            <Action icon="link" onClick={() => share(record)}>Share</Action>
            <Action icon="wrench" onClick={() => router.push('/portal/hepa/work-orders')}>
              Work Orders{orders.length ? ` (${orders.length})` : ''}
            </Action>
            {record.result === 'Fail' && orders.length === 0 && (
              // Straight to this portal's own create screen rather than the
              // product's link-type modal: the modal exists there because the
              // order is created by the API from the inspection, and here the
              // Work Orders screen is the thing that raises one.
              <button onClick={() => router.push('/portal/hepa/work-orders/new')}
                style={styles.danger}>
                <Glyph name="wrench" size={13} color="#fff" />
                Create Work Order
              </button>
            )}
          </div>
        }
      >
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 9 }}>
          <Pill tone={STATUS_TONE[record.status]}>{record.status}</Pill>
          {record.result && <Pill tone={RESULT_TONE[record.result]}>{record.result}</Pill>}
          {record.isoClass === 'ISO 5' && <Pill tone="violet">Aseptic core</Pill>}
        </div>
      </PageHeading>

      <div style={styles.sheet}>
        <FactCards items={[
          {
            label: 'Inspection Date',
            icon: 'calendar',
            value: record.date ? fmtDate(record.date) : DASH,
            note: [record.frequency, record.standard].filter(Boolean).join(' · ') || null,
          },
          { label: 'Inspector', icon: 'user', value: record.inspector || 'Not yet walked', note: record.isoClass || null },
          { label: 'Assignee', icon: 'user', value: record.assignee || 'Unassigned', note: departmentOf(record.assignee) },
          { label: 'Duration', icon: 'clock', ...duration(record) },
          {
            label: 'Score',
            icon: 'doc',
            value: typeof record.score === 'number' ? `${record.scorePoints ?? 0}/${record.maxScore ?? 0}` : 'N/A',
            note: typeof record.score === 'number' ? `${record.score}%` : 'no result yet',
          },
        ]} />

        <InfoBlock tone="slate" icon="box" label="Asset">
          <strong>{record.filterId || record.cleanroomId}</strong>
          {record.filterId
            ? <span style={styles.dim}> — terminal filter{filter?.concern ? ` · ${filter.concern}` : ''}</span>
            : <span style={styles.dim}> — the whole room</span>}
          <div style={styles.sub}>
            <Glyph name="pin" size={12} color="#7c3aed" />
            Location: {record.cleanroomName} · {record.isoClass}
          </div>
        </InfoBlock>

        <div style={styles.pair}>
          {/* The room's conditions are written by the technician at the round,
              so a round that is only booked has none. Said plainly rather than
              printed as a bare unit: "Temperature: °C" reads as a screen that
              lost the number, where "Not recorded" reads as the truth. */}
          <InfoBlock tone="slate" icon="gauge" label="Environmental Conditions">
            {record.temperature == null && record.humidity == null ? (
              <span style={styles.dim}>Not recorded — this round has not been walked.</span>
            ) : (
              <>
                Temperature: {record.temperature == null ? DASH : `${record.temperature}°C`}
                &nbsp;&nbsp;&nbsp;
                Humidity: {record.humidity == null ? DASH : `${record.humidity}%`}
              </>
            )}
          </InfoBlock>

          <InfoBlock tone="slate" icon="doc" label="Checklist"
            right={record.checklistId && (
              <button onClick={() => router.push(`/portal/hepa/checklists/${record.checklistId}`)} style={styles.link}>
                Open
              </button>
            )}>
            <strong>{record.checklistName || DASH}</strong>
            <div style={styles.code}>
              {[
                `Code: ${record.checklistCode || DASH}`,
                record.checklistSteps ? `${record.checklistSteps} steps` : null,
                checklist?.standard || null,
              ].filter(Boolean).join(' · ')}
            </div>
          </InfoBlock>
        </div>

        {(record.notes || record.recommendedActions) && (
          <div style={styles.pair}>
            {record.notes && (
              <InfoBlock tone="slate" icon="doc" label="Inspection Notes">{record.notes}</InfoBlock>
            )}
            {record.recommendedActions && (
              <InfoBlock tone="amber" icon="warning" label="Recommended Actions">
                {record.recommendedActions}
                {record.followUpRequired && (
                  <div style={styles.followUp}>
                    Follow-up required{record.followUpDate ? ` by ${fmtDate(record.followUpDate)}` : ''}
                  </div>
                )}
              </InfoBlock>
            )}
          </div>
        )}
      </div>

      {/* ── inspection results ──────────────────────────────────────────── */}
      {results.length > 0 ? (
        <InspectionResults record={record} results={results} checklist={checklist} orders={orders} router={router} />
      ) : (
        <EmptyPanel title="No inspection results available">
          This inspection may not have been completed yet, or the results are still being processed.
        </EmptyPanel>
      )}

      {/* ── root cause analysis ─────────────────────────────────────────── */}
      {rcaOpen && !rca && (
        <RcaForm record={record} busy={busy} ready={store?.ready}
          onCancel={() => setRcaOpen(false)} onSave={saveRca} />
      )}

      {rca ? (
        <RcaResults record={record} rca={rca} />
      ) : (
        <EmptyPanel title="No Root Cause Analysis available for this inspection.">
          {record.result === 'Fail'
            ? 'This round failed. Open Root Cause Analysis above to record why, and what closes it.'
            : 'Please create a new Root Cause Analysis to get started.'}
        </EmptyPanel>
      )}

      {/* ── the workflow behind the repair ──────────────────────────────── */}
      {walked ? (
        <MttrWorkflow record={record} orders={orders} />
      ) : (
        <EmptyPanel title="No MTTR Data Available">
          Mean Time to Repair (MTTR) data is not available for this inspection.
        </EmptyPanel>
      )}
    </div>
  )
}

// ── results ───────────────────────────────────────────────────────────────
//
// The product's results table, step by step, grouped by the checklist's own
// sections and filterable in place. Filtering here rather than only on the list
// matters on a long checklist: the question a reviewer arrives with is "show me
// what failed", and scrolling forty rows to find two is how that gets missed.

function InspectionResults({ record, results, checklist, orders, router }) {
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState('all')
  const [status, setStatus] = useState('all')

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return results.filter((r) => (
      (!q || [r.itemNumber, r.itemDescription, r.comments].filter(Boolean).join(' ').toLowerCase().includes(q))
      && (priority === 'all' || r.priority === priority)
      && (status === 'all'
        || (status === 'pass' && r.passFail === true)
        || (status === 'fail' && r.passFail === false)
        || (status === 'within' && r.isWithinSpec === true)
        || (status === 'out' && r.isWithinSpec === false))
    ))
  }, [results, search, priority, status])

  // Group by the checklist's own sections, in the checklist's own order. The
  // results carry the step order rather than a section name, so the outline is
  // what says where each one belongs.
  const groups = useMemo(() => {
    const outline = checklistOutline(checklist)
    const keep = new Set(shown.map((r) => r.itemNumber))
    if (!outline.length) {
      return [{ name: record.checklistName, items: shown }]
    }
    let at = 0
    return outline.map((s) => {
      const slice = results.slice(at, at + s.items.length)
      at += s.items.length
      return { name: s.name, items: slice.filter((r) => keep.has(r.itemNumber)) }
    }).filter((g) => g.items.length)
  }, [checklist, results, shown, record.checklistName])

  const passed = results.filter((r) => r.passFail === true).length
  const failed = results.filter((r) => r.passFail === false).length
  const action = results.filter((r) => r.requiresAction).length
  const points = results.reduce((n, r) => n + (r.itemScore || 0), 0)

  return (
    <div style={styles.sheet}>
      <div style={styles.sectionHead}>
        <div style={{ minWidth: 0 }}>
          <h3 style={styles.sectionTitle}>
            <Glyph name="clipboard" size={16} color="#15227a" />
            Inspection Results
          </h3>
          <p style={styles.sectionSub}>Detailed results for {record.reportId}</p>
        </div>
        <div style={styles.stats}>
          <Stat value={results.length} label="Total Items" />
          <Stat value={passed} label="Passed Items" tone="#047857" />
          <Stat value={failed} label="Failed Items" tone="#b91c1c" />
          <Stat value={points} label="Total Score" tone="#2563eb" />
          {action > 0 && <Stat value={action} label="Items Requiring Action" tone="#b45309" />}
        </div>
      </div>

      <div style={styles.resultFilters}>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search results..." />
        </div>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} style={styles.select}>
          <option value="all">All Priorities</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={styles.select}>
          <option value="all">All Status</option>
          <option value="pass">Pass Only</option>
          <option value="fail">Fail Only</option>
          <option value="within">Within Spec</option>
          <option value="out">Out of Spec</option>
        </select>
      </div>

      {shown.length === 0 ? (
        <div style={styles.noRows}>No results found matching your criteria.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Item Description</th>
                <th style={styles.th}>Response</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Priority</th>
                <th style={styles.th}>Comments</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <GroupRows key={g.name} group={g} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {orders.length > 0 && (
        <div style={{ marginTop: 15, paddingTop: 13, borderTop: `1px solid ${LINE}` }}>
          <div style={styles.miniHead}>Corrective work raised off this round</div>
          {orders.map((w) => (
            <button key={w.workOrderId} onClick={() => router.push(`/portal/hepa/work-orders/${w.workOrderId}`)}
              style={styles.orderRow}>
              <Glyph name="wrench" size={13} color="#15227a" />
              <strong style={{ fontSize: 12.5, color: '#15227a' }}>{w.workOrderId}</strong>
              <span style={{ fontSize: 12, color: SUB, minWidth: 0, flex: 1, textAlign: 'left' }}>{w.description}</span>
              <Pill tone={w.status === 'Completed' ? 'green' : 'amber'}>{w.status}</Pill>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function GroupRows({ group }) {
  return (
    <>
      <tr>
        <td colSpan={5} style={styles.groupRow}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Glyph name="list" size={13} color={SUB} />
            <strong style={{ fontSize: 12.5, color: INK }}>{group.name}</strong>
            <span style={{ marginLeft: 'auto' }}>
              <Pill tone="slate">{group.items.length} {group.items.length === 1 ? 'item' : 'items'}</Pill>
            </span>
          </span>
        </td>
      </tr>
      {group.items.map((r) => (
        <tr key={r.itemNumber}>
          <td style={{ ...styles.td, minWidth: 300 }}>
            <span style={styles.itemNo}>Item #{r.itemNumber}</span>
            <span style={{ fontSize: 12.5, color: INK }}>{r.itemDescription}</span>
            <span style={styles.itemType}>{r.responseType}</span>
          </td>
          <td style={styles.td}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12,
              color: r.passFail ? '#047857' : '#b91c1c',
            }}>
              <Glyph name={r.passFail ? 'check' : 'cross'} size={14} color={r.passFail ? '#047857' : '#b91c1c'} />
              {r.passFail ? 'Pass' : 'Fail'}
            </span>
          </td>
          <td style={styles.td}>
            <Pill tone={r.isWithinSpec ? 'green' : 'red'}>{r.isWithinSpec ? 'Within Spec' : 'Out of Spec'}</Pill>
          </td>
          <td style={styles.td}>
            <Pill tone={PRIORITY_TONE[r.priority] || 'slate'}>{r.priority}</Pill>
          </td>
          <td style={{ ...styles.td, maxWidth: 380 }}>
            {r.comments
              ? <span style={{ fontSize: 12, color: SUB, lineHeight: 1.5 }}>{r.comments}</span>
              : <span style={{ color: '#cbd5e1' }}>—</span>}
          </td>
        </tr>
      ))}
    </>
  )
}

function Stat({ value, label, tone }) {
  return (
    <span style={{ textAlign: 'center', minWidth: 62 }}>
      <span style={{ display: 'block', fontSize: 17, fontWeight: 800, color: tone || INK, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
      <span style={{ display: 'block', fontSize: 10.5, color: MUTE, marginTop: 2 }}>{label}</span>
    </span>
  )
}

// ── root cause analysis ───────────────────────────────────────────────────

function RcaForm({ record, busy, ready, onCancel, onSave }) {
  const [form, setForm] = useState({
    category: RCA_CATEGORIES[0],
    method: RCA_METHODS[0],
    description: record.findings?.[0] || '',
    contributing: '',
    recurring: false,
    conditionSatisfactory: record.result !== 'Fail',
    action: record.recommendedActions || '',
    assignedTo: record.assignee || INSPECTORS[0]?.name || '',
    dueDate: record.followUpDate || '',
  })

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  return (
    <div style={{ ...styles.sheet, borderColor: '#ddd6fe', background: '#fdfcff' }}>
      <div style={styles.sectionHead}>
        <div>
          <h3 style={styles.sectionTitle}>
            <Glyph name="pulse" size={16} color="#7c3aed" />
            Root Cause Analysis
          </h3>
          <p style={styles.sectionSub}>Why {record.reportId} came out the way it did, and what closes it.</p>
        </div>
      </div>

      <div style={styles.formGrid}>
        <Field label="Root Cause Category">
          <select value={form.category} onChange={(e) => set('category', e.target.value)} style={styles.input}>
            {RCA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Analysis Method">
          <select value={form.method} onChange={(e) => set('method', e.target.value)} style={styles.input}>
            {RCA_METHODS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Assigned to">
          <select value={form.assignedTo} onChange={(e) => set('assignedTo', e.target.value)} style={styles.input}>
            {INSPECTORS.map((t) => <option key={t.technicianId} value={t.name}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Due Date">
          <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} style={styles.input} />
        </Field>
      </div>

      <Field label="Root Cause Description — required">
        <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)}
          placeholder="What actually caused it. Plain words are fine."
          style={{ ...styles.input, resize: 'vertical' }} />
      </Field>

      <Field label="Contributing Factors">
        <textarea rows={2} value={form.contributing} onChange={(e) => set('contributing', e.target.value)}
          placeholder="Anything that made it more likely, or made it take longer to find."
          style={{ ...styles.input, resize: 'vertical' }} />
      </Field>

      <Field label="Corrective Action — required">
        <textarea rows={2} value={form.action} onChange={(e) => set('action', e.target.value)}
          placeholder="What is being done, and by when."
          style={{ ...styles.input, resize: 'vertical' }} />
      </Field>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 4 }}>
        <label style={styles.check}>
          <input type="checkbox" checked={form.recurring} onChange={(e) => set('recurring', e.target.checked)} />
          This has happened before
        </label>
        <label style={styles.check}>
          <input type="checkbox" checked={form.conditionSatisfactory}
            onChange={(e) => set('conditionSatisfactory', e.target.checked)} />
          Asset condition satisfactory
        </label>
      </div>

      <div style={styles.formFooter}>
        <span style={{ flex: '1 1 220px', fontSize: 11.5, color: MUTE, lineHeight: 1.55 }}>
          Filed as {USER.name} against {record.reportId}. An analysis is written once and
          stays on the record — this is the answer an auditor reads back.
        </span>
        <Action onClick={onCancel}>Cancel</Action>
        <button
          onClick={() => onSave({
            ...form,
            createdBy: USER.name,
            createdOn: new Date().toISOString().slice(0, 10),
          })}
          disabled={!form.description.trim() || !form.action.trim() || busy || !ready}
          style={{
            ...styles.start,
            background: '#7c3aed',
            opacity: !form.description.trim() || !form.action.trim() || busy || !ready ? 0.5 : 1,
          }}>
          {busy ? 'Filing…' : 'Save Analysis'}
        </button>
      </div>
    </div>
  )
}

function RcaResults({ record, rca }) {
  return (
    <div style={styles.sheet}>
      <div style={styles.sectionHead}>
        <div style={{ minWidth: 0 }}>
          <h3 style={styles.sectionTitle}>
            <Glyph name="pulse" size={16} color="#7c3aed" />
            Root Cause Analysis Results
          </h3>
          <p style={styles.sectionSub}>Detailed results for {record.reportId}</p>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <Pill tone={rca.recurring ? 'red' : 'slate'}>{rca.recurring ? 'Recurring' : 'Not Recurring'}</Pill>
          <Pill tone={rca.conditionSatisfactory ? 'green' : 'red'}>
            {rca.conditionSatisfactory ? 'Satisfactory' : 'Unsatisfactory'}
          </Pill>
        </div>
      </div>

      <div style={styles.rcaGrid}>
        <Held label="Root Cause Category">{rca.category}</Held>
        <Held label="Analysis Method">{rca.method}</Held>
        <Held label="Asset Condition">{rca.conditionSatisfactory ? 'Satisfactory' : 'Unsatisfactory'}</Held>
      </div>

      <Held label="Root Cause Description">{rca.description}</Held>
      {rca.contributing && <Held label="Contributing Factors">{rca.contributing}</Held>}

      <div style={styles.miniHead}>Corrective Actions</div>
      <div style={styles.actionCard}>
        <Pill tone="amber">Planned</Pill>
        <div style={styles.rcaGrid}>
          <Held label="Action Description">{rca.action}</Held>
          <Held label="Assigned to">{rca.assignedTo || 'Unassigned'}</Held>
          <Held label="Due Date">{rca.dueDate ? fmtDate(rca.dueDate) : 'Not Set'}</Held>
        </div>
      </div>

      <p style={styles.rcaFoot}>
        Created by {rca.createdBy} on {rca.createdOn ? fmtDate(rca.createdOn) : 'N/A'}
      </p>
    </div>
  )
}

function Held({ label, children }) {
  return (
    <div style={{ minWidth: 0, marginBottom: 11 }}>
      <div style={styles.heldLabel}>{label}</div>
      <div style={styles.heldValue}>{children}</div>
    </div>
  )
}

// ── the workflow behind the repair ────────────────────────────────────────
//
// The product draws this as a horizontal chain of stages with the hours between
// them, and it draws only the stages that actually happened. A chain padded out
// with stages nobody reached says the work is further along than it is, which is
// the one thing a mean-time-to-repair figure must not do.

function MttrWorkflow({ record, orders }) {
  const done = orders.filter((w) => w.status === 'Completed')
  const stages = [
    { key: 'created', icon: 'clipboard', tone: 'amber', label: 'Inspection Created', when: record.date },
    {
      key: 'completed',
      icon: 'check',
      tone: 'green',
      label: 'Inspection Completed',
      when: record.date,
      note: typeof record.durationMinutes === 'number' ? `${record.durationMinutes} min on site` : null,
      badge: record.result,
    },
    ...(orders.length ? [{
      key: 'wo', icon: 'wrench', tone: 'blue', label: 'Work Order Created',
      when: orders[0].raisedAt ? String(orders[0].raisedAt).slice(0, 10) : null,
      note: orders[0].workOrderId,
    }] : []),
    ...(done.length ? [{
      key: 'wodone', icon: 'check', tone: 'green', label: 'Work Order Completed',
      when: done[0].completedAt ? String(done[0].completedAt).slice(0, 10) : null,
    }] : []),
    ...(record.status === 'Completed' && !record.findingsCount ? [{
      key: 'closed', icon: 'check', tone: 'green', label: 'Inspection Closed', when: record.date,
    }] : []),
  ]

  return (
    <div style={styles.sheet}>
      <div style={styles.sectionHead}>
        <div>
          <h3 style={styles.sectionTitle}>
            <Glyph name="pulse" size={16} color="#15227a" />
            Process Flow Diagram
          </h3>
          <p style={styles.sectionSub}>
            Mean Time to Repair (MTTR) WorkFlow Details for Inspection {record.reportId}
            {orders.length ? ` · Linked Work Order ${orders[0].workOrderId}` : ''}
          </p>
        </div>
      </div>

      <div style={styles.flow}>
        {stages.map((s, i) => {
          const t = TONE[s.tone] || TONE.slate
          return (
            <span key={s.key} style={{ display: 'contents' }}>
              {i > 0 && (
                <span style={styles.connector}>
                  <span style={styles.connectorLine} />
                </span>
              )}
              <span style={styles.stage}>
                <span style={{ ...styles.stageDot, background: t.bg, borderColor: t.bd }}>
                  <Glyph name={s.icon} size={18} color={t.fg} />
                </span>
                <span style={styles.stageLabel}>{s.label}</span>
                <span style={styles.stageWhen}>{s.when ? fmtDate(s.when) : 'Not started'}</span>
                {s.note && <span style={styles.stageWhen}>{s.note}</span>}
                {s.badge && <Pill tone={RESULT_TONE[s.badge]}>{s.badge}</Pill>}
              </span>
            </span>
          )
        })}
      </div>

      {record.result === 'Fail' && orders.length === 0 && (
        <p style={styles.gap}>
          The chain stops at the round. A failed round with no corrective work standing
          behind it is the case an auditor asks about first.
        </p>
      )}
    </div>
  )
}

// ── plumbing ──────────────────────────────────────────────────────────────

// Nine of the sixty-eight rounds on this register have not been walked, so a
// record with no measurement in a field is the ordinary case rather than the
// broken one. Every such field degrades to this rather than to an empty unit,
// an `undefined` or a zero — a zero is a measurement, and "we have not measured"
// is not the same claim.
const DASH = '—'

const departmentOf = (name) => INSPECTORS.find((t) => t.name === name)?.department || null

/** How long it took, or how long it is booked for, or neither. */
function duration(record) {
  if (typeof record.durationMinutes === 'number') {
    return { value: `${record.durationMinutes} min`, note: 'actual' }
  }
  if (typeof record.plannedMinutes === 'number') {
    return { value: `${record.plannedMinutes} min`, note: 'planned' }
  }
  return { value: DASH, note: 'not recorded' }
}

function Field({ label, children }) {
  return (
    <div style={{ minWidth: 0, marginBottom: 11 }}>
      <div style={styles.fieldLabel}>{label}</div>
      {children}
    </div>
  )
}

/**
 * Share.
 *
 * The system share sheet where the browser offers one, the clipboard where it
 * does not. A "Share" that silently does nothing on a desktop browser is worse
 * than one that says the link was copied.
 */
async function share(record) {
  const url = typeof window !== 'undefined' ? window.location.href : ''
  const text = `${record.reportId} — ${record.round} at ${record.cleanroomName}`
  try {
    if (navigator.share) {
      await navigator.share({ title: record.reportId, text, url })
      return
    }
    await navigator.clipboard.writeText(url)
  } catch {
    // The user dismissed the sheet, or the clipboard is blocked. Neither is an
    // error worth interrupting them over.
  }
}

/**
 * The round as a file somebody can attach to a deviation.
 *
 * Written out here rather than fetched, because the report *is* the record —
 * there is no separate document behind this button, and a Download that
 * downloads nothing is the worst of the three options.
 */
function downloadReport(record, results) {
  const lines = [
    `Inspection ${record.reportId}`,
    `${record.round} — ${record.standard} (${record.frequency})`,
    `${record.cleanroomName} · ${record.isoClass}${record.filterId ? ` · ${record.filterId}` : ''}`,
    '',
    `Date: ${record.date || DASH}`,
    `Inspector: ${record.inspector || 'Not yet walked'}`,
    `Assignee: ${record.assignee || 'Unassigned'}`,
    `Status: ${record.status}`,
    `Result: ${record.result || 'No result yet'}`,
    `Score: ${typeof record.score === 'number' ? `${record.scorePoints ?? 0}/${record.maxScore ?? 0} (${record.score}%)` : 'N/A'}`,
    `Conditions: ${record.temperature == null && record.humidity == null ? 'not recorded'
      : `${record.temperature == null ? DASH : `${record.temperature}°C`}, ${record.humidity == null ? DASH : `${record.humidity}% RH`}`}`,
    `Checklist: ${record.checklistName || DASH}${record.checklistCode ? ` (${record.checklistCode})` : ''}`,
    '',
    'Results',
    ...results.map((r) => `  ${r.itemNumber}. [${r.passFail ? 'PASS' : 'FAIL'}] ${r.itemDescription}${r.comments ? `\n      ${r.comments}` : ''}`),
  ]
  if (record.recommendedActions) lines.push('', 'Recommended actions', `  ${record.recommendedActions}`)

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${record.reportId}.txt`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const styles = {
  sheet: {
    background: '#fff', borderRadius: 12, padding: '18px 20px', marginBottom: 14,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  start: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 15px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
    background: '#ea7317', color: '#fff', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  danger: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 15px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
    background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
  },

  dim: { color: SUB },
  sub: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: SUB, marginTop: 5 },
  code: { fontSize: 11, color: MUTE, marginTop: 3 },
  pair: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 11 },
  followUp: { fontSize: 11.5, marginTop: 6, fontWeight: 700 },
  link: {
    padding: '3px 9px', fontSize: 10.5, fontWeight: 700, fontFamily: 'inherit',
    borderRadius: 7, background: '#fff', color: '#047857', cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#a7f3d0',
  },

  sectionHead: {
    display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap',
    marginBottom: 13, justifyContent: 'space-between',
  },
  sectionTitle: {
    margin: 0, fontSize: 15.5, fontWeight: 700, color: INK,
    display: 'flex', alignItems: 'center', gap: 8,
  },
  sectionSub: { margin: '4px 0 0', fontSize: 12, color: MUTE, lineHeight: 1.5 },
  stats: { display: 'flex', gap: 18, flexWrap: 'wrap' },

  resultFilters: { display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 4 },
  select: {
    padding: '11px 11px', fontSize: 12.5, fontWeight: 600, color: INK, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
    borderRadius: 10, fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
  },

  table: { width: '100%', minWidth: 780, borderCollapse: 'collapse' },
  th: {
    padding: '9px 12px', fontSize: 10.5, fontWeight: 700, color: MUTE, textAlign: 'left',
    textTransform: 'uppercase', letterSpacing: 0.4, background: '#f8fafc',
    whiteSpace: 'nowrap', borderBottom: `1px solid ${LINE}`,
  },
  td: { padding: '11px 12px', borderTop: `1px solid #f1f5f9`, verticalAlign: 'top' },
  groupRow: { padding: '9px 12px', background: '#f1f5f9', borderTop: `1px solid ${LINE}` },
  itemNo: {
    display: 'inline-block', marginRight: 8, padding: '1px 7px', borderRadius: 6,
    background: '#eef1ff', color: '#15227a', fontSize: 10, fontWeight: 800,
    fontVariantNumeric: 'tabular-nums', verticalAlign: 'middle',
  },
  itemType: { display: 'block', fontSize: 10.5, color: MUTE, fontStyle: 'italic', marginTop: 4 },
  noRows: { padding: '30px 16px', textAlign: 'center', fontSize: 12.5, color: MUTE },

  miniHead: {
    fontSize: 11, fontWeight: 700, color: MUTE, textTransform: 'uppercase',
    letterSpacing: 0.4, margin: '4px 0 8px',
  },
  orderRow: {
    display: 'flex', alignItems: 'center', gap: 9, width: '100%',
    padding: '9px 12px', borderRadius: 9, marginBottom: 6, background: '#fbfcfd',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
    cursor: 'pointer', fontFamily: 'inherit',
  },

  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 },
  fieldLabel: {
    fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase',
    letterSpacing: 0.4, marginBottom: 5,
  },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
    fontFamily: 'inherit', lineHeight: 1.5, color: INK, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, borderRadius: 9, outline: 'none',
  },
  check: { display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: SUB, cursor: 'pointer' },
  formFooter: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    marginTop: 14, paddingTop: 13, borderTop: `1px solid ${LINE}`,
  },

  rcaGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 },
  heldLabel: { fontSize: 11, fontWeight: 700, color: MUTE, marginBottom: 3 },
  heldValue: { fontSize: 12.5, color: INK, lineHeight: 1.55 },
  actionCard: {
    padding: '12px 14px', borderRadius: 10, background: '#fbfcfd', marginBottom: 11,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  rcaFoot: { margin: 0, fontSize: 11, color: MUTE },

  flow: {
    display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto',
    padding: '8px 2px 4px', minWidth: 0,
  },
  stage: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    minWidth: 128, textAlign: 'center', flexShrink: 0,
  },
  stageDot: {
    width: 40, height: 40, borderRadius: 999, display: 'grid', placeItems: 'center',
    borderStyle: 'solid', borderWidth: 1, marginBottom: 3,
  },
  stageLabel: { fontSize: 12, fontWeight: 700, color: INK },
  stageWhen: { fontSize: 10.5, color: MUTE },
  connector: { flex: '1 1 40px', display: 'flex', alignItems: 'center', minWidth: 40, paddingTop: 20 },
  connectorLine: { flex: 1, height: 2, background: '#e2e8f0', borderRadius: 999 },
  gap: {
    margin: '13px 0 0', padding: '11px 13px', fontSize: 12, lineHeight: 1.55,
    borderRadius: 9, background: '#fef2f2', color: '#b91c1c',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fecaca',
  },
}
