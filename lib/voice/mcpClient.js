/**
 * Voice tool execution: in-process MCP handlers, with optional HTTP self-call.
 */

import { callTool } from '../tools.js'

export async function invokeMcpTool(name, args = {}, opts = {}) {
  const httpUrl = opts.mcpUrl
  const apiKey = opts.mcpKey || process.env.MCP_API_KEY
  if (opts.preferHttp && httpUrl) {
    const remote = await callMcpHttp(httpUrl, name, args, apiKey)
    if (remote) return remote
  }
  return callTool(name, args || {})
}

export async function callMcpHttp(url, name, args, apiKey) {
  try {
    const headers = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    }
    if (apiKey) headers.authorization = `Bearer ${apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name, arguments: args || {} },
      }),
    })
    if (!res.ok) return { ok: false, error: `MCP HTTP ${res.status}` }
    const body = await res.json()
    if (body?.result?.structuredContent) return body.result.structuredContent
    if (body?.error) return { ok: false, error: body.error.message || 'MCP error' }
    return { ok: false, error: 'empty MCP response' }
  } catch (error) {
    return { ok: false, error: error?.message || String(error) }
  }
}

export function parseToolArguments(raw) {
  if (raw && typeof raw === 'object') return raw
  if (typeof raw !== 'string' || !raw.trim()) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}
