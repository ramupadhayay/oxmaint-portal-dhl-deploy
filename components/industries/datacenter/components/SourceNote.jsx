'use client'

// Which of these rows came from the client, and which came from us.
//
// The monitoring screens read two datasets. Digital Realty's own workbook
// carries three monitored assets; a portal review found that thin against
// forty-six in scope, so a gap-fill workbook produced internally adds ten more,
// their readings, detections and recommendations.
//
// Both are on the same screen and there is no visual difference between them,
// which is exactly the problem. A PoC's credibility rests on a client being
// able to check any figure against their own file — and a reader who cannot
// tell which rows that applies to has to treat all of them as unverifiable.
//
// So the split is stated once per screen, in a line, with the counts. Not a
// disclaimer: a disclaimer says "some of this may be wrong". This says which
// rows are which, and both kinds are fine once you know.

import { PALETTE } from '../lib/kit'

const { INK, SUB, MUTE, LINE } = PALETTE

/**
 * @param client  how many rows on this screen came from the client's workbook
 * @param added   how many came from the internal gap-fill workbook
 * @param what    the noun — "assets", "detections", "recommendations"
 * @param extra   one more sentence where the screen has something to add
 */
export default function SourceNote({ client, added, what = 'rows', extra }) {
  if (!added) return null

  return (
    <div style={styles.wrap}>
      <span style={styles.swatchClient} />
      <span style={styles.text}>
        <strong style={{ color: INK }}>{client}</strong> {what} from the client&rsquo;s own records
      </span>

      <span style={styles.plus}>+</span>

      <span style={styles.swatchAdded} />
      <span style={styles.text}>
        <strong style={{ color: '#6d28d9' }}>{added}</strong> added internally to close a volume gap
        <span style={styles.badgeInline}>added</span>
      </span>

      {extra && <span style={styles.extra}>{extra}</span>}
    </div>
  )
}

/**
 * The mark on a single row.
 *
 * Deliberately quiet. It has to be findable when somebody asks the question and
 * ignorable when nobody is — a row shouting about its own provenance every time
 * the table is read is worse than one that never mentions it.
 */
export function AddedBadge({ on }) {
  if (!on) return null
  return <span style={styles.badge} title="Added to close a volume gap, not from the client's own records">added</span>
}

const styles = {
  wrap: {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    padding: '8px 12px', marginBottom: 14, borderRadius: 9, background: '#fcfdfe',
    fontSize: 11.5, color: SUB, lineHeight: 1.5,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  swatchClient: { width: 8, height: 8, borderRadius: 2, background: '#15227a', flexShrink: 0 },
  swatchAdded: { width: 8, height: 8, borderRadius: 2, background: '#7c3aed', flexShrink: 0 },
  text: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  plus: { color: MUTE, fontWeight: 700 },
  extra: {
    marginLeft: 'auto', fontSize: 11, color: MUTE,
  },
  badge: {
    display: 'inline-block', marginLeft: 6, padding: '0 6px', borderRadius: 999,
    fontSize: 9, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
    color: '#6d28d9', background: '#f5f3ff', verticalAlign: 'middle',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#ddd6fe',
  },
  badgeInline: {
    display: 'inline-block', padding: '0 6px', borderRadius: 999,
    fontSize: 9, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
    color: '#6d28d9', background: '#f5f3ff',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#ddd6fe',
  },
}
