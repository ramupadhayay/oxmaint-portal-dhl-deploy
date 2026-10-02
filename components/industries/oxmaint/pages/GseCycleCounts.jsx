'use client'

// Cycle Counts — whether the stores system can be believed.
//
// Every parts screen in the portal reads a quantity on hand, and every one of
// them is only as good as the last time somebody walked the bins. A quarterly
// count that finds nine lines out of eighteen wrong is not a stores problem; it
// is the reason a tug sat waiting for a filter the system said was on the shelf.
// So the screen leads with accuracy — the share of lines where the shelf matched
// the system — and puts money second, because a net variance near zero can hide
// a large absolute one: a receiving lag on one bin and an unposted issue on the
// next cancel out in dollars and are both still wrong.
//
// Five years of quarterly sessions come from the workbook, one session per count
// date. The line ids in that record run on across sessions, so a session is
// named by its date rather than by an id. Sessions counted here are stored as
// one record each, carrying their lines, and go through two steps:
//
//   Submitted — the physical quantities are in, nothing has moved yet.
//   Approved  — each variance is posted to the stock ledger as a count
//               correction, referenced to the count, so the quantity every other
//               screen reads now agrees with the shelf.
//
// Approval is kept separate on purpose, and the screen says so when the person
// who counted is also the person who approved. It does not block — a small shop
// often has one storekeeper on nights — but the segregation of duties is the
// first thing an auditor asks about, and it should be visible without asking.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ClipboardList, Target, TrendingUp, Scale, CalendarDays, AlertTriangle, CheckCircle2, Plus,
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { GSE_ACTIVE } from '../lib/gse'
import { loadGseAnalytics, USER, ORG, money, fmtDate } from '../lib/data'
import { useStore } from '../lib/store'
import { useStock } from '../lib/movements'
import ModuleOff from '../components/ModuleOff'
import PagerBar, { usePaged } from '../components/ListPager'

const EMPTY = []
const DAY = 86400000
const KIND = 'cycle_count'
const STALE_DAYS = 90
const VARIANCE_REASONS = ['Receiving lag', 'Damaged write-off', 'Misbin', 'Unposted issue', 'UOM error']

const ts = (iso) => {
  const t = iso ? new Date(iso).getTime() : NaN
  return Number.isFinite(t) ? t : 0
}
const count = (n) => Number(n || 0).toLocaleString('en-US')
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
// Signed, with the sign outside the currency symbol: "−$120", not "$-120".
const signed = (n) => {
  const v = Number(n) || 0
  const r = Math.round(v)
  return `${r < 0 ? '−' : r > 0 ? '+' : ''}${money(Math.abs(v))}`
}
const cost = (n) => `${ORG.currency_symbol}${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function summarise(lines) {
  const n = lines.length
  const matched = lines.filter((l) => Number(l.variance_qty) === 0).length
  const net = lines.reduce((s, l) => s + (Number(l.variance_value) || 0), 0)
  const abs = lines.reduce((s, l) => s + Math.abs(Number(l.variance_value) || 0), 0)
  return { n, matched, accuracy: n ? Math.round((matched / n) * 100) : null, net, abs }
}

const people = (lines, field) => [...new Set(lines.map((l) => l[field]).filter(Boolean))]

// Bands for a quarterly count of a small, busy GSE stores: nine lines in ten
// matching is good, fewer than seven in ten is a stores process that is not
// being followed. Stricter bands painted every session in the record red, and a
// chart that is all one alarm colour tells nobody which quarter to look at.
const accuracyInk = (a) => (a == null ? 'text-slate-400' : a >= 90 ? 'text-emerald-700' : a >= 70 ? 'text-slate-700' : 'text-amber-700')
const accuracyBar = (a) => (a >= 90 ? 'bg-emerald-500' : a >= 70 ? 'bg-blue-500' : 'bg-amber-500')
const accuracyTone = (a) => (a == null ? null : a >= 90 ? 'green' : a >= 70 ? null : 'amber')

export default function GseCycleCounts() {
  const { create, update, notify, records } = useStore()
  const { levels, receive, issue } = useStock()
  const [A, setA] = useState(null)
  const [pick, setPick] = useState(null)
  const [variancesOnly, setVariancesOnly] = useState(false)
  const [busy, setBusy] = useState(false)

  // the count being taken
  const [counting, setCounting] = useState(false)
  const [scope, setScope] = useState('stale')
  const [entries, setEntries] = useState({})

  useEffect(() => {
    if (!GSE_ACTIVE || !loadGseAnalytics) return
    let live = true
    loadGseAnalytics().then((a) => { if (live) setA(a) })
    return () => { live = false }
  }, [])

  const seeded = useMemo(() => (A ? A.counts : EMPTY), [A])
  const stored = records?.[KIND] || EMPTY

  // Oldest first; the picker reverses it.
  const sessions = useMemo(() => {
    const byDate = new Map()
    seeded.forEach((l) => {
      if (!byDate.has(l.count_date)) byDate.set(l.count_date, [])
      byDate.get(l.count_date).push(l)
    })
    const fromRecord = [...byDate.entries()].map(([date, lines]) => ({
      key: `seed:${date}`,
      date,
      label: fmtDate(date),
      status: 'Approved',
      lines,
      counted_by: people(lines, 'counted_by').join(', '),
      approved_by: people(lines, 'approved_by').join(', '),
      sameHands: lines.filter((l) => l.counted_by && l.counted_by === l.approved_by).length,
    }))
    const takenHere = stored.map((r) => {
      const lines = Array.isArray(r.lines) ? r.lines : []
      return {
        key: r.recordId,
        recordId: r.recordId,
        count_id: r.count_id,
        date: r.count_date,
        label: `${fmtDate(r.count_date)} · ${r.count_id || 'count'}`,
        status: r.status || 'Submitted',
        lines,
        scope: r.scope,
        counted_by: r.counted_by || '',
        approved_by: r.approved_by || '',
        approved_at: r.approved_at,
        posted_parts: r.posted_parts || [],
        pending: Boolean(r._pending),
        sameHands: r.approved_by && r.approved_by === r.counted_by ? lines.length : 0,
      }
    })
    return [...fromRecord, ...takenHere]
      .map((s) => ({ ...s, stats: summarise(s.lines) }))
      .sort((a, b) => ts(a.date) - ts(b.date))
  }, [seeded, stored])

  // The trend reads oldest to newest, so on a narrow screen it opens scrolled to
  // the newest end — the quarter anyone opening this page came to see.
  const trendRef = useRef(null)
  useEffect(() => {
    const el = trendRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [sessions.length])

  const latest = sessions[sessions.length - 1] || null
  const current = sessions.find((s) => s.key === pick) || latest

  const allLines = useMemo(() => sessions.flatMap((s) => s.lines), [sessions])
  const overall = useMemo(() => summarise(allLines), [allLines])

  const reasons = useMemo(() => {
    const out = new Map()
    allLines.forEach((l) => {
      const k = l.reason || (Number(l.variance_qty) === 0 ? 'Match' : 'Not given')
      const r = out.get(k) || { reason: k, lines: 0, net: 0, abs: 0 }
      r.lines += 1
      r.net += Number(l.variance_value) || 0
      r.abs += Math.abs(Number(l.variance_value) || 0)
      out.set(k, r)
    })
    return [...out.values()].sort((a, b) => (a.reason === 'Match') - (b.reason === 'Match') || b.abs - a.abs)
  }, [allLines])
  const topReason = useMemo(
    () => reasons.filter((r) => r.reason !== 'Match').sort((a, b) => b.lines - a.lines)[0] || null,
    [reasons],
  )

  const shownLines = useMemo(() => {
    const lines = current ? current.lines : EMPTY
    return variancesOnly ? lines.filter((l) => Number(l.variance_qty) !== 0) : lines
  }, [current, variancesOnly])
  const paged = usePaged(shownLines, 20, `${current?.key}|${variancesOnly}`)

  // When each part was last counted: the stores record's date, or a later
  // count taken here.
  const lastCounted = useMemo(() => {
    const out = new Map()
    levels.forEach((p) => out.set(p.part_id, ts(p.last_count_date)))
    stored.forEach((r) => (r.lines || []).forEach((l) => {
      out.set(l.part_id, Math.max(out.get(l.part_id) || 0, ts(r.count_date)))
    }))
    return out
  }, [levels, stored])

  const categories = useMemo(
    () => [...new Set(levels.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [levels],
  )

  const scoped = useMemo(() => {
    if (scope === 'all') return { parts: levels, fellBack: false }
    if (scope.startsWith('cat:')) {
      const cat = scope.slice(4)
      return { parts: levels.filter((p) => p.category === cat), fellBack: false }
    }
    const since = Date.now() - STALE_DAYS * DAY
    const stale = levels.filter((p) => (lastCounted.get(p.part_id) || 0) < since)
    return stale.length ? { parts: stale, fellBack: false } : { parts: levels, fellBack: true }
  }, [scope, levels, lastCounted])

  if (!GSE_ACTIVE || !loadGseAnalytics) return <ModuleOff module="Cycle counts" />

  const scopeLabel = scope === 'all' ? 'All parts'
    : scope.startsWith('cat:') ? scope.slice(4) : `Not counted in ${STALE_DAYS} days`

  const entryOf = (id) => entries[id] || { physical: '', reason: '' }
  const setEntry = (id, patch) => setEntries((e) => ({ ...e, [id]: { ...entryOf(id), ...patch } }))
  const parsed = (v) => (/^\d+$/.test(String(v).trim()) ? Number(String(v).trim()) : null)

  const lineState = scoped.parts.map((p) => {
    const e = entryOf(p.part_id)
    const physical = parsed(e.physical)
    const system = Number(p.quantity_on_hand) || 0
    const differs = physical != null && physical !== system
    return {
      p, e, physical, system, differs,
      bad: e.physical !== '' && physical == null,
      done: physical != null && (!differs || Boolean(e.reason)),
    }
  })
  const entered = lineState.filter((l) => l.physical != null).length
  const ready = lineState.length > 0 && lineState.every((l) => l.done)

  const startCount = () => {
    setScope('stale')
    setEntries({})
    setCounting(true)
  }

  const submitCount = async () => {
    if (!ready) return
    setBusy(true)
    const seq = 1 + [...seeded, ...stored].reduce((m, r) => {
      const hit = /-(\d+)$/.exec(String(r.count_id || ''))
      return hit ? Math.max(m, Number(hit[1])) : m
    }, 0)
    const now = new Date()
    const count_id = `CNT-${now.getFullYear()}-${String(seq).padStart(4, '0')}`
    const lines = lineState.map(({ p, physical, system, differs, e }) => {
      const variance_qty = physical - system
      const unit_cost = Number(p.unit_cost) || 0
      return {
        part_id: p.part_id,
        part_number: p.part_number || '',
        part_name: p.part_name || '',
        bin: p.storage_location || '',
        system_qty: system,
        physical_qty: physical,
        variance_qty,
        unit_cost,
        variance_value: round2(variance_qty * unit_cost),
        reason: differs ? e.reason : 'Match',
      }
    })
    const saved = await create(KIND, {
      recordId: count_id,
      count_id,
      title: count_id,
      count_date: now.toISOString(),
      status: 'Submitted',
      counted_by: USER.name,
      scope: scopeLabel,
      lines,
    })
    setBusy(false)
    if (saved) {
      setCounting(false)
      setPick(saved.recordId)
      const off = lines.filter((l) => l.variance_qty !== 0).length
      notify(`${count_id} submitted — ${count(lines.length)} lines, ${count(off)} with a variance. Approve it to post the corrections.`)
    }
  }

  // Posts each variance to the ledger, then marks the count approved. Parts
  // already posted are remembered on the record, so an approval that stops half
  // way — a part issued elsewhere in the meantime — can be retried without
  // posting the first half twice.
  const approve = async (s) => {
    if (!s?.recordId || s.status !== 'Submitted') return
    setBusy(true)
    const posted = new Set(s.posted_parts)
    for (const l of s.lines) {
      const v = Number(l.variance_qty) || 0
      if (!v || posted.has(l.part_id)) continue
      const ok = v > 0
        ? await receive(l.part_id, v, 'Stock count correction', s.count_id)
        : await issue(l.part_id, -v, 'Stock count correction', s.count_id)
      if (!ok) {
        if (posted.size !== s.posted_parts.length) {
          await update(KIND, s.recordId, { posted_parts: [...posted] })
        }
        setBusy(false)
        notify(`Stopped at ${l.part_number || l.part_id}: its correction could not be posted. ${s.count_id} is still awaiting approval.`, 'error')
        return
      }
      posted.add(l.part_id)
    }
    const saved = await update(KIND, s.recordId, {
      status: 'Approved',
      approved_by: USER.name,
      approved_at: new Date().toISOString(),
      posted_parts: [...posted],
    })
    setBusy(false)
    if (saved) notify(`${s.count_id} approved — ${count(posted.size)} stock correction${posted.size === 1 ? '' : 's'} posted.`)
  }

  const ls = latest?.stats

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Cycle Counts</h1>
          <p className="text-slate-600 mt-1">
            How often the shelf agrees with the system, what it costs when it does not, and why
          </p>
        </div>
        <Button onClick={startCount} disabled={!A} className="gap-1.5 self-start">
          <Plus className="w-4 h-4" />
          Start count
        </Button>
      </div>

      {!A ? (
        <div className="bg-white border border-slate-200/60 rounded-lg shadow-sm p-12 text-center text-sm text-slate-500">
          Loading five years of stock counts…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Latest count" value={latest ? fmtDate(latest.date) : '—'} sub={latest?.status} Icon={CalendarDays} />
            <Stat label="Lines counted" value={count(ls?.n)} sub="in the latest session" Icon={ClipboardList} />
            <Stat
              label="Accuracy" value={ls?.accuracy == null ? '—' : `${ls.accuracy}%`}
              sub={`${count(ls?.matched)} of ${count(ls?.n)} lines matched`} Icon={Target}
              tone={accuracyTone(ls?.accuracy)}
            />
            <Stat label="Net variance" value={signed(ls?.net)} sub="latest session" Icon={Scale} tone={ls && Math.round(ls.net) < 0 ? 'red' : null} />
            <Stat label="Absolute variance" value={money(ls?.abs ?? 0)} sub="latest session, both directions" Icon={Scale} />
            <Stat label="Net variance, 5 years" value={signed(overall.net)} sub={`${count(sessions.length)} sessions · ${count(overall.n)} lines`} Icon={TrendingUp} />
            <Stat
              label="Most frequent cause" value={topReason ? topReason.reason : '—'}
              sub={topReason ? `${count(topReason.lines)} lines over 5 years` : 'no variances recorded'}
              Icon={AlertTriangle} className="col-span-2"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                Accuracy by session
                <span className="ml-auto text-sm font-normal text-slate-500">oldest to newest · net variance below</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={trendRef} className="overflow-x-auto pb-2">
                <div className="flex items-end gap-2 min-w-max">
                  {sessions.map((s) => {
                    const a = s.stats.accuracy ?? 0
                    const on = current?.key === s.key
                    return (
                      <button
                        key={s.key}
                        onClick={() => setPick(s.key)}
                        title={`${s.label}: ${a}% accurate, net ${signed(s.stats.net)}`}
                        className={`w-16 shrink-0 flex flex-col items-center rounded border-0 p-1 ${on ? 'bg-slate-100' : 'bg-transparent hover:bg-slate-50'}`}
                      >
                        <span className={`text-xs font-semibold tabular-nums ${accuracyInk(s.stats.accuracy)}`}>{a}%</span>
                        <span className="mt-1 h-28 w-6 rounded bg-slate-100 flex items-end overflow-hidden">
                          <span
                            className={`block w-full rounded ${s.status === 'Submitted' ? 'bg-slate-400' : accuracyBar(a)}`}
                            style={{ height: `${Math.max(2, a)}%` }}
                          />
                        </span>
                        <span className={`mt-1 text-[10px] whitespace-nowrap tabular-nums ${Math.round(s.stats.net) < 0 ? 'text-red-700' : 'text-slate-600'}`}>
                          {signed(s.stats.net)}
                        </span>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">{shortDate(s.date)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                Session lines
                <span className="ml-auto flex flex-wrap items-center gap-2 text-sm font-normal">
                  <select
                    value={current?.key || ''} onChange={(e) => setPick(e.target.value)}
                    className="h-9 px-3 rounded-md border border-slate-200 text-sm bg-white outline-none focus:border-primary/40 max-w-full"
                  >
                    {[...sessions].reverse().map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}{s.status === 'Submitted' ? ' · awaiting approval' : ''}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                    <input
                      type="checkbox" checked={variancesOnly}
                      onChange={(e) => setVariancesOnly(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Variances only
                  </label>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {current && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <Badge className={current.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
                    {current.status === 'Approved' ? 'Approved' : 'Awaiting approval'}
                  </Badge>
                  {current.count_id && <span className="font-medium text-slate-900">{current.count_id}</span>}
                  {current.scope && <span className="text-slate-500">Scope: {current.scope}</span>}
                  <span className={`tabular-nums ${accuracyInk(current.stats.accuracy)}`}>
                    {current.stats.accuracy == null ? '—' : `${current.stats.accuracy}%`} accurate
                  </span>
                  <span className="text-slate-600 tabular-nums">
                    net {signed(current.stats.net)} · absolute {money(current.stats.abs)}
                  </span>
                  {current.status === 'Submitted' && current.recordId && (
                    <Button
                      size="sm" className="gap-1.5 ml-auto" disabled={busy || current.pending}
                      onClick={() => approve(current)}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {busy ? 'Posting…' : 'Approve and post adjustments'}
                    </Button>
                  )}
                </div>
              )}
              {current && current.sameHands > 0 && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Counted and approved by the same person
                  {current.recordId ? '' : ` on ${count(current.sameHands)} of ${count(current.lines.length)} lines`}.
                </p>
              )}

              {shownLines.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  {variancesOnly ? 'Every line in this session matched.' : 'This session has no lines.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-2 pr-3 font-medium">Part</th>
                        <th className="py-2 pr-3 font-medium">Bin</th>
                        <th className="py-2 pr-3 font-medium text-right">System</th>
                        <th className="py-2 pr-3 font-medium text-right">Physical</th>
                        <th className="py-2 pr-3 font-medium text-right">Variance</th>
                        <th className="py-2 pr-3 font-medium text-right">Unit cost</th>
                        <th className="py-2 pr-3 font-medium text-right">Variance $</th>
                        <th className="py-2 pr-3 font-medium">Reason</th>
                        <th className="py-2 pr-3 font-medium">Counted by</th>
                        <th className="py-2 font-medium">Approved by</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paged.pageItems.map((l, i) => {
                        const v = Number(l.variance_qty) || 0
                        return (
                          <tr key={`${l.count_id || l.part_id}-${i}`}>
                            <td className="py-2 pr-3 min-w-[12rem]">
                              <span className="block text-slate-900">{l.part_number}</span>
                              <span className="block text-xs text-slate-500">{l.part_name}</span>
                            </td>
                            <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">{l.bin || '—'}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{count(l.system_qty)}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{count(l.physical_qty)}</td>
                            <td className={`py-2 pr-3 text-right tabular-nums font-semibold ${v < 0 ? 'text-red-700' : v > 0 ? 'text-blue-700' : 'text-slate-400'}`}>
                              {v > 0 ? `+${count(v)}` : v < 0 ? `−${count(-v)}` : '0'}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">{cost(l.unit_cost)}</td>
                            <td className={`py-2 pr-3 text-right tabular-nums whitespace-nowrap ${v < 0 ? 'text-red-700' : v > 0 ? 'text-blue-700' : 'text-slate-400'}`}>
                              {v ? signed(l.variance_value) : '—'}
                            </td>
                            <td className="py-2 pr-3 whitespace-nowrap text-slate-600">{l.reason || '—'}</td>
                            <td className="py-2 pr-3 whitespace-nowrap text-slate-600">{l.counted_by || current.counted_by || '—'}</td>
                            <td className="py-2 whitespace-nowrap text-slate-600">{l.approved_by || current.approved_by || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <PagerBar {...paged} noun="lines" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                Why the shelf and the system disagreed
                <span className="ml-auto text-sm font-normal text-slate-500">all sessions, 5 years</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3 font-medium">Reason</th>
                      <th className="py-2 pr-3 font-medium text-right">Lines</th>
                      <th className="py-2 pr-3 font-medium text-right">Net $</th>
                      <th className="py-2 font-medium text-right">Absolute $</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reasons.map((r) => (
                      <tr key={r.reason}>
                        <td className="py-2 pr-3 text-slate-900">{r.reason}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{count(r.lines)}</td>
                        <td className={`py-2 pr-3 text-right tabular-nums ${Math.round(r.net) < 0 ? 'text-red-700' : 'text-slate-700'}`}>
                          {r.reason === 'Match' ? '—' : signed(r.net)}
                        </td>
                        <td className="py-2 text-right tabular-nums">{r.reason === 'Match' ? '—' : money(r.abs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Absolute variance adds both directions, so an overcount on one bin cannot hide a shortage on the next.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── take a count ──────────────────────────────────────────────── */}
      <Dialog open={counting} onOpenChange={(o) => { if (!o && !busy) setCounting(false) }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Start a cycle count</DialogTitle>
            <DialogDescription>
              System quantities are the live stock position. Enter what is on the shelf; a line that
              differs needs a reason.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 min-w-0">
            <div className="space-y-1.5">
              <Label htmlFor="cc-scope">Scope</Label>
              <select
                id="cc-scope" value={scope}
                onChange={(e) => { setScope(e.target.value); setEntries({}) }}
                className="h-10 w-full px-3 rounded-md border border-slate-200 text-sm bg-white outline-none focus:border-primary/40"
              >
                <option value="stale">Not counted in {STALE_DAYS} days</option>
                <option value="all">All parts</option>
                {categories.map((c) => <option key={c} value={`cat:${c}`}>{c}</option>)}
              </select>
              <p className="text-xs text-slate-500">
                {count(lineState.length)} part{lineState.length === 1 ? '' : 's'} · {count(entered)} counted
                {scoped.fellBack && ` · every part was counted in the last ${STALE_DAYS} days, so all are listed`}
              </p>
            </div>

            {lineState.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No parts in this scope.</p>
            ) : (
              <div className="divide-y divide-slate-100 border-y border-slate-100">
                {lineState.map(({ p, e, system, differs, bad }) => (
                  <div key={p.part_id} className="py-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="min-w-0 flex-1 basis-40">
                      <span className="block text-sm font-medium text-slate-900 truncate">{p.part_name}</span>
                      <span className="block text-xs text-slate-500 truncate">
                        {p.part_number}{p.storage_location ? ` · ${p.storage_location}` : ''}
                      </span>
                    </span>
                    <span className="w-16 text-right">
                      <span className="block text-sm tabular-nums text-slate-700">{count(system)}</span>
                      <span className="block text-[11px] text-slate-400">system</span>
                    </span>
                    <span className="w-20">
                      <Input
                        type="text" inputMode="numeric" aria-label={`Physical quantity for ${p.part_number}`}
                        data-part={p.part_id}
                        value={e.physical}
                        onChange={(ev) => setEntry(p.part_id, { physical: ev.target.value })}
                        className={`h-9 text-right tabular-nums ${bad ? 'border-red-400' : ''}`}
                        placeholder="—"
                      />
                    </span>
                    <span className="w-full sm:w-44">
                      {differs ? (
                        <select
                          value={e.reason} data-reason={p.part_id}
                          onChange={(ev) => setEntry(p.part_id, { reason: ev.target.value })}
                          className={`h-9 w-full px-2 rounded-md border text-sm bg-white outline-none ${e.reason ? 'border-slate-200' : 'border-amber-400'}`}
                        >
                          <option value="">Reason for variance…</option>
                          {VARIANCE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      ) : (
                        <span className="hidden sm:block text-xs text-slate-400">
                          {bad ? <span className="text-red-600">Whole number, 0 or more</span> : e.physical === '' ? 'not yet counted' : 'matches'}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCounting(false)} disabled={busy}>Cancel</Button>
            <Button onClick={submitCount} disabled={!ready || busy}>
              {busy ? 'Submitting…' : `Submit count${lineState.length ? ` (${count(entered)}/${count(lineState.length)})` : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// "Mar 24" under a bar — the full date is in the bar's title and the picker.
function shortDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.toLocaleString('en-GB', { month: 'short' })} ${String(d.getFullYear()).slice(2)}`
}

function Stat({ label, value, sub, Icon, tone, className = '' }) {
  const ring = tone === 'red' ? 'border-red-200' : tone === 'amber' ? 'border-amber-200'
    : tone === 'green' ? 'border-emerald-200' : 'border-slate-200/60'
  const ink = tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700'
    : tone === 'green' ? 'text-emerald-700' : 'text-slate-900'
  return (
    <div className={`bg-white border rounded-lg shadow-sm p-4 min-w-0 ${ring} ${className}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-1.5 font-bold tabular-nums break-words text-2xl ${ink}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  )
}
