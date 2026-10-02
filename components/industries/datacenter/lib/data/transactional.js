// GENERATED FILE - DO NOT EDIT BY HAND.
//
// Produced by scripts/import-fsm-workbooks.mjs from
// data-source/DigitalRealty_FSM_PoC_Transactional_Data.xlsx
//
// Every value is carried across exactly as authored. This is client deliverable
// data that gets read back against a Statement of Work, so it is not rounded,
// reformatted or "tidied" on the way in. Edit the workbook and re-run
// `npm run import:fsm`.


export const WORK_ORDERS = [
  {
    "workOrderId": "WO-1001",
    "dateRaised": "2026-09-16",
    "assetId": "IAD35-PUMP-01",
    "siteId": "IAD35",
    "triggerSource": "Condition-Based Alert",
    "alertId": "ALT-0001",
    "priority": "High",
    "description": "Inspect condenser water pump for imbalance; rebalance/replace impeller as required.",
    "action": "Physical inspection confirmed impeller wear; pump rebalanced under redundant-path MOP.",
    "assignedTo": "Site Engineering",
    "status": "Completed",
    "dateCompleted": "2026-09-18",
    "outcome": "Vibration returned to baseline; no cooling redundancy impact.",
    "feedback": "Confirms vibration sensing detects impeller wear ahead of quarterly PM interval."
  },
  {
    "workOrderId": "WO-1002",
    "dateRaised": "2026-09-20",
    "assetId": "ORD12-UPS-01",
    "siteId": "ORD12",
    "triggerSource": "Condition-Based Alert",
    "alertId": "ALT-0002",
    "priority": "Critical",
    "description": "Investigate and correct thermal hot spot at UPS input terminal.",
    "action": "De-energized redundant module per MOP; found and corrected a loose input lug connection.",
    "assignedTo": "Site Engineering + Electrical Vendor",
    "status": "Completed",
    "dateCompleted": "2026-09-21",
    "outcome": "Thermal signature normalized; avoided potential connection failure on critical load path.",
    "feedback": "Add torque-check/thermal-scan step to UPS quarterly PM checklist."
  },
  {
    "workOrderId": "WO-1003",
    "dateRaised": "2026-09-27",
    "assetId": "LHR10-LVSG-01",
    "siteId": "LHR10",
    "triggerSource": "Condition-Based Alert",
    "alertId": "ALT-0003",
    "priority": "Critical",
    "description": "Investigate ultrasonic arcing signature at LV switchgear breaker connection.",
    "action": "Isolated redundant breaker per MOP; resurfaced degraded contact; verified with follow-up ultrasound scan.",
    "assignedTo": "Site Engineering + Switchgear OEM",
    "status": "Completed",
    "dateCompleted": "2026-09-29",
    "outcome": "Arcing signature eliminated; avoided potential unplanned breaker trip.",
    "feedback": "Validates ultrasound as an earlier leading indicator than annual IR thermography for switchgear."
  },
  {
    "workOrderId": "WO-1004",
    "dateRaised": "2026-10-02",
    "assetId": "FRA15-XFMR-01",
    "siteId": "FRA15",
    "triggerSource": "Condition-Based Alert",
    "alertId": "ALT-0004",
    "priority": "High",
    "description": "Pull oil sample from transformer for dissolved-gas analysis (DGA).",
    "action": "Sample pulled and submitted to accredited lab; results pending.",
    "assignedTo": "Site Engineering",
    "status": "In Progress",
    "dateCompleted": null,
    "outcome": "Pending lab result.",
    "feedback": "Pending - correlation log to be updated on DGA result."
  },
  {
    "workOrderId": "WO-1005",
    "dateRaised": "2026-10-06",
    "assetId": "SIN11-GENS-01",
    "siteId": "SIN11",
    "triggerSource": "Condition-Based Alert",
    "alertId": "ALT-0005",
    "priority": "Medium",
    "description": "Correct minor coupling misalignment on standby generator set.",
    "action": "Alignment corrected during scheduled weekly no-load exercise run (no extra outage window required).",
    "assignedTo": "Site Engineering",
    "status": "Completed",
    "dateCompleted": "2026-10-06",
    "outcome": "Vibration within normal limits on next exercise run.",
    "feedback": "Confirms condition data can be actioned inside existing PM windows at no added risk."
  },
  {
    "workOrderId": "WO-1006",
    "dateRaised": "2026-10-14",
    "assetId": "IAD35-CRAH-01",
    "siteId": "IAD35",
    "triggerSource": "Condition-Based Alert",
    "alertId": "ALT-0007",
    "priority": "Medium",
    "description": "Investigate elevated CRAH fan motor temperature.",
    "action": "Inspected drive belt; found slippage; adjusted tension.",
    "assignedTo": "Site Engineering",
    "status": "Completed",
    "dateCompleted": "2026-10-14",
    "outcome": "Motor temperature normalized.",
    "feedback": "Minor finding; no change to PM interval recommended."
  },
  {
    "workOrderId": "WO-1007",
    "dateRaised": "2026-10-01",
    "assetId": "LHR10-UPS-01",
    "siteId": "LHR10",
    "triggerSource": "Calendar PM (PM-UPS-02)",
    "alertId": null,
    "priority": "Scheduled",
    "description": "Annual UPS battery string load/impedance test.",
    "action": "Load/impedance test performed on all strings per IEEE 450.",
    "assignedTo": "Site Engineering + Battery Vendor",
    "status": "Completed",
    "dateCompleted": "2026-10-01",
    "outcome": "All strings within OEM specification.",
    "feedback": "Baseline PM unaffected by PoC, per SOW Section 2.2."
  },
  {
    "workOrderId": "WO-1008",
    "dateRaised": "2026-09-24",
    "assetId": "ORD12-DRYC-01",
    "siteId": "ORD12",
    "triggerSource": "Reactive (Operator Reported)",
    "alertId": null,
    "priority": "Medium",
    "description": "Investigate unusual noise reported by operations during rounds.",
    "action": "Found loose access-panel fastener; tightened; no mechanical fault found.",
    "assignedTo": "Site Engineering",
    "status": "Completed",
    "dateCompleted": "2026-09-24",
    "outcome": "No further finding.",
    "feedback": "Illustrates a reactive work order outside the condition-monitoring pilot for comparison."
  }
]

export const ALERTS = [
  {
    "alertId": "ALT-0001",
    "timestamp": "2026-09-15 11:40",
    "assetId": "IAD35-PUMP-01",
    "siteId": "IAD35",
    "source": "Vibration Sensor",
    "failureCode": "V03",
    "severity": "High",
    "description": "Rising vibration amplitude at 1x running speed, trending above baseline over 5 days.",
    "reviewOutcome": "Engineering confirmed trend consistent with rotor imbalance signature.",
    "validated": "Yes",
    "status": "Closed - Resolved",
    "workOrderId": "WO-1001",
    "classification": "True Positive"
  },
  {
    "alertId": "ALT-0002",
    "timestamp": "2026-09-20 14:02",
    "assetId": "ORD12-UPS-01",
    "siteId": "ORD12",
    "source": "Thermal Sensor",
    "failureCode": "T01",
    "severity": "Critical",
    "description": "Localized hot spot at UPS input terminal, +22 degC delta-T vs. baseline.",
    "reviewOutcome": "Engineering escalated immediately given critical load path.",
    "validated": "Yes",
    "status": "Closed - Resolved",
    "workOrderId": "WO-1002",
    "classification": "True Positive"
  },
  {
    "alertId": "ALT-0003",
    "timestamp": "2026-09-27 03:18",
    "assetId": "LHR10-LVSG-01",
    "siteId": "LHR10",
    "source": "Ultrasound Sensor",
    "failureCode": "U02",
    "severity": "Critical",
    "description": "Ultrasonic acoustic signature consistent with early-stage arcing at breaker cable connection.",
    "reviewOutcome": "Engineering treated as urgent; redundant path confirmed available before action.",
    "validated": "Yes",
    "status": "Closed - Resolved",
    "workOrderId": "WO-1003",
    "classification": "True Positive"
  },
  {
    "alertId": "ALT-0004",
    "timestamp": "2026-10-02 09:05",
    "assetId": "FRA15-XFMR-01",
    "siteId": "FRA15",
    "source": "Thermal Sensor",
    "failureCode": "T04",
    "severity": "High",
    "description": "Gradual winding temperature rise beyond seasonal load-adjusted baseline.",
    "reviewOutcome": "Engineering requested oil sample and dissolved-gas analysis (DGA).",
    "validated": "Pending Lab Result",
    "status": "Under Investigation",
    "workOrderId": "WO-1004",
    "classification": "Pending"
  },
  {
    "alertId": "ALT-0005",
    "timestamp": "2026-10-05 16:44",
    "assetId": "SIN11-GENS-01",
    "siteId": "SIN11",
    "source": "Vibration Sensor",
    "failureCode": "V02",
    "severity": "Medium",
    "description": "Vibration signature consistent with minor coupling misalignment during weekly exercise run.",
    "reviewOutcome": "Engineering scheduled correction at next planned no-load run window.",
    "validated": "Yes",
    "status": "Closed - Resolved",
    "workOrderId": "WO-1005",
    "classification": "True Positive"
  },
  {
    "alertId": "ALT-0006",
    "timestamp": "2026-10-09 12:30",
    "assetId": "SYD12-CHIL-01",
    "siteId": "SYD12",
    "source": "Vibration Sensor",
    "failureCode": "V05",
    "severity": "Medium",
    "description": "Intermittent broadband vibration flagged as possible cavitation.",
    "reviewOutcome": "Physical inspection found no cavitation indicators; noise traced to an adjacent control valve.",
    "validated": "No",
    "status": "Closed - False Positive",
    "workOrderId": null,
    "classification": "False Positive"
  },
  {
    "alertId": "ALT-0007",
    "timestamp": "2026-10-14 08:12",
    "assetId": "IAD35-CRAH-01",
    "siteId": "IAD35",
    "source": "Thermal Sensor",
    "failureCode": "T05",
    "severity": "Medium",
    "description": "Fan motor casing temperature trending above baseline.",
    "reviewOutcome": "Engineering suspected belt slippage; scheduled inspection.",
    "validated": "Yes",
    "status": "Closed - Resolved",
    "workOrderId": "WO-1006",
    "classification": "True Positive"
  },
  {
    "alertId": "ALT-0008",
    "timestamp": "2026-10-18 19:55",
    "assetId": "ORD12-PDU-01",
    "siteId": "ORD12",
    "source": "Ultrasound Sensor",
    "failureCode": "U02",
    "severity": "Low",
    "description": "Low-level ultrasonic activity detected near PDU output breaker; below alarm threshold.",
    "reviewOutcome": "Queued for routine engineering review; not yet inspected.",
    "validated": "Not Yet Reviewed",
    "status": "Open",
    "workOrderId": null,
    "classification": "Pending"
  }
]

export const READINGS = [
  {
    "readingId": "RDG-0001",
    "timestamp": "2026-09-08 09:15",
    "assetId": "IAD35-PUMP-01",
    "sensorType": "Vibration",
    "value": "2.1",
    "unit": "mm/s RMS",
    "threshold": "Alarm > 4.5 mm/s RMS",
    "status": "Normal",
    "alertId": null
  },
  {
    "readingId": "RDG-0002",
    "timestamp": "2026-09-15 11:40",
    "assetId": "IAD35-PUMP-01",
    "sensorType": "Vibration",
    "value": "5.8",
    "unit": "mm/s RMS",
    "threshold": "Alarm > 4.5 mm/s RMS",
    "status": "Alarm",
    "alertId": "ALT-0001"
  },
  {
    "readingId": "RDG-0003",
    "timestamp": "2026-09-18 15:00",
    "assetId": "IAD35-PUMP-01",
    "sensorType": "Vibration",
    "value": "2.4",
    "unit": "mm/s RMS",
    "threshold": "Alarm > 4.5 mm/s RMS",
    "status": "Normal (post-repair)",
    "alertId": null
  },
  {
    "readingId": "RDG-0004",
    "timestamp": "2026-09-12 14:00",
    "assetId": "ORD12-UPS-01",
    "sensorType": "Thermal",
    "value": "46",
    "unit": "degC (baseline 44 degC)",
    "threshold": "Warning > +15 degC delta-T",
    "status": "Normal",
    "alertId": null
  },
  {
    "readingId": "RDG-0005",
    "timestamp": "2026-09-20 14:02",
    "assetId": "ORD12-UPS-01",
    "sensorType": "Thermal",
    "value": "68",
    "unit": "degC (baseline 44 degC)",
    "threshold": "Warning > +15 degC delta-T",
    "status": "Alarm",
    "alertId": "ALT-0002"
  },
  {
    "readingId": "RDG-0006",
    "timestamp": "2026-09-21 18:00",
    "assetId": "ORD12-UPS-01",
    "sensorType": "Thermal",
    "value": "45",
    "unit": "degC (post-repair)",
    "threshold": "Warning > +15 degC delta-T",
    "status": "Normal (post-repair)",
    "alertId": null
  },
  {
    "readingId": "RDG-0007",
    "timestamp": "2026-09-27 03:18",
    "assetId": "LHR10-LVSG-01",
    "sensorType": "Ultrasound",
    "value": "41",
    "unit": "dB uV",
    "threshold": "Alarm > 38 dB uV",
    "status": "Alarm",
    "alertId": "ALT-0003"
  },
  {
    "readingId": "RDG-0008",
    "timestamp": "2026-09-29 10:00",
    "assetId": "LHR10-LVSG-01",
    "sensorType": "Ultrasound",
    "value": "18",
    "unit": "dB uV (post-repair)",
    "threshold": "Alarm > 38 dB uV",
    "status": "Normal (post-repair)",
    "alertId": null
  },
  {
    "readingId": "RDG-0009",
    "timestamp": "2026-10-02 09:05",
    "assetId": "FRA15-XFMR-01",
    "sensorType": "Thermal",
    "value": "79",
    "unit": "degC winding (baseline 61 degC)",
    "threshold": "Warning > +15 degC delta-T",
    "status": "Warning",
    "alertId": "ALT-0004"
  },
  {
    "readingId": "RDG-0010",
    "timestamp": "2026-10-05 16:44",
    "assetId": "SIN11-GENS-01",
    "sensorType": "Vibration",
    "value": "3.9",
    "unit": "mm/s RMS",
    "threshold": "Warning > 3.5 mm/s RMS",
    "status": "Warning",
    "alertId": "ALT-0005"
  },
  {
    "readingId": "RDG-0011",
    "timestamp": "2026-10-06 09:00",
    "assetId": "SIN11-GENS-01",
    "sensorType": "Vibration",
    "value": "1.8",
    "unit": "mm/s RMS (post-repair)",
    "threshold": "Warning > 3.5 mm/s RMS",
    "status": "Normal (post-repair)",
    "alertId": null
  },
  {
    "readingId": "RDG-0012",
    "timestamp": "2026-10-09 12:30",
    "assetId": "SYD12-CHIL-01",
    "sensorType": "Vibration",
    "value": "3.6",
    "unit": "mm/s RMS",
    "threshold": "Warning > 3.5 mm/s RMS",
    "status": "Warning",
    "alertId": "ALT-0006"
  },
  {
    "readingId": "RDG-0013",
    "timestamp": "2026-10-14 08:12",
    "assetId": "IAD35-CRAH-01",
    "sensorType": "Thermal",
    "value": "58",
    "unit": "degC motor casing (baseline 47 degC)",
    "threshold": "Warning > +10 degC delta-T",
    "status": "Warning",
    "alertId": "ALT-0007"
  },
  {
    "readingId": "RDG-0014",
    "timestamp": "2026-10-18 19:55",
    "assetId": "ORD12-PDU-01",
    "sensorType": "Ultrasound",
    "value": "24",
    "unit": "dB uV",
    "threshold": "Alarm > 38 dB uV",
    "status": "Elevated (below alarm)",
    "alertId": "ALT-0008"
  }
]

export const BMS = [
  {
    "readingId": "BMS-0001",
    "timestamp": "2026-09-01 08:00",
    "siteId": "IAD35",
    "locationId": "IAD35-DHPOC",
    "assetId": "IAD35-CRAH-01",
    "point": "Supply Air Temperature",
    "value": "18.2",
    "unit": "degC",
    "status": "Normal",
    "alertId": null
  },
  {
    "readingId": "BMS-0002",
    "timestamp": "2026-09-01 08:00",
    "siteId": "IAD35",
    "locationId": "IAD35-DHPOC",
    "assetId": "N/A (hall average)",
    "point": "Return Air Temperature",
    "value": "24.5",
    "unit": "degC",
    "status": "Normal",
    "alertId": null
  },
  {
    "readingId": "BMS-0003",
    "timestamp": "2026-09-01 08:00",
    "siteId": "IAD35",
    "locationId": "IAD35-DHPOC",
    "assetId": "N/A (hall average)",
    "point": "Relative Humidity",
    "value": "45",
    "unit": "%RH",
    "status": "Normal",
    "alertId": null
  },
  {
    "readingId": "BMS-0004",
    "timestamp": "2026-09-05 09:00",
    "siteId": "ORD12",
    "locationId": "ORD12-DHPOC",
    "assetId": "N/A (hall average)",
    "point": "Return Air Temperature",
    "value": "23.9",
    "unit": "degC",
    "status": "Normal",
    "alertId": null
  },
  {
    "readingId": "BMS-0005",
    "timestamp": "2026-09-10 10:00",
    "siteId": "LHR10",
    "locationId": "LHR10-DHPOC",
    "assetId": "N/A (hall average)",
    "point": "Chilled Water Valve Position",
    "value": "62",
    "unit": "%Open",
    "status": "Normal",
    "alertId": null
  },
  {
    "readingId": "BMS-0006",
    "timestamp": "2026-09-15 11:00",
    "siteId": "FRA15",
    "locationId": "FRA15-DHPOC",
    "assetId": "N/A (hall average)",
    "point": "Return Air Temperature",
    "value": "24.1",
    "unit": "degC",
    "status": "Normal",
    "alertId": null
  },
  {
    "readingId": "BMS-0007",
    "timestamp": "2026-09-20 12:00",
    "siteId": "SIN11",
    "locationId": "SIN11-DHPOC",
    "assetId": "N/A (hall average)",
    "point": "Relative Humidity",
    "value": "48",
    "unit": "%RH",
    "status": "Normal",
    "alertId": null
  },
  {
    "readingId": "BMS-0008",
    "timestamp": "2026-09-25 13:00",
    "siteId": "SYD12",
    "locationId": "SYD12-DHPOC",
    "assetId": "SYD12-CRAH-01",
    "point": "Supply Air Temperature",
    "value": "18.0",
    "unit": "degC",
    "status": "Normal",
    "alertId": null
  },
  {
    "readingId": "BMS-0009",
    "timestamp": "2026-10-14 08:00",
    "siteId": "IAD35",
    "locationId": "IAD35-DHPOC",
    "assetId": "IAD35-CRAH-01",
    "point": "Supply Air Temperature",
    "value": "19.8",
    "unit": "degC",
    "status": "Warning - elevated",
    "alertId": "ALT-0007"
  },
  {
    "readingId": "BMS-0010",
    "timestamp": "2026-10-14 08:05",
    "siteId": "IAD35",
    "locationId": "IAD35-DHPOC",
    "assetId": "IAD35-CRAH-01",
    "point": "Fan Motor Damper Position",
    "value": "88",
    "unit": "%Open (compensating)",
    "status": "Warning",
    "alertId": "ALT-0007"
  },
  {
    "readingId": "BMS-0011",
    "timestamp": "2026-10-18 07:00",
    "siteId": "IAD35",
    "locationId": "IAD35-DHPOC",
    "assetId": "IAD35-CRAH-01",
    "point": "Supply Air Temperature",
    "value": "18.3",
    "unit": "degC (post-repair)",
    "status": "Normal (post-repair)",
    "alertId": null
  },
  {
    "readingId": "BMS-0012",
    "timestamp": "2026-11-01 09:00",
    "siteId": "ORD12",
    "locationId": "ORD12-DHPOC",
    "assetId": "N/A (hall average)",
    "point": "Return Air Temperature",
    "value": "23.7",
    "unit": "degC",
    "status": "Normal",
    "alertId": null
  }
]

export const EPMS = [
  {
    "readingId": "EPMS-0001",
    "timestamp": "2026-09-01 00:00",
    "siteId": "LHR10",
    "assetId": "LHR10-LVSG-01",
    "point": "Bus Voltage L-L",
    "value": "415",
    "unit": "V",
    "status": "Normal",
    "alertId": null
  },
  {
    "readingId": "EPMS-0002",
    "timestamp": "2026-09-27 03:14",
    "siteId": "LHR10",
    "assetId": "LHR10-LVSG-01",
    "point": "Harmonic Distortion (THD)",
    "value": "4.8",
    "unit": "%THD",
    "status": "Warning",
    "alertId": "ALT-0003"
  },
  {
    "readingId": "EPMS-0003",
    "timestamp": "2026-09-27 03:15",
    "siteId": "LHR10",
    "assetId": "LHR10-LVSG-01",
    "point": "Ground Fault Current (Pre-Alarm)",
    "value": "2.4",
    "unit": "A",
    "status": "Warning - precedes alert by 3 min",
    "alertId": "ALT-0003"
  },
  {
    "readingId": "EPMS-0004",
    "timestamp": "2026-09-27 03:20",
    "siteId": "LHR10",
    "assetId": "LHR10-LVSG-01",
    "point": "Breaker Status",
    "value": "Closed - No Trip",
    "unit": "-",
    "status": "Normal (redundant path held)",
    "alertId": "ALT-0003"
  },
  {
    "readingId": "EPMS-0005",
    "timestamp": "2026-09-05 06:00",
    "siteId": "FRA15",
    "assetId": "FRA15-XFMR-01",
    "point": "Load",
    "value": "68",
    "unit": "%Rated",
    "status": "Normal",
    "alertId": null
  },
  {
    "readingId": "EPMS-0006",
    "timestamp": "2026-10-02 09:00",
    "siteId": "FRA15",
    "assetId": "FRA15-XFMR-01",
    "point": "Load",
    "value": "74",
    "unit": "%Rated",
    "status": "Normal (context for thermal alert)",
    "alertId": "ALT-0004"
  },
  {
    "readingId": "EPMS-0007",
    "timestamp": "2026-09-10 07:00",
    "siteId": "ORD12",
    "assetId": "ORD12-UPS-01",
    "point": "Output Current",
    "value": "820",
    "unit": "A",
    "status": "Normal",
    "alertId": null
  },
  {
    "readingId": "EPMS-0008",
    "timestamp": "2026-09-20 14:00",
    "siteId": "ORD12",
    "assetId": "ORD12-UPS-01",
    "point": "Input Terminal Voltage Imbalance",
    "value": "3.1",
    "unit": "%",
    "status": "Warning",
    "alertId": "ALT-0002"
  },
  {
    "readingId": "EPMS-0009",
    "timestamp": "2026-09-21 18:00",
    "siteId": "ORD12",
    "assetId": "ORD12-UPS-01",
    "point": "Input Terminal Voltage Imbalance",
    "value": "0.4",
    "unit": "% (post-repair)",
    "status": "Normal (post-repair)",
    "alertId": null
  },
  {
    "readingId": "EPMS-0010",
    "timestamp": "2026-09-12 08:00",
    "siteId": "ORD12",
    "assetId": "ORD12-PDU-01",
    "point": "Branch Circuit Load",
    "value": "58",
    "unit": "%Rated",
    "status": "Normal",
    "alertId": null
  },
  {
    "readingId": "EPMS-0011",
    "timestamp": "2026-09-15 10:00",
    "siteId": "IAD35",
    "assetId": "IAD35-CHIL-01",
    "point": "Motor Current",
    "value": "210",
    "unit": "A",
    "status": "Normal",
    "alertId": null
  },
  {
    "readingId": "EPMS-0012",
    "timestamp": "2026-09-20 11:00",
    "siteId": "SIN11",
    "assetId": "SIN11-HVSG-01",
    "point": "Bus Voltage",
    "value": "11",
    "unit": "kV",
    "status": "Normal",
    "alertId": null
  },
  {
    "readingId": "EPMS-0013",
    "timestamp": "2026-09-25 12:00",
    "siteId": "SYD12",
    "assetId": "SYD12-GENS-01",
    "point": "Standby Generator Output",
    "value": "0",
    "unit": "kW (standby)",
    "status": "Normal",
    "alertId": null
  },
  {
    "readingId": "EPMS-0014",
    "timestamp": "2026-11-01 09:00",
    "siteId": "FRA15",
    "assetId": "FRA15-LVSG-01",
    "point": "Bus Voltage L-L",
    "value": "400",
    "unit": "V",
    "status": "Normal",
    "alertId": null
  }
]

export const DCIM = [
  {
    "readingId": "DCIM-0001",
    "date": "2026-09-01",
    "siteId": "IAD35",
    "metric": "PUE (trailing 30-day)",
    "value": "1.42",
    "unit": "ratio",
    "trend": "Stable"
  },
  {
    "readingId": "DCIM-0002",
    "date": "2026-09-01",
    "siteId": "IAD35",
    "metric": "Power Capacity Headroom",
    "value": "22",
    "unit": "% of design",
    "trend": "Adequate for N+1"
  },
  {
    "readingId": "DCIM-0003",
    "date": "2026-09-01",
    "siteId": "ORD12",
    "metric": "PUE (trailing 30-day)",
    "value": "1.48",
    "unit": "ratio",
    "trend": "Stable"
  },
  {
    "readingId": "DCIM-0004",
    "date": "2026-09-01",
    "siteId": "ORD12",
    "metric": "Cooling Capacity Headroom",
    "value": "18",
    "unit": "% of design",
    "trend": "Adequate for N+1"
  },
  {
    "readingId": "DCIM-0005",
    "date": "2026-09-01",
    "siteId": "LHR10",
    "metric": "PUE (trailing 30-day)",
    "value": "1.35",
    "unit": "ratio",
    "trend": "Stable (2N site)"
  },
  {
    "readingId": "DCIM-0006",
    "date": "2026-09-01",
    "siteId": "LHR10",
    "metric": "Power Capacity Headroom",
    "value": "45",
    "unit": "% of design",
    "trend": "Adequate for 2N"
  },
  {
    "readingId": "DCIM-0007",
    "date": "2026-09-01",
    "siteId": "FRA15",
    "metric": "PUE (trailing 30-day)",
    "value": "1.31",
    "unit": "ratio",
    "trend": "Stable (2N site)"
  },
  {
    "readingId": "DCIM-0008",
    "date": "2026-09-01",
    "siteId": "FRA15",
    "metric": "Power Capacity Headroom",
    "value": "41",
    "unit": "% of design",
    "trend": "Adequate for 2N"
  },
  {
    "readingId": "DCIM-0009",
    "date": "2026-09-01",
    "siteId": "SIN11",
    "metric": "PUE (trailing 30-day)",
    "value": "1.52",
    "unit": "ratio",
    "trend": "Stable (tropical climate)"
  },
  {
    "readingId": "DCIM-0010",
    "date": "2026-09-01",
    "siteId": "SIN11",
    "metric": "Cooling Capacity Headroom",
    "value": "15",
    "unit": "% of design",
    "trend": "Watch - trending down"
  },
  {
    "readingId": "DCIM-0011",
    "date": "2026-09-01",
    "siteId": "SYD12",
    "metric": "PUE (trailing 30-day)",
    "value": "1.39",
    "unit": "ratio",
    "trend": "Stable"
  },
  {
    "readingId": "DCIM-0012",
    "date": "2026-11-01",
    "siteId": "IAD35",
    "metric": "PUE (trailing 30-day)",
    "value": "1.40",
    "unit": "ratio",
    "trend": "Improved vs. September baseline"
  }
]

export const OEM = [
  {
    "readingId": "OEM-0001",
    "timestamp": "2026-09-10 07:00",
    "siteId": "ORD12",
    "assetId": "ORD12-UPS-01",
    "platform": "Vertiv LIFE Services",
    "indicator": "Module Health Score",
    "value": "90/100",
    "status": "Normal",
    "alertId": null
  },
  {
    "readingId": "OEM-0002",
    "timestamp": "2026-09-20 14:00",
    "siteId": "ORD12",
    "assetId": "ORD12-UPS-01",
    "platform": "Vertiv LIFE Services",
    "indicator": "Module Health Score",
    "value": "92/100",
    "status": "Normal",
    "alertId": null
  },
  {
    "readingId": "OEM-0003",
    "timestamp": "2026-09-20 14:02",
    "siteId": "ORD12",
    "assetId": "ORD12-UPS-01",
    "platform": "Vertiv LIFE Services",
    "indicator": "Remote Diagnostic Alert",
    "value": "Input terminal thermal anomaly flagged",
    "status": "Warning",
    "alertId": "ALT-0002"
  },
  {
    "readingId": "OEM-0004",
    "timestamp": "2026-10-01 09:00",
    "siteId": "LHR10",
    "assetId": "LHR10-UPS-01",
    "platform": "Vertiv LIFE Services",
    "indicator": "Battery String Health Score",
    "value": "88/100",
    "status": "Normal",
    "alertId": null
  },
  {
    "readingId": "OEM-0005",
    "timestamp": "2026-10-05 16:44",
    "siteId": "SIN11",
    "assetId": "SIN11-GENS-01",
    "platform": "Cummins PowerCommand Cloud",
    "indicator": "Vibration Advisory",
    "value": "Minor coupling misalignment flagged",
    "status": "Warning",
    "alertId": "ALT-0005"
  },
  {
    "readingId": "OEM-0006",
    "timestamp": "2026-10-06 09:00",
    "siteId": "SIN11",
    "assetId": "SIN11-GENS-01",
    "platform": "Cummins PowerCommand Cloud",
    "indicator": "Engine Health Score",
    "value": "96/100 (post-repair)",
    "status": "Normal (post-repair)",
    "alertId": null
  },
  {
    "readingId": "OEM-0007",
    "timestamp": "2026-10-30 07:00",
    "siteId": "FRA15",
    "assetId": "FRA15-GENS-01",
    "platform": "MTU / Rolls-Royce ONCall",
    "indicator": "Engine Health Score",
    "value": "94/100",
    "status": "Normal",
    "alertId": null
  },
  {
    "readingId": "OEM-0008",
    "timestamp": "2026-09-15 10:00",
    "siteId": "IAD35",
    "assetId": "IAD35-CHIL-01",
    "platform": "Trane Intelligent Services",
    "indicator": "Refrigeration Circuit Health Score",
    "value": "91/100",
    "status": "Normal",
    "alertId": null
  },
  {
    "readingId": "OEM-0009",
    "timestamp": "2026-11-01 08:00",
    "siteId": "SYD12",
    "assetId": "SYD12-GENS-01",
    "platform": "Caterpillar VisionLink",
    "indicator": "Fuel System Advisory",
    "value": "Routine filter change due",
    "status": "Info",
    "alertId": null
  }
]

export const BATTERY = [
  {
    "readingId": "BAT-0001",
    "timestamp": "2026-09-10 07:00",
    "siteId": "ORD12",
    "assetId": "ORD12-UPS-01",
    "cellRef": "String 1 - Cell 08",
    "cellVoltage": "2.24",
    "internalResistance": "0.98",
    "temperature": "23",
    "stateOfHealth": "97",
    "status": "Normal"
  },
  {
    "readingId": "BAT-0002",
    "timestamp": "2026-10-01 06:00",
    "siteId": "LHR10",
    "assetId": "LHR10-UPS-01",
    "cellRef": "String 1 - Cell 14",
    "cellVoltage": "2.23",
    "internalResistance": "1.05",
    "temperature": "24",
    "stateOfHealth": "96",
    "status": "Normal"
  },
  {
    "readingId": "BAT-0003",
    "timestamp": "2026-10-01 06:00",
    "siteId": "LHR10",
    "assetId": "LHR10-UPS-01",
    "cellRef": "String 2 - Cell 22",
    "cellVoltage": "2.18",
    "internalResistance": "1.42",
    "temperature": "25",
    "stateOfHealth": "89",
    "status": "Watch - trending"
  },
  {
    "readingId": "BAT-0004",
    "timestamp": "2026-10-15 09:00",
    "siteId": "LHR10",
    "assetId": "LHR10-UPS-01",
    "cellRef": "String 2 - Cell 22",
    "cellVoltage": "2.15",
    "internalResistance": "1.55",
    "temperature": "25",
    "stateOfHealth": "86",
    "status": "Warning - added to PM watch list"
  },
  {
    "readingId": "BAT-0005",
    "timestamp": "2026-09-20 12:00",
    "siteId": "SIN11",
    "assetId": "SIN11-BAT-01",
    "cellRef": "Standby Battery Bank - String 1",
    "cellVoltage": "2.20",
    "internalResistance": "1.10",
    "temperature": "27",
    "stateOfHealth": "94",
    "status": "Normal"
  },
  {
    "readingId": "BAT-0006",
    "timestamp": "2026-11-01 08:00",
    "siteId": "SIN11",
    "assetId": "SIN11-BAT-01",
    "cellRef": "Standby Battery Bank - String 2",
    "cellVoltage": "2.19",
    "internalResistance": "1.15",
    "temperature": "27",
    "stateOfHealth": "93",
    "status": "Normal"
  },
  {
    "readingId": "BAT-0007",
    "timestamp": "2026-09-25 13:00",
    "siteId": "SYD12",
    "assetId": "SYD12-BAT-01",
    "cellRef": "Standby Battery Bank - String 1",
    "cellVoltage": "2.22",
    "internalResistance": "1.02",
    "temperature": "22",
    "stateOfHealth": "95",
    "status": "Normal"
  },
  {
    "readingId": "BAT-0008",
    "timestamp": "2026-11-15 06:00",
    "siteId": "ORD12",
    "assetId": "ORD12-UPS-01",
    "cellRef": "String 1 - Cell 08",
    "cellVoltage": "2.23",
    "internalResistance": "1.01",
    "temperature": "23",
    "stateOfHealth": "96",
    "status": "Normal"
  }
]

export const CORRELATIONS = [
  {
    "correlationId": "COR-001",
    "alertId": "ALT-0001",
    "assetId": "IAD35-PUMP-01",
    "inspectionDate": "2026-09-17",
    "finding": "Impeller wear consistent with the V03 imbalance vibration signature.",
    "confirmed": "Yes",
    "failureMode": "V03 - Imbalance",
    "leadTime": "18 days ahead of the next scheduled quarterly pump PM",
    "insight": "Consider a condition-triggered PM interval for high-duty condenser water pumps."
  },
  {
    "correlationId": "COR-002",
    "alertId": "ALT-0002",
    "assetId": "ORD12-UPS-01",
    "inspectionDate": "2026-09-20",
    "finding": "Loose input terminal lug confirmed as heat source.",
    "confirmed": "Yes",
    "failureMode": "T01 - Loose Electrical Connection",
    "leadTime": "Detected before visible insulation damage or trip event",
    "insight": "Add a thermal-scan checkpoint to the UPS quarterly PM checklist (PM-UPS-01)."
  },
  {
    "correlationId": "COR-003",
    "alertId": "ALT-0003",
    "assetId": "LHR10-LVSG-01",
    "inspectionDate": "2026-09-28",
    "finding": "Early-stage arcing confirmed at breaker cable lug; contact resurfaced.",
    "confirmed": "Yes",
    "failureMode": "U02 - Arcing",
    "leadTime": "Approx. 9 months ahead of next annual IR thermography scan (PM-LVSG-01)",
    "insight": "Ultrasound shows earlier lead time than annual IR scanning for LV switchgear connections."
  },
  {
    "correlationId": "COR-004",
    "alertId": "ALT-0004",
    "assetId": "FRA15-XFMR-01",
    "inspectionDate": "Pending",
    "finding": "Pending dissolved-gas analysis (DGA) lab result.",
    "confirmed": "Pending",
    "failureMode": "T04 - Insulation Degradation (suspected)",
    "leadTime": "TBD",
    "insight": "To be updated once DGA result is received."
  },
  {
    "correlationId": "COR-005",
    "alertId": "ALT-0005",
    "assetId": "SIN11-GENS-01",
    "inspectionDate": "2026-10-06",
    "finding": "Minor coupling misalignment confirmed and corrected during routine exercise run.",
    "confirmed": "Yes",
    "failureMode": "V02 - Misalignment",
    "leadTime": "Corrected proactively; no unplanned outage risk incurred",
    "insight": "Condition data actioned inside existing PM windows at no added operational risk."
  },
  {
    "correlationId": "COR-006",
    "alertId": "ALT-0006",
    "assetId": "SYD12-CHIL-01",
    "inspectionDate": "2026-10-10",
    "finding": "No cavitation found; noise traced to an adjacent control valve, not the chiller.",
    "confirmed": "No",
    "failureMode": "N/A - False Positive",
    "leadTime": null,
    "insight": "Refine vibration sensor placement/threshold near high-flow valves to reduce false positives."
  },
  {
    "correlationId": "COR-007",
    "alertId": "ALT-0007",
    "assetId": "IAD35-CRAH-01",
    "inspectionDate": "2026-10-14",
    "finding": "Fan drive belt slippage confirmed and adjusted.",
    "confirmed": "Yes",
    "failureMode": "T05 - Motor Overheating (secondary cause: belt slippage)",
    "leadTime": "Detected within normal monthly filter/belt PM window",
    "insight": "Minor finding; no PM interval change recommended for this asset class."
  }
]

export const KPI_ACTUALS = [
  {
    "kpiId": "KPI-T01",
    "group": "Technical",
    "kpi": "Sensor Availability",
    "target": "~90-100%",
    "actual": 0.945,
    "statusVsTarget": "On Target",
    "computedFrom": "Weekly Health Report Log - Sensor Availability %"
  },
  {
    "kpiId": "KPI-T02",
    "group": "Technical",
    "kpi": "Data Acquisition Reliability",
    "target": "~90-100%",
    "actual": 0.95625,
    "statusVsTarget": "On Target",
    "computedFrom": "Weekly Health Report Log - Data Acquisition Reliability %"
  },
  {
    "kpiId": "KPI-T03",
    "group": "Technical",
    "kpi": "Alert Accuracy",
    "target": "~70-80%",
    "actual": 0.8333333333333334,
    "statusVsTarget": "Above Target (favorable)",
    "computedFrom": "Alert & Anomaly Register - Alert Classification"
  },
  {
    "kpiId": "KPI-T04",
    "group": "Technical",
    "kpi": "False Positive Rate",
    "target": "~10-20%",
    "actual": 0.16666666666666666,
    "statusVsTarget": "On Target",
    "computedFrom": "Alert & Anomaly Register - Alert Classification"
  },
  {
    "kpiId": "KPI-T05",
    "group": "Technical",
    "kpi": "Dashboard Availability",
    "target": "~90-100%",
    "actual": 0.97375,
    "statusVsTarget": "On Target",
    "computedFrom": "Weekly Health Report Log - Dashboard Availability %"
  },
  {
    "kpiId": "KPI-O01",
    "group": "Operational",
    "kpi": "Early Fault Detection",
    "target": "Demonstrated",
    "actual": 5,
    "statusVsTarget": "Demonstrated",
    "computedFrom": "Maintenance Correlation Log - Finding Confirmed Anomaly?"
  },
  {
    "kpiId": "KPI-O02",
    "group": "Operational",
    "kpi": "Reduced Unplanned Maintenance Risk",
    "target": "Demonstrated",
    "actual": 3,
    "statusVsTarget": "Demonstrated",
    "computedFrom": "Alert & Anomaly Register - Critical/High True Positives"
  },
  {
    "kpiId": "KPI-O03",
    "group": "Operational",
    "kpi": "Maintenance Optimization Opportunities",
    "target": "Demonstrated",
    "actual": 7,
    "statusVsTarget": "Demonstrated",
    "computedFrom": "Maintenance Correlation Log - review count (see Insight column for detail)"
  },
  {
    "kpiId": "KPI-O04",
    "group": "Operational",
    "kpi": "Condition-Based Interventions",
    "target": "Demonstrated",
    "actual": 5,
    "statusVsTarget": "Demonstrated",
    "computedFrom": "Work Orders - Trigger Source = Condition-Based Alert, Status = Completed"
  },
  {
    "kpiId": "KPI-O05",
    "group": "Operational",
    "kpi": "Business Case for Scale",
    "target": "Developed",
    "actual": 6,
    "statusVsTarget": "Developed",
    "computedFrom": "Benefits Realization Assessment - quantified benefit count"
  }
]

export const BENEFITS = [
  {
    "benefitId": "BEN-001",
    "category": "Reliability",
    "description": "Early detection of switchgear arcing avoided a potential unplanned breaker trip on a Critical-rated LV switchgear asset.",
    "evidence": "COR-003 / WO-1003",
    "impact": "Avoided potential outage on a Critical asset; $ impact to be quantified with Digital Realty's outage-cost model.",
    "basis": "Illustrative - requires Digital Realty incident-cost benchmark"
  },
  {
    "benefitId": "BEN-002",
    "category": "Reliability",
    "description": "Loose UPS input connection corrected before insulation failure on a Critical load path.",
    "evidence": "COR-002 / WO-1002",
    "impact": "Avoided potential critical-load risk event.",
    "basis": "Illustrative - requires Digital Realty incident-cost benchmark"
  },
  {
    "benefitId": "BEN-003",
    "category": "Maintenance Efficiency",
    "description": "Vibration-based detection of pump imbalance found 18 days ahead of the next scheduled quarterly PM.",
    "evidence": "COR-001 / WO-1001",
    "impact": "18-day earlier intervention than calendar-based PM would have provided.",
    "basis": "Basis: PM Task Library task PM-PUMP-01 (Quarterly)"
  },
  {
    "benefitId": "BEN-004",
    "category": "Maintenance Efficiency",
    "description": "Generator coupling misalignment corrected inside an existing PM window at no incremental cost.",
    "evidence": "COR-005 / WO-1005",
    "impact": "Zero incremental maintenance window required.",
    "basis": "Basis: existing PM-GENS-01 weekly no-load exercise run"
  },
  {
    "benefitId": "BEN-005",
    "category": "Analytics Quality",
    "description": "False-positive alert root-caused and used to refine vibration sensor placement/threshold.",
    "evidence": "COR-006",
    "impact": "Expected improvement in future Alert Accuracy (KPI-T03) and False Positive Rate (KPI-T04).",
    "basis": "Feeds ongoing KPI-T03/T04 trend"
  },
  {
    "benefitId": "BEN-006",
    "category": "Business Case",
    "description": "3 of 8 sample alerts (37.5%) were Critical-severity true positives on assets with no built-in redundancy margin (switchgear, UPS, transformer) - the segment most likely to justify global scale-up.",
    "evidence": "ALT-0002, ALT-0003, ALT-0004",
    "impact": "Indicative only; to be validated against the full 12-month PoC dataset.",
    "basis": "Feeds Section 12 Go/No-Go recommendation"
  }
]

export const PM_COMPLIANCE = [
  {
    "logId": "PMC-001",
    "taskId": "PM-CRAH-01",
    "assetId": "IAD35-CRAH-01",
    "scheduledDate": "2026-09-01",
    "completedDate": "2026-09-01",
    "status": "Completed On Time",
    "team": "Site Engineering"
  },
  {
    "logId": "PMC-002",
    "taskId": "PM-CHIL-01",
    "assetId": "IAD35-CHIL-01",
    "scheduledDate": "2026-09-15",
    "completedDate": "2026-09-18",
    "status": "Completed Late",
    "team": "Chiller OEM Vendor"
  },
  {
    "logId": "PMC-003",
    "taskId": "PM-UPS-01",
    "assetId": "ORD12-UPS-01",
    "scheduledDate": "2026-09-10",
    "completedDate": "2026-09-10",
    "status": "Completed On Time",
    "team": "Site Engineering"
  },
  {
    "logId": "PMC-004",
    "taskId": "PM-UPS-02",
    "assetId": "LHR10-UPS-01",
    "scheduledDate": "2026-10-01",
    "completedDate": "2026-10-01",
    "status": "Completed On Time",
    "team": "Site Engineering + Battery Vendor"
  },
  {
    "logId": "PMC-005",
    "taskId": "PM-LVSG-01",
    "assetId": "LHR10-LVSG-01",
    "scheduledDate": "2026-11-15",
    "completedDate": null,
    "status": "Scheduled",
    "team": "Switchgear OEM"
  },
  {
    "logId": "PMC-006",
    "taskId": "PM-XFMR-01",
    "assetId": "FRA15-XFMR-01",
    "scheduledDate": "2026-10-20",
    "completedDate": null,
    "status": "Scheduled (Advanced due to ALT-0004)",
    "team": "Site Engineering"
  },
  {
    "logId": "PMC-007",
    "taskId": "PM-GENS-01",
    "assetId": "SIN11-GENS-01",
    "scheduledDate": "2026-10-06",
    "completedDate": "2026-10-06",
    "status": "Completed On Time",
    "team": "Site Engineering"
  },
  {
    "logId": "PMC-008",
    "taskId": "PM-GENS-02",
    "assetId": "SYD12-GENS-01",
    "scheduledDate": "2026-11-01",
    "completedDate": null,
    "status": "Scheduled",
    "team": "Generator OEM"
  },
  {
    "logId": "PMC-009",
    "taskId": "PM-CRAH-02",
    "assetId": "SYD12-CRAH-01",
    "scheduledDate": "2026-09-30",
    "completedDate": "2026-10-05",
    "status": "Completed Late",
    "team": "Site Engineering"
  },
  {
    "logId": "PMC-010",
    "taskId": "PM-PDU-01",
    "assetId": "ORD12-PDU-01",
    "scheduledDate": "2026-12-01",
    "completedDate": null,
    "status": "Scheduled",
    "team": "Site Engineering"
  }
]

export const WEEKLY_HEALTH = [
  {
    "reportId": "WHR-01",
    "weekEnding": "2026-09-05",
    "cadence": "Weekly",
    "sensorAvailability": 0.88,
    "dataReliability": 0.91,
    "dashboardAvailability": 0.95,
    "openAlerts": 0,
    "alertsClosed": 0,
    "workOrdersRaised": 0,
    "observations": "Sensor commissioning in progress across all 6 sites; baselining under way.",
    "preparedBy": "Vendor PoC Lead"
  },
  {
    "reportId": "WHR-02",
    "weekEnding": "2026-09-12",
    "cadence": "Weekly",
    "sensorAvailability": 0.93,
    "dataReliability": 0.95,
    "dashboardAvailability": 0.97,
    "openAlerts": 0,
    "alertsClosed": 0,
    "workOrdersRaised": 0,
    "observations": "All sites reporting baseline data; no alerts yet generated.",
    "preparedBy": "Vendor PoC Lead"
  },
  {
    "reportId": "WHR-03",
    "weekEnding": "2026-09-19",
    "cadence": "Weekly",
    "sensorAvailability": 0.95,
    "dataReliability": 0.96,
    "dashboardAvailability": 0.98,
    "openAlerts": 2,
    "alertsClosed": 1,
    "workOrdersRaised": 2,
    "observations": "First two condition-based alerts (ALT-0001, ALT-0002) validated and actioned.",
    "preparedBy": "Vendor PoC Lead"
  },
  {
    "reportId": "WHR-04",
    "weekEnding": "2026-09-26",
    "cadence": "Weekly",
    "sensorAvailability": 0.96,
    "dataReliability": 0.97,
    "dashboardAvailability": 0.99,
    "openAlerts": 1,
    "alertsClosed": 2,
    "workOrdersRaised": 1,
    "observations": "ALT-0003 (LV switchgear arcing) closed same week given criticality.",
    "preparedBy": "Vendor PoC Lead"
  },
  {
    "reportId": "WHR-05",
    "weekEnding": "2026-10-03",
    "cadence": "Weekly",
    "sensorAvailability": 0.94,
    "dataReliability": 0.95,
    "dashboardAvailability": 0.96,
    "openAlerts": 2,
    "alertsClosed": 1,
    "workOrdersRaised": 2,
    "observations": "Transformer DGA sample pending lab turnaround; generator alert closed.",
    "preparedBy": "Vendor PoC Lead"
  },
  {
    "reportId": "WHR-06",
    "weekEnding": "2026-10-10",
    "cadence": "Weekly",
    "sensorAvailability": 0.97,
    "dataReliability": 0.97,
    "dashboardAvailability": 0.98,
    "openAlerts": 1,
    "alertsClosed": 1,
    "workOrdersRaised": 1,
    "observations": "First false-positive alert identified and root-caused (ALT-0006); threshold review opened.",
    "preparedBy": "Vendor PoC Lead"
  },
  {
    "reportId": "WHR-07",
    "weekEnding": "2026-10-24",
    "cadence": "Biweekly (transition per SOW 2.1)",
    "sensorAvailability": 0.96,
    "dataReliability": 0.96,
    "dashboardAvailability": 0.97,
    "openAlerts": 1,
    "alertsClosed": 1,
    "workOrdersRaised": 1,
    "observations": "Moved to biweekly cadence as PoC stabilizes; CRAH belt finding closed.",
    "preparedBy": "Vendor PoC Lead"
  },
  {
    "reportId": "WHR-08",
    "weekEnding": "2026-11-07",
    "cadence": "Biweekly",
    "sensorAvailability": 0.97,
    "dataReliability": 0.98,
    "dashboardAvailability": 0.99,
    "openAlerts": 1,
    "alertsClosed": 0,
    "workOrdersRaised": 0,
    "observations": "Stable operation; PDU ultrasound alert queued for routine review.",
    "preparedBy": "Vendor PoC Lead"
  }
]

export const INCIDENTS = [
  {
    "incidentId": "INC-2025-014",
    "date": "2025-03-11",
    "assetId": "ORD12-UPS-01",
    "siteId": "ORD12",
    "description": "UPS module fault on redundant leg; load remained on active module.",
    "rootCause": "Capacitor failure (age-related).",
    "detectionMethod": "BMS Alarm",
    "downtime": "0 (redundant)",
    "customerImpact": "No"
  },
  {
    "incidentId": "INC-2025-027",
    "date": "2025-06-22",
    "assetId": "LHR10-LVSG-01",
    "siteId": "LHR10",
    "description": "Nuisance trip on non-critical distribution breaker.",
    "rootCause": "Protective relay settings drift.",
    "detectionMethod": "EPMS Alarm",
    "downtime": "1.5",
    "customerImpact": "No"
  },
  {
    "incidentId": "INC-2025-041",
    "date": "2025-08-04",
    "assetId": "IAD35-CHIL-01",
    "siteId": "IAD35",
    "description": "Reduced chiller capacity during peak cooling demand.",
    "rootCause": "Fouled condenser tubes.",
    "detectionMethod": "Operator Report + BMS Trend",
    "downtime": "0 (N+1 covered)",
    "customerImpact": "No"
  },
  {
    "incidentId": "INC-2025-058",
    "date": "2025-10-30",
    "assetId": "FRA15-GENS-01",
    "siteId": "FRA15",
    "description": "Failed to reach rated load during scheduled load-bank test.",
    "rootCause": "Fuel filter restriction.",
    "detectionMethod": "Scheduled PM (PM-GENS-02)",
    "downtime": "N/A (test)",
    "customerImpact": "No"
  },
  {
    "incidentId": "INC-2026-009",
    "date": "2026-02-14",
    "assetId": "SIN11-XFMR-01",
    "siteId": "SIN11",
    "description": "Elevated top-oil temperature alarm during high-load period.",
    "rootCause": "Cooling fan controller fault.",
    "detectionMethod": "BMS Alarm",
    "downtime": "0 (corrected same shift)",
    "customerImpact": "No"
  },
  {
    "incidentId": "INC-2026-021",
    "date": "2026-05-02",
    "assetId": "SYD12-CHIL-01",
    "siteId": "SYD12",
    "description": "Unplanned chiller trip on high discharge pressure.",
    "rootCause": "Condenser water flow restriction.",
    "detectionMethod": "BMS Alarm",
    "downtime": "0.5 (N+1 covered)",
    "customerImpact": "No"
  },
  {
    "incidentId": "INC-2026-033",
    "date": "2026-06-19",
    "assetId": "ORD12-PDU-01",
    "siteId": "ORD12",
    "description": "Breaker overheating identified during routine inspection.",
    "rootCause": "Loose termination.",
    "detectionMethod": "Scheduled PM Inspection",
    "downtime": "0",
    "customerImpact": "No"
  }
]

export const RISKS = [
  {
    "id": "RSK-001",
    "category": "Risk",
    "description": "Limited historical data on asset condition prior to PoC.",
    "likelihood": "Medium",
    "impact": "Medium",
    "mitigation": "Establish baseline operating profiles during initial commissioning weeks.",
    "owner": "Vendor PoC Lead",
    "status": "Open"
  },
  {
    "id": "RSK-002",
    "category": "Risk",
    "description": "Live site access restrictions limit installation windows.",
    "likelihood": "Medium",
    "impact": "Medium",
    "mitigation": "Coordinate sensor installation during approved maintenance windows.",
    "owner": "Site Leadership",
    "status": "Open"
  },
  {
    "id": "RSK-003",
    "category": "Risk",
    "description": "Sensor communication issues (wireless interference, gateway outage).",
    "likelihood": "Medium",
    "impact": "Low",
    "mitigation": "Use redundant collection methods and offline data buffering.",
    "owner": "Vendor PoC Lead",
    "status": "Open"
  },
  {
    "id": "RSK-004",
    "category": "Risk",
    "description": "Change resistance from site operations teams.",
    "likelihood": "Low",
    "impact": "Medium",
    "mitigation": "Stakeholder engagement, training, and clear MOP alignment.",
    "owner": "Regional Operations",
    "status": "Open"
  },
  {
    "id": "RSK-005",
    "category": "Risk",
    "description": "Data quality issues (sensor drift, calibration gaps).",
    "likelihood": "Medium",
    "impact": "Medium",
    "mitigation": "Data validation, cleansing, and periodic calibration checks.",
    "owner": "Vendor PoC Lead",
    "status": "Open"
  },
  {
    "id": "RSK-006",
    "category": "Risk",
    "description": "Environmental noise impacts sensor accuracy (electrical/mechanical background noise).",
    "likelihood": "Medium",
    "impact": "Low",
    "mitigation": "Multi-sensor correlation validation before alert escalation.",
    "owner": "Vendor PoC Lead",
    "status": "Open"
  },
  {
    "id": "ASM-001",
    "category": "Assumption",
    "description": "Digital Realty will provide network/VLAN and firewall access within agreed STEP timelines.",
    "likelihood": null,
    "impact": "High if delayed",
    "mitigation": "Confirmed in Technical Prereq Checklist prior to installation.",
    "owner": "Digital Realty IT/OT",
    "status": "Open"
  },
  {
    "id": "ASM-002",
    "category": "Assumption",
    "description": "Existing BMS/EPMS/DCIM systems expose the data points required without custom development.",
    "likelihood": null,
    "impact": "High if false",
    "mitigation": "Validate integration points during Detailed Technical Solution Design (SOW 5.1).",
    "owner": "Vendor PoC Lead",
    "status": "Open"
  },
  {
    "id": "DEP-001",
    "category": "Dependency",
    "description": "Final Asset Scope Matrix approval by Digital Realty before installation begins (SOW 3.3).",
    "likelihood": null,
    "impact": "Blocks installation",
    "mitigation": "Submit within 10 business days of project initiation; track approval status.",
    "owner": "Digital Realty Reliability Engineering",
    "status": "Pending Approval"
  },
  {
    "id": "DEP-002",
    "category": "Dependency",
    "description": "Site Leadership approval of maintenance/change windows for non-intrusive installation.",
    "likelihood": null,
    "impact": "Blocks installation",
    "mitigation": "Coordinate schedule via Site Readiness Checklist.",
    "owner": "Site Leadership",
    "status": "Pending Approval"
  }
]

export const SITE_READINESS = [
  {
    "category": "Site prerequisites & readiness",
    "item": "Confirm selected PoC data hall/zone and physical access route",
    "appliesTo": "All 6 Sites",
    "status": "Not Started",
    "owner": "Site Leadership"
  },
  {
    "category": "Site prerequisites & readiness",
    "item": "Confirm site safety induction/orientation completed for vendor personnel",
    "appliesTo": "All 6 Sites",
    "status": "Not Started",
    "owner": "Site Leadership"
  },
  {
    "category": "System access & permissions",
    "item": "Provision read-only BMS/EPMS/DCIM accounts for vendor analytics platform",
    "appliesTo": "All 6 Sites",
    "status": "Not Started",
    "owner": "Digital Realty IT/OT"
  },
  {
    "category": "Data sources & availability",
    "item": "Confirm 12 months of CMMS maintenance history exportable for baseline",
    "appliesTo": "All 6 Sites",
    "status": "Not Started",
    "owner": "Asset Management"
  },
  {
    "category": "Asset information & documentation",
    "item": "Provide as-built drawings and OEM manuals for in-scope assets",
    "appliesTo": "All 6 Sites",
    "status": "Not Started",
    "owner": "Site Engineering"
  },
  {
    "category": "Infrastructure & network",
    "item": "Confirm available network drops / wireless coverage in PoC zone",
    "appliesTo": "All 6 Sites",
    "status": "Not Started",
    "owner": "Digital Realty IT/OT"
  },
  {
    "category": "Connectivity & integration",
    "item": "Validate BMS/EPMS/DCIM API or gateway integration endpoints",
    "appliesTo": "All 6 Sites",
    "status": "Not Started",
    "owner": "Vendor PoC Lead"
  },
  {
    "category": "Cybersecurity & compliance",
    "item": "Complete cybersecurity review of sensor/gateway data pathway",
    "appliesTo": "All 6 Sites",
    "status": "Not Started",
    "owner": "Digital Realty IT/OT"
  },
  {
    "category": "Hardware / software / licensing",
    "item": "Confirm sensor hardware and analytics platform licenses procured",
    "appliesTo": "All 6 Sites",
    "status": "Not Started",
    "owner": "Vendor PoC Lead"
  },
  {
    "category": "Environmental & installation",
    "item": "Confirm mounting locations meet OEM environmental specifications",
    "appliesTo": "All 6 Sites",
    "status": "Not Started",
    "owner": "Site Engineering"
  },
  {
    "category": "Site access & scheduling",
    "item": "Agree installation schedule and escort requirements per site",
    "appliesTo": "All 6 Sites",
    "status": "Not Started",
    "owner": "Site Leadership"
  },
  {
    "category": "Change management / maintenance windows",
    "item": "Approve Method of Procedure (MOP) for non-intrusive installation",
    "appliesTo": "All 6 Sites",
    "status": "Not Started",
    "owner": "Site Leadership"
  },
  {
    "category": "Digital Realty resources & stakeholders",
    "item": "Confirm named Site Engineering and Reliability Engineering contacts",
    "appliesTo": "All 6 Sites",
    "status": "Not Started",
    "owner": "Regional Operations"
  },
  {
    "category": "Vendor dependencies & assumptions",
    "item": "Confirm vendor technology partner (sensor OEM) selected and available",
    "appliesTo": "All 6 Sites",
    "status": "Not Started",
    "owner": "Vendor PoC Lead"
  },
  {
    "category": "Required approvals",
    "item": "Final Asset Scope Matrix and Solution Design Package approved (SOW 5.1/3.3)",
    "appliesTo": "All 6 Sites",
    "status": "Not Started",
    "owner": "Digital Realty Reliability Engineering"
  }
]

export const TECH_PREREQ = [
  {
    "category": "Network",
    "item": "VLAN / subnet allocated for sensor gateways",
    "status": "Not Started",
    "owner": "Digital Realty IT/OT"
  },
  {
    "category": "Network",
    "item": "Firewall rules approved for gateway-to-cloud analytics traffic",
    "status": "Not Started",
    "owner": "Digital Realty IT/OT"
  },
  {
    "category": "Cybersecurity",
    "item": "Sensor/gateway firmware security review completed",
    "status": "Not Started",
    "owner": "Digital Realty IT/OT"
  },
  {
    "category": "Cybersecurity",
    "item": "Data-in-transit and data-at-rest encryption confirmed",
    "status": "Not Started",
    "owner": "Vendor PoC Lead"
  },
  {
    "category": "Power",
    "item": "Local power source identified for sensor gateways (non-critical circuit)",
    "status": "Not Started",
    "owner": "Site Engineering"
  },
  {
    "category": "Mounting / Installation",
    "item": "Mounting locations identified and approved (non-intrusive, no shutdown)",
    "status": "Not Started",
    "owner": "Site Engineering"
  },
  {
    "category": "Integration",
    "item": "BMS/EPMS/DCIM data-point mapping confirmed against Section 4.1 sources",
    "status": "Not Started",
    "owner": "Vendor PoC Lead"
  },
  {
    "category": "Integration",
    "item": "CMMS maintenance-history export format confirmed",
    "status": "Not Started",
    "owner": "Asset Management"
  },
  {
    "category": "Software / Licensing",
    "item": "Analytics dashboard licenses provisioned for named users",
    "status": "Not Started",
    "owner": "Vendor PoC Lead"
  },
  {
    "category": "Access",
    "item": "Vendor personnel badge access and escort requirements confirmed",
    "status": "Not Started",
    "owner": "Site Leadership"
  },
  {
    "category": "Change Management",
    "item": "MOP submitted and approved for installation/commissioning activities",
    "status": "Not Started",
    "owner": "Site Leadership"
  },
  {
    "category": "Training",
    "item": "Operations team training session scheduled (SOW 5.4)",
    "status": "Not Started",
    "owner": "Regional Operations"
  }
]
