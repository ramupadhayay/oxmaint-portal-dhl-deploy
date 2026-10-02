// Nutrition-plant reliability library.
// Synthetic reference in the portal's RCM shape. Not a customer's records.

const library = {
  "basis": "Synthetic RCM reference for a nutrition plant in the Orbe configuration — UHT, infant-formula wet and dry, hygiene and utilities. Not Nestlé production records and not a certified JA1011 study. Component-photo modes are the eight seeded captions.",
  "stages": [
    {
      "key": "uht",
      "label": "UHT"
    },
    {
      "key": "wet",
      "label": "Wet process"
    },
    {
      "key": "fill",
      "label": "Aseptic filling"
    },
    {
      "key": "dry",
      "label": "Evaporation and drying"
    },
    {
      "key": "hygiene",
      "label": "Hygiene"
    },
    {
      "key": "utilities",
      "label": "Utilities"
    },
    {
      "key": "components",
      "label": "Component photos"
    }
  ],
  "equipment": [
    {
      "kind": "Tubular UHT Sterilizer",
      "stopHours": 8,
      "stage": "uht",
      "criticality": "High",
      "purpose": "Hold product at sterilizing temperature for the validated time and divert if it is not.",
      "modes": [
        {
          "fn": "Hold product at sterilizing temperature for the validated time, and divert if it is not",
          "ff": "Product leaves the hold below the critical limit, or the diversion valve is slow",
          "mode": "Holding-temperature undershoot with late flow diversion",
          "effect": "Batch hold, possible market withdrawal on a released lot. Infant and UHT dairy are both quality-critical.",
          "product": "Unsterile product can reach the filler if diversion is late",
          "consequence": "Hidden",
          "severity": 10,
          "likelihood": 3,
          "detection": 4,
          "signal": "Holding-tube temperature",
          "task": "Prove diversion on a low-temp challenge each startup. Trend hold temp vs steam valve position. Calibrate the legal FT quarterly.",
          "interval": "every startup FF · quarterly calibration",
          "pf": 18,
          "grief": "Material"
        },
        {
          "fn": "Recover heat without mixing sterile and unsterile streams",
          "ff": "Pressure balance reverses and unsterile product leaks forward",
          "mode": "Regen tube leak with lost sterile-side overpressure",
          "effect": "Line stop and full CIP plus revalidation before release",
          "product": "Sterile side contaminated",
          "consequence": "Safety",
          "severity": 9,
          "likelihood": 3,
          "detection": 4,
          "signal": "",
          "task": "Keep sterile-side differential pressure alarmed. Pressure-decay the bundle each planned stop.",
          "interval": "continuous ΔP · each stop decay test",
          "pf": 0,
          "grief": "Equipment"
        }
      ]
    },
    {
      "kind": "Homogenizer",
      "stopHours": 6,
      "stage": "wet",
      "criticality": "High",
      "purpose": "Hold discharge pressure and particle size at the recipe setpoint without lubricant reaching product.",
      "modes": [
        {
          "fn": "Deliver a stable homogenizing pressure so fat globules stay in spec",
          "ff": "Discharge pressure will not hold at the recipe setpoint",
          "mode": "Valve-seat erosion and pressure instability",
          "effect": "Quality hold on filled stock. On the infant line the same valve family is a formulation-critical asset.",
          "product": "Fat globule size drifts; cream line in the pack",
          "consequence": "Production",
          "severity": 8,
          "likelihood": 6,
          "detection": 3,
          "signal": "First-stage pressure",
          "task": "Trend first-stage pressure and kW at fixed flow. Replace seat and impact ring on the pressure-decay slope, not on a fixed calendar.",
          "interval": "on signal · half the P-F",
          "pf": 6,
          "grief": "Vendor part"
        },
        {
          "fn": "Carry the plunger load without metal contact",
          "ff": "Bearing roughness shows up as vibration and oil temperature before a seizure",
          "mode": "Crank-end rolling-element bearing distress",
          "effect": "Unplanned stop of Line A for 1–3 shifts plus a crank repair. Product in the sterile line is dumped.",
          "product": "Risk of crank seizure and a bent plunger",
          "consequence": "Production",
          "severity": 8,
          "likelihood": 5,
          "detection": 3,
          "signal": "Crank-end velocity",
          "task": "Weekly vibration route on crank DE/NDE. Oil sample for water and wear metals. Do not reset the alarm and run to failure.",
          "interval": "weekly route · oil every 500 h",
          "pf": 5,
          "grief": "Material"
        },
        {
          "fn": "Seal the product cylinder without weeping into the crank or the floor",
          "ff": "Packing weeps product or lets lubricant migrate toward product",
          "mode": "Packing weep and lubricant cross-contact",
          "effect": "Hygiene deviation. Line stop until the plunger and packing are changed.",
          "product": "Micro or foreign-body risk if lube reaches product",
          "consequence": "Safety",
          "severity": 8,
          "likelihood": 4,
          "detection": 3,
          "signal": "Lantern-ring drip",
          "task": "Walk the lantern-ring drip each shift. Change packing on weep, not on a hopeful top-up.",
          "interval": "each shift walk · change on condition",
          "pf": 12,
          "grief": "Material"
        }
      ]
    },
    {
      "kind": "Plate Heat Exchanger",
      "stopHours": 5,
      "stage": "wet",
      "criticality": "High",
      "purpose": "Transfer heat between streams without mixing them.",
      "modes": [
        {
          "fn": "Keep product, water, and CIP streams in their own channels",
          "ff": "A gasket leak mixes streams or weeps to atmosphere",
          "mode": "Gasket compression set and cross-contact",
          "effect": "Batch rejection and a plate-pack teardown",
          "product": "Allergen or unpasteurized crossover",
          "consequence": "Safety",
          "severity": 9,
          "likelihood": 4,
          "detection": 4,
          "signal": "Water-side conductivity",
          "task": "Conductivity on the water side. Crack-test the pack at the planned stop. Regasket by cycle count, not only by year.",
          "interval": "continuous conductivity · stop crack-test",
          "pf": 21,
          "grief": "Material"
        },
        {
          "fn": "Hit the approach temperature at design flow",
          "ff": "Approach widens and the UHT steam demand rises",
          "mode": "Protein fouling and loss of heat transfer",
          "effect": "Shorter run length and an unplanned CIP",
          "product": "UHT becomes unstable; more diversion events",
          "consequence": "Production",
          "severity": 6,
          "likelihood": 6,
          "detection": 3,
          "signal": "",
          "task": "Trend approach temperature and steam-valve % at fixed flow. Trigger CIP on the slope.",
          "interval": "continuous",
          "pf": 0,
          "grief": "Material"
        }
      ]
    },
    {
      "kind": "Aseptic Filler",
      "stopHours": 6,
      "stage": "fill",
      "criticality": "High",
      "purpose": "Fill and seal a sterile pack inside a validated aseptic chamber.",
      "modes": [
        {
          "fn": "Present a sterile web and a sterile chamber to the product",
          "ff": "Peroxide concentration, temperature, or sterile-air overpressure leaves the validated window",
          "mode": "Loss of aseptic-chamber sterility",
          "effect": "Hold every pack since the last good check. Worst case is a released-lot withdrawal.",
          "product": "Filled packs are not commercially sterile",
          "consequence": "Hidden",
          "severity": 10,
          "likelihood": 3,
          "detection": 4,
          "signal": "",
          "task": "Failure-finding: peroxide titration each startup, chamber temp and overpressure alarms that cannot be silenced through a run, HEPA ΔP weekly.",
          "interval": "each startup · weekly HEPA",
          "pf": 0,
          "grief": "Equipment"
        },
        {
          "fn": "Make a hermetic seal at design speed",
          "ff": "Seal strength falls and leakers appear",
          "mode": "Jaw seal weakness from temperature or wear",
          "effect": "Quality hold and a jaw service. Complaints arrive days later if it ships.",
          "product": "Spoilage in the trade",
          "consequence": "Production",
          "severity": 8,
          "likelihood": 4,
          "detection": 4,
          "signal": "Transverse peel strength",
          "task": "Peel-test every hour of run. Trend jaw temperature. Change LS strip on the strength slope.",
          "interval": "hourly peel · continuous jaw temp",
          "pf": 14,
          "grief": "Vendor part"
        }
      ]
    },
    {
      "kind": "Evaporator",
      "stopHours": 8,
      "stage": "dry",
      "criticality": "High",
      "purpose": "Concentrate to a solids window under vacuum.",
      "modes": [
        {
          "fn": "Evaporate to the solids target without burn-on",
          "ff": "Vacuum or ΔT leaves the window and concentrate solids drift",
          "mode": "Calandria fouling and vacuum loss",
          "effect": "Dryer moisture swings and a wet-mix hold",
          "product": "Solids off-spec into the dryer feed",
          "consequence": "Production",
          "severity": 7,
          "likelihood": 5,
          "detection": 3,
          "signal": "First-effect vacuum",
          "task": "Trend vacuum, effect ΔT, and concentrate °Brix. CIP when the slope breaks, not only on the clock.",
          "interval": "continuous",
          "pf": 9,
          "grief": "Material"
        },
        {
          "fn": "Wet every tube so product does not dwell and scorch",
          "ff": "Dry patches scorch and specks show up in powder",
          "mode": "Burn-on from maldistribution",
          "effect": "Infant-formula batch rejection. Specks are a visible foreign-body class complaint.",
          "product": "Powder color and insolubility index fail",
          "consequence": "Production",
          "severity": 8,
          "likelihood": 3,
          "detection": 4,
          "signal": "",
          "task": "Inspect the distribution plate every CIP. Color and scorched-particle test on each concentrate batch.",
          "interval": "every CIP · each batch lab",
          "pf": 0,
          "grief": "Vendor part"
        }
      ]
    },
    {
      "kind": "Spray Dryer",
      "stopHours": 10,
      "stage": "dry",
      "criticality": "High",
      "purpose": "Dry concentrate to a powder specification without a fire or a wet cyclone.",
      "modes": [
        {
          "fn": "Dry powder without a smolder or dust explosion",
          "ff": "Deposits overheat or a spark finds a dust cloud",
          "mode": "Chamber-deposit smolder and fire",
          "effect": "Safety event and a multi-day dryer outage. Infant tower is the plant bottleneck.",
          "product": "Fire suppression trip, wet powder, possible explosion",
          "consequence": "Safety",
          "severity": 10,
          "likelihood": 3,
          "detection": 3,
          "signal": "Chamber CO",
          "task": "CO and chamber IR cameras. Outlet temperature interlock. Campaign-length limit tied to deposit inspection, not only hours.",
          "interval": "continuous CO/IR · campaign inspection",
          "pf": 14,
          "grief": "Equipment"
        },
        {
          "fn": "Spin the wheel at speed without a crash into the chamber",
          "ff": "Bearing defect shows as high-frequency vibration before a wheel rub",
          "mode": "Atomizer spindle bearing wear",
          "effect": "Foreign-body risk in infant powder plus a spindle change. Stop on the vibration step-change.",
          "product": "Wheel rub, chamber damage, metal in powder",
          "consequence": "Safety",
          "severity": 9,
          "likelihood": 4,
          "detection": 3,
          "signal": "Atomizer spindle vibration",
          "task": "Continuous vibration on the atomizer with a hard trip. Oil or grease on the OEM interval. Wheel balance after every clean.",
          "interval": "continuous · balance each CIP",
          "pf": 11,
          "grief": "Material"
        },
        {
          "fn": "Hit the powder moisture target",
          "ff": "Outlet moisture drifts and water activity fails",
          "mode": "Outlet-moisture drift",
          "effect": "Infant batch held for rework or dump",
          "product": "Caking in the bag, microbiology risk if wet",
          "consequence": "Production",
          "severity": 7,
          "likelihood": 5,
          "detection": 3,
          "signal": "",
          "task": "In-line moisture or outlet temperature cascade. Lab moisture every hour while the evaporator solids are moving.",
          "interval": "continuous · hourly lab",
          "pf": 0,
          "grief": "Equipment"
        }
      ]
    },
    {
      "kind": "CIP Set",
      "stopHours": 4,
      "stage": "hygiene",
      "criticality": "High",
      "purpose": "Deliver the validated clean so the next batch starts sterile.",
      "modes": [
        {
          "fn": "Deliver a clean that actually meets time, temperature, and chemistry",
          "ff": "Conductivity or return temperature is short and the object is released as clean",
          "mode": "Short caustic clean hidden by a forced step-complete",
          "effect": "Micro fail on the next product. The failure is hidden at the moment of the clean.",
          "product": "Soil left in the UHT or evaporator",
          "consequence": "Hidden",
          "severity": 9,
          "likelihood": 4,
          "detection": 5,
          "signal": "",
          "task": "Failure-finding: the PLC must not advance on a bypass. Audit forced completes weekly. Independent conductivity check monthly.",
          "interval": "weekly audit · monthly probe check",
          "pf": 0,
          "grief": "Material"
        },
        {
          "fn": "Route CIP to the selected object and nowhere else",
          "ff": "A seat leaks and CIP chemical reaches a line that is in product",
          "mode": "Mixproof seat leak into a live product line",
          "effect": "Immediate dump and a food-safety incident",
          "product": "Caustic in product",
          "consequence": "Hidden",
          "severity": 10,
          "likelihood": 2,
          "detection": 4,
          "signal": "",
          "task": "Seat-lift test on the mixproofs each week. Do not skip the leakage chamber alarm.",
          "interval": "weekly seat-lift",
          "pf": 0,
          "grief": "Vendor part"
        }
      ]
    },
    {
      "kind": "Compressed Air Package",
      "stopHours": 4,
      "stage": "utilities",
      "criticality": "Medium",
      "purpose": "Supply dry oil-free air to valves and the filler.",
      "modes": [
        {
          "fn": "Supply oil-free air at the dewpoint the filler was validated on",
          "ff": "Dewpoint rises and wet air enters the aseptic filters",
          "mode": "Dewpoint excursion on instrument and sterile air",
          "effect": "Filler stop until air quality is back inside the validation",
          "product": "Wet HEPA, sterility risk at the filler",
          "consequence": "Production",
          "severity": 8,
          "likelihood": 3,
          "detection": 3,
          "signal": "Header dewpoint",
          "task": "Continuous dewpoint with a hard interlock to the filler. Particle count on the sterile header monthly.",
          "interval": "continuous dewpoint",
          "pf": 14,
          "grief": "Material"
        },
        {
          "fn": "Compress without overheating the oil-free stage",
          "ff": "Stage discharge temperature climbs toward the trip",
          "mode": "Stage-2 high temperature from cooler fouling",
          "effect": "Aseptic filler stops. Product in the chamber is at risk if air is lost.",
          "product": "Trip, loss of filler overpressure",
          "consequence": "Production",
          "severity": 7,
          "likelihood": 4,
          "detection": 3,
          "signal": "Stage-2 discharge",
          "task": "Trend stage temperatures and cooling-water ΔT. Clean coolers on the slope.",
          "interval": "continuous",
          "pf": 20,
          "grief": "Material"
        }
      ]
    },
    {
      "kind": "Refrigeration Pack",
      "stopHours": 6,
      "stage": "utilities",
      "criticality": "High",
      "purpose": "Hold glycol temperature for raw milk and finished stores.",
      "modes": [
        {
          "fn": "Compress ammonia and return oil to the screw",
          "ff": "Discharge temperature rises and oil logs in the system",
          "mode": "Oil carryover and high discharge temperature",
          "effect": "Raw-milk silo temperature climbs. A warm silo is a dump.",
          "product": "Capacity loss, glycol temperature rises",
          "consequence": "Production",
          "severity": 8,
          "likelihood": 4,
          "detection": 3,
          "signal": "Discharge temperature",
          "task": "Trend discharge temperature and oil level. Vibration on the screw monthly. Do not wait for the silo alarm.",
          "interval": "continuous temp · monthly vibration",
          "pf": 16,
          "grief": "Material"
        },
        {
          "fn": "Keep ammonia inside the machine room boundary",
          "ff": "A seal leak is not detected until the room detector alarms — or until it doesn't",
          "mode": "Shaft-seal leak with a failed room detector",
          "effect": "Safety event. Production stop is secondary.",
          "product": "Technician exposure, evacuation",
          "consequence": "Hidden",
          "severity": 10,
          "likelihood": 2,
          "detection": 4,
          "signal": "",
          "task": "Failure-finding on the room detectors with a bump test monthly. Seal ppm route. Ventilation proof.",
          "interval": "monthly bump test",
          "pf": 0,
          "grief": "Equipment"
        }
      ]
    },
    {
      "kind": "Process Water RO",
      "stopHours": 4,
      "stage": "utilities",
      "criticality": "Medium",
      "purpose": "Make recipe water and the CIP final rinse inside the conductivity limit.",
      "modes": [
        {
          "fn": "Hold permeate conductivity inside the recipe limit",
          "ff": "Salt passage rises and ingredient water fails spec",
          "mode": "Membrane salt-passage rise",
          "effect": "Wet-mix hold. Infant formula is unforgiving on minerals.",
          "product": "Recipe water out of mineral spec",
          "consequence": "Production",
          "severity": 7,
          "likelihood": 4,
          "detection": 3,
          "signal": "Permeate conductivity",
          "task": "Normalize permeate conductivity and flux weekly. Clean or replace on the slope, not when the lab already failed a batch.",
          "interval": "weekly normalized trend",
          "pf": 30,
          "grief": "Material"
        },
        {
          "fn": "Dose the permeate so the water is not a micro vector",
          "ff": "UV intensity is low and water is still released",
          "mode": "UV dose loss hidden by a bypassed alarm",
          "effect": "Hidden hygiene failure into every recipe that shift",
          "product": "Ingredient water micro risk",
          "consequence": "Hidden",
          "severity": 8,
          "likelihood": 3,
          "detection": 5,
          "signal": "",
          "task": "Failure-finding: lamp-hour lockout, intensity alarm that stops the permeate pump, sleeve clean on the CIP of the skid.",
          "interval": "continuous intensity · lamp hours",
          "pf": 0,
          "grief": "Material"
        }
      ]
    },
    {
      "kind": "Drive Chain",
      "stopHours": 3,
      "stage": "components",
      "criticality": "High",
      "purpose": "Transmit drive torque without skipping or snapping.",
      "modes": [
        {
          "fn": "Transmit torque to the driven shaft",
          "ff": "The chain jumps or breaks",
          "mode": "Fatigue or overload, with lubrication or alignment upstream",
          "effect": "Unplanned stop until the chain and sprocket are changed.",
          "product": "Line down. No product quality hold unless the stop is mid-fill.",
          "consequence": "Production",
          "severity": 7,
          "likelihood": 5,
          "signal": "",
          "task": "Measure elongation, inspect sprocket tooth wear, and review load and lubrication history.",
          "interval": "on the route",
          "pf": 21,
          "grief": "Material"
        }
      ]
    },
    {
      "kind": "Coupling",
      "stopHours": 3,
      "stage": "components",
      "criticality": "Medium",
      "purpose": "Connect driver and driven shaft and shed a jam before the shaft does.",
      "modes": [
        {
          "fn": "Transmit torque and accommodate small misalignment",
          "ff": "The hub or the elastomer fails",
          "mode": "Misalignment, overload, or jam",
          "effect": "Drive stops. A continued run marks the shaft.",
          "product": "Unplanned stop.",
          "consequence": "Production",
          "severity": 6,
          "likelihood": 4,
          "signal": "",
          "task": "Alignment check, last torque event, and inspect the driven shaft.",
          "interval": "after a jam",
          "pf": 0,
          "grief": "Workmanship"
        }
      ]
    },
    {
      "kind": "Bearing",
      "stopHours": 5,
      "stage": "components",
      "criticality": "High",
      "purpose": "Carry the shaft without roughness, heat, or debris in the product zone.",
      "modes": [
        {
          "fn": "Run within its temperature and roughness limit",
          "ff": "The race overheats or scores",
          "mode": "Lubrication failure",
          "effect": "Heat, then seizure and an unplanned stop.",
          "product": "Possible lubricant near product if the seal follows.",
          "consequence": "Environment",
          "severity": 8,
          "likelihood": 6,
          "signal": "Bearing temperature",
          "task": "Check grease type, interval, and temperature history.",
          "interval": "each lubrication route",
          "pf": 10,
          "grief": "Material"
        },
        {
          "fn": "Keep a smooth race under a VFD",
          "ff": "Fluting appears on the race",
          "mode": "Electrical erosion",
          "effect": "Noise, then a short life.",
          "product": "Unplanned bearing change.",
          "consequence": "Production",
          "severity": 7,
          "likelihood": 4,
          "signal": "Shaft voltage",
          "task": "Check shaft current, grounding, and the VFD path.",
          "interval": "on vibration route",
          "pf": 30,
          "grief": "Equipment"
        },
        {
          "fn": "Keep the race clean",
          "ff": "Particles embed in the race",
          "mode": "Contamination",
          "effect": "Roughness and a short life.",
          "product": "Unplanned stop. Check the product side of the seal.",
          "consequence": "Environment",
          "severity": 7,
          "likelihood": 5,
          "signal": "",
          "task": "Check seal condition and the ingress path.",
          "interval": "on the route",
          "pf": 14,
          "grief": "Vendor part"
        },
        {
          "fn": "Share load across the race",
          "ff": "Wear is on one side only",
          "mode": "Misalignment",
          "effect": "Early fatigue on one shoulder.",
          "product": "Unplanned stop.",
          "consequence": "Production",
          "severity": 6,
          "likelihood": 4,
          "signal": "",
          "task": "Check shaft alignment and the housing.",
          "interval": "after a coupling or frame move",
          "pf": 0,
          "grief": "Workmanship"
        },
        {
          "fn": "Last the rated hours at the design load",
          "ff": "The race spalls",
          "mode": "Fatigue or spalling",
          "effect": "Vibration, then a stop.",
          "product": "Unplanned bearing change.",
          "consequence": "Production",
          "severity": 7,
          "likelihood": 4,
          "signal": "Bearing vibration",
          "task": "Review hours and load, then replace versus monitor.",
          "interval": "on vibration route",
          "pf": 21,
          "grief": "Equipment"
        }
      ]
    },
    {
      "kind": "PCB Assembly",
      "stopHours": 4,
      "stage": "components",
      "criticality": "High",
      "purpose": "Switch and condition power for the drive or the instrument without a thermal event.",
      "modes": [
        {
          "fn": "Carry the design current without overheating a device",
          "ff": "A device chars or a pad lifts",
          "mode": "Overcurrent, short, or thermal runaway",
          "effect": "The panel is dead until the board is replaced. Do not re-energize first.",
          "product": "Unplanned stop of the equipment that board serves.",
          "consequence": "Safety",
          "severity": 8,
          "likelihood": 3,
          "signal": "",
          "task": "Identify the device and check the upstream supply. Do not re-energize until the cause is bounded.",
          "interval": "on failure",
          "pf": 0,
          "grief": "Vendor part"
        }
      ]
    }
  ]
}

export default { key: 'nestle', label: 'Nutrition plant', own: false, ...library }
