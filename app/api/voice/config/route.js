import { publicVoiceConfig } from '@/lib/voice/phone'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET() {
  const config = publicVoiceConfig()
  return Response.json(
    {
      ...config,
      realtime_ready: Boolean(String(process.env.XAI_API_KEY || '').trim()),
      twilio_incoming: '/api/voice/twilio/incoming',
      media_stream: '/api/voice/media-stream',
      xai_incoming: '/api/voice/xai/incoming',
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}
