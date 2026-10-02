import { experimental_upgradeWebSocket } from '@vercel/functions'
import { mcpSelfUrl, publicOrigin } from '@/lib/voice/phone'
import { handleTwilioMediaSocket } from '@/lib/voice/realtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request) {
  const upgrade = request.headers.get('upgrade') || ''
  if (upgrade.toLowerCase() !== 'websocket') {
    return Response.json(
      {
        ok: false,
        error: 'Expected WebSocket upgrade',
        hint: 'Twilio Media Streams connects here via TwiML <Connect><Stream>.',
      },
      { status: 426, headers: { upgrade: 'websocket' } },
    )
  }

  const apiKey = String(process.env.XAI_API_KEY || '').trim()
  if (!apiKey) {
    return Response.json({ ok: false, error: 'XAI_API_KEY is not set' }, { status: 503 })
  }

  const mcpUrl = mcpSelfUrl(request)
  const mcpKey = String(process.env.MCP_API_KEY || '').trim()
  const { host } = publicOrigin(request)

  return experimental_upgradeWebSocket((ws) => {
    handleTwilioMediaSocket(ws, {
      apiKey,
      mcpUrl,
      mcpKey,
      onLog: (kind, detail) => {
        console.error('[oxmaint-dhl-voice]', host, kind, detail || '')
      },
    })
  })
}
