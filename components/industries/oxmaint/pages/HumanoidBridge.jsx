'use client'

import { useMemo, useState } from 'react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { HumanoidGate } from './humanoidUi'
import { ARM_JOINTS, BODY_JOINTS, EDU, LOCO, SDK_REPO, TOPICS, armCommand, velocityCommand } from '../lib/humanoid/sdk'

const HOLD = [0, 1.57, 0, 1.57, 0, 0, -1.57, 0, -1.57, 0, 0, 0, 0]

export default function HumanoidBridge() {
  const [nic, setNic] = useState('eth0')
  const [vx, setVx] = useState('0.2')
  const [sent, setSent] = useState(null)
  const arm = useMemo(() => armCommand(HOLD, 1), [])

  return (
    <HumanoidGate title="R1 EDU bridge">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">{EDU.model}</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                {EDU.dof} DOF. {EDU.leg} a leg, {EDU.waist}, {EDU.arm}, {EDU.head}. Air is {EDU.airDof} and is not this bridge.
                Compute on the robot: {EDU.compute}.
              </p>
            </div>
            <Badge variant="outline">DDS on the Jetson</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>
            State comes in on <span className="font-mono">{TOPICS.lowState}</span>. Arm commands go out on <span className="font-mono">{TOPICS.armCmd}</span>.
            Walking is the sport service, not a joint command.
          </p>
          <p>
            SDK: <a className="text-primary underline" href={SDK_REPO}>{SDK_REPO}</a>
            {' '}— <span className="font-mono">example/r1</span>, <span className="font-mono">defines.h</span>.
          </p>
          <label className="block text-slate-600">
            Network interface on the robot
            <input value={nic} onChange={(e) => setNic(e.target.value)} className="mt-1 h-9 w-full max-w-xs rounded-md border border-slate-200 px-2 font-mono text-sm" />
          </label>
          <p className="text-xs text-slate-500">The example is started as <span className="font-mono">r1_arm_sdk_dds_example {nic || 'eth0'}</span>. This browser does not open that socket.</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Joint index — R1 EDU</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {BODY_JOINTS.map(([group, names, start]) => (
              <div key={group}>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{group}</p>
                <p className="mt-1 text-slate-900">{names.map((name, i) => `${start + i} ${name}`).join(' · ')}</p>
              </div>
            ))}
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Arms and head — ArmSdk order</p>
              <ul className="mt-1 space-y-1">
                {ARM_JOINTS.map((joint) => (
                  <li key={joint.index} className="font-mono text-xs text-slate-900">
                    {joint.index} {joint.name} · kp {joint.kp} kd {joint.kd}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Command the bridge would publish</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-800">{JSON.stringify(arm, null, 2)}</pre>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-sm text-slate-600">
                vx m/s
                <input value={vx} onChange={(e) => setVx(e.target.value)} className="mt-1 block h-9 w-24 rounded-md border border-slate-200 px-2 font-mono text-sm" />
              </label>
              <Button variant="secondary" onClick={() => setSent(velocityCommand(Number(vx) || 0, 0, 0, 2))}>
                Stage a walk
              </Button>
            </div>
            {sent && <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-800">{JSON.stringify(sent, null, 2)}</pre>}
            <p className="text-xs text-slate-500">Sport API ids: {LOCO.map((row) => `${row.id} ${row.name}`).join(' · ')}</p>
          </CardContent>
        </Card>
      </div>
    </HumanoidGate>
  )
}
