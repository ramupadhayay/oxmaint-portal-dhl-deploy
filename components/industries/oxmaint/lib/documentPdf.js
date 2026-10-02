// The library's documents, rendered as the documents they claim to be.
//
// The register lists O&M manuals, drawings, commissioning reports, calibration
// certificates and spare-parts lists against every asset — but a row is only a
// row until you can open it. This draws each one from the asset it is tied to:
// a manual gets specifications, a PM schedule with procedure codes and a
// troubleshooting table for its class of plant; a drawing gets a title block and
// a schematic of the right kind; a certificate gets as-found/as-left readings
// and a traceability statement. Everything is generated from the asset's own
// type and manufacturer, so it reads as this plant's paperwork rather than a
// blank template.
//
// Nothing is imported at the top. The equipment content is keyed off
// `asset_type`, which both data packs already supply, so this file has no
// opinion about which pack is loaded and cannot go stale when a new one is
// added. jsPDF and SheetJS are pulled in dynamically so neither lands in the
// bundle of the screens that never export anything.

const A4 = { w: 595.28, h: 841.89 }
const LAND = { w: 841.89, h: 595.28 }
const M = 48
const INK = [15, 23, 42]
const SUB = [71, 85, 105]
const MUTE = [148, 163, 184]
const LINE = [226, 232, 240]
const ACCENT = [21, 34, 122]
const SOFT = [241, 245, 249]

const clean = (v) => String(v ?? '-')
  .replace(/[‐-―]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/·/g, '-').replace(/…/g, '...').replace(/[^\x20-\xFF]/g, '')

// Deterministic identity so the same document always carries the same model,
// serial, document number and revision — no clock, no random.
const hash = (s) => { let h = 2166136261; const t = String(s || ''); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) } return Math.abs(h) }
const pick = (arr, seed) => arr[seed % arr.length]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// Dates arrive as full ISO timestamps and are printed the way every screen
// prints them, so a document and the row it was opened from never read as two
// different systems. Repeated here rather than imported to keep this file free
// of static imports — see the note at the top.
const fmtDay = (iso) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? clean(iso) : `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
const shift = (doc, days) => {
  const base = new Date(doc.created_date)
  return Number.isNaN(base.getTime()) ? clean(doc.created_date) : fmtDay(new Date(base.getTime() - days * 86400e3))
}

// A document uploaded through the portal has no document_id of its own, only the
// record id the store handed it. Seeding off that as well is what stops every
// uploaded document coming out with the same number, revision and serial.
const keyOf = (doc) => String(doc.document_id || doc.recordId || doc.document_name || 'DOC')

const shortId = (doc) => String(doc.asset_id || keyOf(doc)).replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase()
const modelNo = (doc, asset) => `${String(asset?.manufacturer || doc.manufacturer || 'OEM').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'OEM'}-${2000 + hash(doc.asset_id) % 7000}`
const serialNo = (doc) => `SN-${100000 + hash(keyOf(doc)) % 899999}`
const rev = (doc) => pick(['A', 'B', 'C', 'D'], hash(`${keyOf(doc)}r`))
const docNo = (doc) => {
  const p = { Manual: 'OM', Drawing: 'DWG', Report: 'CR', Certificate: 'CAL', Spares: 'SP' }[categoryOf(doc)] || 'DOC'
  return `${p}-${shortId(doc)}-${String(1 + hash(keyOf(doc)) % 9).padStart(2, '0')}`
}

// "<Kind> — <Asset>" is how the register names a document, and the cover already
// carries the kind as its kicker — so the title is the half that names the
// asset. Only a recognised kind is stripped, because a document somebody
// uploaded under their own wording has to keep it.
const KIND_PREFIX = /^[^—–-]*\b(manual|drawing|diagram|certificate|report|list|specification|schedule|procedure)\b\s*[—–-]\s*/i
const titleOf = (doc) => String(doc.document_name || '').replace(KIND_PREFIX, '') || doc.asset_name || 'Document'

/**
 * What a document opens as.
 *
 * The seeded library states its own category, but a document uploaded through
 * the portal has only a name and a file type — and without this every one of
 * them opened as a manual, including the parts list that is a spreadsheet. The
 * screen reads it too, so the register's filter and the viewer can never
 * disagree about what a row is.
 */
export function categoryOf(doc) {
  if (doc?.category) return doc.category
  const n = String(doc?.document_name || '').toLowerCase()
  if (/certificate|calibration/.test(n)) return 'Certificate'
  if (/spare|parts list|bom/.test(n)) return 'Spares'
  if (/drawing|diagram|schematic|layout|general arrangement/.test(n)) return 'Drawing'
  if (/report|commissioning|survey|analysis/.test(n)) return 'Report'
  if (/manual|o&m|instruction|procedure/.test(n)) return 'Manual'
  return { DWG: 'Drawing', XLSX: 'Spares' }[doc?.document_type] || 'Manual'
}

// ── equipment profiles ──────────────────────────────────────────────────────
// The specifications, PM schedule, troubleshooting, spares and safety notes that
// make a manual read as the manual for THIS kind of plant, keyed off the asset
// type both packs carry on `asset_type`.
//
// The order of the tests is load-bearing, because these names overlap as plain
// substrings. "Compressor" contains "press", so rotating plant has to be
// decided before the press bucket or every air compressor becomes a hydraulic
// press; "Condenser Water Pump" names a heat exchanger and a pump, and it is the
// pump that is maintained; and "Refrigerant Monitor" is an instrument, not a
// refrigeration circuit. Anything unrecognised falls through to general plant
// rather than being forced into the nearest bucket.
function classProfile(cls = '', manufacturer = '') {
  const c = String(cls).toLowerCase()
  const is = (...k) => k.some((x) => c.includes(x))
  const spread = (n) => (hash(cls + n) % 100)

  // Instruments first: they are named after what they measure, and every one of
  // those words also appears on the plant they are fitted to.
  if (is('monitor', 'sensor', 'transmitter', 'transducer', 'analyser', 'analyzer', 'detector', 'instrument', 'gauge', 'meter')) {
    const variable = is('refrigerant', 'gas', 'leak') ? 'Gas concentration'
      : is('temp') ? 'Temperature'
        : is('flow') ? 'Flow'
          : is('level') ? 'Level'
            : is('vibration') ? 'Vibration velocity' : 'Pressure'
    return {
      discipline: 'Instrumentation / Control',
      schematic: 'instrument',
      specs: [
        ['Measured variable', variable],
        ['Measuring range', `0 - ${pick(['100', '250', '500', '1000'], spread('rng'))} ${pick(['ppm', 'units of span'], spread('u'))}`],
        ['Output signal', '4-20 mA, two-wire, HART'],
        ['Accuracy', `+/- ${(0.2 + (spread('acc') % 6) / 10).toFixed(1)} % of span`],
        ['Supply', '24 V DC, loop powered'],
        ['Enclosure / area', pick(['IP66, safe area', 'IP66, hazardous area certified', 'IP65, indoor'], spread('ip'))],
        ['Calibration interval', '12 months'],
      ],
      pm: [
        ['Zero and span check against a reference', 'Semi-annual', 'IN-01'],
        ['Impulse line and manifold blow-through', 'Quarterly', 'IN-02'],
        ['Enclosure, gland and cable seal inspection', 'Semi-annual', 'IN-03'],
        ['Loop check from element to control system', 'Annual', 'IN-04'],
        ['Alarm and trip function test', 'Annual', 'IN-05'],
        ['Full calibration and certificate issue', 'Annual', 'IN-06'],
      ],
      troubleshoot: [
        ['Reading frozen or off scale', 'Blocked impulse line or failed element', 'Blow the impulse line through; compare the element against a reference'],
        ['Signal drifting against a reference', 'Sensor ageing or zero shift', 'Record the as-found reading before adjusting, then re-zero and span'],
        ['Loop sitting at 3.6 or 21 mA', 'Device diagnostic alarm', 'Read the device status and clear the diagnostic before recalibrating'],
        ['Intermittent signal', 'Moisture in the enclosure or a loose terminal', 'Dry and reseal the enclosure; re-terminate to the stated torque'],
        ['Alarm will not clear after repair', 'Latched alarm at the control system', 'Reset at the control system and prove the loop end to end'],
      ],
      spares: [
        ['Sensing element / probe', 'SEN-ELM-01', 2],
        ['Transmitter, 4-20 mA', 'TX-420-01', 1],
        ['Gasket and O-ring set', 'GKT-IN-SET', 2],
        ['Cable gland set, M20', 'GLD-M20-SET', 4],
        ['Calibration reference kit', 'CAL-REF-01', 1],
      ],
      safety: [
        'Isolate and depressurise the process connection before removing any element.',
        'Do not open a certified enclosure in a classified area without a gas test and the permit that covers it.',
        'A trip may only be overridden under a signed impairment, and must be restored and proved before handback.',
      ],
    }
  }

  if (is('forklift', 'truck', 'vehicle', 'crane', 'hoist', 'telehandler', 'loader', 'trailer', 'mobile')) {
    return {
      discipline: 'Mobile plant / Materials handling',
      schematic: 'drive',
      specs: [
        ['Rated capacity', `${1500 + (spread('cap') % 7) * 500} kg at 500 mm load centre`],
        ['Lift height', `${(3 + (spread('lift') % 36) / 10).toFixed(1)} m`],
        ['Power unit', pick(['48 V electric', '80 V electric', 'LPG', 'Diesel'], spread('pw'))],
        ['Mast', pick(['Duplex', 'Triplex, full free lift'], spread('mast'))],
        ['Hydraulic system pressure', `${170 + spread('bar') % 80} bar`],
        ['Tyres', pick(['Cushion, solid', 'Pneumatic'], spread('ty'))],
        ['Service interval', `${250 + (spread('si') % 3) * 250} operating hours`],
      ],
      pm: [
        ['Operator pre-use check, recorded', 'Every shift', 'MB-01'],
        ['Hydraulic fluid level and hose condition', 'Monthly', 'MB-02'],
        ['Traction battery and charger check', 'Monthly', 'MB-03'],
        ['Mast chain wear measurement and lubrication', 'Quarterly', 'MB-04'],
        ['Brake, steering and horn function test', 'Quarterly', 'MB-05'],
        ['Service to hour meter', '500 h', 'MB-06'],
        ['Thorough examination of the lifting equipment', 'Annual', 'MB-07'],
      ],
      troubleshoot: [
        ['Mast creeps down under load', 'Lift cylinder seals or lowering valve leaking', 'Renew the cylinder seals; never park a loaded mast raised'],
        ['Lift speed reduced', 'Low fluid level or worn pump', 'Top up and look for external leaks; test pump delivery against the rate'],
        ['Traction cuts out on a gradient', 'Low state of charge or controller fault', 'Check the charge level and read the controller fault code'],
        ['Steering heavy', 'Loss of pressure at the steer circuit', 'Check the priority valve and the steer cylinder for bypass'],
        ['Chain wear beyond 2 per cent', 'Fair wear or a lapsed lubrication routine', 'Renew the chains in pairs and reinstate the lubrication route'],
      ],
      spares: [
        ['Hydraulic filter element', 'FLT-MB-H10', 2],
        ['Mast chain set', 'CHN-MST-SET', 1],
        ['Lift cylinder seal kit', 'SEAL-LFT-KIT', 1],
        ['Brake shoe set', 'BRK-SHO-SET', 2],
        ['Fork pair with locating pins', 'FRK-PR-1150', 1],
        ['Beacon and reversing alarm', 'ELC-BCN-01', 2],
      ],
      safety: [
        'Only trained and authorised operators may drive, and the pre-use check must be recorded before the shift starts.',
        'Lower the forks, apply the parking brake and chock the wheels before any work on the machine.',
        'Support a raised mast on its props - never work under a mast held up on hydraulics.',
      ],
    }
  }

  if (is('pump', 'compressor', 'gearbox', 'motor', 'fan', 'blower', 'purge', 'drive', 'centrifuge', 'turbine')) {
    return {
      discipline: 'Mechanical / Rotating plant',
      schematic: 'drive',
      specs: [
        ['Drive rating', `${11 + spread('kw') % 240} kW, 400 V 3-phase 50 Hz`],
        ['Rated speed', `${pick(['985', '1480', '2960'], spread('rpm'))} rpm`],
        ['Full-load current', `${18 + spread('fla') % 260} A`],
        ['Transmission', pick(['Direct coupled, flexible element', 'V-belt drive, 3 x SPB', 'Close coupled'], spread('tx'))],
        ['Bearing arrangement', pick(['Deep groove ball, grease packed', 'Angular contact, oil bath', 'Spherical roller, grease packed'], spread('brg'))],
        ['Lubricant', pick(['ISO VG 46 mineral', 'ISO VG 68 mineral', 'ISO VG 220 gear oil'], spread('lub'))],
        ['Vibration alarm / trip', '4.5 / 7.1 mm/s RMS'],
        ['Protection', 'IP55, Class F insulation, Class B rise'],
      ],
      pm: [
        ['Vibration survey - overall velocity and bearing envelope', 'Monthly', 'RM-01'],
        ['Seal and gland leakage check', 'Monthly', 'RM-02'],
        ['Bearing lubrication to the greasing schedule', 'Quarterly', 'RM-03'],
        ['Coupling alignment or belt tension check', 'Quarterly', 'RM-04'],
        ['Oil sample for wear debris and water content', 'Semi-annual', 'RM-05'],
        ['Motor insulation resistance and winding test', 'Annual', 'RM-06'],
        ['Strip, inspect and rebuild to clearance', 'Annual', 'RM-07'],
      ],
      troubleshoot: [
        ['Bearing running hot', 'Over-greasing, misalignment or overload', 'Check alignment and grease quantity; trend bearing temperature against vibration'],
        ['Vibration above the alarm level', 'Imbalance, soft foot or bearing wear', 'Take a spectrum; balance, re-torque the holding-down bolts or renew the bearing'],
        ['Seal weeping at the gland', 'Worn seal faces or shaft wear', 'Renew the mechanical seal and check shaft run-out before rebuilding'],
        ['Motor trips on overload', 'Restricted suction, wrong duty point or a winding fault', 'Verify the duty point against section 3 and IR test the windings'],
        ['Output falling at unchanged speed', 'Worn clearances or a slipping drive', 'Measure the running clearance; retension or renew the belts'],
      ],
      spares: [
        ['Bearing set, drive and non-drive end', 'BRG-6205-SET', 2],
        ['Mechanical seal, 35 mm', 'SEAL-MS-035', 2],
        ['Coupling element', 'CPL-EL-06', 2],
        ['V-belt set, SPB section', 'BLT-SPB-SET', 2],
        ['Gasket and O-ring kit', 'GKT-KIT-01', 1],
        ['Lubricant, ISO VG 46, 20 L', 'LUB-VG46-20', 2],
      ],
      safety: [
        'Isolate, lock out and prove dead before removing any guard.',
        'Confirm the shaft is at rest and stored energy is released before a coupling guard comes off.',
        'Hot surfaces and pressurised lines - allow to cool and vent before breaking a joint.',
      ],
    }
  }

  if (is('press', 'hydraulic', 'clamp', 'baler', 'shear', 'punch', 'moulding', 'molding')) {
    return {
      discipline: 'Mechanical / Hydraulic power',
      schematic: 'hydraulic',
      specs: [
        ['Rated force', `${100 + (spread('t') % 8) * 50} tonne`],
        ['Working pressure', `${120 + spread('bar') % 180} bar`],
        ['Relief valve setting', `${140 + spread('bar') % 180} bar`],
        ['Pump displacement', `${45 + spread('cc') % 75} cc/rev`],
        ['Reservoir capacity', `${250 + spread('res') % 750} L`],
        ['Fluid', pick(['ISO VG 46 mineral', 'ISO VG 32 mineral', 'HFC water-glycol'], spread('fl'))],
        ['Target cleanliness', 'ISO 4406 18/16/13'],
        ['Filtration', '10 micron return, 125 micron suction strainer'],
      ],
      pm: [
        ['Hose and fitting inspection for chafe and weep', 'Monthly', 'HY-01'],
        ['Guard interlock and two-hand control function test', 'Monthly', 'HY-02'],
        ['Fluid sample - cleanliness and water content', 'Quarterly', 'HY-03'],
        ['Return and pressure filter element change', 'Semi-annual', 'HY-04'],
        ['Accumulator pre-charge check', 'Semi-annual', 'HY-05'],
        ['Relief and safety valve set-point verification', 'Annual', 'HY-06'],
        ['Cylinder seal and rod condition check', 'Annual', 'HY-07'],
      ],
      troubleshoot: [
        ['Slow or weak stroke', 'Internal leakage past the cylinder or a valve', 'Run a cylinder bypass test; renew the seals or the valve spool'],
        ['Pressure will not build', 'Relief set low or pump wear', 'Verify the relief setting on a test gauge and measure pump case drain flow'],
        ['Fluid overheating', 'Continuous flow over relief or a fouled cooler', 'Check the unload control and clean the oil cooler'],
        ['Juddering movement', 'Air entrained in the fluid', 'Bleed the circuit; check the suction line and the reservoir level'],
        ['Ram creeps down when parked', 'Pilot-operated check valve leaking', 'Renew the check valve; never rely on hydraulic hold for access'],
      ],
      spares: [
        ['Return line filter element', 'FLT-HYD-R10', 4],
        ['Pressure filter element', 'FLT-HYD-P10', 2],
        ['Cylinder seal kit', 'SEAL-CYL-KIT', 1],
        ['Hose assembly, 1/2 in 2SN', 'HOS-12-2SN', 2],
        ['Solenoid valve coil, 24 V DC', 'VLV-COIL-24', 2],
        ['Hydraulic oil ISO VG 46, 20 L', 'LUB-HYD46-20', 4],
      ],
      safety: [
        'Stored energy stays in the accumulator and a raised ram - lower the ram onto its blocks and discharge the accumulator before work.',
        'Never search for a leak by hand: a fluid injection injury needs immediate surgical attention.',
        'Prove the guard interlocks and the two-hand control before the machine goes back to production.',
      ],
    }
  }

  if (is('conveyor', 'belt', 'roller', 'chain', 'elevator', 'stacker', 'sorter')) {
    return {
      discipline: 'Mechanical / Materials handling',
      schematic: 'conveyor',
      specs: [
        ['Belt width', `${500 + (spread('w') % 5) * 150} mm`],
        ['Conveyor length', `${12 + spread('len') % 88} m between centres`],
        ['Belt speed', `${(0.5 + (spread('spd') % 20) / 10).toFixed(1)} m/s`],
        ['Design throughput', `${40 + spread('tph') % 260} t/h`],
        ['Drive rating', `${pick(['5.5', '7.5', '11', '15', '22'], spread('kw'))} kW geared motor`],
        ['Belt construction', pick(['EP400/3, 4+2 covers', 'EP500/4, 5+2 covers', 'Steel cord ST630'], spread('belt'))],
        ['Take-up', pick(['Gravity take-up', 'Screw take-up'], spread('tu'))],
      ],
      pm: [
        ['Belt tracking and edge condition check', 'Weekly', 'CV-01'],
        ['Pull-wire and belt-drift trip function test', 'Monthly', 'CV-02'],
        ['Idler and roller rotation survey', 'Monthly', 'CV-03'],
        ['Scraper and skirt adjustment', 'Monthly', 'CV-04'],
        ['Gearbox oil level and breather condition', 'Quarterly', 'CV-05'],
        ['Take-up travel and belt tension check', 'Quarterly', 'CV-06'],
        ['Splice inspection', 'Annual', 'CV-07'],
      ],
      troubleshoot: [
        ['Belt drifting to one side', 'Idler alignment, build-up on a pulley or off-centre loading', 'Clean the pulley lagging, square the idlers and centre the load at the feed point'],
        ['Belt slipping at the drive', 'Low tension or worn lagging', 'Adjust the take-up; renew the drive pulley lagging'],
        ['Repeated spillage at a transfer', 'Skirt wear or a worn scraper blade', 'Reset the skirt clearance and renew the scraper blade'],
        ['Rollers seized or noisy', 'Bearing failure after water ingress', 'Renew the idler set and review sealing and washdown practice'],
        ['Drive trips on overload', 'Material build-up or a jammed chute', 'Clear the chute and confirm the belt runs free before restart'],
      ],
      spares: [
        ['Idler roller set, troughing', 'IDL-TRG-SET', 6],
        ['Return roller', 'IDL-RTN-01', 4],
        ['Scraper blade, tungsten tipped', 'SCR-BLD-TC', 2],
        ['Belt repair and splice kit', 'BLT-SPL-KIT', 1],
        ['Geared motor, drive end', 'GMT-DRV-01', 1],
        ['Pull-wire switch', 'SW-PULL-01', 2],
      ],
      safety: [
        'Isolate, lock out and prove dead before a guard comes off or anyone enters the belt line.',
        'Never track a running belt by hand and never clear a chute while the drive is live.',
        'Every pull-wire and drift switch must be proved before the belt is handed back.',
      ],
    }
  }

  if (is('chiller', 'tower', 'cooler', 'cooling', 'boiler', 'condenser', 'evaporator', 'exchanger', 'air handl', 'ahu', 'coil', 'radiator', 'calorifier')) {
    // A boiler is the same bucket of work as a chiller — water side, fouling,
    // approach — but printing chilled-water temperatures on a boiler manual is
    // the kind of detail that loses the room, so the hot side is read off the
    // type rather than picked.
    const hot = is('boiler', 'calorifier')
    return {
      discipline: 'Mechanical / Heat transfer',
      schematic: 'heat',
      specs: [
        ['Design duty', `${350 + spread('cap') * 5} kW thermal`],
        ['Circuit flow rate', `${18 + spread('flow') % 42} L/s`],
        ['Design flow / return', hot ? '80 C / 60 C' : '7 C / 12 C'],
        ['Working pressure', `${(hot ? 4 : 6) + spread('p') % 6} bar g`],
        ['Heat transfer surface', `${40 + spread('area') % 160} m2`],
        ['Design approach', `${2 + spread('app') % 4} K at full load`],
        ['Auxiliary absorbed power', `${5 + spread('aux') % 45} kW`],
        ['Water treatment', 'Inhibited and dosed, sampled monthly'],
      ],
      pm: [
        ['Water sample - inhibitor, conductivity and bacteria', 'Monthly', 'HT-01'],
        ['Strainer and filter clean', 'Monthly', 'HT-02'],
        ['Approach and duty check against the commissioned baseline', 'Quarterly', 'HT-03'],
        ['Tube or plate fouling inspection', 'Semi-annual', 'HT-04'],
        ['Fin comb and coil clean', 'Semi-annual', 'HT-05'],
        ['Safety valve and control device test', 'Annual', 'HT-06'],
        ['Chemical clean and pressure test', 'Annual', 'HT-07'],
      ],
      troubleshoot: [
        ['Approach temperature widening', 'Scale or fouling on the transfer surface', 'Sample the water and chemically clean; verify the dosing regime'],
        ['Duty falls at unchanged load', 'Air locked circuit or reduced flow', 'Vent the high points; check the strainer and the balancing valve position'],
        ['High differential pressure across the unit', 'Blocked strainer or fouled tubes', 'Clean the strainer, then back-flush and inspect the tubes'],
        ['Frequent safety device operation', 'Expansion or pressurisation fault', 'Check the vessel charge pressure and the control set-points'],
        ['Water loss from the circuit', 'Leaking joint or a passing drain valve', 'Pressure test the circuit and log make-up volume against the treatment record'],
      ],
      spares: [
        ['Gasket set, header and tube plate', 'GKT-HT-01', 1],
        ['Strainer basket', 'STR-BSK-04', 2],
        ['Temperature sensor, PT100', 'SEN-PT100', 4],
        ['Tube cleaning brush kit', 'CLN-TB-01', 1],
        ['Water treatment dosing kit', 'CHM-DOSE-01', 2],
        ['Isolating valve, DN80', 'VLV-ISO-080', 1],
      ],
      safety: [
        'Drain, vent and confirm zero pressure before breaking any joint.',
        'Treated water and cleaning chemicals - read the safety data sheet and wear eye and hand protection.',
        'Isolate and lock out the drive before entering a fan or tower enclosure.',
      ],
    }
  }

  if (is('extruder', 'mixer', 'reactor', 'oven', 'furnace', 'kiln', 'mill', 'granulator', 'dryer', 'blender', 'filler', 'autoclave')) {
    return {
      discipline: 'Process / Production plant',
      schematic: 'process',
      specs: [
        ['Design throughput', `${200 + spread('kgh') % 1300} kg/h`],
        ['Drive rating', `${22 + spread('kw') % 180} kW`],
        ['Drive speed range', `${40 + spread('rpm') % 60} - ${180 + spread('rpm2') % 140} rpm`],
        ['Heating zones', `${4 + spread('z') % 6} zones, ${160 + spread('t') % 140} C maximum`],
        ['Process pressure', `${60 + spread('p') % 140} bar`],
        ['Cooling', pick(['Water jacket on a treated circuit', 'Forced air'], spread('cool'))],
        ['Product contact material', pick(['Nitrided steel', '316L stainless steel', 'Bimetallic liner'], spread('mat'))],
      ],
      pm: [
        ['Interlock and emergency stop function test', 'Monthly', 'PR-01'],
        ['Heater zone and thermocouple verification', 'Quarterly', 'PR-02'],
        ['Drive gearbox oil level and sample', 'Quarterly', 'PR-03'],
        ['Product contact seal and gasket renewal', 'Semi-annual', 'PR-04'],
        ['Cooling circuit clean and flow check', 'Semi-annual', 'PR-05'],
        ['Wear measurement against the recorded limit', 'Annual', 'PR-06'],
        ['Full strip-down, clean and rebuild', 'Annual', 'PR-07'],
      ],
      troubleshoot: [
        ['Output falling at set speed', 'Wear beyond the clearance limit or feed starvation', 'Measure the clearance against the wear limit; check the hopper for bridging'],
        ['Zone temperature will not hold', 'Failed heater band or thermocouple drift', 'Meter the heater current; calibrate or renew the thermocouple'],
        ['Product quality drift', 'Uneven heating or contamination', 'Trend the zone temperatures; purge and inspect the product contact surfaces'],
        ['Drive current rising', 'Higher viscosity or bearing wear', 'Check the material and the zone profile, then take a vibration reading on the drive'],
        ['Leak at a product contact joint', 'Gasket relaxation after thermal cycling', 'Re-torque cold to the recorded figure and renew the gasket if it leaks again'],
      ],
      spares: [
        ['Heater band with thermocouple', 'HTR-BND-01', 4],
        ['Thermocouple, type K', 'TC-K-250', 4],
        ['Product contact gasket set', 'GKT-PC-SET', 2],
        ['Screen pack / breaker plate', 'SCR-PACK-01', 6],
        ['Drive belt set', 'BLT-PR-SET', 1],
        ['Gearbox oil ISO VG 220, 20 L', 'LUB-VG220-20', 2],
      ],
      safety: [
        'Hot surfaces and hot product - let the zones cool and wear heat-resistant gloves and a face shield.',
        'Isolate every energy source including the heater supplies, and prove dead before a guard comes off.',
        'Purge and vent before breaking a product contact joint: pressure can remain after shutdown.',
      ],
    }
  }

  return {
    discipline: 'General plant',
    schematic: 'general',
    specs: [
      ['Equipment type', cls || 'General plant'],
      ['Manufacturer', manufacturer || '-'],
      ['Electrical supply', '400 V, 3-phase, 50 Hz'],
      ['Ingress protection', 'IP54'],
      ['Duty', 'Continuous'],
      ['Lubrication', 'Per the manufacturer schedule'],
    ],
    pm: [
      ['General visual inspection', 'Monthly', 'GN-01'],
      ['Fixings and terminal torque check', 'Quarterly', 'GN-02'],
      ['Lubrication to schedule', 'Quarterly', 'GN-03'],
      ['Functional and safety device test', 'Semi-annual', 'GN-04'],
      ['Full service', 'Annual', 'GN-05'],
    ],
    troubleshoot: [
      ['Unit will not run', 'Supply or control circuit fault', 'Verify the supply and prove the control circuit'],
      ['Abnormal noise', 'Mechanical wear or loose fixings', 'Inspect, re-torque the fixings and renew worn parts'],
      ['Running hot', 'Restricted ventilation or overload', 'Clear the ventilation path and check the load against the rating'],
      ['Alarm active', 'Sensor or threshold', 'Investigate the alarm source before resetting'],
    ],
    spares: [
      ['Fuse set', 'FUS-SET', 1],
      ['Indication lamp', 'LMP-01', 4],
      ['Filter element', 'FLT-01', 2],
      ['Fastener and washer kit', 'FST-KIT-01', 1],
    ],
    safety: [
      'Isolate, lock out and prove dead before service.',
      'Wear the PPE named in the risk assessment for the task.',
      'Confirm zero energy before removing any cover.',
    ],
  }
}

// ── shared drawing surface ──────────────────────────────────────────────────
function band(pdf, { width, right, rightLabel, title }) {
  pdf.setFillColor(...ACCENT)
  pdf.rect(0, 0, width, 74, 'F')
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); pdf.setTextColor(255, 255, 255)
  pdf.text('Oxmaint AI', M, 32)
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(210, 218, 245)
  pdf.text(clean(title || 'Document Library'), M, 48)
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12.5); pdf.setTextColor(255, 255, 255)
  pdf.text(clean(right), width - M, 32, { align: 'right' })
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(210, 218, 245)
  pdf.text(clean(rightLabel), width - M, 48, { align: 'right' })
}

function openInTab(pdf, name) {
  try {
    const url = pdf.output('bloburl')
    const win = window.open(url, '_blank')
    if (!win) pdf.save(name) // popup blocked — fall back to download
  } catch {
    pdf.save(name)
  }
  return name
}

// ── the PDF documents ───────────────────────────────────────────────────────
async function renderPaper(pdf, spec, meta) {
  let y = M
  const room = (need) => { if (y + need > A4.h - M - 26) { footer(); pdf.addPage(); y = M } }
  const footer = () => {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...MUTE)
    pdf.text(clean(`${meta.docNo} - Rev ${meta.rev}`), M, A4.h - 26)
    pdf.text(`Page ${pdf.getNumberOfPages()}`, A4.w - M, A4.h - 26, { align: 'right' })
    pdf.text('Generated by Oxmaint AI - representative document', M, A4.h - 16)
  }
  const heading = (label) => {
    room(34); y += 8
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.setTextColor(...MUTE)
    pdf.text(clean(label).toUpperCase(), M, y); y += 6
    pdf.setDrawColor(...LINE); pdf.setLineWidth(0.6); pdf.line(M, y, A4.w - M, y); y += 14
  }
  const para = (s, opts = {}) => {
    const size = opts.size || 10
    pdf.setFont('helvetica', opts.style || 'normal'); pdf.setFontSize(size); pdf.setTextColor(...(opts.color || INK))
    const lines = pdf.splitTextToSize(clean(s), A4.w - M * 2)
    room(lines.length * (size + 3))
    lines.forEach((ln) => { pdf.text(ln, M, y); y += size + 3 })
    y += 3
  }
  const bullets = (arr) => {
    arr.forEach((s) => {
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(...INK)
      const lines = pdf.splitTextToSize(clean(s), A4.w - M * 2 - 14)
      room(lines.length * 13)
      pdf.setTextColor(...ACCENT); pdf.text('-', M, y); pdf.setTextColor(...INK)
      lines.forEach((ln, i) => pdf.text(ln, M + 14, y + i * 13)); y += lines.length * 13 + 2
    })
  }
  const kv = (rows) => {
    rows.forEach(([k, v]) => {
      const lines = pdf.splitTextToSize(clean(v), A4.w - M - 190)
      room(Math.max(14, lines.length * 13) + 4)
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.setTextColor(...SUB)
      pdf.text(clean(k).toUpperCase(), M, y + 9)
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(...INK)
      lines.forEach((ln, i) => pdf.text(ln, M + 150, y + 9 + i * 13))
      y += Math.max(16, lines.length * 13 + 4)
    })
  }
  const table = (cols, rows) => {
    const tableW = A4.w - M * 2
    const widths = cols.map((c) => (c.w || 1))
    const wsum = widths.reduce((a, b) => a + b, 0)
    const px = widths.map((w) => (w / wsum) * tableW)
    const drawHead = () => {
      room(22)
      pdf.setFillColor(...SOFT); pdf.rect(M, y, tableW, 20, 'F')
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(...SUB)
      let cx = M
      cols.forEach((c, i) => { pdf.text(clean(c.h).toUpperCase(), cx + 6, y + 13); cx += px[i] })
      y += 20
    }
    drawHead()
    pdf.setFontSize(9)
    rows.forEach((r, ri) => {
      const cells = r.map((cell, i) => pdf.splitTextToSize(clean(cell), px[i] - 12))
      const rowH = Math.max(18, Math.max(...cells.map((c) => c.length)) * 11 + 8)
      if (y + rowH > A4.h - M - 30) { footer(); pdf.addPage(); y = M; drawHead(); pdf.setFontSize(9) }
      if (ri % 2 === 1) { pdf.setFillColor(248, 250, 252); pdf.rect(M, y, tableW, rowH, 'F') }
      let cx = M
      cells.forEach((c, i) => {
        pdf.setFont('helvetica', i === 0 ? 'bold' : 'normal'); pdf.setTextColor(...(i === 0 ? INK : SUB))
        c.forEach((ln, li) => pdf.text(ln, cx + 6, y + 12 + li * 11)); cx += px[i]
      })
      pdf.setDrawColor(...LINE); pdf.setLineWidth(0.4); pdf.line(M, y + rowH, M + tableW, y + rowH)
      y += rowH
    })
    y += 4
  }

  // cover band + title
  band(pdf, { width: A4.w, right: meta.docNo, rightLabel: `Rev ${meta.rev}`, title: spec.kicker })
  y = 108
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(...ACCENT)
  pdf.text(clean(spec.kicker).toUpperCase(), M, y); y += 20
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.setTextColor(...INK)
  pdf.splitTextToSize(clean(spec.title), A4.w - M * 2).forEach((ln) => { pdf.text(ln, M, y); y += 21 })
  y += 2
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10.5); pdf.setTextColor(...SUB)
  pdf.text(clean(spec.subtitle), M, y); y += 18
  pdf.setDrawColor(...LINE); pdf.setLineWidth(0.6); pdf.line(M, y, A4.w - M, y); y += 6

  heading('Document control')
  kv(meta.control)

  spec.sections.forEach((s) => {
    heading(s.heading)
    if (s.paras) s.paras.forEach((p) => para(p))
    if (s.bullets) bullets(s.bullets)
    if (s.kv) kv(s.kv)
    if (s.table) table(s.table.cols, s.table.rows)
  })

  if (spec.revisions) {
    heading('Revision history')
    table([{ h: 'Rev', w: 0.5 }, { h: 'Date', w: 1 }, { h: 'Description', w: 3 }, { h: 'By', w: 1 }], spec.revisions)
  }

  footer()
}

function manualSpec(doc, asset, prof, meta) {
  const name = asset?.asset_name || doc.asset_name
  const maker = asset?.manufacturer || doc.manufacturer
  const where = asset?.functional_location_name || asset?.site_name || 'the plant'
  return {
    kicker: 'Operation & Maintenance Manual',
    title: titleOf(doc),
    subtitle: `${prof.discipline} - ${asset?.site_name || ''}`.replace(/ - $/, ''),
    sections: [
      { heading: '1. Introduction & scope', paras: [
        `This manual covers the safe operation and maintenance of ${name}, a ${asset?.asset_type || 'unit'} supplied by ${maker}. It applies to the unit installed at ${where}${asset?.site_name ? `, ${asset.site_name}` : ''}.`,
        'It is written for competent technicians working under the site permit-to-work system. Read it in full before carrying out any operation or maintenance activity.',
      ] },
      { heading: '2. Safety', bullets: prof.safety },
      { heading: '3. Technical specifications', table: { cols: [{ h: 'Parameter', w: 1.4 }, { h: 'Value', w: 2 }], rows: [
        ['Manufacturer', maker], ['Model', asset?.model || modelNo(doc, asset)], ['Serial number', asset?.serial_number || serialNo(doc)],
        ['Asset code', asset?.asset_code || asset?.asset_id || doc.asset_id], ['Criticality', asset?.criticality || '-'],
        ...prof.specs,
      ] } },
      { heading: '4. Operating instructions', paras: [
        'Start-up: confirm the isolation is removed and the permit closed, check lubricant levels and auxiliary supplies, then start from the local control station and watch the unit reach steady state before selecting AUTO.',
        'Normal operation: the unit runs to the duty the production plan sets. Confirm the set-points, clear any standing alarm, and trend the parameters in section 3 against the figures recorded at commissioning.',
        'Shutdown: select OFF at the local station, let the run-down finish, then isolate, lock out and prove dead before any intervention.',
      ] },
      { heading: '5. Preventive maintenance schedule', table: { cols: [{ h: 'Task', w: 2.6 }, { h: 'Frequency', w: 1.1 }, { h: 'Procedure', w: 0.8 }], rows: prof.pm } },
      { heading: '6. Troubleshooting', table: { cols: [{ h: 'Symptom', w: 1.5 }, { h: 'Probable cause', w: 1.4 }, { h: 'Corrective action', w: 2.1 }], rows: prof.troubleshoot } },
      { heading: '7. Recommended spare parts', table: { cols: [{ h: 'Part', w: 2 }, { h: 'Part number', w: 1.2 }, { h: 'Qty', w: 0.5 }], rows: prof.spares.map((s) => [s[0], s[1], String(s[2])]) } },
      { heading: '8. Warranty & support', paras: [`Warranty and field support are provided by ${maker} under the site's service agreement. Quote the model and serial number above when raising a support case.`] },
    ],
    revisions: [
      ['A', shift(doc, 400), 'First issue at commissioning', 'OEM'],
      ['B', shift(doc, 200), 'PM intervals updated to site policy', 'Reliability'],
      [meta.rev, fmtDay(doc.created_date), 'Reviewed and re-issued', doc.uploaded_by_name],
    ],
  }
}

function reportSpec(doc, asset, prof) {
  const seed = hash(keyOf(doc))
  const pf = (i) => (((seed >> i) & 7) === 0 ? 'Observation' : 'Pass')
  return {
    kicker: 'Commissioning Report',
    title: titleOf(doc),
    subtitle: `${prof.discipline} - ${asset?.site_name || ''}`.replace(/ - $/, ''),
    sections: [
      { heading: '1. Scope & references', paras: [
        `This report records the commissioning of ${asset?.asset_name || doc.asset_name} (${asset?.manufacturer || doc.manufacturer}, model ${asset?.model || modelNo(doc, asset)}) at ${asset?.functional_location_name || 'the plant'}${asset?.site_name ? `, ${asset.site_name}` : ''}.`,
        'Testing followed the approved method statement and the manufacturer commissioning schedule: factory acceptance, installation checks, functional testing and a performance test at duty.',
      ] },
      { heading: '2. Pre-commissioning checks', table: { cols: [{ h: 'Check', w: 3 }, { h: 'Result', w: 1 }], rows: [
        ['Installation and alignment to drawing', pf(1)], ['Electrical terminations torqued and IR tested', pf(2)],
        ['Isolation, labelling and earthing verified', pf(3)], ['Lubricant levels and auxiliary supplies confirmed', pf(4)],
      ] } },
      { heading: '3. Functional test results', table: { cols: [{ h: 'Test', w: 1.8 }, { h: 'Acceptance', w: 1.4 }, { h: 'Measured', w: 1.2 }, { h: 'Result', w: 0.8 }], rows: prof.specs.slice(0, 5).map((s, i) => [s[0], s[1], measured(s[1], seed + i), pf(i + 5)]) } },
      { heading: '4. Performance test', paras: [
        'The unit was run at duty under plant control, with alarms, interlocks and the trip chain proved and return to normal demonstrated. The sequences operated as designed and the results were witnessed by the maintenance supervisor.',
      ] },
      { heading: '5. Outstanding items (punch list)', bullets: (seed % 3 === 0)
        ? ['No outstanding items - all defects cleared at witnessing.']
        : ['Minor: update the asset label to match the final code in the register.', 'Minor: trend two set-points over the first month of operation.'] },
      { heading: '6. Sign-off', kv: [['Commissioning engineer', pick(['A. Ribeiro', 'T. Whitfield', 'K. Watanabe'], seed)], ['Witnessed by', doc.uploaded_by_name], ['Date completed', fmtDay(doc.created_date)], ['Status', 'Accepted']] },
    ],
    revisions: [['0', shift(doc, 40), 'Draft for review', 'Commissioning'], ['1', fmtDay(doc.created_date), 'Final issued and accepted', doc.uploaded_by_name]],
  }
}

function certSpec(doc, asset, prof) {
  const seed = hash(keyOf(doc))
  const rows = ['0%', '25%', '50%', '75%', '100%'].map((pt, i) => {
    const nominal = (i * 25)
    const err = (((seed >> (i + 1)) % 7) - 3) / 10
    return [pt, `${nominal.toFixed(1)}`, `${(nominal + err).toFixed(2)}`, `${err.toFixed(2)}`, '+/-0.5', 'Pass']
  })
  return {
    kicker: 'Calibration Certificate',
    title: titleOf(doc),
    subtitle: `Traceable calibration - ${asset?.site_name || ''}`.replace(/ - $/, ''),
    sections: [
      { heading: 'Instrument under test', kv: [
        ['Description', `${asset?.asset_name || doc.asset_name} instrumentation`], ['Manufacturer', asset?.manufacturer || doc.manufacturer],
        ['Model', asset?.model || modelNo(doc, asset)], ['Serial number', asset?.serial_number || serialNo(doc)],
        ['Asset code', asset?.asset_code || asset?.asset_id || doc.asset_id],
        ['Location', asset?.functional_location_name || asset?.site_name || '-'],
        ['Discipline', prof.discipline],
      ] },
      { heading: 'Calibration details', kv: [
        ['Certificate number', docNo(doc)], ['Standard / method', 'ISO/IEC 17025; manufacturer procedure'],
        ['Reference standard', `Site reference STD-${1000 + seed % 8999}, traceable to national standards`],
        ['Ambient conditions', `${21 + seed % 3} C, ${45 + seed % 15}% RH`],
        ['Date of calibration', fmtDay(doc.created_date)], ['Calibration due', shift(doc, -365)],
      ] },
      { heading: 'As-found / as-left readings', table: { cols: [{ h: 'Point', w: 0.8 }, { h: 'Nominal', w: 1 }, { h: 'Measured', w: 1 }, { h: 'Error', w: 0.8 }, { h: 'Tol.', w: 0.7 }, { h: 'Result', w: 0.8 }], rows } },
      { heading: 'Statement of traceability', paras: [
        'The measurements above are traceable to national metrology standards through the reference equipment listed. The reported expanded uncertainty is stated at a coverage factor k=2, approximately 95% confidence.',
        'The instrument was found within tolerance (as-found) and required no adjustment (as-left).',
      ] },
      { heading: 'Authorisation', kv: [['Calibrated by', pick(['M. Hale', 'P. Nair', 'D. Osei'], seed)], ['Approved by', doc.uploaded_by_name], ['Accreditation', 'Site calibration laboratory']] },
    ],
  }
}

function measured(spec, seed) {
  const m = String(spec).match(/([\d.]+)/)
  if (!m) return spec
  const n = parseFloat(m[1])
  const v = (n * (0.98 + (seed % 4) / 100)).toFixed(n >= 100 ? 0 : 1)
  return String(spec).replace(m[1], v)
}

// ── the schematic ───────────────────────────────────────────────────────────
/**
 * The plan drawn on a drawing sheet, chosen by the profile's bucket.
 *
 * A drawing that shows the same boxes for a conveyor and a hydraulic press is
 * worth nothing to the person holding it, so each bucket gets the arrangement
 * its own trade would sketch. Coordinates are offsets from the schematic origin;
 * the renderer places them. Boxes are [x, y, w, h, label, sub] and flows are
 * [x1, y1, x2, y2].
 */
function schematicPlan(kind, asset, meta) {
  const unit = String(asset?.asset_name || meta.title || 'Unit').slice(0, 24)
  const model = meta.model

  if (kind === 'heat') {
    return {
      title: 'Heat transfer loop schematic',
      boxes: [
        [0, 0, 120, 54, 'Return line', 'from process'],
        [175, -6, 150, 66, unit, model],
        [380, 0, 120, 54, 'Flow line', 'to process'],
        [175, 110, 150, 46, 'Circulating pump', 'duty / standby'],
        [540, -6, 150, 66, 'Control station', 'set-point and trend'],
        [540, 110, 150, 46, 'Water treatment', 'dosing and sampling'],
      ],
      flows: [[120, 27, 175, 27], [325, 27, 380, 27], [250, 60, 250, 110], [540, 27, 325, 20]],
    }
  }
  if (kind === 'hydraulic') {
    return {
      title: 'Hydraulic circuit schematic',
      boxes: [
        [0, 0, 120, 54, 'Reservoir', 'ISO VG 46'],
        [175, -6, 130, 66, 'Power unit', 'pump and motor'],
        [360, -6, 130, 66, 'Valve block', 'relief and directional'],
        [545, -6, 150, 66, unit, model],
        [175, 110, 130, 46, 'Accumulator', 'pre-charge checked'],
        [360, 110, 130, 46, 'Return filter', '10 micron'],
      ],
      flows: [[120, 27, 175, 27], [305, 27, 360, 27], [490, 27, 545, 27], [240, 60, 240, 110], [425, 60, 425, 110]],
    }
  }
  if (kind === 'conveyor') {
    return {
      title: 'Conveyor run schematic',
      boxes: [
        [0, -6, 130, 66, 'Tail and take-up', 'tension maintained'],
        [185, 0, 260, 54, unit, 'carrying run - troughing idlers'],
        [500, -6, 140, 66, 'Head pulley', 'geared motor drive'],
        [185, 110, 260, 46, 'Return run', 'return rollers and scraper'],
        [500, 110, 140, 46, 'Pull-wire and drift trips', 'proved on test'],
      ],
      flows: [[130, 27, 185, 27], [445, 27, 500, 27], [315, 60, 315, 110], [570, 60, 570, 110]],
    }
  }
  if (kind === 'process') {
    return {
      title: 'Process line schematic',
      boxes: [
        [0, 0, 120, 54, 'Feed hopper', 'raw material'],
        [175, -6, 170, 66, unit, model],
        [400, 0, 130, 54, 'Product out', 'to next stage'],
        [175, 110, 170, 46, 'Heating zones', 'zone control and thermocouples'],
        [560, -6, 150, 66, 'Drive and gearbox', 'oil filled'],
        [560, 110, 150, 46, 'Cooling circuit', 'treated water'],
      ],
      flows: [[120, 27, 175, 27], [345, 27, 400, 27], [260, 60, 260, 110], [560, 27, 345, 20]],
    }
  }
  if (kind === 'instrument') {
    return {
      title: 'Instrument loop diagram',
      boxes: [
        [0, 0, 130, 54, 'Sensing element', 'process connection'],
        [185, -6, 150, 66, unit, '4-20 mA transmitter'],
        [390, 0, 140, 54, 'Junction box', 'field marshalling'],
        [570, -6, 140, 66, 'Control system', 'alarm and trip'],
        [185, 110, 150, 46, 'Reference standard', 'used at calibration'],
      ],
      flows: [[130, 27, 185, 27], [335, 27, 390, 27], [530, 27, 570, 27], [260, 60, 260, 110]],
    }
  }
  if (kind === 'drive') {
    return {
      title: 'Drive train schematic',
      boxes: [
        [0, 0, 120, 54, 'Supply and starter', '400 V 3ph'],
        [175, -6, 130, 66, 'Drive motor', model],
        [360, 0, 110, 54, 'Coupling', 'flexible element'],
        [520, -6, 150, 66, unit, 'driven unit'],
        [175, 110, 130, 46, 'Lubrication', 'grease or oil bath'],
        [520, 110, 150, 46, 'Condition monitoring', 'vibration and temperature'],
      ],
      flows: [[120, 27, 175, 27], [305, 27, 360, 27], [470, 27, 520, 27], [240, 60, 240, 110], [595, 60, 595, 110]],
    }
  }
  return {
    title: 'Plant schematic',
    boxes: [
      [0, 0, 120, 54, 'Supply', '400 V 3ph'],
      [175, -6, 130, 66, 'Local isolator', 'lockable'],
      [360, -6, 150, 66, unit, model],
      [565, 0, 120, 54, 'Duty / output', 'to process'],
      [360, 110, 150, 46, 'Control and alarms', 'local panel'],
    ],
    flows: [[120, 27, 175, 27], [305, 27, 360, 27], [510, 27, 565, 27], [435, 60, 435, 110]],
  }
}

// ── the drawing (landscape, title block + schematic) ────────────────────────
function renderDrawing(pdf, meta, asset, prof) {
  const W = LAND.w; const H = LAND.h
  band(pdf, { width: W, right: meta.docNo, rightLabel: `Rev ${meta.rev}`, title: 'Engineering Drawing' })

  // border
  pdf.setDrawColor(...INK); pdf.setLineWidth(1); pdf.rect(M / 2, 84, W - M, H - 84 - M / 2)

  const ox = 90; const oy = 150
  const box = (x, yb, w, h, label, sub) => {
    pdf.setDrawColor(...ACCENT); pdf.setLineWidth(1.2); pdf.setFillColor(255, 255, 255); pdf.roundedRect(x, yb, w, h, 4, 4, 'FD')
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(...INK)
    pdf.text(clean(label), x + w / 2, yb + h / 2 - 1, { align: 'center', maxWidth: w - 10 })
    if (sub) { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(...SUB); pdf.text(clean(sub), x + w / 2, yb + h / 2 + 11, { align: 'center', maxWidth: w - 8 }) }
  }
  const flow = (x1, y1, x2, y2) => { pdf.setDrawColor(...SUB); pdf.setLineWidth(1.4); pdf.line(x1, y1, x2, y2); pdf.setFillColor(...SUB); pdf.triangle(x2, y2, x2 - 7, y2 - 4, x2 - 7, y2 + 4, 'F') }

  const plan = schematicPlan(prof.schematic, asset, meta)
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(...INK)
  pdf.text(clean(plan.title), ox, oy - 18)
  plan.boxes.forEach(([x, yb, w, h, label, sub]) => box(ox + x, oy + yb, w, h, label, sub))
  plan.flows.forEach(([x1, y1, x2, y2]) => flow(ox + x1, oy + y1, ox + x2, oy + y2))

  // notes
  let ny = oy + 200
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(...MUTE); pdf.text('NOTES', ox, ny); ny += 14
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(...INK)
  const notes = [
    '1. This drawing is schematic and not to scale; refer to the asset register for tags.',
    '2. All work under the site permit-to-work and lockout/tagout procedures.',
    `3. Equipment: ${meta.manufacturer}, model ${meta.model}, asset ${meta.asset_code}.`,
    '4. Ratings and set-points per the O&M manual, section 3.',
    `5. Discipline: ${prof.discipline}.`,
  ]
  notes.forEach((n) => { pdf.text(clean(n), ox, ny); ny += 13 })

  // title block bottom-right
  const bw = 320; const bh = 96; const bx = W - M / 2 - bw; const by = H - M / 2 - bh
  pdf.setDrawColor(...INK); pdf.setLineWidth(0.8); pdf.rect(bx, by, bw, bh)
  pdf.line(bx, by + 54, bx + bw, by + 54); pdf.line(bx + bw * 0.62, by, bx + bw * 0.62, by + bh)
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(...INK)
  pdf.text(clean(meta.title), bx + 8, by + 20, { maxWidth: bw * 0.6 - 12 })
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...SUB)
  pdf.text(clean(`${meta.site || ''}  -  ${meta.location || ''}`), bx + 8, by + 40, { maxWidth: bw * 0.6 - 12 })
  const tbRow = (label, value, ry) => { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(...MUTE); pdf.text(clean(label).toUpperCase(), bx + 8, ry); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.setTextColor(...INK); pdf.text(clean(value), bx + 8, ry + 10) }
  tbRow('Drawn / checked', meta.uploaded_by_name, by + 66)
  tbRow('Date', meta.issued, by + 84)
  const rx = bx + bw * 0.62 + 8
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(...MUTE)
  pdf.text('DRAWING No.', rx, by + 14); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(...INK); pdf.text(clean(meta.docNo), rx, by + 26)
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(...MUTE); pdf.text('REV', rx, by + 42); pdf.text('SCALE', rx + 50, by + 42); pdf.text('SHEET', rx + 100, by + 42)
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(...INK); pdf.text(clean(meta.rev), rx, by + 54); pdf.text('NTS', rx + 50, by + 54); pdf.text('1 of 1', rx + 100, by + 54)
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(...MUTE); pdf.text('Oxmaint AI - representative drawing', rx, by + 84)
}

// ── the spares workbook (real .xlsx) ────────────────────────────────────────
async function renderSpares(doc, asset, prof, meta) {
  const XLSX = await import('xlsx')
  const header = ['Item', 'Part description', 'Part number', 'Manufacturer', 'Qty on hand', 'Min stock', 'Lead time (wks)', 'Unit cost']
  const rows = prof.spares.map((s, i) => {
    const seed = hash(keyOf(doc) + i)
    return [i + 1, s[0], s[1], meta.manufacturer, s[2], Math.max(1, Math.floor(s[2] / 2)), 2 + seed % 10, 40 + seed % 900]
  })
  const ws = XLSX.utils.aoa_to_sheet([
    [`${asset?.asset_name || doc.asset_name} - Recommended Spare Parts`],
    [`Asset ${meta.asset_code} - ${meta.manufacturer} - ${meta.site || ''}`],
    [`${meta.docNo} - Rev ${meta.rev} - issued ${meta.issued}`],
    [],
    header,
    ...rows,
  ])
  ws['!cols'] = [{ wch: 6 }, { wch: 32 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 10 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Spare parts')
  const name = `${clean(meta.docNo)}.xlsx`
  XLSX.writeFile(wb, name)
  return name
}

// ── entry point ─────────────────────────────────────────────────────────────
/**
 * Open one document from the library as the document it represents.
 *
 * `asset` is the register row the document is filed against — its type and
 * manufacturer are what make the paperwork this plant's rather than a template.
 * PDFs open in a new tab; the spare-parts list downloads as a real .xlsx.
 */
export async function openDocument(document, asset) {
  const doc = document
  const category = categoryOf(doc)
  const prof = classProfile(asset?.asset_type || doc.asset_type || doc.asset_name, asset?.manufacturer || doc.manufacturer)
  const meta = {
    docNo: docNo(doc), rev: rev(doc), title: titleOf(doc),
    manufacturer: asset?.manufacturer || doc.manufacturer || 'OEM',
    model: asset?.model || modelNo(doc, asset),
    asset_code: asset?.asset_code || asset?.asset_id || doc.asset_id || '-',
    site: asset?.site_name || '',
    location: asset?.functional_location_name || '',
    issued: fmtDay(doc.created_date),
    uploaded_by_name: doc.uploaded_by_name || '-',
    control: [
      ['Document number', docNo(doc)], ['Revision', rev(doc)], ['Issue date', fmtDay(doc.created_date)],
      ['Asset', `${asset?.asset_name || doc.asset_name} (${asset?.asset_code || doc.asset_id})`],
      ['Equipment type', asset?.asset_type || doc.asset_type || '-'],
      ['Manufacturer', asset?.manufacturer || doc.manufacturer || '-'],
      ['Site', asset?.site_name || '-'],
      ['Prepared by', doc.uploaded_by_name || '-'],
    ],
  }

  // Spare-parts list — a real workbook, because that is what a storeman is sent.
  if (category === 'Spares') return renderSpares(doc, asset, prof, meta)

  const { jsPDF } = await import('jspdf')

  // Drawing — a landscape sheet with a title block and a schematic.
  if (category === 'Drawing') {
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' })
    renderDrawing(pdf, meta, asset, prof)
    return openInTab(pdf, `${meta.docNo}.pdf`)
  }

  // Everything else — a portrait paper document.
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const spec = category === 'Report' ? reportSpec(doc, asset, prof)
    : category === 'Certificate' ? certSpec(doc, asset, prof)
      : manualSpec(doc, asset, prof, meta)
  await renderPaper(pdf, spec, meta)
  return openInTab(pdf, `${meta.docNo}.pdf`)
}
