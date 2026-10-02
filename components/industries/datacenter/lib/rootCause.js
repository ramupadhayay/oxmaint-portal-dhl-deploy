'use client'

// Why the AI Auditor flagged a risk — the root cause behind a finding.
//
// A finding on its own says a fault exists; it does not say how the platform
// knew. A reviewer's first question is exactly that: was this the IoT layer
// predicting a failure, a walk-by inspection, or a preventive-maintenance cycle
// that slipped — and which of the three condition sensors moved, by how far.
// This assembles that answer from the data the finding already carries: the
// detection alert (its triggering sensors and confidence), the asset's own
// sensor readings against its own thresholds, its criticality, and its PM
// history. Nothing here is invented — the sensor ranges are the same readings
// the Trend screen draws, and the PM context is the same log the Reports use.

import { SENSORS, baselineFor } from './monitoring'
import { PM_LOG } from './reportsData'

// The three sensors read against this asset's own thresholds — the "range
// details" a reviewer asks for: which sensor moved and how far past its line.
function sensorEvidence(asset, alertSensors) {
  if (!asset?._readings?.length) return []
  const latest = asset._readings[asset._readings.length - 1]
  const namedSet = new Set(String(alertSensors || '').toLowerCase().split(/[,\s]+/).filter(Boolean))
  return SENSORS.map((s) => {
    const bl = baselineFor(asset.assetId, s.key)
    const reading = typeof latest?.[s.key] === 'number' ? latest[s.key] : null
    const threshold = bl?.threshold ?? null
    // Two different facts, kept apart: `over` is whether the current reading is
    // past this asset's own line, `named` is whether the detection flagged this
    // sensor (a trend or signature can name a sensor whose latest point is back
    // in band). Showing them as one "triggered" flag read as a contradiction —
    // a sensor tagged triggered while its badge said "in band".
    const over = reading != null && threshold != null && reading > threshold
    const named = namedSet.has(s.label.toLowerCase()) || namedSet.has(s.key)
    return {
      key: s.key, label: s.label, unit: s.unit, decimals: s.decimals,
      reading, threshold, mean: bl?.mean ?? null, over, named,
    }
  })
}

// The asset's most recent PM cycles, so a paused or late one reads as a
// contributing cause — the "a service was due and slipped" reading Ram asked
// for. Derived PM log; labelled as modelled wherever it is shown.
function pmContext(assetId) {
  const rows = PM_LOG.filter((r) => r.assetId === assetId)
  if (!rows.length) return null
  const recent = rows[rows.length - 1] || null
  const pausedRow = [...rows].reverse().find((r) => /paused/i.test(r.status)) || null
  const lateRow = [...rows].reverse().find((r) => /late/i.test(r.status)) || null
  return {
    recentStatus: recent?.status || null,
    recentMonth: recent?.month || null,
    paused: Boolean(pausedRow),
    pausedMonth: pausedRow?.month || null,
    late: Boolean(lateRow),
    lateMonth: lateRow?.month || null,
    slipped: Boolean(pausedRow || lateRow),
  }
}

/**
 * The root cause of one risk, against its asset. `asset` is the monitoring row
 * (monAssetById.get(risk.assetId)); it carries the readings the sensor evidence
 * is drawn from. Returns a plain object the drawer renders — no JSX here.
 */
export function rootCauseFor(risk, asset) {
  const alert = risk._alert || asset?._lastAlert || null
  const predictive = Boolean(risk.alertId && alert)
  const sensors = sensorEvidence(asset, alert?.triggeringSensors)
  const named = sensors.filter((s) => s.named)
  const over = sensors.filter((s) => s.over)
  // Flagged = the detection named it, or the reading is past its line — the ones
  // that implicate this asset, either way.
  const flagged = sensors.filter((s) => s.named || s.over)
  const pm = pmContext(risk.assetId)

  // Which of the three origins surfaced this. Predictive when a detection alert
  // sits behind it; otherwise the auditor's own SLA rule caught a serious asset
  // with no path — and a slipped PM is the upstream cause worth naming.
  const source = predictive ? 'predictive' : (pm?.slipped ? 'pm-slip' : 'audit')

  // Confidence arrives as a decimal on some detections (0.91) and a whole
  // percentage on others (61) — normalise both to a percentage.
  const rawConf = predictive && typeof alert.confidence === 'number' ? alert.confidence : null
  const confidence = rawConf == null ? null : Math.round(rawConf <= 1 ? rawConf * 100 : rawConf)

  return {
    source,
    predictive,
    alert,
    confidence,
    failureMode: alert?.failureCode || risk.failureCode || null,
    detectionDesc: alert?.description || null,
    sensors,
    named,
    over,
    flagged,
    namedCount: named.length,
    overCount: over.length,
    flaggedCount: flagged.length,
    pm,
    // Criticality passthrough — the "why it is a P1" half of the answer.
    tier: risk.tier,
    priority: risk.priority,
    criticality: risk.criticality,
    businessImpact: risk.businessImpact,
    redundancyImpact: risk.redundancyImpact,
    slaText: risk.slaText,
    slaHours: risk.slaHours,
    escalatesTo: risk.escalatesTo,
    dateIssued: risk.dateIssued,
  }
}
