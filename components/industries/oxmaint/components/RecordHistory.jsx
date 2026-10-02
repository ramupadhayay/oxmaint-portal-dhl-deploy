'use client'

// A record's history — who changed it, when, and what each field was before.
//
// The same panel on every record page, because an auditor asks the same
// question of every record and should not have to learn a different screen to
// get the answer. It reads the append-only trail the records API writes; it
// never writes to it.

import { History } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import {
  useRecordHistory, fieldLabel, showValue, fmtWhen, ACTION_STYLE,
} from '../lib/audit'

export default function RecordHistory({
  kind, recordId, assetId, title = 'Change history', limit = 25, showReference = false,
}) {
  const events = useRecordHistory({ kind, recordId, assetId })
  const shown = events.slice(0, limit)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" />
          {title}
          <span className="ml-auto text-sm font-normal text-slate-500">
            {events.length} {events.length === 1 ? 'entry' : 'entries'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {shown.length === 0 ? (
          <p className="py-4 text-sm text-slate-500">
            No changes recorded yet. Every edit, status change and deletion made in this portal is
            written here with who made it, when, and what each field was before — and cannot be
            edited afterwards.
          </p>
        ) : (
          <ol className="space-y-4">
            {shown.map((e) => (
              <li key={e.recordId} className="relative pl-5">
                <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-slate-300" />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge className={`${ACTION_STYLE[e.action] || 'bg-slate-100 text-slate-700'} text-[11px]`}>
                    {e.action}
                  </Badge>
                  {showReference && (
                    <span className="text-sm font-medium text-slate-900">
                      {e.entity} {e.reference}
                    </span>
                  )}
                  <span className="text-sm text-slate-700">by {e.actor_name}</span>
                  <span className="ml-auto text-xs tabular-nums text-slate-400">{fmtWhen(e.at)}</span>
                </div>

                {e.action === 'status changed' && (
                  <p className="mt-1 text-sm text-slate-600">{e.detail}</p>
                )}

                {Array.isArray(e.changes) && e.changes.length > 0 && (
                  <dl className="mt-1.5 space-y-0.5">
                    {e.changes.filter((c) => c.field !== 'status').map((c) => (
                      <div key={c.field} className="flex flex-wrap gap-x-2 text-[13px] leading-5">
                        <dt className="text-slate-500">{fieldLabel(c.field)}</dt>
                        <dd className="min-w-0 break-words text-slate-800">
                          <span className="text-slate-400 line-through decoration-slate-300">{showValue(c.from)}</span>
                          <span className="mx-1.5 text-slate-400">→</span>
                          <span className="font-medium">{showValue(c.to)}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            ))}
          </ol>
        )}
        {events.length > shown.length && (
          <p className="mt-4 text-xs text-slate-500">
            Showing the latest {shown.length} of {events.length}. The full trail is under Compliance → Audit Trail.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
