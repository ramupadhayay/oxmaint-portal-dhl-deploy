'use client'

// Testing & Inspection — every recurring life safety test, when it is due, and
// the evidence behind it.
//
// One line per test rather than per device. A hospital has hundreds of smoke
// detectors and one annual fire alarm inspection that covers them, and the
// question a facilities director is asked is about the inspection. The devices
// are counted beside it so the scope is never in doubt.
//
// The two actions are the two ways a line goes green: raise the job that does
// the test, or put the report where a surveyor will look for it.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShieldCheck, ShieldAlert, ClipboardList, AlertTriangle, CalendarClock, FileWarning, FileCheck2,
  Wrench, Upload, UserX,
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { useStore } from '../lib/store'
import { useActions } from '../lib/actions'
import { useFls, frequencyLabel, FLS_ACTIVE } from '../lib/fls'
import { fmtDate } from '../lib/data'
import ModuleOff from '../components/ModuleOff'

const STATE_STYLE = {
  Current: 'bg-emerald-100 text-emerald-800',
  'Due soon': 'bg-amber-100 text-amber-800',
  Overdue: 'bg-red-100 text-red-800',
}

export default function FlsCompliance() {
  const router = useRouter()
  const { notify } = useStore()
  const { raiseWorkOrder } = useActions()
  const { systems, tests, totals } = useFls()
  const [system, setSystem] = useState('all')
  const [busyKey, setBusyKey] = useState(null)

  const shown = useMemo(
    () => (system === 'all' ? systems : systems.filter((s) => s.key === system)),
    [systems, system],
  )

  if (!FLS_ACTIVE) return <ModuleOff module="Life safety testing" />

  const raise = async (t) => {
    if (!t.firstAsset) {
      notify('No asset of this kind is in the register to raise the job against.', 'error')
      return
    }
    setBusyKey(t.key)
    const overdue = t.state === 'Overdue'
    const wo = await raiseWorkOrder({
      title: t.label,
      description: `${t.label} (${t.standard}) — ${frequencyLabel(t.every).toLowerCase()} test covering ${t.covered.length} `
        + `${t.covered.length === 1 ? 'asset' : 'assets'}. `
        + (t.recordEvidence
          ? 'Completing this work order is the test record.'
          : `Evidence required: ${t.evidence.toLowerCase()}, filed in the document register${t.who === 'Contractor' ? ', and the contractor’s visit booked on this job' : ''}.`),
      assetId: t.firstAsset.asset_id || t.firstAsset.recordId,
      asset: t.firstAsset,
      type: 'Inspection',
      priority: overdue ? 'High' : 'Medium',
      dueInDays: overdue ? 3 : Math.max(3, Math.min(t.daysToDue, 30)),
      estimatedHours: t.who === 'Contractor' ? 4 : 2,
      source: `Life safety test ${t.label}`,
    })
    setBusyKey(null)
    if (wo) notify(`${wo.work_order_number} raised for ${t.label.toLowerCase()}.`)
  }

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Testing &amp; Inspection</h1>
          <p className="text-slate-600 mt-1">
            Every recurring life safety test, the code that sets it, and the evidence behind it
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => router.push('/portal/oxmaint/fls-ilsm')}>
            <ShieldAlert className="h-4 w-4" />
            Impairments &amp; ILSM
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => router.push('/portal/oxmaint/fls-soc')}>
            <ClipboardList className="h-4 w-4" />
            Statement of Conditions
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => router.push('/portal/oxmaint/fls-survey')}>
            <ShieldCheck className="h-4 w-4" />
            Survey readiness
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label="Tests tracked" value={totals.tests} sub={`${totals.devices} devices & systems`} Icon={ShieldCheck} />
        <Stat label="Current" value={totals.current} sub="inside their interval" Icon={FileCheck2} tone="green" />
        <Stat label="Due soon" value={totals.dueSoon} sub="book them now" Icon={CalendarClock} tone={totals.dueSoon ? 'amber' : null} />
        <Stat label="Overdue" value={totals.overdue} sub="past their interval" Icon={AlertTriangle} tone={totals.overdue ? 'red' : null} />
        <Stat label="No current evidence" value={totals.missingDocs} sub="report or certificate missing" Icon={FileWarning} tone={totals.missingDocs ? 'red' : null} />
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip on={system === 'all'} onClick={() => setSystem('all')}>All systems · {tests.length}</FilterChip>
        {systems.map((s) => (
          <FilterChip key={s.key} on={system === s.key} onClick={() => setSystem(s.key)}>
            {s.label} · {s.tests.length}
          </FilterChip>
        ))}
      </div>

      {shown.map((s) => (
        <Card key={s.key}>
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              {s.label}
              <span className="text-sm font-normal text-slate-500">{s.standard}</span>
              <span className="ml-auto text-sm font-normal text-slate-500">
                {s.assets.length} {s.assets.length === 1 ? 'asset' : 'assets'} in the register
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {s.tests.map((t) => (
              <div
                key={t.key}
                className={`rounded-lg border p-3 ${t.state === 'Overdue' ? 'border-red-200 bg-red-50/40' : 'border-slate-200'}`}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{t.label}</span>
                      <Badge className={STATE_STYLE[t.state]}>{t.state}</Badge>
                      {t.who === 'Contractor' && <Badge variant="secondary">Contractor test</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {t.standard} · {frequencyLabel(t.every)} · {t.covered.length} {t.covered.length === 1 ? 'asset' : 'assets'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={busyKey === t.key} onClick={() => raise(t)}>
                      <Wrench className="h-3.5 w-3.5" />
                      {busyKey === t.key ? 'Raising…' : 'Raise job'}
                    </Button>
                    {!t.recordEvidence && (
                      <Button size="sm" variant={t.docCurrent ? 'ghost' : 'outline'} className="h-8 gap-1.5"
                        onClick={() => router.push('/portal/oxmaint/documents')}>
                        <Upload className="h-3.5 w-3.5" />
                        {t.docCurrent ? 'Documents' : `Upload ${t.evidence.toLowerCase()}`}
                      </Button>
                    )}
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                  <Cell label="Last done">
                    {fmtDate(t.lastDone)}
                    {t.lastSource !== 'history' && <span className="text-slate-500"> · {t.lastSource}</span>}
                  </Cell>
                  <Cell label="Next due" tone={t.state === 'Overdue' ? 'text-red-700 font-semibold' : t.state === 'Due soon' ? 'text-amber-700 font-semibold' : ''}>
                    {fmtDate(t.nextDue)}
                    {t.state === 'Overdue' ? ` · ${Math.abs(t.daysToDue)} days late` : ''}
                  </Cell>
                  <Cell label="Performed by" tone={t.performer ? '' : 'text-red-700'}>
                    {t.performer ? (
                      <>
                        {t.performer.name}
                        {t.performer.person && <span className="text-slate-500"> · {t.performer.person}</span>}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1"><UserX className="h-3.5 w-3.5" />Not recorded</span>
                    )}
                  </Cell>
                  <Cell label={t.recordEvidence ? 'Evidence' : t.evidence} tone={t.docCurrent ? '' : 'text-red-700'}>
                    {t.recordEvidence ? (t.docCurrent ? 'Test log in this system' : 'No log inside the interval') : t.doc ? (
                      <>
                        <span className="break-words">{t.doc.document_name}</span>
                        <span className={t.docCurrent ? 'text-slate-500' : 'text-red-700'}>
                          {' · '}
                          {t.docExpired ? `expired ${fmtDate(t.doc.valid_until)}` : t.docCurrent ? `issued ${fmtDate(t.doc.created_date)}` : `stale — ${fmtDate(t.doc.created_date)}`}
                        </span>
                      </>
                    ) : 'Not on file'}
                  </Cell>
                </dl>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function FilterChip({ on, onClick, children }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`h-9 rounded-md border px-3 text-sm ${
        on ? 'border-primary bg-primary/5 font-medium text-primary' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}

function Cell({ label, tone = '', children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-slate-900 ${tone}`}>{children}</dd>
    </div>
  )
}

function Stat({ label, value, sub, Icon, tone }) {
  const ring = tone === 'red' ? 'border-red-200' : tone === 'amber' ? 'border-amber-200' : tone === 'green' ? 'border-emerald-200' : 'border-slate-200/60'
  const ink = tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700' : tone === 'green' ? 'text-emerald-700' : 'text-slate-900'
  return (
    <div className={`bg-white border rounded-lg shadow-sm p-4 ${ring}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-1.5 text-2xl font-bold tabular-nums ${ink}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  )
}
