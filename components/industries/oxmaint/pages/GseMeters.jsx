'use client'

// Meters & Utilisation — the hours, and what they are about to trigger.
//
// A GSE department schedules on engine hours: 250, 500, 1000, and the calendar
// underneath as a backstop. That only works if somebody reads the meters, so
// this screen is built around the reading rather than around the report — log
// one here, and the unit's position against every tier moves with it.
//
// The list is ordered by what falls due soonest *at that unit's own rate*, not
// by hours remaining. A tug doing eleven hours a day and a gateway forklift
// doing two are not the same distance from a service even when the number of
// hours left is identical, and ordering on the raw number is how a hub unit
// gets missed.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Gauge, Zap, Clock, AlertTriangle, Search, History, Plus } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Input } from '../ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select'
import { useStore, useRecords } from '../lib/store'
import { fleet, GSE_ACTIVE } from '../lib/gse'
import { METER_TYPES, METER_KIND, readingsFor, unitOf, useLogReading } from '../lib/meters'
import { ASSETS, SITES, USER, fmtDate } from '../lib/data'
import ModuleOff from '../components/ModuleOff'

const idOfAsset = (a) => a.asset_id || a.recordId

export default function GseMeters() {
  const router = useRouter()
  const store = useStore()
  const logReading = useLogReading()
  const merged = useRecords('asset', ASSETS, idOfAsset)

  const [site, setSite] = useState('all')
  const [q, setQ] = useState('')
  const [logging, setLogging] = useState(null)
  const [value, setValue] = useState('')
  const [type, setType] = useState('hours')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  // The fleet's GSE reading, but with the stored assets layered over the seeded
  // ones — otherwise a reading logged here would not move the row it was
  // logged against until a reload.
  const rows = useMemo(() => {
    const stored = new Map(merged.map((a) => [idOfAsset(a), a]))
    return fleet()
      .map((a) => ({ ...a, ...(stored.get(a.asset_id) || {}), _service: a._service, _battery: a._battery, _powered: a._powered, _electric: a._electric }))
      .filter((a) => a._powered)
  }, [merged])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows
      .filter((a) => (site === 'all' || a.site_id === site))
      .filter((a) => !needle || `${a.asset_name} ${a.asset_code} ${a.asset_type}`.toLowerCase().includes(needle))
      // Soonest by days, not by hours — see the note at the top.
      .sort((a, b) => {
        const da = a._service?.next?.daysRemaining ?? 9999
        const db = b._service?.next?.daysRemaining ?? 9999
        return da - db
      })
  }, [rows, site, q])

  if (!GSE_ACTIVE) return <ModuleOff module="Meters and utilisation" />

  const dueSoon = shown.filter((a) => (a._service?.next?.daysRemaining ?? 999) <= 14)
  const stale = shown.filter((a) => (a._service?.daysSinceRead ?? 0) > 14)
  const logged = (store.records?.[METER_KIND] || []).length

  const openLog = (a) => {
    setLogging(a)
    setValue(String(a.running_hours ?? ''))
    setType('hours')
    setNote('')
  }

  const save = async () => {
    if (!logging) return
    setBusy(true)
    const ok = await logReading({ asset: logging, value, type, by: USER.name, note })
    setBusy(false)
    if (ok) setLogging(null)
  }

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Meters &amp; Utilisation</h1>
          <p className="text-slate-600 mt-1">
            Engine hours per unit, and what the next tiered service is waiting on
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search unit, code, class…"
              className="h-10 w-[240px] pl-9 pr-3 rounded-md border border-slate-200 text-sm outline-none focus:border-primary/40"
            />
          </div>
          <select
            value={site} onChange={(e) => setSite(e.target.value)}
            className="h-10 px-3 rounded-md border border-slate-200 text-sm bg-white outline-none focus:border-primary/40"
          >
            <option value="all">All stations</option>
            {SITES.map((s) => <option key={s.site_id} value={s.site_id}>{s.site_name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Metered units" value={shown.length} sub="powered equipment only" Icon={Gauge} />
        <Stat label="Service within 14 days" value={dueSoon.length} sub="at each unit's own rate" Icon={Clock} tone={dueSoon.length ? 'amber' : null} />
        <Stat label="Reading over 14 days old" value={stale.length} sub="hours may be understated" Icon={AlertTriangle} tone={stale.length ? 'amber' : null} />
        <Stat label="Readings logged here" value={logged} sub="in this session's record" Icon={History} />
      </div>

      {stale.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {stale.length} unit(s) have not had a meter read in over two weeks. A meter-based schedule is
          only as current as its last reading — these units may already be past a service without the
          schedule knowing.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Fleet meters
            <span className="ml-auto text-sm font-normal text-slate-500">{shown.length} units · soonest first</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Unit</th>
                  <th className="py-2 px-3 font-medium">Station</th>
                  <th className="py-2 px-3 font-medium text-right">Hours</th>
                  <th className="py-2 px-3 font-medium text-right">Per day</th>
                  <th className="py-2 px-3 font-medium">Next service</th>
                  <th className="py-2 px-3 font-medium text-right">Due in</th>
                  <th className="py-2 px-3 font-medium text-right">Last read</th>
                  <th className="py-2 pl-3" />
                </tr>
              </thead>
              <tbody>
                {shown.map((a) => {
                  const s = a._service
                  const days = s?.next?.daysRemaining
                  const soon = days != null && days <= 14
                  const staleRead = (s?.daysSinceRead ?? 0) > 14
                  return (
                    <tr key={a.asset_id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2.5 pr-3">
                        <button
                          onClick={() => router.push(`/portal/oxmaint/assets/${encodeURIComponent(a.asset_id)}`)}
                          className="text-left"
                        >
                          <span className="block font-medium text-slate-900">
                            {a.asset_name}
                            {a._electric && <Zap className="inline w-3.5 h-3.5 ml-1.5 text-blue-500" />}
                          </span>
                          <span className="block text-xs text-slate-500">{a.asset_code} · {a.asset_type}</span>
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{a.site_name}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-slate-900">
                        {Number(a.running_hours || 0).toLocaleString('en-US')}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-slate-600">{s?.perDay ?? '—'}</td>
                      <td className="py-2.5 px-3 text-slate-600">{s?.next?.label ?? '—'}</td>
                      <td className={`py-2.5 px-3 text-right tabular-nums ${soon ? 'text-amber-700 font-semibold' : 'text-slate-600'}`}>
                        {days == null ? '—' : `${days}d · ${s.next.hoursRemaining}h`}
                      </td>
                      <td className={`py-2.5 px-3 text-right ${staleRead ? 'text-amber-700' : 'text-slate-500'}`}>
                        {s ? `${s.daysSinceRead}d ago` : '—'}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <Button size="sm" variant="outline" className="h-8 gap-1.5"
                          onClick={() => openLog(a)}>
                          <Plus className="w-3.5 h-3.5" />
                          Reading
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {shown.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">No metered units match these filters.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Reading history
            <span className="ml-auto text-sm font-normal text-slate-500">{logged}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logged === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No readings logged yet. Every reading is kept with who took it and when — an audit asks,
              and a warranty claim turns on what the meter said on a date.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {(store.records?.[METER_KIND] || [])
                .slice()
                .sort((a, b) => new Date(b.read_at || 0) - new Date(a.read_at || 0))
                .slice(0, 20)
                .map((r) => (
                  <div key={r.recordId} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1 text-sm text-slate-900 truncate">
                      {r.asset_name} <span className="text-slate-400">{r.asset_code}</span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-slate-900">
                      {Number(r.value).toLocaleString('en-US')}{unitOf(r.meter_type)}
                    </span>
                    {r.delta != null && (
                      <Badge variant="secondary" className="shrink-0">+{r.delta}{unitOf(r.meter_type)}</Badge>
                    )}
                    <span className="text-xs text-slate-500 shrink-0">{r.read_by}</span>
                    <span className="text-xs text-slate-400 shrink-0 w-24 text-right">{fmtDate(r.read_at)}</span>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(logging)} onOpenChange={(o) => !o && setLogging(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log a meter reading</DialogTitle>
          </DialogHeader>
          {logging && (
            <div className="space-y-4">
              <div className="rounded-md bg-slate-50 px-3 py-2">
                <p className="text-sm font-medium text-slate-900">{logging.asset_name}</p>
                <p className="text-xs text-slate-500">
                  {logging.asset_code} · {logging.site_name} · last reading{' '}
                  {Number(logging.running_hours || 0).toLocaleString('en-US')}h
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">Meter</p>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="h-9 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {METER_TYPES.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">Reading</p>
                  <Input
                    type="number" min="0"
                    step={METER_TYPES.find((t) => t.key === type)?.step || '1'}
                    value={value} onChange={(e) => setValue(e.target.value)}
                    className="h-9 bg-white"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">Note (optional)</p>
                <Input value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="Meter replaced, reading corrected…" className="h-9 bg-white" />
              </div>

              <p className="text-xs text-slate-500">
                A reading below the last one, or one that implies more than twenty hours a day since it,
                is refused — those are a mis-key or a replaced meter, and both need saying rather than
                saving.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogging(null)} disabled={busy}>Cancel</Button>
            <Button onClick={save} disabled={busy || value === ''}>
              {busy ? 'Saving…' : 'Log reading'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Stat({ label, value, sub, Icon, tone }) {
  const ring = tone === 'amber' ? 'border-amber-200' : tone === 'red' ? 'border-red-200' : 'border-slate-200/60'
  const ink = tone === 'amber' ? 'text-amber-700' : tone === 'red' ? 'text-red-700' : 'text-slate-900'
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
