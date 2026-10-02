'use client'

// One thing waiting on a decision — the product's card.
//
// The decision lives on the card, not behind it. This screen was a table that
// opened a drawer to reveal an Approve and a Reject button, which is two clicks
// and a context switch for a judgement somebody has usually already made by the
// time they arrive: they know whether that purchase order is fine. The row still
// opens for the full record, but the answer does not require it.
//
// How long it has been waiting is the one figure that changes behaviour here, so
// it is the one that turns red. A queue sorted by value tells you what is
// expensive; a queue that shows what has been sitting eleven days tells you what
// is stuck, and stuck is the failure an approvals screen exists to prevent.

import { motion } from 'framer-motion'
import {
  AlertTriangle, Calendar, Check, ChevronRight, Clock, Loader2, User, X,
} from 'lucide-react'
import { Card, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { fmtDate, daysUntil, money } from '../lib/data'

const TYPE = {
  'Work Order': 'bg-blue-50 text-blue-700 border-blue-200',
  'Purchase Order': 'bg-violet-50 text-violet-700 border-violet-200',
  Scrap: 'bg-slate-50 text-slate-600 border-slate-200',
  'Work Permit': 'bg-green-50 text-green-700 border-green-200',
}

// Named rather than left to a shared table, which has never seen "Rejected" and
// would draw a refusal in the same neutral grey it uses for a draft.
const DECISION = {
  Pending: 'bg-amber-100 text-amber-800',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
}

// A week is where a request stops being in a queue and starts being ignored.
const STALE_DAYS = 7

export default function ApprovalCard({ approval: a, index = 0, busy, onOpen, onDecide }) {
  const waiting = Math.abs(daysUntil(a.raised_date))
  const stale = a.status === 'Pending' && waiting > STALE_DAYS
  const loading = busy === a.approval_id

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.05 }}
      className="h-full"
    >
      <Card className={`h-full border transition-shadow hover:shadow-md ${stale ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
        <CardContent className="p-4 flex flex-col h-full">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 border ${TYPE[a.type] || TYPE.Scrap}`}>
                {a.type}
              </Badge>
              <span className="text-xs text-slate-400 font-mono shrink-0">{a.reference}</span>
              {stale && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">
                  <AlertTriangle className="w-3 h-3 mr-0.5" />
                  {waiting}d waiting
                </Badge>
              )}
            </div>
            <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 shrink-0 ${DECISION[a.status] || ''}`}>
              {a.status}
            </Badge>
          </div>

          <button
            type="button"
            onClick={() => onOpen?.(a)}
            title={a.title}
            className="text-left w-full border-0 bg-transparent p-0 cursor-pointer font-medium text-slate-900 text-sm leading-snug mb-2 line-clamp-2 hover:text-indigo-700 transition-colors"
          >
            {a.title}
          </button>

          <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1">
            <span className="flex items-center gap-1 min-w-0">
              <User className="w-3 h-3 shrink-0" />
              <span className="truncate">{a.requested_by_name}</span>
            </span>
            {/* A permit commits no money, so a bare $0 would read as a costing
                error rather than as "not applicable". */}
            <span className="font-semibold text-slate-800 shrink-0">
              {a.value ? money(a.value) : '—'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {fmtDate(a.raised_date)}
            </span>
            {a.status === 'Pending' && !stale && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {waiting}d waiting
              </span>
            )}
            <span className="flex items-center gap-1 min-w-0">
              <ChevronRight className="w-3 h-3 shrink-0" />
              <span className="truncate">{a.approver_name}</span>
            </span>
          </div>

          <div className="mt-auto flex items-center gap-2 flex-wrap">
            {a.status === 'Pending' ? (
              <>
                <Button
                  size="sm" disabled={loading} onClick={() => onDecide(a, 'Approved')}
                  className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
                  Approve
                </Button>
                <Button
                  size="sm" variant="outline" disabled={loading} onClick={() => onDecide(a, 'Rejected')}
                  className="h-8 text-xs text-red-600 hover:bg-red-50"
                >
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Reject
                </Button>
              </>
            ) : (
              <span className={`flex items-center gap-1.5 text-xs ${a.status === 'Approved' ? 'text-green-600' : 'text-red-600'}`}>
                {a.status === 'Approved' ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                {a.status}
                {a.decided_by_name ? ` by ${a.decided_by_name}` : ''}
                {a.decided_date ? ` · ${fmtDate(a.decided_date)}` : ''}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
