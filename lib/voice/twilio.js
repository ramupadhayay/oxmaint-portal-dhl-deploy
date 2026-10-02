import { createHmac, timingSafeEqual } from 'node:crypto'

export function twiml(body) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`
}

export function twimlResponse(xml, status = 200) {
  return new Response(xml, {
    status,
    headers: {
      'content-type': 'text/xml; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

export function connectStreamTwiml(wsUrl, params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '')
  const inner = entries
    .map(
      ([name, value]) =>
        `<Parameter name="${escapeXml(name)}" value="${escapeXml(String(value))}" />`,
    )
    .join('')
  return twiml(
    `<Connect><Stream url="${escapeXml(wsUrl)}">${inner}</Stream></Connect>`,
  )
}

export function sayHangupTwiml(message) {
  return twiml(`<Say voice="Polly.Joanna">${escapeXml(message)}</Say><Hangup/>`)
}

export function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function readTwilioParams(request) {
  const contentType = request.headers.get('content-type') || ''
  if (request.method === 'GET') {
    const url = new URL(request.url)
    return Object.fromEntries(url.searchParams.entries())
  }
  if (contentType.includes('application/json')) {
    try {
      const body = await request.json()
      return body && typeof body === 'object' ? body : {}
    } catch {
      return {}
    }
  }
  const text = await request.text()
  return Object.fromEntries(new URLSearchParams(text).entries())
}

export function twilioValidationUrl(request) {
  const url = new URL(request.url)
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  return `${proto}://${host}${url.pathname}${url.search}`
}

export function validateTwilioSignature({ authToken, signature, url, params }) {
  if (!authToken) return { ok: true, skipped: true }
  if (!signature) return { ok: false, error: 'missing X-Twilio-Signature' }
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url)
  const expected = createHmac('sha1', authToken).update(data, 'utf8').digest('base64')
  const a = Buffer.from(expected)
  const b = Buffer.from(String(signature))
  if (a.length !== b.length) return { ok: false, error: 'invalid Twilio signature' }
  if (!timingSafeEqual(a, b)) return { ok: false, error: 'invalid Twilio signature' }
  return { ok: true, skipped: false }
}

export function parseTwilioWsMessage(raw) {
  if (raw == null) return null
  const text = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw)
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function twilioMediaOut(streamSid, payloadB64) {
  return JSON.stringify({
    event: 'media',
    streamSid,
    media: { payload: payloadB64 },
  })
}

export function twilioClear(streamSid) {
  return JSON.stringify({ event: 'clear', streamSid })
}

export function twilioMark(streamSid, name = 'xai') {
  return JSON.stringify({ event: 'mark', streamSid, mark: { name } })
}
