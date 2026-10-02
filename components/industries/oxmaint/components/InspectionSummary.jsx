'use client'

// The six tiles above the inspection list — the product's own, and deliberately
// a different shape from the work-order tiles: a round tinted icon on the right,
// the value with a rate badge beside it, and six across rather than five.
//
// Like the work-order tiles they are a filter, and for the same reason the count
// and the filter come from one predicate: a tile that says 12 and a list that
// then shows 9 is a screen nobody trusts again.

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ClipboardCheck, CheckCircle, Clock, XCircle, AlertTriangle, Settings2,
} from 'lucide-react'
import { Card, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuCheckboxItem,
} from '../ui/dropdown-menu'

const STORAGE_KEY = 'inspectionVisibleCards'
const ALL = ['total', 'completed', 'pending', 'passed', 'failed', 'overdue']

// Look only. The numbers and the predicates behind them belong to the page,
// which already owns them for its own filtering — computing them a second time
// here is how a tile came to read 32 while the rate card beside it said 28.
export function inspectionCards() {
  return [
    { id: 'total', title: 'Total', icon: ClipboardCheck, color: 'text-blue-600', bgColor: 'bg-blue-100', borderColor: 'border-blue-200' },
    { id: 'completed', title: 'Completed', icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100', borderColor: 'border-green-200', rate: 'completion' },
    { id: 'pending', title: 'Pending', icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-100', borderColor: 'border-yellow-200' },
    { id: 'passed', title: 'Passed', icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100', borderColor: 'border-green-200', rate: 'pass' },
    { id: 'failed', title: 'Failed', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100', borderColor: 'border-red-200' },
    { id: 'overdue', title: 'Overdue', icon: AlertTriangle, color: 'text-orange-600', bgColor: 'bg-orange-100', borderColor: 'border-orange-200' },
  ]
}

export default function InspectionSummary({ counts = {}, completionPct, passPct, activeCard, onCardClick }) {
  const [visible, setVisible] = useState(() => new Set(ALL))

  // After mount only: localStorage does not exist on the server and a set that
  // differs between the two renders is a hydration mismatch.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setVisible(new Set(JSON.parse(saved)))
    } catch { /* private mode */ }
  }, [])

  const toggle = (id) => setVisible((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])) } catch {}
    return next
  })

  const cards = inspectionCards()
  const shown = cards.filter((c) => visible.has(c.id))

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Summary Cards ({visible.size} visible)
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Select cards to display</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {cards.map((c) => (
              <DropdownMenuCheckboxItem key={c.id} checked={visible.has(c.id)} onCheckedChange={() => toggle(c.id)}>
                {c.title}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {shown.map((c, index) => {
          const Icon = c.icon
          const value = counts[c.id] ?? 0
          const rate = c.rate === 'completion' ? completionPct : c.rate === 'pass' ? passPct : undefined
          const pct = Number.isFinite(rate) ? Math.round(rate) : undefined
          const isActive = activeCard === c.id || (c.id === 'total' && !activeCard)
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(index, 5) * 0.1 }}
            >
              <Card
                className={`border transition-all duration-200 hover:shadow-md cursor-pointer hover:border-blue-300 ${
                  isActive ? 'border-blue-500 ring-2 ring-blue-200 shadow-lg' : c.borderColor
                }`}
                onClick={() => onCardClick?.(c.id === 'total' || isActive ? null : c.id)}
              >
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center justify-between gap-2 overflow-hidden">
                    <div className="min-w-0">
                      <p className="text-[10px] md:text-sm font-medium text-slate-600 truncate">{c.title}</p>
                      <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
                        <p className="text-lg md:text-2xl font-bold text-slate-900 truncate">{value}</p>
                        {pct > 0 && pct <= 100 && (
                          <Badge variant="secondary" className={`text-[10px] md:text-xs ${c.bgColor} ${c.color} border-0 flex-shrink-0`}>
                            {pct}%
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className={`p-1.5 md:p-2 rounded-full ${c.bgColor} flex-shrink-0`}>
                      <Icon className={`h-4 w-4 md:h-5 md:w-5 ${c.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
