'use client'

// Supervisor waterfall — existing shop statuses read as a monthly pipeline.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GitBranch, AlertTriangle, Users, Pause, CheckCircle } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { GSE_ACTIVE } from '../lib/gse'
import { VOICE_WATERFALL, VOICE_INSIGHTS } from '../lib/data'
import ModuleOff from '../components/ModuleOff'

const TONE = {
  planning: 'bg-sky-50 border-sky-200',
  parts_ready: 'bg-emerald-50 border-emerald-200',
  parts_short: 'bg-amber-50 border-amber-200',
  manpower: 'bg-indigo-50 border-indigo-200',
  in_flow: 'bg-blue-50 border-blue-200',
  review: 'bg-violet-50 border-violet-200',
  completed: 'bg-slate-50 border-slate-200',
  archived: 'bg-slate-50 border-slate-200',
}

export default function GseWaterfall() {
  const router = useRouter()
  const [focus, setFocus] = useState('planning')
  if (!GSE_ACTIVE) return <ModuleOff module="Work-order waterfall" />
  const pipe = VOICE_WATERFALL
  if (!pipe) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-900">Work-order waterfall</h1>
        <p className="text-slate-600 mt-2">The current-period pipeline is only on the DHL GSE voice register.</p>
      </div>
    )
  }

  const stages = pipe.stages || []
  const live = stages.filter((s) => !['completed', 'archived'].includes(s.key))
  const done = stages.filter((s) => ['completed', 'archived'].includes(s.key))
  const h = pipe.highlights || {}
  const days = pipe.manpower?.by_day || []

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Oxmaint AI · supervisor / maintenance manager</p>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">Work-order waterfall</h1>
        <p className="text-slate-600 mt-2 max-w-3xl">
          {pipe.how_to_read} {pipe.honesty}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat icon={GitBranch} label="Still in planning" value={h.planning || 0} />
        <Stat icon={AlertTriangle} label="Need a PR" value={h.need_pr || 0} sub={`${h.parts_short || 0} parts short`} />
        <Stat icon={Pause} label="Scope variation" value={h.variation || 0} />
        <Stat icon={CheckCircle} label="Awaiting your close" value={h.review || 0} />
        <Stat icon={Users} label="Manpower locked" value={h.manpower || 0} />
      </div>

      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500 mb-2">Live pipeline (this week)</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {live.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setFocus(s.key)}
              className={`text-left rounded-lg border p-3 ${TONE[s.key] || 'bg-white border-slate-200'} ${focus === s.key ? 'ring-2 ring-slate-400' : ''}`}
            >
              <div className="text-[11px] uppercase tracking-wide text-slate-500">{s.label}</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{s.count}</div>
              <div className="text-xs text-slate-500">{s.planned} plan · {s.unplanned} unplanned</div>
              <div className="text-[11px] text-slate-400 mt-1">Shop: {s.shop_status}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {done.map((s) => (
          <Card key={s.key}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">{s.label}</div>
                <div className="text-xl font-bold tabular-nums">{s.count}</div>
              </div>
              <Badge variant="outline">{s.planned} plan / {s.unplanned} unplanned</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manpower plan this week</CardTitle>
          <p className="text-sm text-slate-500">{pipe.manpower?.how_to_read}</p>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {days.map((d) => (
            <div key={d.day} className="rounded-md border border-slate-200 px-2 py-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">{d.day.slice(0, 3)}</div>
              <div className="text-lg font-bold tabular-nums">{d.jobs}</div>
              <div className="text-xs text-slate-500">{d.hours}h</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How the buckets map</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          {(pipe.glossary || []).map((g) => (
            <p key={g.key}><span className="font-medium">{g.label}</span> — {g.how_to_read}</p>
          ))}
          <button
            type="button"
            className="text-sm text-slate-600 underline"
            onClick={() => router.push('/portal/oxmaint/gse-voice')}
          >
            Voice / MCP scripts on the call card
          </button>
          {VOICE_INSIGHTS?.workmanship && (
            <p className="text-xs text-slate-500">Workmanship scores sit on the same register — not a second system.</p>
          )}
        </CardContent>
      </Card>

      <FocusNote stage={focus} stages={stages} />
    </div>
  )
}

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

function FocusNote({ stage, stages }) {
  const row = useMemo(() => stages.find((s) => s.key === stage), [stage, stages])
  if (!row) return null
  return (
    <p className="text-sm text-slate-600">
      Selected: <span className="font-medium">{row.label}</span> — {row.count} this week
      ({row.planned} from the plan, {row.unplanned} from a notification). {row.how_to_read}
    </p>
  )
}
