// GENERATED FILE - DO NOT EDIT BY HAND.
//
// Produced by scripts/import-fsm-workbooks.mjs from
// data-source/DigitalRealty_FSM_PoC_Master_Data.xlsx
//
// Every value is carried across exactly as authored. This is client deliverable
// data that gets read back against a Statement of Work, so it is not rounded,
// reformatted or "tidied" on the way in. Edit the workbook and re-run
// `npm run import:fsm`.


export const SITES = [
  {
    "siteId": "IAD35",
    "siteName": "Ashburn Campus - Building 35",
    "region": "NAM",
    "country": "United States",
    "metro": "Ashburn, Virginia",
    "facilityType": "Hyperscale / Wholesale",
    "designTier": "Uptime Tier III-equivalent",
    "powerRedundancy": "2N",
    "coolingRedundancy": "N+1",
    "pocZone": "Data Hall 3, Suite C",
    "itLoadMw": 18,
    "grossAreaSqFt": 210000,
    "pocStatus": "Proposed"
  },
  {
    "siteId": "ORD12",
    "siteName": "Franklin Park Campus - Building 12",
    "region": "NAM",
    "country": "United States",
    "metro": "Chicago, Illinois",
    "facilityType": "Colocation / Interconnection",
    "designTier": "Uptime Tier III-equivalent",
    "powerRedundancy": "N+1",
    "coolingRedundancy": "N+1",
    "pocZone": "Data Hall 1, Suite A",
    "itLoadMw": 9.5,
    "grossAreaSqFt": 140000,
    "pocStatus": "Proposed"
  },
  {
    "siteId": "LHR10",
    "siteName": "London Campus - Building 10",
    "region": "EMEA",
    "country": "United Kingdom",
    "metro": "London (Docklands/Woking)",
    "facilityType": "Colocation / Interconnection",
    "designTier": "Uptime Tier III-equivalent",
    "powerRedundancy": "2N",
    "coolingRedundancy": "N+1",
    "pocZone": "Data Hall 2, Suite B",
    "itLoadMw": 12,
    "grossAreaSqFt": 165000,
    "pocStatus": "Proposed"
  },
  {
    "siteId": "FRA15",
    "siteName": "Hanauer Landstrasse Campus - Building 15",
    "region": "EMEA",
    "country": "Germany",
    "metro": "Frankfurt",
    "facilityType": "Hyperscale / Interconnection",
    "designTier": "Uptime Tier III-equivalent",
    "powerRedundancy": "2N",
    "coolingRedundancy": "N+1",
    "pocZone": "Data Hall 4, Suite D",
    "itLoadMw": 20,
    "grossAreaSqFt": 225000,
    "pocStatus": "Proposed"
  },
  {
    "siteId": "SIN11",
    "siteName": "Loyang Campus - Building 11",
    "region": "APAC",
    "country": "Singapore",
    "metro": "Singapore",
    "facilityType": "Colocation / Hyperscale",
    "designTier": "Uptime Tier III-equivalent",
    "powerRedundancy": "N+1",
    "coolingRedundancy": "N+1",
    "pocZone": "Data Hall 1, Suite A",
    "itLoadMw": 15,
    "grossAreaSqFt": 180000,
    "pocStatus": "Proposed"
  },
  {
    "siteId": "SYD12",
    "siteName": "Erskine Park Campus - Building 12",
    "region": "APAC",
    "country": "Australia",
    "metro": "Sydney",
    "facilityType": "Hyperscale / Wholesale",
    "designTier": "Uptime Tier III-equivalent",
    "powerRedundancy": "2N",
    "coolingRedundancy": "N+1",
    "pocZone": "Data Hall 2, Suite B",
    "itLoadMw": 11,
    "grossAreaSqFt": 150000,
    "pocStatus": "Proposed"
  }
]

export const LOCATIONS = [
  {
    "locationId": "IAD35-BLDG01",
    "parentId": "IAD35",
    "siteId": "IAD35",
    "locationType": "Building",
    "locationName": "Ashburn Campus - Building 35"
  },
  {
    "locationId": "IAD35-FLR01",
    "parentId": "IAD35-BLDG01",
    "siteId": "IAD35",
    "locationType": "Floor",
    "locationName": "Floor 1 - White Space Level"
  },
  {
    "locationId": "IAD35-DHPOC",
    "parentId": "IAD35-FLR01",
    "siteId": "IAD35",
    "locationType": "Data Hall (PoC Zone)",
    "locationName": "Data Hall 3, Suite C"
  },
  {
    "locationId": "IAD35-ELEC01",
    "parentId": "IAD35-FLR01",
    "siteId": "IAD35",
    "locationType": "Electrical Room",
    "locationName": "Electrical Switchgear Room 1 (serving PoC zone)"
  },
  {
    "locationId": "IAD35-MECH01",
    "parentId": "IAD35-BLDG01",
    "siteId": "IAD35",
    "locationType": "Mechanical Plant / Yard",
    "locationName": "Central Utility Plant / Mechanical Yard"
  },
  {
    "locationId": "IAD35-GENYD01",
    "parentId": "IAD35-BLDG01",
    "siteId": "IAD35",
    "locationType": "Generator Yard",
    "locationName": "Standby Generator Yard"
  },
  {
    "locationId": "ORD12-BLDG01",
    "parentId": "ORD12",
    "siteId": "ORD12",
    "locationType": "Building",
    "locationName": "Franklin Park Campus - Building 12"
  },
  {
    "locationId": "ORD12-FLR01",
    "parentId": "ORD12-BLDG01",
    "siteId": "ORD12",
    "locationType": "Floor",
    "locationName": "Floor 1 - White Space Level"
  },
  {
    "locationId": "ORD12-DHPOC",
    "parentId": "ORD12-FLR01",
    "siteId": "ORD12",
    "locationType": "Data Hall (PoC Zone)",
    "locationName": "Data Hall 1, Suite A"
  },
  {
    "locationId": "ORD12-ELEC01",
    "parentId": "ORD12-FLR01",
    "siteId": "ORD12",
    "locationType": "Electrical Room",
    "locationName": "Electrical Switchgear Room 1 (serving PoC zone)"
  },
  {
    "locationId": "ORD12-MECH01",
    "parentId": "ORD12-BLDG01",
    "siteId": "ORD12",
    "locationType": "Mechanical Plant / Yard",
    "locationName": "Central Utility Plant / Mechanical Yard"
  },
  {
    "locationId": "ORD12-GENYD01",
    "parentId": "ORD12-BLDG01",
    "siteId": "ORD12",
    "locationType": "Generator Yard",
    "locationName": "Standby Generator Yard"
  },
  {
    "locationId": "LHR10-BLDG01",
    "parentId": "LHR10",
    "siteId": "LHR10",
    "locationType": "Building",
    "locationName": "London Campus - Building 10"
  },
  {
    "locationId": "LHR10-FLR01",
    "parentId": "LHR10-BLDG01",
    "siteId": "LHR10",
    "locationType": "Floor",
    "locationName": "Floor 1 - White Space Level"
  },
  {
    "locationId": "LHR10-DHPOC",
    "parentId": "LHR10-FLR01",
    "siteId": "LHR10",
    "locationType": "Data Hall (PoC Zone)",
    "locationName": "Data Hall 2, Suite B"
  },
  {
    "locationId": "LHR10-ELEC01",
    "parentId": "LHR10-FLR01",
    "siteId": "LHR10",
    "locationType": "Electrical Room",
    "locationName": "Electrical Switchgear Room 1 (serving PoC zone)"
  },
  {
    "locationId": "LHR10-MECH01",
    "parentId": "LHR10-BLDG01",
    "siteId": "LHR10",
    "locationType": "Mechanical Plant / Yard",
    "locationName": "Central Utility Plant / Mechanical Yard"
  },
  {
    "locationId": "LHR10-GENYD01",
    "parentId": "LHR10-BLDG01",
    "siteId": "LHR10",
    "locationType": "Generator Yard",
    "locationName": "Standby Generator Yard"
  },
  {
    "locationId": "FRA15-BLDG01",
    "parentId": "FRA15",
    "siteId": "FRA15",
    "locationType": "Building",
    "locationName": "Hanauer Landstrasse Campus - Building 15"
  },
  {
    "locationId": "FRA15-FLR01",
    "parentId": "FRA15-BLDG01",
    "siteId": "FRA15",
    "locationType": "Floor",
    "locationName": "Floor 1 - White Space Level"
  },
  {
    "locationId": "FRA15-DHPOC",
    "parentId": "FRA15-FLR01",
    "siteId": "FRA15",
    "locationType": "Data Hall (PoC Zone)",
    "locationName": "Data Hall 4, Suite D"
  },
  {
    "locationId": "FRA15-ELEC01",
    "parentId": "FRA15-FLR01",
    "siteId": "FRA15",
    "locationType": "Electrical Room",
    "locationName": "Electrical Switchgear Room 1 (serving PoC zone)"
  },
  {
    "locationId": "FRA15-MECH01",
    "parentId": "FRA15-BLDG01",
    "siteId": "FRA15",
    "locationType": "Mechanical Plant / Yard",
    "locationName": "Central Utility Plant / Mechanical Yard"
  },
  {
    "locationId": "FRA15-GENYD01",
    "parentId": "FRA15-BLDG01",
    "siteId": "FRA15",
    "locationType": "Generator Yard",
    "locationName": "Standby Generator Yard"
  },
  {
    "locationId": "SIN11-BLDG01",
    "parentId": "SIN11",
    "siteId": "SIN11",
    "locationType": "Building",
    "locationName": "Loyang Campus - Building 11"
  },
  {
    "locationId": "SIN11-FLR01",
    "parentId": "SIN11-BLDG01",
    "siteId": "SIN11",
    "locationType": "Floor",
    "locationName": "Floor 1 - White Space Level"
  },
  {
    "locationId": "SIN11-DHPOC",
    "parentId": "SIN11-FLR01",
    "siteId": "SIN11",
    "locationType": "Data Hall (PoC Zone)",
    "locationName": "Data Hall 1, Suite A"
  },
  {
    "locationId": "SIN11-ELEC01",
    "parentId": "SIN11-FLR01",
    "siteId": "SIN11",
    "locationType": "Electrical Room",
    "locationName": "Electrical Switchgear Room 1 (serving PoC zone)"
  },
  {
    "locationId": "SIN11-MECH01",
    "parentId": "SIN11-BLDG01",
    "siteId": "SIN11",
    "locationType": "Mechanical Plant / Yard",
    "locationName": "Central Utility Plant / Mechanical Yard"
  },
  {
    "locationId": "SIN11-GENYD01",
    "parentId": "SIN11-BLDG01",
    "siteId": "SIN11",
    "locationType": "Generator Yard",
    "locationName": "Standby Generator Yard"
  },
  {
    "locationId": "SYD12-BLDG01",
    "parentId": "SYD12",
    "siteId": "SYD12",
    "locationType": "Building",
    "locationName": "Erskine Park Campus - Building 12"
  },
  {
    "locationId": "SYD12-FLR01",
    "parentId": "SYD12-BLDG01",
    "siteId": "SYD12",
    "locationType": "Floor",
    "locationName": "Floor 1 - White Space Level"
  },
  {
    "locationId": "SYD12-DHPOC",
    "parentId": "SYD12-FLR01",
    "siteId": "SYD12",
    "locationType": "Data Hall (PoC Zone)",
    "locationName": "Data Hall 2, Suite B"
  },
  {
    "locationId": "SYD12-ELEC01",
    "parentId": "SYD12-FLR01",
    "siteId": "SYD12",
    "locationType": "Electrical Room",
    "locationName": "Electrical Switchgear Room 1 (serving PoC zone)"
  },
  {
    "locationId": "SYD12-MECH01",
    "parentId": "SYD12-BLDG01",
    "siteId": "SYD12",
    "locationType": "Mechanical Plant / Yard",
    "locationName": "Central Utility Plant / Mechanical Yard"
  },
  {
    "locationId": "SYD12-GENYD01",
    "parentId": "SYD12-BLDG01",
    "siteId": "SYD12",
    "locationType": "Generator Yard",
    "locationName": "Standby Generator Yard"
  }
]

export const ASSET_CLASSES = [
  {
    "classId": "MEC-CRAH",
    "category": "Mechanical",
    "className": "CRAH Unit (Computer Room Air Handler)",
    "sowRef": "3.2",
    "defaultCriticality": "High",
    "monitoring": "Vibration, Thermal",
    "strategy": "Condition-Based (Pilot) + Preventive (Baseline)"
  },
  {
    "classId": "MEC-CRAC",
    "category": "Mechanical",
    "className": "CRAC Unit (Computer Room Air Conditioner)",
    "sowRef": "3.2",
    "defaultCriticality": "High",
    "monitoring": "Vibration, Thermal",
    "strategy": "Condition-Based (Pilot) + Preventive (Baseline)"
  },
  {
    "classId": "MEC-CHIL",
    "category": "Mechanical",
    "className": "Chiller",
    "sowRef": "3.2",
    "defaultCriticality": "Critical",
    "monitoring": "Vibration, Thermal, Ultrasound",
    "strategy": "Condition-Based (Pilot) + Preventive (Baseline)"
  },
  {
    "classId": "MEC-COND",
    "category": "Mechanical",
    "className": "Condenser",
    "sowRef": "3.2",
    "defaultCriticality": "High",
    "monitoring": "Vibration, Thermal",
    "strategy": "Condition-Based (Pilot) + Preventive (Baseline)"
  },
  {
    "classId": "MEC-CTWR",
    "category": "Mechanical",
    "className": "Cooling Tower",
    "sowRef": "3.2",
    "defaultCriticality": "High",
    "monitoring": "Vibration, Thermal",
    "strategy": "Condition-Based (Pilot) + Preventive (Baseline)"
  },
  {
    "classId": "MEC-PUMP",
    "category": "Mechanical",
    "className": "Pump (Chilled / Condenser Water)",
    "sowRef": "3.2",
    "defaultCriticality": "High",
    "monitoring": "Vibration, Ultrasound",
    "strategy": "Condition-Based (Pilot) + Preventive (Baseline)"
  },
  {
    "classId": "MEC-AHU",
    "category": "Mechanical",
    "className": "Air Handling Unit (AHU)",
    "sowRef": "3.2",
    "defaultCriticality": "Medium",
    "monitoring": "Vibration, Thermal",
    "strategy": "Condition-Based (Pilot) + Preventive (Baseline)"
  },
  {
    "classId": "MEC-DRYC",
    "category": "Mechanical",
    "className": "Dry Cooler",
    "sowRef": "3.2",
    "defaultCriticality": "Medium",
    "monitoring": "Vibration, Thermal",
    "strategy": "Condition-Based (Pilot) + Preventive (Baseline)"
  },
  {
    "classId": "ELE-UPS",
    "category": "Electrical",
    "className": "UPS System",
    "sowRef": "3.2",
    "defaultCriticality": "Critical",
    "monitoring": "Thermal, Ultrasound",
    "strategy": "Condition-Based (Pilot) + Preventive (Baseline)"
  },
  {
    "classId": "ELE-STS",
    "category": "Electrical",
    "className": "Static Transfer Switch",
    "sowRef": "3.2",
    "defaultCriticality": "Critical",
    "monitoring": "Thermal, Ultrasound",
    "strategy": "Condition-Based (Pilot) + Preventive (Baseline)"
  },
  {
    "classId": "ELE-PDU",
    "category": "Electrical",
    "className": "PDU System (Power Distribution Unit)",
    "sowRef": "3.2",
    "defaultCriticality": "Critical",
    "monitoring": "Thermal, Ultrasound",
    "strategy": "Condition-Based (Pilot) + Preventive (Baseline)"
  },
  {
    "classId": "ELE-LVSG",
    "category": "Electrical",
    "className": "LV Switchgear",
    "sowRef": "3.2",
    "defaultCriticality": "Critical",
    "monitoring": "Thermal, Ultrasound",
    "strategy": "Condition-Based (Pilot) + Preventive (Baseline)"
  },
  {
    "classId": "ELE-HVSG",
    "category": "Electrical",
    "className": "HV Switchgear",
    "sowRef": "3.2",
    "defaultCriticality": "Critical",
    "monitoring": "Thermal, Ultrasound",
    "strategy": "Condition-Based (Pilot) + Preventive (Baseline)"
  },
  {
    "classId": "ELE-XFMR",
    "category": "Electrical",
    "className": "Transformer",
    "sowRef": "3.2",
    "defaultCriticality": "Critical",
    "monitoring": "Thermal, Ultrasound",
    "strategy": "Condition-Based (Pilot) + Preventive (Baseline)"
  },
  {
    "classId": "ELE-GENA",
    "category": "Electrical",
    "className": "Generator Auxiliary Systems (fuel, starting, control)",
    "sowRef": "3.2",
    "defaultCriticality": "High",
    "monitoring": "Thermal, Ultrasound",
    "strategy": "Condition-Based (Pilot) + Preventive (Baseline)"
  },
  {
    "classId": "ELE-GENS",
    "category": "Electrical",
    "className": "Standby Generator Set (parent asset)",
    "sowRef": "Supplementary - not explicitly listed in SOW 3.2 but required to contextualize Generator Auxiliary Systems; recommended addition",
    "defaultCriticality": "Critical",
    "monitoring": "Vibration, Thermal, Ultrasound",
    "strategy": "Preventive (Baseline) - NFPA 110; PoC monitors auxiliaries only"
  },
  {
    "classId": "SUP-BMS",
    "category": "Supporting Systems",
    "className": "BMS Infrastructure (Controllers / Field Panels)",
    "sowRef": "3.2",
    "defaultCriticality": "High",
    "monitoring": "Existing Telemetry Only",
    "strategy": "Preventive (Baseline); data source for PoC"
  },
  {
    "classId": "SUP-PMS",
    "category": "Supporting Systems",
    "className": "Power Monitoring System (EPMS)",
    "sowRef": "3.2",
    "defaultCriticality": "High",
    "monitoring": "Existing Telemetry Only",
    "strategy": "Preventive (Baseline); data source for PoC"
  },
  {
    "classId": "SUP-BAT",
    "category": "Supporting Systems",
    "className": "Battery Monitoring System",
    "sowRef": "3.2",
    "defaultCriticality": "High",
    "monitoring": "Existing Telemetry Only",
    "strategy": "Preventive (Baseline); data source for PoC"
  },
  {
    "classId": "SUP-OT",
    "category": "Supporting Systems",
    "className": "Network-Enabled Operational Technology Asset",
    "sowRef": "3.2",
    "defaultCriticality": "Medium",
    "monitoring": "Existing Telemetry Only",
    "strategy": "Preventive (Baseline); data source for PoC"
  }
]

export const MANUFACTURERS = [
  {
    "classId": "MEC-CRAH",
    "className": "CRAH Unit (Computer Room Air Handler)",
    "manufacturers": "Vertiv (Liebert), Stulz, Airedale"
  },
  {
    "classId": "MEC-CRAC",
    "className": "CRAC Unit (Computer Room Air Conditioner)",
    "manufacturers": "Vertiv (Liebert), Stulz, Airedale"
  },
  {
    "classId": "MEC-CHIL",
    "className": "Chiller",
    "manufacturers": "Trane, York (Johnson Controls), Carrier"
  },
  {
    "classId": "MEC-COND",
    "className": "Condenser",
    "manufacturers": "Baltimore Aircoil Company (BAC), EVAPCO, SPX Cooling"
  },
  {
    "classId": "MEC-CTWR",
    "className": "Cooling Tower",
    "manufacturers": "Baltimore Aircoil Company (BAC), EVAPCO, SPX Cooling"
  },
  {
    "classId": "MEC-PUMP",
    "className": "Pump (Chilled / Condenser Water)",
    "manufacturers": "Grundfos, Armstrong Fluid Technology, Bell & Gossett"
  },
  {
    "classId": "MEC-AHU",
    "className": "Air Handling Unit (AHU)",
    "manufacturers": "Trane, Munters, York (Johnson Controls)"
  },
  {
    "classId": "MEC-DRYC",
    "className": "Dry Cooler",
    "manufacturers": "EVAPCO, Guentner, Baltimore Aircoil Company (BAC)"
  },
  {
    "classId": "ELE-UPS",
    "className": "UPS System",
    "manufacturers": "Vertiv (Liebert), Schneider Electric (Galaxy), Eaton, Piller"
  },
  {
    "classId": "ELE-STS",
    "className": "Static Transfer Switch",
    "manufacturers": "Vertiv, ABB, Piller"
  },
  {
    "classId": "ELE-PDU",
    "className": "PDU System (Power Distribution Unit)",
    "manufacturers": "Vertiv, Schneider Electric, Eaton"
  },
  {
    "classId": "ELE-LVSG",
    "className": "LV Switchgear",
    "manufacturers": "Schneider Electric, Siemens, Eaton"
  },
  {
    "classId": "ELE-HVSG",
    "className": "HV Switchgear",
    "manufacturers": "Siemens, ABB, Schneider Electric"
  },
  {
    "classId": "ELE-XFMR",
    "className": "Transformer",
    "manufacturers": "Siemens, ABB, Schneider Electric"
  },
  {
    "classId": "ELE-GENA",
    "className": "Generator Auxiliary Systems (fuel, starting, control)",
    "manufacturers": "Caterpillar, Cummins, MTU / Rolls-Royce, Kohler"
  },
  {
    "classId": "ELE-GENS",
    "className": "Standby Generator Set (parent asset)",
    "manufacturers": "Caterpillar, Cummins, MTU / Rolls-Royce, Kohler"
  },
  {
    "classId": "SUP-BMS",
    "className": "BMS Infrastructure (Controllers / Field Panels)",
    "manufacturers": "Siemens (Desigo), Schneider Electric (EcoStruxure BMS), Honeywell, Trend Controls"
  },
  {
    "classId": "SUP-PMS",
    "className": "Power Monitoring System (EPMS)",
    "manufacturers": "Schneider Electric (Power Monitoring Expert), Eaton (Power Xpert), ETAP"
  },
  {
    "classId": "SUP-BAT",
    "className": "Battery Monitoring System",
    "manufacturers": "Vertiv (Alber / BM3000), EnerSys, Eagle Eye Power Solutions"
  },
  {
    "classId": "SUP-OT",
    "className": "Network-Enabled Operational Technology Asset",
    "manufacturers": "Moxa, Sensaphone, Panduit (SmartZone)"
  }
]

export const FAILURE_CODES = [
  {
    "code": "V01",
    "technology": "Vibration",
    "mode": "Bearing Wear",
    "sowRef": "4.2"
  },
  {
    "code": "V02",
    "technology": "Vibration",
    "mode": "Misalignment",
    "sowRef": "4.2"
  },
  {
    "code": "V03",
    "technology": "Vibration",
    "mode": "Imbalance",
    "sowRef": "4.2"
  },
  {
    "code": "V04",
    "technology": "Vibration",
    "mode": "Looseness",
    "sowRef": "4.2"
  },
  {
    "code": "V05",
    "technology": "Vibration",
    "mode": "Cavitation",
    "sowRef": "4.2"
  },
  {
    "code": "V06",
    "technology": "Vibration",
    "mode": "Resonance",
    "sowRef": "4.2"
  },
  {
    "code": "T01",
    "technology": "Thermal",
    "mode": "Loose Electrical Connection",
    "sowRef": "4.3"
  },
  {
    "code": "T02",
    "technology": "Thermal",
    "mode": "Overloaded Circuitry",
    "sowRef": "4.3"
  },
  {
    "code": "T03",
    "technology": "Thermal",
    "mode": "Cooling Failure",
    "sowRef": "4.3"
  },
  {
    "code": "T04",
    "technology": "Thermal",
    "mode": "Insulation Degradation",
    "sowRef": "4.3"
  },
  {
    "code": "T05",
    "technology": "Thermal",
    "mode": "Motor Overheating",
    "sowRef": "4.3"
  },
  {
    "code": "U01",
    "technology": "Ultrasound",
    "mode": "Lubrication Breakdown",
    "sowRef": "4.4"
  },
  {
    "code": "U02",
    "technology": "Ultrasound",
    "mode": "Arcing",
    "sowRef": "4.4"
  },
  {
    "code": "U03",
    "technology": "Ultrasound",
    "mode": "Corona Discharge",
    "sowRef": "4.4"
  },
  {
    "code": "U04",
    "technology": "Ultrasound",
    "mode": "Tracking",
    "sowRef": "4.4"
  },
  {
    "code": "U05",
    "technology": "Ultrasound",
    "mode": "Compressed Air Leak",
    "sowRef": "4.4"
  },
  {
    "code": "U06",
    "technology": "Ultrasound",
    "mode": "Damper / Valve Degradation",
    "sowRef": "4.4"
  }
]

export const ASSETS = [
  {
    "assetId": "IAD35-CRAH-01",
    "assetName": "CRAH Unit (Computer Room Air Handler) 01 - IAD35",
    "assetClass": "CRAH Unit (Computer Room Air Handler)",
    "siteId": "IAD35",
    "region": "NAM",
    "locationId": "IAD35-DHPOC",
    "criticality": "High",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "BMS; DCIM; CMMS Maintenance History",
    "sensors": "Vibration Sensor, Thermal Sensor",
    "failureCodes": "V01, V02, V04, T03, T05",
    "manufacturer": "Vertiv (Liebert)",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "IAD35-CRAC-01",
    "assetName": "CRAC Unit (Computer Room Air Conditioner) 01 - IAD35",
    "assetClass": "CRAC Unit (Computer Room Air Conditioner)",
    "siteId": "IAD35",
    "region": "NAM",
    "locationId": "IAD35-DHPOC",
    "criticality": "High",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "BMS; DCIM; CMMS Maintenance History",
    "sensors": "Vibration Sensor, Thermal Sensor",
    "failureCodes": "V01, V02, V04, T03, T05",
    "manufacturer": "Vertiv (Liebert)",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "IAD35-CHIL-01",
    "assetName": "Chiller 01 - IAD35",
    "assetClass": "Chiller",
    "siteId": "IAD35",
    "region": "NAM",
    "locationId": "IAD35-MECH01",
    "criticality": "Critical",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "BMS; DCIM; OEM Monitoring Platform; CMMS Maintenance History",
    "sensors": "Vibration Sensor, Thermal Sensor, Ultrasound Sensor",
    "failureCodes": "V01, V02, V03, V05, U01, T03",
    "manufacturer": "Trane",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "IAD35-COND-01",
    "assetName": "Condenser 01 - IAD35",
    "assetClass": "Condenser",
    "siteId": "IAD35",
    "region": "NAM",
    "locationId": "IAD35-MECH01",
    "criticality": "High",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "BMS; DCIM; CMMS Maintenance History",
    "sensors": "Vibration Sensor, Thermal Sensor",
    "failureCodes": "V01, V04, T03",
    "manufacturer": "Baltimore Aircoil Company (BAC)",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "IAD35-CTWR-01",
    "assetName": "Cooling Tower 01 - IAD35",
    "assetClass": "Cooling Tower",
    "siteId": "IAD35",
    "region": "NAM",
    "locationId": "IAD35-MECH01",
    "criticality": "High",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "BMS; DCIM; CMMS Maintenance History",
    "sensors": "Vibration Sensor, Thermal Sensor",
    "failureCodes": "V01, V03, V06, T03",
    "manufacturer": "Baltimore Aircoil Company (BAC)",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "IAD35-PUMP-01",
    "assetName": "Pump (Chilled / Condenser Water) 01 - IAD35",
    "assetClass": "Pump (Chilled / Condenser Water)",
    "siteId": "IAD35",
    "region": "NAM",
    "locationId": "IAD35-MECH01",
    "criticality": "High",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "BMS; DCIM; CMMS Maintenance History",
    "sensors": "Vibration Sensor, Ultrasound Sensor",
    "failureCodes": "V01, V02, V03, V05, U01",
    "manufacturer": "Grundfos",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "IAD35-AHU-01",
    "assetName": "Air Handling Unit (AHU) 01 - IAD35",
    "assetClass": "Air Handling Unit (AHU)",
    "siteId": "IAD35",
    "region": "NAM",
    "locationId": "IAD35-DHPOC",
    "criticality": "Medium",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "BMS; DCIM; CMMS Maintenance History",
    "sensors": "Vibration Sensor, Thermal Sensor",
    "failureCodes": "V01, V04, T03, T05",
    "manufacturer": "Trane",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "IAD35-DRYC-01",
    "assetName": "Dry Cooler 01 - IAD35",
    "assetClass": "Dry Cooler",
    "siteId": "IAD35",
    "region": "NAM",
    "locationId": "IAD35-MECH01",
    "criticality": "Medium",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "BMS; DCIM; CMMS Maintenance History",
    "sensors": "Vibration Sensor, Thermal Sensor",
    "failureCodes": "V01, V04, T03",
    "manufacturer": "EVAPCO",
    "scopeStatus": "Excluded",
    "scopeRationale": "Outside approved PoC critical zone boundary - deferred to future phase"
  },
  {
    "assetId": "ORD12-COND-01",
    "assetName": "Condenser 01 - ORD12",
    "assetClass": "Condenser",
    "siteId": "ORD12",
    "region": "NAM",
    "locationId": "ORD12-MECH01",
    "criticality": "High",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "BMS; DCIM; CMMS Maintenance History",
    "sensors": "Vibration Sensor, Thermal Sensor",
    "failureCodes": "V01, V04, T03",
    "manufacturer": "EVAPCO",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "ORD12-CTWR-01",
    "assetName": "Cooling Tower 01 - ORD12",
    "assetClass": "Cooling Tower",
    "siteId": "ORD12",
    "region": "NAM",
    "locationId": "ORD12-MECH01",
    "criticality": "High",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "BMS; DCIM; CMMS Maintenance History",
    "sensors": "Vibration Sensor, Thermal Sensor",
    "failureCodes": "V01, V03, V06, T03",
    "manufacturer": "EVAPCO",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "ORD12-PUMP-01",
    "assetName": "Pump (Chilled / Condenser Water) 01 - ORD12",
    "assetClass": "Pump (Chilled / Condenser Water)",
    "siteId": "ORD12",
    "region": "NAM",
    "locationId": "ORD12-MECH01",
    "criticality": "High",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "BMS; DCIM; CMMS Maintenance History",
    "sensors": "Vibration Sensor, Ultrasound Sensor",
    "failureCodes": "V01, V02, V03, V05, U01",
    "manufacturer": "Armstrong Fluid Technology",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "ORD12-AHU-01",
    "assetName": "Air Handling Unit (AHU) 01 - ORD12",
    "assetClass": "Air Handling Unit (AHU)",
    "siteId": "ORD12",
    "region": "NAM",
    "locationId": "ORD12-DHPOC",
    "criticality": "Medium",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "BMS; DCIM; CMMS Maintenance History",
    "sensors": "Vibration Sensor, Thermal Sensor",
    "failureCodes": "V01, V04, T03, T05",
    "manufacturer": "Munters",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "ORD12-DRYC-01",
    "assetName": "Dry Cooler 01 - ORD12",
    "assetClass": "Dry Cooler",
    "siteId": "ORD12",
    "region": "NAM",
    "locationId": "ORD12-MECH01",
    "criticality": "Medium",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "BMS; DCIM; CMMS Maintenance History",
    "sensors": "Vibration Sensor, Thermal Sensor",
    "failureCodes": "V01, V04, T03",
    "manufacturer": "Guentner",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "ORD12-UPS-01",
    "assetName": "UPS System 01 - ORD12",
    "assetClass": "UPS System",
    "siteId": "ORD12",
    "region": "NAM",
    "locationId": "ORD12-ELEC01",
    "criticality": "Critical",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "EPMS; DCIM; OEM Monitoring Platform; Battery Monitoring System; CMMS Maintenance History",
    "sensors": "Thermal Sensor, Ultrasound Sensor",
    "failureCodes": "T01, T02, T04, U02, U03",
    "manufacturer": "Schneider Electric (Galaxy)",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "ORD12-STS-01",
    "assetName": "Static Transfer Switch 01 - ORD12",
    "assetClass": "Static Transfer Switch",
    "siteId": "ORD12",
    "region": "NAM",
    "locationId": "ORD12-ELEC01",
    "criticality": "Critical",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "EPMS; DCIM; CMMS Maintenance History",
    "sensors": "Thermal Sensor, Ultrasound Sensor",
    "failureCodes": "T01, U02, U03, U04",
    "manufacturer": "ABB",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "ORD12-PDU-01",
    "assetName": "PDU System (Power Distribution Unit) 01 - ORD12",
    "assetClass": "PDU System (Power Distribution Unit)",
    "siteId": "ORD12",
    "region": "NAM",
    "locationId": "ORD12-ELEC01",
    "criticality": "Critical",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "EPMS; DCIM; CMMS Maintenance History",
    "sensors": "Thermal Sensor, Ultrasound Sensor",
    "failureCodes": "T01, T02, U02",
    "manufacturer": "Schneider Electric",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "LHR10-AHU-01",
    "assetName": "Air Handling Unit (AHU) 01 - LHR10",
    "assetClass": "Air Handling Unit (AHU)",
    "siteId": "LHR10",
    "region": "EMEA",
    "locationId": "LHR10-DHPOC",
    "criticality": "Medium",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "BMS; DCIM; CMMS Maintenance History",
    "sensors": "Vibration Sensor, Thermal Sensor",
    "failureCodes": "V01, V04, T03, T05",
    "manufacturer": "York (Johnson Controls)",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "LHR10-DRYC-01",
    "assetName": "Dry Cooler 01 - LHR10",
    "assetClass": "Dry Cooler",
    "siteId": "LHR10",
    "region": "EMEA",
    "locationId": "LHR10-MECH01",
    "criticality": "Medium",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "BMS; DCIM; CMMS Maintenance History",
    "sensors": "Vibration Sensor, Thermal Sensor",
    "failureCodes": "V01, V04, T03",
    "manufacturer": "Baltimore Aircoil Company (BAC)",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "LHR10-UPS-01",
    "assetName": "UPS System 01 - LHR10",
    "assetClass": "UPS System",
    "siteId": "LHR10",
    "region": "EMEA",
    "locationId": "LHR10-ELEC01",
    "criticality": "Critical",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "EPMS; DCIM; OEM Monitoring Platform; Battery Monitoring System; CMMS Maintenance History",
    "sensors": "Thermal Sensor, Ultrasound Sensor",
    "failureCodes": "T01, T02, T04, U02, U03",
    "manufacturer": "Eaton",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "LHR10-STS-01",
    "assetName": "Static Transfer Switch 01 - LHR10",
    "assetClass": "Static Transfer Switch",
    "siteId": "LHR10",
    "region": "EMEA",
    "locationId": "LHR10-ELEC01",
    "criticality": "Critical",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "EPMS; DCIM; CMMS Maintenance History",
    "sensors": "Thermal Sensor, Ultrasound Sensor",
    "failureCodes": "T01, U02, U03, U04",
    "manufacturer": "Piller",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "LHR10-PDU-01",
    "assetName": "PDU System (Power Distribution Unit) 01 - LHR10",
    "assetClass": "PDU System (Power Distribution Unit)",
    "siteId": "LHR10",
    "region": "EMEA",
    "locationId": "LHR10-ELEC01",
    "criticality": "Critical",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "EPMS; DCIM; CMMS Maintenance History",
    "sensors": "Thermal Sensor, Ultrasound Sensor",
    "failureCodes": "T01, T02, U02",
    "manufacturer": "Eaton",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "LHR10-LVSG-01",
    "assetName": "LV Switchgear 01 - LHR10",
    "assetClass": "LV Switchgear",
    "siteId": "LHR10",
    "region": "EMEA",
    "locationId": "LHR10-ELEC01",
    "criticality": "Critical",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "EPMS; DCIM; CMMS Maintenance History; Incident History",
    "sensors": "Thermal Sensor, Ultrasound Sensor",
    "failureCodes": "T01, T02, U02, U03, U04",
    "manufacturer": "Eaton",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "LHR10-HVSG-01",
    "assetName": "HV Switchgear 01 - LHR10",
    "assetClass": "HV Switchgear",
    "siteId": "LHR10",
    "region": "EMEA",
    "locationId": "LHR10-ELEC01",
    "criticality": "Critical",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "EPMS; DCIM; CMMS Maintenance History; Incident History",
    "sensors": "Thermal Sensor, Ultrasound Sensor",
    "failureCodes": "T01, U02, U03, U04",
    "manufacturer": "Schneider Electric",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "LHR10-XFMR-01",
    "assetName": "Transformer 01 - LHR10",
    "assetClass": "Transformer",
    "siteId": "LHR10",
    "region": "EMEA",
    "locationId": "LHR10-ELEC01",
    "criticality": "Critical",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "EPMS; DCIM; CMMS Maintenance History; Incident History",
    "sensors": "Thermal Sensor, Ultrasound Sensor",
    "failureCodes": "T01, T02, T04, U02, U03",
    "manufacturer": "Schneider Electric",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "FRA15-STS-01",
    "assetName": "Static Transfer Switch 01 - FRA15",
    "assetClass": "Static Transfer Switch",
    "siteId": "FRA15",
    "region": "EMEA",
    "locationId": "FRA15-ELEC01",
    "criticality": "Critical",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "EPMS; DCIM; CMMS Maintenance History",
    "sensors": "Thermal Sensor, Ultrasound Sensor",
    "failureCodes": "T01, U02, U03, U04",
    "manufacturer": "Vertiv",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "FRA15-PDU-01",
    "assetName": "PDU System (Power Distribution Unit) 01 - FRA15",
    "assetClass": "PDU System (Power Distribution Unit)",
    "siteId": "FRA15",
    "region": "EMEA",
    "locationId": "FRA15-ELEC01",
    "criticality": "Critical",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "EPMS; DCIM; CMMS Maintenance History",
    "sensors": "Thermal Sensor, Ultrasound Sensor",
    "failureCodes": "T01, T02, U02",
    "manufacturer": "Vertiv",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "FRA15-LVSG-01",
    "assetName": "LV Switchgear 01 - FRA15",
    "assetClass": "LV Switchgear",
    "siteId": "FRA15",
    "region": "EMEA",
    "locationId": "FRA15-ELEC01",
    "criticality": "Critical",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "EPMS; DCIM; CMMS Maintenance History; Incident History",
    "sensors": "Thermal Sensor, Ultrasound Sensor",
    "failureCodes": "T01, T02, U02, U03, U04",
    "manufacturer": "Schneider Electric",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "FRA15-HVSG-01",
    "assetName": "HV Switchgear 01 - FRA15",
    "assetClass": "HV Switchgear",
    "siteId": "FRA15",
    "region": "EMEA",
    "locationId": "FRA15-ELEC01",
    "criticality": "Critical",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "EPMS; DCIM; CMMS Maintenance History; Incident History",
    "sensors": "Thermal Sensor, Ultrasound Sensor",
    "failureCodes": "T01, U02, U03, U04",
    "manufacturer": "Siemens",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "FRA15-XFMR-01",
    "assetName": "Transformer 01 - FRA15",
    "assetClass": "Transformer",
    "siteId": "FRA15",
    "region": "EMEA",
    "locationId": "FRA15-ELEC01",
    "criticality": "Critical",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "EPMS; DCIM; CMMS Maintenance History; Incident History",
    "sensors": "Thermal Sensor, Ultrasound Sensor",
    "failureCodes": "T01, T02, T04, U02, U03",
    "manufacturer": "Siemens",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "FRA15-GENA-01",
    "assetName": "Generator Auxiliary Systems (fuel, starting, control) 01 - FRA15",
    "assetClass": "Generator Auxiliary Systems (fuel, starting, control)",
    "siteId": "FRA15",
    "region": "EMEA",
    "locationId": "FRA15-GENYD01",
    "criticality": "High",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "BMS; EPMS; OEM Monitoring Platform; CMMS Maintenance History",
    "sensors": "Thermal Sensor, Ultrasound Sensor",
    "failureCodes": "T05, U01, U05",
    "manufacturer": "Kohler",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "FRA15-GENS-01",
    "assetName": "Standby Generator Set (parent asset) 01 - FRA15",
    "assetClass": "Standby Generator Set (parent asset)",
    "siteId": "FRA15",
    "region": "EMEA",
    "locationId": "FRA15-GENYD01",
    "criticality": "Critical",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "BMS; EPMS; OEM Monitoring Platform; CMMS Maintenance History",
    "sensors": "Vibration Sensor, Thermal Sensor, Ultrasound Sensor",
    "failureCodes": "V01, V02, V04, T05, U01",
    "manufacturer": "Kohler",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "FRA15-BMS-01",
    "assetName": "BMS Infrastructure (Controllers / Field Panels) 01 - FRA15",
    "assetClass": "BMS Infrastructure (Controllers / Field Panels)",
    "siteId": "FRA15",
    "region": "EMEA",
    "locationId": "FRA15-ELEC01",
    "criticality": "High",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM)",
    "dataSources": "BMS; Asset Registry Information",
    "sensors": "None (existing telemetry only)",
    "failureCodes": "N/A (telemetry-only asset)",
    "manufacturer": "Trend Controls",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "SIN11-HVSG-01",
    "assetName": "HV Switchgear 01 - SIN11",
    "assetClass": "HV Switchgear",
    "siteId": "SIN11",
    "region": "APAC",
    "locationId": "SIN11-ELEC01",
    "criticality": "Critical",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "EPMS; DCIM; CMMS Maintenance History; Incident History",
    "sensors": "Thermal Sensor, Ultrasound Sensor",
    "failureCodes": "T01, U02, U03, U04",
    "manufacturer": "ABB",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "SIN11-XFMR-01",
    "assetName": "Transformer 01 - SIN11",
    "assetClass": "Transformer",
    "siteId": "SIN11",
    "region": "APAC",
    "locationId": "SIN11-ELEC01",
    "criticality": "Critical",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "EPMS; DCIM; CMMS Maintenance History; Incident History",
    "sensors": "Thermal Sensor, Ultrasound Sensor",
    "failureCodes": "T01, T02, T04, U02, U03",
    "manufacturer": "ABB",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "SIN11-GENA-01",
    "assetName": "Generator Auxiliary Systems (fuel, starting, control) 01 - SIN11",
    "assetClass": "Generator Auxiliary Systems (fuel, starting, control)",
    "siteId": "SIN11",
    "region": "APAC",
    "locationId": "SIN11-GENYD01",
    "criticality": "High",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "BMS; EPMS; OEM Monitoring Platform; CMMS Maintenance History",
    "sensors": "Thermal Sensor, Ultrasound Sensor",
    "failureCodes": "T05, U01, U05",
    "manufacturer": "Caterpillar",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "SIN11-GENS-01",
    "assetName": "Standby Generator Set (parent asset) 01 - SIN11",
    "assetClass": "Standby Generator Set (parent asset)",
    "siteId": "SIN11",
    "region": "APAC",
    "locationId": "SIN11-GENYD01",
    "criticality": "Critical",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "BMS; EPMS; OEM Monitoring Platform; CMMS Maintenance History",
    "sensors": "Vibration Sensor, Thermal Sensor, Ultrasound Sensor",
    "failureCodes": "V01, V02, V04, T05, U01",
    "manufacturer": "Caterpillar",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "SIN11-BMS-01",
    "assetName": "BMS Infrastructure (Controllers / Field Panels) 01 - SIN11",
    "assetClass": "BMS Infrastructure (Controllers / Field Panels)",
    "siteId": "SIN11",
    "region": "APAC",
    "locationId": "SIN11-ELEC01",
    "criticality": "High",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM)",
    "dataSources": "BMS; Asset Registry Information",
    "sensors": "None (existing telemetry only)",
    "failureCodes": "N/A (telemetry-only asset)",
    "manufacturer": "Siemens (Desigo)",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "SIN11-PMS-01",
    "assetName": "Power Monitoring System (EPMS) 01 - SIN11",
    "assetClass": "Power Monitoring System (EPMS)",
    "siteId": "SIN11",
    "region": "APAC",
    "locationId": "SIN11-ELEC01",
    "criticality": "High",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM)",
    "dataSources": "EPMS; Asset Registry Information",
    "sensors": "None (existing telemetry only)",
    "failureCodes": "N/A (telemetry-only asset)",
    "manufacturer": "Eaton (Power Xpert)",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "SIN11-BAT-01",
    "assetName": "Battery Monitoring System 01 - SIN11",
    "assetClass": "Battery Monitoring System",
    "siteId": "SIN11",
    "region": "APAC",
    "locationId": "SIN11-ELEC01",
    "criticality": "High",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM)",
    "dataSources": "Battery Monitoring System; EPMS; Asset Registry Information",
    "sensors": "None (existing telemetry only)",
    "failureCodes": "N/A (telemetry-only asset)",
    "manufacturer": "EnerSys",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "SIN11-OT-01",
    "assetName": "Network-Enabled Operational Technology Asset 01 - SIN11",
    "assetClass": "Network-Enabled Operational Technology Asset",
    "siteId": "SIN11",
    "region": "APAC",
    "locationId": "SIN11-DHPOC",
    "criticality": "Medium",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM)",
    "dataSources": "DCIM; Asset Registry Information",
    "sensors": "None (existing telemetry only)",
    "failureCodes": "N/A (telemetry-only asset)",
    "manufacturer": "Sensaphone",
    "scopeStatus": "Excluded",
    "scopeRationale": "Outside approved PoC critical zone boundary - deferred to future phase"
  },
  {
    "assetId": "SYD12-GENS-01",
    "assetName": "Standby Generator Set (parent asset) 01 - SYD12",
    "assetClass": "Standby Generator Set (parent asset)",
    "siteId": "SYD12",
    "region": "APAC",
    "locationId": "SYD12-GENYD01",
    "criticality": "Critical",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "BMS; EPMS; OEM Monitoring Platform; CMMS Maintenance History",
    "sensors": "Vibration Sensor, Thermal Sensor, Ultrasound Sensor",
    "failureCodes": "V01, V02, V04, T05, U01",
    "manufacturer": "Cummins",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "SYD12-BMS-01",
    "assetName": "BMS Infrastructure (Controllers / Field Panels) 01 - SYD12",
    "assetClass": "BMS Infrastructure (Controllers / Field Panels)",
    "siteId": "SYD12",
    "region": "APAC",
    "locationId": "SYD12-ELEC01",
    "criticality": "High",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM)",
    "dataSources": "BMS; Asset Registry Information",
    "sensors": "None (existing telemetry only)",
    "failureCodes": "N/A (telemetry-only asset)",
    "manufacturer": "Schneider Electric (EcoStruxure BMS)",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "SYD12-PMS-01",
    "assetName": "Power Monitoring System (EPMS) 01 - SYD12",
    "assetClass": "Power Monitoring System (EPMS)",
    "siteId": "SYD12",
    "region": "APAC",
    "locationId": "SYD12-ELEC01",
    "criticality": "High",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM)",
    "dataSources": "EPMS; Asset Registry Information",
    "sensors": "None (existing telemetry only)",
    "failureCodes": "N/A (telemetry-only asset)",
    "manufacturer": "ETAP",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "SYD12-BAT-01",
    "assetName": "Battery Monitoring System 01 - SYD12",
    "assetClass": "Battery Monitoring System",
    "siteId": "SYD12",
    "region": "APAC",
    "locationId": "SYD12-ELEC01",
    "criticality": "High",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM)",
    "dataSources": "Battery Monitoring System; EPMS; Asset Registry Information",
    "sensors": "None (existing telemetry only)",
    "failureCodes": "N/A (telemetry-only asset)",
    "manufacturer": "Eagle Eye Power Solutions",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "SYD12-OT-01",
    "assetName": "Network-Enabled Operational Technology Asset 01 - SYD12",
    "assetClass": "Network-Enabled Operational Technology Asset",
    "siteId": "SYD12",
    "region": "APAC",
    "locationId": "SYD12-DHPOC",
    "criticality": "Medium",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM)",
    "dataSources": "DCIM; Asset Registry Information",
    "sensors": "None (existing telemetry only)",
    "failureCodes": "N/A (telemetry-only asset)",
    "manufacturer": "Panduit (SmartZone)",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "SYD12-CRAH-01",
    "assetName": "CRAH Unit (Computer Room Air Handler) 01 - SYD12",
    "assetClass": "CRAH Unit (Computer Room Air Handler)",
    "siteId": "SYD12",
    "region": "APAC",
    "locationId": "SYD12-DHPOC",
    "criticality": "High",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "BMS; DCIM; CMMS Maintenance History",
    "sensors": "Vibration Sensor, Thermal Sensor",
    "failureCodes": "V01, V02, V04, T03, T05",
    "manufacturer": "Airedale",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "SYD12-CRAC-01",
    "assetName": "CRAC Unit (Computer Room Air Conditioner) 01 - SYD12",
    "assetClass": "CRAC Unit (Computer Room Air Conditioner)",
    "siteId": "SYD12",
    "region": "APAC",
    "locationId": "SYD12-DHPOC",
    "criticality": "High",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "BMS; DCIM; CMMS Maintenance History",
    "sensors": "Vibration Sensor, Thermal Sensor",
    "failureCodes": "V01, V02, V04, T03, T05",
    "manufacturer": "Airedale",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  },
  {
    "assetId": "SYD12-CHIL-01",
    "assetName": "Chiller 01 - SYD12",
    "assetClass": "Chiller",
    "siteId": "SYD12",
    "region": "APAC",
    "locationId": "SYD12-MECH01",
    "criticality": "Critical",
    "monitoringMethod": "Existing Telemetry (BMS/EPMS/DCIM) + New Condition Monitoring Sensors",
    "dataSources": "BMS; DCIM; OEM Monitoring Platform; CMMS Maintenance History",
    "sensors": "Vibration Sensor, Thermal Sensor, Ultrasound Sensor",
    "failureCodes": "V01, V02, V03, V05, U01, T03",
    "manufacturer": "Carrier",
    "scopeStatus": "Included",
    "scopeRationale": "Within approved PoC critical zone / redundancy path"
  }
]

export const CRITICALITY = [
  {
    "rating": "Critical",
    "tier": "Tier 1",
    "redundancyImpact": "Loss reduces a live path to N or creates a single point of failure (SPOF) on the critical power/cooling chain.",
    "businessImpact": "Direct risk to customer-facing IT load; potential SLA breach / outage.",
    "responseSla": "Immediate (<15 min) engineering response"
  },
  {
    "rating": "High",
    "tier": "Tier 2",
    "redundancyImpact": "Asset is an N+1 or redundant leg; loss reduces redundancy margin but does not immediately drop a live path.",
    "businessImpact": "Elevated risk if a second, unrelated failure occurs before repair.",
    "responseSla": "<1 hour engineering response"
  },
  {
    "rating": "Medium",
    "tier": "Tier 3",
    "redundancyImpact": "Supporting or monitoring asset; typically redundant and off the direct critical path.",
    "businessImpact": "Localized or comfort-cooling impact; no immediate customer-facing risk.",
    "responseSla": "<4 hours / next business day"
  },
  {
    "rating": "Low",
    "tier": "Tier 4",
    "redundancyImpact": "Non-critical or informational asset.",
    "businessImpact": "No material operational impact.",
    "responseSla": "Standard SLA / scheduled"
  }
]

export const SYSTEMS = [
  {
    "systemId": "SYS-BMS",
    "systemName": "Building Management System (BMS)",
    "systemType": "Existing OT Platform",
    "vendor": "Siemens Desigo / Schneider EcoStruxure BMS (site-dependent)",
    "protocol": "BACnet / Modbus",
    "dataPoints": "Temperature, humidity, airflow, valve/damper position, alarms",
    "scope": "All 6 PoC sites",
    "sampleLocation": "BMS Data Sample (Transactional workbook)"
  },
  {
    "systemId": "SYS-EPMS",
    "systemName": "Electrical Power Monitoring System (EPMS)",
    "systemType": "Existing OT Platform",
    "vendor": "Schneider Power Monitoring Expert / Eaton Power Xpert (site-dependent)",
    "protocol": "Modbus TCP / IEC 61850",
    "dataPoints": "Voltage, current, power factor, breaker status, protective relay events",
    "scope": "All 6 PoC sites",
    "sampleLocation": "EPMS Data Sample (Transactional workbook)"
  },
  {
    "systemId": "SYS-DCIM",
    "systemName": "Data Center Infrastructure Management (DCIM)",
    "systemType": "Existing OT Platform",
    "vendor": "Site DCIM platform (vendor confirmed during Section 5.1 Solution Design)",
    "protocol": "API / SNMP / BACnet",
    "dataPoints": "Capacity, PUE, asset inventory, environmental trend history",
    "scope": "All 6 PoC sites",
    "sampleLocation": "DCIM Data Sample (Transactional workbook)"
  },
  {
    "systemId": "SYS-OEM",
    "systemName": "OEM Monitoring Platform(s)",
    "systemType": "Existing Vendor Platform",
    "vendor": "e.g., Vertiv LIFE Services, Caterpillar VisionLink (asset-dependent)",
    "protocol": "Cloud API",
    "dataPoints": "OEM-specific health/alarm data for UPS, generator, chiller fleets",
    "scope": "Site- and OEM-dependent",
    "sampleLocation": "OEM Monitoring Sample (Transactional workbook)"
  },
  {
    "systemId": "SYS-BAT",
    "systemName": "Battery Monitoring System",
    "systemType": "Existing OT Platform",
    "vendor": "Vertiv Alber / EnerSys (site-dependent)",
    "protocol": "Modbus / Vendor API",
    "dataPoints": "Cell voltage, internal resistance, temperature, state of health",
    "scope": "Sites with monitored VRLA/Li-ion strings",
    "sampleLocation": "Battery Monitoring Sample (Transactional workbook)"
  },
  {
    "systemId": "SYS-CMMS",
    "systemName": "CMMS Maintenance History",
    "systemType": "Existing Enterprise System",
    "vendor": "Digital Realty enterprise CMMS",
    "protocol": "Flat file / API export",
    "dataPoints": "Work order history, PM compliance, failure/incident records",
    "scope": "All 6 PoC sites",
    "sampleLocation": "Work Orders + PM Compliance Log (Transactional workbook)"
  },
  {
    "systemId": "SYS-AST",
    "systemName": "Asset Registry Information",
    "systemType": "Existing Enterprise System",
    "vendor": "Digital Realty enterprise asset register / CMMS asset module",
    "protocol": "Flat file / API export",
    "dataPoints": "Asset ID, class, manufacturer, location, criticality, install data",
    "scope": "All 6 PoC sites",
    "sampleLocation": "Asset Register - FASM (Master Data workbook)"
  },
  {
    "systemId": "SYS-INC",
    "systemName": "Incident History",
    "systemType": "Existing Enterprise System",
    "vendor": "Digital Realty incident/event management system",
    "protocol": "Flat file / API export",
    "dataPoints": "Incident date, asset, root cause, downtime, customer impact",
    "scope": "All 6 PoC sites",
    "sampleLocation": "Incident History - Baseline (Transactional workbook)"
  },
  {
    "systemId": "SYS-VIB",
    "systemName": "Vibration Sensor Platform (New - PoC)",
    "systemType": "New Condition Monitoring Technology",
    "vendor": "Technology partner selected under Section 5.1 Solution Design",
    "protocol": "Wireless (LoRaWAN/BLE) to Gateway",
    "dataPoints": "Vibration velocity/acceleration spectra, bearing condition indicators",
    "scope": "PoC critical zone only, per site",
    "sampleLocation": "Condition Monitoring Readings (Transactional workbook)"
  },
  {
    "systemId": "SYS-THM",
    "systemName": "Thermal Sensor Platform (New - PoC)",
    "systemType": "New Condition Monitoring Technology",
    "vendor": "Technology partner selected under Section 5.1 Solution Design",
    "protocol": "Fixed IR camera / spot sensor, IP network",
    "dataPoints": "Surface/connection temperature, thermal trend and delta-T alarms",
    "scope": "PoC critical zone only, per site",
    "sampleLocation": "Condition Monitoring Readings (Transactional workbook)"
  },
  {
    "systemId": "SYS-USN",
    "systemName": "Ultrasound Sensor Platform (New - PoC)",
    "systemType": "New Condition Monitoring Technology",
    "vendor": "Technology partner selected under Section 5.1 Solution Design",
    "protocol": "Airborne/contact ultrasound, wireless to Gateway",
    "dataPoints": "Arcing/corona/tracking acoustic signatures, air/gas leak indicators",
    "scope": "PoC critical zone only, per site",
    "sampleLocation": "Condition Monitoring Readings (Transactional workbook)"
  }
]

export const STAKEHOLDERS = [
  {
    "role": "Global Technical Operations",
    "raci": "Accountable",
    "cadence": "Monthly Executive Update",
    "responsibility": "Owns global FSM strategy, scale-up decision, and cross-region standardization."
  },
  {
    "role": "Regional Operations",
    "raci": "Responsible",
    "cadence": "Weekly / Biweekly Review",
    "responsibility": "Coordinates PoC execution and resourcing across EMEA / NAM / APAC sites."
  },
  {
    "role": "Site Leadership",
    "raci": "Accountable (Site)",
    "cadence": "Weekly / Biweekly Review",
    "responsibility": "Approves site access, change windows, and site-level risk acceptance."
  },
  {
    "role": "Site Engineering",
    "raci": "Responsible",
    "cadence": "Weekly / Biweekly Review",
    "responsibility": "Executes physical inspections, validates alerts, and performs maintenance actions."
  },
  {
    "role": "Reliability Engineering",
    "raci": "Consulted",
    "cadence": "Weekly / Biweekly Review",
    "responsibility": "Defines asset criticality, RCM failure modes, and correlates findings to reliability KPIs."
  },
  {
    "role": "Asset Management",
    "raci": "Consulted",
    "cadence": "Monthly Executive Update",
    "responsibility": "Maintains asset registry, manufacturer/model data, and lifecycle records."
  },
  {
    "role": "IT / OT Teams",
    "raci": "Responsible",
    "cadence": "Ad hoc / Change Windows",
    "responsibility": "Provides network, cybersecurity review, and integration support for sensor/gateway deployment."
  },
  {
    "role": "Vendor Partners",
    "raci": "Responsible (Delivery)",
    "cadence": "Weekly / Biweekly Review",
    "responsibility": "Installs and commissions sensors, operates analytics platform, and reports findings."
  }
]

export const PM_TASKS = [
  {
    "taskId": "PM-CRAH-01",
    "classId": "MEC-CRAH",
    "assetClass": "CRAH Unit (Computer Room Air Handler)",
    "task": "Filter inspection/replacement",
    "frequency": "Monthly",
    "standard": "ASHRAE TC 9.9",
    "affectedByPoc": "No - preserved per SOW 2.2"
  },
  {
    "taskId": "PM-CRAH-02",
    "classId": "MEC-CRAH",
    "assetClass": "CRAH Unit (Computer Room Air Handler)",
    "task": "Belt, bearing & coil inspection",
    "frequency": "Quarterly",
    "standard": "OEM / ASHRAE TC 9.9",
    "affectedByPoc": "No - preserved per SOW 2.2"
  },
  {
    "taskId": "PM-CRAC-01",
    "classId": "MEC-CRAC",
    "assetClass": "CRAC Unit (Computer Room Air Conditioner)",
    "task": "Filter inspection/replacement",
    "frequency": "Monthly",
    "standard": "ASHRAE TC 9.9",
    "affectedByPoc": "No - preserved per SOW 2.2"
  },
  {
    "taskId": "PM-CHIL-01",
    "classId": "MEC-CHIL",
    "assetClass": "Chiller",
    "task": "Full mechanical/refrigeration PM & oil analysis",
    "frequency": "Quarterly",
    "standard": "OEM / ASHRAE",
    "affectedByPoc": "No - preserved per SOW 2.2"
  },
  {
    "taskId": "PM-CHIL-02",
    "classId": "MEC-CHIL",
    "assetClass": "Chiller",
    "task": "Annual eddy-current tube inspection",
    "frequency": "Annual",
    "standard": "OEM / ASHRAE",
    "affectedByPoc": "No - preserved per SOW 2.2"
  },
  {
    "taskId": "PM-COND-01",
    "classId": "MEC-COND",
    "assetClass": "Condenser",
    "task": "Coil cleaning & fan inspection",
    "frequency": "Quarterly",
    "standard": "OEM",
    "affectedByPoc": "No - preserved per SOW 2.2"
  },
  {
    "taskId": "PM-CTWR-01",
    "classId": "MEC-CTWR",
    "assetClass": "Cooling Tower",
    "task": "Basin cleaning & water treatment check",
    "frequency": "Monthly",
    "standard": "ASHRAE Legionella Std 188",
    "affectedByPoc": "No - preserved per SOW 2.2"
  },
  {
    "taskId": "PM-PUMP-01",
    "classId": "MEC-PUMP",
    "assetClass": "Pump (Chilled / Condenser Water)",
    "task": "Seal/bearing inspection & alignment check",
    "frequency": "Quarterly",
    "standard": "OEM",
    "affectedByPoc": "No - preserved per SOW 2.2"
  },
  {
    "taskId": "PM-AHU-01",
    "classId": "MEC-AHU",
    "assetClass": "Air Handling Unit (AHU)",
    "task": "Filter & belt inspection",
    "frequency": "Monthly",
    "standard": "ASHRAE TC 9.9",
    "affectedByPoc": "No - preserved per SOW 2.2"
  },
  {
    "taskId": "PM-DRYC-01",
    "classId": "MEC-DRYC",
    "assetClass": "Dry Cooler",
    "task": "Coil cleaning & fan inspection",
    "frequency": "Quarterly",
    "standard": "OEM",
    "affectedByPoc": "No - preserved per SOW 2.2"
  },
  {
    "taskId": "PM-UPS-01",
    "classId": "ELE-UPS",
    "assetClass": "UPS System",
    "task": "UPS module PM inspection",
    "frequency": "Quarterly",
    "standard": "NFPA 70B / OEM",
    "affectedByPoc": "No - preserved per SOW 2.2"
  },
  {
    "taskId": "PM-UPS-02",
    "classId": "ELE-UPS",
    "assetClass": "UPS System",
    "task": "Battery string load/impedance test",
    "frequency": "Annual",
    "standard": "NFPA 111 / IEEE 450",
    "affectedByPoc": "No - preserved per SOW 2.2"
  },
  {
    "taskId": "PM-STS-01",
    "classId": "ELE-STS",
    "assetClass": "Static Transfer Switch",
    "task": "Static switch functional transfer test",
    "frequency": "Annual",
    "standard": "OEM",
    "affectedByPoc": "No - preserved per SOW 2.2"
  },
  {
    "taskId": "PM-PDU-01",
    "classId": "ELE-PDU",
    "assetClass": "PDU System (Power Distribution Unit)",
    "task": "PDU thermographic scan & torque check",
    "frequency": "Annual",
    "standard": "NFPA 70B",
    "affectedByPoc": "No - preserved per SOW 2.2"
  },
  {
    "taskId": "PM-LVSG-01",
    "classId": "ELE-LVSG",
    "assetClass": "LV Switchgear",
    "task": "Switchgear IR thermography scan",
    "frequency": "Annual",
    "standard": "NFPA 70B",
    "affectedByPoc": "No - preserved per SOW 2.2"
  },
  {
    "taskId": "PM-LVSG-02",
    "classId": "ELE-LVSG",
    "assetClass": "LV Switchgear",
    "task": "Breaker maintenance & torque verification",
    "frequency": "Every 3 Years",
    "standard": "NFPA 70B / NETA",
    "affectedByPoc": "No - preserved per SOW 2.2"
  },
  {
    "taskId": "PM-HVSG-01",
    "classId": "ELE-HVSG",
    "assetClass": "HV Switchgear",
    "task": "HV switchgear inspection & IR scan",
    "frequency": "Annual",
    "standard": "NFPA 70E / NETA",
    "affectedByPoc": "No - preserved per SOW 2.2"
  },
  {
    "taskId": "PM-XFMR-01",
    "classId": "ELE-XFMR",
    "assetClass": "Transformer",
    "task": "Transformer oil sampling & IR scan",
    "frequency": "Annual",
    "standard": "IEEE C57.104 / NFPA 70B",
    "affectedByPoc": "No - preserved per SOW 2.2"
  },
  {
    "taskId": "PM-GENA-01",
    "classId": "ELE-GENA",
    "assetClass": "Generator Auxiliary Systems (fuel, starting, control)",
    "task": "Fuel system & starting battery inspection",
    "frequency": "Monthly",
    "standard": "NFPA 110",
    "affectedByPoc": "No - preserved per SOW 2.2"
  },
  {
    "taskId": "PM-GENS-01",
    "classId": "ELE-GENS",
    "assetClass": "Standby Generator Set (parent asset)",
    "task": "No-load exercise run",
    "frequency": "Weekly",
    "standard": "NFPA 110",
    "affectedByPoc": "No - preserved per SOW 2.2"
  },
  {
    "taskId": "PM-GENS-02",
    "classId": "ELE-GENS",
    "assetClass": "Standby Generator Set (parent asset)",
    "task": "Full load bank test",
    "frequency": "Annual",
    "standard": "NFPA 110",
    "affectedByPoc": "No - preserved per SOW 2.2"
  },
  {
    "taskId": "PM-BMS-01",
    "classId": "SUP-BMS",
    "assetClass": "BMS Infrastructure (Controllers / Field Panels)",
    "task": "Controller/sensor calibration check",
    "frequency": "Annual",
    "standard": "OEM",
    "affectedByPoc": "No - preserved per SOW 2.2"
  },
  {
    "taskId": "PM-PMS-01",
    "classId": "SUP-PMS",
    "assetClass": "Power Monitoring System (EPMS)",
    "task": "Meter/relay calibration verification",
    "frequency": "Annual",
    "standard": "OEM / NETA",
    "affectedByPoc": "No - preserved per SOW 2.2"
  },
  {
    "taskId": "PM-BAT-01",
    "classId": "SUP-BAT",
    "assetClass": "Battery Monitoring System",
    "task": "Monitoring system self-test & sensor check",
    "frequency": "Quarterly",
    "standard": "OEM",
    "affectedByPoc": "No - preserved per SOW 2.2"
  },
  {
    "taskId": "PM-OT-01",
    "classId": "SUP-OT",
    "assetClass": "Network-Enabled Operational Technology Asset",
    "task": "Firmware/patch and connectivity check",
    "frequency": "Quarterly",
    "standard": "Digital Realty IT/OT Policy",
    "affectedByPoc": "No - preserved per SOW 2.2"
  }
]

export const KPI_MASTER = [
  {
    "kpiId": "KPI-T01",
    "group": "Technical",
    "kpi": "Sensor Availability",
    "target": "~90-100%",
    "definition": "% of deployed sensors reporting data as expected over the measurement period.",
    "source": "Sensor Platform / Dashboard"
  },
  {
    "kpiId": "KPI-T02",
    "group": "Technical",
    "kpi": "Data Acquisition Reliability",
    "target": "~90-100%",
    "definition": "% of expected data points successfully collected from BMS/EPMS/DCIM/sensors without gaps.",
    "source": "Analytics Platform"
  },
  {
    "kpiId": "KPI-T03",
    "group": "Technical",
    "kpi": "Alert Accuracy",
    "target": "~70-80%",
    "definition": "% of generated alerts confirmed as valid by engineering review / physical inspection.",
    "source": "Alert & Anomaly Register"
  },
  {
    "kpiId": "KPI-T04",
    "group": "Technical",
    "kpi": "False Positive Rate",
    "target": "~10-20%",
    "definition": "% of generated alerts closed as not indicative of a real condition.",
    "source": "Alert & Anomaly Register"
  },
  {
    "kpiId": "KPI-T05",
    "group": "Technical",
    "kpi": "Dashboard Availability",
    "target": "~90-100%",
    "definition": "% uptime of the centralized monitoring dashboard during the PoC period.",
    "source": "Analytics Platform"
  },
  {
    "kpiId": "KPI-O01",
    "group": "Operational",
    "kpi": "Early Fault Detection",
    "target": "Demonstrated",
    "definition": "Evidence that condition monitoring detected degradation ahead of traditional PM/inspection.",
    "source": "Maintenance Correlation Log"
  },
  {
    "kpiId": "KPI-O02",
    "group": "Operational",
    "kpi": "Reduced Unplanned Maintenance Risk",
    "target": "Demonstrated",
    "definition": "Evidence of reduced unplanned-outage risk attributable to condition-based intervention.",
    "source": "Work Orders / Incident History"
  },
  {
    "kpiId": "KPI-O03",
    "group": "Operational",
    "kpi": "Maintenance Optimization Opportunities",
    "target": "Demonstrated",
    "definition": "Identified opportunities to adjust maintenance frequency/scope based on actual asset condition.",
    "source": "Maintenance Correlation Log"
  },
  {
    "kpiId": "KPI-O04",
    "group": "Operational",
    "kpi": "Condition-Based Interventions",
    "target": "Demonstrated",
    "definition": "Count and outcome of maintenance actions triggered by condition data rather than calendar.",
    "source": "Work Orders"
  },
  {
    "kpiId": "KPI-O05",
    "group": "Operational",
    "kpi": "Business Case for Scale",
    "target": "Developed",
    "definition": "Documented ROI / benefits-realization case supporting a global deployment decision.",
    "source": "Final PoC Report"
  }
]
