'use client'

// One work order in the list — the product's own row, rebuilt against this
// portal's data.
//
// The list is not a table. The product renders a stack of full-width cards, and
// that single fact is most of why this portal looked like a different product:
// a table of ten columns says "records", a card that leads with the title and
// carries its badges, its asset and its dates says "work". The markup, the
// classes, the colour maps and the icon per status below are the product's.
//
// Field names are this portal's (snake_case), which is also the product's
// convention, so most of them line up without translation.

import { motion } from 'framer-motion'
import {
  Wrench, User, Clock, PauseCircle, CheckCircle, AlertTriangle,
  MapPin, Calendar, DollarSign, MoreVertical, Eye, Edit, Trash2, ChevronRight,
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '../ui/dropdown-menu'
import { isPast, daysUntil } from '../lib/data'

// The product's maps, verbatim. Kept as lookups rather than a computed scale so
// a status that is not in the list falls to slate instead of to something
// arbitrary.
const STATUS_COLOR = {
  open: 'bg-blue-100 text-blue-800 border-blue-200',
  assigned: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'in progress': 'bg-orange-100 text-orange-800 border-orange-200',
  'on hold': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  closed: 'bg-slate-100 text-slate-800 border-slate-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
}
const PRIORITY_COLOR = {
  low: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-blue-100 text-blue-800 border-blue-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
  emergency: 'bg-red-200 text-red-900 border-red-300',
}
const STATUS_ICON = {
  open: Wrench,
  assigned: User,
  'in progress': Clock,
  'on hold': PauseCircle,
  completed: CheckCircle,
  closed: CheckCircle,
  cancelled: AlertTriangle,
}
const FALLBACK = 'bg-slate-100 text-slate-800 border-slate-200'

const key = (s) => String(s || '').toLowerCase()
const statusColor = (s) => STATUS_COLOR[key(s)] || FALLBACK
const priorityColor = (p) => PRIORITY_COLOR[key(p)] || FALLBACK

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The product's own date shape — "Sep 3, 2026" — read off the string rather
 *  than through a Date, so a timezone can never move it by a day. */
function shortDate(value) {
  if (!value) return null
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`
}

const money = (n) => (n || n === 0 ? `$${Number(n).toLocaleString('en-US')}` : null)

export default function WorkOrderListItem({
  workOrder: w, index = 0, onView, onEdit, onDelete,
}) {
  const status = key(w.status)
  const StatusIcon = STATUS_ICON[status] || Wrench

  // Overdue is derived, never stored — a row that fell overdue has to say so
  // without anything having written to it. Both helpers measure against the
  // dataset's own EPOCH rather than the wall clock, so the answer is the same on
  // the server and in the browser and nothing hydrates differently.
  const settled = ['completed', 'closed', 'cancelled'].includes(status)
  const isOverdue = Boolean(w.due_date && !settled && isPast(w.due_date))
  const overdueDays = isOverdue ? Math.max(1, Math.abs(daysUntil(w.due_date))) : 0

  const cost = money(w.total_cost)
  const scheduled = shortDate(w.due_date)
  const created = shortDate(w.created_date)

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.05 }}
      className={`bg-white border border-slate-200/60 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 hover:border-primary/20 cursor-pointer ${
        isOverdue ? 'border-l-4 border-l-red-500' : ''
      }`}
      onClick={() => onView?.(w)}
    >
      <div className="p-4 min-h-[60px]">
        <div className="flex items-center justify-between">
          {/* Left — what the work order is */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className={`p-2 rounded-lg shrink-0 ${isOverdue ? 'bg-red-100' : 'bg-primary/10'}`}>
              <StatusIcon className={`w-4 h-4 ${isOverdue ? 'text-red-600' : 'text-primary'}`} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 min-w-0">
                <h3 className="font-semibold text-lg shrink min-w-0 mr-1 text-slate-800 truncate" title={w.title}>
                  {w.title}
                </h3>
                <Badge variant="outline" className={`text-xs ${statusColor(w.status)}`}>{w.status}</Badge>
                {w.priority && (
                  <Badge variant="outline" className={`text-xs ${priorityColor(w.priority)}`}>{w.priority}</Badge>
                )}
                {w._created && (
                  <Badge variant="outline" className="text-xs bg-violet-100 text-violet-800 border-violet-200">
                    Raised in this portal
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm text-slate-600 mb-2">
                <span className="font-medium">{w.work_order_number}</span>
                {w.assigned_to_name && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span className="truncate max-w-[150px]">{w.assigned_to_name}</span>
                  </span>
                )}
                {w.work_order_type && (
                  <span className="flex items-center gap-1">
                    <Wrench className="w-3 h-3" />
                    {w.work_order_type}
                  </span>
                )}
              </div>

              {w.asset_name && (
                <div className="flex items-start gap-1.5 mb-2 text-sm">
                  <Wrench className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs font-normal max-w-full whitespace-normal break-words text-left">
                      {w.asset_name}{w.asset_code ? ` (${w.asset_code})` : ''}
                    </Badge>
                  </div>
                </div>
              )}

              {(w.location_name || w.site_name) && (
                <div className="mb-2 flex items-center gap-1.5 text-sm">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-slate-600">
                    {[w.site_name, w.location_name].filter(Boolean).join(' · ')}
                  </span>
                </div>
              )}

              {w.description && (
                <p className="text-sm text-slate-500 line-clamp-1 mb-2">{w.description}</p>
              )}
            </div>
          </div>

          {/* Middle — the numbers, dropped on a narrow window */}
          <div className="hidden lg:flex items-center gap-8 px-6">
            {cost && (
              <div className="text-center">
                <div className="flex items-center gap-1 text-xs mb-1 text-slate-500">
                  <DollarSign className="w-3 h-3" />
                  Cost
                </div>
                <div className="font-semibold text-sm text-slate-800">{cost}</div>
              </div>
            )}
            {scheduled && (
              <div className="text-center">
                <div className="flex items-center gap-1 text-xs mb-1 text-slate-500">
                  <Calendar className="w-3 h-3" />
                  Due
                </div>
                <div className="font-semibold text-sm text-slate-800">{scheduled}</div>
              </div>
            )}
            {created && (
              <div className="text-center">
                <div className="flex items-center gap-1 text-xs mb-1 text-slate-500">
                  <Calendar className="w-3 h-3" />
                  Created
                </div>
                <div className="font-semibold text-sm text-slate-800">{created}</div>
              </div>
            )}
            {isOverdue && (
              <div className="text-center">
                <div className="flex items-center gap-1 text-xs mb-1 text-red-500">
                  <AlertTriangle className="w-3 h-3" />
                  Overdue by
                </div>
                <div className="font-semibold text-sm text-red-600">
                  {overdueDays} {overdueDays === 1 ? 'day' : 'days'}
                </div>
              </div>
            )}
          </div>

          {/* Right — the actions. Stops the click so the row does not also open. */}
          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-11 w-11 p-0 flex items-center justify-center">
                  <MoreVertical className="h-5 w-5 text-slate-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onView?.(w)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </DropdownMenuItem>
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(w)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onDelete && status !== 'completed' && (
                  <DropdownMenuItem
                    onClick={() => onDelete(w)}
                    disabled={!w._created}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>
        </div>
      </div>
    </motion.div>
  )
}
