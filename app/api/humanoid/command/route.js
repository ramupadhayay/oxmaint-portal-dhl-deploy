import { COMMAND_EXAMPLES, ROBOT, SPOKEN, interpretCommand, spokenBrief } from '@/components/industries/oxmaint/lib/humanoid/commands'
import { SPEC } from '@/components/industries/oxmaint/lib/humanoid/quality'
import { publicOrigin, publicVoiceConfig } from '@/lib/voice/phone'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } })
}

function catalog(request) {
  const { origin } = publicOrigin(request)
  const voice = publicVoiceConfig()
  return {
    ok: true,
    ready: true,
    product: SPEC.product,
    spec: SPEC.id,
    command: `${origin}/api/humanoid/command`,
    method: 'POST',
    body: { text: COMMAND_EXAMPLES[0] },
    examples: COMMAND_EXAMPLES,
    spoken: SPOKEN,
    brief: spokenBrief(),
    robot: ROBOT,
    bridge: {
      repo: 'https://github.com/ramupadhayay/oxmaint-portal-dhl-deploy/tree/humanoid/jetson',
      run: 'python3 jetson/bridge.py',
      health: '/health on the Jetson, port 8787',
      note: 'Dry-run until HUMANOID_EXECUTE=1 on the robot. The USB camera is read there, not in this portal.',
    },
    voice: {
      shop: voice.shop,
      phone_number: voice.phone_number,
      display: voice.display,
      provisioned: voice.provisioned,
      twilio_voice_webhook: `${origin}/api/voice/twilio/incoming`,
      xai_sip_webhook: `${origin}/api/voice/xai/incoming`,
      media_stream: `${origin}/api/voice/media-stream`,
      note: voice.line === 'humanoid'
        ? 'Point a new Twilio number at the voice webhook. Do not reuse +1 (415) 639-4335 — that line is the DHL CVG shop.'
        : 'This build is not the humanoid pack. The command still answers, but the phone agent on a DHL build stays the GSE shop.',
    },
    jaw: 'Parallel jaw on the right wrist. Spoken “jaw” or “jaw gun” is this tool. It is not a joint in the R1 EDU 26-DOF map.',
  }
}

export function GET(request) {
  return json(catalog(request))
}

export async function POST(request) {
  let body = {}
  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    body = await request.json().catch(() => ({}))
  } else {
    const text = await request.text()
    body = Object.fromEntries(new URLSearchParams(text).entries())
  }
  const heard = body.text || body.utterance || body.command || body.SpeechResult || ''
  if (!String(heard).trim()) return json({ ...catalog(request), error: 'Send { "text": "..." }.' }, 400)
  return json(interpretCommand(heard))
}
