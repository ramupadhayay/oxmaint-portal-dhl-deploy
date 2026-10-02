import { createHash, timingSafeEqual } from 'node:crypto'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Accept, Authorization, x-api-key, mcp-session-id, mcp-protocol-version, MCP-Protocol-Version, Mcp-Method, Mcp-Name',
  'Access-Control-Expose-Headers': 'mcp-session-id, mcp-protocol-version',
}

export function mcpCorsHeaders() {
  return { ...CORS }
}

export function mcpAuthRequired() {
  if (process.env.MCP_AUTH_REQUIRED === 'false') return false
  if (process.env.MCP_AUTH_REQUIRED === 'true') return true
  if (process.env.MCP_API_KEY) return true
  return process.env.NODE_ENV === 'production'
}

export function bearerFrom(request) {
  const header = request.headers.get('authorization') || ''
  const match = /^Bearer\s+(\S+)/i.exec(header)
  if (match) return match[1]
  return (request.headers.get('x-api-key') || '').trim()
}

function sha256(value) {
  return createHash('sha256').update(String(value ?? '')).digest()
}

export function secretsMatch(provided, expected) {
  if (!expected) return false
  return timingSafeEqual(sha256(provided || ''), sha256(expected))
}

export function verifyMcpToken(request) {
  const token = bearerFrom(request)
  if (!token) return undefined
  const apiKey = process.env.MCP_API_KEY
  if (apiKey && secretsMatch(token, apiKey)) {
    return { token, clientId: 'mcp-api-key', scopes: ['oxmaint-dhl-gse'] }
  }
  return undefined
}

export function unauthorizedResponse() {
  return Response.json(
    {
      error: 'Unauthorized',
      hint: 'Send Authorization: Bearer <MCP_API_KEY>.',
    },
    {
      status: 401,
      headers: {
        ...CORS,
        'WWW-Authenticate': 'Bearer realm="oxmaint-dhl-gse", error="invalid_token"',
      },
    },
  )
}

export function authorizeMcpRequest(request) {
  if (request.method === 'OPTIONS' || request.method === 'HEAD') return null
  if (!mcpAuthRequired()) return null
  if (verifyMcpToken(request)) return null
  return unauthorizedResponse()
}
