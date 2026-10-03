import { waitUntil } from '@vercel/functions'
import { mcpSelfUrl, isDronePack, isHumanoidPack } from '@/lib/voice/phone'
import { runRealtimeSession } from '@/lib/voice/realtime'
import { parseIncomingCall, verifyXaiWebhook, xaiCallRealtimeUrl } from '@/lib/voice/xaiWebhook'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } })
}

export async function POST(request) {
  const rawBody = await request.text()
  const secret = String(process.env.XAI_WEBHOOK_SECRET || '').trim()
  const verified = verifyXaiWebhook({
    secret,
    id: request.headers.get('webhook-id'),
    timestamp: request.headers.get('webhook-timestamp'),
    signature: request.headers.get('webhook-signature'),
    rawBody,
  })
  if (!verified.ok) return json({ ok: false, error: verified.error }, 401)

  let body
  try {
    body = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    return json({ ok: false, error: 'invalid JSON' }, 400)
  }

  const parsed = parseIncomingCall(body)
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400)
  if (parsed.ignored) return json({ ok: true, ignored: true, type: parsed.type })

  const apiKey = String(process.env.XAI_API_KEY || '').trim()
  if (!apiKey) return json({ ok: false, error: 'XAI_API_KEY is not set' }, 503)

  const mcpUrl = mcpSelfUrl(request)
  const mcpKey = String(process.env.MCP_API_KEY || '').trim()
  const url = xaiCallRealtimeUrl(parsed.callId)

  waitUntil(
    runRealtimeSession({
      apiKey,
      url,
      mcpUrl,
      mcpKey,
      onLog: (kind, detail) => {
        console.error('[oxmaint-dhl-voice-xai]', parsed.callId, kind, detail || '')
      },
    })
      .then((session) => session.closed)
      .catch((err) => {
        console.error('[oxmaint-dhl-voice-xai]', parsed.callId, err?.message || err)
      }),
  )

  return json({ ok: true, call_id: parsed.callId })
}

export function GET() {
  return json({
    ok: true,
    webhook: 'xAI SIP CreatePhoneNumberV2 → POST this URL',
    event: 'realtime.call.incoming',
    shop: isDronePack() ? 'Mavic Enterprise' : isHumanoidPack() ? 'Autonomous Units' : 'DHL Express CVG GSE — Oxmaint AI',
  })
}
