'use client'

// My Tasks — one technician's own queue, rebuilt on the product's screen.
//
// The product calls this the technician dashboard and gives it three tabs
// keyed on status: Pending is Open and Assigned, In Progress is In Progress and
// On Hold, Done is Completed and Closed. That mapping is copied exactly, because
// it is the thing that makes the screen make sense — a technician does not think
// in five statuses, they think in "not started / doing / done", and the tabs are
// where those three live.
//
// TWO DEPARTURES FROM THE PRODUCT, BOTH DELIBERATE.
//
// The header is this portal's, not the product's. The product's is a sticky
// compact bar with an icon tile, because that screen is a standalone surface a
// technician opens on a phone. Here the screen sits inside the same shell as
// Work Orders and PM Schedules, and eight screens already opened with a 30px
// title; a ninth that opened differently would read as a different application.
//
// The offline, syncing and queued banners are gone. The product has an offline
// queue behind them — IndexedDB, a sync worker, a pending count. This portal has
// none, so those banners could never fire, and a status bar that can only ever
// say one thing is a claim about a system that does not exist.
//
// What is kept whole is the card and what you can do from it: the tinted overdue
// border, the priority chip, the mono work order number, and the tab deciding
// which single action is offered. Upload Proof writes a real attachment against
// the work order, which is where the Attachments tab on its detail page reads
// from — the product has that tab too, and it had been empty here because
// nothing in the portal could put anything in it.

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  RefreshCw, ClipboardList, Clock, CircleDot, CheckCircle2, AlertTriangle,
  Loader2, Camera, Wrench,
} from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Textarea } from '../ui/textarea'
import { Tabs as ShadTabs, TabsList, TabsTrigger } from '../ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../ui/dialog'
import StatTiles from '../components/StatTiles'
import TaskCard from '../components/TaskCard'
import EvidenceUpload from '../components/EvidenceUpload'
import { useSite } from '../lib/siteStore'
import { useRecords, useStore } from '../lib/store'
import { saveAttachments } from '../lib/attachments'
import { WORK_ORDERS, USER, EPOCH, isPast, fmtDate, daysUntil } from '../lib/data'

const idOf = (w) => w.workorder_id || w.recordId

// The product's own mapping, copied rather than reinvented. A status this
// portal has that the product does not — Cancelled — belongs on none of the
// three: it is neither waiting, nor being worked, nor done.
const TABS = [
  { key: 'pending', label: 'Pending', Icon: Clock, statuses: ['Open', 'Assigned'] },
  { key: 'in-progress', label: 'In Progress', Icon: CircleDot, statuses: ['In Progress', 'On Hold'] },
  { key: 'done', label: 'Done', Icon: CheckCircle2, statuses: ['Completed', 'Closed'] },
]

const EMPTY_LINE = {
  pending: 'No pending tasks assigned to you',
  'in-progress': 'No tasks in progress',
  done: 'No completed tasks yet',
}

const CARDS = [
  { id: 'total', title: 'My Tasks', icon: ClipboardList, color: 'bg-indigo-500', description: 'On your desk', total: true },
  { id: 'pending', title: 'Pending', icon: Clock, color: 'bg-slate-500', description: 'Not started' },
  { id: 'in-progress', title: 'In Progress', icon: CircleDot, color: 'bg-blue-500', description: 'Being worked' },
  { id: 'overdue', title: 'Overdue', icon: AlertTriangle, color: 'bg-red-500', description: 'Past the due date' },
  { id: 'done', title: 'Completed', icon: CheckCircle2, color: 'bg-green-500', description: 'This month' },
]

export default function MyTasks() {
  const router = useRouter()
  const { scope, siteName } = useSite()
  const { update, create, notify } = useStore()

  // Opens on the tab that has work in it. A queue that opens on an empty
  // "Pending" while twenty-seven jobs sit under the next tab reads as a screen
  // with nothing on it.
  const [tab, setTab] = useState(null)
  const [busy, setBusy] = useState('')
  const [completing, setCompleting] = useState(null)
  const [remarks, setRemarks] = useState('')
  const [uploading, setUploading] = useState(null)
  const [files, setFiles] = useState([])

  const merged = useRecords('work_order', WORK_ORDERS, idOf)
  const all = useMemo(() => scope(merged), [scope, merged])

  // What is on the person signed in.
  //
  // For a technician that is the work assigned to them. For whoever runs the
  // shift it is also what has fallen through the middle — a job nobody picked up
  // and is now late — and the exceptions a shop floor escalates: an aircraft-
  // contact job still open, one held for parts, one waiting on a quality
  // walkdown. A manager whose own name is on nothing is not a manager with an
  // empty day, and a screen that shows them nothing is the screen they stop
  // opening.
  const runsTheShift = /manager|supervisor|planner|lead/i.test(USER.role_name || '')
  const mine = useMemo(() => {
    const late = (w) => Boolean(w.due_date) && isPast(w.due_date)
    const live = (w) => w.status !== 'Completed' && w.status !== 'Closed' && w.status !== 'Cancelled'
    const reasonFor = (w) => {
      if (w.assigned_to_name === USER.name) return 'Assigned to you'
      if (!w.assigned_to_name && late(w)) return 'Unassigned and late'
      if (!runsTheShift || !live(w)) return null
      if (late(w)) return 'Late on the shift'
      if (w.priority === 'Critical') return 'Critical — aircraft contact'
      if (w.status === 'On Hold') return 'Held for parts'
      if (w.dhl_status === 'QA Review') return 'Waiting on quality'
      return null
    }
    return all
      .map((w) => ({ w, reason: reasonFor(w) }))
      .filter((x) => x.reason)
      .map(({ w, reason }) => ({ ...w, _id: idOf(w), _reason: reason }))
  }, [all, runsTheShift])

  const isOverdue = useCallback(
    (w) => Boolean(w.due_date) && isPast(w.due_date) && w.status !== 'Completed' && w.status !== 'Closed',
    [],
  )

  const byTab = useMemo(() => {
    const out = {}
    for (const t of TABS) {
      out[t.key] = mine
        .filter((w) => t.statuses.includes(w.status))
        // Late first, then soonest due — the order a shift is actually worked.
        .sort((a, b) => (isOverdue(b) - isOverdue(a))
          || (new Date(a.due_date || 0) - new Date(b.due_date || 0)))
    }
    return out
  }, [mine, isOverdue])

  const doneThisMonth = useMemo(() => {
    const now = new Date(EPOCH)
    return mine.filter((w) => {
      if (!w.completed_date) return false
      const d = new Date(w.completed_date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
  }, [mine])

  const counts = {
    total: mine.length,
    pending: byTab.pending.length,
    'in-progress': byTab['in-progress'].length,
    overdue: mine.filter(isOverdue).length,
    done: doneThisMonth,
  }

  const firstWithWork = TABS.find((t) => byTab[t.key]?.length)?.key || 'pending'
  const activeTab = tab ?? firstWithWork
  const rows = byTab[activeTab] || []

  const start = async (w) => {
    setBusy(w._id)
    try {
      await update('work_order', w._id, { ...w, status: 'In Progress' })
      notify(`Started ${w.work_order_number}.`)
      setTab('in-progress')
    } finally { setBusy('') }
  }

  const completeNow = async () => {
    const w = completing
    if (!w) return
    setBusy(w._id)
    try {
      await update('work_order', w._id, {
        ...w,
        status: 'Completed',
        completed_date: new Date().toISOString(),
        actual_hours: w.actual_hours ?? w.estimated_hours,
        // Appended rather than replacing: the description is the job as raised,
        // and overwriting it would lose why the work was asked for.
        completion_notes: remarks.trim(),
      })
      notify(`${w.work_order_number} completed.`)
      setCompleting(null)
      setRemarks('')
      setTab('done')
    } finally { setBusy('') }
  }

  const uploadNow = async () => {
    const w = uploading
    if (!w || !files.length) return
    setBusy(w._id)
    try {
      const { attached, failed } = await saveAttachments(create, files, {
        work_order_id: w._id,
        work_order_number: w.work_order_number,
        title: w.title,
        uploadedBy: USER.name,
      })
      if (attached.length) {
        notify(`${attached.length} file${attached.length === 1 ? '' : 's'} attached to ${w.work_order_number}.`)
      }
      if (failed.length) notify(`${failed.join(', ')} did not attach.`, 'error')
      setUploading(null)
      setFiles([])
    } finally { setBusy('') }
  }

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">My Tasks</h1>
          <p className="text-slate-600 mt-1 text-sm md:text-base">
            {USER.name} · {counts.pending + counts['in-progress']} live
            {counts.pending + counts['in-progress'] === 1 ? ' job' : ' jobs'} · {siteName}
          </p>
          {runsTheShift && (
            <p className="mt-0.5 text-xs text-slate-500">
              Your own work, jobs nobody has picked up, and what the shift has escalated — critical, held for
              parts, or waiting on a quality walkdown.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <Button variant="outline" className="h-10 px-4 gap-2" onClick={() => setTab('pending')}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button className="h-10 px-4 gap-2" onClick={() => router.push('/portal/oxmaint/work-orders')}>
            <Wrench className="w-4 h-4" />
            All Work Orders
          </Button>
        </div>
      </motion.div>

      <StatTiles
        rows={mine}
        storageKey="oxMyTasksSummaryCards"
        cards={CARDS.map((c) => ({ ...c, value: counts[c.id] }))}
      />

      <ShadTabs value={activeTab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3 h-12">
          {TABS.map(({ key, label, Icon }) => (
            <TabsTrigger key={key} value={key} className="flex items-center gap-2">
              <Icon className="w-4 h-4" />
              {label}
              {byTab[key].length > 0 && <Badge variant="secondary">{byTab[key].length}</Badge>}
            </TabsTrigger>
          ))}
        </TabsList>
      </ShadTabs>

      {rows.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No tasks here</p>
          <p className="text-slate-400 text-sm mt-1">{EMPTY_LINE[activeTab]}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map((w, i) => (
            <TaskCard
              key={w._id}
              task={w}
              tab={activeTab}
              index={i}
              overdue={isOverdue(w)}
              formatDate={fmtDate}
              busy={busy}
              onStart={start}
              onComplete={setCompleting}
              onUpload={(x) => { setFiles([]); setUploading(x) }}
              onOpen={(x) => router.push(`/portal/oxmaint/work-orders/${x._id}`)}
            />
          ))}
        </div>
      )}

      {/* Complete */}
      <Dialog open={Boolean(completing)} onOpenChange={(o) => { if (!o) { setCompleting(null); setRemarks('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Complete Task
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-slate-600 mb-3">
              Mark <strong>{completing?.title}</strong> as completed?
            </p>
            <Textarea
              placeholder="Add completion notes (optional)…"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCompleting(null); setRemarks('') }}>Cancel</Button>
            <Button
              onClick={completeNow}
              disabled={Boolean(busy)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload proof */}
      <Dialog open={Boolean(uploading)} onOpenChange={(o) => { if (!o) { setUploading(null); setFiles([]) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-600" />
              Upload Proof
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-slate-600">
              Photographs or documents for <strong>{uploading?.title}</strong>. They are attached to the
              work order and appear on its Attachments tab.
            </p>
            <EvidenceUpload files={files} onChange={setFiles} disabled={Boolean(busy)} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setUploading(null); setFiles([]) }}>Cancel</Button>
            <Button onClick={uploadNow} disabled={!files.length || Boolean(busy)}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
              Attach {files.length || ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
