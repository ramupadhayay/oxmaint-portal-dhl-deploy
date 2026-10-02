// Synthetic current-period work orders for the CVG GSE voice demo.
//
// The workbook's live register is ~631 jobs over twelve months — too light for
// a Superhub shop that runs about 1,600 work orders a month (~400 a week).
// This file builds that current month / rolling week as a labelled projection
// so voice can answer stage questions at the throughput Ram asked for.
//
// It is not DHL's own records. Jobs use the same field names as 10_Work_Orders
// so they map through index.js unchanged. Ids are WO-V… so they never collide
// with the workbook. People are the existing EMP-00n roster — no invented PII.

export const VOICE_VOLUME = {
  monthlyTarget: 1600,
  weeklyTarget: 400,
  monthDays: 30,
  weekDays: 7,
  source: 'synthetic-voice-volume',
  honesty:
    'Synthetic CVG GSE projection at about 1,600 work orders a month (~400 a week). Patterned on published Superhub scale and industry practice — not DHL actuals. Materials and asset hierarchy are an Oxmaint AI projection mirrored to SAP MM/PM shapes — not a live production SAP connector.',
}

export const HONESTY = VOICE_VOLUME.honesty

// Spoken-code 0001 binds to this demo technician. Not a real DHL employee.
export const DEMO_TECH = {
  tech_id: 'TECH-0001',
  name: 'Alex Rivera',
  shift: 'Days',
  honesty: 'Demo technician identity for the Oxmaint AI voice line — not a real DHL employee.',
}

// A realistic Days-shift board: assigned / in progress / waiting on parts.
export const DEMO_TECH_INDICES = [0, 1, 2, 3, 28, 29, 30, 31, 70, 71, 72, 73]
// Closed week jobs so Alex has a workmanship history supervisors can ask about.
export const DEMO_TECH_CLOSED = [120, 121, 122, 123, 160, 161, 200, 201]

const PARTS_FOR_FAILURE = {
  'HYD-LEAK': [
    { sku: 'HOSE-HYD-12', name: 'Hydraulic hose 1/2 in x 24 in', qty: 1 },
    { sku: 'OIL-HYD-AW46', name: 'AW-46 hydraulic oil (gal)', qty: 2 },
  ],
  'HYD-NO-LIFT': [
    { sku: 'HOSE-HYD-36', name: 'Hydraulic hose 1/2 in x 36 in', qty: 1 },
    { sku: 'FIL-HYD-500', name: 'Hydraulic filter element', qty: 1 },
  ],
  'ELT-DEAD': [{ sku: 'BAT-12-1000', name: '12V flooded starting battery 1000 CCA', qty: 1 }],
  'ELT-ALT': [{ sku: 'BAT-12-1000', name: '12V flooded starting battery 1000 CCA', qty: 1 }],
  'ELT-LIGHT': [{ sku: 'GRS-MP2', name: 'Multipurpose lithium grease (tube)', qty: 1 }],
  'GPU-OUTPUT': [{ sku: 'BAT-8D', name: '8D heavy duty battery', qty: 1 }],
  'GPU-CABLE': [{ sku: 'BAT-8D', name: '8D heavy duty battery', qty: 1 }],
  'BLT-TRACK': [{ sku: 'BLT-CONV-24', name: 'Conveyor belt 24 in x 49 ft laced', qty: 1 }],
  'BRK-SOFT': [{ sku: 'BRK-PAD-TUG', name: 'Brake pad set TUG MA/MH', qty: 1 }],
  'TOW-HITCH': [{ sku: 'SHEAR-737', name: 'Towbar shear pin 737/A320', qty: 2 }],
  'ENG-OIL-LEAK': [
    { sku: 'FIL-OIL-250', name: 'Engine oil filter 250-hr GSE', qty: 1 },
    { sku: 'OIL-15W40-CJ4', name: '15W-40 CJ-4 engine oil (gal)', qty: 3 },
  ],
  'TIR-WEAR': [{ sku: 'TIR-650-10', name: 'GSE tire 6.50-10 solid/pneumatic', qty: 2 }],
  'SAF-ALARM': [{ sku: 'GRS-MP2', name: 'Multipurpose lithium grease (tube)', qty: 1 }],
  'INSP-PRE': [{ sku: 'FIL-AIR-PRI', name: 'Primary air filter element', qty: 1 }],
  'DMG-RAMP': [{ sku: 'BRK-HOSE-24', name: 'Brake hose 24 in', qty: 1 }],
  'PM-30D': [{ sku: 'GRS-MP2', name: 'Multipurpose lithium grease (tube)', qty: 2 }],
  'PM-250': [{ sku: 'FIL-OIL-250', name: 'Engine oil filter 250-hr GSE', qty: 1 }],
  'PM-500': [
    { sku: 'FIL-OIL-250', name: 'Engine oil filter 250-hr GSE', qty: 1 },
    { sku: 'FIL-HYD-500', name: 'Hydraulic filter element', qty: 1 },
  ],
  DEFAULT: [{ sku: 'FIL-OIL-250', name: 'Engine oil filter 250-hr GSE', qty: 1 }],
}

const MATERIAL_META = {
  'HOSE-HYD-12': { sap_material: '4000000028', sloc: '0002', on_hand: 7 },
  'HOSE-HYD-36': { sap_material: '4000000029', sloc: '0001', on_hand: 28 },
  'OIL-HYD-AW46': { sap_material: '4000000006', sloc: '0002', on_hand: 20 },
  'FIL-HYD-500': { sap_material: '4000000003', sloc: '0001', on_hand: 39 },
  'BAT-12-1000': { sap_material: '4000000019', sloc: '0001', on_hand: 33 },
  'GRS-MP2': { sap_material: '4000000009', sloc: '0001', on_hand: 24 },
  'BAT-8D': { sap_material: '4000000020', sloc: '0002', on_hand: 1 },
  'BLT-CONV-24': { sap_material: '4000000025', sloc: '0001', on_hand: 7 },
  'BRK-PAD-TUG': { sap_material: '4000000010', sloc: '0002', on_hand: 16 },
  'SHEAR-737': { sap_material: '4000000035', sloc: '0001', on_hand: 33 },
  'FIL-OIL-250': { sap_material: '4000000001', sloc: '0001', on_hand: 42 },
  'OIL-15W40-CJ4': { sap_material: '4000000005', sloc: '0001', on_hand: 41 },
  'TIR-650-10': { sap_material: '4000000015', sloc: '0001', on_hand: 37 },
  'FIL-AIR-PRI': { sap_material: '4000000004', sloc: '0001', on_hand: 10 },
  'BRK-HOSE-24': { sap_material: '4000000014', sloc: '0001', on_hand: 3 },
}

export { MATERIAL_META }

const VARIANT_OF = {
  'FIL-OIL-250': {
    oem: { vendor: 'Cummins Central Power', sku_variant: 'FIL-OIL-250-OEM', unit_cost: 18.4 },
    alt: { vendor: 'NAPA Commercial / Heavy Duty', sku_variant: 'FIL-OIL-250-AM', unit_cost: 12.61 },
  },
  'FIL-HYD-500': {
    oem: { vendor: 'Parker Store Cincinnati', sku_variant: 'FIL-HYD-500-OEM', unit_cost: 32.5 },
    alt: { vendor: 'NAPA Commercial / Heavy Duty', sku_variant: 'FIL-HYD-500-AM', unit_cost: 27.82 },
  },
  'BAT-8D': {
    oem: { vendor: 'Battery Systems Inc', sku_variant: 'BAT-8D-OEM', unit_cost: 286 },
    alt: { vendor: 'NAPA Commercial / Heavy Duty', sku_variant: 'BAT-8D-AM', unit_cost: 248.9 },
  },
  'BLT-CONV-24': {
    oem: { vendor: 'TLD / Textron GSE', sku_variant: 'BLT-CONV-24-OEM', unit_cost: 1840 },
    alt: { vendor: 'Aviation GSE Supply', sku_variant: 'BLT-CONV-24-AM', unit_cost: 1120 },
  },
  'BRK-HOSE-24': {
    oem: { vendor: 'Parker Store Cincinnati', sku_variant: 'BRK-HOSE-24-OEM', unit_cost: 28.4 },
    alt: { vendor: 'NAPA Commercial / Heavy Duty', sku_variant: 'BRK-HOSE-24-AM', unit_cost: 23.53 },
  },
  'HOSE-HYD-12': {
    oem: { vendor: 'Parker Store Cincinnati', sku_variant: 'HOSE-HYD-12-OEM', unit_cost: 46 },
    alt: { vendor: 'NAPA Commercial / Heavy Duty', sku_variant: 'HOSE-HYD-12-AM', unit_cost: 31 },
  },
}

function variantFor(sku, i, lineStatus) {
  const pack = VARIANT_OF[sku] || {
    oem: { vendor: 'OEM GSE Parts', sku_variant: `${sku}-OEM`, unit_cost: 40 },
    alt: { vendor: 'NAPA Commercial / Heavy Duty', sku_variant: `${sku}-AM`, unit_cost: 28 },
  }
  const useAlt = i % 2 === 1
  const v = useAlt ? pack.alt : pack.oem
  const tough = sku === 'BAT-8D' || sku === 'BLT-CONV-24' || sku === 'BRK-HOSE-24'
  let outcome = 'fit_ok'
  if (useAlt && tough) {
    outcome = i % 5 === 0 ? 'early_failure' : i % 5 === 1 ? 'fit_issue' : i % 5 === 2 ? 'repeat_pr' : 'fit_ok'
  } else if (useAlt && lineStatus === 'short') {
    outcome = i % 4 === 0 ? 'repeat_pr' : 'fit_ok'
  } else if (useAlt && i % 11 === 0) {
    outcome = 'early_failure'
  }
  return { ...v, channel: useAlt ? 'aftermarket' : 'oem', install_outcome: outcome }
}

function materialMeta(sku) {
  return MATERIAL_META[sku] || { sap_material: '4000000099', sloc: '0001', on_hand: 8 }
}

function partsForTask(task, status, i, reservation) {
  const key = task.FailureCode || 'DEFAULT'
  const catalog = PARTS_FOR_FAILURE[key] || PARTS_FOR_FAILURE.DEFAULT
  const holdStatus = i % 3 === 0 ? 'short' : i % 3 === 1 ? 'on_order' : 'reserved'
  const openStatus = status === 'In Progress' ? 'needed' : 'planned'
  const lineStatus = status === 'Parts Hold' ? holdStatus : openStatus
  const insufficient = lineStatus === 'short' || lineStatus === 'on_order'
  return catalog.map((p, idx) => {
    const meta = materialMeta(p.sku)
    const onHand = insufficient ? Math.max(0, (p.qty || 1) - 1) : meta.on_hand
    const variant = variantFor(p.sku, i + idx, lineStatus)
    return {
      sku: p.sku,
      name: p.name,
      qty: p.qty,
      status: lineStatus,
      reserved: lineStatus === 'reserved' || lineStatus === 'needed' || lineStatus === 'planned',
      plant: 'CVG1',
      storage_location: meta.sloc,
      sap_material: meta.sap_material,
      on_hand: onHand,
      reserved_qty: p.qty,
      reservation,
      reservation_item: String((idx + 1) * 10).padStart(4, '0'),
      ...variant,
    }
  })
}

function procurementFor(row, i, { withGr } = {}) {
  const lines = row.PartsNeeded || []
  if (!lines.length) return null
  const reservation = row.SAPReserv
  const short = lines.some((l) => l.status === 'short' || l.status === 'on_order')
  if (!short && !withGr) {
    return {
      reservation,
      notification: row.SAPNotif,
      pr: null,
      po: null,
      gr: null,
      chain_status: 'RESERVATION_ONLY',
    }
  }
  const pr = {
    id: `PR-V${50000 + i}`,
    sap_banfn: String(10050000 + i).padStart(10, '0'),
    status: withGr ? 'Converted' : 'Released',
    created_at: row.CreatedAt,
    store_role: '0003',
    work_order: row.WorkOrderID,
  }
  let po = null
  let gr = null
  let chain = 'PR_RELEASED'
  if (withGr || i % 3 !== 0) {
    po = {
      id: `PO-V${45000 + i}`,
      sap_ebeln: String(4500000000 + i).padStart(10, '0'),
      status: withGr ? 'Received' : 'Open',
      created_at: row.CreatedAt,
      work_order: row.WorkOrderID,
      pr: pr.id,
    }
    chain = 'PO_OPEN'
  }
  if (withGr && po) {
    gr = {
      id: `GR-V${49000 + i}`,
      sap_matdoc: String(4900000000 + i).padStart(10, '0'),
      move_type: '101',
      status: 'Posted',
      posted_at: row.ClosedAt || row.CreatedAt,
      work_order: row.WorkOrderID,
      po: po.id,
      pr: pr.id,
    }
    chain = 'GR_POSTED'
  }
  return {
    reservation,
    notification: row.SAPNotif,
    pr,
    po,
    gr,
    chain_status: chain,
  }
}

const SHIFTS = ['Days', 'Swing', 'Nights']
const ZONES_FALLBACK = [
  'Ramp A', 'Ramp B', 'Ramp C', 'Ramp D', 'Ramp E',
  'ULD Yard', 'GSE Shop North', 'GSE Shop South', 'Battery Shop',
  'Hangar Staging', 'Cargo Sort', 'Snow Barn',
]

const TECHS = [
  'EMP-008', 'EMP-009', 'EMP-010', 'EMP-011', 'EMP-012', 'EMP-013',
  'EMP-014', 'EMP-015', 'EMP-016', 'EMP-017', 'EMP-018', 'EMP-019', 'EMP-020',
]
const LEADS = ['EMP-004', 'EMP-005', 'EMP-006', 'EMP-007']
const REQUESTERS = ['EMP-024', 'EMP-025', 'EMP-016', 'EMP-010', 'EMP-008', 'EMP-003']

const PM_JOBS = [
  { Type: 'Preventive', TemplateID: 'PM-30D', FailureCode: 'PM-30D', FailureDesc: '30-day operational inspection', System: 'PM', EstHours: 1.5 },
  { Type: 'Preventive', TemplateID: 'PM-60D', FailureCode: 'PM-30D', FailureDesc: '30-day operational inspection', System: 'PM', EstHours: 1.2 },
  { Type: 'Preventive', TemplateID: 'PM-90D', FailureCode: 'PM-30D', FailureDesc: '30-day operational inspection', System: 'PM', EstHours: 1.0 },
  { Type: 'Preventive', TemplateID: 'PM-250H', FailureCode: 'PM-250', FailureDesc: 'Scheduled 250-hr PM', System: 'PM', EstHours: 3.5 },
  { Type: 'Preventive', TemplateID: 'PM-500H', FailureCode: 'PM-500', FailureDesc: 'Scheduled 500-hr PM', System: 'PM', EstHours: 6.0 },
  { Type: 'Preventive', TemplateID: 'PM-ANN', FailureCode: 'PM-ANN', FailureDesc: 'Annual / DOT / IATA inspection', System: 'PM', EstHours: 8.0 },
]

const UNSCHEDULED = [
  { FailureCode: 'HYD-LEAK', FailureDesc: 'Hydraulic leak', System: 'Hydraulics', EstHours: 3.5, oos: true },
  { FailureCode: 'HYD-NO-LIFT', FailureDesc: 'No lift / slow lift', System: 'Hydraulics', EstHours: 2.5, oos: true },
  { FailureCode: 'ELT-DEAD', FailureDesc: 'Dead battery / no crank', System: 'Electrical', EstHours: 2.0, oos: false },
  { FailureCode: 'ELT-ALT', FailureDesc: 'Charging system fault', System: 'Electrical', EstHours: 3.0, oos: false },
  { FailureCode: 'ELT-LIGHT', FailureDesc: 'Lighting / beacon inop', System: 'Electrical', EstHours: 1.5, oos: false },
  { FailureCode: 'GPU-OUTPUT', FailureDesc: 'GPU voltage / freq out of spec', System: 'GPU', EstHours: 2.5, oos: true },
  { FailureCode: 'GPU-CABLE', FailureDesc: 'GPU cable / connector damage', System: 'GPU', EstHours: 1.5, oos: true },
  { FailureCode: 'BLT-TRACK', FailureDesc: 'Belt tracking / slip', System: 'Conveyor', EstHours: 2.0, oos: false },
  { FailureCode: 'BRK-SOFT', FailureDesc: 'Soft / fading brakes', System: 'Brakes', EstHours: 4.0, oos: true },
  { FailureCode: 'TOW-HITCH', FailureDesc: 'Hitch / coupling wear', System: 'Tow', EstHours: 2.5, oos: false },
  { FailureCode: 'ENG-OIL-LEAK', FailureDesc: 'Engine oil leak', System: 'Engine', EstHours: 5.0, oos: true },
  { FailureCode: 'TIR-WEAR', FailureDesc: 'Uneven / end-of-life tire', System: 'Tires', EstHours: 2.0, oos: false },
  { FailureCode: 'SAF-ALARM', FailureDesc: 'Backup alarm / interlock', System: 'Safety', EstHours: 1.5, oos: true },
  { FailureCode: 'INSP-PRE', FailureDesc: 'Pre-use defect found', System: 'Inspection', EstHours: 2.0, oos: false },
  { FailureCode: 'DMG-RAMP', FailureDesc: 'Ramp damage / collision', System: 'Damage', EstHours: 3.0, oos: true },
]

// Exact live-slice sizes so voice answers stay the same every call.
const SLICE = {
  assigned: 28,
  inProgress: 42,
  partsHold: 32,
  qaReview: 18,
  p1Open: 10,
  deferredOpen: 22,
  p1ClosedWeek: 8,
  deferredClosedWeek: 15,
}

function fnv(s) {
  let h = 2166136261
  const str = String(s)
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 16
  h = Math.imul(h, 2246822507)
  h ^= h >>> 13
  h = Math.imul(h, 3266489909)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

function pick(key, from) {
  return from[Math.floor(fnv(key) * from.length) % from.length]
}

function between(key, lo, hi, dp = 0) {
  const v = lo + fnv(key) * (hi - lo)
  return dp ? Number(v.toFixed(dp)) : Math.round(v)
}

function pad(n, w) {
  return String(n).padStart(w, '0')
}

function parseAsOf(asOf) {
  const [y, m, d] = String(asOf).slice(0, 10).split('-').map(Number)
  return Date.UTC(y, m - 1, d, 6, 0)
}

function fmtStamp(ms) {
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const mo = pad(d.getUTCMonth() + 1, 2)
  const dd = pad(d.getUTCDate(), 2)
  const hh = pad(d.getUTCHours(), 2)
  const mm = pad(d.getUTCMinutes(), 2)
  return `${y}-${mo}-${dd} ${hh}:${mm}`
}

function daysBack(asOfMs, days, key) {
  const hh = [6, 8, 10, 14, 16, 18, 22, 3][Math.floor(fnv(`${key}-hh`) * 8)]
  const mm = [0, 15, 30, 45][Math.floor(fnv(`${key}-mm`) * 4)]
  return asOfMs - days * 86400000 + (hh - 6) * 3600000 + mm * 60000
}

function jobKind(i) {
  if (i < SLICE.assigned) return { Status: 'Assigned', Priority: 'P3-Scheduled' }
  if (i < SLICE.assigned + SLICE.inProgress) return { Status: 'In Progress', Priority: 'P3-Scheduled' }
  if (i < SLICE.assigned + SLICE.inProgress + SLICE.partsHold) {
    return { Status: 'Parts Hold', Priority: 'P2-Same Shift' }
  }
  if (i < SLICE.assigned + SLICE.inProgress + SLICE.partsHold + SLICE.qaReview) {
    return { Status: 'QA Review', Priority: 'P3-Scheduled' }
  }
  return { Status: 'Closed', Priority: 'P3-Scheduled' }
}

function applySpecialPriorities(i, kind) {
  if (i < SLICE.p1Open) return { ...kind, Priority: 'P1-AOG / Gate Hold' }
  if (i < SLICE.p1Open + SLICE.deferredOpen) return { ...kind, Priority: 'P4-Deferred' }
  const weekClosedStart = SLICE.assigned + SLICE.inProgress + SLICE.partsHold + SLICE.qaReview
  if (i >= weekClosedStart && i < weekClosedStart + SLICE.p1ClosedWeek) {
    return { ...kind, Priority: 'P1-AOG / Gate Hold' }
  }
  if (
    i >= weekClosedStart + SLICE.p1ClosedWeek
    && i < weekClosedStart + SLICE.p1ClosedWeek + SLICE.deferredClosedWeek
  ) {
    return { ...kind, Priority: 'P4-Deferred' }
  }
  // Older closed month: sprinkle P1 and P4 so monthly slices are not empty.
  if (i >= VOICE_VOLUME.weeklyTarget) {
    const older = i - VOICE_VOLUME.weeklyTarget
    if (older % 50 === 0) return { ...kind, Priority: 'P1-AOG / Gate Hold' }
    if (older % 30 === 0) return { ...kind, Priority: 'P4-Deferred' }
    if (older % 7 === 0) return { ...kind, Priority: 'P2-Same Shift' }
  }
  if (kind.Status === 'Closed' && i % 11 === 0) return { ...kind, Priority: 'P2-Same Shift' }
  return kind
}

function chooseTask(i, asset, kind) {
  const unscheduled = kind.Priority.startsWith('P1') || kind.Priority.startsWith('P2')
    || kind.Priority.startsWith('P4') || i % 5 === 0
  if (unscheduled) {
    const u = pick(`vv-u-${i}-${asset.AssetID}`, UNSCHEDULED)
    return { Type: 'Unscheduled', TemplateID: '', ...u }
  }
  const powered = asset.MeterType === 'Hours'
  const pool = powered ? PM_JOBS : PM_JOBS.filter((j) => j.TemplateID !== 'PM-250H' && j.TemplateID !== 'PM-500H')
  return pick(`vv-pm-${i}-${asset.AssetID}`, pool)
}

export function generateVoiceVolumeWorkOrders({ asOf, assets }) {
  const list = Array.isArray(assets) && assets.length ? assets : []
  if (!list.length) return []
  const asOfMs = parseAsOf(asOf)
  const out = []
  const { monthlyTarget, weeklyTarget, monthDays, weekDays } = VOICE_VOLUME

  for (let i = 0; i < monthlyTarget; i += 1) {
    const asset = list[i % list.length]
    const kind = applySpecialPriorities(i, jobKind(i))
    const task = chooseTask(i, asset, kind)
    const inWeek = i < weeklyTarget
    const dayOffset = inWeek
      ? i % weekDays
      : weekDays + ((i - weeklyTarget) % (monthDays - weekDays))
    const createdMs = daysBack(asOfMs, dayOffset, `vv-c-${i}`)
    const closed = kind.Status === 'Closed' || kind.Status === 'QA Review'
    const hours = task.EstHours || 2
    const labor = closed ? Number((hours * (0.85 + fnv(`vv-l-${i}`) * 0.3)).toFixed(2)) : 0
    const rate = 34.5
    const laborCost = Number((labor * rate).toFixed(2))
    const partsCost = kind.Status === 'Parts Hold'
      ? between(`vv-pc-${i}`, 80, 420)
      : task.Type === 'Preventive' && /250|500/.test(task.TemplateID)
        ? (task.TemplateID === 'PM-500H' ? 283.4 : 150.5)
        : closed && task.Type === 'Unscheduled'
          ? between(`vv-pc-${i}`, 12, 380)
          : 0
    const oos = Boolean(task.oos) || kind.Priority.startsWith('P1') || kind.Status === 'Parts Hold'
    const sapN = 40000 + i
    const created = fmtStamp(createdMs)
    const closedAt = closed
      ? fmtStamp(createdMs + Math.round(hours * 3600000 * (0.4 + fnv(`vv-cd-${i}`) * 0.8)))
      : ''

    out.push({
      WorkOrderID: `WO-V26-${pad(i + 1, 5)}`,
      AssetID: asset.AssetID,
      EquipmentType: asset.EquipmentType,
      Manufacturer: asset.Manufacturer,
      Class: asset.Class,
      Type: task.Type,
      TemplateID: task.TemplateID || '',
      FailureCode: task.FailureCode,
      FailureDesc: task.FailureDesc,
      System: task.System,
      Priority: kind.Priority,
      Status: kind.Status,
      CreatedAt: created,
      Shift: pick(`vv-sh-${i}`, SHIFTS),
      LocationZone: asset.LocationZone || pick(`vv-z-${i}`, ZONES_FALLBACK),
      RequestedBy: pick(`vv-rq-${i}`, REQUESTERS),
      AssignedTo: pick(`vv-as-${i}`, TECHS),
      LeadTech: pick(`vv-ld-${i}`, LEADS),
      ClosedAt: closedAt,
      MeterAtOpen: Number(asset.CurrentMeter) || 0,
      OutOfService: oos ? 'Yes' : 'No',
      Comeback: 'No',
      ParentWO: '',
      WarrantyWarning: fnv(`vv-w-${i}`) > 0.92 ? 'Yes' : 'No',
      EstHours: hours,
      LaborHours: labor,
      LaborCostUSD: laborCost,
      PartsCostUSD: partsCost,
      TotalCostUSD: Number((laborCost + partsCost).toFixed(2)),
      DowntimeHours: oos ? Number((hours * 1.2).toFixed(1)) : Number((hours * 0.3).toFixed(1)),
      QualityFlag: closed ? 'Pass' : '',
      AirlineAuditPack: task.Type === 'Preventive' ? 'Yes' : 'No',
      SAPOrder: pad(sapN, 8),
      SAPNotif: pad(10000 + i, 8),
      SAPReserv: pad(900000 + i, 10),
      SAPEquip: asset.SAPEquipment || '',
      FunctLocation: asset.FunctLocation || '',
      WorkCenter: asset.WorkCenter || 'CVGGSE01',
      CostCenter: asset.CostCenter || '14101000',
      OrderType: task.Type === 'Preventive' ? 'PM01' : 'PM02',
      Plant: asset.PlanningPlant || 'CVG1',
      ControllingArea: 'DH01',
      _synthetic: true,
      _voiceVolume: true,
      _voiceWeek: inWeek,
      PartsNeeded: [],
    })
  }

  const techSet = new Set(DEMO_TECH_INDICES)
  for (let i = 0; i < out.length; i += 1) {
    const row = out[i]
    if (techSet.has(i)) {
      row.AssignedTo = DEMO_TECH.tech_id
      row.LeadTech = DEMO_TECH.tech_id
      row.Shift = DEMO_TECH.shift
      row._demoTech = true
    }
    const needsComponents = row.Status === 'Parts Hold'
      || row.Status === 'Assigned'
      || row.Status === 'In Progress'
      || row._demoTech
    const closedChain = row.Status === 'Closed' && row._voiceWeek && i % 40 === 0
    if ((needsComponents && row._voiceWeek) || closedChain) {
      row.PartsNeeded = partsForTask(
        { FailureCode: row.FailureCode },
        closedChain ? 'Closed' : row.Status,
        i,
        row.SAPReserv,
      )
      if (closedChain) {
        row.PartsNeeded = row.PartsNeeded.map((p) => ({ ...p, status: 'received', reserved: false }))
      }
      row.Procurement = procurementFor(row, i, { withGr: closedChain })
    }
  }
  applyQualitySignals(out)
  return out
}

function range(start, end) {
  const out = []
  for (let i = start; i < end; i += 1) out.push(i)
  return out
}

function stampMs(s) {
  const t = Date.parse(String(s || '').replace(' ', 'T') + 'Z')
  return Number.isFinite(t) ? t : 0
}

function emptyQuality() {
  return {
    reopen: false,
    caused_reopen: false,
    reopen_within_days: null,
    bounce_back: false,
    near_pm: false,
    near_pm_days: null,
    rework: false,
    first_time_fix: true,
  }
}

// Seeded peer batches so supervisors can hear a spread: two quiet closers,
// a mid shop, an apprentice with rework, and one with bounce-backs. Indices
// stay inside the 1,600-row month — no extra WOs.
function peerBatches() {
  return [
    { tech_id: DEMO_TECH.tech_id, indices: [...DEMO_TECH_CLOSED, ...range(420, 436)], profile: 'high' },
    { tech_id: 'EMP-010', indices: [...range(124, 136), ...range(440, 460)], profile: 'high' },
    { tech_id: 'EMP-013', indices: [...range(136, 140), ...range(210, 226), ...range(480, 500)], profile: 'mid' },
    { tech_id: 'EMP-018', indices: [...range(140, 156), ...range(520, 545)], profile: 'rework' },
    { tech_id: 'EMP-020', indices: [...range(180, 196), ...range(560, 585)], profile: 'bounce' },
  ]
}

function applyPeerProfile(row, profile, k) {
  const q = row.Quality || emptyQuality()
  if (profile === 'high') {
    const late = k === 0
    q.reopen = late
    q.caused_reopen = late
    q.reopen_within_days = late ? 28 : null
    q.bounce_back = false
    q.near_pm = false
    q.near_pm_days = null
    q.rework = false
    q.first_time_fix = !late
    row.Comeback = late ? 'Yes' : 'No'
    row.QualityFlag = 'Pass'
  } else if (profile === 'mid') {
    q.reopen = k % 10 < 3
    q.caused_reopen = q.reopen
    q.reopen_within_days = q.reopen ? 14 : null
    q.bounce_back = k % 11 < 2
    q.near_pm = k % 4 === 0
    q.near_pm_days = q.near_pm ? 5 : null
    q.rework = k % 5 === 0
    q.first_time_fix = !q.reopen && !q.rework && !q.bounce_back
    row.Comeback = q.reopen ? 'Yes' : 'No'
    row.QualityFlag = q.rework ? 'Rework' : 'Pass'
  } else if (profile === 'rework') {
    q.rework = k % 5 !== 4
    q.reopen = k % 9 < 4
    q.caused_reopen = q.reopen
    q.reopen_within_days = q.reopen ? (k % 2 === 0 ? 7 : 12) : null
    q.bounce_back = k % 4 === 0
    q.near_pm = k % 10 < 3
    q.near_pm_days = q.near_pm ? 4 : null
    q.first_time_fix = k % 10 === 9
    row.Comeback = q.reopen || q.rework ? 'Yes' : 'No'
    row.QualityFlag = q.rework ? 'Rework' : 'Pass'
  } else {
    q.bounce_back = k % 5 !== 4
    q.reopen = k % 10 < 3
    q.caused_reopen = q.reopen
    q.reopen_within_days = q.reopen ? 10 : null
    q.near_pm = k % 5 === 1
    q.near_pm_days = q.near_pm ? 6 : null
    q.rework = k % 4 === 0
    q.first_time_fix = !q.bounce_back && !q.reopen
    row.Comeback = q.bounce_back || q.reopen ? 'Yes' : 'No'
    row.QualityFlag = q.rework ? 'Rework' : 'Pass'
  }
  row.Quality = q
}

function applyQualitySignals(out) {
  const batches = peerBatches()
  const reserved = new Set()
  const peerIds = new Set(batches.map((p) => p.tech_id))
  for (const peer of batches) {
    for (const i of peer.indices) reserved.add(i)
  }
  const others = TECHS.filter((t) => !peerIds.has(t))
  for (let i = 0; i < out.length; i += 1) {
    if (reserved.has(i)) continue
    const row = out[i]
    if (row.Status !== 'Closed') continue
    if (peerIds.has(row.AssignedTo)) {
      row.AssignedTo = pick(`vv-reassign-${i}`, others)
    }
  }

  for (const peer of batches) {
    peer.indices.forEach((i, k) => {
      const row = out[i]
      if (!row || row.Status !== 'Closed') return
      row.AssignedTo = peer.tech_id
      if (peer.tech_id === DEMO_TECH.tech_id) {
        row.LeadTech = DEMO_TECH.tech_id
        row.Shift = DEMO_TECH.shift
        row._demoTech = true
      }
      row._qualityPeer = peer.profile
      row.Quality = emptyQuality()
      applyPeerProfile(row, peer.profile, k)
      if (!(row.PartsNeeded || []).length) {
        row.PartsNeeded = partsForTask(
          { FailureCode: row.FailureCode },
          'Closed',
          i,
          row.SAPReserv,
        ).map((p) => ({ ...p, status: 'received', reserved: false }))
      }
    })
  }

  for (const row of out) {
    if (row.Status !== 'Closed') continue
    if (!row.Quality) row.Quality = emptyQuality()
  }

  const closed = out.filter((w) => w.Status === 'Closed')
  closed.sort((a, b) => stampMs(a.ClosedAt) - stampMs(b.ClosedAt))
  for (let i = 0; i < closed.length; i += 1) {
    const a = closed[i]
    if (a._qualityPeer) continue
    const closeMs = stampMs(a.ClosedAt)
    for (let j = i + 1; j < closed.length; j += 1) {
      const b = closed[j]
      if (b.AssetID !== a.AssetID || b.FailureCode !== a.FailureCode) continue
      const days = Math.round((stampMs(b.CreatedAt) - closeMs) / 86400000)
      if (days < 0 || days > 30) continue
      a.Quality.reopen = true
      a.Quality.caused_reopen = true
      a.Quality.reopen_within_days = days || 1
      a.Quality.first_time_fix = false
      a.Comeback = 'Yes'
      if (!b.ParentWO) b.ParentWO = a.WorkOrderID
      break
    }
    for (const b of out) {
      if (b.WorkOrderID === a.WorkOrderID || b.AssetID !== a.AssetID) continue
      if (b.Type !== 'Unscheduled') continue
      const days = Math.round((stampMs(b.CreatedAt) - closeMs) / 86400000)
      if (days < 0 || days > 14) continue
      if (b.OutOfService === 'Yes' || /^P1|^P2/.test(b.Priority)) {
        a.Quality.bounce_back = true
        a.Quality.first_time_fix = false
        break
      }
    }
  }

  // More variant volume on the week without changing stage counts.
  for (let i = 120; i < 400; i += 7) {
    const row = out[i]
    if (!row || row.Status !== 'Closed' || (row.PartsNeeded || []).length) continue
    row.PartsNeeded = partsForTask(
      { FailureCode: row.FailureCode },
      'Closed',
      i,
      row.SAPReserv,
    ).map((p) => ({ ...p, status: 'received', reserved: false }))
  }
}

export function voiceStageOf(wo) {
  const dhlStatus = wo.dhl_status || wo.Status || ''
  const dhlPriority = wo.dhl_priority || wo.Priority || ''
  const status = wo.status || ''
  if (/^P1/i.test(dhlPriority)) return 'p1_aog'
  if (dhlStatus === 'Parts Hold' || /parts hold|waiting on material|material hold/i.test(`${dhlStatus} ${status}`)) {
    return 'parts_hold'
  }
  if (/^P4/i.test(dhlPriority) || /deferred/i.test(dhlPriority)) return 'deferred'
  if (dhlStatus === 'Closed' || status === 'Completed') return 'completed'
  if (dhlStatus === 'In Progress' || dhlStatus === 'QA Review' || status === 'In Progress') return 'in_progress'
  return 'open'
}

export function matchesStage(wo, stage) {
  const key = String(stage || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  const dhlStatus = wo.dhl_status || wo.Status || ''
  const dhlPriority = wo.dhl_priority || wo.Priority || ''
  const status = wo.status || ''
  if (!key || key === 'all' || key === 'mix' || key === 'stage_mix') return true
  if (key === 'this_week' || key === 'week') return true
  if (key === 'p1' || key === 'p1_aog' || key === 'aog' || key === 'gate_hold') {
    return /^P1/i.test(dhlPriority)
  }
  if (key === 'parts_hold' || key === 'parts' || key === 'waiting_on_material' || key === 'material') {
    return dhlStatus === 'Parts Hold' || /parts hold|waiting on material/i.test(`${dhlStatus} ${status}`)
  }
  if (key === 'deferred' || key === 'p4' || key === 'p4_deferred') {
    return /^P4/i.test(dhlPriority) || /deferred/i.test(dhlPriority)
  }
  if (key === 'in_progress' || key === 'progress') {
    return dhlStatus === 'In Progress' || dhlStatus === 'QA Review' || status === 'In Progress'
  }
  if (key === 'completed' || key === 'closed' || key === 'done') {
    return dhlStatus === 'Closed' || status === 'Completed'
  }
  if (key === 'open' || key === 'assigned') {
    return dhlStatus === 'Assigned' || status === 'Open'
  }
  const wf = String(wo.waterfall || wo.Waterfall || '').toLowerCase()
  if (key === 'planning' || key === 'still_in_planning') return wf === 'planning'
  if (key === 'parts_ready' || key === 'kit_complete') return wf === 'parts_ready'
  if (key === 'parts_short') return wf === 'parts_short' || dhlStatus === 'Parts Hold'
  if (key === 'manpower' || key === 'manpower_planned') return wf === 'manpower'
  if (key === 'in_flow') return wf === 'in_flow' || dhlStatus === 'In Progress'
  if (key === 'review' || key === 'qa_review' || key === 'technical_review') {
    return wf === 'review' || dhlStatus === 'QA Review'
  }
  if (key === 'archived') return wf === 'archived' || wo.archived === true || wo.Archived === 'Yes'
  if (key === 'variation' || key === 'scope_variation') {
    return wo.scope_variation === true || wo.ScopeVariation === 'Yes'
  }
  return voiceStageOf(wo) === key || (wf && wf === key)
}

export { SLICE }
