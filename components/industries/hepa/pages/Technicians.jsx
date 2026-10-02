'use client'

// The people whose names are on the records.
//
// Under 21 CFR Part 11 a test is not a number, it is a number somebody took —
// and the record has to say who. That makes the technician list a compliance
// register rather than an HR one: this is where you answer "who ran the scan on
// HF-2004" and "how much of the estate has one person signed for".
//
// Pass rate is on this screen for one reason and it needs saying plainly: it is
// a property of the filters a technician was sent to, not a score for the
// technician. Someone assigned the failing units will have a lower rate for
// doing their job correctly. The column is labelled accordingly and the note
// under the table says it outright.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Card, Section, DataTable, Toolbar, PALETTE,
} from '../lib/kit'
import { TECHNICIANS, TEST_RECORDS, LEAK_RECORDS, CLEANROOMS, pct } from '../lib/data'
import { DateCell, Status, Id } from '../lib/ui'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

export default function Technicians() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(null)

  const rows = useMemo(() => TECHNICIANS
    .filter((t) => !q || `${t.technicianId} ${t.name}`.toLowerCase().includes(q.toLowerCase()))
    .map((t) => ({ ...t, id: t.technicianId })), [q])

  const person = selected ? TECHNICIANS.find((t) => t.technicianId === selected) : null
  const theirTests = person
    ? TEST_RECORDS.filter((r) => r.technicianId === person.technicianId)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .map((r) => ({ ...r, id: r.testId }))
    : []

  const columns = [
    {
      key: 'name',
      label: 'Technician',
      render: (r) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
          <span style={styles.avatar}>{initials(r.name)}</span>
          <span style={{ lineHeight: 1.35 }}>
            <strong style={{ color: INK, fontSize: 12.5 }}>{r.name}</strong>
            <span style={{ display: 'block', fontSize: 10.5, color: MUTE }}><Id>{r.technicianId}</Id></span>
          </span>
        </span>
      ),
    },
    { key: 'tests', label: 'Integrity tests', align: 'center', render: (r) => <strong style={{ color: INK }}>{r.tests}</strong> },
    { key: 'fails', label: 'Failed', align: 'center', render: (r) => (r.fails ? <strong style={{ color: '#b91c1c' }}>{r.fails}</strong> : <span style={{ color: MUTE }}>—</span>) },
    {
      key: 'passRate',
      label: 'Pass rate of units tested',
      align: 'right',
      render: (r) => (r.passRate == null ? '—' : (
        <span style={{ fontWeight: 700, color: r.passRate >= 0.9 ? '#047857' : r.passRate >= 0.6 ? '#b45309' : '#b91c1c' }}>
          {pct(r.passRate)}
        </span>
      )),
      sortValue: (r) => r.passRate ?? -1,
    },
    { key: 'readings', label: 'Leak readings', align: 'center' },
    { key: 'breaches', label: 'Breaches found', align: 'center', render: (r) => (r.breaches ? <strong style={{ color: '#b45309' }}>{r.breaches}</strong> : <span style={{ color: MUTE }}>—</span>) },
    { key: 'roomCount', label: 'Cleanrooms', align: 'center', render: (r) => <span>{r.roomCount}<span style={{ display: 'block', fontSize: 10, color: MUTE }}>{r.rooms.join(' · ')}</span></span> },
    { key: 'lastOn', label: 'Last on site', render: (r) => <DateCell shifted={r.lastOn} /> },
  ]

  const totalTests = TECHNICIANS.reduce((n, t) => n + t.tests, 0)
  const totalReadings = TECHNICIANS.reduce((n, t) => n + t.readings, 0)

  return (
    <div>
      <PageHeading
        title="Technicians"
        subtitle="Who took each reading. Every integrity test and leak measurement on this portal carries a named technician — the record is not evidence without one."
      />

      <StatCards items={[
        { label: 'Technicians', value: TECHNICIANS.length, icon: 'people', note: 'named on the records' },
        { label: 'Integrity tests', value: totalTests, icon: 'chart', note: `${TEST_RECORDS.length} on the register` },
        { label: 'Leak readings', value: totalReadings, icon: 'wave', note: `${LEAK_RECORDS.length} on the register` },
        { label: 'Cleanrooms covered', value: CLEANROOMS.length, icon: 'site', note: 'every technician works all of them' },
        { label: 'Unattributed records', value: (TEST_RECORDS.length - totalTests) + (LEAK_RECORDS.length - totalReadings), icon: 'alert', tone: 'green', note: 'none — every row is signed' },
      ]} />

      <Toolbar search={q} onSearch={setQ} placeholder="Name or technician id…" />

      <DataTable
        columns={columns}
        rows={rows}
        pageSize={12}
        onRowClick={(r) => setSelected(r.technicianId === selected ? null : r.technicianId)}
      />

      <Card style={{ marginTop: 14, marginBottom: 14, background: '#fffdf7', borderColor: '#fde68a' }}>
        <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2.2"
            strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}>
            <circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" />
          </svg>
          <p style={{ margin: 0, fontSize: 12, color: SUB, lineHeight: 1.6 }}>
            <strong style={{ color: INK }}>Read the pass rate carefully.</strong> It is the
            proportion of <em>units</em> a technician tested that met the
            acceptance criterion — a property of the filters they were sent to,
            not a measure of how they did the work. A technician assigned the
            failing units will show a lower rate for doing their job correctly.
            It belongs here because an inspector asks who signed for what, not
            because it ranks anybody.
          </p>
        </div>
      </Card>

      {person && (
        <Section
          title={`${person.name} — integrity tests (${theirTests.length})`}
          right={(
            <button onClick={() => setSelected(null)} style={styles.close}>Close</button>
          )}
        >
          <DataTable
            columns={[
              { key: 'testId', label: 'Test', render: (r) => <Id strong>{r.testId}</Id> },
              { key: 'filterId', label: 'Filter', render: (r) => <Id>{r.filterId}</Id> },
              { key: 'date', label: 'Tested', render: (r) => <DateCell shifted={r.date} original={r.testDate} /> },
              { key: 'testPoints', label: 'Points', align: 'center' },
              { key: 'penetration', label: 'Penetration', align: 'right' },
              { key: 'result', label: 'Result', render: (r) => <Status>{r.result}</Status> },
              { key: 'lockStatus', label: 'Record', render: (r) => <Status>{r.lockStatus}</Status> },
            ]}
            rows={theirTests}
            pageSize={10}
            onRowClick={(r) => router.push(`/portal/hepa/tests/${r.testId}`)}
          />
        </Section>
      )}

      <p style={{ fontSize: 11.5, color: MUTE, margin: '2px 2px 0', paddingTop: 12, borderTop: `1px solid ${LINE}`, lineHeight: 1.55 }}>
        The leak sheet records only a technician id where the test sheet records
        a name, so a person is named from whichever of their rows carries one.
        Click a row to see that technician&apos;s tests.
      </p>
    </div>
  )
}

const initials = (name) => String(name)
  .split(/[\s.]+/)
  .filter(Boolean)
  .map((w) => w[0])
  .slice(0, 2)
  .join('')
  .toUpperCase()

const styles = {
  avatar: {
    width: 28, height: 28, borderRadius: '50%', background: ACCENT, color: '#fff',
    display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 700, flexShrink: 0,
  },
  close: {
    padding: '5px 11px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 7, background: '#fff', color: SUB, cursor: 'pointer',
  },
}
