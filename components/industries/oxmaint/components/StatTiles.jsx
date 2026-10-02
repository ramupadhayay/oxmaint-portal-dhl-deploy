'use client'

// The product's summary tiles, as one component the screens share.
//
// Work orders and inspections each grew their own copy while their screens were
// being rebuilt, and a third and fourth copy for requests and PM schedules would
// be four places to fix a padding. The tiles differ between screens only in what
// they count, so that is the only thing passed in.
//
// Each card carries the predicate that both counts it and filters the list, for
// the reason that keeps coming back: a tile reading 12 above a list showing 9 is
// a screen nobody trusts twice.

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Settings2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuCheckboxItem,
} from '../ui/dropdown-menu'

export default function StatTiles({
  cards, rows, activeCard, onCardClick, storageKey, defaultVisible,
}) {
  const [visible, setVisible] = useState(() => new Set(defaultVisible || cards.map((c) => c.id)))

  // After mount only: localStorage does not exist on the server, and a set that
  // differs between the two renders is a hydration mismatch.
  useEffect(() => {
    if (!storageKey) return
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) setVisible(new Set(JSON.parse(saved)))
    } catch { /* private mode */ }
  }, [storageKey])

  const toggle = (id) => setVisible((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    if (storageKey) { try { localStorage.setItem(storageKey, JSON.stringify([...next])) } catch {} }
    return next
  })

  const shown = cards.filter((c) => visible.has(c.id))

  const valueOf = (c) => {
    if (typeof c.value === 'function') return c.value(rows)
    if (c.value !== undefined) return c.value
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

      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 items-stretch">
        {shown.map((c, index) => {
          const Icon = c.icon
          const isActive = activeCard === c.id || (c.total && !activeCard)
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(index, 6) * 0.1 }}
              className="h-full"
            >
              <Card
                className={`h-full flex flex-col transition-all duration-200 hover:shadow-lg border cursor-pointer hover:border-blue-300 ${
                  isActive ? 'border-blue-500 ring-2 ring-blue-200 shadow-lg' : 'border-slate-200/60'
                }`}
                onClick={() => onCardClick?.(c.total || isActive || !c.match ? null : c.id)}
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
