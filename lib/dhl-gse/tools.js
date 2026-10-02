import { dhlPackActive, getVoiceRegister } from './register.js'
import {
  filterByStage,
  filterByWindow,
  monthWindow,
  stageMix,
  summarizeWo,
  weekWindow,
} from './slices.js'
import { createMaintenanceRequest, listMaintenanceRequests } from './store.js'
import { fallbackSearch, pineconeConfig, queryWorkOrders, upsertWorkOrders } from './pinecone.js'
import { DEMO_TECH, VOICE_VOLUME } from '../../components/industries/oxmaint/lib/packs/dhl-gse-data/voiceVolume'
import { assertToolRole, verifySpokenRole } from './roles.js'
import { applyWorkOrderOverlay } from './session.js'
import { resolveGseAsset } from './store.js'
import {
  applyInboundSapChange,
  checkMaterialStock,
  createPurchaseRequisition,
  getAssetHierarchy,
  getMaterialBlockers,
  getPrPoGrStatus,
  getProcurementSnapshot,
  getSapSyncStatus,
  postGoodsReceipt,
  SAP_MIRROR_HONESTY,
  updatePurchaseRequisition,
} from './sapMirror.js'
import { getSpareVariantInsights, getWorkmanshipReport } from './insights.js'
import { generateAuditReport } from './auditReport.js'
import {
  advanceWaterfall,
  archiveWorkOrder,
  assignWorkOrder,
  closeTechnicalReview,
  flagScopeVariation,
  getManpowerPlan,
  getWaterfallPipeline,
  listWaterfallStage,
} from './waterfall.js'

const SERVER = {
  name: 'oxmaint-dhl-gse',
  version: '0.1.0',
}

function packGuard() {
  if (dhlPackActive()) return null
  return {
    ok: false,
    error: 'DHL CVG GSE tools are only on a build with NEXT_PUBLIC_OXMAINT_PACK=dhl-gse.',
  }
}

function roleGuard(args, tool) {
  const denied = packGuard()
  if (denied) return denied
  const gate = assertToolRole(args, tool)
  if (!gate.ok) return gate
  return null
}

function isDemoTech(wo) {
  return wo.assigned_to_id === DEMO_TECH.tech_id
    || wo.assigned_to_name === DEMO_TECH.name
    || Boolean(wo.demo_tech)
}

function findWorkOrder(reg, rawId) {
  const key = String(rawId || '').trim().toUpperCase()
  if (!key) return null
  const compact = key.replace(/[^A-Z0-9]/g, '')
  return (reg.workOrders || []).find((w) => {
    const id = String(w.work_order_number || w.workorder_id || '').toUpperCase()
    return id === key || id.replace(/[^A-Z0-9]/g, '') === compact || id.endsWith(compact.slice(-5))
  }) || null
}

function detailWorkOrder(w) {
  const procurement = getProcurementSnapshot(w)
  return {
    ...summarizeWo(w),
    description: w.description,
    parts_needed: Array.isArray(w.parts_needed) ? w.parts_needed : [],
    parts_cost: w.parts_cost,
    estimated_hours: w.estimated_hours,
    out_of_service: w.out_of_service,
    sap_reservation: w.sap_reservation,
    sap_notification: w.sap_notification,
    sap_order: w.sap_order,
    sap_equipment: w.sap_equipment,
    sap_functional_location: w.sap_functional_location,
    procurement,
    pm_hierarchy: w.pm_hierarchy
      ? { path_text: w.pm_hierarchy.path_text, equipment: w.pm_hierarchy.equipment }
      : null,
    waterfall: w.waterfall,
    origin: w.origin,
    planned_start: w.planned_start,
    planned_finish: w.planned_finish,
    scope_variation: Boolean(w.scope_variation),
    variation_note: w.variation_note,
    archived: Boolean(w.archived),
    planning: w.planning,
  }
}

function hotItems(week) {
  const p1 = week.filter((w) => /^P1/i.test(w.dhl_priority || '') && w.dhl_status !== 'Closed')
  const hold = week.filter((w) => w.dhl_status === 'Parts Hold')
  return {
    p1_aog: p1.slice(0, 5).map(summarizeWo),
    parts_hold: hold.slice(0, 5).map(summarizeWo),
  }
}

function nowMs() {
  const t = new Date()
  t.setHours(6, 0, 0, 0)
  return t.getTime()
}

function parseLimit(value, fallback = 12) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(50, Math.floor(n))
}

function windowOf(period, now) {
  const key = String(period || 'week').toLowerCase()
  if (key === 'month' || key === 'this_month' || key === 'monthly') return { ...monthWindow(now), label: 'this_month', days: 30 }
  if (key === 'open' || key === 'current' || key === 'backlog') return { start: 0, end: now, label: 'open_backlog', days: null }
  return { ...weekWindow(now), label: 'this_week', days: 7 }
}

function scopedOrders(reg, period, now) {
  const win = windowOf(period, now)
  if (win.label === 'open_backlog') {
    return {
      win,
      items: (reg.workOrders || []).filter((w) => w.dhl_status !== 'Closed' && w.status !== 'Completed'),
    }
  }
  return { win, items: filterByWindow(reg.workOrders, win) }
}

export async function verifyVoiceRole(args = {}) {
  const denied = packGuard()
  if (denied) return denied
  const spoken = args.spoken_code || args.access_code || args.code || args.pin || args.q
  return verifySpokenRole(spoken)
}

export async function getDhlWoStatusSlice(args = {}) {
  const denied = roleGuard(args, 'get_dhl_wo_status_slice')
  if (denied) return denied
  const role = assertToolRole(args, 'get_dhl_wo_status_slice').role
  const reg = getVoiceRegister()
  const now = nowMs()
  const period = args.period || args.window || 'week'
  const stage = args.stage || args.slice || 'all'
  const { win, items } = scopedOrders(reg, period, now)
  if (role?.id === 'store' && stage === 'all') {
    return {
      ok: true,
      honesty: reg.honesty,
      period: win.label,
      stage: 'parts_hold',
      count: filterByStage(items, 'parts_hold').length,
      mix: stageMix(items),
      hint: 'Store view defaults to Parts Hold. Ask get_parts_hold_queue for the list.',
      sample: filterByStage(items, 'parts_hold').slice(0, parseLimit(args.limit, 8)).map(summarizeWo),
      source: 'dhl-gse voice projection',
    }
  }
  const staged = filterByStage(items, stage)
  return {
    ok: true,
    honesty: reg.honesty,
    period: win.label,
    stage: stage || 'all',
    count: staged.length,
    mix: stageMix(items),
    target: win.label === 'this_week' ? VOICE_VOLUME.weeklyTarget : win.label === 'this_month' ? VOICE_VOLUME.monthlyTarget : null,
    sample: staged.slice(0, parseLimit(args.limit, 8)).map(summarizeWo),
    source: 'dhl-gse voice projection',
    pinecone: pineconeConfig().configured ? 'available' : 'fallback',
  }
}

export async function listWorkOrdersByStage(args = {}) {
  const denied = roleGuard(args, 'list_work_orders_by_stage')
  if (denied) return denied
  const role = assertToolRole(args, 'list_work_orders_by_stage').role
  const reg = getVoiceRegister()
  const now = nowMs()
  const period = args.period || args.window || 'week'
  const stage = args.stage || args.slice || 'all'
  const q = String(args.q || args.query || args.keyword || '').trim()
  const { win, items } = scopedOrders(reg, period, now)
  if (role?.id === 'store' && !/parts|material|hold/i.test(String(stage))) {
    return {
      ok: false,
      error: 'Store can list Parts Hold / waiting-on-material jobs, not the full stage board.',
      hint: 'Call get_parts_hold_queue or pass stage=parts_hold.',
    }
  }
  let staged = filterByStage(items, stage)
  let retrieval = 'deterministic'
  if (q) {
    const cfg = pineconeConfig()
    if (cfg.configured) {
      await upsertWorkOrders(reg.workOrders)
      const remote = await queryWorkOrders({ q, topK: parseLimit(args.limit, 12) })
      if (remote.ok) {
        const ids = new Set(remote.matches.map((m) => m.id))
        const hit = staged.filter((w) => ids.has(w.work_order_number || w.workorder_id))
        if (hit.length) {
          staged = hit
          retrieval = 'pinecone'
        }
      }
    }
    if (retrieval === 'deterministic') staged = fallbackSearch(staged, q, parseLimit(args.limit, 12))
  }
  const limit = parseLimit(args.limit, 12)
  return {
    ok: true,
    honesty: reg.honesty,
    period: win.label,
    stage,
    q: q || null,
    retrieval,
    total: staged.length,
    items: staged.slice(0, limit).map(summarizeWo),
  }
}

export async function getWeeklyWoProjection(args = {}) {
  const denied = roleGuard(args, 'get_weekly_wo_projection')
  if (denied) return denied
  const reg = getVoiceRegister()
  const now = nowMs()
  const week = filterByWindow(reg.workOrders, weekWindow(now))
  const month = filterByWindow(reg.workOrders, monthWindow(now))
  return {
    ok: true,
    honesty: reg.honesty,
    shop: 'DHL Express — CVG Americas Superhub GSE Maintenance',
    weekly: {
      target: VOICE_VOLUME.weeklyTarget,
      raised: week.length,
      completed: week.filter((w) => w.dhl_status === 'Closed' || w.status === 'Completed').length,
      mix: stageMix(week),
    },
    monthly: {
      target: VOICE_VOLUME.monthlyTarget,
      raised: month.length,
      completed: month.filter((w) => w.dhl_status === 'Closed' || w.status === 'Completed').length,
      mix: stageMix(month),
    },
    how_to_read:
      'Say the weekly raised count when asked "how many work orders this week". Assigned is the open board not yet started. Parts Hold is waiting on material. Deferred is P4. P1-AOG is aircraft-on-ground / gate hold. These current-period numbers are the synthetic projection, not DHL actuals.',
    hot: hotItems(week),
    include_sample: args.include_sample ? week.slice(0, 5).map(summarizeWo) : undefined,
  }
}

export async function createGseMaintenanceRequest(args = {}) {
  const denied = roleGuard(args, 'create_maintenance_request')
  if (denied) return denied
  const reg = getVoiceRegister()
  return createMaintenanceRequest({
    ...args,
    requested_by: args.requested_by || DEMO_TECH.name,
  }, { assets: reg.assets, site: reg.site })
}

export async function listGseAssets(args = {}) {
  const denied = roleGuard(args, 'list_gse_assets')
  if (denied) return denied
  const reg = getVoiceRegister()
  const q = String(args.q || args.keyword || '').trim().toLowerCase()
  let items = reg.assets || []
  if (q) {
    items = items.filter((a) =>
      [a.asset_id, a.asset_name, a.asset_type, a.manufacturer, a.model]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }
  const limit = parseLimit(args.limit, 15)
  return {
    ok: true,
    total: items.length,
    items: items.slice(0, limit).map((a) => ({
      asset_id: a.asset_id,
      asset_name: a.asset_name,
      type: a.asset_type,
      manufacturer: a.manufacturer,
      model: a.model,
      location: a.functional_location_name,
      status: a.dhl_status || a.status,
      meter: a.current_meter,
      sap_equipment: a.sap_equipment,
      sap_functional_location: a.sap_functional_location,
      sap_object_type: a.sap_object_type || 'GSE',
      hierarchy: a.pm_hierarchy?.path_text || null,
    })),
  }
}

export async function listMyWorkOrders(args = {}) {
  const denied = roleGuard(args, 'list_my_work_orders')
  if (denied) return denied
  const reg = getVoiceRegister()
  const mine = (reg.workOrders || []).filter(isDemoTech)
  const open = mine.filter((w) => w.dhl_status !== 'Closed' && w.status !== 'Completed')
  return {
    ok: true,
    honesty: DEMO_TECH.honesty,
    technician: DEMO_TECH,
    total: mine.length,
    open: open.length,
    items: (args.open_only === false ? mine : open).slice(0, parseLimit(args.limit, 20)).map(detailWorkOrder),
    how_to_read:
      `These jobs are assigned to ${DEMO_TECH.name} (${DEMO_TECH.tech_id}) on the synthetic register. Read parts_needed when they ask what they need to finish.`,
  }
}

export async function getWorkOrderDetail(args = {}) {
  const denied = roleGuard(args, 'get_work_order_detail')
  if (denied) return denied
  const role = assertToolRole(args, 'get_work_order_detail').role
  const reg = getVoiceRegister()
  const wo = findWorkOrder(reg, args.work_order || args.workorder_id || args.id || args.q)
  if (!wo) {
    return { ok: false, error: 'Work order not found.', hint: 'Use a WO-V26-##### id from the list.' }
  }
  if (role?.id === 'technician' && !isDemoTech(wo)) {
    return {
      ok: false,
      error: `WO ${wo.work_order_number} is not on ${DEMO_TECH.name}'s board.`,
      hint: 'Ask list_my_work_orders for jobs assigned to you.',
    }
  }
  return {
    ok: true,
    honesty: reg.honesty,
    work_order: detailWorkOrder(wo),
  }
}

export async function getPartsHoldQueue(args = {}) {
  const denied = roleGuard(args, 'get_parts_hold_queue')
  if (denied) return denied
  const reg = getVoiceRegister()
  const now = nowMs()
  const { items } = scopedOrders(reg, args.period || 'week', now)
  const hold = filterByStage(items, 'parts_hold')
  return {
    ok: true,
    honesty: reg.honesty,
    period: 'this_week',
    count: hold.length,
    items: hold.slice(0, parseLimit(args.limit, 20)).map(detailWorkOrder),
    how_to_read:
      'Waiting on material. status on each parts_needed line is short, on_order, or reserved. A spoken “parts received” on a named WO can clear the hold for this call.',
  }
}

export async function getMaterialStatus(args = {}) {
  const denied = roleGuard(args, 'get_material_status')
  if (denied) return denied
  const reg = getVoiceRegister()
  const now = nowMs()
  const { items } = scopedOrders(reg, 'week', now)
  const withParts = items.filter((w) => (w.parts_needed || []).length && w.dhl_status !== 'Closed')
  const short = withParts.filter((w) => (w.parts_needed || []).some((p) => p.status === 'short' || p.status === 'on_order'))
  return {
    ok: true,
    honesty: reg.honesty,
    week_jobs_with_parts: withParts.length,
    waiting_or_short: short.length,
    parts_hold: filterByStage(items, 'parts_hold').length,
    sample: short.slice(0, parseLimit(args.limit, 12)).map(detailWorkOrder),
  }
}

export async function applyStoreUpdate(args = {}) {
  const denied = roleGuard(args, 'apply_store_update')
  if (denied) return denied
  const reg = getVoiceRegister()
  const wo = findWorkOrder(reg, args.work_order || args.workorder_id || args.id)
  if (!wo) {
    return { ok: false, error: 'Name the work order to update (WO-V26-#####).' }
  }
  const action = String(args.action || args.update || 'parts_received').toLowerCase()
  if (!/receiv|clear|arrived|in stock|parts received|goods receipt|gr/.test(action) && action !== 'parts_received') {
    return {
      ok: false,
      error: `Store update not recognised: ${action}`,
      hint: 'Say “parts received” or post a goods receipt on a named Parts Hold job.',
    }
  }
  return postGseGoodsReceipt({ ...args, work_order: wo.work_order_number || wo.workorder_id })
}

export async function checkGseMaterialStock(args = {}) {
  const denied = roleGuard(args, 'check_material_stock')
  if (denied) return denied
  const role = assertToolRole(args, 'check_material_stock').role
  const reg = getVoiceRegister()
  const wo = findWorkOrder(reg, args.work_order || args.workorder_id || args.id)
  if (role?.id === 'technician' && wo && !isDemoTech(wo)) {
    return {
      ok: false,
      error: `WO ${wo.work_order_number} is not on ${DEMO_TECH.name}'s board.`,
    }
  }
  return checkMaterialStock({
    sku: args.sku || args.material || args.part,
    sap_material: args.sap_material,
    plant: args.plant,
    sloc: args.storage_location || args.sloc,
    workOrder: wo,
  })
}

export async function createGsePurchaseRequisition(args = {}) {
  const denied = roleGuard(args, 'create_purchase_requisition')
  if (denied) return denied
  const reg = getVoiceRegister()
  const wo = findWorkOrder(reg, args.work_order || args.workorder_id || args.id)
  if (!wo) return { ok: false, error: 'Name the work order to raise a PR against (WO-V26-#####).' }
  const result = createPurchaseRequisition({
    workOrder: wo,
    sku: args.sku || args.material,
    qty: args.qty,
    status: args.status,
  })
  if (result.ok && result.wo_patch) {
    applyWorkOrderOverlay(wo.work_order_number || wo.workorder_id, result.wo_patch)
  }
  return result
}

export async function updateGsePurchaseRequisition(args = {}) {
  const denied = roleGuard(args, 'update_purchase_requisition')
  if (denied) return denied
  const reg = getVoiceRegister()
  const wo = findWorkOrder(reg, args.work_order || args.workorder_id || args.id)
  const result = updatePurchaseRequisition({
    workOrder: wo,
    prId: args.pr || args.pr_id || args.banfn,
    status: args.status || args.update,
  })
  if (result.ok && result.wo_patch && wo) {
    applyWorkOrderOverlay(wo.work_order_number || wo.workorder_id, result.wo_patch)
  }
  return result
}

export async function getGsePrPoGrStatus(args = {}) {
  const denied = roleGuard(args, 'get_pr_po_gr_status')
  if (denied) return denied
  const role = assertToolRole(args, 'get_pr_po_gr_status').role
  const reg = getVoiceRegister()
  const wo = findWorkOrder(reg, args.work_order || args.workorder_id || args.id)
  if (role?.id === 'technician' && wo && !isDemoTech(wo)) {
    return {
      ok: false,
      error: `WO ${wo.work_order_number} is not on ${DEMO_TECH.name}'s board.`,
    }
  }
  if (!wo && !args.pr && !args.po) {
    return { ok: false, error: 'Name a work order, PR, or PO.' }
  }
  return getPrPoGrStatus({
    workOrder: wo,
    prId: args.pr || args.pr_id,
    poId: args.po || args.po_id,
  })
}

export async function postGseGoodsReceipt(args = {}) {
  const denied = roleGuard(args, 'post_goods_receipt')
  if (denied) return denied
  const reg = getVoiceRegister()
  const wo = findWorkOrder(reg, args.work_order || args.workorder_id || args.id)
  if (!wo) return { ok: false, error: 'Name the work order to post a goods receipt against.' }
  const result = postGoodsReceipt({
    workOrder: wo,
    poId: args.po || args.po_id,
    prId: args.pr || args.pr_id,
  })
  if (result.ok && result.wo_patch) {
    applyWorkOrderOverlay(wo.work_order_number || wo.workorder_id, result.wo_patch)
  }
  return {
    ...result,
    work_order: wo.work_order_number,
    before: wo.dhl_status,
    after: result.wo_patch?.dhl_status || wo.dhl_status,
    parts_needed: result.wo_patch?.parts_needed || wo.parts_needed,
  }
}

export async function getGseMaterialBlockers(args = {}) {
  const denied = roleGuard(args, 'get_material_blockers')
  if (denied) return denied
  const reg = getVoiceRegister()
  const now = nowMs()
  const { items } = scopedOrders(reg, args.period || 'week', now)
  return getMaterialBlockers(items)
}

export async function getGseAssetHierarchy(args = {}) {
  const denied = roleGuard(args, 'get_asset_hierarchy')
  if (denied) return denied
  const reg = getVoiceRegister()
  const asset = resolveGseAsset({
    asset_id: args.asset_id || args.id || args.tag,
    q: args.q || args.keyword || args.work_order,
  }, reg.assets)
  if (!asset) {
    const wo = findWorkOrder(reg, args.work_order || args.q)
    if (wo) {
      const hit = (reg.assets || []).find((a) => a.asset_id === wo.asset_id)
      if (hit) return getAssetHierarchy(hit)
    }
    return {
      ok: false,
      error: 'Asset not found.',
      hint: 'Use CVG-PWR-0035, the last four digits, or belt loader.',
    }
  }
  return getAssetHierarchy(asset)
}

export async function getGseSapSyncStatus(args = {}) {
  const denied = roleGuard(args, 'get_sap_sync_status')
  if (denied) return denied
  getVoiceRegister()
  return getSapSyncStatus()
}

export async function getGseWorkmanshipScore(args = {}) {
  const denied = roleGuard(args, 'get_workmanship_score')
  if (denied) return denied
  const role = assertToolRole(args, 'get_workmanship_score').role
  const ownOnly = role?.id === 'technician'
  const techId = args.tech_id || args.technician || args.q || (ownOnly ? DEMO_TECH.tech_id : '')
  return getWorkmanshipReport({
    tech_id: ownOnly ? DEMO_TECH.tech_id : techId,
    own_only: ownOnly,
  })
}

export async function getGseSpareVariantInsights(args = {}) {
  const denied = roleGuard(args, 'get_spare_variant_insights')
  if (denied) return denied
  return getSpareVariantInsights({ sku: args.sku || args.material || args.q })
}

export async function getGseWaterfallPipeline(args = {}) {
  const denied = roleGuard(args, 'get_waterfall_pipeline')
  if (denied) return denied
  const reg = getVoiceRegister()
  return getWaterfallPipeline(reg, { period: args.period || args.window || 'week', now: nowMs() })
}

export async function listGseWaterfallStage(args = {}) {
  const denied = roleGuard(args, 'list_waterfall_stage')
  if (denied) return denied
  const role = assertToolRole(args, 'list_waterfall_stage').role
  const stage = args.stage || args.slice || 'planning'
  if (role?.id === 'store' && !/parts|pr|short|ready|material/i.test(String(stage))) {
    return {
      ok: false,
      error: 'Store can list parts-short / parts-ready jobs, not the full waterfall.',
      hint: 'Pass stage=parts_short or use get_parts_hold_queue.',
    }
  }
  const reg = getVoiceRegister()
  return listWaterfallStage(reg, {
    stage,
    period: args.period || 'week',
    now: nowMs(),
    limit: args.limit,
  })
}

export async function getGseManpowerPlan(args = {}) {
  const denied = roleGuard(args, 'get_manpower_plan')
  if (denied) return denied
  const reg = getVoiceRegister()
  return getManpowerPlan(reg, {
    day: args.day || args.weekday || args.q,
    period: args.period || 'week',
    now: nowMs(),
  })
}

export async function assignGseWorkOrder(args = {}) {
  const denied = roleGuard(args, 'assign_work_order')
  if (denied) return denied
  const reg = getVoiceRegister()
  const wo = findWorkOrder(reg, args.work_order || args.workorder_id || args.id)
  return assignWorkOrder(wo, {
    tech_id: args.tech_id || args.technician,
    tech_name: args.tech_name || args.name,
    planned_start: args.planned_start || args.start,
    planned_finish: args.planned_finish || args.finish,
  })
}

export async function flagGseScopeVariation(args = {}) {
  const denied = roleGuard(args, 'flag_scope_variation')
  if (denied) return denied
  const role = assertToolRole(args, 'flag_scope_variation').role
  const reg = getVoiceRegister()
  const wo = findWorkOrder(reg, args.work_order || args.workorder_id || args.id)
  if (!wo) return { ok: false, error: 'Name the work order (WO-V26-#####).' }
  if (role?.id === 'technician' && !isDemoTech(wo)) {
    return { ok: false, error: `WO ${wo.work_order_number} is not on ${DEMO_TECH.name}'s board.` }
  }
  return flagScopeVariation(wo, { note: args.note || args.reason || args.q })
}

export async function advanceGseWaterfall(args = {}) {
  const denied = roleGuard(args, 'advance_waterfall_stage')
  if (denied) return denied
  const role = assertToolRole(args, 'advance_waterfall_stage').role
  const reg = getVoiceRegister()
  const wo = findWorkOrder(reg, args.work_order || args.workorder_id || args.id)
  if (!wo) return { ok: false, error: 'Name the work order to advance (WO-V26-#####).' }
  if (role?.id === 'technician') {
    if (!isDemoTech(wo)) {
      return { ok: false, error: `WO ${wo.work_order_number} is not on ${DEMO_TECH.name}'s board.` }
    }
    const to = String(args.to || args.stage || 'in_flow')
    if (!/in_flow|in_progress/i.test(to)) {
      return { ok: false, error: 'Technician can only start their own job (advance to in_flow).' }
    }
  }
  return advanceWaterfall(wo, { to: args.to || args.stage })
}

export async function closeGseTechnicalReview(args = {}) {
  const denied = roleGuard(args, 'close_technical_review')
  if (denied) return denied
  const reg = getVoiceRegister()
  const wo = findWorkOrder(reg, args.work_order || args.workorder_id || args.id)
  return closeTechnicalReview(wo)
}

export async function archiveGseWorkOrder(args = {}) {
  const denied = roleGuard(args, 'archive_work_order')
  if (denied) return denied
  const reg = getVoiceRegister()
  const wo = findWorkOrder(reg, args.work_order || args.workorder_id || args.id)
  return archiveWorkOrder(wo)
}

export async function generateGseAuditReport(args = {}) {
  const denied = roleGuard(args, 'generate_audit_report')
  if (denied) return denied
  const period = args.period || args.window || args.q || 'quarter'
  const result = await generateAuditReport({ period })
  return {
    ok: result.ok,
    honesty: result.honesty,
    period: result.period,
    label: result.label,
    url: result.url,
    portal: result.portal,
    work_orders: result.work_orders,
    filename: result.filename,
    how_to_read: result.how_to_read,
  }
}

export async function applyDemoSapInbound(args = {}) {
  const denied = roleGuard(args, 'apply_demo_sap_inbound')
  if (denied) return denied
  const reg = getVoiceRegister()
  const asset = resolveGseAsset({
    asset_id: args.asset_id || args.id || args.tag,
    q: args.q,
  }, reg.assets)
  return applyInboundSapChange({
    idoc_type: args.idoc_type || args.type,
    payload: {
      sku: args.sku || args.material,
      qty: args.qty,
      tplnr: args.tplnr || args.functional_location,
      label: args.label,
      equipment_number: args.equipment_number || args.sap_equipment,
      object_type: args.object_type,
      work_order: args.work_order,
      asset_id: asset?.asset_id,
    },
    asset,
  })
}

export async function getPortalOverview(args = {}) {
  const denied = roleGuard(args, 'get_portal_overview')
  if (denied) return denied
  const reg = getVoiceRegister()
  const now = nowMs()
  const week = filterByWindow(reg.workOrders, weekWindow(now))
  const month = filterByWindow(reg.workOrders, monthWindow(now))
  return {
    ok: true,
    name: SERVER.name,
    version: SERVER.version,
    product: 'Oxmaint AI — DHL CVG GSE',
    shop: 'DHL Express Cincinnati (CVG) Americas Superhub — GSE Maintenance',
    honesty: reg.honesty,
    counts: {
      assets: (reg.assets || []).length,
      voice_month: month.length,
      voice_week: week.length,
      historic_live: reg.meta?.counts?.liveWorkOrders ?? null,
    },
    weekly_target: VOICE_VOLUME.weeklyTarget,
    monthly_target: VOICE_VOLUME.monthlyTarget,
    voice: '+1 (415) 639-4335',
    tools: Object.keys(TOOLS),
  }
}

export const TOOLS = {
  verify_voice_role: {
    title: 'Verify spoken access code',
    description:
      'Call this first when the caller says an access code (0001, 0002, 0003, or spoken forms like “triple zero one”). Sets technician / supervisor / store persona for the rest of the call.',
    inputSchema: {
      type: 'object',
      properties: {
        spoken_code: { type: 'string', description: 'What they said: 0001, triple zero one, zero zero zero two…' },
        access_code: { type: 'string' },
      },
      required: ['spoken_code'],
    },
    handler: verifyVoiceRole,
  },
  get_portal_overview: {
    title: 'Portal overview',
    description: 'Supervisor shop context, honesty banner, weekly/monthly WO targets, and tool list.',
    inputSchema: { type: 'object', properties: {} },
    handler: getPortalOverview,
  },
  get_dhl_wo_status_slice: {
    title: 'Get DHL work-order status slice',
    description:
      'Count work orders for a stage and period. Stages: this week, parts_hold (waiting on material), deferred (P4), in_progress, completed, open, p1_aog. Period: week (default) or month. Returns count plus stage mix. Synthetic CVG projection, not DHL actuals.',
    inputSchema: {
      type: 'object',
      properties: {
        stage: {
          type: 'string',
          description: 'all | open | in_progress | parts_hold | deferred | completed | p1_aog',
        },
        period: { type: 'string', description: 'week | month | backlog' },
        limit: { type: 'number', description: 'Sample size (max 50)' },
      },
    },
    handler: getDhlWoStatusSlice,
  },
  list_work_orders_by_stage: {
    title: 'List work orders by stage',
    description:
      'List CVG GSE work orders in a stage (Parts Hold, Deferred, In Progress, Completed, P1-AOG, Open) for this week or month. Optional keyword q uses Pinecone namespace oxmaint-dhl-gse when keyed, otherwise a deterministic scan.',
    inputSchema: {
      type: 'object',
      properties: {
        stage: { type: 'string' },
        period: { type: 'string', description: 'week | month | backlog' },
        q: { type: 'string', description: 'Optional keyword (belt loader, GPU, hydraulic…)' },
        limit: { type: 'number' },
      },
    },
    handler: listWorkOrdersByStage,
  },
  get_weekly_wo_projection: {
    title: 'Get weekly / monthly WO projection',
    description:
      'The live CVG GSE throughput: ~400 work orders this week and ~1,600 this month, with stage mix (Open / In Progress / Parts Hold / Deferred / Completed / P1-AOG). Use this when the caller asks how many jobs this week or the stage mix.',
    inputSchema: {
      type: 'object',
      properties: {
        include_sample: { type: 'boolean' },
      },
    },
    handler: getWeeklyWoProjection,
  },
  create_maintenance_request: {
    title: 'Create GSE maintenance request',
    description:
      'Log a demo maintenance request against a CVG GSE asset (id like CVG-PWR-0035, last four digits, or type such as belt loader / GPU / pushback). Read the REQ-V ticket id back. Demo store — not live SAP.',
    inputSchema: {
      type: 'object',
      properties: {
        asset_id: { type: 'string', description: 'CVG-PWR-0035, 0035, or belt loader' },
        tag: { type: 'string' },
        q: { type: 'string' },
        description: { type: 'string', description: 'What the caller reported' },
        title: { type: 'string' },
        priority: { type: 'string', description: 'P1-AOG | High | Medium | Low | Deferred' },
        caller: { type: 'string' },
        requested_by: { type: 'string' },
      },
      required: ['description'],
    },
    handler: createGseMaintenanceRequest,
  },
  list_gse_assets: {
    title: 'List GSE assets',
    description: 'Search the CVG GSE sample fleet by type, manufacturer, or asset id.',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string' },
        limit: { type: 'number' },
      },
    },
    handler: listGseAssets,
  },
  list_maintenance_requests: {
    title: 'List demo maintenance requests',
    description: 'List tickets logged from the voice line during this process.',
    inputSchema: {
      type: 'object',
      properties: {
        asset_id: { type: 'string' },
        status: { type: 'string' },
      },
    },
    handler: async (args) => roleGuard(args, 'list_maintenance_requests') || listMaintenanceRequests(args),
  },
  list_my_work_orders: {
    title: 'List my assigned work orders',
    description:
      'Technician (0001) only. Jobs assigned to Alex Rivera / TECH-0001, with status, asset, and parts needed to finish.',
    inputSchema: {
      type: 'object',
      properties: {
        open_only: { type: 'boolean' },
        limit: { type: 'number' },
      },
    },
    handler: listMyWorkOrders,
  },
  get_work_order_detail: {
    title: 'Get work-order detail',
    description:
      'Status, priority, asset, description, and parts_needed for a named WO-V26 job. Technician: own board only. Store / supervisor: any current-period job.',
    inputSchema: {
      type: 'object',
      properties: {
        work_order: { type: 'string', description: 'WO-V26-00071' },
      },
      required: ['work_order'],
    },
    handler: getWorkOrderDetail,
  },
  get_parts_hold_queue: {
    title: 'Parts Hold queue',
    description: 'Store (0003). This week’s jobs waiting on material, with part lines (short / on_order / reserved).',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number' }, period: { type: 'string' } },
    },
    handler: getPartsHoldQueue,
  },
  get_material_status: {
    title: 'Material status this week',
    description: 'Store (0003). Shorts, reservations, and Parts Hold counts for the current week.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number' } },
    },
    handler: getMaterialStatus,
  },
  apply_store_update: {
    title: 'Apply store update',
    description:
      'Store (0003). Spoken “parts received” on a named WO. Posts a demo goods receipt on the SAP MM mirror, updates stock, and clears Parts Hold for this call — not live SAP.',
    inputSchema: {
      type: 'object',
      properties: {
        work_order: { type: 'string' },
        action: { type: 'string', description: 'parts_received | goods_receipt' },
      },
      required: ['work_order'],
    },
    handler: applyStoreUpdate,
  },
  check_material_stock: {
    title: 'Check material stock',
    description:
      'On-hand qty, plant / storage location, and whether a material is available or on order. Technician: own WO or a SKU. Store: any material or WO.',
    inputSchema: {
      type: 'object',
      properties: {
        work_order: { type: 'string' },
        sku: { type: 'string' },
        material: { type: 'string' },
        sap_material: { type: 'string' },
      },
    },
    handler: checkGseMaterialStock,
  },
  create_purchase_requisition: {
    title: 'Create purchase requisition',
    description:
      'Store (0003). Raise a PR linked to a WO when stock is short. SAP MM demo mirror (BANFN-shaped) — not live ECC.',
    inputSchema: {
      type: 'object',
      properties: {
        work_order: { type: 'string' },
        sku: { type: 'string' },
        qty: { type: 'number' },
      },
      required: ['work_order'],
    },
    handler: createGsePurchaseRequisition,
  },
  update_purchase_requisition: {
    title: 'Update purchase requisition',
    description:
      'Store (0003). Change PR status or convert it to a PO on the demo mirror.',
    inputSchema: {
      type: 'object',
      properties: {
        work_order: { type: 'string' },
        pr: { type: 'string' },
        status: { type: 'string', description: 'Released | Converted | convert_to_po' },
      },
    },
    handler: updateGsePurchaseRequisition,
  },
  get_pr_po_gr_status: {
    title: 'Read PR / PO / GR status',
    description:
      'Read the reservation → PR → PO → GR chain on a named WO, with timestamps and status the voice line can read back.',
    inputSchema: {
      type: 'object',
      properties: {
        work_order: { type: 'string' },
        pr: { type: 'string' },
        po: { type: 'string' },
      },
    },
    handler: getGsePrPoGrStatus,
  },
  post_goods_receipt: {
    title: 'Post demo goods receipt',
    description:
      'Store (0003). Post a demo GR (movement 101) on the SAP MM mirror. Updates stock and releases Parts Hold for this call.',
    inputSchema: {
      type: 'object',
      properties: {
        work_order: { type: 'string' },
        po: { type: 'string' },
        pr: { type: 'string' },
      },
      required: ['work_order'],
    },
    handler: postGseGoodsReceipt,
  },
  get_material_blockers: {
    title: 'WOs blocked on material / open PRs',
    description:
      'Supervisor (0002). How many work orders this week are on Parts Hold, and how many purchase requisitions are still open.',
    inputSchema: {
      type: 'object',
      properties: { period: { type: 'string' } },
    },
    handler: getGseMaterialBlockers,
  },
  get_asset_hierarchy: {
    title: 'SAP PM asset hierarchy',
    description:
      'Where a GSE unit sits: Functional Location tree plus Equipment number / object type (e.g. CVG Superhub → GSE yard → belt loaders → CVG-PWR-0035).',
    inputSchema: {
      type: 'object',
      properties: {
        asset_id: { type: 'string', description: 'CVG-PWR-0035, 0035, or belt loader' },
        q: { type: 'string' },
        work_order: { type: 'string' },
      },
    },
    handler: getGseAssetHierarchy,
  },
  get_sap_sync_status: {
    title: 'SAP MM/PM demo sync status',
    description:
      'Last sync, source (SAP MM/PM demo mirror), pending outbound IDocs. Say this is an Oxmaint AI projection mirrored to SAP shapes — not live production SAP.',
    inputSchema: { type: 'object', properties: {} },
    handler: getGseSapSyncStatus,
  },
  get_workmanship_score: {
    title: 'Workmanship score',
    description:
      'Current-period technician workmanship: reopen in 7/14/30 days, bounce-back after a close, corrective too close to the next PM, rework vs first-time-fix, and a simple score. Supervisor: shop table (Alex Rivera / TECH-0001 and peers). Technician: own score only. Synthetic Oxmaint AI projection — not live airline data.',
    inputSchema: {
      type: 'object',
      properties: {
        tech_id: { type: 'string', description: 'TECH-0001, EMP-010, EMP-018…' },
        q: { type: 'string' },
      },
    },
    handler: getGseWorkmanshipScore,
  },
  get_spare_variant_insights: {
    title: 'OEM vs aftermarket spare insights',
    description:
      'Which part variants are best fit / higher value vs those that drive parts-hold or rework. OEM vendor, SKU variant, install outcome (fit, early failure, repeat PR). Store and supervisor. Tied to the SAP-shaped material master on the voice register.',
    inputSchema: {
      type: 'object',
      properties: {
        sku: { type: 'string' },
        material: { type: 'string' },
        q: { type: 'string' },
      },
    },
    handler: getGseSpareVariantInsights,
  },
  get_waterfall_pipeline: {
    title: 'Monthly / weekly waterfall pipeline',
    description:
      'Supervisor / maintenance manager. Counts for the shop waterfall: planning originated, parts ready, parts short (PR path), manpower planned, in flow (incl. deferred + scope variation), technical review, completed, archived. Planned vs unplanned split. Use this for “how many still in planning / need a PR / waiting on my close”. Synthetic Oxmaint AI projection.',
    inputSchema: {
      type: 'object',
      properties: { period: { type: 'string', description: 'week | month' } },
    },
    handler: getGseWaterfallPipeline,
  },
  list_waterfall_stage: {
    title: 'List work orders in a waterfall stage',
    description:
      'List jobs in one waterfall bucket: planning, parts_ready, parts_short, manpower, in_flow, review, completed, archived, variation, deferred, need_pr. Supervisor: any stage. Store: parts_short / parts_ready only.',
    inputSchema: {
      type: 'object',
      properties: {
        stage: { type: 'string' },
        period: { type: 'string', description: 'week | month' },
        limit: { type: 'number' },
      },
      required: ['stage'],
    },
    handler: listGseWaterfallStage,
  },
  get_manpower_plan: {
    title: 'Manpower plan by weekday',
    description:
      'Supervisor. Crew-locked jobs (manpower planned, in flow, review) grouped by planned start day. Ask “manpower plan for Thursday”.',
    inputSchema: {
      type: 'object',
      properties: {
        day: { type: 'string', description: 'Thursday, Thursday, thu…' },
        period: { type: 'string' },
      },
    },
    handler: getGseManpowerPlan,
  },
  assign_work_order: {
    title: 'Assign a technician and planned start',
    description:
      'Supervisor. Lock assignee and planned start/finish; moves the job to manpower planned for this call.',
    inputSchema: {
      type: 'object',
      properties: {
        work_order: { type: 'string' },
        tech_id: { type: 'string' },
        tech_name: { type: 'string' },
        planned_start: { type: 'string' },
        planned_finish: { type: 'string' },
      },
      required: ['work_order'],
    },
    handler: assignGseWorkOrder,
  },
  flag_scope_variation: {
    title: 'Flag scope variation',
    description:
      'Mark that actual activities ran past the plan (extra ops, overrun hours, added components). Technician: own jobs. Supervisor: any current-period job.',
    inputSchema: {
      type: 'object',
      properties: {
        work_order: { type: 'string' },
        note: { type: 'string' },
      },
      required: ['work_order'],
    },
    handler: flagGseScopeVariation,
  },
  advance_waterfall_stage: {
    title: 'Advance waterfall stage',
    description:
      'Move a job to the next waterfall step (planning → parts ready → manpower → in flow → review → completed → archived). Supervisor: any step. Technician: start own job (in_flow) only. Parts short still uses store PR/GR.',
    inputSchema: {
      type: 'object',
      properties: {
        work_order: { type: 'string' },
        to: { type: 'string', description: 'Optional destination stage' },
      },
      required: ['work_order'],
    },
    handler: advanceGseWaterfall,
  },
  close_technical_review: {
    title: 'Supervisor technical close',
    description:
      'Supervisor. Close a QA Review / technical-review job. Moves it to completed for this call.',
    inputSchema: {
      type: 'object',
      properties: { work_order: { type: 'string' } },
      required: ['work_order'],
    },
    handler: closeGseTechnicalReview,
  },
  archive_work_order: {
    title: 'Archive a completed work order',
    description: 'Supervisor. Set the archived flag and date on a completed job.',
    inputSchema: {
      type: 'object',
      properties: { work_order: { type: 'string' } },
      required: ['work_order'],
    },
    handler: archiveGseWorkOrder,
  },
  generate_audit_report: {
    title: 'Generate airline audit PDF',
    description:
      'Supervisor. Build the last-quarter or last-6-month airline audit pack (PM on-time, overdue PMs, asset health, WO chronology, PR–PO–GR, workmanship, hierarchy). Returns a download URL. Synthetic Oxmaint AI projection — say so.',
    inputSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', description: 'quarter | 6m' },
      },
    },
    handler: generateGseAuditReport,
  },
  apply_demo_sap_inbound: {
    title: 'Apply inbound SAP demo IDoc',
    description:
      'Demo-only inbound change on the facade (stock movement or functional-location / equipment patch). Not a live SAP IDoc.',
    inputSchema: {
      type: 'object',
      properties: {
        idoc_type: { type: 'string', description: 'MBGMCR | FUNCLOC_CHANGE | EQUIPMENT_CHANGE' },
        asset_id: { type: 'string' },
        sku: { type: 'string' },
        qty: { type: 'number' },
        tplnr: { type: 'string' },
        equipment_number: { type: 'string' },
      },
    },
    handler: applyDemoSapInbound,
  },
}

export const MCP_SERVER_INFO = SERVER

export async function callTool(name, args = {}) {
  const tool = TOOLS[name]
  if (!tool) return { ok: false, error: `unknown tool: ${name}` }
  try {
    return await tool.handler(args || {})
  } catch (error) {
    return { ok: false, error: error?.message || String(error) }
  }
}

export function listToolDescriptors() {
  return Object.entries(TOOLS).map(([name, tool]) => ({
    name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }))
}
