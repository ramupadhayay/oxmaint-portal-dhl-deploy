'use client'

// DOP/PAO integrity tests.
//
// The register the pass rate on the dashboard is computed from. A row is a
// scan of one filter at a number of points, and the number that decides it is
// the penetration reading against the threshold — see lib/ui for why that
// number is shown exactly as the workbook holds it rather than converted.
//
// Lock status is not decoration. A locked record cannot be edited, which is
// what makes the test evidence rather than a note; a failed test locks as
// "Flagged" so the failure cannot be quietly tidied away either.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, DataTable, Toolbar, Section, BarPairs, PALETTE,
} from '../lib/kit'
import { TEST_RECORDS, FILTER_VIEW, HEADLINE, THRESHOLDS, pct } from '../lib/data'
import { DateCell, Status, Id, Penetration, Derived } from '../lib/ui'

const { MUTE, SUB } = PALETTE

const roomOf = (filterId) => FILTER_VIEW.find((f) => f.filterId === filterId)?.cleanroomName || '—'

export default function Tests() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [result, setResult] = useState('all')
  const [tech, setTech] = useState('all')
  const [lock, setLock] = useState('all')

  const rows = useMemo(() => TEST_RECORDS.filter((t) => {
    if (result !== 'all' && t.result !== result) return false
    if (tech !== 'all' && t.technicianName !== tech) return false
    if (lock !== 'all' && t.lockStatus !== lock) return false
    if (q && !`${t.testId} ${t.filterId} ${t.technicianName} ${roomOf(t.filterId)}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }).map((t) => ({ ...t, id: t.testId })), [q, result, tech, lock])

  // Pass and fail by month on the anchored calendar. The trend is the client's
  // — the months move with the anchor, the shape does not.
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

  const columns = [
    { key: 'testId', label: 'Test', render: (r) => <Id strong>{r.testId}</Id> },
    { key: 'filterId', label: 'Filter', render: (r) => <span><Id>{r.filterId}</Id><span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{roomOf(r.filterId)}</span></span> },
    { key: 'date', label: 'Tested', render: (r) => <DateCell shifted={r.date} original={r.testDate} /> },
    { key: 'testPoints', label: 'Scan points', align: 'center' },
    { key: 'penetration', label: 'Penetration', align: 'right', render: (r) => <Penetration value={r.penetration} /> },
    { key: 'result', label: 'Result', render: (r) => <Status>{r.result}</Status> },
    { key: 'technicianName', label: 'Technician', render: (r) => <span>{r.technicianName}<span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{r.technicianId}</span></span> },
    { key: 'lockStatus', label: 'Record', render: (r) => <Status>{r.lockStatus}</Status> },
  ]

  const fails = TEST_RECORDS.filter((t) => t.result === 'Fail').length

  return (
    <div>
      <PageHeading
        title="DOP/PAO Integrity Tests"
        subtitle={`Aerosol challenge scans against a maximum penetration of ${THRESHOLDS.penetration.value}. Every completed record locks — a failure locks as flagged, so it stays on the register.`}
      />


      <StatCards items={[
        { label: 'Tests on file', value: HEADLINE.tests, icon: 'list', note: `across ${new Set(TEST_RECORDS.map((t) => t.filterId)).size} filters` },
        { label: 'Pass rate', value: pct(HEADLINE.passRate), icon: 'chart', tone: HEADLINE.passRate >= 0.9 ? 'green' : 'red', note: 'workbook dashboard' },
        { label: 'Failed', value: fails, icon: 'alert', tone: fails ? 'red' : 'green', note: 'locked and flagged' },
        { label: 'Technicians', value: new Set(TEST_RECORDS.map((t) => t.technicianId)).size, icon: 'people', note: 'named on the records' },
        { label: 'Scan points', value: TEST_RECORDS.reduce((n, t) => n + (t.testPoints || 0), 0), icon: 'wave', note: 'total across all tests' },
      ]} />

      <Section title="Pass and fail over time" right={<span style={{ fontSize: 11.5, color: MUTE }}>anchored months <Derived /></span>}>
        <BarPairs data={trend} keys={['pass', 'fail']} labels={['Pass', 'Fail']} colors={['#16a34a', '#dc2626']} height={170} />
      </Section>

      <Toolbar
        search={q}
        onSearch={setQ}
        placeholder="Test id, filter, technician or cleanroom…"
        filters={[
          { label: 'Result', value: result, onChange: setResult, options: [...new Set(TEST_RECORDS.map((t) => t.result))] },
          { label: 'Technician', value: tech, onChange: setTech, options: [...new Set(TEST_RECORDS.map((t) => t.technicianName))] },
          { label: 'Record', value: lock, onChange: setLock, options: [...new Set(TEST_RECORDS.map((t) => t.lockStatus))] },
        ]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} of {TEST_RECORDS.length}</span>}
      />

      <DataTable
        columns={columns}
        rows={rows}
        pageSize={14}
        onRowClick={(r) => router.push(`/portal/hepa/tests/${r.testId}`)}
      />

      <p style={{ fontSize: 11.5, color: SUB, margin: '12px 2px 0', lineHeight: 1.55 }}>
        Penetration is carried exactly as the workbook records it. Its column is
        labelled a percentage while the threshold is written as a fraction; the
        rows are internally consistent either way, so the value is shown
        unchanged and the ambiguity is raised on Settings rather than resolved
        by guesswork.
      </p>
    </div>
  )
}
