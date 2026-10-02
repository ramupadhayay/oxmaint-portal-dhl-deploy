import nestleRcm from '../rcmLibraries/nestle'

// Nutrition plant — the estate the Orbe reference analysis attaches to.
//
// Synthetic. The equipment, functions and failure modes follow a UHT and
// infant-formula configuration. Nothing here is a Nestlé production record,
// a certified JA1011 study, or a live sensor feed. The component-photo modes
// are the eight seeded captions (chain, coupling, five bearing ways, PCB).
//
// Grief is recorded on each mode: Material, Vendor part, Workmanship, or
// Equipment. That is where the corrective action has to land.

export default {
  key: 'nestle',
  label: 'Nutrition plant — UHT and infant formula',

  org: {
    organization_name: 'Nutrition Plant',
    organization_code: 'ORBE',
    industry: 'Food manufacturing — UHT dairy and infant formula',
    address: 'Route de Chavornay',
    city: 'Orbe',
    country: 'Switzerland',
    timezone: 'Europe/Zurich',
    currency: 'CHF',
    currency_symbol: 'CHF ',
  },

  user: {
    name: 'Claire Morel',
    email: 'claire.morel@nutrition-plant.example',
    mobile: '+41 21 555 0140',
    role_name: 'Reliability Lead',
    initials: 'CM',
  },

  sites: [
    { site_id: 'site_01', site_name: 'Orbe Nutrition Plant', code: 'ORB', city: 'Orbe', country: 'Switzerland', is_default: true },
  ],

  locations: [
    { functional_location_id: 'loc_01', name: 'UHT — Line A', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_02', name: 'Wet mix and homogenizer', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_03', name: 'Aseptic filler', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_04', name: 'Evaporation and spray dryer', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_05', name: 'CIP room', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_06', name: 'Utilities — air, cold, water', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_07', name: 'Packaging drives', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_08', name: 'Electrical rooms', site_id: 'site_01', parent_id: 'loc_07', level: 2 },
  ],

  assetCount: 72,
  assetKinds: [
    'Tubular UHT Sterilizer', 'Tubular UHT Sterilizer',
    'Homogenizer', 'Homogenizer', 'Homogenizer',
    'Plate Heat Exchanger', 'Plate Heat Exchanger', 'Plate Heat Exchanger',
    'Aseptic Filler', 'Aseptic Filler',
    'Evaporator', 'Evaporator',
    'Spray Dryer', 'Spray Dryer',
    'CIP Set', 'CIP Set', 'CIP Set',
    'Compressed Air Package', 'Compressed Air Package',
    'Refrigeration Pack', 'Refrigeration Pack',
    'Process Water RO', 'Process Water RO',
    'Drive Chain', 'Drive Chain', 'Drive Chain', 'Drive Chain',
    'Coupling', 'Coupling', 'Coupling',
    'Bearing', 'Bearing', 'Bearing', 'Bearing', 'Bearing', 'Bearing',
    'PCB Assembly', 'PCB Assembly', 'PCB Assembly',
  ],
  makers: [
    'Tetra Pak', 'GEA', 'SPX', 'Alfa Laval', 'Atlas Copco', 'Bitzer',
    'Veolia', 'Siemens', 'ABB', 'SKF', 'Renold',
  ],

  workOrderCount: 96,
  tasks: [
    'UHT diversion-valve challenge failed on startup — late close',
    'Hold-temperature undershoot, unplanned stop, batch held',
    'Regen pressure crossover — line stopped for CIP and revalidation',
    'Homogenizer discharge pressure will not hold the recipe',
    'Homogenizer bearing temperature climb, unplanned stop',
    'Packing weep, lubricant toward the product side',
    'Plate heat exchanger gasket cross-contact, batch rejected',
    'Protein fouling, unplanned CIP before the planned end of run',
    'Aseptic chamber left the validated peroxide window',
    'Filler jaw seal leakers, quality hold',
    'Evaporator vacuum loss, solids off the window',
    'Spray dryer outlet temperature excursion',
    'CIP final rinse conductivity out of limit',
    'Compressed-air dewpoint above the filler spec',
    'Refrigeration pack oil carryover, glycol warm',
    'RO salt passage high, recipe water held',
    'Drive chain elongation, unplanned stop on the filler infeed',
    'Coupling elastomer cracked after a jam',
    'Bearing scored, grease interval missed',
    'Bearing fluting on the VFD drive',
    'Bearing contamination past the seal',
    'Bearing uneven wear, housing out of line',
    'Bearing race spalled at the hour limit',
    'PCB device charred, panel isolated, do not re-energize',
  ],

  partCount: 48,
  partNames: [
    'Diversion Valve Actuator', 'Holding-Tube Temperature Probe', 'Steam Control Valve',
    'Regen Tube Bundle', 'Homogenizer Valve Seat', 'Homogenizer Packing Set',
    'Crank Bearing', 'Food-Grade Grease', 'Plate Gasket Set', 'Plate Pack',
    'Peroxide Dosing Pump Seal', 'Sterile Air Filter', 'Jaw Seal Bar',
    'Calandria Gasket', 'Vacuum Pump Seal', 'Dryer Nozzle', 'Cyclone Seal',
    'CIP Spray Ball', 'Conductivity Probe', 'Air Dryer Desiccant',
    'Oil Separator Element', 'Glycol Pump Seal', 'RO Membrane', 'UV Lamp',
    'Drive Chain', 'Sprocket', 'Coupling Elastomer', 'Coupling Hub',
    'Bearing', 'Bearing Housing Seal', 'Shaft Grounding Ring', 'VFD Ground Kit',
    'PCB Power Device', 'Contactor',
  ],

  technicians: [
    { user_id: 'usr_t01', name: 'Marc Keller', role: 'Technician', trade: 'UHT & Wet' },
    { user_id: 'usr_t02', name: 'Sophie Blanc', role: 'Technician', trade: 'Aseptic Filling' },
    { user_id: 'usr_t03', name: 'Luca Meier', role: 'Technician', trade: 'Electrical & Drives' },
    { user_id: 'usr_t04', name: 'Ines Rocha', role: 'Supervisor', trade: 'Reliability' },
    { user_id: 'usr_t05', name: 'Hugo Perrin', role: 'Technician', trade: 'Hygiene & CIP' },
    { user_id: 'usr_t06', name: 'Nora Schmid', role: 'Technician', trade: 'Dryers' },
    { user_id: 'usr_t07', name: 'Paul Aubert', role: 'Planner', trade: 'Maintenance Planning' },
    { user_id: 'usr_t08', name: 'Elena Vogel', role: 'Technician', trade: 'Utilities' },
  ],

  vendorNames: [
    'Tetra Pak Service', 'GEA Service', 'Alfa Laval Channel', 'SKF Food',
    'Atlas Copco Service', 'Siemens Drives', 'Seal & Gasket Supply', 'Hygienic Lubricants',
  ],

  domain: null,
  rcm: nestleRcm,
}
