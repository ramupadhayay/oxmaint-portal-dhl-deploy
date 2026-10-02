'use client'

// The create screen the product actually ships: a full page, not a modal.
//
// A work order carries ten sections' worth of detail — safety, parts, labour,
// costs, links — and a modal can show one of them at a time at best. What the
// modal really costs is the thing this layout puts first: while you are typing,
// you cannot see how much of the record is still missing, so you find out by
// pressing Save. The navigator and the validation panel are therefore the point
// of this screen, and the fields are what sits between them.
//
// One component, three record types. The alternative — a hand-written page per
// record — is how create screens drift apart: the work order asks for a due date
// with a picker and the PM schedule with a text box, and nobody notices until a
// customer does.

import { useMemo, useState } from 'react'
import { Card, Section, Fields, PageHeader, ActionButton, StatusBadge, PALETTE } from './kit'
import { sectionIcon } from './nav'

const { ACCENT, INK, SUB, MUTE, LINE, RED, GREEN } = PALETTE

// Blues for the navigator. The required panel, the active section and a
// completed section have to be three visibly different states, which is one
// more than a single tint can carry.
const PANEL = '#f2f6ff'
const ACTIVE_BG = '#e8ecff'
const DONE_BG = '#f7f9ff'
const DONE_LINE = '#c7d2fe'

// ── icons ────────────────────────────────────────────────────────────────
const GLYPHS = {
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></>,
  tasks: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3 6 1.4 1.4L7 4.8" /><path d="m3 12 1.4 1.4L7 10.8" /><path d="m3 18 1.4 1.4L7 16.8" /></>,
  review: <><path d="m9 11 3 3 5-6" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>,
  parts: <><path d="M12.9 1.5l8 4A2 2 0 0 1 22 7.2v9.5a2 2 0 0 1-1.1 1.8l-8 4a2 2 0 0 1-1.8 0l-8-4a2 2 0 0 1-1.1-1.8V7.2a2 2 0 0 1 1.1-1.7l8-4a2 2 0 0 1 1.8 0z" /><path d="M2.3 6.2 12 11l9.7-4.8M12 22.8V11" /></>,
  attachment: <><path d="M21.4 11.05 12.25 20.2a6 6 0 0 1-8.49-8.49l9.2-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></>,
  people: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></>,
  note: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 9h8M8 13h5" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></>,
  money: <><circle cx="12" cy="12" r="9" /><path d="M15 9.4A3 3 0 0 0 12.5 8h-1a2.5 2.5 0 0 0 0 5h1a2.5 2.5 0 0 1 0 5h-1A3 3 0 0 1 9 14.6" /><path d="M12 6v12" /></>,
  layers: <><path d="M12 2 2 7l10 5 10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" /></>,
  camera: <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  sparkle: <><path d="m12 3 1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" /><path d="m18.6 15.6.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7z" /></>,
  tick: <><path d="M20 6 9 17l-5-5" /></>,
  alert: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  close: <><path d="M18 6 6 18M6 6l12 12" /></>,
}

function Glyph({ name, color = SUB, size = 15, width = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {GLYPHS[name] || GLYPHS.info}
    </svg>
  )
}

// ── schema helpers ───────────────────────────────────────────────────────
const resolve = (v) => (typeof v === 'function' ? v() : v)
const normalise = (options) => (resolve(options) || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o))

const isBlank = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)

const blankRow = (field) => Object.fromEntries((field.rowFields || []).map((rf) => [
  rf.key,
  rf.type === 'toggle' ? Boolean(resolve(rf.default)) : rf.default !== undefined ? resolve(rf.default) : '',
]))

// A row counts as written once any of its non-toggle inputs holds something. A
// toggle alone cannot count: every row is created with its toggles at false, so
// counting them would make an untouched row look filled in.
const rowFilled = (row, rowFields) => (rowFields || []).some((rf) => rf.type !== 'toggle' && !isBlank(row?.[rf.key]))

function filled(field, values) {
  const v = values[field.key]
  if (field.type === 'rows') return Array.isArray(v) && v.some((r) => rowFilled(r, field.rowFields))
  if (field.type === 'toggle') return v === true
  if (Array.isArray(v)) return v.length > 0
  return !isBlank(v) && String(v).trim() !== ''
}

const requiredNow = (field, values) => (
  field.required === true || (typeof field.requiredIf === 'function' && field.requiredIf(values))
)

export function blankValues(schema) {
  const out = {}
  schema.sections.forEach((s) => (s.fields || []).forEach((f) => {
    if (f.type === 'rows') {
      const preset = resolve(f.default)
      out[f.key] = Array.isArray(preset) ? preset : Array.from({ length: f.startRows || 0 }, () => blankRow(f))
    }
    else if (f.type === 'multiselect') out[f.key] = resolve(f.default) || []
    else if (f.type === 'toggle') out[f.key] = Boolean(resolve(f.default))
    else out[f.key] = f.default !== undefined ? resolve(f.default) : ''
  }))
  return out
}

const allFields = (schema) => schema.sections.flatMap((s) => s.fields || [])

// Everything still needed, in the order the sections are laid out, so the
// validation panel reads top-to-bottom like the form does.
function missingList(schema, values) {
  const out = []
  schema.sections.forEach((s) => {
    (s.fields || []).forEach((f) => {
      if (!requiredNow(f, values) || filled(f, values)) return
      out.push({
        id: f.key,
        sectionKey: s.key,
        sectionTitle: s.title,
        label: f.label,
        message: f.missingMessage || `${f.label} is required`,
      })
    })
    ;(schema.crossRules || []).forEach((rule, i) => {
      if ((rule.section || schema.sections[0].key) !== s.key || rule.ok(values)) return
      out.push({
        id: `rule-${i}`,
        sectionKey: s.key,
        sectionTitle: s.title,
        label: rule.label || s.title,
        message: rule.message,
      })
    })
  })
  return out
}

// What a value looks like once it is read back rather than typed in.
function display(field, value) {
  if (field.type === 'rows') {
    const rows = (value || []).filter((r) => rowFilled(r, field.rowFields))
    return `${rows.length} ${rows.length === 1 ? (field.rowNoun || 'row') : (field.rowNounPlural || `${field.rowNoun || 'row'}s`)}`
  }
  if (field.type === 'toggle') return value ? 'Yes' : 'No'
  if (field.type === 'multiselect') return (value || []).join(', ')
  if (field.type === 'select') {
    const hit = normalise(field.options).find((o) => o.value === value)
    return hit ? hit.label : String(value ?? '')
  }
  return String(value ?? '')
}

// ── Ask Synapse ──────────────────────────────────────────────────────────
//
// Suggestions come from the schema's own rules reading what has already been
// typed and the plant's records — a keyword in the title, the asset's site, the
// technician carrying the fewest open jobs. Nothing here is generated text and
// nothing is drawn at random, so the same half-filled form always produces the
// same suggestions and each one can be explained to the person accepting it.
function suggestionsFor(section, values) {
  return (section.fields || [])
    .filter((f) => typeof f.suggest === 'function' && !filled(f, values))
    .map((f) => {
      const value = f.suggest(values)
      if (isBlank(value)) return null
      return {
        key: f.key,
        label: f.label,
        value,
        text: display(f, value),
        why: typeof f.suggestWhy === 'function' ? f.suggestWhy(values) : f.suggestWhy || '',
      }
    })
    .filter(Boolean)
}

// ── the builder ──────────────────────────────────────────────────────────
export function RecordBuilder({ schema, onSubmit, onCancel, onSaveDraft }) {
  const [values, setValues] = useState(() => blankValues(schema))
  const [activeKey, setActiveKey] = useState(schema.sections[0].key)
  const [askedFor, setAskedFor] = useState(null)
  const [saving, setSaving] = useState(false)

  const active = schema.sections.find((s) => s.key === activeKey) || schema.sections[0]
  const initial = useMemo(() => blankValues(schema), [schema])
  const missing = useMemo(() => missingList(schema, values), [schema, values])
  const suggestions = useMemo(
    () => (askedFor === active.key ? suggestionsFor(active, values) : []),
    [askedFor, active, values],
  )

  const set = (key, val) => setValues((p) => ({ ...p, [key]: val }))

  const setRow = (key, index, rowKey, val) => setValues((p) => ({
    ...p,
    [key]: (p[key] || []).map((r, i) => (i === index ? { ...r, [rowKey]: val } : r)),
  }))
  const addRow = (field) => setValues((p) => ({ ...p, [field.key]: [...(p[field.key] || []), blankRow(field)] }))
  const removeRow = (key, index) => setValues((p) => ({ ...p, [key]: (p[key] || []).filter((_, i) => i !== index) }))

  const go = (key) => { setActiveKey(key); setAskedFor(null) }

  // A section is marked complete once something in it has actually been
  // entered. A field still holding the value it was created with is not an
  // answer, and a navigator that ticks sections nobody has opened is worse than
  // no navigator at all.
  const sectionState = (s) => {
    if (s.type === 'review') return missing.length ? 'idle' : 'done'
    if (missing.some((m) => m.sectionKey === s.key)) return 'idle'
    const answered = (s.fields || []).some((f) => (
      filled(f, values) && JSON.stringify(values[f.key]) !== JSON.stringify(initial[f.key])
    ))
    return answered ? 'done' : 'idle'
  }

  // Numbers and dates leave this screen in the shape the list screens read
  // them in, not as the strings an <input> hands back.
  const payload = () => {
    const out = { ...values }
    allFields(schema).forEach((f) => {
      if (f.type === 'number') out[f.key] = isBlank(values[f.key]) ? 0 : Number(values[f.key]) || 0
      if (f.type === 'date' && values[f.key]) out[f.key] = new Date(values[f.key]).toISOString()
      if (f.type === 'rows') {
        out[f.key] = (values[f.key] || [])
          .filter((r) => rowFilled(r, f.rowFields))
          .map((r) => {
            const row = { ...r }
            f.rowFields.forEach((rf) => {
              if (rf.type === 'number') row[rf.key] = isBlank(r[rf.key]) ? 0 : Number(r[rf.key]) || 0
            })
            return row
          })
      }
    })
    return out
  }

  const run = async (fn) => {
    if (!fn || saving) return
    setSaving(true)
    try { await fn(payload()) } finally { setSaving(false) }
  }

  const required = schema.sections.filter((s) => s.required !== false)
  const optional = schema.sections.filter((s) => s.required === false)

  const stillNeeded = missing.slice(0, 3).map((m) => m.label).join(', ')
  const submitText = missing.length
    ? (missing.length === 1 ? `Missing: ${missing[0].label}` : `${missing.length} details still needed`)
    : (schema.submitLabel || 'Submit')

  return (
    <div>
      <PageHeader
        icon={sectionIcon(schema.navKey, ACCENT)}
        title={schema.title}
        subtitle={schema.subtitle}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 296px', gap: 14, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <Card style={{ marginBottom: 14, padding: 15 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>Sections</span>
              <span style={{ fontSize: 11.5, color: MUTE }}>Click a section to navigate directly</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(230px,320px) minmax(0,1fr)', gap: 14 }}>
              <div style={{ background: PANEL, border: `1px solid ${DONE_LINE}`, borderRadius: 12, padding: 11 }}>
                <Legend>Required</Legend>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {required.map((s) => (
                    <SectionCard key={s.key} section={s} active={s.key === activeKey}
                      state={sectionState(s)} onClick={() => go(s.key)} />
                  ))}
                </div>
              </div>

              <div style={{ minWidth: 0 }}>
                <Legend>Optional</Legend>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(214px,1fr))', gap: 8 }}>
                  {optional.map((s) => (
                    <SectionCard key={s.key} section={s} active={s.key === activeKey}
                      state={sectionState(s)} onClick={() => go(s.key)} />
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Section
            title={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Glyph name={active.icon} color={ACCENT} size={16} />
                {active.title}
              </span>
            }
            right={
              active.type === 'review' ? null : (
                <button onClick={() => setAskedFor(askedFor === active.key ? null : active.key)} style={synapseBtn}>
                  <Glyph name="sparkle" color="#fff" size={14} />
                  Ask Synapse
                </button>
              )
            }
          >
            <p style={{ margin: '-4px 0 14px', fontSize: 12, color: MUTE }}>{active.description}</p>

            {askedFor === active.key && (
              <SuggestionPanel
                suggestions={suggestions}
                onAccept={(s) => set(s.key, s.value)}
                onAcceptAll={() => setValues((p) => {
                  const next = { ...p }
                  suggestions.forEach((s) => { next[s.key] = s.value })
                  return next
                })}
                onClose={() => setAskedFor(null)}
              />
            )}

            {active.type === 'review' ? (
              <ReviewSummary schema={schema} values={values} missing={missing} onJump={go} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '14px 16px' }}>
                {(active.fields || []).map((f) => (
                  <div key={f.key} style={{ gridColumn: f.wide || f.type === 'rows' || f.type === 'textarea' || f.type === 'multiselect' ? '1 / -1' : 'auto', minWidth: 0 }}>
                    <FieldLabel field={f} required={requiredNow(f, values)} />
                    <FieldInput
                      field={f}
                      value={values[f.key]}
                      onChange={(v) => set(f.key, v)}
                      onRowChange={(i, rk, v) => setRow(f.key, i, rk, v)}
                      onAddRow={() => addRow(f)}
                      onRemoveRow={(i) => removeRow(f.key, i)}
                    />
                    {f.help && <span style={helpText}>{f.help}</span>}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <div style={{ position: 'sticky', top: 14 }}>
          <ValidationPanel schema={schema} missing={missing} onJump={go} />
        </div>
      </div>

      {/* The right padding clears the chat launcher, which is fixed to the
          bottom-right corner and otherwise sits on top of the submit button —
          the one control on this page that must never be hard to press. */}
      <Card style={{
        position: 'sticky', bottom: 0, marginTop: 14, padding: '12px 84px 12px 15px',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        boxShadow: '0 -4px 16px rgba(15,23,42,0.06)',
      }}>
        <span style={{ fontSize: 12, color: missing.length ? '#b45309' : GREEN, fontWeight: 600, minWidth: 0 }}>
          {missing.length
            ? `Still needed: ${stillNeeded}${missing.length > 3 ? ` and ${missing.length - 3} more` : ''}`
            : 'Everything required is filled in.'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <ActionButton variant="ghost" onClick={onCancel}>Cancel</ActionButton>
          <ActionButton variant="ghost" disabled={saving} onClick={() => run(onSaveDraft)}>Save draft</ActionButton>
          <ActionButton disabled={saving || missing.length > 0} onClick={() => run(onSubmit)}>{submitText}</ActionButton>
        </div>
      </Card>
    </div>
  )
}

// ── navigator ────────────────────────────────────────────────────────────
function Legend({ children }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 800, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 }}>
      {children}
    </div>
  )
}

function SectionCard({ section, active, state, onClick }) {
  const done = state === 'done'
  const tile = active ? ACCENT : done ? ACTIVE_BG : '#f1f5f9'
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', textAlign: 'left',
      padding: '10px 11px', borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit',
      background: active ? ACTIVE_BG : done ? DONE_BG : '#fff',
      border: `1px solid ${active ? ACCENT : done ? DONE_LINE : LINE}`,
    }}>
      <span style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', background: tile,
      }}>
        <Glyph name={section.icon} color={active ? '#fff' : done ? ACCENT : SUB} size={15} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: active || done ? ACCENT : INK }}>
          {section.title}
        </span>
        <span style={{ display: 'block', fontSize: 11, color: MUTE, marginTop: 2, lineHeight: 1.35 }}>
          {section.description}
        </span>
      </span>
      {done && !active && <Glyph name="tick" color={ACCENT} size={13} width={2.6} />}
    </button>
  )
}

// ── fields ───────────────────────────────────────────────────────────────
function FieldLabel({ field, required }) {
  return (
    <label style={labelStyle}>
      {field.label}
      {required && <span style={{ color: RED, marginLeft: 3 }}>*</span>}
    </label>
  )
}

function Counter({ value, max }) {
  const used = String(value ?? '').length
  return <span style={{ ...helpText, color: used >= max ? RED : MUTE }}>{used}/{max} characters</span>
}

function Toggle({ value, onChange, label }) {
  return (
    <button onClick={() => onChange(!value)} style={{
      display: 'inline-flex', alignItems: 'center', gap: 9, padding: '6px 10px 6px 6px',
      border: `1px solid ${value ? ACCENT : LINE}`, borderRadius: 999, cursor: 'pointer',
      background: value ? ACTIVE_BG : '#fff', fontFamily: 'inherit',
    }}>
      <span style={{
        width: 32, height: 18, borderRadius: 999, flexShrink: 0, padding: 2, boxSizing: 'border-box',
        background: value ? ACCENT : '#cbd5e1', display: 'flex', justifyContent: value ? 'flex-end' : 'flex-start',
      }}>
        <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff' }} />
      </span>
      <span style={{ fontSize: 12, fontWeight: 600, color: value ? ACCENT : SUB }}>{label || (value ? 'Yes' : 'No')}</span>
    </button>
  )
}

function FieldInput({ field, value, onChange, onRowChange, onAddRow, onRemoveRow }) {
  if (field.type === 'textarea') {
    return (
      <div>
        <textarea rows={field.rows || 3} value={value || ''} placeholder={field.placeholder} maxLength={field.maxLength}
          onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
        {field.maxLength && <Counter value={value} max={field.maxLength} />}
      </div>
    )
  }

  if (field.type === 'select') {
    return (
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
        <option value="">{field.placeholder || 'Select…'}</option>
        {normalise(field.options).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  }

  if (field.type === 'multiselect') {
    const chosen = value || []
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {normalise(field.options).map((o) => {
          const on = chosen.includes(o.value)
          return (
            <button key={o.value} onClick={() => onChange(on ? chosen.filter((x) => x !== o.value) : [...chosen, o.value])}
              style={{
                padding: '6px 11px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                borderRadius: 999, border: `1px solid ${on ? ACCENT : LINE}`,
                background: on ? ACTIVE_BG : '#fff', color: on ? ACCENT : SUB,
              }}>{o.label}</button>
          )
        })}
      </div>
    )
  }

  if (field.type === 'toggle') return <Toggle value={Boolean(value)} onChange={onChange} label={field.toggleLabel} />

  if (field.type === 'rows') {
    const rows = value || []
    return (
      <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((row, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-end', gap: 8, padding: '9px 10px',
              border: `1px solid ${LINE}`, borderRadius: 11, background: '#fcfdfe',
            }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: MUTE, width: 15, paddingBottom: 9 }}>{i + 1}</span>
              {(field.rowFields || []).map((rf) => (
                <div key={rf.key} style={{ flex: rf.flex || 1, minWidth: 0 }}>
                  {/* A toggle already says what it is, so labelling it twice
                      only makes the row taller. */}
                  {rf.type !== 'toggle' && <span style={{ ...labelStyle, fontSize: 9.5 }}>{rf.label}</span>}
                  {rf.type === 'select' ? (
                    <select value={row[rf.key] || ''} onChange={(e) => onRowChange(i, rf.key, e.target.value)} style={rowInput}>
                      <option value="">{rf.placeholder || 'Select…'}</option>
                      {normalise(rf.options).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : rf.type === 'toggle' ? (
                    <Toggle value={Boolean(row[rf.key])} onChange={(v) => onRowChange(i, rf.key, v)} label={rf.toggleLabel} />
                  ) : (
                    <input type={rf.type === 'number' ? 'number' : 'text'} value={row[rf.key] ?? ''}
                      placeholder={rf.placeholder} min={rf.min} step={rf.step}
                      onChange={(e) => onRowChange(i, rf.key, e.target.value)} style={rowInput} />
                  )}
                </div>
              ))}
              <button onClick={() => onRemoveRow(i)} title="Remove" style={{
                width: 28, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${LINE}`, borderRadius: 8, background: '#fff', cursor: 'pointer', flexShrink: 0,
              }}>
                <Glyph name="close" color={MUTE} size={13} />
              </button>
            </div>
          ))}
          {!rows.length && (
            <p style={{ margin: 0, padding: '14px 12px', fontSize: 12, color: MUTE, textAlign: 'center', border: `1px dashed ${LINE}`, borderRadius: 11 }}>
              {field.emptyNote || 'Nothing added yet.'}
            </p>
          )}
        </div>
        <button onClick={onAddRow} style={{
          marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px',
          fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
          border: `1px solid ${DONE_LINE}`, borderRadius: 9, background: DONE_BG, color: ACCENT,
        }}>
          <Glyph name="plus" color={ACCENT} size={13} />
          {field.addLabel || 'Add row'}
        </button>
      </div>
    )
  }

  return (
    <div>
      <input
        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
        value={value ?? ''} placeholder={field.placeholder} maxLength={field.maxLength}
        min={field.min} max={field.max} step={field.step}
        onChange={(e) => onChange(e.target.value)} style={inputStyle} />
      {field.maxLength && field.type === 'text' && <Counter value={value} max={field.maxLength} />}
    </div>
  )
}

// ── Ask Synapse panel ────────────────────────────────────────────────────
function SuggestionPanel({ suggestions, onAccept, onAcceptAll, onClose }) {
  return (
    <div style={{
      marginBottom: 14, padding: '11px 13px', borderRadius: 12,
      background: '#faf8ff', border: '1px solid #ddd6fe',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: suggestions.length ? 9 : 0 }}>
        <Glyph name="sparkle" color="#6d28d9" size={14} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#5b21b6' }}>
          {suggestions.length ? `${suggestions.length} suggestion${suggestions.length > 1 ? 's' : ''} for this section` : 'Nothing to suggest yet'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 7 }}>
          {suggestions.length > 1 && (
            <button onClick={onAcceptAll} style={{ ...miniBtn, borderColor: '#c4b5fd', color: '#5b21b6' }}>Accept all</button>
          )}
          <button onClick={onClose} style={miniBtn}>Dismiss</button>
        </div>
      </div>

      {suggestions.length ? (
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {suggestions.map((s) => (
            <button key={s.key} onClick={() => onAccept(s)} title={s.why || undefined} style={{
              display: 'inline-flex', alignItems: 'baseline', gap: 7, padding: '7px 11px',
              borderRadius: 999, border: '1px solid #ddd6fe', background: '#fff', cursor: 'pointer',
              fontFamily: 'inherit', maxWidth: '100%',
            }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.label}</span>
              <span style={{ fontSize: 12, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>{s.text}</span>
              {s.why && <span style={{ fontSize: 10.5, color: MUTE }}>· {s.why}</span>}
            </button>
          ))}
        </div>
      ) : (
        <p style={{ margin: '6px 0 0', fontSize: 11.5, color: SUB, lineHeight: 1.5 }}>
          Everything Synapse could work out from this section is already filled in. Enter a title or pick an asset
          and it will have more to go on.
        </p>
      )}

      <p style={{ margin: '9px 0 0', fontSize: 10.5, color: MUTE, lineHeight: 1.5 }}>
        Worked out from what you have entered and this plant's own records — assets, technicians and their current
        workload. Every suggestion is a proposal you accept or ignore.
      </p>
    </div>
  )
}

// ── validation panel ─────────────────────────────────────────────────────
function ValidationPanel({ schema, missing, onJump }) {
  const groups = []
  missing.forEach((m) => {
    const hit = groups.find((g) => g.key === m.sectionKey)
    if (hit) hit.items.push(m)
    else groups.push({ key: m.sectionKey, title: m.sectionTitle, items: [m] })
  })

  if (!missing.length) {
    return (
      <Card style={{ padding: 15, background: '#f6fefb', border: '1px solid #a7f3d0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
          <Glyph name="tick" color="#047857" size={16} width={2.6} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#047857' }}>Ready to submit</span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: '#047857', lineHeight: 1.55 }}>
          Every required field is filled in. {schema.readyNote || 'You can still add optional detail before submitting.'}
        </p>
      </Card>
    )
  }

  return (
    <Card style={{ padding: 15, background: '#fffbfb', border: '1px solid #fecaca' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Glyph name="alert" color="#b91c1c" size={16} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#b91c1c' }}>
          Complete Information Required ({missing.length})
        </span>
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 11.5, color: SUB, lineHeight: 1.5 }}>
        These are needed before the record can be submitted.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {groups.map((g) => (
          <div key={g.key}>
            <button onClick={() => onJump(g.key)} style={{
              display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: 0, marginBottom: 6,
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>{g.title}</span>
              <StatusBadge tone="red">{g.items.length} field{g.items.length > 1 ? 's' : ''}</StatusBadge>
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {g.items.map((m) => (
                <span key={m.id} style={{
                  fontSize: 11.5, lineHeight: 1.45, padding: '5px 9px', borderRadius: 8,
                  color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a',
                }}>{m.message}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── review ───────────────────────────────────────────────────────────────
function ReviewSummary({ schema, values, missing, onJump }) {
  const blocks = schema.sections
    .filter((s) => s.type !== 'review')
    .map((s) => ({ section: s, entered: (s.fields || []).filter((f) => filled(f, values)) }))
    .filter((b) => b.entered.length)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {missing.length > 0 && (
        <p style={{
          margin: 0, padding: '10px 12px', fontSize: 12.5, lineHeight: 1.5, borderRadius: 10,
          background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
        }}>
          {missing.length} item{missing.length > 1 ? 's' : ''} still to complete before this can be submitted.
          The panel on the right names each one.
        </p>
      )}

      {blocks.map(({ section, entered }) => (
        <div key={section.key}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
            <Glyph name={section.icon} color={ACCENT} size={14} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>{section.title}</span>
            <StatusBadge tone={section.required === false ? 'grey' : 'blue'}>
              {section.required === false ? 'Optional' : 'Required'}
            </StatusBadge>
            <button onClick={() => onJump(section.key)} style={{ ...miniBtn, marginLeft: 'auto' }}>Edit</button>
          </div>

          <Fields rows={entered.filter((f) => f.type !== 'rows').map((f) => [f.label, display(f, values[f.key])])} />

          {entered.filter((f) => f.type === 'rows').map((f) => (
            <div key={f.key} style={{ marginTop: 10 }}>
              <div style={{ ...labelStyle, marginBottom: 6 }}>{f.label}</div>
              {(values[f.key] || []).filter((r) => rowFilled(r, f.rowFields)).map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: `1px solid ${LINE}`, fontSize: 12.5, color: INK }}>
                  <span style={{ color: MUTE, fontWeight: 700, minWidth: 16 }}>{i + 1}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {f.rowFields.filter((rf) => !isBlank(r[rf.key]) && r[rf.key] !== false)
                      .map((rf) => (rf.type === 'toggle' ? rf.label : display(rf, r[rf.key])))
                      .join(' · ')}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}

      {!blocks.length && (
        <p style={{ margin: 0, fontSize: 12.5, color: MUTE }}>
          Nothing has been entered yet. Start with Basic Information.
        </p>
      )}
    </div>
  )
}

// ── styles ───────────────────────────────────────────────────────────────
const labelStyle = {
  display: 'block', fontSize: 10.5, fontWeight: 700, color: MUTE,
  textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4,
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12.5,
  border: `1px solid ${LINE}`, borderRadius: 9, outline: 'none',
  fontFamily: 'inherit', color: INK, background: '#fff',
}

const rowInput = { ...inputStyle, padding: '7px 9px', fontSize: 12 }

const helpText = { display: 'block', fontSize: 10.5, color: MUTE, marginTop: 4 }

const miniBtn = {
  padding: '4px 10px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
  border: `1px solid ${LINE}`, borderRadius: 999, background: '#fff', color: SUB,
}

const synapseBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px',
  fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
  border: 'none', borderRadius: 999, color: '#fff',
  background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
}
