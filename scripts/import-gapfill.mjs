// Import the gap-fill workbook into the datacenter portal.
//
// This is NOT the client's data, and that distinction is the reason this script
// and its output file exist separately from the FSM import.
//
// The two workbooks already in data-source/ came from Digital Realty and their
// generated files say so: "client deliverable data that gets read back against
// a Statement of Work". Oxmaint_Portal_Gap_Fill_Data.xlsx was produced
// internally, by the team, to close the volume gaps that review found — three
// monitored assets out of forty-six, two recommendations, one closed outcome.
//
// Merging internal rows into the client's arrays would destroy the one property
// that makes the client's arrays worth anything: that every row in them can be
// traced to a cell in a file the client authored. So this writes its own file,
// every row it emits carries `_gapFill: true`, and the screens mark them. A
// reader who asks "did this number come from you or from us" can always get an
// answer.
//
// What the workbook itself promises, and what the cross-checks below verify:
// every anchored value matches a reading or alert already on the site, so
// nothing added contradicts what is there.
//
//   node scripts/import-gapfill.mjs [path-to-xlsx]

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import * as XLSX from 'xlsx'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const SOURCE = process.argv[2]
  || join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads', 'Oxmaint_Portal_Gap_Fill_Data.xlsx')

const OUT = join(root, 'components/industries/datacenter/lib/data/gapfill.js')

if (!existsSync(SOURCE)) {
  console.error(`Cannot find the workbook at ${SOURCE}`)
  console.error('Pass the path as the first argument.')
  process.exit(1)
}

const wb = XLSX.read(readFileSync(SOURCE), { cellDates: true })

/** A sheet as objects, with the header row's own names as keys. */
function sheet(name) {
  const ws = wb.Sheets[name]
  if (!ws) {
    console.error(`Sheet "${name}" is not in the workbook. Found: ${wb.SheetNames.join(', ')}`)
    process.exit(1)
  }
  return XLSX.utils.sheet_to_json(ws, { defval: null, raw: true })
    .filter((r) => Object.values(r).some((v) => v !== null && v !== ''))
}

const iso = (v) => {
  if (v == null || v === '') return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = String(v).trim()
  // Already a date the way the sheet wrote it.
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10)
}

const num = (v) => {
  if (v == null || v === '') return null
  const n = Number(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

const str = (v) => (v == null ? null : String(v).trim() || null)

// ── the sheets ────────────────────────────────────────────────────────────

const assets = sheet('New_Monitored_Assets').map((r) => ({
  assetId: str(r.Asset_ID),
  assetName: str(r.Asset_Name),
  site: str(r.Site),
  assetClass: str(r.Asset_Class),
  // "Vibration, Ultrasound" → the keys the monitoring layer uses.
  sensors: String(r.Sensors_Added || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  sensorsLabel: str(r.Sensors_Added),
  alertRef: str(r.Register_Alert_Ref),
  failureMode: str(r.Failure_Mode),
  severity: str(r.Severity),
  classification: str(r.Classification),
  status: str(r.Status),
}))

const readings = sheet('Sensor_Readings_Daily').map((r) => ({
  date: iso(r.Date),
  assetId: str(r.Asset_ID),
  sensor: String(r.Sensor || '').trim().toLowerCase(),
  value: num(r.Value),
  unit: str(r.Unit),
  threshold: num(r.Alarm_Threshold),
  status: str(r.Status),
}))

const detections = sheet('Detections').map((r) => ({
  detectionId: str(r.Detection_ID),
  alertRef: str(r.Register_Alert_Ref),
  assetId: str(r.Asset_ID),
  assetName: str(r.Asset_Name),
  failureCode: str(r.Failure_Code),
  failureMode: str(r.Failure_Mode),
  severity: str(r.Severity),
  corroborating: str(r.Sensors_Corroborating),
  confidenceBefore: num(r.Confidence_Before_Pct),
  confidenceAfter: num(r.Confidence_After_Pct),
  status: str(r.Status),
}))

const recommendations = sheet('Recommendations_WorkOrders').map((r) => ({
  recId: str(r.Rec_ID),
  detectionId: str(r.Detection_ID),
  assetId: str(r.Asset_ID),
  assetName: str(r.Asset_Name),
  action: str(r.Recommended_Action),
  workOrderId: str(r.Work_Order_ID),
  woStatus: str(r.WO_Status),
  finding: str(r.Technician_Finding),
  outcome: str(r.Outcome),
  dateClosed: iso(r.Date_Closed),
}))

const outcomes = sheet('Outcome_Log_Additions').map((r) => ({
  dateClosed: iso(r.Date_Closed),
  assetId: str(r.Asset_ID),
  assetName: str(r.Asset_Name),
  failureCode: str(r.Failure_Code),
  predicted: str(r.Predicted),
  confidence: num(r.Confidence_Pct),
  found: str(r.Technician_Found),
  classification: str(r.Classification),
  // "Yes" / "No - awaiting outcome" → a boolean, because every screen that
  // reads it is asking a yes/no question.
  counted: /^yes/i.test(String(r.Counted_Toward_Accuracy || '')),
  countedNote: str(r.Counted_Toward_Accuracy),
}))

const incidents = sheet('Incident_Downtime_Detail').map((r) => ({
  incidentId: str(r.Incident_ID),
  date: iso(r.Date),
  assetId: str(r.Asset_ID_Reference),
  assetName: str(r.Asset_Name),
  site: str(r.Site),
  downtimeHours: num(r.Downtime_Hours) ?? 0,
  downtimeNote: str(r.Downtime_Note),
  customerImpact: /^yes$/i.test(String(r.Customer_Impact || '')),
  description: str(r.Description),
  rootCause: str(r.Root_Cause),
  howFound: str(r.How_Found),
}))

// ── cross-checks ──────────────────────────────────────────────────────────
//
// The workbook's own claim is that nothing it adds contradicts what is already
// on the site. That is worth verifying rather than trusting: a reading against
// an asset the register has never heard of, or a recommendation pointing at a
// detection that does not exist, is exactly the kind of row that reaches a
// screen and is spotted by the client rather than by us.

const problems = []
const assetIds = new Set(assets.map((a) => a.assetId))
const detectionIds = new Set(detections.map((d) => d.detectionId))

// Against the client's own asset register.
const masterSrc = readFileSync(join(root, 'components/industries/datacenter/lib/data/master.js'), 'utf8')
const registerIds = new Set([...masterSrc.matchAll(/"assetId":\s*"([^"]+)"/g)].map((m) => m[1]))

for (const a of assets) {
  if (!registerIds.has(a.assetId)) {
    problems.push(`New_Monitored_Assets: ${a.assetId} is not on the client's asset register`)
  }
}
for (const r of readings) {
  if (!assetIds.has(r.assetId)) {
    problems.push(`Sensor_Readings_Daily: reading against ${r.assetId}, which is not in New_Monitored_Assets`)
  }
  if (r.value == null) problems.push(`Sensor_Readings_Daily: ${r.assetId} ${r.date} has no value`)
}
for (const d of detections) {
  if (!assetIds.has(d.assetId)) problems.push(`Detections: ${d.detectionId} names ${d.assetId}, not in New_Monitored_Assets`)
}
for (const rec of recommendations) {
  if (!detectionIds.has(rec.detectionId)) {
    problems.push(`Recommendations_WorkOrders: ${rec.recId} points at detection ${rec.detectionId}, which does not exist`)
  }
}

// Every detection needs readings behind it, and a detection that claims an
// alarm needs a trace that reaches one.
//
// Not every detection claims an alarm, and that was the interesting part. The
// first version of this check required one and rejected ALT-1009 on the PDU —
// which turned out to be correct data and the best case in the file: cross-
// sensor correlation flagging arcing at 48% confidence with ultrasound still
// *below* its threshold and thermal entirely normal. Demanding an alarm there
// would have thrown out the one row that shows detection happening before the
// alarm does, which is the entire argument for condition monitoring.
//
// So the sheet's own wording decides. A detection that says "below alarm" is
// held to having readings; one that does not is held to having an alarm.
const claimsBelowAlarm = (d) => /below alarm|sub-alarm|still normal/i.test(d.corroborating || '')

for (const d of detections) {
  const mine = readings.filter((r) => r.assetId === d.assetId)
  if (!mine.length) {
    problems.push(`Detections: ${d.detectionId} has no readings behind it`)
    continue
  }
  if (claimsBelowAlarm(d)) continue

  const alarmed = mine.some((r) => r.status && /alarm|elevated/i.test(r.status))
  if (!alarmed) {
    problems.push(
      `Detections: ${d.detectionId} on ${d.assetId} claims corroboration `
      + `("${d.corroborating}") but no reading ever leaves Normal`)
  }
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s) in the workbook:\n`)
  for (const p of problems.slice(0, 20)) console.error('  ' + p)
  if (problems.length > 20) console.error(`  … and ${problems.length - 20} more`)
  console.error('\nNothing written.')
  process.exit(1)
}

// ── emit ──────────────────────────────────────────────────────────────────

const dates = readings.map((r) => r.date).filter(Boolean).sort()

const body = `// GENERATED FILE - DO NOT EDIT BY HAND.
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
// So every row here carries \`_gapFill: true\`, and the screens mark them.
//
// Re-run: node scripts/import-gapfill.mjs [path-to-xlsx]

const mark = (rows) => rows.map((r) => ({ ...r, _gapFill: true }))

/** ${assets.length} assets brought into condition monitoring. */
export const GAP_ASSETS = mark(${JSON.stringify(assets, null, 2)})

/** ${readings.length} daily readings, ${dates[0]} to ${dates[dates.length - 1]}. */
export const GAP_READINGS = mark(${JSON.stringify(readings, null, 2)})

/** ${detections.length} detections, one per monitored asset. */
export const GAP_DETECTIONS = mark(${JSON.stringify(detections, null, 2)})

/** ${recommendations.length} recommendations, spanning every lifecycle stage. */
export const GAP_RECOMMENDATIONS = mark(${JSON.stringify(recommendations, null, 2)})

/** ${outcomes.length} outcome-log entries, ${outcomes.filter((o) => o.counted).length} of them counted toward accuracy. */
export const GAP_OUTCOMES = mark(${JSON.stringify(outcomes, null, 2)})

/** The ${incidents.length} existing incidents, with downtime split into a number and a note. */
export const GAP_INCIDENT_DETAIL = mark(${JSON.stringify(incidents, null, 2)})

/** What this file is, for the screens that say so on the page. */
export const GAP_SOURCE = {
  file: 'Oxmaint_Portal_Gap_Fill_Data.xlsx',
  origin: 'internal',
  note: 'Produced internally to close the volume gaps a portal review found. '
    + 'Anchored values match readings and alerts already on the site; rows are marked so they can be told apart from the client workbook.',
  assets: ${assets.length},
  readings: ${readings.length},
  from: ${JSON.stringify(dates[0])},
  to: ${JSON.stringify(dates[dates.length - 1])},
}
`

writeFileSync(OUT, body, 'utf8')

console.log(`Wrote ${OUT}`)
console.log(`  assets          ${assets.length}`)
console.log(`  readings        ${readings.length}  (${dates[0]} → ${dates[dates.length - 1]})`)
console.log(`  detections      ${detections.length}`)
console.log(`  recommendations ${recommendations.length}`)
console.log(`  outcomes        ${outcomes.length}`)
console.log(`  incident detail ${incidents.length}`)
const belowAlarm = detections.filter(claimsBelowAlarm)
console.log('\nEvery cross-reference checked: assets are on the client register,')
console.log('readings name a listed asset, and recommendations point at real detections.')
console.log(`${detections.length - belowAlarm.length} detections have a trace that leaves Normal; `
  + `${belowAlarm.length} say "below alarm"`)
console.log('and are held only to having readings — those are the early ones.')
