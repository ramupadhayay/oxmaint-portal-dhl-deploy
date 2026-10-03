'use client'

import { useState } from 'react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { DroneGate } from './droneUi'
import { SPOKEN } from '../lib/drone/mission'
import { apiUrl } from '@/lib/apiPath'

export default function DroneVoice() {
  const [text, setText] = useState('Collect images at the tank farm')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  async function send(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const res = await fetch(apiUrl('/api/drone/command'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      setResult(await res.json())
    } finally {
      setBusy(false)
    }
  }

  return (
    <DroneGate title="Mavic voice">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base">Mavic 3 Enterprise</CardTitle>
            <Badge variant="outline">Pilot 2 mission</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>Say one line. The portal returns a WPML mission. It does not fly the aircraft.</p>
          <ul className="list-disc space-y-1 pl-5">
            {SPOKEN.map((row) => <li key={row.say}>{row.say}</li>)}
          </ul>
          <form onSubmit={send} className="flex flex-col gap-2 sm:flex-row">
            <input value={text} onChange={(e) => setText(e.target.value)} className="h-9 flex-1 rounded-md border border-slate-200 px-2" />
            <Button type="submit" disabled={busy}>{busy ? 'Staging' : 'Stage mission'}</Button>
          </form>
          {result?.say && <p className="text-slate-900">{result.say}</p>}
          {result?.waypoints?.length > 0 && (
            <p className="font-mono text-xs text-slate-600">
              {result.waypoints.map((wp) => `${wp.name} ${wp.height}m ${wp.action}`).join(' · ')}
            </p>
          )}
        </CardContent>
      </Card>
    </DroneGate>
  )
}
