'use client'

// Screen 2.3 of the demo spec, and the one it says to build first: the proof
// that something was caught early rather than eventually.
//
// The spec's own note is the brief — "even a static rendering of the CRAH-01
// vibration trend with the threshold crossing marked is worth more than a
// polished but empty estate view". So this screen leads with the crossing and
// the days it bought, and the chart is the evidence for that sentence rather
// than the point of the page.
//
// It defaults to whichever sensor raised the most recent alert, per the spec.
// Landing on a flat thermal trace when the story is in the vibration is how a
// demo loses a room in its first ten seconds.

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Section, StatusBadge, ActionButton, PALETTE } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import TrendChart from '../components/TrendChart'
import SensorSpark from '../components/SensorSpark'
import {
  MON_ASSET_ROWS, monAssetById, SENSORS, sensorByKey, baselineFor, MON_WINDOW,
} from '../lib/monitoring'
import { nextWorkOrderNumber } from '../lib/data'
import { PRIORITY } from '../lib/riskEngine'
import { useWorkOrderStore } from '../lib/store'
import { useWorkOrders } from './WorkOrders'

const { SUB, MUTE, INK, LINE, GREEN, AMBER, RED, ACCENT, BLUE } = PALETTE

const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000)

// What the AI Auditor concludes from a trend, by which sensor is driving it —
// so a thermal ramp, a vibration climb and an ultrasonic signature each read as
// a different fault with a different fix, not one generic "anomaly". The failure
// modes and actions are the estate's own maintenance vocabulary.
const AUDIT_BY_DOMAIN = {
  thermal: {
    mode: 'Thermal fault — a developing hotspot or cooling-path degradation',
    action: 'Thermographic scan of the cooling path, clean or replace the affected component, and re-baseline.',
    inspection: 'Thermographic / IR scan',
  },
  vibration: {
    mode: 'Mechanical wear — a bearing defect or rotating-element imbalance',
    action: 'Inspect the drive-side bearing and alignment, replace if worn, and confirm balance.',
    inspection: 'Vibration analysis',
  },
  ultrasound: {
    mode: 'Electrical — partial discharge or arcing at a connection',
    action: 'De-energise where safe, inspect and torque the connection, then confirm clear with an IR survey.',
    inspection: 'Ultrasonic + IR survey',
  },
}
const AUDIT_FALLBACK = {
  mode: 'A developing fault indicated by the trend against this asset’s baseline',
  action: 'Inspect the affected component and correct the developing fault before it escalates.',
  inspection: 'Condition inspection',
}

/**
 * The AI Auditor's read of the current trend — the same evidence the screen
 * already computes (the crossing, the lead time, how far past the line, how many
 * sensors agree), turned into a verdict, a priority inherited from the asset's
 * criticality, and the action a work order would carry. A trend that never left
 * its band returns a "clear" verdict with no work order, because inventing one
 * is exactly the false positive the auditor exists to avoid.
 */
function auditTrend({ sensor, crossing, leadDays, peakOver, agreeing, sensorCount, drift, asset, last }) {
  const criticality = asset?._register?.criticality || asset?.criticality || 'Medium'
  const priority = PRIORITY[criticality] || 'P3'
  const domain = AUDIT_BY_DOMAIN[sensor.key] || AUDIT_FALLBACK

  if (!crossing) {
    return {
      state: 'clear', priority, criticality, confidence: null,
      headline: 'Within baseline — no work order needed',
      mode: `${sensor.label} is tracking inside this asset’s own band for the whole window. The AI Auditor is monitoring and will raise a job the moment it crosses.`,
      action: null, inspection: null,
      evidence: [
        { label: 'Threshold', value: 'not crossed' },
        { label: 'Drift over window', value: drift == null ? '—' : `${drift > 0 ? '+' : ''}${drift.toFixed(sensor.decimals)} ${sensor.unit}` },
      ],
    }
  }

  const corroborated = agreeing >= 2
  const escalate = corroborated || (peakOver || 0) > 0.25
  const confidence = Math.min(98, 68 + agreeing * 8 + ((peakOver || 0) > 0 ? 14 : 0) + (leadDays > 0 ? 4 : 0))

  return {
    state: escalate ? 'escalate' : 'plan',
    priority, criticality, confidence,
    headline: escalate ? `Escalate — raise a ${priority} work order now` : `Plan corrective maintenance · ${priority}`,
    mode: domain.mode,
    action: domain.action,
    inspection: domain.inspection,
    evidence: [
      leadDays > 0 ? { label: 'Caught early', value: `${leadDays} days before the alert` } : null,
      peakOver != null ? { label: 'Peak vs alarm', value: `${peakOver > 0 ? '+' : ''}${(peakOver * 100).toFixed(0)}%`, bad: peakOver > 0 } : null,
      { label: 'Sensors agreeing', value: `${agreeing} of ${sensorCount}`, bad: corroborated },
      { label: 'Latest reading', value: typeof last === 'number' ? `${last.toFixed(sensor.decimals)} ${sensor.unit}` : '—' },
    ].filter(Boolean),
  }
}

export default function Trend() {
  const router = useRouter()
  const params = useSearchParams()

  const assetParam = params?.get('asset')
  const [assetId, setAssetId] = useState(assetParam || MON_ASSET_ROWS[0]?.assetId)
  const asset = monAssetById.get(assetId) || MON_ASSET_ROWS[0]

  // The sensor that raised the latest alert, unless the reader picks another.
  const defaultSensor = useMemo(() => {
    const alert = asset?._lastAlert
    const named = alert?._sensors?.[0]
    return SENSORS.find((s) => named && s.key === named)?.key || 'vibration'
  }, [asset])

  // The sensor cards link here with ?sensor=thermal. Reading only ?asset
  // meant clicking Thermal landed on the vibration trace — a link promising
  // something it did not do.
  const sensorParam = params?.get('sensor')
  const [picked, setPicked] = useState(
    SENSORS.some((s) => s.key === sensorParam) ? sensorParam : null)
  const sensorKey = picked || defaultSensor
  const sensor = sensorByKey.get(sensorKey)

  // "Not critical for demo but expected by reviewers", says the spec. It zooms
  // the window rather than filtering the data, so the baseline and threshold
  // stay computed over the whole quiet period — narrowing the view must not
  // move the line the reading is being judged against.
  // Zero is the whole series, and that is the default. The review asked for
  // it in as many words — "the chart is too tightly zoomed on the alarm
  // crossing; zoom out so the reader sees more of the quiet baseline period
  // around it". The quiet period is the argument: a line that was flat for
  // three weeks and then was not is evidence, and a line that starts halfway up
  // its own rise is a picture of a number being high.
  const [days, setDays] = useState(0)

  const baseline = useMemo(() => baselineFor(asset.assetId, sensorKey), [asset, sensorKey])

  const full = useMemo(() => asset._readings.map((r) => ({
    date: r.date,
    value: r[sensorKey],
    status: r[sensor.statusKey],
  })), [asset, sensorKey, sensor])

  const series = useMemo(() => (days > 0 ? full.slice(-days) : full), [full, days])

  // Every sensor on this asset, over the same window and through the same
  // baseline arithmetic as the main chart. Drawing the side panel from
  // different maths than the chart beside it would be worse than not drawing
  // it — the two would disagree and the reader would have to decide which.
  const allSensors = useMemo(() => SENSORS.map((sn) => ({
    sensor: sn,
    baseline: baselineFor(asset.assetId, sn.key),
    readings: (days > 0 ? asset._readings.slice(-days) : asset._readings)
      .map((r) => ({ date: r.date, value: r[sn.key], status: r[sn.statusKey] })),
  })), [asset, days])

  const alert = asset._lastAlert
  // Found over the whole window, not the zoomed one — zooming to the last
  // seven days must not make the screen claim the crossing happened later than
  // it did.
  const crossing = useMemo(() => {
    if (!baseline) return null
    return full.find((d) => typeof d.value === 'number' && d.value > baseline.threshold) || null
  }, [full, baseline])

  // The number the screen exists for: how long the sensor was past its
  // threshold before anyone raised an alert about it.
  const leadDays = crossing && alert ? daysBetween(crossing.date, alert.dateRaised) : null

  // How far past its line the worst reading got, as a proportion. A number
  // rather than a colour, because "42% past the alarm" is a sentence somebody
  // can repeat and "red" is not.
  const peakOver = useMemo(() => {
    if (!baseline) return null
    const peak = Math.max(...full.map((d) => (typeof d.value === 'number' ? d.value : -Infinity)))
    return Number.isFinite(peak) ? (peak - baseline.threshold) / baseline.threshold : null
  }, [full, baseline])

  // How many of this asset's sensors are over their own line. One is a signal;
  // two or three agreeing is the corroboration the whole cross-sensor argument
  // rests on, so it is counted rather than left to the reader to eyeball.
  const agreeing = useMemo(() => allSensors.filter(({ baseline: bl, readings }) => {
    if (!bl) return false
    const v = readings.at(-1)?.value
    return typeof v === 'number' && v > bl.threshold
  }).length, [allSensors])

  const first = full[0]?.value
  const last = full[full.length - 1]?.value
  const drift = typeof first === 'number' && typeof last === 'number' ? last - first : null

  // ── the AI Auditor on this trend ─────────────────────────────────────────
  // The screen already has every number the auditor needs; this turns them into
  // a verdict and, on one click, the work order that closes the loop.
  const woStore = useWorkOrderStore()
  const existing = useWorkOrders()

  const audit = useMemo(() => auditTrend({
    sensor, crossing, leadDays, peakOver, agreeing, sensorCount: allSensors.length, drift, asset, last,
  }), [sensor, crossing, leadDays, peakOver, agreeing, allSensors.length, drift, asset, last])

  // idle → analyzing → done. The analyzing beat is deliberate: it makes the AI
  // step visible rather than a verdict that blinks into place.
  const [aiStage, setAiStage] = useState('idle')
  const [raising, setRaising] = useState(false)
  const [woResult, setWoResult] = useState(null)

  // A new asset or sensor is a new trend — reset the auditor so its verdict is
  // never left over from the last one.
  useEffect(() => { setAiStage('idle'); setWoResult(null); setRaising(false) }, [assetId, sensorKey])

  const runAudit = () => {
    if (aiStage === 'analyzing') return
    setAiStage('analyzing')
    setTimeout(() => setAiStage('done'), 850)
  }

  // Auto-raise the work order the verdict describes — a real record through the
  // same store the create screen writes to, priority inherited from the asset's
  // criticality, so it lands in Work Orders like any other. Guarded so a second
  // click cannot raise a duplicate.
  const raiseWorkOrder = async () => {
    if (raising || woResult || !audit.action) return
    setRaising(true)
    const number = nextWorkOrderNumber(existing)
    const lead = leadDays > 0 ? `, first crossed ${crossing.date} — ${leadDays} days before ${alert?.alertId || 'the alert'}` : ''
    const rec = await woStore.create({
      workOrderId: number,
      dateRaised: new Date().toISOString().slice(0, 10),
      assetId: asset.assetId,
      siteId: asset._register?.siteId || asset.siteId || '',
      triggerSource: 'Condition-Based · AI Auditor',
      alertId: alert?.alertId || null,
      priority: audit.priority,
      description: `${sensor.label} on ${asset.assetName} is past its alarm threshold${lead}. ${audit.mode}.`,
      action: audit.action,
      assignedTo: 'Site Engineering',
      status: 'Open',
      dateCompleted: null,
      outcome: null,
      feedback: null,
    })
    setRaising(false)
    if (rec) setWoResult({ number })
  }

  // Schedule the follow-up inspection: seed the create screen with this asset so
  // the AI Auditor hands it over pre-filled, and the operator runs the checklist.
  const scheduleInspection = () => {
    try {
      window.sessionStorage.setItem('datacenter_inspection_seed', JSON.stringify({ assetId: asset.assetId }))
    } catch { /* no seed, the screen opens blank — still reachable */ }
    router.push('/portal/datacenter/inspection-reports/new')
  }

  return (
    <div>
      <PageHeading
        title="Trend Analysis"
        subtitle={`Daily ${sensor.label.toLowerCase()} readings against this asset's own baseline and alarm threshold. ${MON_WINDOW.days} days, ${MON_WINDOW.from} to ${MON_WINDOW.to}.`}
        right={
          <ActionButton onClick={() => router.push(`/portal/datacenter/monitoring/${encodeURIComponent(asset.assetId)}`)}>
            Open asset
          </ActionButton>
        }
      />

      <div style={styles.controls}>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Asset</span>
          <select
            value={asset.assetId}
            onChange={(e) => { setAssetId(e.target.value); setPicked(null) }}
            style={styles.select}
          >
            {MON_ASSET_ROWS.map((a) => (
              <option key={a.assetId} value={a.assetId}>{a.assetId} — {a.assetName}</option>
            ))}
          </select>
        </label>

        <div style={styles.field}>
          <span style={styles.fieldLabel}>Window</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[[0, `All ${MON_WINDOW.days} days`], [14, 'Last 14'], [7, 'Last 7']].map(([n, label]) => (
              <button key={n} onClick={() => setDays(n)}
                style={{ ...styles.tab, ...(days === n ? { background: '#e8ecff', borderColor: '#15227a', color: '#15227a' } : {}) }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.field}>
          <span style={styles.fieldLabel}>Sensor</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SENSORS.map((s) => {
              const on = s.key === sensorKey
              return (
                <button key={s.key} onClick={() => setPicked(s.key)}
                  style={{ ...styles.tab, ...(on ? { background: '#e8ecff', borderColor: '#15227a', color: '#15227a' } : {}) }}>
                  {s.label}
                  {s.key === defaultSensor && !picked && <span style={styles.tabNote}>raised the alert</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* The claim, above the evidence. A reader who takes nothing else from
          this screen should take this line. */}
      {leadDays != null && leadDays > 0 ? (
        <div style={styles.lead}>
          <div style={styles.leadLabel}>Caught early</div>
          <div style={styles.leadValue}>
            {sensor.label} passed its threshold on <strong>{crossing.date}</strong> — {leadDays} days before
            alert <strong>{alert.alertId}</strong> was raised on {alert.dateRaised}.
          </div>
        </div>
      ) : crossing ? (
        <div style={styles.lead}>
          <div style={styles.leadLabel}>Threshold crossed</div>
          <div style={styles.leadValue}>
            {sensor.label} first passed its threshold on <strong>{crossing.date}</strong>.
          </div>
        </div>
      ) : (
        <div style={styles.calm}>
          {sensor.label} stayed inside this asset&rsquo;s baseline for the whole window — no threshold crossing to mark.
        </div>
      )}

      <AiAuditor
        stage={aiStage}
        audit={audit}
        asset={asset}
        sensor={sensor}
        sensorCount={allSensors.length}
        onRun={runAudit}
        onRaise={raiseWorkOrder}
        raising={raising}
        woResult={woResult}
        onSchedule={scheduleInspection}
        onViewWo={(n) => router.push(`/portal/datacenter/work-orders/${encodeURIComponent(n)}`)}
      />

      {/* Two panels rather than one full-bleed chart.

          The trace alone answers "did this cross its line". It cannot answer
          the question a reliability engineer asks straight afterwards — did
          anything else move — and on a wide screen it was spending twelve
          hundred pixels not answering it. The sensors beside it are the same
          asset, the same window and the same thresholds, so vibration climbing
          while thermal stays flat is visible without changing screens. That
          contrast is the difference between dispatching a fitter and
          dispatching a controls engineer. */}
      <style>{`
        .dc-trend { display: grid; gap: 14px; align-items: start; grid-template-columns: 1fr; }
        @media (min-width: 1120px) { .dc-trend { grid-template-columns: minmax(0, 1fr) 264px; } }
      `}</style>

      <div className="dc-trend">
      <Section
        title={`${asset.assetName} — ${sensor.label}`}
        right={<span style={styles.unit}>{sensor.unit}</span>}
        style={{ marginBottom: 0 }}
      >
        <TrendChart
          height={210}
          data={series}
          baseline={baseline}
          marker={alert && alert._sensors.includes(sensorKey) ? { date: alert.dateRaised, label: alert.alertId } : null}
          color={sensor.color}
          unit={sensor.unit}
          decimals={sensor.decimals}
        />

        <div style={styles.legend}>
          <Key swatch={<span style={{ ...styles.swatchLine, background: sensor.color }} />}>Reading</Key>
          <Key swatch={<span style={styles.swatchBand} />}>Baseline band (first 10 days, ±2σ)</Key>
          <Key swatch={<span style={styles.swatchDash} />}>Alarm threshold (+3σ)</Key>
          {crossing && <Key swatch={<span style={styles.swatchCross} />}>First crossing</Key>}
          {alert && <Key swatch={<span style={styles.swatchAlert} />}>Alert raised</Key>}
        </div>

        {/* Said out loud because it is derived, not supplied. A threshold the
            client never set, presented as if they had, is the one number on
            this screen that would not survive being asked about. */}
        <p style={styles.note}>
          No thresholds are supplied for these points, so they are derived from this asset&rsquo;s own quiet period —
          the mean of its first ten days, banded at two standard deviations and alarmed at three.
          Per-asset by construction, as the spec requires.
        </p>
      </Section>

      <Section
        title="All sensors on this asset"
        right={<span style={{ fontSize: 11, color: MUTE }}>{days > 0 ? `last ${days}` : `${MON_WINDOW.days} days`}</span>}
        style={{ marginBottom: 0 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {allSensors.map(({ sensor: sn, baseline: bl, readings }) => (
            <SensorSpark
              key={sn.key}
              sensor={sn}
              readings={readings}
              baseline={bl}
              active={sn.key === sensorKey}
              onPick={setPicked}
            />
          ))}
        </div>

        {/* Three more, about the run rather than the sensors — the questions a
            reader asks once they have accepted the line: how long was it quiet,
            how far past the line did it get, and how many of the three agreed. */}
        <div style={styles.sideFacts}>
          <SideFact
            label="Quiet before the rise"
            value={crossing ? `${full.findIndex((d) => d.date === crossing.date)} days` : `${full.length} days`}
            note={crossing ? 'inside the band, then not' : 'never left the band'}
          />
          <SideFact
            label="Peak against the line"
            value={peakOver == null ? '—' : `${peakOver > 0 ? '+' : ''}${(peakOver * 100).toFixed(0)}%`}
            note={peakOver == null ? 'no threshold' : peakOver > 0 ? 'past the alarm threshold' : 'stayed under it'}
            tone={peakOver > 0 ? RED : GREEN}
          />
          <SideFact
            label="Sensors agreeing"
            value={`${agreeing} of ${allSensors.length}`}
            note={agreeing > 1 ? 'corroborated across sensors' : agreeing === 1 ? 'one sensor only' : 'nothing over its line'}
            tone={agreeing > 1 ? RED : undefined}
          />
        </div>
        <p style={{ margin: '12px 0 0', paddingTop: 11, fontSize: 11, color: MUTE, lineHeight: 1.55, borderTopStyle: 'solid', borderTopWidth: 1, borderTopColor: LINE }}>
          One climbing while the others hold is a mechanical fault on that
          component. All three moving together is more often load or airflow.
          Pick one to bring it into the chart.
        </p>
      </Section>
      </div>

      <div style={styles.facts}>
        <Fact label="Window" value={`${MON_WINDOW.days} days`} note={`${MON_WINDOW.from} → ${MON_WINDOW.to}`} />
        <Fact label="Baseline mean" value={baseline ? `${baseline.mean.toFixed(sensor.decimals)} ${sensor.unit}` : '—'} note="first 10 days" />
        <Fact label="Latest reading" value={typeof last === 'number' ? `${last.toFixed(sensor.decimals)} ${sensor.unit}` : '—'}
          note={series[series.length - 1]?.status} />
        <Fact
          label="Drift over window"
          value={drift == null ? '—' : `${drift > 0 ? '+' : ''}${drift.toFixed(sensor.decimals)} ${sensor.unit}`}
          note={drift == null ? '' : drift > 0 ? 'rising' : 'stable or falling'}
          tone={drift != null && baseline && last > baseline.threshold ? RED : GREEN}
        />
      </div>
    </div>
  )
}

// The AI Auditor panel: a branded surface that reads the trend and, on one
// click, raises the work order it recommends. The three stages make the AI step
// visible — a button, an analyzing beat, then the verdict and the action.
function AiAuditor({ stage, audit, asset, sensor, sensorCount, onRun, onRaise, raising, woResult, onSchedule, onViewWo }) {
  const toneMap = {
    escalate: { fg: '#b91c1c', bg: '#fef2f2', line: '#fecaca', dot: RED },
    plan: { fg: '#b45309', bg: '#fffbeb', line: '#fde68a', dot: AMBER },
    clear: { fg: '#047857', bg: '#ecfdf5', line: '#a7f3d0', dot: GREEN },
  }
  const tone = toneMap[audit.state] || toneMap.plan

  return (
    <div style={styles.aiCard}>
      <div style={styles.aiHead}>
        <span style={styles.aiBadge}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10z" />
          </svg>
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={styles.aiTitle}>AI Auditor</div>
          <div style={styles.aiSub}>Reads this trend and turns it into a tracked work order.</div>
        </div>
        {stage === 'done' && audit.confidence != null && (
          <span style={styles.aiConfidence}>{audit.confidence}% confidence</span>
        )}
      </div>

      {stage === 'idle' && (
        <div style={styles.aiBody}>
          <p style={styles.aiPrompt}>
            The auditor weighs the crossing, the lead time, how far past the alarm the reading got, and how
            many sensors agree — then decides whether this trend warrants a work order, and drafts it.
          </p>
          <button onClick={onRun} style={styles.aiRun}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10z" />
            </svg>
            Run AI Auditor on this trend
          </button>
        </div>
      )}

      {stage === 'analyzing' && (
        <div style={styles.aiBody}>
          <div style={styles.aiAnalyzing}>
            <span style={styles.spinner} />
            Analyzing {MON_WINDOW.days} days across {sensorCount} sensors on {asset.assetName}…
          </div>
          <style>{`@keyframes dcspin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {stage === 'done' && (
        <div style={styles.aiBody}>
          <div style={{ ...styles.aiVerdict, background: tone.bg, borderColor: tone.line }}>
            <span style={{ ...styles.aiVerdictDot, background: tone.dot }} />
            <span style={{ ...styles.aiVerdictText, color: tone.fg }}>{audit.headline}</span>
            <span style={styles.aiPrio}>{audit.priority} · {audit.criticality}</span>
          </div>

          <p style={styles.aiMode}>{audit.mode}</p>

          <div style={styles.aiEvidence}>
            {audit.evidence.map((e) => (
              <span key={e.label} style={styles.aiChip}>
                <span style={styles.aiChipLabel}>{e.label}</span>
                <span style={{ ...styles.aiChipValue, color: e.bad ? RED : INK }}>{e.value}</span>
              </span>
            ))}
          </div>

          {audit.action ? (
            <>
              <div style={styles.aiActionNote}>
                <strong style={{ color: INK }}>Recommended action</strong> — {audit.action}
              </div>
              <div style={styles.aiActions}>
                {woResult ? (
                  <div style={styles.aiRaised}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    Work order <strong>{woResult.number}</strong> raised by the AI Auditor
                    <button onClick={() => onViewWo(woResult.number)} style={styles.aiView}>View →</button>
                  </div>
                ) : (
                  <button onClick={onRaise} disabled={raising} style={{ ...styles.aiRaise, opacity: raising ? 0.7 : 1, cursor: raising ? 'default' : 'pointer' }}>
                    {raising ? 'Raising…' : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                        Auto-raise {audit.priority} work order
                      </>
                    )}
                  </button>
                )}
                <button onClick={onSchedule} style={styles.aiSchedule}>Schedule {audit.inspection}</button>
              </div>
            </>
          ) : (
            <div style={styles.aiClear}>
              No work order needed — the AI Auditor is monitoring, and will raise a job the moment this trend crosses its line.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// A fact in the narrow column: label, value, one line of why.
function SideFact({ label, value, note, tone }) {
  return (
    <div style={styles.sideFact}>
      <div style={styles.sideFactLabel}>{label}</div>
      <div style={{ ...styles.sideFactValue, color: tone || INK }}>{value}</div>
      {note && <div style={styles.sideFactNote}>{note}</div>}
    </div>
  )
}

function Key({ swatch, children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: SUB }}>
      {swatch}{children}
    </span>
  )
}

function Fact({ label, value, note, tone }) {
  return (
    <div style={styles.fact}>
      <div style={styles.factLabel}>{label}</div>
      <div style={{ ...styles.factValue, color: tone || INK }}>{value}</div>
      {note && <div style={styles.factNote}>{note}</div>}
    </div>
  )
}

const styles = {
  sideFacts: {
    display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12, paddingTop: 12,
    borderTopStyle: 'solid', borderTopWidth: 1, borderTopColor: LINE,
  },
  sideFact: {
    padding: '9px 11px', borderRadius: 9, background: '#fcfdfe',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  sideFactLabel: {
    fontSize: 9.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase',
    letterSpacing: 0.4, marginBottom: 3,
  },
  sideFactValue: { fontSize: 15, fontWeight: 800, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' },
  sideFactNote: { fontSize: 10, color: MUTE, marginTop: 3, lineHeight: 1.4 },
  controls: {
    display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end',
    padding: '14px 16px', background: '#fff', border: `1px solid ${LINE}`,
    borderRadius: 12, marginBottom: 16,
  },
  field: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  fieldLabel: { fontSize: 11, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 },
  select: {
    padding: '8px 11px', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 600,
    border: `1px solid ${LINE}`, borderRadius: 9, background: '#fff', color: INK,
    outline: 'none', cursor: 'pointer', maxWidth: 340,
  },
  tab: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '8px 13px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 9, color: '#475569', cursor: 'pointer',
  },
  tabNote: { fontSize: 10, fontWeight: 700, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 999, padding: '1px 6px' },

  lead: { border: '1px solid #a7f3d0', background: '#ecfdf5', borderRadius: 12, padding: '13px 16px', marginBottom: 16 },
  leadLabel: { fontSize: 10.5, fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: 0.5 },
  leadValue: { fontSize: 14, color: INK, marginTop: 5, lineHeight: 1.55 },
  calm: {
    border: `1px solid ${LINE}`, background: '#fcfdfe', borderRadius: 12,
    padding: '13px 16px', marginBottom: 16, fontSize: 13, color: SUB, lineHeight: 1.5,
  },

  // The AI Auditor panel — branded in the product's indigo so it reads as the
  // intelligent surface on a screen of charts, not another data card.
  aiCard: {
    border: '1px solid #d6ddff', borderRadius: 14, marginBottom: 16, overflow: 'hidden',
    background: 'linear-gradient(180deg,#f5f7ff 0%,#ffffff 62%)',
    boxShadow: '0 1px 2px rgba(21,34,122,0.05)',
  },
  aiHead: { display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: '1px solid #eaeefb' },
  aiBadge: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#15227a,#3b3fd8)',
    boxShadow: '0 4px 10px rgba(21,34,122,0.28)',
  },
  aiTitle: { fontSize: 14.5, fontWeight: 800, color: ACCENT, letterSpacing: '-0.01em' },
  aiSub: { fontSize: 11.5, color: SUB, marginTop: 1 },
  aiConfidence: {
    flexShrink: 0, fontSize: 11, fontWeight: 800, color: ACCENT, background: '#e8ecff',
    border: '1px solid #d6ddff', borderRadius: 999, padding: '4px 10px',
  },
  aiBody: { padding: '13px 16px' },
  aiPrompt: { margin: '0 0 12px', fontSize: 12.5, color: SUB, lineHeight: 1.55, maxWidth: 760 },
  aiRun: {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px',
    fontSize: 13, fontWeight: 700, fontFamily: 'inherit', color: '#fff', cursor: 'pointer',
    background: 'linear-gradient(135deg,#15227a,#3b3fd8)', border: 'none', borderRadius: 10,
    boxShadow: '0 6px 16px rgba(21,34,122,0.24)',
  },
  aiAnalyzing: { display: 'flex', alignItems: 'center', gap: 11, fontSize: 13, fontWeight: 600, color: ACCENT, padding: '6px 0' },
  spinner: {
    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
    border: '2.5px solid #d6ddff', borderTopColor: '#15227a', animation: 'dcspin 0.7s linear infinite',
  },
  aiVerdict: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    padding: '10px 13px', borderRadius: 10, borderWidth: 1, borderStyle: 'solid',
  },
  aiVerdictDot: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  aiVerdictText: { fontSize: 13.5, fontWeight: 800, flex: 1, minWidth: 0 },
  aiPrio: {
    flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: '#fff', background: '#0f172a',
    borderRadius: 6, padding: '3px 8px', letterSpacing: '0.02em',
  },
  aiMode: { margin: '11px 0 0', fontSize: 13, color: INK, lineHeight: 1.55, fontWeight: 500 },
  aiEvidence: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 },
  aiChip: {
    display: 'inline-flex', flexDirection: 'column', gap: 2, padding: '7px 11px',
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 9, minWidth: 0,
  },
  aiChipLabel: { fontSize: 9.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 },
  aiChipValue: { fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums' },
  aiActionNote: {
    marginTop: 13, padding: '11px 13px', background: '#f8fafc', border: `1px solid ${LINE}`,
    borderRadius: 10, fontSize: 12.5, color: SUB, lineHeight: 1.55,
  },
  aiActions: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' },
  aiRaise: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 15px',
    fontSize: 13, fontWeight: 700, fontFamily: 'inherit', color: '#fff',
    background: '#15227a', border: 'none', borderRadius: 10,
    boxShadow: '0 6px 16px rgba(21,34,122,0.22)',
  },
  aiSchedule: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 15px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', color: ACCENT, cursor: 'pointer',
    background: '#fff', border: '1px solid #d6ddff', borderRadius: 10,
  },
  aiRaised: {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px',
    fontSize: 12.5, fontWeight: 600, color: '#065f46', background: '#ecfdf5',
    border: '1px solid #a7f3d0', borderRadius: 10, flexWrap: 'wrap',
  },
  aiView: {
    marginLeft: 2, padding: '3px 9px', fontSize: 11.5, fontWeight: 800, fontFamily: 'inherit',
    color: '#047857', background: '#fff', border: '1px solid #a7f3d0', borderRadius: 7, cursor: 'pointer',
  },
  aiClear: {
    marginTop: 12, padding: '11px 13px', background: '#ecfdf5', border: '1px solid #a7f3d0',
    borderRadius: 10, fontSize: 12.5, color: '#065f46', lineHeight: 1.55,
  },

  unit: { fontSize: 11.5, fontWeight: 700, color: MUTE },
  legend: { display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: `1px solid ${LINE}` },
  swatchLine: { width: 16, height: 3, borderRadius: 2 },
  swatchBand: { width: 16, height: 10, borderRadius: 2, background: 'rgba(148,163,184,0.25)' },
  swatchDash: { width: 16, height: 0, borderTop: '2px dashed #dc2626' },
  swatchCross: { width: 10, height: 10, borderRadius: '50%', border: '2.5px solid #dc2626', background: '#fff' },
  swatchAlert: { width: 10, height: 10, borderRadius: '50%', background: '#15227a' },
  note: { margin: '12px 0 0', fontSize: 11.5, color: MUTE, lineHeight: 1.55 },

  facts: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 },
  fact: { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: '13px 15px' },
  factLabel: { fontSize: 11, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 },
  factValue: { fontSize: 20, fontWeight: 800, marginTop: 5, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' },
  factNote: { fontSize: 11.5, color: MUTE, marginTop: 3 },
}
