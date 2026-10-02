'use client'

// One preventive schedule in the grid — the product's card.
//
// A PM schedule is a promise about the future, so the card is built around when
// it next falls due and whether that date has already passed. Everything else —
// the asset, the interval, who it lands on, how long it is expected to take —
// is the detail behind that one fact.

import { motion } from 'framer-motion'
import {
  CalendarClock, Repeat, Wrench, User, Clock, AlertTriangle, PauseCircle,
  CheckCircle, ChevronRight, Gauge,
} from 'lucide-react'
import { Card, CardHeader, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { fmtDate, daysUntil } from '../lib/data'
import { dueState, frequencyLabel } from '../lib/pmSchedule'

// `assets` is the live register, passed down rather than read here: the card is
// rendered once per schedule, and one merge in the page beats one per card.
// Left out, it falls back to the seeded hours — which is what every caller was
// effectively doing, and why a meter-based schedule never went red.
export default function PmScheduleCard({ schedule: p, index = 0, onView, onGenerate, generatedToday = false, assets }) {
  const paused = p.status === 'Paused'
  const due = dueState(p, assets)
  const overdue = Boolean(due?.due)
  const days = daysUntil(p.next_due)
  const dueSoon = !paused && !overdue && days <= 7

  /**
   * Overdue, in the units of whichever trigger got there.
   *
   * The card printed the calendar distance whatever the reason, so a lift past
   * its 500-hour service with its date still a month out read "Overdue by 26
   * days" — where 26 days was how long it had left, not how late it was. On a
   * dual-trigger schedule that is not a rounding error, it is the opposite of
   * the truth.
   */
  const hoursPast = due?.byMeter?.due ? Math.max(0, -Math.round(due.byMeter.hoursRemaining)) : null
  const dayWord = `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`
  const overdueLabel = due?.byTime?.due
    ? `Overdue by ${dayWord}${hoursPast ? ` and ${hoursPast} h` : ''}`
    : `Overdue by ${hoursPast ?? 0} h on the meter`

  // The interval, said the way a planner says it — including the dual trigger,
  // which the card used to render as a calendar interval with the word "run"
  // stuck on the end of it.
  const interval = frequencyLabel(p)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.06 }}
      whileHover={{ y: -2 }}
      className="h-full"
    >
      <Card
        className={`h-full shadow-md hover:shadow-lg transition-all duration-300 border bg-white cursor-pointer ${
          overdue ? 'border-red-300' : dueSoon ? 'border-amber-300' : 'border-slate-200/60'
        }`}
        onClick={() => onView?.(p)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <div className="p-1.5 bg-primary/10 rounded-md">
                  <CalendarClock className="w-4 h-4 text-primary" />
                </div>
                <Badge variant="outline" className={`text-xs gap-1 ${
                  paused
                    ? 'bg-slate-100 text-slate-800 border-slate-200'
                    : 'bg-green-100 text-green-800 border-green-200'
                }`}>
                  {paused ? <PauseCircle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                  {p.status}
                </Badge>
                <Badge variant="outline" className="text-xs gap-1 bg-blue-100 text-blue-800 border-blue-200">
                  {p.frequency_type === 'Meter' ? <Gauge className="w-3 h-3" /> : <Repeat className="w-3 h-3" />}
                  {p.frequency_type}
                </Badge>
                {overdue && (
                  <Badge variant="outline" className="text-xs gap-1 bg-red-100 text-red-800 border-red-200">
                    <AlertTriangle className="w-3 h-3" />
                    Overdue
                  </Badge>
                )}
              </div>

              <h3 className="font-semibold text-lg text-slate-800 mb-1 line-clamp-2" title={p.schedule_name}>
                {p.schedule_name}
              </h3>
              <p className="text-xs text-slate-500">{interval}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-2">
          <div className="flex items-center gap-1.5 text-sm text-slate-600">
            <Wrench className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">
              {p.asset_name}{p.asset_code ? ` (${p.asset_code})` : ''}
            </span>
          </div>

          <div className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium ${
            overdue
              ? 'bg-red-50 text-red-700 border border-red-200'
              : dueSoon
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-slate-50 text-slate-700 border border-slate-200'
          }`}>
            <CalendarClock className="w-3.5 h-3.5 shrink-0" />
            {overdue ? overdueLabel : `Next due ${fmtDate(p.next_due)}`}
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span className="flex items-center gap-1 min-w-0">
              <User className="w-3 h-3 shrink-0" />
              <span className="truncate">{p.assigned_to_name || 'Unassigned'}</span>
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <Clock className="w-3 h-3" />
              {p.estimated_hours} h
            </span>
          </div>

          {/* The register keeps its one-click action. Without it, raising a due
              job would mean opening the schedule first — an extra screen for the
              thing a planner does most often on this page. */}
          {onGenerate && (
            <Button
              size="sm" variant="outline" className="w-full gap-1.5 h-8 text-xs"
              disabled={generatedToday || paused}
              title={
                paused ? 'A paused schedule raises nothing until it is resumed.'
                  : generatedToday ? 'This schedule was already generated today.'
                    : 'Raise a Preventive work order and roll the schedule on.'
              }
              onClick={(e) => { e.stopPropagation(); onGenerate(p) }}
            >
              <Wrench className="w-3 h-3" />
              {generatedToday ? 'Generated today' : 'Generate work order'}
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
