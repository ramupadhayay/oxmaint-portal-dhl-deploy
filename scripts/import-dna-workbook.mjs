// Turns the DNA Technical Fabrics demo workbook into the portal's data modules.
//
// Run with `npm run import:dna` after the workbook changes. The generated files
// are committed, so the app never parses a spreadsheet at runtime and xlsx stays
// a devDependency — the same trade the FSM and WAGA importers make.
//
// Two things about this workbook's shape.
//
// Every sheet carries a one-line description in row 1 and its column headers in
// row 2, so the header row is read explicitly rather than letting the parser
// assume row 1. Left to itself it produces a table whose columns are all named
// `__EMPTY`, which fails silently — every field reads as undefined and the
// screens render a register full of blanks.
//
// And unlike the WAGA workbook, this data is openly fictional. Its own Read Me
// says "Data is fictional but modeled on the actual DNA Technical Fabrics
// process" and the covering document tells engineering to "treat every ID, date,
// and quantity below as sample data, not production data". That is why the dates
// here may be anchored forward at read time — see lib/data/index.js. The values
// written below are always the sheet's own; nothing is shifted on the way in.

import XLSX from 'xlsx'
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'data-source', 'DNA_CMMS_Master_Data.xlsx')
const out = join(root, 'components', 'industries', 'dna', 'lib', 'data')

const wb = XLSX.readFile(src)

// Row 0 is the sheet's description, row 1 the headers, row 2 onward the data.
const table = (name) => {
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', blankrows: false })
  const headers = (aoa[1] || []).map((h) => String(h).trim())
  return aoa.slice(2).map((row) =>
    Object.fromEntries(headers.map((h, i) => [h, typeof row[i] === 'string' ? row[i].trim() : row[i]]))
  )
}

const str = (v) => String(v ?? '').trim()
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v))

// Excel dates arrive as text in this workbook, already ISO. Serial numbers are
// handled anyway so a re-save from Excel — which converts them — does not break
// the import silently.
const date = (v) => {
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10)
  return str(v)
}

// "2026-08-20 09:15" — kept as written rather than parsed to a Date, so the
// generated modules stay plain JSON and no timezone is applied to a plant-floor
// clock reading.
const stamp = (v) => {
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 16).replace('T', ' ')
  return str(v)
}

// ── sheets to modules ────────────────────────────────────────────────────
const LOCATIONS = table('Locations').map((r) => ({
  code: str(r['Location Code']),
  name: str(r['Location Name']),
  type: str(r.Type),
  // The site row carries "-" for its parent. Normalised to empty, so "has no
  // parent" is one test rather than two.
  parent: str(r['Parent Location']) === '-' ? '' : str(r['Parent Location']),
  description: str(r['Description / Address']),
}))

const ASSETS = table('Assets').map((r) => ({
  assetId: str(r['Asset ID']),
  name: str(r['Asset Name']),
  category: str(r.Category),
  locationCode: str(r.Location),
  manufacturer: str(r.Manufacturer),
  model: str(r.Model),
  serial: str(r['Serial No.']),
  installDate: date(r['Install Date']),
  criticality: str(r.Criticality),
  status: str(r.Status),
}))

const PARTS = table('Parts_Inventory').map((r) => ({
  partNo: str(r['Part No.']),
  name: str(r['Part Name']),
  category: str(r.Category),
  // "AST-1201/1202/1203" — one string in the sheet, split here so a part can be
  // found from an asset without every screen re-parsing it. The suffix form is
  // expanded to full ids: the sheet abbreviates after the first.
  compatible: expandAssets(str(r['Compatible Asset(s)'])),
  compatibleRaw: str(r['Compatible Asset(s)']),
  storeroom: str(r['Storeroom Location']),
  qtyOnHand: num(r['Qty on Hand']),
  reorderPoint: num(r['Reorder Point']),
  reorderQty: num(r['Reorder Qty']),
  unitCost: num(r['Unit Cost (USD)']),
  supplier: str(r.Supplier),
}))

// "AST-1201/1202/1203/1204" -> ["AST-1201","AST-1202","AST-1203","AST-1204"]
// "General" -> [] , because it names no asset at all.
function expandAssets(raw) {
  if (!raw || raw.toLowerCase() === 'general') return []
  const parts = raw.split('/').map((s) => s.trim()).filter(Boolean)
  const out = []
  let prefix = ''
  parts.forEach((p) => {
    if (p.includes('-')) { prefix = p.split('-')[0]; out.push(p) }
    else if (prefix) out.push(`${prefix}-${p}`)
  })
  return out
}

const WORK_ORDERS = table('Work_Orders').map((r) => ({
  woNo: str(r['WO No.']),
  title: str(r.Title),
  assetId: str(r.Asset),
  locationCode: str(r.Location),
  type: str(r.Type),
  priority: str(r.Priority),
  status: str(r.Status),
  assignedTo: str(r['Assigned To']),
  requestedBy: str(r['Requested By']),
  dateRequested: date(r['Date Requested']),
  dueDate: date(r['Due Date']),
  dateCompleted: date(r['Date Completed']),
  aiEstimateHrs: num(r['AI Est. Duration (hrs)']),
  actualHrs: num(r['Actual Duration (hrs)']),
  description: str(r.Description),
}))

const PM_SCHEDULES = table('PM_Schedules').map((r) => ({
  pmId: str(r['PM ID']),
  assetId: str(r.Asset),
  task: str(r['PM Task']),
  frequency: str(r.Frequency),
  lastDone: date(r['Last Done']),
  nextDue: date(r['Next Due']),
  estimateHrs: num(r['Est. Duration (hrs)']),
  team: str(r['Assigned Team']),
  checklist: str(r['Checklist Summary']),
}))

const USERS = table('Users_Teams').map((r) => ({
  userId: str(r['User ID']),
  name: str(r.Name),
  role: str(r.Role),
  department: str(r.Department),
  team: str(r.Team),
  shift: str(r.Shift),
  // "Loom mechanical, electrical basics" — a comma list, split so the roster can
  // be searched by skill rather than by substring.
  skills: str(r.Skills).split(',').map((s) => s.trim()).filter(Boolean),
}))

// Purchase orders. The printed source put "4 of 8" in the Received Date column
// for the one partial delivery, because it had nowhere else to record how much
// arrived; the sheet in this workbook splits that into its own Qty Received
// column so no screen has to read a quantity out of a date field.
const PURCHASE_ORDERS = table('Purchase_Orders').map((r) => ({
  poNo: str(r['PO No.']),
  partNo: str(r['Part No.']),
  partName: str(r['Part Name']),
  vendor: str(r.Vendor),
  qtyOrdered: num(r['Qty Ordered']),
  unitCost: num(r['Unit Cost (USD)']),
  totalCost: num(r['Total Cost (USD)']),
  status: str(r.Status),
  orderDate: date(r['Order Date']),
  expectedDate: date(r['Expected Delivery']),
  receivedDate: date(r['Received Date']),
  qtyReceived: num(r['Qty Received']),
  requestedBy: str(r['Requested By']),
  linkedTo: str(r['Linked To']),
}))

const DOWNTIME = table('Downtime_Log').map((r) => ({
  logId: str(r['Log ID']),
  assetId: str(r.Asset),
  locationCode: str(r.Location),
  start: stamp(r['Start Time']),
  end: stamp(r['End Time']),
  hours: num(r['Duration (hrs)']),
  reason: str(r['Reason Code']),
  category: str(r.Category),
  reportedBy: str(r['Reported By']),
}))

// The Read Me, carried so the Source screen can show the brief in its own words
// rather than a paraphrase of it.
const README = XLSX.utils
  .sheet_to_json(wb.Sheets['Read Me'], { header: 1, defval: '', blankrows: false })
  .map((r) => r.map((c) => String(c).trim()).filter(Boolean).join(' '))
  .filter(Boolean)

// ── write ────────────────────────────────────────────────────────────────
const banner = (what) => `// GENERATED by scripts/import-dna-workbook.mjs — do not edit by hand.
// Source: data-source/DNA_CMMS_Master_Data.xlsx (${what})
//
// Values are the sheet's own. Dates are stored exactly as supplied; any shift
// applied for the demo happens at read time in lib/data/index.js, so this file
// stays comparable to the workbook line for line.
`

const write = (file, what, exports) => {
  const body = Object.entries(exports)
    .map(([name, rows]) => `export const ${name} = ${JSON.stringify(rows, null, 2)}\n`)
    .join('\n')
  writeFileSync(join(out, file), banner(what) + '\n' + body)
  console.log(`  ${file.padEnd(16)} ${Object.entries(exports).map(([n, r]) => `${n}=${r.length}`).join(' ')}`)
}

console.log(`reading ${src}\n`)
write('locations.js', 'Locations', { LOCATIONS })
write('assets.js', 'Assets', { ASSETS })
write('parts.js', 'Parts_Inventory', { PARTS })
write('workOrders.js', 'Work_Orders', { WORK_ORDERS })
write('pmSchedules.js', 'PM_Schedules', { PM_SCHEDULES })
write('users.js', 'Users_Teams', { USERS })
write('downtime.js', 'Downtime_Log', { DOWNTIME })
write('purchaseOrders.js', 'Purchase_Orders', { PURCHASE_ORDERS })
write('readme.js', 'Read Me', { README })

// A cheap integrity pass, printed rather than thrown. Every one of these was
// clean on the supplied workbook; a later edit that breaks a reference should be
// visible at import time rather than as an empty cell three screens away.
const assetIds = new Set(ASSETS.map((a) => a.assetId))
const locCodes = new Set(LOCATIONS.map((l) => l.code))
const dangling = (rows, key, set, label) => {
  const bad = [...new Set(rows.map((r) => r[key]).filter((v) => v && !set.has(v)))]
  console.log(`  ${label.padEnd(28)} ${bad.length ? bad.join(', ') : 'none'}`)
}
console.log('\nintegrity:')
dangling(WORK_ORDERS, 'assetId', assetIds, 'work orders -> asset')
dangling(PM_SCHEDULES, 'assetId', assetIds, 'pm schedules -> asset')
dangling(DOWNTIME, 'assetId', assetIds, 'downtime -> asset')
dangling(ASSETS, 'locationCode', locCodes, 'assets -> location')
dangling(USERS, 'department', locCodes, 'users -> department')
const partNos = new Set(PARTS.map((p) => p.partNo))
const userNames = new Set(USERS.map((u) => u.name))
dangling(PURCHASE_ORDERS, 'partNo', partNos, 'purchase orders -> part')
dangling(PURCHASE_ORDERS, 'requestedBy', userNames, 'purchase orders -> requester')

// A PO whose unit cost has drifted from the catalogue would quietly make the
// two screens disagree on what a part costs.
const costDrift = PURCHASE_ORDERS.filter((po) => {
  const part = PARTS.find((p) => p.partNo === po.partNo)
  return part && part.unitCost !== null && Math.abs(part.unitCost - po.unitCost) > 0.005
})
console.log(`  ${'po unit cost vs catalogue'.padEnd(28)} ${costDrift.length ? costDrift.map((p) => p.poNo).join(', ') : 'none'}`)

const lineTotals = PURCHASE_ORDERS.filter((po) => Math.abs(po.qtyOrdered * po.unitCost - po.totalCost) > 0.005)
console.log(`  ${'po qty x unit vs total'.padEnd(28)} ${lineTotals.length ? lineTotals.map((p) => p.poNo).join(', ') : 'none'}`)

const badParts = PARTS.flatMap((p) => p.compatible.filter((a) => !assetIds.has(a)))
console.log(`  ${'parts -> asset'.padEnd(28)} ${badParts.length ? [...new Set(badParts)].join(', ') : 'none'}`)

console.log('\ndone.')
