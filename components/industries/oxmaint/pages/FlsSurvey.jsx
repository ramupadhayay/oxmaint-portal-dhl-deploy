'use client'

// Survey Readiness — could every record be produced if a surveyor asked today.
//
// Organised the way a Joint Commission survey is: by standard. Under each, the
// tests whose records answer it, and for each test the three things a surveyor
// asks to see — that it was done on time, the report or certificate that proves
// it, and who did it. A test is ready only when all three are there.
//
// The gaps are written as sentences rather than icons, because the list is what
// a facilities director works through the week before a survey, and "No
// certificate in the document register" is an instruction where a red dot is
// only a colour.

import { useRouter } from 'next/navigation'
import {
  ShieldCheck, ShieldAlert, Check, X, ClipboardList, FileText, HardHat, Footprints,
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { useFls, frequencyLabel, FLS_ACTIVE } from '../lib/fls'
import { useImpairments, usePfis } from '../lib/ilsm'
import { ORG } from '../lib/data'
import ModuleOff from '../components/ModuleOff'

export default function FlsSurvey() {
  const router = useRouter()
  const { elements, tests, totals } = useFls()
  // The other two questions a surveyor asks in the same conversation: what is
  // out of service right now, and what does the hospital say is wrong with its
  // own building. Summarised here and owned by their own screens.
  const impairments = useImpairments()
  const soc = usePfis()

  if (!FLS_ACTIVE) return <ModuleOff module="Survey readiness" />

  const gaps = tests.filter((t) => !t.ready)

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Survey Readiness</h1>
          <p className="text-slate-600 mt-1">
            Whether {ORG.organization_name} could produce every life safety record a surveyor asks for today
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => router.push('/portal/oxmaint/fls-compliance')}>
            <ClipboardList className="h-4 w-4" />
            Testing &amp; inspection
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => router.push('/portal/oxmaint/fls-ilsm')}>
            <ShieldAlert className="h-4 w-4" />
            Impairments &amp; ILSM
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => router.push('/portal/oxmaint/fls-soc')}>
            <FileText className="h-4 w-4" />
            Statement of Conditions
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => router.push('/portal/oxmaint/fls-ilsm')}
          className={`rounded-lg border bg-white p-4 text-left shadow-sm transition-colors hover:bg-slate-50 ${
            impairments.totals.watchDue ? 'border-red-200' : 'border-slate-200/60'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            <ShieldAlert className="h-3.5 w-3.5" />
            Out of service now
          </div>
          <p className="mt-1.5 text-sm text-slate-900">
            <span className="text-2xl font-bold tabular-nums">{impairments.totals.open}</span>
            <span className="text-slate-500"> {impairments.totals.open === 1 ? 'impairment' : 'impairments'} open</span>
          </p>
          <p className={`mt-1 inline-flex items-center gap-1 text-xs ${impairments.totals.watchDue ? 'font-semibold text-red-700' : 'text-slate-500'}`}>
            <Footprints className="h-3.5 w-3.5" />
            {impairments.totals.watchDue
              ? `${impairments.totals.watchDue} fire ${impairments.totals.watchDue === 1 ? 'watch' : 'watches'} not signed inside the hour`
              : 'Every fire watch signed inside its interval'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => router.push('/portal/oxmaint/fls-soc')}
          className={`rounded-lg border bg-white p-4 text-left shadow-sm transition-colors hover:bg-slate-50 ${
            soc.totals.candidates || soc.totals.overdue ? 'border-red-200' : 'border-slate-200/60'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            <FileText className="h-3.5 w-3.5" />
            Statement of Conditions
          </div>
          <p className="mt-1.5 text-sm text-slate-900">
            <span className="text-2xl font-bold tabular-nums">{soc.totals.open}</span>
            <span className="text-slate-500"> open, {soc.totals.overdue} past target</span>
          </p>
          <p className={`mt-1 text-xs ${soc.totals.candidates ? 'font-semibold text-red-700' : 'text-slate-500'}`}>
            {soc.totals.candidates
              ? `${soc.totals.candidates} proven by testing and not listed`
              : 'Everything the testing programme found is listed'}
          </p>
        </button>
      </div>

      <Card>
        <CardContent className="py-5">
          <div className="flex flex-wrap items-center gap-6">
            <div className="min-w-[180px]">
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-bold tabular-nums ${totals.readiness >= 90 ? 'text-emerald-700' : totals.readiness >= 70 ? 'text-amber-700' : 'text-red-700'}`}>
                  {totals.readiness}%
                </span>
                <span className="text-sm text-slate-500">ready</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{totals.ready} of {totals.tests} tests with a complete record</p>
            </div>
            <div className="min-w-0 flex-1">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full ${totals.readiness >= 90 ? 'bg-emerald-500' : totals.readiness >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${totals.readiness}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-slate-600 max-w-3xl">
                The finding a hospital fears is rarely a failed system. It is the record that cannot be
                produced — the fire door inspection nobody can find, the load test that was run and never
                written down. A test counts as ready here only when it is inside its interval, its evidence
                is on record — the test log for routine in-house tests, the report or certificate in the
                document register for work that is bought in — and who performed it is known.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {elements.map((el) => (
        <Card key={el.key} className={el.pct < 100 ? 'border-amber-200' : undefined}>
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5" />
              <span className="font-mono text-sm text-slate-600">{el.standard}</span>
              <span>{el.title}</span>
              <Badge className={`ml-auto ${el.pct === 100 ? 'bg-emerald-100 text-emerald-800' : el.pct >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                {el.ready} of {el.total} ready
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3 font-medium">Test</th>
                    <th className="py-2 px-3 font-medium text-center"><span className="inline-flex items-center gap-1"><ClipboardList className="h-3.5 w-3.5" />On time</span></th>
                    <th className="py-2 px-3 font-medium text-center"><span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" />Evidence</span></th>
                    <th className="py-2 px-3 font-medium text-center"><span className="inline-flex items-center gap-1"><HardHat className="h-3.5 w-3.5" />Performed by</span></th>
                    <th className="py-2 pl-3 font-medium">What is missing</th>
                  </tr>
                </thead>
                <tbody>
                  {el.tests.map((t) => (
                    <tr key={t.key} className="border-b border-slate-100 align-top">
                      <td className="py-2.5 pr-3">
                        <span className="block font-medium text-slate-900">{t.label}</span>
                        <span className="block text-xs text-slate-500">{t.standard} · {frequencyLabel(t.every)}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center"><Mark ok={t.state !== 'Overdue'} /></td>
                      <td className="py-2.5 px-3 text-center"><Mark ok={t.docCurrent} /></td>
                      <td className="py-2.5 px-3 text-center"><Mark ok={Boolean(t.performer)} /></td>
                      <td className="py-2.5 pl-3">
                        {t.ready
                          ? <span className="text-emerald-700">Complete</span>
                          : (
                            <ul className="space-y-0.5 text-slate-700">
                              {t.gaps.map((g) => <li key={g}>{g}</li>)}
                            </ul>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      {gaps.length > 0 && (
        <p className="text-sm text-slate-600">
          {gaps.length} {gaps.length === 1 ? 'test needs' : 'tests need'} attention. Each closes the same way:
          upload the report or certificate in Documents, book the contractor&rsquo;s or technician&rsquo;s time on
          the work order, and complete the job — the line updates as soon as the record exists.
        </p>
      )}
    </div>
  )
}

function Mark({ ok }) {
  return ok
    ? <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="Present" />
    : <X className="mx-auto h-4 w-4 text-red-600" aria-label="Missing" />
}
