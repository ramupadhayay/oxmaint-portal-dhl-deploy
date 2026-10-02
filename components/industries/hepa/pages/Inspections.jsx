'use client'

// Inspection Reports.
//
// Ported from the product's own screen rather than from a picture of it. The
// order is the product's order: header with the Overall / By Technician cut and
// its actions, the summary-card row and the menu that shows and hides
// individual cards, three rate cards, a band naming whatever is overdue, then
// the list under a heading carrying the count, its Filters popover, its
// list/grid pair, a full-width search, and the pager.
//
// The summary cards are controls, not decoration. In the product the card you
// click is the cut applied to the list, Total Inspections is the "no cut" card,
// and clicking the active one clears it. That is why Total reads as active on
// an unfiltered screen — it says "you are looking at all of them" rather than
// leaving the reader to infer it.
//
// A row opens a page, not a panel. A round carries its checklist, its per-step
// results, the work raised off it and its analysis, and a drawer sliding over
// the table cannot be linked to, opened in a second tab or closed with the back
// button — all three of which somebody does in a review.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeading, PALETTE } from '../lib/kit'
import {
  SummaryCards, RateCards, AlertBand, Segmented, Action, ListHeader,
  ViewToggle, SearchBar, Glyph, Pill, Menu, MenuCheck, MenuLabel, Pagination,
  useCardVisibility, TONE,
} from '../lib/productKit'
import { CLEANROOMS, fmtDate } from '../lib/data'
import { useStore } from '../lib/store'
import { INSPECTION_REPORTS, INSPECTORS, inspectorByName } from '../lib/data/inspections'

const { INK, SUB, MUTE, LINE } = PALETTE

const idOf = (r) => r.reportId || r.recordId

// One place decides what a row's colour means, because the badge, the score and
// the summary card all have to agree about a single row.
const RESULT_TONE = { Pass: 'slate', 'Pass with observations': 'amber', Fail: 'red' }
const STATUS_TONE = {
  Completed: 'slate', 'Open finding': 'red', 'In Progress': 'amber',
  Scheduled: 'amber', Overdue: 'red',
}

// The six the product ships, in its order. Each is a cut of the list as well as
// a number, which is why the predicate lives beside the label.
// `alert` is what earns a card its colour, and only these two get it: a failed
// round and one whose date has passed are the two counts somebody has to act
// on. The other four are the shape of the register, and colouring them said
// nothing while making the two that matter impossible to pick out.
const CARDS = [
  { key: 'total', label: 'Total Inspections', icon: 'clipboard', keep: () => true },
  { key: 'completed', label: 'Completed', icon: 'check', keep: (r) => r._walked },
  { key: 'pending', label: 'Pending', icon: 'clock', keep: (r) => r._pending },
  { key: 'passed', label: 'Passed', icon: 'check', keep: (r) => r.result === 'Pass' },
  { key: 'failed', label: 'Failed', icon: 'cross', alert: true, tone: 'red', keep: (r) => r.result === 'Fail' },
  { key: 'overdue', label: 'Overdue', icon: 'warning', alert: true, tone: 'amber', keep: (r) => r._overdue },
]

const STATUSES = ['Scheduled', 'In Progress', 'Completed', 'Open finding', 'Overdue']
const RESULTS = ['Pass', 'Pass with observations', 'Fail']

// Ten of the rows on this register are rounds nobody has walked yet, so a field
// with no measurement in it is the ordinary case. It reads as a dash rather
// than as an empty unit or an `undefined`, and never as a zero — a zero is a
// measurement and "not measured" is a different statement.
const DASH = '—'

/** What it took, what it is booked for, or neither. */
const durationOf = (r) => (
  typeof r.durationMinutes === 'number' ? `${r.durationMinutes} min`
    : typeof r.plannedMinutes === 'number' ? `${r.plannedMinutes} min (planned)`
      : DASH
)

export default function Inspections() {
  const router = useRouter()
  const store = useStore()

  const [mode, setMode] = useState('overall')
  const [shown, toggleCard] = useCardVisibility('hepaInspectionSummaryCards', CARDS.map((c) => c.key))
  const [cut, setCut] = useState('total')
  const [search, setSearch] = useState('')
  const [view, setView] = useState('list')
  const [location, setLocation] = useState('')
  const [status, setStatus] = useState('all')
  const [result, setResult] = useState('all')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(50)

  // Rounds walked in the portal rewrite the row they came from, so a created
  // record wins over the seeded one carrying the same reference rather than
  // sitting beside it as a second copy.
  const stored = store?.records?.hepa_inspection || []
  const all = useMemo(() => {
    const byId = new Map(INSPECTION_REPORTS.map((r) => [idOf(r), r]))
    for (const row of stored) {
      if (!row.reportId) continue
      byId.set(row.reportId, { ...(byId.get(row.reportId) || {}), ...row })
    }
    return [...byId.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)))
  }, [stored])

  const counts = useMemo(() => {
    const out = {}
    for (const c of CARDS) out[c.key] = all.filter(c.keep).length
    return out
  }, [all])

  const scored = all.filter((r) => typeof r.score === 'number')
  const avgScore = scored.length
    ? Math.round((scored.reduce((n, r) => n + r.score, 0) / scored.length) * 10) / 10
    : 0
  const completionPct = counts.total ? Math.round((counts.completed / counts.total) * 100) : 0
  const passPct = counts.completed ? Math.round((counts.passed / counts.completed) * 100) : 0

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const keep = (CARDS.find((c) => c.key === cut) || CARDS[0]).keep
    return all.filter((r) => (
      keep(r)
      && (!location || r.cleanroomId === location)
      && (status === 'all' || r.status === status)
      && (result === 'all' || (result === 'pending' ? !r.result : r.result === result))
      && (!q || [r.reportId, r.round, r.standard, r.cleanroomName, r.isoClass, r.inspector, r.assignee, r.filterId, r.checklistName]
        .filter(Boolean).join(' ').toLowerCase().includes(q))
    ))
  }, [all, cut, location, status, result, search])

  // Any narrowing puts the reader on a page that may no longer exist. Sending
  // them back to the first one beats an empty list under a pager that says
  // there are sixty-eight.
  useEffect(() => { setPage(0) }, [cut, location, status, result, search, pageSize, mode])

  const paged = useMemo(
    () => rows.slice(page * pageSize, page * pageSize + pageSize),
    [rows, page, pageSize],
  )

  // The By Technician cut. Same rows, aggregated by who they are booked to —
  // the product offers it because "is this a room problem or a shift problem"
  // is a question the flat list cannot answer.
  const technicians = useMemo(() => buildTechnicianReport(rows), [rows])

  const locationName = location
    ? (CLEANROOMS.find((c) => c.cleanroomId === location)?.name || location)
    : 'No Location Selected'

  const filtersOn = status !== 'all' || result !== 'all'
  const searching = Boolean(search.trim()) || filtersOn || Boolean(location) || cut !== 'total'

  const open = (r) => router.push(`/portal/hepa/inspections/${idOf(r)}`)
  const start = (r) => router.push(`/portal/hepa/inspections/new?round=${encodeURIComponent(idOf(r))}`)

  return (
    <div>
      <PageHeading
        title="Inspection Reports"
        subtitle="Track and manage all inspection activities across your cleanrooms and filters"
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Segmented
              value={mode} onChange={setMode}
              options={[{ key: 'overall', label: 'Overall' }, { key: 'tech', label: 'By Technician' }]}
            />
            <Action icon="refresh"
              onClick={() => { setSearch(''); setCut('total'); setLocation(''); setStatus('all'); setResult('all') }}>
              Refresh
            </Action>
            <div style={{ position: 'relative' }}>
              <select value={location} onChange={(e) => setLocation(e.target.value)}
                aria-label="Location filter" style={styles.locationSelect}>
                <option value="">No Location Selected</option>
                {CLEANROOMS.map((c) => <option key={c.cleanroomId} value={c.cleanroomId}>{c.name}</option>)}
              </select>
              <span style={styles.locationFace}>
                <Glyph name="pin" size={14} color={location ? '#15227a' : SUB} />
                <span style={{ color: location ? '#15227a' : SUB }}>{locationName}</span>
              </span>
            </div>
            <Action icon="download"
              onClick={() => (mode === 'tech' ? exportTechnicians(technicians) : exportReports(rows))}>
              Export
            </Action>
            <Action icon="play" primary onClick={() => router.push('/portal/hepa/inspections/new')}>
              New Inspection
            </Action>
          </div>
        }
      />

      {mode === 'tech' ? (
        <TechnicianReport rows={technicians} />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 11 }}>
            <Menu icon="sliders" label={`Summary Cards (${shown.length} visible)`}>
              <MenuLabel>Select cards to display</MenuLabel>
              {CARDS.map((c) => (
                <MenuCheck key={c.key} checked={shown.includes(c.key)} onChange={() => toggleCard(c.key)}>
                  {c.label}
                </MenuCheck>
              ))}
            </Menu>
          </div>

          <SummaryCards
            active={cut}
            onPick={(k) => setCut(k || 'total')}
            cards={CARDS.filter((c) => shown.includes(c.key)).map((c) => ({
              key: c.key,
              label: c.label,
              value: counts[c.key],
              tone: c.tone,
              icon: c.icon,
              pct: c.key === 'completed' ? completionPct : c.key === 'passed' ? passPct : undefined,
            }))}
          />

          <RateCards cards={[
            // The thresholds are the product's. What changed is that a healthy
            // figure now draws nothing: `up` renders no arrow, so the one card
            // carrying a mark is the one that has slipped.
            {
              key: 'completion', title: 'Completion Rate', icon: 'target',
              value: completionPct, suffix: '%', pct: completionPct,
              trend: completionPct >= 80 ? 'up' : completionPct > 0 ? 'down' : 'flat',
              caption: `${counts.completed} of ${counts.total} inspections completed`,
            },
            {
              key: 'pass', title: 'Pass Rate', icon: 'check',
              value: passPct, suffix: '%', pct: passPct,
              trend: passPct >= 90 ? 'up' : passPct >= 70 ? 'flat' : 'down',
              caption: `${counts.passed} of ${counts.completed} inspections passed`,
            },
            {
              key: 'score', title: 'Average Score', icon: 'gauge',
              value: avgScore.toFixed(1), suffix: '', pct: avgScore,
              trend: avgScore >= 80 ? 'up' : avgScore >= 60 ? 'flat' : 'down',
              caption: 'Average score across all completed inspections',
            },
          ]} />

          {counts.overdue > 0 && (
            <AlertBand title={`${counts.overdue} Overdue Inspection${counts.overdue > 1 ? 's' : ''}`}>
              These inspections require immediate attention to maintain compliance.
            </AlertBand>
          )}

          <ListHeader
            title="Inspections"
            count={rows.length}
            icon="clipboard"
            right={
              <>
                <Menu icon="filter" label="Filters" dot={filtersOn} width={272}>
                  <div style={styles.filterHead}>Advanced Filters</div>
                  <p style={styles.filterNote}>Refine your inspection list.</p>

                  <label style={styles.filterField}>
                    <span style={styles.filterLabel}>Status</span>
                    <select value={status} onChange={(e) => setStatus(e.target.value)} style={styles.select}>
                      <option value="all">All Statuses</option>
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>

                  <label style={styles.filterField}>
                    <span style={styles.filterLabel}>Result</span>
                    <select value={result} onChange={(e) => setResult(e.target.value)} style={styles.select}>
                      <option value="all">All Results</option>
                      {RESULTS.map((s) => <option key={s} value={s}>{s}</option>)}
                      <option value="pending">Pending / N/A</option>
                    </select>
                  </label>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 11 }}>
                    <Action onClick={() => { setStatus('all'); setResult('all') }}>Clear Filters</Action>
                  </div>
                </Menu>
                <ViewToggle value={view} onChange={setView} />
              </>
            }
          />

          <SearchBar value={search} onChange={setSearch} placeholder="Search inspections..." />

          {rows.length === 0 ? (
            <div style={styles.empty}>
              <span style={{ display: 'block', marginBottom: 10 }}>
                <Glyph name="clipboard" size={34} color="#cbd5e1" />
              </span>
              <strong style={styles.emptyTitle}>
                {searching ? 'No inspections found' : 'No inspections available'}
              </strong>
              <p style={styles.emptyBody}>
                {searching
                  ? 'Try adjusting your search terms to find what you’re looking for.'
                  : 'Start your first inspection to begin tracking your cleanroom conditions.'}
              </p>
              {!searching && (
                <Action icon="play" primary onClick={() => router.push('/portal/hepa/inspections/new')}>
                  Start Inspection
                </Action>
              )}
            </div>
          ) : (
            <>
              {view === 'grid' ? (
                <div style={styles.grid}>
                  {paged.map((r) => <ReportCard key={idOf(r)} r={r} onOpen={open} onStart={start} />)}
                </div>
              ) : (
                <div style={styles.list}>
                  {paged.map((r) => <ReportRow key={idOf(r)} r={r} onOpen={open} onStart={start} />)}
                </div>
              )}

              <Pagination
                page={page} pageSize={pageSize} total={rows.length}
                onPage={setPage} onPageSize={setPageSize}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── one row ───────────────────────────────────────────────────────────────
//
// The product's list item is two blocks, not a table row: identity and score on
// top, then three columns of detail under a rule. It is taller than a table row
// on purpose — the whole point of the list view is that you can read a round
// without opening it.

function ReportRow({ r, onOpen, onStart }) {
  const st = TONE[STATUS_TONE[r.status]] || TONE.slate
  const items = r.results?.length || 0
  const passed = (r.results || []).filter((x) => x.passFail === true).length
  const failed = (r.results || []).filter((x) => x.passFail === false).length
  const action = (r.results || []).filter((x) => x.requiresAction).length

  return (
    <Clickable onOpen={() => onOpen(r)} style={styles.row}>
      <div style={styles.rowHead}>
        <div style={{ flex: '1 1 340px', minWidth: 0 }}>
          <div style={styles.badgeLine}>
            <span style={styles.ref}>{r.reportId}</span>
            <Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill>
            {r.result && <Pill tone={RESULT_TONE[r.result]}>{r.result}</Pill>}
          </div>

          <h3 style={styles.rowTitle}>{r.round}</h3>

          <div style={styles.facts}>
            <Fact icon="box" label="Asset">
              {r.filterId || (r.cleanroomId ? `${r.cleanroomId} — room-wide` : DASH)}
            </Fact>
            <Fact icon="pin" label="Location">
              {[r.cleanroomName, r.isoClass].filter(Boolean).join(' · ') || DASH}
            </Fact>
            <Fact icon="user" label="Inspector">{r.inspector || 'Not yet walked'}</Fact>
            <Fact icon="check" label="Assignee">{r.assignee || 'Unassigned'}</Fact>
          </div>
        </div>

        <div style={styles.rowRight}>
          <ScoreBlock r={r} />
          {(r.status === 'Scheduled' || r.status === 'Overdue') && (
            <button onClick={(e) => { e.stopPropagation(); onStart(r) }} style={styles.startBtn}>
              <Glyph name="play" size={12} color="#fff" />
              Start Inspection
            </button>
          )}
        </div>
      </div>

      <div style={styles.rowBody}>
        <Column icon="calendar" title="Schedule & Timing">
          <Line label="Inspection Date" value={r.date ? fmtDate(r.date) : DASH} />
          <Line label="Frequency" value={r.frequency || DASH} />
          <Line label="Duration" value={durationOf(r)} />
        </Column>

        {items > 0 ? (
          <Column icon="check" title="Results Summary">
            <Line label="Total Items" value={items} />
            <Line label="Passed" value={passed} tone="#047857" />
            <Line label="Failed" value={failed} tone="#b91c1c" />
            {action > 0 && <Line label="Action Required" value={action} tone="#b45309" />}
          </Column>
        ) : (
          <Column icon="check" title="Results Summary">
            <p style={styles.colNone}>Nothing captured yet — this round has not been walked.</p>
          </Column>
        )}

        <Column icon="doc" title="Additional Info">
          {r.followUpRequired && <Tag tone="#b45309" icon="warning">Follow-up Required</Tag>}
          {r.signatureCaptured && <Tag tone="#047857" icon="check">Signature Captured</Tag>}
          {/* Only where there is any. The room's conditions are written at the
              round, so a round nobody has walked has none, and a badge claiming
              data that is not there is worse than no badge. */}
          {(r.temperature != null || r.humidity != null) && (
            <Tag tone={SUB} icon="gauge">Environmental Data Available</Tag>
          )}
          {r.checklistName && <Tag tone={SUB} icon="doc">{r.checklistName}</Tag>}
        </Column>
      </div>

      {(r.notes || r.recommendedActions) && (
        <div style={styles.rowNotes}>
          {r.notes && (
            <p style={styles.noteLine}>
              <span style={styles.noteLabel}>Notes: </span>{r.notes}
            </p>
          )}
          {r.recommendedActions && (
            <p style={styles.noteLine}>
              <span style={styles.noteLabel}>Recommended Actions: </span>{r.recommendedActions}
            </p>
          )}
        </div>
      )}
    </Clickable>
  )
}

/** The same round as a card, for the grid view. */
function ReportCard({ r, onOpen, onStart }) {
  return (
    <Clickable onOpen={() => onOpen(r)} style={styles.card}>
      <div style={styles.badgeLine}>
        <span style={styles.tile}><Glyph name="clipboard" size={14} color="#15227a" /></span>
        <Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill>
        {r.result && <Pill tone={RESULT_TONE[r.result]}>{r.result}</Pill>}
      </div>

      <span style={styles.ref}>{r.reportId}</span>
      <h3 style={{ ...styles.rowTitle, fontSize: 14 }}>{r.round}</h3>
      <p style={styles.cardAsset}>{r.filterId || r.cleanroomName || DASH}</p>

      <div style={styles.cardGrid}>
        <Line label="Inspection Date" value={r.date ? fmtDate(r.date) : DASH} stacked />
        <Line label="Inspector" value={r.inspector || 'Not yet walked'} stacked />
        <Line label="Assignee" value={r.assignee || 'Unassigned'} stacked />
        <Line label="Duration" value={durationOf(r)} stacked />
      </div>

      {typeof r.score === 'number' && (
        <div style={{ marginTop: 11 }}>
          <div style={styles.scoreRow}>
            <span style={styles.scoreLabel}>Score</span>
            <span style={{ marginLeft: 'auto', ...styles.scoreBig, color: TONE[RESULT_TONE[r.result]]?.fg }}>
              {r.scorePoints}/{r.maxScore}
            </span>
            <span style={styles.scorePct}>{r.score}%</span>
          </div>
          <div style={styles.track}>
            <div style={{
              width: `${r.score}%`, height: '100%', borderRadius: 999,
              background: TONE[RESULT_TONE[r.result]]?.fg || '#15227a',
            }} />
          </div>
        </div>
      )}

      {(r.status === 'Scheduled' || r.status === 'Overdue') && (
        <button onClick={(e) => { e.stopPropagation(); onStart(r) }}
          style={{ ...styles.startBtn, marginTop: 11, justifyContent: 'center' }}>
          <Glyph name="play" size={12} color="#fff" />
          Start Inspection
        </button>
      )}

      {r.followUpRequired && (
        <p style={{ ...styles.noteLine, marginTop: 10, color: '#b45309' }}>Follow-up Required</p>
      )}
    </Clickable>
  )
}

/**
 * A card that opens a record and still holds buttons.
 *
 * The row has a Start button inside it, so the row itself cannot be a button —
 * nested buttons are invalid and React says so on hydration. A div carrying the
 * button role, a tab stop and Enter/Space is the same affordance without the
 * broken markup.
 */
function Clickable({ onOpen, style, children }) {
  return (
    <div role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      style={style}>
      {children}
    </div>
  )
}

function ScoreBlock({ r }) {
  if (typeof r.score !== 'number') {
    return <span style={styles.scoreNone}>Not scored</span>
  }
  const t = TONE[RESULT_TONE[r.result]] || TONE.slate
  const trend = r.score >= 80 ? 'up' : r.score >= 60 ? 'flat' : 'down'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
      <span style={{ ...styles.scoreBig, fontSize: 24, color: t.fg }}>{r.score}%</span>
      <span style={styles.scorePts}>{r.scorePoints}/{r.maxScore}</span>
      <Glyph name={trend} size={15} color={t.fg} />
    </span>
  )
}

function Fact({ icon, label, children }) {
  return (
    <span style={styles.fact}>
      <Glyph name={icon} size={13} color="#94a3b8" />
      <span style={styles.factLabel}>{label}:</span>
      <span style={styles.factValue}>{children}</span>
    </span>
  )
}

function Column({ icon, title, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={styles.colHead}>
        <Glyph name={icon} size={13} color={SUB} />
        <span>{title}</span>
      </div>
      {children}
    </div>
  )
}

function Line({ label, value, tone, stacked }) {
  if (stacked) {
    return (
      <span style={{ minWidth: 0 }}>
        <span style={styles.stackLabel}>{label}</span>
        <span style={styles.stackValue}>{value}</span>
      </span>
    )
  }
  return (
    <div style={styles.line}>
      <span style={{ ...styles.lineLabel, color: tone || MUTE }}>{label}:</span>
      <span style={{ ...styles.lineValue, color: tone || INK }}>{value}</span>
    </div>
  )
}

function Tag({ icon, tone, children }) {
  return (
    <div style={{ ...styles.tag, color: tone }}>
      <Glyph name={icon} size={12} color={tone} />
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</span>
    </div>
  )
}

// ── by technician ─────────────────────────────────────────────────────────
//
// The product draws this as a table with a totals row rather than as cards,
// because every column is a number and the reason to open it is to compare one
// person against another down a column. Cards make that comparison impossible.
//
// Two of the product's columns are statuses this site does not have — On Hold
// and Cancelled — and it has one the product does not, Open finding. So the
// columns follow this register's own statuses; everything else is the
// product's, in the product's order.

function buildTechnicianReport(rows) {
  const m = new Map()
  for (const r of rows) {
    const who = r.assignee || r.inspector || 'Unassigned'
    if (!m.has(who)) m.set(who, [])
    m.get(who).push(r)
  }

  const row = (name, list) => {
    const scored = list.filter((r) => typeof r.score === 'number')
    const timed = list.filter((r) => typeof r.durationMinutes === 'number')
    const completed = list.filter((r) => r._walked).length
    return {
      name,
      department: inspectorByName(name)?.department || null,
      total: list.length,
      completed,
      openFinding: list.filter((r) => r.status === 'Open finding').length,
      inProgress: list.filter((r) => r.status === 'In Progress').length,
      scheduled: list.filter((r) => r.status === 'Scheduled').length,
      overdue: list.filter((r) => r._overdue).length,
      passed: list.filter((r) => r.result === 'Pass').length,
      failed: list.filter((r) => r.result === 'Fail').length,
      // Averages over the rounds that have the figure, never over the whole
      // list. A scheduled round has no score and no duration, and counting it
      // as nought drags both means down every time somebody books work in.
      avgScore: scored.length ? Math.round(scored.reduce((n, r) => n + r.score, 0) / scored.length) : null,
      avgMinutes: timed.length ? Math.round(timed.reduce((n, r) => n + r.durationMinutes, 0) / timed.length) : null,
      completion: list.length ? Math.round((completed / list.length) * 100) : null,
    }
  }

  // Everyone on the roster appears, whether or not this cut left them a round.
  // A technician who drops off the table when a filter is applied looks like a
  // technician who left the site.
  const names = new Set([...m.keys(), ...INSPECTORS.map((t) => t.name)])
  const out = [...names].map((name) => row(name, m.get(name) || [])).sort((a, b) => b.total - a.total)
  return { rows: out, totals: row('Total', rows) }
}

const COLS = [
  { key: 'name', label: 'Technician', align: 'left' },
  { key: 'department', label: 'Department', align: 'left' },
  { key: 'total', label: 'Total' },
  { key: 'completed', label: 'Completed', tone: '#047857' },
  { key: 'openFinding', label: 'Open finding', tone: '#b91c1c' },
  { key: 'inProgress', label: 'In Progress', tone: '#2563eb' },
  { key: 'scheduled', label: 'Scheduled', tone: '#b45309' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'passed', label: 'Passed', tone: '#047857' },
  { key: 'failed', label: 'Failed', tone: '#b91c1c' },
  { key: 'avgScore', label: 'Avg Score' },
  { key: 'avgMinutes', label: 'Avg Duration' },
  { key: 'completion', label: 'Completion Rate' },
]

// A missing average reads as an em dash, never as zero — nought is a
// measurement and "we never measured" is not.
const cell = (r, key) => {
  const v = r[key]
  if (key === 'avgScore' || key === 'completion') return v == null ? '—' : `${v}%`
  if (key === 'avgMinutes') return v == null ? '—' : `${v} min`
  if (key === 'department') return v || '—'
  return v
}

function TechnicianReport({ rows }) {
  return (
    <div style={styles.sheet}>
      <div style={styles.sheetHead}>
        <Glyph name="user" size={16} color="#15227a" />
        <h2 style={styles.sheetTitle}>Inspection Summary by Technician</h2>
      </div>

      {rows.rows.length === 0 ? (
        <div style={styles.empty}>
          <strong style={styles.emptyTitle}>No technicians to show for the current filters.</strong>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th key={c.key} style={{ ...styles.th, textAlign: c.align || 'right' }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.rows.map((r) => (
                <tr key={r.name}>
                  {COLS.map((c) => (
                    <td key={c.key} style={{
                      ...styles.td,
                      textAlign: c.align || 'right',
                      color: c.tone && r[c.key] ? c.tone : c.key === 'name' ? INK : SUB,
                      fontWeight: c.key === 'name' ? 700 : 500,
                    }}>
                      {c.key === 'overdue' && r.overdue > 0
                        ? <span style={styles.overdueChip}>{r.overdue}</span>
                        : cell(r, c.key)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                {COLS.map((c) => (
                  <td key={c.key} style={{ ...styles.td, ...styles.totalTd, textAlign: c.align || 'right' }}>
                    {c.key === 'department' ? '—' : cell(rows.totals, c.key)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── export ────────────────────────────────────────────────────────────────
//
// Exports what is on screen rather than the whole register, and exports the cut
// the reader is looking at rather than always the list — the button sits beside
// the Overall / By Technician control, and a file that ignores both is a file
// whose numbers do not match the page it was asked for.

const csvCell = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function download(name, head, body) {
  const blob = new Blob([[head.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function exportReports(rows) {
  download('inspection-reports',
    ['Inspection #', 'Round', 'Standard', 'Cleanroom', 'ISO class', 'Filter', 'Status', 'Result', 'Score', 'Inspector', 'Assignee', 'Date', 'Findings'],
    rows.map((r) => [
      r.reportId, r.round, r.standard, r.cleanroomName, r.isoClass, r.filterId || '-',
      r.status, r.result || '-', r.score ?? '-', r.inspector || '-', r.assignee || '-',
      r.date, r.findingsCount ?? 0,
    ].map(csvCell).join(',')))
}

function exportTechnicians(report) {
  download('inspection-report-by-technician',
    COLS.map((c) => c.label),
    [...report.rows, report.totals].map((r) => COLS.map((c) => cell(r, c.key)).map(csvCell).join(',')))
}

const styles = {
  locationSelect: {
    position: 'absolute', inset: 0, width: '100%', height: '100%',
    opacity: 0, cursor: 'pointer', fontFamily: 'inherit',
  },
  locationFace: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px',
    fontSize: 12.5, fontWeight: 700, borderRadius: 9, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, whiteSpace: 'nowrap',
    pointerEvents: 'none',
  },

  filterHead: { fontSize: 13, fontWeight: 700, color: INK },
  filterNote: { margin: '3px 0 12px', fontSize: 11.5, color: MUTE, lineHeight: 1.5 },
  filterField: { display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 11 },
  filterLabel: { fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 },
  select: {
    padding: '8px 10px', fontSize: 12.5, fontWeight: 600, color: INK, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
    borderRadius: 9, fontFamily: 'inherit', cursor: 'pointer', outline: 'none', width: '100%',
  },

  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(292px,1fr))', gap: 12 },

  row: {
    borderRadius: 12, background: '#fff', cursor: 'pointer', overflow: 'hidden',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  rowHead: {
    display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap',
    padding: '15px 17px 14px', borderBottom: `1px solid #f1f5f9`,
  },
  rowRight: { marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9 },
  badgeLine: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 7 },
  ref: {
    fontSize: 11.5, fontWeight: 800, color: '#15227a',
    fontVariantNumeric: 'tabular-nums', letterSpacing: 0.2,
  },
  rowTitle: { margin: '0 0 9px', fontSize: 15, fontWeight: 700, color: INK, lineHeight: 1.35 },
  facts: { display: 'flex', flexDirection: 'column', gap: 5 },
  fact: { display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, fontSize: 12 },
  factLabel: { color: SUB, fontWeight: 700, flexShrink: 0 },
  factValue: { color: SUB, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

  rowBody: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
    gap: 20, padding: '14px 17px',
  },
  colHead: {
    display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8,
    fontSize: 12, fontWeight: 700, color: SUB,
  },
  colNone: { margin: 0, fontSize: 11.5, color: MUTE, lineHeight: 1.5 },
  line: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, fontSize: 12 },
  lineLabel: { flex: 1, minWidth: 0 },
  lineValue: { fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  stackLabel: { display: 'block', fontSize: 10.5, color: MUTE, marginBottom: 2 },
  stackValue: {
    display: 'block', fontSize: 11.5, fontWeight: 600, color: INK,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  tag: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, marginBottom: 5, minWidth: 0 },

  rowNotes: { padding: '0 17px 14px' },
  noteLine: { margin: '0 0 4px', fontSize: 12, color: SUB, lineHeight: 1.55 },
  noteLabel: { fontWeight: 700, color: INK },

  card: {
    display: 'flex', flexDirection: 'column', padding: '15px 16px', borderRadius: 12,
    background: '#fff', borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
    cursor: 'pointer', minWidth: 0,
  },
  tile: {
    width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center',
    background: '#eef1ff', flexShrink: 0,
  },
  cardAsset: { margin: '0 0 11px', fontSize: 12, color: SUB },
  cardGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 },

  scoreRow: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 },
  scoreLabel: { fontSize: 11.5, fontWeight: 700, color: SUB },
  scoreBig: { fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums' },
  scorePct: { fontSize: 11, color: MUTE, fontVariantNumeric: 'tabular-nums' },
  scorePts: { fontSize: 11, color: MUTE, fontVariantNumeric: 'tabular-nums' },
  scoreNone: { fontSize: 11.5, color: '#94a3b8' },
  track: { height: 6, background: '#eef2f7', borderRadius: 999, overflow: 'hidden' },

  startBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px',
    fontSize: 12, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
    background: '#ea7317', color: '#fff', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
  },

  sheet: {
    background: '#fff', borderRadius: 12, marginBottom: 14,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, overflow: 'hidden',
  },
  sheetHead: {
    display: 'flex', alignItems: 'center', gap: 9, padding: '13px 16px',
    borderBottom: `1px solid ${LINE}`,
  },
  sheetTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: INK },
  table: { width: '100%', minWidth: 940, borderCollapse: 'collapse', fontSize: 12 },
  th: {
    padding: '10px 12px', fontSize: 10.5, fontWeight: 700, color: MUTE,
    textTransform: 'uppercase', letterSpacing: 0.4, background: '#f8fafc',
    whiteSpace: 'nowrap', borderBottom: `1px solid ${LINE}`,
  },
  td: {
    padding: '10px 12px', borderTop: `1px solid #f1f5f9`, whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  totalTd: { background: '#f8fafc', fontWeight: 800, color: INK, borderTop: `2px solid ${LINE}` },
  overdueChip: {
    display: 'inline-block', padding: '2px 8px', borderRadius: 7, background: '#fef2f2',
    color: '#b91c1c', fontWeight: 800, fontVariantNumeric: 'tabular-nums',
  },

  empty: {
    padding: '44px 22px', textAlign: 'center', borderRadius: 12,
    borderStyle: 'dashed', borderWidth: 1, borderColor: '#dbe2ea', background: '#fcfdfe',
  },
  emptyTitle: { display: 'block', fontSize: 15, fontWeight: 700, color: INK },
  emptyBody: { margin: '7px 0 14px', fontSize: 12.5, color: SUB, lineHeight: 1.55 },
}
