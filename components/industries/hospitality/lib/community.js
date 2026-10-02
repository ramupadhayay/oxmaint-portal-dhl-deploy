'use client'

// Community associations — the HOA and condo side of property maintenance.
//
// This is a second estate inside the same portal, and it says so on every
// screen it owns. The hotel's suites, rotation and guest requests have nothing
// to do with a condo board, so nothing here reads from them and nothing there
// reads from here — the two sit beside each other rather than merging.
//
// What is modelled comes from Oxmaint's own HOA article and its three named
// modules: common area tracking, reserve planning, and PM scheduling with
// vendor management. The nine component types below, their PM frequencies and
// their useful lives are that article's own reference table, not invented
// intervals — a board reading this against the page they arrived from should
// find the same numbers.
//
// The community is Harbour Point: three buildings, 118 units. Sized so the
// reserve position is believable — big enough to carry elevators and three roof
// sections, small enough that one roof replacement moves the forecast visibly,
// which is the thing a board has never been able to see.

// ── the association ───────────────────────────────────────────────────────
export const COMMUNITY = {
  name: 'Harbour Point Condominium Association',
  short: 'Harbour Point',
  buildings: 3,
  units: 118,
  managedBy: 'Coastline Community Management',
  manager: 'T. Ashford',
  managerRole: 'Community Manager',
  boardChair: 'R. Delgado',
  fiscalYearEnd: '31 December',
  // What a board actually has in the bank, and what it collects.
  reserveBalance: 412_000,
  annualReserveContribution: 96_000,
  annualAssessmentIncome: 1_062_000,
  // The article's own framing, carried rather than softened.
  note: 'Reserve figures here follow the straight-line component method. A study '
    + 'from a licensed reserve specialist takes precedence over anything computed on this screen.',
}

// ── the component types, from the article's reference table ───────────────
//
// Frequency, tasks, useful life and reserve priority are that table verbatim.
// Nothing here is a guess about how often a pool is serviced.
export const COMPONENT_TYPES = {
  pool: {
    label: 'Pool & Spa Equipment',
    pm: 'Weekly chemistry / Annual equipment',
    tasks: 'Water chemistry, filter cleaning, heater service, pump inspection',
    life: '10–15 years (heater 8–12)',
    priority: 'High',
  },
  elevator: {
    label: 'Elevator Systems',
    pm: 'Monthly log / Annual inspection',
    tasks: 'Monthly performance log, annual state inspection, 5-year modernisation review',
    life: '20–25 years',
    priority: 'High',
  },
  roof: {
    label: 'Roofing Systems',
    pm: 'Annual inspection / Post-storm',
    tasks: 'Flashings, penetrations, drainage, caulk condition, damage documentation',
    life: '15–30 years (by type)',
    priority: 'High',
  },
  asphalt: {
    label: 'Asphalt Parking & Roads',
    pm: 'Annual inspection / 3-year seal coat',
    tasks: 'Crack mapping, seal coat, striping, drainage review, pothole repair',
    life: '25–30 years (repave)',
    priority: 'Medium',
  },
  landscape: {
    label: 'Landscaping & Irrigation',
    pm: 'Weekly / Seasonal',
    tasks: 'Mow, trim, fertilise, irrigation zone testing, winterisation, backflow prevention',
    life: 'Ongoing / Irrigation heads 7–10 yrs',
    priority: 'Medium',
  },
  hvac: {
    label: 'Common Area HVAC',
    pm: 'Semi-annual PM',
    tasks: 'Filter replacement, coil cleaning, belt inspection, refrigerant check, controls',
    life: '15–20 years',
    priority: 'High',
  },
  paint: {
    label: 'Exterior Paint / Stucco',
    pm: 'Annual inspection / 5–7 year repaint',
    tasks: 'Crack inspection, caulk condition, moisture intrusion indicators, colour fading',
    life: '5–8 years (paint cycle)',
    priority: 'Medium',
  },
  fire: {
    label: 'Fire & Life Safety Systems',
    pm: 'Quarterly / Annual (code)',
    tasks: 'Sprinkler inspection, alarm panel test, extinguisher inspection, exit lighting',
    life: '15–25 years',
    priority: 'High',
  },
  gates: {
    label: 'Entry Gates & Access Control',
    pm: 'Monthly check / Annual service',
    tasks: 'Gate mechanism, motor condition, access reader, safety loop sensors, intercom',
    life: '10–15 years',
    priority: 'Low–Med',
  },
}

// ── the register ──────────────────────────────────────────────────────────
//
// `installed` and `life` drive everything on the reserve screen: age, remaining
// useful life, and the year the replacement lands. `condition` is what an
// inspector scored it at, 1 to 5, and it is deliberately not derived from age —
// a well-maintained twelve-year-old roof and a neglected eight-year-old one are
// the distinction the whole condition-scoring idea exists to make.
const C = (id, type, name, where, installed, life, cost, condition, lastService, extra = {}) => ({
  componentId: id,
  type,
  name,
  location: where,
  installed,
  usefulLife: life,
  replacementCost: cost,
  condition,
  lastService,
  ...extra,
})

export const COMPONENTS = [
  // ── Building A ──────────────────────────────────────────────────────────
  C('CA-1001', 'roof', 'Roof section — Building A', 'Building A', 2006, 25, 268_000, 2, '2026-04-14',
    { note: 'Drone survey flagged flashing separation at two penetrations. Documented, not yet repaired.' }),
  C('CA-1002', 'elevator', 'Passenger elevator — Building A', 'Building A', 2004, 25, 185_000, 2, '2026-08-03',
    { note: 'Modernisation review due. Controller is original and parts are on extended lead time.' }),
  C('CA-1003', 'hvac', 'Corridor HVAC — Building A', 'Building A', 2012, 18, 62_000, 3, '2026-06-20'),
  C('CA-1004', 'fire', 'Sprinkler & alarm — Building A', 'Building A', 2006, 22, 140_000, 4, '2026-07-01'),
  C('CA-1005', 'paint', 'Exterior paint — Building A', 'Building A', 2020, 7, 88_000, 3, '2020-05-10'),

  // ── Building B ──────────────────────────────────────────────────────────
  C('CA-1006', 'roof', 'Roof section — Building B', 'Building B', 2011, 25, 244_000, 3, '2026-04-14'),
  C('CA-1007', 'elevator', 'Passenger elevator — Building B', 'Building B', 2011, 25, 185_000, 4, '2026-08-03'),
  C('CA-1008', 'hvac', 'Corridor HVAC — Building B', 'Building B', 2014, 18, 62_000, 4, '2026-06-20'),
  C('CA-1009', 'fire', 'Sprinkler & alarm — Building B', 'Building B', 2011, 22, 140_000, 4, '2026-07-01'),
  C('CA-1010', 'paint', 'Exterior paint — Building B', 'Building B', 2021, 7, 84_000, 4, '2021-06-02'),

  // ── Building C ──────────────────────────────────────────────────────────
  C('CA-1011', 'roof', 'Roof section — Building C', 'Building C', 2015, 25, 216_000, 4, '2026-04-14'),
  C('CA-1012', 'hvac', 'Corridor HVAC — Building C', 'Building C', 2015, 18, 58_000, 4, '2026-06-20'),
  C('CA-1013', 'fire', 'Sprinkler & alarm — Building C', 'Building C', 2015, 22, 132_000, 5, '2026-07-01'),
  C('CA-1014', 'paint', 'Exterior paint — Building C', 'Building C', 2022, 7, 80_000, 4, '2022-04-18'),

  // ── amenities ───────────────────────────────────────────────────────────
  C('CA-1015', 'pool', 'Pool heater', 'Pool deck', 2016, 10, 24_000, 2, '2026-08-12',
    { note: 'Second season of intermittent lockouts. Service call each time; no root cause recorded.' }),
  C('CA-1016', 'pool', 'Pool pump & filtration', 'Pool deck', 2018, 13, 31_000, 3, '2026-08-12'),
  C('CA-1017', 'pool', 'Spa equipment', 'Pool deck', 2018, 12, 19_000, 3, '2026-08-12'),
  C('CA-1018', 'pool', 'Pool deck & coping', 'Pool deck', 2010, 20, 46_000, 3, '2025-05-02'),
  C('CA-1019', 'hvac', 'Clubhouse HVAC', 'Clubhouse', 2013, 18, 38_000, 3, '2026-06-20'),
  C('CA-1020', 'fire', 'Clubhouse alarm & extinguishers', 'Clubhouse', 2013, 22, 26_000, 4, '2026-07-01'),
  C('CA-1021', 'paint', 'Clubhouse exterior', 'Clubhouse', 2021, 7, 34_000, 4, '2021-06-20'),
  C('CA-1022', 'roof', 'Clubhouse roof', 'Clubhouse', 2013, 22, 74_000, 3, '2026-04-14'),

  // ── grounds ─────────────────────────────────────────────────────────────
  C('CA-1023', 'asphalt', 'Parking lot — north', 'Grounds', 2009, 28, 214_000, 2, '2024-09-11',
    { note: 'Seal coat deferred two cycles. Crack mapping shows spread since the last survey.' }),
  C('CA-1024', 'asphalt', 'Parking lot — south', 'Grounds', 2016, 28, 168_000, 4, '2024-09-11'),
  C('CA-1025', 'asphalt', 'Internal roadway', 'Grounds', 2009, 28, 132_000, 3, '2024-09-11'),
  C('CA-1026', 'landscape', 'Irrigation controller & mainline', 'Grounds', 2017, 15, 42_000, 3, '2026-07-22'),
  C('CA-1027', 'landscape', 'Irrigation heads — zones 1-8', 'Grounds', 2019, 9, 18_000, 3, '2026-07-22'),
  C('CA-1028', 'landscape', 'Irrigation heads — zones 9-14', 'Grounds', 2019, 9, 14_000, 3, '2026-07-22'),
  C('CA-1029', 'landscape', 'Backflow prevention assembly', 'Grounds', 2017, 15, 9_000, 4, '2026-03-30'),
  C('CA-1030', 'gates', 'Entry gate — main', 'Grounds', 2017, 13, 38_000, 3, '2026-08-05'),
  C('CA-1031', 'gates', 'Entry gate — service', 'Grounds', 2017, 13, 29_000, 2, '2026-08-05',
    { note: 'Safety loop intermittent. Gate has closed on a vehicle once; logged as an incident.' }),
  C('CA-1032', 'gates', 'Access control & intercom', 'Grounds', 2019, 12, 26_000, 4, '2026-08-05'),
  C('CA-1033', 'landscape', 'Perimeter fencing', 'Grounds', 2012, 20, 88_000, 3, '2025-10-08'),
  C('CA-1034', 'landscape', 'Exterior & pathway lighting', 'Grounds', 2018, 15, 52_000, 4, '2026-05-19'),
]

// ── vendors ───────────────────────────────────────────────────────────────
//
// The article's vendor-management case is about three things a board cannot
// currently see: what was approved, what was invoiced, and whether the
// contractor is any good. So each carries a contract value, a certificate of
// insurance expiry — the thing that quietly lapses — and a performance score
// from completed work rather than an opinion.
export const VENDORS = [
  {
    vendorId: 'V-201', name: 'Greenline Grounds', trade: 'Landscaping & irrigation',
    contract: 'Annual, auto-renewing', contractValue: 78_000, coiExpires: '2026-11-30',
    since: 2019, jobs: 46, onTime: 41, disputes: 1, rating: 3.6,
    note: 'Auto-renews on 1 January. Scope has not been reviewed since 2021.',
  },
  {
    vendorId: 'V-202', name: 'Tideline Pool Service', trade: 'Pool & spa',
    contract: 'Seasonal', contractValue: 26_400, coiExpires: '2026-09-14',
    since: 2021, jobs: 38, onTime: 36, disputes: 0, rating: 4.4,
    note: 'Certificate of insurance expires in under a month.',
  },
  {
    vendorId: 'V-203', name: 'Meridian Elevator', trade: 'Elevator service',
    contract: 'Annual maintenance agreement', contractValue: 31_200, coiExpires: '2027-02-28',
    since: 2015, jobs: 29, onTime: 24, disputes: 2, rating: 3.1,
    note: 'Two invoices in the last year had no matching work order.',
  },
  {
    vendorId: 'V-204', name: 'Sentinel Fire & Safety', trade: 'Fire & life safety',
    contract: 'Code-cycle inspection', contractValue: 18_900, coiExpires: '2027-05-31',
    since: 2016, jobs: 24, onTime: 24, disputes: 0, rating: 4.8,
  },
  {
    vendorId: 'V-205', name: 'Harbour Roofing Co.', trade: 'Roofing',
    contract: 'Time and materials', contractValue: 0, coiExpires: '2026-12-31',
    since: 2018, jobs: 11, onTime: 9, disputes: 0, rating: 4.2,
  },
  {
    vendorId: 'V-206', name: 'Coastal Asphalt', trade: 'Asphalt & paving',
    contract: 'Per project', contractValue: 0, coiExpires: '2026-08-31',
    since: 2017, jobs: 6, onTime: 5, disputes: 1, rating: 3.4,
    note: 'Certificate of insurance expires this month. No work should be scheduled until it is renewed.',
  },
  {
    vendorId: 'V-207', name: 'Anchor Mechanical', trade: 'HVAC',
    contract: 'Semi-annual PM', contractValue: 22_800, coiExpires: '2027-01-31',
    since: 2020, jobs: 31, onTime: 29, disputes: 0, rating: 4.5,
  },
]

// ── inspections and their findings ────────────────────────────────────────
//
// The article's sharpest line is about a finding sitting in a board member's
// email because there was no system to track it to resolution. So a finding
// here is a record with a state, and the ones still open are counted.
export const INSPECTIONS = [
  {
    inspectionId: 'IN-501', componentId: 'CA-1001', type: 'Annual roof survey',
    by: 'Harbour Roofing Co.', daysAgo: 133,
    finding: 'Flashing separation at two roof penetrations, north elevation. Minor water staining in the ceiling below.',
    severity: 'High', status: 'Open',
  },
  {
    inspectionId: 'IN-502', componentId: 'CA-1023', type: 'Pavement condition survey',
    by: 'Coastal Asphalt', daysAgo: 348,
    finding: 'Alligator cracking across 18% of the north lot. Seal coat overdue by two cycles; full repave becomes likely within four years if deferred again.',
    severity: 'High', status: 'Open',
  },
  {
    inspectionId: 'IN-503', componentId: 'CA-1002', type: 'Annual state elevator inspection',
    by: 'State inspector', daysAgo: 22,
    finding: 'Passed. Inspector noted controller obsolescence and recommended a modernisation study before the next cycle.',
    severity: 'Medium', status: 'Open',
  },
  {
    inspectionId: 'IN-504', componentId: 'CA-1031', type: 'Gate safety check',
    by: 'In-house', daysAgo: 41,
    finding: 'Safety loop intermittent on the service gate. Gate closed on a vehicle on 12 July; no injury, incident logged.',
    severity: 'High', status: 'In progress',
  },
  {
    inspectionId: 'IN-505', componentId: 'CA-1015', type: 'Pool equipment service',
    by: 'Tideline Pool Service', daysAgo: 13,
    finding: 'Heater locking out intermittently. Reset and returned to service. Third call this season.',
    severity: 'Medium', status: 'Open',
  },
  {
    inspectionId: 'IN-506', componentId: 'CA-1004', type: 'Quarterly sprinkler inspection',
    by: 'Sentinel Fire & Safety', daysAgo: 55,
    finding: 'Passed. All devices tested, exit lighting confirmed.',
    severity: 'Low', status: 'Closed',
  },
  {
    inspectionId: 'IN-507', componentId: 'CA-1026', type: 'Backflow certification',
    by: 'Greenline Grounds', daysAgo: 148,
    finding: 'Assembly passed and certified. Certificate filed with the county.',
    severity: 'Low', status: 'Closed',
  },
  {
    inspectionId: 'IN-508', componentId: 'CA-1006', type: 'Annual roof survey',
    by: 'Harbour Roofing Co.', daysAgo: 133,
    finding: 'Serviceable. Two loose ridge caps re-secured during the visit.',
    severity: 'Low', status: 'Closed',
  },
]

// ── the seasonal PM plan ──────────────────────────────────────────────────
//
// Frequencies are the article's. What is added is the season each falls in,
// because HOA maintenance is cyclical and "before the freeze-thaw" is the
// actual constraint on a parking lot seal coat, not a date.
export const PM_PLAN = [
  { planId: 'PM-301', type: 'pool', title: 'Pool chemistry check', every: 'Weekly', season: 'Season (Apr–Oct)', vendor: 'V-202', components: ['CA-1015', 'CA-1016', 'CA-1017'] },
  { planId: 'PM-302', type: 'pool', title: 'Pool opening', every: 'Annual', season: 'Spring', vendor: 'V-202', components: ['CA-1015', 'CA-1016', 'CA-1017', 'CA-1018'] },
  { planId: 'PM-303', type: 'pool', title: 'Pool closing & winterisation', every: 'Annual', season: 'Autumn', vendor: 'V-202', components: ['CA-1015', 'CA-1016', 'CA-1017'] },
  { planId: 'PM-304', type: 'elevator', title: 'Monthly elevator performance log', every: 'Monthly', season: 'All year', vendor: 'V-203', components: ['CA-1002', 'CA-1007'] },
  { planId: 'PM-305', type: 'elevator', title: 'Annual state elevator inspection', every: 'Annual', season: 'Summer', vendor: 'V-203', components: ['CA-1002', 'CA-1007'] },
  { planId: 'PM-306', type: 'roof', title: 'Annual roof and flashing survey', every: 'Annual', season: 'Spring', vendor: 'V-205', components: ['CA-1001', 'CA-1006', 'CA-1011', 'CA-1022'] },
  { planId: 'PM-307', type: 'roof', title: 'Post-storm roof check', every: 'Event-driven', season: 'Storm season', vendor: 'V-205', components: ['CA-1001', 'CA-1006', 'CA-1011', 'CA-1022'] },
  { planId: 'PM-308', type: 'asphalt', title: 'Pavement condition survey', every: 'Annual', season: 'Autumn', vendor: 'V-206', components: ['CA-1023', 'CA-1024', 'CA-1025'] },
  { planId: 'PM-309', type: 'asphalt', title: 'Crack seal before freeze-thaw', every: '3-yearly', season: 'Autumn', vendor: 'V-206', components: ['CA-1023', 'CA-1024', 'CA-1025'] },
  { planId: 'PM-310', type: 'landscape', title: 'Grounds maintenance round', every: 'Weekly', season: 'Mar–Nov', vendor: 'V-201', components: ['CA-1033', 'CA-1034'] },
  { planId: 'PM-311', type: 'landscape', title: 'Irrigation zone test', every: 'Seasonal', season: 'Spring', vendor: 'V-201', components: ['CA-1026', 'CA-1027', 'CA-1028'] },
  { planId: 'PM-312', type: 'landscape', title: 'Irrigation winterisation', every: 'Annual', season: 'Autumn', vendor: 'V-201', components: ['CA-1026', 'CA-1027', 'CA-1028'] },
  { planId: 'PM-313', type: 'landscape', title: 'Backflow prevention certification', every: 'Annual', season: 'Spring', vendor: 'V-201', components: ['CA-1029'] },
  { planId: 'PM-314', type: 'landscape', title: 'Tree trimming before wind season', every: 'Annual', season: 'Autumn', vendor: 'V-201', components: ['CA-1033'] },
  { planId: 'PM-315', type: 'hvac', title: 'Common HVAC semi-annual PM', every: 'Semi-annual', season: 'Spring & Autumn', vendor: 'V-207', components: ['CA-1003', 'CA-1008', 'CA-1012', 'CA-1019'] },
  { planId: 'PM-316', type: 'paint', title: 'Exterior paint and caulk inspection', every: 'Annual', season: 'Spring', vendor: null, components: ['CA-1005', 'CA-1010', 'CA-1014', 'CA-1021'] },
  { planId: 'PM-317', type: 'fire', title: 'Quarterly sprinkler and alarm inspection', every: 'Quarterly', season: 'All year', vendor: 'V-204', components: ['CA-1004', 'CA-1009', 'CA-1013', 'CA-1020'] },
  { planId: 'PM-318', type: 'fire', title: 'Annual extinguisher and exit lighting', every: 'Annual', season: 'Winter', vendor: 'V-204', components: ['CA-1004', 'CA-1009', 'CA-1013', 'CA-1020'] },
  { planId: 'PM-319', type: 'gates', title: 'Gate mechanism and safety loop check', every: 'Monthly', season: 'All year', vendor: null, components: ['CA-1030', 'CA-1031'] },
  { planId: 'PM-320', type: 'gates', title: 'Access control and intercom service', every: 'Annual', season: 'Winter', vendor: null, components: ['CA-1032'] },
]
