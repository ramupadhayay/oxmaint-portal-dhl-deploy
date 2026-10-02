'use client'

// Raising a work order — a page, not a modal.
//
// The product this follows opens a route to create one, and the reason shows up
// as soon as the record has more than four fields: while you are typing you
// cannot see how much is still missing, so in a modal you find out by pressing
// Save. The panel on the right is therefore the point of this screen, and the
// fields are what sits between it and the heading.
//
// The asset drives most of it. Picking one fills in the site, and its
// criticality sets the priority and tells you the response SLA the estate has
// committed to for that tier — which is the number that should decide the
// priority, rather than the person's mood.

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, Section, ActionButton, StatusBadge, PALETTE } from '../lib/kit'
import { useWorkOrderStore, useRiskStore } from '../lib/store'
import { useWorkOrders } from './WorkOrders'
import {
  ASSETS_IN_SCOPE, ALERT_ROWS, assetById, criticalityByRating,
  nextWorkOrderNumber, toneOf,
} from '../lib/data'

const { SUB, MUTE, INK, LINE, RED } = PALETTE

const LIST = '/portal/datacenter/work-orders'
const TRIGGERS = ['Condition-Based Alert', 'Calendar PM', 'Reactive (Operator Reported)']
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low']
const TEAMS = [
  'Site Engineering',
  'Site Engineering + Electrical Vendor',
  'Site Engineering + Switchgear OEM',
  'Site Engineering + Battery Vendor',
  'Chiller OEM Vendor',
  'Mechanical Contractor',
]

// The priority an asset's criticality implies. Overridable — the person raising
// the job may know something the register does not — but it should not start
// blank when the estate has already graded the asset.
const PRIORITY_FOR = { Critical: 'Critical', High: 'High', Medium: 'Medium', Low: 'Low' }

const today = () => new Date().toISOString().slice(0, 10)

export default function WorkOrderCreate() {
  const router = useRouter()
  const params = useSearchParams()
  const { create, persisted } = useWorkOrderStore()
  const riskStore = useRiskStore()
  const existing = useWorkOrders()

  // Raising a job straight off an alert is the workflow the SOW describes, so
  // the alert can hand this screen its own context through the URL.
  const fromAlert = params?.get('alert') || ''
  const seedAlert = ALERT_ROWS.find((a) => a.alertId === fromAlert) || null

  // The AI Auditor's decision queue hands this screen a finding to raise: the
  // asset, the priority its criticality implies, the recommended action as the
  // description, and the finding id so the work order can be linked back to it.
  const pAsset = params?.get('asset') || ''
  const pPriority = params?.get('priority') || ''
  const pDesc = params?.get('desc') || ''
  const recId = params?.get('rec') || ''
  const fromAuditor = params?.get('source') === 'auditor'
  const seedAsset = assetById.get(seedAlert?.assetId || pAsset) || null

  const [form, setForm] = useState(() => ({
    assetId: seedAlert?.assetId || pAsset || '',
    // Condition-based with an alert; an auditor rule-finding with no alert is
    // raised reactively, so it does not require an alert to be linked.
    triggerSource: seedAlert ? 'Condition-Based Alert' : fromAuditor ? 'Reactive (Operator Reported)' : 'Calendar PM',
    alertId: seedAlert?.alertId || '',
    priority: pPriority || (seedAlert ? PRIORITY_FOR[seedAlert._criticality] : seedAsset ? PRIORITY_FOR[seedAsset.criticality] : 'Medium') || 'Medium',
    description: pDesc || (seedAlert ? `Investigate ${String(seedAlert._failureMode || 'the reported anomaly').toLowerCase()} on ${seedAlert._asset}.` : ''),
    assignedTo: 'Site Engineering',
    dateRaised: today(),
    status: 'Open',
    action: '',
    outcome: '',
    feedback: '',
  }))
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState(false)

  const set = (k) => (v) => setForm((f) => {
    const next = { ...f, [k]: v }
    // Choosing the asset settles the site and proposes a priority. Changing it
    // afterwards is allowed; it just is not the starting point.
    if (k === 'assetId') {
      const a = assetById.get(v)
      if (a) next.priority = PRIORITY_FOR[a.criticality] || f.priority
    }
    if (k === 'triggerSource' && !v.startsWith('Condition')) next.alertId = ''
    return next
  })

  const asset = form.assetId ? assetById.get(form.assetId) : null
  const sla = asset ? criticalityByRating.get(asset.criticality)?.responseSla : null

  const alertsForAsset = useMemo(
    () => ALERT_ROWS.filter((a) => !form.assetId || a.assetId === form.assetId),
    [form.assetId])

  // Required to raise anything at all. Everything else can be filled in as the
  // job progresses, which is how work orders actually get written.
  const missing = [
    !form.assetId && 'an asset',
    !form.description.trim() && 'a description',
    !form.assignedTo && 'someone to assign it to',
    form.triggerSource.startsWith('Condition') && !form.alertId && 'the alert it came from',
  ].filter(Boolean)

  const number = useMemo(() => nextWorkOrderNumber(existing), [existing])

  const save = async () => {
    setTouched(true)
    if (missing.length) return
    setSaving(true)
    const record = await create({
      workOrderId: number,
      dateRaised: form.dateRaised,
      assetId: form.assetId,
      siteId: asset?.siteId || '',
      triggerSource: form.triggerSource,
      alertId: form.alertId || null,
      priority: form.priority,
      description: form.description.trim(),
      action: form.action.trim() || null,
      assignedTo: form.assignedTo,
      status: form.status,
      dateCompleted: null,
      outcome: form.outcome.trim() || null,
      feedback: form.feedback.trim() || null,
    })
    // Raised from the auditor's queue: link this work order back to the finding
    // so the risk is no longer an orphan and the close-loop rate reflects it.
    if (record && recId) {
      const patch = { workOrderId: number, source: 'auditor', resolution_status: 'wo_linked' }
      const overlay = riskStore.created.find((r) => r.recId === recId)
      if (overlay) await riskStore.update(overlay.recordId, patch)
      else await riskStore.create({ recordId: recId, recId, ...patch })
    }
    setSaving(false)
    // Land on the record, not back on the list — the thing you just made is
    // what you want to look at, and it proves the save.
    if (record) router.push(`${LIST}/${encodeURIComponent(number)}`)
  }

  return (
    <div>
      <button onClick={() => router.push(LIST)} style={styles.crumb}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M11 18l-6-6 6-6" />
        </svg>
        Work Orders
      </button>

      <div style={styles.head}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={styles.title}>New work order</h1>
          <p style={styles.sub}>
            Will be raised as <strong style={{ color: INK }}>{number}</strong>
            {seedAlert && <> from alert <strong style={{ color: INK }}>{seedAlert.alertId}</strong></>}
            {!seedAlert && recId && <> for auditor finding <strong style={{ color: INK }}>{recId}</strong></>}
          </p>
        </div>
      </div>

      {persisted === false && (
        <div style={styles.warn}>
          No database is configured, so this will not be kept after a refresh.
        </div>
      )}

      <div style={styles.layout}>
        <div style={{ minWidth: 0 }}>
          <Section title="What and where">
            <Field label="Asset" required>
              <select value={form.assetId} onChange={(e) => set('assetId')(e.target.value)} style={styles.input}>
                <option value="">Select an asset…</option>
                {ASSETS_IN_SCOPE.map((a) => (
                  <option key={a.assetId} value={a.assetId}>{a.assetId} — {a.assetName}</option>
                ))}
              </select>
            </Field>

            {asset && (
              <div style={styles.assetCard}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <StatusBadge tone={toneOf(asset.criticality)}>{asset.criticality}</StatusBadge>
                  <span style={{ fontSize: 12, color: SUB }}>{asset._tier}</span>
                </div>
                <div style={{ fontSize: 12.5, color: INK, marginTop: 6 }}>
                  {asset._site} · {asset._location}
                </div>
                {sla && <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>Response SLA: {sla}</div>}
              </div>
            )}

            <Field label="Description" required>
              <textarea value={form.description} onChange={(e) => set('description')(e.target.value)} rows={3}
                placeholder="What needs doing, and why."
                style={{ ...styles.input, resize: 'vertical', lineHeight: 1.5 }} />
            </Field>
          </Section>

          <Section title="Why it was raised">
            <Field label="Trigger source" required>
              <select value={form.triggerSource} onChange={(e) => set('triggerSource')(e.target.value)} style={styles.input}>
                {TRIGGERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>

            {form.triggerSource.startsWith('Condition') && (
              <Field label="Linked alert" required>
                <select value={form.alertId} onChange={(e) => set('alertId')(e.target.value)} style={styles.input}>
                  <option value="">Select the alert…</option>
                  {alertsForAsset.map((a) => (
                    <option key={a.alertId} value={a.alertId}>{a.alertId} — {a.severity} — {a._failureMode || a.failureCode}</option>
                  ))}
                </select>
                {form.assetId && !alertsForAsset.length && (
                  <p style={styles.hint}>No alerts have been raised against this asset. Choose another trigger source.</p>
                )}
              </Field>
            )}

            <Field label="Priority">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {PRIORITIES.map((p) => (
                  <button key={p} type="button" onClick={() => set('priority')(p)}
                    style={{ ...styles.choice, ...(form.priority === p ? styles.choiceOn : {}) }}>
                    {p}
                  </button>
                ))}
              </div>
              {asset && <p style={styles.hint}>Proposed from the asset&rsquo;s criticality. Change it if the job warrants.</p>}
            </Field>
          </Section>

          <Section title="Who and when">
            <Field label="Assign to" required>
              <select value={form.assignedTo} onChange={(e) => set('assignedTo')(e.target.value)} style={styles.input}>
                {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Date raised">
              <input type="date" value={form.dateRaised} onChange={(e) => set('dateRaised')(e.target.value)} style={styles.input} />
            </Field>
          </Section>

          <Section title="Findings" style={{ marginBottom: 0 }}>
            <p style={styles.note}>
              Filled in as the job runs. The feedback line is the last step of the response workflow — what this job teaches the analytics.
            </p>
            <Field label="Action / finding">
              <textarea value={form.action} onChange={(e) => set('action')(e.target.value)} rows={2} style={{ ...styles.input, resize: 'vertical' }} />
            </Field>
            <Field label="Outcome">
              <textarea value={form.outcome} onChange={(e) => set('outcome')(e.target.value)} rows={2} style={{ ...styles.input, resize: 'vertical' }} />
            </Field>
            <Field label="Feedback to analytics">
              <textarea value={form.feedback} onChange={(e) => set('feedback')(e.target.value)} rows={2} style={{ ...styles.input, resize: 'vertical' }} />
            </Field>
          </Section>
        </div>

        {/* Sticky, because its job is to be readable while you are typing at the
            other end of a long form. */}
        <div style={styles.side}>
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Before it can be raised
            </div>
            {missing.length ? (
              <ul style={{ margin: '9px 0 0', paddingLeft: 17, display: 'grid', gap: 5 }}>
                {missing.map((m) => (
                  <li key={m} style={{ fontSize: 12.5, color: touched ? RED : SUB, lineHeight: 1.45 }}>Needs {m}</li>
                ))}
              </ul>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9, fontSize: 12.5, color: '#047857', fontWeight: 600 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Ready to raise
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <ActionButton onClick={save} disabled={saving || missing.length > 0}>
                {saving ? 'Raising…' : 'Raise work order'}
              </ActionButton>
              <button onClick={() => router.push(LIST)} style={styles.cancel}>Cancel</button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={styles.label}>
        {label}
        {required && <span style={{ color: RED, marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

const styles = {
  crumb: {
    display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12,
    padding: '5px 10px 5px 7px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, color: '#15227a', cursor: 'pointer',
  },
  head: { display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  // Matched to PageHeading, which is matched to the product: a record page
  // that opens two sizes smaller than the list it came from reads as a
  // different screen rather than a deeper one.
  title: { margin: 0, fontSize: 28, fontWeight: 700, color: INK, letterSpacing: '-0.02em', lineHeight: 1.15 },
  sub: { margin: '6px 0 0', fontSize: 14.5, color: '#475569', lineHeight: 1.55 },
  warn: {
    marginBottom: 14, padding: '10px 14px', borderRadius: 10,
    background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: 12.5,
  },
  layout: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 16, alignItems: 'start' },
  side: { position: 'sticky', top: 74 },
  label: { display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 5 },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
    fontFamily: 'inherit', color: INK, background: '#fff',
    border: `1px solid ${LINE}`, borderRadius: 9, outline: 'none',
  },
  hint: { margin: '5px 0 0', fontSize: 11.5, color: MUTE, lineHeight: 1.45 },
  note: { margin: '0 0 12px', fontSize: 12, color: MUTE, lineHeight: 1.5 },
  assetCard: { border: `1px solid ${LINE}`, borderRadius: 10, padding: '10px 12px', background: '#fcfdfe', marginBottom: 13 },
  choice: {
    padding: '6px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, color: '#475569', cursor: 'pointer',
  },
  choiceOn: { background: '#e8ecff', borderColor: '#15227a', color: '#15227a' },
  cancel: {
    padding: '8px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 9, color: '#475569', cursor: 'pointer',
  },
}
