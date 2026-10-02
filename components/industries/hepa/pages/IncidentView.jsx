'use client'

// One incident's record.
//
// The product's own layout, section for section: a header carrying the
// reference and the two actions that apply to it, then four tabs — the details,
// the asset, the conditions in the room at the time, and whatever is attached —
// and under them the root cause analysis, drawn as a dashed panel saying there
// is none where none has been recorded.
//
// The analysis panel is below the tabs rather than inside one, which is the
// product's arrangement and the right one: an investigation is not a fifth
// detail of the report, it is the thing the report exists to produce, and a
// reviewer scrolling to the bottom should find either the analysis or a plain
// statement that nobody has done it.
//
// Closing is the one place this record goes beyond the product's screen. Annex 1
// does not accept an event marked resolved with nothing written against it, so
// the corrective action is required to close and is stored on the record rather
// than held in a form — it survives the reload, which is the whole point of
// writing it down.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeading, PALETTE } from '../lib/kit'
import { InfoBlock, EmptyPanel, Action, Pill, Glyph, Z } from '../lib/productKit'
import { FILTER_VIEW, TECHNICIANS, fmtDate } from '../lib/data'
import { useStore } from '../lib/store'
import {
  INCIDENT_STATUSES, INCIDENT_SEVERITIES, INCIDENT_PRIORITIES, INCIDENT_IMPACTS,
  ROOM_CONDITIONS, ROOM_ACTIVITIES, RCA_CATEGORIES, RCA_METHODS, ACTION_STATUSES,
  useIncidents, incidentFromList, updateIncident, closeIncidentWithCapa,
  saveIncidentRca, deleteIncidentRca, createWorkOrder, useCreatedOrders,
} from '../lib/ops'

const { INK, SUB, MUTE, LINE } = PALETTE

const SEVERITY_TONE = { Critical: 'red', Major: 'amber', Minor: 'slate' }
const STATUS_TONE = {
  'Draft': 'slate',
  'Submitted': 'slate',
  'Open': 'amber',
  'Under investigation': 'amber',
  'RCA in progress': 'amber',
  'Actions in progress': 'amber',
  'Pending closure': 'amber',
  'Closed': 'slate',
  'Rejected': 'red',
  'Reopened': 'amber',
  'Escalated': 'red',
  'On hold': 'slate',
}
const ACTION_TONE = {
  'Planned': 'amber', 'On hold': 'amber', 'In progress': 'amber',
  'Completed': 'slate', 'Cancelled': 'red',
}

const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'asset', label: 'Asset Information' },
  { key: 'environment', label: 'Environmental Info' },
  { key: 'images', label: 'Images & Documents' },
]

const technicianNames = TECHNICIANS.map((t) => t.name)

export default function IncidentView({ id }) {
  const router = useRouter()
  const store = useStore()
  const all = useIncidents()
  const orders = useCreatedOrders()

  const [tab, setTab] = useState('details')
  const [editing, setEditing] = useState(false)
  const [rcaOpen, setRcaOpen] = useState(false)
  const [capa, setCapa] = useState('')
  const [busy, setBusy] = useState(false)

  const record = useMemo(() => incidentFromList(all, id), [all, id])

  if (!record) {
    return (
      <div>
        <PageHeading
          title="Incident not found"
          subtitle={`Nothing on the register carries the reference ${id}.`}
          back={{ label: 'Back', onClick: () => router.push('/portal/hepa/incidents') }}
        />
        <EmptyPanel title="No such incident">
          It may have been raised in another portal, or the reference may be mistyped.
        </EmptyPanel>
      </div>
    )
  }

  const filter = record.filterId ? FILTER_VIEW.find((f) => f.filterId === record.filterId) : null
  const rca = record.rca || null
  const raised = orders.filter((w) => w.fromInspection === record.incidentId)

  const raiseWorkOrder = async () => {
    setBusy(true)
    const order = await createWorkOrder(store, {
      filterId: record.filterId,
      orderType: record.classification === 'Equipment' ? 'PM02' : 'PM01',
      priority: record.severity === 'Critical' ? 'Critical' : record.severity === 'Major' ? 'High' : 'Medium',
      description: `${record.type} — ${record.description}`,
      fromInspection: record.incidentId,
    }, orders)
    setBusy(false)
    if (order) router.push(`/portal/hepa/work-orders/${order.workOrderId}`)
  }

  return (
    <div>
      <PageHeading
        title="Incident Details"
        subtitle={record.incidentId}
        back={{ label: 'Back', onClick: () => router.push('/portal/hepa/incidents') }}
        right={(
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Action icon="pulse" onClick={() => setRcaOpen(true)} disabled={Boolean(rca)}>
              {rca ? 'RCA Created' : 'Root Cause Analysis'}
            </Action>
            <Action icon="wrench" onClick={raiseWorkOrder}
              disabled={busy || !record.filterId || !store?.ready}
              title={record.filterId ? undefined : 'This incident names a room but no filter, and an order needs an asset.'}>
              Create Work Order{raised.length ? ` (${raised.length})` : ''}
            </Action>
            <Action icon="doc" onClick={() => setEditing((v) => !v)}>
              {editing ? 'Close form' : 'Edit Incident'}
            </Action>
          </div>
        )}
      />

      <div style={styles.sheet}>
        <div style={styles.sheetTop}>
          <div style={{ minWidth: 0 }}>
            <h2 style={styles.ref}>{record.incidentId}</h2>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 7 }}>
              <Pill tone={SEVERITY_TONE[record.severity]}>{record.severity}</Pill>
              <Pill tone={STATUS_TONE[record.status]}>{record.status}</Pill>
              <Pill tone="slate">{record.classification}</Pill>
              {record.isoClass === 'ISO 5' && <Pill tone="violet">Aseptic core</Pill>}
            </div>
          </div>
          <p style={styles.headline}>{record.type}</p>
        </div>

        <div style={styles.tabs}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                ...styles.tab,
                background: tab === t.key ? '#15227a' : '#fff',
                color: tab === t.key ? '#fff' : SUB,
                borderColor: tab === t.key ? '#15227a' : LINE,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'details' && (
          <>
            <div style={styles.twoCol}>
              <Panel icon="warning" title="Basic Information">
                <Line label="Incident Number" value={record.incidentId} mono />
                <Line label="Incident Type" value={record.type} />
                <Line label="Classification" value={record.classification} />
                <Line label="Date & Time" icon="calendar"
                  value={`${fmtDate(record.date)}${String(record.raisedAt || '').includes('T') ? ` · ${String(record.raisedAt).slice(11, 16)}` : ''}`} />
                <Line label="Location" icon="pin" value={`${record.cleanroomName} · ${record.isoClass}`} />
                <Line label="Area" value={record.area || 'Not specified'} />
                <Line label="Severity Rating" value={<Pill tone={SEVERITY_TONE[record.severity]}>{record.severity}</Pill>} />
                <Line label="Priority" value={<Pill tone="slate">{record.priority || 'Not specified'}</Pill>} last />
              </Panel>

              <Panel icon="user" title="Reporting Information">
                <Line label="Reported By" value={record.reportedBy || 'Unknown'} />
                <Line label="Found By" value={record.foundBy || 'Not specified'} />
                <Line label="Status" value={<Pill tone={STATUS_TONE[record.status]}>{record.status}</Pill>} />
                <Line label="Product Impact" value={record.productImpact || 'Not specified'} />
                <Line label="Downtime" value={record.downtimeHours ? `${record.downtimeHours} hours` : 'None recorded'} />
                <Line label="Created Date" value={fmtDate(record.date)} />
                <Line label="Modified Date"
                  value={record.modifiedAt ? fmtDate(String(record.modifiedAt).slice(0, 10)) : 'Never modified'} />
                <Line label="Modified By" value={record.modifiedBy || 'N/A'} last />
              </Panel>
            </div>

            <Panel icon="doc" title="Description & Details">
              <InfoBlock tone="slate" icon="warning" label="Incident Description">
                {record.description || 'No description provided'}
              </InfoBlock>
              {record.equipmentDamage && (
                <InfoBlock tone="amber" icon="wrench" label="Equipment Damages">
                  {record.equipmentDamage}
                </InfoBlock>
              )}
              {record.additionalComments && (
                <InfoBlock tone="slate" icon="doc" label="Additional Comments">
                  {record.additionalComments}
                </InfoBlock>
              )}
            </Panel>
          </>
        )}

        {tab === 'asset' && (
          <Panel icon="box" title="Asset Information">
            <Line label="Asset"
              value={record.filterId
                ? (
                  <button onClick={() => router.push(`/portal/hepa/filters/${record.filterId}`)} style={styles.link}>
                    {record.filterId}
                    <Glyph name="link" size={12} color="#15227a" />
                  </button>
                )
                : 'No filter selected — the event was room-wide'} />
            <Line label="Cleanroom" value={`${record.cleanroomId || '—'} · ${record.cleanroomName}`} />
            <Line label="Classification of the room" value={record.isoClass} />
            <Line label="Current standing of the filter"
              value={filter ? (filter.concern || 'No concern on the register') : 'Not applicable'} />
            <Line label="Operator Name" value={record.operator || 'Not specified'} last />

            {raised.length > 0 && (
              <div style={{ marginTop: 13, paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
                <div style={styles.blockHead}>Corrective work raised off this incident</div>
                {raised.map((w) => (
                  <button key={w.workOrderId} onClick={() => router.push(`/portal/hepa/work-orders/${w.workOrderId}`)}
                    style={styles.orderRow}>
                    <Glyph name="wrench" size={13} color="#15227a" />
                    <strong style={{ fontSize: 12.5, color: '#15227a' }}>{w.workOrderId}</strong>
                    <span style={{ fontSize: 12, color: SUB, minWidth: 0, flex: 1 }}>{w.description}</span>
                    <Pill tone={w.status === 'Completed' ? 'green' : 'amber'}>{w.status}</Pill>
                  </button>
                ))}
              </div>
            )}
          </Panel>
        )}

        {tab === 'environment' && (
          <Panel icon="gauge" title="Environmental Information">
            <Line label="Room Condition" value={record.roomCondition || 'Not specified'} />
            <Line label="Room Activity" icon="pulse" value={record.roomActivity || 'Not specified'} />
            <Line label="Classification held" value={record.isoClass} last />
            <p style={styles.note}>
              Annex 1 keeps at rest and in operation apart because the same count means
              different things in each: breached at rest it is the facility, breached in
              operation it may be the people in the room.
            </p>
          </Panel>
        )}

        {tab === 'images' && (
          <Panel icon="doc" title="Images & Documents">
            {(record.attachments?.length || record.documentRef) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {record.documentRef && (
                  <button onClick={() => router.push(`/portal/hepa/repository/${record.documentRef}`)} style={styles.docRow}>
                    <Glyph name="doc" size={15} color="#15227a" />
                    <span style={{ minWidth: 0, textAlign: 'left' }}>
                      <strong style={{ display: 'block', fontSize: 12.5, color: '#15227a' }}>{record.documentRef}</strong>
                      <span style={{ display: 'block', fontSize: 11, color: MUTE }}>
                        Certification record for {record.filterId} · Document
                      </span>
                    </span>
                  </button>
                )}
                {(record.attachments || []).map((a, i) => (
                  <div key={i} style={styles.docRow}>
                    <Glyph name="doc" size={15} color={SUB} />
                    <span style={{ minWidth: 0, textAlign: 'left' }}>
                      <strong style={{ display: 'block', fontSize: 12.5, color: INK }}>{a.name}</strong>
                      <span style={{ display: 'block', fontSize: 11, color: MUTE }}>
                        {a.type}{a.description ? ` · ${a.description}` : ''}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={styles.note}>No images attached to this incident</p>
            )}
          </Panel>
        )}
      </div>

      {/* ── editing the report ────────────────────────────────────────────── */}
      {editing && (
        <EditIncidentForm
          record={record}
          ready={store?.ready}
          onCancel={() => setEditing(false)}
          onSubmit={async (patch) => {
            const saved = await updateIncident(store, record, patch)
            if (saved) setEditing(false)
          }}
        />
      )}

      {/* ── the action that closes it ────────────────────────────────────── */}
      {record.status === 'Closed' && record.capa ? (
        <div style={styles.sheet}>
          <div style={styles.sectionHead}>
            <Glyph name="check" size={16} color="#059669" />
            <h3 style={styles.sectionTitle}>Corrective and preventive action</h3>
            <span style={{ marginLeft: 'auto', fontSize: 11.5, color: MUTE }}>
              Closed {record.closedOn ? fmtDate(record.closedOn) : ''}
              {record.daysToClose != null ? ` · ${record.daysToClose} days after the event` : ''}
            </span>
          </div>
          <InfoBlock tone="slate" icon="check" label="What closed it">
            {record.capa}
          </InfoBlock>
        </div>
      ) : (
        <div style={styles.sheet}>
          <div style={styles.sectionHead}>
            <Glyph name="check" size={16} color="#b45309" />
            <h3 style={styles.sectionTitle}>Close this incident</h3>
          </div>
          <p style={styles.note}>
            An incident closes on a corrective and preventive action, not on a status.
            What is written here stays on the record and is what an Annex 1 inspection reads.
          </p>
          <textarea rows={3} value={capa} onChange={(e) => setCapa(e.target.value)}
            placeholder="What was done, and what stops it happening again."
            style={{ ...styles.input, resize: 'vertical', marginTop: 10 }} />
          <div style={styles.rowEnd}>
            <button onClick={async () => {
              setBusy(true)
              const saved = await closeIncidentWithCapa(store, record, capa)
              setBusy(false)
              if (saved) setCapa('')
            }}
              disabled={!capa.trim() || busy || !store?.ready}
              style={{ ...styles.primary, opacity: !capa.trim() || busy || !store?.ready ? 0.5 : 1 }}>
              {busy ? 'Closing…' : 'Close incident'}
            </button>
          </div>
        </div>
      )}

      {/* ── root cause analysis ──────────────────────────────────────────── */}
      {rca ? (
        <RcaResults
          rca={rca}
          incidentNumber={record.incidentId}
          onEdit={() => setRcaOpen(true)}
          onDelete={() => deleteIncidentRca(store, record)}
        />
      ) : (
        <EmptyPanel title="No Root Cause Analysis available for this incident">
          Please create a new Root Cause Analysis to get started.
        </EmptyPanel>
      )}

      {rcaOpen && (
        <RcaModal
          rca={rca}
          ready={store?.ready}
          defaults={record}
          onClose={() => setRcaOpen(false)}
          onSave={async (draft) => {
            const saved = await saveIncidentRca(store, record, draft)
            if (saved) setRcaOpen(false)
          }}
        />
      )}
    </div>
  )
}

/** One of the record's cards: an icon, a title and a stack of labelled lines. */
function Panel({ icon, title, children }) {
  return (
    <div style={styles.panel}>
      <div style={styles.sectionHead}>
        <Glyph name={icon} size={16} color="#15227a" />
        <h3 style={styles.sectionTitle}>{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Line({ label, value, icon, mono, last }) {
  return (
    <div style={{ ...styles.line, borderBottom: last ? 'none' : `1px solid ${LINE}` }}>
      <span style={styles.lineLabel}>
        {icon && <Glyph name={icon} size={13} color={MUTE} />}
        {label}
      </span>
      <span style={{ ...styles.lineValue, fontVariantNumeric: mono ? 'tabular-nums' : 'normal' }}>{value}</span>
    </div>
  )
}

/**
 * Editing the report.
 *
 * The fields the product lets an editor change, and no others: what the event
 * was and how it is rated, not who found it or when. Rewriting the discovery of
 * an incident after the fact is exactly what an audit trail exists to prevent.
 */
function EditIncidentForm({ record, ready, onCancel, onSubmit }) {
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    severity: record.severity,
    priority: record.priority || 'High',
    status: record.status,
    productImpact: record.productImpact || '',
    downtimeHours: record.downtimeHours ?? '',
    area: record.area || '',
    roomCondition: record.roomCondition || ROOM_CONDITIONS[0],
    roomActivity: record.roomActivity || ROOM_ACTIVITIES[0],
    operator: record.operator || '',
    description: record.description || '',
    equipmentDamage: record.equipmentDamage || '',
    additionalComments: record.additionalComments || '',
  })
  const set = (patch) => setForm((p) => ({ ...p, ...patch }))

  return (
    <div style={{ ...styles.sheet, background: '#fbfcff', borderColor: '#c7d2fe' }}>
      <div style={styles.sectionHead}>
        <Glyph name="doc" size={16} color="#15227a" />
        <h3 style={styles.sectionTitle}>Edit Incident Report</h3>
      </div>

      <div style={styles.formGrid4}>
        <Field label="Severity Rating">
          <select value={form.severity} onChange={(e) => set({ severity: e.target.value })} style={styles.input}>
            {INCIDENT_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select value={form.priority} onChange={(e) => set({ priority: e.target.value })} style={styles.input}>
            {INCIDENT_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={(e) => set({ status: e.target.value })} style={styles.input}>
            {INCIDENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Product Impact">
          <select value={form.productImpact} onChange={(e) => set({ productImpact: e.target.value })} style={styles.input}>
            {INCIDENT_IMPACTS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </Field>
      </div>

      <div style={styles.formGrid4}>
        <Field label="Downtime (hours)">
          <input type="number" min={0} value={form.downtimeHours}
            onChange={(e) => set({ downtimeHours: e.target.value })} style={styles.input} />
        </Field>
        <Field label="Incident Area">
          <input value={form.area} onChange={(e) => set({ area: e.target.value })} style={styles.input} />
        </Field>
        <Field label="Room Condition">
          <select value={form.roomCondition} onChange={(e) => set({ roomCondition: e.target.value })} style={styles.input}>
            {ROOM_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Room Activity">
          <select value={form.roomActivity} onChange={(e) => set({ roomActivity: e.target.value })} style={styles.input}>
            {ROOM_ACTIVITIES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Operator Name">
        <input value={form.operator} onChange={(e) => set({ operator: e.target.value })} style={styles.input} />
      </Field>

      <Field label="Incident Description">
        <textarea rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })}
          style={{ ...styles.input, resize: 'vertical' }} />
      </Field>

      <Field label="Equipment Damages">
        <textarea rows={2} value={form.equipmentDamage} onChange={(e) => set({ equipmentDamage: e.target.value })}
          placeholder="Describe any equipment damages…" style={{ ...styles.input, resize: 'vertical' }} />
      </Field>

      <Field label="Additional Comments">
        <textarea rows={2} value={form.additionalComments} onChange={(e) => set({ additionalComments: e.target.value })}
          placeholder="Any additional comments or notes…" style={{ ...styles.input, resize: 'vertical' }} />
      </Field>

      <div style={styles.rowEnd}>
        <Action onClick={onCancel}>Cancel</Action>
        <button onClick={async () => {
          setBusy(true)
          await onSubmit({
            ...form,
            downtimeHours: Number(form.downtimeHours) || 0,
            area: form.area.trim() || null,
            operator: form.operator.trim() || null,
            description: form.description.trim(),
            equipmentDamage: form.equipmentDamage.trim() || null,
            additionalComments: form.additionalComments.trim() || null,
          })
          setBusy(false)
        }}
          disabled={busy || !ready || !form.description.trim()}
          style={{ ...styles.primary, opacity: busy || !ready || !form.description.trim() ? 0.5 : 1 }}>
          {busy ? 'Updating…' : 'Update Incident Report'}
        </button>
      </div>
    </div>
  )
}

/**
 * The analysis, as it reads once it has been recorded.
 *
 * The product's own arrangement: the recurring flag at the top because it is
 * the first thing a reviewer looks for, then the category, the condition of the
 * asset and the method, then the cause itself, then the actions hung off it.
 */
function RcaResults({ rca, incidentNumber, onEdit, onDelete }) {
  return (
    <div style={styles.sheet}>
      <div style={styles.sectionHead}>
        <Glyph name="pulse" size={16} color="#7c3aed" />
        <div style={{ minWidth: 0 }}>
          <h3 style={styles.sectionTitle}>Root Cause Analysis Results</h3>
          <p style={{ margin: '3px 0 0', fontSize: 11.5, color: MUTE }}>
            Detailed results for {incidentNumber}
          </p>
        </div>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Action icon="doc" onClick={onEdit}>Edit RCA</Action>
          <button onClick={onDelete} style={styles.danger}>
            <Glyph name="cross" size={13} color="#b91c1c" />
            Delete RCA
          </button>
        </span>
      </div>

      <div style={{ marginBottom: 12 }}>
        <Pill tone={rca.recurring ? 'red' : 'slate'}>{rca.recurring ? 'Recurring' : 'Not Recurring'}</Pill>
      </div>

      <div style={styles.threeCol}>
        <Fact label="Root Cause Category" value={rca.category} />
        <Fact label="Asset Condition" value={(
          <Pill tone={rca.assetConditionSatisfactory ? 'green' : 'red'}>
            {rca.assetConditionSatisfactory ? 'Satisfactory' : 'Unsatisfactory'}
          </Pill>
        )} />
        <Fact label="Analysis Method" value={rca.analysisMethod || 'N/A'} />
      </div>

      <InfoBlock tone="slate" icon="pulse" label="Root Cause Description">
        {rca.description}
      </InfoBlock>

      <div style={styles.threeCol}>
        <Fact label="Estimated Downtime Impact"
          value={rca.downtimeImpactHours != null ? `${rca.downtimeImpactHours} hours` : 'N/A'} />
        <Fact label="Contributing Factors" value={rca.contributingFactors || 'N/A'} />
      </div>

      <div style={styles.blockHead}>Corrective Actions</div>
      {rca.correctiveActions?.length ? rca.correctiveActions.map((a, i) => (
        <div key={i} style={styles.actionCard}>
          <div style={{ marginBottom: 9 }}>
            <Pill tone={ACTION_TONE[a.status] || 'slate'}>{a.status || 'Not Set'}</Pill>
          </div>
          <div style={styles.threeCol}>
            <Fact label="Action Description" value={a.description || 'N/A'} />
            <Fact label="Assigned to" value={a.assignedTo || 'Unassigned'} />
            <Fact label="Due Date" value={a.dueDate ? fmtDate(a.dueDate) : 'N/A'} />
          </div>
        </div>
      )) : (
        <p style={{ ...styles.note, color: '#b91c1c' }}>
          No corrective actions defined for this Root Cause Analysis.
        </p>
      )}

      <p style={styles.footer}>
        Created by {rca.createdBy} on {rca.createdOn ? fmtDate(rca.createdOn) : 'N/A'}
      </p>
    </div>
  )
}

/**
 * Recording the analysis.
 *
 * The product opens this over the record as a dialog, and it stays one here:
 * the fields belong to the analysis rather than to the report, and putting them
 * inline would leave a reader unsure which of the two they were editing.
 */
function RcaModal({ rca, defaults, ready, onClose, onSave }) {
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(() => ({
    category: rca?.category || defaults.rootCauseCategory || '',
    description: rca?.description || '',
    analysisMethod: rca?.analysisMethod || '',
    downtimeImpactHours: rca?.downtimeImpactHours ?? '',
    contributingFactors: rca?.contributingFactors || '',
    recurring: Boolean(rca?.recurring),
    assetConditionSatisfactory: Boolean(rca?.assetConditionSatisfactory),
    correctiveActions: rca?.correctiveActions?.map((a) => ({ ...a })) || [],
  }))
  const set = (patch) => setForm((p) => ({ ...p, ...patch }))

  const setAction = (i, patch) => set({
    correctiveActions: form.correctiveActions.map((a, n) => (n === i ? { ...a, ...patch } : a)),
  })

  return (
    <div style={styles.scrim} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={styles.modal}>
        <div style={styles.sectionHead}>
          <Glyph name="pulse" size={16} color="#7c3aed" />
          <h3 style={styles.sectionTitle}>
            {rca ? 'Edit Root Cause Analysis' : 'Create Root Cause Analysis'}
          </h3>
          <button onClick={onClose} style={{ ...styles.removeBtn, marginLeft: 'auto' }}>Close</button>
        </div>

        <div style={styles.blockHead}>Basic Information</div>

        <div style={styles.formGrid3}>
          <Field label="Root Cause Category *">
            <select value={form.category} onChange={(e) => set({ category: e.target.value })} style={styles.input}>
              <option value="">Select Category</option>
              {RCA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Analysis Method">
            <select value={form.analysisMethod} onChange={(e) => set({ analysisMethod: e.target.value })} style={styles.input}>
              <option value="">Describe the Analysis Method</option>
              {RCA_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Estimated Downtime Impact (hours)">
            <input type="number" min={0} value={form.downtimeImpactHours}
              onChange={(e) => set({ downtimeImpactHours: e.target.value })}
              placeholder="Enter estimated downtime" style={styles.input} />
          </Field>
        </div>

        <div style={styles.formGrid}>
          <Field label="Root Cause Description *">
            <textarea rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })}
              placeholder="Description for Root Cause" style={{ ...styles.input, resize: 'vertical' }} />
          </Field>
          <Field label="Contributing Factors">
            <textarea rows={3} value={form.contributingFactors} onChange={(e) => set({ contributingFactors: e.target.value })}
              placeholder="Describe the Contributing Factors" style={{ ...styles.input, resize: 'vertical' }} />
          </Field>
        </div>

        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 14 }}>
          <Toggle label="Recurring Issue?" on={form.recurring} onChange={(v) => set({ recurring: v })} />
          <Toggle label="Asset Condition Satisfactory?" on={form.assetConditionSatisfactory}
            onChange={(v) => set({ assetConditionSatisfactory: v })} />
        </div>

        <div style={styles.blockHead}>Corrective Actions</div>

        {form.correctiveActions.map((a, i) => (
          <div key={i} style={styles.actionCard}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 9 }}>
              <Pill tone="slate">Action {i + 1}</Pill>
              <button onClick={() => set({ correctiveActions: form.correctiveActions.filter((_, n) => n !== i) })}
                style={{ ...styles.removeBtn, marginLeft: 'auto' }}>
                Remove
              </button>
            </div>
            <div style={styles.formGrid}>
              <Field label="Action Description *">
                <input value={a.description || ''} onChange={(e) => setAction(i, { description: e.target.value })}
                  placeholder="Enter a description" style={styles.input} />
              </Field>
              <Field label="Action Status">
                <select value={a.status || ''} onChange={(e) => setAction(i, { status: e.target.value })} style={styles.input}>
                  <option value="">Select Status</option>
                  {ACTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <div style={styles.formGrid}>
              <Field label="Assigned To">
                <select value={a.assignedTo || ''} onChange={(e) => setAction(i, { assignedTo: e.target.value })} style={styles.input}>
                  <option value="">Select a team member</option>
                  {technicianNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="Action Due Date">
                <input type="date" value={a.dueDate || ''} onChange={(e) => setAction(i, { dueDate: e.target.value })} style={styles.input} />
              </Field>
            </div>
          </div>
        ))}

        <button onClick={() => set({
          correctiveActions: [...form.correctiveActions, {
            description: '', status: 'Planned', assignedTo: '', dueDate: '',
          }],
        })} style={styles.addBtn}>
          <Glyph name="wrench" size={13} color={SUB} />
          Add Actions
        </button>

        <div style={styles.rowEnd}>
          <Action onClick={onClose}>Cancel</Action>
          <button onClick={async () => { setBusy(true); await onSave(form); setBusy(false) }}
            disabled={busy || !ready}
            style={{ ...styles.primary, opacity: busy || !ready ? 0.5 : 1 }}>
            {busy ? 'Creating…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Toggle({ label, on, onChange }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{label}</span>
      <button onClick={() => onChange(!on)} role="switch" aria-checked={on} aria-label={label}
        style={{ ...styles.switch, background: on ? '#15227a' : '#e2e8f0' }}>
        <span style={{ ...styles.knob, transform: on ? 'translateX(16px)' : 'translateX(1px)' }} />
      </button>
    </label>
  )
}

function Fact({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={styles.factLabel}>{label}</div>
      <div style={styles.factValue}>{value}</div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ minWidth: 0, marginBottom: 11 }}>
      <div style={styles.formLabel}>{label}</div>
      {children}
    </div>
  )
}

const styles = {
  sheet: {
    background: '#fff', borderRadius: 12, padding: '18px 20px', marginBottom: 14,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  sheetTop: { display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', marginBottom: 16 },
  ref: {
    margin: 0, fontSize: 22, fontWeight: 800, color: INK,
    fontVariantNumeric: 'tabular-nums', letterSpacing: -0.2,
  },
  headline: { margin: 0, marginLeft: 'auto', fontSize: 13.5, fontWeight: 700, color: SUB, maxWidth: 360 },

  tabs: { display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 },
  tab: {
    padding: '8px 14px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
    borderRadius: 9, borderStyle: 'solid', borderWidth: 1, cursor: 'pointer', whiteSpace: 'nowrap',
  },

  panel: {
    padding: '14px 16px', borderRadius: 11, background: '#fbfcfd', marginBottom: 12,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, minWidth: 0,
  },
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 12 },
  threeCol: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
    gap: 14, marginBottom: 12,
  },

  sectionHead: { display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 11 },
  sectionTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: INK },
  blockHead: {
    fontSize: 11, fontWeight: 700, color: MUTE, textTransform: 'uppercase',
    letterSpacing: 0.4, margin: '13px 0 8px',
  },

  line: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 14, padding: '8px 0',
  },
  lineLabel: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 11.5, fontWeight: 600, color: MUTE, flexShrink: 0,
  },
  lineValue: { fontSize: 12.5, color: INK, textAlign: 'right', minWidth: 0, wordBreak: 'break-word' },

  link: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0, border: 'none',
    background: 'none', color: '#15227a', fontFamily: 'inherit', fontSize: 12.5,
    fontWeight: 700, cursor: 'pointer', textDecoration: 'underline',
  },
  orderRow: {
    display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left',
    padding: '9px 12px', borderRadius: 9, marginBottom: 6, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, cursor: 'pointer', fontFamily: 'inherit',
  },
  docRow: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
    padding: '10px 13px', borderRadius: 9, background: '#fff', fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, cursor: 'pointer',
  },

  note: { margin: 0, fontSize: 12, color: MUTE, lineHeight: 1.6 },
  footer: { margin: '13px 0 0', fontSize: 11, color: MUTE },

  factLabel: { fontSize: 11, fontWeight: 700, color: MUTE, marginBottom: 4 },
  factValue: { fontSize: 12.5, color: INK, lineHeight: 1.55 },

  actionCard: {
    padding: '12px 14px', borderRadius: 10, marginBottom: 9, background: '#fbfcfd',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },

  rowEnd: {
    display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end',
    flexWrap: 'wrap', marginTop: 14, paddingTop: 13, borderTop: `1px solid ${LINE}`,
  },
  primary: {
    padding: '9px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
    border: 'none', borderRadius: 9, background: '#15227a', color: '#fff', cursor: 'pointer',
  },
  danger: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fecaca', background: '#fef2f2',
    color: '#b91c1c', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  removeBtn: {
    padding: '4px 10px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
    borderRadius: 7, background: '#fef2f2', color: '#b91c1c', cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fecaca',
  },
  addBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    width: '100%', padding: '9px 13px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
    borderRadius: 9, background: '#fff', color: SUB, cursor: 'pointer',
    borderStyle: 'dashed', borderWidth: 1, borderColor: LINE,
  },

  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12 },
  formGrid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 },
  formGrid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 },
  formLabel: {
    fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase',
    letterSpacing: 0.4, marginBottom: 5,
  },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '8px 11px', fontSize: 12.5,
    fontFamily: 'inherit', lineHeight: 1.5, color: INK, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, borderRadius: 9, outline: 'none',
  },

  // The scrim frames the modal rather than scrolling it.
  //
  // The root-cause form is long enough to outgrow a laptop screen, and with the
  // scrim scrolling and no cap on the modal the whole panel moved — taking its
  // heading off the top of the screen and leaving the reader in the middle of a
  // form with no way to see what it was for. Capped and scrolled internally, the
  // panel stays where it was opened.
  scrim: {
    // Above the sidebar and the sticky top bar, which used to paint over the
    // top of this panel. See Z in productKit.
    position: 'fixed', inset: 0, zIndex: Z.modal, background: 'rgba(15,23,42,.45)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '20px 16px', overflow: 'hidden',
  },
  modal: {
    background: '#fff', borderRadius: 13, padding: '20px 22px', width: '100%', maxWidth: 900,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
    boxShadow: '0 20px 50px rgba(15,23,42,.25)',
    // One panel with no separate header to pin, so the whole of it scrolls —
    // against the scrim's content box rather than a vh figure.
    maxHeight: '100%', overflowY: 'auto',
  },

  switch: {
    position: 'relative', width: 34, height: 19, borderRadius: 999, border: 'none',
    cursor: 'pointer', padding: 0, flexShrink: 0, transition: 'background .18s',
  },
  knob: {
    position: 'absolute', top: 1.5, left: 0, width: 16, height: 16, borderRadius: 999,
    background: '#fff', transition: 'transform .18s', boxShadow: '0 1px 2px rgba(15,23,42,.3)',
  },
}
