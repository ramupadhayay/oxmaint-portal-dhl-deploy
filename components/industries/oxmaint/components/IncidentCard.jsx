'use client'

// One incident in the grid — the product's card.
//
// The card itself is tinted by severity rather than only carrying a badge, which
// is the product's own choice and a sound one: a wall of incidents should read at
// a glance, and a critical one should not have to be found by reading.
//
// Lost time is called out separately from severity because they are different
// questions. A low-severity incident that put someone off work is a reportable
// event; a high-severity near miss that hurt nobody is not.

import { motion } from 'framer-motion'
import {
  AlertTriangle, AlertCircle, CheckCircle, Timer, User, Calendar, Wrench,
  MapPin, MoreVertical, Eye, ChevronRight,
} from 'lucide-react'
import { Card, CardHeader, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '../ui/dropdown-menu'
import { fmtDate } from '../lib/data'

const SEVERITY = {
  Low: { badge: 'bg-green-100 text-green-800 border-green-200', tint: 'bg-green-50 border-green-200' },
  Medium: { badge: 'bg-yellow-100 text-yellow-800 border-yellow-200', tint: 'bg-yellow-50 border-yellow-200' },
  High: { badge: 'bg-orange-100 text-orange-800 border-orange-200', tint: 'bg-orange-50 border-orange-200' },
  Critical: { badge: 'bg-red-100 text-red-800 border-red-200', tint: 'bg-red-50 border-red-200' },
}

const STATUS = {
  Open: { cls: 'bg-blue-100 text-blue-700', Icon: AlertCircle },
  'Under Review': { cls: 'bg-green-100 text-green-700', Icon: AlertCircle },
  'Under Investigation': { cls: 'bg-green-100 text-green-700', Icon: AlertCircle },
  Resolved: { cls: 'bg-teal-100 text-teal-700', Icon: CheckCircle },
  Closed: { cls: 'bg-slate-100 text-slate-600', Icon: CheckCircle },
  Draft: { cls: 'bg-slate-100 text-slate-700', Icon: Timer },
}

export default function IncidentCard({ incident: r, index = 0, onView }) {
  const sev = SEVERITY[r.severity] || SEVERITY.Medium
  const st = STATUS[r.status] || STATUS.Draft
  const StatusIcon = st.Icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.06 }}
      whileHover={{ y: -2 }}
      className="h-full"
    >
      <Card
        className={`h-full transition-all duration-200 hover:shadow-lg border cursor-pointer ${sev.tint}`}
        onClick={() => onView?.(r)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant="outline" className={`text-xs gap-1 ${sev.badge}`}>
                  <AlertTriangle className="w-3 h-3" />
                  {r.severity}
                </Badge>
                <Badge variant="secondary" className={`text-xs gap-1 ${st.cls}`}>
                  <StatusIcon className="w-3 h-3" />
                  {r.status}
                </Badge>
                {r.lost_time && (
                  <Badge variant="outline" className="text-xs bg-rose-100 text-rose-800 border-rose-200">
                    Lost time
                  </Badge>
                )}
              </div>

              <h3 className="font-semibold text-lg text-slate-800 mb-1 line-clamp-2" title={r.title}>
                {r.title}
              </h3>
              <p className="text-sm text-slate-600">{r.incident_number}</p>
            </div>

            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="w-4 h-4 text-slate-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onView?.(r)}>
                    <Eye className="w-4 h-4 mr-2" />
                    View details
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-2">
          {r.asset_name && (
            <div className="flex items-center gap-1.5 text-sm text-slate-700">
              <Wrench className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{r.asset_name}</span>
            </div>
          )}
          {r.site_name && (
            <div className="flex items-center gap-1.5 text-sm text-slate-700">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{r.site_name}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-900/5 text-xs text-slate-600">
            <span className="flex items-center gap-1 min-w-0">
              <User className="w-3 h-3 shrink-0" />
              <span className="truncate">{r.reported_by_name || 'Unknown'}</span>
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <Calendar className="w-3 h-3" />
              {fmtDate(r.reported_date)}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
