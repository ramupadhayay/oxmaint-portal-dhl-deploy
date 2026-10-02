'use client'

// Record that a compliance obligation was met — from anywhere in the portal.
//
// This began inside Calendar.jsx as the only way to mark anything done. The
// client's review asked for two things it could not do: file from the
// Requirements register rather than only from the calendar, and attach the
// actual evidence rather than a reference to it. Both are here, and the modal
// moved out of the calendar so all three entry points file the same record in
// the same shape.
//
// THE TWO BASES. A filing answers one of two different questions, and the
// portal must never blur them:
//
//   basis 'occurrence' — the calendar's case. A dated occurrence the portal
//     projected from the recurrence rule was answered. The record carries the
//     occurrenceId and the projected dueDate, so "filed 3 days late" is arithmetic
//     against a date the portal derived and can show its working for.
//
//   basis 'obligation' — recorded straight against the requirement. There is no
//     projected date, so there is nothing to be late against and the record does
//     not pretend otherwise: no occurrenceId, no dueDate. It says a duty was
//     discharged on a day.
//
// The second basis is what makes the register usable. Of the 34 obligations,
// twelve are standing or event-driven and never reach a calendar at all, and
// five more recur on a rule that names no month or day ("Annually", "From
// initial training date"), so the schedule engine emits nothing for them. That is
// seventeen obligations with no way to record compliance — which is precisely
// what the client ran into. Inventing a due date for them would be the
// fabrication the source workbook forbids; letting them be filed without one is
// the honest alternative.

import { useState } from 'react'
import { Modal, ActionButton, PALETTE } from '../lib/kit'
import EvidenceUpload from './EvidenceUpload'
import { USER } from '../lib/store'
import { fmtDate, TODAY } from '../lib/data'

const { INK, SUB, MUTE, LINE } = PALETTE

export const BASIS = { OCCURRENCE: 'occurrence', OBLIGATION: 'obligation' }

/**
 * @param subject  what is being filed against. Either a generated occurrence
 *                 (has occurrenceId and dueDate) or a requirement row.
 * @param onFile   async ({ payload, files }) => void. The caller owns the write
 *                 so the audit line reads in its own screen's words.
 */
export default function FilingModal({ subject, onClose, onFile }) {
  const [filedDate, setFiledDate] = useState(TODAY())
  const [filedBy, setFiledBy] = useState(USER.name)
  const [evidenceRef, setEvidenceRef] = useState('')
  const [note, setNote] = useState('')
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)

  // Reset each time a different subject is opened. Render-phase rather than an
  // effect: an effect would let one frame of the previous filing's text show
  // under the new heading.
  const key = subject ? (subject.occurrenceId || subject.requirementId || '') : ''
  const [seen, setSeen] = useState(key)
  if (key !== seen) {
    setSeen(key)
    setFiledDate(TODAY()); setFiledBy(USER.name); setEvidenceRef(''); setNote(''); setFiles([])
  }

  if (!subject) return null

  const dated = Boolean(subject.occurrenceId && subject.dueDate)
  const basis = dated ? BASIS.OCCURRENCE : BASIS.OBLIGATION
  const title = subject.title || subject.name || 'Obligation'
  const siteId = subject.siteId || ''

  const submit = async () => {
    if (!filedDate || saving) return
    setSaving(true)
    try {
      await onFile({
        payload: {
          // Only a dated occurrence carries these. A filing recorded against the
          // obligation itself leaves them out rather than carrying an empty
          // string, so "has a due date" stays a question the data can answer.
          ...(dated ? { occurrenceId: subject.occurrenceId, dueDate: subject.dueDate } : {}),
          basis,
          requirementId: subject.requirementId,
          siteId,
          siteCode: subject._siteCode || siteId.replace('SITE-', ''),
          title,
          category: subject.category || '',
          submissionMethod: subject.submissionMethod || '',
          filedDate,
          filedBy: filedBy.trim() || USER.name,
          evidenceRef: evidenceRef.trim(),
          note: note.trim(),
          attachmentCount: files.length,
        },
        files,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={saving ? undefined : onClose}
      title={dated ? 'Mark obligation filed' : 'Record compliance against this obligation'}
      subtitle={title}
      width={560}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <ActionButton variant="ghost" onClick={onClose} disabled={saving}>Cancel</ActionButton>
          <ActionButton variant="success" disabled={!filedDate || saving} onClick={submit}>
            Record filing
          </ActionButton>
        </div>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={styles.box}>
          <Row k="Obligation" v={title} />
          <Row k="Reference" v={subject.requirementId} />
          {(subject.category || subject.frequency) && (
            <Row k="Category · frequency" v={[subject.category, subject.frequency].filter(Boolean).join(' · ')} />
          )}
          {dated
            ? <Row k="Projected due" v={fmtDate(subject.dueDate)} />
            : (
              <Row
                k="Due date"
                v={(
                  <span style={{ color: SUB, fontWeight: 500 }}>
                    None — this obligation has no date the portal can project
                  </span>
                )}
              />
            )}
          {subject.submissionMethod && <Row k="Submitted to" v={subject.submissionMethod} last />}
        </div>

        {!dated && (
          <p style={styles.basisNote}>
            This is recorded against the obligation itself rather than a dated occurrence, so it is
            not measured against a deadline — there is none to measure against. It states that the
            duty was discharged on the date below, and who discharged it.
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Filing date">
            <input type="date" value={filedDate} onChange={(e) => setFiledDate(e.target.value)} style={styles.input} />
          </Field>
          <Field label="Filed by">
            <input value={filedBy} onChange={(e) => setFiledBy(e.target.value)} style={styles.input} />
          </Field>
        </div>

        <Field
          label="Evidence reference"
          hint="A confirmation number or a link — for evidence that lives in your own document repository."
        >
          <input
            value={evidenceRef} onChange={(e) => setEvidenceRef(e.target.value)}
            placeholder="e.g. CEDRI receipt 2026-… / SharePoint link" style={styles.input}
          />
        </Field>

        <Field
          label="Attach the evidence"
          hint="Held in the portal against this filing, and downloadable from the obligation afterwards."
        >
          <EvidenceUpload files={files} onChange={setFiles} disabled={saving} />
        </Field>

        <Field label="Note (optional)">
          <textarea
            rows={3} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Anything worth recording about this filing." style={{ ...styles.input, resize: 'vertical' }}
          />
        </Field>
      </div>
    </Modal>
  )
}

function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: SUB, marginBottom: 6 }}>{label}</span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: 11, color: MUTE, marginTop: 5, lineHeight: 1.45 }}>{hint}</span>}
    </label>
  )
}

function Row({ k, v, last }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: last ? 'none' : `1px solid ${LINE}` }}>
      <span style={{ fontSize: 11.5, color: MUTE, flex: '0 0 140px' }}>{k}</span>
      <span style={{ fontSize: 12.5, color: INK, fontWeight: 600, minWidth: 0 }}>{v}</span>
    </div>
  )
}

const styles = {
  box: { padding: '10px 13px', borderRadius: 10, background: '#f8fafc', border: `1px solid ${LINE}` },
  basisNote: {
    margin: 0, padding: '9px 12px', borderRadius: 9, fontSize: 11.5, lineHeight: 1.55,
    background: '#f8fafc', color: SUB, borderLeft: '3px solid #cbd5e1',
  },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
    fontFamily: 'inherit', color: INK, background: '#fff', borderRadius: 9, outline: 'none',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0',
  },
}
