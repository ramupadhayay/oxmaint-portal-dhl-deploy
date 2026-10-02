// Anchoring the workbook's calendar to today.
//
// The workbook was authored around late 2025. Read as written it now says the
// newest integrity test is nine months old and all eighteen certification dates
// have passed, so every document reads "Overdue - Escalate" — which is not a
// compliance system working, it is a dataset that has gone stale. The client's
// brief asks the demo to show "an upcoming test due in N days *and* an overdue
// approval escalated", and as authored the first of those cannot be shown at
// all.
//
// So the whole calendar is shifted by one constant, and nothing else changes.
// Every interval the workbook encodes is preserved exactly — the gap between a
// test and its next certification, between a replacement and its post-
// validation, between a record and its retention expiry. Only where "today"
// falls against them moves.
//
// The constant is not a number typed in here. It is the distance from the
// workbook's most recent test to today, recomputed on every load, which means:
//
//   - the newest test in the file reads as having happened today
//   - the certification dates straddle today, so some are overdue and some are
//     coming up, which is the pair the brief asks for
//   - and the demo cannot rot again. A pinned offset would be correct this week
//     and wrong next month, which is the bug being fixed.
//
// What is NOT done: the workbook's own dates are never overwritten. Every
// record carries both — `recordedDate` is what the file says, `date` is where
// it sits against today — and the record pages show the workbook's date beside
// the anchored one. The numbers a client reads back against their file have to
// still be in there.

import { TESTS } from './data/tests.js'

const DAY = 86400000

const toDate = (iso) => new Date(`${String(iso).slice(0, 10)}T00:00:00Z`)

/** Midnight today, UTC — the same instant for every derived value on a load. */
export const TODAY = (() => {
  const t = new Date()
  return Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())
})()

/** The workbook's most recent integrity test — the point pinned to today. */
export const ANCHOR_SOURCE = TESTS
  .map((t) => t.testDate)
  .filter(Boolean)
  .sort()
  .at(-1)

export const OFFSET_DAYS = ANCHOR_SOURCE
  ? Math.round((TODAY - toDate(ANCHOR_SOURCE).getTime()) / DAY)
  : 0

/** A workbook date, moved onto the anchored calendar. Returns null for null. */
export function shift(iso) {
  if (!iso) return null
  const hasTime = String(iso).length > 10
  const ms = new Date(hasTime ? iso : `${iso}T00:00:00Z`).getTime()
  if (Number.isNaN(ms)) return iso
  const moved = new Date(ms + OFFSET_DAYS * DAY)
  return hasTime ? moved.toISOString() : moved.toISOString().slice(0, 10)
}

/** Whole days from today. Negative is in the past. */
export function daysFromToday(iso) {
  if (!iso) return null
  const ms = new Date(String(iso).length > 10 ? iso : `${iso}T00:00:00Z`).getTime()
  if (Number.isNaN(ms)) return null
  return Math.round((ms - TODAY) / DAY)
}

export const isPast = (iso) => {
  const d = daysFromToday(iso)
  return d !== null && d < 0
}

/**
 * What the screens say about this, in one place so every screen says the same.
 *
 * Shown wherever an anchored date drives a compliance judgement, because a
 * reader who does not know the calendar has been moved would take an "overdue"
 * count as the client's real position.
 */
// Worded without naming what this deployment is. The fact being stated — that
// the calendar is aligned to the newest test and every interval is preserved —
// is true and worth saying; calling the portal a demo on every screen is not
// something a customer should be told about their own system.
export const ANCHOR_NOTE =
  `Dates are aligned to the current period: the most recent integrity test on file (${ANCHOR_SOURCE}) `
  + `is read as today, and every other date keeps its exact interval from it. `
  + `Each record shows its original workbook date alongside.`

export const ANCHOR_SUMMARY = {
  source: ANCHOR_SOURCE,
  offsetDays: OFFSET_DAYS,
  today: new Date(TODAY).toISOString().slice(0, 10),
}
