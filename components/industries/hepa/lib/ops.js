'use client'

// Raising things: work orders, maintenance requests, checklist runs.
//
// Three screens create records and two of them can create each other's, so the
// rules live here rather than in three copies. Same reason the lifecycle
// helpers are in one file — a request converted to a work order on the Requests
// screen has to produce exactly what the Work Orders screen would have created.
//
// Everything here writes through the record store, so a created row survives a
// reload and appears in the other screens that read the same kind.

import { useMemo } from 'react'
import {
  WORK_ORDERS, FILTER_VIEW, CLEANROOMS, TECHNICIANS, USER, THRESHOLDS,
  SEEDED_REQUEST_RECORDS,
} from './data'
import { INCIDENTS } from './data/inspections'
import { useStore } from './store'

export const ORDER_TYPES = [
  { code: 'PM01', label: 'PM01 - Corrective', what: 'Raised because something was found.' },
  { code: 'PM02', label: 'PM02 - Replacement', what: 'A filter change, with validation either side.' },
  { code: 'PM04', label: 'PM04 - Preventive (HEPA Test)', what: 'A scheduled integrity test.' },
  { code: 'PM04L', label: 'PM04 - Preventive (Leak Check)', what: 'A scheduled pressure differential round.' },
]

export const PRIORITIES = ['Critical', 'High', 'Medium', 'Low']

export const REQUEST_KINDS = [
  'Pressure differential rising',
  'Visible damage to filter or frame',
  'Failed integrity test follow-up',
  'Gasket or seal suspect',
  'Certification due',
  'Other',
]

/**
 * The next order number, continuing the client's own sequence.
 *
 * Their orders run 40005000 upward. A created one carries on from the highest
 * on file rather than starting a parallel numbering that would look like a
 * second system — the same reasoning the FSM portal used for its WO-1001 range.
 */
export function nextOrderNumber(existing = []) {
  const nums = [...WORK_ORDERS.map((w) => w.workOrderId), ...existing.map((w) => w.workOrderId)]
    .map((n) => Number(String(n).replace(/\D/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0)
  return String((nums.length ? Math.max(...nums) : 40005000) + 1)
}

export function nextRequestNumber(existing = []) {
  const nums = [...SEEDED_REQUEST_RECORDS, ...existing]
    .map((r) => Number(String(r.requestId || '').replace(/\D/g, '')))
    .filter(Boolean)
  return `REQ-${String((nums.length ? Math.max(...nums) : 6000) + 1)}`
}

/** Work orders created here, shaped like the imported ones so a screen cannot tell. */
export function useCreatedOrders() {
  const store = useStore()
  const rows = store?.records?.hepa_work_order || []
  return useMemo(() => rows.map((r) => {
    const f = FILTER_VIEW.find((x) => x.filterId === r.filterId) || null
    return {
      ...r,
      workOrderId: r.workOrderId || r.recordId,
      cleanroomId: f?.cleanroomId || r.cleanroomId || null,
      cleanroomName: f?.cleanroomName || r.cleanroomName || '—',
      isoClass: f?.isoClass || '—',
      sapEquipmentId: f?.sap?.sapEquipmentId || null,
      sapFunctionalLocation: f?.sap?.sapFunctionalLocation || null,
      documentRef: f?.document?.documentRef || null,
      orderClass: String(r.workOrderType || '').split(' ')[0] || 'PM01',
      dueIn: f?.dueIn ?? null,
      dueOn: f?.nextCertDueOn || null,
      // Marked, because a row created in the portal has not been through SAP
      // and a screen that hides that is lying about where the number came from.
      raisedHere: true,
      syncStatus: r.syncStatus || 'Not sent',
    }
  }), [rows])
}

/**
 * The register: what is already on it, plus what has been raised since.
 *
 * Same merge rule as everywhere else in this portal — a stored record with the
 * same id replaces the seeded one, so a seeded request can be triaged and the
 * change sticks without copying all eight into the database first.
 */
/**
 * A stored request, with the record store's own `kind` taken back off it.
 *
 * Every record in the store carries `kind` as its record-kind — `hepa_request`
 * — and a request's own "what was reported" field was called the same thing.
 * Merging a stored row over a seeded one therefore replaced a real report with
 * the literal string "hepa_request" in the register's Reported column, and a
 * triaged request was enough to do it. What the form collects is written as
 * `reportedKind`; this puts it back under the name the screens read.
 */
function stored(row) {
  const { kind, reportedKind, ...rest } = row
  return reportedKind ? { ...rest, kind: reportedKind } : rest
}

export function useRequests() {
  const store = useStore()
  const rows = store?.records?.hepa_request || []
  return useMemo(() => {
    const byId = new Map(rows.map((r) => [r.recordId, stored(r)]))
    const merged = SEEDED_REQUEST_RECORDS.map((r) => {
      const patch = byId.get(r.recordId)
      return patch ? { ...r, ...patch } : r
    })
    const seededIds = new Set(SEEDED_REQUEST_RECORDS.map((r) => r.recordId))
    const created = rows.filter((r) => !seededIds.has(r.recordId)).map(stored)
    return [...created, ...merged]
      .sort((a, b) => String(b.raisedAt || '').localeCompare(String(a.raisedAt || '')))
  }, [rows])
}

export const requestById = (requests, id) =>
  requests.find((r) => r.requestId === id || r.recordId === id) || null

export function useChecklistRuns() {
  const store = useStore()
  const rows = store?.records?.hepa_checklist_run || []
  return useMemo(
    () => [...rows].sort((a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || ''))),
    [rows],
  )
}

/**
 * Raise a work order.
 *
 * `filterId` is required and checked against the registry, because an order
 * against an asset nobody holds is the row that reaches SAP and bounces.
 */
/**
 * The form's own fields, trimmed to what was actually filled in.
 *
 * Empty strings and empty arrays are dropped rather than stored: a record
 * carrying `safety: ''` reads on a detail screen as "safety requirements were
 * considered and there are none", which is not what an untouched field means.
 */
function workOrderDetail(d) {
  const out = {}
  for (const [k, v] of Object.entries(d)) {
    if (k === 'title' || k === 'description' || k === 'filterId') continue
    if (v === '' || v === null || v === undefined || v === false) continue
    if (Array.isArray(v) && v.length === 0) continue
    out[k] = v
  }
  return out
}

export async function createWorkOrder(store, form, existing = []) {
  const f = FILTER_VIEW.find((x) => x.filterId === form.filterId)
  if (!f) {
    store.notify('Pick a filter from the registry — an order needs an asset.', 'error')
    return null
  }
  if (!form.description?.trim()) {
    store.notify('Say what the work is. An order with no description cannot be planned.', 'error')
    return null
  }

  const type = ORDER_TYPES.find((t) => t.code === form.orderType) || ORDER_TYPES[0]
  const workOrderId = nextOrderNumber(existing)
  const now = new Date().toISOString()

  const record = await store.create('hepa_work_order', {
    recordId: `wo_${workOrderId}`,
    workOrderId,
    workOrderType: type.label,
    filterId: f.filterId,
    cleanroomId: f.cleanroomId,
    cleanroomName: f.cleanroomName,
    priority: form.priority || 'Medium',
    description: form.description.trim(),
    technicianName: form.technicianName || null,
    technicianId: TECHNICIANS.find((t) => t.name === form.technicianName)?.technicianId || null,
    status: 'Open',
    raisedBy: USER.name,
    raisedAt: now,
    raisedOn: now.slice(0, 10),
    fromRequest: form.fromRequest || null,
    // Which round found it, when a round did. Without it a finding turned into
    // work is indistinguishable from one nobody acted on, and "findings with no
    // follow-up" is the one number on the Inspection Reports screen worth
    // reading.
    fromInspection: form.fromInspection || null,
    syncStatus: 'Not sent',
    // Everything the nine-section form collected beyond the five fields an
    // order needs to exist. Kept whole rather than spread across the record so
    // a screen reading an imported order and one reading a raised order see
    // the same shape, and the extra sections are somewhere to be found when a
    // detail tab wants them.
    ...(form.detail ? { detail: workOrderDetail(form.detail) } : {}),
    ...(form.detail?.title?.trim() ? { title: form.detail.title.trim() } : {}),
  })

  if (record) store.notify(`Work order ${workOrderId} raised.`)
  return record
}

export async function updateWorkOrderStatus(store, order, status) {
  const saved = await store.update('hepa_work_order', order.recordId, {
    status,
    ...(status === 'Completed' ? { completedAt: new Date().toISOString(), completedBy: USER.name } : {}),
  })
  if (saved) store.notify(`Order ${order.workOrderId} is now ${status}.`)
  return saved
}

/** Raise a request. Deliberately lighter than an order — anyone can raise one. */
export async function createRequest(store, form, existing = []) {
  if (!form.filterId && !form.cleanroomId) {
    store.notify('Say which filter or which room this is about.', 'error')
    return null
  }
  if (!form.detail?.trim()) {
    store.notify('Describe what was observed.', 'error')
    return null
  }

  const f = FILTER_VIEW.find((x) => x.filterId === form.filterId) || null
  const requestId = nextRequestNumber(existing)
  const now = new Date().toISOString()

  const record = await store.create('hepa_request', {
    recordId: `req_${requestId}`,
    requestId,
    filterId: f?.filterId || null,
    cleanroomId: f?.cleanroomId || form.cleanroomId,
    cleanroomName: f?.cleanroomName
      || CLEANROOMS.find((c) => c.cleanroomId === form.cleanroomId)?.name
      || '—',
    // Not `kind` — see the note on `stored()`. The product's form asks for a
    // category rather than one of the register's fixed reports, so the
    // category is what the Reported column shows when there is one.
    reportedKind: form.kind || form.category || REQUEST_KINDS[0],
    urgency: form.urgency || 'Medium',
    detail: form.detail.trim(),
    raisedBy: form.raisedBy?.trim() || USER.name,
    raisedAt: now,
    status: 'Open',
    // What the product's form collects beyond the four fields a request needs
    // to exist. Written flat rather than nested because the register's columns
    // and the record page read them one at a time.
    ...(form.title?.trim() ? { title: form.title.trim() } : {}),
    ...(form.category ? { category: form.category } : {}),
    ...(form.subCategory?.trim() ? { subCategory: form.subCategory.trim() } : {}),
    ...(form.assignedTo ? { assignedTo: form.assignedTo } : {}),
    ...(form.assignedDepartment ? { assignedDepartment: form.assignedDepartment } : {}),
    ...(form.assignmentNotes?.trim() ? { assignmentNotes: form.assignmentNotes.trim() } : {}),
    ...(form.requesterEmail?.trim() ? { requesterEmail: form.requesterEmail.trim() } : {}),
    ...(form.requesterPhone?.trim() ? { requesterPhone: form.requesterPhone.trim() } : {}),
    ...(form.images?.length ? { images: form.images } : {}),
  })

  if (record) store.notify(`Request ${requestId} raised.`)
  return record
}

/**
 * Turn a request into a work order.
 *
 * The request is not deleted — it is marked converted and carries the order
 * number, so the trail from "somebody noticed something" to "somebody was sent"
 * stays intact. That trail is the whole reason to have requests separate from
 * orders in the first place.
 */
export async function convertRequest(store, request, existingOrders = []) {
  const order = await createWorkOrder(store, {
    filterId: request.filterId,
    orderType: request.kind === 'Certification due' ? 'PM04'
      : request.kind === 'Visible damage to filter or frame' ? 'PM02'
        : 'PM01',
    priority: request.urgency,
    description: `${request.kind} — ${request.detail}`,
    fromRequest: request.requestId,
  }, existingOrders)

  if (!order) return null

  await store.update('hepa_request', request.recordId, {
    status: 'Converted',
    convertedTo: order.workOrderId,
    convertedAt: new Date().toISOString(),
    convertedBy: USER.name,
  })
  return order
}

/**
 * Pick a request up.
 *
 * The product's register counts requests Under Review as their own state, and
 * it is a real one: somebody has taken the request but has not yet decided
 * whether it becomes a job. Without it a request sits at Pending until the
 * moment a work order appears, which tells the person who raised it nothing.
 */
export async function reviewRequest(store, request) {
  const saved = await store.update('hepa_request', request.recordId, {
    status: 'Under Review',
    reviewedBy: USER.name,
    reviewedAt: new Date().toISOString(),
  })
  if (saved) store.notify(`${request.requestId} picked up for review.`)
  return saved
}

export async function rejectRequest(store, request, reason) {
  if (!reason?.trim()) {
    store.notify('A rejected request needs a reason on it.', 'error')
    return null
  }
  const saved = await store.update('hepa_request', request.recordId, {
    status: 'Rejected',
    rejectionReason: reason.trim(),
    rejectedBy: USER.name,
    rejectedAt: new Date().toISOString(),
  })
  if (saved) store.notify('Request closed with a reason on the record.')
  return saved
}

/** Record a completed checklist run. */
export async function completeChecklist(store, template, form) {
  const answered = Object.keys(form.checks || {}).filter((k) => form.checks[k]).length
  if (answered < template.items.length) {
    store.notify(`${template.items.length - answered} steps are not ticked. A partial run is not a completed checklist.`, 'error')
    return null
  }
  if (!form.filterId) {
    store.notify('Say which filter this run was against.', 'error')
    return null
  }

  const f = FILTER_VIEW.find((x) => x.filterId === form.filterId) || null
  const now = new Date().toISOString()

  const record = await store.create('hepa_checklist_run', {
    recordId: `run_${template.id}_${form.filterId}_${Date.now().toString(36)}`,
    templateId: template.id,
    templateName: template.name,
    filterId: form.filterId,
    cleanroomName: f?.cleanroomName || '—',
    steps: template.items.length,
    completed: answered,
    notes: (form.notes || '').trim() || null,
    completedBy: form.technicianName || USER.name,
    completedAt: now,
    outcome: form.outcome || 'Pass',
  })

  if (record) store.notify(`${template.name} completed against ${form.filterId}.`)
  return record
}

// ── incidents ─────────────────────────────────────────────────────────────
//
// The list screen raises them and the record screen investigates and closes
// them, so the vocabulary and the four writes live here rather than in two
// copies that would drift apart the first time a status was added.

/**
 * The events this site records, each carrying its own classification.
 *
 * Classification is a property of the event, not a free choice: a gowning
 * breach is a personnel finding wherever it happens and a seal breach is an
 * equipment one. Letting the person raising it pick both would produce a
 * register that cannot be counted by classification, which is the cut Quality
 * takes it in. Severity and impact stay editable because those are judgements
 * about this occurrence.
 */
export const INCIDENT_TYPES = [
  { type: 'Particle count excursion', classification: 'Environmental', severity: 'Major', impact: 'Batch under review' },
  { type: 'Pressure cascade loss', classification: 'Facility', severity: 'Major', impact: 'Suite cleared' },
  { type: 'Filter seal breach', classification: 'Equipment', severity: 'Critical', impact: 'Room out of use' },
  { type: 'Gowning discipline breach', classification: 'Personnel', severity: 'Minor', impact: 'No product impact' },
  { type: 'Material transfer deviation', classification: 'Process', severity: 'Minor', impact: 'No product impact' },
]

export const INCIDENT_SEVERITIES = ['Critical', 'Major', 'Minor']
export const INCIDENT_PRIORITIES = ['Urgent', 'High', 'Medium', 'Low']
export const INCIDENT_IMPACTS = [
  'Batch under review', 'Suite cleared', 'Room out of use', 'No product impact',
]

// The states an incident report moves through. The whole set, because a
// register that only knows Open and Closed cannot say whether the analysis has
// started or whether closure is waiting on a signature.
export const INCIDENT_STATUSES = [
  'Draft', 'Submitted', 'Open', 'Under investigation', 'RCA in progress',
  'Actions in progress', 'Pending closure', 'Closed', 'Rejected', 'Reopened',
  'Escalated', 'On hold',
]

// The ones that mean somebody is still working on it. Used by the Pending card
// and by its filter, so the number and the list it opens cannot disagree.
export const PENDING_STATUSES = [
  'Submitted', 'Open', 'Under investigation', 'RCA in progress',
  'Actions in progress', 'Pending closure', 'Reopened', 'Escalated',
]

// Annex 1's two occupancy states, and what the room was doing.
export const ROOM_CONDITIONS = ['At rest', 'In operation']
export const ROOM_ACTIVITIES = [
  'Aseptic filling', 'Line setup', 'Changeover',
  'Cleaning and sanitisation', 'Idle', 'Maintenance',
]

export const FOUND_BY = ['Inspection round', 'Monitoring alarm']

export const RCA_CATEGORIES = [
  'Environmental control loss',
  'Filter or seal integrity',
  'Run to failure',
  'Lack of maintenance',
  'Operator or personnel practice',
  'Other',
]

export const RCA_METHODS = ['5 Why', 'Ishikawa', 'Fault tree analysis']

export const ACTION_STATUSES = ['Planned', 'On hold', 'In progress', 'Completed', 'Cancelled']

/** The next reference, continuing the register's own sequence rather than starting a second one. */
export function nextIncidentNumber(existing = []) {
  const nums = [...INCIDENTS, ...existing]
    .map((i) => Number(String(i.incidentId || '').replace(/\D/g, '')))
    .filter(Boolean)
  return `INC-${String((nums.length ? Math.max(...nums) : 2100) + 1)}`
}

/** The register: what is on it, with anything raised or changed here applied. */
export function useIncidents() {
  const store = useStore()
  const rows = store?.records?.hepa_incident || []
  return useMemo(() => {
    const byId = new Map(rows.map((r) => [r.recordId, r]))
    const merged = INCIDENTS.map((r) => {
      const patch = byId.get(r.incidentId)
      return patch ? { ...r, ...patch } : r
    })
    const seededIds = new Set(INCIDENTS.map((r) => r.incidentId))
    const created = rows.filter((r) => !seededIds.has(r.recordId))
    return [...created, ...merged]
      .sort((a, b) => String(b.raisedAt || b.date || '').localeCompare(String(a.raisedAt || a.date || '')))
  }, [rows])
}

export const incidentFromList = (list, id) =>
  list.find((i) => i.incidentId === id || i.recordId === id) || null

/**
 * Raise an incident.
 *
 * Either a filter or a cleanroom, the way the product requires either an asset
 * or a location: a gowning breach is room-wide and naming a filter for it would
 * be a worse record than naming none.
 */
export async function createIncident(store, form, existing = []) {
  const kind = INCIDENT_TYPES.find((k) => k.type === form.type)
  if (!kind) {
    store.notify('Pick the incident type. Its classification follows from it.', 'error')
    return null
  }
  if (!form.filterId && !form.cleanroomId) {
    store.notify('Either a filter or a cleanroom must be selected.', 'error')
    return null
  }
  if (!form.description?.trim()) {
    store.notify('Incident description is required.', 'error')
    return null
  }

  const f = FILTER_VIEW.find((x) => x.filterId === form.filterId) || null
  const room = CLEANROOMS.find((c) => c.cleanroomId === (f?.cleanroomId || form.cleanroomId)) || null
  const incidentId = nextIncidentNumber(existing)
  const date = form.date || new Date().toISOString().slice(0, 10)

  const record = await store.create('hepa_incident', {
    recordId: incidentId,
    incidentId,
    type: kind.type,
    classification: kind.classification,
    severity: form.severity || kind.severity,
    priority: form.priority || 'Medium',
    date,
    raisedAt: `${date}T${form.time || '00:00'}:00`,
    filterId: f?.filterId || null,
    cleanroomId: room?.cleanroomId || null,
    cleanroomName: room?.name || '—',
    isoClass: room?.isoClass || '—',
    area: form.area?.trim() || null,
    roomCondition: form.roomCondition || null,
    roomActivity: form.roomActivity || null,
    operator: form.operator?.trim() || null,
    description: form.description.trim(),
    equipmentDamage: form.equipmentDamage?.trim() || null,
    additionalComments: form.additionalComments?.trim() || null,
    productImpact: form.productImpact || kind.impact,
    downtimeHours: Number(form.downtimeHours) || 0,
    foundBy: form.foundBy || 'Inspection round',
    documentRef: f?.document?.documentRef || null,
    attachments: (form.attachments || [])
      .filter((a) => a.name?.trim())
      .map((a) => ({ name: a.name.trim(), type: a.type || 'Document', description: (a.description || '').trim() })),
    // Nothing established yet. The record page draws the analysis panel empty
    // and says so rather than hiding it, which is how a reviewer can tell that
    // there is none rather than wondering where it went.
    rootCause: null,
    rootCauseCategory: null,
    rca: null,
    capa: null,
    closedOn: null,
    daysToClose: null,
    status: form.status || 'Draft',
    reportedBy: USER.name,
    _open: form.status !== 'Closed',
    _daysAgo: 0,
    raisedHere: true,
  })

  if (record) store.notify(`Incident report ${incidentId} created successfully.`)
  return record
}

/** Edit a raised or seeded incident. Works on both — see the store's merge rule. */
export async function updateIncident(store, incident, patch) {
  const saved = await store.update('hepa_incident', incident.incidentId, {
    incidentId: incident.incidentId,
    ...patch,
    ...(patch.status ? { _open: patch.status !== 'Closed' && patch.status !== 'Rejected' } : {}),
    modifiedBy: USER.name,
    modifiedAt: new Date().toISOString(),
  })
  if (saved) store.notify('Incident report updated successfully.')
  return saved
}

/**
 * Close an incident on a corrective action.
 *
 * The CAPA is required rather than optional. An incident closed with nothing
 * written against it is a record saying the event was dealt with when nobody
 * can say what was done, and that record is what an Annex 1 inspection reads.
 */
export async function closeIncidentWithCapa(store, incident, capa) {
  if (!capa?.trim()) {
    store.notify('An incident cannot be closed without a corrective action on it.', 'error')
    return null
  }
  const closedOn = new Date().toISOString().slice(0, 10)
  const saved = await store.update('hepa_incident', incident.incidentId, {
    incidentId: incident.incidentId,
    capa: capa.trim(),
    status: 'Closed',
    closedOn,
    closedBy: USER.name,
    daysToClose: Math.max(0, Math.round((new Date(closedOn) - new Date(incident.date)) / 86400000)),
    _open: false,
  })
  if (saved) store.notify(`Incident ${incident.incidentId} closed.`)
  return saved
}

/** Record or revise the root cause analysis held against an incident. */
export async function saveIncidentRca(store, incident, rca) {
  if (!rca.category) {
    store.notify('Category is required', 'error')
    return null
  }
  if (!rca.description?.trim()) {
    store.notify('Description is required', 'error')
    return null
  }
  if ((rca.correctiveActions || []).some((a) => !a.description?.trim())) {
    store.notify('Description is required', 'error')
    return null
  }

  const saved = await store.update('hepa_incident', incident.incidentId, {
    incidentId: incident.incidentId,
    rca: {
      category: rca.category,
      description: rca.description.trim(),
      analysisMethod: rca.analysisMethod?.trim() || null,
      recurring: Boolean(rca.recurring),
      contributingFactors: rca.contributingFactors?.trim() || null,
      assetConditionSatisfactory: Boolean(rca.assetConditionSatisfactory),
      downtimeImpactHours: rca.downtimeImpactHours === '' || rca.downtimeImpactHours == null
        ? null : Number(rca.downtimeImpactHours),
      correctiveActions: (rca.correctiveActions || []).map((a) => ({
        description: a.description.trim(),
        status: a.status || null,
        assignedTo: a.assignedTo || null,
        dueDate: a.dueDate || null,
      })),
      createdBy: incident.rca?.createdBy || USER.name,
      createdOn: incident.rca?.createdOn || new Date().toISOString().slice(0, 10),
    },
    // The analysis is where the cause is established, so the incident's own
    // root cause follows it rather than being typed twice.
    rootCause: rca.description.trim(),
    rootCauseCategory: rca.category,
  })
  if (saved) {
    store.notify(incident.rca
      ? 'Root Cause Analysis updated successfully'
      : 'Root Cause Analysis created successfully')
  }
  return saved
}

export async function deleteIncidentRca(store, incident) {
  const saved = await store.update('hepa_incident', incident.incidentId, {
    incidentId: incident.incidentId,
    rca: null,
  })
  if (saved) store.notify('Root Cause Analysis deleted')
  return saved
}

/** Filters worth defaulting a form to: the ones something is wrong with. */
export const suggestedFilters = () => [
  ...FILTER_VIEW.filter((f) => f.concern),
  ...FILTER_VIEW.filter((f) => !f.concern && f.dueIn != null && f.dueIn <= THRESHOLDS.notificationLeadDays.value),
]
