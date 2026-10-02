// Turns the DHL CVG GSE five-year workbook into the portal's data modules.
//
//   npm run import:dhl
//
// Run after the workbook changes. The generated files are committed, so the app
// never parses a spreadsheet at runtime — the same trade the DNA, HEPA, WAGA and
// FSM importers make.
//
// WHAT THIS WORKBOOK IS. Its own cover says it: a representative five-year
// extract for DHL Express CVG ground support equipment, "synthetic but
// operationally patterned. Not DHL confidential actuals." It was built to
// exercise the functional requirements on the Oxmaint GSE notes sheet. Values
// written below are the sheet's own; dates are stored as the sheet gives them
// and any shift for the demo happens at read time in dhl-gse-data/index.js, so
// every generated file stays comparable to the workbook line for line.
//
// FOUR THINGS ABOUT ITS SHAPE.
//
// Every data sheet opens with a banner, a title and a description before its
// header row. The header is found as the first row with at least four filled
// cells rather than assumed, because a parser left to guess names every column
// `__EMPTY` and the register renders as blanks with no error.
//
// Dates arrive as Excel serial numbers. They are converted by column name —
// a date column to YYYY-MM-DD, a timestamp column to "YYYY-MM-DD HH:mm" — and
// a number in any other column is left as the number it is. Converting every
// number that looks like a date is how 117 daily flights became 26 April 1900.
//
// 02_Fleet_Snapshot carries a second, narrower table to the right of the main
// one, reusing the header "Class". Only the first eight columns are read.
//
// The live register only needs the last year. Five years of work orders,
// labour, parts and notes is ~5.7 MB of JSON, and a portal cannot ship that to
// every page. So the work order module holds the twelve months to the as-of date
// plus anything still open, and the other four years are folded into per-asset
// history (last service per template, come-backs, cost, downtime) and a monthly
// series — small, exact, and computed from every row.

import XLSX from 'xlsx'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_NAME = 'DHL_CVG_GSE_5Year_CMMS_Demo.xlsx'
const src = join(root, 'data-source', SRC_NAME)
const out = join(root, 'components', 'industries', 'oxmaint', 'lib', 'packs', 'dhl-gse-data')
mkdirSync(out, { recursive: true })

const wb = XLSX.readFile(src)

// ── cell conversion ──────────────────────────────────────────────────────
const DAY = 86400000
const serialToMs = (v) => Math.round((v - 25569) * DAY / 60000) * 60000
const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10)
const isoStamp = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ')

// Column names that hold a calendar day, and ones that hold a moment.
const DATE_COLS = new Set([
  'InServiceDate', 'WarrantyEndDate', 'HireDate', 'LastCountDate', 'ReadingDate',
  'CreatedDate', 'ReceivedDate', 'NeedBy', 'InstallDate', 'ClaimDate', 'CountDate',
  // The SAP layer's own dates: material documents, and the purchase-requisition
  // to goods-receipt thread. A serial left unconverted reaches a screen as
  // 45501 and a date formatter throws on it.
  'PostingDate', 'PR_Date', 'Release_Date', 'PO_Date', 'Inbound_Date', 'GR_Date',
  // The stock-value path is monthly, written as the first of the month.
  'Month',
])
const STAMP_COLS = new Set(['CreatedAt', 'ClosedAt', 'TimeStart', 'TimeStop', 'NoteTime', 'OOSStart', 'OOSEnd'])

function convert(header, v) {
  if (typeof v === 'string') return v.trim()
  if (v === '' || v === null || v === undefined) return ''
  if (typeof v === 'number') {
    if (DATE_COLS.has(header)) return isoDate(serialToMs(v))
    if (STAMP_COLS.has(header)) return isoStamp(serialToMs(v))
  }
  return v
}

function table(name, { maxCols = Infinity } = {}) {
  const ws = wb.Sheets[name]
  if (!ws) throw new Error(`Sheet ${name} is missing from ${SRC_NAME}.`)
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false, raw: true })
  const hi = aoa.findIndex((r) => r.filter((c) => String(c).trim()).length >= 4)
  if (hi < 0) throw new Error(`${name}: no header row found.`)
  const headers = aoa[hi].slice(0, maxCols).map((h) => String(h).trim())
  return aoa.slice(hi + 1)
    .map((row) => row.slice(0, maxCols))
    .filter((row) => row.some((c) => String(c).trim()))
    .map((row) => {
      const rec = {}
      headers.forEach((h, i) => { if (h) rec[h] = convert(h, row[i]) })
      return rec
    })
}

// The insight and planning sheets stack several tables under one banner, each
// introduced by its own sentence.
//
// They are read as blocks rather than by row number: a line with one cell in it
// is a title or a note and closes the table above it, so the next row with
// several cells starts a new header. Reading by row number breaks the moment a
// sheet gains a section; reading to the next blank line is worse still, because
// these tables sit directly on top of each other and a whole second table then
// arrives as data rows of the first. A block is then picked by the columns it
// carries, not by its position.
function blocksOf(name) {
  const ws = wb.Sheets[name]
  if (!ws) throw new Error(`Sheet ${name} is missing from ${SRC_NAME}.`)
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: true, raw: true })
  const blocks = []
  const notes = []
  let current = null
  for (const row of aoa) {
    const filled = row.filter((c) => String(c).trim()).length
    if (filled <= 1) {
      // A sentence on its own line: the page's own commentary, worth keeping.
      const text = String(row.find((c) => String(c).trim()) || '').trim()
      if (text.length > 60) notes.push(text)
      current = null
      continue
    }
    if (!current) {
      current = { headers: row.map((h) => String(h).trim()), rows: [] }
      blocks.push(current)
      continue
    }
    const rec = {}
    current.headers.forEach((h, k) => { if (h) rec[h] = convert(h, row[k]) })
    current.rows.push(rec)
  }
  return { blocks, notes }
}

const sheetCache = new Map()
const sheetBlocks = (name) => {
  if (!sheetCache.has(name)) sheetCache.set(name, blocksOf(name))
  return sheetCache.get(name)
}

function section(name, mustHave, { nth = 0 } = {}) {
  const { blocks } = sheetBlocks(name)
  const hits = blocks.filter((b) => mustHave.every((h) => b.headers.includes(h)))
  const hit = hits[nth]
  if (!hit) throw new Error(`${name}: no table with columns ${mustHave.join(', ')}${nth ? ` (#${nth + 1})` : ''}.`)
  return hit.rows
}

/** The sentences a sheet writes between its tables. */
const sectionNotes = (name) => sheetBlocks(name).notes

// ── read ─────────────────────────────────────────────────────────────────
const assets = table('03_Assets')
const users = table('04_Users')
const parts = table('05_Parts_Master')
const pmStandards = table('07_PM_Standards')
const manuals = table('08_Manuals')
const meters = table('09_Meter_Readings')
const workOrders = table('10_Work_Orders')
const pos = table('14_Purchase_Orders')
const poLines = table('15_PO_Lines')
const oos = table('18_OOS_Log')
const woLabour = table('11_WO_Labor')
const woParts = table('12_WO_Parts')
const woNotes = table('13_WO_Notes')
const kitLines = table('06_Parts_Kits')
const claims = table('16_Warranty_Claims')
const counts = table('17_Inventory_Counts')
const assumptions = table('01_Assumptions')

// ── SAP, the insight sheets and the forward plan (added in the 2026-09 book) ──
const sapOrg = table('23_SAP_Org')
const goodsMovements = table('24_SAP_GoodsMovements')
// Threads, and — under them on the same tab — the volume path the plan
// assumes. One is five years of documents, the other is a target; they are read
// apart so a screen can never show them as one series.
const p2pThreads = section('34_S4HANA_P2P', ['ThreadID', 'Trigger', 'PR_BANFN'])
const p2pVolumePlan = section('34_S4HANA_P2P', ['Year', 'PRs_from_CMMS'])

// The story sheet carries two more tables under its year-by-year one: what the
// system changes seen four ways, and the growth the trajectory assumes.
const STORY_LENSES = section('30_Next5Yr_Story', ['Lens'])
const GROWTH = section('30_Next5Yr_Story', ['Item'])
const BAND_PROJECTION = section('33_Workmanship_Quality', ['Band', '2026A', '2031'])

const INSIGHTS = {
  technicians: section('25_Insights_Technicians', ['Rank', 'UserID', 'ComebackRate']),
  technicianYears: section('25_Insights_Technicians', ['Year', 'UserID', 'ComebackRate']),
  oemType: section('26_Insights_OEM_Type', ['Manufacturer', 'EquipmentType', 'UnschedPerAssetYr', 'DowntimeHrs']),
  oemNightBank: section('26_Insights_OEM_Type', ['Manufacturer', 'EquipmentType', 'UnschedPerAssetYr'], { nth: 2 }),
  pmBands: section('27_Insights_PM_Cycle', ['CompBand', 'AssetYears', 'AvgUnsched']),
  stableOwner: section('27_Insights_PM_Cycle', ['StableOwner', 'Assets', 'AvgUnscheduled']),
  assetYears: section('27_Insights_PM_Cycle', ['AssetID', 'Year', 'PMCompliance', 'CompBand']),
  abc: section('28_Insights_Inventory_SAP', ['ABC', 'SKUs', 'On-hand value']),
  stockPath: section('28_Insights_Inventory_SAP', ['Month', 'Plant', 'StockValueUSD']),
}
// The fleet snapshot's first table only; a class summary sits to its right.
// Its last row is the grand total, laid across the same columns ("Grand total
// units" under Class, the count under EquipmentType); a type is a name.
const fleet = table('02_Fleet_Snapshot', { maxCols: 8 })
  .filter((r) => typeof r.EquipmentType === 'string' && r.EquipmentType && !/total/i.test(r.Class))

// The as-of date, from the cover's own "Window" line.
const cover = XLSX.utils.sheet_to_json(wb.Sheets['00_Cover'], { header: 1, defval: '', raw: false })
const windowLine = cover.map((r) => r.join(' ')).find((l) => /Window/.test(l) && /through/.test(l)) || ''
const [, windowStart, asOf] = windowLine.match(/(\d{4}-\d{2}-\d{2})\s+through\s+(\d{4}-\d{2}-\d{2})/) || []
if (!asOf) throw new Error('Could not read the as-of date from 00_Cover.')

const asOfMs = Date.parse(`${asOf}T23:59:00Z`)
const stampMs = (s) => (s ? Date.parse(`${String(s).replace(' ', 'T')}:00Z`) : 0)
const dayMs = (s) => (s ? Date.parse(`${s}T00:00:00Z`) : 0)
const yearAgo = asOfMs - 365 * DAY

// ── sanity: the rows the cover says are there ────────────────────────────
const expect = { assets: 150, users: 25, parts: 74, workOrders: 2769 }
const got = { assets: assets.length, users: users.length, parts: parts.length, workOrders: workOrders.length }
for (const k of Object.keys(expect)) {
  if (got[k] !== expect[k]) console.warn(`  note: ${k} ${got[k]} rows (cover declares ${expect[k]})`)
}

// ── per-asset history from all five years ───────────────────────────────
const history = new Map(assets.map((a) => [a.AssetID, {
  pmLast: {}, pmCount: {}, assignees: {}, workOrders5y: 0, cost5y: 0, downtime5y: 0,
  comebacks5y: 0, unscheduled12m: 0, oosEvents12m: 0, oosHours12m: 0, lastClosed: '', lastReading: null,
}]))

for (const w of workOrders) {
  const h = history.get(w.AssetID)
  if (!h) continue
  h.workOrders5y += 1
  h.cost5y += Number(w.TotalCostUSD) || 0
  h.downtime5y += Number(w.DowntimeHours) || 0
  if (w.Comeback === 'Yes') h.comebacks5y += 1
  if (w.Type === 'Unscheduled' && stampMs(w.CreatedAt) >= yearAgo) h.unscheduled12m += 1
  if (w.ClosedAt && w.ClosedAt > h.lastClosed) h.lastClosed = w.ClosedAt
  if (w.Type === 'Preventive' && w.TemplateID) {
    const t = w.TemplateID
    h.pmCount[t] = (h.pmCount[t] || 0) + 1
    const when = w.ClosedAt || w.CreatedAt
    if (!h.pmLast[t] || when > h.pmLast[t].at) h.pmLast[t] = { at: when, meter: Number(w.MeterAtOpen) || null }
    if (w.AssignedTo) h.assignees[w.AssignedTo] = (h.assignees[w.AssignedTo] || 0) + 1
  }
}
for (const o of oos) {
  const h = history.get(o.AssetID)
  if (!h || stampMs(o.OOSStart) < yearAgo) continue
  h.oosEvents12m += 1
  if (o.OOSEnd) h.oosHours12m += Math.max(0, (stampMs(o.OOSEnd) - stampMs(o.OOSStart)) / 3600000)
}
for (const m of meters) {
  const h = history.get(m.AssetID)
  if (!h) continue
  if (!h.lastReading || m.ReadingDate > h.lastReading.date) {
    h.lastReading = { date: m.ReadingDate, reading: Number(m.Reading) || 0, source: m.Source }
  }
}

const round2 = (n) => Math.round(n * 100) / 100
const assetsOut = assets.map((a) => {
  const h = history.get(a.AssetID)
  const topAssignee = Object.entries(h.assignees).sort((x, y) => y[1] - x[1])[0]?.[0] || ''
  return {
    ...a,
    _history: {
      pmLast: h.pmLast,
      pmCount: h.pmCount,
      topPreventiveAssignee: topAssignee,
      workOrders5y: h.workOrders5y,
      cost5y: round2(h.cost5y),
      downtime5y: round2(h.downtime5y),
      comebacks5y: h.comebacks5y,
      unscheduled12m: h.unscheduled12m,
      oosEvents12m: h.oosEvents12m,
      oosHours12m: round2(h.oosHours12m),
      lastClosed: h.lastClosed,
      lastReading: h.lastReading,
    },
  }
})

// ── the live register: twelve months plus anything still open ────────────
const liveWorkOrders = workOrders
  .filter((w) => w.Status !== 'Closed' || stampMs(w.CreatedAt) >= yearAgo)
  .sort((x, y) => (x.CreatedAt < y.CreatedAt ? 1 : -1))

// ── what sits behind each live work order ───────────────────────────────
//
// Labour lines, parts issued, notes and out-of-service entries for the jobs the
// register shows — written to their own module, which the work order page loads
// when one is opened rather than every page loading all of it.
//
// Come-back links are checked rather than trusted. A come-back is a second job on
// the same unit after the first, inside the window the assumptions sheet sets, so
// a link whose parent was raised *after* its child cannot be read as one. Those
// are counted and reported below, and marked, so the screen can call them related
// work orders rather than assert a sequence the dates contradict.
const liveIds = new Set(liveWorkOrders.map((w) => w.WorkOrderID))
const allById = new Map(workOrders.map((w) => [w.WorkOrderID, w]))
const summary = (w) => (w ? {
  WorkOrderID: w.WorkOrderID, CreatedAt: w.CreatedAt, FailureDesc: w.FailureDesc,
  TemplateID: w.TemplateID, Status: w.Status, Type: w.Type,
} : null)
const detail = {}
const slot = (id) => {
  if (!detail[id]) detail[id] = { Labor: [], Parts: [], Notes: [], OOS: [], Parent: null, ParentAfterChild: false, Children: [] }
  return detail[id]
}
for (const l of woLabour) if (liveIds.has(l.WorkOrderID)) slot(l.WorkOrderID).Labor.push(l)
for (const p of woParts) if (liveIds.has(p.WorkOrderID)) slot(p.WorkOrderID).Parts.push(p)
for (const n of woNotes) if (liveIds.has(n.WorkOrderID)) slot(n.WorkOrderID).Notes.push(n)
for (const o of oos) if (o.WorkOrderID && liveIds.has(o.WorkOrderID)) slot(o.WorkOrderID).OOS.push(o)

const links = { comebacks: 0, withParent: 0, parentMissing: 0, parentAfterChild: 0, outsideWindow: 0 }
for (const w of workOrders) {
  if (w.Comeback === 'Yes') links.comebacks += 1
  if (!w.ParentWO) continue
  links.withParent += 1
  const parent = allById.get(w.ParentWO)
  if (!parent) { links.parentMissing += 1; continue }
  const inverted = parent.CreatedAt > w.CreatedAt
  if (inverted) links.parentAfterChild += 1
  else if (stampMs(w.CreatedAt) - stampMs(parent.CreatedAt) > 30 * DAY) links.outsideWindow += 1
  if (liveIds.has(w.WorkOrderID)) {
    const d = slot(w.WorkOrderID)
    d.Parent = summary(parent)
    d.ParentAfterChild = inverted
  }
  if (liveIds.has(parent.WorkOrderID)) slot(parent.WorkOrderID).Children.push({ ...summary(w), ParentAfterChild: inverted })
}

// ── purchase orders with their lines ─────────────────────────────────────
const linesByPo = new Map()
for (const l of poLines) {
  const list = linesByPo.get(l.PurchaseOrderID) || []
  list.push(l)
  linesByPo.set(l.PurchaseOrderID, list)
}
const posOut = pos.map((p) => ({ ...p, Lines: linesByPo.get(p.PurchaseOrderID) || [] }))

// ── twelve months of activity, from every row ────────────────────────────
const monthKey = (ms) => new Date(ms).toISOString().slice(0, 7)
const months = []
{
  const d = new Date(asOfMs)
  for (let i = 11; i >= 0; i -= 1) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1))
    months.push({ month: monthKey(m.getTime()), raised: 0, completed: 0, downtime_hours: 0, cost: 0, preventive: 0, unscheduled: 0, comebacks: 0 })
  }
}
const byMonth = new Map(months.map((m) => [m.month, m]))
for (const w of workOrders) {
  const created = byMonth.get(monthKey(stampMs(w.CreatedAt)))
  if (created) {
    created.raised += 1
    created.downtime_hours += Number(w.DowntimeHours) || 0
    created.cost += Number(w.TotalCostUSD) || 0
    if (w.Type === 'Preventive') created.preventive += 1
    else created.unscheduled += 1
    if (w.Comeback === 'Yes') created.comebacks += 1
  }
  if (w.ClosedAt) {
    const closed = byMonth.get(monthKey(stampMs(w.ClosedAt)))
    if (closed) closed.completed += 1
  }
}
for (const m of months) { m.downtime_hours = round2(m.downtime_hours); m.cost = Math.round(m.cost) }

// ── the fleet the sample stands for ──────────────────────────────────────
const classTotals = {}
let replacementValue = 0
for (const f of fleet) {
  classTotals[f.Class] = (classTotals[f.Class] || 0) + (Number(f.FleetCount_CVG) || 0)
  replacementValue += Number(f.EstReplacementValueUSD) || 0
}

const META = {
  source: SRC_NAME,
  asOf,
  windowStart,
  liveWindowDays: 365,
  counts: {
    assets: assets.length, users: users.length, parts: parts.length, manuals: manuals.length,
    meterReadings: meters.length, workOrders: workOrders.length, liveWorkOrders: liveWorkOrders.length,
    purchaseOrders: pos.length, poLines: poLines.length, oos: oos.length,
  },
  fleet,
  classTotals,
  replacementValue: Math.round(replacementValue),
  monthly: months,
}

// ── parts, warranty, stores and people: the reliability modules ──────────
//
// Four screens read these — warranty recovery, parts kits and sourcing, cycle
// counts, technician KPIs — and nothing else does, so they are one module the
// screens load when opened.
//
// TWO THINGS ARE DERIVED RATHER THAN READ.
//
// A warranty candidate is found from the install history, not the sheet's
// RepeatInstallFlag. The flag is set on 2,710 of 5,585 part lines, routine PM
// filters included, and a recovery queue built on it would ask an analyst to
// claim half the parts room. A candidate here is the same part, on the same unit,
// replaced on an unscheduled job inside both its warranty and its typical life —
// a part that failed early, which is what a vendor pays for. Lines already on a
// claim are not candidates.
//
// OEM or aftermarket is read from the price paid. Every issue line is at the
// part's OEM cost from its preferred vendor or at the alternate cost from its
// alternate vendor; the vendor name alone cannot say which, because for some
// parts the two are the same supplier.

const assume = (label) => Number(assumptions.find((r) => r.Parameter === label)?.Value) || null
const TARGETS = {
  wrenchTime: assume('Technician wrench-time target'),
  comebackRate: assume('Come-back rate target (internal)'),
  comebackWindowDays: assume('Come-back window'),
  aftermarketShare: assume('Aftermarket buy share'),
}

const partById = new Map(parts.map((x) => [x.PartID, x]))
const channelOf = (line) => {
  const part = partById.get(line.PartID)
  if (!part) return 'oem'
  return Math.abs(Number(line.UnitCostUSD) - Number(part.AltVendorUnitCostUSD)) < 0.02
    && Math.abs(Number(line.UnitCostUSD) - Number(part.OEMUnitCostUSD)) >= 0.02 ? 'alt' : 'oem'
}

// Kits, one row each with their lines.
const kits = []
for (const l of kitLines) {
  let kit = kits.find((k) => k.KitID === l.KitID)
  if (!kit) { kit = { KitID: l.KitID, KitName: l.KitName, KitType: l.KitType, Lines: [] }; kits.push(kit) }
  kit.Lines.push({ PartID: l.PartID, SKU: l.SKU, Qty: Number(l.QtyPerKit) || 1 })
}
const kitIssues = {}
for (const line of woParts) {
  if (!line.KitID) continue
  const k = (kitIssues[line.KitID] ||= { jobs5y: new Set(), jobs12m: new Set() })
  k.jobs5y.add(line.WorkOrderID)
  if (dayMs(line.InstallDate) >= yearAgo) k.jobs12m.add(line.WorkOrderID)
}
for (const kit of kits) {
  kit.Issued5y = kitIssues[kit.KitID]?.jobs5y.size || 0
  kit.Issued12m = kitIssues[kit.KitID]?.jobs12m.size || 0
}

// Install history per unit and part, oldest first.
const installs = new Map()
for (const line of woParts) {
  const key = `${line.AssetID}|${line.PartID}`
  const list = installs.get(key) || []
  list.push(line)
  installs.set(key, list)
}

const claimed = new Set(claims.map((c) => `${c.WorkOrderID}|${c.PartID}`))
const usage = new Map(parts.map((x) => [x.PartID, {
  PartID: x.PartID,
  oem: { lines: 0, qty: 0, spend: 0, lines12m: 0, qty12m: 0, lives: [], early: 0 },
  alt: { lines: 0, qty: 0, spend: 0, lines12m: 0, qty12m: 0, lives: [], early: 0 },
}]))
const candidates = []
let earlyFailures = 0
for (const list of installs.values()) {
  list.sort((x, y) => (x.InstallDate < y.InstallDate ? -1 : 1))
  list.forEach((line, i) => {
    const u = usage.get(line.PartID)
    if (!u) return
    const ch = u[channelOf(line)]
    ch.lines += 1
    ch.qty += Number(line.Qty) || 0
    ch.spend += Number(line.ExtCostUSD) || 0
    if (dayMs(line.InstallDate) >= yearAgo) { ch.lines12m += 1; ch.qty12m += Number(line.Qty) || 0 }
    if (!i) return
    // The life of the part this line replaced, credited to where that part came from.
    const prev = list[i - 1]
    const days = Math.round((dayMs(line.InstallDate) - dayMs(prev.InstallDate)) / DAY)
    const prevCh = u[channelOf(prev)]
    prevCh.lives.push(days)
    const part = partById.get(line.PartID)
    const job = allById.get(line.WorkOrderID)
    const warrantyDays = (Number(prev.WarrantyMonths) || 0) * 30.4
    const early = job?.Type === 'Unscheduled' && warrantyDays && days <= warrantyDays
      && days < (Number(part?.TypicalLifeDays) || Infinity)
    if (!early) return
    prevCh.early += 1
    earlyFailures += 1
    if (claimed.has(`${line.WorkOrderID}|${line.PartID}`)) return
    candidates.push({
      Kind: 'Early failure',
      WOPartID: line.WOPartID, WorkOrderID: line.WorkOrderID, AssetID: line.AssetID,
      PartID: line.PartID, SKU: line.SKU, Description: line.Description,
      Vendor: prev.Vendor, Channel: channelOf(prev),
      InstallDate: line.InstallDate, PrevInstallDate: prev.InstallDate, PrevWorkOrderID: prev.WorkOrderID,
      DaysInService: days, WarrantyMonths: Number(prev.WarrantyMonths) || null,
      TypicalLifeDays: Number(part?.TypicalLifeDays) || null,
      Qty: Number(line.Qty) || 1, AmountUSD: round2(Number(line.ExtCostUSD) || 0),
      FailureDesc: job?.FailureDesc || '',
    })
  })
}

// A breakdown on a unit still inside its OEM warranty, with parts on it and no
// claim against it — the other way money is left on the table.
const assetById = new Map(assets.map((a) => [a.AssetID, a]))
const claimedJobs = new Set(claims.map((c) => c.WorkOrderID))
for (const w of workOrders) {
  const a = assetById.get(w.AssetID)
  if (w.Type !== 'Unscheduled' || !a?.WarrantyEndDate || claimedJobs.has(w.WorkOrderID)) continue
  if (String(w.CreatedAt).slice(0, 10) > a.WarrantyEndDate || !(Number(w.PartsCostUSD) > 0)) continue
  candidates.push({
    Kind: 'Unit under OEM warranty',
    WOPartID: '', WorkOrderID: w.WorkOrderID, AssetID: w.AssetID,
    PartID: '', SKU: '', Description: w.FailureDesc || 'Unscheduled repair',
    Vendor: a.Manufacturer, Channel: 'oem',
    InstallDate: String(w.CreatedAt).slice(0, 10), PrevInstallDate: a.InServiceDate, PrevWorkOrderID: '',
    DaysInService: Math.round((stampMs(w.CreatedAt) - dayMs(a.InServiceDate)) / DAY),
    WarrantyMonths: null, WarrantyEndDate: a.WarrantyEndDate, TypicalLifeDays: null,
    Qty: 1, AmountUSD: round2((Number(w.PartsCostUSD) || 0) + (Number(w.LaborCostUSD) || 0)),
    FailureDesc: w.FailureDesc || '',
  })
}
candidates.sort((x, y) => (x.InstallDate < y.InstallDate ? 1 : -1))

const median = (list) => {
  if (!list.length) return null
  const v = [...list].sort((x, y) => x - y)
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2)
}
const partUsage = [...usage.values()].map((u) => {
  const shape = (c) => ({
    lines: c.lines, qty: c.qty, spend: round2(c.spend), lines12m: c.lines12m, qty12m: c.qty12m,
    medianLifeDays: median(c.lives), lifeSamples: c.lives.length, earlyFailures: c.early,
  })
  return { PartID: u.PartID, oem: shape(u.oem), alt: shape(u.alt) }
})

// People. The sheet's own KPI tab reads five years; the screen offers the last
// twelve months beside it, because a technician's standing in 2022 is not a
// conversation anyone needs to have in 2026.
const quarterKey = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}` }
const quarters = []
for (let i = 19; i >= 0; i -= 1) {
  const d = new Date(asOfMs)
  quarters.push(quarterKey(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i * 3, 1)))
}
const blank = () => ({ hours: 0, cost: 0, scheduled: 0, lines: 0, jobs: new Set(), assigned: 0, unscheduledAssigned: 0, comebacks: 0, rework: 0, p1: 0 })
const people = new Map(users.map((u) => [u.UserID, { y5: blank(), m12: blank(), quarters: Object.fromEntries(quarters.map((q) => [q, { hours: 0, scheduled: 0 }])) }]))
for (const l of woLabour) {
  const p = people.get(l.UserID)
  if (!p) continue
  const at = stampMs(l.TimeStart)
  for (const win of at >= yearAgo ? [p.y5, p.m12] : [p.y5]) {
    win.hours += Number(l.Hours) || 0
    win.cost += Number(l.LaborCostUSD) || 0
    win.scheduled += Number(l.ScheduledHoursThatDay) || 0
    win.lines += 1
    win.jobs.add(l.WorkOrderID)
  }
  const q = p.quarters[quarterKey(at)]
  if (q) { q.hours += Number(l.Hours) || 0; q.scheduled += Number(l.ScheduledHoursThatDay) || 0 }
}
for (const w of workOrders) {
  const p = people.get(w.AssignedTo)
  if (!p) continue
  for (const win of stampMs(w.CreatedAt) >= yearAgo ? [p.y5, p.m12] : [p.y5]) {
    win.assigned += 1
    if (w.Type === 'Unscheduled') win.unscheduledAssigned += 1
    if (w.Comeback === 'Yes') win.comebacks += 1
    if (w.QualityFlag === 'Rework') win.rework += 1
    if (String(w.Priority).startsWith('P1')) win.p1 += 1
  }
}
const finish = (win) => ({
  hours: round2(win.hours), cost: Math.round(win.cost), scheduled: round2(win.scheduled), lines: win.lines,
  jobs: win.jobs.size, assigned: win.assigned, unscheduledAssigned: win.unscheduledAssigned,
  comebacks: win.comebacks, rework: win.rework, p1: win.p1,
})
const labourKpi = users
  .map((u) => {
    const p = people.get(u.UserID)
    return {
      UserID: u.UserID, Name: u.Name, Role: u.Role, Shift: u.ShiftDefault,
      y5: finish(p.y5), m12: finish(p.m12),
      quarters: quarters.map((q) => ({ quarter: q, hours: round2(p.quarters[q].hours), scheduled: round2(p.quarters[q].scheduled) })),
    }
  })
  .filter((u) => u.y5.lines > 0)

// Cross-check against the sheet's own KPI tab, so a drift between the two is a
// line in this output rather than an evaluator's question.
const kpiSheet = table('21_Dashboard_LaborKPI')
let kpiDrift = 0
for (const row of kpiSheet) {
  const mine = labourKpi.find((u) => u.UserID === row.UserID)
  if (mine && Math.abs(mine.y5.hours - Number(row['Labor hours'])) > 0.2) kpiDrift += 1
}

// ── five years, month by month: the dashboards ───────────────────────────
//
// The workbook's four dashboard tabs are formulas over five-year totals. The
// screen needs the same figures and the shape behind them — whether downtime is
// rising, which year the unscheduled share turned — so every series is built
// here by calendar month from the transaction rows, and the years are summed from
// the months at read time. That is also what lets the dates move with the rest of
// the portal: a month can be relabelled, a year total cannot.
//
// Each headline is checked against the dashboard tab it reproduces and any
// difference is printed below, so the screen and the workbook cannot quietly
// disagree.

const money2 = (v) => round2(Number(v) || 0)
const firstMonth = monthKey(Math.min(...workOrders.map((w) => stampMs(w.CreatedAt))))
const fyMonths = []
{
  const [y0, m0] = firstMonth.split('-').map(Number)
  const end = monthKey(asOfMs)
  for (let i = 0; ; i += 1) {
    const k = monthKey(Date.UTC(y0, m0 - 1 + i, 1))
    fyMonths.push({
      m: k, preventive: 0, unscheduled: 0, comebacks: 0, p1: 0, rework: 0, closed: 0,
      woCost: 0, labourCost: 0, partsCost: 0, downtime: 0,
      oosEvents: 0, oosHours: 0, oosNotNotified: 0,
      labourHours: 0, scheduledHours: 0, nightHours: 0,
      partsIssueSpend: 0, poSpend: 0, poCount: 0,
    })
    if (k === end) break
  }
}
const fyBy = new Map(fyMonths.map((m) => [m.m, m]))
const monthOf = (ms) => fyBy.get(monthKey(ms))

for (const w of workOrders) {
  const m = monthOf(stampMs(w.CreatedAt))
  if (!m) continue
  if (w.Type === 'Preventive') m.preventive += 1
  else m.unscheduled += 1
  if (w.Comeback === 'Yes') m.comebacks += 1
  if (String(w.Priority).startsWith('P1')) m.p1 += 1
  if (w.QualityFlag === 'Rework') m.rework += 1
  m.woCost += Number(w.TotalCostUSD) || 0
  m.labourCost += Number(w.LaborCostUSD) || 0
  m.partsCost += Number(w.PartsCostUSD) || 0
  m.downtime += Number(w.DowntimeHours) || 0
  if (w.ClosedAt) { const c = monthOf(stampMs(w.ClosedAt)); if (c) c.closed += 1 }
}
for (const o of oos) {
  const m = monthOf(stampMs(o.OOSStart))
  if (!m) continue
  m.oosEvents += 1
  if (o.OOSEnd) m.oosHours += Math.max(0, (stampMs(o.OOSEnd) - stampMs(o.OOSStart)) / 3600000)
  if (o.RampControlNotified !== 'Yes') m.oosNotNotified += 1
}
for (const l of woLabour) {
  const m = monthOf(stampMs(l.TimeStart))
  if (!m) continue
  m.labourHours += Number(l.Hours) || 0
  m.scheduledHours += Number(l.ScheduledHoursThatDay) || 0
  if (l.Shift === 'Nights') m.nightHours += Number(l.Hours) || 0
}
for (const line of woParts) {
  const m = monthOf(dayMs(line.InstallDate))
  if (m) m.partsIssueSpend += Number(line.ExtCostUSD) || 0
}
for (const po of pos) {
  const m = monthOf(dayMs(po.CreatedDate))
  if (!m) continue
  m.poSpend += Number(po.TotalUSD) || 0
  m.poCount += 1
}
for (const m of fyMonths) {
  for (const k of ['woCost', 'labourCost', 'partsCost', 'downtime', 'oosHours', 'labourHours', 'scheduledHours', 'nightHours', 'partsIssueSpend', 'poSpend']) m[k] = round2(m[k])
}

// Fleet: the register by type, maker, class and power source, with five years
// of maintenance against what each unit cost to buy.
const unschedByAsset = {}
const oosByAsset = {}
for (const w of workOrders) if (w.Type === 'Unscheduled') unschedByAsset[w.AssetID] = (unschedByAsset[w.AssetID] || 0) + 1
for (const o of oos) oosByAsset[o.AssetID] = (oosByAsset[o.AssetID] || 0) + 1
const group = (keyOf) => {
  const out = new Map()
  for (const a of assetsOut) {
    const k = keyOf(a) || '—'
    const g = out.get(k) || { key: k, units: 0, acquisition: 0, maintenance: 0, downtime: 0, workOrders: 0, unscheduled: 0, oosEvents: 0, hoursMeter: 0, hoursUnits: 0 }
    g.units += 1
    g.acquisition += Number(a.AcquisitionCostUSD) || 0
    g.maintenance += a._history.cost5y
    g.downtime += a._history.downtime5y
    g.workOrders += a._history.workOrders5y
    g.unscheduled += unschedByAsset[a.AssetID] || 0
    g.oosEvents += oosByAsset[a.AssetID] || 0
    if (a.MeterType === 'Hours') { g.hoursMeter += Number(a.CurrentMeter) || 0; g.hoursUnits += 1 }
    out.set(k, g)
  }
  return [...out.values()].map((g) => ({
    ...g, acquisition: round2(g.acquisition), maintenance: round2(g.maintenance), downtime: round2(g.downtime),
  })).sort((x, y) => y.acquisition - x.acquisition)
}
const countBy = (list, keyOf) => list.reduce((m, r) => { const k = keyOf(r) || '—'; m[k] = (m[k] || 0) + 1; return m }, {})

const bySystem = new Map()
for (const w of workOrders) {
  if (w.Type !== 'Unscheduled') continue
  const g = bySystem.get(w.System) || { system: w.System, unscheduled: 0, cost: 0, downtime: 0, p1: 0 }
  g.unscheduled += 1
  g.cost += Number(w.TotalCostUSD) || 0
  g.downtime += Number(w.DowntimeHours) || 0
  if (String(w.Priority).startsWith('P1')) g.p1 += 1
  bySystem.set(w.System, g)
}
const oosReasons = new Map()
for (const o of oos) {
  const g = oosReasons.get(o.Reason) || { reason: o.Reason, events: 0, hours: 0, notNotified: 0 }
  g.events += 1
  if (o.OOSEnd) g.hours += Math.max(0, (stampMs(o.OOSEnd) - stampMs(o.OOSStart)) / 3600000)
  if (o.RampControlNotified !== 'Yes') g.notNotified += 1
  oosReasons.set(o.Reason, g)
}

const userRole = new Map(users.map((u) => [u.UserID, u.Role]))
const labourGroup = (keyOf) => {
  const out = new Map()
  for (const l of woLabour) {
    const k = keyOf(l)
    const g = out.get(k) || { key: k, people: new Set(), hours: 0, cost: 0, scheduled: 0, lines: 0 }
    g.people.add(l.UserID)
    g.hours += Number(l.Hours) || 0
    g.cost += Number(l.LaborCostUSD) || 0
    g.scheduled += Number(l.ScheduledHoursThatDay) || 0
    g.lines += 1
    out.set(k, g)
  }
  return [...out.values()].map((g) => ({ key: g.key, people: g.people.size, hours: round2(g.hours), cost: round2(g.cost), scheduled: round2(g.scheduled), lines: g.lines }))
}

const vendorIssues = new Map()
for (const line of woParts) {
  const g = vendorIssues.get(line.Vendor) || { vendor: line.Vendor, lines: 0, spend: 0, aftermarketLines: 0 }
  g.lines += 1
  g.spend += Number(line.ExtCostUSD) || 0
  if (channelOf(line) === 'alt') g.aftermarketLines += 1
  vendorIssues.set(line.Vendor, g)
}
for (const c of candidates) {
  if (c.Kind !== 'Early failure') continue
  const g = vendorIssues.get(c.Vendor)
  if (g) g.earlyFailuresUnclaimed = (g.earlyFailuresUnclaimed || 0) + 1
}
const onHand = new Map()
for (const x of parts) {
  const g = onHand.get(x.Category) || { category: x.Category, skus: 0, value: 0 }
  g.skus += 1
  g.value += (Number(x.QtyOnHand) || 0) * (Number(x.StdCostUSD) || 0)
  onHand.set(x.Category, g)
}

const FIVE_YEAR = {
  months: fyMonths,
  fleet: {
    units: assets.length,
    acquisition: round2(assets.reduce((n, a) => n + (Number(a.AcquisitionCostUSD) || 0), 0)),
    status: countBy(assets, (a) => a.Status),
    electric: assets.filter((a) => a.PowerSource === 'Electric').length,
    avgHoursMeter: Math.round(assets.filter((a) => a.MeterType === 'Hours').reduce((n, a) => n + (Number(a.CurrentMeter) || 0), 0) / Math.max(1, assets.filter((a) => a.MeterType === 'Hours').length)),
    byType: group((a) => a.EquipmentType).map((g) => ({ ...g, class: assets.find((a) => a.EquipmentType === g.key)?.Class || '' })),
    byManufacturer: group((a) => a.Manufacturer),
    byClass: group((a) => a.Class),
    byPower: group((a) => a.PowerSource),
    topUnits: assetsOut
      .map((a) => ({
        AssetID: a.AssetID, EquipmentType: a.EquipmentType, Manufacturer: a.Manufacturer, Status: a.Status,
        acquisition: money2(a.AcquisitionCostUSD), maintenance: a._history.cost5y, downtime: a._history.downtime5y,
        workOrders: a._history.workOrders5y, unscheduled: unschedByAsset[a.AssetID] || 0, comebacks: a._history.comebacks5y,
      }))
      .sort((x, y) => y.maintenance - x.maintenance)
      .slice(0, 15),
  },
  work: {
    statusNow: countBy(workOrders, (w) => w.Status),
    bySystem: [...bySystem.values()].map((g) => ({ ...g, cost: round2(g.cost), downtime: round2(g.downtime) })).sort((x, y) => y.cost - x.cost),
    oosReasons: [...oosReasons.values()].map((g) => ({ ...g, hours: round2(g.hours) })).sort((x, y) => y.events - x.events),
    airlineAuditPack: workOrders.filter((w) => w.AirlineAuditPack === 'Yes').length,
  },
  labour: {
    byRole: labourGroup((l) => userRole.get(l.UserID) || l.Role),
    byShift: labourGroup((l) => l.Shift),
    nightBankShare: assume('Night-bank share of GSE work'),
  },
  parts: {
    activeSkus: parts.filter((x) => x.Status === 'Active').length,
    onHandValue: round2(parts.reduce((n, x) => n + (Number(x.QtyOnHand) || 0) * (Number(x.StdCostUSD) || 0), 0)),
    woPartsSpend: round2(woParts.reduce((n, x) => n + (Number(x.ExtCostUSD) || 0), 0)),
    poSpend: round2(pos.reduce((n, x) => n + (Number(x.TotalUSD) || 0), 0)),
    warrantyCredits: round2(claims.reduce((n, c) => n + (Number(c.CreditReceivedUSD) || 0), 0)),
    countVariance: round2(counts.reduce((n, c) => n + (Number(c.VarianceUSD) || 0), 0)),
    openPoValue: round2(pos.filter((x) => x.Status !== 'Received').reduce((n, x) => n + (Number(x.TotalUSD) || 0), 0)),
    byVendor: [...vendorIssues.values()].map((g) => ({ ...g, spend: round2(g.spend), earlyFailuresUnclaimed: g.earlyFailuresUnclaimed || 0 })).sort((x, y) => y.spend - x.spend),
    onHandByCategory: [...onHand.values()].map((g) => ({ ...g, value: round2(g.value) })).sort((x, y) => y.value - x.value),
  },
  represented: { classTotals: META.classTotals, replacementValue: META.replacementValue },
}

// Against the dashboard tabs: the headline figures each one states.
const dashCheck = []
const workbookNotes = []
{
  // Read a dashboard headline by its own label rather than by cell address: the
  // workbook gains sheets and rows between versions, and a check pinned to row 4
  // silently starts comparing against a heading.
  const headline = (sheet, label) => {
    const a = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: '', raw: true, blankrows: false })
    for (let r = 0; r < a.length; r += 1) {
      const c = a[r].findIndex((v) => String(v).trim() === label)
      if (c >= 0 && a[r + 1]) return a[r + 1][c]
    }
    return undefined
  }
  // A cell that did not read is a failure, not a match: NaN compares false.
  const near = (label, mine, theirs, tol = 1) => {
    if (!Number.isFinite(Number(theirs)) || !(Math.abs(Number(mine) - Number(theirs)) <= tol)) dashCheck.push(`${label}: ${mine} vs sheet ${theirs}`)
  }
  const sum = (k) => fyMonths.reduce((n, m) => n + m[k], 0)
  near('19 acquisition', FIVE_YEAR.fleet.acquisition, headline('19_Dashboard_Fleet', 'Acquisition value (sample)'))
  near('19 in service', FIVE_YEAR.fleet.status['In Service'], headline('19_Dashboard_Fleet', 'In service'), 0)
  near('20 work orders', sum('preventive') + sum('unscheduled'), headline('20_Dashboard_WO', 'Work orders'), 0)
  near('20 unscheduled', sum('unscheduled'), headline('20_Dashboard_WO', 'Unscheduled'), 0)
  near('20 come-backs', sum('comebacks'), headline('20_Dashboard_WO', 'Come-backs'), 0)
  near('20 OOS events', sum('oosEvents'), headline('20_Dashboard_WO', 'OOS events'), 0)
  near('20 WO cost', sum('woCost'), headline('20_Dashboard_WO', 'Total WO cost'))
  near('20 downtime', sum('downtime'), headline('20_Dashboard_WO', 'Downtime hours'))
  near('22 WO parts spend', FIVE_YEAR.parts.woPartsSpend, headline('22_Dashboard_Parts', 'WO parts $ (5 yr)'))
  near('22 PO spend', FIVE_YEAR.parts.poSpend, headline('22_Dashboard_Parts', 'PO spend (5 yr)'))
  near('22 warranty credits', FIVE_YEAR.parts.warrantyCredits, headline('22_Dashboard_Parts', 'Warranty credits'))
  near('22 count variance', FIVE_YEAR.parts.countVariance, headline('22_Dashboard_Parts', 'Count variance $'))
  near('22 open PO', FIVE_YEAR.parts.openPoValue, headline('22_Dashboard_Parts', 'Open PO $'))
  // The stores figure the customer states, and the catalogue it stands for.
  near('28 on-hand value', FIVE_YEAR.parts.onHandValue, headline('28_Insights_Inventory_SAP', 'On-hand value (demo)'))
  near('28 SKUs valued', parts.length, headline('28_Insights_Inventory_SAP', 'SKUs valued'), 0)
  // 22_Dashboard_Parts still carries the stores figure from the 74-SKU book,
  // while the parts master and 28_Insights_Inventory_SAP carry the $2M one. The
  // parts master is what the screens read; the stale tab is reported, not used.
  const stale22 = Number(headline('22_Dashboard_Parts', 'On-hand value (std cost)'))
  if (Number.isFinite(stale22) && Math.abs(stale22 - FIVE_YEAR.parts.onHandValue) > 1) {
    workbookNotes.push(`22_Dashboard_Parts on-hand value is $${Math.round(stale22).toLocaleString('en-US')}, not the $${Math.round(FIVE_YEAR.parts.onHandValue).toLocaleString('en-US')} on 05_Parts_Master and 28_Insights_Inventory_SAP — that tab was not regenerated with the larger catalogue.`)
  }
}

// What the five-year record concludes, and what the next five years are meant
// to do about it. The plan figures are targets the workbook states as targets —
// never a second history — and every screen that shows them has to say so.
const PLAN = {
  story: section('30_Next5Yr_Story', ['Year', 'What changes on the ramp']),
  lenses: STORY_LENSES,
  growth: GROWTH,
  kpi: section('31_KPI_Trajectory', ['KPI', 'Unit', '2026A_baseline']),
  valueMap: section('35_CMMS_Value_Map', ['Customer note']),
  // The walkthrough the workbook itself scripts: minute, screen, and the line
  // to say on it.
  demoScript: section('35_CMMS_Value_Map', ['Min', 'Open', 'Say']),
  playbook: section('29_Insights_Ops_Playbook', ['Horizon', 'Owner', 'Insight']),
  techVoice: section('32_Tech_Voice_CVG', ['VoiceID']),
  workmanship: section('33_Workmanship_Quality', ['UserID', 'Band']),
  bandProjection: BAND_PROJECTION,
  // What each page says in its own words between the tables — the line the
  // workbook wants said in the room, kept with the numbers it belongs to.
  notes: {
    kpi: sectionNotes('31_KPI_Trajectory'),
    story: sectionNotes('30_Next5Yr_Story'),
    workmanship: sectionNotes('33_Workmanship_Quality'),
    playbook: sectionNotes('29_Insights_Ops_Playbook'),
    voice: sectionNotes('32_Tech_Voice_CVG'),
  },
}

const ANALYTICS = {
  insights: INSIGHTS,
  plan: PLAN,
  fiveYear: FIVE_YEAR,
  targets: TARGETS,
  kits,
  claims,
  candidates,
  counts,
  partUsage,
  labourKpi,
  quarters,
  stats: {
    partLines: woParts.length,
    flaggedRepeatLines: woParts.filter((x) => x.RepeatInstallFlag === 'Yes').length,
    earlyFailures,
    aftermarketLines: partUsage.reduce((n, u) => n + u.alt.lines, 0),
  },
}

// ── write ────────────────────────────────────────────────────────────────
const banner = (sheet) => `// GENERATED by scripts/import-dhl-gse-workbook.mjs — do not edit by hand.
// Source: data-source/${SRC_NAME} (${sheet})
//
// Synthetic, operationally patterned demo data — not DHL actuals. Values are the
// sheet's own. Dates are stored exactly as supplied; the shift that keeps the
// demo current happens at read time in ./index.js.
`
const rows = (list) => `[\n${list.map((r) => `  ${JSON.stringify(r)}`).join(',\n')}\n]`
const write = (file, sheet, name, value, isRows = true) => {
  writeFileSync(join(out, file), `${banner(sheet)}\nexport const ${name} = ${isRows ? rows(value) : JSON.stringify(value, null, 2)}\n`)
}

write('assets.js', '03_Assets + history from 09, 10, 18', 'ASSETS', assetsOut)
write('users.js', '04_Users', 'USERS', users)
write('parts.js', '05_Parts_Master', 'PARTS', parts)
write('pmStandards.js', '07_PM_Standards', 'PM_STANDARDS', pmStandards)
write('manuals.js', '08_Manuals', 'MANUALS', manuals)
write('workOrders.js', '10_Work_Orders — last 365 days and all open', 'WORK_ORDERS', liveWorkOrders)
write('purchaseOrders.js', '14_Purchase_Orders + 15_PO_Lines', 'PURCHASE_ORDERS', posOut)
write('meta.js', '00_Cover, 02_Fleet_Snapshot, 10_Work_Orders (monthly)', 'META', META, false)

// SAP's own layer: the organisation, every material document behind five years
// of stores movement, and the procure-to-pay threads that turn a reservation
// into a goods receipt. Its own module — six thousand material documents are
// read by the SAP screens and by nothing else.
// Every material document, minus what repeats on all six thousand of them: the
// plant is CVG1 throughout, the material number resolves from the part, the
// movement text from its code, and the year from the posting date. Written out
// in full it is 2.4 MB of chunk for one screen; this is the same ledger at half
// the weight, and nothing on screen is lost.
const movementsOut = goodsMovements.map((m) => ({
  MatDoc: m.MatDoc,
  MoveType: m.MoveType,
  PartID: m.PartID,
  SKU: m.SKU,
  Qty: Number(m.Qty) || 0,
  UnitCostUSD: money2(m.UnitCostUSD),
  ExtUSD: money2(m.ExtUSD),
  StorageLoc: m.StorageLoc,
  PostingDate: m.PostingDate,
  SAPPO: m.SAPPO || '',
  SAPOrder: m.SAPOrder || '',
  SAPReserv: m.SAPReserv || '',
  VendorSAP: m.VendorSAP || '',
  UserID: m.UserID || '',
  RefDoc: m.RefDoc || '',
}))
const moveTypes = {}
for (const m of goodsMovements) if (m.MoveType && !moveTypes[m.MoveType]) moveTypes[m.MoveType] = m.MoveTypeDesc
const SAP = { org: sapOrg, plant: 'CVG1', moveTypes, goodsMovements: movementsOut, p2p: p2pThreads, p2pVolumePlan }

// The last ninety days of it, written where the stores screen can read it
// without pulling the whole five-year ledger. The stockroom's own page should
// open on a stock ledger that already has movement in it — an empty ledger on a
// site that issues five thousand parts a year reads as a system nobody uses.
const ledgerFrom = asOfMs - 90 * DAY
const STOCK_LEDGER = movementsOut.filter((m) => dayMs(m.PostingDate) >= ledgerFrom)
writeFileSync(join(out, 'stockLedger.js'),
  `${banner('24_SAP_GoodsMovements — the last 90 days')}\nexport const STOCK_LEDGER = ${rows(STOCK_LEDGER)}\n`)
writeFileSync(join(out, 'sap.js'),
  `${banner('23_SAP_Org, 24_SAP_GoodsMovements, 34_S4HANA_P2P')}\nexport const SAP = ${JSON.stringify(SAP)}\n`)

// One work order per line, keyed by id, so a diff against a re-import reads as
// the jobs that changed.
const detailBody = `{\n${Object.entries(detail).map(([id, d]) => `  ${JSON.stringify(id)}: ${JSON.stringify(d)}`).join(',\n')}\n}`
writeFileSync(join(out, 'workOrderDetail.js'),
  `${banner('11_WO_Labor, 12_WO_Parts, 13_WO_Notes, 18_OOS_Log — for the live work orders')}\nexport const WORK_ORDER_DETAIL = ${detailBody}\n`)

writeFileSync(join(out, 'analytics.js'),
  `${banner('06_Parts_Kits, 16_Warranty_Claims, 17_Inventory_Counts, 01_Assumptions; derived from 05, 10, 11, 12')}\nexport const ANALYTICS = ${JSON.stringify(ANALYTICS)}\n`)

const kb = (s) => Math.round(Buffer.byteLength(s) / 1024)
console.log(`DHL CVG GSE — as of ${asOf}`)
console.log(`  assets ${assets.length} · users ${users.length} · parts ${parts.length} · manuals ${manuals.length}`)
console.log(`  work orders ${workOrders.length} (live ${liveWorkOrders.length}) · POs ${pos.length} (${poLines.length} lines)`)
console.log(`  history folded from ${meters.length} meter readings and ${oos.length} OOS entries`)
console.log(`  wrote ${out.replace(root, '.')}  (work orders ${kb(rows(liveWorkOrders))} KB, assets ${kb(rows(assetsOut))} KB, detail ${kb(detailBody)} KB)`)
console.log(`  detail for ${Object.keys(detail).length} live jobs from ${woLabour.length} labour, ${woParts.length} parts, ${woNotes.length} notes`)
console.log(`  stock ledger ${kb(rows(STOCK_LEDGER))} KB: ${STOCK_LEDGER.length} movements in the last 90 days`)
console.log(`  sap ${kb(JSON.stringify(SAP))} KB: ${sapOrg.length} org objects · ${goodsMovements.length} material documents · ${p2pThreads.length} P2P threads (+${p2pVolumePlan.length} planned years)`)
console.log(`  insights: ${INSIGHTS.technicians.length} technicians (${INSIGHTS.technicianYears.length} technician-years) · ${INSIGHTS.oemType.length} OEM/type pairs · ${INSIGHTS.assetYears.length} asset-years · ${INSIGHTS.stockPath.length} months of stock value`)
console.log(`  plan: ${PLAN.demoScript.length}-step demo script · ${PLAN.kpi.length} KPIs to 2031 · ${PLAN.story.length} story years · ${PLAN.lenses.length} lenses · ${PLAN.growth.length} growth rows · ${PLAN.valueMap.length} value-map rows · ${PLAN.playbook.length} playbook actions · ${PLAN.techVoice.length} comments · ${PLAN.workmanship.length} workmanship rows (+${PLAN.bandProjection.length} band projections)`)
console.log(`  analytics ${kb(JSON.stringify(ANALYTICS))} KB: ${kits.length} kits · ${claims.length} claims · ${candidates.length} candidates (${candidates.filter((c) => c.Kind === 'Early failure').length} early failures unclaimed, of ${earlyFailures}) · ${counts.length} count lines · ${labourKpi.length} people`)
console.log(`  aftermarket ${ANALYTICS.stats.aftermarketLines} of ${woParts.length} part lines (assumption ${TARGETS.aftermarketShare}) · targets wrench ${TARGETS.wrenchTime} come-back ${TARGETS.comebackRate} · KPI drift vs sheet 21: ${kpiDrift} people`)
console.log(`  five-year: ${fyMonths.length} months from ${firstMonth} · dashboard check ${dashCheck.length ? `DIFFERS — ${dashCheck.join('; ')}` : 'matches sheets 19, 20, 22, 28'}`)
for (const note of workbookNotes) console.log(`  workbook note: ${note}`)
console.log(`  come-back links: ${links.comebacks} flagged, ${links.withParent} with a parent · parent missing ${links.parentMissing} · parent raised AFTER child ${links.parentAfterChild} · gap over 30 days ${links.outsideWindow}`)
