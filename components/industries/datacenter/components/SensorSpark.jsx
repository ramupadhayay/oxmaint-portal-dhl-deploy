'use client'

// The other sensors on the same asset, small.
//
// The big chart proves one sensor crossed its line. What it cannot show is the
// thing a reliability engineer asks next: did anything else move? A vibration
// trace climbing while thermal and ultrasound stay flat is a bearing; all three
// climbing together is a load or an airflow problem. That distinction is the
// difference between dispatching a fitter and dispatching a controls engineer,
// and it is invisible on a screen showing one trace at a time.
//
// So these sit beside the main chart rather than under it. Each is the same
// window and the same per-asset threshold arithmetic as the big one — a
// sparkline drawn from different maths than the chart it sits next to would be
// worse than no sparkline.

import { useMemo } from 'react'

const W = 100
const H = 30

export default function SensorSpark({ sensor, readings, baseline, active, onPick }) {
  const values = readings.map((r) => r.value).filter((v) => typeof v === 'number')
  const last = values[values.length - 1]
  const first = values[0]
  const status = readings[readings.length - 1]?.status

  const geom = useMemo(() => {
    if (!values.length) return null
    // The threshold has to be inside the frame even when nothing reached it,
    // or a calm sensor draws a line that is not there and reads as breached.
    const lo = Math.min(...values, baseline ? baseline.low : Infinity)
    const hi = Math.max(...values, baseline ? baseline.threshold : -Infinity)
    const pad = (hi - lo) * 0.12 || 1
    const min = lo - pad
    const max = hi + pad
    const y = (v) => H - ((v - min) / (max - min)) * H
    const x = (i) => (i / Math.max(1, readings.length - 1)) * W
    return { y, x }
  }, [values, baseline, readings.length])

  if (!geom) return null

  const path = readings
    .map((r, i) => (typeof r.value === 'number'
      ? `${i ? 'L' : 'M'}${geom.x(i).toFixed(1)},${geom.y(r.value).toFixed(1)}`
      : ''))
    .filter(Boolean)
    .join(' ')

  const breached = baseline && typeof last === 'number' && last > baseline.threshold
  const drift = typeof first === 'number' && typeof last === 'number' ? last - first : null
  const thresholdY = baseline ? geom.y(baseline.threshold) : null

  return (
    <button
      onClick={() => onPick?.(sensor.key)}
      title={`Show ${sensor.label} in the main chart`}
      style={{
        ...styles.card,
        borderColor: active ? sensor.color : breached ? '#fecaca' : '#e4e9f0',
        background: active ? '#fbfcff' : '#fff',
        boxShadow: active ? `inset 3px 0 0 ${sensor.color}` : 'none',
      }}
    >
      <div style={styles.head}>
        <span style={{ ...styles.dot, background: sensor.color }} />
        <span style={styles.name}>{sensor.label}</span>
        {active && <span style={styles.showing}>showing</span>}
      </div>

      <div style={styles.readingRow}>
        <span style={{ ...styles.value, color: breached ? '#b91c1c' : '#0f172a' }}>
          {typeof last === 'number' ? last.toFixed(sensor.decimals) : '—'}
          <span style={styles.unit}> {sensor.unit}</span>
        </span>
        {drift != null && (
          <span style={{ ...styles.drift, color: drift > 0 ? '#b45309' : '#047857' }}>
            {drift > 0 ? '▲' : '▼'} {Math.abs(drift).toFixed(sensor.decimals)}
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={styles.svg}>
        <defs>
          <linearGradient id={`spark-${sensor.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={sensor.color} stopOpacity="0.16" />
            <stop offset="100%" stopColor={sensor.color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* The band the asset was quiet in, and the line it must not pass. */}
        {baseline && (
          <rect
            x="0" y={geom.y(baseline.high)} width={W}
            height={Math.max(1, geom.y(baseline.low) - geom.y(baseline.high))}
            fill="#eef1f5"
          />
        )}
        {thresholdY != null && (
          <line x1="0" y1={thresholdY} x2={W} y2={thresholdY}
            stroke="#dc2626" strokeWidth="1" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
        )}

        <path d={`${path} L${W},${H} L0,${H} Z`} fill={`url(#spark-${sensor.key})`} />
        <path d={path} fill="none" stroke={sensor.color} strokeWidth="1.6"
          strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>

      <div style={styles.foot}>
        <span style={{
          ...styles.status,
          color: breached ? '#b91c1c' : status === 'Elevated' ? '#b45309' : '#047857',
          background: breached ? '#fef2f2' : status === 'Elevated' ? '#fffbeb' : '#f0fdf4',
          borderColor: breached ? '#fecaca' : status === 'Elevated' ? '#fde68a' : '#bbf7d0',
        }}>
          {breached ? 'Over threshold' : status || 'Normal'}
        </span>
        {baseline && (
          <span style={styles.threshold}>
            limit {baseline.threshold.toFixed(sensor.decimals)}
          </span>
        )}
      </div>
    </button>
  )
}

const styles = {
  card: {
    display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
    padding: '10px 12px', borderRadius: 11, fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1,
    transition: 'border-color .16s ease, background .16s ease',
  },
  head: { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  name: { fontSize: 11.5, fontWeight: 700, color: '#0f172a' },
  showing: {
    marginLeft: 'auto', fontSize: 9, fontWeight: 700, letterSpacing: 0.3,
    textTransform: 'uppercase', color: '#64748b',
  },
  readingRow: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 },
  value: { fontSize: 17, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' },
  unit: { fontSize: 10, fontWeight: 600, color: '#94a3b8' },
  drift: { marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  svg: { width: '100%', height: 30, display: 'block' },
  foot: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 },
  status: {
    fontSize: 9.5, fontWeight: 700, borderRadius: 999, padding: '1px 8px',
    borderStyle: 'solid', borderWidth: 1, whiteSpace: 'nowrap',
  },
  threshold: {
    marginLeft: 'auto', fontSize: 9.5, color: '#94a3b8',
    fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
  },
}
