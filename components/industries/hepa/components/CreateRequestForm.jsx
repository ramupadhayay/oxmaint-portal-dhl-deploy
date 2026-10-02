'use client'

// Create Maintenance Request — the product's form.
//
// One component behind two doors. The register opens it in a dialog, which is
// where the product puts it; the QR code on the register's overview points a
// phone at /requests/new, which renders the same form on a page of its own.
// Two copies would have drifted the moment either was touched, and the one a
// contractor scans in a corridor is the copy nobody would have noticed drifting.
//
// Asset and location are mutually exclusive, and so are the three assignment
// fields — that is the product's rule, and it is the right one: a request
// against both a filter and a room cannot be routed, and one assigned to a
// person and a department is one that two people each think the other has.

import { useMemo, useState } from 'react'
import { PALETTE } from '../lib/kit'
import { Glyph, BRAND } from '../lib/productKit'
import { FILTER_VIEW, CLEANROOMS, TECHNICIANS, USER, DOCUMENT_RECORDS } from '../lib/data'
import { createRequest } from '../lib/ops'
import { useStore } from '../lib/store'

const { INK, SUB, MUTE, LINE } = PALETTE

const TITLE_MAX = 120
const CATEGORIES = ['Electrical', 'Mechanical', 'Plumbing', 'HVAC', 'IT', 'Safety', 'Cleaning', 'Other']
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']

const DEPARTMENTS = [...new Set(DOCUMENT_RECORDS.map((d) => d.routedToRole).filter(Boolean))].sort()

const BLANK = {
  title: '', priority: 'Medium', category: '', subCategory: '', description: '',
  filterId: '', cleanroomId: '',
  assignedTo: '', assignedDepartment: '', assignmentNotes: '',
  requesterName: USER.name, requesterEmail: '', requesterPhone: '',
  images: [],
}

export default function CreateRequestForm({ requests = [], onDone, onCancel }) {
  const store = useStore()
  const [form, setForm] = useState(BLANK)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }))
    setErrors((e) => {
      const next = { ...e }
      for (const k of Object.keys(patch)) delete next[k]
      return next
    })
  }

  const assets = useMemo(() => [...FILTER_VIEW].sort((a, b) => {
    const rank = (f) => (f.concern === 'Failed integrity test' ? 0 : f.concern ? 1 : 2)
    return rank(a) - rank(b) || a.filterId.localeCompare(b.filterId)
  }), [])

  const check = () => {
    const e = {}
    if (!form.title.trim()) e.title = 'Title is required'
    if (!form.priority) e.priority = 'Priority is required'
    if (!form.description.trim()) e.description = 'Description is required'
    if (!form.filterId && !form.cleanroomId) e.filterId = 'Say which filter or which room this is about'
    if (!form.assignedTo && !form.assignedDepartment) {
      e.assignedTo = 'A maintenance request must be assigned to someone. Choose an assignee or a department.'
    }
    if (!form.requesterName.trim()) e.requesterName = 'Requester Name is required'
    if (!form.requesterEmail.trim()) e.requesterEmail = 'Requester Email is required'
    else if (!form.requesterEmail.includes('@')) e.requesterEmail = 'Enter an email address'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async () => {
    if (!check()) return
    setBusy(true)
    const saved = await createRequest(store, {
      filterId: form.filterId,
      cleanroomId: form.cleanroomId,
      detail: form.description,
      urgency: form.priority,
      title: form.title,
      category: form.category,
      subCategory: form.subCategory,
      assignedTo: form.assignedTo,
      assignedDepartment: form.assignedDepartment,
      assignmentNotes: form.assignmentNotes,
      requesterName: form.requesterName,
      requesterEmail: form.requesterEmail,
      requesterPhone: form.requesterPhone,
      images: form.images,
      raisedBy: form.requesterName,
    }, requests)
    setBusy(false)
    if (saved) {
      setForm(BLANK)
      onDone?.(saved)
    }
  }

  const takeImages = (list) => {
    const added = [...list].map((f) => ({ name: f.name, size: f.size }))
    set({ images: [...form.images, ...added.filter((a) => !form.images.some((i) => i.name === a.name))] })
  }

  const assignedElsewhere = Boolean(form.assignedDepartment)
  const deptElsewhere = Boolean(form.assignedTo)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={grid(3)}>
        <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
          <Field label="Title" required error={errors.title}
            hint={`${form.title.length}/${TITLE_MAX}`}>
            <input value={form.title} maxLength={TITLE_MAX}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Brief description of the issue"
              style={input(errors.title)} />
          </Field>
        </div>
        <Field label="Priority" required error={errors.priority}>
          <select value={form.priority} onChange={(e) => set({ priority: e.target.value })} style={input(errors.priority)}>
            {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
      </div>

      <div style={grid(3)}>
        <Field label="Category">
          <select value={form.category} onChange={(e) => set({ category: e.target.value })} style={input()}>
            <option value="">Select category</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Sub-category">
          <input value={form.subCategory} onChange={(e) => set({ subCategory: e.target.value })}
            placeholder="Specific sub-category (e.g., Pump, Motor)" style={input()} />
        </Field>
      </div>

      <Field label="Description" required error={errors.description}>
        <textarea rows={4} value={form.description} onChange={(e) => set({ description: e.target.value })}
          placeholder="Detailed description of the maintenance request"
          style={{ ...input(errors.description), minHeight: 96, lineHeight: 1.55, resize: 'vertical' }} />
      </Field>

      <div>
        <span style={{ ...styles.label, display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
          <Glyph name="doc" size={14} color={SUB} />
          Images
        </span>
        <label style={styles.upload}>
          <Glyph name="plus" size={14} color={BRAND[700]} />
          Add photos
          <input type="file" accept="image/*" multiple style={{ display: 'none' }}
            onChange={(e) => { takeImages(e.target.files); e.target.value = '' }} />
        </label>
        {form.images.length > 0 && (
          <div style={{ display: 'grid', gap: 9, marginTop: 10, gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))' }}>
            {form.images.map((img, i) => (
              <div key={img.name} style={styles.thumb}>
                <span style={{ fontSize: 11.5, color: SUB, minWidth: 0, overflowWrap: 'anywhere' }}>{img.name}</span>
                <button type="button" onClick={() => set({ images: form.images.filter((_, n) => n !== i) })}
                  style={styles.remove}>Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={grid(2)}>
        <Field label="Asset (Optional)" error={errors.filterId} dim={Boolean(form.cleanroomId)}
          hint={form.cleanroomId ? 'Cleared by the location' : null}>
          <select value={form.filterId} disabled={Boolean(form.cleanroomId)}
            onChange={(e) => set({ filterId: e.target.value })} style={input(errors.filterId, form.cleanroomId)}>
            <option value="">Select an asset (optional)</option>
            {assets.map((f) => (
              <option key={f.filterId} value={f.filterId}>
                {f.filterId} — {f.cleanroomName}{f.concern ? ` · ${f.concern}` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Location" dim={Boolean(form.filterId)}
          hint={form.filterId ? 'Taken from the asset' : 'Pick a room when it is not one filter'}>
          <select value={form.cleanroomId} disabled={Boolean(form.filterId)}
            onChange={(e) => set({ cleanroomId: e.target.value })} style={input(false, form.filterId)}>
            <option value="">Select a location</option>
            {CLEANROOMS.map((c) => <option key={c.cleanroomId} value={c.cleanroomId}>{c.cleanroomId} — {c.name}</option>)}
          </select>
        </Field>
      </div>

      <div>
        <span style={{ ...styles.label, display: 'block', marginBottom: 10 }}>
          Assignment <span style={{ color: '#dc2626' }}>*</span>
        </span>
        <div style={grid(2)}>
          <Field label="Assigned To" error={errors.assignedTo} dim={assignedElsewhere}
            hint={assignedElsewhere ? 'Disabled when a department is assigned.' : null}>
            <select value={form.assignedTo} disabled={assignedElsewhere}
              onChange={(e) => set({ assignedTo: e.target.value, assignedDepartment: '' })}
              style={input(errors.assignedTo, assignedElsewhere)}>
              <option value="">Select team member</option>
              {TECHNICIANS.map((t) => <option key={t.technicianId} value={t.name}>{t.name} ({t.technicianId})</option>)}
            </select>
          </Field>
          <Field label="Assigned Team" dim hint="No teams on file">
            <select value="" disabled style={input(false, true)}>
              <option value="">Select a team...</option>
            </select>
          </Field>
          <Field label="Assigned Department" dim={deptElsewhere}
            hint={deptElsewhere ? 'Disabled when a member is assigned.' : null}>
            <select value={form.assignedDepartment} disabled={deptElsewhere}
              onChange={(e) => set({ assignedDepartment: e.target.value, assignedTo: '' })}
              style={input(false, deptElsewhere)}>
              <option value="">Select department</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ marginTop: 14 }}>
          <Field label="Assignment Notes">
            <textarea rows={2} value={form.assignmentNotes} onChange={(e) => set({ assignmentNotes: e.target.value })}
              placeholder="Add any notes for the assigned team member..."
              style={{ ...input(), minHeight: 62, lineHeight: 1.55, resize: 'vertical' }} />
          </Field>
        </div>
      </div>

      <div style={grid(3)}>
        <Field label="Requester Name" required error={errors.requesterName}
          hint={form.requesterName === USER.name ? 'Pre-filled from your profile' : null}>
          <input value={form.requesterName} onChange={(e) => set({ requesterName: e.target.value })}
            placeholder="Enter name" style={input(errors.requesterName)} />
        </Field>
        <Field label="Requester Email" required error={errors.requesterEmail}>
          <input type="email" value={form.requesterEmail} onChange={(e) => set({ requesterEmail: e.target.value })}
            placeholder="Enter email" style={input(errors.requesterEmail)} />
        </Field>
        <Field label="Phone Number (Optional)">
          <input value={form.requesterPhone} onChange={(e) => set({ requesterPhone: e.target.value })}
            placeholder="Phone number" style={input()} />
        </Field>
      </div>

      <div style={styles.footer}>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={busy} style={styles.ghost}>Cancel</button>
        )}
        <button type="button" onClick={submit} disabled={busy || !store.ready}
          style={{ ...styles.primary, opacity: busy || !store.ready ? 0.5 : 1 }}>
          <Glyph name="send" size={14} color="#fff" />
          {busy ? 'Creating…' : 'Create Request'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, required, hint, error, dim, children }) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={styles.fieldTop}>
        <span style={{ ...styles.label, color: dim ? MUTE : SUB }}>
          {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
        </span>
        {hint && <span style={{ fontSize: 11, color: MUTE, flexShrink: 0 }}>{hint}</span>}
      </span>
      {children}
      {error && <span style={{ display: 'block', fontSize: 11, color: '#b91c1c', marginTop: 5, lineHeight: 1.45 }}>{error}</span>}
    </label>
  )
}

const grid = (cols) => ({
  display: 'grid', gap: 14, alignItems: 'start',
  gridTemplateColumns: `repeat(auto-fit, minmax(${cols === 3 ? 200 : 240}px, 1fr))`,
})

const input = (invalid, disabled) => ({
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
  fontFamily: 'inherit', color: disabled ? MUTE : INK, borderRadius: 9, outline: 'none',
  background: disabled ? '#f8fafc' : '#fff',
  borderStyle: 'solid', borderWidth: 1, borderColor: invalid ? '#fca5a5' : LINE,
})

const styles = {
  fieldTop: {
    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
    gap: 10, marginBottom: 6,
  },
  label: { fontSize: 12, fontWeight: 600, color: SUB },
  upload: {
    display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer',
    padding: '8px 13px', fontSize: 12.5, fontWeight: 700, color: BRAND[700],
    background: BRAND[50], borderRadius: 9,
    borderStyle: 'solid', borderWidth: 1, borderColor: BRAND[100],
  },
  thumb: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9,
    background: '#fcfdfe', borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  remove: {
    marginLeft: 'auto', flexShrink: 0, padding: '3px 8px', fontSize: 10.5, fontWeight: 700,
    fontFamily: 'inherit', color: '#b91c1c', background: '#fff', cursor: 'pointer',
    borderRadius: 6, borderStyle: 'solid', borderWidth: 1, borderColor: '#fecaca',
  },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap',
    paddingTop: 15, borderTop: `1px solid ${LINE}`,
  },
  ghost: {
    padding: '9px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
    color: SUB, background: '#fff', cursor: 'pointer', borderRadius: 9,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  primary: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '10px 18px', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
    color: '#fff', background: BRAND[600], border: 'none', borderRadius: 9, cursor: 'pointer',
  },
}
