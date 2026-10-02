'use client'

// SAP Integration — the same work, in S/4HANA's words.
//
// A GSE shop that runs on S/4 does not want a second system; it wants the one
// place a technician works to post into the one place finance and stores
// already live. So the question an evaluator asks is not "do you integrate" but
// "show me the document": which order, which reservation, which movement, which
// receipt, and can I follow a part on a job back to the purchase order it
// arrived on.
//
// That is what this screen is. Every number here is a document the record
// already carries — 6,607 material documents over five years — and the flow tab
// walks one job end to end: notification, order, reservation, the 261 issues,
// and the equipment they were posted against.
//
// The last tab holds the only forward-looking figures on the page, and they are
// labelled as the plan's, not as history: how many requisitions the CMMS is
// expected to raise, and how fast a requisition should become a receipt.

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Boxes, FileText, ArrowRightLeft, Truck, Building2, Search,
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { Input } from '../ui/input'
import { GSE_ACTIVE } from '../lib/gse'
import { loadSapData, WORK_ORDERS, ASSETS, money, fmtDate } from '../lib/data'
import ModuleOff from '../components/ModuleOff'
import PagerBar, { usePaged } from '../components/ListPager'

const MOVE_LOOK = {
  101: 'bg-emerald-100 text-emerald-800',
  261: 'bg-blue-100 text-blue-800',
  701: 'bg-amber-100 text-amber-800',
  702: 'bg-amber-100 text-amber-800',
}

const nativeSelect = 'h-9 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none'

// The workbook labels its own org objects "(demo)". The objects are the point;
// the parenthesis is the spreadsheet talking about itself.
const orgName = (name) => String(name || '').replace(/\s*\(demo\)/gi, '')

function Stat({ label, value, sub, Icon }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
      </CardContent>
    </Card>
  )
}

/** One document in the chain, with the number a SAP user would quote. */
function Doc({ label, number, children, tone }) {
  return (
    <div className={`min-w-[190px] flex-1 rounded-lg border p-3 ${tone === 'muted' ? 'border-dashed border-slate-200' : 'border-slate-200 bg-white'}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900">{number || '—'}</p>
      {children && <div className="mt-1 text-xs text-slate-500">{children}</div>}
    </div>
  )
}

export default function GseSap() {
  const router = useRouter()
  const [S, setS] = useState(null)
  // Arrived from a work order's SAP card: that job's flow, already open.
  const params = useSearchParams()
  const [jobId, setJobId] = useState(params?.get('job') || '')
  const [moveType, setMoveType] = useState('all')
  const [sloc, setSloc] = useState('all')
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!GSE_ACTIVE || !loadSapData) return undefined
    let live = true
    loadSapData().then((d) => { if (live) setS(d) }).catch(() => {})
    return () => { live = false }
  }, [])

  const movements = S?.movements || []

  // Jobs whose parts were actually posted in SAP — the ones worth walking.
  const jobs = useMemo(() => {
    if (!movements.length) return []
    const posted = new Set(movements.filter((m) => m.move_type === '261').map((m) => m.reference))
    return WORK_ORDERS
      .filter((w) => w.sap_order && posted.has(w.work_order_number))
      .sort((a, b) => String(b.created_date).localeCompare(String(a.created_date)))
  }, [movements])

  const job = useMemo(() => jobs.find((w) => w.work_order_number === jobId) || jobs[0] || null, [jobs, jobId])
  const jobAsset = useMemo(() => (job ? ASSETS.find((a) => a.asset_id === job.asset_id) : null), [job])
  const jobIssues = useMemo(
    () => movements.filter((m) => m.move_type === '261' && m.reference === job?.work_order_number),
    [movements, job],
  )

  const byType = useMemo(() => {
    const out = {}
    movements.forEach((m) => {
      const g = out[m.move_type] || (out[m.move_type] = { count: 0, value: 0 })
      g.count += 1
      g.value += m.value
    })
    return out
  }, [movements])

  const slocs = useMemo(() => [...new Set(movements.map((m) => m.storage_location))].filter(Boolean).sort(), [movements])

  const shownMovements = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return movements.filter((m) => (
      (moveType === 'all' || m.move_type === moveType)
      && (sloc === 'all' || m.storage_location === sloc)
      && (!needle || `${m.id} ${m.part_number} ${m.part_name} ${m.reference} ${m.sap_po} ${m.sap_order}`.toLowerCase().includes(needle))
    ))
  }, [movements, moveType, sloc, q])

  const paged = usePaged(shownMovements, 25, `${moveType}|${sloc}|${q}`)
  const shownValue = useMemo(() => shownMovements.reduce((n, m) => n + m.value, 0), [shownMovements])

  const threads = S?.p2p || []
  const medianDays = useMemo(() => {
    const v = threads.map((t) => t.days_pr_to_gr).filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
    if (!v.length) return null
    const m = Math.floor(v.length / 2)
    return v.length % 2 ? v[m] : Math.round(((v[m - 1] + v[m]) / 2) * 10) / 10
  }, [threads])

  if (!GSE_ACTIVE || !loadSapData) return <ModuleOff module="SAP integration" />

  if (!S) {
    return (
      <div className="max-w-8xl mx-auto p-6">
        <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
      </div>
    )
  }

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">SAP Integration</h1>
        <p className="mt-1 text-slate-600">
          The maintenance record as S/4HANA holds it — plant {S.plant}, its orders, reservations, movements
          and receipts
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Stat label="Material documents" value={movements.length.toLocaleString('en-US')} sub="five years, plant CVG1" Icon={FileText} />
        <Stat
          label="261 issues to orders" value={(byType['261']?.count || 0).toLocaleString('en-US')}
          sub={`${money(byType['261']?.value || 0)} of parts onto jobs`} Icon={ArrowRightLeft}
        />
        <Stat
          label="101 receipts from POs" value={(byType['101']?.count || 0).toLocaleString('en-US')}
          sub={`${money(byType['101']?.value || 0)} received into stores`} Icon={Truck}
        />
        <Stat
          label="Count differences" value={((byType['701']?.count || 0) + (byType['702']?.count || 0)).toLocaleString('en-US')}
          sub="701 gains and 702 losses from cycle counts" Icon={Boxes}
        />
      </div>

      <Tabs defaultValue="flow">
        <TabsList className="flex-wrap">
          <TabsTrigger value="flow" className="gap-1.5"><ArrowRightLeft className="h-4 w-4" />Document flow</TabsTrigger>
          <TabsTrigger value="movements" className="gap-1.5"><FileText className="h-4 w-4" />Goods movements</TabsTrigger>
          <TabsTrigger value="p2p" className="gap-1.5"><Truck className="h-4 w-4" />Procure to pay</TabsTrigger>
          <TabsTrigger value="org" className="gap-1.5"><Building2 className="h-4 w-4" />Organisation</TabsTrigger>
        </TabsList>

        {/* ── one job, end to end ───────────────────────────────────────── */}
        <TabsContent value="flow" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-base">One job, document by document</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    {jobs.length.toLocaleString('en-US')} jobs in the live register posted their parts in SAP.
                    Pick one and follow it.
                  </p>
                </div>
                <select
                  value={job?.work_order_number || ''} onChange={(e) => setJobId(e.target.value)}
                  className={`${nativeSelect} max-w-full lg:w-80`}
                >
                  {jobs.slice(0, 200).map((w) => (
                    <option key={w.work_order_number} value={w.work_order_number}>
                      {w.work_order_number} — {w.title}
                    </option>
                  ))}
                </select>
              </div>
            </CardHeader>
            {job && (
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Doc label="Notification" number={job.sap_notification}>Reported defect</Doc>
                  <Doc label={`Order (${job.sap_order_type || 'PM'})`} number={job.sap_order}>
                    {job.sap_order_type === 'PM01' ? 'Preventive' : 'Unscheduled'} · work centre {job.sap_work_center}
                  </Doc>
                  <Doc label="Reservation" number={job.sap_reservation}>Parts demand on stores</Doc>
                  <Doc label="Goods issues (261)" number={`${jobIssues.length} document${jobIssues.length === 1 ? '' : 's'}`}>
                    {money(jobIssues.reduce((n, m) => n + m.value, 0))} issued
                  </Doc>
                  <Doc label="Settled to cost centre" number={job.sap_cost_center} tone="muted">
                    Plant {job.sap_plant}
                  </Doc>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Equipment</p>
                    <p className="mt-0.5 font-mono text-sm text-slate-900">{jobAsset?.sap_equipment || '—'}</p>
                    <p className="text-xs text-slate-500">
                      {job.asset_name} · functional location <span className="font-mono">{jobAsset?.sap_functional_location || '—'}</span>
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 lg:col-span-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">The job</p>
                    <p className="mt-0.5 text-sm text-slate-900">{job.title}</p>
                    <p className="text-xs text-slate-500">
                      {job.status} · raised {fmtDate(job.created_date)} · {job.dhl_priority || job.priority}
                    </p>
                  </div>
                </div>

                {jobIssues.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="py-2 pr-3 font-medium">Material document</th>
                          <th className="py-2 px-3 font-medium">Posted</th>
                          <th className="py-2 px-3 font-medium">Material</th>
                          <th className="py-2 px-3 font-medium text-right">Qty</th>
                          <th className="py-2 px-3 font-medium text-right">Value</th>
                          <th className="py-2 pl-3 font-medium">Store</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobIssues.map((m) => (
                          <tr key={m.id} className="border-b border-slate-100">
                            <td className="py-2 pr-3 font-mono text-xs text-slate-700">{m.id}</td>
                            <td className="py-2 px-3 whitespace-nowrap text-slate-600">{fmtDate(m.posted)}</td>
                            <td className="py-2 px-3">
                              <span className="block text-slate-900">{m.part_name}</span>
                              <span className="block font-mono text-xs text-slate-500">{m.part_number}</span>
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums">{m.quantity}</td>
                            <td className="py-2 px-3 text-right tabular-nums font-medium text-slate-900">{money(m.value)}</td>
                            <td className="py-2 pl-3 font-mono text-xs text-slate-500">{m.storage_location}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <Button
                  variant="outline" size="sm"
                  onClick={() => router.push(`/portal/oxmaint/work-orders/${encodeURIComponent(job.work_order_number)}`)}
                >
                  Open the work order
                </Button>
              </CardContent>
            )}
          </Card>
        </TabsContent>

        {/* ── the ledger ────────────────────────────────────────────────── */}
        <TabsContent value="movements" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-base">
                    Goods movements
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      {shownMovements.length.toLocaleString('en-US')} documents · {money(shownValue)}
                    </span>
                  </CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    Every movement carries the order, purchase order or count it belongs to — the trail an audit
                    follows in either direction.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={q} onChange={(e) => setQ(e.target.value)} placeholder="Document, part or reference"
                      className="h-9 w-full pl-8 sm:w-60"
                    />
                  </span>
                  <select value={moveType} onChange={(e) => setMoveType(e.target.value)} className={nativeSelect}>
                    <option value="all">All movements</option>
                    {Object.entries(S.moveTypes).map(([code, text]) => (
                      <option key={code} value={code}>{code} — {text}</option>
                    ))}
                  </select>
                  <select value={sloc} onChange={(e) => setSloc(e.target.value)} className={nativeSelect}>
                    <option value="all">All stores</option>
                    {slocs.map((x) => <option key={x} value={x}>Store {x}</option>)}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3 font-medium">Document</th>
                      <th className="py-2 px-3 font-medium">Posted</th>
                      <th className="py-2 px-3 font-medium">Movement</th>
                      <th className="py-2 px-3 font-medium">Material</th>
                      <th className="py-2 px-3 font-medium text-right">Qty</th>
                      <th className="py-2 px-3 font-medium text-right">Value</th>
                      <th className="py-2 px-3 font-medium">Store</th>
                      <th className="py-2 pl-3 font-medium">Against</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.pageItems.map((m) => (
                      <tr key={m.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3 font-mono text-xs text-slate-700">{m.id}</td>
                        <td className="py-2 px-3 whitespace-nowrap text-slate-600">{fmtDate(m.posted)}</td>
                        <td className="py-2 px-3">
                          <Badge className={MOVE_LOOK[m.move_type] || ''}>{m.move_type}</Badge>
                          <span className="ml-2 text-xs text-slate-500">{m.move_text}</span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="block text-slate-900">{m.part_name || m.part_number}</span>
                          <span className="block font-mono text-xs text-slate-500">{m.part_number}</span>
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">{m.quantity}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-medium text-slate-900">{money(m.value)}</td>
                        <td className="py-2 px-3 font-mono text-xs text-slate-500">{m.storage_location}</td>
                        <td className="py-2 pl-3">
                          <span className="block font-mono text-xs text-slate-700">{m.reference}</span>
                          <span className="block text-xs text-slate-500">
                            {m.sap_order ? `order ${m.sap_order}` : m.sap_po ? `PO ${m.sap_po}` : 'physical inventory'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PagerBar {...paged} noun="documents" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── requisition to receipt ────────────────────────────────────── */}
        <TabsContent value="p2p" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Requisition to goods receipt
                <span className="ml-2 text-sm font-normal text-slate-500">
                  {threads.length} threads · median {medianDays} days
                </span>
              </CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                A reservation on a job becomes a requisition, a release, a purchase order, an inbound delivery and a
                101 receipt. The days between the first and the last are what a part waiting on the ramp costs.
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3 font-medium">Thread</th>
                      <th className="py-2 px-3 font-medium">Raised by</th>
                      <th className="py-2 px-3 font-medium">Requisition</th>
                      <th className="py-2 px-3 font-medium">Release</th>
                      <th className="py-2 px-3 font-medium">Purchase order</th>
                      <th className="py-2 px-3 font-medium">Receipt</th>
                      <th className="py-2 pl-3 font-medium text-right">Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {threads.map((t) => (
                      <tr key={t.id} className="border-b border-slate-100 align-top">
                        <td className="py-2 pr-3">
                          <span className="block font-mono text-xs text-slate-700">{t.id}</span>
                          <span className="block text-xs text-slate-500">{t.sample_sku}</span>
                        </td>
                        <td className="py-2 px-3 text-slate-600">{t.trigger}</td>
                        <td className="py-2 px-3">
                          <span className="block font-mono text-xs text-slate-700">{t.pr}</span>
                          <span className="block text-xs text-slate-500">{fmtDate(t.pr_date)}</span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="block text-xs text-slate-600">{t.release_strategy}</span>
                          <span className="block text-xs text-slate-500">{fmtDate(t.released)}</span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="block font-mono text-xs text-slate-700">{t.sap_po}</span>
                          <span className="block text-xs text-slate-500">{t.vendor}</span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="block font-mono text-xs text-slate-700">{t.goods_receipt}</span>
                          <span className="block text-xs text-slate-500">{fmtDate(t.gr_date)} · store {t.storage_location}</span>
                        </td>
                        <td className="py-2 pl-3 text-right">
                          <span className={`tabular-nums font-semibold ${t.days_pr_to_gr > 10 ? 'text-red-700' : 'text-slate-900'}`}>
                            {t.days_pr_to_gr ?? '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {S.volumePlan?.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">What the plan expects of this flow</CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  2026 is measured from the record above. 2027–2031 are targets from the five-year plan, not documents.
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-2 pr-3 font-medium">Year</th>
                        <th className="py-2 px-3 font-medium text-right">Requisitions from the CMMS</th>
                        <th className="py-2 px-3 font-medium text-right">Purchase orders</th>
                        <th className="py-2 px-3 font-medium text-right">Receipts</th>
                        <th className="py-2 px-3 font-medium text-right">Median days</th>
                        <th className="py-2 px-3 font-medium text-right">A-class stockouts</th>
                        <th className="py-2 pl-3 font-medium text-right">Stores value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {S.volumePlan.map((y) => (
                        <tr key={y.year} className="border-b border-slate-100">
                          <td className="py-2 pr-3 font-medium text-slate-900">
                            {y.year}
                            {y.year === 2026 && <span className="ml-2 text-xs font-normal text-slate-500">measured</span>}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">{y.prs.toLocaleString('en-US')}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{y.pos.toLocaleString('en-US')}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{y.receipts.toLocaleString('en-US')}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{y.median_days}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{y.a_stockouts}</td>
                          <td className="py-2 pl-3 text-right tabular-nums">{money(y.stores_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── the org objects everything posts to ───────────────────────── */}
        <TabsContent value="org" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Organisation
                <span className="ml-2 text-sm font-normal text-slate-500">{S.org.length} objects</span>
              </CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                The objects every document on this page resolves to. Plant {S.plant} is the inventory and planning
                plant for CVG ground support.
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3 font-medium">Object</th>
                      <th className="py-2 px-3 font-medium">Value</th>
                      <th className="py-2 px-3 font-medium">Name</th>
                      <th className="py-2 pl-3 font-medium">Used on</th>
                    </tr>
                  </thead>
                  <tbody>
                    {S.org.map((o) => (
                      <tr key={`${o.object}-${o.value}`} className="border-b border-slate-100">
                        <td className="py-2 pr-3 text-slate-900">{o.object}</td>
                        <td className="py-2 px-3 font-mono text-xs font-semibold text-slate-900">{o.value}</td>
                        <td className="py-2 px-3 text-slate-600">{orgName(o.name)}</td>
                        <td className="py-2 pl-3 text-slate-500">{o.used_on}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
