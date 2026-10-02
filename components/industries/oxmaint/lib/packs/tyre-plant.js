import tyreRcm from '../rcmLibraries/tyre'

// A radial tyre plant — the estate, and the reliability analysis over it.
//
// Built for the reliability conversation a tyre manufacturer opens with: can
// you show us the failure modes of our critical equipment, and what you would
// do about each one. A generic CMMS answers that with bearing wear and seal
// failure, which is true of every machine ever built and therefore worth
// nothing in the room.
//
// WHAT IS REAL AND WHAT IS MODELLED. The plant is fictional — no real
// manufacturer's name, estate or records. What is not fictional is the
// reliability content: the equipment a radial tyre plant runs, what each
// machine is there to do, how that function fails, what the failure does to the
// tyre as well as to the machine, and the condition signal that sees it coming.
// That library is the product of this pack; the plant around it exists so the
// library has assets to attach to.
//
// THE ANALYSIS IS RCM, NOT AN FMEA TABLE. Every mode is written under the
// function it defeats, and carries the consequence class — safety, environment,
// production, or hidden — because that is what decides the task. A hidden
// failure (a relief valve that will not lift, an interlock that will not trip)
// is not answered by a shorter inspection interval; it is answered by a
// failure-finding test, and the analysis says so per mode rather than leaving
// the reader to infer it from a risk number.

export default {
  key: 'tyre-plant',
  label: 'Meridian Tyre Works — radial passenger & truck tyres',

  org: {
    organization_name: 'Meridian Tyre Works',
    organization_code: 'MTW',
    industry: 'Tyre manufacturing — radial passenger and truck',
    address: 'Plot 14, Industrial Estate',
    city: 'Chennai',
    country: 'India',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    currency_symbol: '₹',
  },

  user: {
    name: 'Anand Krishnan',
    email: 'anand.krishnan@meridiantyre.example',
    mobile: '+91 98400 21174',
    role_name: 'Head of Maintenance & Reliability',
    initials: 'AK',
  },

  sites: [
    { site_id: 'site_01', site_name: 'Chennai Plant', code: 'CHN', city: 'Chennai', country: 'India', is_default: true },
    { site_id: 'site_02', site_name: 'Hosur Plant', code: 'HSR', city: 'Hosur', country: 'India', is_default: false },
  ],

  // The shop floor in process order, because that is how a tyre plant is walked
  // and how its downtime is argued about: a stop in mixing is felt in curing
  // eight hours later.
  locations: [
    { functional_location_id: 'loc_01', name: 'Mixing — Banbury Line', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_02', name: 'Mixing — Batch-Off & Storage', site_id: 'site_01', parent_id: 'loc_01', level: 2 },
    { functional_location_id: 'loc_03', name: 'Extrusion — Tread & Sidewall', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_04', name: 'Calendering — Steel & Fabric', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_05', name: 'Component Preparation', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_06', name: 'Tyre Building Hall', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_07', name: 'Curing Hall', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_08', name: 'Finishing & Final Inspection', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_09', name: 'Utilities — Boiler House', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_10', name: 'Utilities — Compressor & Chiller Room', site_id: 'site_01', parent_id: 'loc_09', level: 2 },
    { functional_location_id: 'loc_11', name: 'Mould Shop', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_12', name: 'Raw Material Warehouse', site_id: 'site_01', parent_id: null, level: 1 },
    { functional_location_id: 'loc_13', name: 'Hosur — Building & Curing', site_id: 'site_02', parent_id: null, level: 1 },
    { functional_location_id: 'loc_14', name: 'Hosur — Utilities', site_id: 'site_02', parent_id: null, level: 1 },
  ],

  // Weighted the way the floor is: one mixer line and thirty presses, not one
  // of each. The register has to look like a tyre plant before the analysis
  // over it can.
  assetCount: 150,
  assetKinds: [
    // Mixing
    'Banbury Internal Mixer', 'Banbury Internal Mixer',
    'Two-Roll Mill', 'Two-Roll Mill',
    'Batch-Off Cooling Line',
    // Extrusion
    'Tread Extruder', 'Tread Extruder', 'Tread Extruder',
    'Extruder Gear Pump & Screen Changer', 'Extruder Gear Pump & Screen Changer',
    // Calendering
    'Four-Roll Calender',
    'Steel Cord Creel & Let-Off', 'Steel Cord Creel & Let-Off',
    // Component preparation
    'Bead Winder & Apex Applicator', 'Bead Winder & Apex Applicator',
    'Steel Cord Cutter', 'Steel Cord Cutter', 'Ply Cutter & Splicer', 'Ply Cutter & Splicer',
    // Building
    'Tyre Building Machine', 'Tyre Building Machine', 'Tyre Building Machine',
    'Tyre Building Machine', 'Tyre Building Machine', 'Tyre Building Machine',
    // Curing — the press population is the biggest single block in any plant
    'Curing Press', 'Curing Press', 'Curing Press', 'Curing Press', 'Curing Press',
    'Curing Press', 'Curing Press', 'Curing Press', 'Curing Press', 'Curing Press',
    'Curing Press', 'Curing Press',
    // The bladder and the mould are tracked in their own right: both are
    // changed on a cycle count rather than with the press, and the analysis
    // that governs them is theirs, not the press's.
    'Curing Bladder & Mould', 'Curing Bladder & Mould', 'Curing Bladder & Mould',
    'Post-Cure Inflator', 'Post-Cure Inflator',
    // Finishing. Listed more than once each on purpose: the kinds are drawn at
    // random to fill the register, and a kind with a single slot can come out
    // with no units at all — which leaves the analysis describing a machine the
    // plant does not appear to own.
    'Tyre Uniformity Machine', 'Tyre Uniformity Machine', 'Tyre Uniformity Machine',
    'Tyre X-Ray Inspection Unit', 'Tyre X-Ray Inspection Unit', 'Tyre X-Ray Inspection Unit',
    'Dynamic Balance Machine', 'Dynamic Balance Machine', 'Trimming & Buffing Machine',
    // Utilities
    'Steam Boiler', 'Steam Boiler', 'Steam Boiler',
    'Screw Air Compressor', 'Screw Air Compressor', 'Screw Air Compressor',
    'Refrigerant Air Dryer', 'Refrigerant Air Dryer',
    'Water Chiller', 'Water Chiller', 'Water Chiller', 'Cooling Tower', 'Cooling Tower',
    'Hydraulic Power Unit', 'Hydraulic Power Unit', 'Hydraulic Power Unit',
    'Dust Collection Unit', 'Dust Collection Unit', 'Dust Collection Unit',
    'Nitrogen Generator',
    'Overhead Crane', 'Belt Conveyor', 'Belt Conveyor',
  ],
  makers: [
    'Kobe Steel', 'Farrel Pomini', 'HF Mixing Group', 'Troester', 'Berstorff',
    'VMI', 'Mitsubishi Heavy Industries', 'Larsen & Toubro', 'NRM', 'Bartell',
    'Atlas Copco', 'Ingersoll Rand', 'Thermax', 'Kirloskar', 'Rexroth', 'Yokogawa',
  ],

  workOrderCount: 120,
  tasks: [
    'Banbury rotor tip clearance check and dust stop seal inspection',
    'Banbury ram cylinder seal replacement — pressure loss during mixing',
    'Mixer gearbox oil sample and filter change',
    'Two-roll mill nip adjustment and bearing lubrication',
    'Batch-off dip tank concentration check and festoon tracking',
    'Tread extruder screw and barrel wear measurement',
    'Extruder screen changer hydraulic leak repair',
    'Extruder head temperature zone calibration',
    'Calender roll crown adjustment and gap verification',
    'Calender let-off tension loop cell calibration',
    'Steel cord creel brake pad replacement',
    'Bead winder spool tension and wire guide alignment',
    'Apex applicator die changeover and profile check',
    'Ply cutter blade replacement and splice overlap check',
    'Tyre building machine drum segment wear inspection',
    'TBM servo drive fault — transfer ring not indexing',
    'TBM stitcher roller bearing replacement',
    'Curing press bladder replacement at cycle limit',
    'Curing press mould vent cleaning and blind vent survey',
    'Curing press hydraulic clamping pressure test',
    'Curing press steam trap survey and condensate check',
    'Post-cure inflator rim leak investigation',
    'Uniformity machine load wheel calibration',
    'X-ray inspection unit radiation interlock function test',
    'Boiler safety valve lift test and feedwater quality check',
    'Air compressor element vibration survey and oil change',
    'Chilled water pump seal replacement',
    'Hydraulic power unit filter change and oil cleanliness check',
    'Dust collection unit filter differential pressure check',
    'Overhead crane brake and limit switch inspection',
  ],

  partCount: 60,
  partNames: [
    'Banbury Rotor Tip Segment', 'Dust Stop Seal Ring', 'Ram Cylinder Seal Kit',
    'Mixer Gearbox Oil Filter', 'Drop Door Liner Plate', 'Mill Roll Bearing',
    'Mill Nip Adjustment Screw', 'Batch-Off Festoon Roller', 'Dip Tank Pump Seal',
    'Extruder Screw Flight Segment', 'Extruder Barrel Liner', 'Breaker Plate',
    'Screen Pack 40 Mesh', 'Gear Pump Shaft Seal', 'Extruder Heater Band',
    'Thermocouple Type J', 'Calender Roll Bearing', 'Roll Crown Actuator',
    'Doctor Blade', 'Creel Brake Pad', 'Tension Load Cell',
    'Bead Wire Guide Roller', 'Apex Extrusion Die', 'Cutter Blade Set',
    'Splicer Heating Element', 'TBM Drum Segment', 'Stitcher Roller Assembly',
    'Servo Drive Module', 'Transfer Ring Gripper Pad', 'Curing Bladder',
    'Mould Vent Insert', 'Press Hydraulic Cylinder Seal', 'Steam Trap',
    'Press Loader Chuck Pad', 'PCI Rim Seal', 'Load Wheel Bearing',
    'X-Ray Tube Assembly', 'Boiler Safety Valve', 'Feedwater Pump Seal',
    'Compressor Air End Bearing', 'Air Filter Element', 'Oil Separator Element',
    'Dryer Refrigerant Filter', 'Chiller Compressor Contactor', 'Cooling Tower Fill Pack',
    'Hydraulic Pump Cartridge', 'Return Line Filter', 'Proportional Valve',
    'Dust Filter Cartridge', 'Nitrogen Membrane Module', 'Crane Brake Lining',
    'Conveyor Belt Splice Kit',
  ],

  technicians: [
    { user_id: 'usr_t01', name: 'Ravi Shankar', role: 'Technician', trade: 'Mixing & Extrusion' },
    { user_id: 'usr_t02', name: 'Praveen Kumar', role: 'Technician', trade: 'Hydraulics & Presses' },
    { user_id: 'usr_t03', name: 'Meena Iyer', role: 'Technician', trade: 'Electrical & PLC' },
    { user_id: 'usr_t04', name: 'Suresh Nair', role: 'Supervisor', trade: 'Reliability' },
    { user_id: 'usr_t05', name: 'Deepa Raman', role: 'Technician', trade: 'Instrumentation' },
    { user_id: 'usr_t06', name: 'Arjun Pillai', role: 'Technician', trade: 'Mould Shop' },
    { user_id: 'usr_t07', name: 'Lakshmi Venkat', role: 'Planner', trade: 'Maintenance Planning' },
    { user_id: 'usr_t08', name: 'Karthik Rao', role: 'Technician', trade: 'Utilities' },
  ],

  vendorNames: [
    'Kobe Steel Service India', 'VMI Technical Services', 'Bladder & Mould Solutions',
    'Rexroth Hydraulic Services', 'Atlas Copco Service', 'Thermax Boiler Services',
    'Precision Roll Grinders', 'SKF Reliability Services',
  ],

  domain: null,

  // The analysis itself lives in lib/rcmLibraries/tyre — it is the industry's,
  // not this plant's, and every build carries it so a reliability conversation
  // can be had on whichever portal is already open. Here it is simply attached
  // to an estate that has the machines in it.
  rcm: tyreRcm,
}
