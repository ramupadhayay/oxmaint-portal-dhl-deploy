'use client'

// Warranty Recovery — money the shop has already paid for twice.
//
// A warranty register that only lists claims answers the wrong question. The
// claims filed are the recovery somebody already noticed; what a GSE manager
// needs is the recovery nobody noticed — the alternator replaced on the same tug
// eleven weeks after the last one, on a job that was booked as a breakdown and
// closed without anyone asking the vendor for the part back. So the screen opens
// on the candidates, not the claims, and the unclaimed figure is the headline
// tile rather than the last one.
//
// Two kinds of candidate come out of the five-year record:
//
//   Early failure — the same part on the same unit, replaced on an unscheduled
//   job inside both its warranty and its typical life, and not already on a
//   claim. Both limits, because a part inside warranty but past its typical life
//   is a vendor argument the shop will lose.
//
//   Unit under OEM warranty — an unscheduled repair with parts, on a unit still
//   inside its OEM warranty, with no claim against the job. The part may not be
//   a repeat; the unit's own cover is what makes the repair recoverable.
//
// Raising a claim from a candidate removes it from the list, so the list is the
// work still to do. Claims then get a decision — approved with the credit the
// vendor actually paid, which is often less than was asked, or denied with the
// reason — because the recovery rate is credit over what was claimed, and a
// denial nobody wrote down is a denial that repeats next quarter.
//
// The window is measured back from the newest date in the record, not from the
// clock, so "last 12 months" means the latest year of claims and jobs the shop
// actually has.

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ShieldCheck, BadgeDollarSign, Clock, XCircle, Search, FileWarning, ArrowRight, Gavel,
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select'
import { Textarea } from '../ui/textarea'
import { GSE_ACTIVE } from '../lib/gse'
import { loadGseAnalytics, USER, money, fmtDate } from '../lib/data'
import { useRecords, useStore } from '../lib/store'
import ModuleOff from '../components/ModuleOff'
import PagerBar, { usePaged } from '../components/ListPager'

const EMPTY = []
const DAY = 86400000
const KIND = 'warranty_claim'

const REASON_EARLY = 'Repeat failure inside expected life'
const REASON_UNIT = 'Asset still under OEM warranty'
const REASONS = [REASON_EARLY, REASON_UNIT]
const KIND_EARLY = 'Early failure'
const KIND_UNIT = 'Unit under OEM warranty'

// Seeded claims are keyed by their claim id; a claim raised here is stored under
// its claim id too (see raise()), so one key serves both.
const claimIdOf = (c) => c.claim_id || c.recordId

const STATUS_LOOK = {
  Approved: 'bg-emerald-100 text-emerald-800',
  Pending: 'bg-amber-100 text-amber-800',
  Denied: 'bg-red-100 text-red-800',
}

const KIND_LOOK = {
  [KIND_EARLY]: 'bg-red-100 text-red-800',
  [KIND_UNIT]: 'bg-blue-100 text-blue-800',
}

const ts = (iso) => {
  const t = iso ? new Date(iso).getTime() : NaN
  return Number.isFinite(t) ? t : 0
}
const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—')
const count = (n) => Number(n || 0).toLocaleString('en-US')

const nativeSelect = 'h-9 px-3 rounded-md border border-slate-200 text-sm bg-white outline-none focus:border-primary/40 max-w-full'

export default function GseWarranty() {
  const router = useRouter()
  const { create, update, notify } = useStore()
  const [A, setA] = useState(null)
  const [windowKey, setWindowKey] = useState('12m')
  const [tab, setTab] = useState('candidates')

  // candidate filters
  const [kind, setKind] = useState('all')
  const [q, setQ] = useState('')
  // claim filters
  const [status, setStatus] = useState('all')
  const [reason, setReason] = useState('all')
  const [vendor, setVendor] = useState('all')
  const [cq, setCq] = useState('')

  const [raising, setRaising] = useState(null)
  const [deciding, setDeciding] = useState(null)
  const [busy, setBusy] = useState(false)
  // Arrived from a work order's Raise claim: that candidate's form, open.
  const params = useSearchParams()
  const wantCandidate = params?.get('candidate') || ''
  const [handled, setHandled] = useState('')

  useEffect(() => {
    if (!GSE_ACTIVE || !loadGseAnalytics) return
    let live = true
    loadGseAnalytics().then((a) => { if (live) setA(a) })
    return () => { live = false }
  }, [])

  const seededClaims = useMemo(() => (A ? A.claims : EMPTY), [A])
  const candidatesAll = useMemo(() => (A ? A.candidates : EMPTY), [A])
  const claims = useRecords(KIND, seededClaims, claimIdOf)

  // The newest date the record holds, and the year back from it.
  const latest = useMemo(() => {
    let m = 0
    seededClaims.forEach((c) => { m = Math.max(m, ts(c.claim_date)) })
    candidatesAll.forEach((c) => { m = Math.max(m, ts(c.installed)) })
    return m
  }, [seededClaims, candidatesAll])
  const cutoff = windowKey === '12m' ? latest - 365 * DAY : -Infinity

  const claimed = useMemo(
    () => new Set(claims.map((c) => c.candidate_id).filter(Boolean)),
    [claims],
  )

  useEffect(() => {
    if (!A || !wantCandidate || handled === wantCandidate) return
    setHandled(wantCandidate)
    const c = A.candidates.find((x) => x.id === wantCandidate)
    if (!c) return
    if (claimed.has(c.id)) {
      notify('A claim has already been raised for this part on this job.', 'error')
      return
    }
    setTab('candidates')
    setRaising({
      cand: c,
      vendor: c.vendor || '',
      amount: String(Number(c.amount) || ''),
      reason: c.kind === KIND_UNIT ? REASON_UNIT : REASON_EARLY,
      oem_ref: '',
      note: '',
    })
  }, [A, wantCandidate, handled, claimed, notify])

  const windowClaims = useMemo(
    () => claims
      .filter((c) => ts(c.claim_date) >= cutoff)
      .sort((a, b) => ts(b.claim_date) - ts(a.claim_date)),
    [claims, cutoff],
  )
  const openCandidates = useMemo(
    () => candidatesAll
      .filter((c) => !claimed.has(c.id) && ts(c.installed) >= cutoff)
      .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0)),
    [candidatesAll, claimed, cutoff],
  )

  const shownCandidates = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return openCandidates.filter((c) => {
      if (kind !== 'all' && c.kind !== kind) return false
      if (!needle) return true
      return [c.part_number, c.description, c.failure, c.asset_name, c.asset_id, c.work_order_id, c.vendor]
        .some((v) => String(v || '').toLowerCase().includes(needle))
    })
  }, [openCandidates, kind, q])

  const vendors = useMemo(
    () => [...new Set(claims.map((c) => c.vendor).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [claims],
  )

  const shownClaims = useMemo(() => {
    const needle = cq.trim().toLowerCase()
    return windowClaims.filter((c) => {
      if (status !== 'all' && c.status !== status) return false
      if (reason !== 'all' && c.reason !== reason) return false
      if (vendor !== 'all' && c.vendor !== vendor) return false
      if (!needle) return true
      return [c.claim_id, c.work_order_id, c.asset_name, c.asset_id, c.part_number, c.part_name, c.vendor, c.oem_ref]
        .some((v) => String(v || '').toLowerCase().includes(needle))
    })
  }, [windowClaims, status, reason, vendor, cq])

  const candPaged = usePaged(shownCandidates, 20, `${windowKey}|${kind}|${q}`)
  const claimPaged = usePaged(shownClaims, 25, `${windowKey}|${status}|${reason}|${vendor}|${cq}`)

  const totals = useMemo(() => {
    const sum = (rows, f) => rows.reduce((n, r) => n + (Number(r[f]) || 0), 0)
    const decided = windowClaims.filter((c) => c.status === 'Approved' || c.status === 'Denied')
    const pending = windowClaims.filter((c) => c.status === 'Pending')
    const denied = decided.filter((c) => c.status === 'Denied')
    return {
      claimedAmt: sum(windowClaims, 'amount'),
      claimedN: windowClaims.length,
      credit: sum(windowClaims, 'credit'),
      decidedAmt: sum(decided, 'amount'),
      decidedCredit: sum(decided, 'credit'),
      decidedN: decided.length,
      pendingAmt: sum(pending, 'amount'),
      pendingN: pending.length,
      deniedN: denied.length,
      unclaimedAmt: sum(openCandidates, 'amount'),
      unclaimedN: openCandidates.length,
    }
  }, [windowClaims, openCandidates])

  // Vendors ranked by what is still sitting unclaimed against them — the order
  // to work the phone in.
  const byVendor = useMemo(() => {
    const out = new Map()
    const row = (name) => {
      if (!out.has(name)) {
        out.set(name, {
          vendor: name, claims: 0, approved: 0, denied: 0, pending: 0,
          claimed: 0, credited: 0, decidedAmt: 0, decidedCredit: 0, unclaimed: 0, unclaimedN: 0,
        })
      }
      return out.get(name)
    }
    windowClaims.forEach((c) => {
      const r = row(c.vendor || 'Unknown vendor')
      r.claims += 1
      r.claimed += Number(c.amount) || 0
      r.credited += Number(c.credit) || 0
      if (c.status === 'Approved') r.approved += 1
      if (c.status === 'Denied') r.denied += 1
      if (c.status === 'Pending') r.pending += 1
      if (c.status === 'Approved' || c.status === 'Denied') {
        r.decidedAmt += Number(c.amount) || 0
        r.decidedCredit += Number(c.credit) || 0
      }
    })
    openCandidates.forEach((c) => {
      const r = row(c.vendor || 'Unknown vendor')
      r.unclaimed += Number(c.amount) || 0
      r.unclaimedN += 1
    })
    return [...out.values()].sort((a, b) => b.unclaimed - a.unclaimed || b.claimed - a.claimed)
  }, [windowClaims, openCandidates])

  if (!GSE_ACTIVE || !loadGseAnalytics) return <ModuleOff module="Warranty recovery" />

  const goWo = (id) => router.push(`/portal/oxmaint/work-orders/${encodeURIComponent(id)}`)
  const goAsset = (id) => router.push(`/portal/oxmaint/assets/${id}`)

  const openRaise = (c) => setRaising({
    cand: c,
    vendor: c.vendor || '',
    amount: String(Number(c.amount) || ''),
    reason: c.kind === KIND_UNIT ? REASON_UNIT : REASON_EARLY,
    oem_ref: '',
    note: '',
  })

  const raise = async () => {
    const f = raising
    const amount = Number(f?.amount)
    if (!f || !f.vendor.trim() || !(amount > 0)) return
    setBusy(true)
    // One more than the highest claim number anywhere in the register, filed
    // or raised here, so a new claim never reuses a number.
    const seq = 1 + claims.reduce((m, c) => {
      const hit = /-(\d+)$/.exec(String(c.claim_id || ''))
      return hit ? Math.max(m, Number(hit[1])) : m
    }, 0)
    const now = new Date()
    const claim_id = `WR-${now.getFullYear()}-${String(seq).padStart(4, '0')}`
    const c = f.cand
    const saved = await create(KIND, {
      // Stored under its claim id, so a decision recorded on it later lands on
      // this record rather than beside it.
      recordId: claim_id,
      claim_id,
      title: claim_id,
      candidate_id: c.id,
      work_order_id: c.work_order_id,
      in_register: Boolean(c.in_register),
      asset_id: c.asset_id,
      asset_name: c.asset_name,
      part_id: c.part_id || '',
      part_number: c.part_number || '',
      part_name: c.description || c.failure || '',
      claim_date: now.toISOString(),
      vendor: f.vendor.trim(),
      reason: f.reason,
      status: 'Pending',
      amount,
      credit: 0,
      analyst: USER.name,
      oem_ref: f.oem_ref.trim(),
      note: f.note.trim(),
    })
    setBusy(false)
    if (saved) {
      setRaising(null)
      notify(`Claim ${claim_id} raised with ${f.vendor.trim()} for ${money(amount)}.`)
    }
  }

  const openDecide = (c) => setDeciding({
    claim: c, outcome: 'Approved', credit: String(Number(c.amount) || ''), note: '',
  })

  const creditNum = Number(deciding?.credit)
  const decisionOk = deciding && (deciding.outcome === 'Approved'
    ? creditNum > 0 && creditNum <= (Number(deciding.claim.amount) || 0)
    : deciding.note.trim().length > 0)

  const decide = async () => {
    if (!decisionOk) return
    const d = deciding
    setBusy(true)
    const saved = await update(KIND, claimIdOf(d.claim), {
      status: d.outcome,
      credit: d.outcome === 'Approved' ? creditNum : 0,
      decided_at: new Date().toISOString(),
      decided_by: USER.name,
      decision_note: d.note.trim(),
    })
    setBusy(false)
    if (saved) {
      setDeciding(null)
      notify(d.outcome === 'Approved'
        ? `${d.claim.claim_id} approved — ${money(creditNum)} credited.`
        : `${d.claim.claim_id} recorded as denied.`)
    }
  }

  const amountNum = Number(raising?.amount)
  const raiseOk = raising && raising.vendor.trim() && amountNum > 0

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Warranty Recovery</h1>
          <p className="text-slate-600 mt-1">
            Parts and repairs the vendor should be paying for — what has been claimed, what came back,
            and what nobody has asked for yet
          </p>
        </div>
        <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 self-start">
          {[['12m', 'Last 12 months'], ['5y', '5 years']].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setWindowKey(k)}
              className={`h-8 px-3 rounded border-0 text-sm font-medium ${
                windowKey === k ? 'bg-slate-900 text-white' : 'bg-transparent text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!A ? (
        <div className="bg-white border border-slate-200/60 rounded-lg shadow-sm p-12 text-center text-sm text-slate-500">
          Loading warranty claims and recovery candidates…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {/* The call to action first on a phone, last on a desktop row —
                either way the one tile that is not history. */}
            <button
              onClick={() => setTab('candidates')}
              className="col-span-2 lg:col-span-1 lg:order-last text-left rounded-lg shadow-sm p-4 bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-700"
            >
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-emerald-100">
                <FileWarning className="w-3.5 h-3.5" />
                <span className="truncate">Unclaimed recovery</span>
              </div>
              <div className="mt-1.5 text-2xl font-bold tabular-nums">{money(totals.unclaimedAmt)}</div>
              <div className="text-xs text-emerald-100 mt-0.5 flex items-center gap-1">
                {count(totals.unclaimedN)} candidate{totals.unclaimedN === 1 ? '' : 's'} not yet claimed
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>
            <Stat
              label="Claimed" value={money(totals.claimedAmt)}
              sub={`${count(totals.claimedN)} claim${totals.claimedN === 1 ? '' : 's'}`} Icon={ShieldCheck}
            />
            <Stat
              label="Credits received" value={money(totals.credit)}
              sub={`${pct(totals.decidedCredit, totals.decidedAmt)} recovered on decided claims`}
              Icon={BadgeDollarSign} tone="green"
            />
            <Stat
              label="Pending" value={money(totals.pendingAmt)}
              sub={`${count(totals.pendingN)} awaiting a decision`} Icon={Clock}
              tone={totals.pendingN ? 'amber' : null}
            />
            <Stat
              label="Denial rate" value={pct(totals.deniedN, totals.decidedN)}
              sub={`${count(totals.deniedN)} of ${count(totals.decidedN)} decided`} Icon={XCircle}
              tone={totals.decidedN && totals.deniedN / totals.decidedN > 0.25 ? 'red' : null}
            />
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <div className="overflow-x-auto">
              <TabsList>
                <TabsTrigger value="candidates">Candidates ({count(openCandidates.length)})</TabsTrigger>
                <TabsTrigger value="claims">Claims ({count(windowClaims.length)})</TabsTrigger>
                <TabsTrigger value="vendors">By vendor</TabsTrigger>
              </TabsList>
            </div>

            {/* ── candidates ───────────────────────────────────────────── */}
            <TabsContent value="candidates" className="mt-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    Recovery candidates
                    <span className="ml-auto text-sm font-normal text-slate-500">largest first</span>
                  </CardTitle>
                  <p className="text-sm text-slate-500">
                    An early failure is the same part replaced on the same unit, on an unscheduled job, inside
                    both its warranty and its typical life. A unit under OEM warranty is an unscheduled repair
                    on a unit still inside its cover. Neither has a claim against it yet.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <select value={kind} onChange={(e) => setKind(e.target.value)} className={nativeSelect}>
                      <option value="all">All kinds</option>
                      <option value={KIND_EARLY}>Early failures</option>
                      <option value={KIND_UNIT}>Units under OEM warranty</option>
                    </select>
                    <div className="relative flex-1 min-w-[12rem]">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        value={q} onChange={(e) => setQ(e.target.value)}
                        placeholder="Part, unit, work order or vendor"
                        className="h-9 pl-9"
                      />
                    </div>
                  </div>

                  {shownCandidates.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">
                      {openCandidates.length
                        ? 'No candidates match these filters.'
                        : 'Every recoverable job in this window has a claim against it.'}
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {candPaged.pageItems.map((c) => (
                        <div key={c.id} className="py-3 flex flex-col gap-3 md:flex-row md:items-start">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={KIND_LOOK[c.kind] || 'bg-slate-100 text-slate-700'}>{c.kind}</Badge>
                              {c.part_number && (
                                <span className="text-sm font-semibold text-slate-900">{c.part_number}</span>
                              )}
                              <span className="text-sm text-slate-700 min-w-0 break-words">
                                {c.kind === KIND_UNIT ? (c.failure || c.description) : c.description}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                              <button
                                onClick={() => goAsset(c.asset_id)}
                                className="border-0 bg-transparent p-0 text-primary hover:underline text-left"
                              >
                                {c.asset_name}
                              </button>
                              <span>
                                This job{' '}
                                <WoRef id={c.work_order_id} live={c.in_register} go={goWo} />
                                {' · '}{fmtDate(c.installed)}
                              </span>
                              <span>
                                {c.kind === KIND_UNIT ? 'In service since ' : 'Previous install '}
                                {fmtDate(c.previous_installed)}
                                {c.previous_work_order_id && c.kind !== KIND_UNIT && (
                                  <> · {c.previous_work_order_id}</>
                                )}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500">
                              {count(c.days_in_service)} days in service
                              {c.kind === KIND_UNIT
                                ? <> · warranty ends {fmtDate(c.warranty_end)}</>
                                : (
                                  <>
                                    {c.warranty_months != null && <> · warranty {c.warranty_months} mo</>}
                                    {c.typical_life_days != null && <> · typical life {count(c.typical_life_days)} d</>}
                                  </>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                              <span>{c.vendor || 'Vendor not recorded'}</span>
                              <Badge className={c.channel === 'alt' ? 'bg-violet-100 text-violet-800' : 'bg-slate-100 text-slate-700'}>
                                {c.channel === 'alt' ? 'Aftermarket' : 'OEM'}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 md:flex-col md:items-end shrink-0">
                            <span className="text-lg font-bold tabular-nums text-slate-900">{money(c.amount)}</span>
                            <Button size="sm" onClick={() => openRaise(c)} className="ml-auto md:ml-0">
                              Raise claim
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <PagerBar {...candPaged} noun="candidates" />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── claims ───────────────────────────────────────────────── */}
            <TabsContent value="claims" className="mt-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    Claims
                    <span className="ml-auto text-sm font-normal text-slate-500">newest first</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <select value={status} onChange={(e) => setStatus(e.target.value)} className={nativeSelect}>
                      <option value="all">All statuses</option>
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approved</option>
                      <option value="Denied">Denied</option>
                    </select>
                    <select value={reason} onChange={(e) => setReason(e.target.value)} className={nativeSelect}>
                      <option value="all">All reasons</option>
                      {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <select value={vendor} onChange={(e) => setVendor(e.target.value)} className={nativeSelect}>
                      <option value="all">All vendors</option>
                      {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <div className="relative flex-1 min-w-[12rem]">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        value={cq} onChange={(e) => setCq(e.target.value)}
                        placeholder="Claim, work order, part or OEM ref"
                        className="h-9 pl-9"
                      />
                    </div>
                  </div>

                  {shownClaims.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">No claims match these filters.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                            <th className="py-2 pr-3 font-medium">Claim</th>
                            <th className="py-2 pr-3 font-medium">Date</th>
                            <th className="py-2 pr-3 font-medium">Work order</th>
                            <th className="py-2 pr-3 font-medium">Asset</th>
                            <th className="py-2 pr-3 font-medium">Part</th>
                            <th className="py-2 pr-3 font-medium">Vendor</th>
                            <th className="py-2 pr-3 font-medium">Reason</th>
                            <th className="py-2 pr-3 font-medium text-right">Amount</th>
                            <th className="py-2 pr-3 font-medium text-right">Credit</th>
                            <th className="py-2 pr-3 font-medium">Status</th>
                            <th className="py-2 pr-3 font-medium">OEM ref</th>
                            <th className="py-2 font-medium" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {claimPaged.pageItems.map((c) => (
                            <tr key={claimIdOf(c)} className="align-top">
                              <td className="py-2 pr-3 font-medium text-slate-900 whitespace-nowrap">{c.claim_id}</td>
                              <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">{fmtDate(c.claim_date)}</td>
                              <td className="py-2 pr-3 whitespace-nowrap">
                                <WoRef id={c.work_order_id} live={c.in_register} go={goWo} />
                              </td>
                              <td className="py-2 pr-3 min-w-[10rem]">
                                <button onClick={() => goAsset(c.asset_id)} className="border-0 bg-transparent p-0 text-primary hover:underline text-left">
                                  {c.asset_name || c.asset_id}
                                </button>
                              </td>
                              <td className="py-2 pr-3 min-w-[10rem]">
                                <span className="block text-slate-900">{c.part_number || '—'}</span>
                                <span className="block text-xs text-slate-500">{c.part_name}</span>
                              </td>
                              <td className="py-2 pr-3 min-w-[8rem] text-slate-700">{c.vendor}</td>
                              <td className="py-2 pr-3 min-w-[10rem] text-slate-600">{c.reason}</td>
                              <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">{money(c.amount)}</td>
                              <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">
                                {c.status === 'Pending' ? '—' : money(c.credit)}
                              </td>
                              <td className="py-2 pr-3">
                                <Badge className={STATUS_LOOK[c.status] || 'bg-slate-100 text-slate-700'}>{c.status}</Badge>
                                {c.decided_by && (
                                  <span className="block mt-1 text-xs text-slate-500 min-w-[9rem]">
                                    by {c.decided_by}{c.decided_at ? `, ${fmtDate(c.decided_at)}` : ''}
                                    {c.decision_note && <span className="block text-slate-600">{c.decision_note}</span>}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">{c.oem_ref || '—'}</td>
                              <td className="py-2 text-right whitespace-nowrap">
                                {c.status === 'Pending' && (
                                  <Button size="sm" variant="outline" onClick={() => openDecide(c)} className="gap-1">
                                    <Gavel className="w-3.5 h-3.5" />
                                    Record decision
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <PagerBar {...claimPaged} noun="claims" />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── by vendor ────────────────────────────────────────────── */}
            <TabsContent value="vendors" className="mt-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    Recovery by vendor
                    <span className="ml-auto text-sm font-normal text-slate-500">most unclaimed first</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {byVendor.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">No claims or candidates in this window.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                            <th className="py-2 pr-3 font-medium">Vendor</th>
                            <th className="py-2 pr-3 font-medium text-right">Claims</th>
                            <th className="py-2 pr-3 font-medium text-right">Approved</th>
                            <th className="py-2 pr-3 font-medium text-right">Denied</th>
                            <th className="py-2 pr-3 font-medium text-right">Pending</th>
                            <th className="py-2 pr-3 font-medium text-right">Claimed</th>
                            <th className="py-2 pr-3 font-medium text-right">Credited</th>
                            <th className="py-2 pr-3 font-medium text-right">Recovery</th>
                            <th className="py-2 font-medium text-right">Unclaimed</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {byVendor.map((v) => (
                            <tr key={v.vendor}>
                              <td className="py-2 pr-3 min-w-[10rem] text-slate-900">{v.vendor}</td>
                              <td className="py-2 pr-3 text-right tabular-nums">{count(v.claims)}</td>
                              <td className="py-2 pr-3 text-right tabular-nums text-emerald-700">{count(v.approved)}</td>
                              <td className="py-2 pr-3 text-right tabular-nums text-red-700">{count(v.denied)}</td>
                              <td className="py-2 pr-3 text-right tabular-nums text-amber-700">{count(v.pending)}</td>
                              <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">{money(v.claimed)}</td>
                              <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">{money(v.credited)}</td>
                              <td className="py-2 pr-3 text-right tabular-nums">{pct(v.decidedCredit, v.decidedAmt)}</td>
                              <td className="py-2 text-right tabular-nums whitespace-nowrap">
                                {v.unclaimed > 0 ? (
                                  <span className="font-semibold text-emerald-700">
                                    {money(v.unclaimed)}
                                    <span className="block text-xs font-normal text-slate-500">
                                      {count(v.unclaimedN)} candidate{v.unclaimedN === 1 ? '' : 's'}
                                    </span>
                                  </span>
                                ) : <span className="text-slate-400">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="mt-3 text-xs text-slate-500">
                    Recovery is credit received over the amount claimed, on claims the vendor has decided.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* ── raise a claim ─────────────────────────────────────────────── */}
      <Dialog open={Boolean(raising)} onOpenChange={(o) => { if (!o && !busy) setRaising(null) }}>
        <DialogContent>
          {raising && (
            <>
              <DialogHeader>
                <DialogTitle>Raise warranty claim</DialogTitle>
                <DialogDescription>
                  {raising.cand.part_number ? `${raising.cand.part_number} · ` : ''}
                  {raising.cand.asset_name} · job {raising.cand.work_order_id}, {fmtDate(raising.cand.installed)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="wr-vendor">Vendor</Label>
                  <Input
                    id="wr-vendor" value={raising.vendor}
                    onChange={(e) => setRaising((r) => ({ ...r, vendor: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wr-amount">Amount claimed (USD)</Label>
                  <Input
                    id="wr-amount" type="text" inputMode="decimal" value={raising.amount}
                    onChange={(e) => setRaising((r) => ({ ...r, amount: e.target.value }))}
                  />
                  {raising.amount !== '' && !(amountNum > 0) && (
                    <p className="text-xs text-red-600">Enter an amount greater than zero.</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Reason</Label>
                  <Select value={raising.reason} onValueChange={(v) => setRaising((r) => ({ ...r, reason: v }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wr-ref">OEM reference <span className="font-normal text-slate-400">(optional)</span></Label>
                  <Input
                    id="wr-ref" value={raising.oem_ref}
                    onChange={(e) => setRaising((r) => ({ ...r, oem_ref: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wr-note">Note</Label>
                  <Textarea
                    id="wr-note" value={raising.note} rows={3}
                    placeholder={raising.cand.failure || 'What failed, and what the vendor needs to see'}
                    onChange={(e) => setRaising((r) => ({ ...r, note: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRaising(null)} disabled={busy}>Cancel</Button>
                <Button onClick={raise} disabled={!raiseOk || busy}>{busy ? 'Raising…' : 'Raise claim'}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── record a decision ─────────────────────────────────────────── */}
      <Dialog open={Boolean(deciding)} onOpenChange={(o) => { if (!o && !busy) setDeciding(null) }}>
        <DialogContent>
          {deciding && (
            <>
              <DialogHeader>
                <DialogTitle>Record decision · {deciding.claim.claim_id}</DialogTitle>
                <DialogDescription>
                  {deciding.claim.vendor} · claimed {money(deciding.claim.amount)} on {fmtDate(deciding.claim.claim_date)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {['Approved', 'Denied'].map((o) => (
                    <button
                      key={o}
                      onClick={() => setDeciding((d) => ({ ...d, outcome: o }))}
                      className={`h-10 rounded-md border text-sm font-medium ${
                        deciding.outcome === o
                          ? (o === 'Approved' ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-red-600 bg-red-50 text-red-800')
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
                {deciding.outcome === 'Approved' ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="wr-credit">Credit received (USD)</Label>
                    <Input
                      id="wr-credit" type="text" inputMode="decimal" value={deciding.credit}
                      onChange={(e) => setDeciding((d) => ({ ...d, credit: e.target.value }))}
                    />
                    {!decisionOk && (
                      <p className="text-xs text-red-600">
                        The credit must be more than zero and no more than the {money(deciding.claim.amount)} claimed.
                      </p>
                    )}
                    <Label htmlFor="wr-dnote" className="block pt-2">Note <span className="font-normal text-slate-400">(optional)</span></Label>
                    <Textarea
                      id="wr-dnote" rows={2} value={deciding.note}
                      onChange={(e) => setDeciding((d) => ({ ...d, note: e.target.value }))}
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="wr-deny">Denial reason</Label>
                    <Textarea
                      id="wr-deny" rows={3} value={deciding.note}
                      placeholder="What the vendor gave as the reason"
                      onChange={(e) => setDeciding((d) => ({ ...d, note: e.target.value }))}
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeciding(null)} disabled={busy}>Cancel</Button>
                <Button onClick={decide} disabled={!decisionOk || busy}>{busy ? 'Saving…' : 'Save decision'}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// A work order id is a link only when the job is in the live register; older
// jobs from the five-year record have no page to open.
function WoRef({ id, live, go }) {
  if (!id) return <span className="text-slate-400">—</span>
  return live ? (
    <button onClick={() => go(id)} className="border-0 bg-transparent p-0 text-primary hover:underline">{id}</button>
  ) : (
    <span className="text-slate-600">{id}</span>
  )
}

function Stat({ label, value, sub, Icon, tone }) {
  const ring = tone === 'red' ? 'border-red-200' : tone === 'amber' ? 'border-amber-200'
    : tone === 'green' ? 'border-emerald-200' : 'border-slate-200/60'
  const ink = tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700'
    : tone === 'green' ? 'text-emerald-700' : 'text-slate-900'
  return (
    <div className={`bg-white border rounded-lg shadow-sm p-4 ${ring}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-1.5 text-2xl font-bold tabular-nums ${ink}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  )
}
