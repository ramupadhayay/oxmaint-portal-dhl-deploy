'use client'

// Cleanrooms — the locations register.
//
// Every other screen here is a list of things; this is the list of places, and
// it is the one a site lead reads first. "Is Fill Line 1 clean" is a question
// about a room, not about four filter ids, and answering it means rolling the
// filters, tests, readings and open work up to the room they are in.
//
// ISO class is the reason the rooms are not interchangeable: an ISO 5 fill line
// holds a hundred times fewer particles than the ISO 7 suite next to it, so a
// breach means something different in each. The class is on every row.

import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Card, Section, DataTable, HBars, PALETTE,
} from '../lib/kit'
import { CLEANROOM_VIEW, FILTER_VIEW, THRESHOLDS, pct } from '../lib/data'
import { DueIn, Status, Id, Derived } from '../lib/ui'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

// What each grade actually means, because "ISO 5" tells a visitor nothing and
// this is the screen where the rooms are compared to each other.
const ISO_MEANS = {
  'ISO 5': 'Aseptic core — filling and open product. The tightest grade on site.',
  'ISO 7': 'Surrounding support to an aseptic core.',
  'ISO 8': 'Controlled but not aseptic — gowning and material transfer.',
}

const ISO_TONE = { 'ISO 5': '#15227a', 'ISO 7': '#0891b2', 'ISO 8': '#64748b' }

export default function Cleanrooms() {
  const router = useRouter()

  const rows = CLEANROOM_VIEW.map((c) => ({ ...c, id: c.cleanroomId }))

  const byConcern = CLEANROOM_VIEW
    .map((c) => ({ name: `${c.cleanroomId} · ${c.name}`, value: c.concerns, color: c.concerns ? '#dc2626' : '#94a3b8' }))

  const columns = [
    { key: 'cleanroomId', label: 'Room', render: (r) => <span><Id strong>{r.cleanroomId}</Id><span style={{ display: 'block', fontSize: 12, color: INK, fontWeight: 600 }}>{r.name}</span></span> },
    { key: 'isoClass', label: 'Grade', render: (r) => <span style={{ ...styles.iso, color: ISO_TONE[r.isoClass] || MUTE, borderColor: `${ISO_TONE[r.isoClass] || MUTE}33` }}>{r.isoClass}</span> },
    { key: 'filterCount', label: 'Filters', align: 'center', render: (r) => <strong style={{ color: INK }}>{r.filterCount}</strong> },
    { key: 'tests', label: 'Tests', align: 'center', render: (r) => (r.fails ? <span><strong style={{ color: '#b91c1c' }}>{r.fails}</strong><span style={{ color: MUTE }}> / {r.tests}</span></span> : <span style={{ color: MUTE }}>0 / {r.tests}</span>) },
    { key: 'breaches', label: 'Breaches', align: 'center', render: (r) => (r.breaches ? <strong style={{ color: '#b91c1c' }}>{r.breaches}</strong> : <span style={{ color: MUTE }}>—</span>) },
    { key: 'concerns', label: 'Of concern', align: 'center', render: (r) => (r.concerns ? <Status>Fail</Status> : <Status>OK</Status>), sortValue: (r) => r.concerns },
    { key: 'overdue', label: 'Overdue certs', align: 'center', render: (r) => (r.overdue ? <strong style={{ color: '#b91c1c' }}>{r.overdue}</strong> : <span style={{ color: MUTE }}>—</span>) },
    { key: 'nextDueIn', label: 'Next due', render: (r) => <DueIn days={r.nextDueIn} />, sortValue: (r) => r.nextDueIn ?? 9999 },
    { key: 'workOrders', label: 'Work orders', align: 'center' },
  ]

  const worst = [...CLEANROOM_VIEW].sort((a, b) => b.concerns - a.concerns)[0]
  const totalFilters = CLEANROOM_VIEW.reduce((n, c) => n + c.filterCount, 0)

  return (
    <div>
      <PageHeading
        title="Cleanrooms"
        subtitle="The rooms this estate is measured in — their ISO grade, the filters protecting each one, and what is outstanding in them."
      />

      <StatCards items={[
        { label: 'Cleanrooms', value: CLEANROOM_VIEW.length, icon: 'site', note: `${new Set(CLEANROOM_VIEW.map((c) => c.isoClass)).size} ISO grades` },
        { label: 'Filters protecting them', value: totalFilters, icon: 'asset', note: 'across all rooms' },
        { label: 'Aseptic cores', value: CLEANROOM_VIEW.filter((c) => c.isoClass === 'ISO 5').length, icon: 'tick', note: 'ISO 5 — open product' },
        { label: 'Rooms with a concern', value: CLEANROOM_VIEW.filter((c) => c.concerns).length, icon: 'alert', tone: CLEANROOM_VIEW.some((c) => c.concerns) ? 'red' : 'green', note: 'failed test or breach inside' },
        { label: 'Overdue certifications', value: CLEANROOM_VIEW.reduce((n, c) => n + c.overdue, 0), icon: 'clock', tone: 'red', note: 'across the estate' },
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14, marginBottom: 14 }}>
        <Section title="Filters with an open concern" right={<Derived />} style={{ marginBottom: 0 }}>
          <HBars data={byConcern} />
          <p style={styles.foot}>
            A failed DOP/PAO test or any pressure differential over{' '}
            {THRESHOLDS.pressureDifferential.value} in. wg.
            {worst?.concerns ? ` ${worst.name} carries the most, at ${worst.concerns} of ${worst.filterCount}.` : ''}
          </p>
        </Section>

        <Section title="What the grades mean" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(ISO_MEANS).map(([grade, what]) => {
              const n = CLEANROOM_VIEW.filter((c) => c.isoClass === grade).length
              if (!n) return null
              return (
                <div key={grade} style={styles.gradeRow}>
                  <span style={{ ...styles.iso, color: ISO_TONE[grade], borderColor: `${ISO_TONE[grade]}33`, flexShrink: 0 }}>{grade}</span>
                  <span style={{ fontSize: 11.5, color: SUB, flex: '1 1 160px', minWidth: 0, lineHeight: 1.5 }}>{what}</span>
                  <strong style={{ fontSize: 13, color: INK }}>{n}</strong>
                </div>
              )
            })}
          </div>
          <p style={styles.foot}>
            The grade is why the rooms are not interchangeable. A pressure breach
            in an ISO 5 fill line and the same reading in the ISO 8 gowning area
            are not the same finding.
          </p>
        </Section>
      </div>

      <DataTable columns={columns} rows={rows} pageSize={12} onRowClick={(r) => router.push(`/portal/hepa/cleanrooms/${r.cleanroomId}`)} />

      <Card style={{ marginTop: 14, background: '#fcfdfe' }}>
        <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
          <p style={{ margin: 0, fontSize: 12, color: SUB, lineHeight: 1.6 }}>
            Every figure on this screen is a roll-up of the filter registry —
            {' '}{FILTER_VIEW.length} filters counted into the room each one sits in.
            Nothing is recorded against a room directly, which is why a room can
            never disagree with the filters inside it.
          </p>
        </div>
      </Card>
    </div>
  )
}

const styles = {
  iso: {
    display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: 0.2,
    background: '#fff', border: '1px solid', borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap',
  },
  gradeRow: {
    display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap',
    padding: '9px 12px', borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 9, background: '#fcfdfe',
  },
  foot: {
    margin: '13px 0 0', paddingTop: 11, borderTop: `1px solid ${LINE}`,
    fontSize: 11.5, color: MUTE, lineHeight: 1.55,
  },
}
