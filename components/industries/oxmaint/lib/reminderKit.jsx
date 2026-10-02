'use client'

// The chrome the Inspection Reminder screen wears in the product.
//
// These pieces were written on the pharmaceutical portal's copy of that screen
// and lived inside the page file, which is where a page exporting a tab strip
// and a pager to the record page beside it comes from. The general portal
// wants the same screen, so they moved out here — one tab strip, one toggle,
// one pager, used by both, rather than two that were identical on the day the
// second was written.
//
// The icon set is its own rather than merged into `productKit`'s: several
// names — check, info, plus — exist in both and are drawn differently, and
// silently replacing one screen's tick with another's is exactly the kind of
// change nobody spots in a diff.

import { PALETTE } from './kit'
import { Glyph } from './productKit'

const { INK, SUB, MUTE, LINE } = PALETTE

export const PAGE_SIZES = [10, 20, 30, 40, 50]

const LOCAL_ICONS = {
  bell: <><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  archive: <><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" /><path d="M10 12h4" /></>,
  restore: <><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" /><path d="M12 18v-6M9 15l3-3 3 3" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
  pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></>,
  dots: <><circle cx="12" cy="5" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="12" cy="19" r="1.4" /></>,
  repeat: <><path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></>,
  chevronL: <path d="m15 18-6-6 6-6" />,
  chevronR: <path d="m9 18 6-6-6-6" />,
  chevronsL: <><path d="m11 17-5-5 5-5" /><path d="m18 17-5-5 5-5" /></>,
  chevronsR: <><path d="m13 17 5-5-5-5" /><path d="m6 17 5-5-5-5" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></>,
  building: <><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01" /></>,
  library: <><path d="M4 4h4v16H4zM10 4h4v16h-4z" /><path d="m16.5 5 3.5 14.5" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8.5 12.2 2.3 2.3 4.7-4.7" /></>,
}

export function LocalIcon({ name, size = 16, color = 'currentColor' }) {
  const path = LOCAL_ICONS[name]
  if (!path) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {path}
    </svg>
  )
}

/** The three-tab strip the product puts above the list. */
export function Tabs({ value, onChange, items }) {
  return (
    <div style={{ ...styles.tabs, gridTemplateColumns: `repeat(${items.length},1fr)` }}>
      {items.map((t) => {
        const on = value === t.key
        return (
          <button key={t.key} onClick={() => onChange(t.key)}
            style={{
              ...styles.tab,
              background: on ? '#fff' : 'transparent',
              color: on ? '#15227a' : SUB,
              boxShadow: on ? '0 1px 2px rgba(15,23,42,.09)' : 'none',
            }}>
            {t.icon === 'archive'
              ? <LocalIcon name="archive" size={14} color={on ? '#15227a' : SUB} />
              : <Glyph name={t.icon} size={14} color={on ? '#15227a' : SUB} />}
            {t.label}
            <span style={styles.tabCount}>{t.count}</span>
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      role="switch"
      aria-checked={checked}
      style={{
        ...styles.toggle,
        background: checked ? '#15227a' : '#cbd5e1',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <span style={{ ...styles.toggleKnob, transform: `translateX(${checked ? 16 : 0}px)` }} />
    </button>
  )
}

export function Check({ checked, onChange, label }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      style={{
        ...styles.check,
        background: checked ? '#15227a' : '#fff',
        borderColor: checked ? '#15227a' : '#cbd5e1',
      }}
    >
      {checked && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4"
          strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 5 5L19 7" /></svg>
      )}
    </button>
  )
}

/**
 * The product's pager: a count, a page size, and numbered pages with ellipses.
 *
 * One-indexed, because that is what the numbered buttons show and an off-by-one
 * between the button a reader presses and the page they get is the kind of bug
 * that survives a demo. `productKit`'s `Pagination` is the simpler zero-indexed
 * one the report lists use; this is the one the reminder screens use.
 */
export function Pager({ page, totalPages, pageSize, total, itemType, onPage, onPageSize }) {
  if (total === 0) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  const pages = []
  const delta = 2
  const range = []
  for (let i = Math.max(2, page - delta); i <= Math.min(totalPages - 1, page + delta); i += 1) range.push(i)
  pages.push(1)
  if (page - delta > 2) pages.push('…')
  pages.push(...range)
  if (page + delta < totalPages - 1) pages.push('…')
  if (totalPages > 1) pages.push(totalPages)

  return (
    <div style={styles.pagination}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 12, color: SUB }}>
        <span>Showing {start} to {end} of {total} {itemType}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          Show
          <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} style={styles.select}>
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          per page
        </span>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <PageBtn onClick={() => onPage(1)} disabled={page === 1}><LocalIcon name="chevronsL" size={13} color={SUB} /></PageBtn>
          <PageBtn onClick={() => onPage(page - 1)} disabled={page === 1}>
            <LocalIcon name="chevronL" size={13} color={SUB} /> Previous
          </PageBtn>
          {pages.map((p, i) => (p === '…'
            ? <span key={`gap-${i}`} style={{ padding: '0 4px', color: MUTE, fontSize: 12 }}>…</span>
            : <PageBtn key={p} onClick={() => onPage(p)} current={p === page}>{p}</PageBtn>))}
          <PageBtn onClick={() => onPage(page + 1)} disabled={page === totalPages}>
            Next <LocalIcon name="chevronR" size={13} color={SUB} />
          </PageBtn>
          <PageBtn onClick={() => onPage(totalPages)} disabled={page === totalPages}><LocalIcon name="chevronsR" size={13} color={SUB} /></PageBtn>
        </div>
      )}
    </div>
  )
}

function PageBtn({ onClick, disabled, current, children }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        ...styles.pageBtn,
        background: current ? '#15227a' : '#fff',
        color: current ? '#fff' : SUB,
        borderColor: current ? '#15227a' : LINE,
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}>
      {children}
    </button>
  )
}

export function ReminderEmpty({ icon, title, body, action }) {
  return (
    <div style={styles.empty}>
      <LocalIcon name={icon === 'archive' ? 'archive' : 'bell'} size={44} color="#cbd5e1" />
      <strong style={{ display: 'block', fontSize: 15, color: SUB, margin: '12px 0 6px' }}>{title}</strong>
      <span style={{ fontSize: 12.5, color: MUTE }}>{body}</span>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}

/** A labelled filter control, as the product's filter row draws them. */
export function FilterField({ icon, label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      <span style={styles.filterLabel}>
        <Glyph name={icon} size={12} color={MUTE} /> {label}
      </span>
      {children}
    </label>
  )
}

export function Fact({ icon, label, value }) {
  return (
    <span style={styles.fact}>
      <Glyph name={icon} size={13} color={MUTE} />
      {label && <span style={{ fontWeight: 700, color: INK }}>{label}:</span>}
      <span style={{ color: SUB, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
    </span>
  )
}

export const styles = {
  settingRow: {
    display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
    padding: '13px 16px', background: '#fff', borderRadius: 11, marginBottom: 16,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  settingLabel: { fontSize: 13, fontWeight: 700, color: INK },
  settingHelp: { margin: '3px 0 0', fontSize: 11.5, color: MUTE, lineHeight: 1.5 },

  tabs: {
    display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, padding: 4,
    background: '#f1f5f9', borderRadius: 11, marginBottom: 16,
  },
  tab: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '10px 12px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
    border: 'none', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap', minWidth: 0,
  },
  tabCount: {
    padding: '1px 7px', borderRadius: 999, background: '#e2e8f0', color: '#475569',
    fontSize: 10.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
  },

  toggle: {
    width: 36, height: 20, borderRadius: 999, border: 'none', padding: 2,
    display: 'inline-flex', alignItems: 'center', flexShrink: 0, transition: 'background .15s',
  },
  toggleKnob: {
    width: 16, height: 16, borderRadius: 999, background: '#fff', display: 'block',
    transition: 'transform .15s', boxShadow: '0 1px 2px rgba(15,23,42,.3)',
  },
  check: {
    width: 18, height: 18, borderRadius: 5, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
    borderStyle: 'solid', borderWidth: 1, padding: 0,
  },

  pagination: {
    display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 18,
  },
  pageBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px',
    fontSize: 12, fontWeight: 700, fontFamily: 'inherit', borderRadius: 8,
    borderStyle: 'solid', borderWidth: 1, minWidth: 32, justifyContent: 'center',
  },
  select: {
    padding: '7px 10px', fontSize: 12.5, fontWeight: 600, color: INK, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, borderRadius: 9,
    fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
  },

  filterRow: {
    display: 'grid', gap: 12, marginBottom: 16, padding: 15,
    gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
    background: '#fff', borderRadius: 11,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  filterLabel: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  fact: { display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, fontSize: 12 },

  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  empty: {
    padding: '46px 20px', textAlign: 'center', borderRadius: 11,
    borderStyle: 'dashed', borderWidth: 1, borderColor: '#dbe2ea', background: '#fcfdfe',
  },
}
