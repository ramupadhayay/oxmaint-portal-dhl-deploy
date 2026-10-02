'use client'

// Focus Area 1 — electronic document management and storage.
//
// The brief's ask is short and specific: one central store for HEPA
// certification documents, searchable and retrievable by filter, by cleanroom,
// by date range, by technician and by outcome. So that is the whole screen —
// the filter bar is the feature, not furniture around a table.
//
// A row here is the certification record for one filter: what test or
// replacement it documents, where it has reached in the lifecycle, who signed
// it and how many audit entries stand behind it.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, DataTable, Toolbar, Card, PALETTE,
} from '../lib/kit'
import {
  DOCUMENT_RECORDS, FILTER_VIEW, CLEANROOMS, TEST_RECORDS, fmtDate,
} from '../lib/data'
import { DateCell, DueIn, Status, Id } from '../lib/ui'

const { INK, SUB, MUTE, LINE } = PALETTE

const filterOf = (id) => FILTER_VIEW.find((f) => f.filterId === id) || null

// The technician and outcome the brief wants to search by are not on the
// document row — they are on the test the document certifies. Joining here
// rather than at import keeps the generated data the workbook's, unchanged.
const enrich = (d) => {
  const f = filterOf(d.relatedRecordId)
  const test = f?.lastTest || null
  return {
    ...d,
    id: d.documentRef,
    cleanroomId: f?.cleanroomId || null,
    cleanroomName: f?.cleanroomName || '—',
    isoClass: f?.isoClass || '—',
    technicianName: test?.technicianName || null,
    outcome: test?.result || null,
  }
}

const ROWS = DOCUMENT_RECORDS.map(enrich)

export default function Repository() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [room, setRoom] = useState('all')
  const [tech, setTech] = useState('all')
  const [outcome, setOutcome] = useState('all')
  const [stage, setStage] = useState('all')
  // The date range the brief names. Held as two plain dates rather than a
  // preset list: an inspector asks for "January to March", not "last 90 days".
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const rows = useMemo(() => ROWS.filter((d) => {
    if (room !== 'all' && d.cleanroomId !== room) return false
    if (tech !== 'all' && d.technicianName !== tech) return false
    if (outcome !== 'all' && d.outcome !== outcome) return false
    if (stage !== 'all' && d.stage !== stage) return false
    // Ranged on the certification due date, which is the date a document is
    // filed under. Inclusive at both ends — a range that quietly excludes its
    // own end date is a bug an inspector finds, not us.
    if (from && (!d.nextCertDueOn || d.nextCertDueOn < from)) return false
    if (to && (!d.nextCertDueOn || d.nextCertDueOn > to)) return false
    if (q) {
      const hay = `${d.documentRef} ${d.relatedRecordId} ${d.recordType} ${d.cleanroomName} ${d.reviewer} ${d.signedBy || ''} ${d.technicianName || ''}`
      if (!hay.toLowerCase().includes(q.toLowerCase())) return false
    }
    return true
  }), [q, room, tech, outcome, stage, from, to])

  const columns = [
    { key: 'documentRef', label: 'Document', render: (r) => <Id strong>{r.documentRef}</Id> },
    { key: 'recordType', label: 'Documents', render: (r) => <span>{r.recordType}<span style={{ display: 'block', fontSize: 10.5, color: MUTE }}><Id>{r.relatedRecordId}</Id></span></span> },
    { key: 'cleanroomName', label: 'Cleanroom', render: (r) => <span>{r.cleanroomName}<span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{r.isoClass}</span></span> },
    { key: 'outcome', label: 'Outcome', render: (r) => (r.outcome ? <Status>{r.outcome}</Status> : <span style={{ color: MUTE }}>—</span>) },
    { key: 'technicianName', label: 'Technician', render: (r) => r.technicianName || <span style={{ color: MUTE }}>—</span> },
    { key: 'stage', label: 'Stage', render: (r) => <Status>{r.stage}</Status> },
    { key: 'signedBy', label: 'Signed', render: (r) => (r.signedBy ? <span>{r.signedBy}<span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{fmtDate(r.signedOn)}</span></span> : <span style={{ color: MUTE }}>unsigned</span>) },
    { key: 'auditEntries', label: 'Audit', align: 'center', render: (r) => <span style={{ fontWeight: 700, color: INK }}>{r.auditEntries}</span> },
    { key: 'dueIn', label: 'Cert due', render: (r) => <span><DateCell shifted={r.nextCertDueOn} original={r.nextCertDue} /><span style={{ display: 'block', fontSize: 10.5 }}><DueIn days={r.dueIn} /></span></span>, sortValue: (r) => r.dueIn ?? 9999 },
  ]

  const clear = () => { setQ(''); setRoom('all'); setTech('all'); setOutcome('all'); setStage('all'); setFrom(''); setTo('') }
  const narrowed = rows.length !== ROWS.length

  return (
    <div>
      <PageHeading
        title="Document Repository"
        subtitle="One central store for every HEPA certification document — searchable and retrievable by filter, cleanroom, date range, technician and test outcome."
      />


      <StatCards items={[
        { label: 'Documents', value: DOCUMENT_RECORDS.length, icon: 'list', note: 'one per registered filter' },
        { label: 'Signed', value: DOCUMENT_RECORDS.filter((d) => d.signedBy).length, icon: 'tick', note: 'with an electronic signature' },
        { label: 'Unsigned', value: DOCUMENT_RECORDS.filter((d) => !d.signedBy).length, icon: 'clock', tone: 'amber', note: 'still in the workflow' },
        { label: 'Audit entries', value: DOCUMENT_RECORDS.reduce((n, d) => n + (d.auditEntries || 0), 0), icon: 'chart', note: 'across all documents' },
        { label: 'Retrieved', value: rows.length, icon: 'asset', tone: narrowed ? 'amber' : undefined, note: narrowed ? 'matching the current search' : 'no filters applied' },
      ]} />

      <Toolbar
        search={q}
        onSearch={setQ}
        placeholder="Document ref, filter, reviewer, technician…"
        filters={[
          { label: 'Cleanroom', value: room, onChange: setRoom, options: CLEANROOMS.map((c) => c.cleanroomId) },
          { label: 'Technician', value: tech, onChange: setTech, options: [...new Set(TEST_RECORDS.map((t) => t.technicianName))] },
          { label: 'Outcome', value: outcome, onChange: setOutcome, options: [...new Set(TEST_RECORDS.map((t) => t.result))] },
          { label: 'Stage', value: stage, onChange: setStage, options: [...new Set(DOCUMENT_RECORDS.map((d) => d.stage))] },
        ]}
      />

      <Card style={{ marginBottom: 12, padding: '11px 14px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Certification due between
          </span>
          <DateInput value={from} onChange={setFrom} label="from" />
          <span style={{ color: MUTE, fontSize: 12 }}>and</span>
          <DateInput value={to} onChange={setTo} label="to" />
          <button onClick={clear} style={styles.clear}>Clear all</button>
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: MUTE }}>
            {rows.length} of {ROWS.length} documents
          </span>
        </div>
      </Card>

      <DataTable
        columns={columns}
        rows={rows}
        pageSize={12}
        empty="No document matches this search. Clear a filter to widen it."
        onRowClick={(r) => router.push(`/portal/hepa/repository/${r.documentRef}`)}
      />

      <p style={{ fontSize: 11.5, color: SUB, margin: '12px 2px 0', paddingTop: 12, borderTop: `1px solid ${LINE}`, lineHeight: 1.55 }}>
        Technician and outcome come from the integrity test each document
        certifies rather than being copied onto the document row — so a document
        cannot disagree with the test behind it.
      </p>
    </div>
  )
}

function DateInput({ value, onChange, label }) {
  return (
    <input
      type="date"
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '6px 9px', fontSize: 12.5, fontFamily: 'inherit', color: value ? '#15227a' : SUB,
        fontWeight: value ? 700 : 500, borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 8, background: '#fff', outline: 'none',
      }}
    />
  )
}

const styles = {
  clear: {
    padding: '6px 11px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 8, background: '#fff', color: SUB, cursor: 'pointer',
  },
}
