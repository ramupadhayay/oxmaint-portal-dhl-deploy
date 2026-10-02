'use client'

// Inspection Checklists — the library.
//
// Built against the product's own screen (inspection/checklist/page.tsx) rather
// than against the other portals here. The product puts two tabs across the top,
// My Organization and From System; the organization tab carries an Active /
// Archived pair with both counts always visible, a bulk bar that archives or
// restores what is selected, and everything below it — search with its own
// button, a sort, a list/grid toggle and pagination — is shared by both tabs.
//
// The two sources are not a display detail. A system checklist is read-only and
// can only be duplicated; an organization one can be edited, archived and
// deleted. "Who wrote this checklist" is the first question asked about a failed
// run, so the tab a checklist sits under is the answer to it.
//
// It opens on From System. The eight shipped procedures are all there is until
// somebody authors one, and a library that opens empty tells a worse story about
// the module than a tab that starts on the other side.
//
// A checklist opens as its own page. Its sections, its items and their response
// types do not fit a drawer, and a drawer cannot be linked to, opened in a
// second tab or closed with the back button — all three of which somebody does
// in a review.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeading, PALETTE } from '../lib/kit'
import { Action, ListHeader, ViewToggle, SearchBar, Pill, TONE, Glyph } from '../lib/productKit'
import { Mark, Modal, Picker, IconButton } from '../lib/checklistKit'
import { fmtDate } from '../lib/data'
import { useStore } from '../lib/store'
import { useChecklistRuns } from '../lib/ops'
import { libraryOf, featuresOf, FEATURE_TONE, CATEGORIES } from '../lib/checklistLibrary'
import { SCORING_METHODS } from '../lib/checklists'

const { INK, SUB, MUTE, LINE } = PALETTE

const PAGE_SIZES = [10, 20, 30, 40, 50]

const scoringLabel = (v) => SCORING_METHODS.find((s) => s.value === v)?.label || String(v || '').replace('_', '/')

export default function Checklists() {
  const router = useRouter()
  const store = useStore()
  const runs = useChecklistRuns()

  const [tab, setTab] = useState('system')
  const [showArchived, setShowArchived] = useState(false)
  const [selected, setSelected] = useState([])
  const [bulkBusy, setBulkBusy] = useState(false)
  const [confirmBulk, setConfirmBulk] = useState(false)

  // The product keeps the typed value and the applied value apart, so the list
  // does not re-cut on every keystroke and the Search button means something.
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('created')
  const [category, setCategory] = useState('all')
  const [view, setView] = useState('list')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [menuFor, setMenuFor] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [busyDelete, setBusyDelete] = useState(false)
  const [archivedBlocked, setArchivedBlocked] = useState(null)

  const authored = store?.records?.hepa_checklist || []
  const library = useMemo(() => libraryOf(authored), [authored])

  // Completions counted off the runs actually recorded, so working a checklist
  // through moves the figure on its card rather than leaving it static.
  const runCount = useMemo(() => {
    const m = {}
    for (const r of runs) m[r.templateId] = (m[r.templateId] || 0) + 1
    return m
  }, [runs])

  const orgAll = useMemo(() => library.filter((c) => c.source === 'org'), [library])
  const orgActiveCount = orgAll.filter((c) => !c.archived).length
  const orgArchivedCount = orgAll.filter((c) => c.archived).length

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const out = library.filter((c) => (
      c.source === (tab === 'system' ? 'system' : 'org')
      && (tab === 'system' ? !c.archived : c.archived === showArchived)
      && (category === 'all' || c.category === category)
      && (!q || [c.name, c.code, c.category, c.standard, c.what].filter(Boolean).join(' ').toLowerCase().includes(q))
    ))
    const time = (v) => (v ? new Date(v).getTime() || 0 : 0)
    if (sort === 'name') return [...out].sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'updated') return [...out].sort((a, b) => time(b.modifiedAt || b.createdAt) - time(a.modifiedAt || a.createdAt))
    return [...out].sort((a, b) => time(b.createdAt) - time(a.createdAt))
  }, [library, tab, showArchived, category, search, sort])

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, totalPages)
  const shown = rows.slice((current - 1) * pageSize, current * pageSize)

  // Any change to what the list holds sends the reader back to its first page.
  // Staying on page four of a two-page result is the bug that reads as an empty
  // library.
  useEffect(() => { setPage(1); setSelected([]) }, [tab, showArchived, category, search, sort, pageSize])

  const allOnPageSelected = shown.length > 0 && shown.every((c) => selected.includes(c.key))
  const canBulk = tab === 'organization' && shown.length > 0

  const open = (c) => {
    if (tab === 'organization' && c.archived) {
      setArchivedBlocked(c)
      return
    }
    router.push(`/portal/hepa/checklists/${c.id}`)
  }

  const duplicate = (c) => {
    // The product carries the whole checklist through sessionStorage rather than
    // the URL, because a checklist with eighty items does not fit in a query
    // string. Same here, and for the same reason.
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('hepa_checklist_seed', JSON.stringify({ mode: 'duplicate', checklist: c }))
    }
    router.push('/portal/hepa/checklists/new')
  }

  const edit = (c) => {
    if (c.source === 'system') {
      store?.notify('A checklist from the system library cannot be edited. Duplicate it and edit the copy.', 'error')
      return
    }
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('hepa_checklist_seed', JSON.stringify({ mode: 'edit', checklist: c }))
    }
    router.push('/portal/hepa/checklists/new')
  }

  const remove = async () => {
    if (!deleteTarget) return
    setBusyDelete(true)
    const row = authored.find((r) => (r.templateId || r.id || r.recordId) === deleteTarget.key)
    if (row) await store.remove('hepa_checklist', row.recordId)
    setBusyDelete(false)
    setDeleteTarget(null)
  }

  /**
   * Archive, or bring back.
   *
   * A shipped checklist has no database row until somebody does something to
   * it, so archiving one writes the row rather than editing one that is not
   * there. The library reads an organization row over a system one, which is
   * the same mechanism that lets a site edit a step we shipped.
   */
  const runBulk = async () => {
    const archive = !showArchived
    setBulkBusy(true)
    for (const key of selected) {
      const c = library.find((x) => x.key === key)
      if (!c) continue
      const row = authored.find((r) => (r.templateId || r.id || r.recordId) === key)
      if (row) await store.update('hepa_checklist', row.recordId, { archived: archive })
      else await store.create('hepa_checklist', { ...c, recordId: `chk_${key}`, templateId: key, archived: archive })
    }
    setBulkBusy(false)
    setConfirmBulk(false)
    setSelected([])
    store?.notify(archive
      ? `${selected.length} checklist${selected.length === 1 ? '' : 's'} archived.`
      : `${selected.length} checklist${selected.length === 1 ? '' : 's'} restored.`)
  }

  return (
    <div>
      <PageHeading
        title="Inspection Checklists"
        subtitle="Create and manage inspection checklists for your cleanrooms and filters"
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Action icon="refresh" onClick={() => { setSearchInput(''); setSearch(''); setCategory('all'); setSort('created'); setPage(1) }}>
              Refresh
            </Action>
            <Action icon="download" onClick={() => exportCsv(rows)}>Export</Action>
            {!(tab === 'organization' && showArchived) && (
              <Action icon="clipboard" primary onClick={() => router.push('/portal/hepa/checklists/new')}>
                + Create Checklist
              </Action>
            )}
          </div>
        }
      />

      <div style={styles.tabRow}>
        <div style={styles.tabs}>
          {[
            { key: 'organization', label: 'My Organization', icon: 'box' },
            { key: 'system', label: 'From System', icon: 'doc' },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                ...styles.tab,
                background: tab === t.key ? '#15227a' : '#fff',
                color: tab === t.key ? '#fff' : SUB,
                borderColor: tab === t.key ? '#15227a' : LINE,
              }}>
              <Glyph name={t.icon} size={14} color={tab === t.key ? '#fff' : SUB} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'organization' && (
          <div style={styles.subToggle}>
            {[
              { on: false, label: 'Active', icon: 'box', count: orgActiveCount },
              { on: true, label: 'Archived', icon: 'archive', count: orgArchivedCount },
            ].map((s) => (
              <button key={s.label} onClick={() => setShowArchived(s.on)}
                style={{
                  ...styles.subBtn,
                  background: showArchived === s.on ? '#0f172a' : 'transparent',
                  color: showArchived === s.on ? '#fff' : SUB,
                }}>
                <Mark name={s.icon} size={13} color={showArchived === s.on ? '#fff' : SUB} />
                {s.label}
                <span style={{
                  ...styles.subCount,
                  background: showArchived === s.on ? 'rgba(255,255,255,.18)' : '#e2e8f0',
                  color: showArchived === s.on ? '#fff' : SUB,
                }}>{s.count}</span>
              </button>
            ))}
          </div>
        )}

        {tab === 'organization' && showArchived && (
          <span style={styles.archivedHint}>
            Viewing archived checklists — switch to Active to create a new one.
          </span>
        )}
      </div>

      {canBulk && (
        <div style={styles.bulkBar}>
          <label style={styles.bulkPick}>
            <input type="checkbox" checked={allOnPageSelected}
              onChange={(e) => setSelected(e.target.checked ? shown.map((c) => c.key) : [])} />
            {selected.length ? `${selected.length} selected` : 'Select all on this page'}
          </label>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {selected.length > 0 && (
              <button onClick={() => setSelected([])} style={styles.clearSel}>Clear</button>
            )}
            <button onClick={() => setConfirmBulk(true)} disabled={!selected.length || bulkBusy}
              style={{
                ...styles.bulkBtn,
                background: showArchived ? '#059669' : '#d97706',
                opacity: selected.length && !bulkBusy ? 1 : 0.5,
                cursor: selected.length && !bulkBusy ? 'pointer' : 'default',
              }}>
              <Mark name={showArchived ? 'restore' : 'archive'} size={13} color="#fff" />
              {showArchived ? 'Restore Selected' : 'Archive Selected'}
            </button>
          </span>
        </div>
      )}

      <ListHeader
        title={tab === 'system' ? 'System Checklists' : showArchived ? 'Archived Checklists' : 'Checklists'}
        count={rows.length}
        icon="clipboard"
        right={
          <>
            <Picker value={category} onChange={setCategory} style={{ width: 176 }}
              options={[{ value: 'all', label: 'All categories' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} />
            <Picker value={sort} onChange={setSort} style={{ width: 176 }}
              options={[
                { value: 'name', label: 'Sort by Name' },
                { value: 'created', label: 'Sort by Created' },
                { value: 'updated', label: 'Sort by Updated' },
              ]} />
            <ViewToggle value={view} onChange={setView} />
          </>
        }
      />

      <div style={styles.searchRow}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <SearchBar value={searchInput} onChange={setSearchInput}
            placeholder="Search checklists by name, code, standard or description…" />
        </div>
        <Action icon="search" primary onClick={() => setSearch(searchInput)}>Search</Action>
      </div>

      {view === 'grid' ? (
        <div style={styles.grid}>
          {shown.map((c) => (
            <ChecklistCard key={c.key} c={c} runs={runCount[c.key] || 0} tab={tab}
              selectable={canBulk} selected={selected.includes(c.key)}
              onSelect={() => setSelected((p) => (p.includes(c.key) ? p.filter((k) => k !== c.key) : [...p, c.key]))}
              menuOpen={menuFor === c.key} onMenu={() => setMenuFor(menuFor === c.key ? null : c.key)}
              onClose={() => setMenuFor(null)}
              onOpen={() => open(c)} onEdit={() => edit(c)} onDuplicate={() => duplicate(c)}
              onDelete={() => setDeleteTarget(c)} />
          ))}
        </div>
      ) : (
        <div style={styles.list}>
          <ListHead selectable={canBulk} />
          {shown.map((c) => (
            <ChecklistRow key={c.key} c={c} runs={runCount[c.key] || 0} tab={tab}
              selectable={canBulk} selected={selected.includes(c.key)}
              onSelect={() => setSelected((p) => (p.includes(c.key) ? p.filter((k) => k !== c.key) : [...p, c.key]))}
              menuOpen={menuFor === c.key} onMenu={() => setMenuFor(menuFor === c.key ? null : c.key)}
              onClose={() => setMenuFor(null)}
              onOpen={() => open(c)} onEdit={() => edit(c)} onDuplicate={() => duplicate(c)}
              onDelete={() => setDeleteTarget(c)} />
          ))}
        </div>
      )}

      {!rows.length && (
        <EmptyState
          hasFilters={Boolean(search) || category !== 'all'}
          isArchived={tab === 'organization' && showArchived}
          onCreate={() => router.push('/portal/hepa/checklists/new')}
          onClear={() => { setSearchInput(''); setSearch(''); setCategory('all') }}
        />
      )}

      {rows.length > 0 && (
        <Pagination
          page={current} pageSize={pageSize} total={rows.length} totalPages={totalPages}
          onPage={setPage} onPageSize={setPageSize}
        />
      )}

      <Modal open={confirmBulk} width={520}
        title={`${showArchived ? 'Restore' : 'Archive'} ${selected.length} checklist${selected.length === 1 ? '' : 's'}?`}
        onClose={() => setConfirmBulk(false)}>
        <p style={styles.dialogBody}>
          {showArchived
            ? 'The selected checklists will appear in the Active list again.'
            : 'Archiving hides these checklists from the Active list and from the pickers a new '
              + 'inspection is raised from. Rounds already walked against them keep their records. '
              + 'You can restore them at any time.'}
        </p>
        <div style={styles.dialogActions}>
          <Action onClick={() => setConfirmBulk(false)}>Cancel</Action>
          <button onClick={runBulk} disabled={bulkBusy}
            style={{ ...styles.bulkBtn, background: showArchived ? '#059669' : '#d97706', opacity: bulkBusy ? 0.6 : 1 }}>
            {bulkBusy ? 'Working…' : showArchived ? 'Restore' : 'Archive'}
          </button>
        </div>
      </Modal>

      <Modal open={Boolean(deleteTarget)} width={520} title="Delete checklist" onClose={() => setDeleteTarget(null)}>
        <p style={styles.dialogBody}>
          Delete “{deleteTarget?.name}”? This cannot be undone. Runs already recorded against it keep
          their own copy of the steps, so the evidence survives — but nobody will be able to start a
          new run from it.
        </p>
        <div style={styles.dialogActions}>
          <Action onClick={() => setDeleteTarget(null)}>Cancel</Action>
          <button onClick={remove} disabled={busyDelete}
            style={{ ...styles.bulkBtn, background: '#dc2626', opacity: busyDelete ? 0.6 : 1 }}>
            {busyDelete ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>

      <Modal open={Boolean(archivedBlocked)} width={480} title="Checklist archived" onClose={() => setArchivedBlocked(null)}>
        <p style={styles.dialogBody}>
          “{archivedBlocked?.name}” has been archived. Restore it from the Archived view to open it.
        </p>
        <div style={styles.dialogActions}>
          <Action primary onClick={() => setArchivedBlocked(null)}>OK</Action>
        </div>
      </Modal>
    </div>
  )
}

/** The overflow menu the product puts on every card and row. */
function RowMenu({ open, onOpen, onClose, tab, onView, onEdit, onDuplicate, onDelete }) {
  return (
    <span style={{ position: 'relative', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
      <IconButton icon="dots" title="Actions" onClick={onOpen} />
      {open && (
        <>
          {/* Closes on any click elsewhere. A menu that only closes on its own
              button is a menu left hanging over the next thing clicked. */}
          <span style={styles.menuVeil} onClick={onClose} />
          <span style={styles.menu}>
            <button style={styles.menuItem} onClick={() => { onClose(); onView() }}>
              <Mark name="search" size={13} color={SUB} /> View Details
            </button>
            {tab === 'organization' && (
              <button style={styles.menuItem} onClick={() => { onClose(); onEdit() }}>
                <Mark name="edit" size={13} color={SUB} /> Edit Checklist
              </button>
            )}
            <button style={styles.menuItem} onClick={() => { onClose(); onDuplicate() }}>
              <Mark name="copy" size={13} color={SUB} /> Duplicate
            </button>
            {tab === 'organization' && (
              <button style={{ ...styles.menuItem, color: '#dc2626' }} onClick={() => { onClose(); onDelete() }}>
                <Mark name="trash" size={13} color="#dc2626" /> Delete Checklist
              </button>
            )}
          </span>
        </>
      )}
    </span>
  )
}

function Features({ c }) {
  return featuresOf(c).map((f) => <Pill key={f} tone={FEATURE_TONE[f]}>{f}</Pill>)
}

/**
 * The column tracks every row in the list shares.
 *
 * They used to be flex bases — `flex: 2 1 260px` and friends — which sizes each
 * row's columns from that row's own content. A checklist with "10 items · 5
 * sections" pushed its neighbours along and the one under it did not, so
 * nothing lined up down the page and the author column landed in a different
 * place on every row.
 *
 * One grid, declared once, used by the header and by every row. The last track
 * is `auto` so the badges keep their natural width and the menu stays pinned to
 * the right edge.
 */
const COLUMNS = '18px 34px minmax(0,2.4fr) minmax(0,1.4fr) minmax(0,1.1fr) auto 32px'
const COLUMNS_PLAIN = '34px minmax(0,2.4fr) minmax(0,1.4fr) minmax(0,1.1fr) auto 32px'

/** Names the two middle columns, which are unreadable without them. */
function ListHead({ selectable }) {
  return (
    <div style={{ ...styles.listHead, gridTemplateColumns: selectable ? COLUMNS : COLUMNS_PLAIN }}>
      {selectable && <span />}
      <span />
      <span>Checklist</span>
      <span>Content</span>
      <span>Created by</span>
      <span />
      <span />
    </div>
  )
}

/** One row in the list view. */
function ChecklistRow({ c, runs, tab, selectable, selected, onSelect, menuOpen, onMenu, onClose, onOpen, onEdit, onDuplicate, onDelete }) {
  return (
    <div style={{ ...styles.row, gridTemplateColumns: selectable ? COLUMNS : COLUMNS_PLAIN }}
      onClick={onOpen} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen() }}>
      {selectable && (
        <span onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={selected} onChange={onSelect} aria-label={`Select ${c.name}`} />
        </span>
      )}

      <span style={styles.rowTile}>
        <Glyph name="clipboard" size={16} color={MUTE} />
      </span>

      <span style={{ minWidth: 0 }}>
        <span style={styles.rowRef}>{c.code}</span>
        <span style={styles.rowTitle}>{c.name}</span>
        <span style={styles.rowSub}>{c.standard}</span>
      </span>

      <span style={{ minWidth: 0 }}>
        <span style={styles.rowStrong}>{c.itemCount} items · {c.sectionCount} sections</span>
        <span style={styles.rowSub}>{c.category} · {scoringLabel(c.scoringMethod)}</span>
        {/* Capture requirements read as text here rather than as three more
            pills. They are properties of the checklist, and a row wearing five
            badges makes the one that matters — Critical — impossible to spot. */}
        {featuresOf(c).filter((f) => f !== 'Critical').length > 0 && (
          <span style={styles.rowSub}>
            {featuresOf(c).filter((f) => f !== 'Critical').join(' · ')}
          </span>
        )}
      </span>

      <span style={{ minWidth: 0 }}>
        <span style={styles.rowStrong}>{c.author}</span>
        <span style={styles.rowSub}>{c.createdAt ? fmtDate(c.createdAt) : '—'}</span>
        {runs > 0 && <span style={styles.rowSub}>{runs} run{runs === 1 ? '' : 's'} recorded</span>}
      </span>

      <span style={styles.rowBadges}>
        {featuresOf(c).includes('Critical') && <Pill tone="red">Critical</Pill>}
        <Pill tone="slate">{c.archived ? 'Archived' : 'Active'}</Pill>
      </span>

      <RowMenu open={menuOpen} onOpen={onMenu} onClose={onClose} tab={tab}
        onView={onOpen} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} />
    </div>
  )
}

/** The same checklist as a card, for the grid view. */
function ChecklistCard({ c, runs, tab, selectable, selected, onSelect, menuOpen, onMenu, onClose, onOpen, onEdit, onDuplicate, onDelete }) {
  return (
    <div style={styles.card} onClick={onOpen} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen() }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        {selectable && (
          <span onClick={(e) => e.stopPropagation()} style={{ marginTop: 3 }}>
            <input type="checkbox" checked={selected} onChange={onSelect} aria-label={`Select ${c.name}`} />
          </span>
        )}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={styles.cardTitle}>{c.name}</span>
            <Pill tone="slate">{c.archived ? 'Archived' : 'Active'}</Pill>
          </span>
          <span style={styles.rowRef}>{c.code}</span>
        </span>
        <RowMenu open={menuOpen} onOpen={onMenu} onClose={onClose} tab={tab}
          onView={onOpen} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} />
      </div>

      {c.what && <p style={styles.cardWhat}>{c.what}</p>}

      <div style={styles.cardFacts}>
        {[
          ['Standard', c.standard],
          ['Category', c.category],
          ['Scoring', scoringLabel(c.scoringMethod)],
          ['Items', `${c.itemCount} in ${c.sectionCount} section${c.sectionCount === 1 ? '' : 's'}`],
          ['Asset level', c.assetLevel],
          ['Version', c.version],
        ].map(([k, v]) => (
          <span key={k} style={{ minWidth: 0 }}>
            <span style={styles.factKey}>{k}</span>
            <span style={styles.factVal}>{v}</span>
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
        {runs > 0 && <Pill tone="slate">{runs} run{runs === 1 ? '' : 's'}</Pill>}
        <Features c={c} />
      </div>

      <div style={styles.cardFoot}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Glyph name="user" size={12} color={MUTE} />{c.author}
        </span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Glyph name="calendar" size={12} color={MUTE} />{c.createdAt ? fmtDate(c.createdAt) : '—'}
        </span>
      </div>
    </div>
  )
}

function EmptyState({ hasFilters, isArchived, onCreate, onClear }) {
  if (hasFilters) {
    return (
      <div style={styles.empty}>
        <strong style={styles.emptyTitle}>No checklists found</strong>
        <p style={styles.emptyBody}>
          Nothing matches the current search or category. Try widening it.
        </p>
        <Action onClick={onClear}>Clear filters</Action>
      </div>
    )
  }
  if (isArchived) {
    return (
      <div style={styles.empty}>
        <strong style={styles.emptyTitle}>No archived checklists</strong>
        <p style={styles.emptyBody}>
          Archived checklists appear here. Switch to Active to view or create one.
        </p>
      </div>
    )
  }
  return (
    <div style={styles.empty}>
      <strong style={styles.emptyTitle}>Create your first checklist</strong>
      <p style={styles.emptyBody}>
        An organization checklist is one this site wrote. Define its sections, add the items a
        technician has to work through, and set what each one has to capture.
      </p>
      <Action icon="clipboard" primary onClick={onCreate}>Create First Checklist</Action>
    </div>
  )
}

/** The product's pager: a result count, a page size, and numbered pages with ellipses. */
function Pagination({ page, pageSize, total, totalPages, onPage, onPageSize }) {
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  const pages = []
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i += 1) pages.push(i)
  } else {
    pages.push(1)
    if (page - 1 > 2) pages.push(-1)
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i += 1) pages.push(i)
    if (page + 1 < totalPages - 1) pages.push(-1)
    pages.push(totalPages)
  }

  return (
    <div style={styles.pager}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={styles.pagerText}>Showing {start} to {end} of {total} results</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={styles.pagerText}>Show:</span>
          <Picker value={String(pageSize)} onChange={(v) => onPageSize(Number(v))} style={{ width: 78, padding: '6px 8px' }}
            options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))} />
          <span style={styles.pagerText}>per page</span>
        </span>
      </span>

      {totalPages > 1 && (
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Action onClick={() => onPage(page - 1)} disabled={page <= 1}>Previous</Action>
          {pages.map((p, i) => (p === -1
            ? <span key={`gap-${i}`} style={{ ...styles.pagerText, padding: '0 4px' }}>…</span>
            : (
              <button key={p} onClick={() => onPage(p)}
                style={{
                  ...styles.pageBtn,
                  background: p === page ? '#15227a' : '#fff',
                  color: p === page ? '#fff' : SUB,
                  borderColor: p === page ? '#15227a' : LINE,
                }}>{p}</button>
            )))}
          <Action onClick={() => onPage(page + 1)} disabled={page >= totalPages}>Next</Action>
        </span>
      )}
    </div>
  )
}

/**
 * Export.
 *
 * Exports what the filters left on screen rather than the whole library — the
 * button sits beside them, and a file whose contents do not match the page the
 * reader was looking at is a file they have to check by hand.
 */
function exportCsv(rows) {
  const head = ['Code', 'Checklist', 'Standard', 'Category', 'Sections', 'Items', 'Critical items',
    'Scoring', 'Passing score', 'Asset level', 'Source', 'Author', 'Created', 'Status']
  const cell = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const body = rows.map((c) => [
    c.code, c.name, c.standard, c.category, c.sectionCount, c.itemCount, c.criticalCount,
    scoringLabel(c.scoringMethod), c.passingScore, c.assetLevel,
    c.source === 'system' ? 'System' : 'Organization', c.author,
    c.createdAt ? String(c.createdAt).slice(0, 10) : '', c.archived ? 'Archived' : 'Active',
  ].map(cell).join(','))

  const blob = new Blob([[head.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `inspection-checklists-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const styles = {
  tabRow: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 4 },
  tabs: { display: 'flex', gap: 0 },
  tab: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, whiteSpace: 'nowrap',
  },
  subToggle: { display: 'inline-flex', gap: 3, padding: 3, background: '#f1f5f9', borderRadius: 9 },
  subBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px',
    fontSize: 12, fontWeight: 700, fontFamily: 'inherit', border: 'none',
    borderRadius: 7, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  subCount: { padding: '1px 7px', borderRadius: 999, fontSize: 11, fontWeight: 700 },
  archivedHint: { fontSize: 12, color: MUTE },

  bulkBar: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    padding: '11px 14px', marginTop: 14, borderRadius: 10, background: '#f8fafc',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  bulkPick: { display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: SUB, cursor: 'pointer' },
  clearSel: {
    padding: '6px 11px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
    background: 'transparent', border: 'none', color: SUB, cursor: 'pointer',
  },
  bulkBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', color: '#fff',
    border: 'none', borderRadius: 9, cursor: 'pointer',
  },

  searchRow: { display: 'flex', gap: 9, alignItems: 'flex-start', flexWrap: 'wrap' },

  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 12 },

  // Grid, not flex — see COLUMNS. `alignItems: start` so a row with three lines
  // in one column does not push the others to its vertical centre.
  row: {
    display: 'grid', alignItems: 'start', columnGap: 14, rowGap: 0,
    padding: '13px 15px', borderRadius: 11, background: '#fff', width: '100%',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, cursor: 'pointer',
    textAlign: 'left', fontFamily: 'inherit',
  },
  listHead: {
    display: 'grid', columnGap: 14, padding: '0 15px 7px',
    fontSize: 10, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  rowTile: {
    width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center',
    background: '#f1f5f9', borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  // Right-aligned and wrapping upward, so the status pill sits under the
  // critical one rather than pushing the menu button off the row.
  rowBadges: {
    display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end',
    flexWrap: 'wrap', minWidth: 0, paddingTop: 2,
  },
  rowRef: {
    display: 'block', fontSize: 11, fontWeight: 700, color: '#15227a',
    fontVariantNumeric: 'tabular-nums', marginBottom: 2,
  },
  rowTitle: { display: 'block', fontSize: 13, fontWeight: 700, color: INK, lineHeight: 1.35 },
  rowStrong: { display: 'block', fontSize: 12.5, fontWeight: 600, color: INK, lineHeight: 1.35 },
  rowSub: { display: 'block', fontSize: 11, color: MUTE, marginTop: 2, lineHeight: 1.4 },

  card: {
    display: 'flex', flexDirection: 'column', padding: '15px 16px', borderRadius: 12,
    background: '#fff', borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
    cursor: 'pointer', minWidth: 0,
  },
  cardTitle: { fontSize: 14.5, fontWeight: 700, color: INK, lineHeight: 1.3, minWidth: 0 },
  cardWhat: { margin: '9px 0 0', fontSize: 12, color: SUB, lineHeight: 1.5 },
  cardFacts: {
    display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '9px 12px',
    marginTop: 12, paddingTop: 11, borderTop: `1px solid ${LINE}`,
  },
  factKey: { display: 'block', fontSize: 10, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 },
  factVal: { display: 'block', fontSize: 12.5, fontWeight: 700, color: INK, marginTop: 3, lineHeight: 1.35 },
  cardFoot: {
    display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10,
    borderTop: `1px solid ${LINE}`, fontSize: 11, color: MUTE,
  },

  menuVeil: { position: 'fixed', inset: 0, zIndex: 20 },
  menu: {
    position: 'absolute', right: 0, top: 34, zIndex: 21, minWidth: 186,
    display: 'flex', flexDirection: 'column', padding: 5, background: '#fff',
    borderRadius: 10, borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
    boxShadow: '0 12px 30px rgba(15,23,42,.14)',
  },
  menuItem: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
    fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', color: SUB,
    background: 'transparent', border: 'none', borderRadius: 7, cursor: 'pointer',
    textAlign: 'left', whiteSpace: 'nowrap',
  },

  pager: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    marginTop: 16, paddingTop: 14, borderTop: `1px solid ${LINE}`,
  },
  pagerText: { fontSize: 12, color: SUB },
  pageBtn: {
    width: 30, height: 30, fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1, borderRadius: 8, cursor: 'pointer', padding: 0,
  },

  empty: {
    padding: '40px 24px', textAlign: 'center', borderRadius: 12,
    borderStyle: 'dashed', borderWidth: 1, borderColor: '#dbe2ea', background: '#fcfdfe',
  },
  emptyTitle: { display: 'block', fontSize: 15, fontWeight: 700, color: SUB },
  emptyBody: { margin: '7px auto 14px', fontSize: 12.5, color: MUTE, lineHeight: 1.6, maxWidth: 460 },

  dialogBody: { margin: '0 0 18px', fontSize: 13, color: SUB, lineHeight: 1.6 },
  dialogActions: { display: 'flex', gap: 9, justifyContent: 'flex-end', flexWrap: 'wrap' },
}
