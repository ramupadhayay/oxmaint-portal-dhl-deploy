'use client'

// RFP Coverage — where this product stands against the evaluation.
//
// An evaluator arrives with a requirements list and scores vendors against it.
// Every vendor shows a dashboard; almost none show the list. So this screen is
// the list, with the section of the product that answers each line, and a
// verdict that is allowed to say no.
//
// The verdicts are the point. A matrix of green ticks is the least believable
// document in procurement — the reader's job is to find the gap, and finding it
// themselves after being told there wasn't one costs more than the gap did. So
// "partial" and "roadmap" are stated, in the same table, at the same size, with
// the count on the summary. What that buys is that the yeses get believed.
//
// Every row links to the screen that answers it. A claim an evaluator can click
// is a different kind of claim.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ClipboardCheck, Check, Minus, Clock, ExternalLink, CalendarClock,
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { rfpScore, GSE_ACTIVE } from '../lib/gse'
import { DOMAIN, ORG, fmtDate } from '../lib/data'
import ModuleOff from '../components/ModuleOff'

const STATE = {
  yes: { label: 'Covered', cls: 'bg-emerald-100 text-emerald-800', Icon: Check },
  partial: { label: 'Partial', cls: 'bg-amber-100 text-amber-800', Icon: Minus },
  roadmap: { label: 'Roadmap', cls: 'bg-slate-100 text-slate-700', Icon: Clock },
}

export default function GseRfp() {
  const router = useRouter()
  const [filter, setFilter] = useState('all')
  const score = useMemo(() => rfpScore(), [])

  if (!GSE_ACTIVE) return <ModuleOff module="RFP coverage" />

  const ev = DOMAIN?.evaluation
  const daysToEnd = ev?.contractEnds
    ? Math.round((new Date(ev.contractEnds) - new Date()) / 86400000)
    : null

  const areas = score.areas
    .map((a) => ({ ...a, items: filter === 'all' ? a.items : a.items.filter((i) => i.state === filter) }))
    .filter((a) => a.items.length)

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">RFP Coverage</h1>
          <p className="text-slate-600 mt-1">
            {ev?.client || ORG.organization_name} — what a GSE CMMS tender asks for, and where this
            product stands on each line
          </p>
        </div>
        {daysToEnd != null && (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <CalendarClock className="w-3.5 h-3.5" />
              Incumbent contract ends
            </div>
            <div className="mt-1 text-lg font-bold text-slate-900">{fmtDate(ev.contractEnds)}</div>
            <div className="text-xs text-slate-500">
              {daysToEnd > 0 ? `${Math.round(daysToEnd / 30)} months away` : 'passed'}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Requirements listed" value={score.total} sub={`${score.areas.length} areas`} Icon={ClipboardCheck} />
        <Stat label="Covered today" value={score.yes} sub="a screen does this now" tone="green" Icon={Check} />
        <Stat label="Partial" value={score.partial} sub="does some of it" tone="amber" Icon={Minus} />
        <Stat label="Roadmap" value={score.roadmap} sub="does not do this yet" Icon={Clock} />
      </div>

      <Card>
        <CardContent className="py-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-900 tabular-nums">{score.pct}%</span>
                <span className="text-sm text-slate-500">weighted coverage</span>
              </div>
              <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="bg-emerald-500" style={{ width: `${(score.yes / score.total) * 100}%` }} />
                <div className="bg-amber-400" style={{ width: `${(score.partial / score.total) * 100}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Partial counts as half, which is how an evaluator would score it. The {score.roadmap}{' '}
                roadmap items are listed rather than omitted — a gap found after being told there
                wasn't one costs more than the gap.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {[
          { k: 'all', label: `All ${score.total}` },
          { k: 'yes', label: `Covered ${score.yes}` },
          { k: 'partial', label: `Partial ${score.partial}` },
          { k: 'roadmap', label: `Roadmap ${score.roadmap}` },
        ].map((b) => (
          <button
            key={b.k}
            onClick={() => setFilter(b.k)}
            className={`h-9 px-3 rounded-md border text-sm ${
              filter === b.k
                ? 'border-primary bg-primary/5 text-primary font-medium'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >{b.label}</button>
        ))}
      </div>

      {areas.map((a) => (
        <Card key={a.area}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {a.area}
              <span className="ml-auto text-sm font-normal text-slate-500">{a.items.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100">
              {a.items.map((i) => {
                const st = STATE[i.state] || STATE.roadmap
                const Icon = st.Icon
                return (
                  <button
                    key={i.need}
                    onClick={() => router.push(`/portal/oxmaint/${i.where}`)}
                    className="w-full flex flex-wrap items-center gap-3 py-3 text-left hover:bg-slate-50 -mx-2 px-2 rounded"
                  >
                    <Badge className={`shrink-0 gap-1 ${st.cls}`}>
                      <Icon className="w-3 h-3" />
                      {st.label}
                    </Badge>
                    <span className="min-w-0 flex-1 text-sm text-slate-900">{i.need}</span>
                    <span className="shrink-0 text-xs text-slate-500 flex items-center gap-1">
                      {i.where}
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {DOMAIN?.standards?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Standards this department answers to</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100">
              {DOMAIN.standards.map(([name, what]) => (
                <div key={name} className="py-2.5 flex flex-wrap items-baseline gap-3">
                  <span className="text-sm font-semibold text-slate-900 w-52 shrink-0">{name}</span>
                  <span className="min-w-0 flex-1 text-sm text-slate-600">{what}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Said once, at the end, where a reader who has been shown a coverage
          figure is owed the other half of it. */}
      <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
        The equipment, work orders and five years of history here come from a CVG ground support
        extract that is synthetic but operationally patterned — built from published operating scale and
        industry practice, not {ORG.organization_name}'s own records. Coverage above describes what
        this product does, assessed against the requirements a GSE tender typically sets; a formal
        response would be written against the issued requirements document.
      </p>
    </div>
  )
}

function Stat({ label, value, sub, Icon, tone }) {
  const ring = tone === 'amber' ? 'border-amber-200' : tone === 'green' ? 'border-emerald-200' : 'border-slate-200/60'
  const ink = tone === 'amber' ? 'text-amber-700' : tone === 'green' ? 'text-emerald-700' : 'text-slate-900'
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
