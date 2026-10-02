'use client'

// Reliability-centred maintenance, over the plant this build is running.
//
// The analysis lives with the pack — function, functional failure, failure
// mode, effect, consequence, condition signal and task, written once per
// equipment type. This file joins it to the estate: which units of that type
// the site actually has, what they have failed on in the last year, and which
// of them carry the sensor the mode would be caught by.
//
// WHY THE ROW IS PER EQUIPMENT TYPE AND NOT PER UNIT. A plant with thirty
// curing presses has one press analysis, applied thirty times. Printing the
// same five modes against thirty asset numbers turns a decision document into
// a hundred and fifty lines of the same sentence, and the reader stops reading
// before the one mode that matters. The unit count and the units' own failure
// history sit on the row instead.
//
// WHY CONSEQUENCE DECIDES THE TASK, NOT THE RISK NUMBER. An RPN is a sort
// order. What a maintenance programme has to answer is different per class: a
// hidden failure needs a test, because nothing else will ever find it; a safety
// consequence needs a task that works or the design has to change; a production
// consequence is an economic decision. That logic is written out in
// `strategyFor` rather than being implied by a threshold.

import { useMemo } from 'react'
import PACK from './packs'
import tyreLibrary from './rcmLibraries/tyre'
import nestleLibrary from './rcmLibraries/nestle'
import { ASSETS, WORK_ORDERS, EPOCH, daysFrom } from './data'
import { useRecords } from './store'

// The pack's own analysis, where it has one.
export const RCM_LIBRARY = PACK?.rcm || null
export const RCM_ACTIVE = Boolean(RCM_LIBRARY?.equipment?.length)

/**
 * Every analysis this build can show.
 *
 * The plant's own comes first. After it come the industry libraries, which
 * every build carries: an analysis is knowledge about a class of machine, not
 * about one customer's estate, and a reliability conversation should not need
 * its own deployment to be had. On a build whose plant has none of that
 * equipment the library still reads — the screen says the register has no such
 * units, and the actions that need one are off.
 */
const REFERENCE_LIBRARIES = [nestleLibrary, tyreLibrary]

export const RCM_LIBRARIES = [
  ...(RCM_ACTIVE ? [{ ...RCM_LIBRARY, key: RCM_LIBRARY.key || 'plant', own: true }] : []),
  ...REFERENCE_LIBRARIES
    .filter((l) => !RCM_ACTIVE || l.key !== (RCM_LIBRARY.key || 'plant'))
    .map((l) => ({ ...l, own: false })),
]

// A build whose pack has its own analysis opens on it. Every other build opens
// on the first industry library rather than on the generic FMEA: the generic
// one is four modes that are true of any machine, and the library is the thing
// worth showing. The plant's own is one click away on the picker.
export const DEFAULT_LIBRARY_KEY = RCM_ACTIVE
  ? (RCM_LIBRARY.key || 'plant')
  : (REFERENCE_LIBRARIES[0]?.key || 'plant')
export const libraryFor = (key) => RCM_LIBRARIES.find((l) => l.key === key) || null

const WINDOW_DAYS = 365
const DAY = 86400000
const assetIdOf = (a) => a.asset_id || a.recordId
const woIdOf = (w) => w.workorder_id || w.recordId

export const CONSEQUENCES = ['Safety', 'Environment', 'Production', 'Hidden']

export const CONSEQUENCE_TONE = {
  Safety: 'red', Environment: 'amber', Production: 'blue', Hidden: 'violet',
}

export const STRATEGY_TONE = {
  'Failure-finding': 'violet',
  'Condition-based': 'blue',
  'Time-based': 'green',
  'Run to failure': 'grey',
  Redesign: 'red',
}

/**
 * What to do about a mode, decided the way RCM decides it.
 *
 * Hidden first, because a hidden failure is invisible by definition and no
 * amount of watching finds it — it is tested for, or it is not managed at all.
 * Then safety and environment, where the question is whether any task is
 * effective: if none is, the answer is to change the design, not to inspect
 * more often. Production consequences are last and are an economic choice —
 * watch it if there is something to watch, schedule it if there is not, and let
 * it run if neither is worth the money.
 */
export const strategyFor = ({ consequence, signal, pf, severity }) => {
  if (consequence === 'Hidden') return 'Failure-finding'
  if (consequence === 'Safety' || consequence === 'Environment') {
    if (signal && pf > 0) return 'Condition-based'
    if (pf > 0) return 'Time-based'
    return 'Redesign'
  }
  if (signal && pf > 0) return 'Condition-based'
  if (pf > 0) return 'Time-based'
  return severity >= 8 ? 'Redesign' : 'Run to failure'
}

// How hard the mode is to see coming, on the scale the RPN uses. A mode with a
// live signal on an instrumented unit is caught early; a hidden failure is, by
// its nature, the worst score there is until it is tested for.
const detectabilityFor = ({ consequence, signal, pf }, instrumented) => {
  if (consequence === 'Hidden') return 9
  if (signal && instrumented) return pf >= 60 ? 2 : 3
  if (signal) return 5
  return pf > 0 ? 6 : 8
}

const roundTo = (n) => Math.max(1, Math.round(n))

/**
 * The interval a task would be scheduled on, in the words a PM schedule uses.
 *
 * A watched mode is checked at half its warning time — that is what the P-F
 * interval is for. A mode with no warning keeps the interval the analysis
 * wrote, read out of its own words, because "every changeover" and "on cycle
 * count" are real intervals that no number of days describes.
 */
export function scheduleFor(mode) {
  const days = mode.pf > 0 ? Math.max(1, Math.round(mode.pf / 2)) : 0
  if (days >= 28) return { value: Math.max(1, Math.round(days / 30)), unit: 'Months', why: 'half the warning time' }
  if (days > 0) return { value: Math.max(1, Math.round(days / 7)), unit: 'Weeks', why: 'half the warning time' }

  const text = String(mode.interval || '').toLowerCase()
  if (/each shift|daily|every cycle/.test(text)) return { value: 1, unit: 'Weeks', why: 'the analysis asks for it every shift — the shortest a schedule carries is weekly' }
  if (/weekly/.test(text)) return { value: 1, unit: 'Weeks', why: 'as written in the analysis' }
  if (/monthly/.test(text) && !/6-monthly|six/.test(text)) return { value: 1, unit: 'Months', why: 'as written in the analysis' }
  if (/quarter/.test(text)) return { value: 3, unit: 'Months', why: 'as written in the analysis' }
  if (/6-monthly|six-monthly|semi/.test(text)) return { value: 6, unit: 'Months', why: 'as written in the analysis' }
  if (/annual|year/.test(text)) return { value: 12, unit: 'Months', why: 'as written in the analysis' }
  return { value: 1, unit: 'Months', why: 'no stated interval — monthly until the analysis is refined' }
}

/** A schedule's frequency in words: "every week", not "every 1 weeks". */
export const everyText = (plan) => (plan.value === 1
  ? `every ${plan.unit.toLowerCase().replace(/s$/, '')}`
  : `every ${plan.value} ${plan.unit.toLowerCase()}`)

/** What a work order raised from a mode should say it is for. */
export const sourceFor = (mode) => `RCM ${mode.kind} — ${mode.mode}`

/** The library a mode's page address belongs to, read back out of it. */
export const libraryKeyFromSlug = (slug) => String(slug || '').split('--')[0] || DEFAULT_LIBRARY_KEY

/**
 * The register entry for a piece of equipment the analysis knows and the plant
 * has not written down.
 *
 * An analysis read on a portal whose estate is something else has nothing to
 * raise work against, and a screen whose buttons are all greyed out is a
 * document, not a system. This is the missing first step, and it is a real one:
 * the reliability analysis names the machine, its purpose and how critical it
 * is, so registering it from here is better than typing it again into a form.
 * Once it exists the mode has a unit, and the other two actions come alive.
 *
 * `existing` is the register, used only for the number on the end of the code.
 */
export function registerEntry(mode, { site, location, existing = [] }) {
  const initials = String(mode.kind).split(' ').map((w) => w[0]).join('').slice(0, 4).toUpperCase()
  const n = existing.filter((a) => a.asset_type === mode.kind).length + 1
  return {
    asset_name: mode.kind,
    asset_type: mode.kind,
    manufacturer: '',
    model: '',
    serial_number: '',
    site_id: site?.site_id || '',
    site_name: site?.site_name || '',
    functional_location_id: location?.functional_location_id || '',
    functional_location_name: location?.name || '',
    criticality: mode.criticality || 'Medium',
    status: 'Operational',
    purchase_date: '',
    warranty_expiry: daysFrom(365),
    last_maintenance_date: daysFrom(0),
    next_maintenance_date: daysFrom(90),
    purchase_cost: 0,
    supplier: '',
    running_hours: 0,
    iot_enabled: false,
    notes: `Registered from the reliability analysis. ${mode.purpose}`,
    asset_code: `${site?.code || 'NEW'}-${initials}-${String(n).padStart(3, '0')}`,
    health_score: 100,
  }
}

/**
 * The analysis, joined to the estate.
 *
 * `scope` is the site filter from the page, so the counts follow the site the
 * reader is looking at rather than the whole company.
 */
export function useRcm(scope = (rows) => rows, libraryKey = DEFAULT_LIBRARY_KEY) {
  const assets = useRecords('asset', ASSETS, assetIdOf)
  const workOrders = useRecords('work_order', WORK_ORDERS, woIdOf)

  return useMemo(() => {
    const library = libraryFor(libraryKey)
    if (!library?.equipment?.length) return { stages: [], rows: [], totals: {}, equipment: [], library: null }

    const since = new Date(EPOCH).getTime() - WINDOW_DAYS * DAY
    const scoped = scope(assets)

    // Breakdowns in the last year, by asset. The analysis' own likelihood is a
    // starting point; what this plant has actually broken is better evidence,
    // and a screen that says "rare" about a machine that failed twice since
    // January is a screen nobody believes twice.
    const breakdownsBy = new Map()
    for (const w of scope(workOrders)) {
      if (w.work_order_type !== 'Breakdown') continue
      const when = new Date(w.created_date || w.due_date || 0).getTime()
      if (when < since) continue
      breakdownsBy.set(w.asset_id, (breakdownsBy.get(w.asset_id) || 0) + 1)
    }

    const stageLabel = new Map((library.stages || []).map((s) => [s.key, s.label]))
    const rows = []
    const equipment = []

    for (const eq of library.equipment) {
      const units = scoped.filter((a) => a.asset_type === eq.kind)
      const failures = units.reduce((n, a) => n + (breakdownsBy.get(assetIdOf(a)) || 0), 0)
      const instrumented = units.some((a) => a.iot_enabled)
      const worstUnit = [...units].sort(
        (a, b) => (breakdownsBy.get(assetIdOf(b)) || 0) - (breakdownsBy.get(assetIdOf(a)) || 0),
      )[0] || null

      // What this mode costs when it happens, and how much of the year it is
      // likely to take. Modelled, and labelled as modelled everywhere it shows:
      // the stop length is typical for the machine class and the rate follows
      // the occurrence score, because a customer's own downtime record is the
      // only thing that makes these numbers theirs.
      const stopHours = eq.stopHours || 4

      const eqRows = eq.modes.map((m, i) => {
        // The library's likelihood, raised by what these units have actually
        // done. Capped at ten because the scale is ten, and averaged over the
        // fleet so thirty presses with one failure between them do not read
        // like one press that failed thirty times.
        const perUnit = units.length ? failures / units.length : 0
        const occurrence = Math.min(10, roundTo(m.likelihood + perUnit * 2))
        const detectability = detectabilityFor(m, instrumented)
        const strategy = strategyFor(m)
        // Events a year per unit, from the occurrence score: ten is roughly
        // four a year, five is two, one is a fifth. A hidden failure is not
        // counted here — it does not stop the plant when it happens, it lets
        // something else through, and putting an hour figure on that would be
        // the wrong kind of certainty.
        const eventsPerYear = m.consequence === 'Hidden' ? 0 : Math.round((occurrence / 2.5) * 10) / 10
        const unitHours = Math.round(eventsPerYear * stopHours * 10) / 10
        return {
          id: `${eq.kind}-${i}`,
          // The address of this mode's own page. The library key travels in it
          // because two libraries can hold the same equipment, and a page that
          // guesses which one it is showing is a page that shows the wrong
          // analysis on a reload.
          slug: `${library.key}--${eq.kind.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}--${i}`,
          kind: eq.kind,
          stage: eq.stage,
          stageLabel: stageLabel.get(eq.stage) || eq.stage,
          criticality: eq.criticality,
          purpose: eq.purpose,
          units: units.length,
          unitsInstrumented: units.filter((a) => a.iot_enabled).length,
          failures,
          worstUnit,
          ...m,
          occurrence,
          detectability,
          rpn: m.severity * occurrence * detectability,
          strategy,
          // A mode with a signal nobody is reading is the gap worth naming: the
          // instrument exists in the design, and this plant has not fitted it.
          monitored: Boolean(m.signal) && instrumented,
          signalUnfitted: Boolean(m.signal) && !instrumented,
          // Check at half the warning, or the warning passes between checks.
          checkEveryDays: m.pf > 0 ? Math.max(1, Math.round(m.pf / 2)) : 0,
          // The worst this mode does, and what it is likely to cost the year.
          stopHours,
          eventsPerYear,
          unitHours,
          fleetHours: Math.round(unitHours * Math.max(units.length, 1) * 10) / 10,
          // The units this mode applies to, worst first — the row is per
          // equipment type, and a reader who wants the machine numbers should
          // not have to go and look them up.
          unitList: [...units]
            .map((a) => ({ asset: a, failures: breakdownsBy.get(assetIdOf(a)) || 0 }))
            .sort((x, y) => y.failures - x.failures),
        }
      })

      rows.push(...eqRows)
      equipment.push({
        kind: eq.kind,
        stage: eq.stage,
        stageLabel: stageLabel.get(eq.stage) || eq.stage,
        criticality: eq.criticality,
        purpose: eq.purpose,
        units: units.length,
        failures,
        modes: eqRows.sort((a, b) => b.rpn - a.rpn),
      })
    }

    const stages = (library.stages || []).map((s) => ({
      ...s,
      equipment: equipment.filter((e) => e.stage === s.key),
      modes: rows.filter((r) => r.stage === s.key).length,
    })).filter((s) => s.equipment.length)

    const byConsequence = Object.fromEntries(
      CONSEQUENCES.map((c) => [c, rows.filter((r) => r.consequence === c).length]),
    )

    return {
      library,
      stages,
      equipment,
      rows: [...rows].sort((a, b) => b.rpn - a.rpn),
      totals: {
        equipment: equipment.length,
        modes: rows.length,
        units: equipment.reduce((n, e) => n + e.units, 0),
        byConsequence,
        hidden: byConsequence.Hidden || 0,
        safety: (byConsequence.Safety || 0) + (byConsequence.Environment || 0),
        monitored: rows.filter((r) => r.monitored).length,
        signalUnfitted: rows.filter((r) => r.signalUnfitted).length,
        // Nothing to watch and nothing to test: the modes a programme can only
        // answer by scheduling work or by changing the design.
        blind: rows.filter((r) => !r.signal && r.consequence !== 'Hidden').length,
        redesign: rows.filter((r) => r.strategy === 'Redesign').length,
        failureFinding: rows.filter((r) => r.strategy === 'Failure-finding').length,
        conditionBased: rows.filter((r) => r.strategy === 'Condition-based').length,
        highRpn: rows.filter((r) => r.rpn > 200).length,
        mediumRpn: rows.filter((r) => r.rpn > 100 && r.rpn <= 200).length,
        lowRpn: rows.filter((r) => r.rpn <= 100).length,
        failures: equipment.reduce((n, e) => n + e.failures, 0),
        // The year's exposure if nothing is done about any of it, and the part
        // of that a condition task already stands between the plant and.
        exposureHours: Math.round(rows.reduce((n, r) => n + r.fleetHours, 0)),
        coveredHours: Math.round(rows.filter((r) => r.monitored)
          .reduce((n, r) => n + r.fleetHours, 0)),
      },
    }
  }, [assets, workOrders, scope, libraryKey])
}
