'use client'

// Voice demo call card — DHL CVG GSE shop on Oxmaint AI.
//
// Three spoken role codes select persona for the rest of the call.
// The number is the existing xAI Trial Demo Support line.

import { useEffect, useState } from 'react'
import { Phone, PhoneCall, ClipboardList, AlertTriangle, Pause, CheckCircle, Wrench, Users, Package } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { GSE_ACTIVE } from '../lib/gse'
import { DATASET_META, DOMAIN, ORG } from '../lib/data'
import ModuleOff from '../components/ModuleOff'
import { apiUrl } from '@/lib/apiPath'

const ROLES = [
  {
    code: '0001',
    spoken: '“triple zero one” or “zero zero zero one”',
    title: 'Technician',
    who: 'Alex Rivera · TECH-0001 · Days',
    icon: Wrench,
    ask: [
      'What work orders are assigned to me?',
      'Are the parts for WO-V26-00071 in stock or on order?',
      'Where does belt loader 0035 sit in the hierarchy?',
      'What is my workmanship score — any come-backs?',
      'Log a maintenance request on belt loader 0035 — conveyor slipping under load.',
    ],
  },
  {
    code: '0002',
    spoken: '“triple zero two” or “zero zero zero two”',
    title: 'Supervisor',
    who: 'Shop-wide week plan',
    icon: Users,
    ask: [
      'How many work orders this week?',
      'How many this week are still in planning?',
      'How many need a PR? How many have scope variation?',
      'What’s waiting on my technical close?',
      'Manpower plan for Thursday?',
      'How many WOs are blocked on material, and how many open PRs this week?',
      'What is Alex Rivera’s workmanship score versus the shop?',
      'Which spare variants are best fit, and which drive parts hold?',
      'Generate the last quarter airline audit report.',
      'Where is CVG-PWR-0035 in the functional location tree?',
    ],
  },
  {
    code: '0003',
    spoken: '“triple zero three” or “zero zero zero three”',
    title: 'Store',
    who: 'Parts / storeroom',
    icon: Package,
    ask: [
      'What is on Parts Hold this week? Check stock for the short lines.',
      'What is the PR / PO / GR status on that job?',
      'Which aftermarket variants are higher value versus stay-with-OEM?',
      'Post a goods receipt — release the parts hold.',
    ],
  },
]

export default function GseVoice() {
  const [config, setConfig] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch(apiUrl('/api/voice/config'))
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setConfig(data) })
      .catch(() => { if (!cancelled) setConfig({ display: '+1 (415) 639-4335', provisioned: true }) })
    return () => { cancelled = true }
  }, [])

  if (!GSE_ACTIVE) return <ModuleOff module="Voice demo" />

  const display = config?.display || '+1 (415) 639-4335'
  const ready = Boolean(config?.realtime_ready)
  const vol = DATASET_META?.voiceVolume
  const ev = DOMAIN?.evaluation

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Oxmaint AI · DHL Express CVG</p>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">Call the GSE shop</h1>
        <p className="text-slate-600 mt-2 max-w-2xl">
          {ev?.client || ORG.organization_name} — a voice line on the same register as this portal.
          After the greeting, say a four-digit access code. The current-period counts are a
          synthetic Superhub projection (~1,600 a month / ~400 a week), not DHL actuals.
          Materials and the asset tree are an Oxmaint AI projection mirrored to SAP MM/PM
          shapes — not a live production SAP connector.
        </p>
      </div>

      <Card className="border-red-200 bg-gradient-to-br from-red-50 to-white shadow-sm">
        <CardContent className="pt-8 pb-8">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white">
              <PhoneCall className="h-7 w-7" />
            </div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Trial Demo Support</div>
            <a
              href={`tel:${config?.phone_number || '+14156394335'}`}
              className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 tabular-nums"
            >
              {display}
            </a>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Badge variant="outline" className="bg-white">Oxmaint AI</Badge>
              <Badge variant="outline" className="bg-white">CVG GSE shop</Badge>
              {ready
                ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Realtime ready</Badge>
                : <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Set XAI_API_KEY to go live</Badge>}
            </div>
            <p className="text-sm text-slate-500 max-w-md">
              Same number as the prior xAI voice demos. Point the xAI SIP webhook at
              {' '}<code className="text-xs">/api/voice/xai/incoming</code> on this deployment.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={ClipboardList} label="This week (target)" value={vol?.weeklyTarget || 400} />
        <Stat icon={ClipboardList} label="This month (target)" value={vol?.monthlyTarget || 1600} />
        <Stat icon={Phone} label="Portal live register" value={vol?.portalLive || '—'} />
        <Stat icon={AlertTriangle} label="Honesty" value="Synthetic" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Say a role code after the greeting</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          {ROLES.map((role) => {
            const Icon = role.icon
            return (
              <div key={role.code} className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-2xl font-bold tabular-nums text-slate-900">{role.code}</span>
                  <Icon className="h-4 w-4 text-slate-500" />
                </div>
                <div className="font-medium text-slate-900">{role.title}</div>
                <div className="text-xs text-slate-500">{role.who}</div>
                <div className="text-xs text-slate-500">Say {role.spoken}</div>
                <ul className="text-sm text-slate-700 space-y-1 pt-1">
                  {role.ask.map((q) => (
                    <li key={q}>“{q}”</li>
                  ))}
                </ul>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">What the stages mean</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3 text-sm text-slate-700">
          <Row icon={Pause} title="Parts Hold" body="Waiting on material — reservation plus an open PR or PO on the SAP MM demo mirror." />
          <Row icon={Package} title="PR → PO → GR" body="Store can raise a requisition, read status, and post a demo goods receipt that updates stock." />
          <Row icon={AlertTriangle} title="P1-AOG / Gate Hold" body="An aircraft is waiting on this unit." />
          <Row icon={CheckCircle} title="SAP PM tree" body="Functional location + equipment keys. Ask where a unit sits — e.g. Superhub → GSE yard → belt loaders → CVG-PWR-0035." />
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums text-slate-900">{value}</div>
    </div>
  )
}

function Row({ icon: Icon, title, body }) {
  return (
    <div className="flex gap-3">
      <Icon className="h-4 w-4 mt-0.5 text-slate-500 shrink-0" />
      <div>
        <div className="font-medium text-slate-900">{title}</div>
        <div className="text-slate-600">{body}</div>
      </div>
    </div>
  )
}
