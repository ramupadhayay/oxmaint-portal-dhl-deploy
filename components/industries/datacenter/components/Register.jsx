'use client'

// The screen most of this portal is made of.
//
// The SOW's deliverables are largely registers and logs — the asset register,
// the alert register, the risk register, two readiness checklists, the PM
// compliance log, the weekly health log. They differ in their columns and in
// nothing else: each is a searchable, filterable, sortable table over one sheet.
//
// Writing fourteen near-identical screens is how they drift — one gets a search
// box and another does not, one sorts and another does not — so the screen is
// written once and each section supplies its columns.
//
// A row opens a page, not a drawer. That is how the product this follows does
// it, and the reasons are the ones a slide-over cannot answer: the URL of a
// work order is a thing people paste to each other, the browser's back button
// should mean something, a record too tall for a 440px panel should not scroll
// inside one, and a record you can print is a page.

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Toolbar, DataTable, StatusBadge } from '../lib/kit'
import PageHeading from './PageHeading'
import { StatCards } from './MetricCard'
import { useSite } from '../lib/siteStore'

/**
 * @param title      screen heading
 * @param subtitle   one line saying what this register is and, where it matters,
 *                   which part of the SOW asks for it
 * @param rows       the data
 * @param columns    kit DataTable columns
 * @param search     fields a query is matched against
 * @param filters    [{ label, field }] rendered as selects, options derived
 * @param stats      (rows) => StatStrip items, computed over the filtered set
 * @param idOf       (row) => the id used in the row's URL; omit to make rows
 *                   inert, which is right for a reference table with nothing
 *                   more to show than the row already shows
 * @param scoped     false for estate-wide reference tables that must not be
 *                   filtered by the site picker
 * @param right      extra controls for the toolbar (a New button, an export)
 */
export default function Register({
  title, subtitle, rows, columns, search = [], filters = [],
  stats, idOf, scoped = true, pageSize = 12, empty, right, banner,
}) {
  const { scope, siteName, siteId, setSiteId } = useSite()
  const { section } = useParams()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState({})

  const scopedRows = useMemo(() => (scoped ? scope(rows) : rows), [scoped, scope, rows])

  const options = useMemo(() => {
    const o = {}
    filters.forEach((f) => {
      o[f.field] = [...new Set(scopedRows.map((r) => r[f.field]).filter(Boolean))].map(String).sort()
    })
    return o
  }, [filters, scopedRows])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return scopedRows.filter((r) => {
      for (const f of filters) {
        const v = picked[f.field]
        if (v && v !== 'all' && String(r[f.field]) !== v) return false
      }
      if (!q) return true
      return search.some((k) => String(r[k] ?? '').toLowerCase().includes(q))
    })
  }, [scopedRows, query, picked, filters, search])

  const activeFilters = Object.values(picked).filter((v) => v && v !== 'all').length
  const filtered = activeFilters > 0 || query.trim().length > 0

  // Why this register is empty, if it is.
  //
  // It said "Nothing recorded yet." whatever the reason, and that sentence is
  // wrong in the case that actually happens. Several of these registers are
  // thin — battery telemetry is eight readings across four of six sites — so
  // picking a site the sheet does not cover empties the page completely. A
  // reader then reports the screen as broken, which is what happened, and the
  // page had told them it held no data when it holds eight rows.
  //
  // Three different sentences, because they call for three different actions:
  // clear the site, clear the filters, or accept that the sheet is empty.
  const emptyBecause = shown.length ? null
    : rows.length === 0 ? 'source'
      : scopedRows.length === 0 ? 'site'
        : 'filters'

  return (
    <div>
      <PageHeading
        title={title}
        subtitle={subtitle}
        right={right}
      />

      {stats && <StatCards items={stats(shown)} />}

      {/* An optional banner between the stats and the table — the feed screens
          use it to surface the not-normal readings the client asked to see,
          computed over the site-scoped set so it does not vanish when the status
          filter is on. */}
      {banner && banner(scopedRows)}

      <Toolbar
        search={query}
        onSearch={setQuery}
        placeholder="Search…"
        filters={filters.map((f) => ({
          label: f.label,
          value: picked[f.field] || 'all',
          options: options[f.field] || [],
          onChange: (v) => setPicked((p) => ({ ...p, [f.field]: v })),
        }))}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {scoped && siteName !== 'All Sites' && <StatusBadge tone="blue">{siteName}</StatusBadge>}
            {/* Shown only once something is filtering, because "24 of 24" on an
                untouched table is noise that trains people to stop reading it. */}
            {filtered && (
              <>
                <span style={{ fontSize: 11.5, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                  {shown.length} of {scopedRows.length}
                </span>
                <button onClick={() => { setQuery(''); setPicked({}) }} style={clearBtn}>Clear</button>
              </>
            )}
          </div>
        }
      />

      {emptyBecause === 'site' ? (
        <EmptyBecauseSite
          siteName={siteName}
          total={rows.length}
          onClear={() => setSiteId('all')}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={shown}
          pageSize={pageSize}
          onRowClick={idOf ? (r) => router.push(`/portal/datacenter/${section}/${encodeURIComponent(idOf(r))}`) : undefined}
          empty={empty || (emptyBecause === 'filters'
            ? 'Nothing matches these filters.'
            : 'This sheet holds no rows.')}
        />
      )}
    </div>
  )
}

/**
 * The register has rows, just none at the selected site.
 *
 * Its own block rather than a line inside the table, because the reader needs
 * to do something and a sentence in a table cell is not somewhere anyone looks
 * for a control. It names the site, says how many rows exist elsewhere, and
 * clears the filter — three things the old "Nothing recorded yet." said none of.
 */
function EmptyBecauseSite({ siteName, total, onClear }) {
  return (
    <div style={emptyStyles.wrap}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b45309"
        strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
      </svg>
      <div style={{ minWidth: 0, flex: '1 1 260px' }}>
        <div style={emptyStyles.title}>Nothing here for {siteName}</div>
        <p style={emptyStyles.body}>
          This register holds <strong>{total} {total === 1 ? 'row' : 'rows'}</strong>, none of them
          at this site. The header&rsquo;s site picker is filtering the page — it is not
          that the data is missing.
        </p>
      </div>
      <button onClick={onClear} style={emptyStyles.button}>Show all sites</button>
    </div>
  )
}

const emptyStyles = {
  wrap: {
    display: 'flex', alignItems: 'flex-start', gap: 13, flexWrap: 'wrap',
    padding: '18px 20px', borderRadius: 12, background: '#fffbf5',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fde68a',
  },
  title: { fontSize: 13.5, fontWeight: 700, color: '#7c2d12', marginBottom: 5 },
  body: { margin: 0, fontSize: 12.5, color: '#475569', lineHeight: 1.6, maxWidth: 560 },
  button: {
    padding: '8px 14px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
    borderRadius: 9, background: '#15227a', color: '#fff', cursor: 'pointer',
    border: 'none', whiteSpace: 'nowrap', alignSelf: 'center',
  },
}

const clearBtn = {
  padding: '5px 10px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
  border: '1px solid #e4e9f0', borderRadius: 7, background: '#fff', color: '#15227a', cursor: 'pointer',
}

/** Label/value rows. Long text wraps rather than truncating — these fields
 *  carry engineering findings, and a clipped finding is useless. */
export function Facts({ items = [], columns = 1 }) {
  const shown = items.filter((i) => i && i[1] !== null && i[1] !== undefined && i[1] !== '')
  return (
    <div style={{ display: 'grid', gap: 11, gridTemplateColumns: columns > 1 ? `repeat(${columns},minmax(0,1fr))` : '1fr' }}>
      {shown.map(([label, value]) => (
        <div key={label} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, alignItems: 'start' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, paddingTop: 1 }}>{label}</span>
          <span style={{ fontSize: 12.5, color: '#0f172a', lineHeight: 1.55, minWidth: 0, wordBreak: 'break-word' }}>{value}</span>
        </div>
      ))}
    </div>
  )
}
