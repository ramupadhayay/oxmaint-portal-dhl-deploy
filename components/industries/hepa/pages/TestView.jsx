'use client'

// One DOP/PAO integrity test.
//
// The test is the evidence a certification record rests on, so this page shows
// it the way a reviewer needs to read it: the measurement against the
// threshold, the filter it was taken on, the technician who took it, and
// whether the record is locked.
//
// The scan-point bar is the one bit of interpretation here and it is honest
// about being that: the workbook records a single penetration figure per test,
// not one per point, so the bar shows the measurement against the threshold
// rather than pretending to plot twelve readings that were never captured.

import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Card, Section, Fields, DataTable, PALETTE,
} from '../lib/kit'
import {
  testById, filterById, REPLACEMENT_RECORDS, THRESHOLDS, fmtDate,
} from '../lib/data'
import { DateCell, Status, Id, Penetration } from '../lib/ui'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

export default function TestView({ id }) {
  const router = useRouter()
  const t = testById(id)

  if (!t) {
    return (
      <Card style={{ maxWidth: 560 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: INK }}>No test with that reference</h1>
        <p style={{ margin: '8px 0 16px', fontSize: 13.5, color: SUB, lineHeight: 1.6 }}>
          <Id>{id}</Id> is not on the integrity test register.
        </p>
        <button onClick={() => router.push('/portal/hepa/tests')} style={{ ...styles.link, padding: '8px 14px' }}>
          Back to the register
        </button>
      </Card>
    )
  }

  const f = filterById(t.filterId)
  const threshold = THRESHOLDS.penetration.value
  const ratio = Math.min(2, (t.penetration || 0) / threshold)
  const failed = t.result === 'Fail'

  // A test can be the pre- or post-validation of a replacement, and that is the
  // most important thing about it when it is — a failed post-validation test is
  // what blocks a room from being released.
  const validationFor = REPLACEMENT_RECORDS.filter(
    (r) => r.preValidationTestId === t.testId || r.postValidationTestId === t.testId,
  )

  const otherTests = (f?.tests || [])
    .filter((x) => x.testId !== t.testId)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((x) => ({ ...x, id: x.testId }))

  return (
    <div>
      <PageHeading
        back={{ label: 'Integrity tests', onClick: () => router.push('/portal/hepa/tests') }}
        title={`${t.testId} — ${f?.cleanroomName || t.filterId}`}
        subtitle={`DOP/PAO aerosol challenge on filter ${t.filterId}${f ? ` · ${f.isoClass}` : ''} · ${t.testPoints} scan points · ${fmtDate(t.date)}`}
        right={<div style={{ display: 'flex', gap: 8 }}><Status>{t.result}</Status><Status>{t.lockStatus}</Status></div>}
      />


      <StatCards items={[
        { label: 'Penetration measured', value: t.penetration, icon: 'chart', tone: failed ? 'red' : 'green', note: `maximum ${threshold}` },
        { label: 'Result', value: t.result, icon: failed ? 'alert' : 'tick', tone: failed ? 'red' : 'green', note: failed ? 'above the threshold' : 'inside the threshold' },
        { label: 'Scan points', value: t.testPoints, icon: 'wave', note: 'across the filter face' },
        { label: 'Technician', value: t.technicianName, icon: 'people', note: t.technicianId },
        { label: 'Record', value: t.lockStatus.replace('Locked - ', ''), icon: 'asset', tone: failed ? 'red' : 'green', note: 'locked — cannot be edited' },
      ]} />

      <Section title="Measurement against the threshold">
        <div style={{ marginBottom: 9, display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
          <span style={{ color: SUB }}>Measured penetration</span>
          <span style={{ fontWeight: 700, color: failed ? '#b91c1c' : INK }}><Penetration value={t.penetration} /></span>
        </div>
        <div style={styles.track}>
          <div style={{
            width: `${Math.min(100, (ratio / 2) * 100)}%`,
            background: failed ? '#dc2626' : '#16a34a',
            ...styles.fill,
          }} />
          {/* The threshold sits at the halfway mark, so a reading of exactly the
              limit lands in the middle and the eye can judge either side of it. */}
          <div style={styles.marker} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10.5, color: MUTE }}>
          <span>0</span>
          <span style={{ fontWeight: 700, color: ACCENT }}>threshold {threshold}</span>
          <span>{threshold * 2}</span>
        </div>
        <p style={styles.note}>
          The workbook records one penetration figure per test rather than one
          per scan point, so this is the measurement against the acceptance
          criterion — not twelve readings it never captured.
          {failed && ' Above the threshold the record locks as flagged, so the failure stays on the register.'}
        </p>
      </Section>

      {validationFor.length > 0 && (
        <Card style={{ marginBottom: 14, borderColor: '#c7d2fe', background: '#fbfcff' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 7 }}>
            This test validates a replacement
          </div>
          {validationFor.map((r) => {
            const isPost = r.postValidationTestId === t.testId
            return (
              <div key={r.replacementId} style={styles.validation}
                onClick={() => router.push(`/portal/hepa/replacements/${r.replacementId}`)}>
                <Id strong>{r.replacementId}</Id>
                <span style={{ fontSize: 12, color: INK }}>
                  {isPost ? 'Post-installation validation' : 'Pre-replacement baseline'} for{' '}
                  <Id>{r.newSerial}</Id>
                </span>
                <span style={{ marginLeft: 'auto' }}><Status>{r.recertStatus}</Status></span>
              </div>
            )
          })}
          {failed && validationFor.some((r) => r.postValidationTestId === t.testId) && (
            <p style={{ margin: '9px 0 0', fontSize: 12, color: '#7f1d1d', lineHeight: 1.6 }}>
              This is the post-installation test and it failed, which is why the
              replacement is blocked and the room is not released.
            </p>
          )}
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(330px,1fr))', gap: 14, marginBottom: 14 }}>
        <Section title="The record" style={{ marginBottom: 0 }}>
          <Fields columns={2} rows={[
            ['Test id', <Id key="a" strong>{t.testId}</Id>],
            ['Filter', <Id key="b">{t.filterId}</Id>],
            ['Tested', <DateCell key="c" shifted={t.date} original={t.testDate} />],
            ['Scan points', t.testPoints],
            ['Penetration', <Penetration key="d" value={t.penetration} />],
            ['Result', <Status key="e">{t.result}</Status>],
            ['Technician', `${t.technicianName} (${t.technicianId})`],
            ['Lock status', <Status key="f">{t.lockStatus}</Status>],
          ]} />
          <p style={styles.note}>
            A completed test locks. That is what makes it evidence rather than a
            note — and a failed one locks as flagged, so it cannot be tidied away
            either.
          </p>
        </Section>

        {f && (
          <Section
            title="The filter"
            style={{ marginBottom: 0 }}
            right={(
              <button onClick={() => router.push(`/portal/hepa/filters/${f.filterId}`)} style={styles.link}>
                Open record
              </button>
            )}
          >
            <Fields columns={2} rows={[
              ['Filter', <Id key="a" strong>{f.filterId}</Id>],
              ['Cleanroom', `${f.cleanroomName} (${f.cleanroomId})`],
              ['ISO class', f.isoClass],
              ['Installed', <DateCell key="b" shifted={f.installedOn} original={f.installDate} />],
              ['Test interval', f.testInterval],
              ['Tests on file', `${f.testCount}${f.failCount ? ` — ${f.failCount} failed` : ''}`],
              ['Leak breaches', f.breachCount || '—'],
              ['Status', <Status key="c">{f.status}</Status>],
            ]} />
          </Section>
        )}
      </div>

      {otherTests.length > 0 && (
        <Section title={`Other tests on this filter (${otherTests.length})`}>
          <DataTable
            columns={[
              { key: 'testId', label: 'Test', render: (r) => <Id strong>{r.testId}</Id> },
              { key: 'date', label: 'Tested', render: (r) => <DateCell shifted={r.date} original={r.testDate} /> },
              { key: 'testPoints', label: 'Points', align: 'center' },
              { key: 'penetration', label: 'Penetration', align: 'right', render: (r) => <Penetration value={r.penetration} /> },
              { key: 'result', label: 'Result', render: (r) => <Status>{r.result}</Status> },
              { key: 'technicianName', label: 'Technician' },
            ]}
            rows={otherTests}
            pageSize={8}
            onRowClick={(r) => router.push(`/portal/hepa/tests/${r.testId}`)}
          />
        </Section>
      )}
    </div>
  )
}

const styles = {
  track: {
    position: 'relative', height: 12, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 999, transition: 'width .3s' },
  marker: {
    position: 'absolute', left: '50%', top: -3, bottom: -3, width: 2,
    background: ACCENT, borderRadius: 2,
  },
  note: {
    margin: '13px 0 0', paddingTop: 11, borderTop: `1px solid ${LINE}`,
    fontSize: 11.5, color: MUTE, lineHeight: 1.55,
  },
  validation: {
    display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap', cursor: 'pointer',
    padding: '9px 12px', borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 9, background: '#fff',
  },
  link: {
    padding: '5px 11px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 7, background: '#fff', color: ACCENT, cursor: 'pointer',
  },
}
