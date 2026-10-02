'use client'

// The compliance dashboard.
//
// The workbook opens with a sheet of the same name, and this screen shows what
// that sheet holds rather than a second set of numbers computed our way. Where
// something on this page is not on that sheet — anything about *when* — it is
// marked derived, because the workbook's calendar was nine months old and every
// date-based figure in it read the same: overdue.
//
// So the top row is the client's own arithmetic, the second row is ours, and
// which is which is on the screen rather than in a comment.

import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Card, Section, Donut, HBars, DataTable, PALETTE,
} from '../lib/kit'
import {
  HEADLINE, FILTER_VIEW, CLEANROOMS, DOCUMENT_RECORDS, LIFECYCLE_STAGES,
  TEST_RECORDS, LEAK_RECORDS, ORG, THRESHOLDS, pct,
} from '../lib/data'
import { Derived, FromWorkbook, Status, DateCell, DueIn, Id, Penetration } from '../lib/ui'

const { INK, SUB, MUTE, LINE } = PALETTE

export default function Overview() {
  const router = useRouter()
  const d = HEADLINE.derived

  // What a quality lead would open the portal to see: the filters that are not
  // clean, newest concern first. A failed integrity test outranks a pressure
  // breach — see the data layer for why.
  const attention = FILTER_VIEW
    .filter((f) => f.concern || (f.dueIn != null && f.dueIn <= THRESHOLDS.notificationLeadDays.value))
    .map((f) => ({ ...f, id: f.filterId }))
    .sort((a, b) => (a.concern === 'Failed integrity test' ? -1 : 1) - (b.concern === 'Failed integrity test' ? -1 : 1)
      || (a.dueIn ?? 999) - (b.dueIn ?? 999))

  const stageCounts = LIFECYCLE_STAGES.map((name) => ({
    name, value: DOCUMENT_RECORDS.filter((r) => r.stage === name).length,
  }))

  const concernCount = FILTER_VIEW.filter((f) => f.concern).length

  const byRoom = CLEANROOMS.map((c) => ({
    name: `${c.cleanroomId} · ${c.name}`,
    value: FILTER_VIEW.filter((f) => f.cleanroomId === c.cleanroomId && f.concern).length,
    color: '#dc2626',
  }))

  const columns = [
    { key: 'filterId', label: 'Filter', render: (r) => <Id strong>{r.filterId}</Id> },
    { key: 'cleanroomName', label: 'Cleanroom', render: (r) => <span>{r.cleanroomName}<span style={{ color: MUTE, fontSize: 11 }}> · {r.isoClass}</span></span> },
    { key: 'concern', label: 'Concern', render: (r) => (r.concern ? <Status>{r.concern === 'Failed integrity test' ? 'Fail' : 'Breach'}</Status> : <span style={{ color: MUTE }}>—</span>), sortValue: (r) => r.concern || 'zz' },
    { key: 'penetration', label: 'Last penetration', align: 'right', render: (r) => <Penetration value={r.lastTest?.penetration} />, sortValue: (r) => r.lastTest?.penetration ?? -1 },
    { key: 'lastTest', label: 'Last tested', render: (r) => <DateCell shifted={r.lastTest?.date} original={r.lastTest?.testDate} />, sortValue: (r) => r.lastTest?.date || '' },
    { key: 'dueIn', label: 'Cert due', render: (r) => <DueIn days={r.dueIn} />, sortValue: (r) => r.dueIn ?? 9999 },
  ]

  return (
    <div>
      <PageHeading
        title="Compliance Overview"
        subtitle={`${ORG.description}, ${ORG.site} — HEPA integrity testing, leak detection, certification lifecycle and ${ORG.cmms} asset mapping in one register.`}
      />


      {/* The workbook's own dashboard, verbatim. */}
      <SectionLabel>
        From the workbook <FromWorkbook />
      </SectionLabel>
      <StatCards items={[
        { label: 'Audit readiness', value: pct(HEADLINE.auditReadiness), icon: 'tick', tone: HEADLINE.auditReadiness >= 0.8 ? 'green' : 'amber', note: 'Compliance Dashboard sheet' },
        { label: 'Registered filters', value: HEADLINE.filters, icon: 'asset', note: `${CLEANROOMS.length} cleanrooms` },
        { label: 'DOP/PAO pass rate', value: pct(HEADLINE.passRate), icon: 'chart', tone: HEADLINE.passRate >= 0.9 ? 'green' : 'red', note: `${HEADLINE.tests} tests on file` },
        { label: 'Readings in breach', value: HEADLINE.breaches, icon: 'wave', tone: HEADLINE.breaches ? 'red' : 'green', note: `of ${HEADLINE.leakReadings} leak readings` },
        { label: 'Filters flagged', value: HEADLINE.flagged, icon: 'alert', tone: HEADLINE.flagged ? 'amber' : 'green', note: 'flagged or pending replacement' },
      ]} />

      {/* Ours, and saying so. */}
      <SectionLabel>
        On the anchored calendar <Derived />
      </SectionLabel>
      <StatCards
        onCardClick={(to) => router.push(to)}
        items={[
          { label: 'Certifications overdue', value: d.overdue, icon: 'clock', tone: d.overdue ? 'red' : 'green', note: 'escalate to the manager', to: '/portal/hepa/notifications' },
          { label: 'Due soon', value: d.dueSoon, icon: 'alert', tone: d.dueSoon ? 'amber' : 'green', note: `within ${THRESHOLDS.notificationLeadDays.value} days`, to: '/portal/hepa/notifications' },
          { label: 'Awaiting approval', value: d.awaitingApproval, icon: 'list', tone: d.awaitingApproval ? 'amber' : 'green', note: 'unsigned in the workflow', to: '/portal/hepa/approvals' },
          { label: 'Audit-ready & locked', value: d.auditReady, icon: 'tick', note: `of ${DOCUMENT_RECORDS.length} certification records`, to: '/portal/hepa/lifecycle' },
          { label: 'SAP sync errors', value: d.sapErrors, icon: 'wrench', tone: d.sapErrors ? 'red' : 'green', note: `${d.sapPending} more pending`, to: '/portal/hepa/sap-sync' },
        ]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 14, marginBottom: 14 }}>
        <Section title="Certification lifecycle" style={{ marginBottom: 0 }}>
          <Donut data={stageCounts} />
          <p style={styles.foot}>
            A record only reaches the last stage after an electronic signature
            is against it.
          </p>
        </Section>

        <Section
          title="Filters with an open concern, by cleanroom"
          right={<Derived />}
          style={{ marginBottom: 0 }}
        >
          {byRoom.some((r) => r.value) ? <HBars data={byRoom} /> : <Empty>No filter has an open concern.</Empty>}
          <p style={styles.foot}>
            Counted here as a failed DOP/PAO test or any pressure differential
            over {THRESHOLDS.pressureDifferential.value} in. wg — {concernCount} of{' '}
            {FILTER_VIEW.length} filters. That is a wider net than the workbook&apos;s
            own &ldquo;flagged or pending replacement&rdquo; above, which counts
            {' '}{HEADLINE.flagged} filters by their registry status.
          </p>
        </Section>
      </div>

      <Section
        title="Needs attention"
        right={<span style={{ fontSize: 11.5, color: MUTE }}>{attention.length} filters</span>}
      >
        <DataTable
          columns={columns}
          rows={attention}
          pageSize={8}
          empty="Every filter is inside threshold and inside its certification interval."
          onRowClick={(r) => router.push(`/portal/hepa/filters/${r.filterId}`)}
        />
      </Section>

      <Card style={{ background: '#fcfdfe' }}>
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', fontSize: 12, color: SUB }}>
          <Fact label="Records on file" value={`${TEST_RECORDS.length} tests · ${LEAK_RECORDS.length} readings · ${DOCUMENT_RECORDS.length} documents`} />
          <Fact label="Penetration threshold" value={`${THRESHOLDS.penetration.value} max`} />
          <Fact label="Differential threshold" value={`${THRESHOLDS.pressureDifferential.value} in. wg`} />
          <Fact label="Dataset" value={ORG.dataNote} />
        </div>
      </Card>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 9px',
      fontSize: 11, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.5,
    }}>{children}</div>
  )
}

function Fact({ label, value }) {
  return (
    <div style={{ minWidth: 0, flex: '1 1 200px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 }}>{label}</div>
      <div style={{ color: INK, lineHeight: 1.5 }}>{value}</div>
    </div>
  )
}

function Empty({ children }) {
  return <div style={{ padding: '26px 0', textAlign: 'center', color: MUTE, fontSize: 12.5 }}>{children}</div>
}

const styles = {
  foot: { margin: '13px 0 0', paddingTop: 11, borderTop: `1px solid ${LINE}`, fontSize: 11.5, color: MUTE, lineHeight: 1.5 },
}
