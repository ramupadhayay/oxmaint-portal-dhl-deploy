// The demo plant behind the Oxmaint CMMS portal.
//
// Every value here is derived, never random. A demo that shows different
// numbers each time it is opened cannot be rehearsed, and a bug that only
// appears on some loads cannot be found — so the same seed always produces the
// same plant, the same work orders, the same readings.
//
// Nothing here is industry-specific. That is the point of this portal: the
// other twenty are built around one vertical, and this one is the product a
// customer of any industry would be handed. The names below are what they would
// have typed during onboarding — data, not a vertical.

import PACK from './packs'
import { buildDataset } from './packs/dataset'

// The customer, the plant and the failure modes come from a pack — see
// lib/packs. This file keeps the *generation*: the same seeded hash turns any
// pack's inputs into 126 assets, 84 work orders and the KPIs over them, so a
// new demo is a list of names rather than a second copy of everything below.

// ── deterministic helpers ────────────────────────────────────────────────
// A hash, not a random. Same input, same output, on every machine and run.
export function seed(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // Avalanche the result before returning it.
  //
  // Without this the plain FNV hash lets the *last* character dominate the
  // high bits — and pick() reads the high bits. Every key here shares its
  // suffix by design (`wo-0p`, `wo-1p`, `wo-2p` … for priority), so they all
  // landed in the same bucket: twelve work orders in a row came out Medium
  // priority with two titles between them. That reads as a bug in the product
  // rather than in the data, which is worse than looking obviously fake.
  h ^= h >>> 16
  h = Math.imul(h, 2246822507)
  h ^= h >>> 13
  h = Math.imul(h, 3266489909)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

export const pick = (key, from) => from[Math.floor(seed(key) * from.length) % from.length]
export const between = (key, lo, hi, dp = 0) => {
  const v = lo + seed(key) * (hi - lo)
  return dp ? Number(v.toFixed(dp)) : Math.round(v)
}

// Every date is an offset from "today", not from a fixed calendar date.
//
// The obvious alternative — pinning an epoch so screenshots stay identical —
// quietly rots: the pinned day recedes, due dates drift into the past, and a
// demo given a month later opens on a dashboard where everything is overdue.
// The story survives across time only if the clock moves with it. What must not
// move is the content — which asset, which fault, which name — and that comes
// from the seeded hash, which never reads a date.
export const EPOCH = (() => {
  const t = new Date()
  t.setHours(6, 0, 0, 0)
  return t.getTime()
})()
export const daysFrom = (n) => new Date(EPOCH + n * 86400000).toISOString()

export const fmtDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('en-GB', { month: 'short' })} ${d.getFullYear()}`
}
export const isPast = (iso) => Boolean(iso) && new Date(iso).getTime() < EPOCH
export const daysUntil = (iso) => Math.round((new Date(iso).getTime() - EPOCH) / 86400000)

// A pack that arrives as a real dataset rather than as names for the generators.
//
// Built once, here, on this file's clock — and only in the build that runs that
// pack; see lib/packs/dataset.js. Every register below reads the dataset first
// and falls back to its generator, so a pack without one is untouched.
const DS = buildDataset ? buildDataset(EPOCH, { pick, between }) : null

// ── the organisation ─────────────────────────────────────────────────────
export const ORG = {
  organization_id: 'org_demo_0001',
  ...PACK.org,
  created_date: daysFrom(-420),
  subscription_plan: 'Enterprise',
  subscription_status: 'Active',
  subscription_expiry: daysFrom(300),
  max_users: 50,
  max_assets: 500,
}

export const USER = {
  user_id: 'usr_demo_0001',
  ...PACK.user,
  last_login: daysFrom(0),
}

export const SITES = DS ? DS.sites : PACK.sites

export const LOCATIONS = DS ? DS.locations : PACK.locations

// ── assets ───────────────────────────────────────────────────────────────
const ASSET_KINDS = PACK.assetKinds
const MAKERS = PACK.makers
const CRIT = ['High', 'Medium', 'Low']

// Weighted by repetition, because the ratio is the point. Drawn evenly, a fifth
// of the plant came out on the floor — a site running 18% of its assets down is
// not a site running maintenance software, it is a site being shut by its
// insurer. Roughly 85 / 10 / 5 is what a working plant looks like.
const ASSET_STATUS = [...Array(17).fill('Operational'), ...Array(2).fill('Under Maintenance'), 'Down']

export const ASSETS = DS ? DS.assets : Array.from({ length: PACK.assetCount }, (_, i) => {
  const k = `asset-${i}`
  const kind = pick(k + 'kind', ASSET_KINDS)
  const site = pick(k + 'site', SITES)
  // The location has to belong to the asset's own site. Drawing the two
  // independently put a Sheffield press in the Leeds warehouse for 77 of the
  // 126 assets — invisible on any single screen, and the first thing a data
  // audit reports.
  const siteLocations = LOCATIONS.filter((l) => l.site_id === site.site_id)
  const loc = pick(k + 'loc', siteLocations.length ? siteLocations : LOCATIONS)
  return {
    asset_id: `ast_${String(i + 1).padStart(4, '0')}`,
    asset_name: `${kind} ${String((i % 9) + 1).padStart(2, '0')}`,
    asset_code: `${site.code}-${kind.split(' ').map((w) => w[0]).join('')}-${String(i + 1).padStart(3, '0')}`,
    asset_type: kind,
    manufacturer: pick(k + 'mk', MAKERS),
    model: `M${between(k + 'model', 100, 900)}`,
    serial_number: `SN${between(k + 'sn', 100000, 999999)}`,
    site_id: site.site_id,
    site_name: site.site_name,
    functional_location_id: loc.functional_location_id,
    functional_location_name: loc.name,
    criticality: pick(k + 'crit', CRIT),
    status: pick(k + 'st', ASSET_STATUS),
    health_score: between(k + 'health', 52, 99),
    purchase_date: daysFrom(-between(k + 'pd', 200, 2000)),
    warranty_expiry: daysFrom(between(k + 'we', -200, 700)),
    last_maintenance_date: daysFrom(-between(k + 'lm', 1, 90)),
    next_maintenance_date: daysFrom(between(k + 'nm', 1, 60)),
    running_hours: between(k + 'rh', 1200, 42000),
    iot_enabled: seed(k + 'iot') > 0.66,
  }
})

// ── people ───────────────────────────────────────────────────────────────
const orgDomain = (PACK.org.organization_name || 'oxmaint').toLowerCase().replace(/[^a-z0-9]+/g, '')

export const TECHNICIANS = [
  ...(DS ? DS.technicians : PACK.technicians).map((t) => ({
    ...t,
    email: `${t.name.toLowerCase().replace(/[^a-z]+/g, '.')}@${orgDomain}.example`,
  })),
  { user_id: USER.user_id, name: USER.name, role: 'Administrator', trade: '—', email: USER.email },
]

// The first person holding a role. Used where a record needs a lead, an approver
// or a planner — which used to be a name typed in, and a name typed in is a name
// that does not exist in a pack with a different roster.
const personFor = (role, n = 0) => (TECHNICIANS.filter((t) => t.role === role)[n] || TECHNICIANS[0]).name

// The supervisor and planner the generated plant names on rules, gate passes and
// approvals. A pack with a real roster names its own people instead, because a
// name nobody on the team recognises is the first thing an evaluator notices.
export const SUPERVISOR_NAME = DS ? personFor('Supervisor') : 'Marcus Bell'
export const PLANNER_NAME = DS ? personFor('Planner') : 'Grace Holloway'
const siteAt = (i) => SITES[i % SITES.length]

export const TEAMS = DS ? DS.teams : [
  { team_id: 'tm_01', team_name: 'Mechanical', lead_name: 'Marcus Bell', members: 6, site_id: 'site_01' },
  { team_id: 'tm_02', team_name: 'Electrical', lead_name: 'Tom Whelan', members: 4, site_id: 'site_01' },
  { team_id: 'tm_03', team_name: 'Instrumentation', lead_name: 'Sara Kovac', members: 3, site_id: 'site_02' },
  { team_id: 'tm_04', team_name: 'Planning', lead_name: 'Grace Holloway', members: 2, site_id: 'site_01' },
]

// ── work orders ──────────────────────────────────────────────────────────
// Same weighting as the asset statuses, and for the same reason: drawn evenly,
// nearly a quarter came out Cancelled. A backlog that cancels a quarter of its
// jobs is a broken planning process, which is not the story this screen tells.
const WO_STATUS = [
  ...Array(9).fill('Completed'), ...Array(4).fill('Open'),
  ...Array(4).fill('In Progress'), ...Array(2).fill('On Hold'), 'Cancelled',
]
// Weighted for the same reason as the statuses. Drawn evenly, a third of the
// backlog came out Critical — and a backlog where a third of everything is
// critical is a backlog where nothing is, which undercuts the one screen whose
// job is to show a supervisor what to do first.
const WO_PRIORITY = [
  ...Array(9).fill('Medium'), ...Array(5).fill('High'),
  ...Array(4).fill('Low'), 'Critical', 'Critical',
]
const WO_TYPE = ['Corrective', 'Preventive', 'Inspection', 'Breakdown']
const TASKS = PACK.tasks

export const WORK_ORDERS = DS ? DS.workOrders : Array.from({ length: PACK.workOrderCount }, (_, i) => {
  const k = `wo-${i}`
  const asset = ASSETS[Math.floor(seed(k + 'a') * ASSETS.length)]
  const status = pick(k + 'st', WO_STATUS)
  const closed = status === 'Completed' || status === 'Cancelled'
  // Old work orders are the ones that got closed; the ones still open are
  // recent. Spreading both across the same 75 days is what made the dashboard
  // show more overdue work than open work — a number that is not so much wrong
  // as impossible, and the first thing a maintenance manager would notice.
  const created = closed ? -between(k + 'c', 6, 70) : -between(k + 'c', 0, 24)
  const task = pick(k + 't', TASKS)
  return {
    workorder_id: `wo_${String(i + 1).padStart(4, '0')}`,
    work_order_number: `WO-${2600 + i}`,
    title: task,
    description: `${task} on ${asset.asset_name} at ${asset.site_name}.`,
    status,
    priority: pick(k + 'p', WO_PRIORITY),
    work_order_type: pick(k + 'ty', WO_TYPE),
    asset_id: asset.asset_id,
    asset_name: asset.asset_name,
    asset_code: asset.asset_code,
    site_id: asset.site_id,
    site_name: asset.site_name,
    location_name: asset.functional_location_name,
    assigned_to_name: pick(k + 'as', TECHNICIANS).name,
    created_by_name: USER.name,
    created_date: daysFrom(created),
    due_date: daysFrom(created + between(k + 'due', 4, 32)),
    // A cancelled work order was never worked, so it carries no completion date
    // and no hours — only a finished one does.
    completed_date: status === 'Completed' ? daysFrom(created + between(k + 'cd', 1, 14)) : null,
    estimated_hours: between(k + 'eh', 1, 12),
    actual_hours: status === 'Completed' ? between(k + 'ah', 1, 16) : null,
    downtime_hours: status === 'Completed' ? between(k + 'dt', 0, 6) : 0,
    total_cost: between(k + 'cost', 40, 2400),
  }
})

export const OPEN_STATUS = ['Open', 'In Progress', 'On Hold']
const isOpen = (w) => OPEN_STATUS.includes(w.status)

// ── inventory ────────────────────────────────────────────────────────────
const PART_NAMES = PACK.partNames

export const VENDORS = DS ? DS.vendors : Array.from({ length: 8 }, (_, i) => ({
  vendor_id: `ven_${String(i + 1).padStart(3, '0')}`,
  vendor_name: PACK.vendorNames[i],
  contact_name: pick(`vc${i}`, ['J. Hardy', 'M. Ellis', 'R. Fry', 'L. Osei']),
  email: `orders${i + 1}@supplier.example`,
  phone: `+44 114 ${between(`vp${i}`, 200000, 999999)}`,
  payment_terms: pick(`vt${i}`, ['Net 30', 'Net 45', 'Net 60']),
  lead_time_days: between(`vl${i}`, 2, 21),
  status: 'Active',
}))

export const PARTS = DS ? DS.parts : Array.from({ length: PACK.partCount }, (_, i) => {
  const k = `part-${i}`
  const min = between(k + 'min', 5, 25)
  // A stockroom where nothing has run out is a stockroom nobody is drawing
  // from. Drawing the quantity from a plain range gave a one-in-ninety chance
  // of landing on zero, so no part was ever out of stock and the reorder
  // machinery — demand parts, purchase orders, the low-stock alert — had
  // nothing to point at. Roughly one part in eight is short here, and one in
  // sixteen is empty, which is what a working stores looks like.
  const draw = seed(k + 'stk')
  const onHand = draw < 0.0625 ? 0
    : draw < 0.19 ? between(k + 'oh', 1, min - 1)
      : between(k + 'oh', min, 90)
  const cost = between(k + 'uc', 3, 480, 2)
  const vendor = VENDORS[i % VENDORS.length]
  return {
    part_id: `prt_${String(i + 1).padStart(4, '0')}`,
    part_number: `P-${between(k + 'pn', 10000, 99999)}`,
    part_name: pick(k + 'n', PART_NAMES),
    category: pick(k + 'cat', ['Mechanical', 'Electrical', 'Consumable', 'Lubricant']),
    unit: pick(k + 'u', ['ea', 'ea', 'L', 'm']),
    quantity_on_hand: onHand,
    minimum_quantity: min,
    reorder_point: min,
    unit_cost: cost,
    total_value: Number((onHand * cost).toFixed(2)),
    storage_location: `${pick(k + 'sl', ['A', 'B', 'C'])}-${between(k + 'sl2', 1, 40)}`,
    site_id: pick(k + 'site', SITES).site_id,
    vendor_id: vendor.vendor_id,
    vendor_name: vendor.vendor_name,
    status: onHand === 0 ? 'Out of Stock' : onHand < min ? 'Low Stock' : 'In Stock',
  }
})

export const SCRAPS = PARTS.slice(0, 12).map((p, i) => ({
  scrap_id: `scr_${String(i + 1).padStart(3, '0')}`,
  part_id: p.part_id,
  part_name: p.part_name,
  quantity: (i % 4) + 1,
  reason: ['Damaged in handling', 'Past shelf life', 'Obsolete — asset retired', 'Wrong part received'][i % 4],
  value: Number((p.unit_cost * ((i % 4) + 1)).toFixed(2)),
  raised_by_name: TECHNICIANS[i % TECHNICIANS.length].name,
  status: i < 3 ? 'Pending Approval' : 'Approved',
  created_date: daysFrom(-i * 5),
  site_id: p.site_id,
}))

export const PURCHASE_ORDERS = DS ? DS.purchaseOrders : Array.from({ length: 16 }, (_, i) => {
  const vendor = VENDORS[i % VENDORS.length]
  const lines = (i % 3) + 1
  return {
    purchase_order_id: `po_${String(i + 1).padStart(4, '0')}`,
    po_number: `PO-${4100 + i}`,
    vendor_id: vendor.vendor_id,
    vendor_name: vendor.vendor_name,
    status: ['Draft', 'Pending Approval', 'Approved', 'Received'][i % 4],
    line_items: lines,
    total_amount: between(`po${i}`, 320, 8400, 2),
    created_date: daysFrom(-i * 3),
    expected_date: daysFrom(vendor.lead_time_days - i),
    raised_by_name: personFor('Planner'),
    site_id: SITES[i % SITES.length].site_id,
  }
})

export const DEMAND_PARTS = PARTS.filter((p) => p.status !== 'In Stock').slice(0, 14).map((p, i) => ({
  demand_id: `dp_${String(i + 1).padStart(3, '0')}`,
  part_id: p.part_id,
  part_name: p.part_name,
  part_number: p.part_number,
  required_quantity: p.minimum_quantity * 2 - p.quantity_on_hand,
  on_hand: p.quantity_on_hand,
  required_by: daysFrom(between(`dpd${i}`, 2, 24)),
  work_order_number: WORK_ORDERS[i].work_order_number,
  vendor_name: p.vendor_name,
  status: ['Requested', 'Sourcing', 'Ordered'][i % 3],
  site_id: p.site_id,
}))

// ── preventive maintenance ───────────────────────────────────────────────
// Which asset classes carry a meter, when the pack says. A meter-based schedule
// against a cargo dolly is the kind of row that makes a fleet department stop
// believing the rest of the screen.
const METERED_KINDS = PACK.domain?.poweredKinds
  ? new Set(PACK.domain.poweredKinds)
  : null

export const PM_SCHEDULES = DS ? DS.pmSchedules : Array.from({ length: 32 }, (_, i) => {
  const k = `pm-${i}`
  const asset = ASSETS[Math.floor(seed(k + 'a') * ASSETS.length)]
  return {
    schedule_id: `pms_${String(i + 1).padStart(4, '0')}`,
    schedule_name: `${asset.asset_type} — ${pick(k + 'f', ['Monthly', 'Quarterly', 'Six-monthly', 'Annual'])} service`,
    asset_id: asset.asset_id,
    asset_name: asset.asset_name,
    asset_code: asset.asset_code,
    site_id: asset.site_id,
    site_name: asset.site_name,
    // A schedule can run on the calendar, on the meter, or on both — whichever
    // falls first. The third is how fleet maintenance is actually written
    // ("1000 hours or 12 months") and it was the one the product could not say.
    //
    // Only equipment that carries a meter can have a meter trigger. Packs that
    // name their powered classes say which those are; where a pack names none,
    // everything is assumed to have running hours, which is true of plant.
    frequency_type: METERED_KINDS && !METERED_KINDS.has(asset.asset_type)
      ? 'Time'
      : pick(k + 'ft', ['Time', 'Time', 'Meter', 'Both']),
    frequency_value: between(k + 'fv', 1, 12),
    frequency_unit: pick(k + 'fu', ['Weeks', 'Months']),
    // The hours side of a meter or dual trigger. Tiered the way OEM schedules
    // are written rather than drawn from a range — there is no such thing as a
    // 437-hour service.
    meter_interval: pick(k + 'mi', [250, 250, 500, 1000]),
    // What the meter read when this schedule last raised a job. The distance
    // from here to the asset's current hours is how far through the interval it
    // is; without it a meter schedule has no idea where it stands.
    meter_at_last: Math.max(0, (asset.running_hours || 0) - between(k + 'ml', 20, 900)),
    last_generated: daysFrom(-between(k + 'lg', 5, 120)),
    next_due: daysFrom(between(k + 'nd', -8, 45)),
    assigned_to_name: pick(k + 'as', TECHNICIANS).name,
    estimated_hours: between(k + 'eh', 1, 8),
    status: pick(k + 'st', ['Active', 'Active', 'Active', 'Paused']),
  }
})

// ── inspections ──────────────────────────────────────────────────────────
// The kinds of inspection this register records. A pack that names its own
// replaces the four here — a ramp does not do a "condition survey", it does a
// mechanic check — and brings the items, cadence and checklist mapping with
// them (see lib/inspectionItems.jsx). Exported so every screen that offers a
// type offers the same four.
export const INSPECTION_TYPE_DEFS = PACK.domain?.inspectionTypes?.length ? PACK.domain.inspectionTypes : null
export const INSPECTION_TYPES = INSPECTION_TYPE_DEFS
  ? INSPECTION_TYPE_DEFS.map((t) => t.type)
  : ['Daily walk-round', 'Pre-start check', 'Safety inspection', 'Condition survey']

export const INSPECTIONS = Array.from({ length: 40 }, (_, i) => {
  const k = `insp-${i}`
  const asset = ASSETS[Math.floor(seed(k + 'a') * ASSETS.length)]
  const result = pick(k + 'r', ['Pass', 'Pass', 'Pass', 'Fail', 'Pass with observations'])
  return {
    inspection_id: `ins_${String(i + 1).padStart(4, '0')}`,
    inspection_number: `INS-${1400 + i}`,
    inspection_type: pick(k + 'ty', INSPECTION_TYPES),
    asset_id: asset.asset_id,
    asset_name: asset.asset_name,
    site_id: asset.site_id,
    site_name: asset.site_name,
    inspector_name: pick(k + 'ins', TECHNICIANS).name,
    scheduled_date: daysFrom(-between(k + 'sd', 0, 40)),
    status: pick(k + 'st', ['Completed', 'Completed', 'Completed', 'In Progress', 'Scheduled']),
    result,
    score: result === 'Fail' ? between(k + 'sc', 38, 64) : between(k + 'sc', 78, 100),
    findings_count: result === 'Pass' ? 0 : between(k + 'fc', 1, 5),
    duration_minutes: between(k + 'dm', 12, 75),
  }
})

// A pack's own register replaces this one. Its rows name a role rather than a
// person where one person carries the checklist, so the name comes from this
// pack's roster rather than from whoever wrote the pack.
const PACK_CHECKLISTS = (PACK.domain?.checklists || []).map(({ role, ...c }) => ({
  ...c,
  assigned_to: role ? personFor(role) : c.assigned_to,
}))

export const CHECKLISTS = PACK_CHECKLISTS.length ? PACK_CHECKLISTS : [
  { checklist_id: 'chk_001', checklist_name: 'Daily walk-round', items_count: 14, category: 'Operations', assigned_to: 'All technicians', completions_today: 5, due_today: 7, status: 'Active' },
  { checklist_id: 'chk_002', checklist_name: 'Pre-start machine check', items_count: 9, category: 'Operations', assigned_to: 'Line operators', completions_today: 11, due_today: 12, status: 'Active' },
  { checklist_id: 'chk_003', checklist_name: 'Monthly safety inspection', items_count: 22, category: 'Safety', assigned_to: personFor('Supervisor'), completions_today: 0, due_today: 1, status: 'Active' },
  { checklist_id: 'chk_004', checklist_name: 'Compressor condition survey', items_count: 18, category: 'Maintenance', assigned_to: personFor('Technician'), completions_today: 1, due_today: 1, status: 'Active' },
  { checklist_id: 'chk_005', checklist_name: 'Statutory examination — lifting', items_count: 11, category: 'Compliance', assigned_to: 'External', completions_today: 0, due_today: 0, status: 'Active' },
  { checklist_id: 'chk_006', checklist_name: 'Shutdown readiness', items_count: 26, category: 'Maintenance', assigned_to: personFor('Planner'), completions_today: 0, due_today: 0, status: 'Template' },
]

// What gets reported, in the words of the place it happens. A pack's titles
// replace these; the severity, status and asset still come from below.
const INCIDENT_TITLES = PACK.domain?.incidentTitles?.length
  ? PACK.domain.incidentTitles
  : ['Near miss — dropped tool from platform', 'Minor hand injury during belt change', 'Hydraulic oil spill', 'Guard interlock found bypassed', 'Slip on wet floor']

export const INCIDENTS = Array.from({ length: 10 }, (_, i) => {
  const asset = ASSETS[i * 7]
  return {
    incident_id: `inc_${String(i + 1).padStart(3, '0')}`,
    incident_number: `INC-${300 + i}`,
    title: INCIDENT_TITLES[i % INCIDENT_TITLES.length],
    severity: ['Low', 'Medium', 'High'][i % 3],
    status: ['Open', 'Under Review', 'Closed'][i % 3],
    asset_id: asset.asset_id,
    asset_name: asset.asset_name,
    site_id: asset.site_id,
    site_name: asset.site_name,
    reported_by_name: TECHNICIANS[i % TECHNICIANS.length].name,
    reported_date: daysFrom(-i * 7),
    lost_time: i % 4 === 0,
  }
})

export const WORK_PERMITS = Array.from({ length: 9 }, (_, i) => {
  const asset = ASSETS[i * 11]
  return {
    permit_id: `pmt_${String(i + 1).padStart(3, '0')}`,
    permit_number: `PTW-${700 + i}`,
    permit_type: ['Hot Work', 'Confined Space', 'Working at Height', 'Electrical Isolation'][i % 4],
    asset_id: asset.asset_id,
    asset_name: asset.asset_name,
    site_id: asset.site_id,
    work_order_number: WORK_ORDERS[i].work_order_number,
    requested_by_name: TECHNICIANS[i % TECHNICIANS.length].name,
    approver_name: personFor('Supervisor'),
    valid_from: daysFrom(-i),
    valid_to: daysFrom(2 - i),
    status: i < 3 ? 'Pending Approval' : i < 7 ? 'Active' : 'Closed',
  }
})

// A pack's outages replace these. They carry day offsets and a manager's role
// rather than dates and names, and all land on the pack's first site unless a
// row says otherwise — a single-station pack has nowhere else to put them.
const PACK_SHUTDOWNS = (PACK.domain?.shutdowns || []).map((s) => {
  const site = siteAt(s.site || 0)
  return {
    shutdown_id: s.shutdown_id,
    name: s.name,
    status: s.status,
    start_date: daysFrom(s.start),
    end_date: daysFrom(s.end),
    site_id: site.site_id,
    site_name: site.site_name,
    tasks: s.tasks,
    tasks_done: s.tasks_done,
    budget: s.budget,
    progress: s.progress,
    manager: personFor(s.manager),
  }
})

export const SHUTDOWNS = PACK_SHUTDOWNS.length ? PACK_SHUTDOWNS : [
  { shutdown_id: 'sd_001', name: 'Line 1 annual shutdown', status: 'Planned', start_date: daysFrom(21), end_date: daysFrom(26), site_id: siteAt(0).site_id, site_name: siteAt(0).site_name, tasks: 42, tasks_done: 0, budget: 68000, progress: 0, manager: personFor('Planner') },
  { shutdown_id: 'sd_002', name: 'Compressor house overhaul', status: 'In Progress', start_date: daysFrom(-3), end_date: daysFrom(4), site_id: siteAt(0).site_id, site_name: siteAt(0).site_name, tasks: 18, tasks_done: 8, budget: 21000, progress: 46, manager: personFor('Supervisor') },
  { shutdown_id: 'sd_003', name: 'Press shop rebuild', status: 'Completed', start_date: daysFrom(-40), end_date: daysFrom(-33), site_id: siteAt(1).site_id, site_name: siteAt(1).site_name, tasks: 27, tasks_done: 27, budget: 39500, progress: 100, manager: personFor('Planner') },
  { shutdown_id: 'sd_004', name: 'Warehouse racking inspection', status: 'Planned', start_date: daysFrom(48), end_date: daysFrom(49), site_id: siteAt(2).site_id, site_name: siteAt(2).site_name, tasks: 9, tasks_done: 0, budget: 4200, progress: 0, manager: personFor('Supervisor') },
]

export const REQUESTS = WORK_ORDERS.slice(0, 24).map((w, i) => ({
  request_id: w.workorder_id.startsWith('wo_') ? w.workorder_id.replace('wo_', 'req_') : `req_${w.workorder_id}`,
  request_number: w.work_order_number.replace('WO-', 'MR-'),
  title: w.title,
  description: w.description,
  status: ['Pending', 'In Review', 'Approved', 'Work Order Raised', 'Denied'][i % 5],
  priority: w.priority,
  asset_id: w.asset_id,
  asset_name: w.asset_name,
  site_id: w.site_id,
  site_name: w.site_name,
  requested_by_name: TECHNICIANS[i % TECHNICIANS.length].name,
  created_date: w.created_date,
  work_order_number: i % 5 === 3 ? w.work_order_number : null,
}))

export const LOGBOOK = Array.from({ length: 21 }, (_, i) => ({
  entry_id: `log_${String(i + 1).padStart(4, '0')}`,
  shift: ['Morning', 'Afternoon', 'Night'][i % 3],
  shift_date: daysFrom(-Math.floor(i / 3)),
  author_name: TECHNICIANS[i % TECHNICIANS.length].name,
  category: ['Handover', 'Breakdown', 'Observation', 'Safety'][i % 4],
  note: WORK_ORDERS[i].description,
  asset_name: WORK_ORDERS[i].asset_name,
  status: i < 4 ? 'Open' : 'Closed',
  site_id: SITES[i % SITES.length].site_id,
}))

// The five kinds of document a maintenance library actually holds, each with the
// file type it really is and the category the viewer opens it as. Name, type and
// category are one row rather than three parallel arrays because they had drifted
// apart: a calibration certificate was being filed as a DWG.
const DOC_KINDS = [
  { name: 'O&M Manual', type: 'PDF', category: 'Manual' },
  { name: 'Wiring Diagram', type: 'DWG', category: 'Drawing' },
  { name: 'Calibration Certificate', type: 'PDF', category: 'Certificate' },
  { name: 'Commissioning Report', type: 'PDF', category: 'Report' },
  { name: 'Spare Parts List', type: 'XLSX', category: 'Spares' },
]

export const DOC_CATEGORIES = DOC_KINDS.map((d) => d.category)

const SEEDED_DOCUMENTS = Array.from({ length: 14 }, (_, i) => {
  const asset = ASSETS[i * 5]
  const kind = DOC_KINDS[i % DOC_KINDS.length]
  return {
    document_id: `doc_${String(i + 1).padStart(4, '0')}`,
    document_name: `${kind.name} — ${asset.asset_name}`,
    document_type: kind.type,
    // What the viewer renders it as. Without this every document opened as a
    // manual, including the spares list that is a spreadsheet.
    category: kind.category,
    asset_id: asset.asset_id,
    asset_name: asset.asset_name,
    asset_type: asset.asset_type,
    manufacturer: asset.manufacturer,
    size_kb: between(`ds${i}`, 180, 4800),
    uploaded_by_name: USER.name,
    created_date: daysFrom(-i * 9),
    site_id: asset.site_id,
  }
})

// Paperwork a pack brings with it — a hospital's test reports and certificates.
//
// Each is filed against the first asset of the kind it names, so it lands on a
// fire pump rather than on whatever asset a stride through the register picks,
// and it carries the test it evidences and the date it stops being valid. The
// life safety screens read these exactly as they read a file somebody uploads.
const PACK_DOCUMENTS = (PACK.domain?.documents || []).flatMap((d, i) => {
  const asset = ASSETS.find((a) => a.asset_type === d.assetKind)
  if (!asset) return []
  return [{
    document_id: `doc_p${String(i + 1).padStart(2, '0')}`,
    document_name: d.name,
    document_type: d.type || 'PDF',
    category: d.category,
    test: d.test || '',
    asset_id: asset.asset_id,
    asset_name: asset.asset_name,
    asset_type: asset.asset_type,
    manufacturer: asset.manufacturer,
    size_kb: between(`pdoc${i}`, 240, 3200),
    uploaded_by_name: USER.name,
    created_date: daysFrom(-(d.daysAgo || 0)),
    valid_until: d.validDays ? daysFrom((d.validDays || 0) - (d.daysAgo || 0)) : '',
    site_id: asset.site_id,
  }]
})

export const DOCUMENTS = DS ? [...DS.documents, ...PACK_DOCUMENTS] : [...PACK_DOCUMENTS, ...SEEDED_DOCUMENTS]

// `system_type` groups a source on the connector map; `protocol` is what it
// actually speaks. Both were missing, which left the map with nothing to group
// by and the register with nothing to show but a status dot.
//
// The condition-monitoring rows are what make this a maintenance connector
// rather than an IT one: the readings that turn into a work order before the
// asset stops are the whole argument for the product.
export const INTEGRATIONS = [
  { id: 'int_01', name: 'SAP', category: 'ERP', system_type: 'Enterprise', protocol: 'OData / RFC', status: 'Connected', last_sync: daysFrom(0), records: 4820, note: 'Work orders and cost centres, two-way.' },
  { id: 'int_02', name: 'MQTT Broker', category: 'IoT', system_type: 'OT Platform', protocol: 'MQTT 3.1.1', status: 'Connected', last_sync: daysFrom(0), records: 126, note: 'Runtime hours and condition tags.' },
  { id: 'int_03', name: 'Power BI', category: 'Analytics', system_type: 'Enterprise', protocol: 'REST', status: 'Connected', last_sync: daysFrom(-1), records: 12, note: 'KPI dataset refresh, nightly.' },
  { id: 'int_04', name: 'QuickBooks', category: 'Finance', system_type: 'Enterprise', protocol: 'REST', status: 'Not connected', last_sync: null, records: 0, note: 'Purchase orders and invoices.' },
  { id: 'int_05', name: 'Microsoft Teams', category: 'Notifications', system_type: 'Enterprise', protocol: 'Webhook', status: 'Connected', last_sync: daysFrom(0), records: 340, note: 'Critical work order alerts to the maintenance channel.' },
  { id: 'int_06', name: 'Active Directory', category: 'Identity', system_type: 'Enterprise', protocol: 'LDAP / SAML', status: 'Connected', last_sync: daysFrom(-2), records: 52, note: 'SSO and user provisioning.' },
  { id: 'int_07', name: 'Vibration Monitoring', category: 'Condition monitoring', system_type: 'Sensing', protocol: 'MQTT', status: 'Connected', last_sync: daysFrom(0), records: 1840, note: 'Velocity and bearing envelope on rotating plant.' },
  { id: 'int_08', name: 'Thermal Imaging', category: 'Condition monitoring', system_type: 'Sensing', protocol: 'REST', status: 'Connected', last_sync: daysFrom(-3), records: 96, note: 'Route-based thermographic surveys, uploaded per round.' },
  { id: 'int_09', name: 'Oil Analysis', category: 'Condition monitoring', system_type: 'Sensing', protocol: 'CSV / SFTP', status: 'Connected', last_sync: daysFrom(-9), records: 74, note: 'Laboratory results against gearbox and hydraulic samples.' },
  { id: 'int_10', name: 'Ultrasound', category: 'Condition monitoring', system_type: 'New', protocol: 'MQTT', status: 'Not connected', last_sync: null, records: 0, note: 'Leak and steam-trap survey — pilot not yet started.' },
]

// ── the numbers the dashboard shows ──────────────────────────────────────
// Counted from the data above rather than typed in, so the headline figures and
// the lists a user drills into can never disagree.
const openWO = WORK_ORDERS.filter(isOpen)
const doneWO = WORK_ORDERS.filter((w) => w.status === 'Completed')

export const KPI = {
  assets_total: ASSETS.length,
  assets_operational: ASSETS.filter((a) => a.status === 'Operational').length,
  assets_maintenance: ASSETS.filter((a) => a.status === 'Under Maintenance').length,
  assets_down: ASSETS.filter((a) => a.status === 'Down').length,
  assets_iot: ASSETS.filter((a) => a.iot_enabled).length,
  work_orders_total: WORK_ORDERS.length,
  work_orders_open: openWO.length,
  // Overdue is a subset of work still live — a cancelled job cannot be late.
  work_orders_overdue: openWO.filter((w) => isPast(w.due_date)).length,
  work_orders_completed: doneWO.length,
  work_orders_critical: openWO.filter((w) => w.priority === 'Critical').length,
  pm_total: PM_SCHEDULES.length,
  pm_overdue: PM_SCHEDULES.filter((p) => isPast(p.next_due)).length,
  pm_compliance: Math.round((PM_SCHEDULES.filter((p) => !isPast(p.next_due)).length / PM_SCHEDULES.length) * 100),
  parts_total: PARTS.length,
  parts_low: PARTS.filter((p) => p.status === 'Low Stock').length,
  parts_out: PARTS.filter((p) => p.status === 'Out of Stock').length,
  inventory_value: Math.round(PARTS.reduce((n, p) => n + p.total_value, 0)),
  inspections_total: INSPECTIONS.length,
  inspections_failed: INSPECTIONS.filter((i) => i.result === 'Fail').length,
  inspections_pass_rate: Math.round((INSPECTIONS.filter((i) => i.result === 'Pass').length / INSPECTIONS.length) * 100),
  mttr_hours: Number((doneWO.reduce((n, w) => n + (w.actual_hours || 0), 0) / Math.max(1, doneWO.length)).toFixed(1)),
  downtime_hours: WORK_ORDERS.reduce((n, w) => n + w.downtime_hours, 0),
  maintenance_cost: WORK_ORDERS.reduce((n, w) => n + w.total_cost, 0),
  completion_rate: Math.round((doneWO.length / WORK_ORDERS.length) * 100),
  open_incidents: INCIDENTS.filter((i) => i.status !== 'Closed').length,
  active_permits: WORK_PERMITS.filter((p) => p.status === 'Active').length,
}

// Twelve months of history. Completion trails creation slightly, which is what
// a real backlog does — a chart where the two lines meet exactly reads as made
// up, because it is the one thing that never happens.
export const TREND = DS ? DS.trend : Array.from({ length: 12 }, (_, i) => {
  const d = new Date(EPOCH)
  d.setMonth(d.getMonth() - (11 - i))
  const raised = between(`tr${i}r`, 24, 52)
  return {
    month: d.toLocaleString('en-GB', { month: 'short' }),
    raised,
    completed: Math.max(0, raised - between(`tr${i}c`, 0, 9)),
    downtime_hours: between(`tr${i}d`, 12, 68),
    cost: between(`tr${i}$`, 4200, 18600),
  }
})

export const BY_STATUS = (rows, key = 'status') => {
  const out = new Map()
  rows.forEach((r) => out.set(r[key], (out.get(r[key]) || 0) + 1))
  return [...out.entries()].map(([name, value]) => ({ name, value }))
}

// Guarded, because a record created through the API rather than the form can
// arrive without a cost on it — and `$NaN` in a money column is the single
// most damaging thing a screen can show: it does not look like missing data,
// it looks like the arithmetic is broken.
// Hours, as a person writes them. A sum of floats prints as
// 1719.1999999999991 — true, and unreadable; every hours figure on screen is a
// total of logged times, so it goes through here.
export const hours = (n) => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString('en-US')

export const money = (n) => {
  // Nothing is not zero. `Number(null)` is 0, so without this an unpriced order
  // and a free one both read as $0 — and the first quietly joins every spend
  // total as though somebody had priced it.
  if (n === null || n === undefined || n === '') return '—'
  const v = Number(n)
  return Number.isFinite(v)
    ? `${ORG.currency_symbol}${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : '—'
}

// The pack's specialised module, or null. Screens that belong to one check this
// rather than testing for a customer by name.
export const DOMAIN = PACK.domain
export const PACK_KEY = PACK.key
export const PACK_LABEL = PACK.label

// What the dataset behind this pack is — its source, as-of date, the fleet the
// sample stands for, and how far its dates were moved to stay current. Null for a
// pack that is generated.
export const DATASET_META = DS ? DS.meta : null

// Current-period workmanship + spare-variant insights from the voice
// projection. Null on packs that do not seed a Superhub register.
export const VOICE_INSIGHTS = DS?.voiceInsights || null
export const VOICE_WATERFALL = DS?.voiceWaterfall || null

// The labour, parts, notes and out-of-service record behind one work order, for
// a pack whose dataset carries them. Async — it is its own chunk — and null for
// a generated pack, whose jobs have no such record.
export const loadWorkOrderDetail = DS ? DS.loadWorkOrderDetail : null

// Kits, warranty claims and recovery candidates, cycle counts, part usage by
// source and the labour KPI table — for the GSE parts, warranty, stores and
// people screens. Async, its own chunk; null where the pack has no dataset.
export const loadGseAnalytics = DS ? DS.loadGseAnalytics : null

// SAP's own layer for a pack that carries one: the organisation, five years of
// goods movements, and the procure-to-pay threads behind them. Async and large;
// only the SAP screens ask for it.
export const loadSapData = DS ? DS.loadSapData : null

// Stock movements the pack arrives with — what the stores posted before anyone
// opened this portal. Display only: the quantity on each part already counts
// them, so the ledger reads as a history rather than as a second set of books.
export const SEEDED_STOCK_MOVES = DS ? DS.stockMovements : []
