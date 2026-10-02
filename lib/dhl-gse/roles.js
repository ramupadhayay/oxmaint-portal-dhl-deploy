/**
 * Spoken access codes for the DHL CVG GSE voice line.
 *
 * Callers say 0001 / 0002 / 0003 (or “triple zero one”, “zero zero zero two”…).
 * That selects persona and tool scope for the rest of the process. Demo only —
 * not a live DHL directory and not an org passcode.
 */

export const DEMO_TECH = {
  tech_id: 'TECH-0001',
  name: 'Alex Rivera',
  shift: 'Days',
  honesty: 'Demo technician identity for the Oxmaint AI voice line — not a real DHL employee.',
}

const DIGIT_WORDS = {
  zero: '0',
  oh: '0',
  o: '0',
  nought: '0',
  aught: '0',
  one: '1',
  won: '1',
  two: '2',
  too: '2',
  to: '2',
  three: '3',
  four: '4',
  for: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  ate: '8',
  nine: '9',
}

const MULTIPLIERS = {
  single: 1,
  double: 2,
  triple: 3,
  quadruple: 4,
}

const FILLER = /^(code|pin|role|number|access|please|my|is|it|its|it's|the|a|an|say|this|i'm|im|i|am)$/

export function normalizeSpokenCode(raw) {
  if (raw == null) return ''
  const original = String(raw)
  const compact = original.replace(/\D/g, '')
  const s = original
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\baccess\s+code\b/g, ' ')
    .replace(/\b(code|pin|role)\b/g, ' ')
    .trim()
  const tokens = s.split(/\s+/).filter((t) => t && !FILLER.test(t))
  let digits = ''
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i]
    if (/^\d+$/.test(t)) {
      digits += t
      continue
    }
    const next = tokens[i + 1]
    if (MULTIPLIERS[t] && next && DIGIT_WORDS[next]) {
      digits += DIGIT_WORDS[next].repeat(MULTIPLIERS[t])
      i += 1
      continue
    }
    if (DIGIT_WORDS[t]) digits += DIGIT_WORDS[t]
  }
  if (!digits) digits = compact
  if (!digits) return ''
  if (digits.length > 4) digits = digits.slice(-4)
  return digits.padStart(4, '0')
}

export const ROLE_CATALOG = {
  '0001': {
    code: '0001',
    id: 'technician',
    label: 'Technician',
    title: 'GSE Technician',
    you_are: DEMO_TECH.name,
    tech_id: DEMO_TECH.tech_id,
    tools: [
      'verify_voice_role',
      'create_maintenance_request',
      'list_gse_assets',
      'list_my_work_orders',
      'get_work_order_detail',
      'list_maintenance_requests',
      'check_material_stock',
      'get_pr_po_gr_status',
      'get_asset_hierarchy',
      'get_sap_sync_status',
      'get_workmanship_score',
      'flag_scope_variation',
      'advance_waterfall_stage',
    ],
    brief:
      'You are on the floor as Alex Rivera (TECH-0001), Days. Log a request on a named unit, list jobs assigned to you, and read status / parts needed / stock vs on-order on those jobs. You can start your own job (in flow) and flag scope variation. You can say where a unit sits in the SAP PM tree and your own workmanship score. Do not read the shop-wide week plan.',
  },
  '0002': {
    code: '0002',
    id: 'supervisor',
    label: 'Supervisor',
    title: 'GSE Supervisor / Maintenance Manager',
    you_are: 'the shop supervisor',
    tech_id: null,
    tools: [
      'verify_voice_role',
      'get_weekly_wo_projection',
      'get_dhl_wo_status_slice',
      'list_work_orders_by_stage',
      'get_portal_overview',
      'get_work_order_detail',
      'get_material_blockers',
      'get_asset_hierarchy',
      'get_sap_sync_status',
      'get_pr_po_gr_status',
      'apply_demo_sap_inbound',
      'get_workmanship_score',
      'get_spare_variant_insights',
      'generate_audit_report',
      'get_waterfall_pipeline',
      'list_waterfall_stage',
      'get_manpower_plan',
      'assign_work_order',
      'flag_scope_variation',
      'advance_waterfall_stage',
      'close_technical_review',
      'archive_work_order',
    ],
    brief:
      'You have the shop-wide week: about 400 jobs raised, the waterfall (planning → parts → manpower → in flow → review → archived), stage mix, P1-AOG and Parts Hold, open PRs, workmanship, spare-variant fit, and the airline audit PDF. Brief the shop. Do not claim personal technician assignments.',
  },
  '0003': {
    code: '0003',
    id: 'store',
    label: 'Store',
    title: 'Parts / Storeroom',
    you_are: 'the parts clerk',
    tech_id: null,
    tools: [
      'verify_voice_role',
      'get_parts_hold_queue',
      'get_material_status',
      'apply_store_update',
      'list_work_orders_by_stage',
      'get_work_order_detail',
      'get_dhl_wo_status_slice',
      'check_material_stock',
      'create_purchase_requisition',
      'update_purchase_requisition',
      'get_pr_po_gr_status',
      'post_goods_receipt',
      'get_sap_sync_status',
      'get_asset_hierarchy',
      'apply_demo_sap_inbound',
      'get_spare_variant_insights',
      'list_waterfall_stage',
    ],
    brief:
      'You own material: Parts Hold queue, stock vs reservation, PR → PO → GR on the SAP MM demo mirror, a spoken goods receipt that updates stock and clears a named hold for this call, parts-short / parts-ready waterfall lists, and OEM vs aftermarket variant insights. Not a technician board and not the full week plan.',
  },
}

let activeRole = null

export function resetVoiceRole() {
  activeRole = null
}

export function getActiveRole() {
  return activeRole
}

export function setActiveRole(role) {
  activeRole = role ? { ...role } : null
  return activeRole
}

export function resolveRoleFromArgs(args = {}) {
  const spoken = args.access_code || args.code || args.spoken_code || args.role_code || args.pin
  if (spoken != null && String(spoken).trim()) {
    const normalized = normalizeSpokenCode(spoken)
    const role = ROLE_CATALOG[normalized]
    if (role) return role
  }
  if (args.role) {
    const key = String(args.role).toLowerCase()
    const hit = Object.values(ROLE_CATALOG).find((r) => r.id === key || r.code === key)
    if (hit) return hit
  }
  return activeRole
}

export function verifySpokenRole(spoken) {
  const normalized = normalizeSpokenCode(spoken)
  const role = ROLE_CATALOG[normalized]
  if (!role) {
    return {
      ok: false,
      error: 'That is not a recognised access code.',
      hint: 'Say 0001 for technician, 0002 for supervisor, or 0003 for store. You can say “triple zero one” or “zero zero zero one”.',
      heard: String(spoken || ''),
      normalized: normalized || null,
    }
  }
  setActiveRole(role)
  return {
    ok: true,
    role: role.id,
    code: role.code,
    label: role.label,
    title: role.title,
    you_are: role.you_are,
    tech_id: role.tech_id,
    tools: role.tools,
    brief: role.brief,
    honesty: 'Oxmaint AI demo access — synthetic CVG GSE projection, not a live DHL directory.',
    how_to_address:
      role.id === 'technician'
        ? `Address them as ${DEMO_TECH.name}. Jobs assigned to them are tagged ${DEMO_TECH.tech_id}.`
        : `Stay in the ${role.label} view. Do not switch roles unless they say a new code.`,
  }
}

export function roleDenied(role, tool) {
  const need = Object.values(ROLE_CATALOG).find((r) => (r.tools || []).includes(tool))
  return {
    ok: false,
    error: role
      ? `That is outside the ${role.label} view.`
      : 'Say your four-digit access code first.',
    hint: role
      ? (need ? `Ask a ${need.label} to run that, or say code ${need.code}.` : 'Stay on what this role can answer.')
      : 'Say 0001 technician, 0002 supervisor, or 0003 store — then ask again.',
    role: role?.id || null,
  }
}

export function assertToolRole(args, tool) {
  const role = resolveRoleFromArgs(args)
  if (!role) return roleDenied(null, tool)
  if (!(role.tools || []).includes(tool)) return roleDenied(role, tool)
  return { ok: true, role }
}
