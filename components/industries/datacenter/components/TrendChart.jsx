'use client'

// The chart the screens spec calls the most persuasive one in the demo.
//
// Its whole job is to make a single moment obvious: the day a sensor crossed
// the line, and how far ahead of the scheduled inspection that was. So the
// reading line is not the point — the baseline band, the threshold, and the
// marker on the alert date are. A plain line chart would show the same numbers
// and prove nothing.
//
// Drawn as SVG rather than pulled from a chart library: the kit has no
// time-series with a band and a threshold, and a dependency for one chart is
// more to keep working than sixty lines of path arithmetic.

import { useMemo, useState } from 'react'

const PAD = { top: 18, right: 18, bottom: 30, left: 46 }

export default function TrendChart({
  data = [],            // [{ date, value, status }]
  baseline,             // { mean, low, high, threshold }
  marker,               // { date, label }
  color = '#15227a',
  unit = '',
  height = 260,
  decimals = 2,
}) {
  const [hover, setHover] = useState(null)
  const width = 760

  const geom = useMemo(() => {
    const values = data.map((d) => d.value).filter((v) => typeof v === 'number')
    if (!values.length) return null

    // The threshold has to be inside the frame even when nothing reached it —
    // a chart that crops the line it is about would be worse than no chart.
    const candidates = [...values]
    if (baseline) candidates.push(baseline.low, baseline.high, baseline.threshold)
    const min = Math.min(...candidates)
    const max = Math.max(...candidates)
    const span = (max - min) || 1
    const lo = min - span * 0.12
    const hi = max + span * 0.12

    const plotW = width - PAD.left - PAD.right
    const plotH = height - PAD.top - PAD.bottom
    const x = (i) => PAD.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW)
    const y = (v) => PAD.top + plotH - ((v - lo) / (hi - lo)) * plotH

    return { x, y, lo, hi, plotW, plotH }
  }, [data, baseline, height])

  if (!geom || !data.length) {
    return <div style={styles.empty}>No readings in this window.</div>
  }

  const { x, y } = geom
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(data.length - 1).toFixed(1)},${(height - PAD.bottom).toFixed(1)} L${x(0).toFixed(1)},${(height - PAD.bottom).toFixed(1)} Z`

  const markerIndex = marker ? data.findIndex((d) => d.date === marker.date) : -1

  // Where the reading first went past the threshold. This is the fact the
  // screen exists to show, so it is found rather than left to the eye.
  const crossIndex = baseline
    ? data.findIndex((d) => typeof d.value === 'number' && d.value > baseline.threshold)
    : -1

  const ticks = [geom.lo, (geom.lo + geom.hi) / 2, geom.hi]
  const labelEvery = Math.max(1, Math.ceil(data.length / 6))

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', minWidth: 520, display: 'block' }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="dcTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.16" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="#eef2f7" strokeWidth="1" />
            <text x={PAD.left - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="#94a3b8">
              {t.toFixed(decimals)}
            </text>
          </g>
        ))}

        {/* The band is what "normal for this asset" means, and it is derived
            from the asset's own quiet period rather than a fixed number. */}
        {baseline && (
          <>
            <rect
              x={PAD.left} y={y(baseline.high)}
              width={geom.plotW} height={Math.max(1, y(baseline.low) - y(baseline.high))}
              fill="#94a3b8" fillOpacity="0.10"
            />
            <line x1={PAD.left} x2={width - PAD.right} y1={y(baseline.mean)} y2={y(baseline.mean)}
              stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 4" />
            <line x1={PAD.left} x2={width - PAD.right} y1={y(baseline.threshold)} y2={y(baseline.threshold)}
              stroke="#dc2626" strokeWidth="1.5" strokeDasharray="6 4" />
            <text x={width - PAD.right} y={y(baseline.threshold) - 6} textAnchor="end" fontSize="10" fontWeight="700" fill="#dc2626">
              alarm threshold {baseline.threshold.toFixed(decimals)}{unit ? ` ${unit}` : ''}
            </text>
          </>
        )}

        <path d={area} fill="url(#dcTrendFill)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />

        {/* The crossing, then the alert. Two different days, and the gap
            between them is the lead time the programme is arguing for. */}
        {crossIndex >= 0 && (
          <circle cx={x(crossIndex)} cy={y(data[crossIndex].value)} r="5" fill="#fff" stroke="#dc2626" strokeWidth="2.5" />
        )}

        {markerIndex >= 0 && (
          <g>
            <line x1={x(markerIndex)} x2={x(markerIndex)} y1={PAD.top} y2={height - PAD.bottom}
              stroke="#15227a" strokeWidth="1.5" strokeDasharray="4 3" />
            <circle cx={x(markerIndex)} cy={y(data[markerIndex].value)} r="5.5" fill="#15227a" stroke="#fff" strokeWidth="2" />
            <text x={x(markerIndex)} y={PAD.top - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#15227a">
              {marker.label || 'alert'}
            </text>
          </g>
        )}

        {data.map((d, i) => (
          <rect key={i}
            x={x(i) - (geom.plotW / data.length) / 2} y={PAD.top}
            width={geom.plotW / data.length} height={geom.plotH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}

        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={height - PAD.bottom} stroke="#cbd5e1" strokeWidth="1" />
            <circle cx={x(hover)} cy={y(data[hover].value)} r="4" fill={color} />
          </g>
        )}

        {data.map((d, i) => (i % labelEvery === 0 || i === data.length - 1) && (
          <text key={`t${i}`} x={x(i)} y={height - 10} textAnchor="middle" fontSize="10" fill="#94a3b8">
            {String(d.date).slice(5)}
          </text>
        ))}
      </svg>

      {/* Under the chart rather than floating over it: a tooltip that covers
          the line hides the thing it is describing. */}
      <div style={styles.readout}>
        {hover != null ? (
          <>
            <span style={styles.readoutDate}>{data[hover].date}</span>
            <span style={{ ...styles.readoutValue, color }}>
              {data[hover].value?.toFixed(decimals)}{unit ? ` ${unit}` : ''}
            </span>
            {data[hover].status && <span style={styles.readoutStatus}>{data[hover].status}</span>}
          </>
        ) : (
          <span style={styles.readoutHint}>Hover the chart to read a day.</span>
        )}
      </div>
    </div>
  )
}

const styles = {
  empty: { padding: '30px 4px', textAlign: 'center', fontSize: 12.5, color: '#94a3b8' },
  readout: {
    display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap',
    marginTop: 8, minHeight: 22, paddingTop: 8, borderTop: '1px solid #eef2f7',
  },
  readoutDate: { fontSize: 11.5, color: '#64748b', fontFamily: 'ui-monospace, Menlo, monospace' },
  readoutValue: { fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums' },
  readoutStatus: { fontSize: 11.5, color: '#64748b' },
  readoutHint: { fontSize: 11.5, color: '#94a3b8' },
}
