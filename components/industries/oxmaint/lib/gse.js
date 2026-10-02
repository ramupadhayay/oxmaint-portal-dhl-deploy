'use client'

// The GSE module's data layer.
//
// A ground support fleet is not a plant. A plant asks "is this machine healthy";
// a ramp asks "do I have a working belt loader at gate 14 in twenty minutes".
// The difference runs through everything here: readiness is counted by class and
// by station rather than by unit, hours matter only on the things that have an
// engine, and a deicer that is perfect in July is still a problem if it will not
// be ready by November.
//
// Everything is derived from the estate the pack already generates — no second
// set of assets, no numbers that can disagree with the register. What is added
// is the GSE-specific reading of them: which unit is powered, what its meter
// says, what its battery is doing, and whether its class has enough serviceable
// units left to cover the ramp.

import {
  ASSETS, WORK_ORDERS, PM_SCHEDULES, SITES, DOMAIN, EPOCH,
  seed, between, daysUntil, isPast,
} from './data'

// The module is this pack's, not any pack's. A chiller demo that wandered onto
// these screens would be shown a fleet it does not have.
export const GSE_ACTIVE = DOMAIN?.key === 'gse'

const D = GSE_ACTIVE ? DOMAIN : null

const POWERED = new Set(D?.poweredKinds || [])
const ELECTRIC = new Set(D?.electricKinds || [])

// A dataset asset says what it is — its class — so that wins over a list of
// type names. Snow fleet is diesel plant on hour meters, so it counts as powered.
export const isPowered = (a) => (a?.dhl_class
  ? a.dhl_class === 'Power' || a.dhl_class === 'Snow'
  : POWERED.has(a?.asset_type))

/**
 * Which powered units are electric.
 *
 * The pack names the classes being electrified rather than the individual
 * units, because a fleet mid-transition has both — some tugs are battery, the
 * rest are still diesel. Splitting on a seeded hash of the unit's own id keeps
 * the same units electric on every render and every screen.
 */
export const isElectric = (a) => {
  if (!isPowered(a)) return false
  // The register's own power source when it has one. The hash is only for a
  // generated fleet that names classes rather than units.
  if (a.power_source) return a.power_source === 'Electric'
  return ELECTRIC.has(a.asset_type) && seed(`${a.asset_id}-elec`) > 0.55
}

// Out of service means it cannot go to the ramp. The register's own status is
// the source; this only names the ones that count as down, so a screen and a
// count can never disagree about what "available" means.
const DOWN_STATUS = new Set(['Down', 'Out of Service', 'Breakdown', 'Under Maintenance', 'Retired'])

export const isDown = (a) => DOWN_STATUS.has(a?.status)

/**
 * The hour meter.
 *
 * `running_hours` is on every asset the pack generates, but it means nothing on
 * a dolly. Powered units get their reading; everything else gets null, and the
 * screens show a dash rather than a zero — a dolly with "0 hours" reads as a
 * dolly that has never been used.
 */
export const metersOf = (a) => {
  if (!isPowered(a)) return null
  const hours = Number(a.running_hours) || 0
  // How hard this unit is worked, in hours a day. A hub tug and a gateway
  // forklift are not the same animal, and the difference is what decides
  // whether a service is three weeks away or three days.
  const perDay = a.hours_per_year
    ? Number((a.hours_per_year / 365).toFixed(1))
    : Number((between(`${a.asset_id}-perday`, 20, 115) / 10).toFixed(1))
  // Days since the meter was last read, from the reading itself when there is
  // one. A dataset read quarterly will show readings weeks old — which is the
  // finding, not a fault in the screen.
  const lastRead = a.last_reading_date
    ? Math.max(0, Math.round((EPOCH - new Date(a.last_reading_date).getTime()) / 86400000))
    : between(`${a.asset_id}-lastread`, 0, 21)
  return { hours, perDay, daysSinceRead: lastRead }
}

/**
 * Where this unit sits against its tiered engine-hour services.
 *
 * The tiers are cumulative — a 1000-hour service includes the 500, which
 * includes the 250 — so the question is not "which tier" but "how far past the
 * last one of each". The nearest tier due is the one that matters.
 */
export function serviceStatus(a) {
  const m = metersOf(a)
  // A unit with its own interval is serviced at that interval and twice it; the
  // pack's generic tiers are only for a fleet that does not say.
  const own = Number(a.pm_hours_interval) || 0
  const defs = own
    ? [
      { hours: own, label: `${own}-hour service`, body: 'Service at the unit\'s own interval.' },
      { hours: own * 2, label: `${own * 2}-hour service`, body: 'Major service at twice the interval.' },
    ]
    : (D?.serviceTiers || [])
  if (!m || !defs.length) return null
  // Measured from the meter at the last service when the schedule knows it,
  // rather than assuming the unit was serviced on a round number.
  const sched = PM_SCHEDULES.find((s) => s.asset_id === a.asset_id && s.meter_interval)
  const tiers = defs.map((t, i) => {
    const into = i === 0 && sched ? Math.max(0, m.hours - (Number(sched.meter_at_last) || 0)) : m.hours % t.hours
    const remaining = t.hours - into
    return {
      ...t,
      hoursIn: into,
      hoursRemaining: remaining,
      // At this unit's own rate, not at an average. An average is how a fleet
      // report says "due next month" about a tug that will get there Friday.
      daysRemaining: m.perDay > 0 ? Math.round(remaining / m.perDay) : null,
      due: remaining <= t.hours * 0.05,
    }
  })
  const next = tiers.reduce((best, t) => (best && best.hoursRemaining <= t.hoursRemaining ? best : t), null)
  return { ...m, tiers, next }
}

/**
 * Traction battery condition.
 *
 * State of health falls with age and with cycles, so it is derived from the
 * unit's own purchase date rather than drawn at random — a battery in a
 * six-month-old tug reporting 71% would be the first thing a fleet engineer
 * disbelieved.
 */
export function batteryOf(a) {
  if (!isElectric(a)) return null
  const ageDays = a.purchase_date
    ? Math.max(0, Math.round((new Date(EPOCH) - new Date(a.purchase_date)) / 86400000))
    : 400
  const years = ageDays / 365
  const cycles = Math.round(years * between(`${a.asset_id}-cyc`, 240, 330))
  // Roughly 4% a year plus a unit-specific spread. Nothing below 62%, because a
  // pack below that would have been replaced rather than reported.
  const wear = years * 4 + (between(`${a.asset_id}-wear`, 0, 60) / 10)
  const soh = Math.max(62, Math.min(100, Math.round(100 - wear)))
  return {
    soh,
    cycles,
    years: Number(years.toFixed(1)),
    // What the shop does about it. Three words, because a number on its own
    // starts an argument about what the number means.
    verdict: soh >= 85 ? 'Healthy' : soh >= 75 ? 'Monitor' : soh >= 68 ? 'Plan replacement' : 'Replace',
    charge: between(`${a.asset_id}-soc`, 35, 99),
  }
}

/** Every unit, with the GSE reading of it attached. */
export function fleet() {
  if (!GSE_ACTIVE) return []
  return ASSETS.map((a) => ({
    ...a,
    _powered: isPowered(a),
    _electric: isElectric(a),
    _down: isDown(a),
    _service: serviceStatus(a),
    _battery: batteryOf(a),
  }))
}

/**
 * Readiness by equipment class.
 *
 * This is the module's whole reason for existing. A ramp does not care that 94%
 * of the estate is serviceable; it cares that two of its three container
 * loaders are down, because the third one cannot load three aircraft at once.
 * So availability is counted per class, and a class is called short when what
 * is left will not cover the ramp.
 */
export function readiness(rows, siteId = null) {
  const inScope = siteId ? rows.filter((a) => a.site_id === siteId) : rows
  const byClass = new Map()
  for (const a of inScope) {
    const c = byClass.get(a.asset_type) || { kind: a.asset_type, powered: a._powered, total: 0, down: 0, units: [] }
    c.total += 1
    if (a._down) c.down += 1
    c.units.push(a)
    byClass.set(a.asset_type, c)
  }
  return [...byClass.values()].map((c) => {
    const ready = c.total - c.down
    const pct = c.total ? Math.round((ready / c.total) * 100) : 100
    return {
      ...c,
      ready,
      pct,
      // A class with one unit left is a single point of failure whatever the
      // percentage says; a class of forty dollies missing three is not.
      critical: ready === 0 || (c.powered && ready <= 1 && c.total > 1),
      short: pct < 80,
    }
  }).sort((a, b) => a.pct - b.pct)
}

/** The open work holding a unit off the ramp. */
export function blockers(rows) {
  const open = WORK_ORDERS.filter((w) => !['Completed', 'Closed', 'Cancelled'].includes(w.status))
  const byAsset = new Map()
  for (const w of open) {
    const list = byAsset.get(w.asset_id) || []
    list.push(w)
    byAsset.set(w.asset_id, list)
  }
  return rows
    .filter((a) => a._down)
    .map((a) => ({ asset: a, jobs: byAsset.get(a.asset_id) || [] }))
    .sort((a, b) => b.jobs.length - a.jobs.length)
}

/**
 * Seasonal readiness.
 *
 * Counts down to the date the pack names, and judges each unit on whether it
 * has been serviced recently enough to be trusted through the season. Outside
 * the run-up the season is still shown — a department that only looks at its
 * deicers in October is the department this screen exists to prevent.
 */
export function seasons(rows) {
  if (!D?.seasonal?.length) return []
  const today = new Date(EPOCH)
  return D.seasonal.map((s) => {
    const [mm, dd] = s.readyBy.split('-').map(Number)
    let target = new Date(Date.UTC(today.getUTCFullYear(), mm - 1, dd))
    if (target < today) target = new Date(Date.UTC(today.getUTCFullYear() + 1, mm - 1, dd))
    const days = Math.round((target - today) / 86400000)
    const units = rows.filter((a) => s.kinds.includes(a.asset_type))
    const graded = units.map((a) => {
      const serviced = a.last_maintenance_date ? Math.abs(daysUntil(a.last_maintenance_date)) : 999
      // Serviced within six months and not down. A deicer signed off in March
      // is not ready for November, whatever its status field says.
      const ready = !a._down && serviced <= 180
      return { ...a, _servicedDaysAgo: serviced, _seasonReady: ready }
    })
    const ready = graded.filter((u) => u._seasonReady).length
    return {
      ...s,
      target: target.toISOString().slice(0, 10),
      daysToTarget: days,
      units: graded,
      ready,
      notReady: graded.length - ready,
      pct: graded.length ? Math.round((ready / graded.length) * 100) : 100,
    }
  }).sort((a, b) => a.daysToTarget - b.daysToTarget)
}

/** PM compliance, the figure an ISAGO audit opens with. */
export function pmCompliance() {
  const live = PM_SCHEDULES.filter((p) => p.status !== 'Paused')
  if (!live.length) return { pct: 100, total: 0, overdue: 0 }
  const overdue = live.filter((p) => isPast(p.next_due)).length
  return {
    pct: Math.round(((live.length - overdue) / live.length) * 100),
    total: live.length,
    overdue,
  }
}

export const siteName = (id) => SITES.find((s) => s.site_id === id)?.site_name || id

/** The RFP matrix, scored. `partial` counts as half — an evaluator would. */
export function rfpScore() {
  const areas = D?.rfpAreas || []
  const all = areas.flatMap((a) => a.items)
  const yes = all.filter((i) => i.state === 'yes').length
  const partial = all.filter((i) => i.state === 'partial').length
  const roadmap = all.filter((i) => i.state === 'roadmap').length
  return {
    areas,
    total: all.length,
    yes,
    partial,
    roadmap,
    pct: all.length ? Math.round(((yes + partial * 0.5) / all.length) * 100) : 0,
  }
}
