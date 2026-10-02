'use client'

// The SAP modules and transactions the product's Integration Portal lists.
//
// Taken from the product's own `interfaces/sap.ts` on the branch that carries
// that screen, so the codes, names and categories are the ones a reviewer has
// already seen. Nothing here is invented: a transaction that is not in the
// product's catalogue is not in ours.
//
// ── what is live, and what is not ────────────────────────────────────────
//
// Four of these transactions reach a real endpoint. This portal already has a
// working SAP gateway at /api/hepa/sap — it answers in OData v2 envelopes and
// its /sync refuses an unsigned certification with a 409 and a SAP message
// code. That refusal is the most valuable thing on this screen, and it only
// exists because the call is real.
//
// The rest are the product's catalogue with no counterpart in this facility's
// data. They are marked `live: false` and the screen says so rather than
// dressing a local state change as a round trip. A reviewer who cannot tell
// which four are real has to treat all forty as theatre.

export const MODULES = {
  MM: { code: 'MM', name: 'Materials Management', icon: 'box' },
  PM: { code: 'PM', name: 'Plant Maintenance', icon: 'wrench' },
  EHS: { code: 'EHS', name: 'EHS / LOTO', icon: 'shield' },
  CO: { code: 'CO', name: 'Controlling', icon: 'chart' },
  SD: { code: 'SD', name: 'Sales & Distribution', icon: 'cart' },
  HCM: { code: 'HCM', name: 'Human Capital Mgmt', icon: 'users' },
  OPS: { code: 'OPS', name: 'Operations', icon: 'cog' },
  FI: { code: 'FI', name: 'Finance', icon: 'coin' },
  EWM: { code: 'EWM', name: 'Warehouse Management', icon: 'box' },
}

// The order the product's sidebar lists them in, and which start switched on.
// Finance and Warehouse are off by default because this site runs neither
// through the compliance gateway — Configuration turns them on.
export const MODULE_ORDER = ['MM', 'PM', 'EHS', 'CO', 'SD', 'HCM', 'OPS', 'FI', 'EWM']
export const DEFAULT_ON = ['MM', 'PM', 'EHS', 'CO', 'SD', 'HCM', 'OPS']

/**
 * Which way a transaction moves.
 *
 * The product keeps this as its own table rather than deriving it, because the
 * direction is a property of the integration rather than of the module — MM-002
 * is bidirectional while everything either side of it is one-way.
 */
const DIRECTION = {
  'MM-001': 'to-oxmaint',
  'MM-002': 'both',
  'MM-003': 'to-oxmaint',
  'MM-004': 'to-sap',
  'MM-005': 'to-sap',
  'MM-006': 'to-oxmaint',
  'MM-008': 'to-sap',
  'MM-009': 'to-sap',
  'MM-010': 'to-sap',
  'PM-001': 'to-sap',
  'PM-002': 'to-sap',
  'PM-003': 'to-sap',
  'PM-004': 'to-oxmaint',
  'PM-005': 'to-oxmaint',
  'CO-001': 'to-oxmaint',
  'CO-002': 'to-sap',
  'CO-003': 'to-oxmaint',
  'CO-004': 'to-sap',
  'CO-005': 'to-sap',
  'FI-001': 'to-sap',
  'FI-002': 'to-sap',
  'FI-003': 'to-sap',
}

export const directionOf = (code) => DIRECTION[code] || 'to-sap'

export const DIRECTION_LABEL = {
  'to-sap': 'To SAP',
  'to-oxmaint': 'To OXmaint',
  both: 'Both',
}

/**
 * The four that reach the gateway.
 *
 * `verb` and `path` are what the Sync actually issues; `what` is the sentence
 * the log carries so a reader knows why this one is different from the others.
 */
export const LIVE = {
  'PM-004': {
    verb: 'GET',
    path: '/api/hepa/sap/equipment',
    what: 'Reads the equipment master for a filter — the record that makes typing an equipment id twice unnecessary.',
  },
  'PM-002': {
    verb: 'GET',
    path: '/api/hepa/sap/work-orders',
    what: 'Reads maintenance orders by class. PM01, PM02 or PM04, or all of them.',
  },
  'PM-001': {
    verb: 'POST',
    path: '/api/hepa/sap/sync',
    what: 'Posts a certification to SAP. Refuses an unsigned one with ZHEPA/NOT_SIGNED, and is idempotent on retry.',
  },
  'EHS-003': {
    verb: 'GET',
    path: '/api/hepa/sap/status',
    what: 'The handshake and the queue depth — what a health check calls.',
  },
}

export const isLive = (code) => Boolean(LIVE[code])

const t = (code, name, category, moduleCode) => ({ code, name, category, moduleCode })

export const TRANSACTIONS = {
  MM: [
    t('MM-001', 'Create Material Master via API', 'Materials', 'MM'),
    t('MM-002', 'Update Material Master Attributes', 'Materials', 'MM'),
    t('MM-003', 'Material Plant View & MRP Settings Sync', 'Materials', 'MM'),
    t('MM-004', 'Create Purchase Requisition from Work Order', 'Procurement', 'MM'),
    t('MM-005', 'PR Approval Status Callback', 'Procurement', 'MM'),
    t('MM-006', 'Convert PR to PO & Return Reference', 'Procurement', 'MM'),
    t('MM-008', 'Goods Receipt through Purchase Order (GR)', 'Inventory', 'MM'),
    t('MM-009', 'Goods Issue to Maintenance Order (GI)', 'Inventory', 'MM'),
    t('MM-010', 'Stock Transfer Between Locations', 'Inventory', 'MM'),
  ],
  PM: [
    t('PM-001', 'Create Maintenance Order', 'Orders', 'PM'),
    t('PM-002', 'Update Work Order Status', 'Orders', 'PM'),
    t('PM-003', 'Post Labor & Costs', 'Costing', 'PM'),
    t('PM-004', 'Equipment Master Sync', 'Configuration', 'PM'),
    t('PM-005', 'Bill of Materials Integration', 'Configuration', 'PM'),
  ],
  EHS: [
    t('EHS-001', 'Incident Reporting', 'Safety', 'EHS'),
    t('EHS-002', 'Hazardous Material Management', 'Environment', 'EHS'),
    t('EHS-003', 'Compliance Check', 'Compliance', 'EHS'),
    t('EHS-004', 'Audit Management', 'Audit', 'EHS'),
    t('EHS-005', 'Risk Assessment', 'Risk', 'EHS'),
  ],
  CO: [
    t('CO-001', 'Cost Center Planning', 'Planning', 'CO'),
    t('CO-002', 'Internal Order Settlement', 'Settlement', 'CO'),
    t('CO-003', 'Profit Center Accounting', 'Accounting', 'CO'),
    t('CO-004', 'Overhead Cost Controlling', 'Overhead', 'CO'),
    t('CO-005', 'Activity-Based Costing', 'Costing', 'CO'),
  ],
  SD: [
    t('SD-001', 'Create Service Billing', 'Billing', 'SD'),
    t('SD-002', 'Customer Contract Sync', 'Contracts', 'SD'),
  ],
  HCM: [
    t('HCM-001', 'Employee Master Sync', 'Employee Data', 'HCM'),
    t('HCM-002', 'Leave Request Integration', 'Leave', 'HCM'),
    t('HCM-003', 'Payroll Data Transfer', 'Payroll', 'HCM'),
    t('HCM-004', 'Attendance Posting', 'Attendance', 'HCM'),
    t('HCM-005', 'Recruitment Data Import', 'Recruitment', 'HCM'),
  ],
  OPS: [
    t('OPS-001', 'Production Order Creation', 'Production', 'OPS'),
    t('OPS-002', 'Order Confirmation', 'Production', 'OPS'),
    t('OPS-003', 'Material Consumption Posting', 'Inventory', 'OPS'),
    t('OPS-004', 'Shift Handover Logging', 'Operations', 'OPS'),
    t('OPS-005', 'Downtime Recording', 'Operations', 'OPS'),
  ],
  FI: [
    t('FI-001', 'Post GL Documents', 'General Ledger', 'FI'),
    t('FI-002', 'Cost Center Allocation', 'Controlling', 'FI'),
    t('FI-003', 'Purchase Invoice Upload', 'Accounts Payable', 'FI'),
  ],
  EWM: [
    t('EWM-001', 'Create Warehouse Task', 'Tasks', 'EWM'),
    t('EWM-002', 'Confirm Warehouse Task', 'Tasks', 'EWM'),
    t('EWM-003', 'Stock Transfer Posting', 'Inventory', 'EWM'),
    t('EWM-004', 'Goods Receipt Posting', 'Inventory', 'EWM'),
    t('EWM-005', 'Goods Issue Posting', 'Inventory', 'EWM'),
  ],
}

export const transactionsOf = (moduleCode) => TRANSACTIONS[moduleCode] || []

export const countOf = (moduleCode) => transactionsOf(moduleCode).length

/** Every transaction, flattened — the log filters read across modules. */
export const ALL_TRANSACTIONS = MODULE_ORDER.flatMap((m) => transactionsOf(m))

export const transactionByCode = (code) => ALL_TRANSACTIONS.find((x) => x.code === code) || null

// ── the seeded communication log ──────────────────────────────────────────
//
// Deterministic, and derived from the catalogue rather than written out: a
// hand-authored log drifts from the transactions it claims to describe the
// first time one is renamed.
//
// Seeded from each entry's own identity so the same rows come back on a second
// run — a log that reshuffles between two viewings of the same screen is one
// nobody can point at during a review.

function seed(str) {
  let h = 2166136261
  for (let i = 0; i < String(str).length; i += 1) {
    h ^= String(str).charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 15
  h = Math.imul(h, 2246822507)
  h ^= h >>> 13
  return (h >>> 0) / 4294967296
}

const between = (key, lo, hi) => lo + Math.floor(seed(key) * (hi - lo + 1))

const MESSAGES = {
  success: [
    'Payload accepted. {n} record(s) written.',
    'Idempotent replay — the confirmation already on file was returned.',
    'Accepted with {n} field(s) defaulted by the receiving system.',
    'Round trip complete in {ms} ms.',
  ],
  error: [
    'ZHEPA/NOT_SIGNED — the certification carries no electronic signature.',
    'ZHEPA/NO_EQUIP — no equipment master for that identifier.',
    'Destination refused the payload: mandatory field PLANT was empty.',
    'Timed out waiting on the destination after 30000 ms.',
  ],
  pending: ['Queued behind {n} message(s) on the same destination.'],
  processing: ['In flight — the destination has acknowledged but not confirmed.'],
}

/**
 * The log as it stands before anybody presses Sync.
 *
 * Weighted towards success, because a gateway that fails a third of the time is
 * a gateway nobody would have put into production. The failures are what the
 * screen is worth reading for, so there are a few and they name a real reason.
 */
export const SEEDED_LOGS = (() => {
  const rows = []
  const pool = ALL_TRANSACTIONS.filter((x) => x.moduleCode !== 'FI' && x.moduleCode !== 'EWM')

  pool.forEach((txn, i) => {
    const key = `log:${txn.code}`
    const r = seed(`${key}:s`)
    const status = r > 0.86 ? 'error' : r > 0.80 ? 'pending' : r > 0.76 ? 'processing' : 'success'
    const bank = MESSAGES[status]
    const message = bank[between(`${key}:m`, 0, bank.length - 1)]
      .replace('{n}', String(between(`${key}:n`, 1, 24)))
      .replace('{ms}', String(between(`${key}:ms`, 120, 940)))

    rows.push({
      id: `LOG-${String(41200 + i)}`,
      // Minutes back from the top of the list rather than a wall-clock stamp:
      // the screen renders on the server and again on the client, and a real
      // clock between the two is a hydration mismatch.
      minutesAgo: between(`${key}:t`, 2, 2880),
      moduleCode: txn.moduleCode,
      module: MODULES[txn.moduleCode].name,
      transaction: txn.code,
      transactionName: txn.name,
      direction: directionOf(txn.code) === 'to-oxmaint' ? 'inbound' : 'outbound',
      status,
      message,
      live: isLive(txn.code),
      durationMs: between(`${key}:d`, 90, 1400),
    })
  })

  return rows.sort((a, b) => a.minutesAgo - b.minutesAgo)
})()
