'use client'

// Register an asset.
//
// The fields are the workbook's own columns, in its order, because the register
// this writes into is that table — a form asking for something the register
// cannot show, or missing something it can, is how a created row ends up reading
// as a row full of dashes beside the twenty-six that came from the sheet.
//
// The id is generated rather than typed. It continues the workbook's sequence
// from the highest number already in it, so a new asset sorts and reads like the
// ones beside it. Letting somebody type one invites a duplicate, and a duplicate
// asset id in a maintenance system is the bug that quietly attaches a work order
// to the wrong machine.
//
// Everything with a sensible answer is defaulted: today's install date, Medium
// criticality, Running status. A demo where the presenter has to fill nine
// fields before the row appears is a demo about typing.

import { useMemo, useState } from 'react'
import { Modal, ActionButton } from '../lib/kit'
import { ASSET_CATEGORIES, departments, assets } from '../lib/data'
import { nextAssetId } from '../lib/store'

const CRITICALITY = ['High', 'Medium', 'Low']
const STATUS = ['Running', 'Standby', 'Down']

// Manufacturers already on the register, offered as suggestions rather than a
// closed list — a new machine may well come from a supplier the plant has never
// bought from before.
const MAKERS = [...new Set(assets.map((a) => a.manufacturer))].filter(Boolean).sort()

const today = () => new Date().toISOString().slice(0, 10)

export default function AddAssetModal({ open, onClose, onCreate, created = [] }) {
  const suggestedId = useMemo(() => nextAssetId([...assets, ...created]), [created])

  const [form, setForm] = useState(() => blank())
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState(false)

  function blank() {
    return {
      name: '',
      category: ASSET_CATEGORIES[0] || '',
      locationCode: departments[0]?.code || '',
      manufacturer: '',
      model: '',
      serial: '',
      installDate: today(),
      criticality: 'Medium',
      status: 'Running',
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // Name is the only field with no sensible default — everything else either has
  // one or is genuinely optional on the workbook's own rows.
  const missing = !form.name.trim()

  const submit = async () => {
    setTouched(true)
    if (missing) return
    setSaving(true)
    const ok = await onCreate({
      ...form,
      name: form.name.trim(),
      assetId: suggestedId,
      // Written so the register can tell a workbook row from one added here
      // without comparing ids against the sheet.
      _addedInPortal: true,
    })
    setSaving(false)
    if (ok) {
      setForm(blank())
      setTouched(false)
      onClose()
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Register asset" subtitle="Add a machine to the register" width={620}>
      <div style={{ display: 'grid', gap: 13 }}>
        <div style={idRow}>
          <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Asset ID</span>
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 700, color: '#15227a' }}>
            {suggestedId}
          </span>
          <span style={{ fontSize: 10.5, color: '#94a3b8' }}>continues the register&apos;s sequence</span>
        </div>

        <Field label="Asset name" required error={touched && missing ? 'Give the machine a name.' : ''}>
          <input
            autoFocus
            value={form.name}
            onChange={set('name')}
            placeholder="Air-Jet Loom #4"
            style={input}
          />
        </Field>

        <Row>
          <Field label="Process step">
            <select value={form.category} onChange={set('category')} style={input}>
              {ASSET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Department">
            <select value={form.locationCode} onChange={set('locationCode')} style={input}>
              {departments.map((d) => <option key={d.code} value={d.code}>{d.code} — {d.name}</option>)}
            </select>
          </Field>
        </Row>

        <Row>
          <Field label="Manufacturer">
            <input
              list="dna-makers"
              value={form.manufacturer}
              onChange={set('manufacturer')}
              placeholder="Tsudakoma"
              style={input}
            />
            <datalist id="dna-makers">
              {MAKERS.map((m) => <option key={m} value={m} />)}
            </datalist>
          </Field>
          <Field label="Model">
            <input value={form.model} onChange={set('model')} placeholder="ZAX-9100" style={input} />
          </Field>
        </Row>

        <Row>
          <Field label="Serial number">
            <input value={form.serial} onChange={set('serial')} placeholder="AJ-6604" style={input} />
          </Field>
          <Field label="Install date">
            <input type="date" value={form.installDate} onChange={set('installDate')} style={input} />
          </Field>
        </Row>

        <Row>
          <Field label="Criticality">
            <select value={form.criticality} onChange={set('criticality')} style={input}>
              {CRITICALITY.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={set('status')} style={input}>
              {STATUS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </Row>

        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.55 }}>
          Saved against this portal rather than into the supplied workbook, so the sample data
          stays exactly as delivered. It survives a refresh.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 4 }}>
          <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
          <ActionButton onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Register asset'}
          </ActionButton>
        </div>
      </div>
    </Modal>
  )
}

function Row({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 13 }}>{children}</div>
}

function Field({ label, required, error, children }) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 5 }}>
        {label}{required && <span style={{ color: '#dc2626', marginLeft: 3 }}>*</span>}
      </span>
      {children}
      {error && <span style={{ display: 'block', fontSize: 11, color: '#dc2626', marginTop: 4 }}>{error}</span>}
    </label>
  )
}

const input = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
  border: '1px solid #e4e9f0', borderRadius: 9, outline: 'none',
  fontFamily: 'inherit', color: '#0f172a', background: '#fff',
}

const idRow = {
  display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap',
  padding: '10px 13px', background: '#f8fafc', border: '1px solid #eef1f6', borderRadius: 9,
}
