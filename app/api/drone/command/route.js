import { SPOKEN, interpretMission } from '@/components/industries/oxmaint/lib/drone/mission'
import { publicOrigin } from '@/lib/voice/phone'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } })
}

export function GET(request) {
  const { origin } = publicOrigin(request)
  return json({
    ok: true,
    aircraft: 'DJI Mavic 3 Enterprise',
    command: `${origin}/api/drone/command`,
    mcp: `${origin}/api/mcp`,
    spoken: SPOKEN.map((row) => row.say),
    note: 'POST { "text": "Collect images at the tank farm" }. The body is a WPML mission for Pilot 2. It does not fly the aircraft.',
  })
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}))
  const heard = body.text || body.utterance || body.command || ''
  if (!String(heard).trim()) return json({ ok: false, error: 'Send { "text": "..." }.' }, 400)
  return json(interpretMission(heard))
}
