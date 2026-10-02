'use client'

// The few pieces this portal needs that the CMMS kit has no reason to carry.
//
// Everything here exists because of one rule from the data layer: a record
// shows the date it sits on today *and* the date the workbook gave it. That is
// two values in one table cell on eleven screens, so it is a component rather
// than eleven copies of the same span.

import { PALETTE, StatusBadge } from './kit'
import { fmtDate, THRESHOLDS, daysFromToday } from './data'

const { INK, SUB, MUTE } = PALETTE

/**
 * A date on the anchored calendar, with the workbook's own underneath.
 *
 * Small and grey on purpose: the anchored date is the one a demo is read
 * against, the original is what a client checks their file with. Both have to
 * be there, but only one is the answer to "when".
 */
export function DateCell({ shifted, original, bold }) {
  if (!shifted && !original) return <span style={{ color: MUTE }}>—</span>
  return (
    <span style={{ display: 'inline-block', lineHeight: 1.3 }}>
      <span style={{ color: INK, fontWeight: bold ? 700 : 500 }}>{fmtDate(shifted)}</span>
      {original && original !== shifted && (
        <span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>workbook: {fmtDate(original)}</span>
      )}
    </span>
  )
}

/** "in 6 days" / "41 days ago" — the phrasing a scheduler reads, not a signed integer. */
export function DueIn({ days }) {
  if (days == null) return <span style={{ color: MUTE }}>—</span>
  const tone = days < 0 ? '#b91c1c' : days <= THRESHOLDS.notificationLeadDays.value ? '#b45309' : SUB
  const text = days < 0 ? `${Math.abs(days)} days ago` : days === 0 ? 'today' : `in ${days} days`
  return <span style={{ color: tone, fontWeight: days <= THRESHOLDS.notificationLeadDays.value ? 700 : 500 }}>{text}</span>
}

// The banner that used to sit on every screen judging a date is gone.
//
// It said the calendar had been aligned and by how much, on eighteen screens,
// above the content each time — an explanation of the plumbing, repeated, where
// the reader wanted the register. The fact still matters, so it lives on
// Settings under "Calendar alignment" where someone goes to ask, and every row
// still carries its original workbook date beside the current one. What is gone
// is the repetition, not the disclosure.

/**
 * A figure the workbook does not hold.
 *
 * Every derived number on this portal wears one of these. The workbook's own
 * dashboard is the authority for what it computes, and a demo that shows a
 * number the client cannot find in their file has to say where it came from.
 */
export function Derived({ children = 'derived' }) {
  return (
    <span style={{
      display: 'inline-block', marginLeft: 6, padding: '1px 6px', borderRadius: 999,
      fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
      color: '#6d28d9', background: '#f5f3ff', border: '1px solid #ddd6fe', verticalAlign: 'middle',
    }}>{children}</span>
  )
}

/** Where the workbook's own dashboard supplied a figure verbatim. */
export function FromWorkbook({ sheet }) {
  return (
    <span title={sheet ? `Compliance Dashboard — ${sheet}` : 'Compliance Dashboard sheet'}
      style={{
        display: 'inline-block', marginLeft: 6, padding: '1px 6px', borderRadius: 999,
        fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
        color: '#0f766e', background: '#f0fdfa', border: '1px solid #99f6e4', verticalAlign: 'middle',
      }}>workbook</span>
  )
}

// ── the portal's vocabulary, in one place ────────────────────────────────
//
// The same words appear on eight screens and must mean the same colour on all
// of them. The kit's own table does not know pharmaceutical vocabulary, so this
// adds it rather than letting each screen pick.
const TONE = {
  Pass: 'green',
  Fail: 'red',
  OK: 'green',
  Breach: 'red',
  Active: 'green',
  // The registry's own three, and Flagged has to be here: unlisted it fell
  // through to neutral grey, which is the one colour a flagged filter must not
  // wear on a compliance screen.
  Flagged: 'red',
  'Pending Replacement': 'amber',
  'Under Test': 'blue',
  Synced: 'green',
  Pending: 'amber',
  'Re-certified': 'green',
  'Pending Re-certification': 'amber',
  Blocked: 'red',
  Approved: 'green',
  Rejected: 'red',
  'Locked - Final': 'green',
  'Locked - Flagged': 'red',
  Open: 'blue',
  Created: 'grey',
  'Routed for Review': 'blue',
  'Under Review': 'amber',
  'Approved - Signed': 'green',
  'Locked / Audit-Ready': 'green',
  'Scheduled': 'grey',
  'Due soon - Notify': 'amber',
  'Overdue - Escalate': 'red',
}

// Exact match first, then the two the workbook writes as a phrase rather than a
// word — "Error - Retry Queued" and "Blocked - awaiting validation". Matching
// only the exact string left both of them neutral grey.
export const toneFor = (value) => {
  if (TONE[value]) return TONE[value]
  const s = String(value)
  if (s.startsWith('Error') || s.startsWith('Blocked')) return 'red'
  if (s.startsWith('Pending')) return 'amber'
  return undefined
}

/** The kit's badge, taught this portal's words. */
export function Status({ children }) {
  return <StatusBadge tone={toneFor(children)}>{children}</StatusBadge>
}

// ── penetration ──────────────────────────────────────────────────────────
//
// The workbook's column reads "Penetration (%)" but its threshold is 0.0001,
// which is the fraction form of the 0.01% that ISO 14644-3 sets for a DOP/PAO
// integrity test. The rows are internally consistent — every Fail is above the
// threshold and every Pass below — so only the label is ambiguous, and the
// number is carried unchanged rather than multiplied by a hundred on a guess.
// Settings says so in full, and this is where it is rendered.
export const fmtPenetration = (n) => (n == null ? '—' : Number(n).toFixed(5).replace(/0+$/, '0'))

export function Penetration({ value }) {
  if (value == null) return <span style={{ color: MUTE }}>—</span>
  const over = value > THRESHOLDS.penetration.value
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: over ? 700 : 500, color: over ? '#b91c1c' : INK }}>
      {fmtPenetration(value)}
    </span>
  )
}

export function Differential({ value }) {
  if (value == null) return <span style={{ color: MUTE }}>—</span>
  const over = value > THRESHOLDS.pressureDifferential.value
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: over ? 700 : 500, color: over ? '#b91c1c' : INK }}>
      {Number(value).toFixed(2)}
      <span style={{ fontSize: 10.5, color: MUTE, fontWeight: 500 }}> in. wg</span>
    </span>
  )
}

/** A tiny id chip — filter, test, document. Monospaced so columns of them line up. */
export function Id({ children, strong }) {
  return (
    <span style={{
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5,
      fontWeight: strong ? 700 : 500, color: strong ? INK : SUB, whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

export { daysFromToday }
