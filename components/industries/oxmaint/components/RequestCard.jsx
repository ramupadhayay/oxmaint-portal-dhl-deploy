'use client'

// One maintenance request in the grid — the product's card.
//
// A request is a question waiting on an answer, so the card leads with what was
// asked and shows plainly where it has got to: still waiting, refused, or turned
// into a job with the work order's own number on it. That last line matters —
// an approved request with no work order behind it reads as dealt with on every
// screen while no work exists, and the card is where that shows.

import { motion } from 'framer-motion'
import {
  Clock, Pause, CheckCircle, AlertTriangle, XCircle, User, Calendar, Wrench,
  MapPin, ChevronRight, ClipboardList,
} from 'lucide-react'
import { Card, CardHeader, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { fmtDate } from '../lib/data'

const STATUS = {
  pending: { cls: 'bg-yellow-100 text-yellow-800 border-yellow-200', Icon: Clock },
  'in review': { cls: 'bg-slate-100 text-slate-800 border-slate-200', Icon: Pause },
  approved: { cls: 'bg-blue-100 text-blue-800 border-blue-200', Icon: CheckCircle },
  'work order raised': { cls: 'bg-green-100 text-green-800 border-green-200', Icon: CheckCircle },
  denied: { cls: 'bg-red-100 text-red-800 border-red-200', Icon: AlertTriangle },
}
const PRIORITY = {
  low: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-blue-100 text-blue-800 border-blue-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
}
const FALLBACK = 'bg-slate-100 text-slate-800 border-slate-200'

export default function RequestCard({ request: r, index = 0, onView }) {
  const key = String(r.status || '').toLowerCase()
  const look = STATUS[key] || { cls: FALLBACK, Icon: Clock }
  const StatusIcon = look.Icon

  // Approved, but nothing was ever raised against it. This is the request that
  // falls through the gap, so it is called out rather than left to look settled.
  const stalled = r.status === 'Approved' && !r.work_order_number

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.06 }}
      whileHover={{ y: -2 }}
      className="h-full"
    >
      <Card
        className={`h-full shadow-md hover:shadow-lg transition-all duration-300 border bg-white cursor-pointer ${
          stalled ? 'border-amber-300' : 'border-slate-200/60'
        }`}
        onClick={() => onView?.(r)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <div className="p-1.5 bg-primary/10 rounded-md">
                  <ClipboardList className="w-4 h-4 text-primary" />
                </div>
                <Badge variant="outline" className={`text-xs gap-1 ${look.cls}`}>
                  <StatusIcon className="w-3 h-3" />
                  {r.status}
                </Badge>
                {r.priority && (
                  <Badge variant="outline" className={`text-xs ${PRIORITY[String(r.priority).toLowerCase()] || FALLBACK}`}>
                    {r.priority}
                  </Badge>
                )}
                {stalled && (
                  <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-200">
                    No work order
                  </Badge>
                )}
              </div>

              <h3 className="font-semibold text-lg text-slate-800 mb-1 line-clamp-1" title={r.title}>
                {r.title}
              </h3>
              <p className="text-sm text-slate-600 mb-1">{r.request_number}</p>
              {r.description && (
                <p className="text-xs text-slate-500 line-clamp-2">{r.description}</p>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-2">
          {r.asset_name && (
            <div className="flex items-center gap-1.5 text-sm text-slate-600">
              <Wrench className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{r.asset_name}</span>
            </div>
          )}
          {r.site_name && (
            <div className="flex items-center gap-1.5 text-sm text-slate-600">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{r.site_name}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span className="flex items-center gap-1 min-w-0">
              <User className="w-3 h-3 shrink-0" />
              <span className="truncate">{r.requested_by_name || 'Unknown'}</span>
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <Calendar className="w-3 h-3" />
              {fmtDate(r.created_date)}
            </span>
          </div>

          {r.work_order_number && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-md px-2 py-1">
              <CheckCircle className="w-3 h-3 shrink-0" />
              Raised as {r.work_order_number}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
