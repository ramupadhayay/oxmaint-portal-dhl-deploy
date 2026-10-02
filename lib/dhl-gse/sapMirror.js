/**
 * SAP MM / PM demo mirror for the DHL CVG voice line.
 *
 * Not a live ECC or S/4 connector. Seeds reservations, PR → PO → GR documents,
 * material stock, and the functional-location tree from the voice projection,
 * then applies process-local overlays so a spoken goods receipt or inbound
 * IDoc can mutate this call only. Demos work offline.
 *
 * Honesty: Oxmaint AI projection mirrored to SAP shapes — never brand Oxment.
 */

import { MATERIAL_META } from '../../components/industries/oxmaint/lib/packs/dhl-gse-data/voiceVolume.js'
import { pmHierarchyOf } from '../../components/industries/oxmaint/lib/packs/dhl-gse-data/pmHierarchy.js'

export const SAP_MIRROR_HONESTY =
  'Oxmaint AI projection mirrored to SAP MM/PM shapes for demo — not a live production SAP ECC or S/4 connector.'

export const SAP_SOURCE = {
  mm: 'SAP MM demo mirror',
  pm: 'SAP PM demo mirror',
}

function nowIso() {
  return new Date().toISOString()
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function stockKey(plant, sloc, sku) {
  return `${plant || 'CVG1'}|${sloc || '0001'}|${String(sku || '').toUpperCase()}`
}

function emptyState() {
  return {
    last_synced_at: nowIso(),
    stock: new Map(),
    prs: new Map(),
    pos: new Map(),
    grs: new Map(),
    reservations: new Map(),
    hierarchyPatches: new Map(),
    pending_outbound: [],
    events: [],
    seq: { pr: 60000, po: 55000, gr: 4900000100, idoc: 1000 },
    seeded: false,
  }
}

let state = null

export function resetSapMirror() {
  state = emptyState()
  return state
}

function ensure() {
  if (!state) state = emptyState()
  return state
}

function nextIdoc(type, direction, object, payload) {
  const s = ensure()
  s.seq.idoc += 1
  const rec = {
    idoc: `IDOC-V${s.seq.idoc}`,
    type,
    direction,
    object,
    at: nowIso(),
    payload: payload || {},
  }
  s.events.unshift(rec)
  if (s.events.length > 80) s.events.length = 80
  if (direction === 'outbound') {
    s.pending_outbound.unshift(rec)
    if (s.pending_outbound.length > 40) s.pending_outbound.length = 40
  }
  s.last_synced_at = rec.at
  return rec
}

function upsertStock(sku, extras = {}) {
  const s = ensure()
  const meta = MATERIAL_META[sku] || extras
  const plant = extras.plant || 'CVG1'
  const sloc = extras.storage_location || extras.sloc || meta.sloc || '0001'
  const key = stockKey(plant, sloc, sku)
  if (!s.stock.has(key)) {
    s.stock.set(key, {
      sku,
      sap_material: extras.sap_material || meta.sap_material || '4000000099',
      plant,
      storage_location: sloc,
      on_hand: Number.isFinite(Number(extras.on_hand)) ? Number(extras.on_hand) : Number(meta.on_hand) || 0,
      reserved: 0,
      last_synced_at: nowIso(),
      source: SAP_SOURCE.mm,
    })
  }
  return s.stock.get(key)
}

function putDoc(map, doc) {
  if (!doc || !doc.id) return
  map.set(doc.id, { ...doc })
}

function seedReservation(wo, line) {
  const s = ensure()
  const id = line.reservation || wo.sap_reservation
  if (!id) return
  const rec = s.reservations.get(id) || {
    id,
    sap_rsnum: id,
    work_order: wo.work_order_number || wo.workorder_id,
    plant: line.plant || wo.sap_plant || 'CVG1',
    items: [],
    status: 'Open',
  }
  rec.items.push({
    item: line.reservation_item || String(rec.items.length * 10 + 10).padStart(4, '0'),
    sku: line.sku,
    sap_material: line.sap_material,
    qty: line.qty,
    storage_location: line.storage_location,
    status: line.status,
  })
  s.reservations.set(id, rec)
}

export function seedSapMirror(reg) {
  const s = ensure()
  if (s.seeded) return s
  const orders = reg?.workOrders || []
  for (const wo of orders) {
    for (const line of wo.parts_needed || []) {
      upsertStock(line.sku, {
        plant: line.plant,
        sloc: line.storage_location,
        sap_material: line.sap_material,
      })
      const row = upsertStock(line.sku, { plant: line.plant, sloc: line.storage_location })
      if (line.reserved && line.status !== 'received') {
        row.reserved += Number(line.reserved_qty || line.qty) || 0
      }
      seedReservation(wo, line)
    }
    const p = wo.procurement
    if (p?.pr) putDoc(s.prs, { ...p.pr, work_order: p.pr.work_order || wo.work_order_number || wo.workorder_id })
    if (p?.po) putDoc(s.pos, { ...p.po, work_order: p.po.work_order || wo.work_order_number || wo.workorder_id })
    if (p?.gr) putDoc(s.grs, { ...p.gr, work_order: p.gr.work_order || wo.work_order_number || wo.workorder_id })
  }
  for (const [sku, meta] of Object.entries(MATERIAL_META)) {
    upsertStock(sku, meta)
  }
  s.seeded = true
  s.last_synced_at = nowIso()
  nextIdoc('SYNCHRON', 'inbound', 'mirror', { source: SAP_SOURCE.mm, note: 'Initial demo mirror seed' })
  return s
}

export function applyHierarchyPatches(assets) {
  const s = ensure()
  if (!s.hierarchyPatches.size) return assets || []
  return (assets || []).map((a) => {
    const patch = s.hierarchyPatches.get(a.asset_id)
    if (!patch) return a
    const next = { ...a, ...patch }
    if (patch.pm_hierarchy) next.pm_hierarchy = patch.pm_hierarchy
    return next
  })
}

function findStockRows({ sku, sap_material, plant, sloc }) {
  const s = ensure()
  const wantSku = sku ? String(sku).toUpperCase() : ''
  const wantMat = sap_material ? String(sap_material) : ''
  const out = []
  for (const row of s.stock.values()) {
    if (wantSku && row.sku.toUpperCase() !== wantSku) continue
    if (wantMat && String(row.sap_material) !== wantMat) continue
    if (plant && row.plant !== plant) continue
    if (sloc && row.storage_location !== sloc) continue
    out.push({ ...row, available: Math.max(0, row.on_hand - row.reserved) })
  }
  return out
}

export function checkMaterialStock({ sku, sap_material, workOrder, plant, sloc } = {}) {
  seedIfNeeded()
  const lines = workOrder
    ? (workOrder.parts_needed || []).map((p) => {
      const rows = findStockRows({
        sku: p.sku,
        sap_material: p.sap_material,
        plant: p.plant || plant,
        sloc: p.storage_location || sloc,
      })
      const live = rows[0]
      const needed = Number(p.qty) || 0
      const onHand = live ? live.on_hand : Number(p.on_hand) || 0
      const available = live ? live.available : onHand
      const insufficient = available < needed
      let availability = 'available'
      if (p.status === 'on_order' || workOrder.procurement?.po) availability = 'on_order'
      if (p.status === 'short' || (insufficient && !workOrder.procurement?.po)) availability = 'short'
      if (p.status === 'received') availability = 'received'
      if (!insufficient && p.status !== 'on_order' && p.status !== 'short') availability = 'available'
      if (insufficient && workOrder.procurement?.pr && !workOrder.procurement?.gr) {
        availability = workOrder.procurement?.po ? 'on_order' : 'short'
      }
      return {
        sku: p.sku,
        name: p.name,
        qty: needed,
        plant: p.plant || 'CVG1',
        storage_location: p.storage_location,
        sap_material: p.sap_material,
        on_hand: onHand,
        reserved: live?.reserved ?? p.reserved_qty ?? 0,
        available,
        line_status: p.status,
        availability,
        reservation: p.reservation,
        reservation_item: p.reservation_item,
      }
    })
    : findStockRows({ sku, sap_material, plant, sloc }).map((r) => ({
      ...r,
      availability: r.available > 0 ? 'available' : 'short',
    }))
  return {
    ok: true,
    honesty: SAP_MIRROR_HONESTY,
    source: SAP_SOURCE.mm,
    last_synced_at: ensure().last_synced_at,
    work_order: workOrder ? (workOrder.work_order_number || workOrder.workorder_id) : null,
    items: lines,
  }
}

function seedIfNeeded() {
  return ensure()
}

function woId(wo) {
  return wo?.work_order_number || wo?.workorder_id || null
}

export function getProcurementSnapshot(wo) {
  if (!wo) return null
  const s = ensure()
  const id = woId(wo)
  const base = wo.procurement ? clone(wo.procurement) : {
    reservation: wo.sap_reservation || null,
    notification: wo.sap_notification || null,
    pr: null,
    po: null,
    gr: null,
    chain_status: (wo.parts_needed || []).length ? 'RESERVATION_ONLY' : null,
  }
  if (base.pr?.id && s.prs.has(base.pr.id)) base.pr = { ...base.pr, ...s.prs.get(base.pr.id) }
  if (base.po?.id && s.pos.has(base.po.id)) base.po = { ...base.po, ...s.pos.get(base.po.id) }
  if (base.gr?.id && s.grs.has(base.gr.id)) base.gr = { ...base.gr, ...s.grs.get(base.gr.id) }
  if (!base.pr) {
    for (const pr of s.prs.values()) {
      if (pr.work_order === id) { base.pr = { ...pr }; break }
    }
  }
  if (!base.po) {
    for (const po of s.pos.values()) {
      if (po.work_order === id) { base.po = { ...po }; break }
    }
  }
  if (!base.gr) {
    for (const gr of s.grs.values()) {
      if (gr.work_order === id) { base.gr = { ...gr }; break }
    }
  }
  if (base.gr) base.chain_status = 'GR_POSTED'
  else if (base.po) base.chain_status = base.po.status === 'Received' ? 'GR_POSTED' : 'PO_OPEN'
  else if (base.pr) base.chain_status = base.pr.status === 'Created' ? 'PR_CREATED' : 'PR_RELEASED'
  return base
}

export function getPrPoGrStatus({ workOrder, prId, poId } = {}) {
  const s = ensure()
  if (prId && s.prs.has(prId)) {
    const pr = s.prs.get(prId)
    return formatChain({ pr, po: findLinked(s.pos, 'pr', pr.id), gr: findLinked(s.grs, 'pr', pr.id), work_order: pr.work_order })
  }
  if (poId && s.pos.has(poId)) {
    const po = s.pos.get(poId)
    return formatChain({
      po,
      pr: po.pr && s.prs.get(po.pr),
      gr: findLinked(s.grs, 'po', po.id),
      work_order: po.work_order,
    })
  }
  const snap = getProcurementSnapshot(workOrder)
  return formatChain({ ...snap, work_order: woId(workOrder) })
}

function findLinked(map, field, value) {
  for (const doc of map.values()) {
    if (doc[field] === value) return doc
  }
  return null
}

function formatChain({ reservation, notification, pr, po, gr, chain_status, work_order }) {
  return {
    ok: true,
    honesty: SAP_MIRROR_HONESTY,
    work_order: work_order || null,
    reservation: reservation || null,
    notification: notification || null,
    pr: pr || null,
    po: po || null,
    gr: gr || null,
    chain_status: chain_status || (gr ? 'GR_POSTED' : po ? 'PO_OPEN' : pr ? 'PR_RELEASED' : reservation ? 'RESERVATION_ONLY' : null),
    spoken: spokenChain({ pr, po, gr, chain_status }),
    last_synced_at: ensure().last_synced_at,
    source: SAP_SOURCE.mm,
  }
}

function spokenChain({ pr, po, gr, chain_status }) {
  if (gr) return `Goods receipt ${gr.id} posted${gr.posted_at ? ` at ${gr.posted_at}` : ''}. Parts are in the bin.`
  if (po) return `Purchase order ${po.id} is ${po.status || 'Open'}. Waiting on goods receipt.`
  if (pr) return `Purchase requisition ${pr.id} is ${pr.status || 'Released'}.`
  if (chain_status === 'RESERVATION_ONLY') return 'Reservation only — stock covers the component lines.'
  return 'No purchase document on this job.'
}

export function createPurchaseRequisition({ workOrder, sku, qty, status } = {}) {
  const s = ensure()
  const id = woId(workOrder)
  if (!id) return { ok: false, error: 'Name the work order to raise a PR against.' }
  const existing = getProcurementSnapshot(workOrder)
  if (existing?.pr && !status) {
    return {
      ok: true,
      honesty: SAP_MIRROR_HONESTY,
      already_exists: true,
      pr: existing.pr,
      procurement: existing,
      how_to_read: `${existing.pr.id} is already linked to ${id}. Use update to change status.`,
    }
  }
  const lines = (workOrder.parts_needed || []).filter((p) => !sku || p.sku === sku)
  const use = lines.length ? lines : [{ sku: sku || 'FIL-OIL-250', qty: qty || 1, name: sku || 'component' }]
  s.seq.pr += 1
  const createdAt = nowIso()
  const pr = {
    id: `PR-V${s.seq.pr}`,
    sap_banfn: String(10000000 + s.seq.pr).padStart(10, '0'),
    status: status || 'Released',
    created_at: createdAt,
    store_role: '0003',
    work_order: id,
    lines: use.map((p) => ({ sku: p.sku, name: p.name, qty: qty || p.qty, sap_material: p.sap_material })),
  }
  s.prs.set(pr.id, pr)
  const idoc = nextIdoc('PREQCR', 'outbound', pr.id, { work_order: id, sap_banfn: pr.sap_banfn })
  const procurement = {
    ...(existing || {}),
    reservation: existing?.reservation || workOrder.sap_reservation,
    notification: existing?.notification || workOrder.sap_notification,
    pr,
    po: existing?.po || null,
    gr: existing?.gr || null,
    chain_status: 'PR_RELEASED',
  }
  return {
    ok: true,
    honesty: SAP_MIRROR_HONESTY,
    pr,
    procurement,
    idoc,
    wo_patch: { procurement },
    how_to_read: `Raised ${pr.id} (BANFN ${pr.sap_banfn}) against ${id} for store role 0003. Demo IDoc ${idoc.idoc} queued outbound.`,
  }
}

export function updatePurchaseRequisition({ workOrder, prId, status } = {}) {
  const s = ensure()
  const snap = workOrder ? getProcurementSnapshot(workOrder) : null
  const id = prId || snap?.pr?.id
  const pr = id ? s.prs.get(id) : null
  if (!pr) return { ok: false, error: 'Purchase requisition not found.' }
  const nextStatus = String(status || 'Released')
  pr.status = /convert|po/i.test(nextStatus) ? 'Converted' : nextStatus
  pr.updated_at = nowIso()
  let po = snap?.po || findLinked(s.pos, 'pr', pr.id)
  if (/convert|po/i.test(nextStatus) && !po) {
    s.seq.po += 1
    po = {
      id: `PO-V${s.seq.po}`,
      sap_ebeln: String(4500000000 + s.seq.po).padStart(10, '0'),
      status: 'Open',
      created_at: nowIso(),
      work_order: pr.work_order,
      pr: pr.id,
    }
    s.pos.set(po.id, po)
    nextIdoc('PORDCR', 'outbound', po.id, { pr: pr.id, sap_ebeln: po.sap_ebeln })
  }
  nextIdoc('PREQCH', 'outbound', pr.id, { status: pr.status })
  const procurement = {
    ...(snap || {}),
    pr,
    po: po || null,
    gr: snap?.gr || null,
    chain_status: po ? 'PO_OPEN' : pr.status === 'Created' ? 'PR_CREATED' : 'PR_RELEASED',
  }
  return {
    ok: true,
    honesty: SAP_MIRROR_HONESTY,
    pr,
    po,
    procurement,
    wo_patch: { procurement },
    how_to_read: po
      ? `${pr.id} is ${pr.status}. Purchase order ${po.id} is ${po.status}.`
      : `${pr.id} is now ${pr.status}.`,
  }
}

export function postGoodsReceipt({ workOrder, poId, prId } = {}) {
  const s = ensure()
  const snap = getProcurementSnapshot(workOrder)
  const po = (poId && s.pos.get(poId)) || snap?.po || (prId && findLinked(s.pos, 'pr', prId))
  const pr = (prId && s.prs.get(prId)) || snap?.pr || (po?.pr && s.prs.get(po.pr))
  if (snap?.gr && snap.gr.status === 'Posted') {
    return {
      ok: true,
      already_posted: true,
      honesty: SAP_MIRROR_HONESTY,
      gr: snap.gr,
      procurement: snap,
      how_to_read: `Goods receipt ${snap.gr.id} is already posted on this job.`,
    }
  }
  s.seq.gr += 1
  const postedAt = nowIso()
  const gr = {
    id: `GR-V${s.seq.gr}`,
    sap_matdoc: String(s.seq.gr).padStart(10, '0'),
    move_type: '101',
    status: 'Posted',
    posted_at: postedAt,
    work_order: woId(workOrder),
    po: po?.id || null,
    pr: pr?.id || null,
  }
  s.grs.set(gr.id, gr)
  if (po) {
    po.status = 'Received'
    po.received_at = postedAt
  }
  if (pr) pr.status = 'Converted'
  const parts = (workOrder?.parts_needed || []).map((p) => {
    const row = upsertStock(p.sku, { plant: p.plant, sloc: p.storage_location, sap_material: p.sap_material })
    const qty = Number(p.qty) || 0
    row.on_hand += qty
    row.reserved = Math.max(0, (row.reserved || 0) - qty)
    row.last_synced_at = postedAt
    return { ...p, status: 'received', reserved: false, on_hand: row.on_hand }
  })
  nextIdoc('MBGMCR', 'outbound', gr.id, { move_type: '101', sap_matdoc: gr.sap_matdoc, work_order: gr.work_order })
  const procurement = {
    ...(snap || {}),
    pr: pr || snap?.pr || null,
    po: po || snap?.po || null,
    gr,
    chain_status: 'GR_POSTED',
  }
  const woPatch = {
    dhl_status: 'In Progress',
    status: 'In Progress',
    waterfall: 'in_flow',
    parts_needed: parts,
    procurement,
    store_update: 'goods_receipt',
  }
  return {
    ok: true,
    honesty: 'Demo goods receipt on the SAP MM mirror — not a live SAP posting.',
    gr,
    procurement,
    stock_updated: parts.map((p) => ({ sku: p.sku, on_hand: p.on_hand })),
    wo_patch: woPatch,
    how_to_read: `${gr.id} posted (material document ${gr.sap_matdoc}). Stock is up and ${gr.work_order} is off Parts Hold for this call.`,
  }
}

export function getMaterialBlockers(workOrders = []) {
  const s = ensure()
  const week = workOrders || []
  const blocked = week.filter((w) => w.dhl_status === 'Parts Hold' && w.status !== 'Completed')
  const openPrs = []
  const seen = new Set()
  for (const w of week) {
    const snap = getProcurementSnapshot(w)
    if (snap?.pr && !snap.gr && snap.pr.status !== 'Cancelled') {
      if (!seen.has(snap.pr.id)) {
        seen.add(snap.pr.id)
        openPrs.push({
          pr: snap.pr.id,
          status: snap.pr.status,
          work_order: woId(w),
          po: snap.po?.id || null,
          chain_status: snap.chain_status,
        })
      }
    }
  }
  for (const pr of s.prs.values()) {
    if (seen.has(pr.id)) continue
    if (pr.status === 'Cancelled') continue
    const linkedPo = findLinked(s.pos, 'pr', pr.id)
    const linkedGr = findLinked(s.grs, 'pr', pr.id)
    if (linkedGr) continue
    if (week.some((w) => woId(w) === pr.work_order)) {
      seen.add(pr.id)
      openPrs.push({
        pr: pr.id,
        status: pr.status,
        work_order: pr.work_order,
        po: linkedPo?.id || null,
        chain_status: linkedPo ? 'PO_OPEN' : 'PR_RELEASED',
      })
    }
  }
  return {
    ok: true,
    honesty: SAP_MIRROR_HONESTY,
    period: 'this_week',
    blocked_on_material: blocked.length,
    open_prs: openPrs.length,
    sample_blocked: blocked.slice(0, 8).map((w) => ({
      work_order: woId(w),
      title: w.title,
      asset_id: w.asset_id,
      pr: getProcurementSnapshot(w)?.pr?.id || null,
      po: getProcurementSnapshot(w)?.po?.id || null,
    })),
    sample_prs: openPrs.slice(0, 8),
    how_to_read:
      `${blocked.length} work orders this week are on Parts Hold. ${openPrs.length} purchase requisitions are still open (not goods-receipted).`,
  }
}

export function getAssetHierarchy(asset) {
  if (!asset) return { ok: false, error: 'Asset not found.' }
  const s = ensure()
  const patch = s.hierarchyPatches.get(asset.asset_id)
  const hierarchy = patch?.pm_hierarchy || asset.pm_hierarchy || pmHierarchyOf({
    AssetID: asset.asset_id,
    EquipmentType: asset.asset_type,
    AssignedShop: asset.assigned_shop,
    LocationZone: asset.functional_location_name,
    FunctLocation: asset.sap_functional_location,
    SAPEquipment: asset.sap_equipment,
    PlanningPlant: asset.sap_planning_plant,
    WorkCenter: asset.sap_work_center,
    Class: asset.dhl_class,
  })
  return {
    ok: true,
    honesty: SAP_MIRROR_HONESTY,
    source: SAP_SOURCE.pm,
    last_synced_at: s.last_synced_at,
    asset_id: asset.asset_id,
    asset_name: asset.asset_name,
    sap_equipment: hierarchy.equipment?.number || asset.sap_equipment,
    sap_functional_location: hierarchy.functional_locations?.slice(-1)[0]?.tplnr || asset.sap_functional_location,
    sap_object_type: hierarchy.equipment?.object_type || asset.sap_object_type || 'GSE',
    path: hierarchy.path,
    path_text: hierarchy.path_text,
    functional_locations: hierarchy.functional_locations,
    equipment: hierarchy.equipment,
    pending_outbound: s.pending_outbound.filter((e) => e.object === asset.asset_id).slice(0, 5),
    how_to_read: `${asset.asset_id} sits ${hierarchy.path_text}. FuncLoc and equipment numbers are SAP PM-shaped keys on the demo mirror.`,
  }
}

export function getSapSyncStatus() {
  const s = ensure()
  return {
    ok: true,
    honesty: SAP_MIRROR_HONESTY,
    live_production_sap: false,
    mm: {
      source: SAP_SOURCE.mm,
      last_synced_at: s.last_synced_at,
      stock_rows: s.stock.size,
      purchase_requisitions: s.prs.size,
      purchase_orders: s.pos.size,
      goods_receipts: s.grs.size,
    },
    pm: {
      source: SAP_SOURCE.pm,
      last_synced_at: s.last_synced_at,
      pending_hierarchy_patches: s.hierarchyPatches.size,
    },
    pending_outbound_changes: s.pending_outbound.slice(0, 12),
    recent_idocs: s.events.slice(0, 8),
    how_to_read:
      'Bi-directional demo facade: outbound IDocs queue here; apply_inbound_sap_change applies a synthetic inbound IDoc. Not connected to a production SAP system.',
  }
}

export function applyInboundSapChange({ idoc_type, payload = {}, asset } = {}) {
  const s = ensure()
  const type = String(idoc_type || payload.type || '').toUpperCase() || 'SYNCHRON'
  const body = payload || {}
  const idoc = nextIdoc(type, 'inbound', body.object || body.asset_id || body.work_order || 'mirror', body)

  if (type === 'MBGMCR' || type === 'WMMBXY' || type === 'STOCK') {
    const sku = body.sku || body.material
    if (sku) {
      const row = upsertStock(sku, body)
      const qty = Number(body.qty || body.quantity) || 0
      row.on_hand = Math.max(0, row.on_hand + qty)
      row.last_synced_at = nowIso()
    }
  }

  if ((type === 'FUNCLOC_CHANGE' || type === 'EQUIPMENT_CHANGE' || type === 'ILOA') && asset) {
    const current = getAssetHierarchy(asset)
    const nodes = clone(current.functional_locations || [])
    if (body.tplnr && nodes.length) {
      nodes[nodes.length - 1] = {
        ...nodes[nodes.length - 1],
        tplnr: body.tplnr,
        label: body.label || body.tplnr,
      }
    }
    const equipment = {
      ...(current.equipment || {}),
      number: body.equipment_number || body.sap_equipment || current.equipment?.number,
      object_type: body.object_type || current.equipment?.object_type || 'GSE',
    }
    const path = nodes.map((n) => n.label)
    const hierarchy = {
      path,
      path_text: path.join(' → '),
      functional_locations: nodes,
      equipment,
    }
    s.hierarchyPatches.set(asset.asset_id, {
      sap_functional_location: nodes[nodes.length - 1]?.tplnr,
      sap_equipment: equipment.number,
      pm_hierarchy: hierarchy,
    })
    nextIdoc(type === 'EQUIPMENT_CHANGE' ? 'EQUIPMENT_CHANGE' : 'FUNCLOC_CHANGE', 'outbound', asset.asset_id, {
      ack: idoc.idoc,
    })
    return {
      ok: true,
      honesty: SAP_MIRROR_HONESTY,
      idoc,
      asset_id: asset.asset_id,
      hierarchy,
      how_to_read: `Inbound ${type} applied on the SAP PM demo mirror. ${asset.asset_id} now sits ${hierarchy.path_text}.`,
    }
  }

  return {
    ok: true,
    honesty: SAP_MIRROR_HONESTY,
    idoc,
    sync: getSapSyncStatus(),
    how_to_read: `Inbound IDoc ${idoc.idoc} (${type}) applied on the demo mirror.`,
  }
}

export function queueOutboundChange(type, object, payload) {
  return nextIdoc(type, 'outbound', object, payload)
}
