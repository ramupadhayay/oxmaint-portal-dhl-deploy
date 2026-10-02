'use client'

// The Inspection module, built from the facility the workbook describes.
//
// The workbook carries filters, integrity tests, leak readings, replacements
// and certification documents. It carries no inspection rounds, no reminders
// and no incidents — and those are three of the four screens the product ships
// under Inspection. So they are built here, from the workbook's own contents.
//
// Derived, not invented. Every round names a cleanroom that is on the register
// and a technician who appears on the test log; every incident names a filter
// that exists and a failure the register can corroborate. A module that
// invented its own rooms would be caught the first time somebody clicked
// through to one, which is the first thing a quality lead does.
//
// Deterministic, for the reason the rest of this portal is: a screen that shows
// different numbers on the second run cannot be rehearsed. The hash is seeded
// from each record's own identity, so the same room and round always produce
// the same inspection.
//
// What this is NOT: a second opinion on the integrity tests. A DOP/PAO scan is
// a test with a locked record and a penetration figure; an inspection round is
// somebody walking the room with a clipboard. Conflating them would put two
// different meanings of "passed" on one portal.

import { FILTER_VIEW, CLEANROOMS, TECHNICIANS, TEST_RECORDS, THRESHOLDS } from './index.js'
import { templateForRound } from '../checklists.js'
import { shift, daysFromToday, TODAY } from '../anchor.js'

/**
 * A checklist's steps, whatever shape the checklist is in.
 *
 * The library carries flat lists today and a sections → sub-sections → items
 * tree is being put behind the same export. Reading `.items` directly worked
 * until it didn't, and a register that silently reports every round as having
 * nought steps is the kind of breakage that renders fine and is wrong. So the
 * shape is asked rather than assumed, once, here.
 */
export function checklistSteps(template) {
  if (!template) return []

  const text = (item) => (typeof item === 'string' ? item : item?.text || item?.ItemDescription || item?.description || '')

  const fromItems = (list) => (Array.isArray(list) ? list.map(text).filter(Boolean) : [])

  const direct = fromItems(template.items || template.Items)
  if (direct.length) return direct

  const sections = template.sections || template.Sections || []
  const out = []
  for (const s of sections) {
    out.push(...fromItems(s.items || s.Items))
    for (const sub of s.subsections || s.subSections || s.SubSections || []) {
      out.push(...fromItems(sub.items || sub.Items))
    }
  }
  return out
}

/**
 * The same checklist as sections, for the screens that group by one.
 *
 * The product's results table and its conduct page are both organised
 * section → sub-section → item, and a flat checklist has to become one section
 * rather than none — a table with no group header renders, but the reader
 * cannot tell whether the grouping is missing or the checklist has one section.
 * Sub-sections are flattened into their parent here: this portal's checklists
 * are ten steps long, and a second level of heading on ten steps is furniture.
 */
export function checklistOutline(template) {
  if (!template) return []

  const text = (item) => (typeof item === 'string' ? item : item?.text || item?.ItemDescription || item?.description || '')
  const fromItems = (list) => (Array.isArray(list) ? list.map(text).filter(Boolean) : [])

  const sections = template.sections || template.Sections || []
  if (sections.length) {
    return sections.map((s, i) => ({
      name: s.name || s.SectionName || s.sectionName || `Section ${i + 1}`,
      items: [
        ...fromItems(s.items || s.Items),
        ...(s.subsections || s.subSections || s.SubSections || []).flatMap((sub) => fromItems(sub.items || sub.Items)),
      ],
    })).filter((s) => s.items.length)
  }

  const flat = fromItems(template.items || template.Items)
  return flat.length ? [{ name: template.name || 'Checklist', items: flat }] : []
}

// ── determinism ───────────────────────────────────────────────────────────
//
// FNV-1a with the avalanche step. Without the avalanche the last character
// dominates the low bits, and a list keyed on ids that differ only in their
// last digit comes out in visible runs — every third round failed, in order.
function seed(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i += 1) {
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

const DAY = 86400000
const dayOffset = (n) => new Date(TODAY + n * DAY).toISOString().slice(0, 10)

// ── the rounds this facility actually runs ────────────────────────────────
//
// Not a generic walk-round list. These are the five inspections a sterile
// fill-finish site does on its cleanrooms, each with the standard it is done
// against, so a row can be checked rather than only read.
//
// `notifyAt` is the hour the reminder for that round fires, and it is a
// property of the round rather than of the person: a pressure cascade has to be
// read before the suite comes up, an AHU check has to happen before the plant
// does, and a housing inspection can only be done once the room is shut down.
// Firing all five at nine in the morning would be a schedule nobody could work
// to, so each one carries the time its own procedure has to run at.
export const ROUND_TYPES = [
  {
    id: 'gowning',
    name: 'Gowning and personnel flow audit',
    standard: 'EU GMP Annex 1 §7',
    every: 'Weekly',
    everyDays: 7,
    what: 'Gowning sequence, airlock discipline, personnel flow against the approved route.',
    // Observed at the shift changeover, because that is when gowning actually
    // happens — an audit at midday watches an empty ante-room.
    notifyAt: '07:00',
    // The whole point of a gowning audit is that people are the largest
    // contamination source in a cleanroom, so this one runs weekly whatever
    // the filters are doing.
    applies: 'room',
  },
  {
    id: 'pressure',
    name: 'Pressure cascade round',
    standard: 'ISO 14644-3 §B.4',
    every: 'Daily',
    everyDays: 1,
    what: 'Differential across every door in the cascade, against the room’s design values.',
    // Before the suite comes up. A cascade read against a room already in
    // operation is a reading taken after the moment it was needed.
    notifyAt: '06:30',
    applies: 'room',
  },
  {
    id: 'housing',
    name: 'Filter housing and seal inspection',
    standard: 'ISO 14644-3 Annex B',
    every: 'Quarterly',
    everyDays: 91,
    what: 'Housing integrity, gasket seating, clamp torque, frame condition at each terminal filter.',
    // Hands on the housing, so it waits until the room is shut down at the end
    // of the day rather than interrupting a fill.
    notifyAt: '18:00',
    applies: 'filter',
  },
  {
    id: 'ahu',
    name: 'AHU and ductwork check',
    standard: 'Site SOP · mechanical',
    every: 'Monthly',
    everyDays: 30,
    what: 'Pre-filter condition, coil cleanliness, damper operation, duct leakage indicators.',
    // Ahead of the plant, because a damper stroked while the suites are
    // classified is a damper stroked against a room in use.
    notifyAt: '05:30',
    applies: 'room',
  },
  {
    id: 'em',
    name: 'Environmental monitoring round',
    standard: 'EU GMP Annex 1 §9',
    every: 'Weekly',
    everyDays: 7,
    what: 'Viable and non-viable particle counts at the fixed monitoring locations.',
    // Mid-operation on purpose: the counts that matter are the ones taken while
    // people are working in the room.
    notifyAt: '09:00',
    applies: 'room',
  },
]

export const roundById = (id) => ROUND_TYPES.find((r) => r.id === id) || null

const roomTypes = ROUND_TYPES.filter((r) => r.applies === 'room')
const filterTypes = ROUND_TYPES.filter((r) => r.applies === 'filter')

const inspectorNames = TECHNICIANS.map((t) => t.name)

// ── inspection reports: rounds already walked ─────────────────────────────
//
// Two per room per round type, and one per filter for the housing inspection.
// One per room per type would be a register with no range in it; every
// combination would be four hundred near-identical rows.
export const INSPECTION_REPORTS = (() => {
  const rows = []

  /**
   * @param when 'done'      — walked, carries a result and a score
   *             'progress'  — started today, no result yet
   *             'scheduled' — ahead of somebody, nothing captured
   *             'overdue'   — its date has passed and nobody walked it
   *
   * The register holds all four because the product's own screen counts
   * Pending and Overdue beside Completed, and a record opens on a round that
   * has not happened yet — its results panel is empty and its primary action is
   * Start. A register of none-but-finished rounds cannot produce that page.
   */
  const emit = (type, subject, i, when = 'done') => {
    const key = `${type.id}:${subject.id}:${i}:${when}`
    const cl = templateForRound(type.id)
    const steps = checklistSteps(cl)
    const reportId = `INS-${String(3000 + rows.length)}`

    const offset = when === 'done' ? -between(`${key}:d`, 2, Math.max(4, Math.round(type.everyDays * 2.5)))
      : when === 'progress' ? 0
        : when === 'overdue' ? -between(`${key}:d`, 2, 11)
          : between(`${key}:d`, 1, Math.max(3, type.everyDays))

    const walked = when === 'done'

    // Mostly passing. A cleanroom where a third of rounds fail is a cleanroom
    // that is not running, and the failures are what the findings hang off.
    const r = seed(`${key}:r`)
    const result = !walked ? null
      : r > 0.87 ? 'Fail' : r > 0.66 ? 'Pass with observations' : 'Pass'
    const score = !walked ? null
      : result === 'Pass' ? between(`${key}:s`, 93, 100)
        : result === 'Pass with observations' ? between(`${key}:s`, 76, 92)
          : between(`${key}:s`, 48, 75)

    const findings = walked && result !== 'Pass' ? findingsFor(type, subject, result, key) : []

    const inspector = pick(`${key}:who`, inspectorNames)

    // The room's own conditions at the time of the round. A cleanroom is held
    // to a temperature and a humidity band as much as to a particle count, and
    // the technician writes both on the sheet before the first reading — so the
    // record carries them rather than leaving the product's environment panel
    // permanently blank.
    const temperature = Math.round(between(`${key}:t`, 188, 224) / 10)
    const humidity = between(`${key}:h`, 38, 56)

    // Two durations, because the product distinguishes them and so does the
    // work: the planned figure is what the round is booked for and exists on a
    // round nobody has walked yet, the actual is what it took.
    const plannedMinutes = Math.max(15, steps.length * 5)

    rows.push({
      reportId,
      roundId: type.id,
      round: type.name,
      standard: type.standard,
      frequency: type.every,
      cleanroomId: subject.cleanroomId,
      cleanroomName: subject.cleanroomName,
      isoClass: subject.isoClass,
      filterId: subject.filterId || null,
      appliesTo: type.applies,
      date: dayOffset(offset),
      _daysAgo: -offset,
      inspector,
      // Who it is booked to, as against who walked it. The product carries both
      // and they are not the same question: a round assigned to a supervisor
      // and walked by a technician is the ordinary case.
      assignee: when === 'done' ? inspector : pick(`${key}:as`, inspectorNames),
      durationMinutes: walked ? between(`${key}:dur`, 15, 95) : null,
      plannedMinutes,
      temperature,
      humidity,
      result,
      score,
      // The same result as points out of the checklist's own steps, which is
      // how the product states a score beside the percentage. Derived from the
      // percentage rather than the other way round, so the two never disagree.
      scorePoints: score == null ? null : Math.round((score / 100) * steps.length),
      maxScore: steps.length,
      findings,
      findingsCount: findings.length,
      // Step by step, as the round was answered. Without this the record page's
      // results table has nothing to show on a round that was demonstrably
      // walked, which reads as data lost rather than as a screen with no source.
      results: walked ? resultsFor(steps, result, findings, subject, key) : [],
      // What the round asks of somebody next. Only on a failure: a pass with an
      // observation records the observation and the observation says what was
      // done, and a recommendation on every row is a field nobody reads.
      recommendedActions: result === 'Fail' ? recommendationFor(type, subject) : null,
      followUpRequired: result === 'Fail',
      followUpDate: result === 'Fail' ? dayOffset(offset + 7) : null,
      // A completed round is signed by the technician who walked it. That
      // signature is the record, which is why the product surfaces it.
      signatureCaptured: walked,
      // The checklist the round is carried out against, so the record can name
      // it the way the product does — by name and by code.
      checklistId: cl ? cl.id : null,
      checklistName: cl ? cl.name : type.name,
      checklistCode: `CHK${String(Math.floor(seed(`${cl ? cl.id : type.id}code`) * 90000000) + 10000000)}`,
      checklistSteps: steps.length,
      notes: when === 'scheduled' || when === 'overdue'
        ? `Inspection created from Reminder. ${type.what}`
        : walked ? null : `Round opened by ${inspector}. ${type.what}`,
      status: walked ? (result === 'Fail' ? 'Open finding' : 'Completed')
        : when === 'progress' ? 'In Progress'
          : when === 'overdue' ? 'Overdue' : 'Scheduled',
      _failed: result === 'Fail',
      _walked: walked,
      _overdue: when === 'overdue',
      _pending: when === 'scheduled' || when === 'progress',
    })
  }

  for (const c of CLEANROOMS) {
    const subject = {
      id: c.cleanroomId,
      cleanroomId: c.cleanroomId,
      cleanroomName: c.name,
      isoClass: c.isoClass,
    }
    for (const type of roomTypes) {
      emit(type, subject, 0)
      emit(type, subject, 1)
    }
  }

  for (const f of FILTER_VIEW) {
    const subject = {
      id: f.filterId,
      cleanroomId: f.cleanroomId,
      cleanroomName: f.cleanroomName,
      isoClass: f.isoClass,
      filterId: f.filterId,
    }
    for (const type of filterTypes) emit(type, subject, 0)
  }

  // The rounds that have not happened. Spread across the rooms rather than
  // stacked on one, because a single room holding every outstanding round reads
  // as a room in trouble rather than as an ordinary week.
  CLEANROOMS.forEach((c, n) => {
    const subject = { id: c.cleanroomId, cleanroomId: c.cleanroomId, cleanroomName: c.name, isoClass: c.isoClass }
    emit(roomTypes[n % roomTypes.length], subject, 9, 'scheduled')
    if (n % 2 === 0) emit(roomTypes[(n + 2) % roomTypes.length], subject, 8, 'scheduled')
    if (n === 1) emit(roomTypes[(n + 1) % roomTypes.length], subject, 7, 'progress')
    if (n === 3) emit(roomTypes[(n + 3) % roomTypes.length], subject, 6, 'overdue')
  })

  return rows.sort((a, b) => String(b.date).localeCompare(String(a.date)))
})()

/**
 * What the round found.
 *
 * Written per round type rather than from one generic list, because a gowning
 * finding and a duct finding have nothing in common and a register where every
 * observation reads the same is a register nobody reads twice.
 */
function findingsFor(type, subject, result, key) {
  const where = subject.filterId || subject.cleanroomName
  const OBSERVATIONS = {
    gowning: [
      'Second glove change skipped by one operator at the airlock; corrected at the point of inspection and retrained.',
      'Gowning sequence poster at the ante-room door is the superseded revision. Replaced.',
      'Personnel flow crossed the material route once during the observation window.',
    ],
    pressure: [
      `Differential at the ante-room door sitting at the low end of its band on ${where}. Within limits, trending.`,
      'Door held open beyond the interlock delay twice during the round; cascade recovered within seconds.',
      'One gauge reading 0.02 in. wg below the panel value; gauge scheduled for calibration check.',
    ],
    housing: [
      `Minor gasket compression set on ${where}. Within tolerance, re-check next cycle.`,
      `Clamp torque on ${where} below the SOP value at two positions; re-torqued during the inspection.`,
      'Housing frame shows light surface corrosion at one corner. Documented, no breach of the seal line.',
    ],
    ahu: [
      'Pre-filters at the upper end of their differential band; replacement scheduled with the next PM.',
      'Coil face has light debris on the upstream side. Cleaned during the visit.',
      'One damper actuator slow to respond to the controls signal; monitored.',
    ],
    em: [
      'Non-viable counts elevated at one monitoring location, still inside the class limit.',
      'Settle plate at the fill point showed a single colony; within the alert level, below action.',
      'One monitoring location partly obstructed by a transfer cart during the round.',
    ],
  }

  const FAILURES = {
    gowning: [
      'Operator entered the aseptic core without completing the sterile glove change. Room cleared, event escalated to Quality.',
      'Airlock interlock bypassed to move a cart. Gowning discipline finding raised against the shift.',
    ],
    pressure: [
      `Cascade reversed at one door on ${where} during the round. Room taken out of use pending investigation.`,
      `Differential below the minimum on ${where}. Batch operations suspended in the affected suite.`,
    ],
    housing: [
      `Gasket displacement found on ${where}. Filter cannot be relied on until re-tested; integrity test raised.`,
      `Housing seal breach at ${where}. Terminal filter isolated and a replacement scheduled with the OEM.`,
    ],
    ahu: [
      'Duct leakage audible downstream of the final filter bank. Section isolated pending repair.',
      'Damper failed closed during the check, collapsing supply to one zone. Corrective work order raised.',
    ],
    em: [
      'Non-viable counts exceeded the class action level at two locations. Room cleared and re-qualified.',
      'Viable count above the action level at the fill point. Investigation opened; batch under review.',
    ],
  }

  const list = result === 'Fail' ? FAILURES[type.id] : OBSERVATIONS[type.id]
  const n = result === 'Fail' ? between(`${key}:fn`, 1, 2) : between(`${key}:on`, 1, 2)

  const out = []
  for (let i = 0; i < n; i += 1) {
    const text = list[(Math.floor(seed(`${key}:f${i}`) * list.length) + i) % list.length]
    if (!out.includes(text)) out.push(text)
  }
  return out
}

/**
 * The round, step by step, as it was answered.
 *
 * A finding is not a separate thing from the checklist — it is the step that
 * did not pass, written up. So the findings are attached to steps rather than
 * floating beside them, and the step they land on is chosen from the round's
 * own key so the same round always fails the same step.
 *
 * A pass with an observation fails nothing. Its steps all pass and the ones
 * carrying an observation are marked out of spec and requiring action, which is
 * the distinction between "we should look at this" and "this room is not fit".
 */
function resultsFor(steps, result, findings, subject, key) {
  if (!steps.length) return []

  const flagged = new Set()
  findings.forEach((_, i) => {
    // Walk forward from the seeded position rather than re-rolling, so two
    // findings never land on one step and silently become one.
    let at = Math.floor(seed(`${key}:step${i}`) * steps.length) % steps.length
    while (flagged.has(at)) at = (at + 1) % steps.length
    flagged.add(at)
  })

  const flaggedOrder = [...flagged]
  const isFail = result === 'Fail'
  // The aseptic core is where a finding stops a batch. A gowning corridor is
  // not, and grading them the same makes the priority column meaningless.
  const core = subject.isoClass === 'ISO 5'

  return steps.map((text, i) => {
    const hit = flaggedOrder.indexOf(i)
    const isHit = hit !== -1
    return {
      itemNumber: String(i + 1),
      itemDescription: text,
      responseType: 'Pass_Fail',
      passFail: isHit ? !isFail : true,
      isWithinSpec: !isHit,
      requiresAction: isHit,
      priority: isHit ? (isFail ? (core ? 'Critical' : 'High') : 'Medium') : 'Low',
      comments: isHit ? findings[hit] : null,
      itemScore: isHit && isFail ? 0 : 1,
    }
  })
}

/** What the site is asked to do about a failed round, in its own words. */
function recommendationFor(type, subject) {
  const where = subject.filterId || subject.cleanroomName
  return {
    gowning: 'Retrain the shift against the gowning SOP and re-observe within the week. '
      + 'Quality to review whether any batch in progress was exposed.',
    pressure: `Hold ${where} out of use until the cascade is restored and verified across every door, `
      + 'then re-walk the round before the room is released.',
    housing: `Raise an integrity test against ${where}. The filter cannot be relied on until it passes, `
      + 'and the room stays out of use in the meantime.',
    ahu: 'Raise a corrective work order against the unit and re-check supply to the affected zone '
      + 'before the rooms downstream are used.',
    em: `Clear ${where}, re-clean and re-qualify against the class limits. `
      + 'Investigation to cover every batch since the last passing round.',
  }[type.id] || null
}

export const reportById = (id) => INSPECTION_REPORTS.find((r) => r.reportId === id) || null

/**
 * The people who walk the rounds, with the part of the site they belong to.
 *
 * The product's By Technician table carries a Department column, and the
 * workbook does not hold one. What it does hold is where each technician
 * worked, and on this site the answer is the same for all four: every one of
 * them appears against every cleanroom and against both disciplines — integrity
 * tests and differential readings. So they are one team, and the column says
 * so rather than being filled with an org chart nobody wrote. If the workbook
 * ever splits them, this is the one place that has to change.
 */
export const INSPECTORS = TECHNICIANS.map((t) => ({
  technicianId: t.technicianId,
  name: t.name,
  department: 'HEPA Certification',
  rooms: t.roomCount,
}))

export const inspectorByName = (name) => INSPECTORS.find((t) => t.name === name) || null

// ── reminders: rounds that are due ────────────────────────────────────────
//
// One per room per round type, and one per filter for the housing inspection —
// the same coverage as the reports, because a reminder that does not exist for
// a round somebody walks is a round that will be missed.
export const INSPECTION_REMINDERS = (() => {
  const rows = []

  const emit = (type, subject) => {
    const key = `rem:${type.id}:${subject.id}`
    // Spread across the cycle, with a few already past. A reminder list where
    // nothing is overdue is a list nobody opens.
    const due = between(`${key}:due`, -14, Math.max(3, Math.round(type.everyDays * 1.4)))

    // The last time this round was walked here, so the reminder can say what it
    // found rather than only when it is next needed.
    const last = INSPECTION_REPORTS
      .filter((r) => r._walked
        && r.roundId === type.id
        && r.cleanroomId === subject.cleanroomId
        && (type.applies === 'filter' ? r.filterId === subject.filterId : true))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null

    rows.push({
      reminderId: `REM-${String(4000 + rows.length)}`,
      roundId: type.id,
      round: type.name,
      standard: type.standard,
      frequency: type.every,
      intervalDays: type.everyDays,
      cleanroomId: subject.cleanroomId,
      cleanroomName: subject.cleanroomName,
      isoClass: subject.isoClass,
      filterId: subject.filterId || null,
      appliesTo: type.applies,
      dueDate: dayOffset(due),
      _daysAway: due,
      nextAfter: dayOffset(due + type.everyDays),
      // The hour the reminder fires, off the round rather than off the person.
      notifyAt: type.notifyAt,
      assignedTo: pick(`${key}:who`, inspectorNames),
      last,
      status: due < 0 ? 'Overdue' : due <= 2 ? 'Due today' : due <= 7 ? 'Due this week' : 'Scheduled',
      _overdue: due < 0,
      // An ISO 5 room is the aseptic core. A round slipping there is not the
      // same finding as one slipping in a gowning corridor, and the register
      // should not sort them together.
      _asepticCore: subject.isoClass === 'ISO 5',
    })
  }

  for (const c of CLEANROOMS) {
    const subject = { id: c.cleanroomId, cleanroomId: c.cleanroomId, cleanroomName: c.name, isoClass: c.isoClass }
    for (const type of roomTypes) emit(type, subject)
  }
  for (const f of FILTER_VIEW) {
    const subject = {
      id: f.filterId, cleanroomId: f.cleanroomId, cleanroomName: f.cleanroomName,
      isoClass: f.isoClass, filterId: f.filterId,
    }
    for (const type of filterTypes) emit(type, subject)
  }

  return rows.sort((a, b) => a._daysAway - b._daysAway)
})()

export const reminderById = (id) => INSPECTION_REMINDERS.find((r) => r.reminderId === id) || null

// ── incidents ─────────────────────────────────────────────────────────────
//
// The events a sterile facility actually records, each tied to something the
// register can corroborate. A contamination event on a filter whose integrity
// test passed and whose pressure never moved would be an incident the data
// contradicts, so the ones raised here are on filters that have a concern.
export const INCIDENTS = (() => {
  const troubled = FILTER_VIEW.filter((f) => f.concern)
  const clean = FILTER_VIEW.filter((f) => !f.concern)

  const KINDS = [
    {
      id: 'excursion',
      type: 'Particle count excursion',
      severity: 'Major',
      classification: 'Environmental',
      impact: 'Batch under review',
      why: (f) => `Non-viable counts exceeded the ${f.isoClass} action level in ${f.cleanroomName}. `
        + `${f.filterId} was the terminal filter serving the affected zone.`,
      // Three causes, because the register supports three different answers and
      // saying the wrong one is worse than saying nothing. A filter with a
      // failed test is the source; a filter carrying breaches was loading up;
      // a filter with neither did not cause this and the record should say so
      // rather than assert a count the leak sheet contradicts.
      root: (f) => (f.concern === 'Failed integrity test'
        ? `Integrity test on ${f.filterId} measured ${f.lastTest?.penetration} against a maximum of ${THRESHOLDS.penetration.value}. Filter bypass confirmed as the source.`
        : f.breachCount
          ? `Loading on ${f.filterId} reduced face velocity; ${f.breachCount} pressure readings over ${THRESHOLDS.pressureDifferential.value} in. wg in the preceding period.`
          : `No fault found on ${f.filterId}: its last integrity test passed and no differential reading has breached its band. Traced to activity in the room during the monitoring window.`),
    },
    {
      id: 'cascade',
      type: 'Pressure cascade loss',
      severity: 'Major',
      classification: 'Facility',
      impact: 'Suite cleared',
      why: (f) => `Differential across the ante-room door in ${f.cleanroomName} fell below the minimum and the cascade reversed briefly.`,
      root: (f) => (f.breachCount
        ? `Filter loading on ${f.filterId} reduced supply to the zone. ${f.breachCount} readings had already breached the differential threshold.`
        : `Supply to the zone fell away during a door cycle. ${f.filterId} stayed inside its differential band throughout, so the cascade rather than the filter is the finding.`),
    },
    {
      id: 'breach',
      type: 'Filter seal breach',
      severity: 'Critical',
      classification: 'Equipment',
      impact: 'Room out of use',
      why: (f) => `Seal breach found at the ${f.filterId} housing during a routine housing inspection in ${f.cleanroomName}.`,
      root: () => 'Gasket displacement during the last changeover. Post-installation test had not yet been completed against the unit.',
    },
    {
      id: 'gowning',
      type: 'Gowning discipline breach',
      severity: 'Minor',
      classification: 'Personnel',
      impact: 'No product impact',
      why: (f) => `An operator entered ${f.cleanroomName} without completing the sterile glove change.`,
      root: () => 'Observed during the weekly gowning audit. Retraining completed the same shift; no batch was in progress.',
    },
    {
      id: 'transfer',
      type: 'Material transfer deviation',
      severity: 'Minor',
      classification: 'Process',
      impact: 'No product impact',
      why: (f) => `A transfer cart was moved through the ${f.cleanroomName} airlock with the interlock held open.`,
      root: () => 'Cart oversized for the pass-through. Interlock bypass used rather than escalating. Procedure clarified.',
    },
  ]

  // Where in the room it happened. An excursion at the filling zone and one at
  // the stopper bowl are not the same finding, and the product carries the area
  // as its own field beside the location for exactly that reason.
  const AREAS = {
    excursion: ['Filling zone', 'Grade A workstation', 'Stopper bowl'],
    cascade: ['Ante-room door', 'Material airlock', 'Personnel airlock'],
    breach: ['Terminal filter housing', 'Supply plenum', 'Ceiling grid'],
    gowning: ['Gowning ante-room', 'Personnel airlock', 'Change room'],
    transfer: ['Material airlock', 'Pass-through hatch', 'Loading bay'],
  }

  // Annex 1 keeps two occupancy states and the distinction is the whole
  // argument: a count breached at rest is a facility problem, the same count
  // breached in operation may be the people in the room.
  const CONDITIONS = ['At rest', 'In operation']
  const ACTIVITIES = [
    'Aseptic filling', 'Line setup', 'Changeover',
    'Cleaning and sanitisation', 'Idle', 'Maintenance',
  ]

  // What the investigation filed the cause under. Fixed per event type rather
  // than chosen per row: a seal breach is a filter integrity cause wherever it
  // happens, and a register whose categories drift cannot be counted by them.
  const CAUSE_CATEGORY = {
    excursion: 'Environmental control loss',
    cascade: 'Lack of maintenance',
    breach: 'Filter or seal integrity',
    gowning: 'Operator or personnel practice',
    transfer: 'Operator or personnel practice',
  }

  const METHODS = ['5 Why', 'Ishikawa', 'Fault tree analysis']

  const CAPAS = {
    excursion: [
      'Filter replaced and post-installation integrity test passed. Room released.',
      'Monitoring frequency raised at the affected location until two consecutive clean rounds.',
    ],
    cascade: [
      'Differential monitoring interval shortened on the affected zone until the next certification.',
      'Pre-filter change brought forward and the door interlock delay re-set to the design value.',
    ],
    breach: [
      'Filter replaced and post-installation integrity test passed. Room released.',
      'Housing re-gasketed, clamp torque verified against the SOP, and the unit re-scanned.',
    ],
    gowning: [
      'Gowning SOP revised and retraining completed across all shifts.',
      'Second glove change added to the entry checklist and verified by the shift supervisor.',
    ],
    transfer: [
      'Pass-through sized for the transfer cart; interlock bypass removed from the procedure.',
      'Material transfer procedure clarified and the airlock interlock override locked out.',
    ],
  }

  // Severity is what happened; priority is what happens next. A critical
  // finding enters the queue a band above the routine work beside it, because
  // what it competes with is a scheduled filter change.
  const PRIORITY = { Critical: 'Urgent', Major: 'High', Minor: 'Medium' }

  // Every filter with a concern on it, then the two without.
  //
  // The first seven are the register as it stood when this module was built and
  // they keep their references; the rest carry it across the whole troubled part
  // of the estate, because the product's screen counts by month, by severity and
  // by state, and seven rows over eight months cannot fill those counts.
  const subjects = [...troubled.slice(0, 5), ...clean.slice(0, 2), ...troubled.slice(5)]

  return subjects.map((f, i) => {
    const kind = KINDS[i % KINDS.length]
    const key = `inc:${f.filterId}:${kind.id}`
    // An event on a filter whose latest integrity test failed is a recent one.
    // A failed test is that filter's *current* standing, and the excursion that
    // goes with it cannot sit eight months back without the two contradicting
    // each other. The rest spread across the year behind them.
    const daysAgo = f.concern === 'Failed integrity test'
      ? between(`${key}:d`, 2, 44)
      : between(`${key}:d`, 30, 250)
    const closed = seed(`${key}:c`) > 0.3

    // How long the investigation took, and when it shut. Never later than
    // today: a closure date in the future is the kind of thing an auditor spots
    // before anything else on the page.
    const daysToClose = closed ? Math.min(daysAgo, between(`${key}:ttc`, 3, 46)) : null
    const operator = pick(`${key}:op`, inspectorNames)

    const rootCause = kind.root(f)
    // The action that closed it, drawn from what that kind of event can be
    // closed by. Picked from one shared list it was possible to close a gowning
    // breach by resizing a pass-through, which is the sort of line a reviewer
    // stops on.
    const capa = closed ? pick(`${key}:capa`, CAPAS[kind.id]) : null

    // A formal analysis on the events that warrant one.
    //
    // Critical and major events get a written root cause analysis with actions
    // hung off it; a minor gowning slip closes on retraining the same shift.
    // Filing an Ishikawa against every glove change would make the ones that
    // matter impossible to find.
    const analysed = closed && kind.severity !== 'Minor'

    return {
      incidentId: `INC-${String(2100 + i)}`,
      type: kind.type,
      classification: kind.classification,
      severity: kind.severity,
      priority: PRIORITY[kind.severity],
      date: dayOffset(-daysAgo),
      // The hour matters on a fill line. A count breached during the night
      // shift and one breached mid-batch are read differently, so the record
      // carries the time the way the product's Date & Time field does.
      raisedAt: `${dayOffset(-daysAgo)}T${String(between(`${key}:h`, 0, 23)).padStart(2, '0')}:${String(between(`${key}:m`, 0, 59)).padStart(2, '0')}:00`,
      _daysAgo: daysAgo,
      filterId: f.filterId,
      cleanroomId: f.cleanroomId,
      cleanroomName: f.cleanroomName,
      isoClass: f.isoClass,
      area: pick(`${key}:area`, AREAS[kind.id]),
      // What the room was doing at the time. Annex 1's two occupancy states,
      // and the operation that was running — the pair a reviewer needs before
      // deciding whether the count was the facility or the people.
      roomCondition: pick(`${key}:cond`, CONDITIONS),
      roomActivity: pick(`${key}:act`, ACTIVITIES),
      operator,
      description: kind.why(f),
      // What broke, where anything did. Left null on the personnel and process
      // events rather than filled with "None" — a damages field that always has
      // words in it is a field nobody reads.
      equipmentDamage: kind.id === 'breach'
        ? `Gasket displaced at two clamp positions on ${f.filterId}. Housing frame and clamps undamaged.`
        : kind.id === 'cascade'
          ? `Pre-filters upstream of ${f.filterId} loaded beyond their differential band. No mechanical damage.`
          : null,
      rootCause,
      rootCauseCategory: CAUSE_CATEGORY[kind.id],
      analysisMethod: pick(`${key}:meth`, METHODS),
      // Recurring where the same filter has more than one thing wrong with it,
      // which is the register's own evidence rather than a coin toss.
      recurring: f.failCount > 0 && f.breachCount > 0,
      productImpact: kind.impact,
      // The certification document for the filter this happened on. An
      // investigation reaches for it first, so the record can name it rather
      // than sending the reader to the repository to search.
      documentRef: f.document?.documentRef || null,
      // A room out of use is downtime a board asks about. Minor personnel and
      // process events are not: recording an hour against them would inflate
      // the only number on the screen anybody adds up.
      downtimeHours: kind.id === 'breach' ? between(`${key}:dt`, 6, 34)
        : kind.id === 'excursion' ? between(`${key}:dt`, 2, 12)
          : kind.id === 'cascade' ? between(`${key}:dt`, 1, 6)
            : 0,
      reportedBy: pick(`${key}:who`, inspectorNames),
      // Found by a round, or found by the instruments. The split is the
      // argument for keeping both.
      foundBy: kind.id === 'breach' || kind.id === 'gowning' || kind.id === 'transfer'
        ? 'Inspection round'
        : 'Monitoring alarm',
      capa,
      closedOn: closed ? dayOffset(-daysAgo + daysToClose) : null,
      daysToClose,
      // The written analysis, where one was done. Shaped exactly as the one the
      // portal writes when somebody records an analysis here, so the record page
      // does not have to tell a seeded analysis from a filed one.
      rca: analysed
        ? {
          category: CAUSE_CATEGORY[kind.id],
          description: rootCause,
          analysisMethod: pick(`${key}:meth`, METHODS),
          recurring: f.failCount > 0 && f.breachCount > 0,
          contributingFactors: kind.id === 'breach'
            ? 'Changeover carried out on the back shift with one technician; the second check was not performed.'
            : kind.id === 'excursion'
              ? 'Filter approaching the end of its certified life, with the next scan not yet due.'
              : 'Pre-filter change slipped a cycle while the room was in continuous use.',
          // Satisfactory means the unit was fit to stay in service after the
          // event. On a seal breach it was not, and the register should not
          // pretend otherwise.
          assetConditionSatisfactory: kind.id !== 'breach',
          downtimeImpactHours: kind.id === 'breach' ? between(`${key}:dt`, 6, 34)
            : kind.id === 'excursion' ? between(`${key}:dt`, 2, 12)
              : between(`${key}:dt`, 1, 6),
          correctiveActions: [{
            description: capa,
            status: 'Completed',
            assignedTo: pick(`${key}:owner`, inspectorNames),
            dueDate: dayOffset(-daysAgo + daysToClose),
          }],
          createdBy: pick(`${key}:rcaby`, inspectorNames),
          createdOn: dayOffset(-daysAgo + Math.max(1, Math.round(daysToClose / 2))),
        }
        : null,
      status: closed ? 'Closed' : 'Under investigation',
      _open: !closed,
    }
  }).sort((a, b) => String(b.date).localeCompare(String(a.date)))
})()

export const incidentById = (id) => INCIDENTS.find((i) => i.incidentId === id) || null

// ── summaries ─────────────────────────────────────────────────────────────
export const INSPECTION_SUMMARY = {
  reports: INSPECTION_REPORTS.length,
  // Completed counts the rounds that produced a result, whether or not that
  // result was a pass. A failed round is finished — the finding it raised is a
  // separate piece of work, and folding the two together makes the completion
  // figure move when somebody closes a work order.
  completed: INSPECTION_REPORTS.filter((r) => r._walked).length,
  pending: INSPECTION_REPORTS.filter((r) => r._pending).length,
  overdue: INSPECTION_REPORTS.filter((r) => r._overdue).length,
  passed: INSPECTION_REPORTS.filter((r) => r.result === 'Pass').length,
  observations: INSPECTION_REPORTS.filter((r) => r.result === 'Pass with observations').length,
  failed: INSPECTION_REPORTS.filter((r) => r._failed).length,
  openFindings: INSPECTION_REPORTS.filter((r) => r.status === 'Open finding').length,
  // Averaged over the rounds that have a score, not over the register. A
  // scheduled round scoring nothing would drag the mean toward zero and the
  // number would fall every time somebody booked work in.
  averageScore: (() => {
    const scored = INSPECTION_REPORTS.filter((r) => typeof r.score === 'number')
    if (!scored.length) return 0
    return Math.round((scored.reduce((n, r) => n + r.score, 0) / scored.length) * 10) / 10
  })(),

  reminders: INSPECTION_REMINDERS.length,
  // Named apart from the reports' own overdue count above. Both were called
  // `overdue`, so the second quietly won and the reports figure was the
  // reminders figure — a number that looked right and counted the wrong list.
  remindersOverdue: INSPECTION_REMINDERS.filter((r) => r._overdue).length,
  dueThisWeek: INSPECTION_REMINDERS.filter((r) => !r._overdue && r._daysAway <= 7).length,
  overdueInCore: INSPECTION_REMINDERS.filter((r) => r._overdue && r._asepticCore).length,

  incidents: INCIDENTS.length,
  openIncidents: INCIDENTS.filter((i) => i._open).length,
  downtimeHours: INCIDENTS.reduce((n, i) => n + i.downtimeHours, 0),
  foundByRound: INCIDENTS.filter((i) => i.foundBy === 'Inspection round').length,
}
