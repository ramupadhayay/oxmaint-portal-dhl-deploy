'use client'

// The small pieces every table on this portal shares, so a status, a reference
// or a criticality reads identically on all twelve screens.

import { fmtDate } from '../lib/data'

const MUTE = '#94a3b8'
const SUB = '#64748b'
const INK = '#0f172a'
const ACCENT = '#15227a'

/** A monospaced identifier — asset ids and WO numbers get read aloud in a demo. */
export function Ref({ children, tone = ACCENT }) {
  return (
    <span style={{
      fontFamily: 'ui-monospace, "Cascadia Mono", Consolas, monospace',
      fontSize: 11.5, color: tone, fontWeight: 600, whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

/** The department chip. Plant-wide rows say so rather than showing a blank. */
export function DeptChip({ code, name }) {
  if (!code) return <span style={{ color: MUTE, fontSize: 11.5, fontStyle: 'italic' }}>Plant-wide</span>
  return (
    <span title={name || code} style={{
      padding: '2px 7px', borderRadius: 6, background: '#eef2ff',
      border: '1px solid #c7d2fe', color: ACCENT, fontSize: 10.5, fontWeight: 700,
      whiteSpace: 'nowrap',
    }}>{String(code).replace('DNA-', '')}</span>
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

/**
 * A date with how far away it is underneath.
 *
 * The relative line is what a planner actually reads — "in 3 days" answers the
 * question that "18 Sep 2026" makes you do arithmetic for — and it is the half
 * that turns red.
 */
export function DueDate({ value, days, done }) {
  if (!value) return <span style={{ color: MUTE, fontSize: 12 }}>—</span>
  const late = !done && days !== null && days < 0
  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: late ? 700 : 600, color: late ? '#b91c1c' : INK }}>
        {fmtDate(value)}
      </div>
      {days !== null && !done && (
        <div style={{ fontSize: 10.5, color: late ? '#dc2626' : MUTE, marginTop: 2 }}>
          {days < 0 ? `${Math.abs(days)} days late` : days === 0 ? 'due today' : `in ${days} days`}
        </div>
      )}
    </div>
  )
}

/** Criticality, coloured the way the maintenance vocabulary expects. */
export function Criticality({ value }) {
  const tone = { High: '#b91c1c', Medium: '#b45309', Low: '#64748b' }[value] || '#64748b'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: tone }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: tone }} />
      {value || '—'}
    </span>
  )
}

/**
 * A variance in hours, signed.
 *
 * Over and under are both shown in a warning colour rather than red-for-over and
 * green-for-under. An estimate that came in an hour short is not a good outcome
 * — it is the same miss in the other direction, and colouring it green teaches a
 * reader that under-running is free.
 */
export function Variance({ hours }) {
  if (hours === null || hours === undefined) return <span style={{ color: MUTE, fontSize: 12 }}>—</span>
  if (hours === 0) {
    return <span style={{ fontSize: 12, fontWeight: 700, color: '#047857' }}>exact</span>
  }
  const sign = hours > 0 ? '+' : '−'
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color: '#b45309' }}>
      {sign}{Math.abs(hours).toFixed(1)} h
    </span>
  )
}

/** A thin proportion bar — used for stock headroom and workload. */
export function Meter({ value, max, tone = '#15227a', height = 6 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div style={{ height, borderRadius: 999, background: '#eef1f6', overflow: 'hidden', minWidth: 60 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: tone, borderRadius: 999 }} />
    </div>
  )
}

/** A short explanatory line above a table or under a heading. */
export function Note({ children, tone = 'info' }) {
  const tones = {
    info: { bg: '#eff6ff', bd: '#bfdbfe', fg: '#1d4ed8' },
    warn: { bg: '#fffbeb', bd: '#fde68a', fg: '#b45309' },
    good: { bg: '#ecfdf5', bd: '#a7f3d0', fg: '#047857' },
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

/** A horizontal bar list — the Pareto shape the downtime and report screens use. */
export function Bars({ data = [], unit = '', colors = [] }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const palette = colors.length ? colors : ['#15227a', '#3547b8', '#6478d8', '#94a3b8', '#b45309', '#047857']
  return (
    <div style={{ display: 'grid', gap: 9 }}>
      {data.map((d, i) => (
        <div key={d.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,190px) 1fr 62px', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#334155', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
          <Meter value={d.value} max={max} tone={palette[i % palette.length]} height={9} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {d.value}{unit}
          </span>
        </div>
      ))}
      {!data.length && <div style={{ color: MUTE, fontSize: 12.5, padding: '18px 0', textAlign: 'center' }}>Nothing to chart for this filter.</div>}
    </div>
  )
}

/** A labelled figure, for the small grids under a section heading. */
export function Fact({ label, value, sub }) {
  return (
    <div style={{ padding: '12px 14px', background: '#f8fafc', border: '1px solid #eef1f6', borderRadius: 10 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: MUTE }}>{label}</div>
      <div style={{ fontSize: 15, color: INK, marginTop: 6, fontWeight: 700, lineHeight: 1.35 }}>{value}</div>
      {sub ? <div style={{ fontSize: 11.5, color: SUB, marginTop: 3, lineHeight: 1.45 }}>{sub}</div> : null}
    </div>
  )
}
