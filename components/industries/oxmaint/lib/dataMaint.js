// The four maintenance modules the seeded plant implies but does not spell out:
// the approval queue, the lubrication round, the reliability study and the
// automation rules.
//
// Nothing here is a second plant. Every row points back at an asset, a
// technician or a work order that already exists in data.js — so a number on
// one of these screens can be chased down to a record on another, and the two
// will agree. That is the whole reason these live in their own file rather than
// being invented inside each page.
//
// `seed` is private to data.js, so the deterministic draws below go through
// `pick` and `between`, which are the same hash underneath. No Math.random.

import {
  ASSETS, TECHNICIANS, WORK_ORDERS, PARTS, PM_SCHEDULES, INSPECTIONS,
  PURCHASE_ORDERS, SCRAPS, WORK_PERMITS, OPEN_STATUS, USER,
  pick, between, daysFrom, daysUntil, isPast,
  SUPERVISOR_NAME, PLANNER_NAME,
} from './data'

// ── approvals ────────────────────────────────────────────────────────────
//
// One queue, four sources. A supervisor does not open four screens to find out
// what is waiting on them — the thing they are approving changes, the act of
// approving does not.

// Delegated authority, applied identically to every source: at or above the
// limit it goes to the account owner, below it to the shift supervisor. Two
// names rather than one is what makes the queue read as an organisation.
export const AUTHORITY_LIMIT = 5000
const approverFor = (value) => (value >= AUTHORITY_LIMIT ? USER.name : SUPERVISOR_NAME)

// Approvers are excluded from the requester pool. A queue where rows were
// raised by the person approving them is a queue of self-approvals, which reads
// as a broken product rather than as a demo shortcut.
const REQUESTERS = TECHNICIANS.filter((t) => t.role === 'Technician')

const criticalWork = WORK_ORDERS
  .filter((w) => w.priority === 'Critical' && OPEN_STATUS.includes(w.status))
  .map((w) => ({
    approval_id: `apr_${w.workorder_id}`,
    // Carried so the Approve button can write the decision back onto the record
    // it came from, rather than onto a copy of it.
    source_kind: 'work_order',
    source_id: w.workorder_id,
    type: 'Work Order',
    reference: w.work_order_number,
    title: w.title,
    // Not created_by_name: every seeded work order records the account owner as
    // its creator, which would put one name on every row.
    requested_by_name: pick(`${w.workorder_id}req`, REQUESTERS).name,
    value: w.total_cost,
    site_id: w.site_id,
    raised_date: w.created_date,
    approver_name: approverFor(w.total_cost),
    status: 'Pending',
  }))

const pendingPurchase = PURCHASE_ORDERS
  .filter((p) => p.status === 'Pending Approval')
  .map((p) => ({
    approval_id: `apr_${p.purchase_order_id}`,
    source_kind: 'purchase_order',
    source_id: p.purchase_order_id,
    type: 'Purchase Order',
    reference: p.po_number,
    title: `${p.line_items} line${p.line_items === 1 ? '' : 's'} from ${p.vendor_name}`,
    requested_by_name: p.raised_by_name,
    value: p.total_amount,
    site_id: p.site_id,
    raised_date: p.created_date,
    approver_name: approverFor(p.total_amount),
    status: 'Pending',
  }))

const pendingScrap = SCRAPS
  .filter((s) => s.status === 'Pending Approval')
  .map((s) => ({
    approval_id: `apr_${s.scrap_id}`,
    source_kind: 'scrap',
    source_id: s.scrap_id,
    type: 'Scrap',
    reference: s.scrap_id.replace('scr_', 'SCR-'),
    title: `Write off ${s.quantity} × ${s.part_name} — ${s.reason.toLowerCase()}`,
    requested_by_name: s.raised_by_name,
    value: s.value,
    site_id: s.site_id,
    raised_date: s.created_date,
    approver_name: approverFor(s.value),
    status: 'Pending',
  }))

const pendingPermit = WORK_PERMITS
  .filter((p) => p.status === 'Pending Approval')
  .map((p) => ({
    approval_id: `apr_${p.permit_id}`,
    source_kind: 'permit',
    source_id: p.permit_id,
    type: 'Work Permit',
    reference: p.permit_number,
    title: `${p.permit_type} on ${p.asset_name}`,
    requested_by_name: p.requested_by_name,
    // A permit authorises work, it does not commit money — so it carries no
    // value and must not inflate the total awaiting sign-off.
    value: 0,
    site_id: p.site_id,
    raised_date: p.valid_from,
    // Safety sign-off does not follow the money: it is the permit's own
    // authorised signatory whatever the job is worth.
    approver_name: p.approver_name,
    status: 'Pending',
  }))

// Oldest first. How long a request has waited is the number an approver is
// judged on, so it is the order the queue arrives in.
export const APPROVALS = [...criticalWork, ...pendingPurchase, ...pendingScrap, ...pendingPermit]
  .sort((a, b) => new Date(a.raised_date).getTime() - new Date(b.raised_date).getTime())

export const APPROVAL_TYPES = ['Work Order', 'Purchase Order', 'Scrap', 'Work Permit']

// ── lubrication ──────────────────────────────────────────────────────────

// Points are drawn from what the machine actually has. A slide rail on an air
// compressor, or a chain drive on a boiler, is the kind of thing a maintenance
// manager spots in three seconds and never trusts the rest of the screen after.
// Every rotating machine has bearings and most have a coupling, so that is the
// safe general answer for an asset type this table has never seen — which is
// any type at all once a different data pack is active.
const POINTS_DEFAULT = ['Drive-end bearing', 'Non-drive-end bearing', 'Coupling']

const POINTS_BY_TYPE = {
  'Air Compressor': ['Drive-end bearing', 'Non-drive-end bearing', 'Coupling'],
  'Hydraulic Press': ['Drive-end bearing', 'Slide rails', 'Slide rails', 'Coupling'],
  Conveyor: ['Drive-end bearing', 'Non-drive-end bearing', 'Gearbox', 'Chain drive'],
  Chiller: ['Drive-end bearing', 'Non-drive-end bearing', 'Coupling'],
  Boiler: ['Drive-end bearing', 'Non-drive-end bearing', 'Coupling'],
  Pump: ['Drive-end bearing', 'Non-drive-end bearing', 'Coupling'],
  Gearbox: ['Gearbox', 'Gearbox', 'Drive-end bearing', 'Coupling'],
  Extruder: ['Gearbox', 'Drive-end bearing', 'Slide rails'],
  Forklift: ['Chain drive', 'Chain drive', 'Drive-end bearing'],
  'Cooling Tower': ['Gearbox', 'Drive-end bearing', 'Non-drive-end bearing', 'Coupling'],
}

export const LUBE_ROUTES = ['Route A — Line 1', 'Route B — Line 2', 'Route C — Utilities']

// A route is a walk, not a label — a technician covers one plant area per
// round — so it follows the asset's functional location rather than a draw.
const ROUTE_BY_LOCATION = {
  loc_01: LUBE_ROUTES[0],
  loc_02: LUBE_ROUTES[1],
  loc_03: LUBE_ROUTES[2],
  loc_04: LUBE_ROUTES[2],
  loc_05: LUBE_ROUTES[1],
  loc_06: LUBE_ROUTES[2],
}

// One technician owns a route end to end. Splitting a round between people is
// how points get missed, so the assignment follows the route, not the point.
export const ROUTE_OWNER = {
  [LUBE_ROUTES[0]]: 'Daniel Reeve',
  [LUBE_ROUTES[1]]: 'Owen Marsh',
  [LUBE_ROUTES[2]]: 'Victor Lang',
}

const isGrease = (lubricant) => lubricant.includes('grease')

const GREASES = [
  'EP2 lithium grease', 'EP2 lithium grease', 'EP2 lithium grease',
  'EP2 lithium grease', 'EP2 lithium grease', 'Food-grade H1 grease',
]

// Machines that carry their own oil charge, and what is in it.
const OIL_BY_TYPE = {
  'Air Compressor': 'Synthetic compressor oil',
  Chiller: 'Synthetic compressor oil',
  'Hydraulic Press': 'ISO VG 46 hydraulic',
  Extruder: 'ISO VG 46 hydraulic',
}

// The lubricant is a property of what is being lubricated, not a free choice: a
// gearbox takes gear oil whatever else is on the shelf.
const lubricantFor = (asset, point, key) => {
  if (point === 'Gearbox') return 'ISO VG 220 gear oil'
  if (point === 'Slide rails') return OIL_BY_TYPE[asset.asset_type] || 'ISO VG 46 hydraulic'
  // An oil-flooded machine lubricates its own bearings from the main charge. A
  // grease nipple on a screw compressor's air end would be a mistake, and the
  // people watching this demo are the people who would catch it.
  if (OIL_BY_TYPE[asset.asset_type] && point.endsWith('bearing')) return OIL_BY_TYPE[asset.asset_type]
  return pick(key, GREASES)
}

// Grease points are walked weekly to monthly; an oil charge runs on a far
// longer clock. One pool for both puts a gearbox on a seven-day oil change,
// which no plant on earth does. Monthly is the workhorse either way.
const GREASE_INTERVALS = [7, 14, 14, 30, 30, 30]
const OIL_INTERVALS = [30, 90, 90, 180, 180]

const LUBE_ASSETS = ASSETS.filter((a) => a.criticality !== 'Low')

export const LUBE_POINTS = Array.from({ length: 34 }, (_, i) => {
  const k = `lube-${i}`
  // Stride rather than slice, so the round covers the whole register instead of
  // whichever assets happen to sit at the front of it.
  const asset = LUBE_ASSETS[(i * 5) % LUBE_ASSETS.length]
  const point = pick(k + 'pt', POINTS_BY_TYPE[asset.asset_type] || POINTS_DEFAULT)
  const lubricant = lubricantFor(asset, point, k + 'lb')
  const interval = pick(k + 'iv', isGrease(lubricant) ? GREASE_INTERVALS : OIL_INTERVALS)
  // Drawn from a window a fifth wider than the interval, so a realistic minority
  // of the round is behind. Drawn inside it nothing is ever late and a screen
  // whose job is to show what has been missed has nothing to show; drawn much
  // wider and a third of the plant is unlubricated, which says more about the
  // customer than about the product.
  const since = between(k + 'ld', 1, Math.round(interval * 1.2))
  const nextIn = interval - since
  const route = ROUTE_BY_LOCATION[asset.functional_location_id] || LUBE_ROUTES[2]
  return {
    lube_id: `lub_${String(i + 1).padStart(4, '0')}`,
    asset_id: asset.asset_id,
    asset_name: asset.asset_name,
    asset_code: asset.asset_code,
    site_id: asset.site_id,
    site_name: asset.site_name,
    point_name: point,
    lubricant,
    // Grease is booked in grams and oil in litres. One unit for both is how a
    // 25-litre grease charge ends up on a purchase requisition.
    quantity: isGrease(lubricant)
      ? `${between(k + 'q', 8, 60)} g`
      : `${between(k + 'q', 1, 9, 1)} L`,
    interval_days: interval,
    last_done: daysFrom(-since),
    next_due: daysFrom(nextIn),
    route,
    assigned_to_name: ROUTE_OWNER[route],
    status: nextIn < 0 ? 'Overdue' : 'Scheduled',
  }
})

// ── reliability-centred maintenance ──────────────────────────────────────
//
// Two credible failure modes per asset type, each carrying its own severity.
// Severity belongs to the consequence and never moves: losing the steam header
// outranks a forklift off the fleet on every plant there has ever been. So it is
// written down beside the mode rather than drawn.
// Same reason as the lubrication points: a table keyed by one pack's asset
// types is empty for every other pack. These four modes apply to any rotating
// machine, which is what an unrecognised type is most likely to be.
const FAILURE_MODES_DEFAULT = [
  { mode: 'Bearing wear', effect: 'Rising vibration, eventual seizure and unplanned stop', detection: 'Vibration trend and bearing temperature', severity: 8 },
  { mode: 'Seal or gasket failure', effect: 'Loss of containment, unit taken offline', detection: 'Operator round and visual inspection', severity: 7 },
  { mode: 'Motor winding fault', effect: 'Trip on overload, machine unavailable', detection: 'Motor current signature and thermography', severity: 8 },
  { mode: 'Coupling misalignment', effect: 'Accelerated bearing and seal wear', detection: 'Vibration spectrum and laser alignment', severity: 6 },
]

const FAILURE_MODES = {
  'Air Compressor': [
    { mode: 'Air-end bearing seizure', effect: 'Plant air lost — every pneumatic line stops', detection: 'Vibration trend and bearing temperature', severity: 9 },
    { mode: 'Intercooler fouling', effect: 'Discharge temperature trip, unit offline', detection: 'Discharge temperature against ambient', severity: 6 },
  ],
  'Hydraulic Press': [
    { mode: 'Pump internal leakage', effect: 'Tonnage falls below spec, parts out of tolerance', detection: 'Cycle time and pressure decay test', severity: 7 },
    { mode: 'Ram seal failure', effect: 'Oil loss and slide creep, press stopped', detection: 'Visual leak check and oil top-up rate', severity: 8 },
  ],
  Conveyor: [
    { mode: 'Belt tracking drift', effect: 'Edge wear and spillage onto the walkway', detection: 'Daily walk-round and edge wear check', severity: 5 },
    { mode: 'Drive gearbox tooth wear', effect: 'Line stops, product backs up at the transfer', detection: 'Oil sample and gearbox noise trend', severity: 7 },
  ],
  Chiller: [
    { mode: 'Refrigerant charge loss', effect: 'Process cooling lost, batch temperature excursion', detection: 'Suction pressure trend and leak survey', severity: 8 },
    { mode: 'Condenser tube fouling', effect: 'Efficiency falls away, high head pressure trips', detection: 'Approach temperature trend', severity: 5 },
  ],
  Boiler: [
    { mode: 'Feedwater pump failure', effect: 'Low-water trip, steam header lost', detection: 'Pump current and level control response', severity: 10 },
    { mode: 'Burner flame instability', effect: 'Lockout on flame failure, steam demand unmet', detection: 'Flame scanner signal and lockout log', severity: 8 },
  ],
  Pump: [
    { mode: 'Mechanical seal failure', effect: 'Product leak and containment risk', detection: 'Seal pot level and visual leak check', severity: 7 },
    { mode: 'Impeller cavitation damage', effect: 'Flow falls away, downstream plant starves', detection: 'Suction pressure and vibration spectrum', severity: 6 },
  ],
  Gearbox: [
    { mode: 'Output bearing spall', effect: 'Drive seizes, driven equipment stops', detection: 'Vibration envelope and oil particle count', severity: 8 },
    { mode: 'Oil degraded past the condemning limit', effect: 'Accelerated tooth wear, life shortened', detection: 'Scheduled oil analysis', severity: 5 },
  ],
  Extruder: [
    { mode: 'Screw and barrel wear', effect: 'Output rate and dimensional control lost', detection: 'Motor load against throughput', severity: 7 },
    { mode: 'Heater band burn-out', effect: 'Zone off temperature profile, product scrapped', detection: 'Zone temperature deviation alarm', severity: 6 },
  ],
  Forklift: [
    { mode: 'Mast chain stretch beyond limit', effect: 'Load drop risk during lifting', detection: 'Statutory thorough examination', severity: 9 },
    { mode: 'Traction battery capacity loss', effect: 'Shift cut short, truck off the fleet', detection: 'Charge cycle log and discharge test', severity: 4 },
  ],
  'Cooling Tower': [
    { mode: 'Fan gearbox failure', effect: 'Cooling duty lost, connected plant derated', detection: 'Vibration trend and gearbox oil level', severity: 7 },
    { mode: 'Fill fouling and biological growth', effect: 'Approach temperature rises, water hygiene risk', detection: 'Water sampling and approach trend', severity: 8 },
  ],
}

// The reliability report covers a rolling year, so failures are counted and
// MTBF measured over the same window.
const RCM_WINDOW_DAYS = 365

// The strategy is not stored anywhere and never typed in — it is the decision
// the RPN forces. Writing that decision down is the only thing an FMEA is for.
// The bands are the ones the table colours: above 200 is unacceptable and the
// answer is to remove the failure mode, not to schedule around it.
const strategyFor = (rpn) => (
  rpn > 200 ? 'Redesign'
    : rpn > 100 ? 'Condition-based'
      : rpn > 50 ? 'Time-based'
        : 'Run to failure'
)

const HIGH_ASSETS = ASSETS.filter((a) => a.criticality === 'High')

export const RCM = Array.from({ length: 22 }, (_, i) => {
  const k = `rcm-${i}`
  const asset = HIGH_ASSETS[(i * 2) % HIGH_ASSETS.length]
  const m = pick(k + 'm', FAILURE_MODES[asset.asset_type] || FAILURE_MODES_DEFAULT)
  const failures = WORK_ORDERS.filter((w) => w.asset_id === asset.asset_id && w.work_order_type === 'Breakdown').length
  // Occurrence follows the breakdowns actually booked against the asset, so the
  // FMEA and the work order history cannot contradict each other on screen.
  const occurrence = Math.min(8, 1 + failures * 2 + between(k + 'o', 0, 5))
  // An instrumented asset is caught earlier and so scores lower on
  // detectability. That gap is the argument this screen exists to make.
  const detectability = asset.iot_enabled ? between(k + 'd', 1, 4) : between(k + 'd', 3, 8)
  const rpn = m.severity * occurrence * detectability
  return {
    rcm_id: `rcm_${String(i + 1).padStart(4, '0')}`,
    asset_id: asset.asset_id,
    asset_name: asset.asset_name,
    asset_code: asset.asset_code,
    site_id: asset.site_id,
    criticality: asset.criticality,
    failure_mode: m.mode,
    effect: m.effect,
    detection: m.detection,
    severity: m.severity,
    occurrence,
    detectability,
    rpn,
    failures_recorded: failures,
    // With nothing booked there is no mean to take, so what is shown is the run
    // time achieved without a failure rather than a computed average.
    mtbf_days: failures > 0
      ? Math.round(RCM_WINDOW_DAYS / failures)
      : Math.max(RCM_WINDOW_DAYS, Math.round(asset.running_hours / 24)),
    strategy: strategyFor(rpn),
  }
})

export const RCM_STRATEGIES = ['Condition-based', 'Time-based', 'Run to failure', 'Redesign']

// ── automation rules ─────────────────────────────────────────────────────
//
// Run counts are the real ones. A rule claiming 40 runs on a plant that has
// only failed eight inspections is the sort of detail an audience checks.
const runsIn30d = (rows, dateKey) => rows.filter((r) => daysUntil(r[dateKey]) >= -30).length

export const WORKFLOWS = [
  {
    workflow_id: 'wf_001',
    name: 'Critical work order escalation',
    trigger: 'Work order created',
    conditions: ['Priority is Critical', 'Asset criticality is High'],
    actions: [`Notify ${SUPERVISOR_NAME}`, 'Post to the maintenance Teams channel', 'Pull the due date in to 24 hours'],
    runs_30d: runsIn30d(WORK_ORDERS.filter((w) => w.priority === 'Critical'), 'created_date'),
    last_run: daysFrom(0),
    status: 'Active',
    owner_name: SUPERVISOR_NAME,
  },
  {
    workflow_id: 'wf_002',
    name: 'Overdue PM chase',
    trigger: 'PM schedule passes its next due date',
    conditions: ['Schedule status is Active', 'More than 3 days past due'],
    actions: ['Email the assigned technician', 'Raise a corrective work order', 'Add to the daily planning list'],
    runs_30d: PM_SCHEDULES.filter((p) => isPast(p.next_due)).length,
    last_run: daysFrom(0),
    status: 'Active',
    owner_name: PLANNER_NAME,
  },
  {
    workflow_id: 'wf_003',
    name: 'Low stock reorder',
    trigger: 'Part quantity falls below its reorder point',
    conditions: ['Quantity on hand under the minimum', 'No open purchase order for the part'],
    actions: ['Create a demand part line', `Notify ${PLANNER_NAME}`],
    runs_30d: PARTS.filter((p) => p.status !== 'In Stock').length,
    last_run: daysFrom(-1),
    status: 'Active',
    owner_name: PLANNER_NAME,
  },
  {
    workflow_id: 'wf_004',
    name: 'Purchase approval routing',
    trigger: 'Purchase order submitted',
    conditions: [`Value at or above ${AUTHORITY_LIMIT.toLocaleString('en-US')}`],
    actions: ['Route to the account owner', 'Hold the order at Pending Approval'],
    runs_30d: PURCHASE_ORDERS.filter((p) => p.total_amount >= AUTHORITY_LIMIT).length,
    last_run: daysFrom(-2),
    status: 'Active',
    owner_name: USER.name,
  },
  {
    workflow_id: 'wf_005',
    name: 'Failed inspection follow-up',
    trigger: 'Inspection result recorded',
    conditions: ['Result is Fail'],
    actions: ['Raise a corrective work order', 'Set priority to High', 'Attach the inspection findings'],
    runs_30d: INSPECTIONS.filter((x) => x.result === 'Fail').length,
    last_run: daysFrom(-1),
    status: 'Active',
    owner_name: 'Sara Kovac',
  },
  {
    workflow_id: 'wf_006',
    name: 'Permit expiry warning',
    trigger: 'Work permit approaches its valid-to time',
    conditions: ['Permit status is Active', 'Expires within 4 hours'],
    actions: ['Notify the permit holder', 'Notify the authorised signatory'],
    runs_30d: WORK_PERMITS.filter((p) => p.status === 'Active').length,
    last_run: daysFrom(0),
    status: 'Active',
    owner_name: SUPERVISOR_NAME,
  },
  {
    workflow_id: 'wf_007',
    name: 'Lubrication route sign-off',
    trigger: 'Lubrication point signed as done',
    conditions: ['All points on the route complete', 'Signed within the shift'],
    actions: ['Stamp the next due dates', 'Close the route for the shift'],
    runs_30d: runsIn30d(LUBE_POINTS, 'last_done'),
    last_run: daysFrom(-3),
    status: 'Paused',
    owner_name: 'Owen Marsh',
  },
  {
    workflow_id: 'wf_008',
    name: 'Breakdown downtime capture',
    trigger: 'Work order marked complete',
    conditions: ['Type is Breakdown', 'Downtime hours left blank'],
    actions: ['Prompt the technician for downtime', 'Block completion until entered'],
    // A draft rule has never fired. Showing it with runs would say the opposite
    // of what Draft means.
    runs_30d: 0,
    last_run: null,
    status: 'Draft',
    owner_name: PLANNER_NAME,
  },
]
