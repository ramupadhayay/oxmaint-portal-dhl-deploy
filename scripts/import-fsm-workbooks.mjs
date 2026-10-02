// Turns the two FSM PoC workbooks into the portal's seed modules.
//
// Run with `npm run import:fsm` after either workbook changes. The generated
// files are committed, so the app never reads a spreadsheet at runtime and
// `xlsx` stays a devDependency — a portal that parses 80KB of Excel on every
// cold start to render a table it could have been handed is paying for the
// convenience of the person who built it.
//
// The workbooks are the source of truth and are copied into data-source/ beside
// this script. Nothing here invents a value: every field is carried across as
// it was authored, only renamed. That matters more than usual on this data —
// it is a client deliverable whose numbers get read back against a Statement of
// Work, so a helpful rounding here would be a defect.

import XLSX from 'xlsx'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'data-source')
const out = join(root, 'components', 'industries', 'datacenter', 'lib', 'data')

const MASTER = 'DigitalRealty_FSM_PoC_Master_Data.xlsx'
const TRANSACTIONAL = 'DigitalRealty_FSM_PoC_Transactional_Data.xlsx'
const SYNTHETIC = 'FSM_PoC_Synthetic_Asset_Data.xlsx'

// Excel keeps dates as a day count from 1899-12-30, and this workbook's date
// columns arrive that way — 46225 rather than a date. Converted here so no
// screen has to know that, and to an ISO date rather than a Date object so the
// generated modules stay plain JSON.
const excelDate = (n) => {
  if (typeof n !== 'number') return n
  return new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10)
}

const MASTER_SHEETS = {
  'Site Master': ['SITES', {
    'Site ID': 'siteId', 'Site Name': 'siteName', 'Region': 'region', 'Country': 'country',
    'Metro Area': 'metro', 'Facility Type': 'facilityType', 'Design Tier': 'designTier',
    'Power Redundancy': 'powerRedundancy', 'Cooling Redundancy': 'coolingRedundancy',
    'PoC Critical Zone': 'pocZone', 'Total IT Load (MW, illustrative)': 'itLoadMw',
    'Gross Area (sq ft, illustrative)': 'grossAreaSqFt', 'PoC Status': 'pocStatus',
  }],
  'Location Hierarchy Master': ['LOCATIONS', {
    'Location ID': 'locationId', 'Parent Location / Site ID': 'parentId', 'Site ID': 'siteId',
    'Location Type': 'locationType', 'Location Name': 'locationName',
  }],
  'Asset Class Master': ['ASSET_CLASSES', {
    'Class ID': 'classId', 'Category': 'category', 'Asset Class Name': 'className',
    'SOW Reference': 'sowRef', 'Default Criticality': 'defaultCriticality',
    'Recommended Monitoring (SOW Tech)': 'monitoring', 'Maintenance Strategy': 'strategy',
  }],
  'Manufacturer Master': ['MANUFACTURERS', {
    'Class ID': 'classId', 'Asset Class Name': 'className',
    'Representative Manufacturers / OEMs (illustrative)': 'manufacturers',
  }],
  'Failure Code Master': ['FAILURE_CODES', {
    'Failure Code': 'code', 'Monitoring Technology': 'technology',
    'Failure Mode': 'mode', 'SOW Reference': 'sowRef',
  }],
  'Asset Register (FASM)': ['ASSETS', {
    'Asset ID': 'assetId', 'Asset Name': 'assetName', 'Asset Class': 'assetClass',
    'Site ID': 'siteId', 'Region': 'region', 'Physical Location ID': 'locationId',
    'Asset Criticality Rating': 'criticality', 'Monitoring Method': 'monitoringMethod',
    'Existing Data Source(s)': 'dataSources', 'Additional Sensors (where applicable)': 'sensors',
    'Failure Codes Being Monitored': 'failureCodes', 'Manufacturer': 'manufacturer',
    'Asset Status (Included/Excluded)': 'scopeStatus', 'Status Rationale': 'scopeRationale',
  }],
  'Criticality Rating Matrix': ['CRITICALITY', {
    'Rating': 'rating', 'Tier': 'tier', 'Redundancy Impact': 'redundancyImpact',
    'Business Impact': 'businessImpact', 'Response SLA': 'responseSla',
  }],
  'Data Source & System Master': ['SYSTEMS', {
    'System ID': 'systemId', 'System Name': 'systemName', 'System Type': 'systemType',
    'Representative Vendor/Platform': 'vendor', 'Protocol': 'protocol',
    'Typical Data Points': 'dataPoints', 'Scope': 'scope', 'Sample Data Location': 'sampleLocation',
  }],
  'Governance & Stakeholder Master': ['STAKEHOLDERS', {
    'Stakeholder / Role': 'role', 'RACI (PoC Governance)': 'raci',
    'Typical Review Cadence': 'cadence', 'Core Responsibility': 'responsibility',
  }],
  'PM Task Library (Baseline)': ['PM_TASKS', {
    'Task ID': 'taskId', 'Class ID': 'classId', 'Asset Class': 'assetClass', 'PM Task': 'task',
    'Frequency': 'frequency', 'Standard / Reference': 'standard', 'Affected by PoC?': 'affectedByPoc',
  }],
  'KPI Master': ['KPI_MASTER', {
    'KPI ID': 'kpiId', 'Group': 'group', 'KPI': 'kpi', 'Target (per SOW Sec. 8)': 'target',
    'Definition': 'definition', 'Primary Data Source': 'source',
  }],
}

const TRANSACTIONAL_SHEETS = {
  'Work Orders': ['WORK_ORDERS', {
    'Work Order ID': 'workOrderId', 'Date Raised': 'dateRaised', 'Asset ID': 'assetId',
    'Site ID': 'siteId', 'Trigger Source': 'triggerSource', 'Linked Alert ID': 'alertId',
    'Priority': 'priority', 'Description': 'description',
    'Maintenance Action / Finding': 'action', 'Assigned To': 'assignedTo', 'Status': 'status',
    'Date Completed': 'dateCompleted', 'Outcome': 'outcome',
    'Feedback to Analytics (Step 7)': 'feedback',
  }],
  'Alert & Anomaly Register': ['ALERTS', {
    'Alert ID': 'alertId', 'Date/Time': 'timestamp', 'Asset ID': 'assetId', 'Site ID': 'siteId',
    'Monitoring Source': 'source', 'Failure Code': 'failureCode', 'Severity': 'severity',
    'Alert Description': 'description', 'Engineering Review Outcome': 'reviewOutcome',
    'Condition Validated': 'validated', 'Status': 'status', 'Linked Work Order': 'workOrderId',
    'Alert Classification (for KPI-T03/T04)': 'classification',
  }],
  'Condition Monitoring Readings': ['READINGS', {
    'Reading ID': 'readingId', 'Date/Time': 'timestamp', 'Asset ID': 'assetId',
    'Sensor Type': 'sensorType', 'Measured Value': 'value', 'Unit / Baseline': 'unit',
    'Threshold': 'threshold', 'Status': 'status', 'Linked Alert ID': 'alertId',
  }],
  'BMS Data Sample': ['BMS', {
    'Reading ID': 'readingId', 'Timestamp': 'timestamp', 'Site ID': 'siteId',
    'Location ID': 'locationId', 'Asset ID': 'assetId', 'BMS Point Name': 'point',
    'Value': 'value', 'Unit': 'unit', 'Status': 'status', 'Correlates With (Alert ID)': 'alertId',
  }],
  'EPMS Data Sample': ['EPMS', {
    'Reading ID': 'readingId', 'Timestamp': 'timestamp', 'Site ID': 'siteId', 'Asset ID': 'assetId',
    'EPMS Point Name': 'point', 'Value': 'value', 'Unit': 'unit', 'Status': 'status',
    'Correlates With (Alert ID)': 'alertId',
  }],
  'DCIM Data Sample': ['DCIM', {
    'Reading ID': 'readingId', 'Date': 'date', 'Site ID': 'siteId', 'Metric': 'metric',
    'Value': 'value', 'Unit': 'unit', 'Trend Note': 'trend',
  }],
  'OEM Monitoring Sample': ['OEM', {
    'Reading ID': 'readingId', 'Timestamp': 'timestamp', 'Site ID': 'siteId', 'Asset ID': 'assetId',
    'OEM Platform': 'platform', 'Health Indicator / Alarm': 'indicator',
    'Value / Description': 'value', 'Status': 'status', 'Correlates With (Alert ID)': 'alertId',
  }],
  'Battery Monitoring Sample': ['BATTERY', {
    'Reading ID': 'readingId', 'Timestamp': 'timestamp', 'Site ID': 'siteId', 'Asset ID': 'assetId',
    'String / Cell Reference': 'cellRef', 'Cell Voltage (V)': 'cellVoltage',
    'Internal Resistance (mOhm)': 'internalResistance', 'Temperature (degC)': 'temperature',
    'State of Health (%)': 'stateOfHealth', 'Status': 'status',
  }],
  'Maintenance Correlation Log': ['CORRELATIONS', {
    'Correlation ID': 'correlationId', 'Linked Alert ID': 'alertId', 'Asset ID': 'assetId',
    'Physical Inspection Date': 'inspectionDate', 'Inspection/Maintenance Finding': 'finding',
    'Finding Confirmed Anomaly?': 'confirmed', 'Failure Mode Confirmed': 'failureMode',
    'Detection Lead Time vs. Traditional PM': 'leadTime',
    'Maintenance Optimization Insight': 'insight',
  }],
  'KPI Dashboard (Actuals)': ['KPI_ACTUALS', {
    'KPI ID': 'kpiId', 'Group': 'group', 'KPI': 'kpi', 'Target (SOW Sec. 8)': 'target',
    'Actual (Live Formula)': 'actual', 'Status vs. Target': 'statusVsTarget',
    'Computed From': 'computedFrom',
  }],
  'Benefits Realization Assessment': ['BENEFITS', {
    'Benefit ID': 'benefitId', 'Category': 'category', 'Description': 'description',
    'Linked Evidence': 'evidence', 'Estimated Impact (Illustrative)': 'impact',
    'Basis / Assumption': 'basis',
  }],
  'PM Compliance Log': ['PM_COMPLIANCE', {
    'Log ID': 'logId', 'PM Task ID (ref. Master Data)': 'taskId', 'Asset ID': 'assetId',
    'Scheduled Date': 'scheduledDate', 'Completed Date': 'completedDate',
    'Compliance Status': 'status', 'Assigned Team': 'team',
  }],
  'Weekly Health Report Log': ['WEEKLY_HEALTH', {
    'Report ID': 'reportId', 'Week Ending': 'weekEnding', 'Reporting Cadence': 'cadence',
    'Sensor Availability %': 'sensorAvailability',
    'Data Acquisition Reliability %': 'dataReliability',
    'Dashboard Availability %': 'dashboardAvailability', 'Open Alerts': 'openAlerts',
    'Alerts Closed': 'alertsClosed', 'Work Orders Raised': 'workOrdersRaised',
    'Key Observations': 'observations', 'Prepared By': 'preparedBy',
  }],
  'Incident History (Baseline)': ['INCIDENTS', {
    'Incident ID': 'incidentId', 'Date': 'date', 'Asset ID': 'assetId', 'Site ID': 'siteId',
    'Failure Description': 'description', 'Root Cause': 'rootCause',
    'Detection Method (Traditional)': 'detectionMethod', 'Downtime (hrs)': 'downtime',
    'Customer-Facing Impact': 'customerImpact',
  }],
  'Risk-Assumption-Dependency Reg': ['RISKS', {
    'ID': 'id', 'Category': 'category', 'Description': 'description', 'Likelihood': 'likelihood',
    'Impact': 'impact', 'Mitigation / Response': 'mitigation', 'Owner': 'owner', 'Status': 'status',
  }],
  'Site Readiness Checklist': ['SITE_READINESS', {
    'SOW 5.2 Category': 'category', 'Checklist Item': 'item', 'Applies To': 'appliesTo',
    'Status': 'status', 'Owner': 'owner',
  }],
  'Technical Prereq Checklist': ['TECH_PREREQ', {
    'Category': 'category', 'Checklist Item': 'item', 'Status': 'status', 'Owner': 'owner',
  }],
}

// The monitoring demo's own workbook: three assets, thirty days of readings,
// and the alert-to-outcome chain over them. Separate from the two above because
// it is a separate deliverable — the screens spec drives these — but it names
// the same asset ids, so the register and these screens are talking about the
// same machines.
const SYNTHETIC_SHEETS = {
  Assets: ['MON_ASSETS', {
    'Asset_ID': 'assetId', 'Asset_Name': 'assetName', 'Asset_Class': 'assetClass',
    'Site': 'siteId', 'Location': 'location', 'Criticality': 'criticality',
    'Manufacturer': 'manufacturer', 'Monitoring_Methods': 'monitoring',
    'Install_Date': 'installDate', 'Current_Status': 'status',
  }, ['installDate']],

  Sensor_Readings: ['MON_READINGS', {
    'Date': 'date', 'Asset_ID': 'assetId',
    'Vibration_mms': 'vibration', 'Vibration_Status': 'vibrationStatus',
    'Thermal_C': 'thermal', 'Thermal_Status': 'thermalStatus',
    'Ultrasound_dB': 'ultrasound', 'Ultrasound_Status': 'ultrasoundStatus',
  }, ['date']],

  Health_Score_History: ['MON_HEALTH', {
    'Date': 'date', 'Asset_ID': 'assetId', 'Health_Score': 'score',
  }, ['date']],

  Alerts: ['MON_ALERTS', {
    'Alert_ID': 'alertId', 'Asset_ID': 'assetId', 'Date_Raised': 'dateRaised',
    'Failure_Code': 'failureCode', 'Description': 'description',
    'Triggering_Sensors': 'triggeringSensors', 'Confidence_Pct': 'confidence',
    'Severity': 'severity', 'Status': 'status',
  }, ['dateRaised']],

  Recommendations_WorkOrders: ['MON_RECOMMENDATIONS', {
    'Rec_ID': 'recId', 'Alert_ID': 'alertId', 'Asset_ID': 'assetId',
    'Recommended_Action': 'action', 'Urgency': 'urgency', 'Date_Issued': 'dateIssued',
    'Work_Order_ID': 'workOrderId', 'WO_Status': 'woStatus',
    'Technician_Finding': 'finding', 'Outcome': 'outcome', 'Date_Closed': 'dateClosed',
  }, ['dateIssued', 'dateClosed']],
}

let problems = 0

function readSheet(wb, sheetName, mapping, file) {
  const ws = wb.Sheets[sheetName]
  if (!ws) {
    console.error(`  MISSING SHEET: "${sheetName}" in ${file}`)
    problems++
    return []
  }
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null })
  if (!rows.length) return []

  // A renamed or dropped column would otherwise surface as a screen full of
  // blanks, which is the kind of failure nobody notices until a client does.
  const present = new Set(Object.keys(rows[0]))
  for (const header of Object.keys(mapping)) {
    if (!present.has(header)) {
      console.error(`  MISSING COLUMN: "${header}" in ${file} / ${sheetName}`)
      problems++
    }
  }
  for (const header of present) {
    if (!(header in mapping)) console.warn(`  (unmapped column ignored: "${header}" in ${sheetName})`)
  }

  return rows.map((row) => {
    const o = {}
    for (const [header, key] of Object.entries(mapping)) {
      let v = row[header]
      if (typeof v === 'string') v = v.trim()
      // "N/A" is the workbook's way of writing "no link here". Carried through
      // as null so screens can test for a link instead of comparing strings.
      if (v === 'N/A' || v === '') v = null
      o[key] = v === undefined ? null : v
    }
    return o
  })
}

function emit(file, header, groups) {
  const parts = [header, '']
  for (const [name, rows] of groups) {
    parts.push(`export const ${name} = ${JSON.stringify(rows, null, 2)}`, '')
  }
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, file), parts.join('\n'), 'utf8')
  const counts = groups.map(([n, r]) => `${n}=${r.length}`).join(' ')
  console.log(`  wrote ${file}  (${counts})`)
}

const BANNER = (workbook) => `// GENERATED FILE - DO NOT EDIT BY HAND.
//
// Produced by scripts/import-fsm-workbooks.mjs from
// data-source/${workbook}
//
// Every value is carried across exactly as authored. This is client deliverable
// data that gets read back against a Statement of Work, so it is not rounded,
// reformatted or "tidied" on the way in. Edit the workbook and re-run
// \`npm run import:fsm\`.
`

console.log('reading master workbook...')
const masterWb = XLSX.readFile(join(src, MASTER))
emit('master.js', BANNER(MASTER),
  Object.entries(MASTER_SHEETS).map(([sheet, [name, map]]) => [name, readSheet(masterWb, sheet, map, MASTER)]))

console.log('reading transactional workbook...')
const txWb = XLSX.readFile(join(src, TRANSACTIONAL))
emit('transactional.js', BANNER(TRANSACTIONAL),
  Object.entries(TRANSACTIONAL_SHEETS).map(([sheet, [name, map]]) => [name, readSheet(txWb, sheet, map, TRANSACTIONAL)]))

console.log('reading synthetic monitoring workbook...')
const monWb = XLSX.readFile(join(src, SYNTHETIC))
emit('monitoring.js', BANNER(SYNTHETIC),
  Object.entries(SYNTHETIC_SHEETS).map(([sheet, [name, map, dateFields = []]]) => {
    const rows = readSheet(monWb, sheet, map, SYNTHETIC)
    // Only the columns named as dates are converted. Blanket-converting every
    // number would turn a health score of 92 into a date in 1900.
    for (const row of rows) for (const f of dateFields) row[f] = excelDate(row[f])
    return [name, rows]
  }))

if (problems) {
  console.error(`\n${problems} problem(s) above - the workbook changed shape. Fix the mapping before committing.`)
  process.exit(1)
}
console.log('\ndone.')
