'use client'

// The grammar Oxmaint's Asset and Inspection modules are written in.
//
// Those two modules do not use a table. They use a stack of full-width record
// cards, or a three-across grid of the same record as a card, with a toggle
// between the two; a summary row whose cards are themselves the filters; a
// filters panel that opens under a full-width search box; and a pagination bar
// that says "Showing 1 to 12 of 48" with a page-size picker. A DataTable in
// their place reads as a different product, which is the one thing this portal
// must not do.
//
// Built here rather than borrowed from the kit because the kit's Toolbar and
// DataTable are the other shape — the one the register screens want, and which
// is right for the register screens. The rest of this portal keeps them.
//
// Tailwind classes translated to the values they resolve to: slate-100 is
// #f1f5f9, slate-200/80 is #e2e8f0 at 80%, shadow-sm and shadow-lg are the
// framework's own two shadows. The product's primary is the same #15227a this
// portal already uses.

import { useEffect, useMemo, useState } from 'react'

const INK = '#0f172a'
const SUB = '#475569'
const MUTE = '#94a3b8'
const LINE = '#e2e8f0'
const ACCENT = '#15227a'

// ── the pill toggle ──────────────────────────────────────────────────────
export function ViewToggle({ value, onChange, options }) {
  return (
    <div style={styles.toggle}>
      {options.map((o) => {
        const on = o.key === value
        return (
          <button key={o.key} onClick={() => onChange(o.key)} title={o.label}
            style={{ ...styles.toggleBtn, ...(on ? styles.toggleOn : null) }}>
            {o.icon}
            <span style={{ display: o.iconOnly ? 'none' : 'inline' }}>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── the heading over the list ────────────────────────────────────────────
export function CountHeading({ icon, label, count, right }) {
  return (
    <div style={styles.countRow}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        {icon && <span style={{ color: SUB, display: 'flex', flexShrink: 0 }}>{icon}</span>}
        <h2 style={styles.countTitle}>{label} ({count})</h2>
      </div>
      {right && <div style={styles.countRight}>{right}</div>}
    </div>
  )
}

// ── search + filters ─────────────────────────────────────────────────────
//
// The search box is its own full-width row under the controls, which is how the
// product lays it out — the filters live behind a button rather than eating the
// row, because most of the time nobody is filtering.
export function SearchBar({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={MUTE} strokeWidth="2.2" strokeLinecap="round"
        style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
      </svg>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={styles.search} />
      {value && (
        <button onClick={() => onChange('')} title="Clear search" style={styles.searchClear}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={MUTE} strokeWidth="2.8" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  )
}

export function FilterButton({ open, onToggle, count }) {
  return (
    <button onClick={onToggle} style={{ ...styles.ghostBtn, ...(open ? styles.ghostBtnOn : null) }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M4 6h16M7 12h10M10 18h4" />
      </svg>
      Filters
      {count > 0 && <span style={styles.filterCount}>{count}</span>}
    </button>
  )
}

export function FilterPanel({ open, children, onClear, count }) {
  if (!open) return null
  return (
    <div style={styles.panel}>
      <div style={styles.panelGrid}>{children}</div>
      {count > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={onClear} style={styles.clearAll}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            Clear all filters
          </button>
        </div>
      )}
    </div>
  )
}

export function FilterSelect({ label, value, onChange, options, allLabel = 'All' }) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={styles.fieldLabel}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={styles.select}>
        <option value="all">{allLabel}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

/** The chips that say what is currently filtering, each one its own undo. */
export function ActiveFilters({ items = [], onClear }) {
  if (!items.length) return null
  return (
    <div style={styles.chips}>
      <span style={{ fontSize: 12, color: SUB }}>Active filters:</span>
      {items.map((f) => (
        <button key={f.field} onClick={() => onClear(f.field)} style={styles.chip}>
          {f.label}: {f.value}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      ))}
    </div>
  )
}

// ── the record card ──────────────────────────────────────────────────────
export function RecordCard({ onClick, children, style, dim }) {
  return (
    <div
      className="dc-rec"
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick() } }}
      style={{
        ...styles.rec,
        cursor: onClick ? 'pointer' : 'default',
        opacity: dim ? 0.55 : 1,
        filter: dim ? 'grayscale(1)' : 'none',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** The hover lift and the shared card animation, injected once per screen. */
export function ProductStyles() {
  return (
    <style>{`
      .dc-rec { transition: box-shadow .25s ease, transform .25s cubic-bezier(.22,1,.36,1), border-color .25s ease; }
      .dc-rec[role="button"]:hover { box-shadow: 0 10px 24px rgba(15,23,42,0.10); border-color: #cbd5e1; transform: translateY(-1px); }
      .dc-rec[role="button"]:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 2px; }
      .dc-kv { display: flex; justify-content: space-between; gap: 12px; font-size: 12.5px; }
    `}</style>
  )
}

/** A label/value line inside a card's detail column. */
export function KV({ label, value, tone }) {
  return (
    <div className="dc-kv">
      <span style={{ color: tone || MUTE }}>{label}</span>
      <span style={{ color: tone || '#334155', fontWeight: 600, textAlign: 'right', minWidth: 0 }}>{value}</span>
    </div>
  )
}

/** The three-column detail block the product puts under a record's header. */
export function DetailColumns({ children }) {
  return <div style={styles.details}>{children}</div>
}

export function DetailColumn({ icon, title, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <h4 style={styles.detailTitle}>
        {icon && <span style={{ display: 'flex', color: SUB }}>{icon}</span>}
        {title}
      </h4>
      <div style={{ display: 'grid', gap: 7 }}>{children}</div>
    </div>
  )
}

// ── pagination ───────────────────────────────────────────────────────────
export function Pagination({ page, pageSize, total, onPage, onPageSize, itemType = 'records' }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div style={styles.pager}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, color: SUB }}>
          Showing <strong style={{ color: INK }}>{from}</strong> to <strong style={{ color: INK }}>{to}</strong> of{' '}
          <strong style={{ color: INK }}>{total}</strong> {itemType}
        </span>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 12.5, color: SUB }}>Show</span>
          <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} style={{ ...styles.select, width: 'auto', height: 32, padding: '0 8px' }}>
            {[6, 12, 24, 48].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Disabled state set inline: these are inline styles, so `:disabled`
            has nowhere to live, and a Previous button that looks live on page 1
            is a click that does nothing. */}
        <button onClick={() => onPage(page - 1)} disabled={page <= 1} style={pageBtn(page <= 1)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          Previous
        </button>
        <span style={{ fontSize: 12.5, color: SUB, padding: '0 6px', fontVariantNumeric: 'tabular-nums' }}>
          Page {Math.min(page, pages)} of {pages}
        </span>
        <button onClick={() => onPage(page + 1)} disabled={page >= pages} style={pageBtn(page >= pages)}>
          Next
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>
    </div>
  )
}

const pageBtn = (off) => ({
  ...styles.pageBtn,
  opacity: off ? 0.45 : 1,
  cursor: off ? 'default' : 'pointer',
})

export function EmptyState({ icon, title, body }) {
  return (
    <div style={styles.empty}>
      <div style={{ color: '#cbd5e1', display: 'flex', justifyContent: 'center', marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>{title}</div>
      {body && <p style={{ margin: '7px auto 0', fontSize: 12.5, color: MUTE, maxWidth: 420, lineHeight: 1.6 }}>{body}</p>}
    </div>
  )
}

/**
 * Search, filter and paginate a list, the way all four of these screens do it.
 *
 * Written once because they differ only in their fields. Reset-to-page-one on
 * every change is the detail worth having in one place: a filter that narrows
 * 48 records to 3 while the reader is on page 4 shows an empty list, and the
 * reader concludes the filter found nothing.
 */
export function useListControls(rows, { search = [], filters = [], initialPageSize = 12 } = {}) {
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [panel, setPanel] = useState(false)

  const options = useMemo(() => {
    const o = {}
    for (const f of filters) {
      o[f.field] = [...new Set(rows.map((r) => r[f.field]).filter(Boolean))].map(String).sort()
    }
    return o
  }, [rows, filters])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      for (const f of filters) {
        const v = picked[f.field]
        if (v && v !== 'all' && String(r[f.field]) !== v) return false
      }
      if (!q) return true
      return search.some((k) => String(r[k] ?? '').toLowerCase().includes(q))
    })
  }, [rows, query, picked, filters, search])

  useEffect(() => { setPage(1) }, [query, picked, pageSize, rows])

  const active = filters
    .filter((f) => picked[f.field] && picked[f.field] !== 'all')
    .map((f) => ({ field: f.field, label: f.label, value: picked[f.field] }))

  return {
    query, setQuery,
    picked,
    set: (field, value) => setPicked((p) => ({ ...p, [field]: value })),
    clear: (field) => setPicked((p) => ({ ...p, [field]: 'all' })),
    clearAll: () => { setPicked({}); setQuery('') },
    options,
    shown,
    active,
    panel, setPanel,
    page, setPage, pageSize, setPageSize,
    slice: shown.slice((page - 1) * pageSize, page * pageSize),
  }
}

// ── icons the two modules use ────────────────────────────────────────────
const ico = (d, extra) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...extra}>{d}</svg>
)
export const Icons = {
  list: ico(<><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></>),
  grid: ico(<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>),
  box: ico(<><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /></>),
  pin: ico(<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>),
  gear: ico(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>),
  clipboard: ico(<><path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></>),
  bell: ico(<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>),
  warning: ico(<><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>),
  calendar: ico(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>),
  user: ico(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
  check: ico(<><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.5 2.5 4.5-5" /></>),
  cross: ico(<><circle cx="12" cy="12" r="9" /><path d="m15 9-6 6M9 9l6 6" /></>),
  activity: ico(<><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></>),
  file: ico(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>),
  clock: ico(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  qr: ico(<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM18 18h3v3h-3z" /></>),
  trend: ico(<><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>),
  trendDown: ico(<><polyline points="22 17 13.5 8.5 8.5 13.5 2 7" /><polyline points="16 17 22 17 22 11" /></>),
}

const styles = {
  toggle: { display: 'inline-flex', alignItems: 'center', gap: 3, background: '#f1f5f9', borderRadius: 10, padding: 3 },
  toggleBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    height: 30, padding: '0 11px', borderRadius: 7, border: '1px solid transparent',
    background: 'transparent', color: SUB, fontSize: 12.5, fontWeight: 600,
    fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  toggleOn: { background: ACCENT, color: '#fff', boxShadow: '0 1px 2px rgba(15,23,42,0.12)' },

  countRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 },
  countTitle: { margin: 0, fontSize: 18, fontWeight: 700, color: INK, letterSpacing: '-0.01em' },
  countRight: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },

  search: {
    width: '100%', height: 40, padding: '0 34px 0 34px',
    fontSize: 13, fontFamily: 'inherit', color: INK,
    border: `1px solid ${LINE}`, borderRadius: 10, background: '#fff', outline: 'none',
  },
  searchClear: {
    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
    width: 20, height: 20, borderRadius: 5, border: 'none', background: '#f1f5f9',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
  },

  ghostBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    height: 34, padding: '0 13px', borderRadius: 9,
    border: `1px solid ${LINE}`, background: '#fff', color: INK,
    fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  ghostBtnOn: { borderColor: ACCENT, color: ACCENT, background: '#eef2ff' },
  filterCount: {
    minWidth: 18, height: 18, borderRadius: 999, background: ACCENT, color: '#fff',
    fontSize: 10.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
  },

  panel: { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: 14, marginBottom: 14 },
  panelGrid: { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' },
  fieldLabel: { display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 5 },
  select: {
    width: '100%', height: 36, padding: '0 9px', fontSize: 12.5, fontFamily: 'inherit',
    fontWeight: 600, color: INK, border: `1px solid ${LINE}`, borderRadius: 9,
    background: '#fff', outline: 'none', cursor: 'pointer',
  },
  clearAll: {
    display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 11px',
    borderRadius: 8, border: '1px solid #fecaca', background: '#fff', color: '#dc2626',
    fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
  },

  chips: { display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 12 },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px',
    borderRadius: 999, border: `1px solid ${ACCENT}22`, background: '#eef2ff', color: ACCENT,
    fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
  },

  rec: {
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14,
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)', overflow: 'hidden',
  },
  details: { display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))' },
  detailTitle: {
    margin: '0 0 9px', fontSize: 12, fontWeight: 700, color: '#334155',
    display: 'flex', alignItems: 'center', gap: 7,
  },

  pager: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 14, flexWrap: 'wrap', marginTop: 16,
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: '11px 14px',
  },
  pageBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 5, height: 32, padding: '0 11px',
    borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: INK,
    fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
  },

  empty: {
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14,
    padding: '48px 20px', textAlign: 'center',
  },
}
