'use client'

// One work order, on its own page.
//
// Its own component rather than the generic record page because it has to read
// the store as well as the workbook — a job raised in the portal has to open
// like any other — and because it carries the two things the generic page
// cannot: a PDF worth filing, and the alert that raised it shown in full rather
// than as a reference.

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, Section, ActionButton, StatusBadge, Priority, Modal, PALETTE } from '../lib/kit'
import { Facts } from '../components/Register'
import { useWorkOrders } from './WorkOrders'
import { useWorkOrderStore } from '../lib/store'
import { workOrderPdf } from '../lib/workOrderPdf'
import WorkOrderExecution from './WorkOrderExecution'
import { ORG, assetById, alertById, fmtDate, fmtDateTime, toneOf } from '../lib/data'
import { monAlertById } from '../lib/monitoring'

const { SUB, MUTE, INK, LINE, ACCENT } = PALETTE

// The lifecycle a work order moves through, and the badge colour each state
// wears. Mirrors the product's own status flow (Open → In Progress → Completed →
// Closed, with Hold and Cancel off to the side) so a job worked here reads the
// same as one worked in Oxmaint proper.
const STATUS_TONE = { Open: 'amber', Assigned: 'blue', 'In Progress': 'blue', 'On Hold': 'grey', Completed: 'green', Closed: 'grey', Cancelled: 'red' }
const TODAY = () => new Date().toISOString().slice(0, 10)

// The EAM field this work order maps to in the two systems of record a data
// centre is most likely to run. Field names are the standard object attributes —
// IBM Maximo's WORKORDER object, and SAP PM's maintenance order (IW3x /
// BAPI_ALM_ORDER) — so the same record posts to whichever system the site runs,
// without reshaping. This is the point of a visual, standard work-order format:
// the format is the integration contract, not a per-system rebuild.
const PRIORITY_NUM = { Critical: '1', High: '2', Medium: '3', Low: '4' }
function worktypeOf(wo) {
  const t = String(wo.triggerSource || '').toLowerCase()
  if (/condition|auditor|compute|predict/.test(t)) return { code: 'PM03', label: 'Condition-based / Predictive' }
  if (/calendar|preventive|\bpm\b/.test(t)) return { code: 'PM02', label: 'Preventive' }
  return { code: 'PM01', label: 'Corrective / Breakdown' }
}
function sorRows(wo, asset, alert) {
  const wt = worktypeOf(wo)
  // The failure/problem code is the job's actual one — carried on the alert that
  // raised it, not the asset class's first catalogued mode. No alert (a calendar
  // or reactive job) means no coded failure yet.
  const failure = alert?.failureCode
    ? `${alert.failureCode}${alert._failureMode ? ` · ${alert._failureMode}` : ''}`
    : '—'
  return [
    ['Work order no.', 'WONUM', 'AUFNR', wo.workOrderId],
    ['Description', 'DESCRIPTION', 'KTEXT', String(wo.description || '').length > 54 ? `${String(wo.description).slice(0, 54)}…` : (wo.description || '—')],
    ['Asset / equipment', 'ASSETNUM', 'EQUNR', wo.assetId || '—'],
    ['Functional location', 'LOCATION', 'TPLNR', asset?._location || wo._site || '—'],
    ['Site / plant', 'SITEID', 'IWERK', wo.siteId || wo._site || '—'],
    ['Work type / order type', 'WORKTYPE', `AUART · ${wt.code}`, wt.label],
    ['Priority', 'WOPRIORITY', 'PRIOK', `${wo.priority}${PRIORITY_NUM[wo.priority] ? ` (${PRIORITY_NUM[wo.priority]})` : ''}`],
    ['Status', 'STATUS', 'STAT', wo.status],
    // The damage/problem code lives on SAP's PM notification (FECOD), the
    // counterpart to Maximo's WORKORDER.FAILURECODE — not on the order header.
    ['Failure / problem code', 'FAILURECODE', 'FECOD · notification', failure],
    ['Reported date', 'REPORTDATE', 'ERDAT', fmtDate(wo.dateRaised)],
    ['Assigned crew / work centre', 'OWNERGROUP', 'GEWRK', wo.assignedTo || '—'],
    ['Completed date', 'ACTFINISH', 'GETRI', wo.dateCompleted ? fmtDate(wo.dateCompleted) : 'Open'],
  ]
}

export default function WorkOrderView() {
  const { id } = useParams()
  const router = useRouter()
  const workOrderId = decodeURIComponent(String(id))
  const all = useWorkOrders()
  const { ready, update, remove, notify } = useWorkOrderStore()
  const [exporting, setExporting] = useState(false)
  const [editing, setEditing] = useState(false)

  // The status actions apply optimistically: the badge and dates move the moment
  // the button is pressed, and — for a job raised in this portal — the change is
  // persisted through the store so it survives a reload. A seeded job (sample
  // data, not a real record) updates on screen only; there is nothing behind it
  // to write to, and inventing one would be a lie about the demo data.
  const [patch, setPatch] = useState(null)
  const [executing, setExecuting] = useState(false)
  const [seen, setSeen] = useState(workOrderId)
  if (seen !== workOrderId) { setSeen(workOrderId); setPatch(null); setExecuting(false) }

  const wo = useMemo(() => all.find((w) => w.workOrderId === workOrderId) || null, [all, workOrderId])

  const back = () => router.push('/portal/datacenter/work-orders')

  // Records raised in the portal arrive from a fetch, so on the first render
  // they are simply not here yet. Saying "no work order with that reference"
  // in that moment is a lie the page corrects a beat later — and the first
  // thing anyone following a shared link would read. Until the store has
  // answered, the honest state is "still looking".
  if (!wo && !ready) {
    return (
      <div>
        <Back onClick={back} />
        <Card>
          <div style={{ padding: '34px 6px', textAlign: 'center', fontSize: 12.5, color: MUTE }}>
            Loading {workOrderId}…
          </div>
        </Card>
      </div>
    )
  }

  if (!wo) {
    return (
      <div>
        <Back onClick={back} />
        <Card>
          <div style={{ padding: '30px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>No work order with that reference.</div>
            <div style={{ fontSize: 12.5, color: MUTE, margin: '6px 0 14px' }}>{workOrderId} is not in the register.</div>
            <ActionButton onClick={back}>Back to work orders</ActionButton>
          </div>
        </Card>
      </div>
    )
  }

  const asset = wo.assetId ? assetById.get(wo.assetId) : null
  const alert = wo.alertId ? alertById.get(wo.alertId) : null
  // A job may link to either alert family — the SOW register (alertById) or the
  // monitoring feed (monAlertById). Resolve whichever answers, for the failure
  // code in the mapping and for the PDF.
  const detection = wo.alertId ? monAlertById.get(wo.alertId) || null : null
  const linkedAlert = alert || detection

  // The job sheet gets the alert in full, and a confidence figure where one
  // exists. The two alert families in this portal are kept apart everywhere
  // else — the SOW register carries an engineering review, the monitoring feed
  // carries a model confidence — so the sheet asks both and prints whichever
  // answers rather than leaving a "-" that reads as a lost number.
  const jobSheet = async () => {
    setExporting(true)
    try {
      await workOrderPdf(w, { org: ORG, alert: linkedAlert, asset })
    } finally {
      setExporting(false)
    }
  }

  // The work order as it reads right now — the record plus any status change made
  // on this screen and not yet reflected back from the store.
  const w = patch ? { ...wo, ...patch } : wo
  const S = w.status

  // Move the job to a new state, stamping the dates the product stamps: an actual
  // start when work begins, an actual finish when it completes, and clearing the
  // finish if a completed job is reopened.
  const applyStatus = async (next, label, extra = {}) => {
    const p = { status: next, ...extra }
    if (next === 'In Progress') {
      if (S === 'Completed') p.dateCompleted = null
      else if (!w.dateStarted && !p.dateStarted) p.dateStarted = TODAY()
    }
    if (next === 'Completed') p.dateCompleted = TODAY()
    setPatch((prev) => ({ ...(prev || {}), ...p }))
    if (wo._created) await update(wo.workOrderId, p)
    else notify(`${wo.workOrderId} — ${label || next}.`)
  }
  const cancelWo = () => {
    if (typeof window !== 'undefined' && window.confirm(`Cancel ${wo.workOrderId}? It will be marked Cancelled.`)) {
      applyStatus('Cancelled', 'cancelled')
    }
  }
  const copyLink = () => {
    try { navigator.clipboard.writeText(window.location.href); notify('Link copied to clipboard.') }
    catch { notify('Could not copy the link.', 'error') }
  }

  // Only a work order raised in this portal is a real record that can be edited
  // or deleted; a seeded or recommendation-linked one is sample data with nothing
  // behind it to change.
  const isCreated = Boolean(wo._created)
  const deleteWo = async () => {
    if (!isCreated) return
    if (typeof window !== 'undefined' && !window.confirm(`Delete ${wo.workOrderId || 'this work order'}? This removes the record raised in the portal and cannot be undone.`)) return
    const ok = await remove(wo.recordId)
    if (ok) back()
  }
  const saveEdit = async (fields) => {
    setPatch((prev) => ({ ...(prev || {}), ...fields }))
    if (isCreated) await update(wo.workOrderId, fields)
    setEditing(false)
    notify(`${wo.workOrderId} updated.`)
  }

  // The primary action for the current state, plus the secondary moves the
  // product offers alongside it.
  const primary =
    (S === 'Open' || S === 'Assigned') ? { label: 'Start work', to: 'In Progress', variant: 'success', exec: true }
      : S === 'In Progress' ? { label: 'Complete', to: 'Completed', variant: 'success' }
        : S === 'On Hold' ? { label: 'Resume', to: 'In Progress', variant: 'success', exec: true }
          : S === 'Completed' ? { label: 'Reopen', to: 'In Progress', variant: 'ghost' }
            : null
  const canHold = S === 'In Progress'
  const canClose = S === 'Completed'
  const canCancel = S !== 'Completed' && S !== 'Closed' && S !== 'Cancelled'

  const runPrimary = async () => {
    await applyStatus(primary.to, primary.label)
    if (primary.exec) setExecuting(true)
  }

  // Start Work opens the execution screen — a live timer, the task list worked
  // one item at a time, and time logging — the way the product does, rather than
  // just flipping a status. In Progress jobs can re-enter it to keep working.
  if (executing) {
    return (
      <WorkOrderExecution
        wo={w}
        asset={asset}
        onBack={() => setExecuting(false)}
        applyStatus={applyStatus}
        notify={notify}
      />
    )
  }

  return (
    <div>
      <Back onClick={back} />

      <div style={styles.head}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 7 }}>
            <StatusBadge tone={STATUS_TONE[w.status]}>{w.status}</StatusBadge>
            <Priority value={w.priority} />
            <StatusBadge tone={wo._conditionBased ? 'blue' : 'grey'}>{wo.triggerSource}</StatusBadge>
            {wo._created && <StatusBadge tone="violet">Raised in this portal</StatusBadge>}
          </div>
          <h1 style={styles.title}>{wo.workOrderId} — {wo._asset}</h1>
          <p style={styles.sub}>{wo._site} · raised {fmtDate(wo.dateRaised)}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 560 }}>
          {primary && (
            <ActionButton variant={primary.variant} onClick={runPrimary}>
              {primary.label}
            </ActionButton>
          )}
          {S === 'In Progress' && <ActionButton variant="ghost" onClick={() => setExecuting(true)}>Open execution</ActionButton>}
          {canHold && <ActionButton variant="ghost" onClick={() => applyStatus('On Hold', 'put on hold')}>Put on hold</ActionButton>}
          {canClose && <ActionButton variant="ghost" onClick={() => applyStatus('Closed', 'closed')}>Close</ActionButton>}
          {canCancel && <ActionButton variant="ghost" onClick={cancelWo}>Cancel</ActionButton>}
          <ActionButton variant="ghost" onClick={copyLink}>Share</ActionButton>
          {isCreated && <ActionButton variant="ghost" onClick={() => setEditing(true)}>Edit</ActionButton>}
          {isCreated && <ActionButton variant="danger" onClick={deleteWo}>Delete</ActionButton>}
          <ActionButton variant="ghost" onClick={jobSheet} disabled={exporting}>
            {exporting ? 'Building…' : 'Job sheet (PDF)'}
          </ActionButton>
        </div>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, color: INK, lineHeight: 1.6 }}>{wo.description}</div>
      </Card>

      <div style={styles.two}>
        <Section title="Work order" style={{ marginBottom: 0 }}>
          <Facts items={[
            ['Raised', fmtDate(wo.dateRaised)],
            ['Started', w.dateStarted ? fmtDate(w.dateStarted) : (S === 'Completed' || S === 'Closed' ? '—' : 'Not started')],
            ['Completed', w.dateCompleted ? fmtDate(w.dateCompleted) : 'Not yet'],
            ['Priority', <Priority key="p" value={w.priority} />],
            ['Status', <StatusBadge key="s" tone={STATUS_TONE[w.status]}>{w.status}</StatusBadge>],
            ['Assigned to', wo.assignedTo],
            ['Trigger source', wo.triggerSource],
            ['Linked alert', wo.alertId],
          ]} />
        </Section>

        {asset && (
          <Section title="Asset" style={{ marginBottom: 0 }}>
            <Facts items={[
              ['Asset', `${asset.assetId} — ${asset.assetName}`],
              ['Class', asset.assetClass],
              ['Site', asset._site],
              ['Location', asset._location],
              ['Criticality', <span key="c"><StatusBadge tone={toneOf(asset.criticality)}>{asset.criticality}</StatusBadge> {asset._tier}</span>],
              ['Response SLA', asset._sla],
              ['Manufacturer', asset.manufacturer],
            ]} />
            <div style={{ marginTop: 12 }}>
              <button onClick={() => router.push(`/portal/datacenter/assets/${asset.assetId}`)} style={styles.linkBtn}>
                Open the asset record →
              </button>
            </div>
          </Section>
        )}
      </div>

      <Section title="System of record — integration mapping" right={<span style={styles.eam}>EAM-standard</span>}>
        <p style={styles.sorIntro}>
          A standard, visual work-order format is the integration contract: this record’s fields map straight onto IBM Maximo and SAP PM, so it posts to whichever system of record the site runs — no per-system rebuild.
        </p>
        <div style={styles.sorTableWrap}>
          <table style={styles.sorTable}>
            <thead>
              <tr>
                <th style={styles.th}>This work order</th>
                <th style={styles.th}>IBM Maximo</th>
                <th style={styles.th}>SAP PM</th>
                <th style={styles.th}>Value</th>
              </tr>
            </thead>
            <tbody>
              {sorRows(w, asset, linkedAlert).map(([field, maximo, sap, value]) => (
                <tr key={field}>
                  <td style={styles.tdField}>{field}</td>
                  <td style={styles.tdCode}>{maximo}</td>
                  <td style={styles.tdCode}>{sap}</td>
                  <td style={styles.tdVal}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={styles.sorNote}>Field names are the object attributes of Maximo’s WORKORDER and SAP PM’s maintenance order (IW3x / BAPI_ALM_ORDER); the failure code sits on the linked SAP PM notification (FECOD).</p>
      </Section>

      {alert && (
        <Section title="The alert that raised it">
          <div style={styles.alertCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <StatusBadge tone={toneOf(alert.severity)}>{alert.severity}</StatusBadge>
              <span style={styles.mono}>{alert.alertId}</span>
              <span style={{ fontSize: 11.5, color: MUTE }}>{alert.source} · {fmtDateTime(alert.timestamp)}</span>
            </div>
            <div style={{ fontSize: 12.5, color: INK, lineHeight: 1.55 }}>{alert.description}</div>
            <div style={{ fontSize: 12, color: SUB, marginTop: 7, lineHeight: 1.5 }}>{alert.reviewOutcome}</div>
            <button onClick={() => router.push(`/portal/datacenter/alerts/${alert.alertId}`)} style={{ ...styles.linkBtn, marginTop: 10 }}>
              Open the full response chain →
            </button>
          </div>
        </Section>
      )}

      {(wo.action || wo.outcome || wo.feedback) ? (
        <Section title="Findings and outcome">
          <Facts items={[
            ['Action / finding', wo.action],
            ['Outcome', wo.outcome],
            ['Feedback to analytics', wo.feedback],
          ]} />
        </Section>
      ) : (
        <Section title="Findings and outcome">
          <div style={{ fontSize: 12.5, color: MUTE, lineHeight: 1.55 }}>
            Nothing recorded yet. The feedback line is the last step of the response workflow — what this job teaches the analytics — and is filled in when the work completes.
          </div>
        </Section>
      )}

      <EditModal open={editing} wo={w} onClose={() => setEditing(false)} onSave={saveEdit} />
    </div>
  )
}

/** Edit the fields of a work order raised in this portal. */
function EditModal({ open, wo, onClose, onSave }) {
  const [priority, setPriority] = useState(wo.priority || 'Medium')
  const [assignedTo, setAssignedTo] = useState(wo.assignedTo || '')
  const [description, setDescription] = useState(wo.description || '')

  const [seen, setSeen] = useState(open)
  if (open !== seen) {
    setSeen(open)
    if (open) { setPriority(wo.priority || 'Medium'); setAssignedTo(wo.assignedTo || ''); setDescription(wo.description || '') }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit work order" subtitle={wo.workOrderId} width={560}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
          <ActionButton variant="primary" onClick={() => onSave({ priority, assignedTo: assignedTo.trim(), description: description.trim() })}>
            Save changes
          </ActionButton>
        </div>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label style={editStyles.field}>
          <span style={editStyles.label}>Priority</span>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} style={editStyles.input}>
            {['Critical', 'High', 'Medium', 'Low', 'P1', 'P2', 'P3'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label style={editStyles.field}>
          <span style={editStyles.label}>Assigned to</span>
          <input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="Crew or person" style={editStyles.input} />
        </label>
        <label style={editStyles.field}>
          <span style={editStyles.label}>Description</span>
          <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What the work is." style={{ ...editStyles.input, resize: 'vertical' }} />
        </label>
      </div>
    </Modal>
  )
}

const editStyles = {
  field: { display: 'block' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
    fontFamily: 'inherit', color: '#0f172a', background: '#fff', borderRadius: 9, outline: 'none',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0',
  },
}

function Back({ onClick }) {
  return (
    <button onClick={onClick} style={styles.crumb}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M11 18l-6-6 6-6" />
      </svg>
      Work Orders
    </button>
  )
}

const styles = {
  crumb: {
    display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12,
    padding: '5px 10px 5px 7px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, color: '#15227a', cursor: 'pointer',
  },
  head: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap' },
  // Matched to PageHeading, which is matched to the product: a record page
  // that opens two sizes smaller than the list it came from reads as a
  // different screen rather than a deeper one.
  title: { margin: 0, fontSize: 28, fontWeight: 700, color: INK, letterSpacing: '-0.02em', lineHeight: 1.15 },
  sub: { margin: '6px 0 0', fontSize: 14.5, color: '#475569', lineHeight: 1.55 },
  two: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14, marginBottom: 14, alignItems: 'start' },
  alertCard: { border: `1px solid ${LINE}`, borderRadius: 11, padding: '12px 14px', background: '#fcfdfe' },
  mono: { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 11.5, color: SUB },
  linkBtn: {
    padding: '5px 11px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
    background: '#fff', border: '1px solid #15227a33', color: '#15227a', borderRadius: 7, cursor: 'pointer',
  },
  eam: { fontSize: 10.5, fontWeight: 800, color: ACCENT, background: '#eef2ff', border: '1px solid #d6ddff', borderRadius: 999, padding: '3px 10px', letterSpacing: '0.03em' },
  sorIntro: { margin: '0 0 12px', fontSize: 12.5, color: SUB, lineHeight: 1.6, maxWidth: 760 },
  sorTableWrap: { overflowX: 'auto', border: `1px solid ${LINE}`, borderRadius: 10 },
  sorTable: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
  th: { textAlign: 'left', padding: '9px 12px', fontSize: 10, fontWeight: 800, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, background: '#f8fafc', borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' },
  tdField: { padding: '9px 12px', fontWeight: 600, color: INK, borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' },
  tdCode: { padding: '9px 12px', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 11.5, color: ACCENT, borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' },
  tdVal: { padding: '9px 12px', color: SUB, borderBottom: `1px solid ${LINE}` },
  sorNote: { margin: '10px 0 0', fontSize: 11, color: MUTE, lineHeight: 1.55 },
}
