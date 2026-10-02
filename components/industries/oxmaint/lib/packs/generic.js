// The default data pack: a mid-sized manufacturer, no industry framing.
//
// A pack is only the *inputs* — who the customer is, what they own, what breaks
// and what sits in their stores. Everything derived from those (the 126 assets,
// the 84 work orders, the KPIs) is generated in data.js from the same seeded
// hash, so a pack does not repeat that work and cannot drift from it.
//
// To add a demo: copy this file, change the lists, register it in index.js.
// Nothing else in the portal needs touching.

export default {
  key: 'generic',
  label: 'Generic manufacturing',

  org: {
    organization_name: 'Oxmaint AI',
    organization_code: 'OXM',
    industry: 'Manufacturing',
    address: '14 Foundry Road',
    city: 'Sheffield',
    country: 'United Kingdom',
    timezone: 'Europe/London',
    currency: 'USD',
    currency_symbol: '$',
  },

  user: {
    name: 'Alex Doyle',
    email: 'alex.doyle@oxmaint.example',
    mobile: '+44 7700 900123',
    role_name: 'Administrator',
    initials: 'AD',
  },

  sites: [
    { site_id: 'site_01', site_name: 'Sheffield Plant', code: 'SHF', city: 'Sheffield', country: 'United Kingdom', is_default: true },
    { site_id: 'site_02', site_name: 'Rotherham Works', code: 'ROT', city: 'Rotherham', country: 'United Kingdom', is_default: false },
    { site_id: 'site_03', site_name: 'Leeds Depot', code: 'LDS', city: 'Leeds', country: 'United Kingdom', is_default: false },
  ],

  locations: [
    { functional_location_id: 'loc_01', name: 'Line 1 — Forming', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_02', name: 'Line 2 — Finishing', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_03', name: 'Utilities', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_04', name: 'Compressor House', site_id: 'site_01', parent_id: 'loc_03', level: 2 },
    { functional_location_id: 'loc_05', name: 'Press Shop', site_id: 'site_02', parent_id: null, level: 1 },
    { functional_location_id: 'loc_07', name: 'Tool Room', site_id: 'site_02', parent_id: null, level: 1 },
    { functional_location_id: 'loc_08', name: 'Paint Line', site_id: 'site_02', parent_id: 'loc_05', level: 2 },
    { functional_location_id: 'loc_06', name: 'Warehouse', site_id: 'site_03', parent_id: null, level: 1 },
    { functional_location_id: 'loc_09', name: 'Goods In', site_id: 'site_03', parent_id: 'loc_06', level: 2 },
    { functional_location_id: 'loc_10', name: 'Vehicle Bay', site_id: 'site_03', parent_id: null, level: 1 },
  ],

  assetCount: 126,
  assetKinds: [
    'Air Compressor', 'Hydraulic Press', 'Conveyor', 'Chiller', 'Boiler',
    'Pump', 'Gearbox', 'Extruder', 'Forklift', 'Cooling Tower',
  ],
  makers: ['Atlas Copco', 'Siemens', 'ABB', 'Grundfos', 'SEW', 'Schneider'],

  workOrderCount: 84,
  tasks: [
    'Replace worn drive belt', 'Top up hydraulic oil and check for leaks',
    'Bearing running hot — investigate and replace', 'Quarterly service per manufacturer schedule',
    'Vibration above alarm threshold', 'Seal weeping at the pump gland',
    'Calibrate pressure transmitter', 'Clean condenser coils',
    'Motor tripping on overload', 'Replace air filter element',
  ],

  partCount: 48,
  partNames: [
    'V-Belt A-section', 'Hydraulic Oil ISO 46', 'Deep Groove Bearing 6205',
    'Air Filter Element', 'Mechanical Seal 35mm', 'Contactor 40A',
    'Pressure Transmitter 0-16 bar', 'Coupling Element', 'Gearbox Oil 220',
    'Proximity Sensor M18', 'Drive Chain 12B-1', 'Motor 5.5kW 4-pole',
  ],

  technicians: [
    { user_id: 'usr_t01', name: 'Daniel Reeve', role: 'Technician', trade: 'Mechanical' },
    { user_id: 'usr_t02', name: 'Tom Whelan', role: 'Technician', trade: 'Electrical' },
    { user_id: 'usr_t03', name: 'Sara Kovac', role: 'Technician', trade: 'Instrumentation' },
    { user_id: 'usr_t04', name: 'Marcus Bell', role: 'Supervisor', trade: 'Mechanical' },
    { user_id: 'usr_t05', name: 'Ellie Brandt', role: 'Technician', trade: 'Electrical' },
    { user_id: 'usr_t06', name: 'Owen Marsh', role: 'Technician', trade: 'Mechanical' },
    { user_id: 'usr_t07', name: 'Grace Holloway', role: 'Planner', trade: 'Planning' },
    { user_id: 'usr_t08', name: 'Victor Lang', role: 'Technician', trade: 'Instrumentation' },
  ],

  vendorNames: [
    'Brammer', 'RS Components', 'Eriks', 'Bearing Supplies Ltd',
    'Hydraflow', 'NorthTech', 'Kelso Industrial', 'Vantage Parts',
  ],

  // No specialised module. Packs that have one describe it here and the
  // Condition Monitoring screens appear in the menu.
  domain: null,
}
