'use client'

// Leak detection — pressure differential monitoring.
//
// A differential reading does not say the barrier has failed; it says the
// filter is loading. Which is why a breach here raises a work order rather than
// condemning the filter, and why an integrity test outranks it everywhere the
// two disagree.
//
// Readings come in two kinds and the distinction matters on a demo: a
// Scheduled reading is the round, an Alert-triggered one is the system already
// having noticed. Both are on the register; the filter separates them.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, DataTable, Toolbar, Section, PALETTE,
} from '../lib/kit'
import PressureBoard from '../components/PressureBoard'
import { LEAK_RECORDS, FILTER_VIEW, HEADLINE, THRESHOLDS } from '../lib/data'
import { DateCell, Status, Id, Differential } from '../lib/ui'

const { INK, MUTE, LINE } = PALETTE

const roomOf = (filterId) => FILTER_VIEW.find((f) => f.filterId === filterId)?.cleanroomName || '—'

export default function Leaks() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')
  const [state, setState] = useState('all')

  const rows = useMemo(() => LEAK_RECORDS.filter((l) => {
    if (type !== 'all' && l.readingType !== type) return false
    if (state !== 'all' && l.breach !== state) return false
    if (q && !`${l.readingId} ${l.filterId} ${l.technicianId} ${roomOf(l.filterId)}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }).map((l) => ({ ...l, id: l.readingId })), [q, type, state])

  // The filters that are breaching, worst first — and "worst" by how far over
  // the line they went rather than by how many times, because a count is the
  // weakest fact about a breach. Each carries its own readings so the board can
  // draw them against the threshold.
  const worst = useMemo(() => FILTER_VIEW
    .filter((f) => f.breachCount > 0)
    .map((f) => ({
      filterId: f.filterId,
      cleanroomName: f.cleanroomName,
      isoClass: f.isoClass,
      readings: f.leaks,
      lastTest: f.lastTest,
      concern: f.concern,
      peak: Math.max(...f.leaks.map((l) => l.pressureDifferential || 0)),
      breaches: f.breachCount,
    }))
    .sort((a, b) => b.peak - a.peak || b.breaches - a.breaches), [])

  const columns = [
    { key: 'readingId', label: 'Reading', render: (r) => <Id strong>{r.readingId}</Id> },
    { key: 'filterId', label: 'Filter', render: (r) => <span><Id>{r.filterId}</Id><span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{roomOf(r.filterId)}</span></span> },
    { key: 'date', label: 'Read', render: (r) => <DateCell shifted={r.date} original={r.readingDate} /> },
    { key: 'pressureDifferential', label: 'Differential', align: 'right', render: (r) => <Differential value={r.pressureDifferential} /> },
    { key: 'readingType', label: 'Type', render: (r) => <Status>{r.readingType === 'Scheduled' ? 'Scheduled' : 'Open'}</Status>, sortValue: (r) => r.readingType },
    { key: 'technicianId', label: 'Technician', render: (r) => <Id>{r.technicianId}</Id> },
    { key: 'breach', label: 'Against threshold', render: (r) => <Status>{r.breach}</Status> },
  ]

  const breaches = LEAK_RECORDS.filter((l) => l.breach === 'Breach').length
  const alerts = LEAK_RECORDS.filter((l) => l.readingType !== 'Scheduled').length
  const peak = Math.max(...LEAK_RECORDS.map((l) => l.pressureDifferential || 0))

  return (
    <div>
      <PageHeading
        title="Leak Detection"
        subtitle={`Pressure differential readings against a breach threshold of ${THRESHOLDS.pressureDifferential.value} in. wg. A breach raises a work order; it does not condemn the filter — that is what the integrity test is for.`}
      />


      <StatCards items={[
        { label: 'Readings on file', value: HEADLINE.leakReadings, icon: 'wave', note: `across ${new Set(LEAK_RECORDS.map((l) => l.filterId)).size} filters` },
        { label: 'In breach', value: HEADLINE.breaches, icon: 'alert', tone: HEADLINE.breaches ? 'red' : 'green', note: `over ${THRESHOLDS.pressureDifferential.value} in. wg` },
        { label: 'Alert-triggered', value: alerts, icon: 'clock', tone: alerts ? 'amber' : 'green', note: 'the rest are scheduled rounds' },
        { label: 'Filters affected', value: new Set(LEAK_RECORDS.filter((l) => l.breach === 'Breach').map((l) => l.filterId)).size, icon: 'asset', note: 'with at least one breach' },
        { label: 'Highest reading', value: peak.toFixed(2), unit: 'in. wg', icon: 'chart', tone: peak > THRESHOLDS.pressureDifferential.value ? 'red' : 'green', note: 'across the register' },
      ]} />

      {worst.length > 0 && (
        <Section
          title="Filters over the threshold"
          right={<span style={{ fontSize: 11.5, color: MUTE }}>{worst.length} filters · furthest over first</span>}
        >
          <PressureBoard
            items={worst}
            onOpen={(f) => router.push(`/portal/hepa/filters/${f.filterId}`)}
          />
          <p style={{ margin: '13px 0 0', paddingTop: 12, borderTop: `1px solid ${LINE}`, fontSize: 11.5, color: MUTE, lineHeight: 1.55 }}>
            Each card plots that filter&apos;s own readings in time order against
            the {THRESHOLDS.pressureDifferential.value} in. wg line, so two
            breaches trending down and two trending up do not look alike. The
            peak matters more than the count — and where the last integrity test
            failed, the card says so, because that is a compromised barrier
            rather than a loading filter.
          </p>
        </Section>
      )}

      <Toolbar
        search={q}
        onSearch={setQ}
        placeholder="Reading id, filter, technician or cleanroom…"
        filters={[
          { label: 'Type', value: type, onChange: setType, options: [...new Set(LEAK_RECORDS.map((l) => l.readingType))] },
          { label: 'Threshold', value: state, onChange: setState, options: [...new Set(LEAK_RECORDS.map((l) => l.breach))] },
        ]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} of {LEAK_RECORDS.length}</span>}
      />

      <DataTable
        columns={columns}
        rows={rows}
        pageSize={14}
        empty="No reading matches these filters."
        onRowClick={(r) => router.push(`/portal/hepa/filters/${r.filterId}`)}
      />

      <p style={{ fontSize: 11.5, color: MUTE, margin: '12px 2px 0', lineHeight: 1.55 }}>
        A row opens the <strong style={{ color: INK }}>filter</strong> rather than
        the reading: a single differential in isolation says very little, and the
        history beside it is what the reading means.
      </p>
    </div>
  )
}
