'use client'

// The stat card Oxmaint's own dashboard uses, rebuilt.
//
// Taken from the product's MetricCard rather than invented: a white card with a
// variant-coloured border, a tinted icon chip, the title in grey above a bold
// value, and a trend line reading "↗ 4.1% vs last month". Same proportions,
// same colour meanings, same lift on hover.
//
// What it replaced was the kit's StatStrip — a flat row of small numbers with
// no icon, no trend and no colour. Side by side with the real dashboard it read
// as a different, plainer product, which is the thing this portal must not do.
//
// Trend is optional and stays optional. Several figures here are counts of a
// fixed workbook with no previous month to compare against, and a made-up
// "+5.2% vs last month" under a number that has never moved is the kind of
// detail that destroys trust in every other number on the screen.

const VARIANTS = {
  default: { border: '#e2e8f0', chipBg: '#eef2ff', chipBorder: '#c7d2fe', chip: '#15227a', hover: '#c3cbe6' },
  success: { border: '#bbf7d0', chipBg: '#f0fdf4', chipBorder: '#bbf7d0', chip: '#16a34a', hover: '#86efac' },
  warning: { border: '#fed7aa', chipBg: '#fff7ed', chipBorder: '#fed7aa', chip: '#ea580c', hover: '#fdba74' },
  destructive: { border: '#fecaca', chipBg: '#fef2f2', chipBorder: '#fecaca', chip: '#dc2626', hover: '#fca5a5' },
}

export default function MetricCard({
  title, value, unit, change, note, icon, variant = 'default', onClick,
}) {
  const v = VARIANTS[variant] || VARIANTS.default
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      onClick={onClick}
      className="wg-metric"
      style={{
        ...styles.card,
        borderColor: v.border,
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: 'inherit',
        textAlign: 'left',
        width: '100%',
      }}
    >
      {/* Icon beside the label rather than stacked above it. Stacked, with a
          minimum height holding the value to the bottom, each card carried a
          band of empty space and the row only fitted four — so a fifth stat
          dropped onto a line of its own. Five of these fit across. */}
      <div style={styles.head}>
        {icon && (
          <span style={{ ...styles.chip, background: v.chipBg, borderColor: v.chipBorder, color: v.chip }}>
            {icon}
          </span>
        )}
        <p style={styles.title}>{title}</p>
      </div>

      <div style={styles.body}>
        <p style={styles.value}>
          {value}
          {unit && <span style={styles.unit}> {unit}</span>}
        </p>

        {/* Not rendered at all when there is nothing to say. Reserving the row
            for a trend most of these stats do not have left a band of empty
            card under every value. The grid stretches its rows, so cards still
            line up without one of them holding space open. */}
        {(change || note) && (
          <div style={styles.foot}>
            {change ? (
              <>
                <span style={{ ...styles.change, color: change.value >= 0 ? '#16a34a' : '#dc2626' }}>
                  <Arrow up={change.value >= 0} />
                  {Math.abs(change.value)}%
                </span>
                <span style={styles.changeLabel}>{change.label}</span>
              </>
            ) : (
              <span style={styles.changeLabel}>{note}</span>
            )}
          </div>
        )}
      </div>
    </Tag>
  )
}

function Arrow({ up }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      {up
        ? <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>
        : <><polyline points="22 17 13.5 8.5 8.5 13.5 2 7" /><polyline points="16 17 22 17 22 11" /></>}
    </svg>
  )
}

// ── glyphs ───────────────────────────────────────────────────────────────
//
// A card with an empty space where the icon goes looks unfinished, and the
// register screens hand over stats as plain label/value pairs with no icon in
// them. Rather than make twenty screens each name one, the label picks it:
// these are counts of a small, known vocabulary — assets, alerts, work orders,
// readings — and a wrench over "Work orders" is right every time it matches.
// Anything unmatched falls back to a neutral chart glyph rather than guessing.
const GLYPHS = {
  asset: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /></>,
  alert: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
  wrench: <><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></>,
  tick: <><path d="m9 11 3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  site: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
  wave: <><path d="M3 12h4l2-6 4 12 2-6h6" /></>,
  people: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></>,
  chart: <><path d="M3 3v18h18" /><path d="m7 14 3-4 4 3 5-7" /></>,
}

export function iconForLabel(label = '') {
  const s = String(label).toLowerCase()
  if (/alert|anomal|alarm/.test(s)) return 'alert'
  if (/work order|\bwo\b|condition-trig|dispatch/.test(s)) return 'wrench'
  if (/asset|class|register|scope/.test(s)) return 'asset'
  if (/complete|on time|confirm|closed|true positive|ready/.test(s)) return 'tick'
  if (/open|progress|pending|late|overdue|still/.test(s)) return 'clock'
  if (/site|region|location/.test(s)) return 'site'
  if (/reading|sensor|telemetr|correlat/.test(s)) return 'wave'
  if (/owner|stakeholder|team|people|member/.test(s)) return 'people'
  if (/item|task|log|entr|report|checklist/.test(s)) return 'list'
  return 'chart'
}

export function Glyph({ name, size = 19 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {GLYPHS[name] || GLYPHS.chart}
    </svg>
  )
}

// The kit's StatStrip item shape — { label, value, tone, note, unit } — on the
// product's card. One wrapper rather than rewriting twenty call sites, and the
// register screens keep describing their stats the way they always did.
const TONE_TO_VARIANT = { green: 'success', amber: 'warning', red: 'destructive' }

export function StatCards({ items = [], onCardClick }) {
  return (
    <MetricGrid>
      {items.filter(Boolean).map((s) => (
        <MetricCard
          key={s.label}
          title={s.label}
          value={s.value}
          unit={s.unit}
          note={s.note}
          icon={<Glyph name={s.icon || iconForLabel(s.label)} />}
          variant={TONE_TO_VARIANT[s.tone] || 'default'}
          onClick={s.to && onCardClick ? () => onCardClick(s.to) : undefined}
        />
      ))}
    </MetricGrid>
  )
}

/** The grid the product puts these in. */
export function MetricGrid({ children }) {
  return (
    <>
      <style>{`
        .wg-metric { transition: transform .25s cubic-bezier(.22,1,.36,1), box-shadow .25s ease, border-color .25s ease; }
        .wg-metric:hover { transform: translateY(-4px); box-shadow: 0 12px 28px rgba(15,23,42,0.10); }
      `}</style>
      <div style={styles.grid}>{children}</div>
    </>
  )
}

const styles = {
  // auto-fit, not auto-fill. auto-fill keeps making tracks whether or not
  // anything goes in them, so four cards in a row with space for six stayed
  // narrow and left a gap on the right. auto-fit drops the empty tracks and the
  // cards take the width between them, so a row of four and a row of five both
  // reach the same edge.
  //
  // 186px minimum: five fit across the content area at a normal window, which
  // is the most stats these screens produce.
  grid: {
    display: 'grid', gap: 12, marginBottom: 18,
    gridTemplateColumns: 'repeat(auto-fit, minmax(186px, 1fr))',
  },
  card: {
    display: 'flex', flexDirection: 'column',
    padding: '13px 14px', background: '#fff',
    border: '1px solid', borderRadius: 12,
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
  },
  head: { display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 },
  chip: {
    width: 30, height: 30, borderRadius: 9, border: '1px solid',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  title: {
    margin: 0, fontSize: 11.5, fontWeight: 600, color: '#475569', lineHeight: 1.3,
    minWidth: 0, letterSpacing: '0.005em',
  },
  body: { marginTop: 9 },
  value: { margin: 0, fontSize: 24, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.05 },
  unit: { fontSize: 12.5, fontWeight: 600, color: '#64748b', letterSpacing: 0 },
  foot: { display: 'flex', alignItems: 'center', gap: 7, marginTop: 5, flexWrap: 'wrap' },
  change: { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12.5, fontWeight: 700 },
  changeLabel: { fontSize: 10.5, color: '#64748b', lineHeight: 1.35 },
}
