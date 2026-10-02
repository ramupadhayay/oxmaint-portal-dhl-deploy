'use client'

// The Inspection module, in the layout Oxmaint's own Inspection module uses.
//
// These four screens were registers over a DataTable. The product's are not:
// each is a summary row whose cards filter the list, a full-width search box
// with the filters behind a button, a list/grid toggle, a stack of record cards
// carrying their own three-column detail block, and a pagination bar. The
// fields are this PoC's; the shape is the product's.
//
// Three of the four have no data in the client's workbooks, so their rows are
// built from what the workbooks do carry — the PM task library and the asset
// register. Incidents are the exception: those are the client's own records,
// shown as authored.
//
// Inspections raised in the portal land in the same list and carry a badge
// saying so, because somebody should be able to point at the row they just
// made.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeading from '../components/PageHeading'
import MetricCard, { MetricGrid, Glyph } from '../components/MetricCard'
import {
  ProductStyles, ViewToggle, CountHeading, SearchBar, FilterButton, FilterPanel,
  FilterSelect, ActiveFilters, RecordCard, DetailColumns, DetailColumn, KV,
  Pagination, EmptyState, useListControls, Icons,
} from '../components/product'
import { StatusBadge, ActionButton, PALETTE } from '../lib/kit'
import { useSite } from '../lib/siteStore'
import { useInspectionStore, useChecklistStore } from '../lib/store'
import {
  INSPECTION_REPORTS, INSPECTION_REMINDERS, CHECKLISTS, INCIDENT_ROWS,
  shapeInspection, shapeChecklist, responseOf,
} from '../lib/inspections'
import { fmtDate, toneOf } from '../lib/data'

const { SUB, MUTE, INK, LINE, ACCENT } = PALETTE

const VIEWS = [
  { key: 'list', label: 'List', icon: Icons.list },
  { key: 'grid', label: 'Grid', icon: Icons.grid },
]

const resultTone = (r) => ({
  Passed: 'green', 'Passed with observations': 'amber', Failed: 'red', 'In progress': 'blue',
}[r] || 'grey')

const dueTone = (s) => ({
  Overdue: 'red', 'Due this week': 'amber', 'Due this month': 'blue', Scheduled: 'grey',
}[s] || 'grey')

const scoreColour = (n) => (n >= 80 ? '#059669' : n >= 60 ? '#d97706' : '#dc2626')

// ═══ 1. Inspection Reports ═══════════════════════════════════════════════
export function InspectionReports() {
  const router = useRouter()
  const { scope, siteName } = useSite()
  const { created } = useInspectionStore()
  // Grid by default. The list row is the denser read and was the default at
  // first, but the card is what the screen is for here — a wall of cards is
  // scannable at a glance, and the list is one click away for anyone who wants
  // the detail columns.
  const [view, setView] = useState('grid')
  const [kpi, setKpi] = useState(null)

  // What was raised in the portal sits at the top of the list, newest first —
  // the record somebody just made is the one they are looking for.
  const rows = useMemo(() => {
    const mine = created.map(shapeInspection)
    return [...mine, ...INSPECTION_REPORTS]
  }, [created])

  const scoped = useMemo(() => scope(rows), [scope, rows])

  const KPIS = [
    { key: 'total', label: 'Inspections', variant: 'default', icon: 'list', test: () => true },
    { key: 'passed', label: 'Passed', variant: 'success', icon: 'tick', test: (r) => r.result === 'Passed' },
    { key: 'obs', label: 'With observations', variant: 'warning', icon: 'clock', test: (r) => r.result === 'Passed with observations' },
    { key: 'failed', label: 'Failed', variant: 'destructive', icon: 'alert', test: (r) => r._failed },
    { key: 'mine', label: 'Raised here', variant: 'default', icon: 'wrench', test: (r) => r._created },
  ]

  const base = useMemo(() => {
    const k = KPIS.find((x) => x.key === kpi)
    return k && k.key !== 'total' ? scoped.filter(k.test) : scoped
  }, [scoped, kpi])

  const c = useListControls(base, {
    search: ['reportId', '_asset', 'task', 'inspector', 'assetClass', '_site'],
    filters: [
      { field: 'result', label: 'Result' },
      { field: 'criticality', label: 'Criticality' },
      { field: 'inspector', label: 'Inspector' },
      { field: 'assetClass', label: 'Asset class' },
    ],
  })

  const open = (r) => router.push(`/portal/datacenter/inspection-reports/${encodeURIComponent(r.reportId)}`)

  return (
    <div>
      <ProductStyles />

      <PageHeading
        title="Inspection Reports"
        subtitle="What has been inspected, by whom, and what they found."
        right={
          <ActionButton onClick={() => router.push('/portal/datacenter/inspection-reports/new')}>
            + New inspection
          </ActionButton>
        }
      />

      <MetricGrid>
        {KPIS.map((k) => {
          const n = k.key === 'total' ? scoped.length : scoped.filter(k.test).length
          const on = kpi === k.key
          return (
            <div key={k.key} style={on ? styles.kpiOn : undefined}>
              <MetricCard
                title={k.label} value={n} icon={<Glyph name={k.icon} />} variant={k.variant}
                note={on ? 'Filtering the list — click to clear' : undefined}
                onClick={() => setKpi(on ? null : k.key)}
              />
            </div>
          )
        })}
      </MetricGrid>

      <div style={{ marginBottom: 14 }}>
        <SearchBar value={c.query} onChange={c.setQuery} placeholder="Search report, asset, task, inspector…" />
      </div>

      <ActiveFilters items={c.active} onClear={c.clear} />

      <FilterPanel open={c.panel} count={c.active.length} onClear={c.clearAll}>
        <FilterSelect label="Result" value={c.picked.result || 'all'} onChange={(v) => c.set('result', v)} options={c.options.result} allLabel="All results" />
        <FilterSelect label="Criticality" value={c.picked.criticality || 'all'} onChange={(v) => c.set('criticality', v)} options={c.options.criticality} allLabel="All criticalities" />
        <FilterSelect label="Inspector" value={c.picked.inspector || 'all'} onChange={(v) => c.set('inspector', v)} options={c.options.inspector} allLabel="All inspectors" />
        <FilterSelect label="Asset class" value={c.picked.assetClass || 'all'} onChange={(v) => c.set('assetClass', v)} options={c.options.assetClass} allLabel="All classes" />
      </FilterPanel>

      <CountHeading
        icon={Icons.clipboard} label="Inspections" count={`${c.slice.length} of ${c.shown.length}`}
        right={
          <>
            {siteName !== 'All Sites' && <StatusBadge tone="blue">{siteName}</StatusBadge>}
            <FilterButton open={c.panel} onToggle={() => c.setPanel(!c.panel)} count={c.active.length} />
            <ViewToggle value={view} onChange={setView} options={VIEWS} />
          </>
        }
      />

      {c.shown.length === 0 ? (
        <EmptyState icon={<Glyph name="list" size={44} />} title="No inspection matches these filters."
          body="Clear the search or the filters above, or start a new inspection." />
      ) : view === 'grid' ? (
        <div style={styles.grid}>
          {c.slice.map((r) => <ReportCard key={r.reportId} report={r} onOpen={() => open(r)} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {c.slice.map((r) => <ReportRow key={r.reportId} report={r} onOpen={() => open(r)} />)}
        </div>
      )}

      {c.shown.length > 0 && (
        <Pagination page={c.page} pageSize={c.pageSize} total={c.shown.length}
          onPage={c.setPage} onPageSize={c.setPageSize} itemType="inspections" />
      )}
    </div>
  )
}

function ReportRow({ report: r, onOpen }) {
  return (
    <RecordCard onClick={onOpen}>
      <div style={styles.head}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.titleRow}>
            <h3 style={styles.code}>{r.reportId}</h3>
            <StatusBadge tone={resultTone(r.result)}>{r.result}</StatusBadge>
            <StatusBadge tone={toneOf(r.criticality)}>{r.criticality}</StatusBadge>
            {r._created && <StatusBadge tone="blue">Raised in this portal</StatusBadge>}
          </div>

          <div style={{ display: 'grid', gap: 6, marginTop: 10, fontSize: 12.5, color: SUB }}>
            <Line icon={Icons.box} label="Asset">{r._asset}</Line>
            <Line icon={Icons.pin} label="Location">{r._site} · {r._location}</Line>
            <Line icon={Icons.clipboard} label="Task">{r.task}</Line>
            <Line icon={Icons.user} label="Inspector">{r.inspector || '—'}</Line>
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: scoreColour(r.score), letterSpacing: '-0.02em', lineHeight: 1 }}>
            {r.score}%
          </div>
          <div style={{ fontSize: 11, color: MUTE, marginTop: 4 }}>{fmtDate(r.date)}</div>
        </div>
      </div>

      <div style={styles.body}>
        <DetailColumns>
          <DetailColumn icon={Icons.calendar} title="Schedule">
            <KV label="Inspected" value={fmtDate(r.date)} />
            <KV label="Frequency" value={r.frequency} />
            <KV label="PM reference" value={r.taskId} />
          </DetailColumn>

          <DetailColumn icon={Icons.check} title="Result">
            <KV label="Score" value={`${r.score} / 100`} />
            <KV label="Outcome" value={r.result} tone={r._failed ? '#dc2626' : undefined} />
            <KV label="Standard" value={r.standard || '—'} />
          </DetailColumn>

          <DetailColumn icon={Icons.file} title="Findings">
            {r.findings
              ? <p style={styles.findings}>{r.findings}</p>
              : <p style={{ ...styles.findings, color: MUTE }}>No findings recorded — the inspection passed clean.</p>}
          </DetailColumn>
        </DetailColumns>
      </div>
    </RecordCard>
  )
}

function ReportCard({ report: r, onOpen }) {
  return (
    <RecordCard onClick={onOpen} style={{ height: '100%' }}>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={styles.code}>{r.reportId}</span>
          <StatusBadge tone={resultTone(r.result)}>{r.result}</StatusBadge>
          {r._created && <StatusBadge tone="blue">New</StatusBadge>}
        </div>

        <h3 style={{ ...styles.cardName, marginTop: 10 }}>{r._asset}</h3>
        <p style={styles.cardTask}>{r.task}</p>

        <div style={{ display: 'grid', gap: 6, marginTop: 12, fontSize: 12, color: SUB }}>
          <KV label="Inspected" value={fmtDate(r.date)} />
          <KV label="Inspector" value={r.inspector || '—'} />
          <KV label="Criticality" value={r.criticality} />
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 14, display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: scoreColour(r.score), letterSpacing: '-0.02em' }}>{r.score}%</span>
          <span style={{ fontSize: 11, color: MUTE }}>score</span>
        </div>
      </div>
    </RecordCard>
  )
}

// ═══ 2. Inspection Reminder ══════════════════════════════════════════════
const TABS = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'overdue', label: 'Overdue', test: (r) => r._overdue },
  { key: 'week', label: 'Due this week', test: (r) => !r._overdue && r._daysAway <= 7 },
  { key: 'scheduled', label: 'Scheduled', test: (r) => r.status === 'Scheduled' },
]

export function InspectionReminder() {
  const router = useRouter()
  const { scope, siteName } = useSite()
  const [tab, setTab] = useState('all')

  const scoped = useMemo(() => scope(INSPECTION_REMINDERS), [scope])
  const base = useMemo(() => scoped.filter(TABS.find((t) => t.key === tab).test), [scoped, tab])

  const c = useListControls(base, {
    search: ['reminderId', '_asset', 'task', 'assignedTo', 'assetClass'],
    filters: [
      { field: 'frequency', label: 'Frequency' },
      { field: 'criticality', label: 'Criticality' },
      { field: 'assignedTo', label: 'Assigned to' },
    ],
  })

  const open = (r) => router.push(`/portal/datacenter/inspection-reminder/${encodeURIComponent(r.reminderId)}`)

  return (
    <div>
      <ProductStyles />

      <PageHeading
        title="Inspection Reminder"
        subtitle="What is due, and what has slipped past its date. Each is scheduled on its own task's frequency from the PM library."
      />

      <MetricGrid>
        <MetricCard title="Reminders" value={scoped.length} icon={<Glyph name="clock" />} />
        <MetricCard title="Overdue" value={scoped.filter((r) => r._overdue).length} icon={<Glyph name="alert" />} variant="destructive" />
        <MetricCard title="Due this week" value={scoped.filter((r) => !r._overdue && r._daysAway <= 7).length} icon={<Glyph name="clock" />} variant="warning" />
        <MetricCard title="On critical assets" value={scoped.filter((r) => r.criticality === 'Critical').length} icon={<Glyph name="asset" />} variant="warning" />
        <MetricCard title="Scheduled" value={scoped.filter((r) => r.status === 'Scheduled').length} icon={<Glyph name="tick" />} variant="success" />
      </MetricGrid>

      {/* Tabs rather than another select: overdue-versus-upcoming is the split
          somebody opens this screen to make, and the product puts that split on
          a tab bar with the count on it. */}
      <div style={styles.tabs}>
        {TABS.map((t) => {
          const n = scoped.filter(t.test).length
          const on = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ ...styles.tab, ...(on ? styles.tabOn : null) }}>
              {t.label}
              <span style={{ ...styles.tabCount, ...(on ? styles.tabCountOn : null) }}>{n}</span>
            </button>
          )
        })}
      </div>

      <div style={{ marginBottom: 14 }}>
        <SearchBar value={c.query} onChange={c.setQuery} placeholder="Search reminder, asset, task, team…" />
      </div>

      <ActiveFilters items={c.active} onClear={c.clear} />

      <FilterPanel open={c.panel} count={c.active.length} onClear={c.clearAll}>
        <FilterSelect label="Frequency" value={c.picked.frequency || 'all'} onChange={(v) => c.set('frequency', v)} options={c.options.frequency} allLabel="All frequencies" />
        <FilterSelect label="Criticality" value={c.picked.criticality || 'all'} onChange={(v) => c.set('criticality', v)} options={c.options.criticality} allLabel="All criticalities" />
        <FilterSelect label="Assigned to" value={c.picked.assignedTo || 'all'} onChange={(v) => c.set('assignedTo', v)} options={c.options.assignedTo} allLabel="Everyone" />
      </FilterPanel>

      <CountHeading
        icon={Icons.bell} label="Reminders" count={`${c.slice.length} of ${c.shown.length}`}
        right={
          <>
            {siteName !== 'All Sites' && <StatusBadge tone="blue">{siteName}</StatusBadge>}
            <FilterButton open={c.panel} onToggle={() => c.setPanel(!c.panel)} count={c.active.length} />
          </>
        }
      />

      {c.shown.length === 0 ? (
        <EmptyState icon={<Glyph name="clock" size={44} />} title="Nothing due here."
          body="Nothing matches this tab and these filters." />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {c.slice.map((r) => <ReminderRow key={r.reminderId} reminder={r} onOpen={() => open(r)} />)}
        </div>
      )}

      {c.shown.length > 0 && (
        <Pagination page={c.page} pageSize={c.pageSize} total={c.shown.length}
          onPage={c.setPage} onPageSize={c.setPageSize} itemType="reminders" />
      )}
    </div>
  )
}

function ReminderRow({ reminder: r, onOpen }) {
  return (
    <RecordCard onClick={onOpen}>
      <div style={styles.head}>
        {/* The date block on the left, because the question this screen answers
            is "when", and a due date buried in a detail column is a due date
            nobody reads. */}
        <div style={{ ...styles.dueBlock, borderColor: r._overdue ? '#fecaca' : LINE, background: r._overdue ? '#fef2f2' : '#f8fafc' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: r._overdue ? '#b91c1c' : MUTE, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            {r._overdue ? 'Overdue' : 'Due'}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: r._overdue ? '#b91c1c' : INK, marginTop: 3 }}>{fmtDate(r.dueDate)}</div>
          <div style={{ fontSize: 11, color: r._overdue ? '#b91c1c' : MUTE, marginTop: 2 }}>
            {r._overdue ? `${Math.abs(r._daysAway)} days late` : `in ${r._daysAway} days`}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.titleRow}>
            <h3 style={styles.rowName}>{r._asset}</h3>
            <StatusBadge tone={dueTone(r.status)}>{r.status}</StatusBadge>
            <StatusBadge tone={toneOf(r.criticality)}>{r.criticality}</StatusBadge>
          </div>

          <div style={{ display: 'grid', gap: 6, marginTop: 9, fontSize: 12.5, color: SUB }}>
            <Line icon={Icons.clipboard} label="Task">{r.task}</Line>
            <Line icon={Icons.user} label="Assigned to">{r.assignedTo}</Line>
            <Line icon={Icons.pin} label="Site">{r._site}</Line>
            {/* How the last round went, on the row. Without it the only way to
                tell a routine visit from one following a failure is to open
                every reminder in the list, which nobody does. */}
            {r._last && (
              <Line icon={Icons.check} label="Last done">
                {fmtDate(r._last.date)} — {r._last.result.toLowerCase()}, scored {r._last.score}
              </Line>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            <span style={styles.tag}>{r.frequency}</span>
            <span style={styles.tag}>{r.taskId}</span>
            {r.standard && <span style={styles.tag}>{r.standard}</span>}
            {r._criticalClass && <span style={styles.tag}>Critical class</span>}
          </div>
        </div>

        <span style={styles.chev}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </span>
      </div>
    </RecordCard>
  )
}

// ═══ 3. Incident Reports ═════════════════════════════════════════════════
export function IncidentReports() {
  const router = useRouter()
  const { scope, siteName } = useSite()

  const scoped = useMemo(() => scope(INCIDENT_ROWS), [scope])
  const c = useListControls(scoped, {
    search: ['incidentId', '_asset', 'assetId', 'description', 'rootCause', 'detectionMethod'],
    filters: [
      { field: 'detectionMethod', label: 'Detected by' },
      { field: '_criticality', label: 'Criticality' },
    ],
    initialPageSize: 12,
  })

  const open = (i) => router.push(`/portal/datacenter/incidents/${encodeURIComponent(i.incidentId)}`)

  return (
    <div>
      <ProductStyles />

      <PageHeading
        title="Incident Reports"
        subtitle="Past failures, their root cause and how each was found. The absence of historical condition data is itself a risk, and this is the baseline the monitoring is measured against."
      />

      <MetricGrid>
        <MetricCard title="Incidents" value={scoped.length} icon={<Glyph name="alert" />} />
        <MetricCard title="Customer-facing" value={scoped.filter((i) => i._customerImpact).length}
          variant={scoped.some((i) => i._customerImpact) ? 'destructive' : 'success'}
          icon={<Glyph name="people" />} note="redundancy held elsewhere" />
        <MetricCard title="On critical assets" value={scoped.filter((i) => i._criticality === 'Critical').length} variant="warning" icon={<Glyph name="asset" />} />
        <MetricCard title="Found by alarm" value={scoped.filter((i) => /alarm/i.test(i.detectionMethod || '')).length} icon={<Glyph name="wave" />} />
      </MetricGrid>

      <div style={{ marginBottom: 14 }}>
        <SearchBar value={c.query} onChange={c.setQuery} placeholder="Search incident, asset, failure, root cause…" />
      </div>

      <ActiveFilters items={c.active} onClear={c.clear} />

      <FilterPanel open={c.panel} count={c.active.length} onClear={c.clearAll}>
        <FilterSelect label="Detected by" value={c.picked.detectionMethod || 'all'} onChange={(v) => c.set('detectionMethod', v)} options={c.options.detectionMethod} allLabel="Any method" />
        <FilterSelect label="Criticality" value={c.picked._criticality || 'all'} onChange={(v) => c.set('_criticality', v)} options={c.options._criticality} allLabel="All criticalities" />
      </FilterPanel>

      <CountHeading
        icon={Icons.warning} label="Incidents" count={`${c.slice.length} of ${c.shown.length}`}
        right={
          <>
            {siteName !== 'All Sites' && <StatusBadge tone="blue">{siteName}</StatusBadge>}
            <FilterButton open={c.panel} onToggle={() => c.setPanel(!c.panel)} count={c.active.length} />
          </>
        }
      />

      {c.shown.length === 0 ? (
        <EmptyState icon={<Glyph name="alert" size={44} />} title="No incident matches these filters." />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {c.slice.map((i) => <IncidentRow key={i.incidentId} incident={i} onOpen={() => open(i)} />)}
        </div>
      )}

      {c.shown.length > 0 && (
        <Pagination page={c.page} pageSize={c.pageSize} total={c.shown.length}
          onPage={c.setPage} onPageSize={c.setPageSize} itemType="incidents" />
      )}
    </div>
  )
}

function IncidentRow({ incident: i, onOpen }) {
  return (
    <RecordCard onClick={onOpen}>
      <div style={styles.head}>
        <span style={{ ...styles.tile, background: i._customerImpact ? '#fef2f2' : '#eef2ff', color: i._customerImpact ? '#dc2626' : ACCENT }}>
          {Icons.warning}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.titleRow}>
            <h3 style={styles.code}>{i.incidentId}</h3>
            <StatusBadge tone={i._customerImpact ? 'red' : 'green'}>Customer impact: {i.customerImpact}</StatusBadge>
            {i._criticality && <StatusBadge tone={toneOf(i._criticality)}>{i._criticality}</StatusBadge>}
          </div>

          <p style={styles.incidentText}>{i.description}</p>

          <div style={{ display: 'grid', gap: 6, marginTop: 9, fontSize: 12.5, color: SUB }}>
            <Line icon={Icons.box} label="Asset">{i._asset}</Line>
            <Line icon={Icons.pin} label="Site">{i._site}</Line>
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 120 }}>
          <div style={{ fontSize: 11, color: MUTE }}>Downtime</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: INK, marginTop: 3 }}>{i.downtime}</div>
          <div style={{ fontSize: 11, color: MUTE, marginTop: 8 }}>{fmtDate(i.date)}</div>
        </div>
      </div>

      <div style={styles.body}>
        <DetailColumns>
          <DetailColumn icon={Icons.activity} title="Root cause">
            <p style={styles.findings}>{i.rootCause}</p>
          </DetailColumn>
          <DetailColumn icon={Icons.check} title="How it was found">
            <p style={styles.findings}>{i.detectionMethod}</p>
          </DetailColumn>
          <DetailColumn icon={Icons.box} title="Asset">
            <KV label="Reference" value={i.assetId} />
            <KV label="Class" value={i._assetClass || '—'} />
            <KV label="Criticality" value={i._criticality || '—'} />
          </DetailColumn>
        </DetailColumns>
      </div>
    </RecordCard>
  )
}

// ═══ 4. Checklist ════════════════════════════════════════════════════════
export function Checklist() {
  const router = useRouter()
  const { created } = useChecklistStore()
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState(null)

  // Authored checklists first, newest at the top — the one somebody just wrote
  // is the one they came back to look at.
  const all = useMemo(() => [...created.map(shapeChecklist), ...CHECKLISTS], [created])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return all
    return all
      .map((c) => ({ ...c, items: c.items.filter((i) => `${i.text} ${i.assetClass || ''}`.toLowerCase().includes(q)) }))
      .filter((c) => c.items.length || c.name.toLowerCase().includes(q))
  }, [all, query])

  const items = all.reduce((n, c) => n + c._itemCount, 0)
  const critical = all.reduce((n, c) => n + c._criticalCount, 0)

  // Which card is open: whatever was clicked, else the first in the list. Held
  // as "not yet chosen" rather than defaulted at mount, so a checklist created
  // a moment ago opens rather than the first library one.
  const openKey = openId ?? shown[0]?.checklistId

  return (
    <div>
      <ProductStyles />

      <PageHeading
        title="Checklist"
        subtitle="The rounds a technician works through on site, grouped the way the work is actually done."
        right={
          <ActionButton onClick={() => router.push('/portal/datacenter/checklists/new')}>
            New checklist
          </ActionButton>
        }
      />

      <MetricGrid>
        <MetricCard title="Checklists" value={all.length} icon={<Glyph name="list" />} />
        <MetricCard title="Items in total" value={items} icon={<Glyph name="tick" />} />
        <MetricCard title="On critical classes" value={critical} variant="destructive" icon={<Glyph name="alert" />} />
        <MetricCard title="Written here" value={created.length} variant={created.length ? 'success' : 'default'} icon={<Glyph name="wrench" />} />
      </MetricGrid>

      <div style={{ marginBottom: 14 }}>
        <SearchBar value={query} onChange={setQuery} placeholder="Search a checklist item or an asset class…" />
      </div>

      <CountHeading icon={Icons.clipboard} label="Checklists" count={shown.length} />

      {shown.length === 0 ? (
        <EmptyState icon={<Glyph name="list" size={44} />} title="No checklist item matches that search." />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {shown.map((c) => (
            <ChecklistCard
              key={c.checklistId}
              checklist={c}
              router={router}
              open={query.trim() ? true : openKey === c.checklistId}
              onToggle={() => setOpenId(openId === c.checklistId ? null : c.checklistId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Open the builder on an existing checklist.
 *
 * The checklist is handed over in sessionStorage rather than through the URL:
 * a whole checklist does not fit in a query string, and the builder is the same
 * route either way. Session rather than local, so a copy started in one tab is
 * not picked up by another.
 *
 * `edit` keeps the id, so the list reads the edit over what it was. `duplicate`
 * drops it, so the copy is a new checklist rather than a second face of the old.
 */
function openBuilder(router, checklist, mode) {
  try {
    window.sessionStorage.setItem('datacenter_checklist_seed', JSON.stringify({ mode, checklist }))
  } catch { /* blocked storage — the builder opens blank, which is recoverable */ }
  router.push('/portal/datacenter/checklists/new')
}

function ChecklistCard({ checklist: c, open, onToggle, router }) {
  return (
    <RecordCard>
      <button onClick={onToggle} style={styles.checkHead}>
        <span style={{ ...styles.tile, background: '#eef2ff', color: ACCENT }}>{Icons.clipboard}</span>

        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={styles.rowName}>{c.name}</div>
          <div style={{ fontSize: 11.5, color: MUTE, marginTop: 3 }}>
            {c.checklistId} · {c._itemCount} items · {c._classCount} asset classes · applies to {c.appliesTo} assets
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {c._created && <StatusBadge tone="blue">Written here</StatusBadge>}
          {c._criticalCount > 0 && <StatusBadge tone="red">{c._criticalCount} on critical assets</StatusBadge>}
          <StatusBadge tone="grey">{c.category}</StatusBadge>
          <span style={{ display: 'flex', color: MUTE, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .18s ease' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </span>
        </div>
      </button>

      {open && (
        <>
          <div style={{ padding: '0 16px 14px' }}>
            <div style={styles.items}>
              {c.items.map((item, i) => (
                <div key={item.itemId} style={styles.item}>
                  <span style={styles.num}>{i + 1}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={styles.itemText}>
                      {item.text}
                      {item.critical && <span style={styles.criticalDot} title="On a class the client rates Critical" />}
                    </div>
                    {/* An authored line belongs to a section rather than to one
                        asset class, so the meta line says whichever it has. */}
                    <div style={styles.itemMeta}>
                      {[item.assetClass || item.section, item.frequency, item.standard]
                        .filter(Boolean).join(' · ')}
                      {item.required === false ? ' · optional' : ''}
                    </div>
                  </div>
                  {/* What the technician writes down, which the task itself
                      decides — a sheet of pass/fail boxes records nothing from a
                      line that says "measure". */}
                  <span style={styles.response}>{responseOf(item)}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={styles.checkFoot}>
            <span style={{ minWidth: 0 }}>
              Frequencies covered: {c.frequency} · last updated {fmtDate(c.lastUpdated)}
              {c.version ? ` · v${c.version}` : ''}
              {c.generatedBy ? ` · drafted by ${c.generatedBy}` : ''}
            </span>
            {/* Only on checklists written here. A library round is generated
                from the client's PM tasks on every load — editing one would be
                editing something that regenerates underneath the edit. */}
            <span style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              {/* Every checklist opens, not only the authored ones. The card
                  shows an item's text and nothing else it carries — the
                  instruction, the acceptable band, what has to be captured —
                  and those only exist on the record page. */}
              <button onClick={() => router.push(`/portal/datacenter/checklists/${encodeURIComponent(c.checklistId)}`)}
                style={styles.checkAction}>Open</button>
              {c._created && (
                <>
                  <button onClick={() => openBuilder(router, c, 'duplicate')} style={styles.checkAction}>Duplicate</button>
                  <button onClick={() => openBuilder(router, c, 'edit')} style={styles.checkAction}>Edit</button>
                </>
              )}
            </span>
          </div>
        </>
      )}
    </RecordCard>
  )
}

// ── shared parts ─────────────────────────────────────────────────────────
function Line({ icon, label, children }) {
  return (
    <span style={{ display: 'flex', alignItems: 'flex-start', gap: 7, minWidth: 0 }}>
      <span style={{ display: 'flex', flexShrink: 0, color: MUTE, marginTop: 1 }}>{icon}</span>
      <span style={{ fontWeight: 600, flexShrink: 0 }}>{label}:</span>
      <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{children}</span>
    </span>
  )
}

const styles = {
  banner: {
    display: 'flex', gap: 9, alignItems: 'flex-start',
    background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 11,
    padding: '10px 13px', marginBottom: 16,
    fontSize: 12, color: '#92400e', lineHeight: 1.6, maxWidth: 940,
  },
  kpiOn: { borderRadius: 12, boxShadow: `0 0 0 2px ${ACCENT}33`, outline: `1px solid ${ACCENT}` },
  grid: { display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))' },

  head: { padding: 16, display: 'flex', alignItems: 'flex-start', gap: 14 },
  body: { padding: '14px 16px 16px', borderTop: `1px solid #f1f5f9`, background: '#fcfdfe' },
  titleRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 },
  code: { margin: 0, fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 13, fontWeight: 700, color: ACCENT },
  rowName: {
    margin: 0, fontSize: 15, fontWeight: 700, color: INK, letterSpacing: '-0.01em',
    minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  cardName: { margin: 0, fontSize: 14.5, fontWeight: 700, color: INK, lineHeight: 1.35 },
  cardTask: { margin: '5px 0 0', fontSize: 12, color: SUB, lineHeight: 1.5 },
  findings: { margin: 0, fontSize: 12.5, color: '#334155', lineHeight: 1.6 },
  incidentText: { margin: '9px 0 0', fontSize: 13.5, fontWeight: 600, color: INK, lineHeight: 1.5 },

  tile: {
    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  dueBlock: { flexShrink: 0, width: 132, border: '1px solid', borderRadius: 10, padding: '10px 12px' },
  tag: { fontSize: 10.5, fontWeight: 700, color: '#334155', background: '#f1f5f9', border: `1px solid ${LINE}`, borderRadius: 5, padding: '2px 7px' },
  chev: { display: 'flex', alignItems: 'center', flexShrink: 0 },

  tabs: { display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 11, padding: 4, marginBottom: 16, flexWrap: 'wrap' },
  tab: {
    display: 'inline-flex', alignItems: 'center', gap: 7, flex: '1 1 auto', justifyContent: 'center',
    height: 36, padding: '0 14px', borderRadius: 8, border: 'none', background: 'transparent',
    color: SUB, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
  },
  tabOn: { background: '#fff', color: INK, boxShadow: '0 1px 3px rgba(15,23,42,0.10)' },
  tabCount: { fontSize: 11, fontWeight: 700, background: '#e2e8f0', color: SUB, borderRadius: 999, padding: '1px 7px' },
  tabCountOn: { background: ACCENT, color: '#fff' },

  checkHead: {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
    padding: 15, background: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  },
  checkFoot: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    padding: '11px 16px', borderTop: `1px solid ${LINE}`, background: '#fcfdfe', fontSize: 11.5, color: MUTE,
  },
  checkAction: {
    padding: '5px 11px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
    color: ACCENT, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, cursor: 'pointer',
  },
  items: { display: 'grid', gap: 2 },
  item: {
    display: 'flex', alignItems: 'flex-start', gap: 11,
    padding: '10px 11px', borderRadius: 9, background: '#fcfdfe', border: `1px solid ${LINE}`,
  },
  num: {
    width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: '#eef2ff', color: ACCENT,
    fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  itemText: { fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.4 },
  criticalDot: { display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#dc2626', marginLeft: 7, verticalAlign: 'middle' },
  itemMeta: { fontSize: 11, color: MUTE, marginTop: 3 },
  response: {
    fontSize: 10.5, fontWeight: 700, color: SUB, background: '#f1f5f9',
    border: `1px solid ${LINE}`, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap', flexShrink: 0,
  },
}
