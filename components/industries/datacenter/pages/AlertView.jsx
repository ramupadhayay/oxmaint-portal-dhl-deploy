'use client'

// One alert, and the whole chain behind it, on its own page.
//
// This is the screen the PoC is for. SOW 7.2 defines one sequence — alert
// raised, engineering review, condition validated, action determined, work
// order executed, outcome recorded, feedback into analytics — and it spans
// three sheets. Assembling it in one place is what turns a register row into
// something an engineer can read.
//
// The second half is SOW 6.1: what the *existing* systems recorded around the
// same moment. The EPMS logged a ground-fault pre-alarm three minutes before
// ALT-0003; the OEM platform raised its own thermal flag on ALT-0002. Read one
// sheet at a time that correlation is invisible. On one timeline it is the
// point of the programme.

import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, Section, ActionButton, StatusBadge, StepProgress, PALETTE } from '../lib/kit'
import { Facts } from '../components/Register'
import { alertById, evidenceFor, fmtDateTime, toneOf } from '../lib/data'

const { SUB, MUTE, INK, LINE } = PALETTE

const classificationTone = (c) => ({
  'True Positive': 'green', 'False Positive': 'red', Pending: 'amber',
}[c] || 'grey')

export default function AlertView() {
  const { id } = useParams()
  const router = useRouter()
  const alertId = decodeURIComponent(String(id))
  const alert = alertById.get(alertId)

  const evidence = useMemo(() => (alert ? evidenceFor(alertId) : []), [alert, alertId])

  const back = () => router.push('/portal/datacenter/alerts')

  if (!alert) {
    return (
      <div>
        <Back onClick={back} />
        <Card>
          <div style={{ padding: '30px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>No alert with that reference.</div>
            <div style={{ fontSize: 12.5, color: MUTE, margin: '6px 0 14px' }}>{alertId} is not in the register.</div>
            <ActionButton onClick={back}>Back to the register</ActionButton>
          </div>
        </Card>
      </div>
    )
  }

  const wo = alert._workOrder
  const cor = alert._correlation

  const steps = [
    { label: 'Alert generated', sub: `${fmtDateTime(alert.timestamp)} — ${alert.source}` },
    { label: 'Engineering review', sub: alert.reviewOutcome },
    { label: 'Condition validated', sub: cor ? cor.finding : `Validation: ${alert.validated || 'pending'}` },
    { label: 'Maintenance action determined', sub: wo ? wo.description : 'No work order raised' },
    { label: 'Work order executed', sub: wo ? `${wo.workOrderId} — ${wo.status}${wo.dateCompleted ? `, completed ${wo.dateCompleted}` : ''}` : '—' },
    { label: 'Outcome recorded', sub: wo?.outcome || '—' },
    { label: 'Feedback into analytics', sub: wo?.feedback || '—' },
  ]

  // Where the chain has actually reached, rather than a fixed "done".
  let current = 1
  if (alert.validated === 'Yes' || cor) current = 2
  if (wo) current = 4
  if (wo?.status === 'Completed') current = 6
  if (wo?.feedback) current = 7

  return (
    <div>
      <Back onClick={back} />

      <div style={styles.header}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 7 }}>
            <StatusBadge tone={toneOf(alert.severity)}>{alert.severity}</StatusBadge>
            <StatusBadge tone={classificationTone(alert.classification)}>{alert.classification}</StatusBadge>
            <StatusBadge>{alert.status}</StatusBadge>
          </div>
          <h1 style={styles.title}>{alert.alertId} — {alert._asset}</h1>
          <p style={styles.subtitle}>
            {alert.source} · {alert.failureCode}{alert._failureMode ? ` · ${alert._failureMode}` : ''} · {alert._site}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Step 4 to 5 of the response workflow, as a button. An alert with
              no work order is where the chain stops, and this is the one place
              a reader is looking at exactly that. */}
          {wo ? (
            <ActionButton onClick={() => router.push(`/portal/datacenter/work-orders/${encodeURIComponent(wo.workOrderId)}`)}>
              Open {wo.workOrderId}
            </ActionButton>
          ) : (
            <ActionButton onClick={() => router.push(`/portal/datacenter/work-orders/new?alert=${encodeURIComponent(alert.alertId)}`)}>
              Raise work order
            </ActionButton>
          )}
          <button onClick={() => window.print()} style={styles.secondary}>Print</button>
        </div>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, color: INK, lineHeight: 1.6 }}>{alert.description}</div>
      </Card>

      {cor?.leadTime && (
        <div style={styles.lead}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Detection lead time vs. traditional PM
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: INK, marginTop: 5, lineHeight: 1.45 }}>{cor.leadTime}</div>
          {cor.insight && <div style={{ fontSize: 12.5, color: SUB, marginTop: 7, lineHeight: 1.55 }}>{cor.insight}</div>}
        </div>
      )}

      <div style={styles.two}>
        <Section title="Response workflow" style={{ marginBottom: 0 }}>
          <StepProgress steps={steps} current={current} />
        </Section>

        <div>
          <Section title="Alert record">
            <Facts items={[
              ['Raised', fmtDateTime(alert.timestamp)],
              ['Asset', `${alert._asset}${alert._assetClass ? ` · ${alert._assetClass}` : ''}`],
              ['Criticality', alert._criticality],
              ['Site', alert._site],
              ['Monitoring source', alert.source],
              ['Failure code', `${alert.failureCode}${alert._failureMode ? ` — ${alert._failureMode}` : ''}`],
              ['Engineering review', alert.reviewOutcome],
              ['Condition validated', alert.validated],
              ['Classification', alert.classification],
            ]} />
          </Section>

          {wo && (
            <Section title={`Work order ${wo.workOrderId}`} style={{ marginBottom: 0 }}>
              <Facts items={[
                ['Trigger', wo.triggerSource],
                ['Raised', wo.dateRaised],
                ['Completed', wo.dateCompleted || 'Not yet'],
                ['Assigned to', wo.assignedTo],
                ['Action / finding', wo.action],
                ['Outcome', wo.outcome],
                ['Feedback to analytics', wo.feedback],
              ]} />
            </Section>
          )}
        </div>
      </div>

      <Section title={`What the systems recorded (${evidence.length})`}>
        {evidence.length ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {evidence.map((e, i) => (
              <div key={e.readingId || i} style={styles.evidence}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={styles.system}>{e._system}</span>
                  <span style={{ fontSize: 11.5, color: MUTE }}>{fmtDateTime(e._when || e.timestamp)}</span>
                  {e.status && <StatusBadge>{e.status}</StatusBadge>}
                </div>
                <div style={{ fontSize: 12.5, color: INK, marginTop: 4 }}>
                  {e._point || e.sensorType}
                  {e.value != null && <> — <strong>{e.value}</strong>{e.unit ? ` ${e.unit}` : ''}</>}
                  {e.threshold && <span style={{ color: MUTE }}> (threshold {e.threshold})</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: MUTE }}>No correlated readings recorded against this alert.</div>
        )}
      </Section>
    </div>
  )
}

function Back({ onClick }) {
  return (
    <button onClick={onClick} style={styles.crumb}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M11 18l-6-6 6-6" />
      </svg>
      Alert &amp; Anomaly Register
    </button>
  )
}

const styles = {
  crumb: {
    display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12,
    padding: '5px 10px 5px 7px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, color: '#15227a', cursor: 'pointer',
  },
  header: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap' },
  // Matched to PageHeading, which is matched to the product: a record page
  // that opens two sizes smaller than the list it came from reads as a
  // different screen rather than a deeper one.
  title: { margin: 0, fontSize: 28, fontWeight: 700, color: INK, letterSpacing: '-0.02em', lineHeight: 1.15 },
  subtitle: { margin: '6px 0 0', fontSize: 14.5, color: '#475569', lineHeight: 1.55 },
  lead: { border: '1px solid #a7f3d0', background: '#ecfdf5', borderRadius: 12, padding: '13px 15px', marginBottom: 14 },
  two: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 14, marginBottom: 14, alignItems: 'start' },
  secondary: {
    padding: '8px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 9, color: '#475569', cursor: 'pointer',
  },
  evidence: { border: `1px solid ${LINE}`, borderRadius: 10, padding: '9px 11px', background: '#fcfdfe' },
  system: { fontSize: 10.5, fontWeight: 800, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 999, padding: '2px 8px' },
}
