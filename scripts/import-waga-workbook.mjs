// Turns the WAGA Energy import workbook into the portal's data modules.
//
// Run with `npm run import:waga` after the workbook changes. The generated
// files are committed, so the app never reads a spreadsheet at runtime and
// `xlsx` stays a devDependency — the same trade the FSM importer makes, and for
// the same reason.
//
// Nothing here invents a value. That rule is not a preference on this dataset:
// the workbook's own README says "Blank fields mean the source documents did
// not provide enough information. They should not be silently invented", and
// its Verification_Log records which permits genuinely have no issue date. A
// helpful default here would be a compliance defect, so blanks are carried
// across as empty strings and the screens render them as "Not stated".
//
// Two things are deliberately NOT imported as fact:
//   - Compliance_Tasks rows marked "Demo-generated". The workbook says to
//     generate occurrences from the recurrence rules instead, so those rows are
//     carried with their label intact and lib/schedule.js does the work.
//   - Incidents_RCA, which holds a single placeholder row. That source workbook
//     was never supplied, and V-014 says not to populate fake incident data.

import XLSX from 'xlsx'
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'data-source', 'WAGA_iFactory_Portal_Data_Import_VERIFIED.xlsx')
const out = join(root, 'components', 'industries', 'waga', 'lib', 'data')

// Excel stores dates as a day count from 1899-12-30. Converted to an ISO date
// string rather than a Date so the generated modules stay plain JSON, and left
// untouched when the cell was already text — several deadline columns are prose
// ("180 days before expiration") and have to survive as prose.
const excelDate = (v) => {
  if (typeof v !== 'number') return String(v ?? '').trim()
  return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10)
}

const str = (v) => String(v ?? '').trim()
const bool = (v) => str(v).toLowerCase() === 'true'

const wb = XLSX.readFile(src)
const sheet = (name) => XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' })

// ── sheets to modules ────────────────────────────────────────────────────
const SITES = sheet('Sites').map((r) => ({
  siteId: str(r.site_id),
  code: str(r.site_code),
  legalEntity: str(r.legal_entity),
  siteName: str(r.site_name),
  address: str(r.address),
  city: str(r.city),
  state: str(r.state),
  zip: str(r.zip),
  country: str(r.country),
  status: str(r.status),
}))

const PERMITS = sheet('Permits').map((r) => ({
  permitId: str(r.permit_id),
  siteId: str(r.site_id),
  permitType: str(r.permit_type),
  permitTitle: str(r.permit_title),
  permitNumber: str(r.permit_number),
  agency: str(r.agency),
  program: str(r.program),
  issueDate: excelDate(r.issue_date),
  expirationDate: excelDate(r.expiration_date),
  renewalDeadline: excelDate(r.renewal_deadline),
  status: str(r.status),
  sourceFile: str(r.source_file),
  notes: str(r.notes),
}))

const REQUIREMENTS = sheet('Compliance_Requirements').map((r) => ({
  requirementId: str(r.requirement_id),
  siteId: str(r.site_id),
  permitId: str(r.permit_id),
  category: str(r.category),
  name: str(r.requirement_name),
  frequency: str(r.frequency),
  deadlineRule: str(r.deadline_rule),
  responsibleParty: str(r.responsible_party),
  regulatorySource: str(r.regulatory_source),
  submissionMethod: str(r.submission_method),
  retentionRule: str(r.retention_rule),
  active: str(r.active) === '' ? true : bool(r.active),
}))

// Carried with the source_or_demo label intact. Anything not marked as a source
// deadline is an example, and every screen has to be able to say which.
const WORKBOOK_TASKS = sheet('Compliance_Tasks').map((r) => ({
  taskId: str(r.task_id),
  requirementId: str(r.requirement_id),
  siteId: str(r.site_id),
  title: str(r.task_title),
  period: str(r.period),
  dueDate: excelDate(r.due_date),
  status: str(r.status),
  assignee: str(r.assignee),
  completionDate: excelDate(r.completion_date),
  evidenceRef: str(r.evidence_ref),
  provenance: str(r.source_or_demo),
}))

const PARAMETERS = sheet('Parameters_Limits').map((r) => ({
  parameterId: str(r.parameter_id),
  siteId: str(r.site_id),
  permitId: str(r.permit_id),
  scope: str(r.equipment_or_scope),
  parameter: str(r.parameter),
  limitText: str(r.limit_text),
  unit: str(r.unit),
  alertThresholdPct: r.alert_threshold_pct === '' ? null : Number(r.alert_threshold_pct),
  source: str(r.source),
  dataMode: str(r.data_mode),
}))

const DEVIATIONS = sheet('Deviations').map((r) => ({
  deviationId: str(r.deviation_id),
  siteId: str(r.site_id),
  permitId: str(r.permit_id),
  monitoringMethod: str(r.monitoring_method),
  description: str(r.description),
  eventDate: excelDate(r.event_date),
  duration: str(r.duration),
  cause: str(r.cause),
  correctiveAction: str(r.corrective_action),
  status: str(r.status),
  source: str(r.source),
}))

const SAFETY_FIELDS = sheet('Safety_Checklist_Template').map((r) => ({
  fieldId: str(r.field_id),
  section: str(r.section),
  label: str(r.field_label),
  fieldType: str(r.field_type),
  requirement: str(r.required_or_conditional),
  options: str(r.options_or_notes),
  sourcePage: str(r.source_page),
}))

const TRAINING = sheet('Training_Requirements').map((r) => ({
  trainingId: str(r.training_id),
  name: str(r.training_name),
  appliesTo: str(r.applies_to),
  frequency: str(r.frequency),
  required: bool(r.required),
  source: str(r.source),
}))

// Kept so the Incident screen can say what it is waiting for, in the workbook's
// own words, rather than showing an empty table with no explanation.
const INCIDENTS = sheet('Incidents_RCA')
  .map((r) => ({
    incidentId: str(r.incident_id),
    status: str(r.status),
    description: str(r.description),
  }))
  .filter((r) => r.incidentId)

const VERIFICATION = sheet('Verification_Log').map((r) => ({
  checkId: str(r.check_id),
  area: str(r.area),
  v1Result: str(r.v1_result),
  verifiedSource: str(r.verified_source),
  verification: str(r.verification),
  actionTaken: str(r.action_taken),
  productionNote: str(r.production_note),
  confidence: str(r.confidence),
}))

// The README sheet is two columns: a label whose text repeats the workbook name
// before a colon, and the note itself. Only the part after the colon is the
// topic, which is why it is split here rather than carried whole.
const README = sheet('README').map((r) => {
  const keys = Object.keys(r)
  return { topic: str(r[keys[0]]).split(':').pop().trim(), text: str(r[keys[1]]) }
}).filter((r) => r.text)

// ── write ────────────────────────────────────────────────────────────────
const banner = (what) => `// GENERATED by scripts/import-waga-workbook.mjs — do not edit by hand.
// Source: data-source/WAGA_iFactory_Portal_Data_Import_VERIFIED.xlsx (${what})
//
// Empty strings are fields the source documents did not provide. They are not
// missing data waiting to be filled in; the workbook is explicit that they must
// not be invented.
`

const write = (file, what, exports) => {
  const body = Object.entries(exports)
    .map(([name, rows]) => `export const ${name} = ${JSON.stringify(rows, null, 2)}\n`)
    .join('\n')
  writeFileSync(join(out, file), banner(what) + '\n' + body)
  const counts = Object.entries(exports).map(([n, r]) => `${n}=${r.length}`).join(' ')
  console.log(`  ${file.padEnd(18)} ${counts}`)
}

console.log(`reading ${src}\n`)
write('sites.js', 'Sites', { SITES })
write('permits.js', 'Permits', { PERMITS })
write('requirements.js', 'Compliance_Requirements', { REQUIREMENTS })
write('tasks.js', 'Compliance_Tasks', { WORKBOOK_TASKS })
write('parameters.js', 'Parameters_Limits', { PARAMETERS })
write('deviations.js', 'Deviations', { DEVIATIONS })
write('safety.js', 'Safety_Checklist_Template + Training_Requirements + Incidents_RCA',
  { SAFETY_FIELDS, TRAINING, INCIDENTS })
write('provenance.js', 'README + Verification_Log', { README, VERIFICATION })
console.log('\ndone.')
