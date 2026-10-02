// Operations, labour and money for the Oxmaint CMMS portal.
//
// Everything here hangs off the plant in data.js rather than standing beside
// it. A maintenance logbook that names work orders the Work Orders screen has
// never heard of, or a labour report whose hours do not add up to the hours on
// the jobs, is worse than no screen at all — it teaches an audience that the
// numbers in this product do not tie up. So the job records are drawn from the
// completed work orders, the labour hours are summed from those same jobs, and
// the monthly ledger is a split of the cost line the dashboard already shows.

import {
  WORK_ORDERS, PARTS, TECHNICIANS, VENDORS, SITES, TREND, USER, DOMAIN, SUPERVISOR_NAME, PLANNER_NAME,
  pick, between, daysFrom, isPast,
} from './data'

// ── maintenance logbook ──────────────────────────────────────────────────
// Only jobs whose completion date has actually passed. A handful of the seeded
// work orders are stamped a few days ahead, which nobody notices on a status
// column but is glaring on a logbook sorted newest-first: the top of the book
// would be work that has not happened yet.
const DONE_WORK = WORK_ORDERS.filter((w) => w.status === 'Completed' && isPast(w.completed_date))

const WORK_DONE = [
  'Isolated the machine, carried out the repair and ran it up on load before handing back to production',
  'Stripped the unit down, cleaned the mating faces and rebuilt it to the manufacturer torque figures',
  'Renewed the failed component and re-checked alignment with a dial gauge',
  'Drained, flushed and refilled to the correct level, then checked for leaks at working pressure',
  'Replaced the wearing parts, greased the bearings and left the guard secured',
  'Traced the fault to the control circuit, made the repair and proved the interlock before release',
  'Calibrated against the reference standard and recorded the as-left values',
  'Cleaned down, re-tensioned the drive and set the trip points back to the schedule figures',
]

const FINDINGS = [
  'Component worn past its service limit — normal duty wear, no further action',
  'Alignment out by 0.4 mm, corrected on the day',
  'Oil sample showed water ingress; breather to be renewed at the next service',
  'No fault found on test after the repair, left on watch for one week',
  'Guard fixings had worked loose and have been renewed',
  'Bearing housing showing early fretting — raised for a condition check in 30 days',
  'Moisture had tracked into the terminal box past a failed gland; resealed',
  'Nothing adverse noted, asset returned to service in full working order',
]

const LOG_ROWS = DONE_WORK.slice(0, 24).map((w, i) => {
  const k = `mlog-${i}`
  // Merged by name rather than listed twice: two draws can land on the same
  // part, and "V-Belt A-section x2" printed twice in the drawer reads as a bug
  // in the parts list rather than as two separate issues from stores.
  const used = new Map()
  for (let j = 0; j < between(k + 'pc', 0, 3); j++) {
    const p = pick(`${k}p${j}`, PARTS)
    used.set(p.part_name, (used.get(p.part_name) || 0) + between(`${k}q${j}`, 1, 4))
  }
  return {
    log_id: `mlg_${String(i + 1).padStart(4, '0')}`,
    work_order_number: w.work_order_number,
    asset_id: w.asset_id,
    asset_name: w.asset_name,
    site_id: w.site_id,
    technician_name: w.assigned_to_name,
    date: w.completed_date,
    hours: w.actual_hours,
    parts_used: [...used.entries()].map(([part_name, qty]) => ({ part_name, qty })),
    work_done: `${pick(k + 'wd', WORK_DONE)} on ${w.asset_name}.`,
    findings: `${pick(k + 'fd', FINDINGS)}.`,
  }
})

// Unsigned work is always the newest work. A supervisor who is a month behind
// on signatures is a finding in his own right, so the sign-off backlog is taken
// off the top of the list by date rather than sprinkled through it.
export const MAINT_LOG = [...LOG_ROWS]
  .sort((a, b) => new Date(b.date) - new Date(a.date))
  .map((r, i) => ({ ...r, status: i < 5 ? 'Awaiting sign-off' : 'Signed off' }))

// ── operator rounds ──────────────────────────────────────────────────────
const DEFAULT_ROUTE_PARAMS = [
  'Bearing temp DE', 'Bearing temp NDE', 'Discharge pressure', 'Suction pressure',
  'Motor current', 'Vibration H', 'Vibration V', 'Oil level',
  'Gland leak-off', 'Cooling water flow', 'Winding temperature', 'Differential pressure',
]

// A pack's own tags replace these — a ramp round reads a hydraulic level and a
// charger fault code, not a gland leak-off. It must also carry twelve, for the
// stride below.
const ROUTE_PARAMS = DOMAIN?.routeTags?.length === DEFAULT_ROUTE_PARAMS.length ? DOMAIN.routeTags : DEFAULT_ROUTE_PARAMS

// One walk of the parameter list per route, split into failed and warning
// afterwards. Two independent draws would eventually report the same tag as
// both failed and warning on the same card — a contradiction on the face of the
// screen, not a rounding quirk. Stride 5 is coprime with the twelve parameters,
// so the walk never repeats itself either.
const paramsFrom = (key, n) => {
  const start = between(key, 0, ROUTE_PARAMS.length - 1)
  return Array.from({ length: n }, (_, j) => ROUTE_PARAMS[(start + j * 5) % ROUTE_PARAMS.length])
}

const OPERATORS = TECHNICIANS.filter((t) => t.role === 'Technician')

// A round is a physical walk past named equipment on a named shift, so the
// name, shift, site and rhythm are written down; only the readings move.
const DEFAULT_ROUTE_BASE = [
  { name: 'Line 1 forming round', shift: 'Morning', site_id: 'site_01', last: -1, due: 0, done: 1, fail: 0, warn: 1 },
  { name: 'Compressor house round', shift: 'Morning', site_id: 'site_01', last: 0, due: 0, done: 0.62, fail: 2, warn: 2 },
  { name: 'Utilities night round', shift: 'Night', site_id: 'site_01', last: -1, due: 1, done: 0.86, fail: 1, warn: 3 },
  { name: 'Line 2 finishing round', shift: 'Afternoon', site_id: 'site_01', last: -2, due: -1, done: 0.34, fail: 3, warn: 1 },
  { name: 'Press shop round', shift: 'Morning', site_id: 'site_02', last: -1, due: 0, done: 1, fail: 0, warn: 0 },
  { name: 'Warehouse plant round', shift: 'Afternoon', site_id: 'site_03', last: -3, due: 2, done: 0, fail: 0, warn: 2 },
]

// A pack that walks its own rounds replaces the plant's. Same fields, so the
// rhythm — which route is done, which is late — is written by the pack too.
const ROUTE_BASE = DOMAIN?.routes?.length ? DOMAIN.routes : DEFAULT_ROUTE_BASE

export const LOG_ROUTES = ROUTE_BASE.map((r, i) => {
  const k = `route-${i}`
  const points = between(k + 'pt', 14, 38)
  const next_due = daysFrom(r.due)
  const completion_pct = Math.round(r.done * 100)
  const tags = paramsFrom(k + 'tag', r.fail + r.warn)
  return {
    route_id: `rte_${String(i + 1).padStart(3, '0')}`,
    route_name: r.name,
    shift: r.shift,
    points,
    assigned_to_name: pick(k + 'op', OPERATORS).name,
    // Folded onto a site the pack has. A round written against a third site
    // simply vanished from a single-site build's filter, name and all.
    site_id: (SITES.find((x) => x.site_id === r.site_id) || SITES[0]).site_id,
    last_run: daysFrom(r.last),
    next_due,
    completion_pct,
    failed_params: tags.slice(0, r.fail),
    warning_params: tags.slice(r.fail),
    // A finished round is finished even if the next one is already due — the
    // overdue test has to come second or a route that ran this morning would
    // be reported as missed this afternoon.
    status: completion_pct === 100 ? 'Completed'
      : isPast(next_due) ? 'Overdue'
        : completion_pct > 0 ? 'In Progress' : 'Scheduled',
  }
})

// ── labour ───────────────────────────────────────────────────────────────
const RATE_BAND = { Supervisor: [44, 54], Planner: [38, 46], Technician: [28, 39] }

// The site a technician is based at, taken from where their work actually is.
// TECHNICIANS carries no site because a person is not owned by a plant, but the
// site picker still has to be able to answer "who works here".
const homeSite = (rows) => {
  const tally = new Map()
  rows.forEach((w) => tally.set(w.site_id, (tally.get(w.site_id) || 0) + 1))
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || SITES[0].site_id
}

const LABOUR_ROWS = TECHNICIANS.filter((t) => t.role !== 'Administrator').map((t, i) => {
  const k = `lab-${i}`
  const mine = WORK_ORDERS.filter((w) => w.assigned_to_name === t.name && w.status === 'Completed')
  const hours = mine.reduce((n, w) => n + (w.actual_hours || 0), 0)
  const band = RATE_BAND[t.role] || RATE_BAND.Technician
  // A roster that carries its own rates is paid at them; the band is only
  // for a pack whose people arrive without one.
  const rate = t.hourly_rate ?? between(k + 'r', band[0], band[1])
  return {
    labour_id: `lbr_${String(i + 1).padStart(3, '0')}`,
    user_id: t.user_id,
    name: t.name,
    role: t.role,
    trade: t.trade,
    hourly_rate: rate,
    hours_logged: hours,
    jobs_completed: mine.length,
    cost: hours * rate,
    site_id: homeSite(mine),
  }
})

// Utilisation is expressed against the best-covered technician, not against the
// calendar. Booked hours only cover the jobs that reached the CMMS, so hours
// over wall-clock time comes out in single digits — arithmetically right, and
// useless as the headline of a labour report.
const PEAK_HOURS = Math.max(1, ...LABOUR_ROWS.map((r) => r.hours_logged))

export const LABOUR = LABOUR_ROWS.map((r, i) => ({
  ...r,
  utilisation: r.hours_logged
    ? Math.max(35, Math.min(99, Math.round(58 + (r.hours_logged / PEAK_HOURS) * 34) + between(`lab-${i}u`, -3, 3)))
    : 0,
}))

// ── outward gate passes ──────────────────────────────────────────────────
// The item and the reason are written down together, not drawn separately. A
// pass reading "Air Filter Element — motor rewind at the supplier works" is the
// kind of nonsense a seeded pick produces when the catalogue behind it carries
// only twelve part names, and it is the first line anyone reads on this screen.
const DEFAULT_GATE_BASE = [
  { type: 'Returnable', item: 'Motor 5.5kW 4-pole', reason: 'Motor rewind at the supplier works', issued: -38, back: -9, returned: false },
  { type: 'Returnable', item: 'Pressure Transmitter 0-16 bar', reason: 'Calibration at the manufacturer', issued: -31, back: -4, returned: false },
  { type: 'Returnable', item: 'Mechanical Seal 35mm', reason: 'Sent for refurbishment', issued: -26, back: -12, returned: true },
  { type: 'Non-returnable', item: 'Deep Groove Bearing 6205', reason: 'Returned to supplier — wrong item received', issued: -24, back: null, returned: false },
  { type: 'Returnable', item: 'Coupling Element', reason: 'Sub-contract machining to suit the new shaft', issued: -19, back: 4, returned: false },
  { type: 'Non-returnable', item: 'Hydraulic Oil ISO 46', reason: 'Waste oil collection — consignment note attached', issued: -17, back: null, returned: false },
  { type: 'Returnable', item: 'Contactor 40A', reason: 'Exchange unit sent out against a replacement', issued: -14, back: -2, returned: true },
  { type: 'Returnable', item: 'Proximity Sensor M18', reason: 'Warranty repair inside the guarantee period', issued: -11, back: 6, returned: false },
  { type: 'Non-returnable', item: 'Air Filter Element', reason: 'Scrap disposal — weighbridge ticket attached', issued: -9, back: null, returned: false },
  { type: 'Returnable', item: 'Deep Groove Bearing 6205', reason: 'Sent to the supplier for failure analysis', issued: -6, back: 12, returned: false },
  { type: 'Returnable', item: 'Motor 5.5kW 4-pole', reason: 'Motor rewind — line 2 drive', issued: -4, back: 18, returned: false },
  { type: 'Non-returnable', item: 'Gearbox Oil 220', reason: 'Oil sample sent for laboratory analysis', issued: -2, back: null, returned: false },
]

// A pack's passes replace these, named from its own parts master so each one
// resolves to a stock line. Its rows may say `bulk` outright, because a stock
// description like "AW-46 hydraulic oil (gal)" does not spell Oil the way the
// test below reads it.
const GATE_BASE = DOMAIN?.gatePasses?.length ? DOMAIN.gatePasses : DEFAULT_GATE_BASE

export const GATE_PASSES = GATE_BASE.map((g, i) => {
  const k = `gate-${i}`
  // Walked rather than found, because the same part name is stocked at all
  // three sites: taking the first match would file every pass against one site
  // and leave the site filter with nothing to do on this screen. The fallback
  // earns its keep — the stock names are drawn upstream, and a name that
  // stopped appearing there would throw at module load and take the whole
  // portal down with it rather than only this page.
  const stocked = PARTS.filter((p) => p.part_name === g.item)
  const item = stocked[i % stocked.length] || PARTS[i % PARTS.length]
  return {
    pass_id: `ogp_${String(i + 1).padStart(3, '0')}`,
    pass_number: `OGP-9${String(i + 1).padStart(2, '0')}`,
    type: g.type,
    item: g.item,
    // Assemblies leave in ones and twos, oil leaves by the litre. The band is
    // taken from the item name rather than from the part's stock unit, which is
    // drawn independently of the name upstream — a motor measured in metres is
    // harmless in a stores list and absurd on a gate pass.
    quantity: (g.bulk ?? g.item.includes('Oil')) ? between(k + 'q', 5, 25) : between(k + 'q', 1, 3),
    reason: g.reason,
    vendor_name: pick(k + 'v', VENDORS).vendor_name,
    // Signed by stores or by the supervisor, never by the technician carrying
    // the box out — that is the whole point of a gate pass.
    issued_by_name: pick(k + 'ib', [PLANNER_NAME, SUPERVISOR_NAME, USER.name]),
    issued_date: daysFrom(g.issued),
    expected_return: g.type === 'Returnable' ? daysFrom(g.back) : null,
    site_id: item.site_id,
    // A non-returnable pass has nothing to come back, so it closes as soon as
    // the security copy is signed in — a couple of days, not never.
    status: g.type === 'Non-returnable'
      ? (g.issued <= -3 ? 'Closed' : 'Out')
      : g.returned ? 'Returned' : 'Out',
  }
})

// ── partners ─────────────────────────────────────────────────────────────
const PARTNER_BASE = [
  { name: 'Halden Engineering Services', type: 'Contractor', contact_name: 'J. Carter', sla: '8 h call-out, on site within 24 h', status: 'Active' },
  { name: 'Marrick Rotating Equipment', type: 'Service Provider', contact_name: 'M. Wilson', sla: '5 working days for a rewind', status: 'Active' },
  { name: 'Vantage Parts', type: 'Supplier', contact_name: 'R. Fry', sla: 'Next business day on stock lines', status: 'On Hold' },
  { name: 'Ashgrove Foods', type: 'Client', contact_name: 'L. Osei', sla: '4 h response, 24 h fix', status: 'Active' },
  { name: 'Peakline Manufacturing', type: 'Client', contact_name: 'D. Hartley', sla: 'Next business day', status: 'Active' },
]

// A client is billed and a contractor is paid, but both land in the same column
// on a partner ledger, so the band is set by who they are rather than by which
// direction the invoice travels.
const SPEND_BAND = {
  Contractor: [42000, 96000],
  'Service Provider': [18000, 48000],
  Supplier: [9000, 26000],
  Client: [34000, 118000],
}

export const PARTNERS = PARTNER_BASE.map((p, i) => {
  const k = `ptn-${i}`
  const band = SPEND_BAND[p.type]
  return {
    partner_id: `ptn_${String(i + 1).padStart(3, '0')}`,
    name: p.name,
    type: p.type,
    contact_name: p.contact_name,
    email: `accounts@${p.name.split(' ')[0].toLowerCase()}.example`,
    jobs_open: between(k + 'jo', 0, 7),
    jobs_done: between(k + 'jd', 14, 96),
    spend: between(k + 'sp', band[0], band[1]),
    sla: p.sla,
    status: p.status,
  }
})

// ── the ledger ───────────────────────────────────────────────────────────
// Split from the cost line the dashboard already charts, so the two screens can
// never disagree: labour first because it is the largest line in almost every
// maintenance budget, then parts, and the contractor line takes the remainder
// rather than a third draw — three independent draws would not add up to the
// total they are meant to explain.
const LEDGER = TREND.map((t, i) => {
  const k = `fin-${i}`
  const labour = Math.round((t.cost * between(k + 'l', 50, 58)) / 100)
  const parts = Math.round((t.cost * between(k + 'p', 20, 28)) / 100)
  return { month: t.month, labour, parts, contractor: Math.max(0, t.cost - labour - parts), total: t.cost }
})

// One figure for the year, phased evenly. A budget that tracks the actuals month
// by month is a forecast, not a budget, and a variance column against it would
// always read zero.
const MONTHLY_BUDGET = Math.round((LEDGER.reduce((n, m) => n + m.total, 0) / LEDGER.length) * 1.04 / 100) * 100

export const FINANCIALS = LEDGER.map((m) => ({ ...m, budget: MONTHLY_BUDGET }))
