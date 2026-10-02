'use client'

// Impairments & ILSM — what is out of service, and what is in place instead.
//
// The screen is built around the one measure that is a duty rather than a
// checkbox. Tagging a valve and telling the fire department happen once; a fire
// watch is a person walking the floor every hour and signing for it, and the
// signature is the evidence. So the watch has its own column, its own overdue
// state and its own button, and the rest of the measures sit under it as a list
// that is either confirmed or visibly not.
//
// An impairment with a fire watch signed twenty minutes ago and every measure
// confirmed reads green. Nothing else does — least of all one where somebody
// ticked the measures and nobody has walked since the shift before last.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShieldAlert, ShieldCheck, Clock, ClipboardList, AlertTriangle, Footprints, Wrench, CheckCircle2, CircleSlash,
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
import { useStore, useRecords } from '../lib/store'
import { useActions } from '../lib/actions'
import { ASSETS, DOMAIN, fmtDate } from '../lib/data'
import {
  ILSM_ACTIVE, IMPAIRMENT_CAUSES, SYSTEM_LABEL, measuresFor,
  useImpairments, useLogWatchRound, useSetMeasure, useCloseImpairment, useDeclareImpairment,
} from '../lib/ilsm'

const assetIdOf = (a) => a.asset_id || a.recordId

export default function FlsIlsm() {
  const router = useRouter()
  const { notify } = useStore()
  const { raiseWorkOrder } = useActions()
  const { items, totals } = useImpairments()
  const logRound = useLogWatchRound()
  const setMeasure = useSetMeasure()
  const closeImpairment = useCloseImpairment()

  const [declaring, setDeclaring] = useState(false)
  const [rounding, setRounding] = useState(null)      // the impairment a round is being signed for
  const [closing, setClosing] = useState(null)
  const [busy, setBusy] = useState('')

  if (!ILSM_ACTIVE) return <ModuleOff module="Interim life safety measures" />

  const raise = async (imp) => {
    setBusy(imp._id)
    const wo = await raiseWorkOrder({
      title: `Restore to service — ${imp.asset_name || imp.system_label}`,
      description: `${imp.system_label} impaired: ${imp.reason}. Declared ${fmtDate(imp.declared_date)} by ${imp.declared_by}. `
        + 'Interim life safety measures are in force until this is back in service and the impairment is closed.',
      assetId: imp.asset_id,
      type: 'Corrective',
      priority: 'High',
      dueInDays: Math.max(1, imp.expected_end ? 3 : 7),
      estimatedHours: 4,
      source: `Impairment ${imp.impairment_id || imp._id}`,
      sourceId: imp._id,
    })
    setBusy('')
    if (wo) notify(`${wo.work_order_number} raised to restore ${imp.asset_name || imp.system_label}.`)
  }

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Impairments &amp; ILSM</h1>
          <p className="text-slate-600 mt-1">
            Life safety features out of service, and the interim measures in force while the building stays occupied
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => router.push('/portal/oxmaint/fls-soc')}>
            <ClipboardList className="h-4 w-4" />
            Statement of Conditions
          </Button>
          <Button className="gap-2" onClick={() => setDeclaring(true)}>
            <ShieldAlert className="h-4 w-4" />
            Declare an impairment
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label="Open impairments" value={totals.open} sub="features out of service" Icon={ShieldAlert} tone={totals.open ? 'amber' : null} />
        <Stat label="Fire watch due" value={totals.watchDue} sub="no round inside the hour" Icon={Footprints} tone={totals.watchDue ? 'red' : 'green'} />
        <Stat label="Measures not confirmed" value={totals.measuresMissing} sub="across open impairments" Icon={AlertTriangle} tone={totals.measuresMissing ? 'red' : null} />
        <Stat label="Past expected return" value={totals.overrun} sub="longer than declared" Icon={Clock} tone={totals.overrun ? 'amber' : null} />
        <Stat label="Rounds signed today" value={totals.roundsToday} sub="fire watch signatures" Icon={ShieldCheck} tone="green" />
      </div>

      {!items.length && (
        <Card>
          <CardContent className="py-10 text-center">
            <ShieldCheck className="mx-auto h-7 w-7 text-emerald-600" />
            <p className="mt-2 text-sm font-semibold text-slate-900">Nothing is impaired</p>
            <p className="mt-1 text-xs text-slate-500">
              Declare one when a life safety feature goes out of service — the measures the code asks for appear with it.
            </p>
          </CardContent>
        </Card>
      )}

      {items.map((imp) => (
        <Card key={imp._id} className={imp.open && !imp.ready ? 'border-red-200' : undefined}>
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <span>{imp.asset_name || imp.system_label}</span>
              {!imp.open ? <Badge className="bg-slate-100 text-slate-700">Back in service</Badge>
                : imp.watchDue ? <Badge className="bg-red-100 text-red-800">Fire watch due</Badge>
                  : imp.missing.length ? <Badge className="bg-amber-100 text-amber-800">Measures not confirmed</Badge>
                    : <Badge className="bg-emerald-100 text-emerald-800">Measures in force</Badge>}
              <Badge variant="secondary">{imp.system_label}</Badge>
              <Badge variant="secondary">{imp.cause}</Badge>
              <span className="ml-auto text-sm font-normal text-slate-500">
                {imp.asset_code || imp.location_name || imp.site_name}
              </span>
            </CardTitle>
            <p className="text-sm text-slate-600">{imp.reason}</p>
          </CardHeader>

          <CardContent className="space-y-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <Cell label="Declared">
                {fmtDate(imp.declared_date)}
                <span className="text-slate-500"> · {imp.declared_by}</span>
              </Cell>
              <Cell label="Expected back" tone={imp.overrun > 0 ? 'text-amber-700 font-semibold' : ''}>
                {fmtDate(imp.expected_end)}
                {imp.overrun > 0 ? ` · ${imp.overrun} days over` : ''}
              </Cell>
              <Cell label="Days out of service">{imp.daysOpen}</Cell>
              <Cell label="Fire watch" tone={imp.watchDue ? 'text-red-700 font-semibold' : ''}>
                {imp.watchMeasure ? (
                  imp.lastRound
                    ? `${imp.sinceLast === 0 ? 'Signed within the hour' : `${imp.sinceLast} h ago`} · ${imp.roundCount} rounds`
                    : 'No round signed'
                ) : 'Not required for this system'}
              </Cell>
            </dl>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Interim measures the code asks for
              </p>
              <ul className="mt-2 space-y-1.5">
                {imp.measures.map((m) => {
                  const on = m.watch ? !imp.watchDue : imp.confirmedKeys.has(m.key)
                  return (
                    <li key={m.key} className="flex flex-wrap items-start gap-2 text-sm">
                      {on
                        ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        : <CircleSlash className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
                      <span className={`min-w-0 flex-1 ${on ? 'text-slate-800' : 'text-red-700'}`}>
                        {m.label}
                        <span className="text-slate-400"> · {m.standard}</span>
                        {m.watch && imp.lastRound && (
                          <span className="text-slate-500"> · last signed by {imp.lastRound.by}</span>
                        )}
                      </span>
                      {imp.open && (m.watch ? (
                        <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={() => setRounding(imp)}>
                          <Footprints className="h-3.5 w-3.5" />
                          Sign a round
                        </Button>
                      ) : (
                        <Button
                          size="sm" variant="ghost" className="h-7"
                          onClick={() => setMeasure(imp, m.key, !imp.confirmedKeys.has(m.key))}
                        >
                          {on ? 'Take back' : 'Confirm'}
                        </Button>
                      ))}
                    </li>
                  )
                })}
              </ul>
            </div>

            {imp.open && imp.gaps.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                  What a surveyor would ask about
                </p>
                <ul className="mt-1.5 space-y-1 text-sm text-red-800">
                  {imp.gaps.map((g) => <li key={g}>{g}</li>)}
                </ul>
              </div>
            )}

            {imp.rounds.length > 0 && (
              <details className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-slate-500">
                  Fire watch log · {imp.rounds.length} rounds
                </summary>
                <ul className="mt-2 space-y-1 text-sm">
                  {imp.rounds.slice(0, 12).map((w) => (
                    <li key={w.recordId} className="flex flex-wrap gap-2 text-slate-700">
                      <span className="tabular-nums text-slate-500">
                        {new Date(w.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="font-medium">{w.by}</span>
                      {w.note && <span className="text-slate-500">— {w.note}</span>}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {imp.open && (
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <Button size="sm" variant="outline" className="gap-1.5" disabled={busy === imp._id} onClick={() => raise(imp)}>
                  <Wrench className="h-3.5 w-3.5" />
                  {busy === imp._id ? 'Raising…' : 'Raise the job to restore it'}
                </Button>
                <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setClosing(imp)}>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Back in service
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <SignRoundDialog
        impairment={rounding}
        onClose={() => setRounding(null)}
        onSign={async ({ by, note }) => { await logRound({ impairment: rounding, by, note }); setRounding(null) }}
      />
      <CloseDialog
        impairment={closing}
        onClose={() => setClosing(null)}
        onConfirm={async (note) => { await closeImpairment(closing, note); setClosing(null) }}
      />
      <DeclareDialog open={declaring} onClose={() => setDeclaring(false)} />
    </div>
  )
}

/**
 * Sign a fire watch round.
 *
 * The name is asked for rather than assumed. A fire watch is often walked by
 * security or by a contractor's own people, and a log that says every round was
 * walked by whoever happened to be signed into the portal is a log a surveyor
 * is right to disbelieve.
 */
function SignRoundDialog({ impairment, onClose, onSign }) {
  const [by, setBy] = useState('')
  const [note, setNote] = useState('')
  const [seen, setSeen] = useState(null)
  if (impairment !== seen) { setSeen(impairment); if (impairment) { setBy(''); setNote('') } }
  if (!impairment) return null

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign a fire watch round</DialogTitle>
          <DialogDescription>
            {impairment.asset_name || impairment.system_label} — {impairment.reason}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="watch-by" className="mb-1 block text-xs text-slate-600">Walked by</Label>
            <Input id="watch-by" className="h-9" placeholder="Name of the person who walked it" value={by} onChange={(e) => setBy(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="watch-note" className="mb-1 block text-xs text-slate-600">What was seen (optional)</Label>
            <Textarea id="watch-note" rows={3} placeholder="e.g. 4 North corridor clear, no hot work in progress, extinguishers in place"
              value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            The round is stamped with the time it was signed. The watch falls due again{' '}
            {impairment.watchEveryHours === 1 ? 'an hour' : `${impairment.watchEveryHours} hours`} later.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSign({ by, note })}>Sign the round</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CloseDialog({ impairment, onClose, onConfirm }) {
  const [note, setNote] = useState('')
  const [seen, setSeen] = useState(null)
  if (impairment !== seen) { setSeen(impairment); if (impairment) setNote('') }
  if (!impairment) return null

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Put it back in service</DialogTitle>
          <DialogDescription>
            {impairment.asset_name || impairment.system_label} — open {impairment.daysOpen}{' '}
            {impairment.daysOpen === 1 ? 'day' : 'days'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="close-note" className="mb-1 block text-xs text-slate-600">How it was restored</Label>
            <Textarea id="close-note" rows={3} placeholder="e.g. Riser valve reopened and flow verified, tag removed, fire department notified"
              value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            The fire watch stops being due once this is closed. The rounds already signed stay on the record.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm(note)}>Back in service</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Declare an impairment.
 *
 * The measures are shown while it is being declared, not after, because that is
 * when they are put in place. The ones left unticked are the honest answer and
 * the screen will keep saying so.
 */
function DeclareDialog({ open, onClose }) {
  const declare = useDeclareImpairment()
  const assets = useRecords('asset', ASSETS, assetIdOf)
  const systems = DOMAIN?.systems || []
  const [system, setSystem] = useState(systems[0]?.key || '')
  const [assetId, setAssetId] = useState('')
  const [reason, setReason] = useState('')
  const [cause, setCause] = useState(IMPAIRMENT_CAUSES[0])
  const [days, setDays] = useState('7')
  const [confirmed, setConfirmed] = useState([])
  const [saving, setSaving] = useState(false)
  const [seen, setSeen] = useState(open)
  if (open !== seen) {
    setSeen(open)
    if (open) {
      setSystem(systems[0]?.key || ''); setAssetId(''); setReason('')
      setCause(IMPAIRMENT_CAUSES[0]); setDays('7'); setConfirmed([])
    }
  }

  const chosenSystem = systems.find((s) => s.key === system) || null
  const kinds = useMemo(() => new Set(systems.find((s) => s.key === system)?.kinds || []), [systems, system])
  const choices = useMemo(
    () => assets.filter((a) => kinds.has(a.asset_type)).slice(0, 60),
    [assets, kinds],
  )
  const measures = measuresFor(system).filter((m) => !m.watch)
  const watch = measuresFor(system).find((m) => m.watch)

  const save = async () => {
    setSaving(true)
    const asset = assets.find((a) => String(assetIdOf(a)) === String(assetId))
    const row = await declare({ system, asset, reason, cause, expectedDays: days, confirmed })
    setSaving(false)
    if (row) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Declare an impairment</DialogTitle>
          <DialogDescription>
            A life safety feature out of service while the building stays occupied.
          </DialogDescription>
        </DialogHeader>

        {/* Three rows of fields, then the measures two abreast. The form used to
            run past the bottom of a laptop screen, and a declaration nobody can
            reach the button of is a declaration that does not get made. */}
        <div className="space-y-2.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr]">
            <div className="min-w-0">
              <Label htmlFor="imp-system" className="mb-1 block text-xs text-slate-600">
                System
                {chosenSystem && <span className="ml-1.5 font-normal text-slate-400">{chosenSystem.standard}</span>}
              </Label>
              {/* The standard rides on the label, not inside the control: it is
                  the same for every option once one is chosen, and in the
                  trigger it only made the text too long for the field. */}
              <Select value={system} onValueChange={(v) => { setSystem(v); setAssetId(''); setConfirmed([]) }}>
                <SelectTrigger id="imp-system" className="h-9 w-full"><SelectValue placeholder="Which system" /></SelectTrigger>
                <SelectContent>
                  {systems.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <Label htmlFor="imp-cause" className="mb-1 block text-xs text-slate-600">Cause</Label>
              <Select value={cause} onValueChange={setCause}>
                <SelectTrigger id="imp-cause" className="h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {IMPAIRMENT_CAUSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr]">
            <div className="min-w-0">
              <Label htmlFor="imp-asset" className="mb-1 block text-xs text-slate-600">What is out of service</Label>
              <Select value={assetId || undefined} onValueChange={setAssetId}>
                <SelectTrigger id="imp-asset" className="h-9 w-full"><SelectValue placeholder="Choose the asset" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {choices.map((a) => (
                    <SelectItem key={assetIdOf(a)} value={String(assetIdOf(a))}>
                      {a.asset_name} — {a.asset_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <Label htmlFor="imp-days" className="mb-1 block text-xs text-slate-600">Expected days out</Label>
              <Input id="imp-days" className="h-9" type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="imp-reason" className="mb-1 block text-xs text-slate-600">Why it is out of service</Label>
            <Input id="imp-reason" className="h-9" placeholder="e.g. Riser valve closed for corridor renovation — 4 North"
              value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Measures in place now</p>
              <span className="text-[11px] text-slate-400">
                {confirmed.length} of {measures.length} · the rest stay listed on the impairment
              </span>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {measures.map((m) => (
                <label
                  key={m.key} title={`${m.label} · ${m.standard}`}
                  className="flex cursor-pointer items-start gap-2 text-[12.5px] leading-snug text-slate-800"
                >
                  <input
                    type="checkbox" className="mt-[3px] shrink-0"
                    checked={confirmed.includes(m.key)}
                    onChange={(e) => setConfirmed((c) => (e.target.checked ? [...c, m.key] : c.filter((k) => k !== m.key)))}
                  />
                  {/* The short form here, the full wording on the impairment
                      itself. Eight measures at full length made the form taller
                      than the window it has to be finished in. */}
                  <span className="min-w-0">{m.short || m.label}</span>
                </label>
              ))}
            </div>
            {watch && (
              <p className="mt-2 text-[11px] leading-snug text-slate-500">
                A fire watch is required here — sign each round from the impairment itself.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!reason.trim() || !assetId || saving} onClick={save}>
            {saving ? 'Declaring…' : 'Declare it'}
          </Button>
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
