/**
 * E.164 display helpers. This demo reuses the existing xAI Trial Demo Support
 * number +14156394335. Env VOICE_DEMO_PHONE_NUMBER overrides it when set to a
 * valid E.164 value; an invalid override is ignored rather than shown.
 */

export const DEFAULT_DEMO_PHONE = '+14156394335'
export const NUMBER_PROVISIONING_LABEL = 'Number provisioning…'
const DHL_LINE = '+14156394335'

export function isHumanoidPack(env = process.env) {
  return String(env.NEXT_PUBLIC_OXMAINT_PACK || '').trim() === 'humanoid'
}

export function isDronePack(env = process.env) {
  return String(env.NEXT_PUBLIC_OXMAINT_PACK || '').trim() === 'drone'
}

export function readDemoPhoneNumber(env = process.env) {
  if (isHumanoidPack(env)) return readHumanoidPhone(env)
  if (isDronePack(env)) return readDronePhone(env)
  const raw = String(env.VOICE_DEMO_PHONE_NUMBER || DEFAULT_DEMO_PHONE).trim()
  const compact = raw.replace(/[^\d+]/g, '')
  if (!/^\+[1-9]\d{7,14}$/.test(compact)) return DEFAULT_DEMO_PHONE
  return compact
}

const HUMANOID_LINE = '+14085491275'

function readDronePhone(env) {
  const raw = String(env.DRONE_TWILIO_NUMBER || '').trim().replace(/[^\d+]/g, '')
  if (!/^\+[1-9]\d{7,14}$/.test(raw)) return ''
  if (raw === DHL_LINE || raw === HUMANOID_LINE) return ''
  return raw
}

function readHumanoidPhone(env) {
  const raw = String(env.HUMANOID_TWILIO_NUMBER || '').trim().replace(/[^\d+]/g, '')
  if (!/^\+[1-9]\d{7,14}$/.test(raw)) return ''
  if (raw === DHL_LINE) return ''
  return raw
}

export function formatE164Display(e164) {
  const num = String(e164 || '').trim()
  if (!num) return ''
  const us = num.match(/^\+1(\d{3})(\d{3})(\d{4})$/)
  if (us) return `+1 (${us[1]}) ${us[2]}-${us[3]}`
  const cc = num.match(/^(\+\d{1,3})(\d+)$/)
  if (!cc) return num
  const rest = cc[2]
  const chunks = rest.length % 4 === 0 ? rest.match(/.{4}/g) : rest.match(/.{1,3}/g)
  return `${cc[1]} ${chunks.join(' ')}`
}

export function voiceSetupSteps() {
  return [
    'Set XAI_API_KEY (grok-voice realtime) and MCP_API_KEY (tool calls).',
    'VOICE_DEMO_PHONE_NUMBER defaults to +14156394335 (existing Trial Demo Support). Override only if you provision a new number.',
    'Optional: TWILIO_AUTH_TOKEN to validate Twilio signatures, XAI_WEBHOOK_SECRET to validate xAI SIP webhooks.',
    'Twilio: point the Voice webhook at POST /api/voice/twilio/incoming (TwiML Connect Stream → /api/voice/media-stream).',
    'xAI SIP / CreatePhoneNumberV2: set webhook.url to POST /api/voice/xai/incoming. Opening the realtime socket on the posted call_id answers the call.',
    'Build with NEXT_PUBLIC_OXMAINT_PACK=dhl-gse so the tools read the CVG GSE register.',
  ]
}

export function publicVoiceConfig(env = process.env) {
  if (isDronePack(env)) {
    const e164 = readDronePhone(env)
    const provisioned = Boolean(e164)
    return {
      ok: true,
      provisioned,
      phone_number: provisioned ? e164 : null,
      display: provisioned ? formatE164Display(e164) : 'Assign a new Twilio number',
      label: provisioned ? formatE164Display(e164) : 'Assign a new Twilio number',
      shop: 'Mavic Enterprise',
      brand: 'Oxmaint AI',
      line: 'drone',
      setup_steps: [
        'Buy a new Twilio number. Do not reuse the DHL line or +1 (408) 549-1275.',
        'Voice webhook: POST /api/voice/twilio/incoming. xAI SIP webhook: POST /api/voice/xai/incoming.',
        'Until a number is live, POST /api/drone/command with { "text": "Collect images at the tank farm" }.',
      ],
    }
  }
  if (isHumanoidPack(env)) {
    const e164 = readHumanoidPhone(env)
    const provisioned = Boolean(e164)
    return {
      ok: true,
      provisioned,
      phone_number: provisioned ? e164 : null,
      display: provisioned ? formatE164Display(e164) : 'Assign a new Twilio number',
      label: provisioned ? formatE164Display(e164) : 'Assign a new Twilio number',
      shop: 'Autonomous Units',
      brand: 'Oxmaint AI',
      line: 'humanoid',
      setup_steps: [
        'Buy a new Twilio voice number. Do not reuse +1 (415) 639-4335 — that line is the DHL CVG shop.',
        'Set its Voice webhook (POST) to https://<this host>/api/voice/twilio/incoming.',
        'Optional: set HUMANOID_TWILIO_NUMBER to that E.164 value so the call card shows it.',
        'xAI SIP, if you trunk the same number: POST https://<this host>/api/voice/xai/incoming.',
        'Until the number is live, POST /api/humanoid/command with { "text": "..." } stages the same Unitree steps.',
      ],
    }
  }
  const e164 = readDemoPhoneNumber(env)
  const provisioned = Boolean(e164)
  return {
    ok: true,
    provisioned,
    phone_number: provisioned ? e164 : null,
    display: provisioned ? formatE164Display(e164) : NUMBER_PROVISIONING_LABEL,
    label: provisioned ? formatE164Display(e164) : NUMBER_PROVISIONING_LABEL,
    shop: 'DHL Express — CVG GSE Maintenance',
    brand: 'Oxmaint AI',
    setup_steps: voiceSetupSteps(),
  }
}

export function publicOrigin(request) {
  const url = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const host = forwardedHost || request.headers.get('host') || url.host
  const proto = request.headers.get('x-forwarded-proto') || (url.protocol === 'http:' ? 'http' : 'https')
  const origin = `${proto === 'http' ? 'http' : 'https'}://${host}`
  return { host, origin, wsOrigin: origin.replace(/^http/, 'ws') }
}

export function mcpSelfUrl(request, env = process.env) {
  const explicit = String(env.MCP_SERVER_URL || '').trim()
  if (explicit) return explicit.replace(/\/$/, '')
  if (request) {
    const { origin } = publicOrigin(request)
    return `${origin}/api/mcp`
  }
  const vercel = String(env.VERCEL_URL || '').trim()
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '')}/api/mcp`
  return '/api/mcp'
}
