// GENERATED FILE - DO NOT EDIT BY HAND.
//
// Produced by scripts/import-gapfill.mjs from
// Oxmaint_Portal_Gap_Fill_Data.xlsx
//
// This is NOT client data, and it is in its own file for that reason.
//
// The two workbooks in data-source/ came from Digital Realty and are read back
// against a Statement of Work. This one was produced internally to close the
// volume gaps a review of the portal found — three monitored assets out of
// forty-six, two recommendations, one closed outcome. Merging these rows into
// the client's arrays would destroy the property that makes those arrays worth
// having: that every row in them traces to a cell the client authored.
//
// So every row here carries `_gapFill: true`, and the screens mark them.
//
// Re-run: node scripts/import-gapfill.mjs [path-to-xlsx]

const mark = (rows) => rows.map((r) => ({ ...r, _gapFill: true }))

/** 10 assets brought into condition monitoring. */
export const GAP_ASSETS = mark([
  {
    "assetId": "IAD35-PUMP-01",
    "assetName": "Pump (Chilled / Condenser Water) 01 - IAD35",
    "site": "Ashburn Campus - Building 35",
    "assetClass": "Pump (Chilled / Condenser Water)",
    "sensors": [
      "vibration",
      "ultrasound"
    ],
    "sensorsLabel": "Vibration, Ultrasound",
    "alertRef": "ALT-0001",
    "failureMode": "V03 - Imbalance",
    "severity": "High",
    "classification": "True Positive",
    "status": "Closed - Resolved"
  },
  {
    "assetId": "ORD12-UPS-01",
    "assetName": "UPS System 01 - ORD12",
    "site": "Franklin Park Campus - Building 12",
    "assetClass": "UPS System",
    "sensors": [
      "thermal",
      "ultrasound"
    ],
    "sensorsLabel": "Thermal, Ultrasound",
    "alertRef": "ALT-0002",
    "failureMode": "T01 - Loose Electrical Connection",
    "severity": "Critical",
    "classification": "True Positive",
    "status": "Closed - Resolved"
  },
  {
    "assetId": "LHR10-LVSG-01",
    "assetName": "LV Switchgear 01 - LHR10",
    "site": "London Campus - Building 10",
    "assetClass": "LV Switchgear",
    "sensors": [
      "ultrasound",
      "thermal"
    ],
    "sensorsLabel": "Ultrasound, Thermal",
    "alertRef": "ALT-0003",
    "failureMode": "U02 - Arcing",
    "severity": "Critical",
    "classification": "True Positive",
    "status": "Closed - Resolved"
  },
  {
    "assetId": "FRA15-XFMR-01",
    "assetName": "Transformer 01 - FRA15",
    "site": "Hanauer Landstrasse Campus - Building 15",
    "assetClass": "Transformer",
    "sensors": [
      "thermal",
      "ultrasound"
    ],
    "sensorsLabel": "Thermal, Ultrasound",
    "alertRef": "ALT-0004",
    "failureMode": "T04 - Insulation Degradation (suspected)",
    "severity": "High",
    "classification": "Pending",
    "status": "Under Investigation"
  },
  {
    "assetId": "SIN11-GENS-01",
    "assetName": "Standby Generator Set (parent asset) 01 - SIN11",
    "site": "Loyang Campus - Building 11",
    "assetClass": "Standby Generator Set (parent asset)",
    "sensors": [
      "vibration",
      "thermal",
      "ultrasound"
    ],
    "sensorsLabel": "Vibration, Thermal, Ultrasound",
    "alertRef": "ALT-0005",
    "failureMode": "V02 - Misalignment",
    "severity": "Medium",
    "classification": "True Positive",
    "status": "Closed - Resolved"
  },
  {
    "assetId": "SYD12-CHIL-01",
    "assetName": "Chiller 01 - SYD12",
    "site": "Erskine Park Campus - Building 12",
    "assetClass": "Chiller",
    "sensors": [
      "vibration",
      "thermal",
      "ultrasound"
    ],
    "sensorsLabel": "Vibration, Thermal, Ultrasound",
    "alertRef": "ALT-0006",
    "failureMode": "V05 - Cavitation",
    "severity": "Medium",
    "classification": "False Positive",
    "status": "Closed - False Positive"
  },
  {
    "assetId": "ORD12-PDU-01",
    "assetName": "PDU System (Power Distribution Unit) 01 - ORD12",
    "site": "Franklin Park Campus - Building 12",
    "assetClass": "PDU System (Power Distribution Unit)",
    "sensors": [
      "ultrasound",
      "thermal"
    ],
    "sensorsLabel": "Ultrasound, Thermal",
    "alertRef": "ALT-0008",
    "failureMode": "U02 - Arcing",
    "severity": "Low",
    "classification": "Pending",
    "status": "Open"
  },
  {
    "assetId": "ORD12-AHU-01",
    "assetName": "Air Handling Unit (AHU) 01 - ORD12",
    "site": "Franklin Park Campus - Building 12",
    "assetClass": "Air Handling Unit (AHU)",
    "sensors": [
      "vibration",
      "thermal"
    ],
    "sensorsLabel": "Vibration, Thermal",
    "alertRef": "(new - not yet in register)",
    "failureMode": "V04 - Looseness",
    "severity": "Medium",
    "classification": "Pending",
    "status": "Recommended"
  },
  {
    "assetId": "IAD35-CTWR-01",
    "assetName": "Cooling Tower 01 - IAD35",
    "site": "Ashburn Campus - Building 35",
    "assetClass": "Cooling Tower",
    "sensors": [
      "thermal",
      "vibration"
    ],
    "sensorsLabel": "Thermal, Vibration",
    "alertRef": "(new - not yet in register)",
    "failureMode": "T03 - Cooling Failure",
    "severity": "High",
    "classification": "Pending",
    "status": "Recommended"
  },
  {
    "assetId": "LHR10-UPS-01",
    "assetName": "UPS System 01 - LHR10",
    "site": "London Campus - Building 10",
    "assetClass": "UPS System",
    "sensors": [
      "thermal",
      "ultrasound"
    ],
    "sensorsLabel": "Thermal, Ultrasound",
    "alertRef": "(new - not yet in register)",
    "failureMode": "T02 - Overloaded Circuitry",
    "severity": "Critical",
    "classification": "Pending",
    "status": "Dispatched"
  }
])

/** 585 daily readings, 2026-08-09 to 2026-10-17. */
export const GAP_READINGS = mark([
  {
    "date": "2026-08-16",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 1.87,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-17",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 2.09,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-18",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 1.99,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-19",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 2.08,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-20",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 2.16,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-21",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 2.03,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-22",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 2.03,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-23",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 1.9,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-24",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 1.97,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-25",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 2.04,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-26",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 2.1,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-27",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 2.14,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-28",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 2.02,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-29",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 1.93,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-30",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 2,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-31",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 2.19,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-01",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 1.99,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-02",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 2.06,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-03",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 2.21,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-04",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 1.94,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-05",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 2.12,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-06",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 2.23,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-07",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 2.02,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-08",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 2.64,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-09",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 3.28,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-10",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 3.58,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-11",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 4.22,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Elevated"
  },
  {
    "date": "2026-09-12",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 4.82,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Alarm"
  },
  {
    "date": "2026-09-13",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 5.32,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Alarm"
  },
  {
    "date": "2026-09-14",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 5.79,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Alarm"
  },
  {
    "date": "2026-09-15",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 4.58,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Alarm"
  },
  {
    "date": "2026-09-16",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 3.53,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-17",
    "assetId": "IAD35-PUMP-01",
    "sensor": "vibration",
    "value": 2.36,
    "unit": "mm/s RMS",
    "threshold": 4.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-16",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 15.95,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-17",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 15.78,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-18",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 16.77,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-19",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 16.67,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-20",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 15.81,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-21",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 16.37,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-22",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 15.82,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-23",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 16.22,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-24",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 16.07,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-25",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 16.72,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-26",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 16.2,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-27",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 16.42,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-28",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 16.98,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-29",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 16.42,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-30",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 17.45,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-31",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 16.04,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-01",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 17.21,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-02",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 16.62,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-03",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 16.67,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-04",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 17.13,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-05",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 16.95,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-06",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 16.78,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-07",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 16,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-08",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 17.18,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-09",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 19.42,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-10",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 20.05,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-11",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 21.39,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-12",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 22.91,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-13",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 23.37,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-14",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 23.11,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-15",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 21.28,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-16",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 19.52,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-17",
    "assetId": "IAD35-PUMP-01",
    "sensor": "ultrasound",
    "value": 16.47,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-21",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 45.12,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-08-22",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 45.16,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-08-23",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 45.03,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-08-24",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 44.22,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-08-25",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 45.2,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-08-26",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 43.59,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-08-27",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 44.11,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-08-28",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 44.58,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-08-29",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 45.34,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-08-30",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 44.82,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-08-31",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 44.08,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-09-01",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 44.67,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-09-02",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 44.72,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-09-03",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 44.76,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-09-04",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 44.53,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-09-05",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 45.22,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-09-06",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 45.4,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-09-07",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 46.28,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-09-08",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 46.43,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-09-09",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 45.86,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-09-10",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 45.81,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-09-11",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 46.67,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-09-12",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 49.68,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-09-13",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 51.92,
    "unit": "degC",
    "threshold": 59,
    "status": "Elevated"
  },
  {
    "date": "2026-09-14",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 54.97,
    "unit": "degC",
    "threshold": 59,
    "status": "Elevated"
  },
  {
    "date": "2026-09-15",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 58.05,
    "unit": "degC",
    "threshold": 59,
    "status": "Elevated"
  },
  {
    "date": "2026-09-16",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 58.65,
    "unit": "degC",
    "threshold": 59,
    "status": "Elevated"
  },
  {
    "date": "2026-09-17",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 63.4,
    "unit": "degC",
    "threshold": 59,
    "status": "Alarm"
  },
  {
    "date": "2026-09-18",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 64.71,
    "unit": "degC",
    "threshold": 59,
    "status": "Alarm"
  },
  {
    "date": "2026-09-19",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 67.94,
    "unit": "degC",
    "threshold": 59,
    "status": "Alarm"
  },
  {
    "date": "2026-09-20",
    "assetId": "ORD12-UPS-01",
    "sensor": "thermal",
    "value": 45.71,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-08-21",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 14.43,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-22",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 13.34,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-23",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 14.41,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-24",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 13.28,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-25",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 13.9,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-26",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 14.86,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-27",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 14.14,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-28",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 14.53,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-29",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 14.84,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-30",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 15.07,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-31",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 15,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-01",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 13.54,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-02",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 14.41,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-03",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 14.55,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-04",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 13.78,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-05",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 14.8,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-06",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 14.98,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-07",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 15.47,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-08",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 15.74,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-09",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 14.16,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-10",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 14.41,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-11",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 15.32,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-12",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 15.14,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-13",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 16.2,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-14",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 17.77,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-15",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 17.84,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-16",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 19.94,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-17",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 20.96,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-18",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 20.19,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-19",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 22.07,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-20",
    "assetId": "ORD12-UPS-01",
    "sensor": "ultrasound",
    "value": 15.59,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-28",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 18.14,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-29",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 16.5,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-30",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 16.3,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-31",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 18.04,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-01",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 18.16,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-02",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 16.5,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-03",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 17.13,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-04",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 17.84,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-05",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 18.19,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-06",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 16.61,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-07",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 17.85,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-08",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 18.24,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-09",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 17.66,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-10",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 16.79,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-11",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 16.52,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-12",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 17.16,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-13",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 18.47,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-14",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 16.68,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-15",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 16.64,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-16",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 17.53,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-17",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 16.86,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-18",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 17.11,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-19",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 16.86,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-20",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 21.35,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-21",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 25.04,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-22",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 27.68,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-23",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 30.27,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-24",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 34.02,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Elevated"
  },
  {
    "date": "2026-09-25",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 37.93,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Elevated"
  },
  {
    "date": "2026-09-26",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 42.06,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Alarm"
  },
  {
    "date": "2026-09-27",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 30.68,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-28",
    "assetId": "LHR10-LVSG-01",
    "sensor": "ultrasound",
    "value": 17.38,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-28",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 31.02,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-08-29",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 32.71,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-08-30",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 32.94,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-08-31",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 32.05,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-01",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 32.72,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-02",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 32.96,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-03",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 32.49,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-04",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 33.06,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-05",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 31.41,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-06",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 31.95,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-07",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 32.01,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-08",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 31.74,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-09",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 33.37,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-10",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 31.65,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-11",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 32.98,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-12",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 31.82,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-13",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 32.45,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-14",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 32.61,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-15",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 32.18,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-16",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 32.91,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-17",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 32.98,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-18",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 32.59,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-19",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 33.47,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-20",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 33.32,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-21",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 34.39,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-22",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 35.71,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-23",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 36.76,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-24",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 37.41,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-25",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 39.84,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-26",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 40.66,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-27",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 35.71,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-28",
    "assetId": "LHR10-LVSG-01",
    "sensor": "thermal",
    "value": 32.74,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-02",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 60.3,
    "unit": "degC",
    "threshold": 76,
    "status": "Normal"
  },
  {
    "date": "2026-09-03",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 60.99,
    "unit": "degC",
    "threshold": 76,
    "status": "Normal"
  },
  {
    "date": "2026-09-04",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 60.65,
    "unit": "degC",
    "threshold": 76,
    "status": "Normal"
  },
  {
    "date": "2026-09-05",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 61.36,
    "unit": "degC",
    "threshold": 76,
    "status": "Normal"
  },
  {
    "date": "2026-09-06",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 62.57,
    "unit": "degC",
    "threshold": 76,
    "status": "Normal"
  },
  {
    "date": "2026-09-07",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 61.28,
    "unit": "degC",
    "threshold": 76,
    "status": "Normal"
  },
  {
    "date": "2026-09-08",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 62.1,
    "unit": "degC",
    "threshold": 76,
    "status": "Normal"
  },
  {
    "date": "2026-09-09",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 62.07,
    "unit": "degC",
    "threshold": 76,
    "status": "Normal"
  },
  {
    "date": "2026-09-10",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 62.6,
    "unit": "degC",
    "threshold": 76,
    "status": "Normal"
  },
  {
    "date": "2026-09-11",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 60.92,
    "unit": "degC",
    "threshold": 76,
    "status": "Normal"
  },
  {
    "date": "2026-09-12",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 62.81,
    "unit": "degC",
    "threshold": 76,
    "status": "Normal"
  },
  {
    "date": "2026-09-13",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 63.45,
    "unit": "degC",
    "threshold": 76,
    "status": "Normal"
  },
  {
    "date": "2026-09-14",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 62.68,
    "unit": "degC",
    "threshold": 76,
    "status": "Normal"
  },
  {
    "date": "2026-09-15",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 61.98,
    "unit": "degC",
    "threshold": 76,
    "status": "Normal"
  },
  {
    "date": "2026-09-16",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 63.1,
    "unit": "degC",
    "threshold": 76,
    "status": "Normal"
  },
  {
    "date": "2026-09-17",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 63.32,
    "unit": "degC",
    "threshold": 76,
    "status": "Normal"
  },
  {
    "date": "2026-09-18",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 63.29,
    "unit": "degC",
    "threshold": 76,
    "status": "Normal"
  },
  {
    "date": "2026-09-19",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 62.08,
    "unit": "degC",
    "threshold": 76,
    "status": "Normal"
  },
  {
    "date": "2026-09-20",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 65.56,
    "unit": "degC",
    "threshold": 76,
    "status": "Elevated"
  },
  {
    "date": "2026-09-21",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 66.85,
    "unit": "degC",
    "threshold": 76,
    "status": "Elevated"
  },
  {
    "date": "2026-09-22",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 66.8,
    "unit": "degC",
    "threshold": 76,
    "status": "Elevated"
  },
  {
    "date": "2026-09-23",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 68.58,
    "unit": "degC",
    "threshold": 76,
    "status": "Elevated"
  },
  {
    "date": "2026-09-24",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 68.47,
    "unit": "degC",
    "threshold": 76,
    "status": "Elevated"
  },
  {
    "date": "2026-09-25",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 72.27,
    "unit": "degC",
    "threshold": 76,
    "status": "Elevated"
  },
  {
    "date": "2026-09-26",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 73.16,
    "unit": "degC",
    "threshold": 76,
    "status": "Elevated"
  },
  {
    "date": "2026-09-27",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 74.02,
    "unit": "degC",
    "threshold": 76,
    "status": "Elevated"
  },
  {
    "date": "2026-09-28",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 75.68,
    "unit": "degC",
    "threshold": 76,
    "status": "Elevated"
  },
  {
    "date": "2026-09-29",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 75.52,
    "unit": "degC",
    "threshold": 76,
    "status": "Elevated"
  },
  {
    "date": "2026-09-30",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 77.17,
    "unit": "degC",
    "threshold": 76,
    "status": "Alarm"
  },
  {
    "date": "2026-10-01",
    "assetId": "FRA15-XFMR-01",
    "sensor": "thermal",
    "value": 78.34,
    "unit": "degC",
    "threshold": 76,
    "status": "Alarm"
  },
  {
    "date": "2026-09-02",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 19.19,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-03",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 18.24,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-04",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 19.91,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-05",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 19.1,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-06",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 19.12,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-07",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 18.5,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-08",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 19.72,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-09",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 20.05,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-10",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 19.73,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-11",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 19.01,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-12",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 20.16,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-13",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 18.94,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-14",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 20.36,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-15",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 19.93,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-16",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 19.4,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-17",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 19.91,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-18",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 20.2,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-19",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 19.52,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-20",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 21.44,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-21",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 21.34,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-22",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 23.03,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-23",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 23.67,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-24",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 22.95,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-25",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 24.79,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-26",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 24.87,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-27",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 26.51,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-28",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 26.84,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-29",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 27.42,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-30",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 29.04,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-10-01",
    "assetId": "FRA15-XFMR-01",
    "sensor": "ultrasound",
    "value": 28.11,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-05",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 1.72,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-06",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 1.66,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-07",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 1.58,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-08",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 1.8,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-09",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 1.75,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-10",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 1.86,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-11",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 1.78,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-12",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 1.71,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-13",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 1.92,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-14",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 1.67,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-15",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 1.66,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-16",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 1.87,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-17",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 1.77,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-18",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 1.78,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-19",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 1.94,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-20",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 1.78,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-21",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 1.96,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-22",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 1.9,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-23",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 1.81,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-24",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 1.74,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-25",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 1.81,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-26",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 2.03,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-27",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 1.87,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-28",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 2.08,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-29",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 2.41,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-30",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 2.88,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-10-01",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 2.94,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-10-02",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 3.41,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Elevated"
  },
  {
    "date": "2026-10-03",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 3.5,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Alarm"
  },
  {
    "date": "2026-10-04",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 4.04,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Alarm"
  },
  {
    "date": "2026-10-05",
    "assetId": "SIN11-GENS-01",
    "sensor": "vibration",
    "value": 1.81,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-05",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 54.09,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-06",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 55.86,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-07",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 54.72,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-08",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 55.46,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-09",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 55.05,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-10",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 54.19,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-11",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 54.21,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-12",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 54.3,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-13",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 54.32,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-14",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 54.11,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-15",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 54.09,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-16",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 55.9,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-17",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 54.18,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-18",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 55.02,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-19",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 54.24,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-20",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 54.43,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-21",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 55.53,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-22",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 55.88,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-23",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 54.94,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-24",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 54.01,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-25",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 56,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-26",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 54.1,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-27",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 54.78,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-28",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 55.36,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-29",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 56.35,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-30",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 56.5,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-10-01",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 56.36,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-10-02",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 56.23,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-10-03",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 57.38,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-10-04",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 57.74,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-10-05",
    "assetId": "SIN11-GENS-01",
    "sensor": "thermal",
    "value": 55.74,
    "unit": "degC",
    "threshold": 70,
    "status": "Normal"
  },
  {
    "date": "2026-09-05",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 16.44,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-06",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 15.2,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-07",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 15.6,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-08",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 15.97,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-09",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 16.01,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-10",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 16.67,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-11",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 15.48,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-12",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 16.33,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-13",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 15.75,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-14",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 16.55,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-15",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 15.39,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-16",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 15.95,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-17",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 15.21,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-18",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 15.42,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-19",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 16.87,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-20",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 15.63,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-21",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 16.79,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-22",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 16.05,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-23",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 15.08,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-24",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 16.59,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-25",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 15.1,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-26",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 16.65,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-27",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 15.02,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-28",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 16.63,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-29",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 15.9,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-30",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 16.54,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-10-01",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 18.05,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-10-02",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 17.4,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-10-03",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 18.03,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-10-04",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 18.48,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-10-05",
    "assetId": "SIN11-GENS-01",
    "sensor": "ultrasound",
    "value": 15.22,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-09",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 2,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-10",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 2.03,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-11",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 1.81,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-12",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 1.93,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-13",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 1.85,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-14",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 2,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-15",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 1.79,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-16",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 1.94,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-17",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 2.03,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-18",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 2.01,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-19",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 1.83,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-20",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 2.05,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-21",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 1.88,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-22",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 2.05,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-23",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 1.97,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-24",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 1.87,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-25",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 2.05,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-26",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 2.07,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-27",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 2.05,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-28",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 2.13,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-29",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 1.92,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-09-30",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 1.92,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-10-01",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 2.09,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-10-02",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 2.41,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-10-03",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 2.57,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-10-04",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 2.76,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-10-05",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 2.99,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Elevated"
  },
  {
    "date": "2026-10-06",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 3.13,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Elevated"
  },
  {
    "date": "2026-10-07",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 3.25,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Elevated"
  },
  {
    "date": "2026-10-08",
    "assetId": "SYD12-CHIL-01",
    "sensor": "vibration",
    "value": 3.59,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Alarm"
  },
  {
    "date": "2026-09-09",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 27.73,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-09-10",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 27.94,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-09-11",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 28.51,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-09-12",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 27.61,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-09-13",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 28.16,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-09-14",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 28.17,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-09-15",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 27.74,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-09-16",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 27.97,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-09-17",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 28.56,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-09-18",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 27.81,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-09-19",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 28.25,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-09-20",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 28.41,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-09-21",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 27.83,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-09-22",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 28.59,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-09-23",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 28.15,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-09-24",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 28,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-09-25",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 28.26,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-09-26",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 27.91,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-09-27",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 28.25,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-09-28",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 27.73,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-09-29",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 28.51,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-09-30",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 28.05,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-10-01",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 27.73,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-10-02",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 28,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-10-03",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 28.59,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-10-04",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 28.52,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-10-05",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 28.17,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-10-06",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 28.05,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-10-07",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 28.11,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-10-08",
    "assetId": "SYD12-CHIL-01",
    "sensor": "thermal",
    "value": 28.88,
    "unit": "degC",
    "threshold": 41,
    "status": "Normal"
  },
  {
    "date": "2026-09-09",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 16.38,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-09-10",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 17.62,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-09-11",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 17.57,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-09-12",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 16.56,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-09-13",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 16.76,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-09-14",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 17.11,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-09-15",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 17.48,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-09-16",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 17.72,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-09-17",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 17.79,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-09-18",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 16.65,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-09-19",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 16.51,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-09-20",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 16.98,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-09-21",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 17.09,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-09-22",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 17.25,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-09-23",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 16.37,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-09-24",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 17.23,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-09-25",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 17.67,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-09-26",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 17.66,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-09-27",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 17.71,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-09-28",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 17.68,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-09-29",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 17.74,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-09-30",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 16.28,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-10-01",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 17.73,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-10-02",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 16.76,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-10-03",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 16.9,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-10-04",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 17.18,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-10-05",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 18.04,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-10-06",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 17.54,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-10-07",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 17.2,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-10-08",
    "assetId": "SYD12-CHIL-01",
    "sensor": "ultrasound",
    "value": 17.3,
    "unit": "dB uV",
    "threshold": 34,
    "status": "Normal"
  },
  {
    "date": "2026-09-18",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 15.81,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-19",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 15.71,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-20",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 14.4,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-21",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 14.68,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-22",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 14.99,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-23",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 14.75,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-24",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 15.5,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-25",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 14.88,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-26",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 15.65,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-27",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 16.43,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-28",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 16.32,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-29",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 14.89,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-30",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 15.16,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-10-01",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 15.64,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-10-02",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 16.17,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-10-03",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 15.71,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-10-04",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 15.5,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-10-05",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 16.3,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-10-06",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 16.64,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-10-07",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 18.57,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-10-08",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 18.86,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-10-09",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 18.9,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-10-10",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 20.09,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-10-11",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 20.35,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-10-12",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 20.98,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-10-13",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 21.27,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-10-14",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 22.13,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-10-15",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 23.74,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-10-16",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 23.95,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-10-17",
    "assetId": "ORD12-PDU-01",
    "sensor": "ultrasound",
    "value": 24.66,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-09-18",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 31.4,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-19",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 32.01,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-20",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 31.79,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-21",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 31.34,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-22",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 31.83,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-23",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 31.32,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-24",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 31.57,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-25",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 32.48,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-26",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 32.3,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-27",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 32.32,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-28",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 31.33,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-29",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 31.46,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-09-30",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 31.23,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-10-01",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 31.36,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-10-02",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 31.36,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-10-03",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 32.74,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-10-04",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 32.63,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-10-05",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 31.68,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-10-06",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 31.91,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-10-07",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 33.2,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-10-08",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 32.73,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-10-09",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 32.56,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-10-10",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 32.87,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-10-11",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 32.71,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-10-12",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 33.36,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-10-13",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 33.75,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-10-14",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 33.56,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-10-15",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 34.21,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-10-16",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 33.23,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-10-17",
    "assetId": "ORD12-PDU-01",
    "sensor": "thermal",
    "value": 34.17,
    "unit": "degC",
    "threshold": 55,
    "status": "Normal"
  },
  {
    "date": "2026-08-09",
    "assetId": "ORD12-AHU-01",
    "sensor": "vibration",
    "value": 1.75,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-10",
    "assetId": "ORD12-AHU-01",
    "sensor": "vibration",
    "value": 1.52,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-11",
    "assetId": "ORD12-AHU-01",
    "sensor": "vibration",
    "value": 1.66,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-12",
    "assetId": "ORD12-AHU-01",
    "sensor": "vibration",
    "value": 1.72,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-13",
    "assetId": "ORD12-AHU-01",
    "sensor": "vibration",
    "value": 1.67,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-14",
    "assetId": "ORD12-AHU-01",
    "sensor": "vibration",
    "value": 1.88,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-15",
    "assetId": "ORD12-AHU-01",
    "sensor": "vibration",
    "value": 1.77,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-16",
    "assetId": "ORD12-AHU-01",
    "sensor": "vibration",
    "value": 1.79,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-17",
    "assetId": "ORD12-AHU-01",
    "sensor": "vibration",
    "value": 2.15,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-18",
    "assetId": "ORD12-AHU-01",
    "sensor": "vibration",
    "value": 2.11,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-19",
    "assetId": "ORD12-AHU-01",
    "sensor": "vibration",
    "value": 2.6,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-20",
    "assetId": "ORD12-AHU-01",
    "sensor": "vibration",
    "value": 2.6,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-21",
    "assetId": "ORD12-AHU-01",
    "sensor": "vibration",
    "value": 2.91,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-22",
    "assetId": "ORD12-AHU-01",
    "sensor": "vibration",
    "value": 3.17,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Elevated"
  },
  {
    "date": "2026-08-23",
    "assetId": "ORD12-AHU-01",
    "sensor": "vibration",
    "value": 3.39,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Elevated"
  },
  {
    "date": "2026-08-09",
    "assetId": "ORD12-AHU-01",
    "sensor": "thermal",
    "value": 29.36,
    "unit": "degC",
    "threshold": 45,
    "status": "Normal"
  },
  {
    "date": "2026-08-10",
    "assetId": "ORD12-AHU-01",
    "sensor": "thermal",
    "value": 29.74,
    "unit": "degC",
    "threshold": 45,
    "status": "Normal"
  },
  {
    "date": "2026-08-11",
    "assetId": "ORD12-AHU-01",
    "sensor": "thermal",
    "value": 29.8,
    "unit": "degC",
    "threshold": 45,
    "status": "Normal"
  },
  {
    "date": "2026-08-12",
    "assetId": "ORD12-AHU-01",
    "sensor": "thermal",
    "value": 30.64,
    "unit": "degC",
    "threshold": 45,
    "status": "Normal"
  },
  {
    "date": "2026-08-13",
    "assetId": "ORD12-AHU-01",
    "sensor": "thermal",
    "value": 30.58,
    "unit": "degC",
    "threshold": 45,
    "status": "Normal"
  },
  {
    "date": "2026-08-14",
    "assetId": "ORD12-AHU-01",
    "sensor": "thermal",
    "value": 30.12,
    "unit": "degC",
    "threshold": 45,
    "status": "Normal"
  },
  {
    "date": "2026-08-15",
    "assetId": "ORD12-AHU-01",
    "sensor": "thermal",
    "value": 30.61,
    "unit": "degC",
    "threshold": 45,
    "status": "Normal"
  },
  {
    "date": "2026-08-16",
    "assetId": "ORD12-AHU-01",
    "sensor": "thermal",
    "value": 30.51,
    "unit": "degC",
    "threshold": 45,
    "status": "Normal"
  },
  {
    "date": "2026-08-17",
    "assetId": "ORD12-AHU-01",
    "sensor": "thermal",
    "value": 29.9,
    "unit": "degC",
    "threshold": 45,
    "status": "Normal"
  },
  {
    "date": "2026-08-18",
    "assetId": "ORD12-AHU-01",
    "sensor": "thermal",
    "value": 29.61,
    "unit": "degC",
    "threshold": 45,
    "status": "Normal"
  },
  {
    "date": "2026-08-19",
    "assetId": "ORD12-AHU-01",
    "sensor": "thermal",
    "value": 30.36,
    "unit": "degC",
    "threshold": 45,
    "status": "Normal"
  },
  {
    "date": "2026-08-20",
    "assetId": "ORD12-AHU-01",
    "sensor": "thermal",
    "value": 30.04,
    "unit": "degC",
    "threshold": 45,
    "status": "Normal"
  },
  {
    "date": "2026-08-21",
    "assetId": "ORD12-AHU-01",
    "sensor": "thermal",
    "value": 29.67,
    "unit": "degC",
    "threshold": 45,
    "status": "Normal"
  },
  {
    "date": "2026-08-22",
    "assetId": "ORD12-AHU-01",
    "sensor": "thermal",
    "value": 31.1,
    "unit": "degC",
    "threshold": 45,
    "status": "Normal"
  },
  {
    "date": "2026-08-23",
    "assetId": "ORD12-AHU-01",
    "sensor": "thermal",
    "value": 31.16,
    "unit": "degC",
    "threshold": 45,
    "status": "Normal"
  },
  {
    "date": "2026-08-09",
    "assetId": "IAD35-CTWR-01",
    "sensor": "thermal",
    "value": 29.06,
    "unit": "degC",
    "threshold": 42,
    "status": "Normal"
  },
  {
    "date": "2026-08-10",
    "assetId": "IAD35-CTWR-01",
    "sensor": "thermal",
    "value": 29.33,
    "unit": "degC",
    "threshold": 42,
    "status": "Normal"
  },
  {
    "date": "2026-08-11",
    "assetId": "IAD35-CTWR-01",
    "sensor": "thermal",
    "value": 29.56,
    "unit": "degC",
    "threshold": 42,
    "status": "Normal"
  },
  {
    "date": "2026-08-12",
    "assetId": "IAD35-CTWR-01",
    "sensor": "thermal",
    "value": 30.11,
    "unit": "degC",
    "threshold": 42,
    "status": "Normal"
  },
  {
    "date": "2026-08-13",
    "assetId": "IAD35-CTWR-01",
    "sensor": "thermal",
    "value": 29.52,
    "unit": "degC",
    "threshold": 42,
    "status": "Normal"
  },
  {
    "date": "2026-08-14",
    "assetId": "IAD35-CTWR-01",
    "sensor": "thermal",
    "value": 29.85,
    "unit": "degC",
    "threshold": 42,
    "status": "Normal"
  },
  {
    "date": "2026-08-15",
    "assetId": "IAD35-CTWR-01",
    "sensor": "thermal",
    "value": 29.42,
    "unit": "degC",
    "threshold": 42,
    "status": "Normal"
  },
  {
    "date": "2026-08-16",
    "assetId": "IAD35-CTWR-01",
    "sensor": "thermal",
    "value": 29.59,
    "unit": "degC",
    "threshold": 42,
    "status": "Normal"
  },
  {
    "date": "2026-08-17",
    "assetId": "IAD35-CTWR-01",
    "sensor": "thermal",
    "value": 31.32,
    "unit": "degC",
    "threshold": 42,
    "status": "Normal"
  },
  {
    "date": "2026-08-18",
    "assetId": "IAD35-CTWR-01",
    "sensor": "thermal",
    "value": 32.14,
    "unit": "degC",
    "threshold": 42,
    "status": "Normal"
  },
  {
    "date": "2026-08-19",
    "assetId": "IAD35-CTWR-01",
    "sensor": "thermal",
    "value": 33.11,
    "unit": "degC",
    "threshold": 42,
    "status": "Normal"
  },
  {
    "date": "2026-08-20",
    "assetId": "IAD35-CTWR-01",
    "sensor": "thermal",
    "value": 34.93,
    "unit": "degC",
    "threshold": 42,
    "status": "Normal"
  },
  {
    "date": "2026-08-21",
    "assetId": "IAD35-CTWR-01",
    "sensor": "thermal",
    "value": 36.83,
    "unit": "degC",
    "threshold": 42,
    "status": "Elevated"
  },
  {
    "date": "2026-08-22",
    "assetId": "IAD35-CTWR-01",
    "sensor": "thermal",
    "value": 37.36,
    "unit": "degC",
    "threshold": 42,
    "status": "Elevated"
  },
  {
    "date": "2026-08-23",
    "assetId": "IAD35-CTWR-01",
    "sensor": "thermal",
    "value": 39.58,
    "unit": "degC",
    "threshold": 42,
    "status": "Elevated"
  },
  {
    "date": "2026-08-09",
    "assetId": "IAD35-CTWR-01",
    "sensor": "vibration",
    "value": 1.76,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-10",
    "assetId": "IAD35-CTWR-01",
    "sensor": "vibration",
    "value": 1.75,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-11",
    "assetId": "IAD35-CTWR-01",
    "sensor": "vibration",
    "value": 1.82,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-12",
    "assetId": "IAD35-CTWR-01",
    "sensor": "vibration",
    "value": 1.57,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-13",
    "assetId": "IAD35-CTWR-01",
    "sensor": "vibration",
    "value": 1.6,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-14",
    "assetId": "IAD35-CTWR-01",
    "sensor": "vibration",
    "value": 1.82,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-15",
    "assetId": "IAD35-CTWR-01",
    "sensor": "vibration",
    "value": 1.82,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-16",
    "assetId": "IAD35-CTWR-01",
    "sensor": "vibration",
    "value": 1.57,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-17",
    "assetId": "IAD35-CTWR-01",
    "sensor": "vibration",
    "value": 1.81,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-18",
    "assetId": "IAD35-CTWR-01",
    "sensor": "vibration",
    "value": 1.61,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-19",
    "assetId": "IAD35-CTWR-01",
    "sensor": "vibration",
    "value": 1.68,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-20",
    "assetId": "IAD35-CTWR-01",
    "sensor": "vibration",
    "value": 1.7,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-21",
    "assetId": "IAD35-CTWR-01",
    "sensor": "vibration",
    "value": 1.78,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-22",
    "assetId": "IAD35-CTWR-01",
    "sensor": "vibration",
    "value": 1.84,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-23",
    "assetId": "IAD35-CTWR-01",
    "sensor": "vibration",
    "value": 2.02,
    "unit": "mm/s RMS",
    "threshold": 3.5,
    "status": "Normal"
  },
  {
    "date": "2026-08-09",
    "assetId": "LHR10-UPS-01",
    "sensor": "thermal",
    "value": 42.86,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-08-10",
    "assetId": "LHR10-UPS-01",
    "sensor": "thermal",
    "value": 42.46,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-08-11",
    "assetId": "LHR10-UPS-01",
    "sensor": "thermal",
    "value": 43.07,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-08-12",
    "assetId": "LHR10-UPS-01",
    "sensor": "thermal",
    "value": 42.77,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-08-13",
    "assetId": "LHR10-UPS-01",
    "sensor": "thermal",
    "value": 43.1,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-08-14",
    "assetId": "LHR10-UPS-01",
    "sensor": "thermal",
    "value": 44.28,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-08-15",
    "assetId": "LHR10-UPS-01",
    "sensor": "thermal",
    "value": 44.74,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-08-16",
    "assetId": "LHR10-UPS-01",
    "sensor": "thermal",
    "value": 44.45,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-08-17",
    "assetId": "LHR10-UPS-01",
    "sensor": "thermal",
    "value": 47.02,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-08-18",
    "assetId": "LHR10-UPS-01",
    "sensor": "thermal",
    "value": 48.7,
    "unit": "degC",
    "threshold": 59,
    "status": "Normal"
  },
  {
    "date": "2026-08-19",
    "assetId": "LHR10-UPS-01",
    "sensor": "thermal",
    "value": 52.21,
    "unit": "degC",
    "threshold": 59,
    "status": "Elevated"
  },
  {
    "date": "2026-08-20",
    "assetId": "LHR10-UPS-01",
    "sensor": "thermal",
    "value": 53.91,
    "unit": "degC",
    "threshold": 59,
    "status": "Elevated"
  },
  {
    "date": "2026-08-21",
    "assetId": "LHR10-UPS-01",
    "sensor": "thermal",
    "value": 55.68,
    "unit": "degC",
    "threshold": 59,
    "status": "Elevated"
  },
  {
    "date": "2026-08-22",
    "assetId": "LHR10-UPS-01",
    "sensor": "thermal",
    "value": 58.71,
    "unit": "degC",
    "threshold": 59,
    "status": "Elevated"
  },
  {
    "date": "2026-08-23",
    "assetId": "LHR10-UPS-01",
    "sensor": "thermal",
    "value": 60.36,
    "unit": "degC",
    "threshold": 59,
    "status": "Alarm"
  },
  {
    "date": "2026-08-09",
    "assetId": "LHR10-UPS-01",
    "sensor": "ultrasound",
    "value": 13.58,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-10",
    "assetId": "LHR10-UPS-01",
    "sensor": "ultrasound",
    "value": 13.39,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-11",
    "assetId": "LHR10-UPS-01",
    "sensor": "ultrasound",
    "value": 14.85,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-12",
    "assetId": "LHR10-UPS-01",
    "sensor": "ultrasound",
    "value": 13.99,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-13",
    "assetId": "LHR10-UPS-01",
    "sensor": "ultrasound",
    "value": 15.48,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-14",
    "assetId": "LHR10-UPS-01",
    "sensor": "ultrasound",
    "value": 14.53,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-15",
    "assetId": "LHR10-UPS-01",
    "sensor": "ultrasound",
    "value": 14.17,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-16",
    "assetId": "LHR10-UPS-01",
    "sensor": "ultrasound",
    "value": 15.41,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-17",
    "assetId": "LHR10-UPS-01",
    "sensor": "ultrasound",
    "value": 17.18,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-18",
    "assetId": "LHR10-UPS-01",
    "sensor": "ultrasound",
    "value": 19.19,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-19",
    "assetId": "LHR10-UPS-01",
    "sensor": "ultrasound",
    "value": 19.41,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-20",
    "assetId": "LHR10-UPS-01",
    "sensor": "ultrasound",
    "value": 22.44,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-21",
    "assetId": "LHR10-UPS-01",
    "sensor": "ultrasound",
    "value": 24.29,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-22",
    "assetId": "LHR10-UPS-01",
    "sensor": "ultrasound",
    "value": 24.89,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  },
  {
    "date": "2026-08-23",
    "assetId": "LHR10-UPS-01",
    "sensor": "ultrasound",
    "value": 26.91,
    "unit": "dB uV",
    "threshold": 38,
    "status": "Normal"
  }
])

/** 10 detections, one per monitored asset. */
export const GAP_DETECTIONS = mark([
  {
    "detectionId": "ALT-1003",
    "alertRef": "ALT-0001",
    "assetId": "IAD35-PUMP-01",
    "assetName": "Pump (Chilled / Condenser Water) 01 - IAD35",
    "failureCode": "V03",
    "failureMode": "Imbalance",
    "severity": "High",
    "corroborating": "2 of 2",
    "confidenceBefore": 74,
    "confidenceAfter": 88,
    "status": "Closed - Resolved"
  },
  {
    "detectionId": "ALT-1004",
    "alertRef": "ALT-0002",
    "assetId": "ORD12-UPS-01",
    "assetName": "UPS System 01 - ORD12",
    "failureCode": "T01",
    "failureMode": "Loose Electrical Connection",
    "severity": "Critical",
    "corroborating": "2 of 2",
    "confidenceBefore": 71,
    "confidenceAfter": 89,
    "status": "Closed - Resolved"
  },
  {
    "detectionId": "ALT-1005",
    "alertRef": "ALT-0003",
    "assetId": "LHR10-LVSG-01",
    "assetName": "LV Switchgear 01 - LHR10",
    "failureCode": "U02",
    "failureMode": "Arcing",
    "severity": "Critical",
    "corroborating": "2 of 2",
    "confidenceBefore": 76,
    "confidenceAfter": 93,
    "status": "Closed - Resolved"
  },
  {
    "detectionId": "ALT-1006",
    "alertRef": "ALT-0004",
    "assetId": "FRA15-XFMR-01",
    "assetName": "Transformer 01 - FRA15",
    "failureCode": "T04",
    "failureMode": "Insulation Degradation (suspected)",
    "severity": "High",
    "corroborating": "2 of 2",
    "confidenceBefore": 58,
    "confidenceAfter": 71,
    "status": "Under Investigation"
  },
  {
    "detectionId": "ALT-1007",
    "alertRef": "ALT-0005",
    "assetId": "SIN11-GENS-01",
    "assetName": "Standby Generator Set (parent asset) 01 - SIN11",
    "failureCode": "V02",
    "failureMode": "Misalignment",
    "severity": "Medium",
    "corroborating": "1 of 3 (vibration only; thermal/ultrasound stayed normal)",
    "confidenceBefore": 70,
    "confidenceAfter": 85,
    "status": "Closed - Resolved"
  },
  {
    "detectionId": "ALT-1008",
    "alertRef": "ALT-0006",
    "assetId": "SYD12-CHIL-01",
    "assetName": "Chiller 01 - SYD12",
    "failureCode": "V05",
    "failureMode": "Cavitation",
    "severity": "Medium",
    "corroborating": "1 of 3 (vibration only; no thermal/ultrasound corroboration — driver of the false-positive call)",
    "confidenceBefore": 62,
    "confidenceAfter": 41,
    "status": "Closed - False Positive"
  },
  {
    "detectionId": "ALT-1009",
    "alertRef": "ALT-0008",
    "assetId": "ORD12-PDU-01",
    "assetName": "PDU System (Power Distribution Unit) 01 - ORD12",
    "failureCode": "U02",
    "failureMode": "Arcing",
    "severity": "Low",
    "corroborating": "1 of 2 (ultrasound only, below alarm — thermal still normal)",
    "confidenceBefore": 48,
    "confidenceAfter": 61,
    "status": "Open"
  },
  {
    "detectionId": "ALT-1010",
    "alertRef": "(new - not yet in register)",
    "assetId": "ORD12-AHU-01",
    "assetName": "Air Handling Unit (AHU) 01 - ORD12",
    "failureCode": "V04",
    "failureMode": "Looseness",
    "severity": "Medium",
    "corroborating": "1 of 2 (vibration only; thermal still normal)",
    "confidenceBefore": 52,
    "confidenceAfter": 65,
    "status": "Recommended"
  },
  {
    "detectionId": "ALT-1011",
    "alertRef": "(new - not yet in register)",
    "assetId": "IAD35-CTWR-01",
    "assetName": "Cooling Tower 01 - IAD35",
    "failureCode": "T03",
    "failureMode": "Cooling Failure",
    "severity": "High",
    "corroborating": "1 of 2 (thermal only; vibration still normal)",
    "confidenceBefore": 55,
    "confidenceAfter": 68,
    "status": "Recommended"
  },
  {
    "detectionId": "ALT-1012",
    "alertRef": "(new - not yet in register)",
    "assetId": "LHR10-UPS-01",
    "assetName": "UPS System 01 - LHR10",
    "failureCode": "T02",
    "failureMode": "Overloaded Circuitry",
    "severity": "Critical",
    "corroborating": "2 of 2",
    "confidenceBefore": 69,
    "confidenceAfter": 82,
    "status": "Dispatched"
  }
])

/** 10 recommendations, spanning every lifecycle stage. */
export const GAP_RECOMMENDATIONS = mark([
  {
    "recId": "REC-2003",
    "detectionId": "ALT-1003",
    "assetId": "IAD35-PUMP-01",
    "assetName": "Pump (Chilled / Condenser Water) 01 - IAD35",
    "action": "Inspect and correct impeller/coupling imbalance within 2 weeks",
    "workOrderId": "WO-3003",
    "woStatus": "Completed",
    "finding": "Impeller wear consistent with imbalance signature; rebalanced and corrected.",
    "outcome": "True positive",
    "dateClosed": "2026-09-18"
  },
  {
    "recId": "REC-2004",
    "detectionId": "ALT-1004",
    "assetId": "ORD12-UPS-01",
    "assetName": "UPS System 01 - ORD12",
    "action": "De-energize and re-torque input terminal lug within 48 hours",
    "workOrderId": "WO-3004",
    "woStatus": "Completed",
    "finding": "Loose input terminal lug confirmed as heat source; re-torqued and re-tested.",
    "outcome": "True positive",
    "dateClosed": "2026-09-21"
  },
  {
    "recId": "REC-2005",
    "detectionId": "ALT-1005",
    "assetId": "LHR10-LVSG-01",
    "assetName": "LV Switchgear 01 - LHR10",
    "action": "Isolate and resurface breaker cable lug contact within 24 hours",
    "workOrderId": "WO-3005",
    "woStatus": "Completed",
    "finding": "Early-stage arcing confirmed at breaker cable lug; contact resurfaced.",
    "outcome": "True positive",
    "dateClosed": "2026-09-29"
  },
  {
    "recId": "REC-2006",
    "detectionId": "ALT-1006",
    "assetId": "FRA15-XFMR-01",
    "assetName": "Transformer 01 - FRA15",
    "action": "Schedule oil/DGA sampling and IR thermography follow-up within 1 week",
    "workOrderId": "WO-1004",
    "woStatus": "In Progress",
    "finding": "Not logged yet — engineering review in progress.",
    "outcome": "Pending",
    "dateClosed": null
  },
  {
    "recId": "REC-2007",
    "detectionId": "ALT-1007",
    "assetId": "SIN11-GENS-01",
    "assetName": "Standby Generator Set (parent asset) 01 - SIN11",
    "action": "Correct coupling misalignment during next exercise run",
    "workOrderId": "WO-3006",
    "woStatus": "Completed",
    "finding": "Minor coupling misalignment confirmed and corrected during routine exercise run.",
    "outcome": "True positive",
    "dateClosed": "2026-10-06"
  },
  {
    "recId": "REC-2008",
    "detectionId": "ALT-1008",
    "assetId": "SYD12-CHIL-01",
    "assetName": "Chiller 01 - SYD12",
    "action": "No action — monitor; consider adjusting vibration alarm threshold",
    "workOrderId": "—",
    "woStatus": "Not raised",
    "finding": "No cavitation or mechanical wear found on inspection; consistent with a momentary flow transient.",
    "outcome": "False positive",
    "dateClosed": "2026-10-09"
  },
  {
    "recId": "REC-2009",
    "detectionId": "ALT-1009",
    "assetId": "ORD12-PDU-01",
    "assetName": "PDU System (Power Distribution Unit) 01 - ORD12",
    "action": "Add to next scheduled thermographic scan; re-check ultrasound in 2 weeks",
    "workOrderId": "—",
    "woStatus": "Not yet raised",
    "finding": "Not logged yet — below alarm threshold, monitoring only.",
    "outcome": "Pending",
    "dateClosed": null
  },
  {
    "recId": "REC-2010",
    "detectionId": "ALT-1010",
    "assetId": "ORD12-AHU-01",
    "assetName": "Air Handling Unit (AHU) 01 - ORD12",
    "action": "Inspect fan mounting bolts and belt tension within 2 weeks",
    "workOrderId": "—",
    "woStatus": "Not yet raised",
    "finding": "Not logged yet — recommendation issued, no work order raised.",
    "outcome": "Pending",
    "dateClosed": null
  },
  {
    "recId": "REC-2011",
    "detectionId": "ALT-1011",
    "assetId": "IAD35-CTWR-01",
    "assetName": "Cooling Tower 01 - IAD35",
    "action": "Inspect fill media and basin water treatment within 1 week",
    "workOrderId": "—",
    "woStatus": "Not yet raised",
    "finding": "Not logged yet — recommendation issued, no work order raised.",
    "outcome": "Pending",
    "dateClosed": null
  },
  {
    "recId": "REC-2012",
    "detectionId": "ALT-1012",
    "assetId": "LHR10-UPS-01",
    "assetName": "UPS System 01 - LHR10",
    "action": "Redistribute load across output modules and inspect breaker sizing within 48 hours",
    "workOrderId": "WO-3010",
    "woStatus": "Dispatched",
    "finding": "Not logged yet — the job is still open.",
    "outcome": "Pending",
    "dateClosed": null
  }
])

/** 10 outcome-log entries, 5 of them counted toward accuracy. */
export const GAP_OUTCOMES = mark([
  {
    "dateClosed": "2026-09-18",
    "assetId": "IAD35-PUMP-01",
    "assetName": "Pump (Chilled / Condenser Water) 01 - IAD35",
    "failureCode": "V03",
    "predicted": "Imbalance suspected",
    "confidence": 88,
    "found": "Impeller wear consistent with imbalance signature; rebalanced and corrected.",
    "classification": "True positive",
    "counted": true,
    "countedNote": "Yes"
  },
  {
    "dateClosed": "2026-09-21",
    "assetId": "ORD12-UPS-01",
    "assetName": "UPS System 01 - ORD12",
    "failureCode": "T01",
    "predicted": "Loose Electrical Connection suspected",
    "confidence": 89,
    "found": "Loose input terminal lug confirmed as heat source; re-torqued and re-tested.",
    "classification": "True positive",
    "counted": true,
    "countedNote": "Yes"
  },
  {
    "dateClosed": "2026-09-29",
    "assetId": "LHR10-LVSG-01",
    "assetName": "LV Switchgear 01 - LHR10",
    "failureCode": "U02",
    "predicted": "Arcing suspected",
    "confidence": 93,
    "found": "Early-stage arcing confirmed at breaker cable lug; contact resurfaced.",
    "classification": "True positive",
    "counted": true,
    "countedNote": "Yes"
  },
  {
    "dateClosed": "(open)",
    "assetId": "FRA15-XFMR-01",
    "assetName": "Transformer 01 - FRA15",
    "failureCode": "T04",
    "predicted": "Insulation Degradation (suspected) suspected",
    "confidence": 71,
    "found": "Not logged yet — engineering review in progress.",
    "classification": "Pending",
    "counted": false,
    "countedNote": "No - awaiting outcome"
  },
  {
    "dateClosed": "2026-10-06",
    "assetId": "SIN11-GENS-01",
    "assetName": "Standby Generator Set (parent asset) 01 - SIN11",
    "failureCode": "V02",
    "predicted": "Misalignment suspected",
    "confidence": 85,
    "found": "Minor coupling misalignment confirmed and corrected during routine exercise run.",
    "classification": "True positive",
    "counted": true,
    "countedNote": "Yes"
  },
  {
    "dateClosed": "2026-10-09",
    "assetId": "SYD12-CHIL-01",
    "assetName": "Chiller 01 - SYD12",
    "failureCode": "V05",
    "predicted": "Cavitation suspected",
    "confidence": 41,
    "found": "No cavitation or mechanical wear found on inspection; consistent with a momentary flow transient.",
    "classification": "False positive",
    "counted": true,
    "countedNote": "Yes"
  },
  {
    "dateClosed": "(open)",
    "assetId": "ORD12-PDU-01",
    "assetName": "PDU System (Power Distribution Unit) 01 - ORD12",
    "failureCode": "U02",
    "predicted": "Arcing suspected",
    "confidence": 61,
    "found": "Not logged yet — below alarm threshold, monitoring only.",
    "classification": "Pending",
    "counted": false,
    "countedNote": "No - awaiting outcome"
  },
  {
    "dateClosed": "(open)",
    "assetId": "ORD12-AHU-01",
    "assetName": "Air Handling Unit (AHU) 01 - ORD12",
    "failureCode": "V04",
    "predicted": "Looseness suspected",
    "confidence": 65,
    "found": "Not logged yet — recommendation issued, no work order raised.",
    "classification": "Pending",
    "counted": false,
    "countedNote": "No - awaiting outcome"
  },
  {
    "dateClosed": "(open)",
    "assetId": "IAD35-CTWR-01",
    "assetName": "Cooling Tower 01 - IAD35",
    "failureCode": "T03",
    "predicted": "Cooling Failure suspected",
    "confidence": 68,
    "found": "Not logged yet — recommendation issued, no work order raised.",
    "classification": "Pending",
    "counted": false,
    "countedNote": "No - awaiting outcome"
  },
  {
    "dateClosed": "(open)",
    "assetId": "LHR10-UPS-01",
    "assetName": "UPS System 01 - LHR10",
    "failureCode": "T02",
    "predicted": "Overloaded Circuitry suspected",
    "confidence": 82,
    "found": "Not logged yet — the job is still open.",
    "classification": "Pending",
    "counted": false,
    "countedNote": "No - awaiting outcome"
  }
])

/** The 7 existing incidents, with downtime split into a number and a note. */
export const GAP_INCIDENT_DETAIL = mark([
  {
    "incidentId": "INC-2025-014",
    "date": "2025-03-09",
    "assetId": "ORD12-UPS-01",
    "assetName": "UPS System 01 - ORD12",
    "site": "Franklin Park Campus - Building 12",
    "downtimeHours": 0,
    "downtimeNote": "Redundant leg only; load stayed on active module",
    "customerImpact": false,
    "description": "UPS module fault on redundant leg; load remained on active module.",
    "rootCause": "Capacitor failure (age-related).",
    "howFound": "BMS Alarm"
  },
  {
    "incidentId": "INC-2025-027",
    "date": "2025-06-20",
    "assetId": "LHR10-LVSG-01",
    "assetName": "LV Switchgear 01 - LHR10",
    "site": "London Campus - Building 10",
    "downtimeHours": 1.5,
    "downtimeNote": "Nuisance trip on non-critical distribution breaker",
    "customerImpact": false,
    "description": "Nuisance trip on non-critical distribution breaker.",
    "rootCause": "Protective relay settings drift.",
    "howFound": "EPMS Alarm"
  },
  {
    "incidentId": "INC-2025-041",
    "date": "2025-08-02",
    "assetId": "IAD35-CHIL-01",
    "assetName": "Chiller 01 - IAD35",
    "site": "Ashburn Campus - Building 35",
    "downtimeHours": 0,
    "downtimeNote": "N+1 covered; no capacity loss to IT load",
    "customerImpact": false,
    "description": "Reduced chiller capacity during peak cooling demand.",
    "rootCause": "Fouled condenser tubes.",
    "howFound": "Operator Report + BMS Trend"
  },
  {
    "incidentId": "INC-2025-058",
    "date": "2025-10-28",
    "assetId": "FRA15-GENS-01",
    "assetName": "Standby Generator Set (parent asset) 01 - FRA15",
    "site": "Hanauer Landstrasse Campus - Building 15",
    "downtimeHours": 0,
    "downtimeNote": "Scheduled load-bank test, not a live event",
    "customerImpact": false,
    "description": "Failed to reach rated load during scheduled load-bank test.",
    "rootCause": "Fuel filter restriction.",
    "howFound": "Scheduled PM (PM-GENS-02)"
  },
  {
    "incidentId": "INC-2026-009",
    "date": "2026-02-12",
    "assetId": "SIN11-XFMR-01",
    "assetName": "Transformer 01 - SIN11",
    "site": "Loyang Campus - Building 11",
    "downtimeHours": 0,
    "downtimeNote": "Corrected same shift",
    "customerImpact": false,
    "description": "Elevated top-oil temperature alarm during high-load period.",
    "rootCause": "Cooling fan controller fault.",
    "howFound": "BMS Alarm"
  },
  {
    "incidentId": "INC-2026-021",
    "date": "2026-04-30",
    "assetId": "SYD12-CHIL-01",
    "assetName": "Chiller 01 - SYD12",
    "site": "Erskine Park Campus - Building 12",
    "downtimeHours": 0.5,
    "downtimeNote": "N+1 covered; brief transient only",
    "customerImpact": false,
    "description": "Unplanned chiller trip on high discharge pressure.",
    "rootCause": "Condenser water flow restriction.",
    "howFound": "BMS Alarm"
  },
  {
    "incidentId": "INC-2026-033",
    "date": "2026-06-17",
    "assetId": "ORD12-PDU-01",
    "assetName": "PDU System (Power Distribution Unit) 01 - ORD12",
    "site": "Franklin Park Campus - Building 12",
    "downtimeHours": 0,
    "downtimeNote": "Found on inspection before any load impact",
    "customerImpact": false,
    "description": "Breaker overheating identified during routine inspection.",
    "rootCause": "Loose termination.",
    "howFound": "Scheduled PM Inspection"
  }
])

/** What this file is, for the screens that say so on the page. */
export const GAP_SOURCE = {
  file: 'Oxmaint_Portal_Gap_Fill_Data.xlsx',
  origin: 'internal',
  note: 'Produced internally to close the volume gaps a portal review found. '
    + 'Anchored values match readings and alerts already on the site; rows are marked so they can be told apart from the client workbook.',
  assets: 10,
  readings: 585,
  from: "2026-08-09",
  to: "2026-10-17",
}
