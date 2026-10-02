/**
 * DHL CVG GSE shop — Oxmaint AI voice session instructions and tools.
 * Second person. No Pinecone / vector / namespace jargon on the call.
 * Branding: Oxmaint Inc / Oxmaint AI — never Oxment in caller-facing copy.
 * Access is three spoken role codes: 0001 technician, 0002 supervisor, 0003 store.
 */

import { listToolDescriptors } from '../tools.js'

export const VOICE_MODEL = 'grok-voice-latest'
export const VOICE_REALTIME_URL = `wss://api.x.ai/v1/realtime?model=${VOICE_MODEL}`
export const VOICE_NAME = 'eve'

const VOICE_TOOL_NAMES = [
  'verify_voice_role',
  'list_my_work_orders',
  'get_work_order_detail',
  'create_maintenance_request',
  'list_gse_assets',
  'list_maintenance_requests',
  'get_weekly_wo_projection',
  'get_dhl_wo_status_slice',
  'list_work_orders_by_stage',
  'get_portal_overview',
  'get_parts_hold_queue',
  'get_material_status',
  'apply_store_update',
  'check_material_stock',
  'create_purchase_requisition',
  'update_purchase_requisition',
  'get_pr_po_gr_status',
  'post_goods_receipt',
  'get_material_blockers',
  'get_asset_hierarchy',
  'get_sap_sync_status',
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
]

export const VOICE_KEYTERMS = [
  'Oxmaint',
  'Oxmaint AI',
  'DHL',
  'CVG',
  'GSE',
  'P1-AOG',
  'AOG',
  'Parts Hold',
  'Deferred',
  'Alex Rivera',
  'access code',
  'triple zero one',
  'triple zero two',
  'triple zero three',
  'zero zero zero one',
  'storeroom',
  'belt loader',
  'pushback',
  'GPU',
  'tractor',
  'work order',
  'purchase requisition',
  'goods receipt',
  'functional location',
  'workmanship',
  'first-time fix',
  'audit report',
  'waterfall',
  'manpower',
  'scope variation',
  'technical close',
]

export function voiceInstructions() {
  return [
    'You are the Oxmaint AI demo receptionist for the DHL Express GSE shop at Cincinnati / Northern Kentucky International Airport (CVG), the Americas Superhub in Erlanger, Kentucky.',
    'Speak in second person. Keep turns short. Do not invent work-order counts, ticket ids, or asset ids.',
    'This line uses three spoken access codes. Do no shop work until verify_voice_role succeeds.',
    '0001 is technician Alex Rivera (TECH-0001, Days). 0002 is supervisor / maintenance manager. 0003 is store / parts. Accept spoken forms: “triple zero one”, “zero zero zero one”, “0001”, “oh oh oh two”.',
    'After the greeting, wait for the code. Call verify_voice_role with exactly what they said. If it fails, ask them to say the four-digit code again. Do not list every code unless they ask what the codes are.',
    'Once verified, stay in that persona until they say a different code.',
    'Technician (0001): you are talking to Alex Rivera. Use list_my_work_orders and get_work_order_detail for jobs assigned to them — status, priority, asset, description, waterfall stage, and especially parts_needed. check_material_stock and get_pr_po_gr_status say whether material is available or on order. get_asset_hierarchy when they ask where a unit sits. get_workmanship_score for their own first-time-fix / reopen score. advance_waterfall_stage to start their own job (in flow). flag_scope_variation when the job ran past the plan. Use create_maintenance_request when they name a unit (belt loader 0035 / CVG-PWR-0035). Read the REQ-V id back slowly. Do not read the shop-wide week plan or Parts Hold queue.',
    'Supervisor (0002): use get_waterfall_pipeline first for the monthly/weekly waterfall (planning originated, parts ready vs short, manpower planned, in flow, technical review, completed/archived). list_waterfall_stage for a bucket. get_manpower_plan for a weekday (“Thursday”). assign_work_order, advance_waterfall_stage, close_technical_review, archive_work_order, flag_scope_variation for writes. Also get_weekly_wo_projection / get_dhl_wo_status_slice for the ~400 week mix, get_material_blockers, get_asset_hierarchy, get_workmanship_score, get_spare_variant_insights, generate_audit_report. Do not pretend they have a personal technician board.',
    'Store (0003): use get_parts_hold_queue, get_material_status, check_material_stock, and list_waterfall_stage stage=parts_short. Answer waiting-on-material, shorts, reservations, plant and storage location. create_purchase_requisition / update_purchase_requisition and get_pr_po_gr_status for the PR → PO → GR chain. post_goods_receipt or apply_store_update when they say parts arrived on a named WO — that posts a demo GR, updates stock, and clears the hold for this call only, not live SAP. get_spare_variant_insights for which OEM or aftermarket variants are best fit or drive holds.',
    'If they ask whether this is live production SAP, say it is an Oxmaint AI projection mirrored to SAP MM and PM shapes — a sync facade with last sync and demo IDocs, not a live ECC or S/4 connector. If they ask whether these are DHL’s own records, say they are a synthetic Oxmaint AI projection patterned on Superhub throughput.',
    'Shop language: tractors, belt loaders, GPUs, pushbacks, P1-AOG, Parts Hold, Deferred, Days / Swing / Nights. Stay on ground-support equipment. This is Oxmaint AI, never Oxment.',
  ].join(' ')
}

export function voiceFunctionTools() {
  const catalog = new Map(listToolDescriptors().map((t) => [t.name, t]))
  return VOICE_TOOL_NAMES.map((name) => {
    const tool = catalog.get(name)
    if (!tool) return null
    return {
      type: 'function',
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema || { type: 'object', properties: {} },
    }
  }).filter(Boolean)
}

export function remoteMcpTool(serverUrl, apiKey) {
  if (!serverUrl) return null
  const tool = {
    type: 'mcp',
    server_url: serverUrl,
    server_label: 'oxmaint-dhl-gse',
    server_description:
      'Oxmaint AI DHL CVG GSE MCP. verify_voice_role first (0001 technician / 0002 supervisor / 0003 store), then role-scoped tools.',
    allowed_tools: VOICE_TOOL_NAMES,
  }
  if (apiKey) tool.authorization = `Bearer ${apiKey}`
  return tool
}

export function sessionUpdatePayload({ mcpUrl, mcpKey } = {}) {
  const tools = voiceFunctionTools()
  const mcp = remoteMcpTool(mcpUrl, mcpKey)
  if (mcp) tools.push(mcp)
  return {
    type: 'session.update',
    session: {
      voice: VOICE_NAME,
      instructions: voiceInstructions(),
      turn_detection: { type: 'server_vad', silence_duration_ms: 700 },
      audio: {
        input: {
          format: { type: 'audio/pcmu' },
          transcription: {
            language_hint: 'en',
            keyterms: VOICE_KEYTERMS,
          },
        },
        output: { format: { type: 'audio/pcmu' } },
      },
      tools,
    },
  }
}

export function greetingCreate() {
  return {
    type: 'response.create',
    response: {
      instructions:
        'Greet the caller briefly as Oxmaint AI for the DHL CVG GSE shop. Ask them to say their four-digit access code. Do not start shop work, do not list tools, and do not read week counts until verify_voice_role succeeds.',
    },
  }
}

export { VOICE_TOOL_NAMES }
