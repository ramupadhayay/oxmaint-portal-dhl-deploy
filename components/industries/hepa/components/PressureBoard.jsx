'use client'

// Filters that are breaching, shown so the differences are visible.
//
// This replaced a bar chart, and the reason is worth writing down. The counts
// here are 2, 2, 2, 2, 2, 1, 1, 1 — so eight bars came out at two lengths, five
// of them pinned to the full width because the largest sets the scale. Fifty
// vertical pixels each to say almost nothing, and the one thing a reader
// actually wants — how far over the line the readings went — was not on it at
// all. A count is the weakest fact about a breach.
//
// So each filter gets a card instead, carrying the three things that decide
// what to do about it:
//
//   the readings themselves, against the threshold line, in time order —
//   because two breaches trending down and two trending up are not the same
//   filter;
//
//   the peak, as a multiple of the threshold, because 0.36 and 0.61 in. wg are
//   both "a breach" and only one of them is an emergency;
//
//   and whether the last integrity test still passed, because that is the
//   difference between a filter that is loading and a barrier that has failed.
//
// The sparkline is drawn from the readings rather than sampled — there are
// never more than a handful per filter, so there is nothing to summarise away.

import { PALETTE } from '../lib/kit'
import { THRESHOLDS, fmtDate } from '../lib/data'
import { Status, Id } from '../lib/ui'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE
const LIMIT = THRESHOLDS.pressureDifferential.value

/**
 * @param items [{ filterId, cleanroomName, isoClass, readings: [{date, pressureDifferential, breach, readingType}], lastTest, concern }]
 */
export default function PressureBoard({ items = [], onOpen, limit = 8 }) {
  if (!items.length) {
    return (
      <div style={{ padding: '26px 0', textAlign: 'center', color: MUTE, fontSize: 12.5 }}>
        No filter is over the pressure threshold.
      </div>
    )
  }

  const shown = items.slice(0, limit)

  return (
    <>
      <style>{`
        .hepa-pb { display: grid; gap: 10px; grid-template-columns: 1fr; }
        @media (min-width: 620px) { .hepa-pb { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (min-width: 1180px) { .hepa-pb { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        .hepa-pb-card { transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease; }
        .hepa-pb-card:hover { border-color: #c3cbe6; box-shadow: 0 8px 20px rgba(15,23,42,0.07); transform: translateY(-2px); }
      `}</style>

      <div className="hepa-pb">
        {shown.map((f) => <Tile key={f.filterId} f={f} onOpen={onOpen} />)}
      </div>

      {items.length > limit && (
        <p style={{ margin: '11px 2px 0', fontSize: 11.5, color: MUTE }}>
          {items.length - limit} more filters carry a breach. The register below has all of them.
        </p>
      )}
    </>
  )
}

function Tile({ f, onOpen }) {
  const readings = [...(f.readings || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const values = readings.map((r) => r.pressureDifferential)
  const peak = values.length ? Math.max(...values) : 0
  const latest = readings.at(-1)
  const breaches = readings.filter((r) => r.breach === 'Breach').length
  const over = peak / LIMIT
  const failed = f.lastTest?.result === 'Fail'

  // Rising if the last reading is the highest, and there is more than one.
  const rising = values.length > 1 && latest?.pressureDifferential === peak

  return (
    <div
      className="hepa-pb-card"
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={() => onOpen?.(f)}
      onKeyDown={(e) => { if (onOpen && (e.key === 'Enter' || e.key === ' ')) onOpen(f) }}
      style={{ ...styles.card, cursor: onOpen ? 'pointer' : 'default', borderColor: failed ? '#fecaca' : LINE }}
    >
      <div style={styles.head}>
        <span style={{ minWidth: 0 }}>
          <Id strong>{f.filterId}</Id>
          <span style={{ display: 'block', fontSize: 10.5, color: MUTE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {f.cleanroomName} · {f.isoClass}
          </span>
        </span>
        {failed
          ? <Status>Fail</Status>
          : <span style={{ ...styles.count, ...(rising ? styles.countRising : null) }}>{breaches} over</span>}
      </div>

      <Spark readings={readings} />

      <div style={styles.foot}>
        <span style={{ minWidth: 0 }}>
          <span style={styles.footLabel}>Peak</span>
          <span style={{ ...styles.peak, color: over >= 1.5 ? '#b91c1c' : over >= 1 ? '#c2410c' : INK }}>
            {peak.toFixed(2)}
            <span style={{ fontSize: 9.5, color: MUTE, fontWeight: 500 }}> in. wg</span>
          </span>
        </span>
        <span style={{ minWidth: 0, textAlign: 'right' }}>
          <span style={styles.footLabel}>Against limit</span>
          <span style={{ ...styles.peak, color: over >= 1.5 ? '#b91c1c' : over >= 1 ? '#c2410c' : '#047857' }}>
            {over.toFixed(2)}×
          </span>
        </span>
      </div>

      <div style={styles.note}>
        {failed
          ? 'Last integrity test failed — this is the barrier, not the loading.'
          : rising
            ? `Rising: the newest reading is the highest, on ${fmtDate(latest?.date)}.`
            : `Last read ${fmtDate(latest?.date)}. Last integrity test ${f.lastTest?.result?.toLowerCase() || 'not on file'}.`}
      </div>
    </div>
  )
}

/**
 * The readings in time order, with the threshold drawn across them.
 *
 * The y-scale runs from zero to the higher of the peak and the threshold, so
 * the line is always visible and a filter whose readings sit just under it does
 * not look identical to one sitting far below.
 */
function Spark({ readings }) {
  const W = 100
  const H = 34
  const values = readings.map((r) => r.pressureDifferential)
  const top = Math.max(LIMIT * 1.25, ...values) || 1
  const y = (v) => H - (v / top) * H

  if (!values.length) return <div style={{ height: H, marginBottom: 9 }} />

  const step = values.length > 1 ? W / (values.length - 1) : 0
  const pts = values.map((v, i) => [values.length > 1 ? i * step : W / 2, y(v)])
  const line = pts.map(([x, py], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${py.toFixed(1)}`).join(' ')
  const area = `${line} L${pts.at(-1)[0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z`
  const limitY = y(LIMIT)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      style={{ width: '100%', height: H, display: 'block', margin: '10px 0 9px', overflow: 'visible' }}>
      <defs>
        <linearGradient id="hepaPbFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dc2626" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* The threshold. Everything above this line is a breach. */}
      <line x1="0" y1={limitY} x2={W} y2={limitY} stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />

      {values.length > 1 && <path d={area} fill="url(#hepaPbFill)" />}
      {values.length > 1 && (
        <path d={line} fill="none" stroke="#dc2626" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      )}

      {pts.map(([px, py], i) => (
        <circle
          key={readings[i].readingId || i}
          cx={px} cy={py} r={readings[i].breach === 'Breach' ? 2.6 : 1.9}
          fill={readings[i].breach === 'Breach' ? '#dc2626' : '#fff'}
          stroke={readings[i].breach === 'Breach' ? '#dc2626' : '#94a3b8'}
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
        >
          <title>{`${readings[i].date} — ${readings[i].pressureDifferential} in. wg (${readings[i].readingType})`}</title>
        </circle>
      ))}
    </svg>
  )
}

const styles = {
  card: {
    padding: '12px 13px', borderRadius: 11, background: '#fff', minWidth: 0,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  head: { display: 'flex', alignItems: 'flex-start', gap: 9, minWidth: 0 },
  count: {
    flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: '#b45309',
    background: '#fffbeb', borderStyle: 'solid', borderWidth: 1, borderColor: '#fde68a', borderRadius: 999, padding: '2px 8px',
  },
  countRising: { color: '#b91c1c', background: '#fef2f2', borderColor: '#fecaca' },
  foot: {
    display: 'flex', justifyContent: 'space-between', gap: 10,
    paddingTop: 9, borderTop: `1px solid ${LINE}`,
  },
  footLabel: {
    display: 'block', fontSize: 9.5, fontWeight: 700, color: MUTE,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2,
  },
  peak: { fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 },
  note: { marginTop: 8, fontSize: 10.5, color: MUTE, lineHeight: 1.45 },
}

export { ACCENT, SUB }
