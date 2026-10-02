'use client'

// One sensor's current state, for one asset.
//
// The spec asks for this explicitly: "build the three sensor cards as one
// reusable component parameterized by sensor type". Three near-identical cards
// written by hand is how the vibration one ends up saying "above threshold"
// while the thermal one says "high" for the same condition.
//
// The status is read against this asset's own baseline rather than a fixed
// number, which is the other thing the spec is explicit about — a reading that
// is unremarkable on a chiller is an alarm on a CRAH.

import { PALETTE } from '../lib/kit'

const { SUB, MUTE, INK, LINE, GREEN, AMBER, RED } = PALETTE

const TONES = {
  normal: { label: 'Normal', fg: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  elevated: { label: 'Elevated', fg: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  alarm: { label: 'Above threshold', fg: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
}

/**
 * Where a reading sits against this asset's own band.
 *
 * The workbook carries its own status words too, and where they exist they win
 * — they are the client's reading of their own data. The derived state is the
 * fallback, and it is what gives an asset with no status column a sensible one.
 */
export function stateOf(value, baseline, given) {
  const g = String(given || '').toLowerCase()
  if (/alarm|above|critical|high/.test(g)) return 'alarm'
  if (/elevated|warn|caution/.test(g)) return 'elevated'
  if (/normal|ok|stable/.test(g)) return 'normal'
  if (!baseline || typeof value !== 'number') return 'normal'
  if (value > baseline.threshold) return 'alarm'
  if (value > baseline.high) return 'elevated'
  return 'normal'
}

export default function SensorCard({
  sensor,          // from SENSORS: { key, label, unit, decimals, color }
  value,
  status,          // the workbook's own word, where it has one
  baseline,
  series = [],     // for the sparkline
  onClick,
}) {
  const state = stateOf(value, baseline, status)
  const tone = TONES[state]
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag onClick={onClick} className="dc-sensor" style={{ ...styles.card, cursor: onClick ? 'pointer' : 'default' }}>
      <div style={styles.head}>
        <span style={styles.label}>{sensor.label}</span>
        <span style={{ ...styles.pill, color: tone.fg, background: tone.bg, borderColor: tone.border }}>
          {tone.label}
        </span>
      </div>

      <div style={styles.valueRow}>
        <span style={{ ...styles.value, color: state === 'normal' ? INK : tone.fg }}>
          {typeof value === 'number' ? value.toFixed(sensor.decimals) : '—'}
        </span>
        <span style={styles.unit}>{sensor.unit}</span>
      </div>

      {series.length > 1 && <Spark data={series} color={sensor.color} baseline={baseline} />}

      {baseline && (
        <div style={styles.baseline}>
          baseline {baseline.mean.toFixed(sensor.decimals)} · alarm {baseline.threshold.toFixed(sensor.decimals)}
        </div>
      )}
    </Tag>
  )
}

// A thirty-day shape, not a chart. It answers "is this going somewhere" at a
// glance; the trend screen answers "where, and since when".
function Spark({ data, color, baseline, w = 232, h = 40 }) {
  const values = data.filter((v) => typeof v === 'number')
  if (values.length < 2) return null

  const candidates = baseline ? [...values, baseline.threshold] : values
  const min = Math.min(...candidates)
  const max = Math.max(...candidates)
  const span = (max - min) || 1
  const x = (i) => (i / (data.length - 1)) * w
  const y = (v) => h - ((v - min) / span) * h

  const line = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h, display: 'block', marginTop: 12, overflow: 'visible' }}>
      {baseline && baseline.threshold <= max && (
        <line x1="0" x2={w} y1={y(baseline.threshold)} y2={y(baseline.threshold)}
          stroke="#dc2626" strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
      )}
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="2.8" fill={color} />
    </svg>
  )
}

const styles = {
  card: {
    display: 'block', width: '100%', textAlign: 'left', fontFamily: 'inherit',
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 13, padding: 16,
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
    transition: 'border-color .15s, box-shadow .15s',
  },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { fontSize: 12, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: 0.4 },
  pill: { fontSize: 10.5, fontWeight: 700, border: '1px solid', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' },
  valueRow: { display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 10 },
  value: { fontSize: 28, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' },
  unit: { fontSize: 13, fontWeight: 600, color: MUTE },
  baseline: { fontSize: 11, color: MUTE, marginTop: 10 },
}
