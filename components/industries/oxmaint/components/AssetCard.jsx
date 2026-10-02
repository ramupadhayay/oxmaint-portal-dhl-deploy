'use client'

// One asset in the grid, and one asset in the list — the product ships both.
//
// The toggle is not decoration. A card carries the health bar and the location,
// which is what somebody browsing a plant wants; a row fits twice as many assets
// on a screen, which is what somebody looking for a specific one wants. The
// product gives you the switch because those are two different jobs.
//
// Health is the figure that decides whether an asset is worth opening, so it is
// the one drawn rather than written — a bar reads at a glance across thirty
// cards, and a number does not.

import { motion } from 'framer-motion'
import { Cpu, MapPin, Radio, ChevronRight, Wrench } from 'lucide-react'
import { Card, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { Progress } from '../ui/progress'
import { fmtDate, isPast } from '../lib/data'

const STATUS = {
  Operational: 'bg-green-100 text-green-700',
  'Under Maintenance': 'bg-amber-100 text-amber-800',
  Down: 'bg-red-100 text-red-700',
}
const CRIT = {
  High: 'border-red-200 bg-red-50 text-red-700',
  Medium: 'border-amber-200 bg-amber-50 text-amber-700',
  Low: 'border-slate-200 bg-slate-50 text-slate-600',
}

const tone = (n) => (n >= 80 ? 'text-green-600' : n >= 60 ? 'text-amber-600' : 'text-red-600')

export function AssetCard({ asset: a, index = 0, onOpen }) {
  const down = a.status === 'Down'
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index, 10) * 0.04 }}
      className="h-full"
    >
      <Card
        onClick={() => onOpen(a)}
        className={`h-full cursor-pointer border transition-all hover:shadow-md hover:border-indigo-200 ${down ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <div className="font-mono text-[11px] text-slate-400">{a.asset_code}</div>
              <h3 className="font-semibold text-sm text-slate-900 leading-snug line-clamp-2 mt-0.5" title={a.asset_name}>
                {a.asset_name}
              </h3>
            </div>
            <Badge variant="secondary" className={`shrink-0 text-[10px] px-1.5 py-0 ${STATUS[a.status] || ''}`}>
              {a.status}
            </Badge>
          </div>

          <div className="space-y-1 mb-3 text-xs text-slate-500">
            <div className="flex items-center gap-1.5 truncate">
              <Cpu className="w-3 h-3 shrink-0" />
              <span className="truncate">{a.asset_type}</span>
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{a.functional_location_name}</span>
            </div>
          </div>

          <div className="mb-3">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[11px] text-slate-500">Health</span>
              <span className={`text-xs font-bold ${tone(a.health_score)}`}>{a.health_score}%</span>
            </div>
            <Progress value={a.health_score} className="h-1.5" />
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-900/5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${CRIT[a.criticality] || ''}`}>
                {a.criticality}
              </Badge>
              {a.iot_enabled && <Radio className="w-3 h-3 text-blue-500" title="IoT connected" />}
            </div>
            <span className={`text-[11px] ${isPast(a.next_maintenance_date) ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
              <Wrench className="w-3 h-3 inline mr-1" />
              {fmtDate(a.next_maintenance_date)}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function AssetListItem({ asset: a, onOpen }) {
  const down = a.status === 'Down'
  return (
    <button
      type="button" onClick={() => onOpen(a)}
      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left cursor-pointer transition-colors hover:border-indigo-200 hover:bg-slate-50 ${down ? 'border-red-200 bg-red-50/30' : 'border-slate-200 bg-white'}`}
    >
      <span className="w-28 shrink-0 font-mono text-xs font-semibold text-indigo-700 truncate">{a.asset_code}</span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-900">{a.asset_name}</span>
        <span className="block truncate text-xs text-slate-400">{a.asset_type} · {a.functional_location_name}</span>
      </span>

      <span className="hidden w-32 shrink-0 sm:block">
        <span className="flex items-baseline justify-between mb-0.5">
          <span className="text-[10px] text-slate-400">Health</span>
          <span className={`text-[11px] font-bold ${tone(a.health_score)}`}>{a.health_score}%</span>
        </span>
        <Progress value={a.health_score} className="h-1" />
      </span>

      <Badge variant="outline" className={`hidden shrink-0 text-[10px] px-1.5 py-0 md:inline-flex ${CRIT[a.criticality] || ''}`}>
        {a.criticality}
      </Badge>
      <Badge variant="secondary" className={`shrink-0 text-[10px] px-1.5 py-0 ${STATUS[a.status] || ''}`}>
        {a.status}
      </Badge>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
    </button>
  )
}
