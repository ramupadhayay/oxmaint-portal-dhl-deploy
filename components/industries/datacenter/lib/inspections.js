// The inspection modules, built from the plant the workbooks describe.
//
// The client's workbooks carry an asset register, a PM task library and an
// incident history. They carry no inspection reports, no reminders and no
// checklists — and those are three of the modules the product ships. So they
// are built here, from the workbooks' own contents.
//
// Derived, not invented. Each inspection names an asset that is on the
// register, runs a task that is in the PM library at the frequency that library
// states, and is assigned to a team that appears in the work orders. A module
// that invented its own machines would be caught the moment somebody looked up
// one of its assets — which is the first thing a reliability engineer does.
//
// Deterministic, for the same reason the CMMS portal's plant is: a screen that
// shows different numbers on the second run cannot be rehearsed. The hash below
// is seeded from the record's own identity, so the same asset and task always
// produce the same inspection.

import {
  ASSETS_IN_SCOPE, PM_TASKS, ASSET_CLASSES, INCIDENTS, PM_COMPLIANCE, STAKEHOLDERS,
  assetById, siteById, classByName, failureByCode, criticalityByRating, listOf,
} from './data'

// ── determinism ──────────────────────────────────────────────────────────
//
// FNV-1a with the avalanche step. Without it the last character dominates the
// low bits, and a list keyed on ids that differ only in their last digit comes
// out in visible runs — every third inspection Overdue, in order.
function seed(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 15
  h = Math.imul(h, 2246822507)
  h ^= h >>> 13
  return (h >>> 0) / 4294967296
}

const pick = (key, list) => list[Math.floor(seed(key) * list.length) % list.length]
const between = (key, lo, hi) => lo + Math.floor(seed(key) * (hi - lo + 1))

// Dates are offsets from today rather than fixed, so the module does not read
// as a year out of date the month after it is built.
const TODAY = new Date()
const dayOffset = (n) => {
  const d = new Date(TODAY)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const TEAMS = [
  'Site Engineering',
  'Site Engineering + Electrical Vendor',
  'Mechanical Contractor',
  'Chiller OEM Vendor',
  'Reliability Engineering',
]

const INSPECTORS = [
  'D. Reeve', 'T. Whelan', 'S. Kovac', 'M. Bell', 'E. Brandt', 'O. Marsh',
]

// How often each PM frequency comes round, in days. Taken from the library's
// own wording so a "Quarterly" task is scheduled quarterly rather than on a
// number picked to look plausible.
const EVERY = {
  Weekly: 7, Monthly: 30, Quarterly: 91, 'Semi-Annual': 182,
  'Semi-Annually': 182, Annual: 365, Annually: 365, Biennial: 730,
  'Every 3 Years': 1095,
}
const periodOf = (frequency) => EVERY[String(frequency || '').trim()] || 180

// PM tasks that name an asset class we actually hold, so an inspection cannot
// reference a class with nothing in it.
const classesWithAssets = new Set(ASSETS_IN_SCOPE.map((a) => a.assetClass))
const USABLE_TASKS = PM_TASKS.filter((t) => classesWithAssets.has(t.assetClass))

const assetsOfClass = (className) => ASSETS_IN_SCOPE.filter((a) => a.assetClass === className)

// Whether a task matters more than the rest, taken from the register rather
// than from the wording of the task.
//
// This matched on words like "safety" and "trip" at first and flagged nothing:
// this library says "Full load bank test" and "Static switch functional
// transfer test", which are exactly the critical ones and contain none of those
// words. Guessing from the text was the wrong instrument — the client has
// already graded every asset class, and a task on a class they rate Critical is
// a critical task by their own definition.
//
// It sits above the registers rather than beside the checklists because the
// reminders want the same answer, and two copies of a judgement like this one
// is how the checklist and the reminder end up disagreeing about the same task.
const criticalClasses = new Set(
  ASSET_CLASSES.filter((c) => c.defaultCriticality === 'Critical').map((c) => c.className))
const isCritical = (task) => criticalClasses.has(task.assetClass)

// ── inspection reports: what has already been done ───────────────────────
export const INSPECTION_REPORTS = USABLE_TASKS.flatMap((task) => {
  const assets = assetsOfClass(task.assetClass)
  if (!assets.length) return []

  // One report per task per asset would be hundreds of near-identical rows.
  // Two assets per task gives a register with range in it and still lets every
  // row be traced back to the library.
  return assets.slice(0, 2).map((asset, i) => {
    const key = `${task.taskId}:${asset.assetId}:${i}`
    const period = periodOf(task.frequency)
    const done = -between(`${key}:done`, 3, Math.max(4, Math.round(period * 0.8)))
    const r = seed(`${key}:result`)

    // Mostly passing, because a plant where a third of inspections fail is not
    // a plant anybody is running. The failures are what the findings hang off.
    const result = r > 0.86 ? 'Failed' : r > 0.68 ? 'Passed with observations' : 'Passed'
    const score = result === 'Passed' ? between(`${key}:s`, 92, 100)
      : result === 'Passed with observations' ? between(`${key}:s`, 74, 91)
        : between(`${key}:s`, 45, 73)

    return {
      reportId: `INS-${String(seed(key) * 100000 | 0).padStart(5, '0')}`,
      taskId: task.taskId,
      task: task.task,
      standard: task.standard,
      frequency: task.frequency,
      assetId: asset.assetId,
      // Carried so the header's site picker filters these the way it filters
      // every other register — the rule is `r.siteId`, and a row without one is
      // treated as estate-wide and never filtered out.
      siteId: asset.siteId,
      _asset: asset.assetName,
      _site: asset._site,
      _location: asset._location,
      assetClass: task.assetClass,
      criticality: asset.criticality,
      date: dayOffset(done),
      inspector: pick(`${key}:who`, INSPECTORS),
      team: pick(`${key}:team`, TEAMS),
      result,
      score,
      findings: result === 'Passed'
        ? null
        : findingFor(result, task, asset, key),
      _failed: result === 'Failed',
    }
  })
})

function findingFor(result, task, asset, key) {
  const observations = [
    `Minor wear noted during ${task.task.toLowerCase()}; within tolerance, re-check next cycle.`,
    `Reading at the upper end of the normal band on ${asset.assetName}. Trending, no action this cycle.`,
    `Housekeeping and labelling corrected at the point of inspection.`,
    `Minor seal weep observed; monitored, no intervention required yet.`,
  ]
  const failures = [
    `Out-of-tolerance result on ${asset.assetName}. Work order raised for corrective action.`,
    `${task.task} could not be completed to ${task.standard}; access restricted during the window.`,
    `Component beyond service limit. Replacement scheduled with the OEM.`,
    `Protective device test failed. Asset flagged pending re-test.`,
  ]
  return pick(`${key}:finding`, result === 'Failed' ? failures : observations)
}

// ── what a reminder can say beyond its own date ──────────────────────────
//
// A due date on its own is the least useful thing this register holds. The
// questions a planner actually arrives with are: did the last one pass, what is
// already watching this machine, can it be taken out of service for the window,
// and who hears about it if it slips. All four are answerable from the
// workbooks — they are just answerable in four different sheets, which is why
// nobody asks them. Joined here, once, they become the record.

const DAY = 86400000
const TODAY_ISO = dayOffset(0)
const daysFromToday = (iso) =>
  Math.round((new Date(`${iso}T00:00:00`) - new Date(`${TODAY_ISO}T00:00:00`)) / DAY)

/**
 * The report that closed the last cycle of this same task on this same asset.
 *
 * The single most valuable thing a reminder can carry. Without it the reader
 * has to leave the record, find the report register, and filter it twice to
 * learn whether the machine they are about to send somebody to passed last
 * time — and mostly they do not bother, which is how a failing asset gets a
 * routine visit.
 */
const lastReportFor = (taskId, assetId) => INSPECTION_REPORTS
  .filter((r) => r.taskId === taskId && r.assetId === assetId)
  .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null

/** How this asset has fared across everything the report register holds on it. */
function adherenceFor(assetId) {
  const rows = INSPECTION_REPORTS.filter((r) => r.assetId === assetId)
  if (!rows.length) return null
  const passed = rows.filter((r) => r.result === 'Passed').length
  const observations = rows.filter((r) => r.result === 'Passed with observations').length
  const failed = rows.filter((r) => r._failed).length
  return {
    total: rows.length,
    passed,
    observations,
    failed,
    // Clean pass rate, not "did not fail" — an inspection that came back with
    // observations found something, and rolling it in with the clean ones is
    // how a register reports 100% on an asset nobody is happy about.
    passRate: Math.round((passed / rows.length) * 100),
    averageScore: Math.round(rows.reduce((n, r) => n + r.score, 0) / rows.length),
  }
}

/**
 * The client's own PM compliance log for this asset and task.
 *
 * Their record, not ours, and the only on-time evidence in either workbook that
 * was not derived here — so it is carried separately from the report history
 * and labelled as theirs. It covers ten assets, so most reminders have none,
 * and a screen that pads that out would be inventing a compliance figure.
 */
const pmLogFor = (taskId, assetId) => {
  const rows = PM_COMPLIANCE.filter((p) => p.assetId === assetId)
  const mine = rows.filter((p) => p.taskId === taskId)
  const done = rows.filter((p) => /^Completed/.test(p.status || ''))
  return rows.length ? {
    rows: mine.length ? mine : rows,
    logged: rows.length,
    onTime: rows.filter((p) => p.status === 'Completed On Time').length,
    late: rows.filter((p) => p.status === 'Completed Late').length,
    completed: done.length,
    _sameTask: mine.length > 0,
  } : null
}

const stakeholderByRole = new Map(STAKEHOLDERS.map((s) => [s.role, s]))

// Who a slipped inspection goes to.
//
// Two client sheets answer this between them, so none of it is invented: the
// criticality sheet gives the tier, the response SLA they committed to and what
// losing the asset costs, and the RACI sheet names the roles and what each one
// owns. The pairing is the only judgement in it — Tier 1 escalates to the role
// that owns site risk acceptance and change windows, because a critical asset's
// outage window is a site decision and not the round's to make. Below that it
// stays with the people who coordinate and execute the work.
const ESCALATES_TO = {
  Critical: 'Site Leadership',
  High: 'Regional Operations',
  Medium: 'Site Engineering',
  Low: 'Site Engineering',
}

function escalationFor(criticality) {
  const grade = criticalityByRating.get(criticality)
  const role = ESCALATES_TO[criticality] || 'Site Engineering'
  const who = stakeholderByRole.get(role)
  return {
    role,
    raci: who?.raci || null,
    responsibility: who?.responsibility || null,
    cadence: who?.cadence || null,
    tier: grade?.tier || null,
    sla: grade?.responseSla || null,
    businessImpact: grade?.businessImpact || null,
    redundancyImpact: grade?.redundancyImpact || null,
  }
}

/**
 * Which redundancy figure decides whether the asset can come out of service.
 *
 * The sites carry two, and they are not interchangeable: a CRAH sits on the
 * cooling path and a UPS on the power one, so quoting 2N power over a chiller
 * inspection is worse than quoting nothing. The category the client filed the
 * asset class under is what picks between them.
 */
function redundancyFor(site, category) {
  if (!site) return null
  const cooling = /mechanical|cooling/i.test(category || '')
  const value = cooling ? site.coolingRedundancy : site.powerRedundancy
  return {
    path: cooling ? 'Cooling' : 'Power',
    value,
    // N+1 leaves a spare leg, 2N a whole second path. Either means the machine
    // can be isolated for the window, which is the planner's question; a bare N
    // means the round has to be done live or not at all.
    canIsolate: /\+|^2N/i.test(String(value || '')),
    designTier: site.designTier,
    zone: site.pocZone,
  }
}

/**
 * The failure modes behind the visit, split by whether a sensor already covers
 * them.
 *
 * The PM library carries no failure codes, so this is the asset register's list
 * rather than the task's, and every screen showing it says so. The split is the
 * part worth having: the class sheet names the technologies watching that
 * class, so a mode matched by one of them is being watched continuously, and
 * anything left over is only ever found by somebody physically going to look —
 * which is what this reminder is asking for.
 */
function failureModesFor(asset) {
  const watched = new Set(listOf(classByName.get(asset.assetClass)?.monitoring)
    .map((t) => t.toLowerCase()))
  return asset._failureCodes.map((code) => {
    const f = failureByCode.get(code)
    const technology = f?.technology || null
    return {
      code,
      mode: f?.mode || null,
      technology,
      sowRef: f?.sowRef || null,
      sensorCovered: technology ? watched.has(technology.toLowerCase()) : false,
    }
  })
}

// ── reminders: what is coming, and what has slipped ──────────────────────
export const INSPECTION_REMINDERS = USABLE_TASKS.flatMap((task) => {
  const assets = assetsOfClass(task.assetClass)
  if (!assets.length) return []

  return assets.slice(0, 2).map((asset, i) => {
    const key = `rem:${task.taskId}:${asset.assetId}:${i}`
    const period = periodOf(task.frequency)
    // Spread the next due dates across the cycle, with a few already past — a
    // reminder list where nothing is overdue is a list nobody needs.
    const due = between(`${key}:due`, -21, Math.round(period * 0.9))
    const dueDate = dayOffset(due)

    const site = siteById.get(asset.siteId) || null
    const last = lastReportFor(task.taskId, asset.assetId)

    return {
      reminderId: `REM-${String(seed(key) * 100000 | 0).padStart(5, '0')}`,
      taskId: task.taskId,
      task: task.task,
      frequency: task.frequency,
      standard: task.standard,
      assetId: asset.assetId,
      siteId: asset.siteId,
      _asset: asset.assetName,
      _site: asset._site,
      assetClass: task.assetClass,
      criticality: asset.criticality,
      dueDate,
      assignedTo: pick(`${key}:team`, TEAMS),
      _daysAway: due,
      status: due < 0 ? 'Overdue' : due <= 7 ? 'Due this week' : due <= 30 ? 'Due this month' : 'Scheduled',
      _overdue: due < 0,

      // The schedule, spelled out. "Monthly" is the library's word; the interval
      // and the occurrence after this one are what a planner puts in a calendar.
      _intervalDays: period,
      _nextAfter: dayOffset(due + period),

      // Last time round.
      _last: last && { ...last, _daysAgo: -daysFromToday(last.date) },
      _adherence: adherenceFor(asset.assetId),
      _pmLog: pmLogFor(task.taskId, asset.assetId),

      // Where the machine sits and what it is.
      _location: asset._location,
      _category: asset._category,
      _manufacturer: asset.manufacturer,
      _strategy: asset._strategy,
      _monitoringMethod: asset.monitoringMethod,
      _sensors: asset._sensors,
      _dataSources: asset._dataSources,
      _scopeRationale: asset.scopeRationale,
      _failureModes: failureModesFor(asset),

      // Whether the client grades the whole class Critical, which is a stronger
      // statement than this one asset's rating and the reason a checklist line
      // on the same task carries a red dot.
      _criticalClass: isCritical(task),

      // Can it be taken offline for the window, and who hears about it if not.
      _redundancy: redundancyFor(site, asset._category),
      _escalation: escalationFor(asset.criticality),

      // What has already gone wrong on this machine. Empty for most of them —
      // the incident sheet covers seven assets — and an empty list is the
      // answer rather than a gap.
      _incidents: INCIDENTS.filter((x) => x.assetId === asset.assetId),
    }
  })
})

// ── checklists: the PM library, as something a technician fills in ───────
//
// Grouped by category, not by asset class. Per class this library yields one
// or two lines each — twenty checklists holding twenty-five items between them,
// which is a list of stubs rather than anything a technician could work from.
// By category each one holds a round's worth, which is also how the work is
// actually done: somebody walks the mechanical plant, not one CRAH at a time.
//
// The class stays on every item, so a checklist still says which machine each
// line belongs to.
const categoryOf = (className) =>
  ASSET_CLASSES.find((c) => c.className === className)?.category || 'Other'

// What the line asks the technician to write down. A sheet of pass/fail boxes
// captures nothing from a task that says "measure" — the response type comes
// from what the task itself asks for.
const responseFor = (task) =>
  /measure|reading|temperature|pressure|current|resistance|vibration|thickness|level/i.test(task) ? 'Reading'
    : /clean|replace|top up|lubricat|tighten|calibrat|test|exercise/i.test(task) ? 'Done / not done'
      : 'Pass / fail'

export const CHECKLISTS = [...new Set(USABLE_TASKS.map((t) => categoryOf(t.assetClass)))].map((category) => {
  const tasks = USABLE_TASKS.filter((t) => categoryOf(t.assetClass) === category)
  const classes = [...new Set(tasks.map((t) => t.assetClass))]
  const assets = ASSETS_IN_SCOPE.filter((a) => classes.includes(a.assetClass))
  const key = `chk:${category}`

  return {
    checklistId: `CHK-${category.slice(0, 4).toUpperCase()}`,
    name: `${category} plant — routine inspection`,
    category,
    classes,
    appliesTo: assets.length,
    // The mix of frequencies the round covers, rather than one picked from the
    // first task and applied to the rest.
    frequency: [...new Set(tasks.map((t) => t.frequency))].join(', '),
    items: tasks.map((t, i) => ({
      itemId: `${t.taskId}-${i + 1}`,
      text: t.task,
      assetClass: t.assetClass,
      standard: t.standard,
      frequency: t.frequency,
      response: responseFor(t.task),
      critical: isCritical(t),
    })),
    _itemCount: tasks.length,
    _criticalCount: tasks.filter((t) => isCritical(t)).length,
    _classCount: classes.length,
    lastUpdated: dayOffset(-between(key, 10, 120)),
  }
})

// ── a filled inspection sheet, reconstructed for a generated report ──────────
//
// A generated report carries a result and a score but no per-line answers. This
// rebuilds a plausible, class-appropriate sheet for one from its asset class and
// result — deterministic, and flagged `_illustrative` so the page can say the
// lines were reconstructed rather than signed. A report that failed has a line
// that fails; one with observations has a line at the edge of its band; a clean
// pass has every line passing.
const INSP_LINES = (cls = '') => {
  const c = String(cls).toLowerCase()
  const has = (...k) => k.some((x) => c.includes(x))
  if (has('chiller', 'crah', 'crac', 'cool', 'pump', 'condenser', 'coil', 'ahu', 'fan', 'cdu', 'heat')) return [
    { text: 'General condition, mounting and no visible leaks', type: 'pass' },
    { text: 'Differential pressure across filter bank', type: 'reading', unit: 'Pa', limit: '<= 250', ok: 185, bad: 315 },
    { text: 'Supply / return temperature', type: 'reading', unit: 'C', limit: '7-12', ok: 9.4, bad: 15.2 },
    { text: 'Rotating-assembly vibration', type: 'reading', unit: 'mm/s', limit: '<= 4.5', ok: 2.6, bad: 6.9, critical: true },
    { text: 'Belt tension and drive alignment', type: 'pass' },
    { text: 'Condensate drain clear and trap primed', type: 'pass' },
    { text: 'Controls, set-points and alarms normal', type: 'pass', critical: true },
    { text: 'Housekeeping and labelling', type: 'done' },
  ]
  if (has('ups', 'battery', 'rectifier', 'inverter')) return [
    { text: 'Enclosure condition, ventilation and cleanliness', type: 'pass' },
    { text: 'DC bus voltage', type: 'reading', unit: 'V', limit: '384-456', ok: 432, bad: 472, critical: true },
    { text: 'Battery string impedance (worst cell)', type: 'reading', unit: 'mOhm', limit: '<= 5.0', ok: 3.6, bad: 6.4, critical: true },
    { text: 'Module / inlet temperature', type: 'reading', unit: 'C', limit: '<= 35', ok: 28, bad: 41 },
    { text: 'Cooling fans operational', type: 'pass' },
    { text: 'Alarm log reviewed and clear', type: 'pass' },
    { text: 'Thermographic scan of connections', type: 'done', critical: true },
  ]
  if (has('pdu', 'switchgear', 'transformer', 'panel', 'busway', 'distribution', 'breaker', 'rpp', 'sts')) return [
    { text: 'Enclosure, labelling and access clear', type: 'pass' },
    { text: 'Hottest termination (thermographic)', type: 'reading', unit: 'C', limit: '<= 60', ok: 44, bad: 78, critical: true },
    { text: 'Phase load balance', type: 'reading', unit: '%', limit: '<= 15', ok: 8, bad: 22 },
    { text: 'Incomer current', type: 'reading', unit: 'A', limit: 'within rating', ok: 620, bad: 940 },
    { text: 'Breaker operation and interlocks', type: 'pass', critical: true },
    { text: 'Protection relay indication normal', type: 'pass' },
    { text: 'Torque marks intact on terminations', type: 'done' },
  ]
  if (has('generator', 'genset', 'engine')) return [
    { text: 'Engine condition, no leaks, guards fitted', type: 'pass' },
    { text: 'Coolant level and temperature', type: 'reading', unit: 'C', limit: '<= 90', ok: 78, bad: 98 },
    { text: 'Oil pressure at idle', type: 'reading', unit: 'bar', limit: '>= 2.5', ok: 3.4, bad: 1.9, critical: true },
    { text: 'Fuel level and water-in-fuel', type: 'reading', unit: '%', limit: '>= 50', ok: 82, bad: 38 },
    { text: 'Crank batteries and charger', type: 'pass', critical: true },
    { text: 'Auto-start / transfer test', type: 'done', critical: true },
    { text: 'Exhaust and ventilation clear', type: 'pass' },
  ]
  if (has('bms', 'epms', 'dcim', 'control', 'plc', 'node', 'sensor', 'gateway', 'network')) return [
    { text: 'Controller and power supplies healthy', type: 'pass' },
    { text: 'I/O point sample vs field reference', type: 'reading', unit: '% err', limit: '<= 1.0', ok: 0.3, bad: 1.8 },
    { text: 'Redundant pair in sync', type: 'pass', critical: true },
    { text: 'Alarm and trend integrity', type: 'pass' },
    { text: 'Configuration backup taken', type: 'done', critical: true },
    { text: 'Firmware / patch level current', type: 'pass' },
  ]
  return [
    { text: 'General visual condition', type: 'pass' },
    { text: 'Key operating parameter', type: 'reading', unit: '', limit: 'within band', ok: 50, bad: 82 },
    { text: 'Fixings and connections secure', type: 'pass' },
    { text: 'Functional check', type: 'pass', critical: true },
    { text: 'Housekeeping and labelling', type: 'done' },
  ]
}

export function inspectionSheet(report) {
  if (!report) return []
  const lines = INSP_LINES(report.assetClass)
  const key = report.reportId || `${report.taskId}:${report.assetId}`
  const flagged = report.result === 'Failed' ? 2 : report.result === 'Passed with observations' ? 1 : 0
  const order = lines.map((_, i) => i).sort((a, b) => (seed(`${key}:o${a}`) - seed(`${key}:o${b}`)))
  const flaggedSet = new Set(order.slice(0, flagged))
  return lines.map((l, i) => {
    const isBad = flaggedSet.has(i)
    let response = 'pass'
    let note = null
    let value = null
    if (l.type === 'reading') {
      const jitter = (seed(`${key}:v${i}`) - 0.5) * ((l.ok || 1) * 0.06)
      const val = Math.round((isBad ? l.bad : l.ok + jitter) * 10) / 10
      value = `${val}${l.unit ? ` ${l.unit}` : ''} (limit ${l.limit})`
      if (isBad && report.result === 'Failed') { response = 'fail'; note = 'Outside limit - corrective work order raised.' }
      else if (isBad) { note = 'At the edge of the band - trending, no action this cycle.' }
    } else if (isBad) {
      if (report.result === 'Failed') { response = 'fail'; note = 'Did not meet the acceptance criterion.' }
      else { note = 'Minor observation corrected at the point of inspection.' }
    }
    return {
      itemId: `${key}-L${i + 1}`,
      text: l.text,
      responseType: l.type === 'reading' ? 'Reading' : l.type === 'done' ? 'Done / not done' : 'Pass / fail',
      response,
      value,
      note,
      critical: Boolean(l.critical),
      assetClass: report.assetClass,
      _illustrative: true,
    }
  })
}

// The blank sheet for conducting an inspection — the same class-appropriate
// lines, with nothing answered yet, for a technician to work through.
export function inspectionTemplate(assetClass) {
  return INSP_LINES(assetClass).map((l, i) => ({
    itemId: `L${i + 1}`,
    text: l.text,
    responseType: l.type === 'reading' ? 'Reading' : l.type === 'done' ? 'Done / not done' : 'Pass / fail',
    unit: l.unit || '',
    limit: l.limit || '',
    critical: Boolean(l.critical),
    isReading: l.type === 'reading',
  }))
}

// ── incidents, joined to the register ────────────────────────────────────
export const INCIDENT_ROWS = INCIDENTS.map((i) => {
  const asset = assetById.get(i.assetId)
  return {
    ...i,
    _asset: asset?.assetName || i.assetId,
    _assetClass: asset?.assetClass || null,
    _criticality: asset?.criticality || null,
    _site: asset?._site || i.siteId,
    _customerImpact: /^yes$/i.test(String(i.customerImpact || '').trim()),
  }
})

// ── summaries ────────────────────────────────────────────────────────────
export const INSPECTION_SUMMARY = {
  reports: INSPECTION_REPORTS.length,
  passed: INSPECTION_REPORTS.filter((r) => r.result === 'Passed').length,
  observations: INSPECTION_REPORTS.filter((r) => r.result === 'Passed with observations').length,
  failed: INSPECTION_REPORTS.filter((r) => r._failed).length,
  reminders: INSPECTION_REMINDERS.length,
  overdue: INSPECTION_REMINDERS.filter((r) => r._overdue).length,
  dueThisWeek: INSPECTION_REMINDERS.filter((r) => !r._overdue && r._daysAway <= 7).length,
  checklists: CHECKLISTS.length,
  checklistItems: CHECKLISTS.reduce((n, c) => n + c._itemCount, 0),
  incidents: INCIDENT_ROWS.length,
}

// ── checklists authored in the portal ────────────────────────────────────
//
// Same job as shapeInspection: a checklist written on the create screen is
// stored as sections of items, and every screen that shows checklists reads a
// flat list with counts on it. Flattening here means the authored ones and the
// library-derived ones are the same shape by construction, so the Checklist
// screen and Start New Inspection do not each need to know which is which.
/**
 * What a checklist item asks the technician to record.
 *
 * Two vocabularies land on the same field. The generated library writes a
 * sentence — "Pass / fail", "Reading" — because it was built before the
 * authoring screen existed. The builder writes the product's own value list,
 * `Pass_Fail` and `Range`, because that is what the product's generation
 * endpoint answers with and translating it at the boundary would mean
 * translating it back before every save.
 *
 * So both are read here, once, and every screen asks this rather than the
 * field. A run screen that reads `item.response` directly gets nothing from an
 * authored checklist and quietly offers a pass/fail button for a line that says
 * "measure" — which is the one thing a response type exists to prevent.
 */
export const RESPONSE_LABEL = {
  Pass_Fail: 'Pass / fail',
  Selection: 'Selection',
  Text: 'Text note',
  Numeric: 'Reading',
  Range: 'Reading',
  Photo: 'Photo',
  Signature: 'Signature',
}

export const responseOf = (item = {}) =>
  item.response || RESPONSE_LABEL[item.responseType] || item.responseType || 'Pass / fail'

/** Whether this item wants a number written against it, in either vocabulary. */
export const wantsReading = (item = {}) => responseOf(item) === 'Reading'

export function shapeChecklist(record) {
  // Sub-sections count. The builder nests items one level deeper for a round
  // that has stages inside a section — "Belt and drive" under "Fan" — and a
  // flatten that stops at the section reports a checklist as shorter than it
  // is, which is the number a technician plans their round against.
  const items = (record.sections || []).flatMap((s) => [
    ...(s.items || []).map((i) => ({ ...i, section: s.name })),
    ...(s.subSections || []).flatMap((ss) =>
      (ss.items || []).map((i) => ({ ...i, section: `${s.name} · ${ss.name}` }))),
  ])
  const classes = record.classes || []

  return {
    ...record,
    classes,
    items,
    appliesTo: ASSETS_IN_SCOPE.filter((a) => classes.includes(a.assetClass)).length,
    _itemCount: items.length,
    _criticalCount: items.filter((i) => i.critical).length,
    _classCount: classes.length,
    _sectionCount: (record.sections || []).length,
    lastUpdated: record.modifiedOn || record.createdOn,
    _created: true,
  }
}

// ── inspections raised in the portal ─────────────────────────────────────
//
// The create flow writes a record; this is what turns it into a row the list
// screens can show beside the generated ones. Shaping it here rather than in
// the form means the two kinds of row are the same shape by construction — a
// list that has to remember which of its rows came from where is a list that
// eventually forgets.

/** The next INS- number, above every id already in use. */
export function nextInspectionNumber(existing = []) {
  const used = [...INSPECTION_REPORTS, ...existing]
    .map((r) => Number(String(r.reportId || '').replace(/\D/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0)
  return `INS-${String(Math.max(90000, ...used) + 1).padStart(5, '0')}`
}

/**
 * A created inspection, in the shape the registers read.
 *
 * `_created` is what the screens key their "raised here" badge off. It is not
 * cosmetic: a demo audience should be able to tell the row they just made from
 * the forty-nine that were there before, and an inspection that quietly joins
 * the generated set is a row nobody can point at.
 */
export function shapeInspection(record) {
  const asset = assetById.get(record.assetId)
  const checklist = CHECKLISTS.find((c) => c.checklistId === record.checklistId)
  const items = record.items || []
  // "Not applicable" is not a pass. Counting it as one is how a checklist where
  // half the lines were skipped comes out at 100%.
  const graded = items.filter((i) => i.response === 'pass' || i.response === 'fail')
  const failed = graded.filter((i) => i.response === 'fail')
  const noted = items.filter((i) => i.note)

  const score = graded.length
    ? Math.round(((graded.length - failed.length) / graded.length) * 100)
    : 0

  const result = record.status !== 'Completed' ? 'In progress'
    : failed.length ? 'Failed'
      : noted.length ? 'Passed with observations'
        : 'Passed'

  return {
    ...record,
    reportId: record.reportId,
    task: checklist ? checklist.name : record.task || 'Ad-hoc inspection',
    taskId: record.checklistId || '—',
    standard: checklist ? `${checklist.category} round` : '—',
    frequency: checklist?.frequency || 'One-off',
    assetClass: asset?.assetClass || '—',
    criticality: asset?.criticality || '—',
    siteId: asset?.siteId || null,
    _asset: asset?.assetName || record.assetId,
    _site: asset?._site || '—',
    _location: asset?._location || '—',
    date: record.date,
    score,
    result,
    // The findings on a report are the technician's own notes against the lines
    // they wrote them on, plus whatever they typed at the end. Concatenated
    // here rather than in the screen so the record page and the list say the
    // same thing.
    findings: [
      ...noted.map((i) => `${i.text}: ${i.note}`),
      record.notes,
    ].filter(Boolean).join(' · ') || null,
    _failed: result === 'Failed',
    _created: true,
    _items: items,
    _graded: graded.length,
    _failedCount: failed.length,
    _itemCount: items.length,
  }
}
