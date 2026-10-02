'use client'

// Assets Master — Oxmaint's own Asset module, over this PoC's register.
//
// This screen was a DataTable. The product's is not: it is a summary row whose
// cards are the filters, a search box with the filters behind a button, a
// list/grid/category/location toggle, a stack of full-width asset cards, and a
// pagination bar underneath. Side by side, a table read as a different product,
// so the layout here is the product's and only the fields are this PoC's.
//
// The seeded register is the client's Final Asset Scope Matrix, agreed at
// initiation per SOW 3.3, and the cards read it as such. Bulk upload is a
// deliberate, explicit door on top of that: it does not edit the matrix, it adds
// the operator's own rows over it — validated row by row against the estate's
// real sites and the criticality vocabulary before anything is written, and
// clearly the user's, not a fabricated forty-ninth entry in the contract. There
// is still no cost or capacity column, because the workbooks carry neither — a
// card with "Cost: —" on every asset is worse than a card without the row.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeading from '../components/PageHeading'
import MetricCard, { MetricGrid, Glyph } from '../components/MetricCard'
import {
  ProductStyles, ViewToggle, CountHeading, SearchBar, FilterButton, FilterPanel,
  FilterSelect, ActiveFilters, RecordCard, Pagination, EmptyState,
  useListControls, Icons,
} from '../components/product'
import { StatusBadge, ActionButton, PALETTE } from '../lib/kit'
import { useAssetStore } from '../lib/store'
import BulkAssetUpload from '../components/BulkAssetUpload'
import { ALERT_ROWS, WORK_ORDER_ROWS, shapeAsset, toneOf } from '../lib/data'
import { FASM_ASSETS, FASM_SITES, FASM_SUMMARY } from '../lib/data/fasm'

const { SUB, MUTE, INK, LINE, ACCENT } = PALETTE

// The summary cards double as the filters, as they do in the product: click
// "Critical" and the list below is the critical assets.
const KPIS = [
  { key: 'total', label: 'Total assets', variant: 'default', icon: 'asset', test: () => true },
  { key: 'included', label: 'In PoC scope', variant: 'success', icon: 'tick', test: (a) => a._included },
  { key: 'excluded', label: 'Excluded', variant: 'default', icon: 'list', test: (a) => !a._included },
  { key: 'critical', label: 'Critical', variant: 'destructive', icon: 'alert', test: (a) => a.criticality === 'Critical' },
  { key: 'sensored', label: 'Sensors fitted', variant: 'warning', icon: 'wave', test: (a) => a._sensors.length > 0 },
]

const VIEWS = [
  { key: 'list', label: 'List', icon: Icons.list },
  { key: 'grid', label: 'Grid', icon: Icons.grid },
  { key: 'category', label: 'Category', icon: Icons.box },
  { key: 'location', label: 'Location', icon: Icons.pin },
]

export default function AssetMaster() {
  const router = useRouter()
  const [view, setView] = useState('grid')
  const [kpi, setKpi] = useState(null)
  const [uploading, setUploading] = useState(false)
  const assetStore = useAssetStore()

  // The register is the Final Asset Scope Matrix — 92 assets, four sites — with
  // anything bulk-uploaded overlaid on top, newest first. Its sites are its own,
  // not the monitoring demo's, so it is not narrowed by the header's site picker;
  // a Site filter on the register itself does that instead.
  const allAssets = useMemo(() => {
    const created = assetStore.created.filter((r) => r.assetId)
    if (!created.length) return FASM_ASSETS
    const shaped = created.map(shapeAsset)
    const ids = new Set(shaped.map((a) => a.assetId))
    return [...shaped, ...FASM_ASSETS.filter((a) => !ids.has(a.assetId))]
  }, [assetStore.created])

  const existingIds = useMemo(() => new Set(allAssets.map((a) => a.assetId)), [allAssets])

  const createAssets = async (rows) => {
    let n = 0
    for (const r of rows) {
      const rec = await assetStore.create({
        assetId: r.assetId, assetName: r.assetName, assetClass: r.assetClass,
        siteId: r.siteId, criticality: r.criticality, manufacturer: r.manufacturer || '',
        scopeStatus: 'Included',
      })
      if (rec) n++
    }
    return n
  }

  const scoped = allAssets

  // The KPI filter is applied before the search and the selects, so the counts
  // on the cards always describe the same set the cards are counting.
  const base = useMemo(() => {
    const k = KPIS.find((x) => x.key === kpi)
    return k && k.key !== 'total' ? scoped.filter(k.test) : scoped
  }, [scoped, kpi])

  const c = useListControls(base, {
    search: ['assetId', 'assetName', 'assetClass', 'manufacturer', '_location', '_site'],
    filters: [
      { field: '_site', label: 'Site' },
      { field: '_category', label: 'Category' },
      { field: 'criticality', label: 'Criticality' },
      { field: 'assetClass', label: 'Asset class' },
      { field: 'manufacturer', label: 'Manufacturer' },
      { field: 'scopeStatus', label: 'Scope' },
    ],
    initialPageSize: 12,
  })

  const open = (a) => router.push(`/portal/datacenter/assets/${encodeURIComponent(a.assetId)}`)
  const hierarchical = view === 'category' || view === 'location'

  return (
    <div>
      <ProductStyles />

      <PageHeading
        title="Assets Master"
        subtitle={`The Final Asset Scope Matrix — ${FASM_SUMMARY.total} assets across ${FASM_SUMMARY.sites} sites (${FASM_SUMMARY.included} in scope, ${FASM_SUMMARY.excluded} excluded), with class, criticality, monitoring method and data sources. Excluded assets stay on the register with the reason why.`}
        right={
          <>
            <ActionButton onClick={() => setUploading(true)}>Bulk upload</ActionButton>
            <ActionButton variant="ghost" onClick={() => router.push('/portal/datacenter/asset-qr')}>
              Asset QR tags
            </ActionButton>
            <ActionButton variant="ghost" onClick={() => window.print()}>Print</ActionButton>
          </>
        }
      />

      <BulkAssetUpload
        open={uploading}
        onClose={() => setUploading(false)}
        existingIds={existingIds}
        siteIds={FASM_SITES.map((s) => s.siteId)}
        onCreate={createAssets}
      />

      <MetricGrid>
        {KPIS.map((k) => {
          const n = k.key === 'total' ? scoped.length : scoped.filter(k.test).length
          const on = kpi === k.key
          return (
            <div key={k.key} style={on ? styles.kpiOn : undefined}>
              <MetricCard
                title={k.label}
                value={n}
                icon={<Glyph name={k.icon} />}
                variant={k.variant}
                note={on ? 'Filtering the list below — click to clear' : undefined}
                onClick={() => setKpi(on ? null : k.key)}
              />
            </div>
          )
        })}
      </MetricGrid>

      <div style={{ marginBottom: 14 }}>
        <SearchBar value={c.query} onChange={c.setQuery} placeholder="Search asset, id, class, manufacturer, location…" />
      </div>

      <ActiveFilters items={c.active} onClear={c.clear} />

      <FilterPanel open={c.panel} count={c.active.length} onClear={c.clearAll}>
        <FilterSelect label="Site" value={c.picked._site || 'all'} onChange={(v) => c.set('_site', v)} options={c.options._site} allLabel="All sites" />
        <FilterSelect label="Category" value={c.picked._category || 'all'} onChange={(v) => c.set('_category', v)} options={c.options._category} allLabel="All categories" />
        <FilterSelect label="Criticality" value={c.picked.criticality || 'all'} onChange={(v) => c.set('criticality', v)} options={c.options.criticality} allLabel="All criticalities" />
        <FilterSelect label="Asset class" value={c.picked.assetClass || 'all'} onChange={(v) => c.set('assetClass', v)} options={c.options.assetClass} allLabel="All classes" />
        <FilterSelect label="Manufacturer" value={c.picked.manufacturer || 'all'} onChange={(v) => c.set('manufacturer', v)} options={c.options.manufacturer} allLabel="All manufacturers" />
        <FilterSelect label="Scope" value={c.picked.scopeStatus || 'all'} onChange={(v) => c.set('scopeStatus', v)} options={c.options.scopeStatus} allLabel="Included and excluded" />
      </FilterPanel>

      <CountHeading
        icon={Icons.box}
        label="Assets"
        count={hierarchical ? c.shown.length : `${c.slice.length} of ${c.shown.length}`}
        right={
          <>
            <FilterButton open={c.panel} onToggle={() => c.setPanel(!c.panel)} count={c.active.length} />
            <ViewToggle value={view} onChange={setView} options={VIEWS} />
          </>
        }
      />

      {c.shown.length === 0 ? (
        <EmptyState icon={<Glyph name="asset" size={44} />} title="No asset matches these filters."
          body="Clear the search or the filters above, or pick a different summary card." />
      ) : hierarchical ? (
        <Hierarchy rows={c.shown} by={view === 'category' ? '_category' : '_site'} onOpen={open} />
      ) : view === 'grid' ? (
        <div style={styles.grid}>
          {c.slice.map((a) => <AssetCard key={a.assetId} asset={a} onOpen={() => open(a)} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {c.slice.map((a) => <AssetListItem key={a.assetId} asset={a} onOpen={() => open(a)} />)}
        </div>
      )}

      {/* The hierarchy views show the whole tree, so paging them would hide
          branches — the product does the same. */}
      {!hierarchical && c.shown.length > 0 && (
        <Pagination
          page={c.page} pageSize={c.pageSize} total={c.shown.length}
          onPage={c.setPage} onPageSize={c.setPageSize} itemType="assets"
        />
      )}
    </div>
  )
}

// ── the full-width row ───────────────────────────────────────────────────
function AssetListItem({ asset: a, onOpen }) {
  const alerts = ALERT_ROWS.filter((x) => x.assetId === a.assetId).length
  const orders = WORK_ORDER_ROWS.filter((x) => x.assetId === a.assetId).length

  return (
    <RecordCard onClick={onOpen} dim={!a._included}>
      <div style={{ padding: 16, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <span style={styles.tile}><Glyph name="asset" size={18} /></span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.titleRow}>
            <h3 style={styles.name}>{a.assetName}</h3>
            <StatusBadge tone={toneOf(a.criticality)}>{a.criticality}</StatusBadge>
            <StatusBadge tone={a._included ? 'green' : 'grey'}>{a.scopeStatus}</StatusBadge>
          </div>

          <div style={styles.metaRow}>
            <span style={styles.code}>{a.assetId}</span>
            <Meta icon={Icons.pin}>{a._site} · {a._location}</Meta>
            {a.manufacturer && <Meta icon={Icons.gear}>{a.manufacturer}</Meta>}
            <Meta icon={Icons.box}>{a.assetClass}</Meta>
          </div>

          <div style={styles.tagRow}>
            {a._sensors.map((s) => <span key={s} style={styles.tagGreen}>{s}</span>)}
            {a._failureCodes.slice(0, 5).map((f) => <span key={f} style={styles.tag}>{f}</span>)}
            {a._failureCodes.length > 5 && <span style={styles.tag}>+{a._failureCodes.length - 5}</span>}
          </div>
        </div>

        {/* The numbers the product puts down the right of a row, chosen from
            what these workbooks actually hold: this asset's own alerts, its
            work orders and its response SLA. */}
        <div style={styles.rightStats}>
          <RightStat label="Alerts" value={alerts} tone={alerts ? '#b45309' : undefined} />
          <RightStat label="Work orders" value={orders} />
          <RightStat label="Response SLA" value={a._sla || '—'} small />
        </div>

        <span style={styles.chev}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </span>
      </div>
    </RecordCard>
  )
}

// ── the same record as a card ────────────────────────────────────────────
function AssetCard({ asset: a, onOpen }) {
  return (
    <RecordCard onClick={onOpen} dim={!a._included} style={{ height: '100%' }}>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={styles.tile}><Glyph name="asset" size={17} /></span>
          <StatusBadge tone={toneOf(a.criticality)}>{a.criticality}</StatusBadge>
          {!a._included && <StatusBadge tone="grey">Excluded</StatusBadge>}
        </div>

        <h3 style={{ ...styles.name, whiteSpace: 'normal' }}>{a.assetName}</h3>
        <div style={{ ...styles.code, marginTop: 4 }}>{a.assetId}</div>

        <div style={{ display: 'grid', gap: 7, marginTop: 12, fontSize: 12.5, color: SUB }}>
          <Meta icon={Icons.pin}>{a._site}</Meta>
          <Meta icon={Icons.box}>{a.assetClass}</Meta>
          {a.manufacturer && <Meta icon={Icons.gear}>{a.manufacturer}</Meta>}
        </div>

        <div style={{ ...styles.tagRow, marginTop: 12 }}>
          {a._sensors.map((s) => <span key={s} style={styles.tagGreen}>{s}</span>)}
        </div>

        <div style={styles.cardFoot}>
          {a._strategy || a.monitoringMethod}
        </div>
      </div>
    </RecordCard>
  )
}

// ── grouped views ────────────────────────────────────────────────────────
//
// The product's category and location views are a collapsible tree. This
// estate is two levels deep — a category or a site, then its assets — so it is
// a set of groups rather than a tree with one branch per node.
function Hierarchy({ rows, by, onOpen }) {
  const groups = useMemo(() => {
    const m = new Map()
    for (const r of rows) {
      const k = r[by] || 'Unassigned'
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(r)
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [rows, by])

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {groups.map(([name, list]) => <HierarchyGroup key={name} name={name} list={list} onOpen={onOpen} />)}
    </div>
  )
}

function HierarchyGroup({ name, list, onOpen }) {
  const [open, setOpen] = useState(true)
  const critical = list.filter((a) => a.criticality === 'Critical').length

  return (
    <RecordCard>
      <button onClick={() => setOpen(!open)} style={styles.groupHead}>
        <span style={{ display: 'flex', color: MUTE, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .18s ease' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: INK }}>{name}</span>
        <span style={styles.groupCount}>{list.length}</span>
        {critical > 0 && <StatusBadge tone="red">{critical} critical</StatusBadge>}
      </button>

      {open && (
        <div style={{ borderTop: `1px solid ${LINE}` }}>
          {list.map((a) => (
            <button key={a.assetId} onClick={() => onOpen(a)} style={styles.groupRow}>
              <span style={{ ...styles.code, flexShrink: 0, width: 150, textAlign: 'left' }}>{a.assetId}</span>
              <span style={{ flex: 1, minWidth: 0, textAlign: 'left', fontSize: 13, fontWeight: 600, color: a._included ? INK : MUTE }}>
                {a.assetName}
              </span>
              <StatusBadge tone={toneOf(a.criticality)}>{a.criticality}</StatusBadge>
              <span style={{ fontSize: 11.5, color: MUTE, flexShrink: 0 }}>{a._location}</span>
            </button>
          ))}
        </div>
      )}
    </RecordCard>
  )
}

// ── small parts ──────────────────────────────────────────────────────────
function Meta({ icon, children }) {
  return (
    <span style={styles.meta}>
      <span style={{ display: 'flex', flexShrink: 0, color: MUTE }}>{icon}</span>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</span>
    </span>
  )
}

function RightStat({ label, value, tone, small }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 74 }}>
      <div style={{ fontSize: 10.5, color: MUTE, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: small ? 12 : 17, fontWeight: 700, color: tone || INK, letterSpacing: '-0.01em' }}>{value}</div>
    </div>
  )
}

const styles = {
  kpiOn: { borderRadius: 12, boxShadow: `0 0 0 2px ${ACCENT}33`, outline: `1px solid ${ACCENT}` },

  grid: { display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))' },

  tile: {
    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
    background: '#eef2ff', color: ACCENT,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  titleRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 },
  name: {
    margin: 0, fontSize: 15, fontWeight: 700, color: INK, letterSpacing: '-0.01em',
    minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  code: { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 11.5, fontWeight: 700, color: ACCENT },
  metaRow: { display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 7, fontSize: 12.5, color: SUB },
  meta: { display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0, maxWidth: 300 },
  tagRow: { display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 9 },
  tag: { fontSize: 10.5, fontWeight: 700, color: '#334155', background: '#f1f5f9', border: `1px solid ${LINE}`, borderRadius: 5, padding: '2px 7px' },
  tagGreen: { fontSize: 10.5, fontWeight: 700, color: '#15803d', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 5, padding: '2px 7px' },

  rightStats: { display: 'flex', alignItems: 'center', gap: 18, flexShrink: 0, paddingLeft: 8 },
  chev: { display: 'flex', alignItems: 'center', flexShrink: 0 },

  cardFoot: { marginTop: 'auto', paddingTop: 12, fontSize: 11.5, color: MUTE, lineHeight: 1.5 },

  groupHead: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '13px 15px', background: '#fff', border: 'none', cursor: 'pointer',
    fontFamily: 'inherit', textAlign: 'left',
  },
  groupCount: {
    fontSize: 11, fontWeight: 700, color: SUB, background: '#f1f5f9',
    border: `1px solid ${LINE}`, borderRadius: 999, padding: '1px 8px',
  },
  groupRow: {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
    padding: '10px 15px', background: '#fff', border: 'none',
    borderTop: `1px solid #f1f5f9`, cursor: 'pointer', fontFamily: 'inherit',
  },
}
