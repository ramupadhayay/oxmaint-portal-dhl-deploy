'use client'

// The evidence package an inspection actually asks for.
//
// The brief names FDA and EU GMP inspections as the moment this whole system
// has to earn itself, and what that moment needs is not a screen — it is a file
// somebody can be handed. So this screen is a scope picker with an honest
// preview: choose what is in the package, see exactly how many records that is
// and which ones, then export.
//
// The preview is the point. A one-button "Export everything" hides whether the
// pack is complete until after it is on an inspector's desk.

import { useMemo, useState } from 'react'
import {
  PageHeading, StatCards, Card, Section, DataTable, PALETTE,
} from '../lib/kit'
import {
  DOCUMENT_RECORDS, TEST_RECORDS, FILTER_VIEW, CLEANROOMS, ORG, USER,
  LIFECYCLE_STAGES, ANCHOR_NOTE, fmtDate,
} from '../lib/data'
import { useStore } from '../lib/store'
import { DateCell, Status, Id, Penetration } from '../lib/ui'
import { useRole } from '../lib/roles'
import { auditPdf } from '../lib/auditPdf'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

const roomOf = (id) => FILTER_VIEW.find((f) => f.filterId === id)?.cleanroomName || '—'
const roomIdOf = (id) => FILTER_VIEW.find((f) => f.filterId === id)?.cleanroomId || null

export default function AuditExport() {
  const { records, notify } = useStore()
  const { can, why } = useRole()
  const mayExport = can('export')
  const [room, setRoom] = useState('all')
  const [stage, setStage] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [signedOnly, setSignedOnly] = useState(false)
  const [busy, setBusy] = useState(false)
  const [lastFile, setLastFile] = useState(null)

  const documents = useMemo(() => DOCUMENT_RECORDS.map((d) => ({
    ...d,
    id: d.documentRef,
    cleanroomId: roomIdOf(d.relatedRecordId),
    cleanroomName: roomOf(d.relatedRecordId),
  })).filter((d) => {
    if (room !== 'all' && d.cleanroomId !== room) return false
    if (stage !== 'all' && d.stage !== stage) return false
    if (signedOnly && !d.signedBy) return false
    if (from && (!d.nextCertDueOn || d.nextCertDueOn < from)) return false
    if (to && (!d.nextCertDueOn || d.nextCertDueOn > to)) return false
    return true
  }), [room, stage, signedOnly, from, to])

  // The tests that belong to the documents in scope, not every test on file.
  // A package whose evidence does not correspond to its records is worse than
  // a smaller one.
  const inScope = useMemo(() => new Set(documents.map((d) => d.relatedRecordId)), [documents])
  const tests = useMemo(
    () => TEST_RECORDS.filter((t) => inScope.has(t.filterId)).map((t) => ({ ...t, id: t.testId })),
    [inScope],
  )

  // Everything this session has appended: signatures, holds, routings. Real
  // records from the store rather than a fabricated trail.
  const audit = useMemo(() => {
    const rows = records?.hepa_audit || []
    return [...rows]
      .filter((r) => !documents.length || documents.some((d) => d.documentRef === r.documentRef))
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
  }, [records, documents])

  const signed = documents.filter((d) => d.signedBy).length
  const locked = documents.filter((d) => d.stage === 'Locked / Audit-Ready').length
  const gaps = documents.filter((d) => !d.signedBy)

  const scopeLabel = [
    room === 'all' ? 'All cleanrooms' : `${room} — ${CLEANROOMS.find((c) => c.cleanroomId === room)?.name}`,
    stage === 'all' ? 'all lifecycle stages' : stage,
    signedOnly ? 'signed records only' : 'signed and unsigned',
    from || to ? `certification due ${from || 'any'} to ${to || 'any'}` : 'no date range',
  ].join(' · ')

  const exportPack = async () => {
    if (!mayExport) { notify(why('export'), 'error'); return }
    setBusy(true)
    try {
      const name = await auditPdf({
        title: 'HEPA Certification Audit Package',
        org: `${ORG.name} — ${ORG.description}, ${ORG.site}`,
        generatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
        generatedBy: `${USER.name}, ${USER.role}`,
        scope: [
          { label: 'Cleanroom', value: room === 'all' ? 'All' : room },
          { label: 'Lifecycle stage', value: stage === 'all' ? 'All' : stage },
          { label: 'Signature', value: signedOnly ? 'Signed records only' : 'Signed and unsigned' },
          { label: 'Certification due', value: from || to ? `${from || 'any'} to ${to || 'any'}` : 'No range applied' },
          { label: 'Records included', value: `${documents.length} documents, ${tests.length} tests, ${audit.length} audit entries` },
        ],
        note: `${ANCHOR_NOTE} ${ORG.dataNote}`,
        documents,
        tests,
        audit,
      })
      setLastFile(name)
      notify('Audit package exported.')
    } catch (e) {
      notify(e?.message || 'Could not build the package.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const docColumns = [
    { key: 'documentRef', label: 'Document', render: (r) => <Id strong>{r.documentRef}</Id> },
    { key: 'relatedRecordId', label: 'Filter', render: (r) => <span><Id>{r.relatedRecordId}</Id><span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{r.cleanroomName}</span></span> },
    { key: 'recordType', label: 'Type' },
    { key: 'stage', label: 'Stage', render: (r) => <Status>{r.stage}</Status> },
    { key: 'signedBy', label: 'Signature', render: (r) => (r.signedBy ? <span>{r.signedBy}<span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{fmtDate(r.signedOn)}</span></span> : <span style={{ color: '#b45309', fontWeight: 600 }}>unsigned</span>) },
    { key: 'nextCertDueOn', label: 'Cert due', render: (r) => <DateCell shifted={r.nextCertDueOn} original={r.nextCertDue} /> },
  ]

  const testColumns = [
    { key: 'testId', label: 'Test', render: (r) => <Id strong>{r.testId}</Id> },
    { key: 'filterId', label: 'Filter', render: (r) => <Id>{r.filterId}</Id> },
    { key: 'date', label: 'Tested', render: (r) => <DateCell shifted={r.date} original={r.testDate} /> },
    { key: 'penetration', label: 'Penetration', align: 'right', render: (r) => <Penetration value={r.penetration} /> },
    { key: 'result', label: 'Result', render: (r) => <Status>{r.result}</Status> },
    { key: 'technicianName', label: 'Technician' },
    { key: 'lockStatus', label: 'Record', render: (r) => <Status>{r.lockStatus}</Status> },
  ]

  return (
    <div>
      <PageHeading
        title="Audit Export"
        subtitle="Build the evidence package an FDA or EU GMP inspection asks for — certification records, the integrity tests behind them, and the audit trail — scoped and previewed before it leaves the building."
        right={(
          <button
            onClick={exportPack}
            disabled={busy || !mayExport || !documents.length}
            title={mayExport ? undefined : why('export')}
            style={{ ...styles.export, opacity: busy || !mayExport || !documents.length ? 0.55 : 1 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {busy ? 'Building…' : 'Export package (PDF)'}
          </button>
        )}
      />


      <StatCards items={[
        { label: 'Documents in package', value: documents.length, icon: 'list', note: `of ${DOCUMENT_RECORDS.length} on file` },
        { label: 'Integrity tests', value: tests.length, icon: 'chart', note: 'evidence behind the records' },
        { label: 'Signed', value: signed, icon: 'tick', tone: signed === documents.length && documents.length ? 'green' : 'amber', note: `${gaps.length} without a signature` },
        { label: 'Locked / audit-ready', value: locked, icon: 'asset', note: 'final and unmodifiable' },
        { label: 'Audit entries', value: audit.length, icon: 'clock', note: 'appended this session' },
      ]} />

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
          <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: INK }}>Scope of the package</h3>
          <span style={{ fontSize: 11.5, color: MUTE }}>{scopeLabel}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
          <Field label="Cleanroom">
            <Select value={room} onChange={setRoom} options={[['all', 'All cleanrooms'], ...CLEANROOMS.map((c) => [c.cleanroomId, `${c.cleanroomId} — ${c.name}`])]} />
          </Field>
          <Field label="Lifecycle stage">
            <Select value={stage} onChange={setStage} options={[['all', 'All stages'], ...LIFECYCLE_STAGES.map((s) => [s, s])]} />
          </Field>
          <Field label="Certification due from">
            <DateInput value={from} onChange={setFrom} />
          </Field>
          <Field label="Certification due to">
            <DateInput value={to} onChange={setTo} />
          </Field>
          <Field label="Signature">
            <label style={styles.check}>
              <input type="checkbox" checked={signedOnly} onChange={(e) => setSignedOnly(e.target.checked)} />
              <span>Signed records only</span>
            </label>
          </Field>
        </div>
      </Card>

      {gaps.length > 0 && (
        <Card style={{ marginBottom: 14, borderColor: '#fde68a', background: '#fffbf5' }}>
          <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}>
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" />
            </svg>
            <p style={{ margin: 0, fontSize: 12, color: SUB, lineHeight: 1.6 }}>
              <strong style={{ color: '#7c2d12' }}>{gaps.length} of these {documents.length} records carry no electronic signature.</strong>{' '}
              They are included and marked as unsigned rather than quietly dropped —
              a package that hides its own gaps is the one an inspector finds them in.
              Sign them on <strong style={{ color: INK }}>Approvals</strong> before exporting, or export as-is.
            </p>
          </div>
        </Card>
      )}

      <Section title={`Certification records in the package (${documents.length})`}>
        <DataTable columns={docColumns} rows={documents} pageSize={8} empty="Nothing is in scope. Widen the filters above." />
      </Section>

      <Section title={`Integrity tests in the package (${tests.length})`}>
        <DataTable columns={testColumns} rows={tests} pageSize={8} empty="No test evidence for the records in scope." />
      </Section>

      <Section title={`Audit trail (${audit.length})`}>
        {audit.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {audit.slice(0, 12).map((a) => (
              <div key={a.recordId} style={styles.auditRow}>
                <span style={{ fontSize: 11, color: MUTE, minWidth: 130, fontVariantNumeric: 'tabular-nums' }}>
                  {String(a.at).replace('T', ' ').slice(0, 19)}
                </span>
                <Id strong>{a.documentRef}</Id>
                <strong style={{ fontSize: 12, color: INK }}>{a.action}</strong>
                <span style={{ fontSize: 12, color: SUB }}>{a.actor}</span>
                {a.meaning && <span style={{ fontSize: 11.5, color: MUTE, marginLeft: 'auto' }}>{a.meaning}</span>}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 12.5, color: MUTE, lineHeight: 1.6 }}>
            No audit entries yet. Route a record for review, sign one on Approvals,
            or place a legal hold on Retention, and the entry appears here and in
            the exported package.
          </p>
        )}
      </Section>

      {lastFile && (
        <p style={{ fontSize: 12, color: SUB, margin: '4px 2px 0' }}>
          Last package: <strong style={{ color: INK }}>{lastFile}</strong> — saved to your downloads.
        </p>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  )
}

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={styles.input}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )
}

function DateInput({ value, onChange }) {
  return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} style={styles.input} />
}

const styles = {
  input: {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12.5,
    borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 9, background: '#fff', color: INK,
    fontFamily: 'inherit', outline: 'none',
  },
  check: {
    display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: INK,
    padding: '8px 0', cursor: 'pointer',
  },
  export: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', border: 'none', borderRadius: 9,
    background: ACCENT, color: '#fff', cursor: 'pointer',
  },
  auditRow: {
    display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap',
    padding: '8px 11px', borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 9, background: '#fcfdfe',
  },
}
