'use client'

// The small pieces every table on this portal needs, in one place so a blank
// cell reads the same on all twelve screens.
//
// The workbook is unusually strict about absence: "Blank fields mean the source
// documents did not provide enough information. They should not be silently
// invented." Four permits have no expiration date and one has no issue date,
// for three different reasons — two Iowa construction permits are genuinely
// non-expiring, and the Chapter 105 tracker simply never populated the column.
//
// A dash would flatten all of that into "nothing here", which is how a reader
// ends up assuming the data is incomplete rather than that the source was
// silent. So absence is rendered as a stated fact, in a muted italic that is
// visibly not a value.

import { fmtDate, NOT_STATED } from '../lib/data'

const MUTE = '#94a3b8'
const SUB = '#64748b'
const INK = '#0f172a'
const ACCENT = '#15227a'

/** A field the source did not provide. */
export function Blank({ label = NOT_STATED }) {
  return <span style={{ color: MUTE, fontStyle: 'italic', fontSize: 12 }}>{label}</span>
}

/** A value, or the stated absence when it is empty. */
export function Val({ children, blank }) {
  const empty = children === null || children === undefined || children === ''
  return empty ? <Blank label={blank} /> : <>{children}</>
}

/** A date, formatted, or the stated absence. */
export function DateVal({ value, blank }) {
  return value ? <>{fmtDate(value)}</> : <Blank label={blank} />
}

/**
 * The marker on anything this portal worked out rather than read.
 *
 * Every generated calendar occurrence carries one. The workbook's
 * Verification_Log is explicit that its own task rows were "generated from
 * frequencies for UI demonstration, not entered by WAGA", and the same has to
 * be true and visible of the ones computed here — a derived date presented
 * plainly is indistinguishable from a customer record, which is the specific
 * confusion this dataset must not create.
 */
export function Derived({ children = 'Derived' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap',
      background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#6d28d9',
      fontSize: 10, fontWeight: 700,
    }}>
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#7c3aed' }} />
      {children}
    </span>
  )
}

/** Where a row came from — the permit PDF, the tracker tab, the checklist page. */
export function Source({ children }) {
  if (!children) return null
  return (
    <div style={{
      marginTop: 10, padding: '8px 10px', background: '#f8fafc',
      border: '1px solid #eef1f6', borderRadius: 8,
      fontSize: 11.5, color: SUB, lineHeight: 1.5,
    }}>
      <span style={{ fontWeight: 700, color: '#475569' }}>Source: </span>{children}
    </div>
  )
}

/** A monospaced identifier — permit numbers and requirement ids are read aloud. */
export function Ref({ children }) {
  return (
    <span style={{
      fontFamily: 'ui-monospace, "Cascadia Mono", Consolas, monospace',
      fontSize: 11.5, color: ACCENT, fontWeight: 600, whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

/** The site chip that appears in every register. */
export function SiteChip({ code }) {
  if (!code || code === '—') return <Blank label="Organisation-wide" />
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 6, background: '#eef2ff',
      border: '1px solid #c7d2fe', color: ACCENT, fontSize: 10.5, fontWeight: 700,
      whiteSpace: 'nowrap',
    }}>{code}</span>
  )
}

/** Two lines in one cell: the thing, and what it belongs to. */
export function TwoLine({ top, bottom }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: INK, lineHeight: 1.35 }}>{top}</div>
      {bottom ? <div style={{ fontSize: 11, color: SUB, marginTop: 2, lineHeight: 1.4 }}>{bottom}</div> : null}
    </div>
  )
}

/** A short explanatory line under a screen heading or above a table. */
export function Note({ children, tone = 'info' }) {
  const tones = {
    info: { bg: '#eff6ff', bd: '#bfdbfe', fg: '#1d4ed8' },
    warn: { bg: '#fffbeb', bd: '#fde68a', fg: '#b45309' },
    grey: { bg: '#f8fafc', bd: '#e4e9f0', fg: '#475569' },
  }
  const t = tones[tone] || tones.info
  return (
    <div style={{
      padding: '10px 12px', marginBottom: 14, borderRadius: 9,
      background: t.bg, border: `1px solid ${t.bd}`, color: t.fg,
      fontSize: 12, lineHeight: 1.55,
    }}>{children}</div>
  )
}
