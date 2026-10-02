/**
 * Demo maintenance-request store for the DHL CVG voice line.
 * Process-local. When MONGO_URI is set, also persist as an Oxmaint `request`
 * so the portal Requests screen can show what the caller logged.
 */

const SEQ_START = 4000

let localState = null

function todayIso() {
  return new Date().toISOString()
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function emptyLocal() {
  return { requests: [], seq: SEQ_START }
}

export function resetDemoStore() {
  localState = emptyLocal()
  return localState
}

function localStore() {
  if (!localState) resetDemoStore()
  return localState
}

function nextLocalId() {
  const s = localStore()
  s.seq += 1
  const id = `REQ-V${s.seq}`
  return { id, number: id }
}

function clip(text, n) {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`
}

function normalizePriority(value) {
  const p = String(value || '').trim().toLowerCase()
  if (p === 'high' || p === 'urgent' || p === 'critical' || p.startsWith('p1')) return 'Critical'
  if (p === 'low' || p.startsWith('p4') || /deferred/.test(p)) return 'Low'
  if (p.startsWith('p2')) return 'High'
  return 'Medium'
}

export function resolveGseAsset(args, assets) {
  const list = assets || []
  const id = String(args.asset_id || args.id || args.tag || args.asset_code || '').trim()
  const hay = (a) =>
    [a.asset_id, a.asset_code, a.asset_name, a.asset_type, a.manufacturer, a.model]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

  if (id) {
    const key = id.toLowerCase()
    const exact = list.find((a) =>
      [a.asset_id, a.asset_code, a.asset_name].some((v) => String(v).toLowerCase() === key),
    )
    if (exact) return exact
    const tail = key.replace(/^cvg-/, '').replace(/[^a-z0-9]/g, '')
    const byTail = list.find((a) => String(a.asset_id).toLowerCase().endsWith(tail.slice(-4)))
    if (byTail && tail.length >= 4) return byTail
    const partial = list.filter((a) => hay(a).includes(key))
    if (partial.length) return partial[0]
  }

  const q = String(args.q || args.query || args.name || args.model || args.equipment_type || '').trim().toLowerCase()
  const oem = String(args.oem || args.manufacturer || '').trim().toLowerCase()
  if (q) {
    let hits = list.filter((a) => hay(a).includes(q))
    if (oem) {
      const oemHits = hits.filter((a) => String(a.manufacturer).toLowerCase().includes(oem))
      if (oemHits.length) hits = oemHits
    }
    if (hits.length) return hits[0]
  }
  return null
}

function buildRecord(args, asset, ids, site) {
  const description = String(args.description || args.summary || '').trim()
  const title =
    String(args.title || '').trim()
    || clip(description, 80)
    || `Voice maintenance request — ${asset?.asset_name || 'unassigned'}`
  return {
    request_id: ids.id,
    request_number: ids.number,
    title,
    description,
    asset_id: asset?.asset_id || null,
    asset_name: asset?.asset_name || null,
    asset_code: asset?.asset_code || asset?.asset_id || null,
    site_id: asset?.site_id || site?.site_id || 'site_01',
    site_name: asset?.site_name || site?.site_name || 'CVG Americas Superhub',
    requested_by_name: String(args.requested_by || args.caller_name || 'Voice caller').trim() || 'Voice caller',
    created_date: args.created_date || todayIso(),
    priority: normalizePriority(args.priority),
    status: args.status || 'Pending',
    kind: 'maintenance_request',
    work_order_number: null,
    raised_from: args.raised_from || 'voice_demo',
    caller: args.caller || args.from || args.phone || null,
    source: 'voice',
    sap_notification: `N${String(ids.number.replace(/\D/g, '') || ids.id).padStart(8, '0')}`.slice(0, 9),
    sap_notif_type: 'M1',
    lifecycle: 'Asset → Notification/MR → WO (when converted)',
    honesty: 'Demo request logged by Oxmaint AI — SAP PM-shaped notification on the demo mirror, not a live SAP document.',
  }
}

async function persistMongo(record) {
  if (!process.env.MONGO_URI) return { persisted: false }
  try {
    const dbConnect = (await import('../db.js')).default
    const OxmaintRecord = (await import('../models/OxmaintRecord.js')).default
    await dbConnect()
    await OxmaintRecord.create({
      kind: 'request',
      pack: 'dhl-gse',
      recordId: record.request_id,
      siteId: record.site_id || '',
      status: record.status,
      priority: record.priority,
      title: record.title,
      data: record,
      createdByName: record.requested_by_name,
    })
    return { persisted: true }
  } catch (error) {
    return { persisted: false, persist_error: error?.message || String(error) }
  }
}

export async function createMaintenanceRequest(args, { assets, site } = {}) {
  const description = String(args.description || args.summary || '').trim()
  if (!description) {
    return {
      ok: false,
      error: 'description is required',
      hint: 'Ask what is wrong, then call again with a short description and a GSE unit such as CVG-PWR-0035 or belt loader.',
    }
  }
  const asset = resolveGseAsset(args, assets)
  if (!asset) {
    return {
      ok: false,
      error: `GSE asset not found: ${args.asset_id || args.tag || args.q || '(missing asset_id)'}`,
      hint: 'Use a CVG asset id (CVG-PWR-0035), the last four digits, or an equipment type such as belt loader or GPU.',
    }
  }
  const ids = nextLocalId()
  const record = buildRecord(args, asset, ids, site)
  localStore().requests.unshift(record)
  const mongo = await persistMongo(record)
  return { ok: true, request: record, store: mongo.persisted ? 'mongo' : 'demo', ...mongo }
}

export function listMaintenanceRequests(args = {}) {
  let items = localStore().requests.slice()
  if (args.asset_id) {
    const key = String(args.asset_id)
    items = items.filter((r) => r.asset_id === key || r.asset_code === key)
  }
  if (args.status) items = items.filter((r) => r.status === args.status)
  return { ok: true, total: items.length, items: clone(items) }
}
