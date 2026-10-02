'use client'

// UI kit for the Oxmaint CMMS portal.
//
// The shared iFactory kit already carries the primitives every portal needs, so
// they are re-exported rather than rewritten. What is added here is what a CMMS
// is actually made of and the other portals have no use for: a sortable,
// searchable, paginated table, a filter bar, a KPI strip, status badges that
// know maintenance vocabulary, and three small charts.
//
// This is where the leverage is. Nearly every screen in this product is
// "header, filters, KPI strip, table, detail drawer" — so those five pieces
// carry the whole portal, and each page stays short enough to read.

import { useState, useMemo } from 'react'

export * from '../../autonomous-inspection/lib/kit'
import { Card, PALETTE } from '../../autonomous-inspection/lib/kit'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, AMBER, RED, BLUE } = PALETTE

// ── status vocabulary ────────────────────────────────────────────────────
// One table, because the same words appear on eight screens and they must mean
// the same colour on all of them. A status the table has never seen falls back
// to neutral rather than throwing or picking at random.
const TONE = {
  green: { fg: '#047857', bg: '#ecfdf5', bd: '#a7f3d0' },
  amber: { fg: '#b45309', bg: '#fffbeb', bd: '#fde68a' },
  red: { fg: '#b91c1c', bg: '#fef2f2', bd: '#fecaca' },
  blue: { fg: '#1d4ed8', bg: '#eff6ff', bd: '#bfdbfe' },
  grey: { fg: '#475569', bg: '#f8fafc', bd: '#e2e8f0' },
  violet: { fg: '#6d28d9', bg: '#f5f3ff', bd: '#ddd6fe' },
}

const STATUS_TONE = {
  // healthy / done
  Operational: 'green', Completed: 'green', Active: 'green', Pass: 'green',
  'In Stock': 'green', Approved: 'green', Received: 'green', Closed: 'green',
  Connected: 'green', 'Work Order Raised': 'green',
  // in flight
  'In Progress': 'blue', Scheduled: 'blue', 'In Review': 'blue', Sourcing: 'blue',
  Ordered: 'blue', Planned: 'blue', Requested: 'blue',
  // attention
  'Under Maintenance': 'amber', 'On Hold': 'amber', Open: 'amber',
  'Low Stock': 'amber', Pending: 'amber', 'Pending Approval': 'amber',
  'Pass with observations': 'amber', Paused: 'amber', Draft: 'grey',
  High: 'amber', Medium: 'blue',
  // trouble
  Down: 'red', Fail: 'red', 'Out of Stock': 'red', Overdue: 'red',
  Denied: 'red', Critical: 'red', Cancelled: 'grey',
  'Not connected': 'grey', Low: 'grey', Template: 'violet',
}

export function StatusBadge({ children, tone }) {
  const t = TONE[tone || STATUS_TONE[children]] || TONE.grey
  return (
    <span style={{
      display: 'inline-block', padding: '2.5px 8px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
      color: t.fg, background: t.bg, border: `1px solid ${t.bd}`,
    }}>{children}</span>
  )
}

export function Priority({ value }) {
  const tone = { Critical: 'red', High: 'amber', Medium: 'blue', Low: 'grey' }[value] || 'grey'
  const t = TONE[tone]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: t.fg }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.fg }} />{value}
    </span>
  )
}

// ── KPI strip ────────────────────────────────────────────────────────────
export function StatStrip({ items = [] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(168px,1fr))', gap: 12, marginBottom: 16 }}>
      {items.map((s) => (
        <div key={s.label} style={{
          background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: '13px 15px',
          boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 5 }}>
            <span style={{ fontSize: 25, fontWeight: 800, color: s.tone ? TONE[s.tone].fg : INK, lineHeight: 1 }}>{s.value}</span>
            {s.unit && <span style={{ fontSize: 12, color: SUB, fontWeight: 600 }}>{s.unit}</span>}
          </div>
          {s.note && <div style={{ fontSize: 11, color: MUTE, marginTop: 4 }}>{s.note}</div>}
        </div>
      ))}
    </div>
  )
}

// ── filter bar ───────────────────────────────────────────────────────────
export function Toolbar({ search, onSearch, placeholder = 'Search…', filters = [], right }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
      <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180, maxWidth: 340 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTE} strokeWidth="2" strokeLinecap="round"
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 30px', fontSize: 12.5,
            border: `1px solid ${LINE}`, borderRadius: 9, outline: 'none', fontFamily: 'inherit', color: INK, background: '#fff',
          }} />
      </div>
      {filters.map((f) => (
        <select key={f.label} value={f.value} onChange={(e) => f.onChange(e.target.value)}
          style={{
            padding: '8px 10px', fontSize: 12.5, border: `1px solid ${LINE}`, borderRadius: 9,
            background: '#fff', color: f.value === 'all' ? SUB : ACCENT, fontWeight: f.value === 'all' ? 500 : 700,
            fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
          }}>
          <option value="all">{f.label}: All</option>
          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ))}
      {right && <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>{right}</div>}
    </div>
  )
}

// ── the table ────────────────────────────────────────────────────────────
//
// Sorting, paging and the empty state live here rather than in each page. The
// empty state is not decoration: a filter that matches nothing and a dataset
// that is genuinely empty look identical otherwise, and on a demo that reads as
// a broken screen.
export function DataTable({ columns, rows, onRowClick, pageSize = 12, empty = 'Nothing matches these filters.' }) {
  const [sort, setSort] = useState({ key: null, dir: 1 })
  const [page, setPage] = useState(0)

  const sorted = useMemo(() => {
    if (!sort.key) return rows
    const col = columns.find((c) => c.key === sort.key)
    const val = (r) => (col?.sortValue ? col.sortValue(r) : r[sort.key])
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b)
      if (x == null) return 1
      if (y == null) return -1
      return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir
    })
  }, [rows, sort, columns])

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, pages - 1)
  const slice = sorted.slice(current * pageSize, current * pageSize + pageSize)

  const toggle = (key) => {
    setSort((p) => (p.key === key ? { key, dir: -p.dir } : { key, dir: 1 }))
    setPage(0)
  }

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {columns.map((c) => (
                <th key={c.key} onClick={() => c.sortable !== false && toggle(c.key)}
                  style={{
                    textAlign: c.align || 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700,
                    color: sort.key === c.key ? ACCENT : SUB, textTransform: 'uppercase', letterSpacing: 0.4,
                    borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap',
                    cursor: c.sortable === false ? 'default' : 'pointer', userSelect: 'none',
                  }}>
                  {c.label}
                  {sort.key === c.key && <span style={{ marginLeft: 4 }}>{sort.dir === 1 ? '▲' : '▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={r.id || i}
                onClick={() => onRowClick?.(r)}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                style={{ borderBottom: `1px solid ${LINE}`, cursor: onRowClick ? 'pointer' : 'default', transition: 'background .1s' }}>
                {columns.map((c) => (
                  <td key={c.key} style={{ padding: '10px 14px', textAlign: c.align || 'left', color: INK, verticalAlign: 'middle' }}>
                    {c.render ? c.render(r) : (r[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
            {!slice.length && (
              <tr><td colSpan={columns.length} style={{ padding: '34px 14px', textAlign: 'center', color: MUTE, fontSize: 12.5 }}>{empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {sorted.length > pageSize && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderTop: `1px solid ${LINE}`, background: '#fcfdfe' }}>
          <span style={{ fontSize: 11.5, color: SUB }}>
            {current * pageSize + 1}–{Math.min(sorted.length, (current + 1) * pageSize)} of {sorted.length}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <PageBtn disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</PageBtn>
            <PageBtn disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</PageBtn>
          </div>
        </div>
      )}
    </Card>
  )
}

function PageBtn({ disabled, onClick, children }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        padding: '5px 11px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
        border: `1px solid ${LINE}`, borderRadius: 7, background: '#fff',
        color: disabled ? '#cbd5e1' : ACCENT, cursor: disabled ? 'default' : 'pointer',
      }}>{children}</button>
  )
}

// ── charts ───────────────────────────────────────────────────────────────
const CHART_COLORS = [ACCENT, BLUE, GREEN, AMBER, RED, '#7c3aed', '#0891b2', '#db2777']

export function Donut({ data = [], size = 168, thickness = 26, colors = CHART_COLORS }) {
  const total = data.reduce((n, d) => n + d.value, 0) || 1
  const r = (size - thickness) / 2
  const circ = 2 * Math.PI * r
  let offset = 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        <g transform={`translate(${size / 2},${size / 2}) rotate(-90)`}>
          {data.map((d, i) => {
            const len = (d.value / total) * circ
            const el = (
              <circle key={d.name} r={r} fill="none" stroke={colors[i % colors.length]} strokeWidth={thickness}
                strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-offset} />
            )
            offset += len
            return el
          })}
        </g>
        <text x="50%" y="50%" textAnchor="middle" dy="0.05em" style={{ fontSize: 26, fontWeight: 800, fill: INK }}>{total}</text>
        <text x="50%" y="50%" textAnchor="middle" dy="1.5em" style={{ fontSize: 10.5, fill: MUTE }}>total</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 130 }}>
        {data.map((d, i) => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: colors[i % colors.length], flexShrink: 0 }} />
            <span style={{ color: SUB, flex: 1 }}>{d.name}</span>
            <span style={{ fontWeight: 700, color: INK }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function BarPairs({ data = [], keys = [], labels = [], colors = [ACCENT, GREEN], height = 190, unit = '' }) {
  const max = Math.max(1, ...data.flatMap((d) => keys.map((k) => d[k])))
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
        {keys.map((k, i) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: SUB }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: colors[i] }} />{labels[i] || k}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height, borderBottom: `1px solid ${LINE}`, paddingBottom: 2 }}>
        {data.map((d) => (
          <div key={d.month || d.name} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: height - 20, width: '100%', justifyContent: 'center' }} title={keys.map((k, i) => `${labels[i] || k}: ${d[k]}${unit}`).join(' · ')}>
              {keys.map((k, i) => (
                <div key={k} style={{
                  width: `${Math.min(18, 70 / keys.length)}px`, background: colors[i], borderRadius: '3px 3px 0 0',
                  height: `${Math.max(2, (d[k] / max) * 100)}%`, transition: 'height .3s',
                }} />
              ))}
            </div>
            <span style={{ fontSize: 9.5, color: MUTE, whiteSpace: 'nowrap' }}>{d.month || d.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function HBars({ data = [], color = ACCENT, unit = '' }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {data.map((d) => (
        <div key={d.name}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
            <span style={{ color: SUB }}>{d.name}</span>
            <span style={{ fontWeight: 700, color: INK }}>{d.value}{unit}</span>
          </div>
          <div style={{ height: 7, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${(d.value / max) * 100}%`, height: '100%', background: d.color || color, borderRadius: 999, transition: 'width .3s' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── detail panel rows ────────────────────────────────────────────────────
export function Fields({ rows = [], columns = 2 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns},minmax(0,1fr))`, gap: '13px 20px' }}>
      {rows.filter(Boolean).map(([label, value]) => (
        <div key={label} style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 }}>{label}</div>
          <div style={{ fontSize: 13, color: INK, fontWeight: 500, overflowWrap: 'anywhere' }}>{value ?? '—'}</div>
        </div>
      ))}
    </div>
  )
}

export function Section({ title, right, children, style }) {
  return (
    <Card style={{ marginBottom: 14, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
        <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: INK }}>{title}</h3>
        {right}
      </div>
      {children}
    </Card>
  )
}

export const TONES = TONE
