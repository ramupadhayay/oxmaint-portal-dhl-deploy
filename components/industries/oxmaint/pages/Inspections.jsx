'use client'

// Inspection Reports.
//
// This screen used to open with a header tile, a strip of six numbers and a
// table. The product opens it with a summary-card row you can show and hide,
// three rate cards, an alert band and a list of two-block rows — so that is
// what it opens with now, out of the same kit the pharmaceutical portal's copy
// uses. The two registers hold different things; they should not look like
// different products.
//
// What did not change is the half that does the work. The rows can still be
// run, the run still rewrites the row it came from rather than filing a second
// copy beside it, and the record still opens in the drawer this portal opens
// records in — this portal has no record route to send it to, and inventing one
// for a single screen is how two navigation models end up in one product.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Drawer, Fields, StatusBadge, Bar, ActionButton, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useRecords, useStore } from '../lib/store'
import RecordHistory from '../components/RecordHistory'
import { useSite } from '../lib/siteStore'
import { InspectionRunner, itemCount, sheetFor } from '../lib/inspectionItems'
import { assetTypeFor, conditionCount, verdictLabel, withinLimit } from '../lib/inspectionSheet'
import { INSPECTIONS, INSPECTION_TYPE_DEFS, fmtDate, daysFrom } from '../lib/data'
import {
  Action, Glyph, Menu, MenuCheck, MenuLabel, SummaryCards, RateCards,
  AlertBand, ListHeader, ViewToggle, SearchBar, Pagination, useCardVisibility,
} from '../lib/productKit'
// This portal's own `PageHeader` is a 44px icon tile and a 22px title; the
// product opens a screen with a 30px title and no tile. The FSM portal had
// already rebuilt it to match, with the reasoning written into it, so this
// imports that rather than making a third version that drifts from both.
import PageHeading from '../../datacenter/components/PageHeading'
// The product's own card and tiles. Aliased because this file already imports a
// component of the same name from the inline-styled kit, which the grid below
// no longer uses.
import ProductInspectionCard from '../components/InspectionCard'
import InspectionSummary from '../components/InspectionSummary'
import {
  InspectionRow, InspectionCard, InspectionEmpty, styles, DASH,
} from '../lib/inspectionKit'

const { MUTE, SUB, INK, LINE, ACCENT, GREEN, AMBER, RED } = PALETTE

const idOf = (r) => r.inspection_id || r.recordId

const RESULT_TONE = { Pass: 'slate', 'Pass with observations': 'amber', Fail: 'red' }
const STATUS_TONE = {
  Completed: 'slate', 'Open finding': 'red', 'In Progress': 'amber',
  Scheduled: 'amber', Overdue: 'red',
}

// The six the product ships, in its order. Each is a cut of the list as well as
// a number, which is why the predicate lives beside the label. Only the two
// somebody has to act on carry a colour; colouring the other four said nothing
// while making those two impossible to pick out.
/** Carried out, whether or not it left a finding open. */
const isDone = (r) => r._state === 'Completed' || r._state === 'Open finding'

const CARDS = [
  { key: 'total', label: 'Total Inspections', icon: 'clipboard', keep: () => true },
  { key: 'completed', label: 'Completed', icon: 'check', keep: (r) => r._state === 'Completed' || r._state === 'Open finding' },
  { key: 'pending', label: 'Pending', icon: 'clock', keep: (r) => r._state === 'Scheduled' || r._state === 'In Progress' },
  // Pass and fail are counted only over inspections that were actually carried
  // out. Counting a result on a scheduled row — the seed data carries one —
  // made "passed" exceed "completed" and the pass rate read 127%.
  { key: 'passed', label: 'Passed', icon: 'check', keep: (r) => isDone(r) && r.result === 'Pass' },
  { key: 'failed', label: 'Failed', icon: 'cross', alert: true, tone: 'red', keep: (r) => isDone(r) && r.result === 'Fail' },
  { key: 'overdue', label: 'Overdue', icon: 'warning', alert: true, tone: 'amber', keep: (r) => r._state === 'Overdue' },
]

const STATUSES = ['Scheduled', 'In Progress', 'Completed', 'Open finding', 'Overdue']
const RESULTS = ['Pass', 'Pass with observations', 'Fail']

// What the sheet under a report is, said plainly. Only one of the three is a
// signature, and a rebuilt sheet that does not say so is a record that lies —
// the number on it was never written down by anybody.
const SHEET_NOTE = {
  signed: 'As answered on the round and written onto this record.',
  planned: 'The lines this round will ask. Nothing has been answered yet.',
  reconstructed: 'Rebuilt from the recorded result and findings — not the sheet that was signed.',
}

const VERDICT_TONE = {
  pass: { fg: '#047857', bg: '#f0fdf4', bd: '#bbf7d0' },
  fail: { fg: '#b91c1c', bg: '#fef2f2', bd: '#fecaca' },
  na: { fg: '#475569', bg: '#f8fafc', bd: '#e2e8f0' },
  none: { fg: MUTE, bg: '#fff', bd: LINE },
}

export default function Inspections() {
  const { scope, siteId, setSiteId, sites, siteName } = useSite()
  const router = useRouter()
  const { update, records } = useStore()

  const [shown, toggleCard] = useCardVisibility('oxInspectionSummaryCards', CARDS.map((c) => c.key))
  const [cut, setCut] = useState('total')
  const [search, setSearch] = useState('')
  const [view, setView] = useState('list')
  const [status, setStatus] = useState('all')
  const [result, setResult] = useState('all')
  const [type, setType] = useState('all')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [open, setOpen] = useState(null)
  const [running, setRunning] = useState(null)
  const [showSheet, setShowSheet] = useState(true)

  const merged = useRecords('inspection', INSPECTIONS, idOf)
  // Inspection reminders are stored under the same record kind, so a reminder
  // rolled forward would otherwise land here as a report with no reference, no
  // type and no asset. A report is the half that carries a number.
  const scoped = useMemo(() => scope(merged.filter((i) => i.inspection_number)), [scope, merged])
  const types = useMemo(() => [...new Set(INSPECTIONS.map((i) => i.inspection_type))], [])

  const workOrders = records?.work_order || []
  const raisedFrom = useMemo(() => {
    const map = new Map()
    workOrders.forEach((w) => {
      const ref = String(w.raised_from || '')
      if (!ref.startsWith('Inspection ')) return
      const key = ref.slice('Inspection '.length)
      map.set(key, [...(map.get(key) || []), w])
    })
    return map
  }, [workOrders])

  // Two states this register carries but does not store.
  //
  // A round booked for a date that has passed is Overdue, and a completed round
  // whose findings nobody turned into work is an Open finding — the gap the
  // product's own AI Auditor reports, because a finding with no follow-up is a
  // finding that will be found again next month. Both are read off facts the
  // register already holds rather than written into it, so they cannot go stale.
  const today = daysFrom(0)
  const all = useMemo(() => scoped.map((i) => {
    const done = i.status === 'Completed'
    const openFinding = done && i.findings_count > 0 && !(raisedFrom.get(i.inspection_number) || []).length
    const overdue = !done && String(i.scheduled_date) < String(today)
    return {
      ...i,
      _state: openFinding ? 'Open finding' : overdue ? 'Overdue' : i.status,
      _openFinding: openFinding,
    }
  }), [scoped, raisedFrom, today])

  const counts = useMemo(() => {
    const out = {}
    for (const c of CARDS) out[c.key] = all.filter(c.keep).length
    return out
  }, [all])

  const scored = all.filter((i) => typeof i.score === 'number' && i.status === 'Completed')
  const avgScore = scored.length
    ? Math.round((scored.reduce((n, i) => n + i.score, 0) / scored.length) * 10) / 10
    : 0
  const completionPct = counts.total ? Math.round((counts.completed / counts.total) * 100) : 0
  const passPct = counts.completed ? Math.round((counts.passed / counts.completed) * 100) : 0

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const keep = (CARDS.find((c) => c.key === cut) || CARDS[0]).keep
    return all.filter((i) => (
      keep(i)
      && (status === 'all' || i._state === status)
      && (result === 'all' || i.result === result)
      && (type === 'all' || i.inspection_type === type)
      && (!q || [i.inspection_number, i.asset_name, i.inspector_name, i.inspection_type, i.site_name]
        .filter(Boolean).join(' ').toLowerCase().includes(q))
    ))
  }, [all, cut, status, result, type, search])

  // Any narrowing puts the reader on a page that may no longer exist. Sending
  // them back to the first one beats an empty list under a pager that says
  // there are forty.
  useEffect(() => { setPage(0) }, [cut, status, result, type, search, pageSize, siteId])

  const paged = useMemo(
    () => rows.slice(page * pageSize, page * pageSize + pageSize),
    [rows, page, pageSize],
  )

  const filtersOn = status !== 'all' || result !== 'all' || type !== 'all'
  const searching = Boolean(search.trim()) || filtersOn || cut !== 'total'

  const scoreColor = (n) => (n >= 80 ? GREEN : n >= 65 ? AMBER : RED)

  const subject = running && {
    key: idOf(running),
    reference: running.inspection_number,
    inspection_type: running.inspection_type,
    asset_id: running.asset_id,
    asset_name: running.asset_name,
    inspector_name: running.inspector_name,
  }

  // Written back onto the inspection that was run, so the row changes in place.
  const completeRun = async (summary) => {
    await update('inspection', idOf(running), {
      ...summary,
      inspection_number: running.inspection_number,
      inspection_type: running.inspection_type,
      status: 'Completed',
      completed_date: daysFrom(0),
    })
    return running.inspection_number
  }

  const openFindings = open?.findings || []
  const openWorkOrders = open ? (raisedFrom.get(open.inspection_number) || []) : []

  // The lines behind the record, and whether they were signed, rebuilt or are
  // still to be walked. The sheet is last in the drawer and open by default —
  // reading a round line by line is the whole reason it is kept — and folds
  // away for anyone who came for the summary. The readings come out above it
  // whatever happens: two numbers against their limits are the fastest read of
  // a round anybody gets.
  const sheet = useMemo(() => sheetFor(open), [open])
  const readings = sheet.lines.filter((l) => l.value)
  useEffect(() => { setShowSheet(true) }, [open])

  return (
    <div>
      <PageHeading
        title="Inspection Reports"
        subtitle="Track and manage all inspection activities across your sites and assets"
        right={(
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Action icon="refresh"
              onClick={() => { setSearch(''); setCut('total'); setStatus('all'); setResult('all'); setType('all') }}>
              Refresh
            </Action>
            <div style={{ position: 'relative' }}>
              <select value={siteId} onChange={(e) => setSiteId(e.target.value)}
                aria-label="Location filter" style={styles.locationSelect}>
                <option value="all">All Sites</option>
                {sites.map((s) => <option key={s.site_id} value={s.site_id}>{s.site_name}</option>)}
              </select>
              <span style={styles.locationFace}>
                <Glyph name="pin" size={14} color={siteId === 'all' ? SUB : '#15227a'} />
                <span style={{ color: siteId === 'all' ? SUB : '#15227a' }}>{siteName}</span>
              </span>
            </div>
            <Action icon="download" onClick={() => exportReports(rows)}>Export</Action>
            <Action icon="play" primary onClick={() => router.push('/portal/oxmaint/inspections-create')}>
              New Inspection
            </Action>
          </div>
        )}
      />

      {/* The product's tiles, which carry their own visibility menu — the
          separate one that used to sit above them is gone rather than left
          alongside, since two controls for one thing is one too many. The card
          keys are the same six the list filters on, so picking a tile still
          narrows the list exactly as before. */}
      <InspectionSummary
        counts={counts}
        completionPct={completionPct}
        passPct={passPct}
        activeCard={cut === 'total' ? null : cut}
        onCardClick={(k) => setCut(k || 'total')}
      />

      <RateCards cards={[
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
        right={(
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
                </select>
              </label>

              <label style={styles.filterField}>
                <span style={styles.filterLabel}>Type</span>
                <select value={type} onChange={(e) => setType(e.target.value)} style={styles.select}>
                  <option value="all">All Types</option>
                  {types.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 11 }}>
                <Action onClick={() => { setStatus('all'); setResult('all'); setType('all') }}>Clear Filters</Action>
              </div>
            </Menu>
            <ViewToggle value={view} onChange={setView} />
          </>
        )}
      />

      <SearchBar value={search} onChange={setSearch} placeholder="Search inspections..." />

      {rows.length === 0 ? (
        <InspectionEmpty
          searching={searching}
          title={searching ? 'No inspections found' : 'No inspections available'}
          body={searching
            ? 'Try adjusting your search terms to find what you’re looking for.'
            : 'Start your first inspection to begin tracking your asset conditions.'}
          action={(
            <Action icon="play" primary onClick={() => router.push('/portal/oxmaint/inspections-create')}>
              Start Inspection
            </Action>
          )}
        />
      ) : (
        <>
          {/* One card in both views, three across or one, because the product
              draws inspections as a grid of cards and a second visual language
              for the same record is what made this portal read as a different
              product in the first place. */}
          <div className={view === 'grid'
            ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
            : 'grid grid-cols-1 gap-4'}>
            {/* `i` itself, not present(i): that presenter reshapes for the
                inline-styled card this replaced, and under its renamed fields
                every card came out blank. */}
            {paged.map((i, n) => (
              <ProductInspectionCard
                key={idOf(i)} inspection={i} index={n}
                onView={() => setOpen(i)} onStart={() => setRunning(i)}
              />
            ))}
          </div>

          <Pagination
            page={page} pageSize={pageSize} total={rows.length}
            onPage={setPage} onPageSize={setPageSize}
          />
        </>
      )}

      <Drawer open={Boolean(open)} onClose={() => setOpen(null)} title={open?.inspection_number} subtitle={open?.inspection_type}
        icon={sectionIcon('inspections', ACCENT)}
        footer={open && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <ActionButton variant="ghost" onClick={() => setOpen(null)}>Close</ActionButton>
            <ActionButton variant={open.status === 'Completed' ? 'ghost' : 'primary'}
              onClick={() => { setOpen(null); setRunning(open) }}>
              {open.status === 'Completed' ? 'Inspect again' : 'Start inspection'}
            </ActionButton>
          </div>
        )}>
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <StatusBadge>{open.result}</StatusBadge>
              <StatusBadge>{open._state}</StatusBadge>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                <span style={{ color: SUB, fontWeight: 600 }}>Score</span>
                <span style={{ fontWeight: 800, color: scoreColor(open.score) }}>{open.score}%</span>
              </div>
              <Bar pct={open.score} color={scoreColor(open.score)} />
            </div>
            <Fields rows={[
              ['Asset', open.asset_name],
              ['Site', open.site_name],
              ['Inspector', open.inspector_name],
              ['Date', fmtDate(open.completed_date || open.scheduled_date)],
              ['Duration', `${open.duration_minutes} min`],
              ['Findings', open.findings_count || 'None'],
              open.items_total ? ['Items', `${open.items_passed} passed of ${open.items_total}${open.items_na ? `, ${open.items_na} N/A` : ''}`] : null,
              // Two counts, because they are two things: the round asks the same
              // checklist everywhere, and the machine adds its own condition
              // lines on top. Adding them together would put a number on this
              // screen that the reminder register contradicts.
              ['Checklist', `${itemCount(open.inspection_type)} items`
                + (conditionCount(assetTypeFor(open)) ? ` + ${conditionCount(assetTypeFor(open))} condition lines` : '')],
            ]} />

            {open.note && (
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: SUB }}>{open.note}</p>
            )}

            {openFindings.length > 0 && (
              <div>
                <div style={styles.filterLabel}>Findings</div>
                {openFindings.map((f) => (
                  <div key={f.text} style={{ padding: '8px 0', borderBottom: `1px solid ${LINE}` }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: INK, lineHeight: 1.45 }}>
                      {f.text}
                      {f.critical && <span style={sheetStyles.dot} title="Critical line" />}
                    </div>
                    {f.reading && (
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: RED, marginTop: 3 }}>
                        {f.reading}{f.limit ? ` · limit ${f.limit}` : ''}
                      </div>
                    )}
                    {f.note && <div style={{ fontSize: 11.5, color: SUB, marginTop: 3 }}>{f.note}</div>}
                  </div>
                ))}
              </div>
            )}

            {openWorkOrders.length > 0 ? (
              <div>
                <div style={styles.filterLabel}>Corrective work raised</div>
                {openWorkOrders.map((w) => (
                  <div key={w.work_order_number} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '8px 0', borderBottom: `1px solid ${LINE}` }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: ACCENT, minWidth: 76 }}>{w.work_order_number}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: INK, lineHeight: 1.45 }}>{w.title}</span>
                    <StatusBadge>{w.priority}</StatusBadge>
                  </div>
                ))}
              </div>
            ) : open.findings_count > 0 && (
              <p style={{ margin: 0, padding: '9px 12px', fontSize: 12.5, lineHeight: 1.5, borderRadius: 9, background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309' }}>
                {open.findings_count} finding{open.findings_count > 1 ? 's' : ''} raised against {open.asset_name} with no corrective work order behind them.
                Run the inspection again to record the current state and raise the work.
              </p>
            )}

            {readings.length > 0 && (
              <div>
                <div style={styles.filterLabel}>Readings</div>
                <div style={sheetStyles.readGrid}>
                  {readings.map((l) => {
                    const out = withinLimit(l.limit, l.reading) === false
                    return (
                      <div key={l.id} style={{
                        ...sheetStyles.readCard,
                        borderColor: out ? '#fecaca' : LINE,
                        background: out ? '#fef2f2' : '#fff',
                      }}>
                        <div style={sheetStyles.readLabel}>{l.text}</div>
                        <div style={{ ...sheetStyles.readValue, color: out ? RED : INK }}>{l.value}</div>
                        {l.limit && <div style={sheetStyles.readLimit}>limit {l.limit}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {sheet.lines.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <div style={styles.filterLabel}>The sheet — {sheet.lines.length} lines</div>
                  <button onClick={() => setShowSheet((v) => !v)} style={sheetStyles.link}>
                    {showSheet ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p style={sheetStyles.provenance}>{SHEET_NOTE[sheet.state]}</p>

                {showSheet && (
                  <div style={{ display: 'grid', gap: 7 }}>
                    {sheet.lines.map((l, i) => {
                      const tone = VERDICT_TONE[l.response] || VERDICT_TONE.none
                      const out = l.reading != null && withinLimit(l.limit, l.reading) === false
                      return (
                        <div key={l.id} style={{ ...sheetStyles.line, borderColor: tone.bd, background: tone.bg }}>
                          <span style={sheetStyles.num}>{i + 1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={sheetStyles.text}>
                              {l.text}
                              {l.critical && <span style={sheetStyles.dot} title="Critical line — a failure here is not a note for next month" />}
                            </div>
                            <div style={sheetStyles.meta}>
                              {l.responseType}{l.limit ? ` · limit ${l.limit}` : ''}
                            </div>
                            {l.value && (
                              <div style={{ ...sheetStyles.value, color: out ? RED : INK }}>
                                Measured {l.value}{out ? ' — outside limit' : ''}
                              </div>
                            )}
                            {l.note && <div style={sheetStyles.note}>{l.note}</div>}
                          </div>
                          <span style={{ ...sheetStyles.verdict, color: tone.fg, borderColor: tone.bd }}>
                            {verdictLabel(l)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
            {/* Who ran it, when it was completed, and what the score and
                result were before — written by the records API as it happened,
                and not editable afterwards. */}
            <RecordHistory kind="inspection" recordId={String(idOf(open))} title="Audit trail" limit={12} />
          </div>
        )}
      </Drawer>

      <InspectionRunner
        open={Boolean(running)}
        onClose={() => setRunning(null)}
        subject={subject}
        onSubmit={completeRun}
      />
    </div>
  )
}

/**
 * One register row in the shape the shared list draws.
 *
 * Everything the row shows is read off the record; nothing is filled in to make
 * a column look occupied. A round nobody has walked has no items, no inspector
 * and no duration it actually took, and the row says so.
 */
function present(i) {
  const walked = i.status === 'Completed'
  const items = i.items_total
    ? {
      total: i.items_total,
      passed: i.items_passed ?? 0,
      failed: Math.max(0, i.items_total - (i.items_passed ?? 0) - (i.items_na ?? 0)),
      action: i.findings_count || 0,
    }
    : null

  const tags = []
  if (i._openFinding) tags.push({ icon: 'warning', tone: '#b45309', label: 'Follow-up Required' })
  if (walked) tags.push({ icon: 'check', tone: '#047857', label: 'Signature Captured' })
  tags.push({ icon: 'doc', tone: SUB, label: `${i.inspection_type} · ${itemCount(i.inspection_type)} items` })

  return {
    id: idOf(i),
    reference: i.inspection_number,
    title: i.inspection_type,
    status: i._state,
    result: walked ? i.result : null,
    asset: i.asset_name,
    location: i.site_name,
    inspector: walked ? i.inspector_name : null,
    assignee: i.inspector_name,
    date: fmtDate(i.completed_date || i.scheduled_date),
    frequency: FREQUENCY[i.inspection_type] || DASH,
    duration: walked && i.duration_minutes ? `${i.duration_minutes} min` : DASH,
    items,
    score: walked && typeof i.score === 'number' ? { pct: i.score } : null,
    tags,
    notes: i.note || null,
    startable: !walked,
  }
}

// The sheet, in the drawer. Kept beside the screen that draws it rather than in
// the shared inspection kit: the row and the card are the same on every portal
// that shows an inspection list, and this is the one register that keeps a
// filled sheet behind the row.
const sheetStyles = {
  link: {
    background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: 11,
    fontWeight: 700, color: ACCENT, cursor: 'pointer', textDecoration: 'underline',
  },
  provenance: { margin: '4px 0 9px', fontSize: 11.5, color: MUTE, lineHeight: 1.5 },
  line: { display: 'flex', alignItems: 'flex-start', gap: 9, padding: '9px 11px', borderRadius: 9, border: '1px solid' },
  num: {
    width: 20, height: 20, borderRadius: 6, flexShrink: 0, background: '#eef2ff', color: ACCENT,
    fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  text: { fontSize: 12.5, fontWeight: 600, color: INK, lineHeight: 1.45 },
  meta: { fontSize: 10.5, color: MUTE, marginTop: 2 },
  value: { fontSize: 11.5, fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums' },
  note: { fontSize: 11.5, color: SUB, marginTop: 4, lineHeight: 1.5 },
  dot: { display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: RED, marginLeft: 6, verticalAlign: 'middle' },
  verdict: {
    fontSize: 10, fontWeight: 700, background: '#fff', border: '1px solid', borderRadius: 999,
    padding: '2.5px 8px', whiteSpace: 'nowrap', flexShrink: 0,
  },
  readGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, marginTop: 6 },
  readCard: { border: '1px solid', borderRadius: 9, padding: '9px 11px' },
  readLabel: { fontSize: 11, color: SUB, lineHeight: 1.4 },
  readValue: { fontSize: 14, fontWeight: 800, marginTop: 4, fontVariantNumeric: 'tabular-nums' },
  readLimit: { fontSize: 10.5, color: MUTE, marginTop: 2 },
}

/**
 * How often each round comes back.
 *
 * Read off the type rather than stored per row, because that is what it is: a
 * daily walk-round is daily on every asset, and a row carrying its own copy of
 * that would be a row that could disagree with the other thirty-nine.
 */
const FREQUENCY = INSPECTION_TYPE_DEFS
  ? Object.fromEntries(INSPECTION_TYPE_DEFS.map((t) => [t.type, t.cadence]))
  : {
    'Daily walk-round': 'Daily',
    'Pre-start check': 'Every shift',
    'Safety inspection': 'Monthly',
    'Condition survey': 'Quarterly',
  }

function exportReports(rows) {
  const head = ['Reference', 'Type', 'Asset', 'Site', 'Inspector', 'Date', 'Status', 'Result', 'Score', 'Findings']
  const body = rows.map((i) => [
    i.inspection_number, i.inspection_type, i.asset_name, i.site_name, i.inspector_name,
    i.completed_date || i.scheduled_date, i._state, i.status === 'Completed' ? i.result : '',
    i.status === 'Completed' ? i.score : '', i.findings_count || 0,
  ])
  const csv = [head, ...body]
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'inspection-reports.csv'
  a.click()
  URL.revokeObjectURL(url)
}
