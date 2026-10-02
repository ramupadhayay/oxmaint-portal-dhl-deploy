'use client'

// Add somebody to the roster.
//
// The fields are the workbook's own columns, in its order, for the same reason
// the other two forms use theirs: the roster this writes into is that table.
//
// Team is a combo rather than a closed list. On this dataset the ten people hold
// ten distinct team names — the roster is one person per team — so a new starter
// is as likely to be the first of a new team as to join an existing one, and a
// dropdown alone would force the wrong answer. Existing teams are offered as
// suggestions and anything can be typed.
//
// Skills are a comma list because the workbook stores them as one, and the
// roster splits on the comma to make each one searchable. Asking for them in the
// same shape they are stored keeps the two from disagreeing about where a skill
// ends.

import { useMemo, useState } from 'react'
import { Modal, ActionButton } from '../lib/kit'
import { users, departments, TEAMS, SHIFTS, locName } from '../lib/data'
import { nextUserId } from '../lib/store'

// Roles already on the roster, offered as suggestions. A plant hires titles this
// list has never seen, so it is not a closed set.
const ROLES = [...new Set(users.map((u) => u.role))].filter(Boolean).sort()

// Every skill anybody currently holds, for the datalist. Typing an existing one
// exactly is what makes the coverage chart on the roster mean anything — two
// spellings of "Boilers" read as two skills held by one person each.
const SKILLS = [...new Set(users.flatMap((u) => u.skills))].filter(Boolean).sort()

export default function AddMemberModal({ open, onClose, onCreate, created = [] }) {
  const suggestedId = useMemo(() => nextUserId([...users, ...created]), [created])

  const [form, setForm] = useState(() => blank())
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState(false)

  function blank() {
    return {
      name: '',
      role: ROLES[0] || 'Maintenance Technician',
      department: departments[0]?.code || '',
      team: '',
      shift: SHIFTS[0] || '',
      skills: '',
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const missingName = !form.name.trim()
  const missingTeam = !form.team.trim()
  const invalid = missingName || missingTeam

  const submit = async () => {
    setTouched(true)
    if (invalid) return
    setSaving(true)
    const ok = await onCreate({
      userId: suggestedId,
      name: form.name.trim(),
      role: form.role.trim() || 'Maintenance Technician',
      department: form.department,
      team: form.team.trim(),
      shift: form.shift,
      // Split on the way in, the way the importer does, so the roster never has
      // to know whether a row came from the workbook or from here.
      skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
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
    <Modal open={open} onClose={onClose} title="Add team member" subtitle="Put somebody on the roster" width={620}>
      <div style={{ display: 'grid', gap: 13 }}>
        <div style={idRow}>
          <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>User ID</span>
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 700, color: '#15227a' }}>
            {suggestedId}
          </span>
          <span style={{ fontSize: 10.5, color: '#94a3b8' }}>continues the roster&apos;s sequence</span>
        </div>

        <Row>
          <Field label="Name" required error={touched && missingName ? 'Give the person a name.' : ''}>
            <input autoFocus value={form.name} onChange={set('name')} placeholder="Priya Natarajan" style={input} />
          </Field>
          <Field label="Role">
            <input list="dna-roles" value={form.role} onChange={set('role')} placeholder="Maintenance Technician" style={input} />
            <datalist id="dna-roles">
              {ROLES.map((r) => <option key={r} value={r} />)}
            </datalist>
          </Field>
        </Row>

        <Row>
          <Field label="Department">
            <select value={form.department} onChange={set('department')} style={input}>
              {departments.map((d) => (
                <option key={d.code} value={d.code}>{d.code} — {d.name}</option>
              ))}
            </select>
          </Field>
          <Field
            label="Team"
            required
            error={touched && missingTeam ? 'Name the team, existing or new.' : ''}
          >
            <input
              list="dna-teams"
              value={form.team}
              onChange={set('team')}
              placeholder="Weaving Maintenance"
              style={input}
            />
            <datalist id="dna-teams">
              {TEAMS.map((t) => <option key={t} value={t} />)}
            </datalist>
          </Field>
        </Row>

        <Row>
          <Field label="Shift">
            <select value={form.shift} onChange={set('shift')} style={input}>
              {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Skills">
            <input
              list="dna-skills"
              value={form.skills}
              onChange={set('skills')}
              placeholder="Loom mechanical, electrical basics"
              style={input}
            />
            <datalist id="dna-skills">
              {SKILLS.map((s) => <option key={s} value={s} />)}
            </datalist>
            <span style={{ display: 'block', fontSize: 10.5, color: '#94a3b8', marginTop: 5, lineHeight: 1.5 }}>
              Comma separated. Match an existing spelling and the coverage chart counts them
              together.
            </span>
          </Field>
        </Row>

        {form.department && (
          <p style={{ margin: 0, fontSize: 11.5, color: '#64748b' }}>
            Based in {locName(form.department)}.
          </p>
        )}

        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.55 }}>
          Saved against this portal rather than into the supplied workbook, so the sample data
          stays exactly as delivered. It survives a refresh.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 4 }}>
          <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
          <ActionButton onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Add member'}
          </ActionButton>
        </div>
      </div>
    </Modal>
  )
}

function Row({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 13 }}>{children}</div>
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
