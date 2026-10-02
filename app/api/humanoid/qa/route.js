import { SPEC, UNITS, judgeFails, judgeUnit } from '@/components/industries/oxmaint/lib/humanoid/quality'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } })
}

export function GET() {
  return json({
    ok: true,
    spec: SPEC,
    units: UNITS.map((unit) => ({ id: unit.id, frame: unit.frame })),
  })
}

async function readPhoto(image) {
  const apiKey = String(process.env.XAI_API_KEY || '').trim()
  if (!apiKey) {
    return { ok: false, error: 'Photo reading needs XAI_API_KEY. The station frames still judge without it.' }
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
            text: `Judge this photo against ${SPEC.id}, a 200 ml UHT nutrition carton. Fail seal on a channel, weep, or open fin. Fail fill if the liquid is below the min line or over the max line. Fail cap if it is cocked or the tamper band is broken. Fail label if the label is missing or the lot code is unreadable. Fail foreign if a dark inclusion is in the window. Return JSON only: {"fails": string[], "cues": string[], "note": string}. fails may only contain seal, fill, cap, label, foreign. If this is not that carton, return fails as an empty array and say so in note.`,
          },
          { type: 'image_url', image_url: { url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}` } },
        ],
      }],
    }),
  })
  if (!res.ok) return { ok: false, error: 'The photo could not be read. Try again, or judge a station frame.' }
  const payload = await res.json()
  const text = payload.choices?.[0]?.message?.content || ''
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return { ok: false, error: 'The photo came back without a verdict.' }
  try {
    const parsed = JSON.parse(text.slice(start, end + 1))
    const fails = Array.isArray(parsed.fails) ? parsed.fails.filter((item) => typeof item === 'string') : []
    const cues = Array.isArray(parsed.cues) ? parsed.cues.filter((item) => typeof item === 'string').slice(0, 8) : []
    const note = typeof parsed.note === 'string' ? parsed.note.replace(/\s+/g, ' ').trim().slice(0, 280) : ''
    const judged = judgeFails(fails, { id: 'PHOTO', frame: note || cues.join('. ') })
    return { ok: true, source: 'uploaded photo', cues, note, ...judged }
  } catch {
    return { ok: false, error: 'The photo came back without a verdict.' }
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => null)
  if (!body) return json({ ok: false, error: 'Send a unit_id or a photo.' }, 400)
  if (body.unit_id || body.unit) {
    const judged = judgeUnit(body.unit_id || body.unit)
    if (!judged) return json({ ok: false, error: 'That carton is not on this station.', units: UNITS.map((row) => row.id) }, 404)
    return json({ ok: true, spec: SPEC.id, ...judged })
  }
  const image = body.image
  if (typeof image !== 'string' || image.length < 32 || image.length > 2_000_000) {
    return json({ ok: false, error: 'Send unit_id, or a jpeg/png under the size this page accepts.' }, 400)
  }
  const photo = await readPhoto(image)
  return json(photo.ok ? { spec: SPEC.id, ...photo } : photo, photo.ok ? 200 : 503)
}
