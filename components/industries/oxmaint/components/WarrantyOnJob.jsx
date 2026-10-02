'use client'

// Warranty, seen from the job that paid for the part.
//
// The recovery queue lives on its own screen, but the moment somebody notices a
// part failed early is when they are looking at the job it failed on. So the
// job says so: a part here replaced one that did not last its warranty, or the
// unit is still inside its OEM cover — and a claim already filed against the job
// is named with its status, so nobody raises it twice.
//
// The claim itself is raised on Warranty Recovery, opened on this candidate,
// because that is where the claim form, the numbering and the vendor view live.
// One form, reached from two places.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { useStore } from '../lib/store'
import { loadGseAnalytics, money, fmtDate } from '../lib/data'

const STATUS_LOOK = {
  Approved: 'bg-emerald-100 text-emerald-800',
  Pending: 'bg-amber-100 text-amber-800',
  Denied: 'bg-red-100 text-red-800',
}

export default function WarrantyOnJob({ workOrderId }) {
  const router = useRouter()
  const store = useStore()
  const [A, setA] = useState(null)

  useEffect(() => {
    if (!loadGseAnalytics) return undefined
    let live = true
    loadGseAnalytics().then((a) => { if (live) setA(a) }).catch(() => {})
    return () => { live = false }
  }, [])

  const created = store?.records?.warranty_claim
  const { candidates, claims } = useMemo(() => {
    if (!A) return { candidates: [], claims: [] }
    const id = String(workOrderId)
    // A seeded claim a decision was recorded on arrives as a stored overlay;
    // the overlay's status is the current one.
    const overlay = new Map((created || []).map((c) => [c.claim_id || c.recordId, c]))
    const seeded = A.claims.filter((c) => c.work_order_id === id).map((c) => ({ ...c, ...(overlay.get(c.claim_id) || {}) }))
    const seededIds = new Set(A.claims.map((c) => c.claim_id))
    const raisedHere = (created || []).filter((c) => c.work_order_id === id && !seededIds.has(c.claim_id))
    const all = [...raisedHere, ...seeded]
    const claimedCandidates = new Set((created || []).map((c) => c.candidate_id).filter(Boolean))
    return {
      candidates: A.candidates.filter((c) => c.work_order_id === id && !claimedCandidates.has(c.id)),
      claims: all,
    }
  }, [A, created, workOrderId])

  if (!loadGseAnalytics || (!candidates.length && !claims.length)) return null

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
        <ShieldCheck className="h-4 w-4 text-emerald-600" />
        Warranty
      </p>
      <div className="mt-2 space-y-2">
        {candidates.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 first:border-0 first:pt-0">
            <div className="min-w-0 text-sm">
              <Badge className="mr-2 bg-emerald-100 text-emerald-800">{c.kind}</Badge>
              <span className="text-slate-800">{c.part_number ? `${c.part_number} · ${c.description}` : c.description}</span>
              <span className="block text-xs text-slate-500">
                {c.kind === 'Early failure'
                  ? `${c.days_in_service} days in service · warranty ${c.warranty_months} mo · typical life ${c.typical_life_days} d · ${c.vendor}`
                  : `Unit warranty ends ${fmtDate(c.warranty_end)} · ${c.vendor}`}
                {' · '}{money(c.amount)} recoverable
              </span>
            </div>
            <Button
              size="sm" variant="outline"
              onClick={() => router.push(`/portal/oxmaint/gse-warranty?candidate=${encodeURIComponent(c.id)}`)}
            >
              Raise claim
            </Button>
          </div>
        ))}
        {claims.map((c) => (
          <div key={c.claim_id || c.recordId} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 first:border-0 first:pt-0 text-sm">
            <span className="min-w-0">
              <span className="font-mono text-xs text-slate-500">{c.claim_id}</span>
              <span className="ml-2 text-slate-800">{c.part_number || c.part_name} · {c.vendor}</span>
              <span className="block text-xs text-slate-500">
                Filed {fmtDate(c.claim_date)} · {money(c.amount)} claimed
                {Number(c.credit) > 0 ? ` · ${money(c.credit)} credited` : ''}
              </span>
            </span>
            <Badge className={STATUS_LOOK[c.status] || ''}>{c.status}</Badge>
          </div>
        ))}
      </div>
    </div>
  )
}
