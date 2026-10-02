'use client'

// One checklist in the register — the product's card.
//
// A checklist is a template, so what matters on the card is what it will ask
// when somebody walks it: how many items, across how many sections, at what
// asset level, scored how. The name is the button that starts a run, because
// starting one is the thing people come here to do.

import { motion } from 'framer-motion'
import {
  ClipboardCheck, FileText, Layers, MoreVertical, Eye, Play, Archive, Gauge,
} from 'lucide-react'
import { Card, CardHeader, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '../ui/dropdown-menu'
import { fmtDate } from '../lib/data'

const STATUS = {
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  template: 'bg-blue-100 text-blue-800 border-blue-200',
  draft: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  inactive: 'bg-gray-100 text-gray-600 border-gray-300',
  archived: 'bg-gray-100 text-gray-600 border-gray-300',
}

export default function ChecklistCard({
  checklist: c, index = 0, selected = false, onToggleSelect, onOpen, onRun,
}) {
  const status = String(c.status || '').toLowerCase()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.05 }}
      className="h-full"
    >
      <Card
        className="h-full hover:shadow-xl transition-all duration-300 border-slate-200 group relative overflow-hidden bg-gradient-to-br from-white to-slate-50/30 cursor-pointer"
        onClick={() => onOpen?.(c)}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.02] to-purple-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <CardHeader className="pb-3 relative">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start min-w-0 flex-1">
              {onToggleSelect && (
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggleSelect(c)}
                  onClick={(e) => e.stopPropagation()}
                  className="mr-3 mt-1.5 shrink-0 w-4 h-4 accent-primary cursor-pointer"
                />
              )}
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <h3 className="font-semibold text-slate-900 min-w-0 text-lg group-hover:text-primary transition-colors break-words">
                    {c.checklist_name}
                  </h3>
                  {c.status && (
                    <Badge variant="outline" className={`shrink-0 whitespace-nowrap ${STATUS[status] || STATUS.inactive}`}>
                      {c.status}
                    </Badge>
                  )}
                  {c.archived && (
                    <Badge variant="outline" className="shrink-0 whitespace-nowrap bg-gray-100 text-gray-600 border-gray-300">
                      Archived
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-600 font-medium truncate">{c.code}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="w-4 h-4 text-slate-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => onOpen?.(c)}>
                    <Eye className="w-4 h-4 mr-2" />
                    View details
                  </DropdownMenuItem>
                  {onRun && !c.archived && (
                    <DropdownMenuItem onClick={() => onRun(c)}>
                      <Play className="w-4 h-4 mr-2" />
                      Start checklist
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative pt-0 space-y-3">
          <div className="flex items-center gap-4 flex-wrap text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              {c.items} items
            </span>
            <span className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              {c.sections} sections
            </span>
            {c.scoring && (
              <span className="flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-slate-400" />
                {c.scoring}
              </span>
            )}
          </div>

          {c.asset_level && (
            <div className="text-xs text-slate-500">
              Asset level <span className="font-semibold text-slate-800">{c.asset_level}</span>
            </div>
          )}

          {(c.category || c.assigned_to) && (
            <p className="text-xs text-slate-600 leading-relaxed">
              {c.category} checklist for {c.assigned_to}
              {c.runs > 0 ? ` · ${c.runs} completed this session` : ''}
            </p>
          )}

          {c.features?.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {c.features.map((f) => (
                <Badge key={f} variant="outline" className="text-[10px] font-normal bg-slate-50 text-slate-600 border-slate-200">
                  {f}
                </Badge>
              ))}
            </div>
          )}

          {(c.author || c.created) && (
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span className="truncate">{c.author}</span>
              {/* The register stores an ISO timestamp; the footer is a date. */}
              <span className="shrink-0">{fmtDate(c.created)}</span>
            </div>
          )}

          {onRun && !c.archived && (
            <Button
              size="sm" className="w-full gap-1.5"
              onClick={(e) => { e.stopPropagation(); onRun(c) }}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              Start checklist
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
