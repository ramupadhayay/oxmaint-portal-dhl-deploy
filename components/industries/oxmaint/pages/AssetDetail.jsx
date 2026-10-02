'use client'

// One asset, on its own page — the product's record screen.
//
// This portal opened an asset in a 500px drawer. The product gives it a page:
// a 4xl title, its number and badges across the top, and a grid of cards that
// each answer one question — what it is, what condition it is in, what has been
// done to it, what it has cost. None of that fits a panel, and the history is
// the reason anybody opens an asset in the first place.
//
// EVERY CARD IS COUNTED, NOT WRITTEN. Performance, maintenance spend and the
// inspection record are all derived from the work orders and inspections that
// actually name this asset, so a figure here can never disagree with the screen
// it came from. Where the product has a card this plant has no data for, the
// card says so rather than being filled with a plausible number — an invented
// purchase price is the one thing on an asset record nobody would check.
//
// The two things the drawer did well are kept and made more prominent: the
// status control, and the rule that an asset going down raises a breakdown job
// in the same step. Split across two screens, the second half gets forgotten.

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Cpu, Calendar, Info, Gauge, Activity, Wrench, ClipboardCheck,
  DollarSign, Radio, Sparkles, AlertTriangle, Plus, TrendingUp, Clock, Pencil,
} from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Progress } from '../ui/progress'
import { Separator } from '../ui/separator'
import { useRecords, useStore } from '../lib/store'
import { useActions } from '../lib/actions'
import RecordHistory from '../components/RecordHistory'
import { CONSEQUENCE_TONE, useRcm } from '../lib/rcm'
import {
  ASSETS, WORK_ORDERS, PM_SCHEDULES, INSPECTIONS, OPEN_STATUS,
  daysFrom, fmtDate, isPast, money,
} from '../lib/data'

const idOf = (a) => a.asset_id || a.recordId
const woIdOf = (w) => w.workorder_id || w.recordId

const STATUSES = ['Operational', 'Under Maintenance', 'Down']
const STATUS_CLASS = {
  Operational: 'bg-green-600 hover:bg-green-700 text-white',
  'Under Maintenance': 'bg-amber-500 hover:bg-amber-600 text-white',
  Down: 'bg-red-600 hover:bg-red-700 text-white',
}
const CRIT_CLASS = {
  High: 'border-red-200 bg-red-50 text-red-700',
  Medium: 'border-amber-200 bg-amber-50 text-amber-700',
  Low: 'border-slate-200 bg-slate-50 text-slate-600',
}

const healthTone = (n) => (n >= 80 ? 'text-green-600' : n >= 60 ? 'text-amber-600' : 'text-red-600')

export default function AssetDetail() {
  const { id } = useParams()
  const router = useRouter()
  const store = useStore()
  const { update, notify } = store
  const { raiseWorkOrder, suggestAssignee } = useActions()

  const [downOpen, setDownOpen] = useState(false)
  const [raiseJob, setRaiseJob] = useState(true)

  const assets = useRecords('asset', ASSETS, idOf)
  const work = useRecords('work_order', WORK_ORDERS, woIdOf)

  const asset = useMemo(
    () => assets.find((a) => String(idOf(a)) === String(id)) || null,
    [assets, id],
  )

  const mine = useMemo(() => (asset ? work.filter((w) => w.asset_id === idOf(asset)) : []), [work, asset])
  const openWork = mine.filter((w) => OPEN_STATUS.includes(w.status))
  const closed = mine.filter((w) => !OPEN_STATUS.includes(w.status))
  const schedules = useMemo(
    () => (asset ? PM_SCHEDULES.filter((p) => p.asset_id === idOf(asset)) : []),
    [asset],
  )
  const inspections = useMemo(
    () => (asset ? INSPECTIONS.filter((x) => x.asset_id === idOf(asset)) : []),
    [asset],
  )

  // Counted from the work orders that name this asset, so the money on this page
  // is the money on the Work Orders screen.
  const spend = closed.reduce((n, w) => n + (Number(w.total_cost) || 0), 0)
  const hours = closed.reduce((n, w) => n + (Number(w.actual_hours) || 0), 0)
  const downtime = closed.reduce((n, w) => n + (Number(w.downtime_hours) || 0), 0)
  const breakdowns = mine.filter((w) => w.work_order_type === 'Breakdown').length
  const failed = inspections.filter((x) => x.result === 'Fail').length
  const meanScore = inspections.length
    ? Math.round(inspections.reduce((n, x) => n + (Number(x.score) || 0), 0) / inspections.length)
    : null

  const assignee = useMemo(() => suggestAssignee(null, work), [suggestAssignee, work])

  if (!asset) {
    return (
      <div className="max-w-8xl mx-auto p-6">
        <Button variant="ghost" className="mb-4 gap-2" onClick={() => router.push('/portal/oxmaint/assets')}>
          <ArrowLeft className="h-4 w-4" />
          Back to Asset Master
        </Button>
        <Card>
          <CardContent className="p-12 text-center">
            <h3 className="font-semibold text-slate-800 mb-1">No asset with that reference</h3>
            <p className="text-sm text-slate-500">
              Nothing in the register is filed under &ldquo;{id}&rdquo;. It may belong to another site,
              or the reference may have been mistyped.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const setStatus = async (next) => {
    if (asset.status === next) return
    if (next === 'Down') { setRaiseJob(true); setDownOpen(true); return }
    await update('asset', idOf(asset), next === 'Operational'
      // Back in service means somebody has just finished on it, and the asset
      // record is the only place that date is kept.
      ? { ...asset, status: next, last_maintenance_date: daysFrom(0) }
      : { ...asset, status: next })
    notify(`${asset.asset_code} marked ${next.toLowerCase()}.`)
  }

  const raiseBreakdown = async () => {
    const wo = await raiseWorkOrder({
      title: `Breakdown — ${asset.asset_name}`,
      description: `${asset.asset_name} (${asset.asset_code}) was marked down at ${asset.functional_location_name || 'its location'}. Attend, diagnose the fault and return the asset to service.`,
      assetId: idOf(asset),
      type: 'Breakdown',
      priority: asset.criticality === 'High' ? 'Critical' : 'High',
      dueInDays: 1,
      assignedTo: assignee,
      source: 'Asset marked down',
    })
    if (wo) notify(`${wo.work_order_number} raised against ${asset.asset_code}.`)
    return wo
  }

  const markDown = async () => {
    setDownOpen(false)
    await update('asset', idOf(asset), { ...asset, status: 'Down' })
    if (raiseJob) await raiseBreakdown()
  }

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <Button variant="ghost" className="gap-2 hover:bg-indigo-50" onClick={() => router.push('/portal/oxmaint/assets')}>
        <ArrowLeft className="h-4 w-4" />
        Back to Asset Master
      </Button>

      <motion.div
        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl md:text-4xl font-bold text-indigo-900 break-words">{asset.asset_name}</h1>
          <p className="text-slate-500 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="flex items-center gap-2">
              <Cpu className="h-4 w-4 shrink-0" />
              {asset.asset_code}
            </span>
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0" />
              In service since {fmtDate(asset.purchase_date)}
            </span>
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge className={STATUS_CLASS[asset.status] || ''}>{asset.status}</Badge>
          <Badge variant="outline" className={CRIT_CLASS[asset.criticality] || ''}>
            {asset.criticality} criticality
          </Badge>
          {asset.iot_enabled && (
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">IoT connected</Badge>
          )}
          <Button
            size="sm" variant="outline" className="gap-2"
            onClick={() => router.push(`/portal/oxmaint/assets/${idOf(asset)}/edit`)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            size="sm" variant="outline" className="gap-2"
            onClick={async () => {
              const wo = await raiseWorkOrder({
                title: `Attend ${asset.asset_name}`,
                description: `Raised from the asset record for ${asset.asset_name} (${asset.asset_code}).`,
                assetId: idOf(asset),
                type: 'Corrective',
                priority: asset.criticality === 'High' ? 'High' : 'Medium',
                dueInDays: 7,
                source: 'Asset record',
              })
              if (wo) notify(`${wo.work_order_number} raised against ${asset.asset_code}.`)
            }}
          >
            <Plus className="h-4 w-4" />
            Raise work order
          </Button>
        </div>
      </motion.div>

      {/* An asset that is down with nobody asked to fix it is the gap the
          product's own AI Auditor reports, so it is said here in as many words
          rather than left to be inferred from an empty list. */}
      {asset.status === 'Down' && openWork.length === 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-red-800">This asset is down with no open work order</p>
                <p className="text-xs text-red-700 mt-0.5">Nobody has been asked to fix it.</p>
              </div>
            </div>
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white shrink-0" onClick={raiseBreakdown}>
              Raise breakdown work order
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Asset status</div>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <Button
                key={s} size="sm"
                variant={asset.status === s ? 'default' : 'outline'}
                className={asset.status === s ? STATUS_CLASS[s] : ''}
                onClick={() => setStatus(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel icon={Info} title="Basic information">
          <Row k="Type" v={asset.asset_type} />
          <Row k="Manufacturer" v={asset.manufacturer} />
          <Row k="Model" v={asset.model} />
          <Row k="Serial number" v={asset.serial_number} mono />
          <Row k="Site" v={asset.site_name} />
          <Row k="Location" v={asset.functional_location_name} last />
        </Panel>

        <Panel icon={Gauge} title="Condition">
          <div className="mb-3">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-600">Health score</span>
              <span className={`text-lg font-bold ${healthTone(asset.health_score)}`}>{asset.health_score}%</span>
            </div>
            <Progress value={asset.health_score} className="h-2" />
          </div>
          <Row k="Running hours" v={(asset.running_hours || 0).toLocaleString('en-US')} />
          <Row k="Warranty" v={isPast(asset.warranty_expiry)
            ? `Expired ${fmtDate(asset.warranty_expiry)}`
            : `Until ${fmtDate(asset.warranty_expiry)}`} />
          <Row k="Telemetry" v={asset.iot_enabled ? 'IoT sensors reporting' : 'Not instrumented'} last />
        </Panel>

        <Panel icon={Activity} title="Performance">
          <Row k="Work orders raised" v={mine.length} />
          <Row k="Breakdowns" v={breakdowns} tone={breakdowns ? 'text-red-600' : undefined} />
          <Row k="Labour booked" v={hours ? `${hours} h` : 'None recorded'} />
          <Row k="Downtime logged" v={downtime ? `${downtime} h` : 'None recorded'} last />
        </Panel>

        <Panel icon={Wrench} title="Maintenance">
          <Row k="Last maintained" v={fmtDate(asset.last_maintenance_date)} />
          <Row k="Next due" v={fmtDate(asset.next_maintenance_date)}
            tone={isPast(asset.next_maintenance_date) ? 'text-red-600' : undefined} />
          <Row k="Open work orders" v={openWork.length} tone={openWork.length ? 'text-amber-600' : undefined} />
          <Row k="PM schedules" v={schedules.length || 'None cover this asset'} last />
          {schedules.length > 0 && (
            <>
              <Separator className="my-3" />
              <div className="space-y-1.5">
                {schedules.map((p) => (
                  <div key={p.schedule_id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-slate-700">{p.schedule_name}</span>
                    <span className={`shrink-0 ${isPast(p.next_due) ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
                      {fmtDate(p.next_due)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel icon={ClipboardCheck} title="Inspections">
          {inspections.length === 0 ? (
            <p className="text-sm text-slate-400">No inspection has been carried out on this asset.</p>
          ) : (
            <>
              <Row k="Inspections" v={inspections.length} />
              <Row k="Failed" v={failed} tone={failed ? 'text-red-600' : 'text-green-600'} />
              <Row k="Mean score" v={meanScore === null ? '—' : `${meanScore}%`} />
              <Row k="Last inspected" v={fmtDate(inspections[0]?.scheduled_date)} last />
            </>
          )}
        </Panel>

        <Panel icon={DollarSign} title="Financial">
          <Row k="Maintenance spend" v={money(spend)} />
          <Row k="Across" v={`${closed.length} closed work order${closed.length === 1 ? '' : 's'}`} />
          <Row k="Mean per job" v={closed.length ? money(Math.round(spend / closed.length)) : '—'}
            last={!asset.purchase_cost && !asset.supplier} />
          {/* Shown when the register holds them, and only then. A seeded asset
              carries neither, and the note below says so rather than the card
              showing a zero — an invented purchase price is the one number on an
              asset record nobody would think to check. */}
          {Boolean(asset.purchase_cost) && <Row k="Purchase cost" v={money(Number(asset.purchase_cost))} />}
          {Boolean(asset.supplier) && <Row k="Supplier" v={asset.supplier} last />}
          {!asset.purchase_cost && (
            <>
              <Separator className="my-3" />
              <p className="text-xs leading-relaxed text-slate-400">
                Spend is counted from the work orders closed against this asset. No purchase price is
                held for it, so none is shown — it can be added by editing the asset.
              </p>
            </>
          )}
        </Panel>

        <Panel icon={Radio} title="IoT &amp; PLC">
          {asset.iot_enabled ? (
            <>
              <Row k="Sensors" v="Reporting to the edge gateway" />
              <Row k="Telemetry" v="Vibration, temperature, run state" />
              <Row k="Control" v="Read-only from this portal" last />
              <Separator className="my-3" />
              <p className="text-xs leading-relaxed text-slate-400">
                This asset is instrumented. Live values are read on the Chiller AI and Digital Twin
                screens; this record shows only that the link is configured.
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-400">
              This asset carries no sensors. Its condition is known from inspections and from what
              technicians record on a work order, not from telemetry.
            </p>
          )}
        </Panel>

        <Panel icon={Sparkles} title="What the record says">
          <ul className="space-y-2 text-sm text-slate-600">
            {readAsset(asset, { openWork, breakdowns, failed, schedules, downtime }).map((line) => (
              <li key={line} className="flex gap-2">
                <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
                <span className="leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-indigo-600" />
            Open work orders
            <span className="text-sm font-normal text-slate-500">{openWork.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {openWork.length === 0
            ? <p className="text-sm text-slate-400">Nothing open against this asset.</p>
            : openWork.map((w) => <WorkRow key={woIdOf(w)} wo={w} onOpen={() => router.push(`/portal/oxmaint/work-orders/${woIdOf(w)}`)} />)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Work order history
            <span className="ml-2 text-sm font-normal text-slate-500">{closed.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {closed.length === 0
            ? <p className="text-sm text-slate-400">No closed work orders on this asset.</p>
            : closed.slice(0, 10).map((w) => <WorkRow key={woIdOf(w)} wo={w} onOpen={() => router.push(`/portal/oxmaint/work-orders/${woIdOf(w)}`)} />)}
        </CardContent>
      </Card>

      {/* How this class of machine fails, on the page of the machine itself.
          The analysis is written per equipment type, so it belongs here as much
          as on the reliability screen: the person looking at a down asset is the
          person who wants to know what it does next. */}
      <AssetFailureModes asset={asset} onOpenAnalysis={() => router.push('/portal/oxmaint/rcm-reliability')} />

      {/* The asset's own edits and every job, inspection, document and labour
          entry that names it — an asset's history is mostly other records
          happening to it. */}
      <RecordHistory
        kind="asset" recordId={String(idOf(asset))} assetId={String(idOf(asset))}
        title="Audit trail" showReference
      />

      {/* Marking an asset down and raising the job are one decision, so they are
          one step. Split across two screens, the second half gets forgotten. */}
      {downOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setDownOpen(false)}>
          <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Mark asset down
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                {asset.asset_code} at {asset.functional_location_name || asset.site_name} will be shown as
                down on every screen and counted against plant availability.
              </p>
              <label className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${raiseJob ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}>
                <input
                  type="checkbox" checked={raiseJob} onChange={(e) => setRaiseJob(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-red-600 cursor-pointer"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">Raise a breakdown work order</span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-600">
                    {asset.criticality === 'High' ? 'Critical' : 'High'} priority
                    {asset.criticality === 'High' ? ' — this asset is high criticality' : ''}, due tomorrow,
                    {assignee ? ` assigned to ${assignee}` : ' unassigned'}.
                  </span>
                </span>
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDownOpen(false)}>Cancel</Button>
                <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={markDown}>
                  {raiseJob ? 'Mark down & raise job' : 'Mark down'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

/**
 * What this asset's own record says about it.
 *
 * Every line is a fact already on the page, said in a sentence — not a
 * prediction. A card headed "AI insights" that guesses at a failure date is the
 * part of a demo somebody repeats in a meeting as though it were a measurement.
 */
function readAsset(a, { openWork, breakdowns, failed, schedules, downtime }) {
  const out = []
  if (a.health_score < 60) out.push(`Health is ${a.health_score}%, the band where this plant schedules a condition survey.`)
  else if (a.health_score < 80) out.push(`Health is ${a.health_score}% — worth watching, not yet acting on.`)
  else out.push(`Health is ${a.health_score}%, which is normal for this class of asset.`)

  if (breakdowns >= 3) out.push(`${breakdowns} breakdowns have been raised against it — a repeat offender rather than a one-off.`)
  else if (breakdowns) out.push(`${breakdowns} breakdown${breakdowns === 1 ? ' has' : 's have'} been raised against it.`)

  if (!schedules.length) out.push('No preventive schedule covers it, so every job on it so far has been reactive.')
  if (isPast(a.next_maintenance_date)) out.push(`Its next service was due ${fmtDate(a.next_maintenance_date)} and has not been done.`)
  if (failed) out.push(`${failed} inspection${failed === 1 ? '' : 's'} failed on it.`)
  if (openWork.length) out.push(`${openWork.length} work order${openWork.length === 1 ? ' is' : 's are'} open on it now.`)
  if (downtime > 8) out.push(`${downtime} hours of downtime have been logged against it.`)
  if (a.criticality === 'High' && !schedules.length) out.push('It is high criticality with no PM cover, which is the combination worth fixing first.')
  return out
}

function WorkRow({ wo, onOpen }) {
  return (
    <button
      type="button" onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left cursor-pointer hover:border-indigo-200 hover:bg-slate-50 transition-colors"
    >
      <span className="shrink-0 font-mono text-xs font-semibold text-indigo-700">{wo.work_order_number}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-slate-800" title={wo.title}>{wo.title}</span>
      <span className={`shrink-0 text-xs ${isPast(wo.due_date) && OPEN_STATUS.includes(wo.status) ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
        {fmtDate(wo.due_date)}
      </span>
      <Badge variant="secondary" className="shrink-0 text-[10px]">{wo.status}</Badge>
    </button>
  )
}

function Panel({ icon: Icon, title, children }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-indigo-600" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

/**
 * The reliability analysis for this machine's type.
 *
 * Renders nothing where this kind of asset is not one of the critical types the
 * analysis covers — an empty card headed "Reliability" on a fire extinguisher
 * would teach a reader that the analysis is patchy rather than that this asset
 * is not in it. That one test is the whole guard: it used to also require the
 * pack to carry its own analysis, which meant a machine registered from the
 * industry library — the only kind of tyre machine a chiller portal can hold —
 * had its modes on the analysis screen and nothing on its own page.
 */
function AssetFailureModes({ asset, onOpenAnalysis }) {
  const { rows } = useRcm()
  const mine = rows.filter((r) => r.kind === asset.asset_type)
  if (mine.length === 0) return null

  const hidden = mine.filter((r) => r.consequence === 'Hidden').length
  const hours = Math.round(mine.reduce((n, r) => n + (r.unitHours || 0), 0))

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          How this equipment fails
          <Badge variant="secondary">{mine.length} failure modes</Badge>
          {hidden > 0 && <Badge className="bg-violet-100 text-violet-800">{hidden} hidden</Badge>}
          <span className="ml-auto text-sm font-normal text-slate-500">
            {hours} h a year at risk on this unit · modelled
          </span>
        </CardTitle>
        <p className="text-sm text-slate-600">
          From the reliability analysis for {asset.asset_type}. Risk first.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {mine.slice(0, 6).map((m) => (
          <div key={m.id} className="rounded-lg border border-slate-200 p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{m.mode}</span>
              <Badge className={
                m.consequence === 'Safety' ? 'bg-red-100 text-red-800'
                  : m.consequence === 'Hidden' ? 'bg-violet-100 text-violet-800'
                    : m.consequence === 'Environment' ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
              }>{m.consequence}</Badge>
              <span className="ml-auto text-xs font-semibold" style={{ color: m.rpn > 200 ? '#b91c1c' : m.rpn > 100 ? '#b45309' : '#047857' }}>
                RPN {m.rpn}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">{m.fn}</p>
            <p className="mt-1 text-xs text-slate-700">
              <b>{m.strategy}:</b> {m.task} · {m.interval}
              {m.signal ? ` · watched on ${m.signal}` : ''}
            </p>
          </div>
        ))}
        {mine.length > 6 && (
          <p className="text-xs text-slate-500">and {mine.length - 6} more for this equipment type.</p>
        )}
        <Button variant="outline" size="sm" className="mt-1" onClick={onOpenAnalysis}>
          Open the reliability analysis
        </Button>
      </CardContent>
    </Card>
  )
}

function Row({ k, v, tone, mono, last }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 ${last ? '' : 'border-b border-slate-100'}`}>
      <span className="shrink-0 text-xs text-slate-500">{k}</span>
      <span className={`min-w-0 truncate text-sm font-medium ${mono ? 'font-mono text-xs' : ''} ${tone || 'text-slate-800'}`} title={String(v)}>
        {v}
      </span>
    </div>
  )
}
