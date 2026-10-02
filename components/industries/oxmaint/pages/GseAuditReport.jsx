'use client'

// Airline audit pack — last quarter or last six months.

import { useState } from 'react'
import { FileText, Download, Calendar, Shield } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { GSE_ACTIVE } from '../lib/gse'
import { VOICE_INSIGHTS, DATASET_META } from '../lib/data'
import ModuleOff from '../components/ModuleOff'
import { apiUrl } from '@/lib/apiPath'

export default function GseAuditReport() {
  const [period, setPeriod] = useState('quarter')
  const pdfHref = apiUrl(`/api/oxmaint/audit-report.pdf?period=${period}`)
  const jsonHref = apiUrl(`/api/oxmaint/audit-report?period=${period}`)
  const techs = VOICE_INSIGHTS?.workmanship?.technicians || []
  const spares = VOICE_INSIGHTS?.spares
  const vol = DATASET_META?.voiceVolume
  const copy = period === '6m'
    ? 'Last six months: the current-month voice projection plus historic jobs in the last 180 days.'
    : 'Last quarter: this week’s voice projection plus historic jobs in the last 90 days.'

  if (!GSE_ACTIVE) return <ModuleOff module="Airline audit report" />

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Oxmaint AI · airline pack</p>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">Airline audit report</h1>
        <p className="text-slate-600 mt-2 max-w-2xl">
          A dated PDF an airline can file: PM on-time, overdue PMs, asset health, work-order chronology,
          PR–PO–GR highlights, workmanship, and the functional-location snapshot.
          Synthetic Oxmaint AI projection mirrored to SAP shapes — not live airline or production SAP data.
        </p>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate pack
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant={period === 'quarter' ? 'default' : 'outline'} onClick={() => setPeriod('quarter')}>
              Last quarter
            </Button>
            <Button variant={period === '6m' ? 'default' : 'outline'} onClick={() => setPeriod('6m')}>
              Last 6 months
            </Button>
          </div>
          <p className="text-sm text-slate-600">{copy}</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={pdfHref}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={jsonHref}>JSON summary</a>
            </Button>
          </div>
          <p className="text-xs text-slate-500 font-mono break-all">{pdfHref}</p>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-3 gap-3">
        <Mini icon={Calendar} label="Voice week / month" value={`${vol?.weeklyTarget || 400} / ${vol?.monthlyTarget || 1600}`} />
        <Mini icon={Shield} label="Workmanship peers" value={techs.length || '—'} />
        <Mini icon={FileText} label="Spare variants" value={spares?.variants?.length || '—'} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What the PDF includes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <p>1. Honesty and scope — Oxmaint AI branding, dated, not live SAP.</p>
          <p>2. PM compliance (on-time %) and overdue schedules.</p>
          <p>3. Asset health summary by equipment type.</p>
          <p>4. Work-order chronology for the selected period.</p>
          <p>5. Parts / reservation → PR → PO → GR highlights.</p>
          <p>6. Workmanship and rework by technician.</p>
          <p>7. Spare-variant best-fit and watch notes.</p>
          <p>8. Functional location / hierarchy snapshot (e.g. CVG-PWR-0035).</p>
          <div className="pt-2 flex flex-wrap gap-2">
            <Badge variant="outline">Oxmaint AI</Badge>
            <Badge variant="outline">Page numbers</Badge>
            <Badge variant="outline">Table of contents</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Mini({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums text-slate-900">{value}</div>
    </div>
  )
}
