import { mcpSelfUrl, publicOrigin } from '@/lib/voice/phone'
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
    return twimlResponse(
      sayHangupTwiml('The Oxmaint AI voice demo is not configured yet. Please try again later.'),
    )
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
