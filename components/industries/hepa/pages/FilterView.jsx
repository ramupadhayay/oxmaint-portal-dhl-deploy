'use client'

// One filter, with everything that has ever been recorded about it.
//
// This is the page the whole portal converges on. A quality lead asked "what is
// the position on HF-2004" needs the identity, the last integrity test, the
// pressure trend, the replacement history, the certification document and the
// SAP work order in one place — chasing five registers to answer one question is
// the problem this product is sold to remove.

import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Card, Section, Fields, DataTable, PALETTE,
} from '../lib/kit'
import { filterById, THRESHOLDS, fmtDate } from '../lib/data'
import { useDocuments } from '../lib/lifecycle'
import { DateCell, DueIn, Status, Id, Penetration, Differential } from '../lib/ui'
import FailureChain from '../components/FailureChain'

const { INK, SUB, MUTE, LINE } = PALETTE

export default function FilterView({ id }) {
  const router = useRouter()
  const f = filterById(id)
  const documents = useDocuments()

  if (!f) return <Missing id={id} onBack={() => router.push('/portal/hepa/filters')} />

  // The certification document comes from the lifecycle hook rather than the
  // static join, so a signature applied on Approvals shows here without a
  // reload.
  const doc = documents.find((d) => d.relatedRecordId === f.filterId) || f.document

  const testColumns = [
    { key: 'testId', label: 'Test', render: (r) => <Id strong>{r.testId}</Id> },
    { key: 'date', label: 'Tested', render: (r) => <DateCell shifted={r.date} original={r.testDate} /> },
    { key: 'testPoints', label: 'Points', align: 'center' },
    { key: 'penetration', label: 'Penetration', align: 'right', render: (r) => <Penetration value={r.penetration} /> },
    { key: 'result', label: 'Result', render: (r) => <Status>{r.result}</Status> },
    { key: 'technicianName', label: 'Technician' },
    { key: 'lockStatus', label: 'Record', render: (r) => <Status>{r.lockStatus}</Status> },
  ]

  const leakColumns = [
    { key: 'readingId', label: 'Reading', render: (r) => <Id strong>{r.readingId}</Id> },
    { key: 'date', label: 'Read', render: (r) => <DateCell shifted={r.date} original={r.readingDate} /> },
    { key: 'pressureDifferential', label: 'Differential', align: 'right', render: (r) => <Differential value={r.pressureDifferential} /> },
    { key: 'readingType', label: 'Type' },
    { key: 'technicianId', label: 'Technician', render: (r) => <Id>{r.technicianId}</Id> },
    { key: 'breach', label: 'Against threshold', render: (r) => <Status>{r.breach}</Status> },
  ]

  const replacementColumns = [
    { key: 'replacementId', label: 'Change', render: (r) => <Id strong>{r.replacementId}</Id> },
    { key: 'date', label: 'Installed', render: (r) => <DateCell shifted={r.date} original={r.installationDate} /> },
    { key: 'oldSerial', label: 'Old serial', render: (r) => <Id>{r.oldSerial}</Id> },
    { key: 'newSerial', label: 'New serial', render: (r) => <Id strong>{r.newSerial}</Id> },
    { key: 'supplier', label: 'Supplier', render: (r) => <span>{r.supplier}<span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{r.supplierCert}</span></span> },
    { key: 'recertStatus', label: 'Re-certification', render: (r) => <Status>{r.recertStatus}</Status> },
  ]

  return (
    <div>
      <PageHeading
        back={{ label: 'Filter registry', onClick: () => router.push('/portal/hepa/filters') }}
        title={`${f.filterId} — ${f.cleanroomName}`}
        subtitle={`${f.isoClass} · ${f.cleanroomId} · installed ${fmtDate(f.installedOn)} · tested ${String(f.testInterval).toLowerCase()}`}
        right={<Status>{f.status}</Status>}
      />

      {/* Only renders for a filter whose last test failed. */}
      <FailureChain filter={f} />


      {f.concern && (
        <Card style={{ marginBottom: 14, borderColor: '#fecaca', background: '#fef7f7' }}>
          <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2.2"
              strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
            <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>
              <strong style={{ color: '#7f1d1d' }}>{f.concern}.</strong>{' '}
              {f.concern === 'Failed integrity test'
                ? `The most recent DOP/PAO scan measured ${f.lastTest?.penetration} against a maximum of ${THRESHOLDS.penetration.value}. The record is locked and flagged; it cannot be edited.`
                : `${f.breachCount} pressure differential ${f.breachCount === 1 ? 'reading is' : 'readings are'} over ${THRESHOLDS.pressureDifferential.value} in. wg. The barrier has not failed its integrity test — the filter is loading.`}
            </p>
          </div>
        </Card>
      )}

      <StatCards items={[
        { label: 'Integrity tests', value: f.testCount, icon: 'list', tone: f.failCount ? 'red' : 'green', note: f.failCount ? `${f.failCount} failed` : 'all passed' },
        { label: 'Last penetration', value: f.lastTest ? f.lastTest.penetration : '—', icon: 'chart', tone: f.lastTest?.result === 'Fail' ? 'red' : 'green', note: `max ${THRESHOLDS.penetration.value}` },
        { label: 'Leak readings', value: f.leaks.length, icon: 'wave', tone: f.breachCount ? 'red' : 'green', note: f.breachCount ? `${f.breachCount} in breach` : 'none in breach' },
        { label: 'Replacements', value: f.replacements.length, icon: 'wrench', note: f.replacements.length ? 'chain of custody on file' : 'original filter' },
        { label: 'Certification due', value: f.dueIn == null ? '—' : f.dueIn < 0 ? `${Math.abs(f.dueIn)}d ago` : `${f.dueIn}d`, icon: 'clock', tone: f.dueIn == null ? undefined : f.dueIn < 0 ? 'red' : f.dueIn <= THRESHOLDS.notificationLeadDays.value ? 'amber' : 'green', note: fmtDate(f.nextCertDueOn) },
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(330px,1fr))', gap: 14, marginBottom: 14 }}>
        <Section title="Identity" style={{ marginBottom: 0 }}>
          <Fields columns={2} rows={[
            ['Filter id', <Id key="a" strong>{f.filterId}</Id>],
            ['QR label', <Id key="b">{f.qrCode}</Id>],
            ['Cleanroom', `${f.cleanroomName} (${f.cleanroomId})`],
            ['ISO class', f.isoClass],
            ['Installed', <DateCell key="c" shifted={f.installedOn} original={f.installDate} />],
            ['Age', `${f.ageDays} days`],
            ['Test interval', f.testInterval],
            ['Status', <Status key="d">{f.status}</Status>],
          ]} />
        </Section>

        <Section title="SAP" style={{ marginBottom: 0 }}>
          {f.sap ? (
            <>
              <Fields columns={2} rows={[
                ['Equipment id', <Id key="a" strong>{f.sap.sapEquipmentId}</Id>],
                ['Functional location', <Id key="b">{f.sap.sapFunctionalLocation}</Id>],
                ['Work order', <Id key="c">{f.sap.sapWorkOrder}</Id>],
                ['Order type', f.sap.workOrderType],
                ['Certification doc', <Id key="d">{f.sap.documentRef}</Id>],
                ['Sync', <Status key="e">{f.sap.syncStatus}</Status>],
                ['Last sync', <DateCell key="f" shifted={f.sap.date} original={f.sap.lastSync} />],
              ]} />
              <p style={styles.note}>
                These identifiers are SAP&apos;s. The filter is created once in the
                asset master and referenced here — no duplicate entry.
              </p>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 12.5, color: MUTE, lineHeight: 1.6 }}>
              This filter has no SAP mapping. Until it has one, its work orders
              would have to be raised by hand in both systems.
            </p>
          )}
        </Section>
      </div>

      {doc && (
        <Section
          title="Certification document"
          right={(
            <button onClick={() => router.push(`/portal/hepa/repository/${doc.documentRef}`)} style={styles.link}>
              Open record
            </button>
          )}
        >
          <Fields columns={3} rows={[
            ['Reference', <Id key="a" strong>{doc.documentRef}</Id>],
            ['Documents', doc.recordType],
            ['Stage', <Status key="b">{doc.stage}</Status>],
            ['Reviewer', doc.reviewer],
            ['Approval', <Status key="c">{doc.approvalStatus}</Status>],
            ['Signed by', doc.signedBy || 'unsigned'],
            ['Next certification', <span key="d"><DateCell shifted={doc.nextCertDueOn} original={doc.nextCertDue} /> <DueIn days={doc.dueIn} /></span>],
            ['Retention expiry', <DateCell key="e" shifted={doc.retentionExpiryOn} original={doc.retentionExpiry} />],
            ['Audit entries', doc.auditEntries],
          ]} />
        </Section>
      )}

      <Section title={`Integrity tests (${f.tests.length})`}>
        <DataTable
          columns={testColumns}
          rows={[...f.tests].sort((a, b) => String(b.date).localeCompare(String(a.date))).map((t) => ({ ...t, id: t.testId }))}
          pageSize={8}
          empty="No integrity test has been recorded against this filter."
          onRowClick={(r) => router.push(`/portal/hepa/tests/${r.testId}`)}
        />
      </Section>

      <Section title={`Leak detection readings (${f.leaks.length})`}>
        <DataTable
          columns={leakColumns}
          rows={[...f.leaks].sort((a, b) => String(b.date).localeCompare(String(a.date))).map((l) => ({ ...l, id: l.readingId }))}
          pageSize={8}
          empty="No pressure differential reading on file."
        />
      </Section>

      <Section title={`Replacements (${f.replacements.length})`}>
        <DataTable
          columns={replacementColumns}
          rows={[...f.replacements].sort((a, b) => String(b.date).localeCompare(String(a.date))).map((r) => ({ ...r, id: r.replacementId }))}
          pageSize={6}
          empty="This is the original filter — it has never been changed."
          onRowClick={(r) => router.push(`/portal/hepa/replacements/${r.replacementId}`)}
        />
      </Section>
    </div>
  )
}

function Missing({ id, onBack }) {
  return (
    <Card style={{ maxWidth: 560 }}>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: INK }}>No filter with that reference</h1>
      <p style={{ margin: '8px 0 16px', fontSize: 13.5, color: SUB, lineHeight: 1.6 }}>
        <Id>{id}</Id> is not on the filter registry.
      </p>
      <button onClick={onBack} style={{ ...styles.link, padding: '8px 14px' }}>Back to the registry</button>
    </Card>
  )
}

const styles = {
  note: {
    margin: '13px 0 0', paddingTop: 11, borderTop: `1px solid ${LINE}`,
    fontSize: 11.5, color: MUTE, lineHeight: 1.55,
  },
  link: {
    padding: '5px 11px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 7, background: '#fff', color: '#15227a', cursor: 'pointer',
  },
}
