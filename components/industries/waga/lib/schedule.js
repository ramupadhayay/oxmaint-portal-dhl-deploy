// Turning 34 recurrence rules into dated work.
//
// This file exists because the workbook told it to. Compliance_Tasks holds
// seven rows, five of which are labelled "Demo-generated from source
// frequency", and the Verification_Log is blunt about what to do with them:
//
//   "Do NOT import these as historical WAGA completions; generate dynamically
//    after rules are configured."  (V-012)
//
// So the register of requirements is the source of truth and the calendar is
// derived from it. Every occurrence this produces is stamped `derived: true`
// and carries the rule text it came from, so no screen can present a generated
// date as something WAGA recorded.
//
// ── why not everything becomes a due date ────────────────────────────────
//
// The frequency column carries ten distinct values and only five of them are
// calendar events. Nine requirements read "Continuous" or "Every 15 minutes" —
// recording gas flow, confirming flame presence, tracking flare hours. Putting
// "every 15 minutes" on a compliance calendar generates thirty-five thousand
// rows a year and tells a compliance manager nothing they did not already know.
// Those are standing obligations: the question is whether the recording system
// is up, not what is due on Thursday.
//
// Three more are "Event-driven" — approval before a modification, notification
// fifteen days before construction starts. Those have no date until something
// happens, and inventing one would be exactly the fabrication the workbook
// warns against.
//
// So requirements are sorted into four kinds and only `recurring` and
// `milestone` reach the calendar.

const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
}

export const KIND = {
  RECURRING: 'recurring',
  MILESTONE: 'milestone',
  CONTINUOUS: 'continuous',
  EVENT: 'event',
}

export const KIND_LABEL = {
  recurring: 'Scheduled',
  milestone: 'Milestone',
  continuous: 'Standing obligation',
  event: 'Event-driven',
}

/** Which of the four kinds a requirement is, from its frequency alone. */
export function kindOf(requirement) {
  const f = (requirement.frequency || '').toLowerCase()
  if (!f) return KIND.EVENT
  if (f.includes('continuous') || f.includes('minute')) return KIND.CONTINUOUS
  if (f.includes('event')) return KIND.EVENT
  if (f.includes('renewal') || f.includes('5 year') || f.includes('five year')) return KIND.MILESTONE
  return KIND.RECURRING
}

// ── reading the deadline column ──────────────────────────────────────────
//
// `deadline_rule` is prose written by whoever kept the tracker, and it is prose
// in the source documents too. Rather than force it into a date format it was
// never in, the patterns that actually appear are matched and anything else
// falls through to "no date, show the rule". A parser that guessed would put a
// wrong date on a regulatory deadline, which is worse than showing none.

const ISO = /(\d{4})-(\d{2})-(\d{2})/
const MONTH_DAY = new RegExp(
  `\\b(${Object.keys(MONTHS).join('|')})[a-z]*\\.?\\s+(\\d{1,2})\\b`, 'gi'
)

/** Every explicit month/day pair in the rule, as {month, day}. */
function monthDays(rule) {
  const out = []
  let m
  MONTH_DAY.lastIndex = 0
  while ((m = MONTH_DAY.exec(rule)) !== null) {
    const month = MONTHS[m[1].toLowerCase()]
    const day = Number(m[2])
    if (month !== undefined && day >= 1 && day <= 31) out.push({ month, day })
  }
  return out
}

const iso = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10)
const endOfMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()

/**
 * The dates a recurring requirement falls due between two years.
 *
 * `anchor` is only used by the weekly rule, which has no date in its text —
 * a weekly inspection is due every week and the source says nothing about
 * which day, so the anchor is the day the reader is looking at the screen.
 */
function recurringDates(requirement, fromYear, toYear, anchor) {
  const rule = requirement.deadlineRule || ''
  const freq = (requirement.frequency || '').toLowerCase()
  const explicit = monthDays(rule)
  const dates = []

  for (let y = fromYear; y <= toYear; y++) {
    if (explicit.length) {
      // "Mar 31 / Jun 30 / Sep 30 / Dec 31" and "March 23" both land here —
      // the rule names its own dates, so they are used exactly as written.
      explicit.forEach(({ month, day }) => dates.push(iso(y, month, Math.min(day, endOfMonth(y, month)))))
      continue
    }

    if (freq.includes('week')) {
      // Every seven days from the anchor, for one year forward only. A weekly
      // obligation projected over three years is 156 identical rows nobody
      // reads.
      if (y !== fromYear) continue
      for (let i = 0; i < 52; i++) {
        const d = new Date(anchor.getTime() + i * 7 * 86400000)
        dates.push(d.toISOString().slice(0, 10))
      }
      continue
    }

    if (freq.includes('month')) {
      // "End of month" is the only monthly rule in this dataset and it says so.
      for (let m = 0; m < 12; m++) dates.push(iso(y, m, endOfMonth(y, m)))
      continue
    }

    if (freq.includes('quarter')) {
      [2, 5, 8, 11].forEach((m) => dates.push(iso(y, m, endOfMonth(y, m))))
      continue
    }

    if (freq.includes('semi')) {
      // No named dates: the two halves close at the end of June and December.
      dates.push(iso(y, 5, 30), iso(y, 11, 31))
      continue
    }

    // Annual with no date in the rule — the year is known, the day is not, so
    // nothing is emitted rather than a guessed 1 January.
  }

  return dates
}

/** The single date a milestone falls on, or '' when the rule does not say. */
function milestoneDate(requirement, permit) {
  const rule = requirement.deadlineRule || ''

  const explicit = rule.match(ISO)
  if (explicit) return explicit[0]

  // "180 days before expiration" — resolvable only against the permit it hangs
  // off, and only when that permit has an expiry. WMGM055NW002 does; several
  // others deliberately do not.
  const before = rule.match(/(\d+)\s*days?\s+before\s+expiration/i)
  if (before && permit?.expirationDate) {
    const d = new Date(permit.expirationDate)
    d.setUTCDate(d.getUTCDate() - Number(before[1]))
    return d.toISOString().slice(0, 10)
  }

  if (permit?.renewalDeadline) return permit.renewalDeadline
  return ''
}

/**
 * Every dated occurrence the register implies, newest rule first.
 *
 * @param requirements the register
 * @param permits      needed to resolve "180 days before expiration"
 * @param opts.today   the day to measure against; injectable so a test does
 *                     not have to wait for Thursday
 * @param opts.years   how far forward to project recurring rules
 */
export function generateOccurrences(requirements, permits = [], opts = {}) {
  const today = opts.today ? new Date(opts.today) : new Date()
  const years = opts.years ?? 1
  const fromYear = today.getUTCFullYear()
  const permitById = new Map(permits.map((p) => [p.permitId, p]))

  const out = []

  requirements.forEach((r) => {
    const kind = kindOf(r)
    if (kind === KIND.CONTINUOUS || kind === KIND.EVENT) return

    const permit = permitById.get(r.permitId)

    if (kind === KIND.MILESTONE) {
      const dueDate = milestoneDate(r, permit)
      if (!dueDate) return
      out.push(occurrence(r, dueDate, today, kind))
      return
    }

    recurringDates(r, fromYear, fromYear + years, today)
      .forEach((dueDate) => out.push(occurrence(r, dueDate, today, kind)))
  })

  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

// Status is computed against today rather than stored. Nothing here has been
// completed — there are no WAGA completion records in the workbook at all — so
// the only honest states are "past its date" and "not yet".
function occurrence(requirement, dueDate, today, kind) {
  const iso0 = today.toISOString().slice(0, 10)
  const days = Math.round((new Date(dueDate) - new Date(iso0)) / 86400000)
  return {
    occurrenceId: `${requirement.requirementId}@${dueDate}`,
    requirementId: requirement.requirementId,
    siteId: requirement.siteId,
    permitId: requirement.permitId,
    title: requirement.name,
    category: requirement.category,
    frequency: requirement.frequency,
    submissionMethod: requirement.submissionMethod,
    rule: requirement.deadlineRule,
    kind,
    dueDate,
    daysUntil: days,
    status: days < 0 ? 'Past due' : days <= 30 ? 'Due soon' : 'Scheduled',
    // The flag every screen reads before it renders one of these. A derived
    // date is the portal's arithmetic, not WAGA's record.
    derived: true,
  }
}

/** The next occurrence per requirement — what a calendar actually wants. */
export function nextPerRequirement(occurrences) {
  const seen = new Map()
  occurrences
    .filter((o) => o.daysUntil >= 0)
    .forEach((o) => { if (!seen.has(o.requirementId)) seen.set(o.requirementId, o) })
  return [...seen.values()].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}
