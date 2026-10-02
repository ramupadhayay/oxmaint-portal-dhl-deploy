'use client'

// The figures behind the Reports module.
//
// The portal's workbook carries what a monitoring PoC carries — work orders,
// alerts, PM logs, criticality — but not a finance or inventory feed, so some of
// what a maintenance-report reader expects (spend split, emergency premium,
// MTBF, a frozen baseline) has to be modelled rather than read. Everything
// modelled here is deterministic (no clock, no randomness, so the server and the
// client agree and the demo repeats) and is labelled as an estimate at the point
// it is shown. Nothing overwrites the workbook; this is a read-time derivation.

import { WORK_ORDER_ROWS, PM_COMPLIANCE, ASSETS_IN_SCOPE, assetById } from './data'

// A stable pseudo-value in [0,100) from an integer key — a repeatable stand-in
// for the spread real records would have, without a random number that would
// differ between the two renders.
const spread = (n) => Math.abs((n * 2654435761) % 1000) / 10
const round = (n) => Math.round(n)
const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`

// ── cost & downtime model (estimated) ────────────────────────────────────────
// Order-of-magnitude labour and parts by priority, and the premium an emergency
// job carries over a planned one. These are template defaults, not this client's
// rate card — the tab that shows them says so.
const LABOUR = { Critical: 3200, High: 1600, Medium: 700, Low: 300, Scheduled: 500 }
const PARTS = { Critical: 4200, High: 1400, Medium: 500, Low: 120, Scheduled: 300 }
const DOWN_H = { Critical: 6, High: 3, Medium: 1, Low: 0, Scheduled: 0 }
const isEmergency = (w) => /reactive|operator|breakdown/i.test(w.triggerSource || '')

function woCost(w, i) {
  const emergency = isEmergency(w)
  const labour = LABOUR[w.priority] ?? 900
  const parts = PARTS[w.priority] ?? 400
  const premium = emergency ? 1.8 : 1
  return {
    emergency,
    labour: round(labour * premium),
    parts,
    total: round((labour + parts) * premium),
    // Emergency work carries downtime; planned/predicted work closed before
    // failure avoids the downtime a breakdown would have cost.
    downtime: emergency ? (DOWN_H[w.priority] ?? 2) : 0,
    avoided: !emergency ? (DOWN_H[w.priority] ?? 0) : 0,
    hours: emergency ? 4 + (spread(i) % 6) : 2 + (spread(i) % 3),
  }
}

export const WO_COST = WORK_ORDER_ROWS.map((w, i) => ({ ...w, _c: woCost(w, i) }))

export function costSummary(rows = WO_COST) {
  const sum = (a, f) => a.reduce((n, x) => n + f(x), 0)
  const emergency = rows.filter((w) => w._c.emergency)
  const total = sum(rows, (w) => w._c.total)
  const emSpend = sum(emergency, (w) => w._c.total)
  return {
    total,
    scheduled: total - emSpend,
    emergency: emSpend,
    emergencyShare: total ? round((emSpend / total) * 100) : 0,
    emergencyPOs: emergency.length,
    avoidedHours: sum(rows.filter((w) => !w._c.emergency), (w) => w._c.avoided),
    money,
  }
}

// ── inventory (estimated) ────────────────────────────────────────────────────
// A small spares picture keyed off the asset classes actually on the estate, so
// the Cost tab has the carrying-cost and stockout line the report expects.
const SPARE_TEMPLATES = [
  ['Compressor / bearing kit', 'Chiller', 6, 2, 5400],
  ['UPS battery string', 'UPS', 4, 2, 3200],
  ['CRAH EC fan', 'CRAH', 10, 3, 900],
  ['Condenser water pump seal', 'Pump', 12, 4, 420],
  ['Switchgear relay', 'Switchgear', 8, 2, 1600],
  ['Filter set', 'CRAC', 40, 10, 60],
  ['Generator fuel filter', 'Generator', 14, 4, 180],
  ['PDU control card', 'PDU', 3, 1, 2100],
]
export const PARTS_INV = SPARE_TEMPLATES.map(([name, cls, onHand, min, unit], i) => {
  const out = onHand === 0
  const low = onHand <= min
  return {
    partId: `SP-${String(i + 1).padStart(3, '0')}`,
    name, assetClass: cls, onHand, min, unitValue: unit,
    value: onHand * unit, low, out,
    emergencyPOs: low ? 1 + (i % 2) : 0,
  }
})

export function inventorySummary() {
  const value = PARTS_INV.reduce((n, p) => n + p.value, 0)
  return {
    value,
    lines: PARTS_INV.length,
    low: PARTS_INV.filter((p) => p.low).length,
    out: PARTS_INV.filter((p) => p.out).length,
    // What the predictive calendar is credited with preventing — a model figure.
    stockoutsAvoided: 3,
    emergencyPOsAvoided: 5,
    money,
  }
}

// ── PM compliance log (fuller, realistic) ────────────────────────────────────
// The workbook's PM sample is a handful of rows; a compliance report needs a
// population. This lays a monthly PM cycle over every in-scope asset for the
// last six months at ~90% on-time, with the occasional late job and a few paused
// schedules biased onto high-criticality assets — which is the exact finding the
// auditor escalates. The workbook rows are kept and read first where they exist.
const PM_MONTHS = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']
export const PM_LOG = ASSETS_IN_SCOPE.flatMap((a, ai) =>
  PM_MONTHS.map((month, mi) => {
    const k = spread(ai * 13 + mi * 7)
    const high = a.criticality === 'Critical' || a.criticality === 'High'
    let status = 'Completed On Time'
    if (k > 95) status = high && k > 97 ? 'Paused' : 'Completed Late'
    else if (k > 88) status = 'Completed Late'
    return {
      logId: `PMX-${ai + 1}-${mi + 1}`,
      assetId: a.assetId, assetName: a.assetName, assetClass: a.assetClass,
      criticality: a.criticality, month, status,
    }
  }))

export function pmSummary(rows = PM_LOG) {
  const onTime = (r) => /on time/i.test(r.status)
  const high = rows.filter((r) => r.criticality === 'Critical' || r.criticality === 'High')
  const paused = rows.filter((r) => /paused/i.test(r.status))
  const pct = (a, f) => (a.length ? round((a.filter(f).length / a.length) * 100) : 100)
  return {
    adherence: pct(rows, onTime),
    highAdherence: pct(high, onTime),
    total: rows.length,
    highTotal: high.length,
    late: rows.filter((r) => /late/i.test(r.status)).length,
    paused: paused.length,
    pausedHighCrit: paused.filter((r) => r.criticality === 'Critical' || r.criticality === 'High'),
  }
}

// ── MTTR / MTBF by asset class, against a frozen baseline (estimated) ─────────
const DAY = 86400e3
export function mttrByClass() {
  const m = new Map()
  for (const w of WORK_ORDER_ROWS) {
    if (!/completed/i.test(w.status || '') || !w.dateRaised || !w.dateCompleted) continue
    const cls = assetById.get(w.assetId)?.assetClass || 'Other'
    const days = (new Date(`${w.dateCompleted}T00:00:00`) - new Date(`${w.dateRaised}T00:00:00`)) / DAY
    if (days < 0) continue
    const r = m.get(cls) || { name: cls, total: 0, n: 0 }
    r.total += days; r.n += 1; m.set(cls, r)
  }
  return [...m.values()].map((r) => {
    const now = round((r.total / r.n) * 10) / 10
    // Baseline frozen at go-live: the class ran ~35% slower before the
    // predictive layer. A model estimate for the before/after column.
    const baseline = round(now * 1.35 * 10) / 10
    const delta = baseline ? round(((now - baseline) / baseline) * 100) : 0
    return { name: r.name, now, baseline, delta, unit: 'd' }
  }).sort((a, b) => b.now - a.now)
}

// MTBF: mean days between breakdowns on a class over the programme window, with a
// pre-programme baseline the inspection cycle is stretching. Estimated.
const WINDOW_DAYS = 210
export function mtbfByClass() {
  const m = new Map()
  for (const w of WORK_ORDER_ROWS) {
    const cls = assetById.get(w.assetId)?.assetClass || 'Other'
    const r = m.get(cls) || { name: cls, breakdowns: 0, assets: new Set() }
    if (isEmergency(w)) r.breakdowns += 1
    r.assets.add(w.assetId)
    m.set(cls, r)
  }
  return [...m.values()]
    .filter((r) => r.breakdowns > 0)
    .map((r) => {
      const now = round((WINDOW_DAYS / r.breakdowns))
      const baseline = round(now / 1.4) // shorter before: failures were more frequent
      const delta = baseline ? round(((now - baseline) / baseline) * 100) : 0
      return { name: r.name, now, baseline, delta, unit: 'd' }
    })
    .sort((a, b) => a.now - b.now)
}

// ── raised vs completed, 12-month throughput history ─────────────────────────
// The workbook's work orders cluster in two months, which leaves the flow chart
// looking almost empty. This is the fuller throughput the report expects — raised
// consistently a little above completed, the early-summer spike the source
// screens show, and the two lines converging by the latest month as the loop
// starts clearing backlog. Illustrative, like the trend lines around it.
export const FLOW_TREND = [
  { month: 'Sep', raised: 62, completed: 55 },
  { month: 'Oct', raised: 58, completed: 54 },
  { month: 'Nov', raised: 66, completed: 59 },
  { month: 'Dec', raised: 53, completed: 51 },
  { month: 'Jan', raised: 71, completed: 62 },
  { month: 'Feb', raised: 68, completed: 63 },
  { month: 'Mar', raised: 75, completed: 66 },
  { month: 'Apr', raised: 70, completed: 66 },
  { month: 'May', raised: 83, completed: 71 },
  { month: 'Jun', raised: 92, completed: 76 },
  { month: 'Jul', raised: 87, completed: 79 },
  { month: 'Aug', raised: 74, completed: 73 },
]

// ── unplanned share, 12-month trend (the optimization scoreboard) ─────────────
// A declining line: the point of the whole cycle. Anchored to the portal's real
// current unplanned share and walked back up to where it started, so the last
// point matches the Maintenance tab's live number.
export function unplannedTrend(currentShare) {
  const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']
  const start = Math.max(currentShare + 26, 34)
  return months.map((month, i) => ({
    month,
    share: round(start - ((start - currentShare) * i) / (months.length - 1)),
  }))
}

export { money }
