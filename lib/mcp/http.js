import { authorizeMcpRequest, mcpCorsHeaders } from './auth.js'
import { MCP_SERVER_INFO, callTool, listToolDescriptors } from '../tools.js'
import { isDronePack, isHumanoidPack } from '../voice/phone.js'

export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const DEFAULT_PROTOCOL = '2025-03-26'

function withCors(init = {}) {
  const headers = new Headers(init.headers || {})
  for (const [key, value] of Object.entries(mcpCorsHeaders())) headers.set(key, value)
  if (init.protocolVersion) headers.set('mcp-protocol-version', init.protocolVersion)
  return { ...init, headers }
}

function jsonRpc(id, extra, status = 200, protocolVersion = DEFAULT_PROTOCOL) {
  return Response.json(
    { jsonrpc: '2.0', id: id ?? null, ...extra },
    withCors({ status, protocolVersion, headers: { 'content-type': 'application/json' } }),
  )
}

function negotiateProtocol(requested) {
  if (requested && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)) return requested
  return DEFAULT_PROTOCOL
}

function isNotification(msg) {
  return msg && typeof msg === 'object' && !('id' in msg) && typeof msg.method === 'string'
}

export function mcpInfoBody() {
  return {
    ok: true,
    name: MCP_SERVER_INFO.name,
    version: MCP_SERVER_INFO.version,
    transport: 'streamable-http',
    endpoint: '/api/mcp',
    protocol: SUPPORTED_PROTOCOL_VERSIONS,
    tools: listToolDescriptors().map((t) => t.name),
    auth: 'Authorization: Bearer <MCP_API_KEY> (required in production)',
    docs: '/VOICE-SETUP.md',
  }
}

export function mcpOptionsResponse() {
  return new Response(null, withCors({ status: 204 }))
}

export function mcpInfoResponse() {
  return Response.json(mcpInfoBody(), withCors({ status: 200 }))
}

function initializeResult(params = {}) {
  const protocolVersion = negotiateProtocol(params.protocolVersion)
  return {
    protocolVersion,
    serverInfo: {
      name: MCP_SERVER_INFO.name,
      version: MCP_SERVER_INFO.version,
    },
    capabilities: { tools: { listChanged: false } },
    instructions: isDronePack()
      ? [
          'Oxmaint AI — DJI Mavic 3 Enterprise.',
          'Every mission order must call stage_drone_command, set_waypoint, collect_images, or list_drone_commands.',
          'Speak the say field. Do not invent coordinates.',
          'The result is a WPML mission for DJI Pilot 2. This server does not connect to the aircraft.',
        ].join(' ')
      : isHumanoidPack()
      ? [
          'Oxmaint AI — Autonomous Units, one Unitree R1 EDU.',
          'Every spoken physical order must call stage_robot_command, run_quality_inspection, or list_robot_commands.',
          'Speak the say field from the tool result. Do not invent joint numbers or carton results.',
          'The Jetson on the robot publishes the steps. This server stages them. It does not open a DDS socket.',
        ].join(' ')
      : [
          'Oxmaint AI — DHL Express CVG GSE maintenance shop.',
          'Never invent work-order counts, asset ids, or ticket numbers. Call the tools.',
          'Current-period volume is a synthetic projection at ~1,600 WOs/month (~400/week), not DHL actuals. Say so if asked.',
          'Call verify_voice_role first with the spoken access code: 0001 technician, 0002 supervisor, 0003 store.',
          'Then stay in that role. Technician: list_my_work_orders / create_maintenance_request. Supervisor: get_weekly_wo_projection. Store: get_parts_hold_queue / apply_store_update.',
        ].join(' '),
  }
}

async function dispatch(msg) {
  const { id, method, params } = msg || {}
  if (method === 'initialize') {
    const result = initializeResult(params || {})
    return { kind: 'json', id, result, protocolVersion: result.protocolVersion }
  }
  if (method === 'server/discover') {
    return {
      kind: 'json',
      id,
      result: {
        protocolVersions: SUPPORTED_PROTOCOL_VERSIONS,
        serverInfo: { name: MCP_SERVER_INFO.name, version: MCP_SERVER_INFO.version },
        transports: ['streamable-http'],
      },
    }
  }
  if (method === 'notifications/initialized' || method?.startsWith('notifications/')) {
    return { kind: 'empty' }
  }
  if (method === 'ping') return { kind: 'json', id, result: {} }
  if (method === 'tools/list') {
    return { kind: 'json', id, result: { tools: listToolDescriptors() } }
  }
  if (method === 'tools/call') {
    const name = params?.name
    const args = params?.arguments || params?.args || {}
    if (!name) {
      return { kind: 'error', id, code: -32602, message: 'tools/call requires params.name' }
    }
    const payload = await callTool(name, args)
    const isError = Boolean(payload && payload.ok === false)
    return {
      kind: 'json',
      id,
      result: {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        isError,
        structuredContent: payload,
      },
    }
  }
  if (!method) {
    return { kind: 'error', id, code: -32600, message: 'Invalid Request' }
  }
  return { kind: 'error', id, code: -32601, message: `Method not found: ${method}` }
}

function toResponse(dispatched, fallbackId) {
  if (dispatched.kind === 'empty') {
    return new Response(null, withCors({ status: 204 }))
  }
  const id = dispatched.id ?? fallbackId ?? null
  if (dispatched.kind === 'error') {
    return jsonRpc(id, { error: { code: dispatched.code, message: dispatched.message } })
  }
  return jsonRpc(id, { result: dispatched.result }, 200, dispatched.protocolVersion)
}

export async function handleJsonRpc(body) {
  if (Array.isArray(body)) {
    const parts = await Promise.all(body.map((msg) => dispatch(msg)))
    const responses = []
    for (let i = 0; i < body.length; i += 1) {
      if (isNotification(body[i]) || parts[i].kind === 'empty') continue
      const d = parts[i]
      if (d.kind === 'error') {
        responses.push({ jsonrpc: '2.0', id: d.id ?? body[i]?.id ?? null, error: { code: d.code, message: d.message } })
      } else {
        responses.push({ jsonrpc: '2.0', id: d.id ?? body[i]?.id ?? null, result: d.result })
      }
    }
    if (!responses.length) return new Response(null, withCors({ status: 204 }))
    return Response.json(responses, withCors({ status: 200 }))
  }
  if (!body || typeof body === 'undefined' || body === null || typeof body !== 'object') {
    return jsonRpc(null, { error: { code: -32600, message: 'Invalid Request' } })
  }
  if (isNotification(body) && String(body.method || '').startsWith('notifications/')) {
    return new Response(null, withCors({ status: 204 }))
  }
  const dispatched = await dispatch(body)
  return toResponse(dispatched, body.id)
}

export async function handleMcpHttp(request) {
  if (request.method === 'OPTIONS') return mcpOptionsResponse()

  if (request.method === 'GET' || request.method === 'HEAD') {
    const info = mcpInfoResponse()
    if (request.method === 'HEAD') return new Response(null, { status: info.status, headers: info.headers })
    return info
  }

  if (request.method === 'DELETE') {
    const denied = authorizeMcpRequest(request)
    if (denied) return denied
    return new Response(null, withCors({ status: 204 }))
  }

  const denied = authorizeMcpRequest(request)
  if (denied) return denied

  if (request.method !== 'POST') {
    return Response.json(
      { error: 'Method not allowed' },
      withCors({ status: 405, headers: { allow: 'GET, HEAD, POST, DELETE, OPTIONS' } }),
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return jsonRpc(null, { error: { code: -32700, message: 'Parse error' } })
  }
  return handleJsonRpc(body)
}
