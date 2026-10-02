'use client'

// One job on a technician's own queue — the product's card.
//
// The product draws this differently from the work order list, and the reason is
// worth keeping. A list is for a planner deciding what to schedule, so it reads
// as columns you can scan and compare. This is for the person holding a spanner,
// so it reads as one job at a time with the next action on it: the tinted border
// tells them it is late before they read a word, and the button under it is the
// only thing they can do from here.
//
// Which button that is comes from the tab, not from the row. On Pending there is
// exactly one move — start it. In Progress offers finishing it or attaching what
// you photographed. Done offers nothing, because a finished job is a record, not
// a task. Showing all three everywhere and greying two out would put the same
// decision back on the reader that the tabs just took away.

import { motion } from 'framer-motion'
import {
  AlertTriangle, Camera, CheckCircle2, ChevronRight, Clock, Loader2, Play, Wrench,
} from 'lucide-react'
import { Card, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'

const PRIORITY = {
  Critical: 'bg-red-50 text-red-700 border-red-200',
  High: 'bg-orange-50 text-orange-700 border-orange-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Low: 'bg-slate-50 text-slate-600 border-slate-200',
}

export default function TaskCard({
  task: w, tab, overdue, index = 0, formatDate,
  busy, onStart, onComplete, onUpload, onOpen,
}) {
  const loading = busy === w._id

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 10) * 0.05 }}
    >
      <Card className={`overflow-hidden border h-full ${overdue ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 border ${PRIORITY[w.priority] || PRIORITY.Medium}`}>
                {w.priority}
              </Badge>
              <span className="text-xs text-slate-400 font-mono shrink-0">#{w.work_order_number}</span>
              {overdue && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">
                  <AlertTriangle className="w-3 h-3 mr-0.5" />
                  Overdue
                </Badge>
              )}
            </div>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">{w.status}</Badge>
          </div>

          {/* The title opens the full work order. Everything else on the card is
              a shortcut; this is the way through to the whole record.

              `border-0 bg-transparent p-0 cursor-pointer` is not decoration.
              Tailwind is loaded here without preflight — the five inline-styled
              portals in this repo would be rewritten by it — so a bare <button>
              keeps the browser's own chrome and draws a grey box around the
              title. Every raw button in this portal has to undo that itself; the
              ui/button component already does. */}
          <button
            type="button"
            onClick={() => onOpen?.(w)}
            className="text-left w-full border-0 bg-transparent p-0 cursor-pointer font-medium text-slate-900 text-sm leading-snug mb-1 line-clamp-2 hover:text-indigo-700 transition-colors"
            title={w.title}
          >
            {w.title}
          </button>

          {w.asset_name && (
            <p className="text-xs text-slate-500 mb-2 truncate">
              <Wrench className="w-3 h-3 inline mr-1" />
              {w.asset_code ? `${w.asset_name} (${w.asset_code})` : w.asset_name}
            </p>
          )}

          <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
            {w.created_date && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(w.created_date)}
              </span>
            )}
            {w.due_date && (
              <span className={`flex items-center gap-1 ${overdue ? 'text-red-600 font-semibold' : ''}`}>
                <ChevronRight className="w-3 h-3" />
                {formatDate(w.due_date)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {tab === 'pending' && (
              <Button size="sm" disabled={loading} onClick={() => onStart(w)} className="h-8 text-xs">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Play className="w-3.5 h-3.5 mr-1.5" />}
                Start
              </Button>
            )}

            {tab === 'in-progress' && (
              <>
                <Button
                  size="sm" disabled={loading} onClick={() => onComplete(w)}
                  className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                  Complete
                </Button>
                <Button size="sm" variant="outline" disabled={loading} onClick={() => onUpload(w)} className="h-8 text-xs">
                  <Camera className="w-3.5 h-3.5 mr-1.5" />
                  Upload Proof
                </Button>
              </>
            )}

            {tab === 'done' && (
              <div className="flex items-center gap-1.5 text-xs text-green-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Completed{w.completed_date ? ` ${formatDate(w.completed_date)}` : ''}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
