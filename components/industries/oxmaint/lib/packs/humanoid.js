// Plant floor with one R1 EDU. The CMMS around it is the same portal.
// The humanoid module is domain.sections — kit, inspection, end-of-shift walk,
// and the SDK bridge. Synthetic. Not a robot log and not a customer's stores.

export default {
  key: 'humanoid',
  label: 'Plant floor — R1 EDU',

  org: {
    organization_name: 'Plant Floor',
    organization_code: 'R1',
    industry: 'Food manufacturing — humanoid stores, inspection and shift walk',
    address: 'Bay 1',
    city: 'Orbe',
    country: 'Switzerland',
    timezone: 'Europe/Zurich',
    currency: 'CHF',
    currency_symbol: 'CHF ',
  },

  user: {
    name: 'Claire Morel',
    email: 'claire.morel@plant-floor.example',
    mobile: '+41 21 555 0190',
    role_name: 'Reliability Lead',
    initials: 'CM',
  },

  sites: [
    { site_id: 'site_01', site_name: 'Plant floor', code: 'R1', city: 'Orbe', country: 'Switzerland', is_default: true },
  ],

  locations: [
    { functional_location_id: 'loc_01', name: 'Stores', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_02', name: 'Wet mix', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_03', name: 'Aseptic filler', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_04', name: 'CIP room', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_05', name: 'Electrical room', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_06', name: 'Robot dock', site_id: 'site_01', parent_id: null, level: 1 },
  ],

  assetCount: 120,
  assetKinds: [
    'Homogenizer', 'Homogenizer', 'Aseptic Filler', 'Aseptic Filler',
    'CIP Set', 'CIP Set', 'Drive Chain', 'Drive Chain', 'Bearing', 'Bearing',
    'PCB Assembly', 'Plate Heat Exchanger', 'Spray Dryer', 'Process Water RO',
  ],
  makers: ['GEA', 'Tetra Pak', 'Alfa Laval', 'SKF', 'ABB', 'Unitree'],

  workOrderCount: 96,
  tasks: [
    'Homogenizer packing change — kit to be picked',
    'Filler infeed chain — kit to be picked',
    'CIP spray-ball service — kit to be picked',
    'UHT hold-tube inspection photo',
    'Filler jaw inspection photo',
    'End-of-shift walk — cleanliness',
    'End-of-shift walk — missing guard',
    'End-of-shift walk — chain elongation',
  ],

  partCount: 40,
  partNames: [
    'Homogenizer Packing Set', 'Food-Grade Grease', 'Plunger Seal',
    'Drive Chain', 'Sprocket', 'CIP Spray Ball', 'Gasket Set', 'Bearing',
  ],

  technicians: [
    { user_id: 'usr_t01', name: 'Marc Keller', role: 'Technician', trade: 'Wet process' },
    { user_id: 'usr_t02', name: 'Luca Meier', role: 'Technician', trade: 'Electrical' },
    { user_id: 'usr_t03', name: 'Ines Rocha', role: 'Supervisor', trade: 'Reliability' },
    { user_id: 'usr_t04', name: 'Paul Aubert', role: 'Planner', trade: 'Planning' },
    { user_id: 'usr_t05', name: 'Elena Vogel', role: 'Technician', trade: 'Stores' },
    { user_id: 'usr_t06', name: 'Hugo Perrin', role: 'Technician', trade: 'Hygiene' },
    { user_id: 'usr_t07', name: 'Nora Schmid', role: 'Technician', trade: 'Filling' },
    { user_id: 'usr_t08', name: 'R1 EDU', role: 'Technician', trade: 'Humanoid' },
  ],

  vendorNames: [
    'GEA Service', 'SKF Food', 'Seal & Gasket Supply', 'Hygienic Lubricants',
    'Tetra Pak Service', 'ABB Drives', 'Alfa Laval Channel', 'Unitree',
  ],

  domain: {
    key: 'humanoid',
    label: 'Humanoid',
    subtitle: 'R1 EDU — quality, kit, inspection, shift walk, voice',
    icon: 'humanoid',
    sections: [
      { key: 'humanoid-qa', label: 'Quality inspection', kw: 'quality qa spec carton jaw reject filler outfeed uht vision photo' },
      { key: 'humanoid-voice', label: 'Voice command', kw: 'voice twilio xai grok jaw gun command sdk unitree phone' },
      { key: 'humanoid-bridge', label: 'R1 EDU bridge', kw: 'unitree r1 edu sdk dds actuator joint arm lowstate rt/arm_sdk jetson' },
      { key: 'humanoid-kit', label: 'Spare-parts kit', kw: 'kit spare parts bin pick gripper store on hand work order humanoid' },
      { key: 'humanoid-inspect', label: 'Visual inspection', kw: 'waypoint inspection photo camera humanoid return dock' },
      { key: 'humanoid-walk', label: 'End-of-shift walk', kw: 'shift walk cleanliness safety maintenance request abnormal' },
    ],
  },
}
