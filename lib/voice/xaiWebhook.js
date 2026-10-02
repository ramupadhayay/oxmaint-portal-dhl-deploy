import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * xAI SIP CreatePhoneNumberV2 posts a signed Standard Webhooks event:
 * { type: "realtime.call.incoming", data: { call_id, sip_headers } }
 * Secret is returned once at number registration (XAI_WEBHOOK_SECRET).
 */

export function parseIncomingCall(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid JSON' }
  const type = body.type || body.event_type
  if (type && type !== 'realtime.call.incoming') {
    return { ok: true, ignored: true, type }
  }
  const callId =
    body.data?.call_id
    || body.call_id
    || body.data?.callId
    || body.callId
  if (!callId) return { ok: false, error: 'missing data.call_id' }
  const headers = body.data?.sip_headers || body.sip_headers || []
  const from = sipHeader(headers, 'From') || body.data?.from || null
  const to = sipHeader(headers, 'To') || body.data?.to || null
  return { ok: true, ignored: false, callId, from, to, type: type || 'realtime.call.incoming' }
}

function sipHeader(headers, name) {
  if (!Array.isArray(headers)) return null
  const hit = headers.find((h) => String(h?.name || '').toLowerCase() === name.toLowerCase())
  return hit?.value || null
}

function webhookKeys(secret) {
  const raw = String(secret || '')
  const keys = [raw]
  if (raw.startsWith('whsec_')) {
    const body = raw.slice('whsec_'.length)
    keys.push(body)
    try {
      keys.push(Buffer.from(body, 'base64'))
    } catch {
      /* keep the string forms */
    }
  }
  return keys
}

export function verifyXaiWebhook({ secret, id, timestamp, signature, rawBody }) {
  if (!secret) return { ok: true, skipped: true }
  if (!id || !timestamp || !signature) return { ok: false, error: 'missing webhook signature headers' }
  const age = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (Number.isFinite(age) && age > 300) return { ok: false, error: 'webhook timestamp too old' }
  const signed = `${id}.${timestamp}.${rawBody}`
  const parts = String(signature)
    .split(' ')
    .map((p) => p.trim())
    .filter(Boolean)
  for (const part of parts) {
    const value = part.startsWith('v1,') ? part.slice(3) : part.includes(',') ? part.split(',')[1] : part
    for (const key of webhookKeys(secret)) {
      const expected = createHmac('sha256', key).update(signed).digest('base64')
      if (safeEqualB64(expected, value)) return { ok: true, skipped: false }
    }
  }
  return { ok: false, error: 'invalid xAI webhook signature' }
}

function safeEqualB64(a, b) {
  try {
    const left = Buffer.from(String(a))
    const right = Buffer.from(String(b))
    if (left.length !== right.length) return false
    return timingSafeEqual(left, right)
  } catch {
    return false
  }
}

export function xaiCallRealtimeUrl(callId) {
  const id = encodeURIComponent(String(callId))
  return `wss://api.x.ai/v1/realtime?call_id=${id}`
}
