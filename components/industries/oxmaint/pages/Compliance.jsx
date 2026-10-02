'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  PageHeader, StatStrip, Toolbar, DataTable, Drawer, Fields, Section,
  StatusBadge, Donut, HBars, ActionButton, PALETTE,
} from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { EPOCH, fmtDate, isPast, daysUntil } from '../lib/data'
import { COMPLIANCE_ITEMS, AUDIT_TRAIL, CAPAS, VALIDATIONS, REVIEWS, VAULT } from '../lib/dataCompliance'
import { useRouter } from 'next/navigation'
import { useAuditTrail, fieldLabel, showValue } from '../lib/audit'

// Where a line in the trail can be followed back to. A trail entry that cannot
// be opened is a claim; one that can is a record.
const RECORD_ROUTE = {
  work_order: 'work-orders', asset: 'assets', pm_schedule: 'pm-schedules', purchase_order: 'purchase-orders',
}

const { SUB, MUTE, INK, LINE, GREEN, AMBER, RED } = PALETTE

const TABS = ['Dashboard', 'Audit Trail', 'CAPA', 'Validation', 'Reviews', 'Vault']

// The menu lists the six compliance areas separately, so arriving from one of
// them has to open its tab — and moving on to the next has to move the tab
// rather than leave the reader on the screen they have just navigated away from.
const TAB_FOR_SECTION = {
  compliance: 'Dashboard',
  'audit-trail': 'Audit Trail',
  capa: 'CAPA',
  validation: 'Validation',
  reviews: 'Reviews',
  vault: 'Vault',
}

// The kit's status table speaks maintenance; these words are new to it and would
// otherwise all come out neutral grey — which on a compliance screen means
// "compliant" and "overdue" look the same at a glance.
const ITEM_TONE = { Compliant: 'green', 'Due Soon': 'amber', Overdue: 'red' }
const CAPA_TONE = { Verification: 'violet' }
const PROTOCOL_TONE = { 'In Execution': 'blue' }
const CLASS_TONE = { Controlled: 'blue', Confidential: 'amber', Public: 'grey' }
const ACTION_TONE = {
  created: 'blue', updated: 'grey', 'status changed': 'violet', assigned: 'blue',
  approved: 'green', deleted: 'red', exported: 'grey',
}

const CAPA_STATUSES = ['Open', 'In Progress', 'Verification', 'Closed', 'Overdue']

// Reading the trail is nearly always "what happened lately", so the window is
// a filter rather than something to search for.
const WHEN_OPTIONS = ['Today', 'Last 7 days', 'Last 30 days']
const WHEN_SINCE = {
  Today: (now) => new Date(now).setHours(0, 0, 0, 0),
  'Last 7 days': (now) => now.getTime() - 7 * 86400000,
  'Last 30 days': (now) => now.getTime() - 30 * 86400000,
}

// An audit line is read within a day of the event it records, so the clock time
// carries the meaning and a column of identical dates carries none.
const fmtWhen = (iso) => {
  const d = new Date(iso)
  const day = `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('en-GB', { month: 'short' })}`
  return `${day} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

const dueCell = (iso, late) => (
  <span style={{ whiteSpace: 'nowrap', color: late ? '#b91c1c' : INK, fontWeight: late ? 700 : 500 }}>
    {fmtDate(iso)}
    {late && <span style={{ fontSize: 10.5, marginLeft: 5 }}>{Math.abs(daysUntil(iso))}d late</span>}
  </span>
)

export default function Compliance({ section }) {
  const { scope, siteName } = useSite()
  const router = useRouter()
  const live = useAuditTrail()

  const [tab, setTab] = useState(TAB_FOR_SECTION[section] || 'Dashboard')
  const [auditQ, setAuditQ] = useState('')
  const [entity, setEntity] = useState('all')
  const [auditAction, setAuditAction] = useState('all')
  const [auditUser, setAuditUser] = useState('all')
  const [auditWhen, setAuditWhen] = useState('all')
  const [openAudit, setOpenAudit] = useState(null)
  const [capaQ, setCapaQ] = useState('')
  const [capaStatus, setCapaStatus] = useState('all')
  const [capaType, setCapaType] = useState('all')
  const [openItem, setOpenItem] = useState(null)
  const [openCapa, setOpenCapa] = useState(null)

  useEffect(() => {
    const wanted = TAB_FOR_SECTION[section]
    if (wanted) setTab(wanted)
  }, [section])

  const items = useMemo(() => scope(COMPLIANCE_ITEMS), [scope])
  // What was done in this portal — written by the records API as it happened —
  // ahead of the history the plant arrived with. Same shape as those lines, so
  // the filters, the counts and the export treat both alike.
  const audit = useMemo(
    () => [...scope(live), ...scope(AUDIT_TRAIL)].sort((a, b) => String(b.at).localeCompare(String(a.at))),
    [scope, live],
  )
  const capas = useMemo(() => scope(CAPAS), [scope])
  const protocols = useMemo(() => scope(VALIDATIONS), [scope])
  const reviews = useMemo(() => scope(REVIEWS), [scope])
  const vault = useMemo(() => scope(VAULT), [scope])

  const entities = useMemo(() => [...new Set(audit.map((a) => a.entity))].sort(), [audit])
  const actions = useMemo(() => [...new Set(audit.map((a) => a.action))].filter(Boolean).sort(), [audit])
  const people = useMemo(() => [...new Set(audit.map((a) => a.actor_name))].filter(Boolean).sort(), [audit])

  /**
   * The trail, counted.
   *
   * Every one of these is a count of the same lines the table below shows, so a
   * number a reader questions can be filtered down to the rows that produced
   * it. `byDay` is fourteen days ending today whether or not anything happened
   * on them — a chart drawn only on the days with activity reads as busier than
   * the fortnight was.
   */
  const auditStats = useMemo(() => {
    const now = new Date(EPOCH)
    const dayKey = (d) => new Date(d).toDateString()
    const today = dayKey(now)
    const weekAgo = now.getTime() - 7 * 86400000

    const byDay = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now.getTime() - (13 - i) * 86400000)
      return {
        key: dayKey(d),
        label: `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('en-GB', { month: 'short' })}`,
        value: 0,
      }
    })
    const dayIndex = new Map(byDay.map((d, i) => [d.key, i]))

    const perRecord = new Map()
    const perUser = new Map()
    for (const a of audit) {
      const i = dayIndex.get(dayKey(a.at))
      if (i !== undefined) byDay[i].value += 1
      const ref = a.reference || a.record_id || '—'
      perRecord.set(ref, (perRecord.get(ref) || 0) + 1)
      perUser.set(a.actor_name || 'Unknown user', (perUser.get(a.actor_name || 'Unknown user') || 0) + 1)
    }
    const top = (m) => [...m.entries()].map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 5)

    return {
      today: audit.filter((a) => dayKey(a.at) === today).length,
      week: audit.filter((a) => new Date(a.at).getTime() >= weekAgo).length,
      people: new Set(audit.map((a) => a.actor_name)).size,
      records: new Set(audit.map((a) => a.reference || a.record_id)).size,
      statusChanges: audit.filter((a) => a.action === 'status changed').length,
      deletions: audit.filter((a) => a.action === 'deleted').length,
      byDay,
      topRecords: top(perRecord),
      byUser: top(perUser),
    }
  }, [audit])

  // Built in a fixed order rather than counted off the rows, so overdue is the
  // red slice on every site and on an empty register alike. Counting produces
  // whatever order the data happens to arrive in, and a green "overdue" wedge is
  // worse than no chart.
  const mix = useMemo(() => ['Compliant', 'Due Soon', 'Overdue'].map((name) => ({
    name, value: items.filter((i) => i.status === name).length,
  })), [items])

  const byArea = useMemo(() => (
    [...new Set(items.map((i) => i.area))].map((name) => {
      const own = items.filter((i) => i.area === name)
      return {
        name,
        value: own.length,
        color: own.some((i) => i.status === 'Overdue') ? RED : '#15227a',
      }
    }).sort((a, b) => b.value - a.value)
  ), [items])

  const auditRows = useMemo(() => {
    const q = auditQ.trim().toLowerCase()
    const since = WHEN_SINCE[auditWhen]?.(new Date(EPOCH)) ?? null
    return audit.filter((a) => (
      (entity === 'all' || a.entity === entity) &&
      (auditAction === 'all' || a.action === auditAction) &&
      (auditUser === 'all' || a.actor_name === auditUser) &&
      (since === null || new Date(a.at).getTime() >= since) &&
      (!q || [a.actor_name, a.entity, a.reference, a.action, a.detail].join(' ').toLowerCase().includes(q))
    ))
  }, [audit, auditQ, entity, auditAction, auditUser, auditWhen])

  // Which record a line can be followed back to. Not every kind has a page of
  // its own — a module being switched off is a real change with nowhere to go —
  // so the row opens the change itself and offers the record when there is one.
  const recordRouteFor = (r) => {
    const base = RECORD_ROUTE[r?.entity_kind]
    return base && r?.record_id ? `/portal/oxmaint/${base}/${encodeURIComponent(r.record_id)}` : null
  }

  // The trail as a workbook, one row per changed field. An auditor reconciles
  // this against their own sample, and a summary line ("status, due date") is
  // not something anyone can reconcile.
  const exportAudit = async () => {
    try {
      const XLSX = await import('xlsx')
      const lines = auditRows.flatMap((r) => {
        const base = {
          When: new Date(r.at).toISOString().replace('T', ' ').slice(0, 16),
          User: r.actor_name, Entity: r.entity, Reference: r.reference, Action: r.action,
        }
        const changes = Array.isArray(r.changes) ? r.changes : []
        return changes.length
          ? changes.map((c) => ({ ...base, Field: fieldLabel(c.field), Before: c.from, After: c.to }))
          : [{ ...base, Field: '', Before: '', After: r.detail === '—' ? '' : r.detail }]
      })
      const ws = XLSX.utils.json_to_sheet(lines)
      ws['!cols'] = [{ wch: 17 }, { wch: 20 }, { wch: 16 }, { wch: 26 }, { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 30 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Audit trail')
      XLSX.writeFile(wb, `audit-trail-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch {
      // The export is a convenience beside the screen, not the record itself.
    }
  }

  const capaRows = useMemo(() => {
    const q = capaQ.trim().toLowerCase()
    return capas.filter((c) => (
      (capaStatus === 'all' || c.status === capaStatus) &&
      (capaType === 'all' || c.type === capaType) &&
      (!q || [c.capa_number, c.title, c.source, c.owner_name].join(' ').toLowerCase().includes(q))
    ))
  }, [capas, capaQ, capaStatus, capaType])

  const testsTotal = protocols.reduce((n, v) => n + v.tests_total, 0)
  const testsPassed = protocols.reduce((n, v) => n + v.tests_passed, 0)

  return (
    <div>
      <PageHeader
        icon={sectionIcon('compliance', '#15227a')}
        title="Compliance"
        subtitle={`Obligations, actions and controlled records · ${siteName}`}
        right={<ActionButton variant="ghost" onClick={() => window.print()}>Export PDF</ActionButton>}
      />

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '7px 14px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
            borderRadius: 9, border: `1px solid ${tab === t ? '#15227a' : LINE}`,
            background: tab === t ? '#15227a' : '#fff', color: tab === t ? '#fff' : SUB,
          }}>{t}</button>
        ))}
      </div>

      {tab === 'Dashboard' && (
        <>
          <StatStrip items={[
            { label: 'Obligations', value: items.length },
            { label: 'Compliant', value: items.filter((i) => i.status === 'Compliant').length, tone: 'green' },
            { label: 'Due soon', value: items.filter((i) => i.status === 'Due Soon').length, tone: 'amber' },
            { label: 'Overdue', value: items.filter((i) => i.status === 'Overdue').length, tone: 'red' },
            { label: 'Open CAPAs', value: capas.filter((c) => c.status !== 'Closed').length, tone: 'amber' },
          ]} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(320px, 100%),1fr))', gap: 14 }}>
            <Section title="Register status"><Donut data={mix} colors={[GREEN, AMBER, RED]} /></Section>
            <Section title="Obligations by area"><HBars data={byArea} /></Section>
          </div>

          <Section title="Obligation register">
            <DataTable
              rows={items} pageSize={10} onRowClick={setOpenItem}
              empty="No obligations recorded for this site."
              columns={[
                { key: 'title', label: 'Obligation', render: (r) => <span style={{ fontWeight: 600 }}>{r.title}</span> },
                { key: 'area', label: 'Area' },
                { key: 'frequency', label: 'Frequency' },
                { key: 'owner_name', label: 'Owner' },
                {
                  key: 'next_due', label: 'Next due',
                  sortValue: (r) => new Date(r.next_due).getTime(),
                  render: (r) => dueCell(r.next_due, r.status === 'Overdue'),
                },
                { key: 'evidence_count', label: 'Evidence', align: 'right' },
                { key: 'status', label: 'Status', render: (r) => <StatusBadge tone={ITEM_TONE[r.status]}>{r.status}</StatusBadge> },
              ]} />
          </Section>
        </>
      )}

      {tab === 'Audit Trail' && (
        <>
          <StatStrip items={[
            { label: 'Entries', value: audit.length },
            { label: 'Today', value: auditStats.today },
            { label: 'Last 7 days', value: auditStats.week },
            { label: 'People', value: auditStats.people },
            { label: 'Records touched', value: auditStats.records },
            { label: 'Status changes', value: auditStats.statusChanges, tone: 'violet' },
            { label: 'Deletions', value: auditStats.deletions, tone: auditStats.deletions ? 'red' : undefined },
          ]} />

          {/* Who is changing what, and when. Both read straight off the same
              lines the table shows, so a number here always has rows behind it
              that a reader can go and look at. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(300px, 100%),1fr))', gap: 14, marginBottom: 14 }}>
            <Section title="Changes by day" right={<span style={{ fontSize: 11.5, color: MUTE }}>last 14 days</span>} style={{ marginBottom: 0 }}>
              {auditStats.byDay.some((d) => d.value > 0)
                ? <DayBars data={auditStats.byDay} />
                : <div style={{ padding: '18px 0', textAlign: 'center', color: MUTE, fontSize: 12.5 }}>Nothing changed in the last fortnight.</div>}
            </Section>
            <Section title="Most changed records" right={<span style={{ fontSize: 11.5, color: MUTE }}>click a row below to open one</span>} style={{ marginBottom: 0 }}>
              {auditStats.topRecords.length
                ? <HBars data={auditStats.topRecords} />
                : <div style={{ padding: '18px 0', textAlign: 'center', color: MUTE, fontSize: 12.5 }}>No records have been changed yet.</div>}
            </Section>
            <Section title="Who made the changes" style={{ marginBottom: 0 }}>
              {auditStats.byUser.length
                ? <HBars data={auditStats.byUser} />
                : <div style={{ padding: '18px 0', textAlign: 'center', color: MUTE, fontSize: 12.5 }}>Nobody has changed anything yet.</div>}
            </Section>
          </div>

          <Toolbar
            search={auditQ} onSearch={setAuditQ}
            placeholder="Search user, reference, action…"
            filters={[
              { label: 'Entity', value: entity, onChange: setEntity, options: entities },
              { label: 'Action', value: auditAction, onChange: setAuditAction, options: actions },
              { label: 'User', value: auditUser, onChange: setAuditUser, options: people },
              { label: 'When', value: auditWhen, onChange: setAuditWhen, options: WHEN_OPTIONS },
            ]}
            right={(
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 11.5, color: MUTE }}>{auditRows.length} shown</span>
                <ActionButton variant="ghost" onClick={exportAudit}>Export Excel</ActionButton>
              </div>
            )}
          />

          <DataTable
            rows={auditRows} pageSize={12}
            onRowClick={setOpenAudit}
            empty="No audit entries match these filters."
            columns={[
              {
                key: 'at', label: 'Time',
                sortValue: (r) => new Date(r.at).getTime(),
                render: (r) => <span style={{ whiteSpace: 'nowrap', color: SUB }}>{fmtWhen(r.at)}</span>,
              },
              { key: 'actor_name', label: 'User', render: (r) => <span style={{ fontWeight: 600 }}>{r.actor_name}</span> },
              { key: 'entity', label: 'Entity' },
              {
                key: 'reference', label: 'Reference',
                render: (r) => (
                  <span title={r.reference} style={{
                    display: 'block', maxWidth: 210, overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', fontWeight: 700, color: '#15227a',
                  }}>{r.reference}</span>
                ),
              },
              { key: 'action', label: 'Action', render: (r) => <StatusBadge tone={ACTION_TONE[r.action]}>{r.action}</StatusBadge> },
              { key: 'detail', label: 'Detail', render: (r) => <span style={{ color: r.detail === '—' ? MUTE : INK }}>{r.detail}</span> },
              {
                key: 'open', label: '', width: 92, sortable: false,
                render: (r) => (
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: '#15227a' }}>
                    {r.changes?.length ? `${r.changes.length} field${r.changes.length === 1 ? '' : 's'}` : 'Open'}
                  </span>
                ),
              },
            ]} />

          {/* There is deliberately no "add entry" button, and a reader is owed
              the reason rather than left to conclude the screen is unfinished. */}
          <p style={{ margin: '12px 2px 0', fontSize: 11.5, color: MUTE, lineHeight: 1.6 }}>
            Every line here is written by the server in the same request as the change it describes, and the API
            refuses to create, edit or delete one — which is why there is nothing on this screen that adds an entry.
            A trail somebody can type into is a trail an auditor is right to disregard. To see a line appear, change
            a record: complete a job, upload a document, book a contractor&rsquo;s hours.
          </p>
        </>
      )}

      {tab === 'CAPA' && (
        <>
          <StatStrip items={[
            { label: 'Actions', value: capas.length },
            { label: 'Open', value: capas.filter((c) => c.status !== 'Closed').length, tone: 'amber' },
            { label: 'Overdue', value: capas.filter((c) => c.status === 'Overdue').length, tone: 'red' },
            { label: 'Awaiting verification', value: capas.filter((c) => c.status === 'Verification').length },
            { label: 'Closed', value: capas.filter((c) => c.status === 'Closed').length, tone: 'green' },
          ]} />

          <Toolbar
            search={capaQ} onSearch={setCapaQ}
            placeholder="Search number, title, source, owner…"
            filters={[
              { label: 'Status', value: capaStatus, onChange: setCapaStatus, options: CAPA_STATUSES },
              { label: 'Type', value: capaType, onChange: setCapaType, options: ['Corrective', 'Preventive'] },
            ]}
            right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{capaRows.length} shown</span>}
          />

          <DataTable
            rows={capaRows} pageSize={12} onRowClick={setOpenCapa}
            empty="No corrective actions match these filters."
            columns={[
              { key: 'capa_number', label: 'CAPA', render: (r) => <span style={{ fontWeight: 700, color: '#15227a' }}>{r.capa_number}</span> },
              {
                key: 'title', label: 'Title',
                render: (r) => (
                  <span title={r.title} style={{ display: 'block', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                ),
              },
              { key: 'source', label: 'Source' },
              { key: 'type', label: 'Type' },
              { key: 'owner_name', label: 'Owner' },
              {
                key: 'due_date', label: 'Due',
                sortValue: (r) => new Date(r.due_date).getTime(),
                render: (r) => dueCell(r.due_date, r.status === 'Overdue'),
              },
              {
                key: 'effectiveness_checked', label: 'Effectiveness', align: 'center',
                sortValue: (r) => (r.effectiveness_checked ? 1 : 0),
                render: (r) => (r.effectiveness_checked
                  ? <span style={{ color: GREEN, fontWeight: 700 }}>Checked</span>
                  : <span style={{ color: MUTE }}>—</span>),
              },
              { key: 'status', label: 'Status', render: (r) => <StatusBadge tone={CAPA_TONE[r.status]}>{r.status}</StatusBadge> },
            ]} />
        </>
      )}

      {tab === 'Validation' && (
        <>
          <StatStrip items={[
            { label: 'Protocols', value: protocols.length },
            { label: 'Approved', value: protocols.filter((v) => v.status === 'Approved').length, tone: 'green' },
            { label: 'In execution', value: protocols.filter((v) => v.status === 'In Execution').length, tone: 'blue' },
            { label: 'Draft', value: protocols.filter((v) => v.status === 'Draft').length },
            { label: 'Tests passed', value: testsTotal ? Math.round((testsPassed / testsTotal) * 100) : 0, unit: '%', note: `${testsPassed} of ${testsTotal}` },
          ]} />

          <DataTable
            rows={protocols} pageSize={12}
            empty="No validation protocols recorded."
            columns={[
              { key: 'protocol', label: 'Protocol', render: (r) => <span style={{ fontWeight: 700, color: '#15227a' }}>{r.protocol}</span> },
              { key: 'system', label: 'System' },
              {
                key: 'scope', label: 'Scope',
                render: (r) => (
                  <span title={r.scope} style={{ display: 'block', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: SUB }}>{r.scope}</span>
                ),
              },
              { key: 'executed_by_name', label: 'Executed by' },
              { key: 'approved_by_name', label: 'Approved by', render: (r) => r.approved_by_name || <span style={{ color: MUTE }}>—</span> },
              { key: 'executed_date', label: 'Executed', sortValue: (r) => (r.executed_date ? new Date(r.executed_date).getTime() : 0), render: (r) => fmtDate(r.executed_date) },
              {
                key: 'tests_passed', label: 'Tests passed', align: 'right',
                sortValue: (r) => (r.tests_total ? r.tests_passed / r.tests_total : 0),
                render: (r) => {
                  const pct = r.tests_total ? Math.round((r.tests_passed / r.tests_total) * 100) : 0
                  const tone = pct === 100 ? GREEN : pct ? AMBER : MUTE
                  return (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 118 }}>
                      <span style={{ flex: 1, height: 5, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                        <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: tone }} />
                      </span>
                      <span style={{ fontWeight: 700, fontSize: 11.5, color: tone, width: 46 }}>{r.tests_passed}/{r.tests_total}</span>
                    </span>
                  )
                },
              },
              { key: 'status', label: 'Status', render: (r) => <StatusBadge tone={PROTOCOL_TONE[r.status]}>{r.status}</StatusBadge> },
            ]} />
        </>
      )}

      {tab === 'Reviews' && (
        <>
          <StatStrip items={[
            { label: 'Reviews', value: reviews.length },
            { label: 'Scheduled', value: reviews.filter((r) => r.status === 'Scheduled').length },
            { label: 'Under way', value: reviews.filter((r) => r.status === 'In Review').length, tone: 'blue' },
            { label: 'Overdue', value: reviews.filter((r) => r.status === 'Overdue').length, tone: 'red' },
            { label: 'Reviewers involved', value: reviews.reduce((n, r) => n + r.reviewers, 0) },
          ]} />

          <DataTable
            rows={reviews} pageSize={12}
            empty="No reviews recorded for this site."
            columns={[
              { key: 'subject', label: 'Subject', render: (r) => <span style={{ fontWeight: 600 }}>{r.subject}</span> },
              { key: 'cycle', label: 'Cycle' },
              { key: 'owner_name', label: 'Owner' },
              { key: 'reviewers', label: 'Reviewers', align: 'right' },
              { key: 'site_name', label: 'Site' },
              { key: 'last_review', label: 'Last review', sortValue: (r) => new Date(r.last_review).getTime(), render: (r) => fmtDate(r.last_review) },
              {
                key: 'next_due', label: 'Next due',
                sortValue: (r) => new Date(r.next_due).getTime(),
                render: (r) => dueCell(r.next_due, isPast(r.next_due)),
              },
              { key: 'status', label: 'Status', render: (r) => <StatusBadge>{r.status}</StatusBadge> },
            ]} />
        </>
      )}

      {tab === 'Vault' && (
        <>
          <StatStrip items={[
            { label: 'Documents', value: vault.length },
            { label: 'Controlled', value: vault.filter((d) => d.classification === 'Controlled').length },
            { label: 'Confidential', value: vault.filter((d) => d.classification === 'Confidential').length, tone: 'amber' },
            { label: 'Approved', value: vault.filter((d) => d.status === 'Approved').length, tone: 'green' },
            { label: 'Awaiting sign-off', value: vault.filter((d) => d.status !== 'Approved').length, tone: 'amber' },
          ]} />

          <DataTable
            rows={vault} pageSize={12}
            empty="No controlled documents held for this site."
            columns={[
              { key: 'document_name', label: 'Document', render: (r) => <span style={{ fontWeight: 600 }}>{r.document_name}</span> },
              { key: 'classification', label: 'Classification', render: (r) => <StatusBadge tone={CLASS_TONE[r.classification]}>{r.classification}</StatusBadge> },
              { key: 'version', label: 'Version', render: (r) => <span style={{ fontWeight: 700, color: '#15227a' }}>{r.version}</span> },
              { key: 'retention_years', label: 'Retention', align: 'right', render: (r) => `${r.retention_years} years` },
              { key: 'site_name', label: 'Site' },
              { key: 'signed_by_name', label: 'Signed by', render: (r) => r.signed_by_name || <span style={{ color: MUTE }}>Unsigned</span> },
              { key: 'signed_date', label: 'Signed', sortValue: (r) => (r.signed_date ? new Date(r.signed_date).getTime() : 0), render: (r) => fmtDate(r.signed_date) },
              { key: 'status', label: 'Status', render: (r) => <StatusBadge>{r.status}</StatusBadge> },
            ]} />
        </>
      )}

      {/* One line of the trail, in full.
          Every row opens this, including the kinds with no record page of their
          own — switching a module off is a real change, and a row that does
          nothing when it is clicked reads as a broken screen. */}
      <Drawer
        open={Boolean(openAudit)} onClose={() => setOpenAudit(null)}
        title={openAudit ? `${openAudit.entity} ${openAudit.reference}` : ''}
        subtitle={openAudit ? `${openAudit.action} · ${fmtWhen(openAudit.at)}` : ''}
        icon={sectionIcon('audit-trail', '#15227a')} width={560}
      >
        {openAudit && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatusBadge tone={ACTION_TONE[openAudit.action]}>{openAudit.action}</StatusBadge>
              <StatusBadge tone="grey">{openAudit.entity}</StatusBadge>
              {openAudit.site_id && <StatusBadge tone="grey">{openAudit.site_id}</StatusBadge>}
            </div>

            <Fields rows={[
              ['When', fmtWhen(openAudit.at)],
              ['User', openAudit.actor_name],
              ['Record', openAudit.reference],
              ['Kind', openAudit.entity_kind || openAudit.entity],
              ['Record id', openAudit.record_id || '—'],
              ['Summary', openAudit.detail && openAudit.detail !== '—' ? openAudit.detail : 'No field summary'],
            ]} />

            {openAudit.changes?.length ? (
              <Section title={`What changed (${openAudit.changes.length})`} style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {openAudit.changes.map((c) => (
                    <div key={c.field} style={{ borderBottom: `1px solid ${LINE}`, paddingBottom: 8 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        {fieldLabel(c.field)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12.5, color: SUB, textDecoration: 'line-through', overflowWrap: 'anywhere' }}>
                          {showValue(c.from) || '—'}
                        </span>
                        <span style={{ color: MUTE }}>→</span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: INK, overflowWrap: 'anywhere' }}>
                          {showValue(c.to) || '—'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            ) : (
              <p style={{ margin: 0, padding: '9px 12px', fontSize: 12.5, lineHeight: 1.55, borderRadius: 9, background: '#f8fafc', border: `1px solid ${LINE}`, color: SUB }}>
                {openAudit.action === 'created'
                  ? 'A new record. The trail lists field changes from the second write onward, so there is nothing to compare this one against.'
                  : 'No field-level detail was recorded for this line.'}
              </p>
            )}

            {recordRouteFor(openAudit) ? (
              <ActionButton onClick={() => router.push(recordRouteFor(openAudit))}>
                Open {openAudit.entity.toLowerCase()} {openAudit.reference}
              </ActionButton>
            ) : (
              <p style={{ margin: 0, fontSize: 11.5, color: MUTE, lineHeight: 1.55 }}>
                This kind has no record page of its own — a setting rather than a register — so the change above is
                the whole of it.
              </p>
            )}
          </div>
        )}
      </Drawer>

      <Drawer
        open={Boolean(openItem)} onClose={() => setOpenItem(null)}
        title={openItem?.title} subtitle={openItem?.area}
        icon={sectionIcon('compliance', '#15227a')} width={500}
      >
        {openItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatusBadge tone={ITEM_TONE[openItem.status]}>{openItem.status}</StatusBadge>
              <StatusBadge tone="grey">{openItem.frequency}</StatusBadge>
            </div>

            <Fields rows={[
              ['Area', openItem.area],
              ['Frequency', openItem.frequency],
              ['Owner', openItem.owner_name],
              ['Site', openItem.site_name],
              ['Last completed', fmtDate(openItem.last_completed)],
              ['Next due', fmtDate(openItem.next_due)],
              ['Evidence held', `${openItem.evidence_count} documents`],
              ['Days to due', openItem.status === 'Overdue' ? `${Math.abs(daysUntil(openItem.next_due))} days late` : `${daysUntil(openItem.next_due)} days`],
            ]} />

            {openItem.status === 'Overdue' && (
              <p style={{ margin: 0, padding: '9px 12px', fontSize: 12.5, lineHeight: 1.5, borderRadius: 9, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
                This obligation has run past its date. The examination must be booked and the register updated before the next audit.
              </p>
            )}
          </div>
        )}
      </Drawer>

      <Drawer
        open={Boolean(openCapa)} onClose={() => setOpenCapa(null)}
        title={openCapa?.capa_number} subtitle={openCapa?.title}
        icon={sectionIcon('capa', '#15227a')} width={500}
      >
        {openCapa && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatusBadge tone={CAPA_TONE[openCapa.status]}>{openCapa.status}</StatusBadge>
              <StatusBadge tone="grey">{openCapa.type}</StatusBadge>
              <StatusBadge tone="grey">{openCapa.source}</StatusBadge>
            </div>

            <p style={{ margin: 0, fontSize: 13, color: SUB, lineHeight: 1.55 }}>{openCapa.title}</p>

            <Fields rows={[
              ['Source', openCapa.source],
              ['Raised from', openCapa.source_reference || '—'],
              ['Type', openCapa.type],
              ['Owner', openCapa.owner_name],
              ['Site', openCapa.site_name],
              ['Raised', fmtDate(openCapa.raised_date)],
              ['Due', fmtDate(openCapa.due_date)],
              ['Effectiveness check', openCapa.effectiveness_checked ? 'Completed' : 'Outstanding'],
            ]} />

            {openCapa.status === 'Overdue' && (
              <p style={{ margin: 0, padding: '9px 12px', fontSize: 12.5, lineHeight: 1.5, borderRadius: 9, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
                Past its agreed date by {Math.abs(daysUntil(openCapa.due_date))} days. {openCapa.owner_name} owns the action.
              </p>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}

/**
 * Changes per day, for a fortnight.
 *
 * Columns rather than the kit's horizontal bars: fourteen dates in a row read
 * as time passing, and the same fourteen stacked read as a league table of
 * days, which is not a thing anybody wants. Empty days keep their slot — the
 * gaps are the point.
 */
function DayBars({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 104 }}>
      {data.map((d) => (
        <div key={d.key} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: d.value ? INK : '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>
            {d.value || ''}
          </span>
          <div
            title={`${d.label} — ${d.value} ${d.value === 1 ? 'change' : 'changes'}`}
            style={{
              width: '100%',
              height: `${Math.max(d.value ? 4 : 2, (d.value / max) * 62)}px`,
              borderRadius: 4,
              background: d.value ? '#15227a' : '#eef2f7',
            }}
          />
          <span style={{ fontSize: 9.5, color: MUTE, whiteSpace: 'nowrap', transform: 'rotate(-45deg)', transformOrigin: 'center', marginTop: 6 }}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  )
}
