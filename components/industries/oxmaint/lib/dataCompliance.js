// The compliance layer over the demo plant.
//
// It sits beside data.js rather than inside it: that file is the plant — the
// assets, the work, the stock — and everything here is the paperwork a regulator
// asks for about that plant. Keeping them apart also means this module can grow
// without enlarging the one file every other screen already imports.
//
// The rule from data.js carries over unchanged: derived, never random. Where a
// distribution is itself the story — how much of the obligation register is
// late, how many corrective actions are still open — the shape is written out
// rather than drawn from the hash. A range wide enough to look varied is also
// wide enough to put half the plant in breach, and a register that reports half
// the plant in breach is not a register anyone would still be running.

import {
  pick, between, daysFrom, isPast, daysUntil, EPOCH, DOMAIN,
  SITES, TECHNICIANS, ASSETS, WORK_ORDERS, PARTS, PM_SCHEDULES,
  PURCHASE_ORDERS, INSPECTIONS, INCIDENTS,
} from './data'

// A register written against three sites still has to open on a pack with one.
// An obligation filed against a site that pack does not have belongs to the site
// it does have — reading it as nothing crashed every Compliance tab on the
// single-site DHL build.
const siteOf = (id) => SITES.find((s) => s.site_id === id) || SITES[0]
const nth = (rows, n) => (rows.length ? rows[n % rows.length] : null)

// A duty needs someone who can sign for it, so obligations, actions, reviews and
// documents are owned by the supervisor, the planner and the administrator. A
// technician carries the work; they do not carry the liability.
const OWNERS = TECHNICIANS.filter((t) => t.role !== 'Technician')

// Days between examinations, keyed by the words shown in the frequency column,
// so the frequency and the two dates can never contradict each other:
// last_completed is simply next_due less one full cycle.
const CYCLE_DAYS = {
  Quarterly: 91,
  'Six-monthly': 182,
  Annual: 365,
  Biennial: 730,
  'Five-yearly': 1826,
}

// ── the obligation register ──────────────────────────────────────────────
// due_in is written per obligation because the shape of this register is what
// the dashboard is for: two statutory items late, three inside the warning
// window, the rest in date. The ISO 55001 review carries no site — it is the
// management system, not a plant — and the site filter is built to let
// organisation-level records through rather than hide them.
//
// A pack may carry its own register, and one that does replaces this list
// rather than adding to it. What a hospital is surveyed against and what a UK
// factory is inspected for have nothing in common, and a dashboard that shows a
// facilities director in Ohio a lifting examination is not showing them their
// own building.
const DEFAULT_OBLIGATIONS = [
  { title: 'ISO 55001 asset management system review', area: 'Asset Management', frequency: 'Annual', site: null, due_in: 212 },
  { title: 'LOLER thorough examination — lifting equipment', area: 'Statutory Examination', frequency: 'Six-monthly', site: 'site_01', due_in: -9 },
  { title: 'PUWER work equipment assessment', area: 'Statutory Examination', frequency: 'Annual', site: 'site_02', due_in: 96 },
  { title: 'PSSR written scheme of examination — pressure systems', area: 'Statutory Examination', frequency: 'Biennial', site: 'site_01', due_in: 18 },
  { title: 'COSHH assessment review', area: 'Health & Safety', frequency: 'Annual', site: 'site_01', due_in: -23 },
  { title: 'EICR fixed electrical installation', area: 'Electrical Safety', frequency: 'Five-yearly', site: 'site_02', due_in: 540 },
  { title: 'Environmental permit — emissions monitoring return', area: 'Environmental', frequency: 'Quarterly', site: 'site_01', due_in: 11 },
  { title: 'Fire risk assessment review', area: 'Fire Safety', frequency: 'Annual', site: 'site_03', due_in: 26 },
  { title: 'Legionella risk assessment and monitoring', area: 'Health & Safety', frequency: 'Quarterly', site: 'site_01', due_in: 64 },
  { title: 'Waste transfer notes — duty of care audit', area: 'Environmental', frequency: 'Annual', site: 'site_03', due_in: 150 },
]

const OBLIGATIONS = DOMAIN?.obligations?.length ? DOMAIN.obligations : DEFAULT_OBLIGATIONS

export const COMPLIANCE_ITEMS = OBLIGATIONS.map((o, i) => {
  const k = `cmp-${i}`
  const site = o.site ? siteOf(o.site) : null
  const next_due = daysFrom(o.due_in)
  return {
    compliance_id: `cmp_${String(i + 1).padStart(3, '0')}`,
    title: o.title,
    area: o.area,
    frequency: o.frequency,
    owner_name: pick(k + 'own', OWNERS).name,
    site_id: site ? site.site_id : null,
    site_name: site ? site.site_name : 'Organisation-wide',
    last_completed: daysFrom(o.due_in - CYCLE_DAYS[o.frequency]),
    next_due,
    evidence_count: between(k + 'ev', 2, 14),
    status: isPast(next_due) ? 'Overdue' : daysUntil(next_due) < 30 ? 'Due Soon' : 'Compliant',
  }
})

// ── audit trail ──────────────────────────────────────────────────────────
// Weighted towards work orders because that is what a CMMS is used for all day.
const ENTITIES = [
  'Work Order', 'Work Order', 'Work Order', 'Work Order',
  'Asset', 'Asset', 'Part', 'Part',
  'PM Schedule', 'Purchase Order', 'User',
]

// Each entity draws only from the actions that can happen to it, and its
// reference points at a record that exists elsewhere in the portal. Both matter
// for the same reason: the whole value of an audit trail is that a line can be
// followed back to the thing it changed, and a line reading "User assigned" or
// pointing at a work order that is not in the backlog proves the log is theatre.
const ENTITY_SPEC = {
  'Work Order': {
    // No delete. A work order is cancelled, never removed — it is the record of
    // what was done to a machine, and a log showing them being deleted is a log
    // showing the maintenance history being edited.
    actions: ['created', 'updated', 'updated', 'status changed', 'status changed', 'assigned', 'approved', 'exported'],
    transitions: ['Open → In Progress', 'In Progress → Completed', 'Open → On Hold', 'On Hold → In Progress'],
    target: (k) => {
      const r = pick(k, WORK_ORDERS)
      return { reference: r.work_order_number, site_id: r.site_id }
    },
  },
  Asset: {
    actions: ['created', 'updated', 'updated', 'status changed', 'exported'],
    transitions: ['Operational → Under Maintenance', 'Under Maintenance → Operational', 'Operational → Down', 'Down → Operational'],
    target: (k) => {
      const r = pick(k, ASSETS)
      return { reference: r.asset_code, site_id: r.site_id }
    },
  },
  Part: {
    actions: ['created', 'updated', 'updated', 'status changed', 'deleted'],
    transitions: ['In Stock → Low Stock', 'Low Stock → Out of Stock', 'Out of Stock → In Stock'],
    target: (k) => {
      const r = pick(k, PARTS)
      return { reference: r.part_number, site_id: r.site_id }
    },
  },
  'PM Schedule': {
    actions: ['created', 'updated', 'status changed', 'assigned'],
    transitions: ['Active → Paused', 'Paused → Active'],
    target: (k) => {
      const r = pick(k, PM_SCHEDULES)
      return { reference: r.schedule_name, site_id: r.site_id }
    },
  },
  'Purchase Order': {
    actions: ['created', 'updated', 'approved', 'status changed', 'exported'],
    transitions: ['Draft → Pending Approval', 'Pending Approval → Approved', 'Approved → Received'],
    target: (k) => {
      const r = pick(k, PURCHASE_ORDERS)
      return { reference: r.po_number, site_id: r.site_id }
    },
  },
  User: {
    actions: ['created', 'updated', 'updated', 'deleted'],
    transitions: [],
    target: (k) => ({ reference: pick(k, TECHNICIANS).name, site_id: null }),
  },
}

// A pack that writes its own trail replaces the generated one. The generator
// puts forty lines inside a day of each other, which is what a busy Tuesday
// looks like and not what a fortnight looks like — and the audit screen now
// charts a fortnight. Lines about the organisation rather than the plant carry
// no site, which is what lets the site filter show them under every site.
const ORG_WIDE = new Set(['Document', 'Plan for Improvement', 'Purchase Order'])
const PACK_TRAIL = (DOMAIN?.auditLines || []).map((l, i) => ({
  audit_id: `aud_pack_${String(i + 1).padStart(4, '0')}`,
  at: new Date(EPOCH - l.hoursAgo * 3600000).toISOString(),
  actor_name: l.actor,
  entity: l.entity,
  reference: l.reference,
  action: l.action,
  detail: l.detail || '—',
  site_id: ORG_WIDE.has(l.entity) ? null : SITES[0]?.site_id || null,
}))

const GENERATED_TRAIL = Array.from({ length: 40 }, (_, i) => {
  const k = `aud-${i}`
  const entity = pick(k + 'en', ENTITIES)
  const spec = ENTITY_SPEC[entity]
  const action = pick(k + 'ac', spec.actions)
  const target = spec.target(k + 'rf')
  // An approval carries authority, so it is never signed by a technician. One
  // that is tells an auditor the permissions model is not being applied, which
  // is a worse finding than whatever the approval was for.
  const actor = action === 'approved' ? pick(k + 'ap', OWNERS) : pick(k + 'at', TECHNICIANS)
  return {
    audit_id: `aud_${String(i + 1).padStart(4, '0')}`,
    // Newest first, roughly forty minutes apart. The jitter is capped below the
    // gap so the sequence stays strictly descending however it is sorted back.
    at: new Date(EPOCH - (i * 40 + between(k + 'j', 0, 24)) * 60000).toISOString(),
    actor_name: actor.name,
    entity,
    reference: target.reference,
    action,
    detail: action === 'status changed' ? pick(k + 'tr', spec.transitions)
      : action === 'assigned' ? `to ${pick(k + 'to', TECHNICIANS).name}`
        : '—',
    site_id: target.site_id,
  }
})

export const AUDIT_TRAIL = PACK_TRAIL.length ? PACK_TRAIL : GENERATED_TRAIL

// ── corrective and preventive actions ────────────────────────────────────
// Two of these are the actions raised against the register above — the late
// lifting examination and the missing calibration certificates — so a customer
// who follows a finding from the dashboard into CAPA lands on the same story
// rather than a second, unrelated one.
const DEFAULT_CAPA_DEFS = [
  { title: 'Guard interlock found bypassed — restore interlock and retrain the shift', source: 'Incident', type: 'Corrective', state: 'In Progress', due_in: 6, site: 'site_01' },
  { title: 'Repeat bearing failures on the forming line — revise lubrication interval', source: 'Inspection finding', type: 'Preventive', state: 'In Progress', due_in: 19, site: 'site_01' },
  { title: 'Hydraulic oil spill — fit bunding and revise the decanting procedure', source: 'Incident', type: 'Corrective', state: 'In Progress', due_in: -8, site: 'site_01' },
  { title: 'Statutory lifting examinations run past date — rebuild the examination register', source: 'Internal audit', type: 'Corrective', state: 'Open', due_in: -15, site: 'site_01' },
  { title: 'Calibration certificates missing for three pressure transmitters', source: 'Internal audit', type: 'Corrective', state: 'Verification', due_in: 21, site: 'site_02' },
  { title: 'Isolation not verified before work started — add a verification step to the permit', source: 'Incident', type: 'Preventive', state: 'Closed', due_in: -34, site: 'site_01' },
  { title: 'Spares issued without a stores transaction — enforce booking at the counter', source: 'Internal audit', type: 'Preventive', state: 'Closed', due_in: -52, site: 'site_03' },
  { title: 'Compressor trips traced to fouled coolers — add coil cleaning to the schedule', source: 'Inspection finding', type: 'Preventive', state: 'In Progress', due_in: 27, site: 'site_01' },
  { title: 'Eye protection not worn in the press shop — introduce supervisor spot checks', source: 'Internal audit', type: 'Corrective', state: 'Open', due_in: 9, site: 'site_02' },
  { title: 'Work orders closed without completion notes — make the field mandatory', source: 'Internal audit', type: 'Preventive', state: 'Closed', due_in: -20, site: 'site_01' },
  { title: 'Emergency lighting test records incomplete at the depot', source: 'Inspection finding', type: 'Corrective', state: 'Verification', due_in: 15, site: 'site_03' },
  { title: 'Contractor started work without a site briefing — revise the gate process', source: 'Incident', type: 'Corrective', state: 'Closed', due_in: -41, site: 'site_02' },
  { title: 'Vibration alarms acknowledged but not actioned — add an escalation rule', source: 'Inspection finding', type: 'Preventive', state: 'In Progress', due_in: 33, site: 'site_01' },
  { title: 'Delivery missed after unplanned press downtime — review the spares holding', source: 'Customer complaint', type: 'Corrective', state: 'Open', due_in: 4, site: 'site_02' },
]

// A pack's actions replace these, for the reason its obligations replace the
// register: a forming line and a press shop are not where a ramp's findings
// come from. Same sources and states, so the story still ties back to the
// incidents and inspections it was raised against.
const CAPA_DEFS = DOMAIN?.capas?.length ? DOMAIN.capas : DEFAULT_CAPA_DEFS

const FAILED_INSPECTIONS = INSPECTIONS.filter((i) => i.result === 'Fail')

export const CAPAS = CAPA_DEFS.map((c, i) => {
  const k = `capa-${i}`
  // A finding-led action inherits the site of the record that raised it, so the
  // site filter moves the inspection, the incident and the action together.
  const src = c.source === 'Inspection finding' ? nth(FAILED_INSPECTIONS, i)
    : c.source === 'Incident' ? nth(INCIDENTS, i)
      : null
  const site = siteOf(src ? src.site_id : c.site)
  const due_date = daysFrom(c.due_in)
  return {
    capa_id: `capa_${String(i + 1).padStart(3, '0')}`,
    capa_number: `CAPA-${201 + i}`,
    title: c.title,
    source: c.source,
    source_reference: src ? (src.inspection_number || src.incident_number) : null,
    type: c.type,
    owner_name: pick(k + 'own', OWNERS).name,
    site_id: site.site_id,
    site_name: site.site_name,
    raised_date: daysFrom(c.due_in - between(k + 'lead', 24, 70)),
    due_date,
    // The effectiveness check is what closes an action out, so it exists on the
    // closed ones and on whichever of the verification queue has got that far.
    effectiveness_checked: c.state === 'Closed' || (c.state === 'Verification' && pick(k + 'eff', [true, false])),
    // A closed action cannot be late, for the same reason a cancelled work
    // order cannot be: nobody is waiting on it.
    status: c.state !== 'Closed' && isPast(due_date) ? 'Overdue' : c.state,
  }
})

// ── validation protocols ─────────────────────────────────────────────────
// Equipment protocols name the machine they qualify. The asset type they ask
// for belongs to whichever pack was active when they were written, so a pack
// with a different plant finds nothing — and the protocol then had no system
// name at all. Falling back to a real machine from the active pack keeps every
// row pointing at something the portal actually holds.
const assetOf = (type, i = 0) => ASSETS.find((a) => a.asset_type === type) || ASSETS[(i * 17) % ASSETS.length]

const DEFAULT_VALIDATION_DEFS = [
  { protocol: 'IQ-1001', system: 'Oxmaint CMMS', scope: 'Application and database server installation', status: 'Approved', tests_total: 34 },
  { protocol: 'OQ-1002', system: 'Oxmaint CMMS', scope: 'Work order, preventive maintenance and stores workflows', status: 'Approved', tests_total: 58 },
  { protocol: 'PQ-1003', system: 'Oxmaint CMMS', scope: 'Performance across a full maintenance cycle', status: 'In Execution', tests_total: 46 },
  { protocol: 'IQ-1004', asset: 'Air Compressor', scope: 'Compressor house upgrade — installation records and drawings', status: 'Approved', tests_total: 22 },
  { protocol: 'OQ-1005', asset: 'Air Compressor', scope: 'Pressure hold, dew point and unload sequence', status: 'Approved', tests_total: 31 },
  { protocol: 'IQ-1006', asset: 'Chiller', scope: 'Chilled water skid installation and pipework verification', status: 'Approved', tests_total: 19 },
  { protocol: 'OQ-1007', asset: 'Chiller', scope: 'Set point control and alarm response', status: 'In Execution', tests_total: 27 },
  { protocol: 'PQ-1008', asset: 'Boiler', scope: 'Steam quality and load response over three shifts', status: 'Draft', tests_total: 24 },
  { protocol: 'IQ-1009', system: 'Handheld scanning terminals', scope: 'Device build, network join and label print verification', status: 'Approved', tests_total: 16 },
]

// A pack may qualify its own equipment. The fallback to a real machine below
// still applies, but a compressor-house scope printed against a belt loader is
// the mismatch that fallback cannot fix — so the scope comes with the pack.
const VALIDATION_DEFS = DOMAIN?.validations?.length ? DOMAIN.validations : DEFAULT_VALIDATION_DEFS

export const VALIDATIONS = VALIDATION_DEFS.map((v, i) => {
  const k = `val-${i}`
  const asset = v.asset ? assetOf(v.asset, i) : null
  const draft = v.status === 'Draft'
  return {
    validation_id: `val_${String(i + 1).padStart(3, '0')}`,
    protocol: v.protocol,
    system: asset ? `${asset.asset_name} (${asset.asset_code})` : (v.system || 'Plant equipment'),
    scope: v.scope,
    executed_by_name: pick(k + 'ex', TECHNICIANS).name,
    // A protocol that has not been executed cannot carry an approval signature
    // or an execution date. Showing either would say the system is qualified
    // when the tests have not been run, which is the one lie this screen exists
    // to prevent.
    approved_by_name: v.status === 'Approved' ? pick(k + 'ap', OWNERS).name : null,
    executed_date: draft ? null
      : daysFrom(-(v.status === 'Approved' ? between(k + 'dt', 40, 300) : between(k + 'dt', 2, 18))),
    tests_total: v.tests_total,
    tests_passed: v.status === 'Approved' ? v.tests_total
      : draft ? 0
        : Math.round(v.tests_total * between(k + 'pp', 55, 85) / 100),
    status: v.status,
  }
})

// ── periodic reviews ─────────────────────────────────────────────────────
const REVIEW_DEFS = [
  { subject: 'Maintenance policy', cycle: 'Annual', site: 'site_01', due_in: 121 },
  { subject: 'Asset criticality ranking', cycle: 'Six-monthly', site: 'site_01', due_in: 34 },
  { subject: 'Preventive maintenance programme effectiveness', cycle: 'Quarterly', site: 'site_01', due_in: 12 },
  { subject: 'Spare parts minimum and maximum levels', cycle: 'Six-monthly', site: 'site_01', due_in: -6 },
  { subject: 'Permit to work procedure', cycle: 'Annual', site: 'site_02', due_in: 74 },
  { subject: 'Approved contractor list', cycle: 'Annual', site: 'site_02', due_in: 45 },
  { subject: 'Risk register', cycle: 'Quarterly', site: 'site_02', due_in: 8 },
  { subject: 'Management review — asset management system', cycle: 'Annual', site: null, due_in: 189 },
  { subject: 'Emergency response plan', cycle: 'Annual', site: 'site_03', due_in: -18 },
  { subject: 'Supplier performance review', cycle: 'Six-monthly', site: 'site_03', due_in: 61 },
]

export const REVIEWS = REVIEW_DEFS.map((r, i) => {
  const k = `rev-${i}`
  const site = r.site ? siteOf(r.site) : null
  const next_due = daysFrom(r.due_in)
  return {
    review_id: `rev_${String(i + 1).padStart(3, '0')}`,
    subject: r.subject,
    cycle: r.cycle,
    owner_name: pick(k + 'own', OWNERS).name,
    reviewers: between(k + 'rv', 2, 7),
    last_review: daysFrom(r.due_in - CYCLE_DAYS[r.cycle]),
    next_due,
    site_id: site ? site.site_id : null,
    site_name: site ? site.site_name : 'Organisation-wide',
    // Derived from the date rather than stored, so a review cannot sit on
    // "Scheduled" three weeks after the day it was meant to happen. Papers go
    // out about three weeks ahead, which is the point the review is under way.
    status: isPast(next_due) ? 'Overdue' : daysUntil(next_due) < 21 ? 'In Review' : 'Scheduled',
  }
})

// ── controlled documents ─────────────────────────────────────────────────
const DEFAULT_VAULT_DEFS = [
  { document_name: 'Maintenance Policy', classification: 'Controlled', retention_years: 7, status: 'Approved', site: null },
  { document_name: 'Asset Management Plan', classification: 'Controlled', retention_years: 7, status: 'Approved', site: null },
  { document_name: 'Health and Safety Policy Statement', classification: 'Public', retention_years: 5, status: 'Approved', site: null },
  { document_name: 'Permit to Work Procedure', classification: 'Controlled', retention_years: 7, status: 'Approved', site: 'site_01' },
  { document_name: 'Lockout, Tagout, Tryout Procedure', classification: 'Controlled', retention_years: 7, status: 'Approved', site: 'site_01' },
  { document_name: 'Calibration Procedure', classification: 'Controlled', retention_years: 5, status: 'Approved', site: 'site_01' },
  { document_name: 'Spare Parts Control Procedure', classification: 'Controlled', retention_years: 5, status: 'In Review', site: 'site_03' },
  { document_name: 'Contractor Management Procedure', classification: 'Controlled', retention_years: 7, status: 'Approved', site: 'site_02' },
  { document_name: 'Emergency Response Plan', classification: 'Controlled', retention_years: 10, status: 'Approved', site: 'site_01' },
  { document_name: 'Internal Audit Procedure', classification: 'Controlled', retention_years: 5, status: 'Approved', site: null },
  { document_name: 'Corrective and Preventive Action Procedure', classification: 'Controlled', retention_years: 5, status: 'Approved', site: null },
  { document_name: 'Document Control Procedure', classification: 'Controlled', retention_years: 5, status: 'Draft', site: null },
  { document_name: 'Training and Competence Matrix', classification: 'Confidential', retention_years: 6, status: 'Approved', site: 'site_01' },
  { document_name: 'Risk Register', classification: 'Confidential', retention_years: 10, status: 'Approved', site: 'site_02' },
  { document_name: 'Statutory Examination Register', classification: 'Controlled', retention_years: 10, status: 'Approved', site: 'site_01' },
  { document_name: 'Environmental Permit and Aspects Register', classification: 'Public', retention_years: 10, status: 'In Review', site: 'site_01' },
]

// A pack's controlled documents replace these — mostly the same procedures,
// with its own registers in place of a statutory examination register and an
// environmental permit it does not hold.
const VAULT_DEFS = DOMAIN?.vaultDocuments?.length ? DOMAIN.vaultDocuments : DEFAULT_VAULT_DEFS

export const VAULT = VAULT_DEFS.map((d, i) => {
  const k = `vlt-${i}`
  const site = d.site ? siteOf(d.site) : null
  const draft = d.status === 'Draft'
  return {
    vault_id: `vlt_${String(i + 1).padStart(3, '0')}`,
    document_name: d.document_name,
    classification: d.classification,
    version: `v${between(k + 'maj', 1, 5)}.${between(k + 'min', 0, 9)}`,
    retention_years: d.retention_years,
    // A draft carries no signature. One that appeared to would say the document
    // is in force, and people work to whatever the vault says is in force.
    signed_by_name: draft ? null : pick(k + 'sg', OWNERS).name,
    signed_date: draft ? null : daysFrom(-between(k + 'sd', 20, 600)),
    site_id: site ? site.site_id : null,
    site_name: site ? site.site_name : 'Organisation-wide',
    status: d.status,
  }
})
