// The joined view of the DNA Technical Fabrics demo dataset.
//
// The workbook is relational: a work order names an asset, the asset names a
// location, a part lists the assets it fits, a downtime record names both. Every
// join lives here so no screen has to re-assemble the story, and each row
// arrives already knowing its own context.
//
// Derived fields are prefixed `_` so it is obvious on sight which values came
// from the sheet and which this file worked out.

import { LOCATIONS } from './locations'
import { ASSETS } from './assets'
import { PARTS } from './parts'
import { WORK_ORDERS } from './workOrders'
import { PM_SCHEDULES } from './pmSchedules'
import { USERS } from './users'
import { DOWNTIME } from './downtime'
import { PURCHASE_ORDERS } from './purchaseOrders'
import { README } from './readme'

export { LOCATIONS, ASSETS, PARTS, WORK_ORDERS, PM_SCHEDULES, USERS, DOWNTIME, README }

// ── the date anchor ──────────────────────────────────────────────────────
//
// The workbook was authored around 24 August 2026 and its dates cluster in that
// week: five work orders overdue, four PM schedules due or just past, one loom
// down with a live job against it. That is a good state to demo — and it decays.
// Left pinned, the same portal opened in October shows every schedule overdue
// and every job late, which says something about the customer rather than about
// the product.
//
// So dates are shifted forward by the gap between the workbook's own reference
// day and today. The stored values are never touched — the modules stay
// comparable to the sheet line for line — and the shift is applied here, in one
// place, on the way out.
//
// This is only defensible because the data says it is fictional. The workbook's
// Read Me says "Data is fictional but modeled on the actual DNA Technical
// Fabrics process", and the covering document tells engineering to treat every
// date as sample data. The WAGA portal does the opposite for the opposite
// reason: its dates are real regulatory deadlines and shifting one would be a
// compliance defect.
//
// Set ANCHOR to false to show the sheet's dates exactly as authored.
export const ANCHOR = true

// The day the workbook describes as "now" — the latest date its open work was
// raised on.
export const SOURCE_TODAY = '2026-08-24'

const DAY = 86400000
const todayIso = () => new Date().toISOString().slice(0, 10)

export const OFFSET_DAYS = ANCHOR
  ? Math.round((new Date(todayIso()) - new Date(SOURCE_TODAY)) / DAY)
  : 0

/** A stored date, moved onto the demo's timeline. */
export const shift = (iso) => {
  if (!iso) return ''
  if (!OFFSET_DAYS) return iso
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  d.setUTCDate(d.getUTCDate() + OFFSET_DAYS)
  return d.toISOString().slice(0, 10)
}

/** Same, for the "2026-08-20 09:15" stamps in the downtime log. */
export const shiftStamp = (v) => {
  if (!v) return ''
  const [date, time = ''] = String(v).split(' ')
  return time ? `${shift(date)} ${time}` : shift(date)
}

// ── formatting ───────────────────────────────────────────────────────────
export const fmtDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${String(d.getUTCDate()).padStart(2, '0')} ${d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })} ${d.getUTCFullYear()}`
}

export const daysUntil = (iso) => {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return Math.round((d - new Date(todayIso())) / DAY)
}

export const money = (n) =>
  n === null || n === undefined || Number.isNaN(Number(n))
    ? '—'
    : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`

export const hrs = (n) => (n === null || n === undefined ? '' : `${Number(n).toFixed(1)} h`)

// ── the customer ─────────────────────────────────────────────────────────
// Counted from the data rather than restated, so a header can never disagree
// with the tables under it. The covering document's own summary claimed 21
// assets, 10 PM tasks and 15 parts against a workbook holding 26, 13 and 18.
export const ORG = {
  name: 'DNA Technical Fabrics',
  group: 'DNA Textile Group',
  parent: 'Denim North America',
  sector: 'Textiles',
  address: LOCATIONS.find((l) => l.type === 'Site')?.description || '',
  siteName: LOCATIONS.find((l) => l.type === 'Site')?.name || '',
  assetCount: ASSETS.length,
  locationCount: LOCATIONS.length,
  partCount: PARTS.length,
  userCount: USERS.length,
}

// ── lookups ──────────────────────────────────────────────────────────────
const locByCode = new Map(LOCATIONS.map((l) => [l.code, l]))
const assetById = new Map(ASSETS.map((a) => [a.assetId, a]))
const userByName = new Map(USERS.map((u) => [u.name, u]))

export const locationOf = (code) => locByCode.get(code) || null
export const assetOf = (id) => assetById.get(id) || null
export const userOf = (name) => userByName.get(name) || null
export const locName = (code) => locByCode.get(code)?.name || code || '—'

// ── locations ────────────────────────────────────────────────────────────
export const locations = LOCATIONS.map((l) => ({
  ...l,
  _parent: l.parent ? locByCode.get(l.parent) : null,
  _assetCount: ASSETS.filter((a) => a.locationCode === l.code).length,
  _children: LOCATIONS.filter((c) => c.parent === l.code).length,
}))

export const site = locations.find((l) => l.type === 'Site') || null
export const departments = locations.filter((l) => l.type !== 'Site')

// ── assets ───────────────────────────────────────────────────────────────
export const assets = ASSETS.map((a) => ({
  ...a,
  installDate: shift(a.installDate),
  _location: locByCode.get(a.locationCode) || null,
  _locationName: locName(a.locationCode),
  _workOrders: WORK_ORDERS.filter((w) => w.assetId === a.assetId).length,
  _openWorkOrders: WORK_ORDERS.filter((w) => w.assetId === a.assetId && w.status !== 'Completed').length,
  _pmCount: PM_SCHEDULES.filter((p) => p.assetId === a.assetId).length,
  _downtimeHrs: DOWNTIME.filter((d) => d.assetId === a.assetId).reduce((s, d) => s + (d.hours || 0), 0),
  _parts: PARTS.filter((p) => p.compatible.includes(a.assetId)).length,
}))

export const ASSET_CATEGORIES = [...new Set(ASSETS.map((a) => a.category))].filter(Boolean).sort()
export const ASSET_STATUSES = [...new Set(ASSETS.map((a) => a.status))].filter(Boolean)

// An asset carrying neither a schedule nor a job is not necessarily wrong — a
// spare boiler and three QC instruments legitimately sit quiet — but it is the
// first thing a maintenance manager looks for when reviewing coverage.
export const uncoveredAssets = assets.filter((a) => !a._pmCount && !a._workOrders)

// ── work orders ──────────────────────────────────────────────────────────
export const OPEN_STATUSES = ['Open', 'In Progress', 'On Hold']

export const workOrders = WORK_ORDERS.map((w) => ({
  ...w,
  dateRequested: shift(w.dateRequested),
  dueDate: shift(w.dueDate),
  dateCompleted: shift(w.dateCompleted),
  _asset: assetById.get(w.assetId) || null,
  _assetName: assetById.get(w.assetId)?.name || w.assetId,
  _locationName: locName(w.locationCode),
  _assignee: userByName.get(w.assignedTo) || null,
  _open: OPEN_STATUSES.includes(w.status),
  _daysToDue: daysUntil(shift(w.dueDate)),
  // Only a job that is still live can be late. A completed one that ran past its
  // date was late once; it is not outstanding work now, and counting it as such
  // is how an overdue figure ends up larger than the open backlog.
  _overdue: OPEN_STATUSES.includes(w.status) && daysUntil(shift(w.dueDate)) < 0,
  _variance: w.actualHrs !== null && w.aiEstimateHrs !== null ? Number((w.actualHrs - w.aiEstimateHrs).toFixed(2)) : null,
}))

export const openWorkOrders = workOrders.filter((w) => w._open)
export const overdueWorkOrders = workOrders.filter((w) => w._overdue)
export const WO_STATUSES = [...new Set(WORK_ORDERS.map((w) => w.status))]
export const WO_TYPES = [...new Set(WORK_ORDERS.map((w) => w.type))]
export const WO_PRIORITIES = ['Critical', 'High', 'Medium', 'Low']

// ── AI estimates ─────────────────────────────────────────────────────────
//
// The comparison the customer asked to see. Only completed jobs carry an actual,
// so the sample is six of fifteen — small enough that every screen showing an
// accuracy figure has to show the count beside it. A "50% exact" headline over
// six rows, presented without its denominator, is the kind of number that gets
// challenged in the room.
export const estimated = workOrders.filter((w) => w.aiEstimateHrs !== null && w.actualHrs !== null)

export const estimateStats = (() => {
  if (!estimated.length) return null
  const abs = estimated.map((w) => Math.abs(w._variance))
  const exact = estimated.filter((w) => w._variance === 0).length
  const over = estimated.filter((w) => w._variance > 0).length
  const under = estimated.filter((w) => w._variance < 0).length
  const totalEst = estimated.reduce((s, w) => s + w.aiEstimateHrs, 0)
  const totalAct = estimated.reduce((s, w) => s + w.actualHrs, 0)
  return {
    sample: estimated.length,
    ofTotal: workOrders.length,
    meanAbsError: Number((abs.reduce((s, v) => s + v, 0) / abs.length).toFixed(2)),
    exact,
    over,
    under,
    totalEstimated: Number(totalEst.toFixed(1)),
    totalActual: Number(totalAct.toFixed(1)),
    biasHrs: Number((totalAct - totalEst).toFixed(1)),
  }
})()

// ── mean time to repair ──────────────────────────────────────────────────
//
// The standard CMMS metric, and on this dataset a thin one. MTTR is the average
// hours actually spent on unplanned repair work, so it counts completed
// corrective and emergency jobs only — a preventive service is not a repair, and
// folding it in would flatter the figure with routine work.
//
// The sample is returned beside the number because it is small. Two or three
// jobs is an average in the arithmetic sense and not in any other, and a bare
// "3.3 hours MTTR" invites a conclusion the data cannot carry.
export const REPAIR_TYPES = ['Corrective', 'Emergency']

export const mttr = (() => {
  const repairs = workOrders.filter(
    (w) => REPAIR_TYPES.includes(w.type) && w.status === 'Completed' && w.actualHrs !== null
  )
  if (!repairs.length) return null
  const total = repairs.reduce((s, w) => s + w.actualHrs, 0)
  return {
    hours: Number((total / repairs.length).toFixed(2)),
    sample: repairs.length,
    totalHours: Number(total.toFixed(1)),
    jobs: repairs,
  }
})()

// ── PM schedules ─────────────────────────────────────────────────────────
export const pmSchedules = PM_SCHEDULES.map((p) => ({
  ...p,
  lastDone: shift(p.lastDone),
  nextDue: shift(p.nextDue),
  _asset: assetById.get(p.assetId) || null,
  _assetName: assetById.get(p.assetId)?.name || p.assetId,
  _locationName: locName(assetById.get(p.assetId)?.locationCode),
  _daysToDue: daysUntil(shift(p.nextDue)),
  _status: (() => {
    const d = daysUntil(shift(p.nextDue))
    if (d === null) return 'Scheduled'
    if (d < 0) return 'Overdue'
    if (d === 0) return 'Due today'
    if (d <= 7) return 'Due soon'
    return 'Scheduled'
  })(),
}))

export const overduePM = pmSchedules.filter((p) => p._daysToDue !== null && p._daysToDue < 0)
export const PM_FREQUENCIES = [...new Set(PM_SCHEDULES.map((p) => p.frequency))]
export const PM_TEAMS = [...new Set(PM_SCHEDULES.map((p) => p.team))].filter(Boolean).sort()

// PM compliance, over the schedules that have a date to be judged against.
export const pmCompliance = pmSchedules.length
  ? Math.round(((pmSchedules.length - overduePM.length) / pmSchedules.length) * 100)
  : null

// ── parts ────────────────────────────────────────────────────────────────
//
// Nothing in the supplied workbook sits at or below its reorder point, which
// matters because stock alerts are one of the things the customer asked to see.
// Rather than invent a shortage, the band below reports what is actually there:
// three parts are one unit above their trigger, and those are the rows a stores
// controller would be watching.
export const parts = PARTS.map((p) => {
  const qty = p.qtyOnHand ?? 0
  const point = p.reorderPoint ?? 0
  const state = qty <= 0 ? 'Out of stock'
    : qty <= point ? 'Below reorder point'
      : qty <= point + 1 ? 'Approaching reorder'
        : 'In stock'
  return {
    ...p,
    _value: Number(((p.qtyOnHand ?? 0) * (p.unitCost ?? 0)).toFixed(2)),
    _state: state,
    _headroom: qty - point,
    _assets: p.compatible.map((id) => assetById.get(id)).filter(Boolean),
    _storeroomName: locName(p.storeroom),
    // Filled in below, once purchase orders have been joined. A part that is
    // short but already on order is a different problem from one nobody has
    // raised an order for, and every shortage screen needs to tell them apart.
    _incoming: 0,
    _openPos: [],
  }
})

export const partsBelowReorder = parts.filter((p) => p._state === 'Below reorder point' || p._state === 'Out of stock')
export const partsApproaching = parts.filter((p) => p._state === 'Approaching reorder')
export const inventoryValue = Number(parts.reduce((s, p) => s + p._value, 0).toFixed(2))
export const PART_CATEGORIES = [...new Set(PARTS.map((p) => p.category))].filter(Boolean).sort()

// ── downtime ─────────────────────────────────────────────────────────────
export const downtime = DOWNTIME.map((d) => ({
  ...d,
  start: shiftStamp(d.start),
  end: shiftStamp(d.end),
  _asset: assetById.get(d.assetId) || null,
  _assetName: assetById.get(d.assetId)?.name || d.assetId,
  _locationName: locName(d.locationCode),
  _planned: d.category === 'Planned',
}))

export const downtimeHours = Number(downtime.reduce((s, d) => s + (d.hours || 0), 0).toFixed(1))
export const unplannedDowntime = downtime.filter((d) => !d._planned)
export const unplannedHours = Number(unplannedDowntime.reduce((s, d) => s + (d.hours || 0), 0).toFixed(1))

/** Hours grouped by a field, biggest first — what a Pareto needs. */
export const downtimeBy = (key) => {
  const m = new Map()
  downtime.forEach((d) => m.set(d[key], (m.get(d[key]) || 0) + (d.hours || 0)))
  return [...m.entries()]
    .map(([name, value]) => ({ name, value: Number(value.toFixed(1)) }))
    .sort((a, b) => b.value - a.value)
}

// ── purchase orders ──────────────────────────────────────────────────────
//
// The procurement half of parts inventory. Each order names a part, a vendor and
// the person who raised it, and its "Linked To" line says what it was raised
// for — a customer batch, a reorder trigger, or a specific job. Those references
// are resolved here rather than left as prose, so an order opens onto the work
// order or schedule that caused it.
export const PO_OPEN_STATUSES = ['Draft', 'Pending Approval', 'Approved', 'Ordered', 'Partially Received']
export const PO_STATUSES = [...new Set(PURCHASE_ORDERS.map((p) => p.status))]

// "Spare stock for WO-2001 (Loom #3 fault)" and "Linked to PM-011 annual
// calibration" both name a record the portal already holds. Pulled out by
// pattern rather than by a foreign key, because the source column is a sentence.
const REF = /(WO-\d{4}|PM-\d{3}|AST-\d{4}|PRT-\d{4}|PO-\d{4})/g

/**
 * One order, given the fields every screen reads it through.
 *
 * Exported because orders raised in the portal have to arrive at those screens
 * carrying the same fields as the workbook's, and a second copy of this
 * arithmetic beside the create form is how the register and the record page end
 * up disagreeing about whether an order is late.
 *
 * `shiftDates` is the one difference between the two callers. Workbook dates are
 * anchored and moved at read time; an order raised in a meeting is already dated
 * today and moving it would put a brand new order in the past.
 */
export function derivePurchaseOrder(po, { shiftDates = true } = {}) {
  const when = shiftDates ? shift : (d) => d || ''
  const part = PARTS.find((p) => p.partNo === po.partNo) || null
  const refs = [...new Set(String(po.linkedTo || '').match(REF) || [])]
  const open = PO_OPEN_STATUSES.includes(po.status)
  const outstanding = Math.max(0, (po.qtyOrdered || 0) - (po.qtyReceived || 0))
  const expected = when(po.expectedDate)
  return {
    ...po,
    orderDate: when(po.orderDate),
    expectedDate: expected,
    receivedDate: when(po.receivedDate),
    _part: part,
    _requester: USERS.find((u) => u.name === po.requestedBy) || null,
    // Every id the Linked To sentence mentions, so the record page can offer
    // them as links instead of printing the sentence and leaving it there.
    _refs: refs,
    _open: open,
    // Only an order still in flight has anything outstanding. A cancelled one
    // has nothing on the way, and counting its quantity as incoming is how a
    // stores controller ends up waiting for a delivery nobody placed.
    _outstanding: po.status === 'Cancelled' ? 0 : outstanding,
    _incoming: open && po.status !== 'Cancelled' ? outstanding : 0,
    _daysToExpected: daysUntil(expected),
    _late: open && expected ? daysUntil(expected) < 0 : false,
  }
}

export const purchaseOrders = PURCHASE_ORDERS.map((po) => derivePurchaseOrder(po))

export const openPurchaseOrders = purchaseOrders.filter((p) => p._open)
export const latePurchaseOrders = purchaseOrders.filter((p) => p._late)
export const poCommitted = Number(
  openPurchaseOrders.reduce((s, p) => s + (p.totalCost || 0), 0).toFixed(2)
)

/** Orders against one part — what the stores is waiting on for it. */
export const posForPart = (partNo) => purchaseOrders.filter((p) => p.partNo === partNo)

/** Quantity on the way for a part, across every order still in flight. */
export const incomingFor = (partNo) =>
  purchaseOrders.filter((p) => p.partNo === partNo).reduce((s, p) => s + p._incoming, 0)

/** Orders that mention a given record id in their Linked To line. */
export const posLinkedTo = (id) => purchaseOrders.filter((p) => p._refs.includes(id))

// Stitched on rather than computed inside `parts`, which is built above this
// block. Mutating once at module load keeps a single `parts` array that every
// screen shares — the alternative, a second derived array, is how two screens
// end up disagreeing about whether a shortage is already on order.
parts.forEach((p) => {
  const mine = purchaseOrders.filter((po) => po.partNo === p.partNo)
  p._incoming = mine.reduce((s, po) => s + po._incoming, 0)
  p._openPos = mine.filter((po) => po._open)
})

// ── people ───────────────────────────────────────────────────────────────
export const users = USERS.map((u) => {
  const mine = workOrders.filter((w) => w.assignedTo === u.name)
  return {
    ...u,
    _departmentName: locName(u.department),
    _assigned: mine.length,
    _open: mine.filter((w) => w._open).length,
    _completed: mine.filter((w) => w.status === 'Completed').length,
    _hoursLogged: Number(mine.reduce((s, w) => s + (w.actualHrs || 0), 0).toFixed(1)),
    _openHours: Number(mine.filter((w) => w._open).reduce((s, w) => s + (w.aiEstimateHrs || 0), 0).toFixed(1)),
  }
})

export const TEAMS = [...new Set(USERS.map((u) => u.team))].filter(Boolean).sort()
export const SHIFTS = [...new Set(USERS.map((u) => u.shift))].filter(Boolean)

// Work with no owner. Every one of these is a real row in the sheet, and it is
// the number a planner acts on first.
export const unassignedWork = openWorkOrders.filter((w) => !w.assignedTo || w.assignedTo === 'Unassigned')
