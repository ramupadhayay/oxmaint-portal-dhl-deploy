'use client'

// Incident Reports — reported, reviewed, closed.
//
// A safety incident that can only be listed is a filing cabinet. What makes it
// a record is that somebody picked it up, wrote down what was done about it and
// signed it off, so the drawer carries the whole life of the incident: start a
// review, raise the corrective work, close it with a statement of what was
// done. None of that changed.
//
// What changed is the front of the screen. It opens the way the product opens
// it — summary cards that are also cuts of the list, one filter card carrying
// the search, the filters and the active-filter badges, and rows that are read
// rather than scanned across columns. The days-since-lost-time figure survived
// the rewrite because it is the one number every plant puts on the wall, and a
// redesign that quietly drops it is a redesign that lost something.

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw, Download, Plus, AlertTriangle, TrendingUp, Timer, UserX,
} from 'lucide-react'
import {
  Drawer, Modal, Fields, StatusBadge, ActionButton, PALETTE,
} from '../lib/kit'
import { Button } from '../ui/button'
import StatTiles from '../components/StatTiles'
// Aliased: this file already imports an IncidentCard from the inline-styled kit,
// which the grid below no longer uses.
import ProductIncidentCard from '../components/IncidentCard'
import { sectionIcon } from '../lib/nav'
import { useRecords, useStore } from '../lib/store'
import { useActions } from '../lib/actions'
import { CreateModal } from '../lib/forms'
import { useSite } from '../lib/siteStore'
import { INCIDENTS, USER, fmtDate, daysUntil } from '../lib/data'
import {
  SummaryCards, InfoBlock, Action, Glyph, ListHeader, ViewToggle, SearchBar,
  Menu, MenuCheck, MenuLabel, useCardVisibility,
} from '../lib/productKit'
import { IncidentRow, IncidentCard, IncidentEmpty, styles } from '../lib/incidentKit'
import PageHeading from '../../datacenter/components/PageHeading'

const { MUTE, SUB, INK, LINE } = PALETTE

const idOf = (r) => r.incident_id || r.recordId

// Severity is about what happened; priority is about what happens next. A
// safety finding goes into the queue a band above the routine work sitting
// beside it, because the thing it is competing with is a filter change.
const PRIORITY_FROM_SEVERITY = { High: 'Critical', Medium: 'High', Low: 'Medium' }

// One place decides what a row's colour means, because the pill on the row, the
// pill on the card and the badge in the drawer all have to agree about a single
// incident.
const SEVERITY_TONE = { High: 'red', Medium: 'amber', Low: 'slate' }
const STATUS_TONE = { Open: 'red', 'Under Review': 'amber', Closed: 'slate' }

const SEVERITIES = ['High', 'Medium', 'Low']
const STATUSES = ['Open', 'Under Review', 'Closed']

// The product's five, with its fifth swapped for this register's own. There are
// no drafts here — an incident is reported or it is not — and lost time is the
// count this register exists to keep down.
// Look only — the counts and the predicates live on CARDS below.
const TILE_ICON = {
  total: AlertTriangle,
  thisMonth: TrendingUp,
  high: AlertTriangle,
  pending: Timer,
  lostTime: UserX,
}
const TILE_COLOR = {
  total: 'bg-slate-500',
  thisMonth: 'bg-blue-600',
  high: 'bg-red-600',
  pending: 'bg-amber-600',
  lostTime: 'bg-rose-700',
}
const TILE_NOTE = {
  total: 'All incidents in this site scope',
  thisMonth: 'Reported since the first of the month',
  high: 'High severity, whatever the outcome',
  pending: 'Not yet closed out',
  lostTime: 'Someone was put off work',
}

const CARDS = [
  { key: 'total', label: 'Total', icon: 'warning', keep: () => true },
  { key: 'thisMonth', label: 'This Month', icon: 'up', keep: (i) => i.reported_date >= startOfMonth() },
  { key: 'high', label: 'High Severity', icon: 'warning', alert: true, tone: 'red', keep: (i) => i.severity === 'High' },
  { key: 'pending', label: 'Pending', icon: 'clock', alert: true, tone: 'amber', keep: (i) => i.status !== 'Closed' },
  { key: 'lostTime', label: 'Lost Time', icon: 'cross', keep: (i) => Boolean(i.lost_time) },
]

const startOfMonth = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export default function Incidents() {
  const { scope, siteName } = useSite()
  const { create, update } = useStore()
  const { raiseWorkOrder } = useActions()

  const [creating, setCreating] = useState(false)
  const [shownCards, toggleCard] = useCardVisibility('oxIncidentSummaryCards', CARDS.map((c) => c.key))
  const [cut, setCut] = useState('total')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [severity, setSeverity] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [view, setView] = useState('list')
  const [openId, setOpenId] = useState(null)
  const [actions, setActions] = useState('')
  const [closing, setClosing] = useState(false)
  const [closureNote, setClosureNote] = useState('')

  const merged = useRecords('incident', INCIDENTS, idOf)
  const all = useMemo(() => scope(merged), [scope, merged])
  const open = useMemo(() => all.find((i) => idOf(i) === openId) || null, [all, openId])

  const counts = useMemo(() => {
    const out = {}
    for (const c of CARDS) out[c.key] = all.filter(c.keep).length
    return out
  }, [all])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const keep = (CARDS.find((c) => c.key === cut) || CARDS[0]).keep
    return all.filter((i) => (
      keep(i)
      && (status === 'all' || i.status === status)
      && (severity === 'all' || i.severity === severity)
      && (!q || [i.incident_number, i.title, i.asset_name, i.reported_by_name, i.site_name]
        .filter(Boolean).join(' ').toLowerCase().includes(q))
    ))
  }, [all, cut, search, status, severity])

  const activeFilters = [
    severity !== 'all' && { label: `Severity: ${severity}`, clear: () => setSeverity('all') },
    status !== 'all' && { label: `Status: ${status}`, clear: () => setStatus('all') },
    cut !== 'total' && { label: CARDS.find((c) => c.key === cut).label, clear: () => setCut('total') },
  ].filter(Boolean)
  const hasActiveFilters = activeFilters.length > 0 || Boolean(search.trim())
  const clearAll = () => { setSeverity('all'); setStatus('all'); setCut('total'); setSearch('') }

  // The noticeboard figure. Taken from the most recent incident actually marked
  // as lost time, so switching the toggle in the drawer resets the counter in
  // front of you — which is exactly what it does on the wall.
  const lastLostTime = all
    .filter((i) => i.lost_time)
    .reduce((latest, i) => (!latest || new Date(i.reported_date) > new Date(latest) ? i.reported_date : latest), null)
  const daysSinceLostTime = lastLostTime === null ? null : Math.abs(daysUntil(lastLostTime))

  const openRow = (row) => {
    const full = all.find((i) => idOf(i) === row.id) || null
    setOpenId(full ? idOf(full) : null)
    setActions(full?.immediate_actions || '')
  }

  const startReview = () => update('incident', openId, {
    status: 'Under Review',
    review_started_by_name: USER.name,
    review_started_date: new Date().toISOString(),
  })

  const saveActions = () => update('incident', openId, { immediate_actions: actions })

  const setLostTime = (value) => update('incident', openId, { lost_time: value })

  const cancelClose = () => { setClosing(false); setClosureNote('') }

  const closeIncident = async () => {
    await update('incident', openId, {
      status: 'Closed',
      closure_notes: closureNote,
      closed_by_name: USER.name,
      closed_date: new Date().toISOString(),
    })
    cancelClose()
  }

  const raiseCorrective = async () => {
    const wo = await raiseWorkOrder({
      title: `Corrective action — ${open.title}`,
      description: `Raised from incident ${open.incident_number} (${open.severity} severity) on ${open.asset_name}. `
        + `${open.immediate_actions || 'No immediate actions recorded.'}`,
      assetId: open.asset_id,
      type: 'Corrective',
      priority: PRIORITY_FROM_SEVERITY[open.severity] || 'High',
      dueInDays: open.severity === 'High' ? 2 : 7,
      estimatedHours: 4,
      source: `Incident ${open.incident_number}`,
    })
    if (wo) await update('incident', openId, { corrective_wo_number: wo.work_order_number })
  }

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Incident Reports</h1>
          <p className="text-slate-600 mt-1 text-sm md:text-base">
            Track and manage safety incidents to improve operational efficiency
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <Button variant="outline" className="h-10 px-4 gap-2" onClick={clearAll}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button variant="outline" className="h-10 px-4 gap-2" onClick={() => exportCsv(rows)}>
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button className="h-10 px-4 gap-2" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" />
            Report Incident
          </Button>
        </div>
      </motion.div>

      {/* The counts and the predicates behind them stay with the page, which
          already owns them for its own filtering — the tiles only draw. */}
      <StatTiles
        rows={all}
        activeCard={cut === 'total' ? null : cut}
        onCardClick={(k) => setCut(k || 'total')}
        storageKey="oxIncidentSummaryCards"
        cards={CARDS.map((c) => ({
          id: c.key,
          title: c.label,
          icon: TILE_ICON[c.key] || AlertTriangle,
          color: TILE_COLOR[c.key] || 'bg-slate-500',
          description: TILE_NOTE[c.key] || '',
          total: c.key === 'total',
          value: counts[c.key],
          match: c.key === 'total' ? null : c.keep,
        }))}
      />

      {/* The wall figure. Its own band rather than a sixth card, because it is
          not a cut of the list — there is nothing to show if you press it. */}
      <div style={{ marginBottom: 14 }}>
        <InfoBlock
          tone={daysSinceLostTime === null ? 'green' : daysSinceLostTime < 7 ? 'red' : daysSinceLostTime < 30 ? 'amber' : 'green'}
          icon="shield"
          label={daysSinceLostTime === null
            ? 'No lost-time incident on record'
            : `${daysSinceLostTime} day${daysSinceLostTime === 1 ? '' : 's'} since the last lost-time incident`}
        >
          {daysSinceLostTime === null
            ? `Nothing on this register at ${siteName} has been marked as lost time.`
            : `Last recorded on ${fmtDate(lastLostTime)}. Marking an incident as lost time in the record resets this figure.`}
        </InfoBlock>
      </div>

      {/* ── the filters card ──────────────────────────────────────────────── */}
      <div style={styles.filterCard}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search incident reports…" />

        <div style={styles.filterActions}>
          <Action icon="sliders" onClick={() => setShowFilters((v) => !v)}>
            Filters{activeFilters.length ? ` (${activeFilters.length})` : ''}
          </Action>
          {hasActiveFilters && (
            <button onClick={clearAll} style={styles.clear}>
              <Glyph name="cross" size={13} color="#b91c1c" />
              Clear
            </button>
          )}
          <span style={{ marginLeft: 'auto' }}>
            <ViewToggle value={view} onChange={setView} />
          </span>
        </div>

        <div style={styles.showing}>
          <span>
            Showing <strong style={{ color: INK }}>{rows.length}</strong> of{' '}
            <strong style={{ color: INK }}>{all.length}</strong> incidents
          </span>
          {rows.length !== all.length && (
            <span style={{ color: '#15227a', fontWeight: 700 }}>{all.length - rows.length} filtered out</span>
          )}
        </div>

        {activeFilters.length > 0 && (
          <div style={styles.badgeRow}>
            <span style={{ fontSize: 11.5, color: SUB }}>Active filters:</span>
            {activeFilters.map((f) => (
              <button key={f.label} onClick={f.clear} style={styles.badge}>
                {f.label}
                <Glyph name="cross" size={11} color="#15227a" />
              </button>
            ))}
          </div>
        )}

        {showFilters && (
          <div style={styles.filterGrid}>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>
                <Glyph name="warning" size={12} color={MUTE} /> Severity
              </span>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={styles.select}>
                <option value="all">All Severities</option>
                {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>
                <Glyph name="check" size={12} color={MUTE} /> Status
              </span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={styles.select}>
                <option value="all">All Statuses</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>

      <ListHeader icon="warning" title="Incidents" count={rows.length} />

      {rows.length === 0 ? (
        <IncidentEmpty
          filtered={hasActiveFilters}
          title={hasActiveFilters ? 'No incident reports found' : 'No incidents reported'}
          body={hasActiveFilters
            ? 'Try adjusting your search terms or filters to find what you’re looking for.'
            : `Nothing has been reported against ${siteName} recently.`}
          action={(
            <button onClick={() => setCreating(true)} style={styles.emptyBtn}>
              <Glyph name="warning" size={14} color="#fff" />
              Report Incident
            </button>
          )}
        />
      ) : (
        // One card in both views — three across or one. `i` itself, not
        // present(i): that presenter reshapes for the inline-styled card this
        // replaced, and its renamed fields leave the new one blank.
        <div className={view === 'grid'
          ? 'grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
          : 'grid gap-4 grid-cols-1'}>
          {rows.map((i, n) => (
            <ProductIncidentCard
              key={idOf(i)} incident={i} index={n}
              /* openRow looks the record up by row.id — the presented shape's
                 key, not the record's own — so it is handed that and nothing
                 else, rather than changing what every other caller passes. */
              onView={() => openRow({ id: idOf(i) })}
            />
          ))}
        </div>
      )}

      <Drawer
        open={Boolean(open)} onClose={() => setOpenId(null)}
        title={open?.incident_number} subtitle={open?.title}
        icon={sectionIcon('incidents', '#15227a')}
        width={500}
        footer={open && open.status !== 'Closed' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <ActionButton variant="ghost" onClick={raiseCorrective}>Raise corrective work</ActionButton>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {open.status === 'Open' && <ActionButton onClick={startReview}>Start review</ActionButton>}
              {open.status === 'Under Review' && <ActionButton variant="success" onClick={() => setClosing(true)}>Close</ActionButton>}
            </div>
          </div>
        ) : null}
      >
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatusBadge>{open.status}</StatusBadge>
              <StatusBadge>{open.severity}</StatusBadge>
              {open.lost_time && <StatusBadge tone="red">Lost time</StatusBadge>}
              {open.corrective_wo_number && <StatusBadge tone="blue">{open.corrective_wo_number}</StatusBadge>}
            </div>

            <Fields rows={[
              ['Asset', open.asset_name],
              ['Site', open.site_name],
              ['Reported by', open.reported_by_name],
              ['Reported', fmtDate(open.reported_date)],
              open.review_started_by_name ? ['Review started by', open.review_started_by_name] : null,
              open.closed_by_name ? ['Closed by', open.closed_by_name] : null,
            ]} />

            <div>
              <div style={styles.fieldLabel}>Immediate actions</div>
              <textarea
                value={actions}
                onChange={(e) => setActions(e.target.value)}
                onBlur={saveActions}
                rows={3}
                disabled={open.status === 'Closed'}
                placeholder="What was done at the time."
                style={{
                  width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '9px 11px',
                  fontSize: 12.5, fontFamily: 'inherit', lineHeight: 1.55, color: INK,
                  background: open.status === 'Closed' ? '#f8fafc' : '#fff',
                  borderStyle: 'solid', borderWidth: 1, borderColor: LINE, borderRadius: 9,
                  outline: 'none', resize: 'vertical',
                }}
              />
            </div>

            {open.status !== 'Closed' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, color: SUB }}>
                <input type="checkbox" checked={Boolean(open.lost_time)}
                  onChange={(e) => setLostTime(e.target.checked)} />
                Lost time — somebody was off work because of this
              </label>
            )}

            {open.closure_notes && (
              <div>
                <div style={styles.fieldLabel}>Closure</div>
                <p style={{ margin: '6px 0 0', fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>{open.closure_notes}</p>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <Modal open={closing} onClose={cancelClose} title="Close incident"
        footer={(
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <ActionButton variant="ghost" onClick={cancelClose}>Cancel</ActionButton>
            <ActionButton variant="success" disabled={!closureNote.trim()} onClick={closeIncident}>Close incident</ActionButton>
          </div>
        )}>
        <p style={{ margin: '0 0 10px', fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>
          Say what was done. A closed incident with no statement behind it is one nobody can learn from.
        </p>
        <textarea value={closureNote} onChange={(e) => setClosureNote(e.target.value)} rows={4}
          placeholder="What was done, and what stops it happening again."
          style={{
            width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
            fontFamily: 'inherit', lineHeight: 1.55, color: INK, background: '#fff',
            borderStyle: 'solid', borderWidth: 1, borderColor: LINE, borderRadius: 9,
            outline: 'none', resize: 'vertical',
          }} />
      </Modal>

      <CreateModal kind="incident" open={creating} onClose={() => setCreating(false)}
        onSubmit={(values) => create('incident', values)} />
    </div>
  )
}

/** One register row in the shape the shared list draws. */
function present(i) {
  const age = Math.abs(daysUntil(i.reported_date))
  const closed = i.status === 'Closed'
  const daysToClose = closed && i.closed_date
    ? Math.max(0, Math.round((new Date(i.closed_date) - new Date(i.reported_date)) / 86400000))
    : null

  return {
    id: i.incident_id || i.recordId,
    reference: i.incident_number,
    severity: i.severity,
    status: i.status,
    classification: i.lost_time ? 'Lost time' : null,
    description: i.title,
    rootCause: i.closure_notes || i.immediate_actions || null,
    facts: [
      { icon: 'box', label: i.asset_name },
      { icon: 'pin', label: i.site_name },
      { icon: 'user', label: i.reported_by_name },
      { icon: 'calendar', label: fmtDate(i.reported_date) },
      { icon: 'clock', label: closed && daysToClose != null ? `Closed in ${daysToClose}d` : `Open ${age}d` },
    ],
    metrics: [
      { value: closed && daysToClose != null ? `${daysToClose}d` : `${age}d`, label: closed ? 'Time to close' : 'Open for' },
      { value: i.corrective_wo_number ? '1' : '—', label: 'Corrective work' },
    ],
  }
}

function exportCsv(rows) {
  const head = ['Ref', 'Incident', 'Asset', 'Site', 'Severity', 'Lost time', 'Reported by', 'Date', 'Status', 'Corrective WO']
  const cell = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const body = rows.map((i) => [
    i.incident_number, i.title, i.asset_name, i.site_name, i.severity,
    i.lost_time ? 'Yes' : 'No', i.reported_by_name, i.reported_date, i.status,
    i.corrective_wo_number || '',
  ].map(cell).join(','))

  const blob = new Blob([[head.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'incident-reports.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
