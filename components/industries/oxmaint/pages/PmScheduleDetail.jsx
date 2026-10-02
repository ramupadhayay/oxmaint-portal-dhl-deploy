'use client'

// A PM schedule on its own page — the product's view, not a drawer.
//
// This portal opened a schedule in a side panel that showed eight fields and a
// button. The product gives it a page: the title as the heading with its
// badges, an action bar, and cards down a two-thirds column with the timing
// beside them. The panel could not hold the one thing a planner actually opens
// a schedule to see — what it has raised — so the panel never showed it, and a
// schedule looked like a row of settings rather than something that had been
// running for months.
//
// Editing works the way it does on a work order: the fields that can change
// become controls where they already sit, the rest stay text, and `?edit=1`
// carries the state in the URL so a reload does not lose it.

import { useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, CalendarClock, Repeat, Gauge, Wrench, User, Clock, MapPin,
  Pencil, Trash2, AlertTriangle, PauseCircle, PlayCircle, Share2,
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Input } from '../ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select'
import { useRecords, useStore } from '../lib/store'
import {
  idOf, isOverdue, generatedToday, frequencyLabel, raisedBy, usePmGenerate,
  dueState, hasMeterTrigger, usePmAssets,
} from '../lib/pmSchedule'
import RecordHistory from '../components/RecordHistory'
import {
  ASSETS, PM_SCHEDULES, WORK_ORDERS, TECHNICIANS, fmtDate, isPast, daysUntil,
} from '../lib/data'

const STATUSES = ['Active', 'Paused']
const UNITS = ['Weeks', 'Months']
// Calendar, meter, or both — the third is how fleet maintenance is actually
// written and was the one this product could not say.
const BASES = ['Time', 'Meter', 'Both']
const BASIS_LABEL = {
  Time: 'Time — triggered by the calendar',
  Meter: 'Meter — triggered by running hours',
  Both: 'Both — whichever falls first',
}
const ASSIGNEES = [...new Set([
  ...TECHNICIANS.map((t) => t.name),
  ...PM_SCHEDULES.map((p) => p.assigned_to_name),
].filter(Boolean))].sort()

/**
 * Moving a schedule to another asset moves the asset's own fields with it.
 *
 * Same rule as a work order: the code and the site belong to the asset, not to
 * the schedule. A schedule left on the old site while pointing at the new asset
 * reads fine here and is wrong on every count that groups by site.
 */
const assetFields = (a) => ({
  asset_id: a?.asset_id || '',
  asset_name: a?.asset_name || '—',
  asset_code: a?.asset_code || '',
  site_id: a?.site_id || '',
  site_name: a?.site_name || '',
})

const WO_STATUS_LOOK = {
  Open: 'bg-blue-100 text-blue-800',
  Assigned: 'bg-cyan-100 text-cyan-800',
  'In Progress': 'bg-orange-100 text-orange-800',
  'On Hold': 'bg-yellow-100 text-yellow-800',
  Completed: 'bg-green-100 text-green-800',
  Closed: 'bg-slate-100 text-slate-800',
  Cancelled: 'bg-red-100 text-red-800',
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">{label}</p>
      <div className="text-slate-900 text-sm font-medium">{children ?? '—'}</div>
    </div>
  )
}

function Empty({ icon: Icon, title, body }) {
  return (
    <div className="bg-white border border-slate-200/60 rounded-lg shadow-sm p-12 text-center">
      <Icon className="w-9 h-9 text-slate-300 mx-auto mb-3" />
      <h3 className="font-semibold text-slate-800 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-md mx-auto">{body}</p>
    </div>
  )
}

export default function PmScheduleDetail() {
  const { id } = useParams()
  const router = useRouter()
  const { update, remove, notify } = useStore()
  const params = useSearchParams()
  const generate = usePmGenerate()

  const [editing, setEditing] = useState(params?.get('edit') === '1')
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const setField = (k, v) => setDraft((d) => ({ ...d, [k]: v }))

  const merged = useRecords('pm_schedule', PM_SCHEDULES, idOf)
  const workOrders = useRecords('work_order', WORK_ORDERS, (w) => w.workorder_id || w.recordId)

  const pm = useMemo(
    () => merged.find((p) => String(idOf(p)) === String(id)) || null,
    [merged, id],
  )
  // The live register, not the seeded one. This page shows the asset's running
  // hours and judges the meter trigger against them, so reading the seed meant
  // a reading logged minutes ago on the Meters screen was invisible here.
  const assets = usePmAssets()
  const asset = useMemo(
    () => (pm ? assets.find((a) => (a.asset_id || a.recordId) === pm.asset_id) || null : null),
    [pm, assets],
  )
  const raised = useMemo(() => raisedBy(pm, workOrders), [pm, workOrders])

  const back = () => router.push('/portal/oxmaint/pm-schedules')

  if (!pm) {
    return (
      <div className="max-w-8xl mx-auto p-6 space-y-6">
        <Button variant="ghost" onClick={back} className="gap-2 -ml-2">
          <ArrowLeft className="w-4 h-4" />
          Back to PM Schedules
        </Button>
        <Empty
          icon={AlertTriangle}
          title="No schedule with that reference"
          body="It may have been deleted, or the address may be wrong. The register lists every schedule this portal holds."
        />
      </div>
    )
  }

  const due = dueState(pm, assets)
  const overdue = isOverdue(pm, assets)
  const paused = pm.status === 'Paused'
  const alreadyToday = generatedToday(pm)

  const startEdit = () => {
    setDraft({
      schedule_name: pm.schedule_name || '',
      asset_id: pm.asset_id || '',
      assigned_to_name: pm.assigned_to_name || '',
      frequency_value: pm.frequency_value ?? '',
      frequency_unit: pm.frequency_unit || 'Months',
      frequency_type: pm.frequency_type || 'Time',
      meter_interval: pm.meter_interval ?? 250,
      estimated_hours: pm.estimated_hours ?? '',
      status: pm.status || 'Active',
      next_due: (pm.next_due || '').slice(0, 10),
    })
    setEditing(true)
  }

  const closeEdit = () => {
    setEditing(false)
    setDraft(null)
    router.replace(`/portal/oxmaint/pm-schedules/${encodeURIComponent(String(id))}`)
  }

  const saveEdit = async () => {
    if (!draft) return
    const every = Number(draft.frequency_value)
    const interval = Number(draft.meter_interval)
    const hours = Number(draft.estimated_hours)
    setBusy(true)
    const saved = await update('pm_schedule', idOf(pm), {
      ...pm,
      ...draft,
      schedule_name: String(draft.schedule_name || '').trim() || pm.schedule_name,
      // A frequency of nothing is not a frequency. Anything unreadable keeps
      // what the schedule already had rather than silently becoming every
      // zero months, which would put the next due date on today, forever.
      frequency_value: Number.isFinite(every) && every > 0 ? every : pm.frequency_value,
      // Same rule as the calendar interval: an hours interval of nothing is not
      // an interval, and zero would make the schedule due the moment it saved.
      meter_interval: Number.isFinite(interval) && interval > 0 ? interval : (pm.meter_interval || 250),
      // Blank means "not estimated", which is a different thing from zero hours.
      estimated_hours: draft.estimated_hours === '' || !Number.isFinite(hours) || hours < 0
        ? null
        : hours,
      ...assetFields(ASSETS.find((a) => a.asset_id === draft.asset_id) || asset),
    })
    setBusy(false)
    if (!saved) return
    notify(`${pm.schedule_name} updated.`)
    closeEdit()
  }

  const togglePause = async () => {
    setBusy(true)
    const next = paused ? 'Active' : 'Paused'
    const saved = await update('pm_schedule', idOf(pm), { ...pm, status: next })
    setBusy(false)
    if (saved) {
      notify(paused
        ? `${pm.schedule_name} resumed — next due ${fmtDate(pm.next_due)}.`
        : `${pm.schedule_name} paused — it will raise nothing until resumed.`)
    }
  }

  const raiseNow = async () => {
    setBusy(true)
    await generate(pm)
    setBusy(false)
  }

  const del = async () => {
    if (!pm._created) return
    if (typeof window !== 'undefined'
      && !window.confirm(`Delete ${pm.schedule_name}? This cannot be undone.`)) return
    const ok = await remove('pm_schedule', idOf(pm))
    if (ok) back()
  }

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      notify('Link copied.')
    } catch { notify('The link could not be copied.', 'error') }
  }

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      {/* Action bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={back} className="gap-2 -ml-2 w-fit">
          <ArrowLeft className="w-4 h-4" />
          Back to PM Schedules
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <Button size="sm" variant="outline" onClick={closeEdit} disabled={busy}>Cancel</Button>
              <Button size="sm" className="gap-2" onClick={saveEdit} disabled={busy}>
                <Pencil className="h-4 w-4" />
                {busy ? 'Saving…' : 'Save changes'}
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" className="gap-2" onClick={share}>
                <Share2 className="h-4 w-4" />
                Share
              </Button>
              <Button size="sm" variant="outline" className="gap-2" onClick={togglePause} disabled={busy}>
                {paused ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
                {paused ? 'Resume' : 'Pause'}
              </Button>
              <Button
                size="sm" className="gap-2" onClick={raiseNow}
                disabled={busy || alreadyToday || paused}
                title={
                  paused ? 'A paused schedule raises nothing until it is resumed.'
                    : alreadyToday ? 'This schedule was already generated today.'
                      : 'Raise a Preventive work order and roll the schedule on.'
                }
              >
                <Wrench className="h-4 w-4" />
                {alreadyToday ? 'Generated today' : 'Generate work order'}
              </Button>
              <Button size="sm" variant="outline" className="gap-2" onClick={startEdit}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              {pm._created && (
                <Button size="sm" variant="destructive" className="gap-2" onClick={del}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Heading */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="max-w-xl">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">Schedule name</p>
              <Input
                value={draft?.schedule_name ?? ''}
                onChange={(e) => setField('schedule_name', e.target.value)}
                placeholder="What this schedule services, and how often"
                className="bg-white text-base font-medium"
              />
            </div>
          ) : (
            <h1 className="text-2xl font-bold text-slate-900 break-words">{pm.schedule_name}</h1>
          )}
          <p className="text-slate-600 mt-1">
            Preventive maintenance schedule · {pm.asset_name}
            {pm.asset_code ? ` (${pm.asset_code})` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={overdue ? 'bg-red-100 text-red-800' : paused ? 'bg-slate-100 text-slate-700' : 'bg-green-100 text-green-800'}>
            {overdue
              ? (due?.firstBy === 'meter' ? 'Overdue on hours'
                : due?.firstBy === 'both' ? 'Overdue on both' : 'Overdue')
              : pm.status}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            {pm.frequency_type === 'Meter' ? <Gauge className="w-3.5 h-3.5" /> : <Repeat className="w-3.5 h-3.5" />}
            {pm.frequency_type}-based
          </Badge>
        </div>
      </div>

      {editing && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-900">
          Editing <strong>{pm.schedule_name}</strong>. The name, asset, who it is on, the frequency,
          the basis, the hours estimate, the next due date and whether it is active can all be
          changed here. What it has already raised is history and is not editable — a job that was
          done cannot be un-scheduled.
        </div>
      )}

      {/* Paused schedules say so where it matters, not only in a badge. */}
      {paused && !editing && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This schedule is paused. It will not fall due and will raise nothing until it is resumed.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="w-5 h-5" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Assigned to">
                  {editing ? (
                    <Select
                      value={draft?.assigned_to_name || 'Unassigned'}
                      onValueChange={(v) => setField('assigned_to_name', v === 'Unassigned' ? '' : v)}
                    >
                      <SelectTrigger className="h-9 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="Unassigned">Unassigned</SelectItem>
                        {ASSIGNEES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (pm.assigned_to_name || 'Unassigned')}
                </Field>

                <Field label="Estimated hours">
                  {editing ? (
                    <Input
                      type="number" min="0" step="0.5"
                      value={draft?.estimated_hours ?? ''}
                      onChange={(e) => setField('estimated_hours', e.target.value)}
                      placeholder="Not estimated"
                      className="h-9 bg-white"
                    />
                  ) : (pm.estimated_hours ? `${pm.estimated_hours} h` : '—')}
                </Field>

                <Field label="Status">
                  {editing ? (
                    <Select value={draft?.status ?? 'Active'} onValueChange={(v) => setField('status', v)}>
                      <SelectTrigger className="h-9 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : pm.status}
                </Field>

                <div className="col-span-2 md:col-span-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">Asset</p>
                  {editing ? (
                    <>
                      <Select value={draft?.asset_id || ''} onValueChange={(v) => setField('asset_id', v)}>
                        <SelectTrigger className="h-9 bg-white"><SelectValue placeholder="Select an asset" /></SelectTrigger>
                        <SelectContent className="max-h-72">
                          {ASSETS.map((a) => (
                            <SelectItem key={a.asset_id} value={a.asset_id}>
                              {a.asset_name} — {a.asset_code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="mt-1.5 text-xs text-slate-500">The code and site follow the asset.</p>
                    </>
                  ) : (
                    <button
                      onClick={() => router.push(`/portal/oxmaint/assets/${encodeURIComponent(pm.asset_id)}`)}
                      className="text-sm font-medium text-primary hover:underline text-left"
                    >
                      {pm.asset_name} {pm.asset_code ? `(${pm.asset_code})` : ''}
                    </button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* The reason this is a page and not a panel. */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                Work orders raised by this schedule
                <span className="ml-auto text-sm font-normal text-slate-500">{raised.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {raised.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">
                  Nothing raised yet. Generate work order raises a Preventive job against{' '}
                  {pm.asset_name} and rolls the schedule on {frequencyLabel(pm).toLowerCase()}.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {raised.map((w) => {
                    const late = w.due_date && isPast(w.due_date)
                      && !['Completed', 'Closed', 'Cancelled'].includes(w.status)
                    return (
                      <button
                        key={w.workorder_id || w.recordId}
                        onClick={() => router.push(`/portal/oxmaint/work-orders/${encodeURIComponent(String(w.workorder_id || w.recordId))}`)}
                        className="w-full flex flex-wrap items-center gap-3 py-3 text-left hover:bg-slate-50 -mx-2 px-2 rounded"
                      >
                        <span className="font-mono text-xs text-slate-500 shrink-0">{w.work_order_number}</span>
                        <span className="min-w-0 flex-1 text-sm font-medium text-slate-900 truncate">{w.title}</span>
                        <Badge className={`shrink-0 ${WO_STATUS_LOOK[w.status] || WO_STATUS_LOOK.Open}`}>
                          {w.status}
                        </Badge>
                        <span className={`shrink-0 text-xs ${late ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                          {fmtDate(w.due_date)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Repeat className="w-5 h-5" />
                Frequency
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">Every</p>
                    <div className="flex gap-2">
                      <Input
                        type="number" min="1" step="1"
                        value={draft?.frequency_value ?? ''}
                        onChange={(e) => setField('frequency_value', e.target.value)}
                        className="h-9 bg-white w-24"
                      />
                      <Select value={draft?.frequency_unit ?? 'Months'} onValueChange={(v) => setField('frequency_unit', v)}>
                        <SelectTrigger className="h-9 bg-white flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UNITS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Field label="Basis">
                    <Select value={draft?.frequency_type ?? 'Time'} onValueChange={(v) => setField('frequency_type', v)}>
                      <SelectTrigger className="h-9 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BASES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  {['Meter', 'Both'].includes(draft?.frequency_type) && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">
                        Hours interval
                      </p>
                      <Input
                        type="number" min="1" step="50"
                        value={draft?.meter_interval ?? 250}
                        onChange={(e) => setField('meter_interval', e.target.value)}
                        className="h-9 bg-white"
                      />
                      <p className="mt-1.5 text-xs text-slate-500">
                        {draft?.frequency_type === 'Both'
                          ? 'Whichever falls first — the hours or the calendar above.'
                          : 'Counted from the meter reading at the last service.'}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Field label="Interval">{frequencyLabel(pm)}</Field>
                  <Field label="Basis">{BASIS_LABEL[pm.frequency_type] || BASIS_LABEL.Time}</Field>
                  {hasMeterTrigger(pm) && due?.byMeter && (
                    <Field label="On the meter">
                      {due.byMeter.unknown ? (
                        <span className="text-amber-700">No reading — cannot tell where this stands</span>
                      ) : (
                        <span className={due.byMeter.due ? 'text-red-600 font-semibold' : ''}>
                          {due.byMeter.hoursSince} of {due.byMeter.interval} h
                          {due.byMeter.due
                            ? ` · ${Math.abs(due.byMeter.hoursRemaining)} h past`
                            : ` · ${due.byMeter.hoursRemaining} h to go`}
                        </span>
                      )}
                    </Field>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Timing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Next due">
                {editing ? (
                  <Input
                    type="date"
                    value={draft?.next_due ?? ''}
                    onChange={(e) => setField('next_due', e.target.value)}
                    className="h-9 bg-white"
                  />
                ) : (
                  <span className={overdue ? 'text-red-600 font-semibold' : ''}>
                    {fmtDate(pm.next_due)}
                    {/* Late on the calendar, not late because something else
                        was. A schedule overdue on its meter with this date a
                        month out was reading "· 26 days late" against a date 26
                        days in the future. The meter's own lateness is stated
                        in hours, in the meter panel, where it belongs. */}
                    {due?.byTime?.due && ` · ${Math.abs(daysUntil(pm.next_due))} days late`}
                    {!overdue && !paused && daysUntil(pm.next_due) <= 7 && ' · this week'}
                  </span>
                )}
              </Field>
              {/* Last generated is not editable. It is a record of something
                  that happened, and a date somebody typed is no longer that. */}
              <Field label="Last generated">{fmtDate(pm.last_generated)}</Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Asset
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Site">{pm.site_name}</Field>
              <Field label="Type">{asset?.asset_type}</Field>
              <Field label="Criticality">{asset?.criticality}</Field>
              <Field label="Location">{asset?.functional_location_name}</Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Ownership
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Assigned to">{pm.assigned_to_name || 'Unassigned'}</Field>
              <Field label="Jobs raised">
                {raised.length === 0 ? 'None yet' : `${raised.length} to date`}
              </Field>
              <Field label="Open now">
                {raised.filter((w) => !['Completed', 'Closed', 'Cancelled'].includes(w.status)).length || 'None'}
              </Field>
            </CardContent>
          </Card>

          <RecordHistory kind="pm_schedule" recordId={String(idOf(pm))} limit={10} />
        </div>
      </div>
    </div>
  )
}
