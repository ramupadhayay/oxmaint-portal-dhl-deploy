'use client'

// Add or edit an asset — the product's page, not a modal.
//
// Registering a machine is not a five-field job. The product gives it a page
// with five sections, and the reason is the same one that gave an asset its own
// record page: a modal that holds twenty fields is a modal nobody finishes, and
// the fields it drops are the ones a register is for — serial number, warranty,
// purchase cost, when the last service was.
//
// One component for both jobs. Add and edit differ in three things: the title,
// whether the fields start empty, and whether saving creates or updates. Written
// twice they drift, and the half that drifts is always the edit form, because it
// is the one nobody demos.
//
// WHAT THE FORM WRITES IS WHAT THE RECORD PAGE READS. The financial section
// exists because the product has one, and the fields it captures — purchase
// cost, supplier — are then shown on the asset's record. A seeded asset carries
// neither, and its record says so rather than showing a zero; that is the same
// rule, seen from the other side.

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Info, Cpu, Calendar, DollarSign, Wrench, Save, Loader2,
} from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Switch } from '../ui/switch'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../ui/select'
import { useRecords, useStore } from '../lib/store'
import { ASSETS, SITES, LOCATIONS, DOMAIN, daysFrom } from '../lib/data'

// data.js has no `today` — `daysFrom(0)` is the same date in the same format,
// which is the format every other date on the record is written in.
const today = () => daysFrom(0)

const idOf = (a) => a.asset_id || a.recordId

const CRITICALITY = ['High', 'Medium', 'Low']
const STATUSES = ['Operational', 'Under Maintenance', 'Down']

const TYPES = [...new Set(ASSETS.map((a) => a.asset_type))].sort()
const MAKERS = [...new Set(ASSETS.map((a) => a.manufacturer))].sort()

const REQUIRED = ['asset_name', 'asset_type', 'site_id', 'criticality', 'status']

const BLANK = {
  asset_name: '', asset_type: '', manufacturer: '', model: '', serial_number: '',
  site_id: '', functional_location_id: '',
  criticality: 'Medium', status: 'Operational',
  purchase_date: '', warranty_expiry: '', last_maintenance_date: '', next_maintenance_date: '',
  purchase_cost: '', supplier: '',
  running_hours: '', iot_enabled: false, notes: '',
}

export default function AssetForm({ mode = 'add' }) {
  const { id } = useParams()
  const router = useRouter()
  const { create, update, notify } = useStore()

  const assets = useRecords('asset', ASSETS, idOf)
  const existing = useMemo(
    () => (mode === 'edit' ? assets.find((a) => String(idOf(a)) === String(id)) || null : null),
    [assets, id, mode],
  )

  const [v, setV] = useState(() => (mode === 'edit' ? null : { ...BLANK, purchase_date: today() }))
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  // Seeded once the record resolves. `useState` cannot wait for it and an effect
  // would overwrite whatever had been typed while the store was loading.
  const [seeded, setSeeded] = useState(false)
  if (mode === 'edit' && existing && !seeded) {
    setSeeded(true)
    setV({
      ...BLANK,
      ...Object.fromEntries(Object.keys(BLANK).map((k) => [k, existing[k] ?? BLANK[k]])),
    })
  }

  if (mode === 'edit' && !existing && seeded === false && assets.length) {
    return (
      <div className="max-w-8xl mx-auto p-6">
        <Button variant="ghost" className="mb-4 gap-2" onClick={() => router.push('/portal/oxmaint/assets')}>
          <ArrowLeft className="h-4 w-4" />
          Back to Asset Master
        </Button>
        <Card>
          <CardContent className="p-12 text-center">
            <h3 className="font-semibold text-slate-800 mb-1">No asset with that reference</h3>
            <p className="text-sm text-slate-500">Nothing in the register is filed under &ldquo;{id}&rdquo;.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!v) {
    return <div className="max-w-8xl mx-auto p-6 text-sm text-slate-400">Loading the asset…</div>
  }

  const set = (k) => (val) => setV((p) => ({ ...p, [k]: val }))
  const missing = REQUIRED.filter((k) => !String(v[k] ?? '').trim())
  const locations = LOCATIONS.filter((l) => !v.site_id || l.site_id === v.site_id)

  const save = async () => {
    setTouched(true)
    if (missing.length || saving) return
    setSaving(true)
    try {
      const site = SITES.find((s) => s.site_id === v.site_id)
      const loc = LOCATIONS.find((l) => l.functional_location_id === v.functional_location_id)
      const shared = {
        ...v,
        running_hours: Number(v.running_hours) || 0,
        purchase_cost: v.purchase_cost === '' ? '' : Number(v.purchase_cost) || 0,
        site_name: site?.site_name || '',
        functional_location_name: loc?.name || '',
      }

      if (mode === 'edit') {
        // The whole record, not the changed fields: `update` writes the data
        // object wholesale, so a partial patch blanks everything it omits.
        await update('asset', idOf(existing), { ...existing, ...shared })
        notify(`${existing.asset_code} updated.`)
        router.push(`/portal/oxmaint/assets/${idOf(existing)}`)
        return
      }

      const initials = String(v.asset_type || '').split(' ').map((w) => w[0]).join('')
      const saved = await create('asset', {
        ...shared,
        // The code follows the register's own shape — site code, type initials,
        // a number — so a new asset reads like the ones beside it.
        asset_code: `${site?.code || 'NEW'}-${initials}-${String(Math.floor(Math.random() * 900) + 100)}`,
        health_score: 100,
        warranty_expiry: v.warranty_expiry || daysFrom(365),
        last_maintenance_date: v.last_maintenance_date || today(),
        next_maintenance_date: v.next_maintenance_date || daysFrom(90),
      })
      if (!saved) return
      notify(`${saved.asset_code} added to the register.`)
      router.push(`/portal/oxmaint/assets/${saved.asset_id || saved.recordId}`)
    } finally {
      setSaving(false)
    }
  }

  const back = () => (mode === 'edit' && existing
    ? router.push(`/portal/oxmaint/assets/${idOf(existing)}`)
    : router.push('/portal/oxmaint/assets'))

  const err = (k) => touched && REQUIRED.includes(k) && !String(v[k] ?? '').trim()

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <Button variant="ghost" className="gap-2 hover:bg-indigo-50" onClick={back}>
        <ArrowLeft className="h-4 w-4" />
        {mode === 'edit' ? 'Back to the asset' : 'Back to Asset Master'}
      </Button>

      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
          {mode === 'edit' ? `Edit ${existing?.asset_name || 'asset'}` : 'Add an asset'}
        </h1>
        <p className="text-slate-600 mt-1 text-sm md:text-base">
          {mode === 'edit'
            ? `Change what the register holds for ${existing?.asset_code || 'this asset'}.`
            : 'Register a machine on the plant. Only the first section is required — the rest can be filled in later.'}
        </p>
      </motion.div>

      <Section icon={Info} title="Basic information">
        <Grid>
          <Field label="Asset name" required error={err('asset_name')}>
            <Input value={v.asset_name} onChange={(e) => set('asset_name')(e.target.value)} placeholder={DOMAIN?.placeholders?.asset || 'Air Compressor 10'} />
          </Field>
          <Field label="Type" required error={err('asset_type')}>
            <Picker value={v.asset_type} onChange={set('asset_type')} options={TYPES} placeholder="Choose a type…" />
          </Field>
          <Field label="Site" required error={err('site_id')}>
            <Picker
              value={v.site_id}
              onChange={(x) => { set('site_id')(x); set('functional_location_id')('') }}
              options={SITES.map((s) => ({ value: s.site_id, label: s.site_name }))}
              placeholder="Choose a site…"
            />
          </Field>
          <Field label="Location" hint={v.site_id ? undefined : 'Pick a site first — locations belong to one.'}>
            <Picker
              value={v.functional_location_id} onChange={set('functional_location_id')}
              options={locations.map((l) => ({ value: l.functional_location_id, label: l.name }))}
              placeholder="Choose a location…" disabled={!v.site_id}
            />
          </Field>
          <Field label="Criticality" required error={err('criticality')} hint="How much stops when this asset does.">
            <Picker value={v.criticality} onChange={set('criticality')} options={CRITICALITY} />
          </Field>
          <Field label="Status" required error={err('status')}>
            <Picker value={v.status} onChange={set('status')} options={STATUSES} />
          </Field>
        </Grid>
      </Section>

      <Section icon={Cpu} title="Equipment details">
        <Grid>
          <Field label="Manufacturer">
            <Picker value={v.manufacturer} onChange={set('manufacturer')} options={MAKERS} placeholder="Choose or leave blank…" allowClear />
          </Field>
          <Field label="Model">
            <Input value={v.model} onChange={(e) => set('model')(e.target.value)} placeholder="M549" />
          </Field>
          <Field label="Serial number" hint="What is stamped on the nameplate.">
            <Input value={v.serial_number} onChange={(e) => set('serial_number')(e.target.value)} placeholder="SN868400" className="font-mono" />
          </Field>
          <Field label="Running hours">
            <Input
              type="number" min="0" value={v.running_hours}
              onChange={(e) => set('running_hours')(e.target.value)} placeholder="0"
            />
          </Field>
        </Grid>
      </Section>

      <Section icon={Calendar} title="Dates and timeline">
        <Grid>
          <Field label="In service since">
            <Input type="date" value={v.purchase_date} onChange={(e) => set('purchase_date')(e.target.value)} />
          </Field>
          <Field label="Warranty expires" hint={mode === 'add' ? 'Left blank, this defaults to a year from today.' : undefined}>
            <Input type="date" value={v.warranty_expiry} onChange={(e) => set('warranty_expiry')(e.target.value)} />
          </Field>
          <Field label="Last maintained">
            <Input type="date" value={v.last_maintenance_date} onChange={(e) => set('last_maintenance_date')(e.target.value)} />
          </Field>
          <Field label="Next service due">
            <Input type="date" value={v.next_maintenance_date} onChange={(e) => set('next_maintenance_date')(e.target.value)} />
          </Field>
        </Grid>
      </Section>

      <Section
        icon={DollarSign} title="Financial information"
        note="Optional, and shown on the asset's record only when it is filled in. An asset registered without it says the figure is not held rather than showing a zero."
      >
        <Grid>
          <Field label="Purchase cost">
            <Input
              type="number" min="0" value={v.purchase_cost}
              onChange={(e) => set('purchase_cost')(e.target.value)} placeholder="e.g. 48000"
            />
          </Field>
          <Field label="Supplier">
            <Input value={v.supplier} onChange={(e) => set('supplier')(e.target.value)} placeholder="Who it was bought from" />
          </Field>
        </Grid>
      </Section>

      <Section icon={Wrench} title="Maintenance information">
        <div className="space-y-4">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3">
            <Switch checked={Boolean(v.iot_enabled)} onCheckedChange={set('iot_enabled')} className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium text-slate-900">IoT connected</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                This asset reports telemetry to the edge gateway. Its record shows the link is
                configured; live values are read on the Chiller AI and Digital Twin screens.
              </span>
            </span>
          </label>
          <Field label="Notes">
            <Textarea
              rows={3} value={v.notes} onChange={(e) => set('notes')(e.target.value)}
              placeholder="Anything a technician arriving at this asset should know."
              className="resize-y"
            />
          </Field>
        </div>
      </Section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-slate-500">
          {touched && missing.length
            ? `${missing.length} required field${missing.length === 1 ? '' : 's'} still empty`
            : 'Asset name, type, site, criticality and status are required.'}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={back} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || (touched && missing.length > 0)} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {mode === 'edit' ? 'Save changes' : 'Create asset'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Section({ icon: Icon, title, note, children }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-indigo-600" />
          {title}
        </CardTitle>
        {note && <p className="text-xs leading-relaxed text-slate-500 mt-1">{note}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

const Grid = ({ children }) => <div className="grid gap-4 sm:grid-cols-2">{children}</div>

function Field({ label, hint, required, error, children }) {
  return (
    <div className="min-w-0">
      <Label className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </Label>
      {children}
      {error
        ? <p className="mt-1 text-xs text-red-600">Required</p>
        : hint && <p className="mt-1 text-xs leading-relaxed text-slate-400">{hint}</p>}
    </div>
  )
}

// Options are either plain strings or {value,label} — the register's own lists
// are the first, the site and location pickers the second.
function Picker({ value, onChange, options, placeholder, disabled, allowClear }) {
  const items = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full"><SelectValue placeholder={placeholder || 'Choose…'} /></SelectTrigger>
      <SelectContent>
        {allowClear && <SelectItem value=" ">—</SelectItem>}
        {items.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}
