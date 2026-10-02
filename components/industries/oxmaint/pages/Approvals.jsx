'use client'

// Approvals — everything waiting on somebody's decision, from four screens at
// once, rebuilt on the product's cards.
//
// What was already right and is kept: the decision is read back off the record
// it was written to rather than held in this screen's state, so approving a
// purchase order on the Purchase Orders screen means it has already left this
// queue by the time you walk back here. And what a decision *means* differs by
// what is being decided — a rejected work order has to be cancelled, or it walks
// straight back into the backlog it just came out of.
//
// What changed: the decision lives on the card now. It was a table that opened a
// drawer to reveal Approve and Reject, which is two clicks and a context switch
// for a judgement somebody has usually already made by the time they arrive. The
// record still opens; the answer no longer requires it.
//
// The tabs are Pending / Approved / Rejected rather than the four request types.
// Type is what a request *is*; decision state is what you are here to change,
// and a queue should be organised around the thing you came to do. Type stayed
// as a filter beside them.

import { useCallback, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw, Download, ClipboardCheck, Clock, Check, X, AlertTriangle, DollarSign,
} from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import { Tabs as ShadTabs, TabsList, TabsTrigger } from '../ui/tabs'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../ui/select'
import StatTiles from '../components/StatTiles'
import ApprovalCard from '../components/ApprovalCard'
import { Drawer, Fields, StatusBadge, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { useStore } from '../lib/store'
import { USER, fmtDate, daysUntil, money } from '../lib/data'
import { APPROVALS, APPROVAL_TYPES } from '../lib/dataMaint'

const { SUB } = PALETTE

const DECISION_TONE = { Pending: 'amber', Approved: 'green', Rejected: 'red' }
const TYPE_TONE = {
  'Work Order': 'blue', 'Purchase Order': 'violet', Scrap: 'grey', 'Work Permit': 'green',
}

// What a decision means differs by what is being decided, and getting it wrong
// is worse than not having the button: a rejected critical work order left Open
// walks straight back into the backlog it just came out of, and an approved
// permit that stays Pending never reaches the permit board.
const OUTCOME = {
  work_order: {
    Approved: { approval_status: 'Approved' },
    Rejected: { approval_status: 'Rejected', status: 'Cancelled' },
  },
  purchase_order: {
    Approved: { approval_status: 'Approved', status: 'Approved' },
    Rejected: { approval_status: 'Rejected', status: 'Cancelled' },
  },
  scrap: {
    Approved: { approval_status: 'Approved', status: 'Approved' },
    Rejected: { approval_status: 'Rejected', status: 'Denied' },
  },
  permit: {
    Approved: { approval_status: 'Approved', status: 'Active' },
    Rejected: { approval_status: 'Rejected', status: 'Closed' },
  },
}

const TABS = [
  { key: 'Pending', label: 'Pending', Icon: Clock },
  { key: 'Approved', label: 'Approved', Icon: Check },
  { key: 'Rejected', label: 'Rejected', Icon: X },
]

const STALE_DAYS = 7

const CARDS = [
  { id: 'pending', title: 'Awaiting decision', icon: ClipboardCheck, color: 'bg-amber-500', description: 'Across all four queues', total: true },
  { id: 'stale', title: 'Waiting over a week', icon: AlertTriangle, color: 'bg-red-500', description: 'Stuck, not just queued' },
  { id: 'value', title: 'Value awaiting', icon: DollarSign, color: 'bg-indigo-500', description: 'Committed if approved' },
  { id: 'approved', title: 'Approved', icon: Check, color: 'bg-green-500', description: 'Decided in this portal' },
  { id: 'rejected', title: 'Rejected', icon: X, color: 'bg-slate-500', description: 'Decided in this portal' },
]

export default function Approvals() {
  const { scope, siteName } = useSite()
  const store = useStore()
  const { records, update, notify } = store

  const [tab, setTab] = useState('Pending')
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [openId, setOpenId] = useState(null)
  const [busy, setBusy] = useState('')

  // The decision is read back off the record it was written to rather than held
  // in this screen's state.
  const all = useMemo(() => scope(APPROVALS).map((a) => {
    const stored = (records?.[a.source_kind] || []).find((r) => r.recordId === a.source_id)
    return {
      ...a,
      status: stored?.approval_status || a.status,
      decided_by_name: stored?.approved_by_name || null,
      decided_date: stored?.approval_date || null,
    }
  }), [scope, records])

  const open = useMemo(() => all.find((a) => a.approval_id === openId) || null, [all, openId])
  const pending = useMemo(() => all.filter((a) => a.status === 'Pending'), [all])

  const counts = {
    pending: pending.length,
    stale: pending.filter((a) => Math.abs(daysUntil(a.raised_date)) > STALE_DAYS).length,
    value: money(pending.reduce((n, a) => n + (a.value || 0), 0)),
    approved: all.filter((a) => a.status === 'Approved').length,
    rejected: all.filter((a) => a.status === 'Rejected').length,
  }

  const byTab = useMemo(() => {
    const out = {}
    for (const t of TABS) {
      out[t.key] = all
        .filter((a) => a.status === t.key)
        // Longest-waiting first: a queue should put what is stuck at the top,
        // not what arrived last.
        .sort((a, b) => new Date(a.raised_date) - new Date(b.raised_date))
    }
    return out
  }, [all])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (byTab[tab] || []).filter((a) => (
      (type === 'all' || a.type === type) &&
      (!q || [a.reference, a.title, a.requested_by_name, a.approver_name]
        .join(' ').toLowerCase().includes(q))
    ))
  }, [byTab, tab, search, type])

  const decide = useCallback(async (approval, outcome) => {
    setBusy(approval.approval_id)
    try {
      await update(approval.source_kind, approval.source_id, {
        ...OUTCOME[approval.source_kind][outcome],
        approved_by_name: USER.name,
        approval_date: new Date().toISOString(),
      })
      notify(`${approval.reference} ${outcome.toLowerCase()}.`)
      setOpenId(null)
    } finally {
      setBusy('')
    }
  }, [update, notify])

  const exportCsv = () => {
    const cols = ['Type', 'Reference', 'Request', 'Requested by', 'Value', 'Raised', 'Approver', 'Status']
    const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
    const body = rows.map((a) => [
      a.type, a.reference, a.title, a.requested_by_name,
      a.value || '', fmtDate(a.raised_date), a.approver_name, a.status,
    ].map(cell).join(','))
    const csv = `﻿${[cols.join(','), ...body].join('\r\n')}`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const el = document.createElement('a')
    el.href = url
    el.download = `approvals-${tab.toLowerCase()}.csv`
    document.body.appendChild(el)
    el.click()
    el.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    notify(`${rows.length} row${rows.length === 1 ? '' : 's'} exported.`)
  }

  const clearAll = () => { setSearch(''); setType('all'); setTab('Pending') }

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Approvals</h1>
          <p className="text-slate-600 mt-1 text-sm md:text-base">
            {pending.length} awaiting a decision · {siteName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <Button variant="outline" className="h-10 px-4 gap-2" onClick={clearAll}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button variant="outline" className="h-10 px-4 gap-2" onClick={exportCsv} disabled={!rows.length}>
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </motion.div>

      <StatTiles
        rows={all}
        storageKey="oxApprovalSummaryCards"
        cards={CARDS.map((c) => ({ ...c, value: counts[c.id] }))}
      />

      <ShadTabs value={tab} onValueChange={setTab}>
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reference, request or requester…"
          className="h-10 sm:max-w-md"
        />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-10 sm:w-56"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {APPROVAL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-500 sm:ml-auto">{rows.length} shown</span>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Nothing here</p>
          <p className="text-slate-400 text-sm mt-1">
            {tab === 'Pending' ? 'Nothing is waiting on you.' : `Nothing has been ${tab.toLowerCase()} yet.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.map((a, i) => (
            <ApprovalCard
              key={a.approval_id}
              approval={a}
              index={i}
              busy={busy}
              onOpen={(x) => setOpenId(x.approval_id)}
              onDecide={decide}
            />
          ))}
        </div>
      )}

      <Drawer
        open={Boolean(open)} onClose={() => setOpenId(null)}
        title={open?.reference}
        subtitle={open?.title}
        icon={sectionIcon('approvals', '#15227a')}
        width={480}
      >
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatusBadge tone={TYPE_TONE[open.type]}>{open.type}</StatusBadge>
              <StatusBadge tone={DECISION_TONE[open.status]}>{open.status}</StatusBadge>
            </div>

            <p style={{ margin: 0, fontSize: 13, color: SUB, lineHeight: 1.55 }}>{open.title}</p>

            <Fields rows={[
              ['Type', open.type],
              ['Reference', open.reference],
              ['Requested by', open.requested_by_name],
              ['Raised', fmtDate(open.raised_date)],
              ['Waiting', `${Math.abs(daysUntil(open.raised_date))} days`],
              ['Value', open.value ? money(open.value) : 'No cost committed'],
              ['Approver', open.approver_name],
              ['Decision', open.status],
              open.decided_by_name && ['Decided by', open.decided_by_name],
              open.decided_date && ['Decided on', fmtDate(open.decided_date)],
            ]} />

            {open.status === 'Pending' && (
              <div className="flex gap-2">
                <Button
                  disabled={Boolean(busy)} onClick={() => decide(open, 'Approved')}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Approve
                </Button>
                <Button
                  variant="outline" disabled={Boolean(busy)} onClick={() => decide(open, 'Rejected')}
                  className="text-red-600 hover:bg-red-50"
                >
                  <X className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
