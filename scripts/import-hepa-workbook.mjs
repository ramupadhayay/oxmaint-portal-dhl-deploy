// Turn the HEPA compliance workbook into committed JS modules.
//
//   npm run import:hepa
//
// The same arrangement the FSM portal uses, and for the same reason: the client
// deliverable is a workbook, the portal has to render exactly what it says, and
// a value that got rounded or "tidied" on the way in is a value that no longer
// matches the file somebody will read it back against.
//
// Three things this workbook does that the FSM one does not:
//
// Its sheets open with a title and a description before the header row, and two
// of them carry a *parameter* on the row above the header — the DOP/PAO
// penetration threshold and the leak pressure-differential threshold. Those are
// the numbers Pass/Fail and Breach are computed against, so they are lifted out
// rather than left as prose nobody reads.
//
// Two sheets end with roll-up rows ("Total mapped assets") sitting in the same
// columns as the data. Rows are kept by matching the id column against the
// pattern its records use, so a trailer cannot be mistaken for a nineteenth
// filter — and neither can a row somebody appends later.
//
// And the workbook says of itself: "SAMPLE / DEMO dataset only. All facility
// names, filter IDs, technician names ... illustrative". That wording is
// carried onto the screens; it is not ours to soften.

import XLSX from 'xlsx'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'data-source')
const out = join(root, 'components', 'industries', 'hepa', 'lib', 'data')
const WORKBOOK = 'HEPA_Sample_Dataset.xlsx'

// Excel counts days from 1899-12-30. Left as a serial, an install date renders
// as "45444" — which looks like an asset tag and reads as a bug.
const excelDate = (n) => {
  if (typeof n !== 'number') return n
  return new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10)
}

// A timestamp keeps its time of day: an e-signature is only evidence if it says
// when, and 45854.125 is three in the morning.
const excelDateTime = (n) => {
  if (typeof n !== 'number') return n
  return new Date(Math.round((n - 25569) * 86400000)).toISOString()
}

let problems = 0
const fail = (msg) => { console.error('  ' + msg); problems++ }

/**
 * Rows of one sheet, mapped to camelCase keys.
 *
 * @param headerRow  0-based index of the row carrying the column names
 * @param idPattern  what the first column looks like on a real record — the
 *                   test that separates data from the roll-up rows underneath
 */
function readSheet(wb, sheetName, { headerRow, idPattern, mapping, dates = [], timestamps = [] }) {
  const ws = wb.Sheets[sheetName]
  if (!ws) { fail(`MISSING SHEET: "${sheetName}"`); return [] }

  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null })
  const headers = (grid[headerRow] || []).map((h) => (typeof h === 'string' ? h.trim() : h))
  if (!headers.length) { fail(`NO HEADER ROW at index ${headerRow} in "${sheetName}"`); return [] }

  // A renamed or dropped column would otherwise surface as a screen full of
  // blanks, which is the kind of failure nobody notices until a client does.
  for (const header of Object.keys(mapping)) {
    if (!headers.includes(header)) fail(`MISSING COLUMN: "${header}" in "${sheetName}"`)
  }
  for (const h of headers) {
    if (h && !(h in mapping)) console.warn(`  (unmapped column ignored: "${h}" in ${sheetName})`)
  }

  const rows = []
  for (const line of grid.slice(headerRow + 1)) {
    const first = line[0]
    if (typeof first !== 'string' || !idPattern.test(first.trim())) continue

    const o = {}
    for (const [header, key] of Object.entries(mapping)) {
      const col = headers.indexOf(header)
      let v = col === -1 ? null : line[col]
      if (typeof v === 'string') v = v.trim()
      if (v === '' || v === undefined) v = null
      o[key] = v
    }
    for (const k of dates) o[k] = excelDate(o[k])
    for (const k of timestamps) o[k] = excelDateTime(o[k])
    rows.push(o)
  }
  return rows
}

/** A single labelled parameter sitting above the header — a threshold. */
function readParam(wb, sheetName, { row, labelCol = 0, valueCol }) {
  const grid = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, blankrows: false, defval: null })
  const line = grid[row] || []
  const label = typeof line[labelCol] === 'string' ? line[labelCol].trim() : String(line[labelCol] ?? '')
  const value = line[valueCol]
  if (typeof value !== 'number') {
    fail(`PARAMETER NOT A NUMBER in "${sheetName}" row ${row}: got ${JSON.stringify(value)} for "${label}"`)
  }
  return { label, value }
}

// ── the sheets ────────────────────────────────────────────────────────────
const SHEETS = {
  filters: ['Filter Asset Registry', {
    headerRow: 2,
    idPattern: /^HF-\d+$/,
    mapping: {
      'Filter ID': 'filterId', 'Cleanroom ID': 'cleanroomId', 'Cleanroom Name': 'cleanroomName',
      'ISO Class': 'isoClass', 'Location QR Code': 'qrCode', 'Install Date': 'installDate',
      'Filter Age (days)': 'ageDays', 'Test Interval': 'testInterval', 'Current Status': 'status',
    },
    dates: ['installDate'],
  }],

  tests: ['DOP-PAO Test Records', {
    headerRow: 3,
    idPattern: /^DT-\d+$/,
    mapping: {
      'Test ID': 'testId', 'Filter ID': 'filterId', 'Test Date': 'testDate',
      'Test Points': 'testPoints', 'Penetration (%)': 'penetration', 'Pass/Fail': 'result',
      'Technician ID': 'technicianId', 'Technician Name': 'technicianName',
      'Record Lock Status': 'lockStatus',
    },
    dates: ['testDate'],
  }],

  leaks: ['Leak Detection Records', {
    headerRow: 3,
    idPattern: /^LR-\d+$/,
    mapping: {
      'Reading ID': 'readingId', 'Filter ID': 'filterId', 'Reading Date': 'readingDate',
      'Pressure Differential (in. wg)': 'pressureDifferential', 'Reading Type': 'readingType',
      'Technician ID': 'technicianId', 'Threshold Breach': 'breach',
    },
    dates: ['readingDate'],
  }],

  replacements: ['Replacement Records', {
    headerRow: 2,
    idPattern: /^RP-\d+$/,
    mapping: {
      'Replacement ID': 'replacementId', 'Filter ID': 'filterId',
      'Old Serial No': 'oldSerial', 'New Serial No': 'newSerial',
      'Supplier': 'supplier', 'Supplier Cert Ref': 'supplierCert',
      'Pre-Validation Test ID': 'preValidationTestId', 'Post-Validation Test ID': 'postValidationTestId',
      'Installation Date': 'installationDate', 'Recert Status': 'recertStatus',
    },
    dates: ['installationDate'],
  }],

  sap: ['SAP Integration Mapping', {
    headerRow: 2,
    idPattern: /^HF-\d+$/,
    mapping: {
      'Oxmaint Filter ID': 'filterId', 'SAP Equipment ID': 'sapEquipmentId',
      'SAP Functional Location': 'sapFunctionalLocation', 'SAP Work Order No.': 'sapWorkOrder',
      'Work Order Type': 'workOrderType', 'Sync Status': 'syncStatus',
      'Last Sync Timestamp': 'lastSync', 'Linked Document Ref (Oxmaint)': 'documentRef',
    },
    dates: ['lastSync'],
  }],

  documents: ['Document Lifecycle Mgmt', {
    headerRow: 3,
    idPattern: /^DOC-/,
    mapping: {
      'Document Ref': 'documentRef', 'Related Record ID': 'relatedRecordId', 'Record Type': 'recordType',
      'Lifecycle Stage': 'stage', 'Routed To (Role)': 'routedToRole', 'Reviewer': 'reviewer',
      'Approval Status': 'approvalStatus', 'E-Signature By': 'signedBy',
      'E-Signature Timestamp': 'signedAt', 'Audit Trail Entries': 'auditEntries',
      'Retention Expiry Date': 'retentionExpiry', 'Next Cert. Due Date': 'nextCertDue',
      'Notification Status': 'notificationStatus',
    },
    dates: ['retentionExpiry', 'nextCertDue'],
    timestamps: ['signedAt'],
  }],
}

// ── read ──────────────────────────────────────────────────────────────────
console.log(`reading ${WORKBOOK}...`)
const wb = XLSX.readFile(join(src, WORKBOOK))

const data = {}
for (const [key, [sheetName, spec]] of Object.entries(SHEETS)) {
  data[key] = readSheet(wb, sheetName, spec)
  console.log(`  ${sheetName.padEnd(26)} ${String(data[key].length).padStart(3)} rows`)
}

// The thresholds Pass/Fail and Breach are judged against. Lifted out of the
// sheet rather than restated in code: if the workbook is revised, the portal
// moves with it instead of quietly disagreeing.
const thresholds = {
  penetration: readParam(wb, 'DOP-PAO Test Records', { row: 2, valueCol: 1 }),
  pressureDifferential: readParam(wb, 'Leak Detection Records', { row: 2, valueCol: 2 }),
  notificationLeadDays: readParam(wb, 'Document Lifecycle Mgmt', { row: 2, valueCol: 4 }),
}
console.log('')
for (const [k, p] of Object.entries(thresholds)) {
  console.log(`  ${k.padEnd(22)} ${p.value}   ("${p.label}")`)
}

// The dashboard is the workbook's own arithmetic. Carried across as authored so
// the portal can be checked against it rather than recomputing and hoping the
// two agree.
const dashboard = XLSX.utils
  .sheet_to_json(wb.Sheets['Compliance Dashboard'], { header: 1, blankrows: false, defval: null })
  .slice(3)
  .filter((r) => typeof r[0] === 'string' && r[0].trim() && typeof r[1] === 'number')
  .map((r) => ({ metric: r[0].trim(), value: r[1], source: typeof r[2] === 'string' ? r[2].trim() : null }))
console.log(`  ${'Compliance Dashboard'.padEnd(22)} ${dashboard.length} metrics`)

// ── cross-references ──────────────────────────────────────────────────────
// A test against a filter that is not on the registry is a broken row, and it
// is invisible on any single screen — it just quietly renders a blank.
const filterIds = new Set(data.filters.map((f) => f.filterId))
const orphan = (rows, label, key = 'filterId') => {
  const bad = rows.filter((r) => r[key] && !filterIds.has(r[key]))
  if (bad.length) fail(`${bad.length} ${label} reference a filter not on the registry: ${bad.slice(0, 3).map((b) => b[key]).join(', ')}`)
}
orphan(data.tests, 'DOP/PAO tests')
orphan(data.leaks, 'leak readings')
orphan(data.replacements, 'replacements')
orphan(data.sap, 'SAP mappings')

const testIds = new Set(data.tests.map((t) => t.testId))
for (const r of data.replacements) {
  for (const k of ['preValidationTestId', 'postValidationTestId']) {
    if (r[k] && !testIds.has(r[k])) fail(`${r.replacementId}.${k} points at ${r[k]}, which is not a test on file`)
  }
}

// ── emit ──────────────────────────────────────────────────────────────────
const BANNER = `// GENERATED FILE - DO NOT EDIT BY HAND.
//
// Produced by scripts/import-hepa-workbook.mjs from
// data-source/${WORKBOOK}
//
// The workbook describes itself as a SAMPLE / DEMO dataset whose facility
// names, filter IDs and technician names are illustrative. That is carried onto
// the screens as written; it is not ours to soften.
//
// Every value is exactly as authored — not rounded, not reformatted. Dates are
// the one exception: Excel serials become ISO strings, because a serial renders
// as "45444" and reads as a bug. Edit the workbook and re-run
// \`npm run import:hepa\`.
`

mkdirSync(out, { recursive: true })

const emit = (file, groups) => {
  const parts = [BANNER, '']
  for (const [name, value] of groups) parts.push(`export const ${name} = ${JSON.stringify(value, null, 2)}`, '')
  writeFileSync(join(out, file), parts.join('\n'), 'utf8')
  const counts = groups.map(([n, v]) => `${n}=${Array.isArray(v) ? v.length : 'obj'}`).join(' ')
  console.log(`  wrote ${file}  (${counts})`)
}

console.log('')
emit('filters.js', [['FILTERS', data.filters], ['THRESHOLDS', thresholds]])
emit('tests.js', [['TESTS', data.tests], ['LEAKS', data.leaks]])
emit('replacements.js', [['REPLACEMENTS', data.replacements]])
emit('sap.js', [['SAP_MAPPING', data.sap]])
emit('documents.js', [['DOCUMENTS', data.documents]])
emit('dashboard.js', [['WORKBOOK_DASHBOARD', dashboard]])

console.log('')
if (problems) {
  console.error(`${problems} problem(s) — the workbook and this importer disagree. Nothing downstream is trustworthy until that is resolved.`)
  process.exit(1)
}
console.log('import clean.')
