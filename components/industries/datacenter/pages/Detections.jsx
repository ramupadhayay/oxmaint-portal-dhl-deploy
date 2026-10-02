'use client'

// Screen 2.4 — what was detected, and why the system believes it.
//
// The spec's brief is "in language an engineer would trust", and its dev note
// says to keep the confidence boost visible somewhere in the UI because it is
// the detail that sells cross-sensor correlation. So the sensor agreement is
// not a footnote here — it is the middle of the screen, showing which sensors
// agreed and what that agreement was worth.
//
// One alert on its own is a claim. Three sensors agreeing about the same asset
// over the same window is an argument, and this is the screen that makes it.

import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, Section, ActionButton, StatusBadge, PALETTE } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import SourceNote from '../components/SourceNote'
import { StatCards } from '../components/MetricCard'
import { Facts } from '../components/Register'
import SensorCard from '../components/SensorCard'
import {
  MON_ALERT_ROWS, monAlertById, monAssetById, SENSORS, sensorByKey,
  baselineFor, confidenceStory,
} from '../lib/monitoring'

const { SUB, MUTE, INK, LINE, GREEN, AMBER, RED, ACCENT } = PALETTE

const sevTone = (s) => ({ Critical: 'red', Warning: 'amber', High: 'amber', Informational: 'blue' }[s] || 'grey')

// ── the list ─────────────────────────────────────────────────────────────
export default function Detections() {
  const router = useRouter()

  const stats = [
    { label: 'Detections', value: MON_ALERT_ROWS.length, note: 'across the monitored estate' },
    { label: 'Corroborated', value: MON_ALERT_ROWS.filter((a) => a._corroborated).length, tone: 'green', note: 'more than one sensor agreed' },
    { label: 'Open', value: MON_ALERT_ROWS.filter((a) => a._open).length, tone: 'amber', note: 'not yet closed out' },
    { label: 'Mean confidence', value: MON_ALERT_ROWS.length
        ? `${Math.round(MON_ALERT_ROWS.reduce((n, a) => n + (a.confidence || 0), 0) / MON_ALERT_ROWS.length)}%`
        : '—', note: 'after corroboration' },
  ]

  return (
    <div>
      <PageHeading
        title="Detections"
        subtitle="Each anomaly the analytics raised, the failure code it matched, and which sensors agreed. Open one for the evidence behind the confidence figure."
      />

      <SourceNote
        client={MON_ALERT_ROWS.filter((r) => !r._gapFill).length}
        added={MON_ALERT_ROWS.filter((r) => r._gapFill).length}
        what="detections"
        extra={`${MON_ALERT_ROWS.filter((r) => r._belowAlarm).length} fired below their alarm line`}
      />

      <StatCards items={stats} />

      <div style={styles.list}>
        {MON_ALERT_ROWS.map((a) => {
          const story = confidenceStory(a)
          return (
            <button key={a.alertId} className="dc-detect" style={styles.row}
              onClick={() => router.push(`/portal/datacenter/detections/${encodeURIComponent(a.alertId)}`)}>
              <div style={styles.rowHead}>
                <StatusBadge tone={sevTone(a.severity)}>{a.severity}</StatusBadge>
                <span style={styles.code}>{a.failureCode}</span>
                <span style={styles.rowId}>{a.alertId}</span>
                <span style={styles.rowDate}>{a.dateRaised}</span>
              </div>

              <div style={styles.rowAsset}>{a._asset}</div>
              <div style={styles.rowDesc}>{a.description}</div>

              <div style={styles.rowFoot}>
                <SensorAgreement alert={a} />
                <span style={styles.conf}>
                  <strong style={{ color: INK }}>{a.confidence}%</strong>
                  {story && <span style={{ color: MUTE }}> from {story.before}%</span>}
                </span>
                <StatusBadge>{a.status}</StatusBadge>
              </div>
            </button>
          )
        })}
      </div>

      <style>{`
        .dc-detect { transition: border-color .15s, box-shadow .15s, transform .15s; }
        .dc-detect:hover { border-color: #c3cbe6; box-shadow: 0 8px 20px rgba(15,23,42,0.08); transform: translateY(-2px); }
      `}</style>
    </div>
  )
}

/** Which of the three agreed — the spec's "confirmed by 2 of 3 sensors". */
function SensorAgreement({ alert, size = 'small' }) {
  return (
    <span style={styles.agree}>
      {SENSORS.map((s) => {
        const on = alert._sensors.includes(s.key)
        return (
          <span key={s.key} style={{
            ...styles.agreeChip,
            ...(on
              ? { color: '#047857', background: '#ecfdf5', borderColor: '#a7f3d0' }
              : { color: '#94a3b8', background: '#f8fafc', borderColor: '#e2e8f0' }),
          }}>
            {on ? '✓' : '·'} {s.label}
          </span>
        )
      })}
      <span style={styles.agreeCount}>
        {alert._agreeing} of {SENSORS.length}
      </span>
    </span>
  )
}

// ── one detection ────────────────────────────────────────────────────────
export function DetectionView() {
  const { id } = useParams()
  const router = useRouter()
  const alertId = decodeURIComponent(String(id))
  const alert = monAlertById.get(alertId)

  const back = () => router.push('/portal/datacenter/detections')

  const asset = alert ? monAssetById.get(alert.assetId) : null
  const story = alert ? confidenceStory(alert) : null

  // What each sensor read on the day the alert was raised — the evidence the
  // confidence figure is built on.
  const onTheDay = useMemo(() => {
    if (!asset || !alert) return null
    return asset._readings.find((r) => r.date === alert.dateRaised) || asset._readings[asset._readings.length - 1]
  }, [asset, alert])

  if (!alert) {
    return (
      <div>
        <PageHeading title="No detection with that reference" back={{ label: 'Detections', onClick: back }}
          subtitle={`${alertId} is not in the detection log.`} />
        <Card><div style={{ padding: '26px 6px', textAlign: 'center' }}><ActionButton onClick={back}>Back to detections</ActionButton></div></Card>
      </div>
    )
  }

  const rec = alert._recommendation

  return (
    <div>
      <PageHeading
        back={{ label: 'Detections', onClick: back }}
        title={`${alert.failureCode} — ${alert._asset}`}
        subtitle={`${alert.alertId} · raised ${alert.dateRaised}${alert._failureMode ? ` · ${alert._failureMode}` : ''}`}
        right={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ActionButton onClick={() => router.push(`/portal/datacenter/trend?asset=${encodeURIComponent(alert.assetId)}`)}>
              See the trend
            </ActionButton>
            <button onClick={() => router.push(`/portal/datacenter/monitoring/${encodeURIComponent(alert.assetId)}`)} style={styles.secondary}>
              Open asset
            </button>
          </div>
        }
      />

      <div style={styles.chips}>
        <StatusBadge tone={sevTone(alert.severity)}>{alert.severity}</StatusBadge>
        <StatusBadge>{alert.status}</StatusBadge>
        <span style={styles.codeBig}>{alert.failureCode}</span>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: INK, lineHeight: 1.6 }}>{alert.description}</div>
      </Card>

      {/* The argument, not a footnote. */}
      <Section title="Why the system believes this">
        <div style={styles.confRow}>
          <div style={styles.confBlock}>
            <div style={styles.confLabel}>Confidence</div>
            <div style={styles.confValue}>{alert.confidence}%</div>
            {story && (
              <div style={styles.confStory}>
                <span style={styles.confBefore}>{story.before}%</span>
                <span style={styles.confArrow}>→</span>
                <span style={styles.confAfter}>{story.after}%</span>
                <span style={styles.confWhy}>once {story.agreeing - 1} more sensor{story.agreeing - 1 > 1 ? 's' : ''} agreed</span>
              </div>
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={styles.confLabel}>Sensor agreement</div>
            <div style={{ marginTop: 8 }}><SensorAgreement alert={alert} /></div>
            <p style={styles.confNote}>
              A single sensor crossing a threshold is a weak signal. The other two are checked against the
              same asset over the same window — agreement raises confidence, disagreement lowers it.
            </p>
          </div>
        </div>
      </Section>

      {asset && onTheDay && (
        <Section title={`What the sensors read on ${onTheDay.date}`}>
          <div style={styles.sensorGrid}>
            {SENSORS.map((s) => (
              <SensorCard
                key={s.key}
                sensor={s}
                value={onTheDay[s.key]}
                status={onTheDay[s.statusKey]}
                baseline={baselineFor(asset.assetId, s.key)}
                series={asset._readings.map((r) => r[s.key])}
                onClick={() => router.push(`/portal/datacenter/trend?asset=${encodeURIComponent(asset.assetId)}`)}
              />
            ))}
          </div>
        </Section>
      )}

      <Section title="Detection record">
        <Facts items={[
          ['Alert ID', alert.alertId],
          ['Asset', `${alert.assetId} — ${alert._asset}`],
          ['Raised', alert.dateRaised],
          ['Failure code', alert.failureCode],
          ['Failure mode', alert._failureMode],
          ['Triggering sensors', alert.triggeringSensors],
          ['Confidence', `${alert.confidence}%`],
          ['Severity', alert.severity],
          ['Status', alert.status],
        ]} />
      </Section>

      {rec && (
        <Section title="What it led to">
          <div style={styles.rec}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: INK, lineHeight: 1.5 }}>{rec.action}</div>
            <div style={styles.recFoot}>
              <StatusBadge tone={rec.urgency === 'High' ? 'red' : 'amber'}>{rec.urgency} urgency</StatusBadge>
              <span>Work order <strong style={{ color: INK }}>{rec.workOrderId}</strong> — {rec.woStatus}</span>
              <button onClick={() => router.push('/portal/datacenter/recommendations')} style={styles.recLink}>
                Open →
              </button>
            </div>
          </div>
        </Section>
      )}
    </div>
  )
}

const styles = {
  secondary: {
    padding: '8px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 9, color: '#475569', cursor: 'pointer',
  },
  list: { display: 'grid', gap: 12 },
  row: {
    display: 'block', width: '100%', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer',
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 13, padding: '15px 17px',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
  },
  rowHead: { display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
  code: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5, fontWeight: 700, color: ACCENT, background: '#eef2ff', borderRadius: 6, padding: '2px 7px' },
  rowId: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5, color: MUTE },
  rowDate: { fontSize: 11.5, color: MUTE, marginLeft: 'auto' },
  rowAsset: { fontSize: 14.5, fontWeight: 700, color: INK, marginTop: 9 },
  rowDesc: { fontSize: 12.5, color: SUB, lineHeight: 1.55, marginTop: 4 },
  rowFoot: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 12, paddingTop: 11, borderTop: `1px solid ${LINE}` },

  agree: { display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  agreeChip: { fontSize: 10.5, fontWeight: 700, border: '1px solid', borderRadius: 999, padding: '2px 8px' },
  agreeCount: { fontSize: 11, fontWeight: 700, color: SUB, marginLeft: 3 },
  conf: { fontSize: 12.5, color: SUB },

  chips: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 },
  codeBig: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5, fontWeight: 700, color: ACCENT, background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 7, padding: '3px 9px' },

  confRow: { display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' },
  confBlock: { minWidth: 190 },
  confLabel: { fontSize: 11, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 },
  confValue: { fontSize: 40, fontWeight: 800, color: GREEN, lineHeight: 1, letterSpacing: '-0.03em', marginTop: 6, fontVariantNumeric: 'tabular-nums' },
  confStory: { display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 10 },
  confBefore: { fontSize: 13, fontWeight: 700, color: MUTE, textDecoration: 'line-through' },
  confArrow: { fontSize: 13, color: MUTE },
  confAfter: { fontSize: 13, fontWeight: 800, color: GREEN },
  confWhy: { fontSize: 11.5, color: MUTE },
  confNote: { margin: '12px 0 0', fontSize: 12, color: SUB, lineHeight: 1.55, maxWidth: 560 },

  sensorGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 },

  rec: { border: `1px solid ${LINE}`, borderRadius: 12, padding: '14px 16px', background: '#fcfdfe' },
  recFoot: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 12, fontSize: 12.5, color: SUB },
  recLink: {
    padding: '5px 11px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
    background: '#fff', border: `1px solid ${ACCENT}33`, color: ACCENT, borderRadius: 7, cursor: 'pointer',
  },
}
