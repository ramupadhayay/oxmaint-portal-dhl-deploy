'use client'

// The gap-fill rows, reshaped into what the monitoring screens already read.
//
// The two datasets describe the same thing in different shapes. The client's
// monitoring workbook stores one row per asset per day with a column for each
// sensor; the gap-fill workbook stores one row per asset per day *per sensor*.
// Neither is wrong — they were authored for different purposes — but the
// screens read the first, and rewriting every screen to accept both would put
// the difference in twenty places instead of one.
//
// So it is pivoted here, once. Everything downstream keeps reading the shape it
// already reads, and gains seven more assets without knowing anything happened.
//
// `_gapFill` survives the pivot. It is the whole reason this file is separate
// from the client's: a reader who asks whether a number came from Digital
// Realty or from us has to be able to get an answer, and a flag that gets lost
// in a reshape is a flag that was never worth setting.

import {
  GAP_ASSETS, GAP_READINGS, GAP_DETECTIONS, GAP_RECOMMENDATIONS,
  GAP_OUTCOMES, GAP_INCIDENT_DETAIL, GAP_SOURCE,
} from './data/gapfill'
import { ASSETS_IN_SCOPE, SITES } from './data'

export { GAP_SOURCE, GAP_INCIDENT_DETAIL, GAP_OUTCOMES }

const assetById = new Map(ASSETS_IN_SCOPE.map((a) => [a.assetId, a]))
const siteById = new Map(SITES.map((s) => [s.siteId, s]))

// The sheet writes "Vibration"; the screens key on "vibration". Lower-casing is
// enough for all three, and anything the sheet adds later that is not one of
// them is dropped rather than becoming a column nothing reads.
const SENSOR_KEYS = new Set(['vibration', 'thermal', 'ultrasound'])

/**
 * The daily readings, pivoted to one row per asset per day.
 *
 * A sensor an asset does not carry is left absent rather than zeroed. Zero is a
 * reading — a chart drawing a flat line at zero for a sensor that was never
 * fitted is inventing data, and worse, it is inventing data that looks healthy.
 */
export const GAP_MON_READINGS = (() => {
  const byKey = new Map()

  for (const r of GAP_READINGS) {
    if (!SENSOR_KEYS.has(r.sensor)) continue
    const key = `${r.assetId}|${r.date}`
    if (!byKey.has(key)) {
      byKey.set(key, { date: r.date, assetId: r.assetId, _gapFill: true })
    }
    const row = byKey.get(key)
    row[r.sensor] = r.value
    row[`${r.sensor}Status`] = r.status
    // Carried per sensor because the sheet supplies a real alarm threshold and
    // the client's data does not. Where it exists it beats the derived one —
    // see baselineFor, which is explicit that it derives thresholds only
    // because the workbook has none.
    row[`${r.sensor}Threshold`] = r.threshold
    row[`${r.sensor}Unit`] = r.unit
  }

  return [...byKey.values()].sort((a, b) => (
    a.assetId === b.assetId
      ? String(a.date).localeCompare(String(b.date))
      : a.assetId.localeCompare(b.assetId)))
})()

/** Thresholds the sheet supplied, keyed the way baselineFor asks for them. */
export const GAP_THRESHOLDS = (() => {
  const m = new Map()
  for (const r of GAP_READINGS) {
    if (!SENSOR_KEYS.has(r.sensor) || r.threshold == null) continue
    m.set(`${r.assetId}|${r.sensor}`, { threshold: r.threshold, unit: r.unit })
  }
  return m
})()

/** The new assets, in the shape the estate list reads. */
export const GAP_MON_ASSETS = GAP_ASSETS.map((a) => {
  const reg = assetById.get(a.assetId)
  const siteId = reg?.siteId || a.assetId.split('-')[0]
  return {
    assetId: a.assetId,
    assetName: a.assetName,
    assetClass: a.assetClass,
    siteId,
    location: reg?._location || siteById.get(siteId)?.pocZone || '—',
    criticality: reg?.criticality || a.severity || 'Medium',
    manufacturer: reg?.manufacturer || '—',
    monitoring: a.sensorsLabel,
    installDate: reg?.installDate || null,
    // The workbook's own words for where this one has got to.
    status: a.status,
    _gapFill: true,
    _failureMode: a.failureMode,
    _severity: a.severity,
    _classification: a.classification,
    _registerAlert: a.alertRef,
  }
})

/**
 * The detections, as alerts.
 *
 * Confidence arrives as a whole percentage here and as a fraction in the
 * client's file. The monitoring layer already normalises that — anything at or
 * below one is a fraction — so it is passed through as the sheet wrote it
 * rather than converted twice.
 */
export const GAP_MON_ALERTS = GAP_DETECTIONS.map((d) => {
  const rec = GAP_RECOMMENDATIONS.find((r) => r.detectionId === d.detectionId) || null
  return {
    alertId: d.detectionId,
    assetId: d.assetId,
    // The date the recommendation closed is the only date in the sheet; where
    // there is none the detection is still open, and the last reading is the
    // honest stand-in for when it was raised.
    dateRaised: rec?.dateClosed
      || GAP_MON_READINGS.filter((r) => r.assetId === d.assetId).at(-1)?.date
      || null,
    failureCode: d.failureCode,
    description: `${d.failureMode} — ${d.corroborating}`,
    triggeringSensors: sensorsOf(d),
    confidence: d.confidenceAfter,
    severity: d.severity,
    status: d.status,
    _gapFill: true,
    _confidenceBefore: d.confidenceBefore,
    _confidenceAfter: d.confidenceAfter,
    _corroborating: d.corroborating,
    _registerAlert: d.alertRef,
    // The three that fired below their alarm line. Worth its own flag: it is
    // the case that argues for condition monitoring rather than thresholds.
    _belowAlarm: /below alarm|sub-alarm|still normal/i.test(d.corroborating || ''),
  }
})

// The detection sheet says "2 of 2" rather than naming them, so the sensors are
// taken from the asset row, which does name them.
function sensorsOf(d) {
  const a = GAP_ASSETS.find((x) => x.assetId === d.assetId)
  return a ? a.sensorsLabel : ''
}

/** The recommendations, as the recommendation screen reads them. */
export const GAP_MON_RECOMMENDATIONS = GAP_RECOMMENDATIONS.map((r) => ({
  recId: r.recId,
  alertId: r.detectionId,
  assetId: r.assetId,
  action: r.action,
  urgency: GAP_DETECTIONS.find((d) => d.detectionId === r.detectionId)?.severity || 'Medium',
  dateIssued: null,
  workOrderId: r.workOrderId,
  woStatus: r.woStatus,
  finding: r.finding,
  outcome: r.outcome,
  dateClosed: r.dateClosed,
  _gapFill: true,
  _assetName: r.assetName,
}))

/** Health scores, derived from how far each reading sits into its own band. */
export const GAP_MON_HEALTH = (() => {
  const out = []
  const byAsset = new Map()
  for (const r of GAP_MON_READINGS) {
    if (!byAsset.has(r.assetId)) byAsset.set(r.assetId, [])
    byAsset.get(r.assetId).push(r)
  }

  for (const [assetId, rows] of byAsset) {
    for (const row of rows) {
      // Worst sensor decides the score: an asset is as healthy as its least
      // healthy signal, not as healthy as its average.
      let worst = 0
      for (const key of SENSOR_KEYS) {
        const v = row[key]
        const th = row[`${key}Threshold`]
        if (typeof v !== 'number' || !th) continue
        worst = Math.max(worst, Math.min(1.3, v / th))
      }
      out.push({
        date: row.date,
        assetId,
        // 100 at rest, falling away as a reading approaches its line and past
        // it. Rounded because a health score with decimals invites a precision
        // it does not have.
        score: Math.max(5, Math.round(100 - worst * 70)),
        _gapFill: true,
      })
    }
  }
  return out
})()

/** What this adds, for the screens that say so on the page. */
export const GAP_SUMMARY = {
  ...GAP_SOURCE,
  monitoredAssets: GAP_MON_ASSETS.length,
  detections: GAP_MON_ALERTS.length,
  belowAlarm: GAP_MON_ALERTS.filter((a) => a._belowAlarm).length,
  recommendations: GAP_MON_RECOMMENDATIONS.length,
  readingRows: GAP_MON_READINGS.length,
}
