'use client'

// The preventive-maintenance record, made whole.
//
// The PM compliance log the workbook carries is thin — a scheduled date, a
// completed date, a status and a team. That is enough to prove the baseline PM
// still runs, but not enough to read as a completed maintenance record: what was
// actually done on the visit, what was measured, how far off schedule it landed,
// and when it is due again. This module joins each log entry to its PM task and
// its asset (real), derives the schedule variance and the next-due date from the
// task's own cadence (real), and models the visit detail a PM produces — the
// checklist worked, the readings taken, the finding — clearly labelled as
// illustrative, the way the inspection and report modules model theirs. The
// workbook rows are never edited; everything added is read-time and marked.

import { PM_COMPLIANCE, PM_TASKS, assetById, ASSETS_IN_SCOPE } from './data'

export const PM_ESTIMATE = 'Illustrative — the visit detail is modelled from the PM type; the schedule dates, status and team are the workbook’s.'

// ── deterministic helpers (hydration-safe: no Date.now / Math.random / argless
// new Date; literal-string dates only) ──────────────────────────────────────
const h = (str) => { let x = 2166136261; for (const c of String(str)) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619) } return x >>> 0 }
const at = (d) => new Date(`${String(d).slice(0, 10)}T00:00:00`)
const daysBetween = (a, b) => Math.round((at(b) - at(a)) / 86400000)
const iso = (dt) => dt.toISOString().slice(0, 10)
const addMonths = (d, m) => { const dt = at(d); dt.setMonth(dt.getMonth() + m); return iso(dt) }
const between = (seed, lo, hi) => lo + (h(seed) % 1000) / 1000 * (hi - lo)
const round = (n, dp = 0) => { const p = 10 ** dp; return Math.round(n * p) / p }
const pick = (seed, arr) => arr[h(seed) % arr.length]

const FREQ_MONTHS = { Weekly: 0.25, Monthly: 1, 'Bi-monthly': 2, Quarterly: 3, 'Semi-annual': 6, 'Semi-Annual': 6, Annual: 12, Annually: 12, Yearly: 12, 'Every 3 Years': 36 }
const taskById = new Map(PM_TASKS.map((t) => [t.taskId, t]))

const TECHS = ['D. Reeve', 'T. Whelan', 'S. Kovac', 'M. Bell', 'E. Brandt', 'O. Marsh', 'A. Fenn']

// A PM checklist per discipline, keyed off words in the task name — the steps a
// technician ticks on the visit. Illustrative.
function stepsFor(task) {
  const t = String(task.task || '').toLowerCase()
  const cls = String(task.assetClass || '').toLowerCase()
  if (/filter/.test(t)) return ['Isolate under redundant path', 'Inspect filter media', 'Measure differential pressure', 'Replace filter if past ΔP limit', 'Log and restore to service']
  if (/battery|impedance|load/.test(t) || /ups|battery/.test(cls)) return ['Confirm float voltage', 'Measure per-cell internal resistance', 'Run timed load/discharge test', 'Check terminal torque and corrosion', 'Record capacity vs nameplate']
  if (/thermograph|electrical|breaker|switchgear/.test(t) || /switchgear|pdu|lvsg|hvsg/.test(cls)) return ['De-energise or scan under load', 'IR-scan busbars and terminations', 'Check breaker trip settings', 'Torque-audit connections', 'Log hotspots against baseline']
  if (/oil|dga|transformer/.test(t) || /transformer|xfmr/.test(cls)) return ['Sample oil for DGA', 'Check winding and top-oil temperature', 'Inspect bushings and tap changer', 'Verify cooling fans/pumps', 'Record gas ratios vs trend']
  if (/generator|load bank|genset|exercise/.test(t) || /generator|gen/.test(cls)) return ['Start and reach rated load', 'Run timed load-bank exercise', 'Check coolant, oil and fuel', 'Inspect exhaust and vibration', 'Log run hours and fault codes']
  if (/pump|coolant|water/.test(t) || /pump|chiller|cond|ctwr|crac/.test(cls)) return ['Check seal and bearing condition', 'Measure vibration and flow', 'Inspect coolant quality/level', 'Verify controls and setpoints', 'Log against baseline']
  return ['Isolate and make safe', 'Inspect per procedure', 'Take reference readings', 'Correct minor findings', 'Log and restore to service']
}

// Two or three key readings per discipline, plausible for the asset, with a
// pass/watch band. Illustrative.
function readingsFor(task, seed) {
  const t = `${task.task} ${task.assetClass}`.toLowerCase()
  const r = []
  if (/filter|crah|crac|air/.test(t)) { r.push({ label: 'Filter ΔP', value: round(between(seed + 1, 55, 135)), unit: 'Pa', limit: '≤ 250 Pa' }); r.push({ label: 'Supply air temp', value: round(between(seed + 2, 18, 24), 1), unit: '°C', limit: '18–24' }) }
  else if (/battery|ups|impedance/.test(t)) { r.push({ label: 'String voltage', value: round(between(seed + 1, 432, 440), 1), unit: 'V', limit: '432–440' }); r.push({ label: 'Worst-cell impedance', value: round(between(seed + 2, 0.28, 0.52), 3), unit: 'mΩ', limit: '≤ 0.60' }); r.push({ label: 'Capacity vs nameplate', value: round(between(seed + 3, 88, 99)), unit: '%', limit: '≥ 80%' }) }
  else if (/switchgear|breaker|thermograph|lvsg|hvsg|pdu/.test(t)) { r.push({ label: 'Peak ΔT vs baseline', value: round(between(seed + 1, 1.5, 9), 1), unit: '°C', limit: '≤ 15' }); r.push({ label: 'Busbar load', value: round(between(seed + 2, 42, 78)), unit: '% rated', limit: '≤ 80%' }) }
  else if (/oil|dga|transformer|xfmr/.test(t)) { r.push({ label: 'Top-oil temperature', value: round(between(seed + 1, 48, 72)), unit: '°C', limit: '≤ 90' }); r.push({ label: 'Total dissolved gas', value: round(between(seed + 2, 180, 640)), unit: 'ppm', limit: '≤ 720' }) }
  else if (/generator|genset|gen/.test(t)) { r.push({ label: 'Load-bank test', value: round(between(seed + 1, 92, 100)), unit: '% rated', limit: '≥ 90%' }); r.push({ label: 'Coolant temperature', value: round(between(seed + 2, 78, 92)), unit: '°C', limit: '≤ 95' }) }
  else { r.push({ label: 'Vibration', value: round(between(seed + 1, 0.8, 2.1), 2), unit: 'mm/s', limit: '≤ 2.8' }) }
  return r
}

const FINDINGS_OK = ['All parameters within limits; asset returned to service.', 'No exceptions; readings tracking the established baseline.', 'Nominal — no corrective action required.']
const FINDINGS_OBS = ['Minor finding logged for the watch list; no immediate action.', 'Reading trending toward its limit — flagged for the next visit.', 'Corrected a minor issue on site; within limits on completion.']

/**
 * Every PM compliance log entry, joined and enriched. Real fields carried from
 * the workbook; derived fields (variance, next due) computed; visit detail
 * (checklist, readings, finding) modelled and flagged _illustrative.
 */
export const PM_RECORDS = PM_COMPLIANCE.map((c) => {
  const task = taskById.get(c.taskId) || {}
  const asset = assetById.get(c.assetId) || null
  const seed = h(`${c.logId}:${c.taskId}:${c.assetId}`)
  const varianceDays = c.completedDate ? daysBetween(c.scheduledDate, c.completedDate) : null
  const freqM = FREQ_MONTHS[task.frequency] ?? 3
  const nextDue = addMonths(c.scheduledDate, Math.max(1, Math.round(freqM)))
  const onTime = /on time/i.test(c.status)
  const late = /late/i.test(c.status)
  const done = onTime || late
  const steps = stepsFor(task)
  const checklist = steps.map((step, i) => {
    const roll = h(seed + i * 13) % 100
    const result = !done ? 'Pending' : roll > 92 ? 'Corrected' : roll > 80 ? 'Observation' : 'Pass'
    return { step, result }
  })
  const hasObs = checklist.some((s) => s.result === 'Observation' || s.result === 'Corrected')
  return {
    ...c,
    _task: task,
    _asset: asset,
    _taskName: task.task || c.taskId,
    _assetName: asset?.assetName || c.assetId,
    _site: asset?._site || null,
    _location: asset?._location || null,
    _criticality: asset?.criticality || null,
    _frequency: task.frequency || null,
    _standard: task.standard || null,
    _discipline: asset?._category || task.assetClass || null,
    varianceDays,
    nextDue,
    _onTime: onTime,
    _late: late,
    _done: done,
    _durationHrs: round(between(seed + 71, 0.75, 4.5), 1),
    _technician: pick(seed + 72, TECHS),
    _checklist: done ? checklist : [],
    _readings: done ? readingsFor(task, seed) : [],
    _finding: !done ? 'Scheduled — not yet performed.' : hasObs ? pick(seed + 73, FINDINGS_OBS) : pick(seed + 74, FINDINGS_OK),
    _illustrative: true,
  }
})
export const pmRecordById = new Map(PM_RECORDS.map((r) => [r.logId, r]))

export function pmSummary(rows = PM_RECORDS) {
  const done = rows.filter((r) => r._done)
  const onTime = rows.filter((r) => r._onTime).length
  const late = rows.filter((r) => r._late).length
  const scheduled = rows.filter((r) => !r._done).length
  const adherence = done.length ? round((onTime / done.length) * 100) : 100
  const avgVariance = done.length ? round(done.reduce((s, r) => s + (r.varianceDays || 0), 0) / done.length, 1) : 0
  return { total: rows.length, onTime, late, scheduled, adherence, avgVariance }
}

// ── the calendar ─────────────────────────────────────────────────────────────
// The month's PM plan: the real logged/scheduled entries on their own dates,
// plus the recurring occurrences the PM cadence projects for the month (marked
// planned, so the calendar reads as a full month rather than four stray jobs).

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const pmMonthName = (m) => MONTH_NAMES[m]

const STATUS_TONE = {
  'Completed On Time': 'green', 'Completed Late': 'amber', Scheduled: 'blue', Planned: 'grey',
}
export const pmTone = (status) => STATUS_TONE[status] || 'grey'

// The months the workbook's own PM log spans, so the calendar opens on real data.
export const PM_MONTHS = [...new Set(PM_RECORDS.map((r) => r.scheduledDate.slice(0, 7)))].sort()

// Projected recurring PM occurrences for one asset+task in a given month.
function projectedOccurrence(task, asset, year, monthIdx) {
  const freqM = FREQ_MONTHS[task.frequency]
  if (!freqM) return null
  const absMonth = year * 12 + monthIdx
  const seed = h(`${task.taskId}:${asset.assetId}`)
  // A quarterly/annual task only lands in the months its phase selects.
  const period = Math.max(1, Math.round(freqM))
  if (period > 1 && absMonth % period !== seed % period) return null
  const day = 1 + (seed % 27) // 1–28, safe for every month
  return { day, taskId: task.taskId, assetId: asset.assetId }
}

/**
 * All PM occurrences in a month, as { date, day, taskId, assetId, task, asset,
 * status, tone, logId?, projected }. Real entries win over projected duplicates.
 */
export function pmForMonth(year, monthIdx) {
  const ymPrefix = `${year}-${String(monthIdx + 1).padStart(2, '0')}`
  const occ = []
  const claimed = new Set()

  // Real log entries scheduled this month.
  for (const r of PM_RECORDS) {
    if (r.scheduledDate.slice(0, 7) !== ymPrefix) continue
    claimed.add(`${r.taskId}:${r.assetId}`)
    occ.push({ date: r.scheduledDate, day: Number(r.scheduledDate.slice(8, 10)), taskId: r.taskId, assetId: r.assetId, task: r._taskName, asset: r._assetName, status: r.status, tone: pmTone(r.status), logId: r.logId, projected: false })
  }

  // Projected recurring occurrences the cadence implies, minus what is logged.
  for (const task of PM_TASKS) {
    const assets = ASSETS_IN_SCOPE.filter((a) => a.assetClass === task.assetClass)
    for (const a of assets) {
      if (claimed.has(`${task.taskId}:${a.assetId}`)) continue
      const p = projectedOccurrence(task, a, year, monthIdx)
      if (!p) continue
      const date = `${ymPrefix}-${String(p.day).padStart(2, '0')}`
      occ.push({ date, day: p.day, taskId: task.taskId, assetId: a.assetId, task: task.task, asset: a.assetName, status: 'Planned', tone: 'grey', projected: true })
    }
  }
  return occ.sort((x, y) => x.day - y.day)
}

// The 6×7 day grid for a month, Monday-first, with the occurrences bucketed.
export function pmGrid(year, monthIdx) {
  const first = at(`${year}-${String(monthIdx + 1).padStart(2, '0')}-01`)
  const startDow = (first.getDay() + 6) % 7 // Monday = 0
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate()
  const byDay = {}
  for (const o of pmForMonth(year, monthIdx)) { (byDay[o.day] = byDay[o.day] || []).push(o) }
  const cells = []
  for (let i = 0; i < 42; i += 1) {
    const dayNum = i - startDow + 1
    const inMonth = dayNum >= 1 && dayNum <= daysInMonth
    cells.push({ key: i, day: inMonth ? dayNum : null, items: inMonth ? (byDay[dayNum] || []) : [] })
  }
  return cells
}
