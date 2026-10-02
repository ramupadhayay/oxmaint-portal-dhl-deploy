// The property behind the Hospitality portal.
//
// Reads `packs/hospitality` directly rather than whichever pack the CMMS portal
// is running. That is the whole reason this is a portal and not a pack: both
// can be open in the same build, on the same host, and the console swaps
// between them with a click instead of a rebuild.
//
// Generation is the CMMS portal's, copied rather than imported — importing its
// data.js would drag in the plant of whatever pack it is running today, 168
// assets built to answer a question this portal never asks. The helpers below
// are thirty lines; the coupling would have been the whole module.
//
// Every value is derived, never random: the same seed produces the same suites,
// the same work orders and the same readings on every machine and every run.
// Dates are offsets from today rather than a pinned calendar, so a demo given
// next month opens on a property that is still running rather than one whose
// every due date has gone red.

import PACK from '../../oxmaint/lib/packs/hospitality'

// ── deterministic helpers ────────────────────────────────────────────────
export function seed(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // Avalanche: without it the last character dominates the high bits, and
  // pick() reads the high bits — so keys that share a suffix all land in one
  // bucket and the data comes out visibly patterned.
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
export const money = (n) => `${PACK.org.currency_symbol}${Number(n || 0).toLocaleString('en-US')}`

// ── the property ─────────────────────────────────────────────────────────
export const ORG = {
  organization_id: 'org_hosp_0001',
  ...PACK.org,
  created_date: daysFrom(-420),
}

export const USER = { user_id: 'usr_hosp_0001', ...PACK.user, last_login: daysFrom(0) }

// One property, not three. The CMMS pack carries sister sites because the
// portal's team and site filters expect more than one; this portal is built for
// a single hotel and a site switcher over one entry is a control with nothing
// to do.
export const SITE = PACK.sites[0]
export const LOCATIONS = PACK.locations.filter((l) => l.site_id === SITE.site_id)

export const TECHNICIANS = PACK.technicians.map((t) => ({
  ...t,
  email: `${t.name.toLowerCase().replace(/[^a-z]+/g, '.')}@residenceinndover.example`,
}))
export const CREW = TECHNICIANS.filter((t) => t.role === 'Technician')

export const DOMAIN = PACK.domain
export const SUITE_PM = DOMAIN.suitePm
export const ROUNDS = DOMAIN.rounds
export const CYCLE_DAYS = DOMAIN.cycleDays
export const SHIFT_MINUTES = DOMAIN.shiftMinutes

// ── the suites ───────────────────────────────────────────────────────────
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

const NUMBERS = DOMAIN.floors.flatMap((f) =>
  range(f.from, f.to).map((number) => ({ number, floor: f.floor })))

export const SUITE_COUNT = NUMBERS.length

// Where in the rotation today sits. Read from the clock, so the board advances
// overnight on its own — the one thing a picture of a spreadsheet cannot do.
export const CYCLE_POSITION = SUITE_COUNT
  ? Math.floor(EPOCH / 86400000) % CYCLE_DAYS
  : 0

// A suite's place in the rotation is its place in the building. Scattering the
// order reads as more sophisticated and is worse work: a tech given 214 and 215
// walks four steps, one given 108 and 331 walks the property twice.
export const SUITES = NUMBERS.map((s, i) => {
  const k = `suite-${s.number}`
  const cycleDay = Math.floor((i * CYCLE_DAYS) / SUITE_COUNT)
  const passed = cycleDay < CYCLE_POSITION

  // Roughly one in fourteen slips. A rotation that never misses is a rotation
  // nobody is running by hand, and the catch-up queue is half of what makes
  // tomorrow's schedule differ from today's.
  const slipped = passed && seed(k + 'slip') < 0.07

  const dueOffset = slipped || !passed ? cycleDay - CYCLE_POSITION : cycleDay - CYCLE_POSITION + CYCLE_DAYS
  const lastOffset = passed && !slipped ? cycleDay - CYCLE_POSITION : cycleDay - CYCLE_POSITION - CYCLE_DAYS

  return {
    suite_id: `ste_${s.number}`,
    suite_number: String(s.number),
    floor: s.floor,
    suite_type: pick(k + 'type', DOMAIN.suiteTypes),
    pet_friendly: seed(k + 'pet') > 0.7,
    occupied: seed(k + 'occ') > 0.28,
    rotation_slot: i,
    cycle_day: cycleDay,
    last_pm_date: daysFrom(lastOffset),
    next_pm_date: daysFrom(dueOffset),
    due_in_days: dueOffset,
    overdue_days: dueOffset < 0 ? -dueOffset : 0,
    state: dueOffset < 0 ? 'Overdue' : dueOffset === 0 ? 'Due today' : passed ? 'Done this cycle' : 'Scheduled',
  }
})

export const suiteByNumber = (n) => SUITES.find((s) => s.suite_number === String(n)) || null

// ── the estate ───────────────────────────────────────────────────────────
// In-suite assets are generated per suite rather than drawn at random, because
// at an extended-stay property that is what the register actually is: every
// suite has one of each of these, and a PTAC that belongs to no room is not a
// thing a hotel engineer has ever seen.
const IN_SUITE = [
  { kind: 'PTAC Unit', maker: 'Amana', crit: 'High' },
  { kind: 'Guest Refrigerator', maker: 'GE Appliances', crit: 'Medium' },
  { kind: 'Dishwasher', maker: 'Whirlpool', crit: 'Medium' },
  { kind: 'Microwave', maker: 'GE Appliances', crit: 'Low' },
  { kind: 'Cooktop', maker: 'Whirlpool', crit: 'Medium' },
  { kind: 'Garbage Disposal', maker: 'Whirlpool', crit: 'Low' },
]

// Plant is the opposite: a handful of items the whole property depends on, so
// they are listed rather than generated.
const PLANT = [
  { kind: 'Pool Pump', maker: 'Pentair', crit: 'High', loc: 'Pool & Spa', n: 2 },
  { kind: 'Pool Heater', maker: 'Pentair', crit: 'High', loc: 'Pool & Spa', n: 1 },
  { kind: 'Water Heater', maker: 'Rheem', crit: 'High', loc: 'Mechanical Room', n: 3 },
  { kind: 'Rooftop Unit', maker: 'Rheem', crit: 'High', loc: 'Public Areas & Fitness', n: 2 },
  { kind: 'Commercial Washer', maker: 'Speed Queen', crit: 'Medium', loc: 'Guest Laundry & Housekeeping', n: 3 },
  { kind: 'Commercial Dryer', maker: 'Speed Queen', crit: 'Medium', loc: 'Guest Laundry & Housekeeping', n: 3 },
  { kind: 'Ice Machine', maker: 'GE Appliances', crit: 'Low', loc: 'Breakfast & Kitchen', n: 2 },
  { kind: 'Fire Alarm Panel', maker: 'Rheem', crit: 'High', loc: 'Public Areas & Fitness', n: 1 },
  { kind: 'Elevator', maker: 'Amana', crit: 'High', loc: 'Public Areas & Fitness', n: 1 },
]

const ASSET_STATUS = [...Array(17).fill('Operational'), ...Array(2).fill('Under Maintenance'), 'Down']

const suiteAssets = SUITES.flatMap((s) =>
  IN_SUITE.map((a, j) => {
    const k = `ast-${s.suite_number}-${j}`
    return {
      asset_id: `ast_s${s.suite_number}_${j}`,
      asset_name: `${a.kind} — Suite ${s.suite_number}`,
      asset_code: `DOV-${a.kind.split(' ').map((w) => w[0]).join('')}-${s.suite_number}`,
      asset_type: a.kind,
      manufacturer: a.maker,
      model: `M${between(k + 'm', 100, 900)}`,
      serial_number: `SN${between(k + 's', 100000, 999999)}`,
      location_name: `Floor ${s.floor}`,
      suite_number: s.suite_number,
      in_suite: true,
      criticality: a.crit,
      status: pick(k + 'st', ASSET_STATUS),
      health_score: between(k + 'h', 62, 99),
      last_maintenance_date: s.last_pm_date,
      next_maintenance_date: s.next_pm_date,
    }
  }))

const plantAssets = PLANT.flatMap((p) =>
  Array.from({ length: p.n }, (_, i) => {
    const k = `plant-${p.kind}-${i}`
    return {
      asset_id: `ast_p_${p.kind.replace(/\W+/g, '').toLowerCase()}_${i + 1}`,
      asset_name: `${p.kind} ${String(i + 1).padStart(2, '0')}`,
      asset_code: `DOV-${p.kind.split(' ').map((w) => w[0]).join('')}-${String(i + 1).padStart(2, '0')}`,
      asset_type: p.kind,
      manufacturer: p.maker,
      model: `M${between(k + 'm', 100, 900)}`,
      serial_number: `SN${between(k + 's', 100000, 999999)}`,
      location_name: p.loc,
      suite_number: null,
      in_suite: false,
      criticality: p.crit,
      status: pick(k + 'st', ASSET_STATUS),
      health_score: between(k + 'h', 55, 98),
      last_maintenance_date: daysFrom(-between(k + 'lm', 2, 120)),
      next_maintenance_date: daysFrom(between(k + 'nm', 1, 70)),
    }
  }))

export const ASSETS = [...plantAssets, ...suiteAssets]
export const PLANT_ASSETS = plantAssets
export const SUITE_ASSETS = suiteAssets

// ── work orders ──────────────────────────────────────────────────────────
const WO_STATUS = [
  ...Array(9).fill('Completed'), ...Array(4).fill('Open'),
  ...Array(4).fill('In Progress'), ...Array(2).fill('On Hold'), 'Cancelled',
]
const WO_PRIORITY = [
  ...Array(9).fill('Medium'), ...Array(5).fill('High'),
  ...Array(4).fill('Low'), 'Critical', 'Critical',
]
const WO_TYPE = ['Corrective', 'Preventive', 'Inspection', 'Guest request']

export const WORK_ORDERS = Array.from({ length: 76 }, (_, i) => {
  const k = `wo-${i}`
  const asset = ASSETS[Math.floor(seed(k + 'a') * ASSETS.length)]
  const status = pick(k + 'st', WO_STATUS)
  const closed = status === 'Completed' || status === 'Cancelled'
  // Old work orders are the ones that got closed; the ones still open are
  // recent. Spreading both across the same window is what makes a dashboard
  // report more overdue work than open work — a number that is not so much
  // wrong as impossible.
  const created = closed ? -between(k + 'c', 6, 70) : -between(k + 'c', 0, 22)
  const task = pick(k + 't', PACK.tasks)
  return {
    workorder_id: `wo_${String(i + 1).padStart(4, '0')}`,
    work_order_number: `WO-${4100 + i}`,
    title: asset.suite_number ? `Suite ${asset.suite_number} — ${task}` : task,
    description: `${task} on ${asset.asset_name}.`,
    status,
    priority: pick(k + 'p', WO_PRIORITY),
    work_order_type: pick(k + 'ty', WO_TYPE),
    asset_id: asset.asset_id,
    asset_name: asset.asset_name,
    suite_number: asset.suite_number,
    location_name: asset.location_name,
    assigned_to_name: pick(k + 'as', TECHNICIANS).name,
    created_by_name: USER.name,
    created_date: daysFrom(created),
    due_date: daysFrom(created + between(k + 'due', 3, 26)),
    completed_date: status === 'Completed' ? daysFrom(created + between(k + 'cd', 1, 12)) : null,
    // Half an hour to three, not the one-to-six a plant's jobs run to. Hotel
    // work is short and frequent: a disposal reset, a cartridge, a filter. Six
    // hours on a guest room job would mean the suite is out of service for a
    // night, which is a different conversation from a work order.
    estimated_hours: between(k + 'eh', 0.5, 3, 1),
    actual_hours: status === 'Completed' ? between(k + 'ah', 0.5, 4, 1) : null,
    total_cost: between(k + 'cost', 30, 1400),
  }
})

export const OPEN_STATUS = ['Open', 'In Progress', 'On Hold']
export const isOpen = (w) => OPEN_STATUS.includes(w.status)

// ── PM schedules ─────────────────────────────────────────────────────────
// One schedule per repeating round, plus the suite rotation itself — which is
// the largest standing commitment on the property and belongs in the library
// beside the rest rather than living only on a board.
export const PM_SCHEDULES = [
  {
    schedule_id: 'pms_rotation',
    schedule_name: 'Guest suite PM — quarterly rotation',
    frequency: 'Quarterly',
    every_days: CYCLE_DAYS,
    scope: `All ${SUITE_COUNT} suites`,
    tasks: SUITE_PM.checklist.length,
    minutes: SUITE_PM.minutes,
    compliance: null,
    next_due: daysFrom(0),
    owner: CREW[0]?.name || USER.name,
    status: 'Active',
  },
  ...ROUNDS.map((r, i) => ({
    schedule_id: `pms_${r.key}`,
    schedule_name: r.label,
    frequency: r.every === 'day' ? 'Daily' : r.every === 'week' ? 'Weekly' : 'Monthly',
    every_days: r.every === 'day' ? 1 : r.every === 'week' ? 7 : 30,
    scope: r.location,
    tasks: 1,
    minutes: r.minutes,
    compliance: r.compliance || null,
    next_due: daysFrom(r.every === 'day' ? 0 : between(`pm${i}`, 1, r.every === 'week' ? 6 : 27)),
    owner: pick(`pmo${i}`, CREW).name,
    status: 'Active',
  })),
]

// ── parts and vendors ────────────────────────────────────────────────────
export const VENDORS = PACK.vendorNames.map((name, i) => ({
  vendor_id: `ven_${String(i + 1).padStart(3, '0')}`,
  vendor_name: name,
  contact_name: pick(`vc${i}`, ['J. Hardy', 'M. Ellis', 'R. Fry', 'L. Osei']),
  email: `orders${i + 1}@supplier.example`,
  phone: `+1 302 555 ${between(`vp${i}`, 1000, 9999)}`,
  lead_time_days: between(`vl${i}`, 2, 18),
  status: 'Active',
}))

export const PARTS = PACK.partNames.map((name, i) => {
  const k = `part-${i}`
  const min = between(k + 'min', 4, 20)
  // A stockroom where nothing has run out is a stockroom nobody draws from, and
  // the reorder machinery would have nothing to point at.
  const draw = seed(k + 'stk')
  const onHand = draw < 0.07 ? 0 : draw < 0.2 ? between(k + 'q', 1, min) : between(k + 'q', min, min * 4)
  return {
    part_id: `prt_${String(i + 1).padStart(3, '0')}`,
    part_name: name,
    part_number: `P-${between(k + 'pn', 1000, 9999)}`,
    quantity_on_hand: onHand,
    min_quantity: min,
    unit_cost: between(k + 'uc', 4, 180, 2),
    total_value: Math.round(onHand * between(k + 'uc', 4, 180, 2)),
    vendor_name: pick(k + 'v', VENDORS).vendor_name,
    location_name: 'Mechanical Room',
    status: onHand === 0 ? 'Out of Stock' : onHand < min ? 'Low Stock' : 'In Stock',
  }
})

// ── requests ─────────────────────────────────────────────────────────────
// The hotel-specific one. In a plant a request comes from an operator; here it
// comes from the front desk relaying a guest, or from housekeeping finding
// something while turning a room — and the difference matters, because a guest
// is in the building waiting and a housekeeping note is not.
const REQUEST_SOURCE = [
  ...Array(5).fill('Front desk — guest'),
  ...Array(3).fill('Housekeeping'),
  ...Array(2).fill('Breakfast attendant'),
  'Night audit',
]
const REQUEST_TEXT = [
  'Guest reports the AC not cooling',
  'No hot water in the shower',
  'Dishwasher leaking onto the kitchen floor',
  'TV remote and outlet by the desk not working',
  'Toilet running continuously',
  'Fridge making a loud noise overnight',
  'Bathroom door will not latch',
  'Waffle iron tripping the outlet',
  'Corridor light flickering on the third floor',
  'Pool water cloudy this morning',
]

export const REQUESTS = Array.from({ length: 26 }, (_, i) => {
  const k = `req-${i}`
  const suite = pick(k + 's', SUITES)
  const status = pick(k + 'st', [
    ...Array(4).fill('Open'), ...Array(3).fill('Converted'), ...Array(2).fill('Closed'), 'Rejected',
  ])
  const src = pick(k + 'src', REQUEST_SOURCE)
  const guest = src.startsWith('Front desk')
  return {
    request_id: `req_${String(i + 1).padStart(3, '0')}`,
    request_number: `REQ-${900 + i}`,
    title: pick(k + 't', REQUEST_TEXT),
    source: src,
    // A guest is standing at the desk; housekeeping's note is not urgent in the
    // same way. Priority follows the source rather than being drawn separately.
    priority: guest ? pick(k + 'p', ['High', 'High', 'Critical', 'Medium']) : pick(k + 'p', ['Medium', 'Low', 'Low']),
    suite_number: seed(k + 'insuite') > 0.25 ? suite.suite_number : null,
    location_name: seed(k + 'insuite') > 0.25 ? `Floor ${suite.floor}` : pick(k + 'l', LOCATIONS).name,
    raised_by: src,
    raised_date: daysFrom(-between(k + 'd', 0, 18)),
    status,
    work_order_number: status === 'Converted' ? `WO-${4100 + between(k + 'w', 0, 75)}` : null,
  }
})

// ── inspections ──────────────────────────────────────────────────────────
// Not the suite PM — these are the whole-property inspections somebody outside
// the department signs: the brand's QA visit, the fire marshal, the pool permit.
export const INSPECTIONS = [
  { key: 'brand-qa', name: 'Marriott brand QA audit', body: 'Brand standards', every: 'Annual' },
  { key: 'fire-marshal', name: 'Fire marshal inspection', body: 'Dover Fire Marshal', every: 'Annual' },
  { key: 'pool-permit', name: 'Public pool permit inspection', body: 'Delaware Public Health', every: 'Annual' },
  { key: 'elevator', name: 'Elevator certificate', body: 'State elevator inspector', every: 'Annual' },
  { key: 'backflow', name: 'Backflow preventer test', body: 'Licensed tester', every: 'Annual' },
  { key: 'sprinkler', name: 'Sprinkler system inspection', body: 'Cintas Fire Protection', every: 'Quarterly' },
  { key: 'alarm', name: 'Fire alarm system test', body: 'Cintas Fire Protection', every: 'Quarterly' },
  { key: 'hood', name: 'Kitchen hood and duct cleaning', body: 'Contracted vendor', every: 'Semi-annual' },
].map((x, i) => {
  const k = `insp-${x.key}`
  const every = x.every === 'Quarterly' ? 91 : x.every === 'Semi-annual' ? 182 : 365
  const last = -between(k + 'l', 20, every - 20)
  const result = pick(k + 'r', [...Array(6).fill('Pass'), 'Pass with observations', 'Pass with observations', 'Fail'])
  return {
    inspection_id: `ins_${String(i + 1).padStart(3, '0')}`,
    ...x,
    frequency: x.every,
    last_date: daysFrom(last),
    next_date: daysFrom(last + every),
    result,
    findings: result === 'Pass' ? 0 : between(k + 'f', 1, 4),
    inspector: x.body,
  }
})

// ── incidents ────────────────────────────────────────────────────────────
export const INCIDENTS = Array.from({ length: 9 }, (_, i) => {
  const k = `inc-${i}`
  const kinds = [
    ['Guest slip in the pool area', 'Guest safety', 'Pool & Spa'],
    ['Water damage to the ceiling below Suite 214', 'Property damage', 'Guest Floors'],
    ['Smoke detector activation — burnt toast', 'Life safety', 'Guest Floors'],
    ['Refrigerant smell reported near the rooftop unit', 'Environmental', 'Public Areas & Fitness'],
    ['Employee strain lifting a laundry cart', 'Staff injury', 'Guest Laundry & Housekeeping'],
    ['Elevator stopped between floors with a guest inside', 'Guest safety', 'Public Areas & Fitness'],
  ]
  const [title, category, location] = pick(k + 'kind', kinds)
  const status = pick(k + 'st', [...Array(5).fill('Closed'), 'Under review', 'Open', 'Open'])
  const raised = -between(k + 'd', 3, 150)
  return {
    incident_id: `inc_${String(i + 1).padStart(3, '0')}`,
    incident_number: `INC-${300 + i}`,
    title,
    category,
    location_name: location,
    severity: pick(k + 'sev', ['Low', 'Medium', 'Medium', 'High']),
    status,
    reported_by: pick(k + 'by', TECHNICIANS).name,
    reported_date: daysFrom(raised),
    closed_date: status === 'Closed' ? daysFrom(raised + between(k + 'c', 2, 21)) : null,
    corrective_action: status === 'Closed' ? 'Recorded, corrected and signed off.' : 'Under investigation.',
  }
})

// ── teams ────────────────────────────────────────────────────────────────
// Four names, not four departments. At a 98-suite property the "team" is the
// Chief Engineer, a tech or two, and the people who raise the work.
export const TEAMS = [
  { team_id: 'tm_01', team_name: 'Engineering', lead_name: TECHNICIANS.find((t) => t.role === 'Supervisor')?.name || USER.name, members: 3, covers: 'Suites, plant, life safety' },
  { team_id: 'tm_02', team_name: 'Housekeeping', lead_name: 'Grace Holloway', members: 8, covers: 'Raises suite issues on turn' },
  { team_id: 'tm_03', team_name: 'Front office', lead_name: 'Sara Kovac', members: 5, covers: 'Relays guest requests' },
  { team_id: 'tm_04', team_name: 'Contracted', lead_name: 'Victor Lang', members: 4, covers: 'Elevator, fire, pool' },
]

// ── headline numbers ─────────────────────────────────────────────────────
const openWO = WORK_ORDERS.filter(isOpen)
const doneWO = WORK_ORDERS.filter((w) => w.status === 'Completed')

export const KPI = {
  assets_total: ASSETS.length,
  assets_operational: ASSETS.filter((a) => a.status === 'Operational').length,
  assets_maintenance: ASSETS.filter((a) => a.status === 'Under Maintenance').length,
  assets_down: ASSETS.filter((a) => a.status === 'Down').length,
  suites_total: SUITE_COUNT,
  suites_occupied: SUITES.filter((s) => s.occupied).length,
  suites_overdue: SUITES.filter((s) => s.state === 'Overdue').length,
  work_orders_total: WORK_ORDERS.length,
  work_orders_open: openWO.length,
  // Overdue is a subset of work still live — a cancelled job cannot be late.
  work_orders_overdue: openWO.filter((w) => isPast(w.due_date)).length,
  work_orders_completed: doneWO.length,
  work_orders_critical: openWO.filter((w) => w.priority === 'Critical').length,
  requests_open: REQUESTS.filter((r) => r.status === 'Open').length,
  pm_total: PM_SCHEDULES.length,
  pm_overdue: PM_SCHEDULES.filter((p) => isPast(p.next_due)).length,
  pm_compliance: Math.round((PM_SCHEDULES.filter((p) => !isPast(p.next_due)).length / PM_SCHEDULES.length) * 100),
  parts_total: PARTS.length,
  parts_low: PARTS.filter((p) => p.status === 'Low Stock').length,
  parts_out: PARTS.filter((p) => p.status === 'Out of Stock').length,
  inventory_value: Math.round(PARTS.reduce((n, p) => n + p.total_value, 0)),
  inspections_total: INSPECTIONS.length,
  inspections_due_90: INSPECTIONS.filter((i) => daysUntil(i.next_date) <= 90).length,
  open_incidents: INCIDENTS.filter((i) => i.status !== 'Closed').length,
  mttr_hours: Number((doneWO.reduce((n, w) => n + (w.actual_hours || 0), 0) / Math.max(1, doneWO.length)).toFixed(1)),
  maintenance_cost: WORK_ORDERS.reduce((n, w) => n + w.total_cost, 0),
  completion_rate: Math.round((doneWO.length / WORK_ORDERS.length) * 100),
}

// Twelve months of history, for the trend on Reports. Completion trails
// creation slightly, because a backlog that closes everything it opens in the
// same month is not a backlog anyone recognises.
export const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(EPOCH)
  d.setMonth(d.getMonth() - (11 - i))
  const raised = between(`m${i}r`, 48, 82)
  return {
    month: d.toLocaleString('en-GB', { month: 'short' }),
    raised,
    completed: Math.round(raised * (between(`m${i}c`, 84, 99) / 100)),
    cost: between(`m${i}$`, 3200, 9400),
  }
})
