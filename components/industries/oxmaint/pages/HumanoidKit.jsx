'use client'

import { useState } from 'react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { HumanoidGate } from './humanoidUi'
import { KITS } from '../lib/humanoid/workflows'

const STEPS = ['At the dock', 'Walking to the bin', 'At the bin', 'Part in the gripper', 'Confirmed']

export default function HumanoidKit() {
  const [jobId, setJobId] = useState(KITS[0].id)
  const [step, setStep] = useState(0)
  const [picked, setPicked] = useState({})
  const job = KITS.find((row) => row.id === jobId) || KITS[0]

  function choose(id) {
    setJobId(id)
    setStep(0)
    setPicked({})
  }

  function advance(line) {
    if (step < 3) {
      setStep(step + 1)
      return
    }
    const ok = line.onHand >= line.need
    setPicked((current) => ({ ...current, [line.part]: ok ? 'in the kit' : 'short — left on the shelf' }))
    setStep(0)
  }

  const done = job.lines.every((line) => picked[line.part])
  const short = job.lines.some((line) => picked[line.part] && line.onHand < line.need)

  return (
    <HumanoidGate title="Spare-parts kit">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Kit for a work order</CardTitle>
          <p className="text-sm text-slate-500">
            The robot walks the bin, picks what the order needs, and confirms it is on the shelf before the kit is closed.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {KITS.map((row) => (
            <Button key={row.id} size="sm" variant={row.id === job.id ? 'default' : 'outline'} onClick={() => choose(row.id)}>
              {row.id}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">{job.title}</CardTitle>
            <Badge variant="outline">{job.asset}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {job.lines.map((line) => {
            const available = line.onHand >= line.need
            return (
              <div key={line.part} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{line.part}</p>
                    <p className="text-xs text-slate-500">Bin {line.bin} · need {line.need} · on hand {line.onHand}</p>
                  </div>
                  <Badge variant={available ? 'secondary' : 'outline'}>{available ? 'In the store' : 'Not in the store'}</Badge>
                </div>
                <p className="mt-2 text-xs text-slate-500">{STEPS[picked[line.part] ? 4 : step]}</p>
                {!picked[line.part] && (
                  <Button className="mt-2" size="sm" variant="secondary" onClick={() => advance(line)}>
                    {step < 3 ? 'Next' : 'Confirm the pick'}
                  </Button>
                )}
                {picked[line.part] && <p className="mt-2 text-sm text-slate-900">{picked[line.part]}</p>}
              </div>
            )
          })}
          {done && (
            <p className="text-sm text-slate-900">
              {short
                ? 'Kit is not complete. The short line stays on the order. Do not start the job on a missing part.'
                : 'Kit is complete. Every line was on the shelf and is in the gripper count.'}
            </p>
          )}
        </CardContent>
      </Card>
    </HumanoidGate>
  )
}
