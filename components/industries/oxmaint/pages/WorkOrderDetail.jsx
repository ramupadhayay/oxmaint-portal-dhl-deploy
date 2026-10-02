'use client'

// A work order on its own page — the product's detail view, not a drawer.
//
// This portal used to open a work order in a 500px side panel. The product gives
// it a page: a back link, an action bar, the number as the heading with its
// badges, a status control that only offers the moves the lifecycle allows, the
// description at full width, a four-column summary, and nine tabs beneath. None
// of that fits in a panel, and squeezing it in was the single clearest way this
// portal announced it was not the product.
//
// The tabs that this portal has no data behind — comments, attachments, child
// work orders — are present and say so, because that is what they do in the
// product when a work order has none. Removing them would change the shape of
// the screen to hide an absence the product shows plainly.

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, Play, Pause, CheckCircle, XCircle, Clock, Wrench, User, Calendar,
  DollarSign, MapPin, Share2, Pencil, Trash2, FileText, Package, MessageSquare,
  Paperclip, GitBranch, Gauge, ShieldCheck, AlertTriangle, History, Plus, Boxes,
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select'
import { useRecords, useStore } from '../lib/store'
import { attachmentsByWorkOrder, ATTACHMENT_KIND } from '../lib/attachments'
import { attachmentUrl, downloadUrl, prettySize } from '../lib/fileEvidence'
import { workOrderPdf } from '../lib/workOrderPdf'
import WorkOrderExecution from './WorkOrderExecution'
import RecordHistory from '../components/RecordHistory'
import IssueKit from '../components/IssueKit'
import WarrantyOnJob from '../components/WarrantyOnJob'
import {
  useLabourEntries, useLogLabour, WORKER_TYPES, TECHNICIAN_NAMES, VENDOR_NAMES,
  inHouseRate, contractorRate,
} from '../lib/labour'
import { ASSETS, ORG, USER, WORK_ORDERS, fmtDate, money, isPast, loadWorkOrderDetail } from '../lib/data'

// ── editing happens here ──────────────────────────────────────────────────
//
// Edit used to be a 560px modal raised over the list's slide-over, and this
// page's own Edit button pushed back to the list — which left the reader on the
// screen they had just come from and looked like the button had failed.
//
// The product edits a work order on the work order: /maintenance/work-orders/
// edit/<id> is its own route beside view/<id>. So Edit from anywhere — the row
// menu, this page's action bar — lands here, and the change happens on the
// record itself: the three fields that can change become controls where they
// already sit, and the rest stay as text, which is itself the answer to "what
// can I edit here".
//
// Not a dialog, which greys out the asset, the schedule and the cost a change
// is weighed against. Not a side panel either, which puts a field next to its
// own value and asks the reader to look twice.
//
// `?edit=1` carries it, so the state is in the URL and a reader who reloads is
// still editing.

const idOf = (w) => w.workorder_id || w.recordId

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low']
const WO_TYPES = ['Corrective', 'Preventive', 'Inspection', 'Breakdown']

/**
 * Moving a work order to another asset moves five other fields with it.
 *
 * The code, the site and the location are the asset's, not the job's — a job
 * left on the old site while pointing at the new asset is the kind of row that
 * reads fine on this page and is wrong on every report that groups by site.
 * They are derived here rather than offered as fields, because there is exactly
 * one right answer and asking for it invites a different one.
 */
const assetFields = (a) => ({
  asset_id: a?.asset_id || '',
  asset_name: a?.asset_name || '—',
  asset_code: a?.asset_code || '',
  site_id: a?.site_id || '',
  site_name: a?.site_name || '',
  location_name: a?.functional_location_name || '',
})

// Who a job can be put on, taken from who already holds one. A free-text box
// here is how a work order ends up assigned to a name that is on nobody's
// roster.
const ASSIGNEES = [...new Set(WORK_ORDERS.map((w) => w.assigned_to_name).filter(Boolean))].sort()

const STATUS_LOOK = {
  Open: { cls: 'bg-blue-100 text-blue-800', Icon: Wrench },
  Assigned: { cls: 'bg-cyan-100 text-cyan-800', Icon: User },
  'In Progress': { cls: 'bg-orange-100 text-orange-800', Icon: Clock },
  'On Hold': { cls: 'bg-yellow-100 text-yellow-800', Icon: Pause },
  Completed: { cls: 'bg-green-100 text-green-800', Icon: CheckCircle },
  Closed: { cls: 'bg-slate-100 text-slate-800', Icon: CheckCircle },
  Cancelled: { cls: 'bg-red-100 text-red-800', Icon: XCircle },
}
const PRIORITY_LOOK = {
  Low: 'bg-green-100 text-green-800',
  Medium: 'bg-blue-100 text-blue-800',
  High: 'bg-orange-100 text-orange-800',
  Critical: 'bg-red-100 text-red-800',
}

// What each status is allowed to become. The dropdown offers exactly this and
// nothing else, so a work order cannot be walked into a state the lifecycle does
// not have — which a free-text status field allows and a planner then has to
// unpick.
const FLOW = {
  Open: ['In Progress', 'On Hold', 'Cancelled'],
  Assigned: ['In Progress', 'On Hold', 'Cancelled'],
  'In Progress': ['On Hold', 'Completed', 'Cancelled'],
  'On Hold': ['In Progress', 'Cancelled'],
  Completed: ['In Progress', 'Closed'],
  Closed: [],
  Cancelled: [],
}

const TABS = [
  { id: 'overview', label: 'Overview', Icon: FileText },
  { id: 'asset-info', label: 'Asset Info', Icon: Wrench },
  { id: 'tasks', label: 'Tasks', Icon: CheckCircle },
  { id: 'comments', label: 'Comments', Icon: MessageSquare },
  { id: 'attachments', label: 'Attachments', Icon: Paperclip },
  { id: 'time', label: 'Time', Icon: Clock },
  { id: 'materials', label: 'Materials', Icon: Package },
  { id: 'costs', label: 'Costs', Icon: DollarSign },
  { id: 'children', label: 'Children', Icon: GitBranch },
  { id: 'history', label: 'History', Icon: History },
]

// A moment on the maintenance record, as the plant floor wrote it: the day, and
// the clock time to the minute.
const fmtStamp = (iso) => (iso ? `${fmtDate(iso)} ${new Date(iso).toISOString().slice(11, 16)}` : '—')

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">{label}</p>
      <div className="text-slate-900 text-sm font-medium">{children ?? '—'}</div>
    </div>
  )
}

// A work order on the other end of a link. Openable when it is in the live
// register; named with its date otherwise, because a job from three years ago is
// still the answer to "what did this come back from".
function LinkedJob({ job, label, onOpen }) {
  const body = (
    <>
      <span className="font-mono text-xs text-slate-500 shrink-0">{job.id}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{job.title}</span>
      {label && <Badge className="shrink-0 bg-amber-100 text-amber-800">{label}</Badge>}
      <span className="shrink-0 text-xs tabular-nums text-slate-500">{fmtDate(job.created)}</span>
      <Badge variant="outline" className="shrink-0">{job.dhl_status}</Badge>
    </>
  )
  return job.in_register ? (
    <button type="button" onClick={() => onOpen(job.id)}
      className="flex w-full flex-wrap items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-left hover:bg-slate-50">
      {body}
    </button>
  ) : (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-slate-200 px-3 py-2">
      {body}
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

export default function WorkOrderDetail() {
  const { id } = useParams()
  const router = useRouter()
  const store = useStore()
  const { update, remove, notify } = store
  const params = useSearchParams()
  const [editing, setEditing] = useState(params?.get('edit') === '1')

  // The draft. Seeded when editing opens rather than in an effect, so the
  // controls carry this record's values on the render they first appear —
  // an effect does it one render later, which is long enough to see a blank.
  const [draft, setDraft] = useState(null)
  const setField = (k, v) => setDraft((d) => ({ ...d, [k]: v }))
  // Metadata only — the payloads are projected off the bulk load — so counting
  // and listing the files costs nothing until one is opened.
  const attachments = useMemo(
    () => attachmentsByWorkOrder(store.records?.[ATTACHMENT_KIND]).get(String(id)) || [],
    [store.records, id],
  )
  const merged = useRecords('work_order', WORK_ORDERS, idOf)
  const labour = useLabourEntries(String(id))
  const logLabour = useLogLabour()
  // The time-entry form on the Time tab, or null while it is closed.
  const [labourForm, setLabourForm] = useState(null)

  // The maintenance record behind this job — labour lines, parts issued, notes,
  // out-of-service entries and come-back links — for a pack whose dataset
  // carries one. Its own chunk, loaded when the page opens, so the registers
  // never download it. Null for a generated pack, and the tabs say so as before.
  const [detail, setDetail] = useState(null)
  useEffect(() => {
    if (!loadWorkOrderDetail) return undefined
    let live = true
    setDetail(null)
    loadWorkOrderDetail(String(id)).then((d) => { if (live) setDetail(d) }).catch(() => {})
    return () => { live = false }
  }, [id])

  const [tab, setTab] = useState('overview')
  const [executing, setExecuting] = useState(false)
  const [busy, setBusy] = useState(false)

  const wo = useMemo(() => merged.find((w) => String(idOf(w)) === String(id)) || null, [merged, id])
  const asset = useMemo(() => (wo ? ASSETS.find((a) => a.asset_id === wo.asset_id) || null : null), [wo])

  const back = () => router.push('/portal/oxmaint/work-orders')

  if (!wo) {
    return (
      <div className="max-w-8xl mx-auto p-6 space-y-6">
        <Button variant="ghost" onClick={back} className="gap-2 -ml-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Work Orders
        </Button>
        <Empty
          icon={AlertTriangle}
          title="No work order with that reference"
          body="It may have been deleted, or the address may be wrong. The register lists everything this portal holds."
        />
      </div>
    )
  }

  const status = wo.status || 'Open'
  const look = STATUS_LOOK[status] || STATUS_LOOK.Open
  const StatusIcon = look.Icon
  const overdue = wo.due_date && isPast(wo.due_date)
    && !['Completed', 'Closed', 'Cancelled'].includes(status)

  /**
   * Move the job to another status.
   *
   * Takes the same three arguments as the register's handler, because the
   * execution screen calls both. This one used to take one, and was handed to
   * that screen as `(next) => applyStatus(next)` — so completing a job from its
   * own page threw away the minutes the technician had just logged.
   *
   * Time the execution screen books arrives as `actual_hours`, but it is an
   * amount worked, not a new total. It is booked as a labour entry, which moves
   * the job's hours with it, and kept out of the status patch so the two writes
   * cannot overwrite each other.
   */
  const applyStatus = async (next, label, extra = {}) => {
    if (!next || next === status || busy) return null
    setBusy(true)
    const { actual_hours: worked, ...rest } = extra || {}
    if (next === 'Completed' && Number(worked) > 0) {
      await logLabour({
        wo, workOrderRecordId: idOf(wo), workerType: 'In-house',
        workerName: wo.assigned_to_name || USER.name, hours: worked, silent: true,
      })
    }
    const patch = { status: next, ...rest }
    if (next === 'In Progress' && !wo.started_date) patch.started_date = new Date().toISOString().slice(0, 10)
    if (next === 'Completed') patch.completed_date = new Date().toISOString().slice(0, 10)
    if (next === 'In Progress' && status === 'Completed') patch.completed_date = null
    const saved = await update('work_order', idOf(wo), patch)
    setBusy(false)
    if (saved && label !== null) notify(`${wo.work_order_number} — ${next.toLowerCase()}.`)
    return saved
  }

  const today = () => new Date().toISOString().slice(0, 10)

  const openLabourForm = () => setLabourForm({
    workerType: 'In-house',
    workerName: wo.assigned_to_name || '',
    vendorName: '',
    contractorTech: '',
    hours: '',
    rate: '',
    workDate: today(),
    note: '',
  })

  const setLabour = (k, v) => setLabourForm((f) => ({ ...f, [k]: v }))

  const saveLabour = async () => {
    const f = labourForm
    if (!f) return
    const contractor = f.workerType === 'Contractor'
    setBusy(true)
    const entry = await logLabour({
      wo,
      workOrderRecordId: idOf(wo),
      workerType: f.workerType,
      workerName: contractor ? f.contractorTech : f.workerName,
      vendorName: f.vendorName,
      hours: f.hours,
      rate: f.rate === '' ? undefined : Number(f.rate),
      workDate: f.workDate,
      note: f.note,
    })
    setBusy(false)
    if (entry) setLabourForm(null)
  }

  const startEdit = () => {
    setDraft({
      title: wo.title || '',
      description: wo.description || '',
      priority: wo.priority || 'Medium',
      work_order_type: wo.work_order_type || 'Corrective',
      assigned_to_name: wo.assigned_to_name || '',
      // Dates go into the control as yyyy-mm-dd and come back the same, which
      // is what the record stores. Formatting only happens on the way to a
      // reader.
      due_date: (wo.due_date || '').slice(0, 10),
      estimated_hours: wo.estimated_hours ?? '',
      asset_id: wo.asset_id || '',
    })
    setEditing(true)
    setTab('overview')
  }

  // The flag leaves the URL when the form does, so a reload does not put the
  // reader back into a change they have already finished with.
  const closeEdit = () => {
    setEditing(false)
    setDraft(null)
    router.replace(`/portal/oxmaint/work-orders/${encodeURIComponent(String(id))}`)
  }

  const saveEdit = async () => {
    if (!draft) return
    const hours = Number(draft.estimated_hours)
    setBusy(true)
    const saved = await update('work_order', idOf(wo), {
      ...wo,
      ...draft,
      title: String(draft.title || '').trim() || wo.title,
      description: String(draft.description || '').trim(),
      // Blank means "not estimated", which is a different thing from zero
      // hours and has to survive as null rather than becoming 0 h on the card.
      estimated_hours: draft.estimated_hours === '' || !Number.isFinite(hours) || hours < 0
        ? null
        : hours,
      ...assetFields(ASSETS.find((a) => a.asset_id === draft.asset_id) || asset),
    })
    setBusy(false)
    if (!saved) return
    notify(`${wo.work_order_number} updated.`)
    closeEdit()
  }

  const del = async () => {
    if (!wo._created) return
    if (typeof window !== 'undefined'
      && !window.confirm(`Delete ${wo.work_order_number}? This cannot be undone.`)) return
    const ok = await remove('work_order', idOf(wo))
    if (ok) back()
  }

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      notify('Link copied.')
    } catch { notify('The link could not be copied.', 'error') }
  }

  const jobSheet = async () => {
    try { await workOrderPdf(wo, { org: ORG, asset }) } catch (e) {
      notify(e?.message || 'The job sheet could not be prepared.', 'error')
    }
  }

  if (executing) {
    return (
      <WorkOrderExecution
        wo={wo} asset={asset}
        onBack={() => setExecuting(false)}
        applyStatus={applyStatus}
        notify={notify}
      />
    )
  }

  const options = FLOW[status] || []
  const canStart = ['Open', 'Assigned', 'On Hold'].includes(status)

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      {/* Action bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={back} className="gap-2 -ml-2 w-fit">
          <ArrowLeft className="w-4 h-4" />
          Back to Work Orders
        </Button>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {canStart && (
            <Button size="sm" onClick={() => setExecuting(true)}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white">
              <Play className="h-4 w-4" />
              Start Work
            </Button>
          )}
          {status === 'In Progress' && (
            <Button size="sm" onClick={() => setExecuting(true)}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              <Gauge className="h-4 w-4" />
              Open Execution
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-2" onClick={share}>
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={jobSheet}>
            <FileText className="h-4 w-4" />
            Job sheet (PDF)
          </Button>
          {/* Any job can be edited. A planner correcting a due date or an
              assignment is doing the ordinary work of a CMMS, and the change is
              stored as a change — the History tab names who made it and what it
              was before. Delete is different, and stays with the jobs this
              portal raised: the register's own jobs are the record. */}
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
              <Button size="sm" variant="outline" className="gap-2" onClick={startEdit}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              {wo._created && (
                <Button size="sm" variant="destructive" className="gap-2" onClick={del}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Title block */}
      <div className="bg-white border border-slate-200/60 rounded-lg shadow-sm p-6 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-slate-900">{wo.work_order_number}</h1>
              <Badge variant="secondary" className={`gap-1 ${look.cls}`}>
                <StatusIcon className="w-3 h-3" />
                {status}
              </Badge>
              {wo.priority && (
                <Badge variant="secondary" className={`gap-1 ${PRIORITY_LOOK[wo.priority] || 'bg-slate-100 text-slate-800'}`}>
                  Priority {wo.priority}
                </Badge>
              )}
              {overdue && (
                <Badge variant="secondary" className="gap-1 bg-red-100 text-red-800">
                  <AlertTriangle className="w-3 h-3" />
                  Overdue
                </Badge>
              )}
              {wo._created && (
                <Badge variant="secondary" className="bg-violet-100 text-violet-800">Raised in this portal</Badge>
              )}
            </div>
            <h2 className="text-xl text-slate-700 font-medium break-words">{wo.title}</h2>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={status}
              disabled={busy || options.length === 0}
              onChange={(e) => applyStatus(e.target.value)}
              className="w-full sm:w-48 h-10 px-3 rounded-md border border-slate-200 bg-white text-sm outline-none focus:border-primary/40 disabled:opacity-60"
            >
              <option value={status}>{status} (current)</option>
              {options.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {editing && (
          <div className="w-full">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">Title</p>
            <Input
              value={draft?.title ?? ''}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="What the job is"
              className="bg-white text-base font-medium"
            />
          </div>
        )}

        {editing ? (
          <div className="w-full">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">Description</p>
            <Textarea
              rows={3}
              value={draft?.description ?? ''}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="What is wrong, and what the job has to do."
              className="bg-white"
            />
          </div>
        ) : wo.description ? (
          <p className="text-slate-600 w-full whitespace-pre-wrap break-words">{wo.description}</p>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-4 border-t border-slate-200">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-600">
              <User className="h-4 w-4" />
              <span className="text-sm font-medium">Assignment</span>
            </div>
            <p className="text-slate-900 font-medium">{wo.assigned_to_name || 'Unassigned'}</p>
            <p className="text-sm text-slate-500">Raised by {wo.created_by_name || '—'}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-600">
              <Calendar className="h-4 w-4" />
              <span className="text-sm font-medium">Schedule</span>
            </div>
            <p className={`font-medium ${overdue ? 'text-red-600' : 'text-slate-900'}`}>
              Due {fmtDate(wo.due_date)}
            </p>
            <p className="text-sm text-slate-500">Raised {fmtDate(wo.created_date)}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-600">
              <Wrench className="h-4 w-4" />
              <span className="text-sm font-medium">Asset</span>
            </div>
            <p className="text-slate-900 font-medium">{wo.asset_name || '—'}</p>
            <p className="text-sm text-slate-500 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {[wo.site_name, wo.location_name].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-600">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm font-medium">Cost</span>
            </div>
            <p className="text-slate-900 font-medium">{money(wo.total_cost || 0)}</p>
            <p className="text-sm text-slate-500">
              {wo.actual_hours ? `${wo.actual_hours} h worked` : `${wo.estimated_hours || 0} h estimated`}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex w-full flex-wrap justify-start h-auto gap-1 bg-slate-100 p-1">
          {TABS.map(({ id: t, label, Icon }) => (
            <TabsTrigger key={t} value={t} className="gap-1.5 data-[state=active]:bg-white">
              <Icon className="w-3.5 h-3.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          {editing && (
            <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-900">
              Editing <strong>{wo.work_order_number}</strong>. The title, description, type,
              priority, asset, who it is on, when it is due and the hours estimate can all be
              changed here. Status has its own control above; the actual hours, downtime and cost
              are recorded by working the job, not by editing it.
            </div>
          )}
          {/* The record's own words beside the portal's: the priority as the
              shop wrote it, and the flags an airline audit asks about. */}
          {(wo.dhl_priority || wo.airline_audit_pack || wo.out_of_service || wo.comeback || wo.warranty_warning) && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {wo.dhl_priority && <Badge variant="outline">{wo.dhl_priority}</Badge>}
              {wo.dhl_status && <Badge variant="outline">Record status: {wo.dhl_status}</Badge>}
              {wo.out_of_service && <Badge className="bg-red-100 text-red-800">Out of service</Badge>}
              {wo.airline_audit_pack && <Badge className="bg-indigo-100 text-indigo-800">Airline audit pack</Badge>}
              {wo.comeback && <Badge className="bg-amber-100 text-amber-800">Come-back</Badge>}
              {wo.warranty_warning && <Badge className="bg-amber-100 text-amber-800">Warranty warning</Badge>}
              {wo.quality_flag && <Badge variant="outline">Quality: {wo.quality_flag}</Badge>}
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Work Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Field label="Work order">{wo.work_order_number}</Field>
                <Field label="Type">
                  {editing ? (
                    <Select value={draft?.work_order_type ?? 'Corrective'} onValueChange={(v) => setField('work_order_type', v)}>
                      <SelectTrigger className="h-9 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WO_TYPES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : wo.work_order_type}
                </Field>
                <Field label="Priority">
                  {editing ? (
                    <Select value={draft?.priority ?? 'Medium'} onValueChange={(v) => setField('priority', v)}>
                      <SelectTrigger className="h-9 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : wo.priority}
                </Field>
                {/* Status is not here. It has its own control in the header and
                    its own transitions, and a second way to set it is how the
                    two end up disagreeing. */}
                <Field label="Status">{status}</Field>
                {wo.system && <Field label="System">{wo.system}{wo.failure_code ? ` · ${wo.failure_code}` : ''}</Field>}
                {wo.shift && <Field label="Shift">{wo.shift}</Field>}
                {wo.meter_at_open != null && (
                  <Field label="Meter at open">
                    {Number(wo.meter_at_open).toLocaleString('en-US')} {asset?.meter_type === 'Cycles' ? 'cycles' : 'h'}
                  </Field>
                )}
                {wo.lead_tech_name && <Field label="Lead technician">{wo.lead_tech_name}</Field>}

                {editing && (
                  <div className="col-span-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">Asset</p>
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
                    <p className="mt-1.5 text-xs text-slate-500">
                      The code, site and location follow the asset.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Assignment &amp; Scheduling</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Field label="Assigned to">
                  {editing ? (
                    <Select
                      value={draft?.assigned_to_name || 'Unassigned'}
                      onValueChange={(v) => setField('assigned_to_name', v === 'Unassigned' ? '' : v)}
                    >
                      <SelectTrigger className="h-9 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Unassigned">Unassigned</SelectItem>
                        {ASSIGNEES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (wo.assigned_to_name || 'Unassigned')}
                </Field>
                <Field label="Raised by">{wo.created_by_name}</Field>
                <Field label="Due">
                  {editing ? (
                    <Input
                      type="date"
                      value={draft?.due_date ?? ''}
                      onChange={(e) => setField('due_date', e.target.value)}
                      className="h-9 bg-white"
                    />
                  ) : fmtDate(wo.due_date)}
                </Field>
                <Field label="Started">{wo.started_date ? fmtDate(wo.started_date) : 'Not started'}</Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-slate-500" />
                  Safety &amp; Compliance
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Field label="Asset criticality">{asset?.criticality}</Field>
                <Field label="Site">{wo.site_name}</Field>
                <Field label="Location">{wo.location_name}</Field>
                <Field label="Downtime">{wo.downtime_hours ? `${wo.downtime_hours} h` : '0 h'}</Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Cost Summary</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Field label="Labour">{money(wo.labour_cost || 0)}</Field>
                <Field label="Parts">{money(wo.parts_cost || 0)}</Field>
                <Field label="Total">{money(wo.total_cost || 0)}</Field>
                <Field label="Estimated hours">
                  {editing ? (
                    <Input
                      type="number" min="0" step="0.5"
                      value={draft?.estimated_hours ?? ''}
                      onChange={(e) => setField('estimated_hours', e.target.value)}
                      placeholder="Not estimated"
                      className="h-9 bg-white"
                    />
                  ) : (wo.estimated_hours ? `${wo.estimated_hours} h` : '—')}
                </Field>
              </CardContent>
            </Card>

            {/* What this job is in the ERP. The numbers are on the record
                already; without them on screen an evaluator has to take the
                integration on trust, which is the one thing they will not do. */}
            {wo.sap_order && (
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-slate-500" />
                    In SAP
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                    <Field label="Notification"><span className="font-mono text-sm">{wo.sap_notification}</span></Field>
                    <Field label={`Order (${wo.sap_order_type || 'PM'})`}><span className="font-mono text-sm">{wo.sap_order}</span></Field>
                    <Field label="Reservation"><span className="font-mono text-sm">{wo.sap_reservation}</span></Field>
                    <Field label="Work centre"><span className="font-mono text-sm">{wo.sap_work_center}</span></Field>
                    <Field label="Cost centre"><span className="font-mono text-sm">{wo.sap_cost_center}</span></Field>
                  </div>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => router.push(`/portal/oxmaint/gse-sap?job=${encodeURIComponent(wo.work_order_number)}`)}
                  >
                    Follow the documents
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Out of service, with whether ramp control was told. Showing the
                unit down in the system and notifying ramp control are the two
                things an airline audit checks on every entry. */}
            {detail?.oos?.length > 0 && (
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    Out of service
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {detail.oos.map((o) => (
                    <div key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className="font-medium text-slate-900">{o.reason}</span>
                      <span className="tabular-nums text-slate-500">
                        {fmtStamp(o.start)} → {o.end ? fmtStamp(o.end) : 'still out'}
                      </span>
                      {o.hours != null && <span className="tabular-nums text-slate-500">{o.hours} h</span>}
                      <Badge className={o.ramp_control_notified ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>
                        {o.ramp_control_notified ? 'Ramp control notified' : 'Ramp control not notified'}
                      </Badge>
                      <Badge variant="outline">{o.shown_in_system ? 'Shown in system' : 'Not shown in system'}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="asset-info" className="mt-4">
          {asset ? (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">{asset.asset_name}</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Field label="Code">{asset.asset_code}</Field>
                <Field label="Type">{asset.asset_type}</Field>
                <Field label="Manufacturer">{asset.manufacturer}</Field>
                <Field label="Model">{asset.model}</Field>
                <Field label="Serial">{asset.serial_number}</Field>
                <Field label="Criticality">{asset.criticality}</Field>
                <Field label="Status">{asset.status}</Field>
                <Field label="Health">{asset.health_score}%</Field>
                <Field label="Site">{asset.site_name}</Field>
                <Field label="Location">{asset.functional_location_name}</Field>
                <Field label="Running hours">{Number(asset.running_hours).toLocaleString('en-US')}</Field>
                <Field label="Next service">{fmtDate(asset.next_maintenance_date)}</Field>
              </CardContent>
            </Card>
          ) : (
            <Empty icon={Wrench} title="No asset on this work order"
              body="This job was raised without an asset, so there is no equipment record to show." />
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <Empty icon={CheckCircle} title="Tasks are kept on the execution screen"
            body="Open the work order with Start Work to tick tasks off, add your own and log time against them." />
        </TabsContent>

        <TabsContent value="comments" className="mt-4">
          {detail?.notes?.length ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Notes
                  <span className="ml-2 text-sm font-normal text-slate-500">{detail.notes.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-4">
                  {detail.notes.map((n) => (
                    <li key={n.id} className="border-l-2 border-slate-200 pl-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-medium text-slate-800">{n.author}</span>
                        <Badge variant="outline" className="text-[10px]">{n.type}</Badge>
                        <span className="tabular-nums">{fmtStamp(n.at)}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap break-words">{n.text}</p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ) : (
            <Empty icon={MessageSquare} title="No comments" body="Nothing has been added to this work order yet." />
          )}
        </TabsContent>

        <TabsContent value="attachments" className="mt-4">
          {attachments.length === 0 ? (
            <Empty
              icon={Paperclip}
              title="No attachments"
              body="No photographs or documents are attached to this work order. A technician adds them with Upload Proof on My Tasks."
            />
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Attachments
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    {attachments.length} file{attachments.length === 1 ? '' : 's'}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {attachments.map((a) => (
                  <div
                    key={a.recordId}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                  >
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">{a.fileType}</Badge>
                    <span className="flex-1 min-w-0 truncate text-sm font-medium text-slate-800" title={a.fileName}>
                      {a.fileName}
                    </span>
                    <span className="text-xs text-slate-400 shrink-0">{prettySize(a.sizeBytes)}</span>
                    <span className="text-xs text-slate-400 shrink-0 hidden sm:inline">{a.uploadedBy || '—'}</span>
                    <Button
                      size="sm" variant="outline" className="h-8 text-xs shrink-0"
                      onClick={async () => {
                        const full = await store.loadAttachment(a.recordId)
                        if (!full) return
                        const url = attachmentUrl(full)
                        if (!url) return
                        downloadUrl(url, a.fileName)
                        // Revoked a beat later: the click is synchronous but the
                        // browser reads the URL after this frame.
                        setTimeout(() => URL.revokeObjectURL(url), 4000)
                      }}
                    >
                      Download
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="time" className="mt-4 space-y-4">
          {detail?.labour?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Recorded time
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    {detail.labour.length} {detail.labour.length === 1 ? 'line' : 'lines'} ·{' '}
                    {Math.round(detail.labour.reduce((n, l) => n + l.hours, 0) * 100) / 100} h ·{' '}
                    {money(detail.labour.reduce((n, l) => n + l.cost, 0))}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-2 pr-3 font-medium">Technician</th>
                        <th className="py-2 px-3 font-medium">Shift</th>
                        <th className="py-2 px-3 font-medium">Start → stop</th>
                        <th className="py-2 px-3 font-medium text-right">Hours</th>
                        <th className="py-2 px-3 font-medium text-right">Scheduled that day</th>
                        <th className="py-2 pl-3 font-medium text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.labour.map((l) => (
                        <tr key={l.id} className="border-b border-slate-100">
                          <td className="py-2 pr-3">
                            <span className="block font-medium text-slate-900">{l.name}</span>
                            <span className="block text-xs text-slate-500">{l.role} · {money(l.rate)}/h</span>
                          </td>
                          <td className="py-2 px-3 text-slate-600">{l.shift}</td>
                          <td className="py-2 px-3 tabular-nums text-slate-600">{fmtStamp(l.start)} → {!l.stop ? '—' : l.stop.slice(0, 10) === String(l.start).slice(0, 10) ? l.stop.slice(11, 16) : fmtStamp(l.stop)}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-slate-900">{l.hours}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-slate-500">{l.scheduled_hours ?? '—'}</td>
                          <td className="py-2 pl-3 text-right tabular-nums font-medium text-slate-900">{money(l.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Hours recorded against the hours each technician was scheduled that day — the basis of
                  time-on-task. Time booked in this portal is listed separately below.
                </p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Time</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <Field label="Estimated">{wo.estimated_hours ? `${wo.estimated_hours} h` : '—'}</Field>
              <Field label="Actual">{wo.actual_hours ? `${wo.actual_hours} h` : '—'}</Field>
              <Field label="Labour cost">{wo.labour_cost ? money(wo.labour_cost) : '—'}</Field>
              <Field label="Downtime">{wo.downtime_hours ? `${wo.downtime_hours} h` : '0 h'}</Field>
              <Field label="Started">{wo.started_date ? fmtDate(wo.started_date) : 'Not started'}</Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle className="text-base">
                  Labour
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    {labour.length} {labour.length === 1 ? 'entry' : 'entries'}
                    {labour.length > 0 && ` · ${Math.round(labour.reduce((n, e) => n + (Number(e.hours) || 0), 0) * 100) / 100} h · ${money(labour.reduce((n, e) => n + (Number(e.cost) || 0), 0))}`}
                  </span>
                </CardTitle>
                {!labourForm && (
                  <Button size="sm" className="ml-auto gap-2" onClick={openLabourForm}>
                    <Plus className="h-4 w-4" />
                    Log time
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {labourForm && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-4 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {WORKER_TYPES.map((t) => (
                      <Button
                        key={t} type="button" size="sm"
                        variant={labourForm.workerType === t ? 'default' : 'outline'}
                        onClick={() => setLabour('workerType', t)}
                      >
                        {t}
                      </Button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {labourForm.workerType === 'In-house' ? (
                      <div className="lg:col-span-2">
                        <Label htmlFor="labour-tech" className="mb-1 block text-xs text-slate-600">Technician</Label>
                        <Select value={labourForm.workerName || undefined} onValueChange={(v) => setLabour('workerName', v)}>
                          <SelectTrigger id="labour-tech" className="h-9 bg-white"><SelectValue placeholder="Who did the work" /></SelectTrigger>
                          <SelectContent>
                            {TECHNICIAN_NAMES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <>
                        <div>
                          <Label htmlFor="labour-vendor" className="mb-1 block text-xs text-slate-600">Contractor</Label>
                          <Select value={labourForm.vendorName || undefined} onValueChange={(v) => setLabour('vendorName', v)}>
                            <SelectTrigger id="labour-vendor" className="h-9 bg-white"><SelectValue placeholder="Which firm" /></SelectTrigger>
                            <SelectContent className="max-h-72">
                              {VENDOR_NAMES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="labour-ctech" className="mb-1 block text-xs text-slate-600">Their technician</Label>
                          <Input
                            id="labour-ctech" className="h-9 bg-white" placeholder="Name on the service report"
                            value={labourForm.contractorTech} onChange={(e) => setLabour('contractorTech', e.target.value)}
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <Label htmlFor="labour-hours" className="mb-1 block text-xs text-slate-600">Hours</Label>
                      <Input
                        id="labour-hours" type="number" min="0" step="0.25" className="h-9 bg-white"
                        value={labourForm.hours} onChange={(e) => setLabour('hours', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="labour-rate" className="mb-1 block text-xs text-slate-600">Rate per hour</Label>
                      <Input
                        id="labour-rate" type="number" min="0" step="1" className="h-9 bg-white"
                        placeholder={`${money(labourForm.workerType === 'Contractor'
                          ? contractorRate(labourForm.vendorName)
                          : inHouseRate(labourForm.workerName))} default`}
                        value={labourForm.rate} onChange={(e) => setLabour('rate', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="labour-date" className="mb-1 block text-xs text-slate-600">Date worked</Label>
                      <Input
                        id="labour-date" type="date" className="h-9 bg-white"
                        value={labourForm.workDate} onChange={(e) => setLabour('workDate', e.target.value)}
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3">
                      <Label htmlFor="labour-note" className="mb-1 block text-xs text-slate-600">Note</Label>
                      <Input
                        id="labour-note" className="h-9 bg-white" placeholder="What was done, or the service report number"
                        value={labourForm.note} onChange={(e) => setLabour('note', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setLabourForm(null)} disabled={busy}>Cancel</Button>
                    <Button size="sm" onClick={saveLabour} disabled={busy}>{busy ? 'Saving…' : 'Book time'}</Button>
                  </div>
                </div>
              )}

              {labour.length === 0 ? (
                !labourForm && (
                  <p className="py-2 text-sm text-slate-500">
                    No time booked yet. Time logged when the job is completed is booked here
                    automatically; contractor visits are booked with Log time.
                  </p>
                )
              ) : (
                <div className="divide-y divide-slate-100">
                  {labour.map((e) => (
                    <div key={e.recordId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                      <span className="w-24 shrink-0 text-xs tabular-nums text-slate-500">{fmtDate(e.work_date)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">
                          {e.worker_type === 'Contractor' ? e.vendor_name : e.worker_name}
                          {e.worker_type === 'Contractor' && e.worker_name && e.worker_name !== e.vendor_name && (
                            <span className="font-normal text-slate-500"> · {e.worker_name}</span>
                          )}
                        </span>
                        {e.note && <span className="block truncate text-xs text-slate-500">{e.note}</span>}
                      </span>
                      <Badge className={e.worker_type === 'Contractor' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}>
                        {e.worker_type}
                      </Badge>
                      <span className="w-14 shrink-0 text-right text-sm tabular-nums text-slate-900">{e.hours} h</span>
                      <span className="w-20 shrink-0 text-right text-xs tabular-nums text-slate-500">{money(e.rate)}/h</span>
                      <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900">{money(e.cost)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <RecordHistory kind="work_order" recordId={String(idOf(wo))} />
        </TabsContent>

        <TabsContent value="materials" className="mt-4 space-y-4">
          <IssueKit
            wo={wo} asset={asset} recordId={idOf(wo)}
            recordedKits={[...new Set((detail?.parts || []).map((x) => x.kit_id).filter(Boolean))]}
          />
          <WarrantyOnJob workOrderId={wo.work_order_number || id} />
          {detail?.parts?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Parts issued
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    {detail.parts.length} {detail.parts.length === 1 ? 'line' : 'lines'} ·{' '}
                    {money(detail.parts.reduce((n, x) => n + x.ext_cost, 0))}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-2 pr-3 font-medium">Part</th>
                        <th className="py-2 px-3 font-medium text-right">Qty</th>
                        <th className="py-2 px-3 font-medium text-right">Unit</th>
                        <th className="py-2 px-3 font-medium text-right">Extended</th>
                        <th className="py-2 px-3 font-medium">Vendor</th>
                        <th className="py-2 pl-3 font-medium">Warranty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.parts.map((x) => (
                        <tr key={x.id} className="border-b border-slate-100 align-top">
                          <td className="py-2 pr-3">
                            <span className="block font-medium text-slate-900">{x.part_name}</span>
                            <span className="block text-xs text-slate-500">
                              <span className="font-mono">{x.part_number}</span>{x.kit_id ? ` · kit ${x.kit_id}` : ''}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">{x.quantity}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-slate-600">{money(x.unit_cost)}</td>
                          <td className="py-2 px-3 text-right tabular-nums font-medium text-slate-900">{money(x.ext_cost)}</td>
                          <td className="py-2 px-3 text-slate-600">{x.vendor}</td>
                          <td className="py-2 pl-3">
                            <span className="text-slate-600">{x.warranty_months ? `${x.warranty_months} months` : '—'}</span>
                            {x.repeat_install && (
                              <Badge className="ml-2 bg-amber-100 text-amber-800">Repeat install</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {detail.parts.some((x) => x.repeat_install) && (
                  <p className="mt-2 text-xs text-amber-700">
                    A part marked repeat install went back on inside its expected life — the trigger for a
                    warranty claim against the vendor.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
          {/* Issued in this portal — at completion, or as a kit. Beside the
              record's own lines rather than instead of them. */}
          {wo.parts_used?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {detail?.parts?.length ? 'Issued from stores' : 'Parts issued'}
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    {wo.parts_used.length} {wo.parts_used.length === 1 ? 'line' : 'lines'} ·{' '}
                    {money(wo.parts_used.reduce((n, p) => n + (Number(p.ext_cost) || (Number(p.quantity) || 0) * (Number(p.unit_cost) || 0)), 0))}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {wo.parts_used.map((p, i) => (
                  <div key={`${p.part_id || p.part_name}-${i}`}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 last:border-0">
                    <span className="min-w-0 text-sm text-slate-800">
                      {p.part_name || p.part_id}
                      {p.kit_id && <span className="ml-2 text-xs text-slate-500">kit {p.kit_id}</span>}
                      {p.source && <Badge variant="outline" className="ml-2 text-[10px]">{p.source}</Badge>}
                    </span>
                    <span className="text-sm tabular-nums text-slate-500">
                      {p.quantity} × {money(p.unit_cost || 0)}
                      {p.issued_by && <span className="ml-2 text-xs">· {p.issued_by}, {fmtDate(p.issued_at)}</span>}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {!detail?.parts?.length && !wo.parts_used?.length && (
            <Empty icon={Package} title="No parts issued"
              body="Parts are booked against a work order when it is completed, and are taken out of stock at the same time." />
          )}
        </TabsContent>

        <TabsContent value="costs" className="mt-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Cost breakdown</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Field label="Labour">{money(wo.labour_cost || 0)}</Field>
              <Field label="Parts">{money(wo.parts_cost || 0)}</Field>
              <Field label="Rate">{wo.labour_rate ? `${money(wo.labour_rate)}/h` : '—'}</Field>
              <Field label="Total">{money(wo.total_cost || 0)}</Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="children" className="mt-4">
          {detail && (detail.parent || detail.children?.length) ? (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Linked work orders</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                {detail.parent && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                      {detail.parent_after_child ? 'Related work order' : 'Come-back of'}
                    </p>
                    <LinkedJob job={detail.parent} onOpen={(jid) => router.push(`/portal/oxmaint/work-orders/${encodeURIComponent(jid)}`)} />
                    {detail.parent_after_child && (
                      <p className="mt-1.5 text-xs text-amber-700">
                        The record links this job to one raised after it, so it is shown as related rather than
                        as the job it came back from.
                      </p>
                    )}
                  </div>
                )}
                {detail.children?.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Raised against this job
                    </p>
                    <div className="space-y-2">
                      {detail.children.map((c) => (
                        <LinkedJob
                          key={c.id} job={c}
                          label={c.parent_after_child ? 'Related' : 'Come-back'}
                          onOpen={(jid) => router.push(`/portal/oxmaint/work-orders/${encodeURIComponent(jid)}`)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Empty icon={GitBranch} title="No child work orders"
              body="Nothing has been raised under this work order." />
          )}
        </TabsContent>
      </Tabs>

      {/* The same gate the Edit button carries. Only a work order raised in
          this portal can be changed here — the seeded ones are the customer's
          record and nothing on this screen edits it — so `?edit=1` typed
          against one of those opens the page and no dialog, rather than a form
          whose Save has nowhere to go. */}
    </div>
  )
}

