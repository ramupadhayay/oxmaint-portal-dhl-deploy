'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { RefreshCw, Download, Plus, Search, Wrench } from 'lucide-react'
import {
  PageHeader, StatStrip, Toolbar, DataTable, Drawer, Modal, Fields, StatusBadge,
  Priority, ActionButton, Section, PALETTE,
} from '../lib/kit'
import { Button } from '../ui/button'
import WorkOrderListItem from '../components/WorkOrderListItem'
import PagerBar, { usePaged } from '../components/ListPager'
import WorkOrderSummary, { cardDefinitions } from '../components/WorkOrderSummary'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { useRecords, useStore } from '../lib/store'
import { useStock } from '../lib/movements'
import { CreateModal } from '../lib/forms'
import { workOrderPdf } from '../lib/workOrderPdf'
import WorkOrderExecution from './WorkOrderExecution'
import { useLogLabour } from '../lib/labour'
import { ASSETS, DATASET_META, ORG, USER, WORK_ORDERS, TECHNICIANS, OPEN_STATUS, isPast, fmtDate, daysUntil, money } from '../lib/data'

const { SUB, MUTE, INK, LINE, GREEN } = PALETTE

// Closed sits at the end of the lifecycle rather than in the middle of it: a
// completed job is finished work, a closed one is finished paperwork. It is in
// the filter list because this screen can now put a job there, and a status you
// can reach but cannot filter by is a status that hides work.
const STATUSES = ['Open', 'In Progress', 'On Hold', 'Completed', 'Closed', 'Cancelled']
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low']
const TYPES = ['Corrective', 'Preventive', 'Inspection', 'Breakdown']

// One flat charge-out rate for maintenance labour. A per-trade rate would be
// more accurate and less explainable, and the number on the screen has to be one
// an audience can reproduce in their head from the hours beside it.
const LABOUR_RATE = 48

const idOf = (w) => w.workorder_id || w.recordId
const partIdOf = (p) => p.part_id || p.recordId

export default function WorkOrders() {
  const { scope, siteName } = useSite()
  const router = useRouter()
  const { create, update, remove, notify } = useStore()
  const { levels, issue } = useStock()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState('all')
  const [type, setType] = useState('all')
  const [openId, setOpenId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [executing, setExecuting] = useState(false)
  // Which summary tile is filtering the list, if any. Null is "Total".
  const [card, setCard] = useState(null)

  const [completing, setCompleting] = useState(false)
  const [hours, setHours] = useState('')
  const [downtime, setDowntime] = useState('0')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState([])
  const lineSeq = useRef(0)

  const merged = useRecords('work_order', WORK_ORDERS, idOf)
  const all = useMemo(() => scope(merged), [scope, merged])

  const partById = useMemo(() => new Map(levels.map((p) => [partIdOf(p), p])), [levels])
  // The nameplate the job sheet and the execution screen need. The work order
  // carries the asset's name and code already; the serial, model and criticality
  // only live on the asset record.
  const assetById = useMemo(() => new Map(ASSETS.map((a) => [a.asset_id, a])), [])

  // The drawer reads from the live list rather than holding its own copy, so a
  // status change shows in the drawer and the table at once. Keeping a snapshot
  // is what makes a detail panel go stale the moment you act on it.
  const open = useMemo(() => merged.find((w) => idOf(w) === openId) || null, [merged, openId])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((w) => (
      (status === 'all' || w.status === status) &&
      (priority === 'all' || w.priority === priority) &&
      (type === 'all' || w.work_order_type === type) &&
      (!q || [w.work_order_number, w.title, w.asset_name, w.assigned_to_name].join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, status, priority, type])

  const live = all.filter((w) => OPEN_STATUS.includes(w.status))

  const patch = useCallback((changes) => {
    if (!open) return
    update('work_order', idOf(open), { ...open, ...changes })
  }, [open, update])

  // Opening a different job has to leave the execution screen behind. Without
  // this, backing out of a deleted or cancelled job kept the flag set and the
  // next work order opened straight into somebody else's task list.
  const openRecord = (id) => { setOpenId(id); setExecuting(false) }
  const closeRecord = () => { setOpenId(null); setExecuting(false) }

  // ── lifecycle ──────────────────────────────────────────────────────────
  //
  // One writer for every status move, so the dates the product stamps are
  // stamped in one place: a start when work begins, a completion when it
  // finishes, and that completion cleared again when a finished job is reopened.
  // A record that is both open and completed is the one thing a backlog report
  // cannot survive.
  //
  // `label` is what the job did, for the toast. Passing null hands the message
  // to the caller — the execution screen does that, because it knows how much
  // time it has just booked and this function does not. The saved record comes
  // back so a caller can tell a write that stuck from one that was rolled back.
  const logLabour = useLogLabour()

  const applyStatus = useCallback(async (next, label, extra = {}) => {
    if (!open) return null
    // Time the execution screen booked is an amount worked, not a total. It goes
    // in as a labour entry — which is what the Labour screen and the job's Time
    // tab read — and the job's figures below carry that forward rather than
    // being overwritten by the copy of the row this handler was holding.
    const { actual_hours: worked, ...rest } = extra || {}
    const booked = next === 'Completed' && Number(worked) > 0 ? Number(worked) : 0
    const changes = { status: next, ...rest }

    if (next === 'In Progress') {
      if (open.status === 'Completed') changes.completed_date = null
      if (!open.started_date) changes.started_date = new Date().toISOString()
    }
    if (next === 'Completed') {
      changes.completed_date = new Date().toISOString()
      // Completing from the execution screen books hours and no parts. Rolling
      // the cost up here at the rate the completion modal uses is what keeps a
      // job finished at the machine and one closed off by the supervisor
      // costing the same money — two rates would show up as a cost variance
      // that has nothing to do with the work.
      const parts = Number(open.parts_cost) || 0
      if (booked) {
        const entry = await logLabour({
          wo: open, workOrderRecordId: idOf(open), workerType: 'In-house',
          workerName: open.assigned_to_name || USER.name, hours: booked, silent: true,
        })
        const hours = Math.round(((Number(open.actual_hours) || 0) + (entry ? booked : 0)) * 100) / 100
        changes.actual_hours = hours
        changes.labour_cost = Math.round((Number(open.labour_cost) || 0) + (entry ? Number(entry.cost) || 0 : 0))
      } else {
        // Closed off without time from the screen — the supervisor's route. Kept
        // as it was: the job's own hours, or its estimate, at the standard rate.
        const hours = Math.max(0, Number(open.actual_hours ?? open.estimated_hours) || 0)
        changes.actual_hours = hours
        changes.labour_rate = LABOUR_RATE
        changes.labour_cost = Math.round(hours * LABOUR_RATE)
      }
      changes.total_cost = (Number(changes.labour_cost) || 0) + parts
    }

    const saved = await update('work_order', idOf(open), { ...open, ...changes })
    // Only on a write that stuck. The store rolls the row back and reports the
    // failure itself, and a success toast over the top of that reads as saved.
    if (saved && label) notify(`${open.work_order_number} — ${label}.`)
    return saved
  }, [open, update, notify, logLabour])

  const cancelWorkOrder = () => {
    if (!open) return
    if (typeof window !== 'undefined'
      && !window.confirm(`Cancel ${open.work_order_number}? It will be marked Cancelled and drop out of the backlog.`)) return
    applyStatus('Cancelled', 'cancelled')
  }

  // Only a job raised in this portal is a real record. A seeded one is sample
  // plant with nothing behind it to delete, and offering the action anyway is a
  // button that cannot work.
  const deleteWorkOrder = async () => {
    if (!open?._created) return
    if (typeof window !== 'undefined'
      && !window.confirm(`Delete ${open.work_order_number}? This removes the work order raised in this portal and cannot be undone.`)) return
    const ok = await remove('work_order', idOf(open))
    if (ok) closeRecord()
  }

  /** The same delete, reached from a row's own menu rather than from the drawer,
   *  so a planner clearing up does not have to open each one first. */
  const deleteRow = async (w) => {
    if (!w?._created) return
    if (typeof window !== 'undefined'
      && !window.confirm(`Delete ${w.work_order_number}? This removes the work order raised in this portal and cannot be undone.`)) return
    const ok = await remove('work_order', idOf(w))
    if (ok && idOf(w) === openId) closeRecord()
  }

  /** The filtered register as a spreadsheet — what is on screen, not everything,
   *  because the filters are how somebody decided what they wanted. */
  const exportCsv = () => {
    const cols = ['work_order_number', 'title', 'status', 'priority', 'work_order_type',
      'asset_name', 'asset_code', 'site_name', 'assigned_to_name', 'created_date', 'due_date',
      'estimated_hours', 'actual_hours', 'total_cost']
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [cols.join(','), ...rows.map((w) => cols.map((c) => esc(w[c])).join(','))].join('\r\n')
    try {
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `work-orders-${rows.length}.csv`
      a.click()
      URL.revokeObjectURL(url)
      notify(`${rows.length} work order${rows.length === 1 ? '' : 's'} exported.`)
    } catch (e) {
      notify(e?.message || 'The export could not be prepared.', 'error')
    }
  }

  // There is no record route in this portal — a work order opens in the drawer
  // on this screen — so sharing copies the reference alongside the link to the
  // screen it opens on. A deep link would be the friendlier thing to paste and
  // a 404 for whoever was sent it.
  const copyLink = async () => {
    if (!open) return
    const url = typeof window !== 'undefined' ? window.location.href : ''
    try {
      await navigator.clipboard.writeText(`${open.work_order_number} — ${open.title}\n${url}`)
      notify(`${open.work_order_number} and the link copied to the clipboard.`)
    } catch {
      notify('Could not copy to the clipboard.', 'error')
    }
  }

  const jobSheet = async () => {
    if (!open) return
    await workOrderPdf(open, { org: ORG, asset: assetById.get(open.asset_id) || null })
  }

  // The move the current state is waiting for, and the moves that sit alongside
  // it. Start work and Resume open the execution screen rather than only
  // flipping a status, because the next thing that happens after either of them
  // is somebody working the job.
  const S = open?.status
  const primary = !open ? null
    : (S === 'Open' || S === 'Draft') ? { label: 'Start work', to: 'In Progress', verb: 'work started', variant: 'success', exec: true }
      : S === 'On Hold' ? { label: 'Resume', to: 'In Progress', verb: 'resumed', variant: 'success', exec: true }
        : S === 'In Progress' ? { label: 'Complete', variant: 'success', complete: true }
          : S === 'Completed' ? { label: 'Reopen', to: 'In Progress', verb: 'reopened', variant: 'ghost' }
            : null

  // Hold is offered from Open as well as In Progress: a job parked before anyone
  // has touched it — waiting on a part, a permit or a shutdown window — is the
  // commonest reason a supervisor reaches for the button.
  const canHold = S === 'Open' || S === 'In Progress'
  const canClose = S === 'Completed'
  const canCancel = Boolean(open) && S !== 'Completed' && S !== 'Closed' && S !== 'Cancelled'

  const runPrimary = async () => {
    if (!primary) return
    if (primary.complete) { startComplete(); return }
    // Only walk into the execution screen once the job is actually In Progress.
    // Opening it over a failed write would put a technician in front of a task
    // list for a job the register still has sitting in the backlog.
    const saved = await applyStatus(primary.to, primary.verb)
    if (saved && primary.exec) setExecuting(true)
  }

  // ── completion ─────────────────────────────────────────────────────────
  const startComplete = () => {
    setHours(String(open?.actual_hours ?? open?.estimated_hours ?? 1))
    setDowntime(String(open?.downtime_hours ?? 0))
    setNote('')
    setLines([])
    setCompleting(true)
  }

  const addLine = () => {
    lineSeq.current += 1
    setLines((p) => [...p, { key: `l${lineSeq.current}`, part_id: '', qty: '1' }])
  }
  const setLine = (key, changes) => setLines((p) => p.map((l) => (l.key === key ? { ...l, ...changes } : l)))
  const dropLine = (key) => setLines((p) => p.filter((l) => l.key !== key))

  const booked = useMemo(() => lines
    .filter((l) => l.part_id && Math.floor(Number(l.qty) || 0) > 0)
    .map((l) => {
      const part = partById.get(l.part_id)
      const quantity = Math.floor(Number(l.qty) || 0)
      return {
        part_id: l.part_id,
        part_name: part?.part_name || '',
        part_number: part?.part_number || '',
        unit: part?.unit || 'ea',
        quantity,
        unit_cost: Number(part?.unit_cost) || 0,
        line_value: Number(((Number(part?.unit_cost) || 0) * quantity).toFixed(2)),
      }
    }), [lines, partById])

  const labourHours = Math.max(0, Number(hours) || 0)
  const labourCost = Math.round(labourHours * LABOUR_RATE)
  const partsCost = Math.round(booked.reduce((n, l) => n + l.line_value, 0))
  const totalCost = labourCost + partsCost

  // The same part can be picked on two lines, and each line on its own may look
  // affordable while the pair is not — so the check is against the total demand
  // per part, not per line.
  const shortfall = useMemo(() => {
    const demand = new Map()
    booked.forEach((l) => demand.set(l.part_id, (demand.get(l.part_id) || 0) + l.quantity))
    for (const [id, qty] of demand) {
      const part = partById.get(id)
      if (!part || qty > part.quantity_on_hand) {
        return { name: part?.part_name || 'that part', want: qty, have: part?.quantity_on_hand ?? 0, unit: part?.unit || '' }
      }
    }
    return null
  }, [booked, partById])

  const incomplete = lines.some((l) => !l.part_id || Math.floor(Number(l.qty) || 0) < 1)

  const confirmComplete = async () => {
    if (!open) return
    if (shortfall) {
      notify(`Only ${shortfall.have} ${shortfall.unit} of ${shortfall.name} on hand — ${shortfall.want} needed.`, 'error')
      return
    }
    await update('work_order', idOf(open), {
      ...open,
      status: 'Completed',
      completed_date: new Date().toISOString(),
      actual_hours: labourHours,
      downtime_hours: Math.max(0, Number(downtime) || 0),
      completion_note: note,
      parts_used: booked,
      labour_rate: LABOUR_RATE,
      labour_cost: labourCost,
      parts_cost: partsCost,
      total_cost: totalCost,
    })

    for (const line of booked) {
      await issue(line.part_id, line.quantity, 'Issued to work order', open.work_order_number)
    }

    setCompleting(false)
    notify(booked.length
      ? `${open.work_order_number} completed — ${booked.length} part line${booked.length > 1 ? 's' : ''} issued, ${money(totalCost)} booked.`
      : `${open.work_order_number} completed — ${money(totalCost)} booked.`)
  }

  const columns = [
    { key: 'work_order_number', label: 'WO', render: (r) => <span style={{ fontWeight: 700, color: '#15227a' }}>{r.work_order_number}</span> },
    { key: 'title', label: 'Title', render: (r) => (
      <span style={{ display: 'block', maxWidth: 290, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.title}>{r.title}</span>
    ) },
    { key: 'asset_name', label: 'Asset' },
    { key: 'work_order_type', label: 'Type' },
    { key: 'priority', label: 'Priority', render: (r) => <Priority value={r.priority} />, sortValue: (r) => PRIORITIES.indexOf(r.priority) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge>{r.status}</StatusBadge> },
    { key: 'assigned_to_name', label: 'Assigned to', render: (r) => r.assigned_to_name || <span style={{ color: MUTE }}>Unassigned</span> },
    {
      key: 'due_date', label: 'Due',
      sortValue: (r) => new Date(r.due_date).getTime(),
      render: (r) => {
        const late = OPEN_STATUS.includes(r.status) && isPast(r.due_date)
        return (
          <span style={{ whiteSpace: 'nowrap', color: late ? '#b91c1c' : INK, fontWeight: late ? 700 : 500 }}>
            {fmtDate(r.due_date)}
            {late && <span style={{ fontSize: 10.5, marginLeft: 5 }}>{Math.abs(daysUntil(r.due_date))}d late</span>}
          </span>
        )
      },
    },
    { key: 'total_cost', label: 'Cost', align: 'right', render: (r) => money(r.total_cost) },
  ]

  // The tile filter sits on top of the toolbar's, so clicking "Overdue" narrows
  // whatever the search and selects have already left.
  const cardMatch = cardDefinitions().find((c) => c.id === card)?.match
  const shown = cardMatch ? rows.filter(cardMatch) : rows
  // Paged, and computed above the execution screen's early return so the hook
  // runs on every render. Rendering every row made the DHL register a 5.2 MB page.
  const paged = usePaged(shown, 25, `${search}|${status}|${priority}|${type}|${card}`)

  // The execution screen takes the whole page rather than opening in a second
  // overlay on top of the drawer. There is no record route in this portal, and
  // a technician working a job needs the room — a task list, a clock and the
  // guidance side by side do not fit in a 500px panel.
  if (executing && open) {
    return (
      <WorkOrderExecution
        wo={open}
        asset={assetById.get(open.asset_id) || null}
        onBack={() => setExecuting(false)}
        applyStatus={applyStatus}
        notify={notify}
      />
    )
  }


  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:justify-between md:items-start lg:items-center gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Work Orders</h1>
          <p className="text-slate-600 mt-1">Manage and track maintenance work orders across your organization</p>
          {DATASET_META?.voiceVolume?.honesty && (
            <p className="text-xs text-slate-500 mt-2 max-w-xl">{DATASET_META.voiceVolume.honesty}</p>
          )}
        </div>
        <div className="flex w-full flex-nowrap items-center gap-3 overflow-x-auto pb-1 lg:w-auto lg:overflow-visible lg:pb-0">
          <Button variant="outline" className="h-10 px-4 gap-2" onClick={() => { setSearch(''); setStatus('all'); setPriority('all'); setType('all'); setCard(null); notify('Filters cleared.') }}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button variant="outline" className="h-10 px-4 gap-2" onClick={exportCsv}>
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button variant="outline" className="h-10 px-4 gap-2" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" />
            Quick WO
          </Button>
          <Button className="h-10 px-4 gap-2" onClick={() => router.push('/portal/oxmaint/work-orders-create')}>
            <Plus className="w-4 h-4" />
            Create Work Order
          </Button>
        </div>
      </motion.div>

      <WorkOrderSummary rows={all} activeCard={card} onCardClick={setCard} />

      <div className="bg-white border border-slate-200/60 rounded-lg shadow-sm p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1 min-w-[220px] basis-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search WO number, title, asset, technician…"
              className="w-full h-10 pl-9 pr-3 rounded-md border border-slate-200 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
            />
          </div>
          {[
            { label: 'Status', value: status, set: setStatus, options: STATUSES },
            { label: 'Priority', value: priority, set: setPriority, options: PRIORITIES },
            { label: 'Type', value: type, set: setType, options: TYPES },
          ].map((f) => (
            <select
              key={f.label} value={f.value} onChange={(e) => f.set(e.target.value)}
              /* shrink-0 matters: without it the search field's flex-1 wins the
                 row and squeezes these until their own labels clip. */
              className="h-10 px-3 shrink-0 w-[150px] rounded-md border border-slate-200 text-sm bg-white outline-none focus:border-primary/40"
            >
              <option value="all">{f.label}: All</option>
              {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}
          <span className="text-sm text-slate-500 whitespace-nowrap">{shown.length} shown</span>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="bg-white border border-slate-200/60 rounded-lg shadow-sm p-12 text-center">
          <Wrench className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-800 mb-1">No work orders found</h3>
          <p className="text-sm text-slate-500">No work orders match these filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paged.pageItems.map((w, i) => (
            <WorkOrderListItem
              key={idOf(w)} workOrder={w} index={i}
              /* Opening a work order goes to its own page, the way the product
                 does it. The drawer this used to raise is still here for the
                 quick edit, but a job with a header, a status control and nine
                 tabs does not belong in a 500px panel. */
              onView={(r) => router.push(`/portal/oxmaint/work-orders/${idOf(r)}`)}
              /* Edit opens the work order, not a box over the list. The
                 product edits a job on the job — its edit route sits beside
                 view — and the three fields this changes are weighed against
                 the asset, the schedule and the cost, none of which fit beside
                 a 560px modal. */
              onEdit={(r) => router.push(`/portal/oxmaint/work-orders/${encodeURIComponent(idOf(r))}?edit=1`)}
              onDelete={deleteRow}
            />
          ))}
        </div>
      )}
      {shown.length > 0 && <PagerBar {...paged} noun="work orders" />}

      <CreateModal
        kind="work_order" open={creating} onClose={() => setCreating(false)}
        onSubmit={async (values) => {
          const rec = await create('work_order', values)
          if (rec) openRecord(rec.recordId)
        }}
      />

      <Drawer
        open={Boolean(open)} onClose={closeRecord}
        title={open?.work_order_number}
        subtitle={open?.title}
        icon={sectionIcon('work-orders', '#15227a')}
        width={500}
        footer={open && (primary || canHold || canClose || canCancel) ? (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {canCancel && <ActionButton size="sm" variant="ghost" onClick={cancelWorkOrder}>Cancel</ActionButton>}
            {canClose && <ActionButton size="sm" variant="ghost" onClick={() => applyStatus('Closed', 'closed')}>Close</ActionButton>}
            {canHold && <ActionButton size="sm" variant="ghost" onClick={() => applyStatus('On Hold', 'put on hold')}>Put on hold</ActionButton>}
            {S === 'In Progress' && (
              <ActionButton size="sm" variant="subtle" onClick={() => setExecuting(true)}>Open execution</ActionButton>
            )}
            {primary && (
              <ActionButton size="sm" variant={primary.variant} onClick={runPrimary}>{primary.label}</ActionButton>
            )}
          </div>
        ) : null}
      >
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatusBadge>{open.status}</StatusBadge>
              <StatusBadge>{open.priority}</StatusBadge>
              <StatusBadge tone="grey">{open.work_order_type}</StatusBadge>
              {OPEN_STATUS.includes(open.status) && isPast(open.due_date) && <StatusBadge>Overdue</StatusBadge>}
              {open._created && <StatusBadge tone="violet">Raised in this portal</StatusBadge>}
            </div>

            {/* What you do with the record, kept apart from what you do to the
                job. The footer moves the work along; these four do not change
                its state at all. */}
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              <ActionButton size="sm" variant="ghost" onClick={copyLink}>Share</ActionButton>
              <ActionButton size="sm" variant="ghost" onClick={jobSheet}>Job sheet (PDF)</ActionButton>
              <ActionButton size="sm" variant="ghost"
                onClick={() => router.push(`/portal/oxmaint/work-orders/${encodeURIComponent(idOf(open))}?edit=1`)}>
                Edit
              </ActionButton>
              {open._created && <ActionButton size="sm" variant="danger" onClick={deleteWorkOrder}>Delete</ActionButton>}
            </div>

            <p style={{ margin: 0, fontSize: 13, color: SUB, lineHeight: 1.55 }}>{open.description}</p>

            {open.raised_from && (
              <p style={{ margin: 0, fontSize: 11.5, color: MUTE }}>Raised from {open.raised_from}.</p>
            )}

            {/* The two things a supervisor changes most often, inline rather
                than behind an edit screen. */}
            {OPEN_STATUS.includes(open.status) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 13, borderRadius: 11, background: '#f8fafc', border: `1px solid ${LINE}` }}>
                <div>
                  <label style={miniLabel}>Assigned to</label>
                  <select value={open.assigned_to_name || ''} onChange={(e) => patch({ assigned_to_name: e.target.value })} style={miniSelect}>
                    <option value="">Unassigned</option>
                    {TECHNICIANS.map((t) => <option key={t.user_id} value={t.name}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={miniLabel}>Priority</label>
                  <select value={open.priority} onChange={(e) => patch({ priority: e.target.value })} style={miniSelect}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            )}

            <Fields rows={[
              ['Asset', open.asset_code ? `${open.asset_name} (${open.asset_code})` : open.asset_name],
              ['Location', open.location_name],
              ['Site', open.site_name],
              ['Assigned to', open.assigned_to_name || 'Unassigned'],
              ['Raised by', open.created_by_name],
              ['Raised on', fmtDate(open.created_date)],
              ['Due', fmtDate(open.due_date)],
              ['Started', open.started_date ? fmtDate(open.started_date) : 'Not started'],
              ['Completed', open.completed_date ? fmtDate(open.completed_date) : '—'],
              ['Estimated hours', `${open.estimated_hours} h`],
              ['Actual hours', open.actual_hours != null ? `${open.actual_hours} h` : '—'],
              ['Downtime', `${open.downtime_hours ?? 0} h`],
              ['Total cost', money(open.total_cost || 0)],
            ]} />

            {open.completion_note && (
              <div>
                <div style={miniLabel}>Completion note</div>
                <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.55 }}>{open.completion_note}</p>
              </div>
            )}

            {Array.isArray(open.parts_used) && open.parts_used.length > 0 && (
              <Section title="Parts used" style={{ marginBottom: 0 }}>
                {open.parts_used.map((l) => (
                  <div key={l.part_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: `1px solid ${LINE}` }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: INK, minWidth: 34 }}>{l.quantity} {l.unit}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.part_name} <span style={{ color: MUTE }}>{l.part_number}</span>
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>{money(l.line_value)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 16, marginTop: 11, fontSize: 12, color: SUB }}>
                  <span>Labour {open.actual_hours} h × {money(open.labour_rate || LABOUR_RATE)}/h = <b style={{ color: INK }}>{money(open.labour_cost || 0)}</b></span>
                  <span>Parts <b style={{ color: INK }}>{money(open.parts_cost || 0)}</b></span>
                </div>
              </Section>
            )}
          </div>
        )}
      </Drawer>

      <Modal
        open={completing && Boolean(open)} onClose={() => setCompleting(false)}
        title={`Complete ${open?.work_order_number || ''}`}
        subtitle={open?.title}
        icon={sectionIcon('work-orders', '#15227a')}
        width={620}
        footer={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
            <span style={{ fontSize: 12, color: SUB }}>
              Total <b style={{ color: INK, fontSize: 13.5 }}>{money(totalCost)}</b>
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 9 }}>
              <ActionButton variant="ghost" onClick={() => setCompleting(false)}>Cancel</ActionButton>
              <ActionButton variant="success" disabled={Boolean(shortfall) || incomplete} onClick={confirmComplete}>
                Complete and book parts
              </ActionButton>
            </div>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={miniLabel}>Actual hours</label>
              <input type="number" min={0} step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} style={miniInput} />
            </div>
            <div>
              <label style={miniLabel}>Downtime hours</label>
              <input type="number" min={0} step="0.5" value={downtime} onChange={(e) => setDowntime(e.target.value)} style={miniInput} />
            </div>
          </div>

          <div>
            <label style={miniLabel}>What was done</label>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Findings, what was replaced, anything the next person needs"
              style={{ ...miniInput, resize: 'vertical', fontWeight: 400 }} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ ...miniLabel, marginBottom: 0 }}>Parts used</label>
              <div style={{ marginLeft: 'auto' }}>
                <ActionButton size="sm" variant="subtle" onClick={addLine}>Add part</ActionButton>
              </div>
            </div>

            {!lines.length && (
              <p style={{ margin: 0, fontSize: 12.5, color: MUTE }}>No parts booked. Add a line to draw stock against this job.</p>
            )}

            {lines.map((l) => {
              const part = partById.get(l.part_id)
              const want = Math.floor(Number(l.qty) || 0)
              const over = part && want > part.quantity_on_hand
              return (
                <div key={l.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                  <select value={l.part_id} onChange={(e) => setLine(l.key, { part_id: e.target.value })}
                    style={{ ...miniInput, flex: 1, minWidth: 0 }}>
                    <option value="">Choose a part…</option>
                    {levels.map((p) => (
                      <option key={partIdOf(p)} value={partIdOf(p)}>
                        {p.part_name} — {p.part_number} ({p.quantity_on_hand} {p.unit} on hand)
                      </option>
                    ))}
                  </select>
                  <div style={{ width: 92, flexShrink: 0 }}>
                    <input type="number" min={1} value={l.qty} onChange={(e) => setLine(l.key, { qty: e.target.value })}
                      style={{ ...miniInput, borderColor: over ? '#fecaca' : LINE, color: over ? '#b91c1c' : INK }} />
                    {part && (
                      <span style={{ display: 'block', fontSize: 10.5, color: over ? '#b91c1c' : MUTE, marginTop: 3 }}>
                        {part.quantity_on_hand} {part.unit} on hand
                      </span>
                    )}
                  </div>
                  <span style={{ width: 66, flexShrink: 0, paddingTop: 8, fontSize: 12.5, fontWeight: 700, color: INK, textAlign: 'right' }}>
                    {part ? money((Number(part.unit_cost) || 0) * want) : '—'}
                  </span>
                  <button type="button" onClick={() => dropLine(l.key)} aria-label="Remove line"
                    style={{
                      flexShrink: 0, width: 34, height: 34, borderRadius: 9, cursor: 'pointer',
                      border: `1px solid ${LINE}`, background: '#fff', color: MUTE, fontFamily: 'inherit', fontSize: 14,
                    }}>×</button>
                </div>
              )
            })}
          </div>

          {shortfall && (
            <p style={{
              margin: 0, padding: '9px 12px', fontSize: 12.5, lineHeight: 1.5, borderRadius: 9,
              background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
            }}>
              {shortfall.name}: {shortfall.want} {shortfall.unit} booked but only {shortfall.have} on hand.
              Reduce the line, or receive stock against a purchase order first.
            </p>
          )}

          <div style={{ padding: '12px 14px', borderRadius: 11, background: '#f8fafc', border: `1px solid ${LINE}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: SUB, marginBottom: 5 }}>
              <span>Labour — {labourHours} h at {money(LABOUR_RATE)}/h</span>
              <b style={{ color: INK }}>{money(labourCost)}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: SUB, marginBottom: 8 }}>
              <span>Parts — {booked.length} line{booked.length === 1 ? '' : 's'} at catalogue cost</span>
              <b style={{ color: INK }}>{money(partsCost)}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 800, color: INK, borderTop: `1px solid ${LINE}`, paddingTop: 8 }}>
              <span>Total cost</span>
              <span style={{ color: GREEN }}>{money(totalCost)}</span>
            </div>
          </div>
        </div>
      </Modal>

    </div>
  )
}


const miniLabel = { display: 'block', fontSize: 10, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }
const miniSelect = {
  width: '100%', boxSizing: 'border-box', padding: '7px 9px', fontSize: 12.5, fontWeight: 600,
  border: `1px solid ${LINE}`, borderRadius: 8, background: '#fff', color: '#15227a',
  fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
}
const miniInput = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12.5, fontWeight: 600,
  border: `1px solid ${LINE}`, borderRadius: 9, background: '#fff', color: INK,
  fontFamily: 'inherit', outline: 'none',
}
