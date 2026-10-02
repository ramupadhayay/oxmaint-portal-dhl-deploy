'use client'

import { useEffect, useState } from 'react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { HumanoidGate } from './humanoidUi'
import { apiUrl } from '@/lib/apiPath'

const SAMPLES = [
  'Run quality inspection and pick the faulty cartons off the line',
  'Check carton CTN-1902',
  'Close the jaw gun',
  'Open the jaw',
  'Walk forward',
  'Stop',
  'Pick the kit for work order 2614',
  'Inspect the filler jaw',
  'Start the end of shift walk',
  'Return to the dock',
]

export default function HumanoidVoice() {
  const [config, setConfig] = useState(null)
  const [catalog, setCatalog] = useState(null)
  const [text, setText] = useState(SAMPLES[0])
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(apiUrl('/api/voice/config')).then((r) => r.json()).then((data) => { if (!cancelled) setConfig(data) }).catch(() => {})
    fetch(apiUrl('/api/humanoid/command')).then((r) => r.json()).then((data) => { if (!cancelled) setCatalog(data) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  function speak(say) {
    if (typeof window === 'undefined' || !window.speechSynthesis || !say) return
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(say))
  }

  async function send(value) {
    const heard = String(value ?? text).trim()
    if (!heard) return
    setBusy(true)
    setText(heard)
    try {
      const res = await fetch(apiUrl('/api/humanoid/command'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: heard }),
      })
      const data = await res.json()
      setResult(data)
      if (data.say) speak(data.say)
    } catch {
      setResult({ understood: false, say: 'The command point did not answer.', steps: [] })
    } finally {
      setBusy(false)
    }
  }

  function listen() {
    const Rec = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
    if (!Rec) {
      setResult({ understood: false, say: 'This browser has no speech recognition. Type the order, or use the Twilio webhook once a new number is assigned.', steps: [] })
      return
    }
    const rec = new Rec()
    rec.lang = 'en-US'
    setListening(true)
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    rec.onresult = (event) => {
      const heard = event.results?.[0]?.[0]?.transcript || ''
      send(heard)
    }
    rec.start()
  }

  const phone = config?.phone_number
  const webhook = catalog?.voice?.twilio_voice_webhook
  const sip = catalog?.voice?.xai_sip_webhook

  return (
    <HumanoidGate title="Voice to the robot">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ready to test</CardTitle>
          <p className="text-sm text-slate-500">
            The same interpreter answers this page, a POST, and the xAI voice agent.
            A spoken order becomes arm, walk, and jaw steps for the Jetson. It does not move the robot from the browser.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="break-all font-mono text-xs text-slate-700">{catalog?.command || '/api/humanoid/command'}</p>
          <div className="flex flex-wrap gap-2">
            {phone ? (
              <a href={`tel:${phone}`} className="text-lg font-semibold text-slate-900">{config.display}</a>
            ) : (
              <Badge variant="outline">Assign a new Twilio number</Badge>
            )}
            {config?.realtime_ready
              ? <Badge variant="secondary">Voice agent ready</Badge>
              : <Badge variant="outline">Set XAI_API_KEY for a live call</Badge>}
          </div>
          <p className="text-xs text-slate-500">
            Do not point +1 (415) 639-4335 here. That number is the DHL shop.
            {webhook ? ` Twilio Voice webhook: ${webhook}` : ''}
            {sip ? ` xAI SIP webhook: ${sip}` : ''}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Say an order</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((sample) => (
              <Button key={sample} size="sm" variant="outline" onClick={() => send(sample)}>{sample}</Button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => send(text)}>Stage the command</Button>
            <Button variant="outline" disabled={busy} onClick={listen}>{listening ? 'Listening…' : 'Speak'}</Button>
          </div>
          {result && (
            <div className="space-y-2">
              <p className="text-sm text-slate-900">{result.say}</p>
              {(result.steps || []).map((row, index) => (
                <div key={`${row.label}-${index}`} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-900">{index + 1}. {row.label}</p>
                  <pre className="mt-2 overflow-x-auto text-[11px] leading-relaxed text-slate-700">{JSON.stringify(row.publish, null, 2)}</pre>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </HumanoidGate>
  )
}
