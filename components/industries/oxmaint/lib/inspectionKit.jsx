'use client'

// The Inspection list item, as the product draws it.
//
// The product's row is not a table row — it is two blocks. Identity, title and
// four facts on the left; score and a Start button on the right; then three
// columns of detail under a rule. It is taller than a table row on purpose:
// the point of the list view is that a round can be read without opening it.
//
// This file holds the row, the card and the pieces they are built from, and
// nothing about any one register. Every screen that uses it hands over rows in
// the shape below, so a portal whose inspections are cleanrooms and a portal
// whose inspections are pumps get the same list rather than two that were the
// same on the day they were written.
//
//   {
//     id, reference, title, status, result,
//     asset, location, inspector, assignee,
//     date, frequency, duration,
//     items:  { total, passed, failed, action } | null,
//     score:  { pct, points, max } | null,
//     tags:   [{ icon, tone, label }],
//     notes, recommendedActions,
//     startable,
//   }
//
// `status` and `result` are the register's own words; the tone maps are passed
// in beside them, because "Fail" is red everywhere but "Open finding" only
// exists on one of these registers.

import { PALETTE } from './kit'
import { Glyph, Pill, TONE } from './productKit'

const { INK, SUB, MUTE, LINE } = PALETTE

/** A field with no measurement in it — never a zero, which is a measurement. */
export const DASH = '—'

/**
 * A card that opens a record and still holds buttons.
 *
 * The row has a Start button inside it, so the row itself cannot be a button —
 * nested buttons are invalid and React says so on hydration. A div carrying the
 * button role, a tab stop and Enter/Space is the same affordance without the
 * broken markup.
 */
export function Clickable({ onOpen, style, children }) {
  return (
    <div role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      style={style}>
      {children}
    </div>
  )
}

export function Fact({ icon, label, children }) {
  return (
    <span style={styles.fact}>
      <Glyph name={icon} size={13} color="#94a3b8" />
      <span style={styles.factLabel}>{label}:</span>
      <span style={styles.factValue}>{children}</span>
    </span>
  )
}

export function Column({ icon, title, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={styles.colHead}>
        <Glyph name={icon} size={13} color={SUB} />
        <span>{title}</span>
      </div>
      {children}
    </div>
  )
}

export function Line({ label, value, tone, stacked }) {
  if (stacked) {
    return (
      <span style={{ minWidth: 0 }}>
        <span style={styles.stackLabel}>{label}</span>
        <span style={styles.stackValue}>{value}</span>
      </span>
    )
  }
  return (
    <div style={styles.line}>
      <span style={{ ...styles.lineLabel, color: tone || MUTE }}>{label}:</span>
      <span style={{ ...styles.lineValue, color: tone || INK }}>{value}</span>
    </div>
  )
}

export function Tag({ icon, tone, children }) {
  return (
    <div style={{ ...styles.tag, color: tone }}>
      <Glyph name={icon} size={12} color={tone} />
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</span>
    </div>
  )
}

export function ScoreBlock({ score, tone }) {
  if (!score || typeof score.pct !== 'number') {
    return <span style={styles.scoreNone}>Not scored</span>
  }
  const t = TONE[tone] || TONE.slate
  const trend = score.pct >= 80 ? 'up' : score.pct >= 60 ? 'flat' : 'down'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
      <span style={{ ...styles.scoreBig, fontSize: 24, color: t.fg }}>{score.pct}%</span>
      {score.points != null && <span style={styles.scorePts}>{score.points}/{score.max}</span>}
      <Glyph name={trend} size={15} color={t.fg} />
    </span>
  )
}

/** One round, as the product's list draws it. */
export function InspectionRow({ r, statusTone, resultTone, onOpen, onStart, startLabel = 'Start Inspection' }) {
  const items = r.items
  return (
    <Clickable onOpen={() => onOpen(r)} style={styles.row}>
      <div style={styles.rowHead}>
        <div style={{ flex: '1 1 340px', minWidth: 0 }}>
          <div style={styles.badgeLine}>
            <span style={styles.ref}>{r.reference}</span>
            <Pill tone={statusTone[r.status]}>{r.status}</Pill>
            {r.result && <Pill tone={resultTone[r.result]}>{r.result}</Pill>}
          </div>

          <h3 style={styles.rowTitle}>{r.title}</h3>

          <div style={styles.facts}>
            <Fact icon="box" label="Asset">{r.asset || DASH}</Fact>
            <Fact icon="pin" label="Location">{r.location || DASH}</Fact>
            <Fact icon="user" label="Inspector">{r.inspector || 'Not yet walked'}</Fact>
            <Fact icon="check" label="Assignee">{r.assignee || 'Unassigned'}</Fact>
          </div>
        </div>

        <div style={styles.rowRight}>
          <ScoreBlock score={r.score} tone={resultTone[r.result]} />
          {r.startable && onStart && (
            <button onClick={(e) => { e.stopPropagation(); onStart(r) }} style={styles.startBtn}>
              <Glyph name="play" size={12} color="#fff" />
              {startLabel}
            </button>
          )}
        </div>
      </div>

      <div style={styles.rowBody}>
        <Column icon="calendar" title="Schedule & Timing">
          <Line label="Inspection Date" value={r.date || DASH} />
          <Line label="Frequency" value={r.frequency || DASH} />
          <Line label="Duration" value={r.duration || DASH} />
        </Column>

        <Column icon="check" title="Results Summary">
          {items ? (
            <>
              <Line label="Total Items" value={items.total} />
              <Line label="Passed" value={items.passed} tone="#047857" />
              <Line label="Failed" value={items.failed} tone="#b91c1c" />
              {items.action > 0 && <Line label="Action Required" value={items.action} tone="#b45309" />}
            </>
          ) : (
            <p style={styles.colNone}>Nothing captured yet — this round has not been walked.</p>
          )}
        </Column>

        <Column icon="doc" title="Additional Info">
          {(r.tags || []).map((t) => (
            <Tag key={t.label} icon={t.icon} tone={t.tone}>{t.label}</Tag>
          ))}
        </Column>
      </div>

      {(r.notes || r.recommendedActions) && (
        <div style={styles.rowNotes}>
          {r.notes && (
            <p style={styles.noteLine}><span style={styles.noteLabel}>Notes: </span>{r.notes}</p>
          )}
          {r.recommendedActions && (
            <p style={styles.noteLine}>
              <span style={styles.noteLabel}>Recommended Actions: </span>{r.recommendedActions}
            </p>
          )}
        </div>
      )}
    </Clickable>
  )
}

/** The same round as a card, for the grid view. */
export function InspectionCard({ r, statusTone, resultTone, onOpen, onStart, startLabel = 'Start Inspection' }) {
  const t = TONE[resultTone[r.result]] || TONE.slate
  return (
    <Clickable onOpen={() => onOpen(r)} style={styles.card}>
      <div style={styles.badgeLine}>
        <span style={styles.tile}><Glyph name="clipboard" size={14} color="#15227a" /></span>
        <Pill tone={statusTone[r.status]}>{r.status}</Pill>
        {r.result && <Pill tone={resultTone[r.result]}>{r.result}</Pill>}
      </div>

      <span style={styles.ref}>{r.reference}</span>
      <h3 style={{ ...styles.rowTitle, fontSize: 14 }}>{r.title}</h3>
      <p style={styles.cardAsset}>{r.asset || r.location || DASH}</p>

      <div style={styles.cardGrid}>
        <Line label="Inspection Date" value={r.date || DASH} stacked />
        <Line label="Inspector" value={r.inspector || 'Not yet walked'} stacked />
        <Line label="Assignee" value={r.assignee || 'Unassigned'} stacked />
        <Line label="Duration" value={r.duration || DASH} stacked />
      </div>

      {r.score && typeof r.score.pct === 'number' && (
        <div style={{ marginTop: 11 }}>
          <div style={styles.scoreRow}>
            <span style={styles.scoreLabel}>Score</span>
            {r.score.points != null && (
              <span style={{ marginLeft: 'auto', ...styles.scoreBig, color: t.fg }}>
                {r.score.points}/{r.score.max}
              </span>
            )}
            <span style={{ ...styles.scorePct, marginLeft: r.score.points == null ? 'auto' : 0 }}>
              {r.score.pct}%
            </span>
          </div>
          <div style={styles.track}>
            <div style={{ width: `${r.score.pct}%`, height: '100%', borderRadius: 999, background: t.fg || '#15227a' }} />
          </div>
        </div>
      )}

      {r.startable && onStart && (
        <button onClick={(e) => { e.stopPropagation(); onStart(r) }}
          style={{ ...styles.startBtn, marginTop: 11, justifyContent: 'center' }}>
          <Glyph name="play" size={12} color="#fff" />
          {startLabel}
        </button>
      )}
    </Clickable>
  )
}

/** The empty state, which says something different when a filter caused it. */
export function InspectionEmpty({ searching, title, body, action }) {
  return (
    <div style={styles.empty}>
      <span style={{ display: 'block', marginBottom: 10 }}>
        <Glyph name="clipboard" size={34} color="#cbd5e1" />
      </span>
      <strong style={styles.emptyTitle}>{title}</strong>
      <p style={styles.emptyBody}>{body}</p>
      {!searching && action}
    </div>
  )
}

export const styles = {
  locationSelect: {
    position: 'absolute', inset: 0, width: '100%', height: '100%',
    opacity: 0, cursor: 'pointer', fontFamily: 'inherit',
  },
  locationFace: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px',
    fontSize: 12.5, fontWeight: 700, borderRadius: 9, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, whiteSpace: 'nowrap',
    pointerEvents: 'none',
  },

  filterHead: { fontSize: 13, fontWeight: 700, color: INK },
  filterNote: { margin: '3px 0 12px', fontSize: 11.5, color: MUTE, lineHeight: 1.5 },
  filterField: { display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 11 },
  filterLabel: { fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 },
  select: {
    padding: '8px 10px', fontSize: 12.5, fontWeight: 600, color: INK, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
    borderRadius: 9, fontFamily: 'inherit', cursor: 'pointer', outline: 'none', width: '100%',
  },

  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(292px,1fr))', gap: 12 },

  row: {
    borderRadius: 12, background: '#fff', cursor: 'pointer', overflow: 'hidden',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  rowHead: {
    display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap',
    padding: '15px 17px 14px', borderBottom: '1px solid #f1f5f9',
  },
  rowRight: { marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9 },
  badgeLine: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 7 },
  ref: {
    fontSize: 11.5, fontWeight: 800, color: '#15227a',
    fontVariantNumeric: 'tabular-nums', letterSpacing: 0.2,
  },
  rowTitle: { margin: '0 0 9px', fontSize: 15, fontWeight: 700, color: INK, lineHeight: 1.35 },
  facts: { display: 'flex', flexDirection: 'column', gap: 5 },
  fact: { display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, fontSize: 12 },
  factLabel: { color: SUB, fontWeight: 700, flexShrink: 0 },
  factValue: { color: SUB, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

  rowBody: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
    gap: 20, padding: '14px 17px',
  },
  colHead: {
    display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8,
    fontSize: 12, fontWeight: 700, color: SUB,
  },
  colNone: { margin: 0, fontSize: 11.5, color: MUTE, lineHeight: 1.5 },
  line: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, fontSize: 12 },
  lineLabel: { flex: 1, minWidth: 0 },
  lineValue: { fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  stackLabel: { display: 'block', fontSize: 10.5, color: MUTE, marginBottom: 2 },
  stackValue: {
    display: 'block', fontSize: 11.5, fontWeight: 600, color: INK,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  tag: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, marginBottom: 5, minWidth: 0 },

  rowNotes: { padding: '0 17px 14px' },
  noteLine: { margin: '0 0 4px', fontSize: 12, color: SUB, lineHeight: 1.55 },
  noteLabel: { fontWeight: 700, color: INK },

  card: {
    display: 'flex', flexDirection: 'column', padding: '15px 16px', borderRadius: 12,
    background: '#fff', borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
    cursor: 'pointer', minWidth: 0,
  },
  tile: {
    width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center',
    background: '#eef1ff', flexShrink: 0,
  },
  cardAsset: { margin: '0 0 11px', fontSize: 12, color: SUB },
  cardGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 },

  scoreRow: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 },
  scoreLabel: { fontSize: 11.5, fontWeight: 700, color: SUB },
  scoreBig: { fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums' },
  scorePct: { fontSize: 11, color: MUTE, fontVariantNumeric: 'tabular-nums' },
  scorePts: { fontSize: 11, color: MUTE, fontVariantNumeric: 'tabular-nums' },
  scoreNone: { fontSize: 11.5, color: '#94a3b8' },
  track: { height: 6, background: '#eef2f7', borderRadius: 999, overflow: 'hidden' },

  startBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px',
    fontSize: 12, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
    background: '#ea7317', color: '#fff', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
  },

  sheet: {
    background: '#fff', borderRadius: 12, marginBottom: 14,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, overflow: 'hidden',
  },
  sheetHead: {
    display: 'flex', alignItems: 'center', gap: 9, padding: '13px 16px',
    borderBottom: `1px solid ${LINE}`,
  },
  sheetTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: INK },
  table: { width: '100%', minWidth: 940, borderCollapse: 'collapse', fontSize: 12 },
  th: {
    padding: '10px 12px', fontSize: 10.5, fontWeight: 700, color: MUTE,
    textTransform: 'uppercase', letterSpacing: 0.4, background: '#f8fafc',
    whiteSpace: 'nowrap', borderBottom: `1px solid ${LINE}`,
  },
  td: {
    padding: '10px 12px', borderTop: '1px solid #f1f5f9', whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  totalTd: { background: '#f8fafc', fontWeight: 800, color: INK, borderTop: `2px solid ${LINE}` },
  overdueChip: {
    display: 'inline-block', padding: '2px 8px', borderRadius: 7, background: '#fef2f2',
    color: '#b91c1c', fontWeight: 800, fontVariantNumeric: 'tabular-nums',
  },

  empty: {
    padding: '44px 22px', textAlign: 'center', borderRadius: 12,
    borderStyle: 'dashed', borderWidth: 1, borderColor: '#dbe2ea', background: '#fcfdfe',
  },
  emptyTitle: { display: 'block', fontSize: 15, fontWeight: 700, color: INK },
  emptyBody: { margin: '7px 0 14px', fontSize: 12.5, color: SUB, lineHeight: 1.55 },
}
