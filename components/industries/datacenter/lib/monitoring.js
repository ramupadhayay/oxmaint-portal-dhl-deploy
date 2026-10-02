// The Analytics & Monitoring demo, joined up.
//
// The screens spec asks for six views onto one pipeline — estate, asset, trend,
// alert, recommendation, outcome log — and is explicit that moving between them
// should be a filter change rather than a different system. So the joins and
// the derived facts live here once, and each screen takes a slice.
//
// The assets are deliberately at different points in that pipeline: some all
// the way round the loop and confirmed, some halfway with a work order still
// open, some healthy and silent, and three flagged below their alarm line by
// cross-sensor correlation alone. A demo where every asset tells the same
// success story is the one nobody believes.
//
// Two sources feed this, and they are kept apart on purpose. The client's own
// monitoring workbook carries three assets; a review found that thin against
// forty-six in scope, so a gap-fill workbook produced internally adds ten more.
// Those rows carry `_gapFill` all the way through to the screens, because a
// reader who asks whether a figure came from Digital Realty or from us has to
// be able to get an answer.

import { MON_ASSETS, MON_READINGS, MON_HEALTH, MON_ALERTS, MON_RECOMMENDATIONS } from './data/monitoring'
import { assetById, FAILURE_CODES } from './data'
import {
  GAP_MON_ASSETS, GAP_MON_READINGS, GAP_MON_HEALTH, GAP_MON_ALERTS,
  GAP_MON_RECOMMENDATIONS, GAP_THRESHOLDS, GAP_SUMMARY,
} from './gapfillJoin'

export { GAP_SUMMARY }

// One list each, client's first so their assets lead every screen that does not
// sort. Ids do not collide — the gap-fill assets are ones the client's
// monitoring workbook never covered — so this is a concatenation rather than a
// merge, and there is no precedence rule to get wrong.
const ALL_ASSETS = [...MON_ASSETS, ...GAP_MON_ASSETS]
const ALL_READINGS = [...MON_READINGS, ...GAP_MON_READINGS]
const ALL_HEALTH = [...MON_HEALTH, ...GAP_MON_HEALTH]
const ALL_ALERTS = [...MON_ALERTS, ...GAP_MON_ALERTS]
const ALL_RECOMMENDATIONS = [...MON_RECOMMENDATIONS, ...GAP_MON_RECOMMENDATIONS]

export {
  MON_ASSETS, MON_READINGS, MON_HEALTH, MON_ALERTS, MON_RECOMMENDATIONS,
  ALL_ASSETS, ALL_READINGS, ALL_HEALTH, ALL_ALERTS, ALL_RECOMMENDATIONS,
}

// ── the three sensors, described once ────────────────────────────────────
//
// Every screen that draws a sensor needs the same four facts about it, and the
// spec asks for one reusable card component parameterised by sensor type. This
// is that parameter.
export const SENSORS = [
  { key: 'vibration', label: 'Vibration', unit: 'mm/s', statusKey: 'vibrationStatus', decimals: 2, color: '#15227a' },
  { key: 'thermal', label: 'Thermal', unit: '°C', statusKey: 'thermalStatus', decimals: 1, color: '#c2410c' },
  { key: 'ultrasound', label: 'Ultrasound', unit: 'dB', statusKey: 'ultrasoundStatus', decimals: 1, color: '#0891b2' },
]

export const sensorByKey = new Map(SENSORS.map((s) => [s.key, s]))

const readingsOf = (assetId) => ALL_READINGS
  .filter((r) => r.assetId === assetId)
  .sort((a, b) => String(a.date).localeCompare(String(b.date)))

const healthOf = (assetId) => ALL_HEALTH
  .filter((h) => h.assetId === assetId)
  .sort((a, b) => String(a.date).localeCompare(String(b.date)))

/**
 * The baseline band and alarm threshold for one sensor on one asset.
 *
 * The spec is explicit that thresholds are per asset, not one fixed number for
 * all of them — a vibration reading that is unremarkable on a chiller is an
 * alarm on a CRAH. The workbook does not carry thresholds, so they are derived
 * from the asset's own quiet period: the first ten days, before any of these
 * assets started to drift.
 *
 * Derived, and labelled as derived wherever it is shown, because a threshold
 * presented as if the client supplied it would be the one number on the screen
 * that is not theirs.
 */
export function baselineFor(assetId, sensorKey) {
  const rows = readingsOf(assetId).slice(0, 10).map((r) => r[sensorKey]).filter((v) => typeof v === 'number')
  if (!rows.length) return null
  const mean = rows.reduce((n, v) => n + v, 0) / rows.length
  const sd = Math.sqrt(rows.reduce((n, v) => n + (v - mean) ** 2, 0) / rows.length) || mean * 0.05

  // A supplied threshold beats a derived one, and says so.
  //
  // The paragraph above is only true of the client's workbook: it has no
  // thresholds, so they are derived. The gap-fill sheet does carry them, and
  // deriving one on top of a number somebody actually set would be replacing a
  // fact with an estimate. Where the sheet supplies it the band stays derived —
  // that is about this asset's quiet period, which the sheet says nothing
  // about — but the alarm line is theirs.
  const supplied = GAP_THRESHOLDS.get(`${assetId}|${sensorKey}`)

  return {
    mean,
    low: mean - 2 * sd,
    high: mean + 2 * sd,
    // Two sigma is the band, three is the line. Anything past it is what the
    // trend screen marks as the crossing.
    threshold: supplied ? supplied.threshold : mean + 3 * sd,
    _derivedThreshold: !supplied,
    _unit: supplied?.unit || null,
  }
}

// ── alerts ───────────────────────────────────────────────────────────────
const failureByCode = new Map(FAILURE_CODES.map((f) => [f.code, f]))
const recByAlert = new Map(ALL_RECOMMENDATIONS.map((r) => [r.alertId, r]))

const listOf = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean)

/**
 * The column is called Confidence_Pct and holds 0.91.
 *
 * Rendered as it arrives that reads "0.91%" — a system 91% sure of a bearing
 * failure, reported to the client as one percent sure. The reference document
 * settles which was meant: "confidence rises from 82% to 91%". Anything at or
 * below 1 is therefore a fraction; anything above is already a percentage, so a
 * workbook that starts storing 91 does not silently become 9100%.
 */
const asPercent = (v) => {
  if (typeof v !== 'number') return null
  return Math.round((v <= 1 ? v * 100 : v) * 10) / 10
}

export const MON_ALERT_ROWS = ALL_ALERTS.map((a) => {
  const sensors = listOf(a.triggeringSensors).map((s) => s.toLowerCase())
  return {
    ...a,
    confidence: asPercent(a.confidence),
    // Looked up across every monitored asset, not just the client's three. The
    // gap-fill set adds ten more, and searching only MON_ASSETS meant every
    // detection on one of them printed a raw id where a name belongs.
    _asset: ALL_ASSETS.find((x) => x.assetId === a.assetId)?.assetName
      || assetById.get(a.assetId)?.assetName
      || a.assetId,
    _register: assetById.get(a.assetId) || null,
    _sensors: sensors,
    // "Confirmed by 2 of 3 sensors" — the spec calls this out twice as the
    // detail that sells cross-sensor correlation, so it is computed here rather
    // than written into a screen.
    _agreeing: sensors.length,
    _corroborated: sensors.length > 1,
    _failureMode: failureByCode.get(a.failureCode)?.mode || null,
    _recommendation: recByAlert.get(a.alertId) || null,
    _open: !/closed/i.test(a.status || ''),
  }
})

export const monAlertById = new Map(MON_ALERT_ROWS.map((a) => [a.alertId, a]))

/**
 * Confidence before corroboration.
 *
 * The spec's example is 82% rising to 91% once a second and third sensor agree.
 * The workbook stores only the final figure, so the starting point is shown as
 * what it implies rather than invented: each corroborating sensor beyond the
 * first is worth the same step.
 */
export function confidenceStory(alert) {
  if (!alert || !alert._corroborated) return null
  const step = 4.5
  const before = Math.round((alert.confidence - step * (alert._agreeing - 1)) * 10) / 10
  return { before, after: alert.confidence, agreeing: alert._agreeing, of: SENSORS.length }
}

// ── assets, as the estate view needs them ────────────────────────────────
export const MON_ASSET_ROWS = ALL_ASSETS.map((a) => {
  const health = healthOf(a.assetId)
  const readings = readingsOf(a.assetId)
  const latest = readings[readings.length - 1] || null
  const score = health.length ? health[health.length - 1].score : null

  // Trend is against the score seven days back, per the spec.
  const weekAgo = health.length > 7 ? health[health.length - 8].score : null
  const delta = score != null && weekAgo != null ? score - weekAgo : null

  const alerts = MON_ALERT_ROWS.filter((x) => x.assetId === a.assetId)
  const open = alerts.filter((x) => x._open)
  const lastAlert = alerts.sort((x, y) => String(y.dateRaised).localeCompare(String(x.dateRaised)))[0] || null

  return {
    ...a,
    _register: assetById.get(a.assetId) || null,
    _score: score,
    _delta: delta,
    _trend: delta == null ? 'stable' : delta <= -3 ? 'declining' : delta >= 3 ? 'rising' : 'stable',
    _band: score == null ? 'grey' : score >= 85 ? 'green' : score >= 60 ? 'amber' : 'red',
    _latest: latest,
    _readings: readings,
    _health: health,
    _alerts: alerts,
    _openAlert: open[0] || null,
    _lastAlert: lastAlert,
    // Status comes from the latest alert's severity rather than the score alone,
    // so a fresh low-severity alert reads differently from a critical one —
    // which is what the spec asks for and what a score on its own cannot say.
    _status: open.length
      ? (open[0].severity || 'Alert active')
      : (score == null ? 'Unknown' : score >= 85 ? 'Healthy' : score >= 60 ? 'Warning' : 'Critical'),
    _monitoring: listOf(a.monitoring),
  }
})

export const monAssetById = new Map(MON_ASSET_ROWS.map((a) => [a.assetId, a]))

// ── recommendations and the outcome log ──────────────────────────────────
/**
 * A cell that says the work has not happened yet is not a value.
 *
 * This workbook fills the waiting state in rather than leaving it empty:
 * "Pending" as an outcome, "Pending inspection" as a technician's finding.
 * Rendered as written, the second one reads as though somebody went out,
 * inspected the asset, and found a thing called "Pending inspection" — which
 * is worse than an honest blank, because a reader believes it.
 *
 * The spec is unambiguous about the intent: the finding is "only populated
 * once status = completed". So a placeholder is treated as absent and the
 * screen says what is actually true — the job is still open.
 */
const placeholder = (v) => !v || /^(pending|tbd|n\/a|none|-)\b/i.test(String(v).trim())

export const MON_REC_ROWS = ALL_RECOMMENDATIONS.map((r) => ({
  ...r,
  _asset: monAssetById.get(r.assetId)?.assetName || assetById.get(r.assetId)?.assetName || r.assetId,
  // The asset's criticality register row. The risk engine reads criticality,
  // tier and class from here, so a finding inherits the asset's criticality as
  // its work-order priority and SLA rather than trusting the recommendation's
  // own urgency label.
  _register: assetById.get(r.assetId) || null,
  _alert: monAlertById.get(r.alertId) || null,
  // Treating any non-empty outcome as closed would pull a record still under
  // review into the accuracy figures — moving a contractual KPI on evidence
  // that does not exist yet.
  _closed: !placeholder(r.outcome),
  _finding: placeholder(r.finding) ? null : r.finding,
  _truePositive: /true positive/i.test(r.outcome || ''),
  _falsePositive: /false positive/i.test(r.outcome || ''),
}))

// The work orders the recommendations point at.
//
// A finding links to a work order by id — "Inspect the bearing (WO-3004)" — but
// those orders were only ever a reference, never records, so opening one from
// the auditor landed on "no work order with that reference". This turns each
// referenced order into an actual work order carrying the finding's own context:
// the asset, the recommended action as the job, the technician's finding, and
// the outcome. Placeholder ids (an em dash) are skipped — those are findings
// with no order raised. Ids that already exist in the seeded plant are the
// caller's to de-duplicate.
export const REC_WORK_ORDERS = MON_REC_ROWS
  .filter((r) => r.workOrderId && !/^[—–\s-]+$/.test(String(r.workOrderId)))
  .map((r) => {
    const asset = assetById.get(r.assetId)
    return {
      workOrderId: r.workOrderId,
      dateRaised: r.dateIssued,
      assetId: r.assetId,
      siteId: asset?.siteId || '',
      triggerSource: r.alertId ? 'Condition-Based Alert' : 'Reactive (Operator Reported)',
      alertId: r.alertId || null,
      priority: asset?.criticality || r.urgency || 'Medium',
      description: r.action,
      action: r._finding || null,
      assignedTo: 'Site Engineering',
      status: r._closed ? 'Completed' : /dispatch/i.test(r.woStatus || '') ? 'In Progress' : 'Open',
      dateCompleted: r.dateClosed || null,
      outcome: r._closed ? r.outcome : null,
      feedback: null,
      _asset: r._asset,
      _criticality: asset?.criticality || null,
      _site: asset?._site || asset?.siteId || '',
      _location: asset?._location || null,
      _alert: r._alert || null,
      _conditionBased: Boolean(r.alertId),
      _created: false,
      _fromRecommendation: r.recId,
    }
  })

/**
 * Alert accuracy and false positive rate, against the SOW targets.
 *
 * Computed from closed records only — an alert still under review has no
 * outcome yet, and counting it either way would move a KPI on evidence that
 * does not exist. With two closed records the figures are coarse, and the
 * screen says so rather than dressing them up.
 */
export const MON_ACCURACY = (() => {
  const closed = MON_REC_ROWS.filter((r) => r._closed)
  const truePositives = closed.filter((r) => r._truePositive).length
  const falsePositives = closed.filter((r) => r._falsePositive).length
  const pct = (n) => (closed.length ? Math.round((n / closed.length) * 1000) / 10 : null)
  return {
    closed: closed.length,
    pending: MON_REC_ROWS.length - closed.length,
    truePositives,
    falsePositives,
    accuracy: pct(truePositives),
    falsePositiveRate: pct(falsePositives),
    targets: { accuracy: '~70-80%', falsePositiveRate: '~10-20%' },
  }
})()

// ── the monitoring window ────────────────────────────────────────────────
export const MON_WINDOW = (() => {
  const dates = MON_READINGS.map((r) => r.date).filter(Boolean).sort()
  return { from: dates[0] || null, to: dates[dates.length - 1] || null, days: new Set(dates).size }
})()

export const SUMMARY_MON = {
  assets: MON_ASSET_ROWS.length,
  monitored: MON_ASSET_ROWS.filter((a) => a._monitoring.length).length,
  healthy: MON_ASSET_ROWS.filter((a) => a._band === 'green').length,
  alerts: MON_ALERT_ROWS.length,
  openAlerts: MON_ALERT_ROWS.filter((a) => a._open).length,
  readings: MON_READINGS.length,
}
