'use client'

// Labour — time booked against work, by the organisation's own technicians and
// by contractors.
//
// This was a table computed once from the seeded work orders, so nothing booked
// in the portal ever reached it, and it had no idea contractors existed. It now
// reads labour entries: every completion from the execution screen books one,
// every contractor visit is booked from a work order's Time tab or from here.
//
// Contractors get their own table rather than a column, because the questions
// are different. Of a technician you ask how busy they are; of a firm you ask
// what it has billed, on how many jobs — and, in regulated work, which of its
// people signed the test.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader, StatStrip, Section, DataTable, StatusBadge, ActionButton, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { useRecords } from '../lib/store'
import {
  useLabourEntries, useLogLabour, labourRollup, WORKER_TYPES, TECHNICIAN_NAMES, VENDOR_NAMES,
  inHouseRate, contractorRate,
} from '../lib/labour'
import { WORK_ORDERS, money, fmtDate } from '../lib/data'
import { LABOUR } from '../lib/dataOps'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog'

const { MUTE, SUB, INK, GREEN, AMBER, BLUE } = PALETTE

const woIdOf = (w) => w.workorder_id || w.recordId

const utilColour = (pct) => (pct >= 85 ? GREEN : pct >= 65 ? BLUE : AMBER)

// A number and a bar in the same cell, because 71% and 94% are hard to tell
// apart in a column of figures and impossible to miss side by side.
/**
 * Hours, with the bar inside the column.
 *
 * The chart this replaces put the name on the left of a card and the number on
 * the far right, with a full-width bar under both: three things to read and no
 * two of them aligned. Here the track is a fixed width in a fixed column, so
 * every bar shares a left edge and the eye can compare lengths, and the figure
 * sits against it in tabular figures.
 *
 * The darker segment is the time booked in the portal. It is usually a sliver
 * beside the modelled history, and it is the sliver that is real.
 */
function HoursCell({ hours, max, booked = 0 }) {
  const pct = Math.max(2, Math.round((hours / max) * 100))
  const bookedPct = hours > 0 ? Math.min(100, Math.round((booked / hours) * 100)) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
      <div style={{ width: 130, height: 8, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#a5b4fc', borderRadius: 999, position: 'relative' }}>
          {bookedPct > 0 && (
            <div
              title={`${booked} h booked in the portal`}
              style={{ width: `${bookedPct}%`, height: '100%', background: '#15227a', borderRadius: 999 }}
            />
          )}
        </div>
      </div>
      <span style={{ fontWeight: 700, color: INK, minWidth: 46, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {hours} h
      </span>
    </div>
  )
}

function UtilBar({ pct }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
      <div style={{ width: 62, height: 6, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: utilColour(pct), borderRadius: 999 }} />
      </div>
      <span style={{ fontWeight: 700, color: INK, minWidth: 30, textAlign: 'right' }}>{pct}%</span>
    </div>
  )
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const today = () => new Date().toISOString().slice(0, 10)

const blankForm = () => ({
  workOrderId: '', workerType: 'In-house', workerName: '', vendorName: '', contractorTech: '',
  hours: '', rate: '', workDate: today(), note: '',
})

export default function Labour() {
  const router = useRouter()
  const { scope, siteName } = useSite()
  const entries = useLabourEntries()
  const logLabour = useLogLabour()
  const workOrders = useRecords('work_order', WORK_ORDERS, woIdOf)

  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const scopedEntries = useMemo(() => scope(entries), [scope, entries])
  const { people, firms } = useMemo(
    () => labourRollup(scope(LABOUR), scopedEntries),
    [scope, scopedEntries],
  )

  const inHouseHours = round2(people.reduce((n, r) => n + (Number(r.hours_logged) || 0), 0))
  const contractorHours = round2(firms.reduce((n, f) => n + (Number(f.hours) || 0), 0))
  const cost = people.reduce((n, r) => n + (Number(r.cost) || 0), 0)
    + firms.reduce((n, f) => n + (Number(f.cost) || 0), 0)
  const allHours = inHouseHours + contractorHours
  const contractorShare = allHours ? Math.round((contractorHours / allHours) * 100) : 0

  // One ranked list of people rather than a chart above a table of the same
  // eight names. `_booked` is the part of each total that came from a labour
  // entry in the portal — the rest is the estate's modelled history, and a
  // reader is entitled to know which is which.
  const techRows = useMemo(() => {
    const booked = new Map()
    for (const e of scopedEntries) {
      if (e.worker_type === 'Contractor') continue
      const at = booked.get(e.worker_name) || { hours: 0, entries: 0 }
      at.hours = round2(at.hours + (Number(e.hours) || 0))
      at.entries += 1
      booked.set(e.worker_name, at)
    }
    return [...people]
      .map((r) => ({
        ...r,
        hours_logged: round2(r.hours_logged),
        _booked: booked.get(r.name)?.hours || 0,
        _entries: booked.get(r.name)?.entries || 0,
      }))
      .sort((a, b) => b.hours_logged - a.hours_logged)
  }, [people, scopedEntries])

  const maxHours = Math.max(1, ...techRows.map((r) => r.hours_logged))

  // Open work first, then the most recent — the jobs time is actually booked to.
  const woChoices = useMemo(() => [...workOrders]
    .sort((a, b) => String(b.created_date || '').localeCompare(String(a.created_date || '')))
    .slice(0, 150), [workOrders])

  const chosenWo = form ? workOrders.find((w) => String(woIdOf(w)) === String(form.workOrderId)) : null

  const save = async () => {
    if (!form) return
    const contractor = form.workerType === 'Contractor'
    setBusy(true)
    const entry = await logLabour({
      wo: chosenWo,
      workOrderRecordId: form.workOrderId,
      workerType: form.workerType,
      workerName: contractor ? form.contractorTech : form.workerName,
      vendorName: form.vendorName,
      hours: form.hours,
      rate: form.rate === '' ? undefined : Number(form.rate),
      workDate: form.workDate,
      note: form.note,
    })
    setBusy(false)
    if (entry) setForm(null)
  }

  const peopleColumns = [
    {
      key: 'name', label: 'Technician', width: 210,
      render: (r) => (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: '#15227a' }}>{r.name}</div>
          <div style={{ fontSize: 11, color: MUTE, marginTop: 1 }}>{r.trade || r.role}</div>
        </div>
      ),
    },
    // The bar lives inside the Hours column so every bar starts at the same x
    // and the number it belongs to is beside it, not across the card.
    {
      key: 'hours_logged', label: 'Hours', align: 'right', width: 230,
      sortValue: (r) => r.hours_logged,
      render: (r) => <HoursCell hours={r.hours_logged} max={maxHours} booked={r._booked} />,
    },
    { key: 'jobs_completed', label: 'Jobs', align: 'right', width: 74 },
    {
      key: '_entries', label: 'Booked here', align: 'right', width: 120,
      render: (r) => (r._entries
        ? <span style={{ fontWeight: 600 }}>{r._entries} {r._entries === 1 ? 'entry' : 'entries'}</span>
        : <span style={{ color: MUTE }}>—</span>),
    },
    { key: 'hourly_rate', label: 'Rate', align: 'right', width: 96, render: (r) => `${money(r.hourly_rate)}/h` },
    { key: 'cost', label: 'Cost', align: 'right', width: 110, render: (r) => <span style={{ fontWeight: 700 }}>{money(r.cost)}</span> },
    {
      key: 'utilisation', label: 'Utilisation', align: 'right', width: 130,
      render: (r) => (r.utilisation ? <UtilBar pct={r.utilisation} /> : <span style={{ color: MUTE }}>—</span>),
    },
  ]

  const firmColumns = [
    { key: 'vendor_name', label: 'Contractor', render: (r) => <span style={{ fontWeight: 700, color: '#15227a' }}>{r.vendor_name}</span> },
    { key: 'entries', label: 'Visits', align: 'right' },
    { key: 'jobs', label: 'Jobs', align: 'right' },
    { key: 'hours', label: 'Hours', align: 'right', render: (r) => `${round2(r.hours)} h` },
    { key: 'cost', label: 'Billed', align: 'right', render: (r) => <span style={{ fontWeight: 700 }}>{money(r.cost)}</span> },
  ]

  const entryColumns = [
    { key: 'work_date', label: 'Date', sortValue: (r) => r.work_date, render: (r) => <span style={{ whiteSpace: 'nowrap', color: SUB }}>{fmtDate(r.work_date)}</span> },
    { key: 'work_order_number', label: 'Work order', render: (r) => <span style={{ fontWeight: 700, color: '#15227a' }}>{r.work_order_number}</span> },
    { key: 'asset_name', label: 'Asset' },
    {
      key: 'worker_name', label: 'Worked by',
      render: (r) => (r.worker_type === 'Contractor'
        ? <span><b>{r.vendor_name}</b>{r.worker_name && r.worker_name !== r.vendor_name ? <span style={{ color: MUTE }}> · {r.worker_name}</span> : null}</span>
        : r.worker_name),
    },
    {
      key: 'worker_type', label: 'Type',
      // A seeded visit says so. It is the estate's own history, and letting it
      // pass for something booked in the portal would make every count on this
      // screen unreconcilable against the rows under it.
      render: (r) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <StatusBadge tone={r.worker_type === 'Contractor' ? 'amber' : 'grey'}>{r.worker_type}</StatusBadge>
          {r._seeded && <span style={{ fontSize: 10.5, color: MUTE }}>history</span>}
        </span>
      ),
    },
    { key: 'hours', label: 'Hours', align: 'right', render: (r) => `${r.hours} h` },
    { key: 'cost', label: 'Cost', align: 'right', render: (r) => <span style={{ fontWeight: 700 }}>{money(r.cost)}</span> },
    { key: 'entered_by', label: 'Entered by' },
  ]

  return (
    <div>
      <PageHeader
        icon={sectionIcon('labour', '#15227a')}
        title="Labour"
        subtitle={`Time booked against work, by technicians and contractors · ${siteName}`}
        right={<ActionButton onClick={() => setForm(blankForm())}>Log time</ActionButton>}
      />

      <StatStrip items={[
        { label: 'In-house hours', value: inHouseHours, unit: 'h' },
        { label: 'Contractor hours', value: contractorHours, unit: 'h' },
        { label: 'Labour cost', value: money(cost) },
        { label: 'Contractor share', value: contractorShare, unit: '%', tone: contractorShare > 50 ? 'amber' : undefined },
        { label: 'Entries booked', value: scopedEntries.length },
      ]} />

      <Section
        title="Technicians"
        right={<span style={{ fontSize: 11.5, color: SUB }}>{people.length} on the books · ranked by hours</span>}
      >
        <DataTable
          columns={peopleColumns} rows={techRows} pageSize={10}
          empty={`Nobody is based at ${siteName}.`}
        />
        <p style={{ margin: '10px 2px 0', fontSize: 11, color: MUTE, lineHeight: 1.5 }}>
          Hours, jobs and cost carry the estate&rsquo;s modelled history plus everything booked in the portal;
          <b> Booked here</b> is the part that came from a labour entry. Utilisation is modelled for this estate,
          and a contractor visit marked <b>history</b> in the entries below came with the estate rather than being
          booked in this portal.
        </p>
      </Section>

      <Section title="Contractors" right={<span style={{ fontSize: 11.5, color: SUB }}>{firms.length} firms with time booked</span>}>
        <DataTable
          columns={firmColumns} rows={firms} pageSize={8}
          empty="No contractor time booked yet. Book a visit with Log time, or from the work order's Time tab — who performed a certified test is the first thing a surveyor asks."
        />
      </Section>

      <Section title="Time entries" right={<span style={{ fontSize: 11.5, color: SUB }}>newest first</span>}>
        <DataTable
          columns={entryColumns} rows={scopedEntries} pageSize={10}
          onRowClick={(r) => r.work_order_id && router.push(`/portal/oxmaint/work-orders/${encodeURIComponent(r.work_order_id)}`)}
          empty="No time booked in the portal yet. Completing a job from its execution screen books the logged time here."
        />
      </Section>

      <Dialog open={Boolean(form)} onOpenChange={(o) => { if (!o && !busy) setForm(null) }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Log time</DialogTitle>
            <DialogDescription>
              Book hours against a work order. The job&rsquo;s own hours and labour cost move with it.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="log-wo" className="mb-1 block text-xs text-slate-600">Work order</Label>
                <Select value={form.workOrderId || undefined} onValueChange={(v) => set('workOrderId', v)}>
                  <SelectTrigger id="log-wo" className="h-9"><SelectValue placeholder="Choose the job" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {woChoices.map((w) => (
                      <SelectItem key={woIdOf(w)} value={String(woIdOf(w))}>
                        {w.work_order_number} — {w.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-2">
                {WORKER_TYPES.map((t) => (
                  <Button key={t} type="button" size="sm" variant={form.workerType === t ? 'default' : 'outline'}
                    onClick={() => set('workerType', t)}>
                    {t}
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {form.workerType === 'In-house' ? (
                  <div className="sm:col-span-2">
                    <Label htmlFor="log-tech" className="mb-1 block text-xs text-slate-600">Technician</Label>
                    <Select value={form.workerName || undefined} onValueChange={(v) => set('workerName', v)}>
                      <SelectTrigger id="log-tech" className="h-9"><SelectValue placeholder="Who did the work" /></SelectTrigger>
                      <SelectContent>
                        {TECHNICIAN_NAMES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="log-vendor" className="mb-1 block text-xs text-slate-600">Contractor</Label>
                      <Select value={form.vendorName || undefined} onValueChange={(v) => set('vendorName', v)}>
                        <SelectTrigger id="log-vendor" className="h-9"><SelectValue placeholder="Which firm" /></SelectTrigger>
                        <SelectContent className="max-h-72">
                          {VENDOR_NAMES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="log-ctech" className="mb-1 block text-xs text-slate-600">Their technician</Label>
                      <Input id="log-ctech" className="h-9" placeholder="Name on the service report"
                        value={form.contractorTech} onChange={(e) => set('contractorTech', e.target.value)} />
                    </div>
                  </>
                )}
                <div>
                  <Label htmlFor="log-hours" className="mb-1 block text-xs text-slate-600">Hours</Label>
                  <Input id="log-hours" type="number" min="0" step="0.25" className="h-9"
                    value={form.hours} onChange={(e) => set('hours', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="log-rate" className="mb-1 block text-xs text-slate-600">Rate per hour</Label>
                  <Input id="log-rate" type="number" min="0" step="1" className="h-9"
                    placeholder={`${money(form.workerType === 'Contractor' ? contractorRate(form.vendorName) : inHouseRate(form.workerName))} default`}
                    value={form.rate} onChange={(e) => set('rate', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="log-date" className="mb-1 block text-xs text-slate-600">Date worked</Label>
                  <Input id="log-date" type="date" className="h-9"
                    value={form.workDate} onChange={(e) => set('workDate', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="log-note" className="mb-1 block text-xs text-slate-600">Note</Label>
                  <Input id="log-note" className="h-9" placeholder="Service report number"
                    value={form.note} onChange={(e) => set('note', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)} disabled={busy}>Cancel</Button>
            <Button onClick={save} disabled={busy || !form?.workOrderId}>{busy ? 'Saving…' : 'Book time'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
