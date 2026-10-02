// Hospitality — extended-stay hotel engineering.
//
// Built around Residence Inn by Marriott Dover: 98 suites at 600 Jefferic Blvd,
// Dover DE, an extended-stay property where every suite carries a full kitchen.
// That is the fact that shapes this pack. A limited-service room has a PTAC, a
// bathroom and a television; a Residence Inn suite adds a refrigerator, a
// dishwasher, a microwave, a cooktop and a disposal on top of those, so the
// estate is roughly twice the size per room and the guest-room PM rotation is
// the department's largest standing commitment rather than a side task.
//
// WHERE THE DATA COMES FROM. Unlike the chiller pack, which was built from a
// solution overview prepared for a named customer, there is no client workbook
// behind this one. The property facts — 98 suites, in-suite kitchens, pool and
// spa, fitness centre, guest laundry, breakfast service — are public. Everything
// below those is *modelled*: the asset mix from what an extended-stay property
// of this size runs, the PM tasks and intervals from industry-standard hotel
// maintenance practice. It is a faithful model of the property, not a copy of
// its records, and nothing here should be quoted back to the customer as their
// own figures.
//
// The people are deliberately the same eight names the other packs use. They are
// referenced by name in data.js and dataMaint.js — team leads, checklist
// assignees, approvers, planners — so a pack that renamed them would leave those
// references pointing at nobody. A pack changes the plant, not the roster; only
// the trades below are hotel trades.

export default {
  key: 'hospitality',
  label: 'Hospitality — extended-stay hotel engineering',

  org: {
    organization_name: 'Residence Inn Dover',
    organization_code: 'RID',
    industry: 'Hospitality — extended stay',
    address: '600 Jefferic Blvd',
    city: 'Dover',
    country: 'United States',
    timezone: 'America/New_York',
    currency: 'USD',
    currency_symbol: '$',
  },

  user: {
    name: 'Renee Baker',
    email: 'renee.baker@residenceinndover.example',
    mobile: '+1 302 555 0118',
    role_name: 'Chief Engineer',
    initials: 'RB',
  },

  // Only the first is the real property. The other two stand in for the sister
  // hotels a management company would run alongside it — they exist because the
  // portal's teams and site filters expect more than one site, and because the
  // multi-property rollup is worth showing. They are placeholders, not claims
  // about specific hotels.
  sites: [
    { site_id: 'site_01', site_name: 'Residence Inn Dover', code: 'DOV', city: 'Dover', country: 'United States', is_default: true },
    { site_id: 'site_02', site_name: 'Newark Extended Stay', code: 'NWK', city: 'Newark', country: 'United States', is_default: false },
    { site_id: 'site_03', site_name: 'Salisbury Select Service', code: 'SBY', city: 'Salisbury', country: 'United States', is_default: false },
  ],

  // A hotel's functional locations are floors and back-of-house plant, not
  // production lines. The three guest floors carry 33 / 33 / 32 suites — the 98
  // the property actually has.
  locations: [
    { functional_location_id: 'loc_01', name: 'Guest Floors', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_02', name: 'Floor 1 — Suites 101–133', site_id: 'site_01', parent_id: 'loc_01', level: 2 },
    { functional_location_id: 'loc_03', name: 'Floor 2 — Suites 201–233', site_id: 'site_01', parent_id: 'loc_01', level: 2 },
    { functional_location_id: 'loc_04', name: 'Floor 3 — Suites 301–332', site_id: 'site_01', parent_id: 'loc_01', level: 2 },
    { functional_location_id: 'loc_05', name: 'Pool & Spa', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_06', name: 'Mechanical Room', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_07', name: 'Breakfast & Kitchen', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_08', name: 'Guest Laundry & Housekeeping', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_09', name: 'Public Areas & Fitness', site_id: 'site_02', parent_id: null, level: 1 },
    { functional_location_id: 'loc_10', name: 'Exterior & Grounds', site_id: 'site_03', parent_id: null, level: 1 },
  ],

  // Larger than the other packs' 126 because a hotel counts its estate by the
  // room. Ninety-eight suites of PTACs and kitchen appliances plus the plant
  // behind them is what puts this above a factory of comparable floor area.
  assetCount: 168,
  assetKinds: [
    'PTAC Unit', 'Guest Refrigerator', 'Dishwasher', 'Microwave', 'Cooktop',
    'Garbage Disposal', 'Water Heater', 'Bathroom Exhaust Fan',
    'Pool Pump', 'Pool Heater', 'Commercial Washer', 'Commercial Dryer',
    'Fire Alarm Panel', 'Elevator', 'Rooftop Unit', 'Ice Machine',
  ],
  makers: ['Amana', 'GE Appliances', 'Whirlpool', 'Rheem', 'Pentair', 'Speed Queen'],

  workOrderCount: 84,
  // Written the way a hotel engineer raises them — the suite number first,
  // because that is how the front desk reports it and how the tech walks it.
  tasks: [
    'PTAC filter clogged — clean filter and check coil',
    'Dishwasher not draining — clear pump and check drain hose',
    'Refrigerator icing over — inspect door gasket and defrost cycle',
    'No hot water at shower — check mixing valve and cartridge',
    'Garbage disposal jammed — clear and reset',
    'Quarterly suite PM — full 18-point checklist',
    'Pool chlorine below range — adjust feeder and re-test',
    'Bathroom exhaust fan noisy — replace motor',
    'Corridor lighting out — replace lamp and check driver',
    'Laundry washer drum bearing noise — inspect and schedule repair',
    'Monthly fire extinguisher inspection — floor sweep',
    'Elevator door sensor intermittent — call service vendor',
  ],

  partCount: 48,
  partNames: [
    'PTAC Filter 15x20', 'Refrigerator Door Gasket', 'Dishwasher Drain Pump',
    'Disposal Splash Guard', 'Shower Cartridge', 'Toilet Fill Valve',
    'Pool Chlorine Tablets 3in', 'Pool Filter Cartridge', 'LED Lamp A19 2700K',
    'Bathroom Exhaust Fan Motor', 'Washer Drive Belt', 'Water Heater Element 4500W',
  ],

  // The same eight people as the other packs, with hotel trades. Marcus Bell
  // stays a Supervisor and Grace Holloway a Planner because data.js and
  // dataMaint.js name them in those roles — as the approver above the authority
  // limit, and as the planner who raises requests and owns shutdowns.
  technicians: [
    { user_id: 'usr_t01', name: 'Daniel Reeve', role: 'Technician', trade: 'HVAC' },
    { user_id: 'usr_t02', name: 'Tom Whelan', role: 'Technician', trade: 'Electrical' },
    { user_id: 'usr_t03', name: 'Sara Kovac', role: 'Technician', trade: 'Plumbing' },
    { user_id: 'usr_t04', name: 'Marcus Bell', role: 'Supervisor', trade: 'Engineering' },
    { user_id: 'usr_t05', name: 'Ellie Brandt', role: 'Technician', trade: 'Appliance' },
    { user_id: 'usr_t06', name: 'Owen Marsh', role: 'Technician', trade: 'General Maintenance' },
    { user_id: 'usr_t07', name: 'Grace Holloway', role: 'Planner', trade: 'Planning' },
    { user_id: 'usr_t08', name: 'Victor Lang', role: 'Technician', trade: 'Pool & Life Safety' },
  ],

  // Eight exactly — VENDORS in data.js indexes this list by position.
  vendorNames: [
    'Ferguson HVAC Supply', 'Grainger', 'HD Supply Facilities', 'Otis Elevator Service',
    'Pentair Pool Service', 'Cintas Fire Protection', 'Speed Queen Commercial', 'Sysco Equipment Service',
  ],

  // The property's shape, read by the Hospitality portal.
  //
  // Deliberately carries no `sections`, which is what would put a module in the
  // CMMS portal's menu. The hotel demo is its own portal at /portal/hospitality
  // rather than a module inside this one, so that both can be open in the same
  // build and the console swaps between them with a click instead of a rebuild.
  // This block is the data that portal is generated from; nothing here renders
  // in the CMMS portal.
  domain: {
    key: 'hospitality',
    label: 'Daily Schedule',
    subtitle: 'One shift, planned from the rotation and the backlog',

    // 98 suites over three floors — the count the property actually has.
    floors: [
      { floor: 1, from: 101, to: 133 },
      { floor: 2, from: 201, to: 233 },
      { floor: 3, from: 301, to: 332 },
    ],

    // Residence Inn sells studios mostly, with one- and two-bedrooms above them.
    // Weighted by repetition so the mix comes out of the same seeded pick as
    // everything else.
    suiteTypes: [
      ...Array(6).fill('Studio'), ...Array(3).fill('One-Bedroom'), 'Two-Bedroom',
    ],

    // The rotation. Quarterly is the interval a select-service brand standard
    // asks for, and 91 days over 98 suites is what sets the daily number: about
    // one and a half suites a day, which is two on a working day.
    cycleDays: 91,
    shiftMinutes: 480,

    // A suite PM, and what it covers. Eighteen checkpoints rather than a hotel's
    // usual nine or ten because every suite here has a full kitchen — that is
    // the whole reason this property's rotation is heavier than its room count
    // suggests.
    suitePm: {
      minutes: 45,
      checklist: [
        { group: 'Kitchen', item: 'Refrigerator — door seal, coil, temperature at 3°C' },
        { group: 'Kitchen', item: 'Dishwasher — drain, spray arms, no standing water' },
        { group: 'Kitchen', item: 'Microwave — door catch, turntable, interior' },
        { group: 'Kitchen', item: 'Cooktop — burners, controls, indicator lamps' },
        { group: 'Kitchen', item: 'Garbage disposal — run, reset, splash guard' },
        { group: 'Kitchen', item: 'Sink — faucet, aerator, drain, trap for leaks' },
        { group: 'HVAC', item: 'PTAC — clean or replace filter' },
        { group: 'HVAC', item: 'PTAC — coil condition and condensate drain' },
        { group: 'HVAC', item: 'Thermostat — reads and holds setpoint' },
        { group: 'Bathroom', item: 'Exhaust fan — pulls, no bearing noise' },
        { group: 'Bathroom', item: 'Toilet — fill valve, flapper, no running' },
        { group: 'Bathroom', item: 'Shower — cartridge, pressure, diverter' },
        { group: 'Bathroom', item: 'Caulk and grout — no gaps at tub or base' },
        { group: 'Safety', item: 'Smoke detector — test button and battery' },
        { group: 'Safety', item: 'GFCI outlets — trip and reset' },
        { group: 'Safety', item: 'Lamps and outlets — all working, none loose' },
        { group: 'Fixtures', item: 'Entry door — lock, closer, latch alignment' },
        { group: 'Fixtures', item: 'Window and blinds — seal, operation, hardware' },
      ],
    },

    // The work that repeats regardless of which suites come up. `compliance`
    // marks the ones an inspector, an insurer or a brand audit will ask to see
    // the log for — those are the entries that must not be dropped when a shift
    // runs short.
    rounds: [
      { key: 'pool', label: 'Pool & spa chemistry — pH and chlorine', every: 'day', minutes: 10, compliance: 'Delaware public pool log', location: 'Pool & Spa' },
      { key: 'mech', label: 'Mechanical room walk — water heaters, pumps, leaks', every: 'day', minutes: 15, location: 'Mechanical Room' },
      { key: 'breakfast', label: 'Breakfast equipment — waffle irons, warmers, coffee', every: 'day', minutes: 10, location: 'Breakfast & Kitchen' },
      { key: 'laundry', label: 'Laundry — lint traps, drains, dryer vents', every: 'day', minutes: 8, location: 'Guest Laundry & Housekeeping' },
      { key: 'corridors', label: 'Corridor and stairwell sweep — lighting, doors, signage', every: 'week', minutes: 25, location: 'Public Areas & Fitness' },
      { key: 'fitness', label: 'Fitness equipment — belts, bolts, emergency stops', every: 'week', minutes: 20, location: 'Public Areas & Fitness' },
      { key: 'extinguishers', label: 'Fire extinguisher floor sweep — gauge, pin, tag', every: 'month', minutes: 20, compliance: 'NFPA 10 monthly inspection', location: 'Guest Floors' },
      { key: 'emergency-lights', label: 'Emergency lighting and exit signs — 30-second test', every: 'month', minutes: 25, compliance: 'Life safety', location: 'Guest Floors' },
    ],
  },
}
