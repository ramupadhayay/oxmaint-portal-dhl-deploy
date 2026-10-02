'use client'

// Reports.
//
// Not a new set of numbers — a second reading of the ones already on the
// registers, cut the ways a site lead is asked to report them: by room, by
// grade, by technician, by month, by order class. Every figure here can be
// traced back to a row somebody can open.
//
// The workbook's own dashboard sits at the top, verbatim, so the first thing a
// reader sees is the client's arithmetic rather than ours. Everything below it
// is derived and wears the badge.

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Card, Section, Donut, HBars, BarPairs, DataTable, PALETTE,
} from '../lib/kit'
import {
  WORKBOOK_DASHBOARD, HEADLINE, CLEANROOM_VIEW, TECHNICIANS, TEST_RECORDS,
  LEAK_RECORDS, WORK_ORDERS, PM_SCHEDULES, DOCUMENT_RECORDS, LIFECYCLE_STAGES,
  FILTER_VIEW, THRESHOLDS, pct,
} from '../lib/data'
import { Derived, FromWorkbook, Id } from '../lib/ui'

const { INK, SUB, MUTE, LINE } = PALETTE

export default function Reports() {
  const router = useRouter()

  // Pass and fail by month on the current calendar.
  const trend = useMemo(() => {
    const m = new Map()
    for (const t of TEST_RECORDS) {
      const key = String(t.date).slice(0, 7)
      if (!m.has(key)) m.set(key, { month: key, pass: 0, fail: 0 })
      m.get(key)[t.result === 'Pass' ? 'pass' : 'fail'] += 1
    }
    return [...m.values()].sort((a, b) => a.month.localeCompare(b.month))
      .map((r) => ({ ...r, month: r.month.slice(2).replace('-', '/') }))
  }, [])

  const byGrade = useMemo(() => {
    const m = new Map()
    for (const c of CLEANROOM_VIEW) {
      if (!m.has(c.isoClass)) m.set(c.isoClass, { name: c.isoClass, rooms: 0, filters: 0, fails: 0, breaches: 0 })
      const g = m.get(c.isoClass)
      g.rooms += 1
      g.filters += c.filterCount
      g.fails += c.fails
      g.breaches += c.breaches
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [])

  const stageCounts = LIFECYCLE_STAGES.map((name) => ({
    name, value: DOCUMENT_RECORDS.filter((d) => d.stage === name).length,
  }))

  const byOrderClass = useMemo(() => {
    const m = new Map()
    for (const w of WORK_ORDERS) m.set(w.orderClass, (m.get(w.orderClass) || 0) + 1)
    return [...m.entries()].sort().map(([name, value]) => ({ name, value }))
  }, [])

  const techRows = TECHNICIANS.map((t) => ({ ...t, id: t.technicianId }))

  const roomRows = CLEANROOM_VIEW.map((c) => ({ ...c, id: c.cleanroomId }))

  return (
    <div>
      <PageHeading
        title="Reports"
        subtitle="The registers cut the ways this site is asked to report them — by cleanroom, by ISO grade, by technician, by month and by order class."
      />

      <SectionLabel>The workbook&apos;s own dashboard <FromWorkbook /></SectionLabel>
      <StatCards items={[
        { label: 'Audit readiness', value: pct(HEADLINE.auditReadiness), icon: 'tick', tone: HEADLINE.auditReadiness >= 0.8 ? 'green' : 'amber', note: 'pass rate × no-breach rate' },
        { label: 'DOP/PAO pass rate', value: pct(HEADLINE.passRate), icon: 'chart', tone: HEADLINE.passRate >= 0.9 ? 'green' : 'red', note: `${HEADLINE.tests} tests` },
        { label: 'Readings in breach', value: HEADLINE.breaches, icon: 'wave', tone: 'red', note: `of ${HEADLINE.leakReadings}` },
        { label: 'Registered filters', value: HEADLINE.filters, icon: 'asset', note: `${HEADLINE.flagged} flagged or pending` },
        { label: 'Replacements', value: HEADLINE.replacements, icon: 'wrench', note: `${HEADLINE.blockedReplacements} blocked` },
      ]} />

      <SectionLabel>Cut from the registers <Derived /></SectionLabel>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(330px,1fr))', gap: 14, marginBottom: 14 }}>
        <Section title="Integrity tests by month" style={{ marginBottom: 0 }}>
          <BarPairs data={trend} keys={['pass', 'fail']} labels={['Pass', 'Fail']} colors={['#16a34a', '#dc2626']} height={180} />
          <p style={styles.foot}>
            Every test on the register, placed on the current calendar. The
            intervals between them are the workbook&apos;s and are unchanged.
          </p>
        </Section>

        <Section title="Certification lifecycle" style={{ marginBottom: 0 }}>
          <Donut data={stageCounts} />
          <p style={styles.foot}>
            {DOCUMENT_RECORDS.filter((d) => d.stage === 'Locked / Audit-Ready').length} of{' '}
            {DOCUMENT_RECORDS.length} records have reached the locked stage, which
            is what an audit package claims as final.
          </p>
        </Section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(330px,1fr))', gap: 14, marginBottom: 14 }}>
        <Section title="Work orders by class" style={{ marginBottom: 0 }}>
          <HBars data={byOrderClass} />
          <p style={styles.foot}>
            PM01 corrective, PM02 replacement, PM04 preventive — the client&apos;s own
            SAP order classes. {WORK_ORDERS.length} orders in total.
          </p>
        </Section>

        <Section title="PM plan" style={{ marginBottom: 0 }}>
          <HBars data={['Overdue', 'Due soon', 'Scheduled'].map((name) => ({
            name,
            value: PM_SCHEDULES.filter((p) => p.state === name).length,
            color: name === 'Overdue' ? '#dc2626' : name === 'Due soon' ? '#d97706' : '#94a3b8',
          }))} />
          <p style={styles.foot}>
            Measured with the same {THRESHOLDS.notificationLeadDays.value}-day lead
            time the notification screen escalates on.
          </p>
        </Section>
      </div>

      <Section title="By ISO grade">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
          {byGrade.map((g) => (
            <div key={g.name} style={styles.grade}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, marginBottom: 7 }}>{g.name}</div>
              <Line label="Cleanrooms" value={g.rooms} />
              <Line label="Filters" value={g.filters} />
              <Line label="Failed tests" value={g.fails} tone={g.fails ? '#b91c1c' : null} />
              <Line label="Breaches" value={g.breaches} tone={g.breaches ? '#b91c1c' : null} />
            </div>
          ))}
        </div>
        <p style={styles.foot}>
          The grade matters because the rooms are not interchangeable: a breach in
          an aseptic core and the same reading in a gowning area are not the same
          finding.
        </p>
      </Section>

      <Section title="By cleanroom">
        <DataTable
          columns={[
            { key: 'cleanroomId', label: 'Room', render: (r) => <span><Id strong>{r.cleanroomId}</Id><span style={{ display: 'block', fontSize: 12, color: INK }}>{r.name}</span></span> },
            { key: 'isoClass', label: 'Grade' },
            { key: 'filterCount', label: 'Filters', align: 'center' },
            { key: 'tests', label: 'Tests', align: 'center' },
            { key: 'fails', label: 'Failed', align: 'center', render: (r) => (r.fails ? <strong style={{ color: '#b91c1c' }}>{r.fails}</strong> : '—') },
            { key: 'breaches', label: 'Breaches', align: 'center', render: (r) => (r.breaches ? <strong style={{ color: '#b91c1c' }}>{r.breaches}</strong> : '—') },
            { key: 'overdue', label: 'Overdue certs', align: 'center', render: (r) => (r.overdue ? <strong style={{ color: '#b91c1c' }}>{r.overdue}</strong> : '—') },
            { key: 'workOrders', label: 'Work orders', align: 'center' },
          ]}
          rows={roomRows}
          pageSize={8}
          onRowClick={(r) => router.push(`/portal/hepa/cleanrooms/${r.cleanroomId}`)}
        />
      </Section>

      <Section title="By technician">
        <DataTable
          columns={[
            { key: 'name', label: 'Technician', render: (r) => <span><strong style={{ color: INK }}>{r.name}</strong><span style={{ display: 'block', fontSize: 10.5, color: MUTE }}><Id>{r.technicianId}</Id></span></span> },
            { key: 'tests', label: 'Tests', align: 'center' },
            { key: 'fails', label: 'Failed', align: 'center', render: (r) => (r.fails ? <strong style={{ color: '#b91c1c' }}>{r.fails}</strong> : '—') },
            { key: 'passRate', label: 'Pass rate of units tested', align: 'right', render: (r) => (r.passRate == null ? '—' : pct(r.passRate)), sortValue: (r) => r.passRate ?? -1 },
            { key: 'readings', label: 'Leak readings', align: 'center' },
            { key: 'breaches', label: 'Breaches found', align: 'center' },
            { key: 'roomCount', label: 'Rooms', align: 'center' },
          ]}
          rows={techRows}
          pageSize={8}
          onRowClick={() => router.push('/portal/hepa/technicians')}
        />
        <p style={styles.foot}>
          Pass rate is a property of the filters a technician was sent to, not a
          score for the technician — see the note on the Technicians screen.
        </p>
      </Section>

      <Card style={{ background: '#fcfdfe' }}>
        <p style={{ margin: 0, fontSize: 11.5, color: MUTE, lineHeight: 1.6 }}>
          Everything on this screen is a second reading of the registers —{' '}
          {FILTER_VIEW.length} filters, {TEST_RECORDS.length} integrity tests,{' '}
          {LEAK_RECORDS.length} leak readings, {DOCUMENT_RECORDS.length} certification
          documents. The {WORKBOOK_DASHBOARD.length} figures at the top are the
          workbook&apos;s own and are shown unchanged; every chart below them is
          worked out here and says so.
        </p>
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

function Line({ label, value, tone }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '3px 0' }}>
      <span style={{ color: SUB }}>{label}</span>
      <strong style={{ color: tone || INK }}>{value}</strong>
    </div>
  )
}

const styles = {
  grade: { padding: '12px 14px', borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 11, background: '#fcfdfe' },
  foot: {
    margin: '13px 0 0', paddingTop: 11, borderTop: `1px solid ${LINE}`,
    fontSize: 11.5, color: MUTE, lineHeight: 1.55,
  },
}
