// DHL Express — Ground Support Equipment maintenance.
//
// THE DATA IS A DATASET NOW, NOT A GENERATOR. The assets, people, work orders,
// parts, purchase orders, PM schedules, manuals and twelve-month trend come from
// data-source/DHL_CVG_GSE_5Year_CMMS_Demo.xlsx — a five-year CVG extract built to
// exercise the Oxmaint GSE notes sheet — imported by `npm run import:dhl` into
// ./dhl-gse-data. Its own cover says it is synthetic but operationally patterned
// and not DHL actuals, and that is how it must be described. The lists further
// down (asset kinds, makers, tasks, names) are what the generators would use; with
// the dataset loaded they are only a fallback.
//
// Built for the GSE Maintenance department's 2027 CMMS evaluation. Their
// current contract ends in July 2027, so this is a procurement exercise rather
// than a curiosity: what wins it is demonstrable coverage of a requirements
// list, not a dashboard nobody scores.
//
// WHAT IS PUBLIC AND WHAT IS MODELLED. The scale is published: the CVG GSE shop
// maintains about 3,500 pieces — roughly 800 powered and 2,700 non-powered —
// and runs 24/7; the hub is 194 acres with 67 aircraft gates and 117 daily
// flights; a $292M, 305,000 sq ft maintenance facility opened there in January
// 2026. Everything below that line is MODELLED: the equipment mix from what an
// express air hub of this size runs, the PM intervals from OEM and industry
// practice, the people invented. It is a faithful model of the operation, not a
// copy of their records, and no figure here should be quoted back to them as
// their own.
//
// WHY THE KIND LIST REPEATS. data.js picks an asset's type uniformly from
// `assetKinds`, so a flat list of fourteen would make dollies as rare as
// deicers. The published split is roughly 1:3.4 powered to non-powered, and on
// a ramp that ratio is the whole character of the estate — a shop where most of
// what you own has no engine schedules its work completely differently. So the
// non-powered kinds appear several times each. The repetition is the weighting.
//
// The people are the eight names the other packs use. data.js and dataMaint.js
// reference them by name for leads, approvers and planners; a pack that renamed
// them would leave those pointing at nobody. A pack changes the plant, not the
// roster — only the trades below are ramp trades.

export default {
  key: 'dhl-gse',
  label: 'DHL Express — GSE maintenance',

  org: {
    organization_name: 'DHL Express',
    organization_code: 'DHL',
    industry: 'Air express logistics — ground support equipment',
    address: '1200 South Airport Road',
    city: 'Erlanger',
    country: 'United States',
    timezone: 'America/New_York',
    currency: 'USD',
    currency_symbol: '$',
  },

  user: {
    name: 'Amy Sturm',
    email: 'amy.sturm@dhl.example',
    mobile: '+1 859 555 0118',
    role_name: 'GSE Maintenance Manager',
    initials: 'AS',
  },

  // CVG only. The four gateways this pack used to carry were modelled, and the
  // dataset is the superhub's own GSE department — inventing stations beside it
  // would put units on the map that no row in the workbook supports.
  sites: [
    { site_id: 'site_01', site_name: 'CVG Americas Superhub', code: 'CVG', city: 'Erlanger KY', country: 'United States', is_default: true },
  ],

  locations: [
    { functional_location_id: 'loc_01', name: 'GSE Maintenance Shop', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_02', name: 'Heavy Bay', site_id: 'site_01', parent_id: 'loc_01', level: 2 },
    { functional_location_id: 'loc_03', name: 'Battery & Charging Room', site_id: 'site_01', parent_id: 'loc_01', level: 2 },
    { functional_location_id: 'loc_04', name: 'Cargo Apron — North', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_05', name: 'Cargo Apron — South', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_06', name: 'Deicing Pad', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_07', name: 'GSE Staging', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_08', name: 'Ramp Operations', site_id: 'site_02', parent_id: null, level: 1 },
    { functional_location_id: 'loc_09', name: 'Gateway Shop', site_id: 'site_02', parent_id: 'loc_08', level: 2 },
    { functional_location_id: 'loc_10', name: 'Ramp Operations', site_id: 'site_03', parent_id: null, level: 1 },
    { functional_location_id: 'loc_11', name: 'Gateway Shop', site_id: 'site_03', parent_id: 'loc_10', level: 2 },
    { functional_location_id: 'loc_12', name: 'Ramp Operations', site_id: 'site_04', parent_id: null, level: 1 },
    { functional_location_id: 'loc_13', name: 'Deicing Pad', site_id: 'site_04', parent_id: null, level: 1 },
    { functional_location_id: 'loc_14', name: 'Ramp Operations', site_id: 'site_05', parent_id: null, level: 1 },
  ],

  assetCount: 168,
  // Powered kinds once, non-powered several times — see the note at the top.
  assetKinds: [
    // Powered — hour meters, fuel or traction batteries, tiered engine-hour PM.
    'Pushback Tractor', 'Cargo Tractor', 'Belt Loader', 'Container Loader',
    'Ground Power Unit', 'Air Start Unit', 'Pre-Conditioned Air Unit',
    'Deicing Truck', 'Lavatory Service Truck', 'Water Service Truck',
    'Forklift', 'Scissor Lift', 'Maintenance Van',
    // Non-powered — inspected on condition and on a calendar, never on hours.
    // Thirteen powered slots against forty-three non-powered puts the generated
    // estate at 23% powered, which is the published 800-of-3,500 split. Dollies
    // and ULDs carry most of the weight because on a cargo hub they do.
    'Cargo Dolly', 'Cargo Dolly', 'Cargo Dolly', 'Cargo Dolly', 'Cargo Dolly',
    'Cargo Dolly', 'Cargo Dolly', 'Cargo Dolly', 'Cargo Dolly', 'Cargo Dolly',
    'ULD Container', 'ULD Container', 'ULD Container', 'ULD Container', 'ULD Container',
    'ULD Container', 'ULD Container', 'ULD Container', 'ULD Container', 'ULD Container',
    'Pallet Dolly', 'Pallet Dolly', 'Pallet Dolly', 'Pallet Dolly',
    'Pallet Dolly', 'Pallet Dolly', 'Pallet Dolly',
    'Baggage Cart', 'Baggage Cart', 'Baggage Cart',
    'Baggage Cart', 'Baggage Cart', 'Baggage Cart',
    'Passenger Stairs', 'Passenger Stairs', 'Passenger Stairs',
    'Chock & Cone Set', 'Chock & Cone Set', 'Chock & Cone Set',
    'Tow Bar', 'Tow Bar', 'Tow Bar', 'Tow Bar',
  ],
  makers: [
    'TLD', 'JBT AeroTech', 'Textron GSE', 'Tug Technologies', 'Charlatte',
    'Mulag', 'Vestergaard', 'NMC-Wollard', 'Hobart', 'Trepel',
  ],

  workOrderCount: 96,
  // Written the way a ramp mechanic raises them on a work order, not the way an
  // analytics deck describes them.
  tasks: [
    'Belt loader conveyor belt slipping under load — adjust and inspect rollers',
    'Pushback tractor hydraulic leak at the steering cylinder',
    'GPU output voltage drifting out of 115V 400Hz tolerance',
    'Container loader platform will not raise to main deck height',
    'Deicer boom control unresponsive in the basket',
    'Cargo tractor failing brake test on the pre-shift walkaround',
    'Traction battery not holding charge over a full shift',
    'Hour meter reading does not match the unit — verify and correct',
    'Dolly deck roller seized, ULD will not transfer',
    'ULD container door latch damaged — out of service until repaired',
    '250-hour service — oil, filters, hydraulics and brake check',
    '1000-hour service — full inspection per OEM schedule',
    'Annual load test on the scissor lift',
    'Glycol pump losing prime on the deicing truck',
    'Tow bar shear pin replaced after a hard connect',
    'Passenger stairs handrail loose at the top platform',
    'Charger fault — unit not accepting a charge overnight',
    'Fuel gauge sender reading empty on a full tank',
  ],

  partCount: 56,
  partNames: [
    'Conveyor Belt — Belt Loader', 'Hydraulic Hose 1/2in JIC', 'Hydraulic Oil ISO 46',
    'Brake Pad Set — Tug', 'Traction Battery Cell 2V', 'Battery Charger Module',
    'Alternator 24V 120A', 'Starter Motor', 'Engine Oil Filter', 'Fuel Filter Element',
    'Air Filter — Diesel GSE', 'Deck Roller Assembly', 'ULD Door Latch Kit',
    'Glycol Pump Seal Kit', 'Boom Control Joystick', 'GPU Output Contactor',
    'Tow Bar Shear Pin', 'Hitch Pin & Retainer', 'Tyre 7.00-12 Solid',
    'Wheel Bearing Kit', 'Hydraulic Filter Cartridge', 'Coolant 50/50 Premix',
    'Work Light LED 24V', 'Beacon Amber 24V', 'Proximity Switch — Platform',
    'Hydraulic Cylinder Seal Kit', 'Drive Chain — Conveyor', 'Gearbox Oil 80W-90',
  ],

  technicians: [
    { user_id: 'usr_t01', name: 'Daniel Reeve', role: 'Technician', trade: 'GSE Mechanical' },
    { user_id: 'usr_t02', name: 'Tom Whelan', role: 'Technician', trade: 'GSE Electrical' },
    { user_id: 'usr_t03', name: 'Sara Kovac', role: 'Technician', trade: 'Hydraulics' },
    { user_id: 'usr_t04', name: 'Marcus Bell', role: 'Supervisor', trade: 'GSE Mechanical' },
    { user_id: 'usr_t05', name: 'Ellie Brandt', role: 'Technician', trade: 'Battery & Charging' },
    { user_id: 'usr_t06', name: 'Owen Marsh', role: 'Technician', trade: 'Diesel' },
    { user_id: 'usr_t07', name: 'Grace Holloway', role: 'Planner', trade: 'Planning' },
    { user_id: 'usr_t08', name: 'Victor Lang', role: 'Technician', trade: 'Welding & Fabrication' },
  ],

  vendorNames: [
    'TLD Parts & Service', 'JBT AeroTech Parts', 'Textron GSE Support',
    'Vestergaard Service', 'Global GSE Parts', 'Hobart Ground Power',
    'Aviation Spares Direct', 'Ramp Supply Co',
  ],

  // ── the specialised module ───────────────────────────────────────────────
  //
  // What a GSE shop needs that a plant CMMS does not: whether the ramp has the
  // equipment it needs right now, what the hour meters say, how the electric
  // fleet's batteries are holding up, whether the deicers are ready for winter,
  // and — because this is an RFP — where the product stands against their list.
  domain: {
    key: 'gse',
    label: 'GSE Fleet',
    subtitle: 'Ramp readiness, meters, batteries and seasonal cover',

    icon: 'gse',
    sections: [
      { key: 'gse-readiness', label: 'Fleet Readiness', kw: 'gse fleet readiness ramp available down out of service aog gate equipment ready gap station gse availability uptime' },
      { key: 'gse-meters', label: 'Meters & Utilisation', kw: 'hour meter reading utilisation hours run engine hours odometer cycles due service interval 250 500 1000 meter based pm' },
      { key: 'gse-battery', label: 'eGSE & Battery', kw: 'egse electric battery state of health charge charger traction battery electrification emissions diesel replacement' },
      { key: 'gse-seasonal', label: 'Seasonal Readiness', kw: 'seasonal deicing winter readiness glycol deicer summer season campaign ready before winter' },
      { key: 'gse-stores', label: 'Stores Health', kw: 'stores inventory abc class a b c valuation on hand value 2 million unrestricted quality inspection blocked stock split storage location sloc stockout reorder mrp material type moving average price' },
      { key: 'gse-reliability', label: 'Reliability Insights', kw: 'reliability oem manufacturer equipment type unscheduled per asset year pm cycle compliance behind ahead stable owner rotating technicians breakdowns comparison tug charlatte eagle itw tld night bank' },
      { key: 'gse-workmanship', label: 'Workmanship', kw: 'workmanship quality technician band excellent watch come-back rework median days to next unscheduled mentor coaching notes comments peer' },
      { key: 'gse-sap', label: 'SAP Integration', kw: 'sap s4hana s/4 erp integration plant cvg1 material document goods movement 101 261 701 702 reservation notification pm01 pm02 work center cost center purchase requisition banfn p2p procure to pay goods receipt storage location' },
      { key: 'gse-next-five', label: 'Next Five Years', kw: 'next five years 2027 2028 2029 2030 2031 trajectory target kpi plan roadmap improvement slope owner sap s4hana go live ai agent story playbook value map' },
      { key: 'gse-five-year', label: 'Five-Year Performance', kw: 'five year 5 year dashboard trend history fleet cost acquisition manufacturer equipment type downtime unscheduled preventive come-back oos out of service ramp control labour parts spend vendor po spend year over year' },
      { key: 'gse-warranty', label: 'Warranty Recovery', kw: 'warranty claim recovery credit oem vendor repeat failure early failure inside warranty denied approved pending claim candidate' },
      { key: 'gse-parts-kits', label: 'Parts Kits & Sourcing', kw: 'parts kit pm kit brake kit issue as a set oem aftermarket alternate vendor cost life best part vendor comparison sourcing' },
      { key: 'gse-spare-insights', label: 'Spare variant insights', kw: 'oem aftermarket variant spare parts best fit higher value early failure repeat pr parts hold vendor reliability store supervisor' },
      { key: 'gse-audit-report', label: 'Airline audit PDF', kw: 'airline audit report pdf quarter six months pm compliance overdue workmanship hierarchy pr po gr oxmaint ai' },
      { key: 'gse-cycle-counts', label: 'Cycle Counts', kw: 'cycle count inventory verification physical count variance reason code bin accuracy shrink audit stores quarterly' },
      { key: 'gse-tech-kpi', label: 'Technician KPIs', kw: 'technician kpi wrench time time on task scheduled hours recorded come-back rework quality peer employee performance labour productivity' },
      { key: 'gse-rfp', label: 'RFP Coverage', kw: 'rfp requirement coverage evaluation tender procurement matrix capability contract 2027 scoring' },
      { key: 'gse-voice', label: 'Voice demo', kw: 'voice call phone twilio xai grok receptionist work order this week parts hold deferred p1 aog 415 639 4335 oxmaint ai' },
      { key: 'gse-waterfall', label: 'WO waterfall', kw: 'waterfall pipeline planning originated parts ready parts short manpower in flow deferred scope variation technical review archived supervisor' },
    ],

    // Only powered equipment carries an hour meter. A service-hours figure
    // against a dolly is the kind of detail that loses a room of mechanics.
    poweredKinds: [
      'Baggage Tractor', 'Cargo Tractor / Bobtail', 'Belt Loader', 'ULD / Pallet Cargo Loader',
      'Pushback Tractor', 'Towbarless Tractor', 'Ground Power Unit', 'Air Start Unit',
      'PCA / Preconditioned Air', 'Lavatory Service Truck', 'Potable Water Truck',
      'Forklift / Pallet Jack Powered', 'Crew / Ramp Vehicle', 'Mobile GSE Charger Cart',
      'Scissor Lift / Maintenance Stand Powered',
      'Snow Plow Truck', 'Deicer Truck', 'Snow Blower', 'Runway Broom', 'Liquid Deice Trailer',
    ],

    // Electric today, and what each would otherwise be burning. The department
    // is measured on both availability and emissions, so the fleet's split is
    // part of the fleet's description rather than a separate report.
    electricKinds: ['Baggage Tractor', 'Belt Loader', 'Forklift / Pallet Jack Powered', 'PCA / Preconditioned Air', 'Mobile GSE Charger Cart', 'Scissor Lift / Maintenance Stand Powered'],

    // Equipment that only earns its keep in one season, and the date the
    // readiness clock runs to. A deicer that fails its check in November is a
    // different problem from one that fails it in July.
    seasonal: [
      { kinds: ['Deicer Truck', 'Snow Plow Truck', 'Snow Blower', 'Runway Broom', 'Liquid Deice Trailer'], season: 'Winter', readyBy: '11-01', note: 'Deicing fleet must be serviced, glycol system tested and boom certified before the first freeze.' },
      { kinds: ['PCA / Preconditioned Air'], season: 'Summer', readyBy: '05-01', note: 'PCA demand peaks in summer; units idle through winter and need recommissioning.' },
    ],

    // The tiered engine-hour services the OEM schedules are built from, and
    // what each one actually covers. These are the intervals the department
    // will be asked to evidence in an audit.
    serviceTiers: [
      { hours: 250, label: '250-hour service', body: 'Oil and filter, lubrication, fluid levels, brake and tyre check, hour-meter verification.' },
      { hours: 500, label: '500-hour service', body: 'The 250 plus hydraulic filter, belt and hose inspection, battery and charging check.' },
      { hours: 1000, label: '1000-hour service', body: 'The 500 plus full OEM inspection, brake overhaul assessment, structural and load-path check.' },
    ],

    // What gets checked before a unit is signed onto the ramp, and by whom.
    // Daily by the operator, weekly by a mechanic — the article's own cadence
    // and the one an airline audit expects to see records for.
    inspectionCadence: [
      { key: 'daily', label: 'Daily operator walkaround', by: 'Operator', body: 'Before each shift: fluids, lights, beacons, brakes, horn, visible damage, hour meter.' },
      { key: 'weekly', label: 'Weekly mechanic check', by: 'Mechanic', body: 'Safety-critical systems: brakes, steering, hydraulics, lifting and load paths, guarding.' },
      { key: 'annual', label: 'Annual certification', by: 'Mechanic', body: 'Load test where fitted, structural inspection, and the certificate the audit asks for.' },
    ],

    // The standards this department is held to. Named so the compliance screens
    // have something real to point at rather than the word "compliance".
    standards: [
      ['IATA ISAGO', 'Ground operations audit — equipment maintenance records and serviceability.'],
      ['IATA AHM 913 / 915', 'Ground support equipment design and functional requirements.'],
      ['OSHA 1910.178', 'Powered industrial truck operation, inspection and operator training.'],
      ['EPA SPCC / stormwater', 'Deicing fluid capture and fuel storage on the ramp.'],
      ['DOT / FMCSA', 'Road-registered GSE crossing public roads between facilities.'],
      ['Airport authority airside rules', 'Access, escort, and equipment condition on the movement area.'],
    ],

    // Where the RFP screen gets its rows. Each is a requirement a GSE CMMS
    // tender asks about, with the section of this product that answers it.
    // `state` is honest: 'yes' where a screen does it today, 'partial' where it
    // does some of it, 'roadmap' where it does not. A matrix of green ticks is
    // the least believable thing to put in front of an evaluator.
    rfpAreas: [
      {
        area: 'Asset register & hierarchy',
        items: [
          { need: 'Every powered and non-powered unit, by station and location', state: 'yes', where: 'assets' },
          { need: 'Make, model, serial, year, registration and warranty per unit', state: 'yes', where: 'assets' },
          { need: 'QR/barcode identification on the unit', state: 'yes', where: 'asset-qr' },
          { need: 'Bulk load of an existing fleet register', state: 'yes', where: 'assets' },
        ],
      },
      {
        area: 'Preventive maintenance',
        items: [
          { need: 'Tiered engine-hour services — 250 / 500 / 1000', state: 'yes', where: 'pm-schedules' },
          { need: 'Calendar intervals — monthly, quarterly, annual', state: 'yes', where: 'pm-schedules' },
          { need: 'Hours or calendar, whichever falls first', state: 'yes', where: 'pm-schedules' },
          { need: 'Work order raised automatically as an interval approaches', state: 'yes', where: 'pm-schedules' },
          { need: 'Seasonal campaigns — deicing fleet before winter', state: 'yes', where: 'gse-seasonal' },
          { need: 'Forward view of services due, by week, against crew capacity', state: 'yes', where: 'pm-forecast' },
        ],
      },
      {
        area: 'Meter management',
        items: [
          { need: 'Hour-meter and odometer readings captured per unit', state: 'yes', where: 'gse-meters' },
          { need: 'Reading history with who logged it and when', state: 'yes', where: 'gse-meters' },
          { need: 'Meter rollover and mis-key protection', state: 'yes', where: 'gse-meters' },
          { need: 'Telematics feed instead of manual entry', state: 'roadmap', where: 'integrations' },
        ],
      },
      {
        area: 'Work management',
        items: [
          { need: 'Corrective, preventive and breakdown work orders', state: 'yes', where: 'work-orders' },
          { need: 'Assign to technician, track labour hours and cost', state: 'yes', where: 'work-orders' },
          { need: 'Parts issued against the job', state: 'yes', where: 'work-orders' },
          { need: 'Mobile execution on the ramp', state: 'yes', where: 'my-tasks' },
          { need: 'Approval routing above a cost threshold', state: 'yes', where: 'approvals' },
        ],
      },
      {
        area: 'Inspections & compliance',
        items: [
          { need: 'Daily operator walkaround, recorded per unit', state: 'yes', where: 'checklists' },
          { need: 'Weekly mechanic safety-critical check', state: 'yes', where: 'inspections' },
          { need: 'Failed check raises a work order automatically', state: 'yes', where: 'inspections' },
          { need: 'Tamper-evident audit trail of who signed what', state: 'yes', where: 'audit-trail' },
          { need: 'Annual certification records for audit', state: 'partial', where: 'certificates' },
        ],
      },
      {
        area: 'Parts & purchasing',
        items: [
          { need: 'Parts catalogue with stock by station', state: 'yes', where: 'parts' },
          { need: 'Reorder points and low-stock warning', state: 'yes', where: 'stocks' },
          { need: 'Purchase orders to OEM and aftermarket vendors', state: 'yes', where: 'purchase-orders' },
          { need: 'Receive against the order and book into stock', state: 'yes', where: 'purchase-orders' },
          { need: 'Parts kits issued onto the job as a set', state: 'yes', where: 'work-orders' },
          { need: 'OEM against aftermarket — price paid and life delivered, by part', state: 'yes', where: 'gse-parts-kits' },
          { need: 'Current-period OEM vs aftermarket variant fit, early failure and repeat PR', state: 'yes', where: 'gse-spare-insights' },
          { need: 'Cycle counts with variance value and reason codes', state: 'yes', where: 'gse-cycle-counts' },
          { need: 'Warranty claims, and early failures not yet claimed', state: 'yes', where: 'gse-warranty' },
        ],
      },
      {
        area: 'Reporting & analytics',
        items: [
          { need: 'PM compliance by station and by equipment class', state: 'yes', where: 'reports' },
          { need: 'Fleet availability and downtime', state: 'yes', where: 'gse-readiness' },
          { need: 'Cost per unit and per operating hour', state: 'partial', where: 'financial' },
          { need: 'MTBF and failure analysis by class', state: 'yes', where: 'rcm-reliability' },
          { need: 'Five-year trend of cost, downtime and unscheduled work', state: 'yes', where: 'gse-five-year' },
          { need: 'Fleet cost by equipment type and manufacturer', state: 'yes', where: 'gse-five-year' },
          { need: 'Technician wrench time against scheduled hours', state: 'yes', where: 'gse-tech-kpi' },
          { need: 'Come-back and rework rate by technician', state: 'yes', where: 'gse-tech-kpi' },
          { need: 'Current-period workmanship score (reopen, bounce-back, near-PM, first-time-fix)', state: 'yes', where: 'gse-workmanship' },
          { need: 'Airline audit PDF for a quarter or six months', state: 'yes', where: 'gse-audit-report' },
          { need: 'Monthly work-order waterfall for the maintenance manager (planning through archive)', state: 'yes', where: 'gse-waterfall' },
          { need: 'Export to the department’s own reporting', state: 'yes', where: 'reports' },
        ],
      },
      {
        area: 'Electrification',
        items: [
          { need: 'Traction battery state of health per unit', state: 'yes', where: 'gse-battery' },
          { need: 'Charger assets maintained as equipment', state: 'yes', where: 'gse-battery' },
          { need: 'Diesel-to-electric fleet transition tracking', state: 'yes', where: 'gse-battery' },
          { need: 'Charge scheduling against flight banks', state: 'roadmap', where: 'gse-battery' },
        ],
      },
      {
        area: 'SAP S/4HANA',
        items: [
          { need: 'Equipment and functional location held against the SAP record', state: 'yes', where: 'gse-sap' },
          { need: 'PM01 preventive and PM02 unscheduled orders, with notification', state: 'yes', where: 'gse-sap' },
          { need: 'Reservation from the job, goods issue 261 against the order', state: 'yes', where: 'gse-sap' },
          { need: 'Goods receipt 101 against the purchase order, into plant and store', state: 'yes', where: 'gse-sap' },
          { need: 'Cycle-count differences posted as 701 / 702', state: 'yes', where: 'gse-sap' },
          { need: 'Requisition to receipt, with release strategy and cycle time', state: 'yes', where: 'gse-sap' },
          { need: 'Settlement to the GSE cost centre and work centre', state: 'partial', where: 'gse-sap' },
          { need: 'Live posting into a customer S/4HANA system', state: 'roadmap', where: 'integrations' },
        ],
      },
      {
        area: 'Platform & integration',
        items: [
          { need: 'Named users with role-based access', state: 'yes', where: 'members' },
          { need: 'Multi-station with per-station scoping', state: 'yes', where: 'locations' },
          { need: 'Documented REST API', state: 'yes', where: 'integrations' },
          { need: 'SAP / finance interface for cost posting', state: 'partial', where: 'integrations' },
          { need: 'Migration from the incumbent CMMS', state: 'partial', where: 'explore-apps' },
        ],
      },
    ],

    // The evaluation this is being built for. Dates drive the countdown on the
    // RFP screen; a tender with no clock on it reads as a brochure.
    evaluation: {
      client: 'DHL Express — GSE Maintenance',
      contact: 'Amy Sturm, GSE Maintenance Manager',
      contractEnds: '2027-07-01',
      note: 'Incumbent CMMS contract ends July 2027. This evaluation is for the replacement.',
    },

    // ── the shop's own registers ────────────────────────────────────────────
    //
    // Everything below replaces a generic register that was written for a UK
    // factory — production lines, a compressor house, LOLER examinations, a
    // press shop. None of it is what a GSE mechanic at an air cargo hub works
    // to, and an evaluator who opens Inspections and reads "Daily walk-round of
    // Line 1" stops believing the ramp screens as well. Each list keeps the
    // shape of the one it replaces, so the screens read it unchanged; only the
    // words are the shop's.
    //
    // CVG is one station. Nothing here names a second site — every row lands on
    // the superhub whatever the generator's own list would have done.

    // The four kinds of inspection the register records, in the order of the
    // generic four they stand in for. `frequency` is the reminder cadence and
    // `cadence` the wording on the report; `categories` says which checklist
    // categories open onto this type on the create screen. The items are what
    // the runner asks, and follow the operator-then-mechanic split above: a
    // walkaround is what the driver checks before signing the unit onto the
    // ramp, the weekly check is the mechanic's safety-critical list, and the
    // quarterly inspection is the structure and the load path.
    inspectionTypes: [
      {
        type: 'Daily operator walkaround',
        frequency: 'Daily',
        cadence: 'Every shift',
        categories: ['Operations'],
        items: [
          'No fuel, hydraulic or coolant leaks under the unit',
          'Engine oil, coolant and hydraulic fluid at or above minimum',
          'Tyres free of cuts, chunking and low pressure',
          'Service and parking brakes hold on test',
          'Steering responds without excessive free play',
          'Horn, backup alarm and amber beacon working',
          'Headlights, work lights and marker lamps working',
          'Tow hitch, pintle and safety pin secure',
          'Bumpers and rub strips intact at aircraft contact points',
          'Fire extinguisher present, charged and bracket secure',
          'No out-of-service tag left on the unit from the last shift',
          'Hour meter reading recorded',
        ],
      },
      {
        type: 'Weekly mechanic check',
        frequency: 'Weekly',
        cadence: 'Weekly',
        categories: ['Maintenance'],
        items: [
          'Brake pads, rotors and lines inspected and within limits',
          'Steering linkage and kingpins free of play',
          'Hydraulic hoses and fittings free of chafe and weep',
          'Lift, boom or conveyor load path inspected for cracks',
          'Platform and boom interlocks proved on test',
          'Battery terminals clean, tight and free of corrosion',
          'Charger connector and cable free of damage',
          'Belts, chains and rollers tensioned and aligned',
          'Emergency stop and emergency lowering function tested',
          'Open defects from operator walkarounds reviewed and cleared',
        ],
      },
      {
        type: 'Ramp safety inspection',
        frequency: 'Monthly',
        cadence: 'Monthly',
        categories: ['Safety'],
        items: [
          'Fire extinguishers on units and at the shop charged and tagged',
          'Eyewash and shower at the battery charging area tested',
          'Charging area ventilation running and unobstructed',
          'Spill kits stocked at the deice pad and fuel cart area',
          'Glycol and fuel storage inside secondary containment',
          'Chocks and cones issued with every tug and loader',
          'FOD walk of the equipment staging area completed',
          'Equipment parked clear of the aircraft safety envelope',
          'Out-of-service tags and lockout padlocks stocked',
          'Hearing and eye protection available at the GPU line',
          'High-visibility vests worn by everyone airside',
          'Wheel chocks and jack stands in the heavy bay inspected',
          'Propane forklift cylinders stored upright in the cage',
          'Safety data sheets current for glycol, AW-46 and battery acid',
          'Airside vehicle permits displayed on road-going units',
          'Operator training records current for the units in use',
        ],
      },
      {
        type: 'Quarterly structural inspection',
        frequency: 'Quarterly',
        cadence: 'Quarterly',
        categories: ['Compliance'],
        items: [
          'Chassis and frame welds inspected for cracking',
          'Lift cylinders and pivot pins measured for wear',
          'Scissor arms and platform rollers inspected',
          'Deicer boom and basket structure inspected',
          'Conveyor frame and boom hinge points inspected',
          'Tow bar head, shear pin housing and eye inspected',
          'Load rating and data plates legible',
          'Guard rails and platform gates latch correctly',
          'Corrosion and paint condition assessed',
          'Mounting bolts on engine, pump and axles torqued',
          'Hydraulic cylinder drift measured under load',
          'Hour meter checked against the last service record',
          'Wheel bearings checked for play and noise',
          'Findings reconciled with the annual certification record',
        ],
      },
    ],

    // The checklist register. `role` names who carries a checklist, so it lands
    // on a real person in the roster; a row with no role keeps the words in
    // `assigned_to` — a ramp crew is not one person.
    checklists: [
      { checklist_id: 'chk_001', checklist_name: 'Daily operator walkaround', items_count: 14, category: 'Operations', assigned_to: 'All ramp operators', completions_today: 38, due_today: 46, status: 'Active' },
      { checklist_id: 'chk_002', checklist_name: 'Pre-shift tug and belt loader check', items_count: 9, category: 'Operations', assigned_to: 'Ramp operators', completions_today: 21, due_today: 24, status: 'Active' },
      { checklist_id: 'chk_003', checklist_name: 'Monthly ramp safety inspection', items_count: 22, category: 'Safety', role: 'Supervisor', completions_today: 0, due_today: 1, status: 'Active' },
      { checklist_id: 'chk_004', checklist_name: 'GPU and PCA output check', items_count: 18, category: 'Maintenance', role: 'Technician', completions_today: 1, due_today: 2, status: 'Active' },
      { checklist_id: 'chk_005', checklist_name: 'Annual load test — loaders and lifts', items_count: 11, category: 'Compliance', assigned_to: 'External', completions_today: 0, due_today: 0, status: 'Active' },
      { checklist_id: 'chk_006', checklist_name: 'Deicer fleet pre-season readiness', items_count: 26, category: 'Maintenance', role: 'Planner', completions_today: 0, due_today: 0, status: 'Template' },
    ],

    // The steps behind each checklist category, for the register's seeded rows
    // and for composing a draft on the create screen. Same four categories and
    // roughly the same depth as the generic bank.
    checklistItems: {
      Operations: [
        'No fluid leaks under the unit', 'Tyres and wheels undamaged', 'Brakes hold on test',
        'Horn, backup alarm and beacon working', 'Lights and marker lamps working', 'Tow hitch and pin secure',
        'Bumpers intact at aircraft contact points', 'Fire extinguisher charged', 'Fuel or battery charge sufficient for the shift',
        'Conveyor or platform runs without noise', 'Hydraulic level at or above minimum', 'Hour meter reading recorded',
        'Seat belt and operator presence switch working', 'No open out-of-service tag',
      ],
      Safety: [
        'Fire extinguishers charged and tagged', 'Eyewash at the charging area tested', 'Charging area ventilation running',
        'Lockout padlocks and out-of-service tags stocked', 'Platform and boom interlocks proved', 'First aid kits stocked on service vehicles',
        'Spill kit at the deice pad complete', 'Glycol storage inside containment', 'Equipment parked clear of the aircraft envelope',
        'Chocks and cones issued with units', 'High-visibility vests worn airside', 'Hearing protection at the GPU line',
        'FOD walk of the staging area complete', 'Propane cylinders stored upright and caged', 'Emergency stops tested on loaders',
        'Jack stands and wheel chocks inspected', 'Airside driving permits current', 'Hot work permit displayed in the heavy bay',
        'Fall protection at the deicer basket inspected', 'Battery acid neutraliser available', 'Safety briefing recorded for the shift',
        'Snow barn exits unobstructed',
      ],
      Maintenance: [
        'Engine oil and filter changed at the hour interval', 'Hydraulic filter element changed', 'Brake pads measured',
        'Hydraulic hoses inspected for chafe', 'Conveyor belt tension and tracking set', 'Battery terminals cleaned and torqued',
        'Traction battery state of health logged', 'GPU output voltage and frequency recorded', 'PCA discharge temperature recorded',
        'Glycol heater and pump pressure checked', 'Lift cylinders checked for drift', 'Wheel bearings checked for play',
        'Grease points lubricated', 'Coolant strength tested', 'Fault codes read and cleared',
        'Hour meter verified against the unit', 'Parts used booked to the work order', 'Unit road-tested before return to the ramp',
      ],
      Compliance: [
        'Annual load test certificate in date', 'Load rating plate legible',
        'OSHA 1910.178 inspection record on file', 'DOT inspection sticker current on road units',
        'Operator training records current', 'Deicer boom certification in date',
        'Calibration certificates filed for test equipment', 'SPCC containment inspection recorded',
        'Stormwater monitoring sample taken', 'ISAGO record retention met', 'Register updated',
      ],
    },

    // What gets reported on a ramp. Titles only — severity, status and the unit
    // come from the generator, so these are written to read sensibly on any
    // unit and at any severity.
    incidentTitles: [
      'Tug struck ULD dolly on Ramp B',
      'Hydraulic line burst on belt loader',
      'Glycol spill at the deice pad',
      'Near miss — belt loader raised without a spotter',
      'Hand caught at tow bar hitch during connect',
    ],

    // Planned outages. A GSE shop does not shut a line — it pulls a class of
    // equipment out of rotation, or a piece of the building, around the flight
    // schedule. `manager` is a role; the generator puts a person on it.
    shutdowns: [
      { shutdown_id: 'sd_001', name: 'Deicer fleet pre-season overhaul', status: 'Planned', start: 21, end: 26, tasks: 42, tasks_done: 0, budget: 68000, progress: 0, manager: 'Planner' },
      { shutdown_id: 'sd_002', name: 'Hangar door and GPU pit annual', status: 'In Progress', start: -3, end: 4, tasks: 18, tasks_done: 8, budget: 21000, progress: 46, manager: 'Supervisor' },
      { shutdown_id: 'sd_003', name: 'Belt loader conveyor rebuild campaign', status: 'Completed', start: -40, end: -33, tasks: 27, tasks_done: 27, budget: 39500, progress: 100, manager: 'Planner' },
      { shutdown_id: 'sd_004', name: 'Battery Shop charger bank inspection', status: 'Planned', start: 48, end: 49, tasks: 9, tasks_done: 0, budget: 4200, progress: 0, manager: 'Supervisor' },
    ],

    // Rounds, walked by zone. Same six-route rhythm as the generic register —
    // one finished, one overdue, one not started — so the screen still has
    // something to say about each state.
    routes: [
      { name: 'Ramp A start-of-shift GSE line check', shift: 'Days', site_id: 'site_01', last: -1, due: 0, done: 1, fail: 0, warn: 1 },
      { name: 'Battery Shop charger round', shift: 'Days', site_id: 'site_01', last: 0, due: 0, done: 0.62, fail: 2, warn: 2 },
      { name: 'Snow Barn deicer and plow round', shift: 'Nights', site_id: 'site_01', last: -1, due: 1, done: 0.86, fail: 1, warn: 3 },
      { name: 'Ramp D GPU and PCA round', shift: 'Swing', site_id: 'site_01', last: -2, due: -1, done: 0.34, fail: 3, warn: 1 },
      { name: 'ULD Yard dolly and loader round', shift: 'Days', site_id: 'site_01', last: -1, due: 0, done: 1, fail: 0, warn: 0 },
      { name: 'Hangar Staging pushback and tow bar round', shift: 'Swing', site_id: 'site_01', last: -3, due: 2, done: 0, fail: 0, warn: 2 },
    ],

    // The tags a round flags. Exactly twelve, because the generator walks this
    // list with a stride of five and needs a length it is coprime with.
    routeTags: [
      'Hydraulic oil level', 'Engine oil level', 'Coolant level', 'Tyre pressure',
      'Brake hold test', 'Battery state of charge', 'Charger fault code', 'GPU output voltage',
      'GPU output frequency', 'PCA discharge temp', 'Glycol tank level', 'Beacon and lights',
    ],

    // What is actually read at a reading point, in the units a US shop reads
    // them in, with the warning band inside the failure band.
    routeReadings: [
      { param: 'Hydraulic oil temperature', short: 'Hyd oil temp', unit: '°F', lo: 90, hi: 160, failLo: 40, failHi: 190, dp: 0 },
      { param: 'Hydraulic system pressure', short: 'Hyd pressure', unit: 'psi', lo: 1800, hi: 2600, failLo: 1400, failHi: 3000, dp: 0 },
      { param: 'GPU output voltage', short: 'GPU volts', unit: 'V', lo: 113, hi: 117, failLo: 110, failHi: 120, dp: 1 },
      { param: 'Glycol tank level', short: 'Glycol level', unit: '%', lo: 35, hi: 85, failLo: 15, failHi: 92, dp: 0 },
      { param: 'GPU output frequency', short: 'GPU freq', unit: 'Hz', lo: 398, hi: 402, failLo: 395, failHi: 405, dp: 1 },
      { param: 'Tyre pressure', short: 'Tyre press', unit: 'psi', lo: 90, hi: 110, failLo: 75, failHi: 120, dp: 0 },
    ],

    // Outward gate passes. Item names are the stock descriptions from the parts
    // master, so each pass resolves to a real stock line; `bulk` marks the ones
    // that leave by the gallon rather than by the piece.
    gatePasses: [
      { type: 'Returnable', item: 'Hydraulic pump 4.9 / belt loader', reason: 'Core exchange — pump rebuilt by the OEM', issued: -38, back: -9, returned: false },
      { type: 'Returnable', item: 'GPU output cable 400 Hz', reason: 'Cable head re-termination and continuity test at the vendor', issued: -31, back: -4, returned: false },
      { type: 'Returnable', item: 'Lift cylinder TUG 660', reason: 'Sent out for reseal and rod re-chrome', issued: -26, back: -12, returned: true },
      { type: 'Non-returnable', item: 'Brake pad set TUG MA/MH', reason: 'Returned to supplier — wrong application received', issued: -24, back: null, returned: false },
      { type: 'Returnable', item: 'Scissor lift cylinder cargo loader', reason: 'Cylinder rebuild — scored barrel', issued: -19, back: 4, returned: false },
      { type: 'Non-returnable', item: 'AW-46 hydraulic oil (gal)', reason: 'Waste hydraulic fluid collection — manifest attached', issued: -17, back: null, returned: false, bulk: true },
      { type: 'Returnable', item: '24V 100A alternator', reason: 'Rebuild exchange unit sent against a replacement', issued: -14, back: -2, returned: true },
      { type: 'Returnable', item: 'Tow coupling / lunette', reason: 'Warranty claim — cracked weld inside the warranty period', issued: -11, back: 6, returned: false },
      { type: 'Non-returnable', item: 'Conveyor belt 24 in x 49 ft laced', reason: 'Worn belt to scrap — recycler ticket attached', issued: -9, back: null, returned: false },
      { type: 'Returnable', item: '80V 40 kWh LFP traction pack', reason: 'Sent to the battery OEM for cell balancing and capacity test', issued: -6, back: 12, returned: false },
      { type: 'Returnable', item: 'GPU aircraft connector head', reason: 'Pin block replacement — Ramp D unit', issued: -4, back: 18, returned: false },
      { type: 'Non-returnable', item: 'Dexron ATF / transmission (gal)', reason: 'Fluid sample sent for laboratory analysis', issued: -2, back: null, returned: false },
    ],

    // ── the obligation register, in this shop's terms ──────────────────────
    //
    // The generic register is UK statutory work — LOLER, PUWER, COSHH, an EICR.
    // A US air cargo hub answers to OSHA for its powered industrial trucks, to
    // the EPA for glycol and fuel, to DOT for anything that crosses a public
    // road, to NFPA for propane and fuelling, and to the airlines through
    // ISAGO. Two late and three inside the warning window, as elsewhere.
    //
    // `due_in` is days from today; negative is overdue.
    obligations: [
      { title: 'IATA ISAGO audit — GSE maintenance records and serviceability', area: 'Airline Audit', frequency: 'Biennial', site: null, due_in: 132 },
      { title: 'OSHA 29 CFR 1910.178(l) — tug and forklift operator evaluations', area: 'OSHA', frequency: 'Annual', site: 'site_01', due_in: -9 },
      { title: 'OSHA 1910.178(q)(7) — daily truck examination records audit', area: 'OSHA', frequency: 'Quarterly', site: 'site_01', due_in: 11 },
      { title: 'OSHA 1910.178(g) — battery charging area eyewash and ventilation', area: 'OSHA', frequency: 'Quarterly', site: 'site_01', due_in: 64 },
      { title: 'Deicer boom structural and load certification', area: 'Equipment Certification', frequency: 'Annual', site: 'site_01', due_in: -23 },
      { title: 'EPA SPCC plan — five-year review and PE certification', area: 'EPA', frequency: 'Five-yearly', site: 'site_01', due_in: 540 },
      { title: 'Stormwater permit — deicing runoff monitoring report', area: 'EPA', frequency: 'Quarterly', site: 'site_01', due_in: 18 },
      { title: 'EPA Section 608 — PCA refrigerant leak records review', area: 'EPA', frequency: 'Annual', site: 'site_01', due_in: 212 },
      { title: 'DOT / FMCSA annual inspection — road-registered GSE', area: 'DOT', frequency: 'Annual', site: 'site_01', due_in: 96 },
      { title: 'NFPA 58 — propane cylinder storage and exchange cage inspection', area: 'Fire Safety', frequency: 'Six-monthly', site: 'site_01', due_in: 26 },
      { title: 'NFPA 407 — fuel cart and hydrant equipment inspection', area: 'Fire Safety', frequency: 'Annual', site: 'site_01', due_in: 150 },
      { title: 'Airport authority airside vehicle permit renewals', area: 'Airport Authority', frequency: 'Annual', site: null, due_in: 74 },
    ],

    // Corrective and preventive actions, each traceable to something that
    // happens on a ramp. Sources are the generic four, so the screen's filters
    // and colours are unchanged.
    capas: [
      { title: 'Tug struck ULD dolly on Ramp B — add a spotter rule for reversing in the dolly lanes', source: 'Incident', type: 'Corrective', state: 'In Progress', due_in: 6, site: 'site_01' },
      { title: 'Repeat conveyor belt slippage on TUG 660 belt loaders — revise the tension check interval', source: 'Inspection finding', type: 'Preventive', state: 'In Progress', due_in: 19, site: 'site_01' },
      { title: 'Glycol spill at the deice pad — fit drip containment at the transfer coupling and revise the fill procedure', source: 'Incident', type: 'Corrective', state: 'In Progress', due_in: -8, site: 'site_01' },
      { title: 'Deicer boom certifications run past date — rebuild the certification register', source: 'Internal audit', type: 'Corrective', state: 'Open', due_in: -15, site: 'site_01' },
      { title: 'Load test certificates missing for three cargo loaders', source: 'Internal audit', type: 'Corrective', state: 'Verification', due_in: 21, site: 'site_01' },
      { title: 'Belt loader raised under an aircraft door without a spotter — add the check to the walkaround', source: 'Incident', type: 'Preventive', state: 'Closed', due_in: -34, site: 'site_01' },
      { title: 'Parts issued at the Battery Shop without a stores transaction — enforce booking at the counter', source: 'Internal audit', type: 'Preventive', state: 'Closed', due_in: -52, site: 'site_01' },
      { title: 'GPU trips traced to worn 400 Hz output contactors — add contactor inspection to the 500-hour service', source: 'Inspection finding', type: 'Preventive', state: 'In Progress', due_in: 27, site: 'site_01' },
      { title: 'Hearing protection not worn at the GPU line — introduce supervisor spot checks', source: 'Internal audit', type: 'Corrective', state: 'Open', due_in: 9, site: 'site_01' },
      { title: 'Work orders closed without completion notes — make the field mandatory', source: 'Internal audit', type: 'Preventive', state: 'Closed', due_in: -20, site: 'site_01' },
      { title: 'Charger fault codes not logged on the night round — add the reading to the Battery Shop route', source: 'Inspection finding', type: 'Corrective', state: 'Verification', due_in: 15, site: 'site_01' },
      { title: 'Contractor tyre service van entered the ramp without an escort — revise the airside gate process', source: 'Incident', type: 'Corrective', state: 'Closed', due_in: -41, site: 'site_01' },
      { title: 'Hour meter mis-keys accepted without a check — add a rollover and mis-key rule', source: 'Inspection finding', type: 'Preventive', state: 'In Progress', due_in: 33, site: 'site_01' },
      { title: 'Departure delayed after a pushback tractor went unserviceable — review the spare tractor holding', source: 'Customer complaint', type: 'Corrective', state: 'Open', due_in: 4, site: 'site_01' },
    ],

    // Validation protocols. The three CMMS rows are the product's own and
    // stay; the equipment rows qualify GSE rather than plant. `asset` is an
    // equipment type from the register, so each resolves to a real unit.
    validations: [
      { protocol: 'IQ-1001', system: 'Oxmaint CMMS', scope: 'Application and database server installation', status: 'Approved', tests_total: 34 },
      { protocol: 'OQ-1002', system: 'Oxmaint CMMS', scope: 'Work order, preventive maintenance and stores workflows', status: 'Approved', tests_total: 58 },
      { protocol: 'PQ-1003', system: 'Oxmaint CMMS', scope: 'Performance across a full maintenance cycle', status: 'In Execution', tests_total: 46 },
      { protocol: 'IQ-1004', asset: 'Deicer Truck', scope: 'Glycol heater upgrade — installation records and drawings', status: 'Approved', tests_total: 22 },
      { protocol: 'OQ-1005', asset: 'Deicer Truck', scope: 'Fluid temperature, nozzle flow and boom interlock sequence', status: 'Approved', tests_total: 31 },
      { protocol: 'IQ-1006', asset: 'Ground Power Unit', scope: '400 Hz output cable and connector head installation verification', status: 'Approved', tests_total: 19 },
      { protocol: 'OQ-1007', asset: 'Ground Power Unit', scope: 'Output voltage and frequency regulation under aircraft load', status: 'In Execution', tests_total: 27 },
      { protocol: 'PQ-1008', asset: 'PCA / Preconditioned Air', scope: 'Discharge temperature and airflow across three flight banks', status: 'Draft', tests_total: 24 },
      { protocol: 'IQ-1009', system: 'Ramp handheld terminals', scope: 'Device build, network join and QR label scan verification', status: 'Approved', tests_total: 16 },
    ],

    // Controlled documents. The generic vault is mostly right for any
    // maintenance department; the rows that named UK registers are replaced
    // with the ones this shop keeps.
    vaultDocuments: [
      { document_name: 'Maintenance Policy', classification: 'Controlled', retention_years: 7, status: 'Approved', site: null },
      { document_name: 'GSE Fleet Management Plan', classification: 'Controlled', retention_years: 7, status: 'Approved', site: null },
      { document_name: 'Safety and Health Policy Statement', classification: 'Public', retention_years: 5, status: 'Approved', site: null },
      { document_name: 'Hot Work Permit Procedure', classification: 'Controlled', retention_years: 7, status: 'Approved', site: 'site_01' },
      { document_name: 'Lockout / Tagout Procedure (OSHA 1910.147)', classification: 'Controlled', retention_years: 7, status: 'Approved', site: 'site_01' },
      { document_name: 'Test Equipment Calibration Procedure', classification: 'Controlled', retention_years: 5, status: 'Approved', site: 'site_01' },
      { document_name: 'Spare Parts Control Procedure', classification: 'Controlled', retention_years: 5, status: 'In Review', site: 'site_01' },
      { document_name: 'Contractor and Airside Escort Procedure', classification: 'Controlled', retention_years: 7, status: 'Approved', site: 'site_01' },
      { document_name: 'Deicing Fluid Spill Response Plan', classification: 'Controlled', retention_years: 10, status: 'Approved', site: 'site_01' },
      { document_name: 'Internal Audit Procedure', classification: 'Controlled', retention_years: 5, status: 'Approved', site: null },
      { document_name: 'Corrective and Preventive Action Procedure', classification: 'Controlled', retention_years: 5, status: 'Approved', site: null },
      { document_name: 'Document Control Procedure', classification: 'Controlled', retention_years: 5, status: 'Draft', site: null },
      { document_name: 'Operator Training and Authorization Matrix', classification: 'Confidential', retention_years: 6, status: 'Approved', site: 'site_01' },
      { document_name: 'Risk Register', classification: 'Confidential', retention_years: 10, status: 'Approved', site: 'site_01' },
      { document_name: 'Equipment Certification Register', classification: 'Controlled', retention_years: 10, status: 'Approved', site: 'site_01' },
      { document_name: 'SPCC Plan and Stormwater Pollution Prevention Plan', classification: 'Public', retention_years: 10, status: 'In Review', site: 'site_01' },
    ],

    // ── certificates and isolation ──────────────────────────────────────────
    //
    // Which certificate a unit carries follows from what the unit is, as in the
    // generic table: a loader or a lift is load tested, a truck under 1910.178
    // is inspected under it, a road-going unit carries its DOT sticker, and a
    // piece of test equipment is calibrated. Anything the table does not name —
    // dollies, carts, stands — gets the annual structural inspection.
    certificates: {
      byKind: {
        'Baggage Tractor': ['Powered industrial truck inspection (OSHA 1910.178)'],
        'Cargo Tractor / Bobtail': ['Powered industrial truck inspection (OSHA 1910.178)', 'DOT annual vehicle inspection'],
        'Belt Loader': ['Powered industrial truck inspection (OSHA 1910.178)', 'Annual load test certificate'],
        'ULD / Pallet Cargo Loader': ['Annual load test certificate', 'Annual load test certificate', 'Powered industrial truck inspection (OSHA 1910.178)'],
        'Pushback Tractor': ['Powered industrial truck inspection (OSHA 1910.178)'],
        'Towbarless Tractor': ['Powered industrial truck inspection (OSHA 1910.178)', 'Annual load test certificate'],
        'Forklift / Pallet Jack Powered': ['Powered industrial truck inspection (OSHA 1910.178)'],
        'Scissor Lift / Maintenance Stand Powered': ['Annual load test certificate'],
        'Deicer Truck': ['Deicer boom structural certification', 'Deicer boom structural certification', 'DOT annual vehicle inspection'],
        'Snow Plow Truck': ['DOT annual vehicle inspection'],
        'Lavatory Service Truck': ['DOT annual vehicle inspection'],
        'Potable Water Truck': ['DOT annual vehicle inspection'],
        'Crew / Ramp Vehicle': ['DOT annual vehicle inspection'],
        'Ground Power Unit': ['Calibration certificate'],
        'GPU Load Bank': ['Calibration certificate'],
        'Hydraulic Load Tester': ['Calibration certificate'],
        'Battery Load Tester': ['Calibration certificate'],
        'Torque Wrench Set': ['Calibration certificate'],
        'Alignment / Tracking Gauge': ['Calibration certificate'],
        'Diagnostic Scan Tool': ['Calibration certificate'],
        'Passenger Stairs (towable)': ['Annual load test certificate'],
        'Work Stand / Maintenance Dock': ['Annual load test certificate'],
      },
      fallback: 'Annual structural inspection',
      validityDays: {
        'Powered industrial truck inspection (OSHA 1910.178)': 365,
        'Annual load test certificate': 365,
        'Deicer boom structural certification': 365,
        'DOT annual vehicle inspection': 365,
        'Calibration certificate': 365,
        'Annual structural inspection': 365,
      },
      // In-house appears where a qualified mechanic may sign; a boom
      // certification is bought in from the OEM's service arm.
      issuers: {
        'Powered industrial truck inspection (OSHA 1910.178)': ['In-house', 'In-house', 'ITW GSE Service'],
        'Annual load test certificate': ['JBT AeroTech Service', 'ITW GSE Service', 'In-house'],
        'Deicer boom structural certification': ['Global Ground Support', 'JBT AeroTech Service'],
        'DOT annual vehicle inspection': ['In-house', 'Cummins Central Power'],
        'Calibration certificate': ['In-house', 'Transcat', 'Transcat'],
        'Annual structural inspection': ['In-house'],
      },
      codes: {
        'Powered industrial truck inspection (OSHA 1910.178)': 'PIT',
        'Annual load test certificate': 'LDT',
        'Deicer boom structural certification': 'DBC',
        'DOT annual vehicle inspection': 'DOT',
        'Calibration certificate': 'CAL',
        'Annual structural inspection': 'STR',
      },
      issuerCodes: {
        'In-house': 'CVG', 'ITW GSE Service': 'ITW', 'JBT AeroTech Service': 'JBT',
        'Global Ground Support': 'GGS', 'Cummins Central Power': 'CCP', Transcat: 'TRC',
      },
    },

    // The energy each unit has to be made safe from, isolation first. There is
    // no MCC on a ramp: a unit is isolated at its own battery master or
    // connector, and the hazard that hurts mechanics is the raised boom.
    energySources: {
      byKind: {
        'Baggage Tractor': ['Electrical — battery master switch', 'Stored energy — spring parking brake', 'Gravity — unit raised on jack stands'],
        'Cargo Tractor / Bobtail': ['Electrical — chassis battery disconnect', 'Stored energy — air brake reservoir', 'Chemical — diesel fuel supply'],
        'Belt Loader': ['Electrical — battery master switch', 'Hydraulic — boom lift circuit', 'Gravity — raised conveyor boom'],
        'ULD / Pallet Cargo Loader': ['Electrical — battery master switch', 'Hydraulic — platform lift circuit', 'Gravity — raised bridge platform'],
        'Pushback Tractor': ['Electrical — battery master switch', 'Hydraulic — steering and hitch circuit', 'Stored energy — spring brake'],
        'Towbarless Tractor': ['Electrical — battery master switch', 'Hydraulic — nose-wheel cradle clamp', 'Gravity — raised cradle'],
        'Ground Power Unit': ['Electrical — 400 Hz output and start battery', 'Thermal — exhaust and turbo', 'Chemical — diesel fuel supply'],
        'Air Start Unit': ['Electrical — engine start battery', 'Pneumatic — bleed air duct', 'Thermal — exhaust'],
        'PCA / Preconditioned Air': ['Electrical — 480V supply disconnect', 'Chemical — refrigerant circuit', 'Stored energy — blower inertia'],
        'Deicer Truck': ['Electrical — chassis battery disconnect', 'Thermal — glycol heater', 'Gravity — raised boom and basket'],
        'Forklift / Pallet Jack Powered': ['Electrical — battery connector', 'Hydraulic — mast circuit', 'Gravity — raised forks'],
        'Scissor Lift / Maintenance Stand Powered': ['Electrical — battery connector', 'Hydraulic — lift cylinder', 'Gravity — raised platform'],
        'Mobile GSE Charger Cart': ['Electrical — 480V input disconnect', 'Electrical — DC output capacitors'],
        'Snow Plow Truck': ['Electrical — chassis battery disconnect', 'Hydraulic — plow lift circuit', 'Gravity — raised plow blade'],
      },
      fallback: ['Electrical — battery master switch'],
    },

    // ── words on the forms and the auditor ──────────────────────────────────
    placeholders: {
      asset: 'Belt Loader 0142',
      pmSchedule: 'Belt loader — 250-hour service',
      shutdown: 'Deicer fleet pre-season overhaul',
      checklist: 'Daily operator walkaround',
      checklistName: 'e.g. Belt loader weekly mechanic check',
      checklistPurpose: 'Describe the purpose and scope of this checklist — which units or zones it covers, what a mechanic has to establish, and what takes a unit off the ramp.',
      checklistStandard: 'e.g. OSHA 29 CFR 1910.178(q)(7)',
      sectionName: 'e.g. Conveyor and boom',
      subSectionName: 'e.g. Hydraulic lift circuit',
      itemDescription: 'e.g. Conveyor belt tracks centrally at full speed',
      unit: 'e.g. psi, V, Hz',
    },

    // The auditor's advice, where the generic wording talks about machines
    // and condition surveys. Keyed by check id; checks not named keep theirs.
    auditorFixes: {
      'paused-critical': 'Restart the schedule or move the unit off the critical list. A paused plan on an aircraft-contact unit is an unrecorded risk.',
      'poor-health-no-work': 'Book a mechanic check. A falling health score with nothing planned against it is how a unit goes unserviceable in the middle of a flight bank instead of in the shop.',
      'duplicate-names': 'Rename so each unit is unique at the station — otherwise work gets booked against whichever one appeared first in the list.',
      'never-inspected': 'Add them to an operator walkaround or a mechanic check. A unit nobody looks at only reports its condition by failing on the ramp.',
      'no-documents': 'Upload the OEM manual and wiring diagram. This is the difference between a two-hour repair and a unit parked through the night sort.',
    },

    // Parts proposed from the words in a new work order. The names are stock
    // descriptions from the parts master, so a match is always a real line.
    partSignals: [
      { match: /conveyor belt|belt slip/i, name: 'Conveyor belt 24 in x 49 ft laced' },
      { match: /roller/i, name: 'Conveyor roller 24 in' },
      { match: /brake/i, name: 'Universal GSE disc pad set' },
      { match: /filter/i, name: 'Engine oil filter 250-hr GSE' },
      { match: /seal|weep|cylinder/i, name: 'Hydraulic cylinder seal kit' },
      { match: /hydraulic|oil leak/i, name: 'AW-46 hydraulic oil (gal)' },
      { match: /hose/i, name: 'Hydraulic hose 1/2 in x 24 in' },
      { match: /alternator|charging/i, name: '24V 100A alternator' },
      { match: /starter|will not start|won.t start/i, name: '24V starter motor' },
      { match: /tyre|tire/i, name: 'GSE tire 6.50-10 solid/pneumatic' },
      { match: /shear pin|tow ?bar/i, name: 'Towbar shear pin 737/A320' },
      { match: /gpu|400 ?hz/i, name: 'GPU output cable 400 Hz' },
      { match: /beacon/i, name: 'Amber beacon LED' },
      { match: /deice|nozzle|glycol/i, name: 'Deice nozzle assembly' },
      { match: /chain/i, name: 'Roller chain conveyor drive' },
    ],
  },
}
