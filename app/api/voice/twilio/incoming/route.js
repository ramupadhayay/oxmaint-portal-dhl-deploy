import { mcpSelfUrl, publicOrigin, isDronePack, isHumanoidPack } from '@/lib/voice/phone'
import { spokenBrief } from '@/components/industries/oxmaint/lib/humanoid/catalog'
import {
  connectStreamTwiml,
  readTwilioParams,
  sayHangupTwiml,
  twilioValidationUrl,
  twimlResponse,
  validateTwilioSignature,
} from '@/lib/voice/twilio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

async function handleIncoming(request) {
  const params = await readTwilioParams(request)
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || '').trim()
  const check = validateTwilioSignature({
    authToken,
    signature: request.headers.get('x-twilio-signature'),
    url: twilioValidationUrl(request),
    params,
  })
  if (!check.ok) {
    return twimlResponse(sayHangupTwiml('We could not validate this call.'), 403)
  }

  const apiKey = String(process.env.XAI_API_KEY || '').trim()
  if (!apiKey) {
    const line = isDronePack()
      ? 'Oxmaint, Mavic 3 Enterprise. I cannot start the live voice agent on this call until the xAI key is on the line. Say new waypoint, collect images, or fly the yard mission.'
      : isHumanoidPack()
      ? `Oxmaint, R 1 E D U. I cannot start the live voice agent on this call until the xAI key is on the line. The orders that line will follow are: ${spokenBrief()}.`
      : 'The Oxmaint AI voice demo is not configured yet. Please try again later.'
    return twimlResponse(sayHangupTwiml(line))
  }

  const { wsOrigin } = publicOrigin(request)
  const streamUrl = `${wsOrigin}/api/voice/media-stream`
  const xml = connectStreamTwiml(streamUrl, {
    from: params.From || params.from || '',
    to: params.To || params.to || '',
    callSid: params.CallSid || params.callSid || '',
    mcp: mcpSelfUrl(request),
  })
  return twimlResponse(xml)
}

export function GET(request) {
  return handleIncoming(request)
}

export function POST(request) {
  return handleIncoming(request)
}
