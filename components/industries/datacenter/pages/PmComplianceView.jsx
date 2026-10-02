'use client'

// A completed PM, as a maintenance record rather than a log line.
//
// The generic record page showed the four workbook fields and stopped. A PM that
// ran is more than that: how far off schedule it landed and when it is due again,
// the checklist the technician actually worked, the readings taken against their
// limits, and the finding. This page assembles that from pmData — the schedule
// facts real, the visit detail modelled and labelled.

import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, Section, ActionButton, StatusBadge, PALETTE } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { pmRecordById, PM_ESTIMATE } from '../lib/pmData'

const { SUB, MUTE, INK, LINE, GREEN, AMBER, RED, ACCENT, BLUE } = PALETTE

const RESULT_TONE = { Pass: 'green', Observation: 'amber', Corrected: 'blue', Pending: 'grey' }
const statusTone = (s) => (/on time/i.test(s) ? 'green' : /late/i.test(s) ? 'amber' : /scheduled/i.test(s) ? 'blue' : 'grey')

export default function PmComplianceView() {
  const { id } = useParams()
  const router = useRouter()
  const rec = useMemo(() => pmRecordById.get(decodeURIComponent(String(id))), [id])

  const back = () => router.push('/portal/datacenter/pm-compliance')

  if (!rec) {
    return (
      <div>
        <PageHeading title="PM record not found" back={{ label: 'PM Compliance', onClick: back }}
          subtitle={`No compliance log with reference “${id}”.`} />
      </div>
    )
  }

  const v = rec.varianceDays
  const varianceLabel = v == null ? 'Not completed'
    : v <= 0 ? `${Math.abs(v)}d early` : `${v}d late`

  const stats = [
    { label: 'Status', value: rec._onTime ? 'On time' : rec._late ? 'Late' : 'Scheduled', tone: statusTone(rec.status), note: rec._done ? 'Completed' : 'Awaiting the visit' },
    { label: 'Schedule variance', value: rec._done ? varianceLabel : '—', tone: v == null ? 'grey' : v <= 0 ? 'green' : v <= 3 ? 'amber' : 'red', note: `sched ${fmt(rec.scheduledDate)}` },
    { label: 'Next due', value: fmt(rec.nextDue), note: `${rec._frequency || 'recurring'} cadence` },
    { label: 'On-site time', value: rec._durationHrs, unit: 'h', note: rec._technician },
  ]

  return (
    <div>
      <PageHeading
        title={`${rec.logId} — ${rec._taskName}`}
        back={{ label: 'PM Compliance', onClick: back }}
        subtitle={`${rec._assetName}${rec._site ? ` · ${rec._site}` : ''} · ${rec._frequency || ''} · ${rec._standard || ''}`.replace(/ · $/, '')}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusBadge tone={statusTone(rec.status)}>{rec.status}</StatusBadge>
            <ActionButton variant="ghost" onClick={() => { try { window.print() } catch { /* no-op */ } }}>Print</ActionButton>
          </div>
        }
      />

      <StatCards items={stats} />

      <div style={styles.two}>
        <Section title="Checklist worked" right={<span style={styles.note}>{rec._illustrative ? 'illustrative' : ''}</span>} style={{ marginBottom: 0 }}>
          {rec._checklist.length === 0 ? (
            <div style={styles.calm}>The visit has not run yet — the checklist is worked on completion.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {rec._checklist.map((s, i) => (
                <div key={i} style={styles.step}>
                  <span style={styles.stepNum}>{i + 1}</span>
                  <span style={{ minWidth: 0, flex: 1, fontSize: 12.5, color: INK }}>{s.step}</span>
                  <StatusBadge tone={RESULT_TONE[s.result]}>{s.result}</StatusBadge>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Readings taken" right={<span style={styles.note}>vs limit · illustrative</span>} style={{ marginBottom: 0 }}>
          {rec._readings.length === 0 ? (
            <div style={styles.calm}>No readings yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rec._readings.map((r, i) => (
                <div key={i} style={styles.reading}>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={styles.readLabel}>{r.label}</span>
                    <span style={styles.readLimit}>limit {r.limit}</span>
                  </span>
                  <span style={styles.readValue}>{r.value} <span style={styles.readUnit}>{r.unit}</span></span>
                </div>
              ))}
            </div>
          )}
          {rec._finding && (
            <div style={styles.finding}>
              <span style={styles.findLabel}>Finding</span> {rec._finding}
            </div>
          )}
        </Section>
      </div>

      <div style={styles.two}>
        <Section title="PM task" style={{ marginBottom: 0 }}>
          <Facts rows={[
            ['Task', rec._taskName],
            ['Task ID', rec.taskId],
            ['Frequency', rec._frequency],
            ['Standard', rec._standard],
            ['Discipline', rec._discipline],
            ['Team', rec.team],
          ]} />
          <button onClick={() => router.push(`/portal/datacenter/pm-tasks/${encodeURIComponent(rec.taskId)}`)} style={styles.linkBtn}>Open the PM task →</button>
        </Section>

        <Section title="Asset" style={{ marginBottom: 0 }}>
          <Facts rows={[
            ['Asset', rec._assetName],
            ['Reference', rec.assetId],
            ['Site', rec._site],
            ['Location', rec._location],
            ['Criticality', rec._criticality],
          ]} />
          {rec._asset && (
            <button onClick={() => router.push(`/portal/datacenter/assets/${encodeURIComponent(rec.assetId)}`)} style={styles.linkBtn}>Open the asset record →</button>
          )}
        </Section>
      </div>

      <p style={styles.foot}>{PM_ESTIMATE}</p>
    </div>
  )
}

function Facts({ rows }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {rows.filter(([, v]) => v != null && v !== '').map(([label, value]) => (
        <div key={label} style={styles.factRow}>
          <span style={styles.factLabel}>{label}</span>
          <span style={styles.factValue}>{value}</span>
        </div>
      ))}
    </div>
  )
}

function fmt(d) {
  if (!d) return '—'
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const dt = new Date(`${String(d).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(dt.getTime())) return String(d)
  return `${dt.getDate()} ${M[dt.getMonth()]} ${dt.getFullYear()}`
}

const styles = {
  two: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14, marginBottom: 14, alignItems: 'start' },
  note: { fontSize: 10.5, color: MUTE },
  calm: { padding: '12px 14px', borderRadius: 10, background: '#f8fafc', border: `1px solid ${LINE}`, fontSize: 12.5, color: SUB, lineHeight: 1.5 },
  step: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px', border: `1px solid ${LINE}`, borderRadius: 9, background: '#fff' },
  stepNum: { flexShrink: 0, width: 20, height: 20, borderRadius: '50%', background: '#eef2ff', color: ACCENT, fontSize: 10.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  reading: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: `1px solid ${LINE}`, borderRadius: 9, background: '#fcfdfe' },
  readLabel: { display: 'block', fontSize: 12.5, fontWeight: 700, color: INK },
  readLimit: { display: 'block', fontSize: 10.5, color: MUTE, marginTop: 1 },
  readValue: { fontSize: 15, fontWeight: 800, color: INK, fontVariantNumeric: 'tabular-nums', flexShrink: 0 },
  readUnit: { fontSize: 11, fontWeight: 600, color: MUTE },
  finding: { marginTop: 11, paddingTop: 11, borderTop: `1px solid ${LINE}`, fontSize: 12.5, color: SUB, lineHeight: 1.55 },
  findLabel: { fontWeight: 800, color: INK, marginRight: 5 },
  factRow: { display: 'grid', gridTemplateColumns: '130px 1fr', gap: 12, alignItems: 'start' },
  factLabel: { fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, paddingTop: 1 },
  factValue: { fontSize: 12.5, color: INK, lineHeight: 1.5, wordBreak: 'break-word' },
  linkBtn: { marginTop: 12, padding: '6px 11px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', background: '#fff', border: '1px solid #15227a33', color: ACCENT, borderRadius: 7, cursor: 'pointer' },
  foot: { marginTop: 4, fontSize: 11, color: MUTE, lineHeight: 1.55 },
}
