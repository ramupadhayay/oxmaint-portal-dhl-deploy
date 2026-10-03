// DJI Mavic 3 Enterprise. Voice builds a Pilot 2 waypoint mission.
// Synthetic sample yard. Not a flight log.

export default {
  key: 'drone',
  label: 'Mavic Enterprise',

  org: {
    organization_name: 'Mavic Enterprise',
    organization_code: 'M3E',
    industry: 'Aerial inspection — waypoint missions',
    address: 'Pad 1',
    city: 'Orbe',
    country: 'Switzerland',
    timezone: 'Europe/Zurich',
    currency: 'CHF',
    currency_symbol: 'CHF ',
  },

  user: {
    name: 'Claire Morel',
    email: 'claire.morel@plant-floor.example',
    mobile: '+41 21 555 0191',
    role_name: 'Pilot',
    initials: 'CM',
  },

  sites: [
    { site_id: 'site_01', site_name: 'Mavic Enterprise', code: 'M3E', city: 'Orbe', country: 'Switzerland', is_default: true },
  ],

  locations: [
    { functional_location_id: 'loc_01', name: 'Home pad', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_02', name: 'Roof north', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_03', name: 'Tank farm', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_04', name: 'Filler roof', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_05', name: 'Perimeter south', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_06', name: 'Dock yard', site_id: 'site_01', parent_id: null, level: 1 },
  ],

  assetCount: 96,
  assetKinds: [
    'Mavic 3E', 'Mavic 3T', 'RC Pro', 'Flight battery', 'Propeller set',
    'Homogenizer', 'Aseptic Filler', 'Tank', 'Roof', 'Yard',
  ],
  makers: ['DJI', 'DJI', 'DJI', 'GEA', 'Tetra Pak', 'Alfa Laval'],

  workOrderCount: 48,
  tasks: [
    'New waypoint — filler roof',
    'Collect images — tank farm',
    'Collect details — dock yard',
    'Yard mission — five photos',
    'Return home',
  ],

  partCount: 24,
  partNames: ['Flight Battery', 'Propeller Set', 'Gimbal Cover', 'ND Filter', 'RC Cable'],

  technicians: [
    { user_id: 'usr_t01', name: 'Marc Keller', role: 'Technician', trade: 'Wet process' },
    { user_id: 'usr_t02', name: 'Luca Meier', role: 'Technician', trade: 'Electrical' },
    { user_id: 'usr_t03', name: 'Ines Rocha', role: 'Supervisor', trade: 'Reliability' },
    { user_id: 'usr_t04', name: 'Paul Aubert', role: 'Planner', trade: 'Planning' },
    { user_id: 'usr_t05', name: 'Elena Vogel', role: 'Technician', trade: 'Stores' },
    { user_id: 'usr_t06', name: 'Hugo Perrin', role: 'Technician', trade: 'Hygiene' },
    { user_id: 'usr_t07', name: 'Nora Schmid', role: 'Technician', trade: 'Filling' },
    { user_id: 'usr_t08', name: 'Mavic 3E', role: 'Pilot', trade: 'Aircraft' },
  ],

  vendorNames: [
    'DJI Enterprise', 'DJI Battery', 'Prop Shop', 'GEA Service',
    'Tetra Pak Service', 'ABB Drives', 'Alfa Laval Channel', 'SKF Food',
  ],

  domain: {
    key: 'drone',
    label: 'Mavic Enterprise',
    subtitle: 'Mavic 3E — waypoint, images, Pilot 2 mission',
    icon: 'drone',
    sections: [
      { key: 'drone-voice', label: 'Voice mission', kw: 'voice dji mavic enterprise waypoint photo mission pilot wpml' },
    ],
  },
}
