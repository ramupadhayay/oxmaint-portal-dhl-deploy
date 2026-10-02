'use client'

// Certification due dates, and who gets told about them.
//
// This screen is the reason the calendar is anchored at all. The workbook's own
// Notification Status column was computed on the day it was authored, and by
// the time it reached us every one of its eighteen rows read "Overdue -
// Escalate". A notification demo where nothing is ever *upcoming* shows half
// the feature — you cannot see a reminder fire, only a backlog.
//
// So the status here is recomputed on the anchored calendar and marked derived,
// with the workbook's own wording shown beside it. Every interval is unchanged;
// only the day they are measured from moved.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Card, Section, DataTable, HBars, PALETTE,
} from '../lib/kit'
import { FILTER_VIEW, CLEANROOMS, THRESHOLDS, HEADLINE, fmtDate } from '../lib/data'
import { useDocuments } from '../lib/lifecycle'
import { DateCell, DueIn, Status, Id, Derived } from '../lib/ui'

const { INK, SUB, MUTE, LINE } = PALETTE

const LEAD = THRESHOLDS.notificationLeadDays.value

// Who a notification goes to. The brief asks for escalation to a manager on an
// overdue certification, which means the recipient has to depend on the state
// rather than be one fixed address.
const ROUTE = {
  'Overdue - Escalate': { to: 'Site Quality Manager', via: 'Email + SAP work order', tone: 'red' },
  'Due soon - Notify': { to: 'Assigned quality reviewer', via: 'Email', tone: 'amber' },
  'Scheduled': { to: 'No action', via: 'Appears on the planner', tone: 'grey' },
}

const filterOf = (id) => FILTER_VIEW.find((f) => f.filterId === id) || null

export default function Notifications() {
  const router = useRouter()
  const documents = useDocuments()
  const [state, setState] = useState('all')

  const rows = useMemo(() => documents.map((d) => {
    const f = filterOf(d.relatedRecordId)
    return {
      ...d,
      id: d.documentRef,
      cleanroomId: f?.cleanroomId || null,
      cleanroomName: f?.cleanroomName || '—',
      isoClass: f?.isoClass || '—',
      route: ROUTE[d.notification] || ROUTE.Scheduled,
    }
  }).filter((d) => state === 'all' || d.notification === state)
    .sort((a, b) => (a.dueIn ?? 9999) - (b.dueIn ?? 9999)), [documents, state])

  const counts = useMemo(() => {
    const c = { 'Overdue - Escalate': 0, 'Due soon - Notify': 0, 'Scheduled': 0 }
    for (const d of documents) if (c[d.notification] != null) c[d.notification] += 1
    return c
  }, [documents])

  const byRoom = CLEANROOMS.map((c) => ({
    name: `${c.cleanroomId} · ${c.name}`,
    value: documents.filter((d) => filterOf(d.relatedRecordId)?.cleanroomId === c.cleanroomId
      && d.notification === 'Overdue - Escalate').length,
    color: '#dc2626',
  })).filter((r) => r.value)

  const columns = [
    { key: 'notification', label: 'Status', render: (r) => <Status>{r.notification}</Status>, sortValue: (r) => r.dueIn ?? 9999 },
    { key: 'documentRef', label: 'Document', render: (r) => <Id strong>{r.documentRef}</Id> },
    { key: 'relatedRecordId', label: 'Filter', render: (r) => <span><Id>{r.relatedRecordId}</Id><span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{r.cleanroomName} · {r.isoClass}</span></span> },
    { key: 'nextCertDueOn', label: 'Certification due', render: (r) => <DateCell shifted={r.nextCertDueOn} original={r.nextCertDue} bold /> },
    { key: 'dueIn', label: 'Lead', render: (r) => <DueIn days={r.dueIn} />, sortValue: (r) => r.dueIn ?? 9999 },
    { key: 'to', label: 'Notify', render: (r) => <span><strong style={{ color: INK, fontSize: 12 }}>{r.route.to}</strong><span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{r.route.via}</span></span>, sortable: false },
    { key: 'workbook', label: 'Workbook said', render: (r) => <span style={{ fontSize: 11, color: MUTE }}>{r.notificationStatus}</span>, sortable: false },
    { key: 'stage', label: 'Stage', render: (r) => <Status>{r.stage}</Status> },
  ]

  const overdue = rows.filter((r) => r.notification === 'Overdue - Escalate')

  return (
    <div>
      <PageHeading
        title="Notifications"
        subtitle={`Certification due dates with a ${LEAD}-day lead time. Inside the lead time the reviewer is notified; past the due date it escalates to the site quality manager and raises an SAP work order.`}
        right={(
          <select value={state} onChange={(e) => setState(e.target.value)} style={styles.select}>
            <option value="all">All statuses</option>
            {Object.keys(ROUTE).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        )}
      />


      <StatCards
        onCardClick={(to) => router.push(to)}
        items={[
          { label: 'Overdue — escalate', value: counts['Overdue - Escalate'], icon: 'alert', tone: counts['Overdue - Escalate'] ? 'red' : 'green', note: 'to the quality manager' },
          { label: 'Due soon — notify', value: counts['Due soon - Notify'], icon: 'clock', tone: counts['Due soon - Notify'] ? 'amber' : 'green', note: `within ${LEAD} days` },
          { label: 'Scheduled', value: counts.Scheduled, icon: 'list', note: 'no action needed yet' },
          { label: 'Lead time', value: LEAD, unit: 'days', icon: 'chart', note: 'set on the Settings screen', to: '/portal/hepa/settings' },
          { label: 'Filters flagged', value: HEADLINE.flagged, icon: 'asset', tone: HEADLINE.flagged ? 'amber' : 'green', note: 'workbook dashboard' },
        ]}
      />

      <Card style={{ marginBottom: 14, background: '#fcfdfe' }}>
        <p style={{ margin: 0, fontSize: 12, color: SUB, lineHeight: 1.6 }}>
          <strong style={{ color: INK }}>Where this status comes from.</strong> The workbook
          carries a Notification Status of its own, computed on the day it was
          written — and by then every one of its {documents.length} rows read
          &ldquo;Overdue - Escalate&rdquo;. The status in the first column is recomputed
          against the anchored calendar <Derived /> so an upcoming certification is
          visible at all; the workbook&apos;s own wording is in the last column,
          unchanged, for comparison.
        </p>
      </Card>

      {overdue.length > 0 && (
        <Section
          title={`Escalations (${overdue.length})`}
          right={<span style={{ fontSize: 11.5, color: MUTE }}>to the Site Quality Manager</span>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {overdue.slice(0, 6).map((r) => (
              <div key={r.documentRef} style={styles.escalation}
                onClick={() => router.push(`/portal/hepa/repository/${r.documentRef}`)}>
                <span style={styles.bang}>!</span>
                <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                  <div style={{ fontSize: 12.5, color: INK, fontWeight: 600 }}>
                    {r.cleanroomName} — filter <Id strong>{r.relatedRecordId}</Id>
                  </div>
                  <div style={{ fontSize: 11.5, color: SUB, marginTop: 2 }}>
                    Certification was due {fmtDate(r.nextCertDueOn)} · <DueIn days={r.dueIn} /> · document{' '}
                    <Id>{r.documentRef}</Id> is at <strong style={{ color: INK }}>{r.stage}</strong>
                  </div>
                </div>
                <span style={{ fontSize: 11, color: MUTE, whiteSpace: 'nowrap' }}>
                  Email + SAP work order
                </span>
              </div>
            ))}
            {overdue.length > 6 && (
              <span style={{ fontSize: 11.5, color: MUTE, paddingLeft: 2 }}>
                and {overdue.length - 6} more on the register below.
              </span>
            )}
          </div>
        </Section>
      )}

      {byRoom.length > 0 && (
        <Section title="Overdue certifications by cleanroom">
          <HBars data={byRoom} />
        </Section>
      )}

      <Section
        title={`Certification register (${rows.length})`}
        right={<span style={{ fontSize: 11.5, color: MUTE }}>soonest first</span>}
      >
        <DataTable
          columns={columns}
          rows={rows}
          pageSize={12}
          empty="No certification carries this status."
          onRowClick={(r) => router.push(`/portal/hepa/repository/${r.documentRef}`)}
        />
      </Section>

      <p style={{ fontSize: 11.5, color: MUTE, margin: '2px 2px 0', paddingTop: 12, borderTop: `1px solid ${LINE}`, lineHeight: 1.55 }}>
        The lead time is a single threshold on Settings, applied everywhere a due
        date is judged — this screen, the filter registry and the approvals
        queue all read the same number.
      </p>
    </div>
  )
}

const styles = {
  select: {
    padding: '8px 11px', fontSize: 12.5, fontFamily: 'inherit', borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`,
    borderRadius: 9, background: '#fff', color: INK, cursor: 'pointer', outline: 'none',
  },
  escalation: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', cursor: 'pointer',
    padding: '10px 13px', borderStyle: 'solid', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, background: '#fef7f7',
  },
  bang: {
    width: 22, height: 22, borderRadius: '50%', background: '#dc2626', color: '#fff',
    display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0,
  },
}
