'use client'

// A small modal for the two create flows this portal's Teams and Documents
// modules add — one overlay, one card, a set of fields and a submit. The record
// pages elsewhere are their own screens; a crew or a document is a handful of
// fields and does not need one.

import { useState } from 'react'
import { PALETTE } from '../lib/kit'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

export default function Modal({ open, title, fields, submitLabel = 'Save', onSubmit, onClose }) {
  const [values, setValues] = useState({})
  const [busy, setBusy] = useState(false)
  if (!open) return null

  const set = (k, v) => setValues((p) => ({ ...p, [k]: v }))
  const missing = fields.some((f) => f.required && !String(values[f.key] || '').trim())

  const submit = async () => {
    if (missing || busy) return
    setBusy(true)
    try { await onSubmit(values); setValues({}); onClose() }
    finally { setBusy(false) }
  }

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <div style={styles.head}>
          <h3 style={styles.title}>{title}</h3>
          <button onClick={onClose} style={styles.x} aria-label="Close">✕</button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {fields.map((f) => (
            <label key={f.key} style={styles.field}>
              <span style={styles.label}>{f.label}{f.required && <span style={{ color: '#dc2626' }}> *</span>}</span>
              {f.options ? (
                <select value={values[f.key] || ''} onChange={(e) => set(f.key, e.target.value)} style={styles.input}>
                  <option value="">Select…</option>
                  {f.options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
                </select>
              ) : (
                <input value={values[f.key] || ''} onChange={(e) => set(f.key, e.target.value)}
                  placeholder={f.placeholder || ''} style={styles.input} />
              )}
            </label>
          ))}
        </div>

        <div style={styles.foot}>
          <button onClick={onClose} style={styles.cancel}>Cancel</button>
          <button onClick={submit} disabled={missing || busy} style={{ ...styles.save, opacity: missing || busy ? 0.55 : 1 }}>
            {busy ? 'Saving…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 600, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8vh 20px' },
  card: { width: '100%', maxWidth: 460, background: '#fff', borderRadius: 14, boxShadow: '0 24px 60px rgba(15,23,42,0.3)', padding: 22 },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: INK },
  x: { border: 'none', background: 'none', fontSize: 15, color: MUTE, cursor: 'pointer', fontFamily: 'inherit' },
  field: { display: 'grid', gap: 5 },
  label: { fontSize: 11.5, fontWeight: 600, color: SUB },
  input: { width: '100%', padding: '9px 11px', fontSize: 13, fontFamily: 'inherit', color: INK, border: `1px solid ${LINE}`, borderRadius: 9, outline: 'none', background: '#fff' },
  foot: { display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 20 },
  cancel: { padding: '9px 15px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 9, color: '#475569', cursor: 'pointer' },
  save: { padding: '9px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', background: '#15227a', border: '1px solid #15227a', borderRadius: 9, color: '#fff', cursor: 'pointer' },
}
