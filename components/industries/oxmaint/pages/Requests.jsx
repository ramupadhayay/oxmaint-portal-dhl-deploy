'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw, Plus, Search, ClipboardList, Clock, Pause, CheckCircle, XCircle,
  AlertTriangle, BarChart3,
} from 'lucide-react'
import {
  PageHeader, StatStrip, Toolbar, DataTable, Drawer, Modal, Fields, StatusBadge,
  Priority, ActionButton, PALETTE,
} from '../lib/kit'
import { Button } from '../ui/button'
import StatTiles from '../components/StatTiles'
import RequestCard from '../components/RequestCard'
import { sectionIcon } from '../lib/nav'
import { useRecords, useStore } from '../lib/store'
import { useActions } from '../lib/actions'
import { CreateModal } from '../lib/forms'
import { useSite } from '../lib/siteStore'
import { REQUESTS, USER, daysFrom, fmtDate } from '../lib/data'

const { MUTE, SUB, INK, LINE } = PALETTE

const idOf = (r) => r.request_id || r.recordId

// The two states in which the request desk still owes the requester an answer.
const UNDECIDED = ['Pending', 'In Review']

// Each tile carries the predicate that both counts it and filters the grid.
// "Awaiting work order" is the one worth having: a request approved and then
// never raised reads as settled on every other screen while no work exists.
const REQUEST_CARDS = [
  { id: 'total', title: 'Total Requests', icon: BarChart3, color: 'bg-slate-500', description: 'All requests in this site scope', total: true },
  { id: 'pending', title: 'Pending', icon: Clock, color: 'bg-yellow-500', description: 'Not yet looked at', match: (r) => r.status === 'Pending' },
  { id: 'in_review', title: 'In Review', icon: Pause, color: 'bg-slate-600', description: 'Being assessed by the desk', match: (r) => r.status === 'In Review' },
  { id: 'awaiting_wo', title: 'Awaiting Work Order', icon: AlertTriangle, color: 'bg-amber-600', description: 'Approved, but nothing raised yet', match: (r) => r.status === 'Approved' && !r.work_order_number },
  { id: 'raised', title: 'Work Order Raised', icon: CheckCircle, color: 'bg-green-600', description: 'Turned into a job', match: (r) => r.status === 'Work Order Raised' },
  { id: 'denied', title: 'Denied', icon: XCircle, color: 'bg-red-600', description: 'Refused, with a reason recorded', match: (r) => r.status === 'Denied' },
]

export default function Requests() {
  const { scope, siteName } = useSite()
  const { create, update, notify } = useStore()
  const { raiseWorkOrder } = useActions()
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState('all')
  const [openId, setOpenId] = useState(null)
  const [denying, setDenying] = useState(false)
  const [reason, setReason] = useState('')
  // Which summary tile is narrowing the grid, if any.
  const [card, setCard] = useState(null)

  const merged = useRecords('request', REQUESTS, idOf)
  const all = useMemo(() => scope(merged), [scope, merged])

  // The drawer reads the request out of the live list rather than holding its
  // own copy, so the work order number appears the moment it is raised instead
  // of on the next time the row is opened.
  const open = useMemo(() => merged.find((r) => idOf(r) === openId) || null, [merged, openId])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((r) => (
      (status === 'all' || r.status === status) &&
      (priority === 'all' || r.priority === priority) &&
      (!q || [r.request_number, r.title, r.asset_name, r.requested_by_name].join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, status, priority])

  const undecided = open ? UNDECIDED.includes(open.status) : false
  // An approved request that never became a job is the request nobody chases:
  // it reads as dealt with on every screen and no work exists behind it.
  const approvedNoOrder = Boolean(open && open.status === 'Approved' && !open.work_order_number)

  const approve = async () => {
    if (!open) return
    const wo = await raiseWorkOrder({
      type: 'Corrective',
      priority: open.priority,
      assetId: open.asset_id,
      title: open.title,
      description: open.description,
      source: `Request ${open.request_number}`,
    })
    // If the work order could not be saved the request stays where it was.
    // Marking it converted with nothing to convert to is worse than leaving it
    // in the queue.
    if (!wo) return
    await update('request', idOf(open), {
      status: 'Work Order Raised',
      work_order_number: wo.work_order_number,
      decided_by_name: USER.name,
      decision_date: daysFrom(0),
    })
    notify(`${wo.work_order_number} raised from ${open.request_number}.`)
  }

  const deny = async () => {
    const text = reason.trim()
    if (!open || !text) return
    await update('request', idOf(open), {
      status: 'Denied',
      denial_reason: text,
      decided_by_name: USER.name,
      decision_date: daysFrom(0),
    })
    setDenying(false)
    setReason('')
  }

  const columns = [
    { key: 'request_number', label: 'Ref', render: (r) => <span style={{ fontWeight: 700, color: '#15227a' }}>{r.request_number}</span> },
    { key: 'title', label: 'Request', render: (r) => <span style={{ display: 'block', maxWidth: 290, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.title}>{r.title}</span> },
    { key: 'asset_name', label: 'Asset' },
    { key: 'requested_by_name', label: 'Requested by' },
    { key: 'created_date', label: 'Raised', sortValue: (r) => new Date(r.created_date).getTime(), render: (r) => fmtDate(r.created_date) },
    { key: 'priority', label: 'Priority', render: (r) => <Priority value={r.priority} /> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge>{r.status}</StatusBadge> },
    { key: 'work_order_number', label: 'Work order', render: (r) => (r.work_order_number ? <span style={{ fontWeight: 700, color: '#15227a' }}>{r.work_order_number}</span> : '—') },
  ]

  // The tile filter sits on top of the toolbar's, so picking one narrows what
  // the search and selects have already left.
  const cardMatch = REQUEST_CARDS.find((c) => c.id === card)?.match
  const shown = cardMatch ? rows.filter(cardMatch) : rows

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:justify-between md:items-start lg:items-center gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Maintenance Requests</h1>
          <p className="text-slate-600 mt-1">Review what the floor has asked for, and turn it into work</p>
        </div>
        <div className="flex w-full flex-nowrap items-center gap-3 overflow-x-auto pb-1 lg:w-auto lg:overflow-visible lg:pb-0">
          <Button variant="outline" className="h-10 px-4 gap-2"
            onClick={() => { setSearch(''); setStatus('all'); setPriority('all'); setCard(null); notify('Filters cleared.') }}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button className="h-10 px-4 gap-2" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" />
            Raise Request
          </Button>
        </div>
      </motion.div>

      <StatTiles
        rows={all} activeCard={card} onCardClick={setCard}
        storageKey="oxRequestSummaryCards"
        cards={REQUEST_CARDS}
      />

      <div className="bg-white border border-slate-200/60 rounded-lg shadow-sm p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1 min-w-[220px] basis-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference, request, asset, requester…"
              className="w-full h-10 pl-9 pr-3 rounded-md border border-slate-200 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
            />
          </div>
          {[
            { label: 'Status', value: status, set: setStatus, options: ['Pending', 'In Review', 'Approved', 'Work Order Raised', 'Denied'] },
            { label: 'Priority', value: priority, set: setPriority, options: ['Critical', 'High', 'Medium', 'Low'] },
          ].map((f) => (
            <select key={f.label} value={f.value} onChange={(e) => f.set(e.target.value)}
              className="h-10 px-3 shrink-0 w-[170px] rounded-md border border-slate-200 text-sm bg-white outline-none focus:border-primary/40">
              <option value="all">{f.label}: All</option>
              {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}
          <span className="text-sm text-slate-500 whitespace-nowrap">{shown.length} shown</span>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="bg-white border border-slate-200/60 rounded-lg shadow-sm p-12 text-center">
          <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-800 mb-1">No requests found</h3>
          <p className="text-sm text-slate-500">No maintenance requests match these filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((r, n) => (
            <RequestCard key={idOf(r)} request={r} index={n} onView={(x) => setOpenId(idOf(x))} />
          ))}
        </div>
      )}

      <Drawer open={Boolean(open)} onClose={() => setOpenId(null)} title={open?.request_number} subtitle={open?.title}
        icon={sectionIcon('requests', '#15227a')} width={500}
        footer={open && (undecided || approvedNoOrder) ? (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
            {undecided && (
              <ActionButton variant="ghost" onClick={() => { setReason(''); setDenying(true) }}>Deny</ActionButton>
            )}
            {open.status === 'Pending' && (
              <ActionButton variant="subtle" onClick={() => update('request', idOf(open), { status: 'In Review' })}>Put in review</ActionButton>
            )}
            <ActionButton variant="success" onClick={approve}>
              {undecided ? 'Approve & raise work order' : 'Raise work order'}
            </ActionButton>
          </div>
        ) : null}>
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <StatusBadge>{open.status}</StatusBadge>
              <StatusBadge>{open.priority}</StatusBadge>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: SUB, lineHeight: 1.55 }}>{open.description}</p>

            {open.status === 'Denied' && (
              <div style={{ padding: '11px 13px', borderRadius: 11, background: '#fef2f2', border: '1px solid #fecaca' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: 0.4 }}>Reason for denial</div>
                <p style={{ margin: '5px 0 0', fontSize: 12.5, color: open.denial_reason ? '#7f1d1d' : '#b91c1c', lineHeight: 1.5, fontStyle: open.denial_reason ? 'normal' : 'italic' }}>
                  {open.denial_reason || 'No reason was recorded. The requester was told no and not told why.'}
                </p>
              </div>
            )}

            {open.status === 'Work Order Raised' && open.work_order_number && (
              <div style={{ padding: '11px 13px', borderRadius: 11, background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                <div style={{ fontSize: 12.5, color: '#065f46' }}>
                  Converted to <strong style={{ fontWeight: 800 }}>{open.work_order_number}</strong>
                  {open.decided_by_name ? ` by ${open.decided_by_name}` : ''}. Track it on the Work Orders screen.
                </div>
              </div>
            )}

            <Fields rows={[
              ['Asset', open.asset_name],
              ['Site', open.site_name],
              ['Requested by', open.requested_by_name],
              ['Raised', fmtDate(open.created_date)],
              ['Work order', open.work_order_number || 'Not yet raised'],
              ['Decided by', open.decided_by_name || '—'],
              open.decision_date ? ['Decided', fmtDate(open.decision_date)] : null,
            ]} />
          </div>
        )}
      </Drawer>

      {/* A denial without a reason is the thing requesters escalate over, so the
          reason is asked for at the point of denial rather than left optional. */}
      <Modal open={denying} onClose={() => setDenying(false)} title="Deny request" subtitle={open?.request_number}
        icon={sectionIcon('requests', '#15227a')} width={480}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <ActionButton variant="ghost" onClick={() => setDenying(false)}>Cancel</ActionButton>
            <ActionButton variant="danger" disabled={!reason.trim()} onClick={deny}>Deny request</ActionButton>
          </div>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.55 }}>
            {open?.requested_by_name} will see this on the request. Say what would change the answer.
          </p>
          <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 }}>Reason</label>
          <textarea
            value={reason} onChange={(e) => setReason(e.target.value)} rows={4}
            placeholder="Covered by the PM due next week — no separate job needed."
            style={{
              width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
              border: `1px solid ${LINE}`, borderRadius: 9, outline: 'none', resize: 'vertical',
              fontFamily: 'inherit', color: INK, background: '#fff', lineHeight: 1.5,
            }} />
        </div>
      </Modal>

      <CreateModal kind="request" open={creating} onClose={() => setCreating(false)}
        onSubmit={(values) => create('request', values)} />
    </div>
  )
}
