// One shift, in the order it should be walked.
//
// data.js says what the property is and where the rotation has got to. This
// turns that into the answer to the only question the rest of the portal does
// not ask: what does one person do today.
//
// The order is not a preference. Catch-up first, because an overdue suite is
// the only line here that is already a failure. Rounds next, because the
// compliance ones are a dated log an inspector, an insurer or a brand audit
// will ask to see, and a day they are skipped is a hole in it. Rotation after
// that. The backlog last, which is the only part that can honestly be moved —
// so it is the part shown as movable.

import {
  SUITES, SUITE_COUNT, CYCLE_POSITION, CYCLE_DAYS, SUITE_PM, ROUNDS,
  SHIFT_MINUTES, WORK_ORDERS, CREW, EPOCH, isOpen,
  seed, daysFrom, daysUntil,
} from './data'

// ── rotation coverage ─────────────────────────────────────────────────────
export const ROTATION = (() => {
  const done = SUITES.filter((s) => s.state === 'Done this cycle').length
  const overdue = SUITES.filter((s) => s.state === 'Overdue').length
  const dueToday = SUITES.filter((s) => s.state === 'Due today').length
  return {
    total: SUITE_COUNT,
    done,
    overdue,
    dueToday,
    ahead: SUITE_COUNT - done - overdue - dueToday,
    // Against where the rotation should be by now, not against the whole cycle.
    // "38% done" on day 34 of 91 reads as failing and is in fact a suite ahead.
    expected: Math.round((CYCLE_POSITION / CYCLE_DAYS) * SUITE_COUNT),
    coverage: Math.round((done / SUITE_COUNT) * 1000) / 10,
    cyclePosition: CYCLE_POSITION,
    cycleDays: CYCLE_DAYS,
    perDay: Math.round((SUITE_COUNT / CYCLE_DAYS) * 10) / 10,
  }
})()

// ── which rounds fall today ───────────────────────────────────────────────
const TODAY = new Date(EPOCH)
const DOW = TODAY.getDay()
const DOM = TODAY.getDate()

// Weekly rounds sit on a weekday and monthly ones early in the month, both
// derived from the round's own key so they never all land on one day.
const weeklyDay = (r) => 1 + Math.floor(seed(r.key + 'dow') * 5)
const monthlyDay = (r) => 2 + Math.floor(seed(r.key + 'dom') * 9)

export const roundDueToday = (r) =>
  r.every === 'day' ? true
    : r.every === 'week' ? DOW === weeklyDay(r)
      : DOM === monthlyDay(r)

export const roundNextIn = (r) => {
  if (r.every === 'day') return 0
  if (r.every === 'week') return (weeklyDay(r) - DOW + 7) % 7
  const d = monthlyDay(r)
  if (d >= DOM) return d - DOM
  const daysInMonth = new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0).getDate()
  return daysInMonth - DOM + d
}

// A property this size runs a Chief Engineer and a tech or two, so the day is
// written for one named person rather than dealt out across a crew.
export const technicianForDay = (offset = 0) =>
  CREW.length ? CREW[(Math.floor(EPOCH / 86400000) + offset) % CREW.length] : null

// ── the schedule ──────────────────────────────────────────────────────────
/**
 * @param offset days from today
 * @param suites the live suites — the generated ones with any PM completed
 *               through the portal applied. Defaults to the generated set so
 *               the module-level exports below still work outside React, but a
 *               screen should pass `useSuites()` or a suite ticked this morning
 *               is still on the catch-up queue this afternoon.
 */
export function scheduleFor(offset = 0, suites = SUITES) {
  // A suite done today stays on today's list, ticked, in the group it was in
  // before it was done. Filtering on the current state alone made the row
  // vanish as it was ticked — a PM recorded stops the suite being overdue, so
  // it dropped out of catch-up under the cursor. The plan for a day should not
  // rearrange itself while somebody is walking it.
  const heldToday = (s, was) => offset === 0 && s.completed_today && s.origin_state === was

  const overdue = suites
    .filter((s) => s.state === 'Overdue' || heldToday(s, 'Overdue'))
    // Sorted on what it was, not what it is: completing a suite takes its
    // overdue days to zero, and sorting on the live value moved the row the
    // moment it was ticked.
    .sort((a, b) => (b.origin_overdue_days ?? b.overdue_days ?? 0) - (a.origin_overdue_days ?? a.overdue_days ?? 0))
    .slice(0, 2)

  const dueToday = suites.filter((s) => (
    (s.due_in_days === offset && !s.completed_today) || heldToday(s, 'Due today')
  ))

  const rounds = ROUNDS.filter((r) =>
    offset === 0 ? roundDueToday(r) : roundNextIn(r) === offset || r.every === 'day')

  // The backlog fills what the rest of the day leaves, rather than a fixed
  // three. Taking three regardless put nine hours of work orders behind a shift
  // that was already full, so the schedule was over budget every single day and
  // the warning that says so stopped meaning anything. Planning a day that
  // cannot be done is the failure this screen exists to prevent.
  const fixedMinutes =
    overdue.length * SUITE_PM.minutes
    + rounds.reduce((n, r) => n + r.minutes, 0)
    + dueToday.length * SUITE_PM.minutes

  const candidates = WORK_ORDERS
    .filter(isOpen)
    .sort((a, b) => daysUntil(a.due_date) - daysUntil(b.due_date))

  const wos = []
  let spent = fixedMinutes
  for (const w of candidates) {
    if (wos.length >= 3) break
    const mins = Math.round((w.estimated_hours || 1) * 60)
    // Always carry the most urgent one, even if the day is already full: a job
    // dropped silently because the morning ran long is how a backlog rots.
    if (wos.length && spent + mins > SHIFT_MINUTES) break
    wos.push(w)
    spent += mins
  }

  const suiteItem = (s, why) => ({
    key: `suite-${s.suite_number}`,
    label: `Suite ${s.suite_number} — quarterly PM`,
    detail: `${s.suite_type} · Floor ${s.floor} · ${SUITE_PM.checklist.length} checkpoints`,
    minutes: SUITE_PM.minutes,
    location: `Floor ${s.floor}`,
    why,
    suite: s,
  })

  const groups = [
    overdue.length && {
      key: 'catch-up',
      title: 'Catch-up',
      note: 'Missed on their rotation date — these come first',
      tone: 'red',
      items: overdue.map((s) => suiteItem(s, `${s.overdue_days} day${s.overdue_days === 1 ? '' : 's'} overdue`)),
    },
    rounds.length && {
      key: 'rounds',
      title: 'Rounds',
      note: 'Repeat regardless of which suites come up',
      tone: 'blue',
      items: rounds.map((r) => ({
        key: r.key,
        label: r.label,
        detail: r.location,
        minutes: r.minutes,
        location: r.location,
        compliance: r.compliance || null,
        why: r.every === 'day' ? 'Daily' : r.every === 'week' ? 'Weekly' : 'Monthly',
      })),
    },
    dueToday.length && {
      key: 'rotation',
      title: 'Suite rotation',
      note: `${ROTATION.perDay} suites a day keeps all ${SUITE_COUNT} on a ${CYCLE_DAYS}-day cycle`,
      tone: 'indigo',
      items: dueToday.map((s) => suiteItem(s, 'Due on the rotation')),
    },
    wos.length && {
      key: 'work-orders',
      title: 'Open work orders',
      note: 'Soonest due first — the only part of the day that can be moved',
      tone: 'amber',
      items: wos.map((w) => ({
        key: w.workorder_id,
        label: w.title,
        detail: `${w.work_order_number} · ${w.asset_name}`,
        minutes: Math.round((w.estimated_hours || 1) * 60),
        location: w.location_name,
        priority: w.priority,
        why: daysUntil(w.due_date) < 0 ? 'Past due' : `Due in ${daysUntil(w.due_date)} days`,
        workOrder: w,
      })),
    },
  ].filter(Boolean)

  const totalMinutes = groups.reduce((n, g) => n + g.items.reduce((m, i) => m + i.minutes, 0), 0)

  return {
    date: daysFrom(offset),
    technician: technicianForDay(offset),
    groups,
    totalMinutes,
    shiftMinutes: SHIFT_MINUTES,
    fits: totalMinutes <= SHIFT_MINUTES,
    itemCount: groups.reduce((n, g) => n + g.items.length, 0),
  }
}

export const TODAY_SCHEDULE = scheduleFor(0)

/** Compliance rounds that are not due today, with when they next are. */
export const UPCOMING_COMPLIANCE = ROUNDS
  .filter((r) => r.compliance && !roundDueToday(r))
  .map((r) => ({ ...r, nextIn: roundNextIn(r) }))
  .sort((a, b) => a.nextIn - b.nextIn)

/** The next week, so the board shows the rotation moving rather than a day. */
export const weekAhead = (suites = SUITES) => Array.from({ length: 7 }, (_, i) => {
  const s = scheduleFor(i, suites)
  return {
    offset: i,
    date: s.date,
    items: s.itemCount,
    minutes: s.totalMinutes,
    suites: suites.filter((x) => x.due_in_days === i).length,
  }
})

export const WEEK_AHEAD = weekAhead()
