'use client'

// Issue a parts kit onto a work order.
//
// A GSE shop does not pick a 250-hour service one filter at a time. The stores
// clerk pulls the kit — filters, oil, grease — and it goes onto the job as a
// set, which is why the kit exists. So the job offers the kits, with the one its
// work calls for first, and issuing one does the two things a paper issue slip
// did: takes every line out of stock and books every line onto the job.
//
// Both, or the stockroom and the job disagree. Every line is checked against
// what is on the shelf before anything moves, and the first shortfall is named —
// "insufficient stock" on an eight-line kit tells a clerk nothing they can act
// on. If a line still fails part-way (someone issued the last one a moment ago),
// the lines already taken out are the lines booked onto the job, and the
// message says the kit is incomplete.
//
// OEM or aftermarket is chosen per issue because that is the decision the
// sourcing screen informs: the same kit, at either price.

import { useEffect, useMemo, useState } from 'react'
import { PackagePlus } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Label } from '../ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog'
import { useStore } from '../lib/store'
import { useStock } from '../lib/movements'
import { USER, money, loadGseAnalytics } from '../lib/data'

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

// The kit a job's own work points to. Read from the PM template and the system
// the job was raised against — the same two fields a planner reads.
function suggestedKit(wo, asset) {
  const tpl = `${wo?.template_id || ''} ${wo?.failure_code || ''}`
  const system = wo?.system || ''
  if (/250/.test(tpl)) return asset?.power_source === 'Electric' ? 'KIT-PM-250-EL' : 'KIT-PM-250-DSL'
  if (/500/.test(tpl)) return 'KIT-PM-500-DSL'
  if (/SEAS/.test(tpl) || system === 'Snow') return 'KIT-SNOW-IN'
  if (/PREUSE/.test(tpl)) return 'KIT-PREUSE'
  if (system === 'Brakes') return asset?.asset_type === 'Belt Loader' ? 'KIT-BRK-660' : 'KIT-BRK-TUG'
  if (system === 'Hydraulics') return 'KIT-HYD-LEAK'
  if (system === 'Conveyor') return 'KIT-BELT-660'
  if (system === 'GPU') return 'KIT-GPU-CABLE'
  if (system === 'Tow') return 'KIT-TOW-PINS'
  return null
}

/** The button, and the dialog it opens. Renders nothing where the pack has no kits. */
export default function IssueKit({ wo, asset, recordId, recordedKits = [] }) {
  const { update, notify } = useStore()
  const { levels, issue } = useStock()
  const [kits, setKits] = useState(null)
  const [open, setOpen] = useState(false)
  const [kitId, setKitId] = useState('')
  const [source, setSource] = useState('oem')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!loadGseAnalytics) return undefined
    let live = true
    loadGseAnalytics().then((a) => { if (live) setKits(a.kits) }).catch(() => {})
    return () => { live = false }
  }, [])

  const suggested = useMemo(() => suggestedKit(wo, asset), [wo, asset])
  // The suggested kit first, then the rest by type and name.
  const ordered = useMemo(() => (kits || []).slice().sort((x, y) => (
    (y.id === suggested) - (x.id === suggested) || x.type.localeCompare(y.type) || x.name.localeCompare(y.name)
  )), [kits, suggested])

  const kit = ordered.find((k) => k.id === kitId) || null
  const onHand = useMemo(() => new Map(levels.map((p) => [p.part_id, p])), [levels])

  const lines = useMemo(() => (kit ? kit.lines.map((l) => {
    const part = onHand.get(l.part_id)
    const unit = source === 'alt' ? (l.alt_unit_cost || l.oem_unit_cost) : l.oem_unit_cost
    return {
      ...l,
      have: part?.quantity_on_hand ?? 0,
      unit_label: part?.unit || l.unit,
      unit_cost: round2(unit),
      ext: round2(unit * l.qty),
    }
  }) : []), [kit, onHand, source])

  const short = lines.find((l) => l.have < l.qty) || null
  // Already on the job — from the maintenance record, or issued here before.
  // Not refused (a second kit is sometimes right), but never done unknowingly.
  const already = kit && (recordedKits.includes(kit.id) || (wo.parts_used || []).some((p) => p.kit_id === kit.id))
  const total = round2(lines.reduce((n, l) => n + l.ext, 0))

  if (!loadGseAnalytics || !kits?.length) return null

  const start = () => {
    setKitId(suggested && kits.some((k) => k.id === suggested) ? suggested : ordered[0]?.id || '')
    setSource('oem')
    setOpen(true)
  }

  const submit = async () => {
    if (!kit || busy) return
    if (short) {
      notify(`Only ${short.have} ${short.unit_label} of ${short.part_name} on hand — the kit needs ${short.qty}.`, 'error')
      return
    }
    setBusy(true)
    const at = new Date().toISOString()
    const issued = []
    for (const l of lines) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await issue(l.part_id, l.qty, 'Issued to work order', `${wo.work_order_number} · ${kit.id}`)
      if (!ok) break
      issued.push({
        part_id: l.part_id, part_number: l.part_number, part_name: l.part_name,
        quantity: l.qty, unit: l.unit_label, unit_cost: l.unit_cost, ext_cost: l.ext,
        kit_id: kit.id, kit_name: kit.name, source: source === 'alt' ? 'Aftermarket' : 'OEM',
        issued_at: at, issued_by: USER.name,
      })
    }
    if (issued.length) {
      const added = round2(issued.reduce((n, l) => n + l.ext_cost, 0))
      await update('work_order', recordId, {
        parts_used: [...(wo.parts_used || []), ...issued],
        parts_cost: round2((Number(wo.parts_cost) || 0) + added),
        total_cost: round2((Number(wo.total_cost) || 0) + added),
      })
    }
    setBusy(false)
    if (issued.length === lines.length) {
      setOpen(false)
      notify(`${kit.name} issued to ${wo.work_order_number} — ${issued.length} lines, ${money(total)}.`)
    } else {
      notify(`${kit.name} is incomplete on ${wo.work_order_number}: ${issued.length} of ${lines.length} lines issued before stock ran out.`, 'error')
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">Issue a parts kit</p>
          <p className="text-xs text-slate-500">
            Takes every line out of stock and books it onto this job.
            {suggested && kits.some((k) => k.id === suggested) && (
              <> Suggested for this work: <span className="font-medium text-slate-700">{kits.find((k) => k.id === suggested).name}</span>.</>
            )}
          </p>
        </div>
        <Button size="sm" onClick={start} className="gap-1.5">
          <PackagePlus className="h-4 w-4" />
          Issue kit
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) setOpen(false) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Issue kit to {wo.work_order_number}</DialogTitle>
            <DialogDescription>{wo.title}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="kit-pick">Kit</Label>
                <select
                  id="kit-pick" value={kitId} onChange={(e) => setKitId(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                >
                  {ordered.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.id === suggested ? '★ ' : ''}{k.name} ({k.type})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Source</Label>
                <div className="flex gap-2">
                  {[['oem', 'OEM'], ['alt', 'Aftermarket']].map(([v, label]) => (
                    <Button
                      key={v} type="button" size="sm" variant={source === v ? 'default' : 'outline'}
                      onClick={() => setSource(v)} className="flex-1"
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {kit && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3 font-medium">Part</th>
                      <th className="py-2 px-3 font-medium text-right">Qty</th>
                      <th className="py-2 px-3 font-medium text-right">On hand</th>
                      <th className="py-2 px-3 font-medium text-right">Unit</th>
                      <th className="py-2 pl-3 font-medium text-right">Line</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.part_id} className={`border-b border-slate-100 ${l.have < l.qty ? 'bg-red-50' : ''}`}>
                        <td className="py-2 pr-3">
                          <span className="block text-slate-900">{l.part_name}</span>
                          <span className="block font-mono text-xs text-slate-500">{l.part_number}</span>
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">{l.qty} {l.unit_label}</td>
                        <td className={`py-2 px-3 text-right tabular-nums ${l.have < l.qty ? 'font-semibold text-red-700' : 'text-slate-600'}`}>
                          {l.have.toLocaleString('en-US')}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-slate-600">{money(l.unit_cost)}</td>
                        <td className="py-2 pl-3 text-right tabular-nums font-medium text-slate-900">{money(l.ext)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="pt-2 text-right text-slate-500">Kit total</td>
                      <td className="pt-2 pl-3 text-right tabular-nums font-semibold text-slate-900">{money(total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {already && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                This job already carries the {kit.name}. Issue it again only if a second set was used.
              </p>
            )}
            {short && (
              <p className="text-sm text-red-700">
                {short.part_name} is short — {short.have} on hand, the kit needs {short.qty}. Nothing is issued until
                the kit can be issued whole.
              </p>
            )}
            {kit && !short && (
              <p className="text-xs text-slate-500">
                <Badge variant="outline" className="mr-1.5">{source === 'alt' ? 'Aftermarket' : 'OEM'}</Badge>
                Adds {money(total)} to this job&apos;s parts cost.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={!kit || Boolean(short) || busy}>
              {busy ? 'Issuing…' : 'Issue kit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
