'use client'

// One replacement, as a chain of custody.
//
// A replacement record answers a question an inspector asks directly: prove the
// filter in that ceiling is the one you say it is, and prove it was tested after
// it went in. So the page is laid out as the chain rather than as a form — old
// serial, new serial, supplier certificate, pre-test, post-test — with each link
// opening the record behind it.

import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Card, Section, Fields, PALETTE,
} from '../lib/kit'
import {
  REPLACEMENT_RECORDS, filterById, testById, THRESHOLDS, fmtDate,
} from '../lib/data'
import { DateCell, Status, Id, Penetration } from '../lib/ui'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

export default function ReplacementView({ id }) {
  const router = useRouter()
  const r = REPLACEMENT_RECORDS.find((x) => x.replacementId === id)

  if (!r) {
    return (
      <Card style={{ maxWidth: 560 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: INK }}>No replacement with that reference</h1>
        <p style={{ margin: '8px 0 16px', fontSize: 13.5, color: SUB, lineHeight: 1.6 }}>
          <Id>{id}</Id> is not on the replacement register.
        </p>
        <button onClick={() => router.push('/portal/hepa/replacements')} style={{ ...styles.link, padding: '8px 14px' }}>
          Back to the register
        </button>
      </Card>
    )
  }

  const f = filterById(r.filterId)
  const pre = testById(r.preValidationTestId)
  const post = testById(r.postValidationTestId)
  const blocked = r.blocked

  const links = [
    { key: 'old', title: 'Filter removed', lines: [['Serial', r.oldSerial]], strike: true },
    {
      key: 'pre',
      title: 'Pre-replacement baseline',
      lines: [['Test', r.preValidationTestId], ['Result', pre?.result], ['Penetration', pre?.penetration]],
      onClick: pre ? () => router.push(`/portal/hepa/tests/${pre.testId}`) : null,
      tone: pre?.result === 'Fail' ? 'red' : null,
    },
    {
      key: 'new',
      title: 'Filter installed',
      lines: [['Serial', r.newSerial], ['Supplier', r.supplier], ['Certificate', r.supplierCert]],
    },
    {
      key: 'post',
      title: 'Post-installation validation',
      lines: r.awaitingPostTest
        ? [['Test', 'not yet recorded']]
        : [['Test', r.postValidationTestId], ['Result', post?.result], ['Penetration', post?.penetration]],
      onClick: post ? () => router.push(`/portal/hepa/tests/${post.testId}`) : null,
      tone: r.awaitingPostTest ? 'amber' : post?.result === 'Fail' ? 'red' : post?.result === 'Pass' ? 'green' : null,
    },
    {
      key: 'out',
      title: 'Re-certification',
      lines: [['Status', r.recertStatus]],
      tone: blocked ? 'red' : r.recertified ? 'green' : 'amber',
    },
  ]

  return (
    <div>
      <PageHeading
        back={{ label: 'Replacements', onClick: () => router.push('/portal/hepa/replacements') }}
        title={`${r.replacementId} — ${f?.cleanroomName || r.filterId}`}
        subtitle={`Filter ${r.filterId}${f ? ` · ${f.isoClass}` : ''} · ${r.supplier} · installed ${fmtDate(r.date)}`}
        right={<Status>{r.recertStatus}</Status>}
      />


      {blocked && (
        <Card style={{ marginBottom: 14, borderColor: '#fecaca', background: '#fef7f7' }}>
          <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2.2"
              strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
            <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.65 }}>
              <strong style={{ color: '#7f1d1d' }}>Blocked — awaiting validation.</strong> The new
              filter <Id>{r.newSerial}</Id> from {r.supplier} is installed, but{' '}
              {r.awaitingPostTest
                ? 'no post-installation integrity test has been recorded against it'
                : <>post-installation test <Id>{r.postValidationTestId}</Id>
                  {post ? ` measured ${post.penetration} against a maximum of ${THRESHOLDS.penetration.value}` : ' did not pass'}</>}
              . The replacement is not complete and the room is not released — a
              filter in the frame is not a certified filter.
            </p>
          </div>
        </Card>
      )}

      <StatCards items={[
        { label: 'Re-certification', value: r.recertStatus, icon: blocked ? 'alert' : 'tick', tone: blocked ? 'red' : r.recertified ? 'green' : 'amber', note: blocked ? 'room not released' : r.recertified ? 'post-test passed' : 'awaiting the post-test' },
        { label: 'Installed', value: fmtDate(r.date), icon: 'clock', note: `workbook: ${fmtDate(r.installationDate)}` },
        { label: 'Supplier', value: r.supplier, icon: 'people', note: r.supplierCert },
        { label: 'Pre-test', value: pre?.result || '—', icon: 'chart', tone: pre?.result === 'Fail' ? 'red' : pre ? 'green' : undefined, note: r.preValidationTestId || 'none recorded' },
        { label: 'Post-test', value: post?.result || (r.awaitingPostTest ? 'Not done' : '—'), icon: 'tick', tone: post?.result === 'Fail' ? 'red' : post ? 'green' : r.awaitingPostTest ? 'amber' : undefined, note: r.postValidationTestId || 'none recorded' },
      ]} />

      <Section title="Chain of custody">
        <div style={styles.chain}>
          {links.map((l, i) => (
            <div key={l.key} style={styles.chainCell}>
              <div
                onClick={l.onClick || undefined}
                style={{
                  ...styles.node,
                  ...(l.tone === 'red' ? styles.nodeRed : l.tone === 'green' ? styles.nodeGreen : l.tone === 'amber' ? styles.nodeAmber : null),
                  cursor: l.onClick ? 'pointer' : 'default',
                }}
              >
                <div style={styles.nodeTitle}>{l.title}</div>
                {l.lines.map(([label, value]) => (
                  <div key={label} style={{ marginTop: 5 }}>
                    <span style={styles.nodeLabel}>{label}</span>
                    <span style={{ ...styles.nodeValue, textDecoration: l.strike ? 'line-through' : 'none' }}>
                      {value ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
              {i < links.length - 1 && (
                <svg width="16" height="14" viewBox="0 0 24 16" fill="none" stroke={MUTE} strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" style={styles.arrow}>
                  <path d="M2 8h18M15 3l5 5-5 5" />
                </svg>
              )}
            </div>
          ))}
        </div>
        <p style={styles.note}>
          Each link is a record this portal holds. The chain is only complete when
          the post-installation test has passed — which is the difference between
          a filter being fitted and a room being released.
        </p>
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(330px,1fr))', gap: 14, marginBottom: 14 }}>
        <Section title="The change" style={{ marginBottom: 0 }}>
          <Fields columns={2} rows={[
            ['Change id', <Id key="a" strong>{r.replacementId}</Id>],
            ['Filter', <Id key="b">{r.filterId}</Id>],
            ['Old serial', <Id key="c">{r.oldSerial}</Id>],
            ['New serial', <Id key="d" strong>{r.newSerial}</Id>],
            ['Supplier', r.supplier],
            ['Supplier certificate', <Id key="e">{r.supplierCert}</Id>],
            ['Installed', <DateCell key="f" shifted={r.date} original={r.installationDate} />],
            ['Re-certification', <Status key="g">{r.recertStatus}</Status>],
          ]} />
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
              ['Status', <Status key="b">{f.status}</Status>],
              ['Tests on file', `${f.testCount}${f.failCount ? ` — ${f.failCount} failed` : ''}`],
              ['Leak breaches', f.breachCount || '—'],
              ['Last penetration', f.lastTest ? <Penetration key="c" value={f.lastTest.penetration} /> : '—'],
              ['SAP work order', f.sap ? <Id key="d">{f.sap.sapWorkOrder}</Id> : '—'],
            ]} />
          </Section>
        )}
      </div>
    </div>
  )
}

const styles = {
  chain: { display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: 4 },
  chainCell: { display: 'flex', alignItems: 'center', gap: 4, flex: '1 1 168px', minWidth: 0 },
  node: {
    flex: 1, minWidth: 0, padding: '11px 12px', borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`,
    borderRadius: 10, background: '#fcfdfe',
  },
  nodeRed: { borderColor: '#fecaca', background: '#fef7f7' },
  nodeGreen: { borderColor: '#bbf7d0', background: '#f6fdf9' },
  nodeAmber: { borderColor: '#fde68a', background: '#fffbf5' },
  nodeTitle: {
    fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase',
    letterSpacing: 0.4, lineHeight: 1.35,
  },
  nodeLabel: { display: 'block', fontSize: 10, color: MUTE },
  nodeValue: {
    display: 'block', fontSize: 11.5, fontWeight: 600, color: INK,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', overflowWrap: 'anywhere',
  },
  arrow: { flexShrink: 0 },
  note: {
    margin: '14px 0 0', paddingTop: 12, borderTop: `1px solid ${LINE}`,
    fontSize: 11.5, color: MUTE, lineHeight: 1.55,
  },
  link: {
    padding: '5px 11px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 7, background: '#fff', color: ACCENT, cursor: 'pointer',
  },
}
