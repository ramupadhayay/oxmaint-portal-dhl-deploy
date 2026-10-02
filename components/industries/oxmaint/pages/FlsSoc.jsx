'use client'

// Statement of Conditions — the deficiencies the hospital has written down
// itself, each with the code that sets it, a plan, an owner and a date.
//
// Two lists, and the second is the point of the screen.
//
// The first is the SOC: what is on the record. The second is what the testing
// programme can already prove and the SOC does not mention — a test overdue, a
// certificate expired — sitting one button away from being listed. A surveyor
// finding a deficiency the hospital had already listed sees a programme
// working. Finding one the hospital's own system knew about and never wrote
// down is the finding this screen exists to prevent.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ClipboardList, AlertTriangle, CalendarClock, ShieldAlert, Plus, Wrench, CheckCircle2,
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog'
import ModuleOff from '../components/ModuleOff'
import { useStore } from '../lib/store'
import { useActions } from '../lib/actions'
import { DOMAIN, LOCATIONS, ORG, TECHNICIANS, fmtDate } from '../lib/data'
import { ILSM_ACTIVE, usePfis, useAddPfi, useResolvePfi } from '../lib/ilsm'

export default function FlsSoc() {
  const router = useRouter()
  const { notify } = useStore()
  const { raiseWorkOrder } = useActions()
  const { listed, candidates, totals } = usePfis()
  const addPfi = useAddPfi()
  const resolvePfi = useResolvePfi()

  const [adding, setAdding] = useState(null)   // true, or a candidate to list
  const [resolving, setResolving] = useState(null)
  const [busy, setBusy] = useState('')

  if (!ILSM_ACTIVE) return <ModuleOff module="Statement of Conditions" />

  const raise = async (pfi) => {
    setBusy(pfi._id)
    const wo = await raiseWorkOrder({
      title: `Life safety deficiency — ${pfi.title}`,
      description: `${pfi.code}. Listed on the Statement of Conditions ${fmtDate(pfi.discovered_date)}, `
        + `target ${fmtDate(pfi.target_date)}${pfi.location_name ? `, ${pfi.location_name}` : ''}. `
        + (pfi.ilsm_required ? 'Interim life safety measures are required until it is corrected.' : ''),
      assetId: pfi.asset_id || '',
      type: 'Corrective',
      priority: pfi.overdue ? 'High' : 'Medium',
      dueInDays: Math.max(3, Math.min(pfi.daysToTarget ?? 30, 60)),
      estimatedHours: 4,
      source: `Plan for Improvement ${pfi.pfi_id || pfi._id}`,
      sourceId: pfi._id,
    })
    setBusy('')
    if (wo) notify(`${wo.work_order_number} raised against ${pfi.code.split('—')[0].trim()}.`)
  }

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Statement of Conditions</h1>
          <p className="text-slate-600 mt-1">
            {ORG.organization_name}&rsquo;s own account of its Life Safety Code deficiencies, and the plan for each
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => router.push('/portal/oxmaint/fls-ilsm')}>
            <ShieldAlert className="h-4 w-4" />
            Impairments &amp; ILSM
          </Button>
          <Button className="gap-2" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" />
            Add a deficiency
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label="On the SOC" value={totals.listed} sub={`${totals.resolved} resolved`} Icon={ClipboardList} />
        <Stat label="Open" value={totals.open} sub="awaiting correction" Icon={CalendarClock} tone={totals.open ? 'amber' : 'green'} />
        <Stat label="Past target date" value={totals.overdue} sub="plan date missed" Icon={AlertTriangle} tone={totals.overdue ? 'red' : null} />
        <Stat label="ILSM required" value={totals.ilsm} sub="interim measures needed" Icon={ShieldAlert} tone={totals.ilsm ? 'amber' : null} />
        <Stat label="Proven, not listed" value={totals.candidates} sub="found by the testing programme" Icon={AlertTriangle} tone={totals.candidates ? 'red' : 'green'} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Plans for Improvement</CardTitle>
          <p className="text-sm text-slate-600">
            Each deficiency, the chapter that sets it, who owns putting it right and by when.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {!listed.length && <p className="py-6 text-center text-sm text-slate-500">Nothing is listed yet.</p>}
          {listed.map((p) => (
            <div key={p._id} className={`rounded-lg border p-3 ${p.overdue ? 'border-red-200 bg-red-50/40' : 'border-slate-200'}`}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{p.title}</span>
                    {!p.open ? <Badge className="bg-slate-100 text-slate-700">Resolved</Badge>
                      : p.overdue ? <Badge className="bg-red-100 text-red-800">Past target</Badge>
                        : <Badge className="bg-amber-100 text-amber-800">Open</Badge>}
                    {p.ilsm_required && <Badge variant="secondary">ILSM required</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {p.code}
                    {p.location_name ? ` · ${p.location_name}` : ''}
                    {p.source ? ` · ${p.source}` : ''}
                  </p>
                </div>
                {p.open && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={busy === p._id} onClick={() => raise(p)}>
                      <Wrench className="h-3.5 w-3.5" />
                      {busy === p._id ? 'Raising…' : 'Raise job'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={() => setResolving(p)}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Resolved
                    </Button>
                  </div>
                )}
              </div>

              <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <Cell label="Discovered">{fmtDate(p.discovered_date)}<span className="text-slate-500"> · {p.daysOpen} days ago</span></Cell>
                <Cell label="Target" tone={p.overdue ? 'text-red-700 font-semibold' : ''}>
                  {fmtDate(p.target_date)}
                  {p.open && p.daysToTarget !== null && (
                    <span className={p.overdue ? '' : 'text-slate-500'}>
                      {p.overdue ? ` · ${Math.abs(p.daysToTarget)} days over` : ` · in ${p.daysToTarget} days`}
                    </span>
                  )}
                </Cell>
                <Cell label="Owner">{p.owner || '—'}</Cell>
                <Cell label={p.open ? 'Interim measures' : 'Closed out'}>
                  {p.open
                    ? (p.ilsm_required ? 'Required — see Impairments & ILSM' : 'Not required')
                    : `${fmtDate(p.resolved_date)}${p.resolution_note ? ` · ${p.resolution_note}` : ''}`}
                </Cell>
              </dl>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* The gap between what the building says and what the SOC says. */}
      <Card className={candidates.length ? 'border-red-200' : undefined}>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            Proven by the testing programme, not on the SOC
            <Badge className={candidates.length ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}>
              {candidates.length}
            </Badge>
          </CardTitle>
          <p className="text-sm text-slate-600">
            Each of these is a test this system can already show is overdue or unevidenced. Listing one puts it on the
            record with a plan and a date.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {!candidates.length && (
            <p className="py-4 text-center text-sm text-emerald-700">
              Nothing outstanding — every test the programme tracks is current and evidenced.
            </p>
          )}
          {candidates.map((c) => (
            <div key={c.test_key} className="flex flex-wrap items-start gap-3 rounded-lg border border-slate-200 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{c.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {c.code} · {c.system}
                  {c.location_name ? ` · ${c.location_name}` : ''}
                </p>
              </div>
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setAdding(c)}>
                <Plus className="h-3.5 w-3.5" />
                Add to the SOC
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <AddPfiDialog
        state={adding}
        onClose={() => setAdding(null)}
        onSave={async (payload) => { const r = await addPfi(payload); if (r) setAdding(null) }}
      />
      <ResolveDialog
        pfi={resolving}
        onClose={() => setResolving(null)}
        onConfirm={async (note) => { await resolvePfi(resolving, note); setResolving(null) }}
      />
    </div>
  )
}

/**
 * List a deficiency.
 *
 * Opened either empty or from a candidate the testing programme proved. In the
 * second case the code, the wording and the location arrive filled in and the
 * test key travels with them, so the same deficiency is never offered twice.
 */
function AddPfiDialog({ state, onClose, onSave }) {
  const codes = DOMAIN?.pfiCodes || []
  const owners = TECHNICIANS.map((t) => t.name)
  const candidate = state && state !== true ? state : null

  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [days, setDays] = useState('60')
  const [ilsm, setIlsm] = useState(false)
  const [owner, setOwner] = useState('')
  const [saving, setSaving] = useState(false)
  const [seen, setSeen] = useState(null)

  if (state !== seen) {
    setSeen(state)
    if (state) {
      setCode(candidate?.code || codes[0] || '')
      setTitle(candidate?.title || '')
      setLocation(candidate?.location_name || '')
      setDays(candidate?.ilsm_required ? '30' : '60')
      setIlsm(Boolean(candidate?.ilsm_required))
      setOwner('')
      setSaving(false)
    }
  }
  if (!state) return null

  const save = async () => {
    setSaving(true)
    await onSave({
      code,
      title,
      locationName: location,
      siteId: candidate?.site_id || '',
      assetId: candidate?.asset_id || '',
      targetDays: days,
      ilsm,
      owner,
      testKey: candidate?.test_key || '',
    })
    setSaving(false)
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{candidate ? 'Add it to the Statement of Conditions' : 'Add a deficiency'}</DialogTitle>
          <DialogDescription>
            {candidate
              ? 'Proven by the testing programme. Give it an owner and a date and it is on the record.'
              : 'A Life Safety Code deficiency, the chapter that sets it, and the plan to put it right.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="pfi-code" className="mb-1 block text-xs text-slate-600">Code reference</Label>
            {candidate ? (
              <Input id="pfi-code" className="h-9" value={code} onChange={(e) => setCode(e.target.value)} />
            ) : (
              <Select value={code} onValueChange={setCode}>
                <SelectTrigger id="pfi-code" className="h-9"><SelectValue placeholder="Which chapter" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {codes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <Label htmlFor="pfi-title" className="mb-1 block text-xs text-slate-600">What was found</Label>
            <Textarea id="pfi-title" rows={2} value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Unsealed cable penetration above the ceiling at the 3 East smoke barrier" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Label htmlFor="pfi-loc" className="mb-1 block text-xs text-slate-600">Location</Label>
              <Select value={location || undefined} onValueChange={setLocation}>
                <SelectTrigger id="pfi-loc" className="h-9"><SelectValue placeholder="Where it is" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {LOCATIONS.map((l) => <SelectItem key={l.functional_location_id} value={l.name}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pfi-days" className="mb-1 block text-xs text-slate-600">Target in days</Label>
              <Input id="pfi-days" className="h-9" type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pfi-owner" className="mb-1 block text-xs text-slate-600">Owner</Label>
              <Select value={owner || undefined} onValueChange={setOwner}>
                <SelectTrigger id="pfi-owner" className="h-9"><SelectValue placeholder="Who owns the plan" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {owners.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <label className="flex cursor-pointer items-end gap-2 pb-2 text-sm text-slate-800">
              <input type="checkbox" checked={ilsm} onChange={(e) => setIlsm(e.target.checked)} />
              <span>Interim life safety measures required</span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!title.trim() || !code || saving} onClick={save}>
            {saving ? 'Listing…' : 'List it'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ResolveDialog({ pfi, onClose, onConfirm }) {
  const [note, setNote] = useState('')
  const [seen, setSeen] = useState(null)
  if (pfi !== seen) { setSeen(pfi); if (pfi) setNote('') }
  if (!pfi) return null

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark the deficiency resolved</DialogTitle>
          <DialogDescription>{pfi.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="pfi-res" className="mb-1 block text-xs text-slate-600">How it was corrected</Label>
            <Textarea id="pfi-res" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Penetration firestopped to the listed system and photographed, WO-2481" />
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            It stays on the Statement of Conditions as a resolved entry. A surveyor asks what the hospital has put
            right as often as what it has not.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm(note)}>Mark resolved</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Cell({ label, tone = '', children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-slate-900 ${tone}`}>{children}</dd>
    </div>
  )
}

function Stat({ label, value, sub, Icon, tone }) {
  const ring = tone === 'red' ? 'border-red-200' : tone === 'amber' ? 'border-amber-200' : tone === 'green' ? 'border-emerald-200' : 'border-slate-200/60'
  const ink = tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700' : tone === 'green' ? 'text-emerald-700' : 'text-slate-900'
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
