import { NextResponse } from 'next/server'
import { featuresFromCues, usableCues } from '@/components/industries/oxmaint/lib/componentPhotos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  const body = await request.json().catch(() => null)
  const image = body?.image
  if (typeof image !== 'string' || image.length < 32 || image.length > 1_800_000) {
    return NextResponse.json({ ok: false, error: 'That photo is not one this page can read.' }, { status: 400 })
  }
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'Photo reading is not available in this session.' })
  }

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'grok-4.5',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Look at this one component photo. Return JSON only: {"cues": string[], "note": string}. cues are short visible facts: color, texture, geometry, wear. Do not name a maintenance class. Do not say belt-loader, conveyor, or GSE tyre. No measurements. If the photo is unclear, return fewer cues.',
          },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}` } },
        ],
      }],
    }),
  })
  if (!res.ok) return NextResponse.json({ ok: false, error: 'The photo could not be read. Try again.' })

  const payload = await res.json()
  const text = payload.choices?.[0]?.message?.content || ''
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return NextResponse.json({ ok: false, error: 'The photo came back without cues.' })
  let parsed
  try { parsed = JSON.parse(text.slice(start, end + 1)) } catch {
    return NextResponse.json({ ok: false, error: 'The photo came back without cues.' })
  }
  const cues = usableCues(Array.isArray(parsed.cues) ? parsed.cues.filter((item) => typeof item === 'string') : [])
  const note = typeof parsed.note === 'string' ? parsed.note.replace(/\s+/g, ' ').trim().slice(0, 280) : ''
  return NextResponse.json({ ok: true, cues, features: featuresFromCues(cues), note })
}
