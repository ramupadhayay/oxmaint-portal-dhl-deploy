'use client'

import { useState } from 'react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { HumanoidGate } from './humanoidUi'
import { WALK } from '../lib/humanoid/workflows'

export default function HumanoidWalk() {
  const [open, setOpen] = useState([])
  const [seen, setSeen] = useState({})

  function file(point) {
    setSeen((current) => ({ ...current, [point.id]: true }))
    if (!point.kind) return
    setOpen((current) => current.some((row) => row.id === point.id) ? current : [
      ...current,
      { id: point.id, kind: point.kind, place: point.place, note: point.note, ref: `REQ-${740 + current.length}` },
    ])
  }

  return (
    <HumanoidGate title="End-of-shift walk">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">End of shift</CardTitle>
          <p className="text-sm text-slate-500">
            A clear point stays closed. Anything abnormal opens one request: cleanliness, safety, or maintenance.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {WALK.map((point) => (
            <div key={point.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{point.place}</p>
                <p className="text-xs text-slate-500">{point.note}</p>
              </div>
              <div className="flex items-center gap-2">
                {point.kind && <Badge variant="outline">{point.kind}</Badge>}
                <Button size="sm" variant={seen[point.id] ? 'outline' : 'secondary'} disabled={seen[point.id]} onClick={() => file(point)}>
                  {seen[point.id] ? (point.kind ? 'Request opened' : 'Clear') : 'Record this point'}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Requests from this walk</CardTitle></CardHeader>
        <CardContent>
          {open.length === 0 && <p className="text-sm text-slate-500">None yet.</p>}
          <ul className="space-y-2">
            {open.map((row) => (
              <li key={row.id} className="text-sm text-slate-900">
                <span className="font-mono text-xs text-slate-500">{row.ref}</span>
                {' '}<span className="font-semibold">{row.kind}</span>
                {' · '}{row.place}
                <span className="block text-slate-500">{row.note}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </HumanoidGate>
  )
}
