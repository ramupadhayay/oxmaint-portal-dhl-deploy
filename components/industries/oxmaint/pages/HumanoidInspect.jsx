'use client'

import { useState } from 'react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { HumanoidGate } from './humanoidUi'
import { WAYPOINTS } from '../lib/humanoid/workflows'

export default function HumanoidInspect() {
  const [active, setActive] = useState(null)
  const [phase, setPhase] = useState('dock')
  const [photos, setPhotos] = useState({})

  const point = WAYPOINTS.find((row) => row.id === active) || null

  function go(id) {
    const row = WAYPOINTS.find((item) => item.id === id)
    if (!row?.ready) return
    setActive(id)
    setPhase('out')
  }

  function shoot(file) {
    if (!file || !point) return
    setPhotos((current) => ({ ...current, [point.id]: URL.createObjectURL(file) }))
    setPhase('photo')
  }

  return (
    <HumanoidGate title="Visual inspection">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Inspection when the waypoint is known</CardTitle>
          <p className="text-sm text-slate-500">
            No pose, no dispatch. With a pose, the robot goes, takes the picture, and comes back to the dock.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {WAYPOINTS.map((row) => (
            <div key={row.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{row.name}</p>
                <Badge variant={row.ready ? 'secondary' : 'outline'}>{row.ready ? 'Waypoint set' : 'No waypoint'}</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">{row.pose || 'Pose has not been taught.'}</p>
              <Button className="mt-2" size="sm" variant="secondary" disabled={!row.ready || (active === row.id && phase !== 'dock')} onClick={() => go(row.id)}>
                Send the robot
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {point && phase !== 'dock' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{point.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-900">
              {phase === 'out' && 'Walking to the waypoint.'}
              {phase === 'there' && 'On station. Take the picture, then it returns.'}
              {phase === 'photo' && 'Picture stored. Returning to the dock.'}
              {phase === 'back' && 'Back at the dock. The picture stays on this point.'}
            </p>
            {photos[point.id] && (
              <img src={photos[point.id]} alt="" className="max-h-60 w-full rounded-lg border border-slate-200 bg-slate-50 object-contain" />
            )}
            {phase === 'out' && <Button variant="secondary" onClick={() => setPhase('there')}>At the point</Button>}
            {phase === 'there' && (
              <Button asChild variant="secondary">
                <label>
                  Take the picture
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { shoot(e.target.files?.[0]); e.target.value = '' }} />
                </label>
              </Button>
            )}
            {phase === 'photo' && <Button variant="secondary" onClick={() => setPhase('back')}>Return</Button>}
            {phase === 'back' && <Button variant="outline" onClick={() => { setPhase('dock'); setActive(null) }}>Clear the run</Button>}
          </CardContent>
        </Card>
      )}
    </HumanoidGate>
  )
}
