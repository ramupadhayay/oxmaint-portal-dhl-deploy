'use client'

// Incident Reports.
//
// Built against the product's own screen rather than against the other list
// screens in this portal, because this one is shaped differently: a header with
// Refresh, Export and Report Incident; a row of summary cards that are controls
// rather than decoration; a filters card carrying the search, the cut and the
// "showing 12 of 18" line; then the reports themselves as cards, in a list or a
// grid, over a pager.
//
// The summary cards filter. Clicking Critical/Major narrows the list to those
// rows and clicking it again clears — which is why the count in the list header
// and the count in the "showing" line are the same number read two ways, and
// why Total is drawn as the active card on an unfiltered screen: it says "you
// are looking at all of them" rather than leaving the reader to infer it.
//
// Root cause is on the row, not only on the record. Half the value of this
// register to a quality lead is telling apart the events whose cause has been
// established from the ones still open, and that question should not need a
// click per row to answer.
//
// A row opens a page, not a drawer. An incident carries its investigation, its
// analysis, the corrective work raised off it and the action that closed it — a
// panel sliding over the list cannot be linked to, opened in a second tab or
// closed with the back button, all three of which somebody does in a review.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeading, PALETTE } from '../lib/kit'
import {
  SummaryCards, Action, ListHeader, ViewToggle, SearchBar, Glyph, Pill,
  Menu, MenuCheck, MenuLabel, useCardVisibility, TONE,
} from '../lib/productKit'
import { CLEANROOMS, FILTER_VIEW, USER, fmtDate } from '../lib/data'
import { useStore } from '../lib/store'
import {
  INCIDENT_TYPES, INCIDENT_SEVERITIES, INCIDENT_PRIORITIES, INCIDENT_IMPACTS,
  INCIDENT_STATUSES, PENDING_STATUSES, ROOM_CONDITIONS, ROOM_ACTIVITIES, FOUND_BY,
  useIncidents, createIncident, nextIncidentNumber,
} from '../lib/ops'

const { INK, SUB, MUTE, LINE } = PALETTE

const idOf = (r) => r.incidentId || r.recordId

// The five the product's IncidentAnalytics carries, in its order and under its
// own ids. Held at module scope because the visibility menu, the card row and
// the cut applied to the list all have to agree on the same five keys, and a
// list rebuilt inside the render is a list that can quietly disagree with the
// one persisted under the reader's choice.
// Only the two that ask for action carry colour — a critical or major event on
// the register, and one still waiting on somebody. The rest describe the shape
// of the register rather than a state to fix.
const CARDS = [
  { key: 'total', label: 'Total', icon: 'warning' },
  { key: 'thisMonth', label: 'This Month', icon: 'up' },
  { key: 'highCritical', label: 'Critical/Major', icon: 'warning', alert: true, tone: 'red' },
  { key: 'pending', label: 'Pending', icon: 'clock', alert: true, tone: 'amber' },
  { key: 'drafts', label: 'Drafts', icon: 'doc' },
]

// One place decides what a row's colour means, because the pill on the row, the
// pill on the card and the pill on the record all have to agree about a single
// incident. The product carries these as Tailwind classes; this portal has a
// six-tone palette instead, so they are mapped once rather than per screen.
const SEVERITY_TONE = { Critical: 'red', Major: 'amber', Minor: 'slate' }
const STATUS_TONE = {
  'Draft': 'slate',
  'Submitted': 'slate',
  'Open': 'amber',
  'Under investigation': 'amber',
  'RCA in progress': 'amber',
  'Actions in progress': 'amber',
  'Pending closure': 'amber',
  'Closed': 'slate',
  'Rejected': 'red',
  'Reopened': 'amber',
  'Escalated': 'red',
  'On hold': 'slate',
}

const startOfMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const timeOf = (r) => (String(r.raisedAt || '').includes('T') ? String(r.raisedAt).slice(11, 16) : null)

export default function Incidents() {
  const router = useRouter()
  const store = useStore()
  const all = useIncidents()

  const [shownCards, toggleCard] = useCardVisibility('hepaIncidentAnalyticsCards', CARDS.map((c) => c.key))
  const [cut, setCut] = useState('total')
  const [search, setSearch] = useState('')
  const [severity, setSeverity] = useState('all')
  const [status, setStatus] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [view, setView] = useState('list')
  const [creating, setCreating] = useState(false)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  const counts = useMemo(() => {
    const som = startOfMonth()
    return {
      total: all.length,
      thisMonth: all.filter((i) => String(i.date) >= som).length,
      highCritical: all.filter((i) => i.severity === 'Critical' || i.severity === 'Major').length,
      pending: all.filter((i) => PENDING_STATUSES.includes(i.status)).length,
      drafts: all.filter((i) => i.status === 'Draft').length,
    }
  }, [all])

  // The cut each summary card applies. Written beside the counts above so a card
  // and the list it opens cannot describe different sets.
  const CUTS = {
    total: () => true,
    thisMonth: (i) => String(i.date) >= startOfMonth(),
    highCritical: (i) => i.severity === 'Critical' || i.severity === 'Major',
    pending: (i) => PENDING_STATUSES.includes(i.status),
    drafts: (i) => i.status === 'Draft',
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const keep = CUTS[cut] || CUTS.total
    return all.filter((i) => (
      keep(i)
      && (severity === 'all' || i.severity === severity)
      && (status === 'all' || i.status === status)
      && (!q || [i.incidentId, i.description, i.cleanroomName, i.type, i.filterId, i.reportedBy]
        .filter(Boolean).join(' ').toLowerCase().includes(q))
    ))
  }, [all, cut, severity, status, search])

  const activeFilters = [
    search && { label: `Search: "${search}"`, clear: () => setSearch('') },
    severity !== 'all' && { label: `Severity: ${severity}`, clear: () => setSeverity('all') },
    status !== 'all' && { label: `Status: ${status}`, clear: () => setStatus('all') },
  ].filter(Boolean)

  const hasActiveFilters = activeFilters.length > 0 || cut !== 'total'

  const clearAll = () => { setSearch(''); setSeverity('all'); setStatus('all'); setCut('total'); setPage(0) }

  const refresh = () => {
    clearAll()
    store.notify('Incident data refreshed successfully')
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, totalPages - 1)
  const shown = rows.slice(current * pageSize, current * pageSize + pageSize)

  const open = (r) => router.push(`/portal/hepa/incidents/${idOf(r)}`)

  return (
    <div>
      <PageHeading
        title="Incident Reports"
        subtitle="Track and manage contamination incidents to improve operational efficiency"
        right={(
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Action icon="refresh" onClick={refresh}>Refresh</Action>
            <Action icon="download" onClick={() => exportCsv(rows)}>Export</Action>
            <Action icon="warning" primary onClick={() => setCreating((v) => !v)}>
              {creating ? 'Close form' : 'Report Incident'}
            </Action>
          </div>
        )}
      />

      {creating && (
        <NewIncidentForm
          existing={all}
          ready={store?.ready}
          onCancel={() => setCreating(false)}
          onSubmit={async (form) => {
            const saved = await createIncident(store, form, all)
            if (saved) {
              setCreating(false)
              router.push(`/portal/hepa/incidents/${saved.incidentId}`)
            }
            return saved
          }}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 11 }}>
        <Menu icon="sliders" label={`Summary Cards (${shownCards.length} visible)`}>
          <MenuLabel>Select cards to display</MenuLabel>
          {CARDS.map((c) => (
            <MenuCheck key={c.key} checked={shownCards.includes(c.key)} onChange={() => toggleCard(c.key)}>
              {c.label}
            </MenuCheck>
          ))}
        </Menu>
      </div>

      <SummaryCards
        active={cut}
        onPick={(k) => { setCut(k || 'total'); setPage(0) }}
        cards={CARDS.filter((c) => shownCards.includes(c.key))
          .map((c) => ({ ...c, value: counts[c.key] }))}
      />

      {/* ── the filters card ──────────────────────────────────────────────── */}
      <div style={styles.filterCard}>
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(0) }} placeholder="Search incident reports…" />

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
              <select value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(0) }} style={styles.select}>
                <option value="all">All Severities</option>
                {INCIDENT_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>
                <Glyph name="check" size={12} color={MUTE} /> Status
              </span>
              <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }} style={styles.select}>
                <option value="all">All Statuses</option>
                {INCIDENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>

      <ListHeader icon="warning" title="Incidents" count={rows.length} />

      {rows.length === 0 ? (
        <div style={styles.empty}>
          <span style={styles.emptyMark}><Glyph name="check" size={26} color="#059669" /></span>
          <h3 style={styles.emptyTitle}>
            {hasActiveFilters ? 'No incident reports found' : 'No incidents reported'}
          </h3>
          <p style={styles.emptyBody}>
            {hasActiveFilters
              ? 'Try adjusting your search terms or filters to find what you’re looking for.'
              : 'No contamination or deviation event has been reported against these cleanrooms recently.'}
          </p>
          {!hasActiveFilters && (
            <button onClick={() => setCreating(true)} style={styles.emptyBtn}>
              <Glyph name="warning" size={13} color="#fff" />
              Report First Incident
            </button>
          )}
        </div>
      ) : view === 'grid' ? (
        <div style={styles.grid}>
          {shown.map((r) => <IncidentCard key={idOf(r)} r={r} onOpen={open} />)}
        </div>
      ) : (
        <div style={styles.list}>
          {shown.map((r) => <IncidentRow key={idOf(r)} r={r} onOpen={open} />)}
        </div>
      )}

      {rows.length > 0 && (
        <div style={styles.pager}>
          <span style={{ fontSize: 11.5, color: MUTE }}>
            Showing {current * pageSize + 1} to {Math.min(rows.length, (current + 1) * pageSize)} of {rows.length} incidents
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 11.5, color: MUTE, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              Show
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0) }} style={styles.select}>
                {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              per page
            </label>
            <Action onClick={() => setPage(Math.max(0, current - 1))} disabled={current === 0}>Previous</Action>
            <span style={{ fontSize: 11.5, color: SUB, fontWeight: 700 }}>{current + 1} / {totalPages}</span>
            <Action onClick={() => setPage(Math.min(totalPages - 1, current + 1))} disabled={current >= totalPages - 1}>Next</Action>
          </span>
        </div>
      )}

      <p style={styles.footnote}>
        An incident closed with nothing written against it is a record saying the event
        was dealt with when nobody can say what was done. Open one and the corrective
        action is what closes it.
      </p>
    </div>
  )
}

/**
 * One row.
 *
 * The product's layout: reference, severity and state on the first line; the
 * asset, the room, the date and the two numbers on the second; the description
 * on the third. The fourth line is this portal's — the established cause, or
 * that there is none yet.
 */
function IncidentRow({ r, onOpen }) {
  const st = TONE[STATUS_TONE[r.status]] || TONE.slate
  return (
    <button onClick={() => onOpen(r)} style={styles.row}>
      <span style={{ ...styles.tile, background: st.bg, borderColor: st.bd }}>
        <Glyph name="warning" size={17} color={st.fg} />
      </span>

      <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <span style={styles.titleRow}>
          <strong style={styles.ref}>{r.incidentId}</strong>
          <Pill tone={SEVERITY_TONE[r.severity]}>{r.severity}</Pill>
          <Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill>
          {r.classification && <span style={styles.class}>{r.classification}</span>}
        </span>

        <span style={styles.metaRow}>
          <span style={styles.meta}>
            <Glyph name="box" size={12} color={MUTE} />
            {r.filterId || 'Room-wide'}
          </span>
          <span style={styles.meta}>
            <Glyph name="pin" size={12} color={MUTE} />
            {r.cleanroomName} · {r.isoClass}
          </span>
          <span style={styles.meta}>
            <Glyph name="calendar" size={12} color={MUTE} />
            {fmtDate(r.date)}{timeOf(r) ? ` ${timeOf(r)}` : ''}
          </span>
          <span style={styles.meta}>
            <Glyph name="clock" size={12} color={MUTE} />
            Downtime: {r.downtimeHours ? `${r.downtimeHours}h` : 'None'}
          </span>
          <span style={styles.meta}>
            {r.status === 'Closed'
              ? `Closed in ${r.daysToClose ?? 0}d`
              : `Open ${r._daysAgo ?? 0}d`}
          </span>
        </span>

        <span style={{ ...styles.desc, WebkitLineClamp: 1 }}>{r.description}</span>

        <span style={styles.cause}>
          <span style={styles.causeLabel}>Root cause</span>
          {r.rootCause || 'Not yet established.'}
        </span>
      </span>
    </button>
  )
}

/** The same incident as a card, for the grid view. */
function IncidentCard({ r, onOpen }) {
  return (
    <button onClick={() => onOpen(r)} style={styles.card}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, width: '100%' }}>
        <span style={{ ...styles.tile, width: 30, height: 30, background: '#f1f5f9', borderColor: LINE }}>
          <Glyph name="warning" size={15} color={SUB} />
        </span>
        <strong style={{ ...styles.ref, marginBottom: 0 }}>{r.incidentId}</strong>
      </span>

      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 9 }}>
        <Pill tone={SEVERITY_TONE[r.severity]}>{r.severity}</Pill>
        <Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill>
      </span>

      <span style={{ ...styles.desc, marginTop: 0, WebkitLineClamp: 2 }}>{r.description}</span>

      <span style={styles.metricGrid}>
        <span style={styles.metric}>
          <span style={styles.metricValue}>{r.downtimeHours ? `${r.downtimeHours}h` : '—'}</span>
          <span style={styles.metricLabel}>Downtime</span>
        </span>
        <span style={styles.metric}>
          <span style={styles.metricValue}>
            {r.status === 'Closed' ? `${r.daysToClose ?? 0}d` : `${r._daysAgo ?? 0}d`}
          </span>
          <span style={styles.metricLabel}>{r.status === 'Closed' ? 'Time to close' : 'Open for'}</span>
        </span>
      </span>

      <span style={styles.cardFacts}>
        <span style={styles.meta}><Glyph name="box" size={12} color={MUTE} />{r.filterId || 'Room-wide'}</span>
        <span style={styles.meta}><Glyph name="pin" size={12} color={MUTE} />{r.cleanroomName}</span>
        <span style={styles.meta}><Glyph name="user" size={12} color={MUTE} />{r.reportedBy}</span>
        <span style={styles.meta}><Glyph name="calendar" size={12} color={MUTE} />{fmtDate(r.date)}</span>
        {r.attachments?.length > 0 && (
          <span style={styles.meta}>
            <Glyph name="doc" size={12} color={MUTE} />
            {r.attachments.length} attachment{r.attachments.length > 1 ? 's' : ''}
          </span>
        )}
      </span>
    </button>
  )
}

/**
 * Report an incident.
 *
 * The product's field order, kept: when, then what it happened to, then what it
 * was, then how bad, then the numbers, then the description. Classification is
 * not on the form — it follows from the type, which is what keeps the register
 * countable by it.
 *
 * The product opens this in a dialog. Here it is a sheet under the header,
 * because every other create form in this portal is one and a single modal
 * would be the odd screen out.
 */
function NewIncidentForm({ existing, ready, onCancel, onSubmit }) {
  const today = new Date().toISOString().slice(0, 10)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    date: today,
    time: '09:00',
    cleanroomId: CLEANROOMS[0]?.cleanroomId || '',
    filterId: '',
    type: INCIDENT_TYPES[0].type,
    area: '',
    roomActivity: ROOM_ACTIVITIES[0],
    severity: INCIDENT_TYPES[0].severity,
    priority: 'High',
    status: 'Draft',
    roomCondition: ROOM_CONDITIONS[0],
    downtimeHours: '',
    productImpact: INCIDENT_TYPES[0].impact,
    operator: '',
    foundBy: FOUND_BY[0],
    description: '',
    equipmentDamage: '',
    additionalComments: '',
    attachments: [],
  })

  const set = (patch) => setForm((p) => ({ ...p, ...patch }))

  // Picking the type moves severity and impact with it. They stay editable —
  // this occurrence may be worse or lighter than the type usually is — but the
  // form should not open on a seal breach rated Minor.
  const pickType = (type) => {
    const kind = INCIDENT_TYPES.find((k) => k.type === type)
    set({ type, severity: kind.severity, productImpact: kind.impact })
  }

  const roomFilters = FILTER_VIEW.filter((f) => !form.cleanroomId || f.cleanroomId === form.cleanroomId)
  const kind = INCIDENT_TYPES.find((k) => k.type === form.type)

  const submit = async () => {
    setBusy(true)
    await onSubmit(form)
    setBusy(false)
  }

  return (
    <div style={styles.sheet}>
      <div style={styles.sheetHead}>
        <Glyph name="warning" size={17} color="#ea7317" />
        <h3 style={styles.sheetTitle}>Report New Incident</h3>
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: MUTE }}>
          {nextIncidentNumber(existing)} · raised as {USER.name}
        </span>
      </div>

      <div style={styles.formGrid}>
        <Field label="Incident Date *">
          <input type="date" max={today} value={form.date} onChange={(e) => set({ date: e.target.value })} style={styles.input} />
        </Field>
        <Field label="Incident Time *">
          <input type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} style={styles.input} />
        </Field>
      </div>

      <div style={styles.formGrid}>
        <Field label="Location — the cleanroom">
          <select value={form.cleanroomId} onChange={(e) => set({ cleanroomId: e.target.value, filterId: '' })} style={styles.input}>
            {CLEANROOMS.map((c) => <option key={c.cleanroomId} value={c.cleanroomId}>{c.cleanroomId} — {c.name} ({c.isoClass})</option>)}
          </select>
        </Field>
        <Field label="Associated Filter — where it is one filter">
          <select value={form.filterId} onChange={(e) => set({ filterId: e.target.value })} style={styles.input}>
            <option value="">No filter selected — room-wide</option>
            {roomFilters.map((f) => <option key={f.filterId} value={f.filterId}>{f.filterId}{f.concern ? ` — ${f.concern}` : ''}</option>)}
          </select>
        </Field>
      </div>

      <div style={styles.formGrid3}>
        <Field label="Incident Type *">
          <select value={form.type} onChange={(e) => pickType(e.target.value)} style={styles.input}>
            {INCIDENT_TYPES.map((k) => <option key={k.type} value={k.type}>{k.type}</option>)}
          </select>
          <span style={styles.hint}>Classified as {kind.classification}.</span>
        </Field>
        <Field label="Incident Area">
          <input value={form.area} onChange={(e) => set({ area: e.target.value })} placeholder="e.g. Filling zone" style={styles.input} />
        </Field>
        <Field label="Room Activity">
          <select value={form.roomActivity} onChange={(e) => set({ roomActivity: e.target.value })} style={styles.input}>
            {ROOM_ACTIVITIES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>
      </div>

      <div style={styles.formGrid4}>
        <Field label="Severity Rating *">
          <select value={form.severity} onChange={(e) => set({ severity: e.target.value })} style={styles.input}>
            {INCIDENT_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Priority *">
          <select value={form.priority} onChange={(e) => set({ priority: e.target.value })} style={styles.input}>
            {INCIDENT_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={(e) => set({ status: e.target.value })} style={styles.input}>
            {INCIDENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Room Condition">
          <select value={form.roomCondition} onChange={(e) => set({ roomCondition: e.target.value })} style={styles.input}>
            {ROOM_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>

      <div style={styles.formGrid4}>
        <Field label="Downtime (hours)">
          <input type="number" min={0} value={form.downtimeHours} onChange={(e) => set({ downtimeHours: e.target.value })}
            placeholder="Enter downtime in hours" style={styles.input} />
        </Field>
        <Field label="Product Impact">
          <select value={form.productImpact} onChange={(e) => set({ productImpact: e.target.value })} style={styles.input}>
            {INCIDENT_IMPACTS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </Field>
        <Field label="Operator Name">
          <input value={form.operator} onChange={(e) => set({ operator: e.target.value })} placeholder="Who was in the room" style={styles.input} />
        </Field>
        <Field label="Found By">
          <select value={form.foundBy} onChange={(e) => set({ foundBy: e.target.value })} style={styles.input}>
            {FOUND_BY.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Incident Description *">
        <textarea rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })}
          placeholder="Provide a detailed description of the incident…" style={{ ...styles.input, resize: 'vertical' }} />
      </Field>

      <Field label="Equipment Damages">
        <textarea rows={2} value={form.equipmentDamage} onChange={(e) => set({ equipmentDamage: e.target.value })}
          placeholder="Describe any equipment damages…" style={{ ...styles.input, resize: 'vertical' }} />
      </Field>

      <Field label="Additional Comments">
        <textarea rows={2} value={form.additionalComments} onChange={(e) => set({ additionalComments: e.target.value })}
          placeholder="Any additional comments or notes…" style={{ ...styles.input, resize: 'vertical' }} />
      </Field>

      <Attachments
        rows={form.attachments}
        onChange={(attachments) => set({ attachments })}
      />

      <div style={styles.sheetFooter}>
        <span style={{ flex: '1 1 240px', fontSize: 11.5, color: MUTE, lineHeight: 1.55 }}>
          Filed as {form.status}. Nothing is investigated until somebody opens it —
          the root cause and the action that closes it are recorded on the record itself.
        </span>
        <Action onClick={onCancel}>Cancel</Action>
        <button onClick={submit} disabled={busy || !ready || !form.description.trim()}
          style={{ ...styles.primary, opacity: busy || !ready || !form.description.trim() ? 0.5 : 1 }}>
          {busy ? 'Creating…' : 'Create Incident Report'}
        </button>
      </div>
    </div>
  )
}

/**
 * Attachments.
 *
 * The product uploads files and validates the extension against the chosen
 * type. This portal stores records rather than files, so what is captured is
 * the reference — what the document is called, what kind it is and what it
 * shows. A file picker that dropped the file on submit would be worse than
 * saying plainly that the reference is what is held.
 */
function Attachments({ rows, onChange }) {
  const add = () => onChange([...rows, { name: '', type: 'Document', description: '' }])
  const set = (i, patch) => onChange(rows.map((r, n) => (n === i ? { ...r, ...patch } : r)))
  const remove = (i) => onChange(rows.filter((_, n) => n !== i))

  return (
    <div style={styles.attachCard}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Glyph name="doc" size={15} color="#15227a" />
        <strong style={{ fontSize: 13, color: INK }}>Attachments</strong>
      </div>

      {rows.map((r, i) => (
        <div key={i} style={styles.attachRow}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ fontSize: 12, color: SUB }}>Attachment {i + 1}</strong>
            <button onClick={() => remove(i)} style={styles.removeBtn}>Remove</button>
          </div>
          <div style={styles.formGrid}>
            <Field label="Document reference">
              <input value={r.name} onChange={(e) => set(i, { name: e.target.value })}
                placeholder="e.g. EM-trend-CR-101.pdf" style={styles.input} />
            </Field>
            <Field label="Type">
              <select value={r.type} onChange={(e) => set(i, { type: e.target.value })} style={styles.input}>
                {['Document', 'Report', 'Photo', 'Video', 'Other'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Description">
            <input value={r.description} onChange={(e) => set(i, { description: e.target.value })}
              placeholder="Describe this attachment…" style={styles.input} />
          </Field>
        </div>
      ))}

      <button onClick={add} style={styles.addBtn}>
        <Glyph name="doc" size={13} color={SUB} />
        Add Attachment
      </button>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ minWidth: 0, marginBottom: 11 }}>
      <div style={styles.label}>{label}</div>
      {children}
    </div>
  )
}

/**
 * Export.
 *
 * What is on screen rather than the whole register — the button sits beside the
 * filters, and a file that ignores them is a file whose numbers do not match the
 * page the reader was looking at when they asked for it.
 */
function exportCsv(rows) {
  const head = [
    'Incident', 'Type', 'Classification', 'Severity', 'Priority', 'Status',
    'Cleanroom', 'ISO class', 'Filter', 'Area', 'Date', 'Reported by',
    'Found by', 'Downtime hours', 'Product impact', 'Root cause', 'Corrective action',
  ]
  const cell = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const body = rows.map((r) => [
    r.incidentId, r.type, r.classification, r.severity, r.priority || '', r.status,
    r.cleanroomName, r.isoClass, r.filterId || '', r.area || '', r.date, r.reportedBy,
    r.foundBy, r.downtimeHours ?? 0, r.productImpact, r.rootCause || '', r.capa || '',
  ].map(cell).join(','))

  const blob = new Blob([[head.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `incident-reports-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const styles = {
  filterCard: {
    background: '#fff', borderRadius: 12, padding: '14px 16px 4px', marginBottom: 4,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  filterActions: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 },
  clear: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fecaca', background: '#fef2f2',
    color: '#b91c1c', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  showing: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    fontSize: 12, color: SUB, marginBottom: 12,
  },
  badgeRow: { display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 },
  badge: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px',
    fontSize: 11, fontWeight: 700, fontFamily: 'inherit', borderRadius: 999,
    background: '#eef2ff', color: '#15227a', cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#c7d2fe',
  },
  filterGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12,
    paddingTop: 12, borderTop: `1px solid ${LINE}`, marginBottom: 4,
  },
  field: { display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, marginBottom: 11 },
  fieldLabel: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  select: {
    padding: '8px 10px', fontSize: 12.5, fontWeight: 600, color: INK, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, borderRadius: 9,
    fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
  },

  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 10 },

  row: {
    display: 'flex', alignItems: 'flex-start', gap: 13, padding: '13px 15px',
    borderRadius: 11, background: '#fff', width: '100%', textAlign: 'left',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  tile: {
    width: 36, height: 36, borderRadius: 9, display: 'grid', placeItems: 'center',
    borderStyle: 'solid', borderWidth: 1, flexShrink: 0,
  },
  titleRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 },
  ref: {
    display: 'block', fontSize: 13, fontWeight: 800, color: '#15227a',
    fontVariantNumeric: 'tabular-nums', marginBottom: 2,
  },
  class: { fontSize: 11, color: MUTE, fontWeight: 600 },
  metaRow: { display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 6 },
  meta: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: MUTE, minWidth: 0 },
  // Clamped the way the product clamps it: one line on a row, two on a card.
  // A description that runs to five lines turns the list into a wall and the
  // whole point of the list is scanning it.
  desc: {
    display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden',
    fontSize: 12.5, color: INK, lineHeight: 1.55, marginTop: 2,
  },
  cause: {
    display: 'block', fontSize: 11.5, color: SUB, lineHeight: 1.5, marginTop: 7,
    paddingTop: 7, borderTop: `1px solid ${LINE}`,
  },
  // Set as written rather than upper-cased like the portal's other micro-labels.
  // Everything else this label sits beside is a heading; this one is read as
  // part of the sentence after it, and "ROOT CAUSE Gasket displacement…" is a
  // shout followed by a statement.
  causeLabel: {
    display: 'inline-block', fontSize: 10.5, fontWeight: 800, color: MUTE, marginRight: 8,
  },

  card: {
    display: 'flex', flexDirection: 'column', padding: '14px 15px', borderRadius: 11,
    background: '#fff', borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', minWidth: 0,
  },
  metricGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 11,
    padding: '10px 12px', borderRadius: 9, background: '#f8fafc',
  },
  metric: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 0 },
  metricValue: { fontSize: 17, fontWeight: 800, color: INK, fontVariantNumeric: 'tabular-nums' },
  metricLabel: { fontSize: 10.5, color: MUTE },
  cardFacts: { display: 'flex', flexDirection: 'column', gap: 5, marginTop: 11 },

  empty: {
    padding: '40px 20px', textAlign: 'center', borderRadius: 11,
    borderStyle: 'dashed', borderWidth: 1, borderColor: '#dbe2ea', background: '#fcfdfe',
  },
  emptyMark: {
    display: 'grid', placeItems: 'center', width: 48, height: 48, borderRadius: 999,
    background: '#ecfdf5', margin: '0 auto 12px',
  },
  emptyTitle: { margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: INK },
  emptyBody: { margin: '0 auto', maxWidth: 460, fontSize: 12.5, color: MUTE, lineHeight: 1.6 },
  emptyBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 15, padding: '9px 16px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
    background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer',
  },

  pager: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    marginTop: 13, paddingTop: 12, borderTop: `1px solid ${LINE}`,
  },

  sheet: {
    background: '#fbfcff', borderRadius: 12, padding: '18px 20px', marginBottom: 14,
    borderStyle: 'solid', borderWidth: 1, borderColor: '#c7d2fe',
  },
  sheetHead: { display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 14 },
  sheetTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: INK },
  sheetFooter: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    marginTop: 14, paddingTop: 13, borderTop: `1px solid ${LINE}`,
  },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 },
  formGrid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 },
  formGrid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 },
  label: {
    fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase',
    letterSpacing: 0.4, marginBottom: 5,
  },
  hint: { display: 'block', fontSize: 10.5, color: MUTE, marginTop: 4 },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '8px 11px', fontSize: 12.5,
    fontFamily: 'inherit', lineHeight: 1.5, color: INK, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, borderRadius: 9, outline: 'none',
  },
  primary: {
    padding: '9px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
    border: 'none', borderRadius: 9, background: '#15227a', color: '#fff', cursor: 'pointer',
  },

  attachCard: {
    padding: '13px 15px', borderRadius: 10, background: '#fff', marginBottom: 4,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  attachRow: {
    padding: '11px 13px', borderRadius: 9, marginBottom: 9, background: '#fbfcfd',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  removeBtn: {
    marginLeft: 'auto', padding: '4px 10px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
    borderRadius: 7, background: '#fef2f2', color: '#b91c1c', cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fecaca',
  },
  addBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    width: '100%', padding: '9px 13px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
    borderRadius: 9, background: '#fff', color: SUB, cursor: 'pointer',
    borderStyle: 'dashed', borderWidth: 1, borderColor: LINE,
  },

  footnote: {
    fontSize: 11.5, color: MUTE, margin: '14px 2px 0', paddingTop: 12,
    borderTop: `1px solid ${LINE}`, lineHeight: 1.55,
  },
}
