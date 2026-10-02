'use client'

// The heading every screen in this portal wears, matched to the product's.
//
// The kit's PageHeader was built for a different console: a 44px icon tile, a
// 22px title and a 13px subtitle in pale grey. Oxmaint's own screens do not
// look like that — they open with a 30px bold title, a description under it in
// slate-600, and the screen's actions on the right. No icon tile at all.
//
// The difference reads as two different products sitting behind one sign-in,
// which is exactly what this portal must not look like, so the heading is
// rebuilt here rather than borrowed.
//
// One deviation, deliberate: the description is held to a readable measure.
// The product's descriptions are four or five words; these carry a sentence of
// SOW context, and a sentence set the full width of a 1600px screen is a line
// nobody finishes.

const INK = '#0f172a'
const SUB = '#475569'
const LINE = '#e4e9f0'
const ACCENT = '#15227a'

/**
 * @param title    the screen's name
 * @param subtitle one line saying what it is
 * @param right    the screen's actions
 * @param back     { label, onClick } — shown above the title on record pages,
 *                 where the way back is part of the heading rather than a
 *                 control floating above it
 */
export default function PageHeading({ title, subtitle, right, back, children, wide }) {
  return (
    <div style={{ marginBottom: 24 }}>
      {back && (
        <button onClick={back.onClick} style={styles.back}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          {back.label}
        </button>
      )}

      <div style={styles.row}>
        <div style={{ minWidth: 0 }}>
          <h1 style={styles.title}>{title}</h1>
          {/* `wide` drops the readable-measure cap for a subtitle that reads
              better across the row than stacked into three short lines. */}
          {subtitle && <p style={wide ? { ...styles.subtitle, maxWidth: 'none' } : styles.subtitle}>{subtitle}</p>}
          {children}
        </div>
        {right && <div style={styles.actions}>{right}</div>}
      </div>
    </div>
  )
}

const styles = {
  row: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: 16, flexWrap: 'wrap',
  },
  title: {
    margin: 0, fontSize: 30, fontWeight: 700, color: INK,
    letterSpacing: '-0.02em', lineHeight: 1.15,
  },
  subtitle: {
    // No readable-measure cap: a capped subtitle wrapped to three short lines
    // with empty space beside it, which read worse than the full-width line it
    // is now. `wide` stays a harmless no-op on the pages that pass it.
    margin: '6px 0 0', fontSize: 14.5, color: SUB, lineHeight: 1.55,
  },
  actions: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  back: {
    display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12,
    padding: '5px 10px 5px 7px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8,
    color: ACCENT, cursor: 'pointer',
  },
}
