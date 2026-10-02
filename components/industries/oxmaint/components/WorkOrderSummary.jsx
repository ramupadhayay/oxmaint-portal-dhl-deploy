'use client'

// The stat tiles above the work-order list — the product's own, including the
// part people miss: the tiles are a FILTER. Clicking one narrows the list and
// the tile takes a ring; clicking it again, or clicking Total, clears it.
//
// Which tiles are on screen is the reader's choice, kept in localStorage under
// the product's own key so a supervisor who only cares about cost sees cost.
//
// Three of the product's eleven have no basis in this portal's data — it has no
// approval workflow, no billing flag and no EHS risk score — and a tile that can
// only ever read zero is worse than one that is not there. Those three are
// replaced by counts this data can actually stand behind (overdue, on hold,
// inspections), keeping the shape and losing the fiction.

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  FileText, Zap, AlertTriangle, Shield, Wrench, Clock, DollarSign,
  TrendingUp, PauseCircle, Search, Settings2,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuCheckboxItem,
} from '../ui/dropdown-menu'
import { isPast } from '../lib/data'

const STORAGE_KEY = 'workOrderVisibleCards'

const DEFAULT_VISIBLE = ['total_work_orders', 'high_priority', 'overdue_work_orders', 'total_cost', 'critical_work_orders']

const money = (n) => `$${Math.round(n || 0).toLocaleString('en-US')}`

/** The eleven tiles, each with the predicate that both counts it and filters the
 *  list — one definition, so the number on the tile and the rows behind it can
 *  never disagree. */
export function cardDefinitions() {
  const settled = (w) => ['completed', 'closed', 'cancelled'].includes(String(w.status).toLowerCase())
  const overdue = (w) => Boolean(w.due_date && !settled(w) && isPast(w.due_date))

  return [
    { id: 'total_work_orders', title: 'Total Work Orders', icon: FileText, color: 'bg-slate-500', description: 'All work orders in this site scope', match: null },
    { id: 'high_priority', title: 'High Priority', icon: Zap, color: 'bg-yellow-500', description: 'Critical and high priority', match: (w) => ['high', 'critical'].includes(String(w.priority).toLowerCase()) },
    { id: 'critical_work_orders', title: 'Critical Work Orders', icon: AlertTriangle, color: 'bg-red-600', description: 'Critical priority work orders', match: (w) => String(w.priority).toLowerCase() === 'critical' },
    { id: 'overdue_work_orders', title: 'Overdue', icon: AlertTriangle, color: 'bg-red-700', description: 'Past due and still open', match: overdue },
    { id: 'preventive_work_orders', title: 'Preventive', icon: Shield, color: 'bg-green-600', description: 'Preventive maintenance work orders', match: (w) => w.work_order_type === 'Preventive' },
    { id: 'corrective_work_orders', title: 'Corrective', icon: Wrench, color: 'bg-blue-600', description: 'Corrective maintenance work orders', match: (w) => w.work_order_type === 'Corrective' },
    { id: 'breakdown_work_orders', title: 'Breakdown', icon: Zap, color: 'bg-red-500', description: 'Unplanned breakdown work', match: (w) => w.work_order_type === 'Breakdown' },
    { id: 'inspection_work_orders', title: 'Inspection', icon: Search, color: 'bg-cyan-600', description: 'Inspection work orders', match: (w) => w.work_order_type === 'Inspection' },
    { id: 'on_hold_work_orders', title: 'On Hold', icon: PauseCircle, color: 'bg-yellow-600', description: 'Started and since paused', match: (w) => String(w.status).toLowerCase() === 'on hold' },
    { id: 'cost_overruns', title: 'Cost Overruns', icon: TrendingUp, color: 'bg-red-800', description: 'Actual hours past the estimate', match: (w) => Number(w.actual_hours || 0) > Number(w.estimated_hours || 0) && Number(w.estimated_hours || 0) > 0 },
    { id: 'total_cost', title: 'Total Cost', icon: DollarSign, color: 'bg-emerald-500', description: 'Costs booked against these work orders', match: null, total: true },
  ]
}

export default function WorkOrderSummary({ rows, activeCard, onCardClick }) {
  const [visible, setVisible] = useState(() => new Set(DEFAULT_VISIBLE))

  // Read after mount only. localStorage does not exist on the server, and a set
  // that differs between the two renders is a hydration mismatch.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setVisible(new Set(JSON.parse(saved)))
    } catch { /* private mode, or something else wrote nonsense there */ }
  }, [])

  const toggle = (id) => setVisible((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])) } catch {}
    return next
  })

  const cards = cardDefinitions()
  const shown = cards.filter((c) => visible.has(c.id))

  const valueOf = (c) => {
    if (c.total) return money(rows.reduce((sum, w) => sum + Number(w.total_cost || 0), 0))
    if (!c.match) return rows.length
    return rows.filter(c.match).length
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Summary Cards ({visible.size} visible)
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Select Cards to Display</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {cards.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.id}
                checked={visible.has(c.id)}
                onCheckedChange={() => toggle(c.id)}
              >
                {c.title}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 items-stretch">
        {shown.map((c, index) => {
          const Icon = c.icon
          const isActive = activeCard === c.id || (c.id === 'total_work_orders' && !activeCard)
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(index, 6) * 0.1 }}
              className="h-full"
            >
              <Card
                className={`h-full flex flex-col transition-all duration-200 hover:shadow-lg border cursor-pointer hover:border-blue-300 ${
                  isActive ? 'border-blue-500 ring-2 ring-blue-200 shadow-lg' : 'border-slate-200/60'
                }`}
                onClick={() => {
                  // Total clears; clicking the active tile clears; anything else
                  // becomes the filter.
                  if (c.id === 'total_work_orders' || c.total || isActive) onCardClick?.(null)
                  else onCardClick?.(c.id)
                }}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">{c.title}</CardTitle>
                  <div className={`p-2 rounded-lg ${c.color}`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900 mb-1">{valueOf(c)}</div>
                  <p className="text-xs text-slate-500">{c.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
