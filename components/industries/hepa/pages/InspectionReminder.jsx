'use client'

// Inspection Reminders.
//
// Ported from the product's own screen rather than from an idea of what a
// reminder list should look like. That distinction cost this file a rewrite:
// the first version was a KPI strip, a table and a drawer, and the product has
// none of those three. It has a header with Export / Refresh / Create Reminder,
// an org-level switch under it, a summary-card row you can hide, three tabs
// carrying counts, a filter card that applies its search on submit, a bulk
// action bar, cards rather than rows, and its own pagination footer.
//
// What is swapped is the data and nothing else. The product's asset is this
// site's HEPA filter and its location is the cleanroom, so the labels stay
// "Asset" and "Location" and the values change — which is also why picking a
// filter locks the cleanroom to that filter's room, exactly as picking an asset
// locks the location in the product.
//
// The one rule this screen is built on: every due judgement is recomputed from
// `dueDate`. The seeded rows carry `_daysAway` and `status` fixed at the moment
// the module loaded, and both are wrong the instant a row is rolled forward. A
// row the register seeded and a row somebody rolled this morning have to read
// identically, so nothing here trusts a stored derivation.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeading, PALETTE } from '../lib/kit'
import {
  SummaryCards, AlertBand, Action, ListHeader, Glyph, Pill,
  Menu, MenuCheck, MenuLabel, useCardVisibility, TONE, Z,
} from '../lib/productKit'
import { CLEANROOMS, FILTER_VIEW, TECHNICIANS, fmtDate, daysFromToday } from '../lib/data'
import { TODAY } from '../lib/anchor'
import { useStore } from '../lib/store'
import {
  INSPECTION_REMINDERS, INSPECTION_REPORTS, ROUND_TYPES, roundById, checklistSteps,
} from '../lib/data/inspections'
import { TEMPLATES, templateForRound } from '../lib/checklists'

const { INK, SUB, MUTE, LINE } = PALETTE

export const KIND = 'hepa_inspection'

// The org-level switch is one row rather than a per-reminder setting, and this
// portal's store has no settings kind. It is written under the inspection kind
// with neither a reminderId nor a reportId, which is precisely what makes both
// registers ignore it — the reminder list skips rows with no reminderId and
// Inspection Reports skips rows with no reportId.
const SETTING_ID = 'inspection-auto-wo'

const DAY = 86400000
const dayOffset = (n) => new Date(TODAY + n * DAY).toISOString().slice(0, 10)

/**
 * The one due rule. Every screen that judges a reminder goes through here.
 */
export const dueState = (days) => (
  days < 0 ? 'Overdue' : days <= 2 ? 'Due today' : days <= 7 ? 'Due this week' : 'Scheduled'
)

/** The four bands the product's Next Due card sorts a reminder into. */
export const priorityOf = (days) => (
  days < 0 ? 'Overdue' : days <= 3 ? 'Urgent' : days <= 7 ? 'Due Soon' : 'Upcoming'
)

export const DUE_TONE = {
  Overdue: 'red', 'Due today': 'amber', 'Due this week': 'amber', Scheduled: 'blue',
}
export const PRIORITY_TONE = {
  Overdue: 'red', Urgent: 'amber', 'Due Soon': 'amber', Upcoming: 'green',
}

/**
 * Which document a change to this reminder is written against.
 *
 * A reminder that shipped in the bundle has no document until the first change
 * creates one, so its reference is the key. A reminder raised in the portal
 * already has one, under the id the database gave it — and patching that by its
 * reference would write a *second* document describing the same reminder, which
 * the merge then has to resolve by luck rather than by rule.
 */
export const keyOf = (r) => r.recordId || r.reminderId

/** The row as both screens read it, with every derived field recomputed. */
export function shapeReminder(row) {
  const away = daysFromToday(row.dueDate)
  return {
    ...row,
    _daysAway: away,
    _overdue: away < 0,
    _asepticCore: row.isoClass === 'ISO 5',
    status: dueState(away),
    // Active until somebody archives it. A seeded row carries no flag, so the
    // absence of one means active rather than unknown.
    isActive: row.isActive !== false,
    // A daily or weekly round raises its own next inspection; the monthly and
    // quarterly ones are booked by a person. Read off the interval so a
    // reminder created in the portal answers this the same way a seeded one does.
    autoGenerate: (row.intervalDays || 0) <= 7,
  }
}

/**
 * The reminder register: what shipped, with whatever has been done to it since.
 *
 * Reminders and filed rounds share one record kind here because they share one
 * in the product — a reminder is the next occurrence of a round, not a
 * different sort of thing. What tells them apart is which identity the row
 * carries: a reminder has a reminderId, a filed round has a reportId.
 */
export function useReminders() {
  const store = useStore()
  const stored = store?.records?.[KIND] || []

  return useMemo(() => {
    const byId = new Map(INSPECTION_REMINDERS.map((r) => [r.reminderId, r]))
    for (const row of stored) {
      if (!row.reminderId) continue
      byId.set(row.reminderId, { ...(byId.get(row.reminderId) || {}), ...row })
    }
    return [...byId.values()]
      .filter((r) => !r._deleted)
      .map(shapeReminder)
      .sort((a, b) => a._daysAway - b._daysAway)
  }, [stored])
}

/**
 * The checklist a reminder is walked against.
 *
 * Asked of the row rather than of the round, because a reminder raised in the
 * portal can name a checklist off the library that belongs to no scheduled
 * round — and a reminder whose checklist could not be found is one the product
 * refuses to create an inspection from, which would be the wrong answer here.
 *
 * The code is read back off the register rather than generated, so the reminder
 * names the checklist by the same code the reports already carry.
 * `checklistSteps` is asked for the item count because the library is being
 * moved from flat lists to a sections tree, and reading `.items` directly is how
 * a screen ends up reporting nought steps and rendering perfectly.
 */
export function checklistFor(r) {
  const template = (r?.checklistId && TEMPLATES.find((t) => t.id === r.checklistId))
    || templateForRound(r?.roundId)
  if (!template) return null
  const code = INSPECTION_REPORTS.find((x) => x.checklistId === template.id)?.checklistCode || null
  return { ...template, code, steps: checklistSteps(template) }
}

/**
 * When this schedule started running, and who walked the first one.
 *
 * Off the register rather than stamped on the row: the earliest round of this
 * type in this room is the point the schedule has been running from. A round
 * nobody has walked yet falls back to one interval before its due date, which
 * is where it would have been raised.
 */
export function originOf(r) {
  const first = INSPECTION_REPORTS
    .filter((x) => x._walked && x.roundId === r.roundId && x.cleanroomId === r.cleanroomId
      && (r.filterId ? x.filterId === r.filterId : true))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))[0]
  if (first) return { by: first.inspector, on: first.date }
  return { by: r.assignedTo, on: dayOffset((daysFromToday(r.dueDate) || 0) - (r.intervalDays || 30)) }
}

/** The rounds this reminder has generated — the product's `inspections` list. */
export function inspectionsFor(r, stored = []) {
  const byId = new Map(INSPECTION_REPORTS
    .filter((x) => x.roundId === r.roundId && x.cleanroomId === r.cleanroomId
      && (r.filterId ? x.filterId === r.filterId : true))
    .map((x) => [x.reportId, x]))
  for (const x of stored) {
    if (!x.reportId) continue
    if (x.fromReminder !== r.reminderId && !byId.has(x.reportId)) continue
    byId.set(x.reportId, { ...(byId.get(x.reportId) || {}), ...x })
  }
  return [...byId.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

export const REPORT_STATUS_TONE = {
  Completed: 'green', 'Open finding': 'red', 'In Progress': 'blue',
  Scheduled: 'amber', Overdue: 'amber',
}

/** The next reference in the report register's own sequence. */
export const nextReportNumber = (stored) => {
  const filed = stored.filter((r) => r.reportId
    && !INSPECTION_REPORTS.some((s) => s.reportId === r.reportId)).length
  return `INS-${3000 + INSPECTION_REPORTS.length + filed}`
}

const PAGE_SIZES = [10, 20, 30, 40, 50]

// The three the product's InspectionReminderSummary carries, under its own ids.
// Held at module scope because the reader's stored choice is keyed on them: a
// list rebuilt each render alongside the counts is one that can quietly stop
// matching what was persisted.
const CARD_KEYS = ['total', 'active', 'inactive']

export default function InspectionReminder() {
  const router = useRouter()
  const store = useStore()
  const stored = store?.records?.[KIND] || []

  const all = useReminders()

  const [tab, setTab] = useState('active')
  const [shownCards, toggleCard] = useCardVisibility('hepaReminderSummaryCards', CARD_KEYS)
  const [cardFilter, setCardFilter] = useState('total')

  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    due: 'all', assignedTo: 'all', round: 'all', cleanroom: 'all',
  })

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [nextDuePage, setNextDuePage] = useState(1)
  const [nextDuePageSize, setNextDuePageSize] = useState(50)

  const [selected, setSelected] = useState(() => new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(null)
  const [creating, setCreating] = useState(false)

  const autoWorkOrder = Boolean(stored.find((r) => r.recordId === SETTING_ID)?.autoWorkOrder)

  const activeCount = all.filter((r) => r.isActive).length
  const archivedCount = all.length - activeCount
  const overdue = all.filter((r) => r.isActive && r._overdue)
  const overdueInCore = overdue.filter((r) => r._asepticCore)

  // The tab decides the is_active slice, exactly as it does in the product —
  // the Active tab never shows an archived reminder even when a card filter
  // says otherwise.
  const inTab = useMemo(
    () => all.filter((r) => (tab === 'archived' ? !r.isActive : r.isActive)),
    [all, tab],
  )

  const rows = useMemo(() => {
    const q = appliedSearch.trim().toLowerCase()
    return inTab.filter((r) => (
      (filters.due === 'all' || r.status === filters.due)
      && (filters.assignedTo === 'all' || r.assignedTo === filters.assignedTo)
      && (filters.round === 'all' || r.roundId === filters.round)
      && (filters.cleanroom === 'all' || r.cleanroomId === filters.cleanroom)
      && (!q || [r.reminderId, r.round, r.standard, r.cleanroomName, r.filterId, r.assignedTo,
        r.frequency, roundById(r.roundId)?.what].filter(Boolean).join(' ').toLowerCase().includes(q))
    ))
  }, [inTab, appliedSearch, filters])

  // The product's Next Due tab is its own list with its own pagination: what is
  // coming up, soonest first, rather than the whole register re-sorted.
  const nextDue = useMemo(
    () => all.filter((r) => r.isActive && r._daysAway <= 30).slice().sort((a, b) => a._daysAway - b._daysAway),
    [all],
  )

  const totalPages = Math.ceil(rows.length / pageSize)
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize)
  const nextDueRows = nextDue.slice((nextDuePage - 1) * nextDuePageSize, nextDuePage * nextDuePageSize)

  const activeFilterCount = (appliedSearch ? 1 : 0)
    + Object.values(filters).filter((v) => v !== 'all').length

  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.reminderId))

  const goTab = (next) => {
    setTab(next)
    setSelected(new Set())
    setPage(1)
  }

  const applySearch = () => {
    setAppliedSearch(searchInput.trim())
    setPage(1)
  }

  const clearFilters = () => {
    setFilters({ due: 'all', assignedTo: 'all', round: 'all', cleanroom: 'all' })
    setSearchInput('')
    setAppliedSearch('')
    setPage(1)
  }

  const refresh = () => {
    store.refresh?.()
    store.notify?.('Inspection reminders refreshed successfully')
  }

  // The three cards are the is_active axis, which is also what the tabs cut on.
  // So clicking one switches tab rather than leaving the reader on a list the
  // tab has already emptied — the product's own reasoning, and its own bug to
  // have avoided.
  const pickCard = (key) => {
    const next = key || 'total'
    setCardFilter(next)
    setPage(1)
    setSelected(new Set())
    goTab(next === 'inactive' ? 'archived' : 'active')
  }

  const openReminder = (r) => {
    // An archived reminder is not openable in the product — it says so and
    // sends you to restore it first, rather than showing a record that cannot
    // be acted on.
    if (!r.isActive) {
      setBlocked(r)
      return
    }
    router.push(`/portal/hepa/inspection-reminder/${r.reminderId}`)
  }

  const toggleSelect = (id, on) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const selectAllOnPage = (on) => {
    setSelected(on ? new Set(pageRows.map((r) => r.reminderId)) : new Set())
  }

  const runBulk = async () => {
    const archiving = tab === 'active'
    setBusy(true)
    for (const id of selected) {
      const row = all.find((r) => r.reminderId === id)
      if (!row) continue
      // The patch carries the reminderId as well as the flag: a stored row is
      // only recognised as a reminder by the identity it holds, and a patch
      // that carried only `isActive` would come back from the database as a
      // record neither register could place.
      await store.update(KIND, keyOf(row), { reminderId: id, isActive: !archiving })
    }
    setBusy(false)
    setConfirmBulk(false)
    const n = selected.size
    setSelected(new Set())
    store.notify?.(archiving
      ? `${n} reminders archived successfully`
      : `${n} reminders restored successfully`)
  }

  const removeReminder = async (r) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Are you sure you want to delete this inspection reminder?')) return
    // Written as a tombstone rather than a hard delete, because most of these
    // rows ship in the bundle and are not in the database to be removed. The
    // register holds the delta; this is the delta that says "gone".
    const saved = await store.update(KIND, keyOf(r), { reminderId: r.reminderId, _deleted: true })
    store.notify?.(saved
      ? 'Inspection reminder deleted successfully'
      : 'Failed to delete inspection reminder', saved ? 'ok' : 'error')
  }

  /**
   * Create an inspection from a reminder.
   *
   * Two writes, and the order matters. The round is booked onto the report
   * register, and the reminder moves on by its own interval — which is what a
   * reminder is for. If only one of the two survives, the one worth keeping is
   * the reminder: it is what the facility works from tomorrow, whereas a
   * missing round can be booked again.
   */
  const createInspection = async (r) => {
    const type = roundById(r.roundId)
    const days = r.intervalDays || type?.everyDays || 30
    const checklist = checklistFor(r)
    const reference = nextReportNumber(stored)

    await store.update(KIND, keyOf(r), {
      reminderId: r.reminderId,
      dueDate: dayOffset(days),
      nextAfter: dayOffset(days * 2),
    })

    const created = await store.create(KIND, {
      reportId: reference,
      roundId: r.roundId,
      round: r.round,
      standard: r.standard,
      frequency: r.frequency,
      cleanroomId: r.cleanroomId,
      cleanroomName: r.cleanroomName,
      isoClass: r.isoClass,
      filterId: r.filterId || null,
      appliesTo: r.appliesTo,
      date: dayOffset(0),
      assignee: r.assignedTo,
      inspector: null,
      result: null,
      score: null,
      scorePoints: null,
      maxScore: checklist?.steps?.length || 0,
      findings: [],
      findingsCount: 0,
      // Nothing has been answered, signed or found, because nobody has walked
      // it yet. Written as empty rather than left off: the report screens read
      // these fields, and an absent array is a different bug from an empty one.
      results: [],
      sectionsWalked: 0,
      recommendedActions: null,
      followUpRequired: false,
      followUpDate: null,
      signatureCaptured: false,
      signedBy: null,
      // The room's conditions are written by the technician at the round, so a
      // booked round has none. They stay unset rather than being guessed —
      // a temperature nobody measured is worse than a blank one.
      temperature: null,
      humidity: null,
      checklistId: checklist?.id || null,
      checklistName: checklist?.name || r.round,
      checklistCode: checklist?.code || null,
      checklistSteps: checklist?.steps?.length || 0,
      notes: `Inspection created from Reminder. ${type?.what || ''}`.trim(),
      status: 'Scheduled',
      durationMinutes: null,
      // What the round is booked to take, by the register's own rule — five
      // minutes a step. The report screens show the planned figure until an
      // actual one exists, and a round created without it reads as "undefined
      // min" on a page nobody would think to blame this screen for.
      plannedMinutes: Math.max(15, (checklist?.steps?.length || 0) * 5),
      _walked: false,
      _pending: true,
      _overdue: false,
      _failed: false,
      fromReminder: r.reminderId,
    })

    if (!created) {
      store.notify?.('Failed to create inspection from reminder', 'error')
      return
    }
    store.notify?.('Inspection created successfully from reminder')
    router.push(`/portal/hepa/inspections/${reference}`)
  }

  // Values change every render; the keys do not. CARD_KEYS is what the
  // visibility menu and the reader's stored choice agree on, so it lives at
  // module scope rather than being rebuilt here alongside the counts.
  const cards = [
    // None of the three is an alert: total, active and archived describe how
    // the register is divided, not something to act on. What needs attention
    // here is overdue, and that has its own band under these cards.
    { key: 'total', label: 'Total Reminders', value: all.length, icon: 'clipboard' },
    { key: 'active', label: 'Active', value: activeCount, icon: 'check' },
    { key: 'inactive', label: 'Archived', value: archivedCount, icon: 'cross' },
  ]

  return (
    <div>
      <PageHeading
        title="Inspection Reminders"
        subtitle="Manage and schedule your inspection reminder interval efficiently."
        right={(
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Action icon="download" onClick={() => exportCsv(rows)}>Export</Action>
            <Action icon="refresh" onClick={refresh}>Refresh</Action>
            <Action primary onClick={() => setCreating(true)}>
              <LocalIcon name="plus" size={14} color="#fff" />Create Reminder
            </Action>
          </div>
        )}
      />

      {/* Org-level rather than per-reminder: the rule applies to every round
          the site walks, so it is one switch above the list. */}
      <div style={styles.settingRow}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div style={styles.settingLabel}>Auto-create Work Order for failed inspections</div>
          <p style={styles.settingHelp}>
            When enabled, completing an inspection with failed or out-of-spec items automatically
            creates a work order for those items.
          </p>
        </div>
        <Toggle
          checked={autoWorkOrder}
          disabled={!store.ready}
          onChange={async (checked) => {
            const saved = await store.update(KIND, SETTING_ID, {
              setting: 'auto_wo_failed_inspection', autoWorkOrder: checked,
            })
            store.notify?.(saved ? 'Auto-create Work Order setting saved' : 'Failed to save setting',
              saved ? 'ok' : 'error')
          }}
        />
      </div>

      {/* Contextual to the active side of the register. Hidden on Archived, where
          "Active: 34 / Archived: 4" beside a list of four is a misleading pair. */}
      {tab !== 'archived' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 11 }}>
            <Menu icon="sliders" label={`Summary Cards (${shownCards.length} visible)`}>
              <MenuLabel>Select cards to display</MenuLabel>
              {cards.map((c) => (
                <MenuCheck key={c.key} checked={shownCards.includes(c.key)} onChange={() => toggleCard(c.key)}>
                  {c.label}
                </MenuCheck>
              ))}
            </Menu>
          </div>
          <SummaryCards
            cards={cards.filter((c) => shownCards.includes(c.key))}
            active={cardFilter}
            onPick={pickCard}
          />
        </>
      )}

      {overdue.length > 0 && (
        <AlertBand
          tone="red"
          title={`${overdue.length} Overdue Inspection Reminder${overdue.length > 1 ? 's' : ''}`}
          onClick={() => { goTab('active'); setFilters((p) => ({ ...p, due: 'Overdue' })); setShowFilters(true) }}
        >
          {overdue.length > 1 ? 'These rounds require' : 'This round requires'} immediate attention to
          maintain compliance.
          {overdueInCore.length > 0 && ` ${overdueInCore.length} of them ${overdueInCore.length > 1 ? 'are' : 'is'} in the ISO 5 aseptic core, where a round that has slipped is a batch question rather than a housekeeping one.`}
        </AlertBand>
      )}

      <Tabs
        value={tab}
        onChange={goTab}
        items={[
          { key: 'active', label: 'Active', icon: 'list', count: activeCount },
          { key: 'next-due', label: 'Next Due', icon: 'flat', count: nextDue.length },
          { key: 'archived', label: 'Archived', icon: 'archive', count: archivedCount },
        ]}
      />

      {tab === 'next-due' ? (
        <>
          <div style={styles.list}>
            {nextDueRows.map((r) => (
              <NextDueCard key={r.reminderId} r={r} onOpen={() => openReminder(r)} />
            ))}
          </div>

          {nextDueRows.length === 0 && (
            <Empty
              icon="bell"
              title="No Upcoming Reminders"
              body="There are no inspection reminders due in the near future"
            />
          )}

          <Pagination
            page={nextDuePage}
            totalPages={Math.ceil(nextDue.length / nextDuePageSize)}
            pageSize={nextDuePageSize}
            total={nextDue.length}
            itemType="next due inspection reminders"
            onPage={setNextDuePage}
            onPageSize={(n) => { setNextDuePageSize(n); setNextDuePage(1) }}
          />
        </>
      ) : (
        <>
          <Filters
            search={searchInput}
            onSearch={setSearchInput}
            onSubmit={applySearch}
            expanded={showFilters}
            onExpand={() => setShowFilters((v) => !v)}
            filters={filters}
            onChange={(patch) => { setFilters((p) => ({ ...p, ...patch })); setPage(1) }}
            appliedSearch={appliedSearch}
            onClearSearch={() => { setSearchInput(''); setAppliedSearch(''); setPage(1) }}
            activeCount={activeFilterCount}
            onClear={clearFilters}
            shown={rows.length}
            total={inTab.length}
          />

          {pageRows.length > 0 && (
            <BulkActionBar
              mode={tab === 'archived' ? 'restore' : 'archive'}
              selectedCount={selected.size}
              allOnPageSelected={allOnPageSelected}
              onSelectAll={selectAllOnPage}
              onClear={() => setSelected(new Set())}
              onConfirm={() => setConfirmBulk(true)}
              busy={busy}
            />
          )}

          <ListHeader
            icon="bell"
            title={tab === 'archived' ? 'Archived Reminders' : 'Inspection Reminders'}
            count={rows.length}
          />

          <div style={styles.list}>
            {pageRows.map((r) => (
              <ReminderCard
                key={r.reminderId}
                r={r}
                stored={stored}
                selected={selected.has(r.reminderId)}
                onSelect={(on) => toggleSelect(r.reminderId, on)}
                onOpen={() => openReminder(r)}
                onEdit={() => openReminder(r)}
                onDelete={() => removeReminder(r)}
                onCreateInspection={() => createInspection(r)}
              />
            ))}
          </div>

          {pageRows.length === 0 && (
            tab === 'archived' ? (
              <Empty
                icon="archive"
                title="No Archived Reminders"
                body="Reminders you archive from the Active tab will appear here. You can restore them anytime."
              />
            ) : (
              <Empty
                icon="bell"
                title={inTab.length === 0 ? 'No Inspection Reminders Found' : 'No Matching Reminders'}
                body={inTab.length === 0
                  ? 'Get started by adding your first inspection reminder'
                  : 'Try adjusting your filters to see more results'}
                action={inTab.length === 0
                  ? (
                    <Action primary onClick={() => setCreating(true)}>
                      <LocalIcon name="plus" size={14} color="#fff" />Add First Reminder
                    </Action>
                  )
                  : null}
              />
            )
          )}

          <Pagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            total={rows.length}
            itemType="inspection reminders"
            onPage={(n) => { setPage(n); setSelected(new Set()) }}
            onPageSize={(n) => { setPageSize(n); setPage(1); setSelected(new Set()) }}
          />
        </>
      )}

      <Modal
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        title={tab === 'archived'
          ? `Restore ${selected.size} reminders?`
          : `Archive ${selected.size} reminders?`}
        width={460}
        footer={(
          <>
            <Action onClick={() => setConfirmBulk(false)} disabled={busy}>Cancel</Action>
            <button onClick={runBulk} disabled={busy}
              style={{ ...styles.confirmBtn, background: tab === 'archived' ? '#059669' : '#ea7317' }}>
              {busy ? 'Processing...' : tab === 'archived' ? 'Restore' : 'Archive'}
            </button>
          </>
        )}
      >
        <p style={styles.dialogBody}>
          {tab === 'archived'
            ? 'Selected reminders will be moved back to the Active tab and notifications will resume on their next scheduled run.'
            : 'Selected reminders will be moved to the Archived tab and will stop sending notifications. You can restore them anytime.'}
        </p>
      </Modal>

      <Modal
        open={Boolean(blocked)}
        onClose={() => setBlocked(null)}
        title="Reminder Archived"
        width={430}
        footer={<Action primary onClick={() => setBlocked(null)}>OK</Action>}
      >
        <p style={styles.dialogBody}>
          This inspection reminder has been archived. To view its details, please restore it from
          the Archived tab.
        </p>
      </Modal>

      {creating && (
        <CreateReminderModal
          onClose={() => setCreating(false)}
          existing={all}
          ready={store.ready}
          onCreate={async (payload) => {
            const saved = await store.create(KIND, payload)
            if (!saved) return
            store.notify?.('Inspection reminder created successfully')
            setCreating(false)
            router.push(`/portal/hepa/inspection-reminder/${payload.reminderId}`)
          }}
        />
      )}
    </div>
  )
}

/* ── the reminder card ────────────────────────────────────────────────────── */

function ReminderCard({ r, stored, selected, onSelect, onOpen, onEdit, onDelete, onCreateInspection }) {
  const [confirm, setConfirm] = useState(false)
  const type = roundById(r.roundId)
  const checklist = checklistFor(r)
  const origin = originOf(r)
  const generated = inspectionsFor(r, stored)

  return (
    <div style={styles.card} onClick={onOpen} role="button" tabIndex={-1}>
      <div style={styles.cardHead}>
        <span onClick={(e) => e.stopPropagation()} style={{ paddingTop: 3 }}>
          <Check checked={selected} onChange={onSelect} label={`Select reminder ${r.round}`} />
        </span>

        <span style={{ flex: 1, minWidth: 0 }}>
          <h3 style={styles.cardTitle}>{r.round} ({r.reminderId})</h3>
          <span style={styles.cardDesc}>
            <span style={{ color: MUTE }}>Description: </span>
            {r.description || type?.what}
          </span>
        </span>

        <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <Pill tone="slate">{r.isActive ? 'Active' : 'Archived'}</Pill>
          {r.autoGenerate && (
            <span style={styles.outlinePill}>
              <Glyph name="check" size={12} color={SUB} /> Auto Generate
            </span>
          )}
          <RowMenu items={[
            { label: 'View Details', icon: 'eye', onClick: onOpen },
            { label: 'Edit', icon: 'pencil', onClick: onEdit },
            { label: 'Delete', icon: 'trash', onClick: onDelete, danger: true },
          ]} />
        </span>
      </div>

      <div style={styles.cardGrid}>
        <Fact icon="user" value={r.assignedTo} />
        <Fact icon="bell" label="Notification" value={r.notifyAt || '—'} />
        <Fact icon="calendar" label="Next Due Date" value={fmtDate(r.dueDate)} />
      </div>

      {/* Asset is drawn only where there is one, as the product draws it. A
          room-wide round has no unit to name, and a dash in its place reads as
          a missing value rather than as a round that covers the whole room. */}
      <div style={styles.cardGrid}>
        {r.filterId && <Fact icon="box" label="Asset" value={r.filterId} />}
        <Fact icon="pin" label="Location" value={`${r.cleanroomName} (${r.isoClass})`} />
        <Fact icon="check" label="Checklist"
          value={checklist ? `${checklist.name}${checklist.code ? ` (${checklist.code})` : ''}` : '—'} />
      </div>

      <div style={styles.recurrence}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <LocalIcon name="repeat" size={14} color="#2563eb" />
          <strong style={{ fontSize: 12.5, color: INK }}>Recurrence Schedule (1):</strong>
        </span>
        <div style={{ marginTop: 6, fontSize: 12.5, color: SUB }}>
          1. {r.frequency} — every {r.intervalDays} day{r.intervalDays > 1 ? 's' : ''}, against {r.standard}
        </div>
      </div>

      {generated.length > 0 && (
        <div style={styles.generated}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Glyph name="clipboard" size={14} color="#059669" />
            <strong style={{ fontSize: 12.5, color: INK }}>Generated Inspections ({generated.length}):</strong>
          </span>
          <div style={{ marginTop: 6 }}>
            {generated.slice(0, 3).map((g, i) => (
              <div key={g.reportId} style={styles.generatedRow}>
                <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>{i + 1}. {g.reportId}</span>
                <Pill tone={REPORT_STATUS_TONE[g.status] || 'slate'}>{g.status}</Pill>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: MUTE }}>{fmtDate(g.date)}</span>
              </div>
            ))}
            {generated.length > 3 && (
              <div style={{ fontSize: 11.5, color: MUTE, marginTop: 4 }}>
                And {generated.length - 3} more...
              </div>
            )}
          </div>
        </div>
      )}

      <div style={styles.cardFoot}>
        <span style={{ fontSize: 11, color: MUTE }}>
          Created by {origin.by} on {fmtDate(origin.on)}
        </span>
        <span onClick={(e) => e.stopPropagation()} style={{ marginLeft: 'auto' }}>
          <button onClick={() => setConfirm(true)} disabled={!r.isActive}
            style={{ ...styles.secondaryBtn, opacity: r.isActive ? 1 : 0.5 }}>
            <Glyph name="clipboard" size={13} color={SUB} />
            Create Inspection
          </button>
        </span>
      </div>

      <span onClick={(e) => e.stopPropagation()}>
        <Modal
          open={confirm}
          onClose={() => setConfirm(false)}
          title={checklist
            ? 'Are you sure you want to create an inspection from this reminder?'
            : 'Checklist required'}
          width={470}
          footer={checklist ? (
            <>
              <Action icon="cross" onClick={() => setConfirm(false)}>No</Action>
              <Action icon="check" primary onClick={() => { setConfirm(false); onCreateInspection() }}>Yes</Action>
            </>
          ) : <Action primary onClick={() => setConfirm(false)}>OK</Action>}
        >
          {checklist ? (
            <p style={styles.dialogBody}>
              The round is booked against {r.filterId || r.cleanroomName} as {checklist.name}, and
              this reminder moves on {r.intervalDays} day{r.intervalDays > 1 ? 's' : ''} to its next
              occurrence.
            </p>
          ) : (
            <p style={{ ...styles.dialogBody, color: '#b91c1c' }}>
              Reminder does not have a checklist assigned. Cannot create inspection.
            </p>
          )}
        </Modal>
      </span>
    </div>
  )
}

/* ── the next due card ────────────────────────────────────────────────────── */

function NextDueCard({ r, onOpen }) {
  const priority = priorityOf(r._daysAway)
  const tone = TONE[PRIORITY_TONE[priority]] || TONE.slate
  const checklist = checklistFor(r)
  const type = roundById(r.roundId)

  const when = r._daysAway < 0
    ? `Overdue by ${Math.abs(r._daysAway)} day(s)`
    : r._daysAway === 0 ? 'Due Today'
      : r._daysAway === 1 ? 'Due Tomorrow'
        : `Due in ${r._daysAway} day(s)`

  return (
    <div style={{ ...styles.card, borderColor: tone.bd, background: priority === 'Upcoming' ? '#fff' : tone.bg }}
      onClick={onOpen} role="button" tabIndex={-1}>
      <div style={styles.cardHead}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <h3 style={styles.cardTitle}>{r.round} ({r.reminderId})</h3>
          <div style={{ ...styles.cardGrid, marginTop: 8 }}>
            <Fact icon="user" value={r.assignedTo} />
            <Fact icon="calendar" label="Due Date"
              value={<span style={{ color: tone.fg, fontWeight: 700 }}>{fmtDate(r.dueDate)}</span>} />
            <Fact icon="clock" label="Status" value={<span style={{ color: tone.fg, fontWeight: 700 }}>{when}</span>} />
          </div>
        </span>

        <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <span style={{ ...styles.priorityPill, background: tone.fg }}>
            {priority === 'Overdue' && <Glyph name="warning" size={11} color="#fff" />}
            {priority}
          </span>
          <RowMenu items={[{ label: 'View Details', icon: 'eye', onClick: onOpen }]} />
        </span>
      </div>

      <div style={styles.cardGrid}>
        <Fact icon="doc" label="Checklist"
          value={checklist ? `${checklist.name}${checklist.code ? ` (${checklist.code})` : ''}` : '—'} />
        {r.filterId && <Fact icon="box" label="Asset" value={r.filterId} />}
        <Fact icon="pin" label="Location" value={`${r.cleanroomName} (${r.isoClass})`} />
      </div>

      <div style={{ paddingTop: 10, borderTop: `1px solid ${LINE}` }}>
        <p style={{ margin: 0, fontSize: 12, color: SUB, lineHeight: 1.55 }}>
          <strong style={{ color: INK }}>Description: </strong>{r.description || type?.what}
        </p>
      </div>

      {(r._overdue || r._daysAway <= 7) && (
        <div style={{ ...styles.priorityAlert, background: tone.bg, borderColor: tone.fg, color: tone.fg }}>
          <Glyph name="warning" size={14} color={tone.fg} />
          <span style={{ fontWeight: 700, fontSize: 12 }}>
            {r._overdue
              ? 'This reminder is overdue and requires immediate attention'
              : r._daysAway <= 3
                ? 'This reminder is due very soon'
                : 'This reminder is approaching its due date'}
          </span>
        </div>
      )}
    </div>
  )
}

/* ── the filter card ──────────────────────────────────────────────────────── */

function Filters({
  search, onSearch, onSubmit, expanded, onExpand, filters, onChange,
  appliedSearch, onClearSearch, activeCount, onClear, shown, total,
}) {
  const badges = []
  if (appliedSearch) badges.push({ label: `Search: "${appliedSearch}"`, onRemove: onClearSearch })
  if (filters.due !== 'all') badges.push({ label: `Due: ${filters.due}`, onRemove: () => onChange({ due: 'all' }) })
  if (filters.assignedTo !== 'all') badges.push({ label: `Assigned To: ${filters.assignedTo}`, onRemove: () => onChange({ assignedTo: 'all' }) })
  if (filters.round !== 'all') badges.push({ label: `Round: ${roundById(filters.round)?.name || filters.round}`, onRemove: () => onChange({ round: 'all' }) })
  if (filters.cleanroom !== 'all') {
    const name = CLEANROOMS.find((c) => c.cleanroomId === filters.cleanroom)?.name || filters.cleanroom
    badges.push({ label: `Location: ${name}`, onRemove: () => onChange({ cleanroom: 'all' }) })
  }

  return (
    <div style={styles.filterCard}>
      <div style={styles.filterTop}>
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <span style={styles.searchIcon}><Glyph name="search" size={15} color={MUTE} /></span>
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSubmit() }}
            placeholder="Search Reminder Title, Description, Assigned To Name, Interval Type"
            style={styles.searchInput}
          />
        </div>

        <button onClick={onSubmit} style={styles.searchBtn}>
          <Glyph name="search" size={14} color={SUB} /> Search
        </button>

        <Action icon="sliders" onClick={onExpand}>
          Filters{activeCount > 0 ? ` (${activeCount})` : ''}
        </Action>

        {activeCount > 0 && (
          <button onClick={onClear} style={styles.clearBtn}>
            <Glyph name="cross" size={13} color="#b91c1c" /> Clear
          </button>
        )}
      </div>

      <div style={styles.resultsLine}>
        Showing <strong style={{ color: INK }}>{shown}</strong> of{' '}
        <strong style={{ color: INK }}>{total}</strong> inspection reminders
      </div>

      {badges.length > 0 && (
        <div style={styles.badgeRow}>
          <span style={{ fontSize: 12, color: SUB }}>Active filters:</span>
          {badges.map((b) => (
            <button key={b.label} onClick={b.onRemove} style={styles.filterBadge}>
              {b.label} <Glyph name="cross" size={11} color="#15227a" />
            </button>
          ))}
        </div>
      )}

      {expanded && (
        <div style={styles.filterGrid}>
          {/* The product's date axis here is the created date. This register's
              rows are read forward rather than backward — a reminder matters for
              when it is next due — so the axis is the due window, and the round
              and the cleanroom take the two slots the product gives to teams and
              departments, which this facility does not have. */}
          <FilterField icon="clock" label="Due">
            <select value={filters.due} onChange={(e) => onChange({ due: e.target.value })} style={styles.select}>
              <option value="all">All due states</option>
              <option value="Overdue">Overdue</option>
              <option value="Due today">Due today</option>
              <option value="Due this week">Due this week</option>
              <option value="Scheduled">Scheduled</option>
            </select>
          </FilterField>

          <FilterField icon="user" label="Assigned To">
            <select value={filters.assignedTo} onChange={(e) => onChange({ assignedTo: e.target.value })} style={styles.select}>
              <option value="all">All members</option>
              {TECHNICIANS.map((t) => <option key={t.technicianId} value={t.name}>{t.name}</option>)}
            </select>
          </FilterField>

          <FilterField icon="clipboard" label="Round">
            <select value={filters.round} onChange={(e) => onChange({ round: e.target.value })} style={styles.select}>
              <option value="all">All rounds</option>
              {ROUND_TYPES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </FilterField>

          <FilterField icon="pin" label="Location">
            <select value={filters.cleanroom} onChange={(e) => onChange({ cleanroom: e.target.value })} style={styles.select}>
              <option value="all">All locations</option>
              {CLEANROOMS.map((c) => <option key={c.cleanroomId} value={c.cleanroomId}>{c.name}</option>)}
            </select>
          </FilterField>
        </div>
      )}
    </div>
  )
}

/* ── bulk action bar ──────────────────────────────────────────────────────── */

function BulkActionBar({ mode, selectedCount, allOnPageSelected, onSelectAll, onClear, onConfirm, busy }) {
  const archive = mode === 'archive'
  return (
    <div style={styles.bulkBar}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Check checked={allOnPageSelected} onChange={onSelectAll} label="Select all on this page" />
        <button onClick={() => onSelectAll(!allOnPageSelected)} style={styles.bulkLabel}>
          {selectedCount > 0 ? `${selectedCount} selected` : 'Select all on this page'}
        </button>
      </span>

      <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
        {selectedCount > 0 && (
          <button onClick={onClear} disabled={busy} style={styles.ghostBtn}>
            <Glyph name="cross" size={13} color={SUB} /> Clear
          </button>
        )}
        <button onClick={onConfirm} disabled={selectedCount === 0 || busy}
          style={{
            ...styles.confirmBtn,
            background: archive ? '#ea7317' : '#059669',
            opacity: selectedCount === 0 || busy ? 0.5 : 1,
          }}>
          <LocalIcon name={archive ? 'archive' : 'restore'} size={13} color="#fff" />
          {archive ? 'Archive Selected' : 'Restore Selected'}
        </button>
      </span>
    </div>
  )
}

/* ── pagination ───────────────────────────────────────────────────────────── */

export function Pagination({ page, totalPages, pageSize, total, itemType, onPage, onPageSize }) {
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
            : (
              <PageBtn key={p} onClick={() => onPage(p)} current={p === page}>{p}</PageBtn>
            )))}
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

/* ── the create modal ─────────────────────────────────────────────────────── */

/**
 * Create Inspection Reminder.
 *
 * The product's four cards, in its order: Basic Information, Asset / Location &
 * Checklist, Assignment, Recurrence Schedule.
 *
 * Two things about the middle card carry straight over from the product. An
 * asset and a location are mutually exclusive, and choosing the asset fills the
 * location from it and locks it — here, choosing a filter fills in the room that
 * filter serves. And the checklist grid is tabbed: what is linked to the thing
 * you picked, what this organisation wrote, and what came from the library.
 */
function CreateReminderModal({ onClose, onCreate, existing, ready }) {
  const [form, setForm] = useState(() => ({
    title: '',
    description: '',
    notifyAt: '07:00',
    isActive: true,
    sendEmail: true,
    filterId: '',
    cleanroomId: '',
    checklistId: '',
    assignedTo: '',
    intervals: [{ type: 'Weekly', days: 7 }],
  }))
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  const filter = form.filterId ? FILTER_VIEW.find((f) => f.filterId === form.filterId) : null
  const cleanroomId = filter ? filter.cleanroomId : form.cleanroomId
  const cleanroom = cleanroomId ? CLEANROOMS.find((c) => c.cleanroomId === cleanroomId) : null

  const template = form.checklistId ? TEMPLATES.find((t) => t.id === form.checklistId) : null

  const setField = (patch) => setForm((p) => ({ ...p, ...patch }))

  const validate = () => {
    const next = {}
    if (!form.title.trim()) next.title = 'Inspection Reminder title is required'
    if (!form.notifyAt) next.notifyAt = 'Inspection Notification Time is required'
    if (!form.checklistId) next.checklist = 'Inspection Checklist Selection is required'
    if (!form.filterId && !form.cleanroomId) next.subject = 'Either Asset or Location must be selected'
    if (!form.assignedTo) next.assignment = 'An inspection reminder must be assigned to someone. Choose an assignee.'
    form.intervals.forEach((iv, i) => {
      if (!iv.days || iv.days < 1 || iv.days > 366) next[`interval_${i}`] = 'Value must be between 1 and 366'
    })
    setErrors(next)
    setSubmitted(true)
    return Object.keys(next).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    setSaving(true)

    // The shortest schedule wins: a reminder carrying two intervals fires on
    // whichever comes round first, so that is the one the due date is set from.
    const days = Math.min(...form.intervals.map((iv) => iv.days))
    const roundId = template?.roundId || null
    const type = roundId ? roundById(roundId) : null

    await onCreate({
      reminderId: `REM-${4000 + existing.length}`,
      roundId,
      round: form.title.trim(),
      standard: template?.standard || 'Site SOP',
      frequency: form.intervals[0].type,
      intervalDays: days,
      cleanroomId: cleanroom?.cleanroomId || '',
      cleanroomName: cleanroom?.name || '',
      isoClass: cleanroom?.isoClass || '',
      filterId: form.filterId || null,
      appliesTo: form.filterId ? 'filter' : 'room',
      // Held on the row rather than inferred from the round: a reminder can be
      // raised against a library checklist that belongs to no scheduled round.
      checklistId: form.checklistId,
      dueDate: dayOffset(days),
      nextAfter: dayOffset(days * 2),
      notifyAt: form.notifyAt,
      assignedTo: form.assignedTo,
      description: form.description.trim() || type?.what || null,
      sendEmail: form.sendEmail,
      isActive: form.isActive,
      last: null,
    })
    setSaving(false)
  }

  return (
    <Modal
      open
      onClose={onClose}
      icon="bell"
      title="Create Inspection Reminder"
      width={880}
      footer={(
        <>
          <Action icon="cross" onClick={onClose} disabled={saving}>Cancel</Action>
          <Action icon="check" primary onClick={submit} disabled={saving || !ready}>
            {saving ? 'Creating...' : 'Create Reminder'}
          </Action>
        </>
      )}
    >
      <FormCard icon="sliders" title="Basic Information">
        <div style={styles.formGrid}>
          <Field label="Reminder Title" required error={errors.title} span={2}>
            <input
              value={form.title}
              onChange={(e) => setField({ title: e.target.value })}
              placeholder="e.g., Pressure cascade round"
              style={{ ...styles.input, borderColor: errors.title ? '#dc2626' : LINE }}
            />
          </Field>
          <Field label="Active Reminder">
            <Toggle checked={form.isActive} onChange={(v) => setField({ isActive: v })} />
          </Field>
          <Field label="Email Notification">
            <Toggle checked={form.sendEmail} onChange={(v) => setField({ sendEmail: v })} />
          </Field>
        </div>

        <div style={{ ...styles.formGrid, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
          <Field label="Description">
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setField({ description: e.target.value })}
              placeholder="Add any additional notes or instructions..."
              style={{ ...styles.input, resize: 'vertical' }}
            />
          </Field>
          <Field label="Notification Time" required error={errors.notifyAt}>
            <input
              type="time"
              value={form.notifyAt}
              onChange={(e) => setField({ notifyAt: e.target.value })}
              style={{ ...styles.input, borderColor: errors.notifyAt ? '#dc2626' : LINE }}
            />
          </Field>
        </div>
      </FormCard>

      <FormCard icon="box" title="Asset / Location & Checklist">
        <div style={{ ...styles.formGrid, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
          <Field label="Asset">
            <select
              value={form.filterId}
              disabled={Boolean(form.cleanroomId)}
              onChange={(e) => setField({ filterId: e.target.value, cleanroomId: '', checklistId: '' })}
              style={{ ...styles.input, opacity: form.cleanroomId ? 0.5 : 1 }}
            >
              <option value="">Select an asset</option>
              {FILTER_VIEW.map((f) => (
                <option key={f.filterId} value={f.filterId}>{f.filterId} — {f.cleanroomName}</option>
              ))}
            </select>
          </Field>
          <Field label="Location">
            <select
              value={cleanroomId}
              disabled={Boolean(form.filterId)}
              onChange={(e) => setField({ cleanroomId: e.target.value, filterId: '', checklistId: '' })}
              style={{ ...styles.input, opacity: form.filterId ? 0.5 : 1 }}
            >
              <option value="">Select location</option>
              {CLEANROOMS.map((c) => (
                <option key={c.cleanroomId} value={c.cleanroomId}>{c.name} ({c.isoClass})</option>
              ))}
            </select>
          </Field>
        </div>

        {form.filterId && (
          <p style={{ fontSize: 11, color: MUTE, margin: '0 0 10px' }}>
            Location taken from the selected asset.
          </p>
        )}

        {!form.filterId && !form.cleanroomId && (
          <div style={{
            ...styles.banner,
            background: submitted && errors.subject ? '#fef2f2' : '#eff6ff',
            borderColor: submitted && errors.subject ? '#fecaca' : '#bfdbfe',
            color: submitted && errors.subject ? '#b91c1c' : '#1d4ed8',
          }}>
            <LocalIcon name="info" size={14} color={submitted && errors.subject ? '#b91c1c' : '#1d4ed8'} />
            {submitted && errors.subject
              ? 'Either Asset or Location must be selected'
              : 'Select either an Asset or a Location to proceed.'}
          </div>
        )}

        <ChecklistSelectionGrid
          selectedId={form.checklistId}
          onSelect={(t) => setField({ checklistId: t.id, title: form.title || t.name })}
          hasSubject={Boolean(form.filterId || form.cleanroomId)}
          appliesTo={form.filterId ? 'filter' : 'room'}
        />
        {errors.checklist && <p style={styles.errorText}>{errors.checklist}</p>}
      </FormCard>

      <FormCard icon="user" title="Assignment" required error={errors.assignment}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9, flexWrap: 'wrap' }}>
          {/* The product offers a user, a team or a department and asks for
              exactly one. This facility's register carries technicians and no
              org units, so the axis it can answer honestly is the only one
              shown rather than two empty selects. */}
          <p style={{ margin: 0, fontSize: 11, color: MUTE, flex: 1 }}>
            Assign this reminder to the technician who walks the round.
          </p>
          {form.assignedTo && (
            <button onClick={() => setField({ assignedTo: '' })} style={styles.ghostBtn}>
              <Glyph name="cross" size={12} color={SUB} /> Clear
            </button>
          )}
        </div>
        <div style={{ maxWidth: 280 }}>
          <Field label="Assigned To">
            <select value={form.assignedTo} onChange={(e) => setField({ assignedTo: e.target.value })} style={styles.input}>
              <option value="">Select team member</option>
              {TECHNICIANS.map((t) => <option key={t.technicianId} value={t.name}>{t.name}</option>)}
            </select>
          </Field>
        </div>
      </FormCard>

      <FormCard
        icon="clock"
        title="Recurrence Schedule"
        right={(
          <Action onClick={() => setField({ intervals: [...form.intervals, { type: 'Weekly', days: 7 }] })}>
            <LocalIcon name="plus" size={13} color={SUB} />Add Interval
          </Action>
        )}
      >
        {form.intervals.map((iv, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={i} style={styles.intervalRow}>
            <Field label="Interval Type" required>
              <select
                value={iv.type}
                onChange={(e) => {
                  const days = { Daily: 1, Weekly: 7, Monthly: 30, Quarterly: 91 }[e.target.value] || 7
                  const next = form.intervals.slice()
                  next[i] = { type: e.target.value, days }
                  setField({ intervals: next })
                }}
                style={styles.input}
              >
                {['Daily', 'Weekly', 'Monthly', 'Quarterly'].map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </Field>
            <Field label="Interval Value" required error={errors[`interval_${i}`]}>
              <input
                type="number"
                min={1}
                max={366}
                value={iv.days}
                onChange={(e) => {
                  const next = form.intervals.slice()
                  next[i] = { ...iv, days: Number(e.target.value) }
                  setField({ intervals: next })
                }}
                style={{ ...styles.input, borderColor: errors[`interval_${i}`] ? '#dc2626' : LINE }}
              />
              {!errors[`interval_${i}`] && (
                <p style={{ fontSize: 10.5, color: MUTE, margin: '5px 0 0' }}>
                  Days between one round and the next. Enter a value between 1-366.
                </p>
              )}
            </Field>
            {form.intervals.length > 1 && (
              <button
                onClick={() => setField({ intervals: form.intervals.filter((_, n) => n !== i) })}
                style={styles.removeInterval}
                aria-label="Remove interval"
              >
                <LocalIcon name="trash" size={14} color="#dc2626" />
              </button>
            )}
          </div>
        ))}
      </FormCard>
    </Modal>
  )
}

/**
 * The checklist picker.
 *
 * Three tabs, as the product has them: what is linked to the thing you picked,
 * what this organisation wrote, and what came out of the library. The split here
 * is real — the five round checklists are this site's own and each names the
 * round it belongs to, and the three procedure ones are standard methods
 * (ISO 14644-3 Annex B and the changeover chain of custody) rather than a
 * schedule anybody walks.
 */
export function ChecklistSelectionGrid({ selectedId, onSelect, hasSubject, appliesTo }) {
  const [tab, setTab] = useState('specified')
  const [search, setSearch] = useState('')

  const own = TEMPLATES.filter((t) => t.roundId)
  const library = TEMPLATES.filter((t) => !t.roundId)

  const source = tab === 'specified'
    ? own.filter((t) => roundById(t.roundId)?.applies === appliesTo)
    : tab === 'organization' ? own : library

  const q = search.trim().toLowerCase()
  const list = q ? source.filter((t) => `${t.name} ${t.standard}`.toLowerCase().includes(q)) : source
  const selected = TEMPLATES.find((t) => t.id === selectedId) || null

  return (
    <div style={{ marginTop: 6 }}>
      <div style={styles.formLabel}>Select Inspection Checklist <span style={{ color: '#dc2626' }}>*</span></div>

      <div style={styles.checklistTabs}>
        {[
          { key: 'specified', label: 'Specified Checklists', icon: 'check' },
          { key: 'organization', label: 'Organization Checklists', icon: 'building' },
          { key: 'system', label: 'Library Checklists', icon: 'library' },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              ...styles.checklistTab,
              background: tab === t.key ? '#fff' : 'transparent',
              color: tab === t.key ? '#15227a' : SUB,
              boxShadow: tab === t.key ? '0 1px 2px rgba(15,23,42,.08)' : 'none',
            }}>
            <LocalIcon name={t.icon === 'check' ? 'check' : t.icon} size={14} color={tab === t.key ? '#15227a' : SUB} />
            {t.label}
          </button>
        ))}
      </div>

      <div style={styles.checklistNote}>
        {tab === 'specified'
          ? 'Checklists linked with the selected asset or location'
          : tab === 'organization'
            ? 'Checklists created and customized by your organization'
            : 'Standard checklists from the system library'}
      </div>

      <div style={{ position: 'relative', marginBottom: 12 }}>
        <span style={styles.searchIcon}><Glyph name="search" size={14} color={MUTE} /></span>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or code..." style={styles.searchInput} />
      </div>

      {tab === 'specified' && !hasSubject ? (
        <div style={styles.checklistEmpty}>
          <Glyph name="warning" size={22} color="#cbd5e1" />
          <span>Select an asset or location to view specified checklists</span>
        </div>
      ) : list.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 260, overflowY: 'auto' }}>
          {list.map((t) => {
            const on = t.id === selectedId
            const code = INSPECTION_REPORTS.find((r) => r.roundId === t.roundId)?.checklistCode
            return (
              <button key={t.id} onClick={() => onSelect(t)}
                style={{
                  ...styles.checklistCard,
                  borderColor: on ? '#2563eb' : LINE,
                  background: on ? '#eff6ff' : '#fff',
                }}>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <strong style={{ display: 'block', fontSize: 12.5, color: INK }}>{t.name}</strong>
                  <span style={{ display: 'block', fontSize: 11, color: MUTE, marginTop: 2 }}>
                    Code: {code || '—'} · Version: 1.0 · {checklistSteps(t).length} items
                  </span>
                </span>
                {on && <Glyph name="check" size={17} color="#2563eb" />}
              </button>
            )
          })}
        </div>
      ) : (
        <div style={styles.checklistEmpty}>
          <Glyph name="warning" size={22} color="#cbd5e1" />
          <span>No checklists found</span>
        </div>
      )}

      {selected && (
        <div style={styles.checklistSelected}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 8 }}>
            <Glyph name="check" size={17} color="#2563eb" />
            <strong style={{ fontSize: 14, color: '#15227a' }}>{selected.name}</strong>
            <Pill tone="slate">{selected.roundId ? 'Organization' : 'System'}</Pill>
          </div>
          <div style={{ fontSize: 12, color: SUB, lineHeight: 1.6 }}>
            <div><strong>Standard:</strong> {selected.standard}</div>
            <div><strong>Total Items:</strong> {checklistSteps(selected).length}</div>
            <p style={{ margin: '6px 0 0', fontStyle: 'italic' }}>{selected.what}</p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── local primitives ─────────────────────────────────────────────────────── */
//
// productKit carries the module's shared chrome; these are the pieces it does
// not have because no other screen in this portal needs them — the three tabs,
// a switch, a checkbox, a dialog, a row menu, and the handful of glyphs the kit
// leaves out. They live here rather than in the kit because the kit is another
// agent's file, and a piece added there for one screen is a piece two screens
// have to agree about.

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
    <div style={styles.tabs}>
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

function RowMenu({ items }) {
  const [open, setOpen] = useState(false)
  return (
    <span style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setOpen((v) => !v)} style={styles.dotsBtn} aria-label="More actions">
        <LocalIcon name="dots" size={16} color={SUB} />
      </button>
      {open && (
        <>
          <span style={styles.scrim} onClick={() => setOpen(false)} />
          <span style={styles.menu}>
            {items.map((it) => (
              <button key={it.label} onClick={() => { setOpen(false); it.onClick() }}
                style={{ ...styles.menuItem, color: it.danger ? '#dc2626' : SUB }}>
                <LocalIcon name={it.icon} size={13} color={it.danger ? '#dc2626' : SUB} />
                {it.label}
              </button>
            ))}
          </span>
        </>
      )}
    </span>
  )
}

export function Modal({ open, onClose, title, icon, width = 560, footer, back, children }) {
  if (!open) return null
  return (
    <div style={styles.overlay} onClick={onClose} role="presentation">
      <div style={{ ...styles.dialog, maxWidth: width }} onClick={(e) => e.stopPropagation()} role="dialog">
        <div style={styles.dialogHead}>
          {/* The product's edit screen is a route with a Back button rather than
              a dialog with a Cancel. Where a caller says so, the header carries
              that Back instead of the icon. */}
          {back ? (
            <button onClick={back.onClick} style={styles.dialogBack}>
              <Glyph name="back" size={13} color="#15227a" />
              {back.label}
            </button>
          ) : icon && <LocalIcon name={icon} size={17} color="#15227a" />}
          <h2 style={styles.dialogTitle}>{title}</h2>
          <button onClick={onClose} style={styles.dialogClose} aria-label="Close">
            <Glyph name="cross" size={16} color={MUTE} />
          </button>
        </div>
        <div style={styles.dialogBodyWrap}>{children}</div>
        {footer && <div style={styles.dialogFoot}>{footer}</div>}
      </div>
    </div>
  )
}

export function FormCard({ icon, title, required, error, right, children }) {
  return (
    <div style={{ ...styles.formCard, borderColor: error ? '#fecaca' : LINE }}>
      <div style={styles.formCardHead}>
        <Glyph name={icon} size={16} color="#15227a" />
        <h3 style={styles.formCardTitle}>{title}</h3>
        {required && <span style={{ color: '#dc2626' }}>*</span>}
        {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
      </div>
      {children}
      {error && <p style={styles.errorText}>{error}</p>}
    </div>
  )
}

export function Field({ label, required, error, span, children }) {
  return (
    <div style={{ minWidth: 0, gridColumn: span ? `span ${span}` : undefined }}>
      <div style={styles.formLabel}>
        {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
      </div>
      {children}
      {error && <p style={styles.errorText}>{error}</p>}
    </div>
  )
}

function FilterField({ icon, label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      <span style={styles.filterLabel}>
        <Glyph name={icon} size={12} color={MUTE} /> {label}
      </span>
      {children}
    </label>
  )
}

function Fact({ icon, label, value }) {
  return (
    <span style={styles.fact}>
      <Glyph name={icon} size={13} color={MUTE} />
      {label && <span style={{ fontWeight: 700, color: INK }}>{label}:</span>}
      <span style={{ color: SUB, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
    </span>
  )
}

function Empty({ icon, title, body, action }) {
  return (
    <div style={styles.empty}>
      <LocalIcon name={icon === 'archive' ? 'archive' : 'bell'} size={44} color="#cbd5e1" />
      <strong style={{ display: 'block', fontSize: 15, color: SUB, margin: '12px 0 6px' }}>{title}</strong>
      <span style={{ fontSize: 12.5, color: MUTE }}>{body}</span>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}

/**
 * Export.
 *
 * What is on screen, not the whole register — the button sits beside the
 * filters, and a file that ignores them is a file whose numbers do not match
 * the page the reader was looking at when they asked for it.
 */
function exportCsv(rows) {
  const head = ['Title', 'Reference', 'Interval', 'Status', 'Assigned To', 'Location', 'Asset', 'Next Due', 'Description']
  const cell = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  // "Inactive" rather than "Archived" in the Status column, which looks like an
  // inconsistency with the screen and is not: the product's export writes the
  // is_active flag itself, and the screen's "Archived" is the word it puts on
  // the tab that flag files a reminder under. The file is read outside the
  // product, where the flag is the thing that means something.
  const body = rows.map((r) => [
    r.round, r.reminderId, `${r.frequency} — every ${r.intervalDays} days`,
    r.isActive ? 'Active' : 'Inactive', r.assignedTo, r.cleanroomName, r.filterId || '',
    r.dueDate, roundById(r.roundId)?.what || '',
  ].map(cell).join(','))

  const blob = new Blob([[head.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `inspection-reminders-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const styles = {
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

  filterCard: {
    background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 14,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  filterTop: { display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap', marginBottom: 11 },
  searchIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex' },
  searchInput: {
    width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 34px', fontSize: 12.5,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, borderRadius: 9,
    outline: 'none', fontFamily: 'inherit', color: INK, background: '#fff',
  },
  searchBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
    background: '#f1f5f9', color: SUB, cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  clearBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
    background: '#fff', color: '#b91c1c', cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fecaca',
  },
  resultsLine: { fontSize: 12, color: SUB, marginBottom: 10 },
  badgeRow: { display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center', marginBottom: 11 },
  filterBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px',
    fontSize: 11, fontWeight: 700, fontFamily: 'inherit', borderRadius: 999,
    background: '#eef2ff', color: '#15227a', cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#c7d2fe',
  },
  filterGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12,
    paddingTop: 12, borderTop: `1px solid ${LINE}`,
  },
  filterLabel: {
    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700,
    color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  select: {
    padding: '7px 10px', fontSize: 12.5, fontWeight: 600, color: INK, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, borderRadius: 9,
    fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
  },

  bulkBar: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    padding: '10px 14px', borderRadius: 10, background: '#f8fafc', marginBottom: 12,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  bulkLabel: {
    background: 'none', border: 'none', padding: 0, fontFamily: 'inherit',
    fontSize: 12.5, fontWeight: 700, color: SUB, cursor: 'pointer',
  },
  ghostBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px',
    fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', borderRadius: 8,
    background: 'transparent', color: SUB, cursor: 'pointer', border: 'none',
  },
  confirmBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 15px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
    color: '#fff', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
  },

  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: {
    background: '#fff', borderRadius: 12, padding: '15px 17px',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
    cursor: 'pointer', minWidth: 0,
  },
  cardHead: { display: 'flex', alignItems: 'flex-start', gap: 11, marginBottom: 13 },
  cardTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: '#15227a', lineHeight: 1.35 },
  cardDesc: { display: 'block', fontSize: 12, color: SUB, marginTop: 3, lineHeight: 1.5 },
  outlinePill: {
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px',
    fontSize: 11, fontWeight: 700, borderRadius: 999, color: SUB, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, whiteSpace: 'nowrap',
  },
  cardGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
    gap: 10, marginBottom: 11,
  },
  fact: {
    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, minWidth: 0,
    whiteSpace: 'nowrap',
  },
  recurrence: {
    padding: '10px 13px', borderRadius: 9, background: '#eff6ff',
    borderLeftStyle: 'solid', borderLeftWidth: 4, borderLeftColor: '#bfdbfe', marginBottom: 11,
  },
  generated: {
    padding: '10px 13px', borderRadius: 9, background: '#ecfdf5',
    borderLeftStyle: 'solid', borderLeftWidth: 4, borderLeftColor: '#a7f3d0', marginBottom: 11,
  },
  generatedRow: {
    display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0',
    borderBottomStyle: 'solid', borderBottomWidth: 1, borderBottomColor: '#d1fae5',
  },
  cardFoot: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    paddingTop: 11, borderTop: `1px solid ${LINE}`,
  },
  secondaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 13px',
    fontSize: 12, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
    background: '#f1f5f9', color: SUB, cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, whiteSpace: 'nowrap',
  },

  priorityPill: {
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px',
    borderRadius: 999, fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap',
  },
  priorityAlert: {
    display: 'flex', alignItems: 'center', gap: 9, padding: '10px 13px', marginTop: 11,
    borderRadius: 9, borderLeftStyle: 'solid', borderLeftWidth: 4,
  },

  pagination: {
    display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 18,
  },
  pageBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px',
    fontSize: 12, fontWeight: 700, fontFamily: 'inherit', borderRadius: 8,
    borderStyle: 'solid', borderWidth: 1, minWidth: 32, justifyContent: 'center',
  },

  // The overlay must not scroll.
  //
  // It used to, and the dialog's own body scrolled as well — two nested scroll
  // containers over the same content. Scrolling inside a tall form (or the
  // browser scrolling to a focused field) moved the whole dialog up instead of
  // its contents, carrying the title bar off the top of the screen and clipping
  // the first card. The form still worked, which is what made it easy to miss.
  //
  // So the overlay is a fixed frame and the dialog fits inside it: header and
  // footer pinned, one scroll container, in the body where it belongs.
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: Z.modal,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    // Tight, and capped in pixels rather than left as a viewport percentage. On
    // a laptop 4vh either side took 50px off a dialog that already had to fit a
    // seven-field form; a fixed 20px gives that back without the dialog
    // touching the edges of the screen.
    padding: '20px 16px', overflow: 'hidden',
  },
  dialog: {
    background: '#fff', borderRadius: 14, width: '100%', boxShadow: '0 18px 48px rgba(15,23,42,.22)',
    // Against the overlay's content box rather than a vh figure, so it stays
    // right if that padding is ever changed.
    display: 'flex', flexDirection: 'column', maxHeight: '100%', minHeight: 0,
  },
  dialogHead: {
    display: 'flex', alignItems: 'center', gap: 9, padding: '16px 18px 13px',
    borderBottom: `1px solid ${LINE}`, flexShrink: 0,
  },
  dialogTitle: { margin: 0, fontSize: 15.5, fontWeight: 700, color: INK, flex: 1, minWidth: 0 },
  dialogBack: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 7px',
    fontSize: 12, fontWeight: 600, fontFamily: 'inherit', borderRadius: 8,
    background: '#fff', color: '#15227a', cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, flexShrink: 0,
  },
  dialogClose: {
    background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex',
  },
  // `flex: 1` so it takes the space the pinned header and footer leave, and
  // `minHeight: 0` because a flex child will not shrink below its content
  // without it — which is what let the dialog outgrow its own maxHeight and
  // pushed the scrolling back out to the overlay.
  dialogBodyWrap: { padding: '16px 18px', overflowY: 'auto', minHeight: 0, flex: 1 },
  dialogBody: { margin: 0, fontSize: 13, color: SUB, lineHeight: 1.6 },
  dialogFoot: {
    display: 'flex', justifyContent: 'flex-end', gap: 9, padding: '13px 18px',
    borderTop: `1px solid ${LINE}`, flexWrap: 'wrap', flexShrink: 0,
  },

  formCard: {
    borderRadius: 11, padding: '14px 15px', marginBottom: 13,
    borderStyle: 'solid', borderWidth: 1, background: '#fcfdfe',
  },
  formCardHead: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  formCardTitle: { margin: 0, fontSize: 14, fontWeight: 700, color: INK },
  formGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
    gap: 12, marginBottom: 12, alignItems: 'start',
  },
  formLabel: { fontSize: 11, fontWeight: 700, color: SUB, marginBottom: 5 },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '8px 11px', fontSize: 12.5,
    fontFamily: 'inherit', lineHeight: 1.5, color: INK, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, borderRadius: 9, outline: 'none',
  },
  errorText: {
    margin: '5px 0 0', fontSize: 11.5, color: '#dc2626', lineHeight: 1.45,
  },
  banner: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 9,
    fontSize: 12.5, marginBottom: 12, borderStyle: 'solid', borderWidth: 1,
  },
  intervalRow: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr)) auto',
    gap: 12, alignItems: 'start', padding: '12px 13px', borderRadius: 9, marginBottom: 9,
    background: '#fff', borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  removeInterval: {
    background: 'none', border: 'none', cursor: 'pointer', padding: 6, alignSelf: 'center',
  },

  checklistTabs: {
    display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, padding: 4,
    background: '#f1f5f9', borderRadius: 10, marginBottom: 11,
  },
  checklistTab: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    padding: '8px 10px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
    border: 'none', borderRadius: 7, cursor: 'pointer', whiteSpace: 'nowrap', minWidth: 0,
  },
  checklistNote: {
    padding: '9px 12px', borderRadius: 9, background: '#eff6ff', marginBottom: 11,
    fontSize: 12, color: SUB, borderStyle: 'solid', borderWidth: 1, borderColor: '#dbeafe',
  },
  checklistCard: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
    padding: '10px 12px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1,
  },
  checklistEmpty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    padding: '34px 16px', borderRadius: 11, background: '#f8fafc',
    borderStyle: 'dashed', borderWidth: 2, borderColor: '#e2e8f0',
    fontSize: 12.5, fontWeight: 600, color: MUTE, textAlign: 'center',
  },
  checklistSelected: {
    marginTop: 13, padding: '14px 16px', borderRadius: 11, background: '#eff6ff',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#bfdbfe',
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
    width: 17, height: 17, borderRadius: 5, display: 'grid', placeItems: 'center',
    borderStyle: 'solid', borderWidth: 1, cursor: 'pointer', padding: 0, flexShrink: 0,
  },

  dotsBtn: {
    background: '#f8fafc', border: 'none', borderRadius: 7, cursor: 'pointer',
    width: 28, height: 28, display: 'grid', placeItems: 'center', padding: 0,
  },
  scrim: { position: 'fixed', inset: 0, zIndex: 40 },
  menu: {
    position: 'absolute', top: 32, right: 0, zIndex: 41, minWidth: 156,
    background: '#fff', borderRadius: 10, padding: 5, display: 'flex', flexDirection: 'column',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
    boxShadow: '0 10px 26px rgba(15,23,42,.14)',
  },
  menuItem: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', width: '100%',
    fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', textAlign: 'left',
    background: 'none', border: 'none', borderRadius: 7, cursor: 'pointer',
  },

  empty: {
    padding: '46px 20px', textAlign: 'center', borderRadius: 11,
    borderStyle: 'dashed', borderWidth: 1, borderColor: '#dbe2ea', background: '#fcfdfe',
  },
}
