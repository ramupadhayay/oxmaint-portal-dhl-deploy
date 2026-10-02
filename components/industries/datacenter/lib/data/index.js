// The joined view of the FSM PoC data.
//
// The two workbooks are relational on purpose — an alert names an asset, the
// asset names a site and a class, the class carries the criticality default,
// and a correlation row ties the alert back to what an engineer actually found.
// Screens should read that story, not re-assemble it, so every join lives here
// and each screen gets rows that already know their own context.
//
// Nothing below invents a value. Where a field is derived it is derived from
// the workbook and named so it is obviously derived (`_site`, `_tier`), because
// this data gets read back against a Statement of Work and an invented number
// would be a defect rather than a convenience.

import {
  SITES, LOCATIONS, ASSET_CLASSES, MANUFACTURERS, FAILURE_CODES, ASSETS,
  CRITICALITY, SYSTEMS, STAKEHOLDERS, PM_TASKS, KPI_MASTER,
} from './master'

import {
  WORK_ORDERS, ALERTS, READINGS, BMS, EPMS, DCIM, OEM, BATTERY,
  CORRELATIONS, KPI_ACTUALS, BENEFITS, PM_COMPLIANCE, WEEKLY_HEALTH,
  INCIDENTS, RISKS, SITE_READINESS, TECH_PREREQ,
} from './transactional'

/**
 * The client's own row text, with the contract citations taken out.
 *
 * Several rows in the source end with a bracketed reference — a risk that
 * closes "(SOW 3.3)", a readiness item that closes "(SOW 5.4)", a cadence
 * written "Biweekly (transition per SOW 2.1)". They are how the client's
 * planning documents cross-reference themselves, and they are meaningless to
 * anyone reading the register: nobody working a readiness checklist needs the
 * clause number that put the item on it.
 *
 * Done here rather than in the generated files. Those are produced by the
 * importer and a hand edit to them is undone the next time it runs, so the
 * import stays a faithful copy of what was supplied and the screens read as a
 * product instead of as a document review.
 *
 * Only the citation goes. The sentence around it is the client's and is left
 * exactly as written, including its punctuation once the bracket is gone.
 */
const CITATION = /\s*[([]?(?:transition\s+)?(?:per\s+|see\s+)?SOW(?:\s+Section)?\s*[0-9][0-9.\/–-]*[)\]]?\s*/gi

const plain = (v) => (typeof v === 'string'
  ? v.replace(CITATION, ' ').replace(/\s+([.,;])/g, '$1').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim()
  : v)

const scrub = (rows) => rows.map((r) => {
  const out = { ...r }
  for (const k of Object.keys(out)) out[k] = plain(out[k])
  return out
})

const RISKS_CLEAN = scrub(RISKS)
const SITE_READINESS_CLEAN = scrub(SITE_READINESS)
const TECH_PREREQ_CLEAN = scrub(TECH_PREREQ)
const WEEKLY_HEALTH_CLEAN = scrub(WEEKLY_HEALTH)
const PM_TASKS_CLEAN = scrub(PM_TASKS)
const WORK_ORDERS_CLEAN = scrub(WORK_ORDERS)

export {
  SITES, LOCATIONS, ASSET_CLASSES, MANUFACTURERS, FAILURE_CODES,
  CRITICALITY, SYSTEMS, STAKEHOLDERS, KPI_MASTER,
  READINGS, BMS, EPMS, DCIM, OEM, BATTERY, BENEFITS,
  INCIDENTS, PM_COMPLIANCE, KPI_ACTUALS,
  PM_TASKS_CLEAN as PM_TASKS,
  RISKS_CLEAN as RISKS,
  SITE_READINESS_CLEAN as SITE_READINESS,
  TECH_PREREQ_CLEAN as TECH_PREREQ,
  WEEKLY_HEALTH_CLEAN as WEEKLY_HEALTH,
}

// ── the customer ─────────────────────────────────────────────────────────
// Read from the data rather than written out again, so a pack swap or a new
// site list cannot leave the header disagreeing with the tables under it.
export const ORG = {
  // No customer name. This is the general data centre portal — the same build
  // is shown to whoever is asking — and a client's name in the header is the
  // one detail a visitor is guaranteed to read and remember.
  name: 'Data Center Operations',
  programme: 'Future State Maintenance PoC',
  sowDate: 'Aug 12, 2026',
  siteCount: SITES.length,
  regions: [...new Set(SITES.map((s) => s.region))],
  assetCount: ASSETS.length,
}

// ── lookups ──────────────────────────────────────────────────────────────
const by = (rows, key) => new Map(rows.map((r) => [r[key], r]))

export const siteById = by(SITES, 'siteId')
export const locationById = by(LOCATIONS, 'locationId')
export const classByName = by(ASSET_CLASSES, 'className')
export const failureByCode = by(FAILURE_CODES, 'code')
export const criticalityByRating = by(CRITICALITY, 'rating')
export const manufacturersByClass = by(MANUFACTURERS, 'classId')
export const kpiMasterById = by(KPI_MASTER, 'kpiId')

// Split a workbook's comma-separated cell into a list. Several columns hold
// them — failure codes, sensors, data sources — and each screen splitting its
// own is how the same cell ends up rendered three different ways.
export const listOf = (value) =>
  (value || '').split(/[,;]/).map((s) => s.trim()).filter(Boolean)

// ── assets, with their context attached ──────────────────────────────────
export const ASSET_ROWS = ASSETS.map((a) => {
  const site = siteById.get(a.siteId)
  const cls = classByName.get(a.assetClass)
  const crit = criticalityByRating.get(a.criticality)
  return {
    ...a,
    _site: site?.siteName || a.siteId,
    _siteZone: site?.pocZone || null,
    _location: locationById.get(a.locationId)?.locationName || a.locationId,
    _category: cls?.category || null,
    _classId: cls?.classId || null,
    _strategy: cls?.strategy || null,
    _tier: crit?.tier || null,
    _sla: crit?.responseSla || null,
    _failureCodes: listOf(a.failureCodes),
    _sensors: listOf(a.sensors),
    _dataSources: listOf(a.dataSources),
    _included: a.scopeStatus === 'Included',
  }
})

export const assetById = by(ASSET_ROWS, 'assetId')

// The same context an asset in the workbook carries, given to one raised in the
// portal — a bulk-uploaded asset arrives with only its core columns, and the
// register's cards read `_site`, `_sensors`, `_failureCodes` and the rest, so an
// asset missing them would be the one card on the screen that throws. Kept
// beside the mapping above so the two cannot drift.
export function shapeAsset(a) {
  const site = siteById.get(a.siteId)
  const cls = classByName.get(a.assetClass)
  const crit = criticalityByRating.get(a.criticality)
  return {
    ...a,
    _site: site?.siteName || a.siteId,
    _siteZone: site?.pocZone || null,
    _location: locationById.get(a.locationId)?.locationName || a.locationId || '—',
    _category: cls?.category || a.assetClass || null,
    _classId: cls?.classId || null,
    _strategy: cls?.strategy || null,
    _tier: crit?.tier || null,
    _sla: crit?.responseSla || null,
    _failureCodes: listOf(a.failureCodes),
    _sensors: listOf(a.sensors),
    _dataSources: listOf(a.dataSources),
    _included: (a.scopeStatus || 'Included') === 'Included',
  }
}

// The PoC's actual working set. SOW 3.3 requires the excluded assets to stay on
// the register with a rationale, so they are kept and flagged rather than
// filtered out at import — but most screens count only what is in scope.
export const ASSETS_IN_SCOPE = ASSET_ROWS.filter((a) => a._included)

// ── the response workflow, stitched together ─────────────────────────────
//
// SOW 7.2 is one chain: alert → engineering review → condition validated →
// action → work order → outcome → feedback. It is the thing this PoC exists to
// demonstrate, and it spans three sheets. Assembling it once here is what lets
// a screen show the whole chain on one row.
const woByAlert = new Map(WORK_ORDERS.filter((w) => w.alertId).map((w) => [w.alertId, w]))
const corByAlert = new Map(CORRELATIONS.map((c) => [c.alertId, c]))

export const ALERT_ROWS = ALERTS.map((a) => {
  const asset = assetById.get(a.assetId)
  const wo = a.workOrderId ? WORK_ORDERS.find((w) => w.workOrderId === a.workOrderId) : woByAlert.get(a.alertId)
  const cor = corByAlert.get(a.alertId)
  return {
    ...a,
    _asset: asset?.assetName || a.assetId,
    _assetClass: asset?.assetClass || null,
    _criticality: asset?.criticality || null,
    _site: siteById.get(a.siteId)?.siteName || a.siteId,
    _failureMode: failureByCode.get(a.failureCode)?.mode || null,
    _workOrder: wo || null,
    _correlation: cor || null,
    _leadTime: cor?.leadTime || null,
    _truePositive: a.classification === 'True Positive',
    _falsePositive: a.classification === 'False Positive',
  }
})

export const alertById = by(ALERT_ROWS, 'alertId')

export const WORK_ORDER_ROWS = WORK_ORDERS_CLEAN.map((w) => {
  const asset = assetById.get(w.assetId)
  return {
    ...w,
    _asset: asset?.assetName || w.assetId,
    _criticality: asset?.criticality || null,
    _site: siteById.get(w.siteId)?.siteName || w.siteId,
    _alert: w.alertId ? alertById.get(w.alertId) || null : null,
    // Condition-based is the PoC's contribution; calendar and reactive are the
    // baseline it is being measured against.
    _conditionBased: (w.triggerSource || '').startsWith('Condition'),
  }
})

// Neither sheet carries a site of its own — both hang off an asset. The site is
// resolved through it so the header's site picker narrows these screens like
// every other one; without it, picking Ashburn would leave the readings and
// correlations for all six sites on screen, which reads as a broken filter.
/**
 * A work order raised in the portal, given the same shape as a seeded one.
 *
 * The list and the record page render one array, so anything created has to
 * arrive already carrying the asset's name, site and criticality — otherwise a
 * new row is the one row on the screen with blanks where every other row has
 * context, which is exactly how a demo betrays which records are real.
 */
export function shapeWorkOrder(record) {
  const asset = assetById.get(record.assetId)
  return {
    ...record,
    _asset: asset?.assetName || record.assetId || '—',
    _criticality: asset?.criticality || null,
    _site: asset?._site || siteById.get(record.siteId)?.siteName || record.siteId || '—',
    siteId: record.siteId || asset?.siteId || null,
    _alert: record.alertId ? alertById.get(record.alertId) || null : null,
    _conditionBased: (record.triggerSource || '').startsWith('Condition'),
    _created: true,
  }
}

/**
 * The next work order number, continuing the workbook's sequence.
 *
 * The seeded orders run WO-1001 upward, and a new one numbered from 1 would sit
 * in a list beside them announcing that it came from somewhere else.
 */
export function nextWorkOrderNumber(existing = []) {
  const highest = [...WORK_ORDERS, ...existing].reduce((max, w) => {
    const n = Number(String(w.workOrderId || '').replace(/\D/g, ''))
    return Number.isFinite(n) && n > max ? n : max
  }, 1000)
  return `WO-${highest + 1}`
}

export const CORRELATION_ROWS = CORRELATIONS.map((c) => {
  const asset = assetById.get(c.assetId)
  return {
    ...c,
    siteId: asset?.siteId || null,
    _asset: asset?.assetName || c.assetId,
    _site: asset?._site || null,
    _criticality: asset?.criticality || null,
    _alert: alertById.get(c.alertId) || null,
    _severity: alertById.get(c.alertId)?.severity || null,
  }
})

export const READING_ROWS = READINGS.map((r) => {
  const asset = assetById.get(r.assetId)
  return {
    ...r,
    siteId: asset?.siteId || null,
    _asset: asset?.assetName || r.assetId,
    _site: asset?._site || null,
    _alert: r.alertId ? alertById.get(r.alertId) || null : null,
  }
})

// ── the integrated feeds, as one list ────────────────────────────────────
//
// Five sheets, one shape. SOW 4.1 lists them as separate existing systems and
// SOW 6.1 asks for correlation *across* them, so the portal needs both views:
// each feed on its own, and everything that touched a given alert regardless of
// which system saw it.
const feed = (rows, system, pointKey) => rows.map((r) => ({
  ...r,
  _system: system,
  _point: r[pointKey] ?? null,
  _when: r.timestamp || r.date || null,
  _asset: r.assetId ? assetById.get(r.assetId)?.assetName || r.assetId : null,
  _site: siteById.get(r.siteId)?.siteName || r.siteId,
}))

export const FEEDS = {
  BMS: feed(BMS, 'BMS', 'point'),
  EPMS: feed(EPMS, 'EPMS', 'point'),
  DCIM: feed(DCIM, 'DCIM', 'metric'),
  OEM: feed(OEM, 'OEM Monitoring', 'indicator'),
  Battery: feed(BATTERY, 'Battery Monitoring', 'cellRef'),
}

export const ALL_FEED_ROWS = Object.values(FEEDS).flat()

/** Everything any system recorded against one alert, oldest first. */
export function evidenceFor(alertId) {
  const rows = [
    ...READING_ROWS.filter((r) => r.alertId === alertId).map((r) => ({ ...r, _system: `${r.sensorType} sensor`, _point: r.sensorType })),
    ...ALL_FEED_ROWS.filter((r) => r.alertId === alertId),
  ]
  return rows.sort((a, b) => String(a._when || a.timestamp || '').localeCompare(String(b._when || b.timestamp || '')))
}

// ── KPIs ─────────────────────────────────────────────────────────────────
//
// The workbook computes these with spreadsheet formulas and stores the result,
// so the value is carried across rather than recomputed — recomputing would
// risk this portal and the client's own workbook disagreeing on a number that
// is contractual.
export const KPI_ROWS = KPI_ACTUALS.map((k) => {
  const master = kpiMasterById.get(k.kpiId)
  const numeric = typeof k.actual === 'number'

  // Not every numeric KPI is a ratio. The Technical ones are — 0.945 sensor
  // availability — but the Operational ones are counts: five early fault
  // detections, seven optimisation opportunities. Multiplying those by a
  // hundred printed "500%", which is not a number a percentage can be.
  //
  // The target column is what tells them apart, and it is the client's own
  // wording: "~90-100%" is a percentage target, "Demonstrated" and "Developed"
  // are not. Reading the intent off the target rather than guessing from the
  // magnitude means a count that happens to be below 1 is still a count.
  const isPercentage = numeric && /%/.test(String(k.target ?? ''))

  return {
    ...k,
    _definition: master?.definition || null,
    _source: master?.source || null,
    _isPercentage: isPercentage,
    // Only a percentage has a position on a 0-100 bar. A count has no such
    // scale, so screens draw no bar for one rather than inventing a ceiling.
    _percent: isPercentage ? Math.round(k.actual * 1000) / 10 : null,
    _display: isPercentage
      ? `${Math.round(k.actual * 1000) / 10}%`
      : numeric
        ? String(k.actual)
        : String(k.actual ?? '—'),
    // A count needs its own noun or "5" says nothing. Taken from the KPI's own
    // name so it stays true if the sheet's wording changes.
    _unit: isPercentage ? null : numeric ? countUnit(k.kpi) : null,
    _favourable: /On Target|Above Target|Demonstrated|Below Target \(favorable\)/i.test(k.statusVsTarget || ''),
  }
})

function countUnit(kpi) {
  const s = String(kpi || '').toLowerCase()
  if (/detection/.test(s)) return 'detections'
  if (/opportunit/.test(s)) return 'opportunities'
  if (/intervention/.test(s)) return 'interventions'
  if (/risk/.test(s)) return 'risks reduced'
  if (/case/.test(s)) return 'benefits recorded'
  return 'recorded'
}

// ── headline counts for the overview ─────────────────────────────────────
export const SUMMARY = {
  sites: SITES.length,
  regions: ORG.regions.length,
  assetsInScope: ASSETS_IN_SCOPE.length,
  assetsExcluded: ASSET_ROWS.length - ASSETS_IN_SCOPE.length,
  criticalAssets: ASSETS_IN_SCOPE.filter((a) => a.criticality === 'Critical').length,
  alerts: ALERT_ROWS.length,
  alertsOpen: ALERT_ROWS.filter((a) => !/^Closed/i.test(a.status || '')).length,
  truePositives: ALERT_ROWS.filter((a) => a._truePositive).length,
  falsePositives: ALERT_ROWS.filter((a) => a._falsePositive).length,
  workOrders: WORK_ORDER_ROWS.length,
  workOrdersOpen: WORK_ORDER_ROWS.filter((w) => w.status !== 'Completed').length,
  conditionTriggered: WORK_ORDER_ROWS.filter((w) => w._conditionBased).length,
  correlationsConfirmed: CORRELATION_ROWS.filter((c) => c.confirmed === 'Yes').length,
  pmOnTime: PM_COMPLIANCE.filter((p) => p.status === 'Completed On Time').length,
  pmLogged: PM_COMPLIANCE.length,
  openRisks: RISKS.filter((r) => r.category === 'Risk' && r.status === 'Open').length,
}

// ── shared formatting ────────────────────────────────────────────────────
export const fmtDate = (v) => {
  if (!v) return '—'
  const d = new Date(String(v).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return String(v)
  return `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('en-GB', { month: 'short' })} ${d.getFullYear()}`
}

export const fmtDateTime = (v) => {
  if (!v) return '—'
  const s = String(v)
  const d = new Date(s.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return s
  const time = s.includes(':') ? ` ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : ''
  return fmtDate(v) + time
}

/** Severity and criticality share the maintenance vocabulary the kit knows. */
export const toneOf = (value) => ({
  Critical: 'red', High: 'amber', Medium: 'blue', Low: 'grey',
}[value] || 'grey')
