'use client'

// Evidence & Records — the four things the hospital asked for, in one place.
//
// The enquiry named four: an inspection audit trail, document upload, equipment
// tracking and labour tracking. Each of them already has a full screen in this
// portal, and each of those screens is built for the person who works in it all
// day. None of them is built for the ten minutes in which somebody is asked
// whether the hospital can produce its records.
//
// So this page is the answer to that question and nothing else. Four panels,
// one per ask, each showing the live count and the last few rows — and each
// one a door into the screen that owns it. Nothing here keeps its own state or
// its own copy of anything: every number is read from the same records the
// owning screen reads, so this page cannot disagree with them.

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  History, FileCheck2, Boxes, HardHat, ArrowRight, AlertTriangle, ShieldCheck,
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import ModuleOff from '../components/ModuleOff'
import { useRecords } from '../lib/store'
import { useAuditTrail } from '../lib/audit'
import { useLabourEntries } from '../lib/labour'
import { useFls, FLS_ACTIVE } from '../lib/fls'
import { ASSETS, DOCUMENTS, EPOCH, ORG, fmtDate, money } from '../lib/data'

const assetIdOf = (a) => a.asset_id || a.recordId
const docIdOf = (d) => d.document_id || d.recordId
const time = (iso) => (iso ? new Date(iso).getTime() : 0)
const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10

export default function FlsEvidence() {
  const router = useRouter()
  const { systems, totals } = useFls()
  const trail = useAuditTrail()
  const labour = useLabourEntries()
  const documents = useRecords('document', DOCUMENTS, docIdOf)
  const assets = useRecords('asset', ASSETS, assetIdOf)

  const now = new Date(EPOCH).toISOString()

  // Certificates and reports are the ones a surveyor asks for by name. A
  // photograph of a corridor is a document; it is not evidence of a test.
  const evidence = useMemo(() => {
    const rows = documents.filter((d) => ['Report', 'Certificate'].includes(d.category))
    const expired = rows.filter((d) => d.valid_until && time(d.valid_until) < time(now))
    return {
      rows,
      expired: expired.length,
      current: rows.length - expired.length,
      latest: [...documents].sort((a, b) => time(b.created_date) - time(a.created_date)).slice(0, 4),
      uploaded: documents.filter((d) => d.recordId && !d.document_id).length,
    }
  }, [documents, now])

  // Only the plant the life safety programme is judged on, not all 150 assets.
  const devices = useMemo(() => {
    const kinds = new Set(systems.flatMap((s) => s.kinds))
    const mine = assets.filter((a) => kinds.has(a.asset_type))
    return {
      total: mine.length,
      down: mine.filter((a) => a.status === 'Down').length,
      maintenance: mine.filter((a) => a.status === 'Under Maintenance').length,
      bySystem: systems.map((s) => ({ key: s.key, label: s.label, standard: s.standard, count: s.assets.length })),
    }
  }, [assets, systems])

  const work = useMemo(() => {
    const contractor = labour.filter((e) => e.worker_type === 'Contractor')
    const hours = labour.reduce((n, e) => n + (Number(e.hours) || 0), 0)
    const contractorHours = contractor.reduce((n, e) => n + (Number(e.hours) || 0), 0)
    return {
      entries: labour.length,
      hours: round1(hours),
      contractorHours: round1(contractorHours),
      share: hours ? Math.round((contractorHours / hours) * 100) : 0,
      cost: labour.reduce((n, e) => n + (Number(e.cost) || 0), 0),
      latest: contractor.slice(0, 4),
    }
  }, [labour])

  if (!FLS_ACTIVE) return <ModuleOff module="Life safety evidence" />

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Evidence &amp; Records</h1>
          <p className="text-slate-600 mt-1">
            What {ORG.organization_name} can produce on the day it is asked — the trail of every change, the
            paperwork behind every test, the estate it covers and who performed the work
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => router.push('/portal/oxmaint/fls-survey')}>
          <ShieldCheck className="h-4 w-4" />
          Survey readiness · {totals.readiness}%
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1 — the audit trail */}
        <Panel
          Icon={History}
          title="Inspection audit trail"
          note="Written by the server beside each change, and refused to anything else"
          figure={trail.length}
          figureLabel={trail.length === 1 ? 'line recorded' : 'lines recorded'}
          onOpen={() => router.push('/portal/oxmaint/audit-trail')}
          openLabel="Open the trail"
        >
          {trail.length === 0 ? (
            <Empty>Nothing has been changed in the portal yet. Edit an inspection and its line appears here.</Empty>
          ) : (
            <ul className="space-y-1.5">
              {trail.slice(0, 5).map((e) => (
                <li key={e.recordId} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="tabular-nums text-xs text-slate-500">
                    {new Date(e.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="font-medium text-slate-900">{e.entity} {e.reference}</span>
                  <span className="text-slate-600">{e.action}</span>
                  <span className="text-slate-400">· {e.actor_name}</span>
                  {e.detail && e.detail !== '—' && <span className="w-full text-xs text-slate-500">{e.detail}</span>}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* 2 — documents */}
        <Panel
          Icon={FileCheck2}
          title="Document upload & evidence"
          note="Reports and certificates held as files, not as filenames"
          figure={evidence.rows.length}
          figureLabel="reports & certificates"
          onOpen={() => router.push('/portal/oxmaint/documents')}
          openLabel="Open the register"
          tone={totals.missingDocs ? 'red' : null}
        >
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge className="bg-emerald-100 text-emerald-800">{evidence.current} current</Badge>
            {evidence.expired > 0 && <Badge className="bg-red-100 text-red-800">{evidence.expired} expired</Badge>}
            {totals.missingDocs > 0 && (
              <Badge className="bg-amber-100 text-amber-800">
                {totals.missingDocs} {totals.missingDocs === 1 ? 'test' : 'tests'} without current evidence
              </Badge>
            )}
            {evidence.uploaded > 0 && <Badge variant="secondary">{evidence.uploaded} uploaded here</Badge>}
          </div>
          <ul className="space-y-1.5">
            {evidence.latest.map((d) => (
              <li key={docIdOf(d)} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-medium text-slate-900">{d.document_name}</span>
                <span className="text-xs text-slate-500">
                  {d.category || 'Document'} · {fmtDate(d.created_date)}
                  {d.valid_until ? ` · valid to ${fmtDate(d.valid_until)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        {/* 3 — equipment */}
        <Panel
          Icon={Boxes}
          title="Equipment tracking"
          note="The devices and plant the programme is judged on"
          figure={devices.total}
          figureLabel="life safety assets"
          onOpen={() => router.push('/portal/oxmaint/assets')}
          openLabel="Open the register"
        >
          <div className="mb-2 flex flex-wrap gap-2">
            {devices.down > 0 && <Badge className="bg-red-100 text-red-800">{devices.down} down</Badge>}
            {devices.maintenance > 0 && <Badge className="bg-amber-100 text-amber-800">{devices.maintenance} under maintenance</Badge>}
            <Badge variant="secondary">{totals.tests} recurring tests across them</Badge>
          </div>
          <ul className="space-y-1">
            {devices.bySystem.map((s) => (
              <li key={s.key} className="flex items-baseline gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-slate-800">{s.label}</span>
                <span className="text-xs text-slate-400">{s.standard}</span>
                <span className="w-10 text-right font-semibold tabular-nums text-slate-900">{s.count}</span>
              </li>
            ))}
          </ul>
        </Panel>

        {/* 4 — labour */}
        <Panel
          Icon={HardHat}
          title="Labour tracking"
          note="Who performed each test, in-house or bought in"
          figure={work.hours}
          figureLabel="hours booked"
          onOpen={() => router.push('/portal/oxmaint/labour')}
          openLabel="Open labour"
          tone={totals.missingPerformer ? 'amber' : null}
        >
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge variant="secondary">{work.contractorHours} h by contractors · {work.share}%</Badge>
            <Badge variant="secondary">{money(work.cost)} booked</Badge>
            {totals.missingPerformer > 0 && (
              <Badge className="bg-amber-100 text-amber-800">
                {totals.missingPerformer} {totals.missingPerformer === 1 ? 'test' : 'tests'} with no recorded performer
              </Badge>
            )}
          </div>
          {work.latest.length === 0 ? (
            <Empty>
              No contractor visit is booked yet. Certified testing is bought in, and who performed it is the first
              thing a surveyor asks.
            </Empty>
          ) : (
            <ul className="space-y-1.5">
              {work.latest.map((e) => (
                <li key={e.recordId} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-medium text-slate-900">{e.vendor_name}</span>
                  {e.worker_name && e.worker_name !== e.vendor_name && (
                    <span className="text-slate-500">{e.worker_name}</span>
                  )}
                  <span className="text-xs text-slate-500">
                    {e.hours} h · {e.work_order_number} · {fmtDate(e.work_date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-slate-600">
            Every figure on this page is read from the records the owning screen reads — there is no second copy to
            fall out of step. The audit trail is written by the records API beside the change it describes and refused
            to everything else, which is what makes it worth showing to a surveyor: a screen that could write a line
            could also skip one.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function Panel({ Icon, title, note, figure, figureLabel, tone, onOpen, openLabel, children }) {
  const ring = tone === 'red' ? 'border-red-200' : tone === 'amber' ? 'border-amber-200' : undefined
  return (
    <Card className={ring}>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {Icon && <Icon className="h-4 w-4 text-slate-400" />}
          <span>{title}</span>
          <span className="ml-auto flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular-nums text-slate-900">{figure}</span>
            <span className="text-xs text-slate-500">{figureLabel}</span>
          </span>
        </CardTitle>
        <p className="text-sm text-slate-600">{note}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {children}
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-slate-600" onClick={onOpen}>
          {openLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  )
}

function Empty({ children }) {
  return (
    <p className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50/60 p-2.5 text-xs leading-relaxed text-slate-600">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
      <span>{children}</span>
    </p>
  )
}
