// Hospital fire & life safety — an acute-care hospital's facilities department.
//
// Built for the enquiry that came in from the hospital fire & life safety
// article: inspection audit trail, document upload, equipment and labour
// tracking. The article's own argument is the brief. The Joint Commission
// finding a hospital fears is rarely a failed system — it is a record that
// cannot be produced: the fire door inspection nobody can find, the sprinkler
// head replacement with no completion date, the generator load test that was
// done and never written down in a retrievable form.
//
// WHAT IS REAL AND WHAT IS MODELLED. The hospital is fictional — no real
// organisation's name, estate or records. The systems, the standards they are
// tested under (NFPA 72, 25, 110, 101, 80, 99) and the Joint Commission
// standards that ask for the evidence are real, and the test intervals are the
// ones those codes set. Everything else — the asset mix, the people, the
// contractors — is modelled, and nothing here should be read as any hospital's
// actual compliance position.
//
// WHY THE KIND LIST REPEATS. data.js draws an asset's type uniformly from this
// list, and a hospital does not own one smoke detector per fire pump. Devices
// are listed several times and plant once, which is the weighting.
//
// The people are the eight names every pack uses — other modules reference them
// by name — with life-safety trades.

export default {
  key: 'hospital-fls',
  label: 'Riverside Regional — hospital life safety',

  org: {
    organization_name: 'Riverside Regional Medical Center',
    organization_code: 'RRMC',
    industry: 'Acute care hospital — facilities & life safety',
    address: '2200 Riverside Parkway',
    city: 'Dayton',
    country: 'United States',
    timezone: 'America/New_York',
    currency: 'USD',
    currency_symbol: '$',
  },

  user: {
    name: 'Dana Whitfield',
    email: 'dana.whitfield@riversideregional.example',
    mobile: '+1 937 555 0164',
    role_name: 'Director of Facilities & Life Safety',
    initials: 'DW',
  },

  sites: [
    { site_id: 'site_01', site_name: 'Main Campus', code: 'RRM', city: 'Dayton OH', country: 'United States', is_default: true },
    { site_id: 'site_02', site_name: 'Outpatient Pavilion', code: 'OPP', city: 'Kettering OH', country: 'United States', is_default: false },
    { site_id: 'site_03', site_name: 'Rehabilitation Hospital', code: 'RRH', city: 'Beavercreek OH', country: 'United States', is_default: false },
  ],

  locations: [
    { functional_location_id: 'loc_01', name: 'Central Energy Plant', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_02', name: 'Generator Yard', site_id: 'site_01', parent_id: 'loc_01', level: 2 },
    { functional_location_id: 'loc_03', name: 'Fire Pump Room', site_id: 'site_01', parent_id: 'loc_01', level: 2 },
    { functional_location_id: 'loc_04', name: 'Surgical Tower', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_05', name: 'Emergency Department', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_06', name: 'Patient Tower — North', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_07', name: 'Medical Gas Manifold Room', site_id: 'site_01', parent_id: 'loc_01', level: 2 },
    { functional_location_id: 'loc_08', name: 'Fire Command Center', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_09', name: 'Clinics & Imaging', site_id: 'site_02', parent_id: null, level: 1 },
    { functional_location_id: 'loc_10', name: 'Ambulatory Surgery', site_id: 'site_02', parent_id: null, level: 1 },
    { functional_location_id: 'loc_11', name: 'Mechanical Room', site_id: 'site_02', parent_id: null, level: 1 },
    { functional_location_id: 'loc_12', name: 'Inpatient Rehab Unit', site_id: 'site_03', parent_id: null, level: 1 },
    { functional_location_id: 'loc_13', name: 'Therapy Gym', site_id: 'site_03', parent_id: null, level: 1 },
    { functional_location_id: 'loc_14', name: 'Plant Room', site_id: 'site_03', parent_id: null, level: 1 },
  ],

  assetCount: 150,
  assetKinds: [
    // Fire alarm and detection — NFPA 72
    'Fire Alarm Control Panel',
    'Smoke Detector', 'Smoke Detector', 'Smoke Detector', 'Smoke Detector', 'Smoke Detector', 'Smoke Detector',
    'Heat Detector', 'Heat Detector',
    'Manual Pull Station', 'Manual Pull Station', 'Manual Pull Station',
    'Horn/Strobe Notification Device', 'Horn/Strobe Notification Device', 'Horn/Strobe Notification Device', 'Horn/Strobe Notification Device',
    // Suppression — NFPA 25
    'Sprinkler Riser', 'Sprinkler Riser', 'Fire Pump', 'Kitchen Hood Suppression System',
    // Emergency power — NFPA 110
    'Emergency Generator', 'Automatic Transfer Switch', 'Automatic Transfer Switch', 'UPS',
    // Egress and building features — NFPA 101 / 80 / 105
    'Exit Sign', 'Exit Sign', 'Exit Sign', 'Exit Sign', 'Exit Sign',
    'Emergency Lighting Unit', 'Emergency Lighting Unit', 'Emergency Lighting Unit', 'Emergency Lighting Unit',
    'Fire Door Assembly', 'Fire Door Assembly', 'Fire Door Assembly', 'Fire Door Assembly', 'Fire Door Assembly', 'Fire Door Assembly',
    'Fire/Smoke Damper', 'Fire/Smoke Damper', 'Fire/Smoke Damper',
    // Medical gas and vacuum — NFPA 99
    'Medical Gas Alarm Panel', 'Medical Gas Alarm Panel', 'Zone Valve Box', 'Zone Valve Box', 'Zone Valve Box',
    'Medical Air Compressor',
    // Nurse call
    'Nurse Call Master Station',
    // Portable extinguishers — NFPA 10. The most numerous life safety device in
    // any hospital and the first one a surveyor walks up to, because the tag on
    // the bracket either has this month's initials on it or it does not.
    'Fire Extinguisher', 'Fire Extinguisher', 'Fire Extinguisher', 'Fire Extinguisher',
    'Fire Extinguisher', 'Fire Extinguisher', 'Fire Extinguisher', 'Fire Extinguisher',
  ],
  makers: [
    'Notifier', 'Simplex', 'Edwards EST', 'Siemens', 'Viking', 'Tyco', 'Kohler',
    'Caterpillar', 'ASCO', 'Eaton', 'BeaconMedaes', 'Amico', 'Rauland',
    'Amerex', 'Ansul', 'Kidde',
  ],

  workOrderCount: 90,
  tasks: [
    'Annual fire alarm inspection — initiating device and notification appliance test',
    'Smoke detector failed sensitivity test — replace head',
    'Fire alarm panel trouble signal — ground fault on NAC circuit',
    'Quarterly sprinkler inspection — gauges, valves and alarm devices',
    'Sprinkler head painted over in corridor — replace',
    'Fire pump weekly churn test',
    'Fire pump annual flow test with contractor',
    'Generator monthly load test — 30 minutes at 30% of nameplate',
    'Generator annual load bank test',
    'ATS failed to transfer within 10 seconds — investigate',
    'Exit sign battery failed 30-second test — replace battery',
    'Emergency lighting 90-minute annual test',
    'Fire door failed to latch — adjust closer and latch hardware',
    'Fire door inspection — gap at meeting stiles exceeds 1/8 inch',
    'Fire/smoke damper inspection and drop test',
    'Medical gas master alarm — low pressure signal test',
    'Zone valve box label and access inspection',
    'Kitchen hood suppression semiannual inspection',
    'Nurse call pull cord not annunciating at master station',
  ],

  partCount: 50,
  partNames: [
    'Photoelectric Smoke Detector Head', 'Heat Detector 135°F', 'Horn/Strobe Wall Mount',
    'Manual Pull Station Dual Action', 'Fire Alarm Panel Battery 12V 18Ah', 'NAC Power Supply Board',
    'Sprinkler Head Pendent 155°F', 'Sprinkler Head Sidewall 200°F', 'Sprinkler Escutcheon',
    'Fire Pump Packing Set', 'Pressure Gauge 0-300 psi', 'Tamper Switch OS&Y',
    'Generator Oil Filter', 'Generator Fuel Filter', 'Generator Starting Battery',
    'Block Heater Element', 'ATS Controller Module', 'Exit Sign LED Battery Pack',
    'Emergency Light Battery 6V', 'Door Closer Grade 1', 'Fire Door Latch Set',
    'Fire-Rated Door Gasket', 'Fusible Link 165°F', 'Damper Actuator 24V',
    'Medical Gas Alarm Sensor — O2', 'Zone Valve Ball Valve 1in', 'Nurse Call Pull Cord Station',
  ],

  technicians: [
    { user_id: 'usr_t01', name: 'Daniel Reeve', role: 'Technician', trade: 'Fire Alarm' },
    { user_id: 'usr_t02', name: 'Tom Whelan', role: 'Technician', trade: 'Electrical / Emergency Power' },
    { user_id: 'usr_t03', name: 'Sara Kovac', role: 'Technician', trade: 'Medical Gas' },
    { user_id: 'usr_t04', name: 'Marcus Bell', role: 'Supervisor', trade: 'Life Safety' },
    { user_id: 'usr_t05', name: 'Ellie Brandt', role: 'Technician', trade: 'Electrical / Emergency Power' },
    { user_id: 'usr_t06', name: 'Owen Marsh', role: 'Technician', trade: 'Doors & Building Features' },
    { user_id: 'usr_t07', name: 'Grace Holloway', role: 'Planner', trade: 'Compliance Planning' },
    { user_id: 'usr_t08', name: 'Victor Lang', role: 'Technician', trade: 'Sprinkler & Suppression' },
  ],

  // The contractors a hospital's life safety programme actually leans on —
  // certified testing is largely bought in.
  vendorNames: [
    'Summit Fire Protection', 'Keystone Fire Alarm Services', 'Midwest Generator Service',
    'Allied Door Inspection Group', 'Precision Medical Gas Certification', 'Tri-State Damper Testing',
    'Buckeye Sprinkler Co', 'Clearview Nurse Call Systems', 'Cardinal Extinguisher Service',
  ],

  domain: {
    key: 'fls',
    label: 'Life Safety',
    subtitle: 'NFPA testing, evidence and Joint Commission survey readiness',
    icon: 'fls',
    sections: [
      // First, because it is the page to open when somebody asks whether the
      // hospital can produce its records. It owns nothing — the four screens
      // behind it do.
      { key: 'fls-evidence', label: 'Evidence & Records', kw: 'audit trail document upload evidence certificate report equipment asset labour contractor hours who performed produce records surveyor binder' },
      { key: 'fls-compliance', label: 'Testing & Inspection', kw: 'nfpa 72 25 110 101 80 99 10 fire alarm sprinkler generator load test exit emergency lighting fire door damper medical gas extinguisher test frequency due overdue' },
      { key: 'fls-ilsm', label: 'Impairments & ILSM', kw: 'ilsm interim life safety measures impairment sprinkler out of service fire watch construction hot work tag notify ahj compensating measure nfpa 25 15.5 ec.02.03.03' },
      { key: 'fls-soc', label: 'Statement of Conditions', kw: 'esoc statement of conditions pfi plan for improvement deficiency life safety code nfpa 101 ls.01.01.01 basic building information target date' },
      { key: 'fls-survey', label: 'Survey Readiness', kw: 'joint commission survey readiness environment of care ec.02.03.05 ec.02.05.07 ec.02.05.09 life safety ls evidence documentation record produce binder' },
    ],

    // Plant that runs on hours. Everything else here is tested on a calendar.
    poweredKinds: ['Emergency Generator', 'Fire Pump', 'Medical Air Compressor'],

    systems: [
      { key: 'alarm', label: 'Fire alarm & detection', standard: 'NFPA 72', kinds: ['Fire Alarm Control Panel', 'Smoke Detector', 'Heat Detector', 'Manual Pull Station', 'Horn/Strobe Notification Device'] },
      { key: 'suppression', label: 'Sprinklers & suppression', standard: 'NFPA 25', kinds: ['Sprinkler Riser', 'Fire Pump', 'Kitchen Hood Suppression System'] },
      { key: 'power', label: 'Emergency power', standard: 'NFPA 110', kinds: ['Emergency Generator', 'Automatic Transfer Switch', 'UPS'] },
      { key: 'egress', label: 'Egress & building features', standard: 'NFPA 101 / 80', kinds: ['Exit Sign', 'Emergency Lighting Unit', 'Fire Door Assembly', 'Fire/Smoke Damper'] },
      { key: 'medgas', label: 'Medical gas & vacuum', standard: 'NFPA 99', kinds: ['Medical Gas Alarm Panel', 'Zone Valve Box', 'Medical Air Compressor'] },
      { key: 'nursecall', label: 'Nurse call', standard: 'UL 1069', kinds: ['Nurse Call Master Station'] },
      { key: 'portable', label: 'Portable extinguishers', standard: 'NFPA 10', kinds: ['Fire Extinguisher'] },
    ],

    // Each recurring test, the code that sets it, how often, the evidence a
    // surveyor expects to see, and who usually performs it. `kinds` narrows a
    // system's assets to the ones the test is actually run on.
    //
    // `Record` means the test log in the CMMS is the evidence — a weekly fire
    // pump churn or a monthly generator run is documented by the completed
    // record, not by a PDF somebody uploads. `Report` and `Certificate` are
    // paperwork from bought-in work, and have to be in the document register.
    tests: [
      { key: 'fa-annual', system: 'alarm', label: 'Fire alarm system annual inspection & test', standard: 'NFPA 72', every: 365, evidence: 'Report', who: 'Contractor' },
      { key: 'fa-battery', system: 'alarm', label: 'Panel secondary power (battery) test', standard: 'NFPA 72', every: 182, evidence: 'Record', who: 'In-house', kinds: ['Fire Alarm Control Panel'] },
      { key: 'sp-quarterly', system: 'suppression', label: 'Sprinkler quarterly inspection — valves, gauges, alarm devices', standard: 'NFPA 25', every: 91, evidence: 'Record', who: 'In-house', kinds: ['Sprinkler Riser'] },
      { key: 'fp-weekly', system: 'suppression', label: 'Fire pump weekly churn test', standard: 'NFPA 25', every: 7, evidence: 'Record', who: 'In-house', kinds: ['Fire Pump'] },
      { key: 'fp-annual', system: 'suppression', label: 'Fire pump annual flow test', standard: 'NFPA 25', every: 365, evidence: 'Certificate', who: 'Contractor', kinds: ['Fire Pump'] },
      { key: 'kh-semi', system: 'suppression', label: 'Kitchen hood suppression semiannual inspection', standard: 'NFPA 96 / 17A', every: 182, evidence: 'Certificate', who: 'Contractor', kinds: ['Kitchen Hood Suppression System'] },
      { key: 'gen-monthly', system: 'power', label: 'Generator monthly load test — 30 minutes', standard: 'NFPA 110', every: 30, evidence: 'Record', who: 'In-house', kinds: ['Emergency Generator'] },
      { key: 'ats-monthly', system: 'power', label: 'Automatic transfer switch monthly test', standard: 'NFPA 110', every: 30, evidence: 'Record', who: 'In-house', kinds: ['Automatic Transfer Switch'] },
      { key: 'gen-loadbank', system: 'power', label: 'Generator annual load bank test', standard: 'NFPA 110', every: 365, evidence: 'Report', who: 'Contractor', kinds: ['Emergency Generator'] },
      { key: 'el-monthly', system: 'egress', label: 'Exit & emergency lighting 30-second test', standard: 'NFPA 101', every: 30, evidence: 'Record', who: 'In-house', kinds: ['Exit Sign', 'Emergency Lighting Unit'] },
      { key: 'el-annual', system: 'egress', label: 'Exit & emergency lighting 90-minute annual test', standard: 'NFPA 101', every: 365, evidence: 'Record', who: 'In-house', kinds: ['Exit Sign', 'Emergency Lighting Unit'] },
      { key: 'fd-annual', system: 'egress', label: 'Fire door assembly annual inspection', standard: 'NFPA 80', every: 365, evidence: 'Report', who: 'Contractor', kinds: ['Fire Door Assembly'] },
      { key: 'damper', system: 'egress', label: 'Fire/smoke damper inspection & operational test', standard: 'NFPA 80 / 105', every: 2190, evidence: 'Report', who: 'Contractor', kinds: ['Fire/Smoke Damper'] },
      { key: 'mg-alarm', system: 'medgas', label: 'Medical gas alarm panel & zone valve inspection', standard: 'NFPA 99', every: 365, evidence: 'Certificate', who: 'Contractor', kinds: ['Medical Gas Alarm Panel', 'Zone Valve Box'] },
      { key: 'mg-compressor', system: 'medgas', label: 'Medical air compressor quarterly maintenance', standard: 'NFPA 99', every: 91, evidence: 'Record', who: 'In-house', kinds: ['Medical Air Compressor'] },
      { key: 'nc-annual', system: 'nursecall', label: 'Nurse call system functional test', standard: 'UL 1069', every: 365, evidence: 'Record', who: 'In-house' },
      // NFPA 10's four clocks on one extinguisher. They run at once and on
      // different scales — a monthly walk-round the hospital does itself, and a
      // hydrostatic test twelve years apart — which is why an extinguisher
      // programme fails on the interval nobody was tracking rather than on the
      // one everybody knows.
      { key: 'ext-monthly', system: 'portable', label: 'Extinguisher monthly inspection — pressure, seal, access, signage', standard: 'NFPA 10', every: 30, evidence: 'Record', who: 'In-house' },
      { key: 'ext-annual', system: 'portable', label: 'Extinguisher annual maintenance & retag', standard: 'NFPA 10', every: 365, evidence: 'Report', who: 'Contractor' },
      { key: 'ext-internal', system: 'portable', label: 'Extinguisher 6-year internal examination', standard: 'NFPA 10', every: 2190, evidence: 'Report', who: 'Contractor' },
      { key: 'ext-hydro', system: 'portable', label: 'Extinguisher 12-year hydrostatic test', standard: 'NFPA 10', every: 4380, evidence: 'Certificate', who: 'Contractor' },
    ],

    // The Joint Commission standards a surveyor asks the evidence for, and the
    // tests whose records answer each. Standard numbers only — element-of-
    // performance numbering changes between manuals, and a wrong EP cited to a
    // hospital is worse than none.
    surveyElements: [
      { key: 'ec-fire-mgmt', standard: 'EC.02.03.01', title: 'Fire safety management — the organisation minimises fire risk', tests: ['fa-annual', 'fd-annual'] },
      { key: 'ec-fire-equipment', standard: 'EC.02.03.05', title: 'Fire safety equipment and building features are maintained and tested', tests: ['fa-annual', 'fa-battery', 'sp-quarterly', 'fp-weekly', 'fp-annual', 'kh-semi', 'ext-monthly', 'ext-annual', 'ext-internal', 'ext-hydro'] },
      { key: 'ec-emergency-power', standard: 'EC.02.05.07', title: 'Emergency power systems are inspected, tested and maintained', tests: ['gen-monthly', 'ats-monthly', 'gen-loadbank', 'el-monthly', 'el-annual'] },
      { key: 'ec-medgas', standard: 'EC.02.05.09', title: 'Medical gas and vacuum systems are inspected, tested and maintained', tests: ['mg-alarm', 'mg-compressor'] },
      { key: 'ls-features', standard: 'LS.02.01.10 / .30', title: 'Building and fire protection features are designed and maintained', tests: ['fd-annual', 'damper'] },
    ],

    // Test reports and certificates already in the document register. Each is
    // filed against the first asset of its kind, so the register and the survey
    // screen point at the same paperwork. `daysAgo` is when it was issued and
    // `validDays` how long it stands.
    documents: [
      { name: 'Fire alarm annual inspection & test report', category: 'Report', type: 'PDF', assetKind: 'Fire Alarm Control Panel', daysAgo: 118, validDays: 365, test: 'fa-annual' },
      { name: 'Fire pump annual flow test certificate', category: 'Certificate', type: 'PDF', assetKind: 'Fire Pump', daysAgo: 402, validDays: 365, test: 'fp-annual' },
      { name: 'Generator annual load bank test report', category: 'Report', type: 'PDF', assetKind: 'Emergency Generator', daysAgo: 64, validDays: 365, test: 'gen-loadbank' },
      { name: 'Fire door assembly inspection report', category: 'Report', type: 'PDF', assetKind: 'Fire Door Assembly', daysAgo: 211, validDays: 365, test: 'fd-annual' },
      { name: 'Medical gas verification certificate', category: 'Certificate', type: 'PDF', assetKind: 'Medical Gas Alarm Panel', daysAgo: 330, validDays: 365, test: 'mg-alarm' },
      { name: 'Kitchen hood suppression inspection certificate', category: 'Certificate', type: 'PDF', assetKind: 'Kitchen Hood Suppression System', daysAgo: 150, validDays: 182, test: 'kh-semi' },
      { name: 'Fire/smoke damper inspection report', category: 'Report', type: 'PDF', assetKind: 'Fire/Smoke Damper', daysAgo: 900, validDays: 2190, test: 'damper' },
      { name: 'Extinguisher annual maintenance & retag report', category: 'Report', type: 'PDF', assetKind: 'Fire Extinguisher', daysAgo: 96, validDays: 365, test: 'ext-annual' },
      { name: 'Extinguisher 6-year internal examination report', category: 'Report', type: 'PDF', assetKind: 'Fire Extinguisher', daysAgo: 2240, validDays: 2190, test: 'ext-internal' },
    ],

    // ── Interim life safety measures ────────────────────────────────────────
    //
    // A hospital does not close when its sprinklers do. The building stays
    // occupied — patients in beds, some of whom cannot walk — so when a life
    // safety feature goes out of service the code and the surveyor both ask the
    // same question: what is in place instead, and who is documenting it.
    //
    // These are the compensating measures. `watch` is the one that is a duty
    // rather than a task: a fire watch is a person patrolling the affected area
    // and signing for each round, and the round log is the evidence. The rest
    // are confirmed once, when the impairment is declared.
    ilsmMeasures: [
      { key: 'tag', short: 'Impairment tag on the valve or panel', label: 'Impairment tag placed at the control valve or panel', standard: 'NFPA 25 15.5.2', appliesTo: ['suppression', 'alarm'] },
      { key: 'notify', short: 'Fire department and AHJ notified', label: 'Fire department and authority having jurisdiction notified', standard: 'NFPA 101 4.6.10', appliesTo: ['suppression', 'alarm', 'egress', 'power'] },
      { key: 'watch', short: 'Fire watch, each round signed', label: 'Fire watch patrolling the affected area, each round signed', standard: 'NFPA 101 4.6.10.3', appliesTo: ['suppression', 'alarm'], watch: true, everyHours: 1 },
      { key: 'extinguishers', short: 'Extra extinguishers staged', label: 'Additional portable extinguishers staged in the area', standard: 'NFPA 10', appliesTo: ['suppression', 'alarm'] },
      { key: 'signage', short: 'Temporary exit signage up', label: 'Temporary signage for the affected exits and routes', standard: 'NFPA 101 7.10', appliesTo: ['egress', 'alarm'] },
      { key: 'egress', short: 'Egress routes inspected daily', label: 'Exits and egress routes in the area inspected daily', standard: 'NFPA 101 7.1', appliesTo: ['egress', 'suppression', 'alarm', 'power'] },
      { key: 'training', short: 'Staff briefed on the response plan', label: 'Affected staff briefed on the impairment and the fire response plan', standard: 'EC.02.03.03', appliesTo: ['suppression', 'alarm', 'egress', 'power', 'medgas'] },
      { key: 'hotwork', short: 'Hot work permit in force', label: 'Hot work permit and post-work watch in force', standard: 'NFPA 51B', appliesTo: ['suppression', 'alarm', 'egress'] },
    ],

    // Impairments the demo opens with. One is being run properly and one is
    // not, because the screen's job is to tell them apart: the fire watch on
    // the second has not been signed for since the shift before last.
    impairments: [
      {
        key: 'imp-seed-1',
        system: 'suppression',
        assetKind: 'Sprinkler Riser',
        reason: 'Riser valve closed for corridor renovation — 4 North',
        cause: 'Construction',
        daysAgo: 5,
        expectedDays: 12,
        confirmed: ['tag', 'notify', 'extinguishers', 'egress', 'hotwork'],
        watchRounds: [1, 2, 3, 4, 5, 6],       // hours ago, most recent first
        declaredBy: 'Marcus Bell',
      },
      {
        key: 'imp-seed-2',
        system: 'alarm',
        assetKind: 'Fire Alarm Control Panel',
        reason: 'Panel on bypass while notification circuit board is replaced',
        cause: 'Planned maintenance',
        daysAgo: 1,
        expectedDays: 2,
        confirmed: ['tag', 'notify'],
        watchRounds: [14, 15, 16],
        declaredBy: 'Daniel Reeve',
      },
    ],

    // ── Statement of Conditions ─────────────────────────────────────────────
    //
    // The Life Safety Code deficiencies a hospital is carrying, each with the
    // chapter that sets it and a plan to put it right. A surveyor reads the SOC
    // as the hospital's own account of what is wrong — so a deficiency listed
    // with a plan and a date is a programme working, and the same deficiency
    // found by the surveyor and absent from the list is a finding.
    pfiCodes: [
      'NFPA 101 8.3.3 — fire barrier penetration',
      'NFPA 101 8.5.6 — smoke barrier penetration',
      'NFPA 101 19.2.3.4 — egress width and corridor clearance',
      'NFPA 101 19.3.6.1 — corridor separation',
      'NFPA 101 19.7.5.1 — combustible decorations',
      'NFPA 101 7.9 — emergency lighting',
      'NFPA 101 7.10 — exit signage',
      'NFPA 80 5.2 — fire door assembly clearances',
      'NFPA 25 5.2.1 — sprinkler head condition and clearance',
      'NFPA 99 5.1 — medical gas system condition',
    ],
    // ── the obligation register, in this hospital's terms ──────────────────
    //
    // The generic register is UK statutory work — LOLER, PUWER, COSHH, an EICR.
    // None of it is what an American hospital is surveyed against, and a
    // compliance dashboard showing a lifting examination to a facilities
    // director in Ohio is the kind of detail that ends a demo early. These are
    // the programmes a hospital actually carries, with two late and two inside
    // the warning window, because the shape of the register is what the
    // dashboard is for.
    //
    // `due_in` is days from today; negative is overdue.
    obligations: [
      { title: 'Joint Commission EC.02.03.05 — fire safety equipment testing record', area: 'Joint Commission', frequency: 'Annual', site: null, due_in: 74 },
      { title: 'Statement of Conditions review and PFI update', area: 'Life Safety Code', frequency: 'Six-monthly', site: null, due_in: -12 },
      { title: 'Fire drills — one per shift per quarter', area: 'Fire Safety', frequency: 'Quarterly', site: 'site_01', due_in: 8 },
      { title: 'Interim life safety measures policy review', area: 'Life Safety Code', frequency: 'Annual', site: null, due_in: 141 },
      { title: 'Emergency operations plan — annual evaluation', area: 'Emergency Management', frequency: 'Annual', site: 'site_01', due_in: 96 },
      { title: 'Utility systems management plan review', area: 'Environment of Care', frequency: 'Annual', site: 'site_01', due_in: 23 },
      { title: 'Hazardous materials inventory and SDS review', area: 'Environment of Care', frequency: 'Annual', site: 'site_02', due_in: -31 },
      { title: 'Medical equipment inventory — risk categorisation', area: 'Medical Equipment', frequency: 'Annual', site: 'site_01', due_in: 187 },
      { title: 'Smoke barrier and compartment survey', area: 'Life Safety Code', frequency: 'Six-monthly', site: 'site_01', due_in: 52 },
      { title: 'Environment of care rounds — patient care areas', area: 'Environment of Care', frequency: 'Six-monthly', site: 'site_03', due_in: 19 },
      { title: 'Generator fuel quality test and inventory', area: 'Emergency Power', frequency: 'Annual', site: 'site_01', due_in: 118 },
      { title: 'Life safety drawings — accuracy verification', area: 'Life Safety Code', frequency: 'Annual', site: null, due_in: 246 },
    ],

    // ── the trail the demo opens with ───────────────────────────────────────
    //
    // A fortnight of life safety work as it would actually read: tests
    // completed, evidence filed, contractors booked, an impairment declared and
    // a deficiency listed. `hoursAgo` places each line, so the audit screen's
    // fortnight of activity has something in it on a fresh build — an empty
    // chart on a screen whose point is traceability is the wrong first
    // impression, and a build that has never been clicked has nothing else.
    auditLines: [
      { hoursAgo: 3, actor: 'Victor Lang', entity: 'Work Order', reference: 'WO-2588', action: 'status changed', detail: 'In Progress → Completed' },
      { hoursAgo: 4, actor: 'Victor Lang', entity: 'Labour', reference: 'WO-2588', action: 'created', detail: '—' },
      { hoursAgo: 9, actor: 'Grace Holloway', entity: 'Document', reference: 'Extinguisher annual maintenance & retag report', action: 'created', detail: '—' },
      { hoursAgo: 11, actor: 'Marcus Bell', entity: 'Impairment', reference: 'imp-seed-2', action: 'created', detail: '—' },
      { hoursAgo: 12, actor: 'Daniel Reeve', entity: 'Work Order', reference: 'WO-2579', action: 'assigned', detail: 'to Daniel Reeve' },
      { hoursAgo: 26, actor: 'Tom Whelan', entity: 'Work Order', reference: 'WO-2571', action: 'status changed', detail: 'Open → In Progress' },
      { hoursAgo: 27, actor: 'Tom Whelan', entity: 'Meter Reading', reference: 'Emergency Generator 01', action: 'created', detail: '—' },
      { hoursAgo: 33, actor: 'Marcus Bell', entity: 'Fire Watch Round', reference: 'imp-seed-1', action: 'created', detail: '—' },
      { hoursAgo: 38, actor: 'Grace Holloway', entity: 'Plan for Improvement', reference: 'pfi-seed-3', action: 'created', detail: '—' },
      { hoursAgo: 49, actor: 'Sara Kovac', entity: 'Work Order', reference: 'WO-2563', action: 'status changed', detail: 'In Progress → Completed' },
      { hoursAgo: 51, actor: 'Sara Kovac', entity: 'Inspection', reference: 'INS-1187', action: 'created', detail: '—' },
      { hoursAgo: 58, actor: 'Owen Marsh', entity: 'Work Order', reference: 'WO-2559', action: 'updated', detail: 'due date, priority' },
      { hoursAgo: 73, actor: 'Grace Holloway', entity: 'Document', reference: 'Fire door assembly inspection report', action: 'created', detail: '—' },
      { hoursAgo: 75, actor: 'Owen Marsh', entity: 'Labour', reference: 'WO-2551', action: 'created', detail: '—' },
      { hoursAgo: 80, actor: 'Marcus Bell', entity: 'Fire Watch Round', reference: 'imp-seed-1', action: 'created', detail: '—' },
      { hoursAgo: 96, actor: 'Ellie Brandt', entity: 'Work Order', reference: 'WO-2544', action: 'status changed', detail: 'Open → In Progress' },
      { hoursAgo: 104, actor: 'Grace Holloway', entity: 'Plan for Improvement', reference: 'pfi-seed-2', action: 'updated', detail: 'target date, owner' },
      { hoursAgo: 121, actor: 'Daniel Reeve', entity: 'Work Order', reference: 'WO-2536', action: 'status changed', detail: 'In Progress → Completed' },
      { hoursAgo: 123, actor: 'Daniel Reeve', entity: 'Asset', reference: 'RRM-FACP-001', action: 'updated', detail: 'status, last maintenance date' },
      { hoursAgo: 140, actor: 'Victor Lang', entity: 'Work Order', reference: 'WO-2528', action: 'status changed', detail: 'In Progress → Completed' },
      { hoursAgo: 146, actor: 'Grace Holloway', entity: 'Document', reference: 'Medical gas verification certificate', action: 'created', detail: '—' },
      { hoursAgo: 168, actor: 'Marcus Bell', entity: 'Work Order', reference: 'WO-2519', action: 'approved', detail: '—' },
      { hoursAgo: 171, actor: 'Sara Kovac', entity: 'Labour', reference: 'WO-2519', action: 'created', detail: '—' },
      { hoursAgo: 193, actor: 'Owen Marsh', entity: 'Inspection', reference: 'INS-1174', action: 'created', detail: '—' },
      { hoursAgo: 196, actor: 'Owen Marsh', entity: 'Work Order', reference: 'WO-2511', action: 'status changed', detail: 'Open → In Progress' },
      { hoursAgo: 214, actor: 'Ellie Brandt', entity: 'Meter Reading', reference: 'Fire Pump 01', action: 'created', detail: '—' },
      { hoursAgo: 238, actor: 'Grace Holloway', entity: 'Document', reference: 'Kitchen hood suppression inspection certificate', action: 'created', detail: '—' },
      { hoursAgo: 241, actor: 'Victor Lang', entity: 'Work Order', reference: 'WO-2498', action: 'status changed', detail: 'In Progress → Completed' },
      { hoursAgo: 262, actor: 'Marcus Bell', entity: 'Plan for Improvement', reference: 'pfi-seed-1', action: 'created', detail: '—' },
      { hoursAgo: 287, actor: 'Tom Whelan', entity: 'Work Order', reference: 'WO-2487', action: 'status changed', detail: 'In Progress → Completed' },
      { hoursAgo: 290, actor: 'Tom Whelan', entity: 'Labour', reference: 'WO-2487', action: 'created', detail: '—' },
      { hoursAgo: 311, actor: 'Daniel Reeve', entity: 'Work Order', reference: 'WO-2479', action: 'updated', detail: 'assigned to, estimated hours' },
      { hoursAgo: 334, actor: 'Grace Holloway', entity: 'Purchase Order', reference: 'PO-4471', action: 'approved', detail: '—' },
      { hoursAgo: 336, actor: 'Grace Holloway', entity: 'Purchase Order', reference: 'PO-4471', action: 'created', detail: '—' },
    ],

    // ── the contractors' own visits ─────────────────────────────────────────
    //
    // Certified life safety testing is bought in, and "who performed it" is the
    // first thing a surveyor asks — so the Contractors table cannot open empty
    // on a fresh build, and the tests these visits answer show their firm
    // rather than a modelled guess. `daysAgo` is when the visit happened.
    contractorVisits: [
      { daysAgo: 1, vendor: 'Cardinal Extinguisher Service', technician: 'R. Okafor', hours: 6, rate: 95, workOrder: 'WO-2588', title: 'Extinguisher annual maintenance & retag', assetKind: 'Fire Extinguisher', report: 'CES-88417' },
      { daysAgo: 3, vendor: 'Keystone Fire Alarm Services', technician: 'M. Delgado', hours: 8, rate: 128, workOrder: 'WO-2579', title: 'Fire alarm system annual inspection & test', assetKind: 'Fire Alarm Control Panel', report: 'KFA-20613' },
      { daysAgo: 4, vendor: 'Keystone Fire Alarm Services', technician: 'M. Delgado', hours: 7.5, rate: 128, workOrder: 'WO-2579', title: 'Fire alarm annual — devices, floors 3 to 6', assetKind: 'Fire Alarm Control Panel', report: 'KFA-20613' },
      { daysAgo: 6, vendor: 'Midwest Generator Service', technician: 'D. Pruitt', hours: 5, rate: 142, workOrder: 'WO-2571', title: 'Generator annual load bank test', assetKind: 'Emergency Generator', report: 'MGS-7741' },
      { daysAgo: 9, vendor: 'Allied Door Inspection Group', technician: 'J. Hartley', hours: 9, rate: 88, workOrder: 'WO-2563', title: 'Fire door assembly annual inspection', assetKind: 'Fire Door Assembly', report: 'ADI-3392' },
      { daysAgo: 10, vendor: 'Allied Door Inspection Group', technician: 'J. Hartley', hours: 6.5, rate: 88, workOrder: 'WO-2563', title: 'Fire door inspection — surgical tower', assetKind: 'Fire Door Assembly', report: 'ADI-3392' },
      { daysAgo: 12, vendor: 'Precision Medical Gas Certification', technician: 'A. Reyes', hours: 6, rate: 136, workOrder: 'WO-2551', title: 'Medical gas alarm panel & zone valve inspection', assetKind: 'Medical Gas Alarm Panel', report: 'PMG-1184' },
      { daysAgo: 16, vendor: 'Buckeye Sprinkler Co', technician: 'T. Nowak', hours: 4, rate: 112, workOrder: 'WO-2536', title: 'Sprinkler quarterly inspection — risers and valves', assetKind: 'Sprinkler Riser', report: 'BSC-5520' },
      { daysAgo: 21, vendor: 'Summit Fire Protection', technician: 'C. Whitmore', hours: 5.5, rate: 118, workOrder: 'WO-2519', title: 'Fire pump annual flow test', assetKind: 'Fire Pump', report: 'SFP-9067' },
      { daysAgo: 29, vendor: 'Tri-State Damper Testing', technician: 'L. Boone', hours: 12, rate: 104, workOrder: 'WO-2487', title: 'Fire/smoke damper inspection & drop test', assetKind: 'Fire/Smoke Damper', report: 'TSD-2214' },
      { daysAgo: 34, vendor: 'Clearview Nurse Call Systems', technician: 'P. Ibarra', hours: 4.5, rate: 98, workOrder: 'WO-2479', title: 'Nurse call system functional test', assetKind: 'Nurse Call Master Station', report: 'CNC-664' },
    ],

    pfis: [
      {
        key: 'pfi-seed-1',
        code: 'NFPA 101 8.5.6 — smoke barrier penetration',
        title: 'Unsealed cable penetration above the ceiling at the 3 East smoke barrier',
        locationName: 'Patient Tower — North',
        daysAgo: 41,
        targetDays: 90,
        ilsm: false,
        owner: 'Grace Holloway',
      },
      {
        key: 'pfi-seed-2',
        code: 'NFPA 80 5.2 — fire door assembly clearances',
        title: 'Gap at meeting stiles exceeds 1/8 inch on the OR corridor cross-corridor doors',
        locationName: 'Surgical Tower',
        daysAgo: 12,
        targetDays: 45,
        ilsm: false,
        owner: 'Owen Marsh',
      },
      {
        key: 'pfi-seed-3',
        code: 'NFPA 101 19.2.3.4 — egress width and corridor clearance',
        title: 'Equipment stored in the corridor reduces clear egress width below 8 feet',
        locationName: 'Emergency Department',
        daysAgo: 64,
        targetDays: 30,
        ilsm: true,
        owner: 'Marcus Bell',
      },
    ],
  },
}
