'use client'

// The Final Asset Scope Matrix — 92 assets across four sites.
//
// This is the SOW 3.3 deliverable, populated: the full register the programme
// agreed at initiation, taken from the client's Final Asset Scope Matrix sample
// data set. It is loaded as the Asset Register's scope matrix; the monitoring,
// recommendations and reports demo continues to run on its own working data, so
// this does not touch the closed loop. The document is explicit that Health
// Score, Manufacturer and Failure Codes are illustrative placeholders and that
// the set is replaced with real asset data at the 3.3 / 5.1 deliverable.

import { criticalityByRating, listOf } from './index'

export const FASM_SITES = [
  { siteId: 'FRA10', siteName: 'Frankfurt DC10', region: 'EMEA' },
  { siteId: 'IAD12', siteName: 'Ashburn DC12', region: 'NAM' },
  { siteId: 'SIN08', siteName: 'Singapore DC08', region: 'APAC' },
  { siteId: 'DXB-JFZ1', siteName: 'Jafza Freezone DC1', region: 'GCC' },
]
const siteNameOf = Object.fromEntries(FASM_SITES.map((s) => [s.siteId, s.siteName]))
const regionOf = Object.fromEntries(FASM_SITES.map((s) => [s.siteId, s.region]))
const siteIdOf = (id) => (id.startsWith('DXB-JFZ1') ? 'DXB-JFZ1' : id.slice(0, 5))

const categoryOf = (cls) => {
  if (/switchgear|ups|pdu|generator|transformer|vfd|static switch|power monitoring|battery/i.test(cls)) return 'Electrical'
  if (/crac|crah|chiller|cooling tower|condenser|pump|air handling|dry cooler/i.test(cls)) return 'Mechanical'
  return 'Supporting Systems'
}

// [ id, name, class, criticality, location, monitoringMethod, sensors, dataSources, failureCodes, manufacturer, health, status ]
const F = [
  // ── Frankfurt DC10 (EMEA) — 23 ──
  ['FRA10-CRAC-01', 'CRAC Unit 01', 'CRAC Unit', 'Medium', 'Hall C-4 / Rack Row 2', 'Vibration + Thermal', 'Vibration, Thermal', 'CMMS', 'RESONANCE', 'Vertiv (Liebert)', 63, 'Included'],
  ['FRA10-CRAH-01', 'CRAH Unit 01', 'CRAH Unit', 'Critical', 'Hall A-4 / Rack Row 19', 'Vibration + Thermal', 'Vibration, Thermal', 'CMMS', 'LOOSENESS', 'Vertiv', 84, 'Included'],
  ['FRA10-CTWR-01', 'Cooling Tower 01', 'Cooling Tower', 'Medium', 'Hall A-1 / Rack Row 13', 'Vibration', 'Vibration', 'EPMS', 'IMBALANCE, SCALING', 'BAC', 79, 'Included'],
  ['FRA10-CRAC-02', 'CRAC Unit 02', 'CRAC Unit', 'Medium', 'Hall A-5 / Rack Row 10', 'Vibration + Thermal', 'Vibration, Thermal', 'BMS, CMMS', 'RESONANCE', 'Stulz', 82, 'Included'],
  ['FRA10-PUMP-01', 'Pump 01', 'Pump', 'Medium', 'Hall B-3 / Rack Row 15', 'Vibration + Ultrasound', 'Vibration, Ultrasound', 'EPMS', 'MISALIGN', 'Grundfos', 64, 'Included'],
  ['FRA10-PUMP-02', 'Pump 02', 'Pump', 'High', 'Hall B-3 / Rack Row 18', 'Vibration + Ultrasound', 'Vibration, Ultrasound', 'BMS, CMMS, EPMS', 'SEAL-WEAR, CAVITATION', 'Grundfos', 87, 'Included'],
  ['FRA10-COND-01', 'Condenser 01', 'Condenser', 'Medium', 'Hall A-5 / Rack Row 11', 'Thermal', 'Thermal', 'DCIM, OEM Platform', 'FOULING', 'Baltimore Aircoil', 62, 'Included'],
  ['FRA10-COND-02', 'Condenser 02', 'Condenser', 'High', 'Hall C-5 / Rack Row 18', 'Thermal', 'Thermal', 'EPMS', 'FOULING, CORROSION', 'Baltimore Aircoil', null, 'Excluded'],
  ['FRA10-CTWR-02', 'Cooling Tower 02', 'Cooling Tower', 'Medium', 'Hall A-6 / Rack Row 6', 'Vibration', 'Vibration', 'BMS, CMMS, OEM Platform', 'BRG-WEAR', 'SPX Cooling', 65, 'Included'],
  ['FRA10-GENA-01', 'Generator Auxiliary 01', 'Generator Auxiliary', 'Critical', 'Hall A-3 / Rack Row 14', 'Vibration + Thermal', 'Vibration, Thermal', 'BMS, DCIM, OEM Platform', 'LOOSE-CONN, BRG-WEAR', 'MTU', 79, 'Included'],
  ['FRA10-PDU-01', 'PDU System 01', 'PDU System', 'Critical', 'Hall A-5 / Rack Row 17', 'Thermal + Telemetry', 'Thermal', 'BMS, DCIM, EPMS', 'LOOSE-CONN, OVERLOAD', 'Vertiv', 81, 'Included'],
  ['FRA10-UPS-01', 'UPS System 01', 'UPS System', 'High', 'Hall A-1 / Rack Row 16', 'Thermal + Telemetry', 'Thermal, Battery Telemetry', 'EPMS', 'LOOSE-CONN, BATT-DEGRADE', 'Schneider Electric', 94, 'Included'],
  ['FRA10-SSW-01', 'Static Switch 01', 'Static Switch', 'Critical', 'Hall C-6 / Rack Row 7', 'Thermal + Telemetry', 'Thermal', 'BMS, CMMS, OEM Platform', 'OVERLOAD', 'ABB', 92, 'Included'],
  ['FRA10-HVSG-01', 'HV Switchgear 01', 'HV Switchgear', 'Low', 'Hall A-3 / Rack Row 1', 'Thermal + Ultrasound', 'Thermal, Ultrasound', 'EPMS', 'TRACKING, CORONA', 'ABB', 72, 'Included'],
  ['FRA10-LVSG-01', 'LV Switchgear 01', 'LV Switchgear', 'Critical', 'Hall C-2 / Rack Row 9', 'Thermal + Ultrasound', 'Thermal, Ultrasound', 'DCIM', 'ARCING, TRACKING, LOOSE-CONN', 'Siemens', 62, 'Included'],
  ['FRA10-VFD-01', 'VFD / Drive 01', 'VFD / Drive', 'High', 'Hall C-4 / Rack Row 12', 'Thermal + Telemetry', 'Thermal', 'BMS, EPMS', 'OVERLOAD, LOOSE-CONN', 'ABB', 64, 'Included'],
  ['FRA10-GENA-02', 'Generator Auxiliary 02', 'Generator Auxiliary', 'High', 'Hall A-2 / Rack Row 18', 'Vibration + Thermal', 'Vibration, Thermal', 'BMS, DCIM', 'BRG-WEAR', 'Cummins', 73, 'Included'],
  ['FRA10-VFD-02', 'VFD / Drive 02', 'VFD / Drive', 'High', 'Hall C-5 / Rack Row 1', 'Thermal + Telemetry', 'Thermal', 'BMS, CMMS', 'OVERLOAD', 'ABB', 61, 'Included'],
  ['FRA10-SSW-02', 'Static Switch 02', 'Static Switch', 'Critical', 'Hall A-4 / Rack Row 9', 'Thermal + Telemetry', 'Thermal', 'EPMS', 'OVERLOAD', 'ABB', 82, 'Included'],
  ['FRA10-OTNW-01', 'Network-Enabled OT Device 01', 'Network-Enabled OT Device', 'High', 'Hall C-6 / Rack Row 18', 'Telemetry Only', 'None (existing telemetry)', 'BMS, EPMS', 'COMMS-LOSS, LATENCY-HIGH', 'Moxa', null, 'Excluded'],
  ['FRA10-BMSI-01', 'BMS Infrastructure Node 01', 'BMS Infrastructure Node', 'High', 'Hall A-6 / Rack Row 8', 'Telemetry Only', 'None (existing telemetry)', 'BMS, CMMS, EPMS', 'COMMS-LOSS, SENSOR-DRIFT', 'Siemens', 96, 'Included'],
  ['FRA10-OTNW-02', 'Network-Enabled OT Device 02', 'Network-Enabled OT Device', 'Low', 'Hall A-6 / Rack Row 11', 'Telemetry Only', 'None (existing telemetry)', 'CMMS, DCIM', 'COMMS-LOSS', 'Cisco', 74, 'Included'],
  ['FRA10-PMON-01', 'Power Monitoring Device 01', 'Power Monitoring Device', 'High', 'Hall C-5 / Rack Row 4', 'Telemetry Only', 'None (existing telemetry)', 'BMS', 'CAL-DRIFT, COMMS-LOSS', 'Eaton', 87, 'Included'],

  // ── Ashburn DC12 (NAM) — 23 ──
  ['IAD12-CRAC-01', 'CRAC Unit 01', 'CRAC Unit', 'High', 'Hall C-6 / Rack Row 10', 'Vibration + Thermal', 'Vibration, Thermal', 'DCIM, EPMS', 'BRG-WEAR, RESONANCE', 'Vertiv (Liebert)', 86, 'Included'],
  ['IAD12-CRAH-01', 'CRAH Unit 01', 'CRAH Unit', 'Medium', 'Hall A-3 / Rack Row 10', 'Vibration + Thermal', 'Vibration, Thermal', 'BMS', 'BRG-WEAR, LOOSENESS, IMBALANCE', 'Airedale', 93, 'Included'],
  ['IAD12-COND-01', 'Condenser 01', 'Condenser', 'Critical', 'Hall B-3 / Rack Row 2', 'Thermal', 'Thermal', 'BMS', 'CORROSION, FOULING', 'Baltimore Aircoil', 98, 'Included'],
  ['IAD12-CRAH-02', 'CRAH Unit 02', 'CRAH Unit', 'Medium', 'Hall C-2 / Rack Row 18', 'Vibration + Thermal', 'Vibration, Thermal', 'BMS, CMMS, OEM Platform', 'BRG-WEAR, IMBALANCE', 'Stulz', 62, 'Included'],
  ['IAD12-CRAH-03', 'CRAH Unit 03', 'CRAH Unit', 'High', 'Hall A-6 / Rack Row 8', 'Vibration + Thermal', 'Vibration, Thermal', 'BMS, DCIM', 'BRG-WEAR', 'Stulz', 80, 'Included'],
  ['IAD12-CRAC-02', 'CRAC Unit 02', 'CRAC Unit', 'Medium', 'Hall B-1 / Rack Row 6', 'Vibration + Thermal', 'Vibration, Thermal', 'EPMS', 'RESONANCE, BRG-WEAR', 'Stulz', 69, 'Included'],
  ['IAD12-PUMP-01', 'Pump 01', 'Pump', 'Medium', 'Hall A-4 / Rack Row 8', 'Vibration + Ultrasound', 'Vibration, Ultrasound', 'BMS', 'MISALIGN', 'Xylem', 82, 'Included'],
  ['IAD12-COND-02', 'Condenser 02', 'Condenser', 'High', 'Hall B-3 / Rack Row 3', 'Thermal', 'Thermal', 'EPMS', 'FOULING', 'Baltimore Aircoil', 83, 'Included'],
  ['IAD12-CTWR-01', 'Cooling Tower 01', 'Cooling Tower', 'High', 'Hall A-5 / Rack Row 14', 'Vibration', 'Vibration', 'DCIM, EPMS', 'IMBALANCE, BRG-WEAR, SCALING', 'SPX Cooling', 60, 'Included'],
  ['IAD12-XFMR-01', 'Transformer 01', 'Transformer', 'Medium', 'Hall C-5 / Rack Row 7', 'Thermal + DGA', 'Thermal, Dissolved Gas Analysis', 'BMS, OEM Platform', 'INSUL-DEG, DGA-GAS-RISE, OVERHEAT', 'SPX', 58, 'Included'],
  ['IAD12-XFMR-02', 'Transformer 02', 'Transformer', 'Critical', 'Hall C-4 / Rack Row 11', 'Thermal + DGA', 'Thermal, Dissolved Gas Analysis', 'BMS, DCIM, OEM Platform', 'OVERHEAT, DGA-GAS-RISE', 'ABB', 77, 'Included'],
  ['IAD12-GENA-01', 'Generator Auxiliary 01', 'Generator Auxiliary', 'High', 'Hall A-3 / Rack Row 10', 'Vibration + Thermal', 'Vibration, Thermal', 'CMMS, DCIM, EPMS', 'LOOSE-CONN, BRG-WEAR', 'MTU', 93, 'Included'],
  ['IAD12-LVSG-01', 'LV Switchgear 01', 'LV Switchgear', 'Medium', 'Hall C-1 / Rack Row 10', 'Thermal + Ultrasound', 'Thermal, Ultrasound', 'EPMS, OEM Platform', 'LOOSE-CONN, TRACKING', 'ABB', 68, 'Included'],
  ['IAD12-XFMR-03', 'Transformer 03', 'Transformer', 'Medium', 'Hall A-4 / Rack Row 20', 'Thermal + DGA', 'Thermal, Dissolved Gas Analysis', 'BMS', 'DGA-GAS-RISE, INSUL-DEG, OVERHEAT', 'Siemens', 60, 'Included'],
  ['IAD12-SSW-01', 'Static Switch 01', 'Static Switch', 'High', 'Hall C-6 / Rack Row 1', 'Thermal + Telemetry', 'Thermal', 'EPMS, OEM Platform', 'OVERLOAD', 'Eaton', 67, 'Included'],
  ['IAD12-SSW-02', 'Static Switch 02', 'Static Switch', 'Critical', 'Hall B-6 / Rack Row 17', 'Thermal + Telemetry', 'Thermal', 'OEM Platform', 'LOOSE-CONN, OVERLOAD', 'Eaton', 66, 'Included'],
  ['IAD12-XFMR-04', 'Transformer 04', 'Transformer', 'High', 'Hall C-3 / Rack Row 17', 'Thermal + DGA', 'Thermal, Dissolved Gas Analysis', 'CMMS, EPMS, OEM Platform', 'DGA-GAS-RISE, OVERHEAT, INSUL-DEG', 'ABB', 73, 'Included'],
  ['IAD12-VFD-01', 'VFD / Drive 01', 'VFD / Drive', 'High', 'Hall A-2 / Rack Row 13', 'Thermal + Telemetry', 'Thermal', 'BMS, DCIM', 'OVERLOAD, LOOSE-CONN', 'ABB', 66, 'Included'],
  ['IAD12-PDU-01', 'PDU System 01', 'PDU System', 'Critical', 'Hall C-6 / Rack Row 1', 'Thermal + Telemetry', 'Thermal', 'OEM Platform', 'OVERLOAD, LOOSE-CONN', 'Schneider Electric', 82, 'Included'],
  ['IAD12-OTNW-01', 'Network-Enabled OT Device 01', 'Network-Enabled OT Device', 'Critical', 'Hall B-1 / Rack Row 13', 'Telemetry Only', 'None (existing telemetry)', 'DCIM, EPMS', 'LATENCY-HIGH, COMMS-LOSS', 'Moxa', 85, 'Included'],
  ['IAD12-BATM-01', 'Battery Monitoring System 01', 'Battery Monitoring System', 'Medium', 'Hall C-4 / Rack Row 5', 'Telemetry Only', 'None (existing telemetry)', 'BMS, CMMS', 'CELL-DEGRADE', 'Eaton', 63, 'Included'],
  ['IAD12-OTNW-02', 'Network-Enabled OT Device 02', 'Network-Enabled OT Device', 'Critical', 'Hall B-3 / Rack Row 3', 'Telemetry Only', 'None (existing telemetry)', 'DCIM, OEM Platform', 'LATENCY-HIGH', 'Cisco', 75, 'Included'],
  ['IAD12-OTNW-03', 'Network-Enabled OT Device 03', 'Network-Enabled OT Device', 'Medium', 'Hall A-5 / Rack Row 5', 'Telemetry Only', 'None (existing telemetry)', 'BMS, CMMS, OEM Platform', 'COMMS-LOSS, LATENCY-HIGH', 'Cisco', 70, 'Included'],

  // ── Singapore DC08 (APAC) — 23 ──
  ['SIN08-COND-01', 'Condenser 01', 'Condenser', 'High', 'Hall C-6 / Rack Row 4', 'Thermal', 'Thermal', 'BMS, CMMS, DCIM', 'CORROSION', 'Carrier', 96, 'Included'],
  ['SIN08-CHLR-01', 'Chiller 01', 'Chiller', 'Critical', 'Hall C-6 / Rack Row 8', 'Vibration + Ultrasound', 'Vibration, Ultrasound', 'BMS, EPMS', 'REFRIG-LEAK, BRG-WEAR', 'Carrier', 95, 'Included'],
  ['SIN08-CRAC-01', 'CRAC Unit 01', 'CRAC Unit', 'Medium', 'Hall B-6 / Rack Row 12', 'Vibration + Thermal', 'Vibration, Thermal', 'DCIM', 'RESONANCE', 'Stulz', 92, 'Included'],
  ['SIN08-CRAC-02', 'CRAC Unit 02', 'CRAC Unit', 'Critical', 'Hall A-6 / Rack Row 17', 'Vibration + Thermal', 'Vibration, Thermal', 'EPMS, OEM Platform', 'BRG-WEAR, MISALIGN', 'Stulz', 85, 'Included'],
  ['SIN08-CTWR-01', 'Cooling Tower 01', 'Cooling Tower', 'High', 'Hall A-4 / Rack Row 19', 'Vibration', 'Vibration', 'DCIM', 'IMBALANCE, SCALING, BRG-WEAR', 'SPX Cooling', 86, 'Included'],
  ['SIN08-AHU-01', 'Air Handling Unit 01', 'Air Handling Unit', 'Critical', 'Hall B-3 / Rack Row 20', 'Vibration + Thermal', 'Vibration, Thermal', 'DCIM', 'BELT-WEAR', 'Daikin', 74, 'Included'],
  ['SIN08-CTWR-02', 'Cooling Tower 02', 'Cooling Tower', 'High', 'Hall C-6 / Rack Row 16', 'Vibration', 'Vibration', 'EPMS, OEM Platform', 'SCALING', 'BAC', 88, 'Included'],
  ['SIN08-DRYC-01', 'Dry Cooler 01', 'Dry Cooler', 'Critical', 'Hall C-3 / Rack Row 14', 'Vibration', 'Vibration', 'CMMS, DCIM, EPMS', 'FAN-IMBALANCE', 'Guntner', 93, 'Included'],
  ['SIN08-PUMP-01', 'Pump 01', 'Pump', 'Medium', 'Hall C-2 / Rack Row 7', 'Vibration + Ultrasound', 'Vibration, Ultrasound', 'BMS, DCIM, EPMS', 'CAVITATION, SEAL-WEAR', 'Xylem', 92, 'Included'],
  ['SIN08-LVSG-01', 'LV Switchgear 01', 'LV Switchgear', 'High', 'Hall B-2 / Rack Row 10', 'Thermal + Ultrasound', 'Thermal, Ultrasound', 'DCIM', 'TRACKING, LOOSE-CONN, ARCING', 'Siemens', 72, 'Included'],
  ['SIN08-UPS-01', 'UPS System 01', 'UPS System', 'High', 'Hall A-5 / Rack Row 10', 'Thermal + Telemetry', 'Thermal, Battery Telemetry', 'EPMS, OEM Platform', 'OVERLOAD', 'Schneider Electric', 64, 'Included'],
  ['SIN08-VFD-01', 'VFD / Drive 01', 'VFD / Drive', 'High', 'Hall B-1 / Rack Row 19', 'Thermal + Telemetry', 'Thermal', 'BMS, CMMS', 'LOOSE-CONN', 'Danfoss', 83, 'Included'],
  ['SIN08-UPS-02', 'UPS System 02', 'UPS System', 'Critical', 'Hall C-5 / Rack Row 20', 'Thermal + Telemetry', 'Thermal, Battery Telemetry', 'CMMS', 'BATT-DEGRADE, OVERLOAD', 'Vertiv', 84, 'Included'],
  ['SIN08-LVSG-02', 'LV Switchgear 02', 'LV Switchgear', 'High', 'Hall C-6 / Rack Row 4', 'Thermal + Ultrasound', 'Thermal, Ultrasound', 'BMS, CMMS', 'TRACKING, LOOSE-CONN', 'Siemens', null, 'Excluded'],
  ['SIN08-LVSG-03', 'LV Switchgear 03', 'LV Switchgear', 'Critical', 'Hall A-1 / Rack Row 14', 'Thermal + Ultrasound', 'Thermal, Ultrasound', 'CMMS', 'ARCING', 'Siemens', 62, 'Included'],
  ['SIN08-VFD-02', 'VFD / Drive 02', 'VFD / Drive', 'High', 'Hall C-2 / Rack Row 14', 'Thermal + Telemetry', 'Thermal', 'DCIM, EPMS, OEM Platform', 'LOOSE-CONN, OVERLOAD', 'Danfoss', 95, 'Included'],
  ['SIN08-SSW-01', 'Static Switch 01', 'Static Switch', 'High', 'Hall B-5 / Rack Row 19', 'Thermal + Telemetry', 'Thermal', 'EPMS', 'LOOSE-CONN', 'ABB', null, 'Excluded'],
  ['SIN08-HVSG-01', 'HV Switchgear 01', 'HV Switchgear', 'Critical', 'Hall C-3 / Rack Row 20', 'Thermal + Ultrasound', 'Thermal, Ultrasound', 'BMS, CMMS', 'CORONA, TRACKING, ARCING', 'ABB', 85, 'Included'],
  ['SIN08-HVSG-02', 'HV Switchgear 02', 'HV Switchgear', 'Critical', 'Hall C-6 / Rack Row 15', 'Thermal + Ultrasound', 'Thermal, Ultrasound', 'BMS, EPMS, OEM Platform', 'TRACKING, ARCING, CORONA', 'Siemens', null, 'Excluded'],
  ['SIN08-BATM-01', 'Battery Monitoring System 01', 'Battery Monitoring System', 'Low', 'Hall C-1 / Rack Row 6', 'Telemetry Only', 'None (existing telemetry)', 'DCIM, OEM Platform', 'CELL-DEGRADE, COMMS-LOSS', 'Vertiv', 78, 'Included'],
  ['SIN08-BATM-02', 'Battery Monitoring System 02', 'Battery Monitoring System', 'Medium', 'Hall B-1 / Rack Row 13', 'Telemetry Only', 'None (existing telemetry)', 'DCIM', 'CELL-DEGRADE, COMMS-LOSS', 'Eaton', 74, 'Included'],
  ['SIN08-BMSI-01', 'BMS Infrastructure Node 01', 'BMS Infrastructure Node', 'Medium', 'Hall A-2 / Rack Row 9', 'Telemetry Only', 'None (existing telemetry)', 'CMMS, DCIM, OEM Platform', 'COMMS-LOSS', 'Siemens', 86, 'Included'],
  ['SIN08-PMON-01', 'Power Monitoring Device 01', 'Power Monitoring Device', 'High', 'Hall B-5 / Rack Row 1', 'Telemetry Only', 'None (existing telemetry)', 'CMMS, DCIM, EPMS', 'COMMS-LOSS', 'Eaton', 68, 'Included'],

  // ── Jafza Freezone DC1 (GCC) — 23 ──
  ['DXB-JFZ1-AHU-01', 'Air Handling Unit 01', 'Air Handling Unit', 'Critical', 'Hall C-3 / Rack Row 17', 'Vibration + Thermal', 'Vibration, Thermal', 'EPMS', 'BELT-WEAR', 'Trane', 89, 'Included'],
  ['DXB-JFZ1-CTWR-01', 'Cooling Tower 01', 'Cooling Tower', 'Medium', 'Hall C-5 / Rack Row 5', 'Vibration', 'Vibration', 'BMS, EPMS, OEM Platform', 'IMBALANCE', 'SPX Cooling', null, 'Excluded'],
  ['DXB-JFZ1-CRAC-01', 'CRAC Unit 01', 'CRAC Unit', 'Medium', 'Hall C-5 / Rack Row 16', 'Vibration + Thermal', 'Vibration, Thermal', 'DCIM', 'RESONANCE, MISALIGN', 'Stulz', 77, 'Included'],
  ['DXB-JFZ1-CHLR-01', 'Chiller 01', 'Chiller', 'High', 'Hall B-2 / Rack Row 14', 'Vibration + Ultrasound', 'Vibration, Ultrasound', 'CMMS, EPMS', 'REFRIG-LEAK, BRG-WEAR, CAVITATION', 'Carrier', 94, 'Included'],
  ['DXB-JFZ1-CRAH-01', 'CRAH Unit 01', 'CRAH Unit', 'Medium', 'Hall C-3 / Rack Row 4', 'Vibration + Thermal', 'Vibration, Thermal', 'BMS, EPMS', 'IMBALANCE, BRG-WEAR', 'Stulz', 90, 'Included'],
  ['DXB-JFZ1-DRYC-01', 'Dry Cooler 01', 'Dry Cooler', 'High', 'Hall B-5 / Rack Row 13', 'Vibration', 'Vibration', 'BMS, CMMS, EPMS', 'FAN-IMBALANCE', 'Guntner', 74, 'Included'],
  ['DXB-JFZ1-CRAC-02', 'CRAC Unit 02', 'CRAC Unit', 'Medium', 'Hall C-3 / Rack Row 8', 'Vibration + Thermal', 'Vibration, Thermal', 'BMS, CMMS, OEM Platform', 'MISALIGN, RESONANCE', 'Stulz', 98, 'Included'],
  ['DXB-JFZ1-CRAC-03', 'CRAC Unit 03', 'CRAC Unit', 'Low', 'Hall A-3 / Rack Row 12', 'Vibration + Thermal', 'Vibration, Thermal', 'BMS, DCIM, OEM Platform', 'BRG-WEAR, MISALIGN, RESONANCE', 'Stulz', 78, 'Included'],
  ['DXB-JFZ1-PUMP-01', 'Pump 01', 'Pump', 'Critical', 'Hall B-5 / Rack Row 8', 'Vibration + Ultrasound', 'Vibration, Ultrasound', 'BMS', 'SEAL-WEAR, CAVITATION, MISALIGN', 'Xylem', 97, 'Included'],
  ['DXB-JFZ1-VFD-01', 'VFD / Drive 01', 'VFD / Drive', 'Critical', 'Hall B-3 / Rack Row 19', 'Thermal + Telemetry', 'Thermal', 'DCIM, EPMS', 'LOOSE-CONN, OVERLOAD', 'ABB', 62, 'Included'],
  ['DXB-JFZ1-HVSG-01', 'HV Switchgear 01', 'HV Switchgear', 'Medium', 'Hall C-3 / Rack Row 19', 'Thermal + Ultrasound', 'Thermal, Ultrasound', 'BMS, EPMS', 'ARCING, CORONA', 'ABB', 82, 'Included'],
  ['DXB-JFZ1-HVSG-02', 'HV Switchgear 02', 'HV Switchgear', 'Critical', 'Hall C-3 / Rack Row 8', 'Thermal + Ultrasound', 'Thermal, Ultrasound', 'BMS, EPMS, OEM Platform', 'CORONA, ARCING', 'ABB', 72, 'Included'],
  ['DXB-JFZ1-LVSG-01', 'LV Switchgear 01', 'LV Switchgear', 'High', 'Hall C-3 / Rack Row 5', 'Thermal + Ultrasound', 'Thermal, Ultrasound', 'BMS, DCIM, EPMS', 'TRACKING, ARCING, LOOSE-CONN', 'Siemens', 60, 'Included'],
  ['DXB-JFZ1-SSW-01', 'Static Switch 01', 'Static Switch', 'High', 'Hall B-3 / Rack Row 11', 'Thermal + Telemetry', 'Thermal', 'BMS, CMMS, DCIM', 'LOOSE-CONN', 'Eaton', 74, 'Included'],
  ['DXB-JFZ1-SSW-02', 'Static Switch 02', 'Static Switch', 'Low', 'Hall B-5 / Rack Row 4', 'Thermal + Telemetry', 'Thermal', 'BMS, DCIM, EPMS', 'OVERLOAD', 'Eaton', 58, 'Included'],
  ['DXB-JFZ1-VFD-02', 'VFD / Drive 02', 'VFD / Drive', 'Medium', 'Hall C-3 / Rack Row 20', 'Thermal + Telemetry', 'Thermal', 'BMS, EPMS, OEM Platform', 'LOOSE-CONN, OVERLOAD', 'Danfoss', 97, 'Included'],
  ['DXB-JFZ1-LVSG-02', 'LV Switchgear 02', 'LV Switchgear', 'Critical', 'Hall B-4 / Rack Row 4', 'Thermal + Ultrasound', 'Thermal, Ultrasound', 'BMS', 'LOOSE-CONN, TRACKING, ARCING', 'Siemens', 60, 'Included'],
  ['DXB-JFZ1-SSW-03', 'Static Switch 03', 'Static Switch', 'Medium', 'Hall B-5 / Rack Row 14', 'Thermal + Telemetry', 'Thermal', 'DCIM, EPMS, OEM Platform', 'OVERLOAD, LOOSE-CONN', 'ABB', 64, 'Included'],
  ['DXB-JFZ1-HVSG-03', 'HV Switchgear 03', 'HV Switchgear', 'Medium', 'Hall C-3 / Rack Row 2', 'Thermal + Ultrasound', 'Thermal, Ultrasound', 'DCIM', 'ARCING, CORONA', 'Siemens', 92, 'Included'],
  ['DXB-JFZ1-OTNW-01', 'Network-Enabled OT Device 01', 'Network-Enabled OT Device', 'Critical', 'Hall A-2 / Rack Row 19', 'Telemetry Only', 'None (existing telemetry)', 'BMS, CMMS, OEM Platform', 'COMMS-LOSS, LATENCY-HIGH', 'Moxa', 79, 'Included'],
  ['DXB-JFZ1-PMON-01', 'Power Monitoring Device 01', 'Power Monitoring Device', 'Medium', 'Hall A-2 / Rack Row 18', 'Telemetry Only', 'None (existing telemetry)', 'BMS, EPMS', 'COMMS-LOSS', 'Schneider Electric', 75, 'Included'],
  ['DXB-JFZ1-BATM-01', 'Battery Monitoring System 01', 'Battery Monitoring System', 'Critical', 'Hall A-3 / Rack Row 2', 'Telemetry Only', 'None (existing telemetry)', 'DCIM, EPMS', 'CELL-DEGRADE', 'Vertiv', 59, 'Included'],
  ['DXB-JFZ1-PMON-02', 'Power Monitoring Device 02', 'Power Monitoring Device', 'High', 'Hall A-5 / Rack Row 2', 'Telemetry Only', 'None (existing telemetry)', 'BMS, CMMS, EPMS', 'CAL-DRIFT, COMMS-LOSS', 'Eaton', 90, 'Included'],
]

export const FASM_ASSETS = F.map(([assetId, assetName, assetClass, criticality, location, monitoringMethod, sensors, dataSources, failureCodes, manufacturer, health, scopeStatus]) => {
  const siteId = siteIdOf(assetId)
  const crit = criticalityByRating.get(criticality) || {}
  return {
    assetId, assetName, assetClass, criticality, location, monitoringMethod,
    sensors, dataSources, failureCodes, manufacturer,
    healthScore: health,
    scopeStatus, siteId,
    region: regionOf[siteId] || null,
    _site: siteNameOf[siteId] || siteId,
    _location: location,
    _category: categoryOf(assetClass),
    _tier: crit.tier || null,
    _sla: crit.responseSla || null,
    _sensors: /^none/i.test(sensors) ? [] : listOf(sensors),
    _failureCodes: listOf(failureCodes),
    _dataSources: listOf(dataSources),
    _included: scopeStatus === 'Included',
    _fasm: true,
  }
})

export const FASM_SUMMARY = {
  total: FASM_ASSETS.length,
  included: FASM_ASSETS.filter((a) => a._included).length,
  excluded: FASM_ASSETS.filter((a) => !a._included).length,
  critical: FASM_ASSETS.filter((a) => a.criticality === 'Critical').length,
  sites: FASM_SITES.length,
}
