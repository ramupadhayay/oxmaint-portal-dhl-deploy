// The SAP integration gateway.
//
// What this is, plainly: a real HTTP boundary that serves the customer's own
// SAP export in the shapes SAP itself uses. It is not a live connection to
// their system, and nothing here pretends otherwise — the status endpoint says
// which mode it is running in, and the console screen prints that on the page.
//
// It is worth building as a real boundary rather than reading the arrays
// straight from the component, because everything that makes an integration
// hard lives at the boundary and nowhere else: a request that takes time, a
// response envelope you have to unwrap, an error you have to surface rather
// than swallow, a retry that has to be idempotent. A screen that fakes those in
// component state demonstrates a picture of an integration. This one has to
// handle them.
//
// The envelope is modelled on SAP's OData v2 responses — `d` for a single
// entity, `d.results` for a collection, and errors as `{error: {code, message}}`
// — so the console shows a payload a SAP engineer recognises rather than one we
// invented.

import { NextResponse } from 'next/server'
import {
  SAP_RECORDS, FILTER_VIEW, WORK_ORDERS, DOCUMENT_RECORDS, ORG,
} from '@/components/industries/hepa/lib/data/index.js'

export const GATEWAY = {
  // What a connection card needs to show. Every field here is a fact about
  // this deployment rather than decoration.
  system: 'S4H',
  client: '100',
  host: 'sap-gw.internal',
  service: '/sap/opu/odata/sap/ZHEPA_COMPLIANCE_SRV',
  protocol: 'OData v2',
  auth: 'OAuth 2.0 client credentials',
  plant: 'SPK1',
  // The one thing that must never be dressed up.
  mode: 'workbook-backed',
  modeNote: 'Serving the SAP Integration Map exported from the compliance '
    + 'workbook. Point SAP_GATEWAY_URL at a live gateway to switch this over — '
    + 'the endpoints and payload shapes below do not change.',
  site: ORG.site,
}

export const ENDPOINTS = [
  {
    id: 'status',
    method: 'GET',
    path: '/api/hepa/sap/status',
    sapPath: '$metadata',
    what: 'Handshake and queue depth. What a health check calls.',
  },
  {
    id: 'equipment',
    method: 'GET',
    path: '/api/hepa/sap/equipment',
    sapPath: 'EquipmentSet',
    what: 'The asset master record for a filter — equipment id, functional location, plant.',
  },
  {
    id: 'work-orders',
    method: 'GET',
    path: '/api/hepa/sap/work-orders',
    sapPath: 'MaintenanceOrderSet',
    what: 'Maintenance orders, filterable by order class and status.',
  },
  {
    id: 'sync',
    method: 'POST',
    path: '/api/hepa/sap/sync',
    sapPath: 'ConfirmationSet',
    what: 'Posts a completion confirmation, or retries one the queue rejected.',
  },
]

// SAP-shaped envelopes. `d` for one entity, `d.results` for a collection.
export const one = (entity, extra = {}) =>
  NextResponse.json({ d: { ...entity, __metadata: { type: extra.type || 'ZHEPA.Entity' } }, ...extra.meta })

export const many = (rows, type = 'ZHEPA.Entity') =>
  NextResponse.json({ d: { results: rows.map((r) => ({ ...r, __metadata: { type } })) } })

export const sapError = (code, message, status = 400) =>
  NextResponse.json(
    { error: { code, message: { lang: 'en', value: message } } },
    { status },
  )

// A boundary that answers instantly is the one nobody writes a loading state
// for, and then the first slow response in production has nowhere to render.
// This is small and bounded — enough to be real, not enough to be annoying.
export const latency = (ms = 220) => new Promise((r) => setTimeout(r, ms))

/** The equipment master, in SAP's field names rather than ours. */
export const equipmentOf = (row) => {
  const f = FILTER_VIEW.find((x) => x.filterId === row.filterId) || null
  return {
    Equipment: row.sapEquipmentId,
    EquipmentName: `HEPA filter ${row.filterId}`,
    FunctionalLocation: row.sapFunctionalLocation,
    TechnicalObjectType: 'HEPA',
    MaintenancePlant: GATEWAY.plant,
    PlannerGroup: 'QA1',
    Location: f?.cleanroomName || '',
    LocationCode: f?.cleanroomId || '',
    ConstructionYear: f?.installDate ? String(f.installDate).slice(0, 4) : '',
    StartUpDate: f?.installDate || null,
    EquipmentStatus: f?.status === 'Active' ? 'AVLB' : 'INAC',
    // Ours, carried alongside rather than dressed as SAP's.
    _oxmaintFilterId: row.filterId,
    _oxmaintDocumentRef: row.documentRef,
  }
}

/** A maintenance order, in SAP's field names. */
export const orderOf = (w, status) => ({
  MaintenanceOrder: w.workOrderId,
  MaintenanceOrderType: w.orderClass,
  MaintOrderDesc: String(w.workOrderType).replace(/^PM\d+ - /, ''),
  Equipment: w.sapEquipmentId,
  FunctionalLocation: w.sapFunctionalLocation,
  MaintenancePlant: GATEWAY.plant,
  MaintOrdBasicStartDate: w.raisedOn,
  MaintOrderSystemStatus: SYSTEM_STATUS[status] || 'CRTD',
  _oxmaintFilterId: w.filterId,
  _oxmaintDocumentRef: w.documentRef,
  _oxmaintStatus: status,
})

// SAP writes order state as system status codes, not words.
export const SYSTEM_STATUS = {
  Open: 'CRTD REL',
  'In Progress': 'REL PRC',
  'Pending Approval': 'REL CNF',
  Completed: 'CNF TECO',
  Reopened: 'REL PRC',
}

/**
 * Why a record is sitting in the queue.
 *
 * Derived from the record rather than picked at random, so the same filter
 * always fails for the same stated reason and a person can check it. These are
 * the failures this boundary actually has: a confirmation posted against an
 * order SAP has already closed, a missing cost centre on the equipment, and a
 * lock held by another user's transaction.
 */
export const FAILURE_REASONS = [
  {
    code: 'IW/033',
    message: 'Order is already technically complete; confirmation rejected.',
    fix: 'Reopen the order in SAP, or post the confirmation against the follow-on order.',
  },
  {
    code: 'CO/168',
    message: 'Cost centre missing on the equipment master.',
    fix: 'Maintain the cost centre on the equipment, then retry.',
  },
  {
    code: 'SY/lock',
    message: 'Object locked by user QA_BATCH; the transaction could not acquire it.',
    fix: 'Transient — retry once the batch job releases the lock.',
  },
]

export const failureFor = (filterId) => {
  // Stable per filter: the digits of the id pick the reason, so it never moves
  // between page loads.
  const n = Number(String(filterId).replace(/\D/g, '')) || 0
  return FAILURE_REASONS[n % FAILURE_REASONS.length]
}

export const sapRows = () => SAP_RECORDS
export const workOrders = () => WORK_ORDERS
export const documents = () => DOCUMENT_RECORDS
