'use client'

// One inspection reminder in the register — the product's card.
//
// The product draws a reminder as a wide card rather than a table row because a
// reminder is read for four different reasons at once: who walks it, when it is
// next due, what it is against, and how often it repeats. A row forces those
// into columns of equal weight; the card lets the recurrence sit in its own
// tinted block, which is the part people actually argue about.
//
// Two shapes live here. ReminderCard is the register — everything about a
// standing reminder. NextDueCard is the queue — the same reminder read only for
// when, tinted by how close that is.

import { motion } from 'framer-motion'
import {
  Bell, User, MapPin, CheckCircle2, Package, Eye, Repeat, MoreVertical,
  ClipboardList, Calendar, AlertTriangle, Play, FileCheck,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '../ui/dropdown-menu'
import { fmtDate, isPast, daysUntil } from '../lib/data'
import { itemCount, FREQUENCY_DAYS } from '../lib/inspectionItems'

const Fact = ({ icon: Icon, label, children }) => (
  <div className="flex items-start gap-2 text-sm min-w-0">
    <Icon className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
    {label && <span className="font-medium shrink-0">{label}:</span>}
    <span className="text-gray-600 truncate">{children}</span>
  </div>
)

export function ReminderCard({ reminder: r, index = 0, onView, onStart }) {
  const late = isPast(r.next_due)
  const paused = r.status === 'Paused'
  const away = daysUntil(r.next_due)
  const every = FREQUENCY_DAYS[r.frequency] || 30
  const cadence = every === 1 ? 'every day' : `every ${every} days`

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.05 }}
      className="h-full"
    >
      <Card
        className="h-full shadow-md hover:shadow-lg transition-all duration-300 border border-slate-200/60 bg-white cursor-pointer"
        onClick={() => onView?.(r)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl font-semibold text-primary-900 mb-1 break-words whitespace-normal">
                {r.inspection_type} ({r.reminder_id || r.recordId})
                <div className="flex items-center gap-2 mt-1 text-sm">
                  <span className="text-gray-500">Checklist:</span>
                  <span className="font-medium text-gray-500">
                    {itemCount(r.inspection_type)} items, walked {cadence}
                  </span>
                </div>
              </CardTitle>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Overdue outranks Active. A reminder can be both, and the one
                  worth reading from across the room is the one that has slipped. */}
              <Badge className={late ? 'bg-red-500' : paused ? 'bg-gray-300' : 'bg-green-500'}>
                {late ? 'Overdue' : r.status}
              </Badge>
              <Badge variant="outline" className="text-sm">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Auto Generate
              </Badge>

              <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100 bg-slate-50/50">
                      <MoreVertical className="h-4 w-4 text-slate-600" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onView?.(r)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onStart?.(r)} disabled={paused}>
                      <Play className="mr-2 h-4 w-4" />
                      Start inspection
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Fact icon={User}>{r.assigned_to_name || '-'}</Fact>
            <Fact icon={Bell} label="Notification">
              {r.notify_days_before} day{r.notify_days_before > 1 ? 's' : ''} before
            </Fact>
            <Fact icon={Calendar} label="Next Due Date">{fmtDate(r.next_due)}</Fact>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Fact icon={Package} label="Asset">{r.asset_name} ({r.asset_code || '-'})</Fact>
            <Fact icon={MapPin} label="Location">{r.site_name || '-'}</Fact>
            <Fact icon={CheckCircle2} label="Last completed">{fmtDate(r.last_completed)}</Fact>
          </div>

          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border-l-4 border-blue-200">
            <Repeat className="w-4 h-4 text-blue-500 inline-block mr-3" />
            <span className="font-medium">Recurrence Schedule (1):</span>
            <div className="mt-2 space-y-1">
              1. {r.frequency} — {cadence}, on {r.asset_name}
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-gray-500">
              {late
                ? `${Math.abs(away)} day${Math.abs(away) === 1 ? '' : 's'} late`
                : `Due in ${away} day${away === 1 ? '' : 's'}`}
            </div>
            <Button
              variant="secondary" size="sm" disabled={paused}
              className="disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={(e) => { e.stopPropagation(); onStart?.(r) }}
            >
              <ClipboardList className="w-4 h-4 mr-1" />
              Create Inspection
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* ── the queue card ───────────────────────────────────────────────────────── */

const PRIORITY = [
  { max: -1, label: 'Overdue', badge: 'bg-red-500', text: 'text-red-600 font-semibold', tint: 'border-red-200 bg-red-50/30', alert: 'bg-red-50 border-red-400 text-red-800', note: 'This reminder is overdue and requires immediate attention' },
  { max: 3, label: 'Urgent', badge: 'bg-orange-500', text: 'text-orange-600 font-semibold', tint: 'border-orange-200 bg-orange-50/30', alert: 'bg-orange-50 border-orange-400 text-orange-800', note: 'This reminder is due very soon' },
  { max: 7, label: 'Soon', badge: 'bg-yellow-500', text: 'text-yellow-600 font-semibold', tint: 'border-yellow-200 bg-yellow-50/30', alert: 'bg-yellow-50 border-yellow-400 text-yellow-800', note: 'This reminder is approaching its due date' },
  { max: Infinity, label: 'Upcoming', badge: 'bg-green-500', text: 'text-green-600 font-semibold', tint: '', alert: '', note: '' },
]

export function NextDueCard({ reminder: r, index = 0, onView }) {
  const away = r._daysAway
  const p = PRIORITY.find((x) => away <= x.max)
  const overdue = away < 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.05 }}
      className="h-full"
    >
      <Card
        className={`h-full hover:shadow-md transition-shadow cursor-pointer ${p.tint}`}
        onClick={() => onView?.(r)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-semibold text-primary-900 mb-2 break-words whitespace-normal">
                {r.inspection_type} ({r.reminder_id || r.recordId})
              </CardTitle>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Fact icon={User}>{r.assigned_to_name || '-'}</Fact>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className="font-medium min-w-[80px]">Due Date:</span>
                  <span className={p.text}>{fmtDate(r.next_due)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge className={p.badge}>
                {overdue && <AlertTriangle className="w-3 h-3 mr-1" />}
                {p.label}
              </Badge>
              <div onClick={(e) => e.stopPropagation()}>
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
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Fact icon={FileCheck} label="Checklist">{itemCount(r.inspection_type)} items</Fact>
            <Fact icon={Package} label="Asset">{r.asset_name} ({r.asset_code || '-'})</Fact>
            <Fact icon={MapPin} label="Location">{r.site_name || '-'}</Fact>
            <Fact icon={Repeat} label="Frequency">{r.frequency}</Fact>
          </div>

          {away <= 7 && (
            <div className={`p-3 rounded-lg border-l-4 ${p.alert}`}>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium text-sm">{p.note}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default ReminderCard
