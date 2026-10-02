'use client'

// One inspection in the grid — the product's card, rebuilt against this
// portal's data.
//
// Inspections are a grid of cards rather than the work orders' full-width stack,
// which is the product's own distinction and a sound one: a work order is a job
// you read down a queue, an inspection is a result you scan across.
//
// The Start button only appears on an inspection that has not been done, because
// that is the only state in which starting one means anything.

import { motion } from 'framer-motion'
import {
  ClipboardCheck, CheckCircle, XCircle, AlertTriangle, MoreVertical, Eye,
  Play, User, Calendar, FileText,
} from 'lucide-react'
import { Card, CardHeader, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '../ui/dropdown-menu'
import { isPast, fmtDate } from '../lib/data'

const STATUS_COLOR = {
  completed: 'bg-green-100 text-green-800 border-green-200',
  'in progress': 'bg-blue-100 text-blue-800 border-blue-200',
  scheduled: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
}
const FALLBACK = 'bg-slate-100 text-slate-800 border-slate-200'

// The product keys results on Pass / Fail / Conditional. This portal's third
// state is "Pass with observations", which is the same thing said longer, so it
// takes the same amber.
function resultLook(result) {
  const r = String(result || '').toLowerCase()
  if (r === 'pass') return { cls: 'bg-green-100 text-green-800 border-green-200', Icon: CheckCircle }
  if (r === 'fail') return { cls: 'bg-red-100 text-red-800 border-red-200', Icon: XCircle }
  if (r.startsWith('pass')) return { cls: 'bg-yellow-100 text-yellow-800 border-yellow-200', Icon: AlertTriangle }
  return { cls: FALLBACK, Icon: AlertTriangle }
}

const scoreColour = (n) => (n >= 80 ? 'text-green-600' : n >= 60 ? 'text-yellow-600' : 'text-red-600')

/**
 * The score arrives either as a number or, from the list's own presenter, as
 * `{ pct }` — the shape the inline-styled card it replaced wanted. Reading both
 * is cheaper than rewriting the presenter, and rendering the object was a React
 * "objects are not valid as a child" the moment this card met a walked report.
 */
function scoreOf(value) {
  if (typeof value === 'number') return value
  if (value && typeof value.pct === 'number') return value.pct
  return null
}

export default function InspectionCard({ inspection: r, index = 0, onView, onStart }) {
  const status = String(r.status || '').toLowerCase()
  const isDone = status === 'completed'
  const score = scoreOf(r.score)
  const overdue = !isDone && Boolean(r.scheduled_date) && isPast(r.scheduled_date)
  const result = resultLook(r.result)
  const ResultIcon = result.Icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.06 }}
      whileHover={{ y: -2 }}
      className="h-full"
    >
      <Card
        className={`h-full shadow-md hover:shadow-lg transition-all duration-300 border bg-white cursor-pointer relative ${
          overdue ? 'border-orange-300' : 'border-slate-200/60'
        }`}
        onClick={() => onView?.(r)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <div className="p-1.5 bg-primary/10 rounded-md">
                  <ClipboardCheck className="w-4 h-4 text-primary" />
                </div>
                <Badge variant="outline" className={`text-xs ${STATUS_COLOR[status] || FALLBACK}`}>
                  {r.status}
                </Badge>
                {r.result && (
                  <Badge variant="outline" className={`text-xs ${result.cls}`}>
                    <ResultIcon className="w-3 h-3" />
                    <span className="ml-1">{r.result}</span>
                  </Badge>
                )}
                {overdue && (
                  <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-200">
                    Overdue
                  </Badge>
                )}
              </div>

              <h3 className="font-semibold text-lg text-slate-800 mb-1 line-clamp-1">
                {r.inspection_number}
              </h3>
              <p className="text-sm text-slate-600 mb-2 line-clamp-1">
                {r.asset_name || 'Asset not specified'}
              </p>
              {r.inspection_type && (
                <p className="text-xs text-slate-500 line-clamp-2">{r.inspection_type}</p>
              )}
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4 text-slate-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onView?.(r)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View details
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {!isDone && onStart && (
                <Button size="sm" onClick={() => onStart(r)} className="whitespace-nowrap w-full gap-1.5">
                  <Play className="w-3 h-3" />
                  Start
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs text-slate-500">
            <span className="flex items-center gap-1 min-w-0">
              <User className="w-3 h-3 shrink-0" />
              <span className="truncate">{r.inspector_name || 'Unassigned'}</span>
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <Calendar className="w-3 h-3" />
              {fmtDate(r.scheduled_date)}
            </span>
          </div>

          {isDone && (
            <div className="flex items-center justify-between gap-2 mt-2">
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <FileText className="w-3 h-3" />
                {r.findings_count || 0} finding{Number(r.findings_count) === 1 ? '' : 's'}
              </span>
              {score != null && (
                <span className={`text-sm font-bold ${scoreColour(score)}`}>{score}%</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
