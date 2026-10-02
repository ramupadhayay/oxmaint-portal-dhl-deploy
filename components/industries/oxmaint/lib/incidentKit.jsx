'use client'

// The Incident Reports list, as the product draws it.
//
// A tile carrying the severity's colour, then the reference and its pills, then
// a line of facts, the description clamped to one line, and the root cause
// under a rule. The card view is the same incident with the two numbers that
// matter — how long it was down, how long it took to close — pulled out.
//
// Rows arrive normalised, so a register of contamination events and a register
// of dropped tools get the same list rather than two that drift:
//
//   {
//     id, reference, severity, status, classification,
//     asset, location, when, downtime, age,
//     description, rootCause,
//     facts: [{ icon, label }],
//     metrics: [{ value, label }],
//   }

import { PALETTE } from './kit'
import { Glyph, Pill, TONE } from './productKit'

const { INK, SUB, MUTE, LINE } = PALETTE

export function IncidentRow({ r, severityTone, statusTone, onOpen }) {
  const st = TONE[statusTone[r.status]] || TONE.slate
  return (
    <button onClick={() => onOpen(r)} style={styles.row}>
      <span style={{ ...styles.tile, background: st.bg, borderColor: st.bd }}>
        <Glyph name="warning" size={17} color={st.fg} />
      </span>

      <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <span style={styles.titleRow}>
          <strong style={styles.ref}>{r.reference}</strong>
          <Pill tone={severityTone[r.severity]}>{r.severity}</Pill>
          <Pill tone={statusTone[r.status]}>{r.status}</Pill>
          {r.classification && <span style={styles.class}>{r.classification}</span>}
        </span>

        <span style={styles.metaRow}>
          {(r.facts || []).map((f) => (
            <span key={f.label} style={styles.meta}>
              <Glyph name={f.icon} size={12} color={MUTE} />
              {f.label}
            </span>
          ))}
        </span>

        <span style={{ ...styles.desc, WebkitLineClamp: 1 }}>{r.description}</span>

        <span style={styles.cause}>
          <span style={styles.causeLabel}>Root cause</span>
          {r.rootCause || 'Not yet established.'}
        </span>
      </span>
    </button>
  )
}

export function IncidentCard({ r, severityTone, statusTone, onOpen }) {
  return (
    <button onClick={() => onOpen(r)} style={styles.card}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, width: '100%' }}>
        <span style={{ ...styles.tile, width: 30, height: 30, background: '#f1f5f9', borderColor: LINE }}>
          <Glyph name="warning" size={15} color={SUB} />
        </span>
        <strong style={{ ...styles.ref, marginBottom: 0 }}>{r.reference}</strong>
      </span>

      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 9 }}>
        <Pill tone={severityTone[r.severity]}>{r.severity}</Pill>
        <Pill tone={statusTone[r.status]}>{r.status}</Pill>
      </span>

      <span style={{ ...styles.desc, marginTop: 0, WebkitLineClamp: 2 }}>{r.description}</span>

      {(r.metrics || []).length > 0 && (
        <span style={styles.metricGrid}>
          {r.metrics.map((m) => (
            <span key={m.label} style={styles.metric}>
              <span style={styles.metricValue}>{m.value}</span>
              <span style={styles.metricLabel}>{m.label}</span>
            </span>
          ))}
        </span>
      )}

      <span style={styles.cardFacts}>
        {(r.facts || []).map((f) => (
          <span key={f.label} style={styles.meta}>
            <Glyph name={f.icon} size={12} color={MUTE} />
            {f.label}
          </span>
        ))}
      </span>
    </button>
  )
}

/**
 * The empty state.
 *
 * A tick rather than a shrug, and green: an incident register with nothing in
 * it is the one empty list in a CMMS that is good news.
 */
export function IncidentEmpty({ filtered, title, body, action }) {
  return (
    <div style={styles.empty}>
      <span style={styles.emptyMark}><Glyph name="check" size={26} color="#059669" /></span>
      <h3 style={styles.emptyTitle}>{title}</h3>
      <p style={styles.emptyBody}>{body}</p>
      {!filtered && action}
    </div>
  )
}

export const styles = {
  filterCard: {
    background: '#fff', borderRadius: 12, padding: '14px 16px 4px', marginBottom: 4,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  filterActions: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 },
  clear: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fecaca', background: '#fef2f2',
    color: '#b91c1c', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  showing: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    fontSize: 12, color: SUB, marginBottom: 12,
  },
  badgeRow: { display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 },
  badge: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px',
    fontSize: 11, fontWeight: 700, fontFamily: 'inherit', borderRadius: 999,
    background: '#eef2ff', color: '#15227a', cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#c7d2fe',
  },
  filterGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12,
    paddingTop: 12, borderTop: `1px solid ${LINE}`, marginBottom: 4,
  },
  field: { display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, marginBottom: 11 },
  fieldLabel: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  select: {
    padding: '8px 10px', fontSize: 12.5, fontWeight: 600, color: INK, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, borderRadius: 9,
    fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
  },

  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 10 },

  row: {
    display: 'flex', alignItems: 'flex-start', gap: 13, padding: '13px 15px',
    borderRadius: 11, background: '#fff', width: '100%', textAlign: 'left',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  tile: {
    width: 36, height: 36, borderRadius: 9, display: 'grid', placeItems: 'center',
    borderStyle: 'solid', borderWidth: 1, flexShrink: 0,
  },
  titleRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 },
  ref: {
    display: 'block', fontSize: 13, fontWeight: 800, color: '#15227a',
    fontVariantNumeric: 'tabular-nums', marginBottom: 2,
  },
  class: { fontSize: 11, color: MUTE, fontWeight: 600 },
  metaRow: { display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 6 },
  meta: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: MUTE, minWidth: 0 },
  // Clamped the way the product clamps it: one line on a row, two on a card.
  // A description that runs to five lines turns the list into a wall and the
  // whole point of the list is scanning it.
  desc: {
    display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden',
    fontSize: 12.5, color: INK, lineHeight: 1.55, marginTop: 2,
  },
  cause: {
    display: 'block', fontSize: 11.5, color: SUB, lineHeight: 1.5, marginTop: 7,
    paddingTop: 7, borderTop: `1px solid ${LINE}`,
  },
  // Set as written rather than upper-cased like the portal's other micro-labels.
  // Everything else this label sits beside is a heading; this one is read as
  // part of the sentence after it, and "ROOT CAUSE Gasket displacement…" is a
  // shout followed by a statement.
  causeLabel: {
    display: 'inline-block', fontSize: 10.5, fontWeight: 800, color: MUTE, marginRight: 8,
  },

  card: {
    display: 'flex', flexDirection: 'column', padding: '14px 15px', borderRadius: 11,
    background: '#fff', borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', minWidth: 0,
  },
  metricGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 11,
    padding: '10px 12px', borderRadius: 9, background: '#f8fafc',
  },
  metric: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 0 },
  metricValue: { fontSize: 17, fontWeight: 800, color: INK, fontVariantNumeric: 'tabular-nums' },
  metricLabel: { fontSize: 10.5, color: MUTE },
  cardFacts: { display: 'flex', flexDirection: 'column', gap: 5, marginTop: 11 },

  empty: {
    padding: '40px 20px', textAlign: 'center', borderRadius: 11,
    borderStyle: 'dashed', borderWidth: 1, borderColor: '#dbe2ea', background: '#fcfdfe',
  },
  emptyMark: {
    display: 'grid', placeItems: 'center', width: 48, height: 48, borderRadius: 999,
    background: '#ecfdf5', margin: '0 auto 12px',
  },
  emptyTitle: { margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: INK },
  emptyBody: { margin: '0 auto', maxWidth: 460, fontSize: 12.5, color: MUTE, lineHeight: 1.6 },
  emptyBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 15, padding: '9px 16px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
    background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer',
  },
}
