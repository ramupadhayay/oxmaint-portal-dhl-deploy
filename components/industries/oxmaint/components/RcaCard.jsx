'use client'

// One root cause analysis in the register — the product's card.
//
// The product leads with two judgements rather than with the reference number:
// has this happened before, and was the asset in an acceptable state. Those are
// the questions a reliability engineer scans a wall of analyses for, and they
// are the two the record can answer without being opened.
//
// The heading is the cause category, not the failure. An RCA filed under the
// wrong category is worse than no RCA, so the category is the thing put at eye
// level where somebody will argue with it.

import { motion } from 'framer-motion'
import {
  Brain, DollarSign, MoreVertical, Eye, Link2, AlertTriangle, Wrench,
} from 'lucide-react'
import { Card, CardHeader, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '../ui/dropdown-menu'
import { fmtDate, money } from '../lib/data'

const STATUS = {
  Open: 'bg-amber-100 text-amber-800 border-amber-200',
  'In Review': 'bg-blue-100 text-blue-800 border-blue-200',
  Closed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
}

const Fact = ({ icon: Icon, label, children }) => (
  <div className="flex items-center gap-2 text-sm min-w-0">
    <Icon className="w-4 h-4 text-slate-400 shrink-0" />
    <span className="text-slate-600 shrink-0">{label}:</span>
    <span className="font-medium text-slate-800 truncate">{children}</span>
  </div>
)

export default function RcaCard({ rca: r, index = 0, onView }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.06 }}
      whileHover={{ y: -2 }}
      className="h-full"
    >
      <Card
        className="h-full shadow-md hover:shadow-lg transition-all duration-300 border border-slate-200/60 bg-white cursor-pointer"
        onClick={() => onView?.(r)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <Badge className={`text-sm border ${r.is_recurring_issue
                ? 'text-red-800 bg-red-200' : 'text-green-800 bg-green-200'}`}>
                {r.is_recurring_issue ? 'Recurring Issue' : 'Non-Recurring Issue'}
              </Badge>

              {r.asset_condition_satisfactory === false && (
                <Badge className="text-sm border text-orange-800 bg-orange-200 gap-1">
                  <AlertTriangle className="w-4 h-4 text-red-800" />
                  Asset Unsatisfactory
                </Badge>
              )}
            </div>

            <div onClick={(e) => e.stopPropagation()} className="shrink-0">
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

          <h3 className="font-semibold text-lg text-slate-800 mb-1 line-clamp-1" title={r.root_cause_category}>
            {r.root_cause_category}
          </h3>
          <p className="text-sm text-slate-600 line-clamp-2 mb-3">{r.root_cause_description}</p>
        </CardHeader>

        <CardContent className="pt-0 space-y-2">
          <div className="space-y-3 mb-2">
            {r.work_order_number && (
              <Fact icon={Link2} label="Linked Work Order">{r.work_order_number}</Fact>
            )}
            {r.inspection_number && (
              <Fact icon={Link2} label="Linked Inspection">{r.inspection_number}</Fact>
            )}
            <Fact icon={Wrench} label="Asset">{r.asset_name}</Fact>
            <Fact icon={Brain} label="Analysis Method">{r.method}</Fact>
            <Fact icon={DollarSign} label="Estimated Cost Impact">
              {money(r.estimated_cost_impact)}
            </Fact>
            <div className="flex items-center gap-2 text-sm">
              <Wrench className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-slate-600">Corrective Actions:</span>
              <Badge variant="secondary" className="ml-1 h-5 px-2 text-xs">{r.actions.length}</Badge>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div className="text-xs text-slate-500 truncate">
              Created by {r.owner} on {fmtDate(r.raised)}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Status is not on the product's card — the product's RCA has no
                  status field. This register does, and an analysis nobody has
                  closed out is the reason to scan the list at all. It sits in
                  the footer rather than beside the two judgement badges, which
                  the product gives the whole first row to. */}
              <Badge variant="outline" className={`text-xs ${STATUS[r.status] || ''}`}>
                {r.status}
              </Badge>
              <div className="text-xs text-slate-500">{r.reference}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
