// The joined view every screen reads.
//
// The generated modules beside this one are the workbook, exactly as authored.
// This is where they are put together — a filter with its tests, its leak
// readings, its replacement history, its SAP mapping and its document — and
// where the calendar is anchored to today (see ../anchor.js for why).
//
// Two rules hold everywhere below.
//
// A workbook value is never recomputed. The pass rate, the breach count and the
// audit-readiness score are on the Compliance Dashboard sheet with their own
// formulas; the portal shows those, and where it derives anything alongside it
// says so. A demo that quietly disagrees with the file it came from is worse
// than one that shows nothing.
//
// And every record keeps both dates. `testDate` is what the workbook says;
// `date` is where it sits against today. Screens judge overdue against the
// second and show the first, so the numbers a client reads back against their
// own file are still in there.

// Extensions on purpose. Next resolves either, but written this way the data
// layer also runs under plain node — which is how it gets checked against the
// workbook's own dashboard without a browser in the loop.
import { FILTERS, THRESHOLDS } from './filters.js'
import { TESTS, LEAKS } from './tests.js'
import { REPLACEMENTS } from './replacements.js'
import { SAP_MAPPING } from './sap.js'
import { DOCUMENTS } from './documents.js'
import { WORKBOOK_DASHBOARD } from './dashboard.js'
import { SEEDED_REQUESTS } from './requests.js'
import { shift, daysFromToday, isPast, TODAY, ANCHOR_NOTE, ANCHOR_SUMMARY, OFFSET_DAYS } from '../anchor.js'

export { THRESHOLDS, WORKBOOK_DASHBOARD, ANCHOR_NOTE, ANCHOR_SUMMARY, OFFSET_DAYS }
export { shift, daysFromToday, isPast }

// ── the facility ──────────────────────────────────────────────────────────
// From the workbook's Read Me and the client brief. The customer's name lives
// in data and in the profile menu, never in the portal chrome — the same
// correction every other portal on this platform has needed.
export const ORG = {
  name: 'Jubilant HollisterStier',
  site: 'Spokane, WA',
  description: 'Sterile fill-finish facility',
  cmms: 'SAP',
  // What the workbook says about its own contents, said plainly. The file's own
  // wording called itself a sample; that is a fact about the data's provenance,
  // not something to label the portal with, so it is stated as provenance.
  dataNote: 'Facility names, filter IDs and technician names in this dataset are '
    + 'illustrative and follow the HEPA technical data model.',
}

export const USER = {
  name: 'A. Petrov',
  role: 'Site Quality Lead',
  initials: 'AP',
}

// ── cleanrooms ────────────────────────────────────────────────────────────
export const CLEANROOMS = (() => {
  const byId = new Map()
  for (const f of FILTERS) {
    if (!byId.has(f.cleanroomId)) {
      byId.set(f.cleanroomId, {
        cleanroomId: f.cleanroomId,
        name: f.cleanroomName,
        isoClass: f.isoClass,
        filterCount: 0,
      })
    }
    byId.get(f.cleanroomId).filterCount += 1
  }
  return [...byId.values()].sort((a, b) => a.cleanroomId.localeCompare(b.cleanroomId))
})()

// ── records, on the anchored calendar ─────────────────────────────────────
const withDate = (rows, field) => rows.map((r) => ({ ...r, date: shift(r[field]) }))

export const TEST_RECORDS = withDate(TESTS, 'testDate')
export const LEAK_RECORDS = withDate(LEAKS, 'readingDate')

// The workbook writes this status as "Blocked - awaiting validation", not
// "Blocked". Four screens matched the short form and every one of them silently
// counted zero — the blocked banner never appeared, the record page never
// warned, and the assistant answered "0 replacements are blocked" next to a
// dashboard reading 1.
//
// So the predicate lives here once rather than as a string comparison in each
// screen. The workbook's own wording is still what gets displayed; only the
// test for it is centralised.
const isBlocked = (status) => String(status).startsWith('Blocked')

export const REPLACEMENT_RECORDS = withDate(REPLACEMENTS, 'installationDate').map((r) => ({
  ...r,
  blocked: isBlocked(r.recertStatus),
  recertified: r.recertStatus === 'Re-certified',
  // Blocked here means the post-installation test has not been done, not that
  // it failed — RP-5004 carries no post-validation test id at all. The two read
  // very differently to a reviewer, so the distinction is kept.
  awaitingPostTest: isBlocked(r.recertStatus) && !r.postValidationTestId,
}))

export const SAP_RECORDS = SAP_MAPPING.map((s) => ({ ...s, date: shift(s.lastSync) }))

export const DOCUMENT_RECORDS = DOCUMENTS.map((d) => {
  const nextDue = shift(d.nextCertDue)
  const dueIn = daysFromToday(nextDue)
  return {
    ...d,
    // Anchored, alongside the workbook's own.
    nextCertDueOn: nextDue,
    retentionExpiryOn: shift(d.retentionExpiry),
    signedOn: shift(d.signedAt),
    dueIn,
    // Derived here rather than read from the sheet: the workbook's own
    // Notification Status was computed against its authoring date, when every
    // row was already past due. Recomputing it on the anchored calendar is what
    // makes an upcoming certification visible at all — which is half of what
    // the brief asks the notification view to show.
    notification: dueIn === null ? null
      : dueIn < 0 ? 'Overdue - Escalate'
        : dueIn <= THRESHOLDS.notificationLeadDays.value ? 'Due soon - Notify'
          : 'Scheduled',
    notificationDerived: true,
  }
})

// ── the filters, with everything hanging off them ─────────────────────────
const byFilter = (rows) => {
  const m = new Map()
  for (const r of rows) {
    if (!m.has(r.filterId)) m.set(r.filterId, [])
    m.get(r.filterId).push(r)
  }
  return m
}

const testsBy = byFilter(TEST_RECORDS)
const leaksBy = byFilter(LEAK_RECORDS)
const replacementsBy = byFilter(REPLACEMENT_RECORDS)
const sapBy = new Map(SAP_RECORDS.map((s) => [s.filterId, s]))
const docBy = new Map(DOCUMENT_RECORDS.map((d) => [d.relatedRecordId, d]))

const newest = (rows) => (rows.length
  ? [...rows].sort((a, b) => String(a.date).localeCompare(String(b.date))).at(-1)
  : null)

export const FILTER_VIEW = FILTERS.map((f) => {
  const tests = testsBy.get(f.filterId) || []
  const leaks = leaksBy.get(f.filterId) || []
  const replacements = replacementsBy.get(f.filterId) || []
  const lastTest = newest(tests)
  const lastLeak = newest(leaks)
  const doc = docBy.get(f.filterId) || null

  return {
    ...f,
    installedOn: shift(f.installDate),
    tests,
    leaks,
    replacements,
    sap: sapBy.get(f.filterId) || null,
    document: doc,

    lastTest,
    lastLeak,
    // Counts, not judgements — each is a plain tally of rows the workbook holds.
    testCount: tests.length,
    failCount: tests.filter((t) => t.result === 'Fail').length,
    breachCount: leaks.filter((l) => l.breach === 'Breach').length,

    // The filter's current standing, derived. A failed integrity test outranks
    // a pressure breach: penetration above the threshold means the barrier
    // itself is compromised, where a differential says it is loading up.
    concern: lastTest?.result === 'Fail' ? 'Failed integrity test'
      : leaks.filter((l) => l.breach === 'Breach').length ? 'Pressure breach'
        : null,
    nextCertDueOn: doc?.nextCertDueOn || null,
    dueIn: doc?.dueIn ?? null,
  }
})

// ── the CMMS view of the same records ─────────────────────────────────────
//
// The registers above are the compliance shape of this data. What follows is
// the maintenance shape of it — work orders, a PM calendar, technicians — and
// it is the *same* rows read a second way, not a second dataset. A HEPA
// integrity test is a PM04 job on a work order; the filter it was done on is an
// asset; the person who signed the reading is a technician with a workload.
//
// Nothing here invents a record. Every work order number, type and equipment id
// is the client's own out of the SAP sheet; what is derived is the *state*, and
// that is said on the screen rather than left to look like it came from SAP.

const INTERVAL_DAYS = { Quarterly: 91, 'Semi-Annual': 182, Annual: 365, Monthly: 30 }

/**
 * A work order's state, worked out from the certification record it produced.
 *
 * SAP gives us the order and its type but not whether it is finished, so this
 * reads the document: a locked, audit-ready certification means the job is done
 * and signed off. Anything short of that is still open, and a record that was
 * rejected in review is a job that has to be redone.
 */
export const workOrderStatus = (doc) => {
  if (!doc) return 'Open'
  if (doc.approvalStatus === 'Rejected') return 'Reopened'
  if (doc.stage === 'Locked / Audit-Ready') return 'Completed'
  if (doc.approvalStatus === 'Approved') return 'Pending Approval'
  if (doc.stage === 'Under Review' || doc.stage === 'Routed for Review') return 'In Progress'
  return 'Open'
}

/** Priority from the physical condition, not from a field nobody filled in. */
export const workOrderPriority = (f) => (
  f?.concern === 'Failed integrity test' ? 'Critical'
    : f?.breachCount ? 'High'
      : f?.dueIn != null && f.dueIn < 0 ? 'High'
        : f?.dueIn != null && f.dueIn <= THRESHOLDS.notificationLeadDays.value ? 'Medium'
          : 'Low'
)

export const WORK_ORDERS = SAP_RECORDS.map((s) => {
  const f = FILTER_VIEW.find((x) => x.filterId === s.filterId) || null
  const doc = DOCUMENT_RECORDS.find((d) => d.documentRef === s.documentRef) || null
  return {
    // SAP's, unchanged.
    workOrderId: s.sapWorkOrder,
    workOrderType: s.workOrderType,
    filterId: s.filterId,
    sapEquipmentId: s.sapEquipmentId,
    sapFunctionalLocation: s.sapFunctionalLocation,
    documentRef: s.documentRef,
    syncStatus: s.syncStatus,
    raisedOn: s.date,
    raisedOnWorkbook: s.lastSync,
    // Ours, and the screen says so.
    cleanroomId: f?.cleanroomId || null,
    cleanroomName: f?.cleanroomName || '—',
    isoClass: f?.isoClass || '—',
    // The short code SAP order types carry — PM01, PM02, PM04.
    orderClass: String(s.workOrderType).split(' ')[0],
    technicianName: f?.lastTest?.technicianName || null,
    technicianId: f?.lastTest?.technicianId || null,
    dueIn: f?.dueIn ?? null,
    dueOn: f?.nextCertDueOn || null,
  }
})

export const PM_SCHEDULES = FILTER_VIEW.map((f) => {
  const every = INTERVAL_DAYS[f.testInterval] || null
  const passed = f.tests.filter((t) => t.result === 'Pass').length
  return {
    scheduleId: `PM-${f.filterId.replace(/^HF-/, '')}`,
    filterId: f.filterId,
    cleanroomId: f.cleanroomId,
    cleanroomName: f.cleanroomName,
    isoClass: f.isoClass,
    task: `DOP/PAO integrity test — ${f.cleanroomName}`,
    frequency: f.testInterval,
    everyDays: every,
    lastDoneOn: f.lastTest?.date || null,
    lastDoneWorkbook: f.lastTest?.testDate || null,
    lastResult: f.lastTest?.result || null,
    nextDueOn: f.nextCertDueOn,
    nextDueWorkbook: f.document?.nextCertDue || null,
    dueIn: f.dueIn,
    // Per-schedule compliance: how many of this filter's tests passed. The
    // site-wide figure stays the workbook's own pass rate.
    completions: f.testCount,
    passed,
    compliance: f.testCount ? passed / f.testCount : null,
    assignedTo: f.lastTest?.technicianName || null,
    state: f.dueIn == null ? 'No date set'
      : f.dueIn < 0 ? 'Overdue'
        : f.dueIn <= THRESHOLDS.notificationLeadDays.value ? 'Due soon'
          : 'Scheduled',
  }
})

export const TECHNICIANS = (() => {
  const m = new Map()
  const touch = (id, name) => {
    if (!m.has(id)) m.set(id, { technicianId: id, name: name || id, tests: 0, passes: 0, fails: 0, readings: 0, breaches: 0, rooms: new Set(), lastOn: null })
    const t = m.get(id)
    // The leak sheet carries only the id; the test sheet carries the name. So a
    // technician who appears on both is named from whichever row has one.
    if (name && t.name === id) t.name = name
    return t
  }
  for (const r of TEST_RECORDS) {
    const t = touch(r.technicianId, r.technicianName)
    t.tests += 1
    if (r.result === 'Pass') t.passes += 1
    else t.fails += 1
    if (!t.lastOn || String(r.date) > t.lastOn) t.lastOn = r.date
  }
  for (const r of LEAK_RECORDS) {
    const t = touch(r.technicianId, null)
    t.readings += 1
    if (r.breach === 'Breach') t.breaches += 1
    if (!t.lastOn || String(r.date) > t.lastOn) t.lastOn = r.date
  }
  for (const r of [...TEST_RECORDS, ...LEAK_RECORDS]) {
    const f = FILTERS.find((x) => x.filterId === r.filterId)
    if (f) m.get(r.technicianId)?.rooms.add(f.cleanroomId)
  }
  return [...m.values()]
    .map((t) => ({ ...t, rooms: [...t.rooms].sort(), roomCount: t.rooms.size, passRate: t.tests ? t.passes / t.tests : null }))
    .sort((a, b) => a.technicianId.localeCompare(b.technicianId))
})()

/** The cleanrooms, with everything in them rolled up. */
export const CLEANROOM_VIEW = CLEANROOMS.map((c) => {
  const filters = FILTER_VIEW.filter((f) => f.cleanroomId === c.cleanroomId)
  return {
    ...c,
    filters,
    tests: filters.reduce((n, f) => n + f.testCount, 0),
    fails: filters.reduce((n, f) => n + f.failCount, 0),
    breaches: filters.reduce((n, f) => n + f.breachCount, 0),
    concerns: filters.filter((f) => f.concern).length,
    overdue: filters.filter((f) => f.dueIn != null && f.dueIn < 0).length,
    nextDueIn: filters.map((f) => f.dueIn).filter((d) => d != null).sort((a, b) => a - b)[0] ?? null,
    workOrders: WORK_ORDERS.filter((w) => w.cleanroomId === c.cleanroomId).length,
  }
})

// Requests already on the register, placed on the anchored calendar. Written
// as "N days ago" in the seed rather than as dates, so they move with the rest
// of the portal and a demo never opens on a request raised next Tuesday.
const daysBack = (n) => new Date(TODAY - n * 86400000).toISOString()

export const SEEDED_REQUEST_RECORDS = SEEDED_REQUESTS.map((r) => {
  const f = FILTER_VIEW.find((x) => x.filterId === r.filterId) || null
  return {
    ...r,
    recordId: `req_${r.requestId}`,
    cleanroomId: f?.cleanroomId || r.cleanroomId || null,
    cleanroomName: f?.cleanroomName
      || CLEANROOMS.find((c) => c.cleanroomId === r.cleanroomId)?.name
      || '—',
    isoClass: f?.isoClass || '—',
    raisedAt: daysBack(r.daysAgo),
    convertedAt: r.convertedDaysAgo != null ? daysBack(r.convertedDaysAgo) : null,
    rejectedAt: r.rejectedDaysAgo != null ? daysBack(r.rejectedDaysAgo) : null,
    seeded: true,
  }
})

export const filterById = (id) => FILTER_VIEW.find((f) => f.filterId === id) || null
export const workOrderById = (id) => WORK_ORDERS.find((w) => w.workOrderId === id) || null
export const testById = (id) => TEST_RECORDS.find((t) => t.testId === id) || null
export const documentByRef = (ref) => DOCUMENT_RECORDS.find((d) => d.documentRef === ref) || null

// ── the lifecycle, in the order the brief names it ────────────────────────
export const LIFECYCLE_STAGES = [
  'Created',
  'Routed for Review',
  'Under Review',
  'Approved - Signed',
  'Locked / Audit-Ready',
]

// ── headline numbers ──────────────────────────────────────────────────────
// The workbook's own dashboard is the authority for anything it computes. This
// object carries those verbatim and marks what is derived alongside them, so a
// figure on screen can always be traced to one or the other.
const dash = (metric) => WORKBOOK_DASHBOARD.find((d) => d.metric.startsWith(metric))?.value ?? null

export const HEADLINE = {
  // From the workbook, as authored.
  filters: dash('Total registered filters'),
  flagged: dash('Filters flagged or pending'),
  tests: dash('Total DOP/PAO tests'),
  passRate: dash('DOP/PAO pass rate'),
  leakReadings: dash('Total leak detection'),
  breaches: dash('Leak readings in breach'),
  replacements: dash('Total replacement events'),
  blockedReplacements: dash('Replacements blocked'),
  auditReadiness: dash('Audit readiness score'),

  // Derived on the anchored calendar — the workbook has no equivalent, because
  // when it was written every one of these was overdue.
  derived: {
    overdue: DOCUMENT_RECORDS.filter((d) => d.notification === 'Overdue - Escalate').length,
    dueSoon: DOCUMENT_RECORDS.filter((d) => d.notification === 'Due soon - Notify').length,
    scheduled: DOCUMENT_RECORDS.filter((d) => d.notification === 'Scheduled').length,
    awaitingApproval: DOCUMENT_RECORDS.filter((d) => d.approvalStatus === 'Pending').length,
    signed: DOCUMENT_RECORDS.filter((d) => d.approvalStatus === 'Approved').length,
    auditReady: DOCUMENT_RECORDS.filter((d) => d.stage === 'Locked / Audit-Ready').length,
    sapErrors: SAP_RECORDS.filter((s) => String(s.syncStatus).startsWith('Error')).length,
    sapPending: SAP_RECORDS.filter((s) => s.syncStatus === 'Pending').length,
  },
}

export const pct = (n) => `${Math.round(Number(n) * 1000) / 10}%`
export const fmtDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(String(iso).length > 10 ? iso : `${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return String(iso)
  return `${String(d.getUTCDate()).padStart(2, '0')} ${d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })} ${d.getUTCFullYear()}`
}
