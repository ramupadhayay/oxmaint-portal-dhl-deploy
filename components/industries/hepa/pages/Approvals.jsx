'use client'

// Where a certification record is actually signed.
//
// This is the screen 21 CFR Part 11 is judged on, so the signature panel is
// deliberately not a tick box. A signature under that rule carries three parts
// and all three are on the form:
//
//   identity   — who is signing, and in what role
//   meaning    — what they mean by signing, typed rather than assumed
//   timestamp  — written by the system, not offered to the signer
//
// The meaning field is required. A record that says "approved" without saying
// what was approved is the thing an inspection asks about, and a demo that
// glosses over it is demonstrating the wrong product.
//
// Rejection is here too, and it is a first-class act: the record goes back to
// the originator with the reason attached, rather than disappearing.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Card, Section, DataTable, PALETTE,
} from '../lib/kit'
import { FILTER_VIEW, USER, THRESHOLDS, fmtDate } from '../lib/data'
import { useStore } from '../lib/store'
import {
  useDocuments, useAuditTrail, signDocument, rejectDocument, advanceStage,
} from '../lib/lifecycle'
import { DateCell, DueIn, Status, Id, Penetration } from '../lib/ui'
import { useRole } from '../lib/roles'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

const filterOf = (id) => FILTER_VIEW.find((f) => f.filterId === id) || null

// Suggested wordings, because the point of the field is that it is specific and
// nobody writes a good one from a blank box under demo pressure. Picking one
// still fills the same field a typed sentence would.
const MEANINGS = [
  'Reviewed and approved: the integrity test meets the acceptance criteria.',
  'Approved as the responsible quality reviewer for this cleanroom.',
  'Approved: replacement chain of custody and post-installation test verified.',
]

export default function Approvals() {
  const router = useRouter()
  const store = useStore()
  const documents = useDocuments()
  const trail = useAuditTrail()
  const { can, why, role } = useRole()

  const [selected, setSelected] = useState(null)
  const [meaning, setMeaning] = useState(MEANINGS[0])
  const [reason, setReason] = useState('')
  const [mode, setMode] = useState('sign')
  const [busy, setBusy] = useState(false)

  // Whether this role may do what the panel is currently set to do. Declared
  // after `mode` rather than beside the other role bits — reading it before the
  // state it depends on threw on the temporal dead zone.
  const allowed = mode === 'sign' ? can('sign') : can('reject')

  // The queue: anything that has not been signed yet, soonest due first. A
  // signed record is not waiting for anyone, and the board is where its later
  // stages are moved.
  const queue = useMemo(() => documents
    .filter((d) => d.approvalStatus !== 'Approved')
    .map((d) => ({ ...d, id: d.documentRef, cleanroom: filterOf(d.relatedRecordId)?.cleanroomName || '—' }))
    .sort((a, b) => (a.dueIn ?? 9999) - (b.dueIn ?? 9999)), [documents])

  const signedRows = useMemo(() => documents
    .filter((d) => d.approvalStatus === 'Approved')
    .map((d) => ({ ...d, id: d.documentRef, cleanroom: filterOf(d.relatedRecordId)?.cleanroomName || '—' }))
    .sort((a, b) => String(b.signedAt || '').localeCompare(String(a.signedAt || ''))), [documents])

  const doc = selected ? documents.find((d) => d.documentRef === selected) : null
  const f = doc ? filterOf(doc.relatedRecordId) : null

  const submit = async () => {
    if (!doc) return
    // Checked here as well as on the button. A disabled control is a courtesy;
    // the refusal has to hold even if something else calls this.
    if (!allowed) { store.notify(why(mode === 'sign' ? 'sign' : 'reject'), 'error'); return }
    setBusy(true)
    if (mode === 'sign') {
      // A record still sitting at Created or Routed has not been reviewed, so
      // signing it moves it through review first rather than skipping a stage
      // the audit trail is supposed to show.
      if (doc.stage === 'Created') await advanceStage(store, doc, 'Routed for Review')
      if (doc.stage === 'Created' || doc.stage === 'Routed for Review') await advanceStage(store, { ...doc, stage: 'Routed for Review' }, 'Under Review')
      const saved = await signDocument(store, { ...doc, stage: 'Under Review' }, { meaning })
      if (saved) { setSelected(null); setMeaning(MEANINGS[0]) }
    } else {
      const saved = await rejectDocument(store, doc, { reason })
      if (saved) { setSelected(null); setReason('') }
    }
    setBusy(false)
  }

  const columns = [
    { key: 'documentRef', label: 'Document', render: (r) => <Id strong>{r.documentRef}</Id> },
    { key: 'relatedRecordId', label: 'Filter', render: (r) => <span><Id>{r.relatedRecordId}</Id><span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{r.cleanroom}</span></span> },
    { key: 'recordType', label: 'Type' },
    { key: 'stage', label: 'Stage', render: (r) => <Status>{r.stage}</Status> },
    { key: 'reviewer', label: 'Reviewer' },
    { key: 'dueIn', label: 'Cert due', render: (r) => <DueIn days={r.dueIn} />, sortValue: (r) => r.dueIn ?? 9999 },
    {
      key: 'act',
      label: '',
      align: 'right',
      sortable: false,
      render: (r) => (
        <button
          onClick={(e) => { e.stopPropagation(); setSelected(r.documentRef); setMode('sign') }}
          style={{ ...styles.btn, ...(selected === r.documentRef ? styles.btnActive : null) }}
        >
          {selected === r.documentRef ? 'Selected' : 'Review'}
        </button>
      ),
    },
  ]

  const signedColumns = [
    { key: 'documentRef', label: 'Document', render: (r) => <Id strong>{r.documentRef}</Id> },
    { key: 'cleanroom', label: 'Cleanroom' },
    { key: 'signedBy', label: 'Signed by', render: (r) => <span>{r.signedBy}<span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{r.signatureRole || 'Quality Reviewer'}</span></span> },
    {
      // Signed here, the timestamp is now and there is no workbook date to
      // show beside it. Signed in the workbook, the pair is the usual one.
      key: 'signedAt',
      label: 'Signed',
      sortValue: (r) => r.signedAt || '',
      render: (r) => (r.signatureMeaning
        ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>{String(r.signedAt).replace('T', ' ').slice(0, 16)}<span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>signed in this portal</span></span>
        : <DateCell shifted={r.signedOn} original={String(r.signedAt || '').slice(0, 10)} />),
    },
    { key: 'signatureMeaning', label: 'Meaning of signature', render: (r) => <span style={{ fontSize: 11.5, color: SUB }}>{r.signatureMeaning || 'Recorded in the workbook without a stated meaning.'}</span> },
    { key: 'stage', label: 'Stage', render: (r) => <Status>{r.stage}</Status> },
  ]

  return (
    <div>
      <PageHeading
        title="Approvals"
        subtitle="Review a certification record and sign it electronically — identity, meaning and timestamp, as 21 CFR Part 11 requires — or return it with a reason."
      />


      <StatCards items={[
        { label: 'Awaiting approval', value: queue.length, icon: 'clock', tone: queue.length ? 'amber' : 'green', note: 'unsigned records' },
        { label: 'Signed', value: signedRows.length, icon: 'tick', tone: 'green', note: 'with a stated meaning' },
        { label: 'Overdue in the queue', value: queue.filter((q) => (q.dueIn ?? 0) < 0).length, icon: 'alert', tone: queue.some((q) => (q.dueIn ?? 0) < 0) ? 'red' : 'green', note: 'past their certification date' },
        { label: 'Due within lead time', value: queue.filter((q) => q.dueIn != null && q.dueIn >= 0 && q.dueIn <= THRESHOLDS.notificationLeadDays.value).length, icon: 'list', note: `${THRESHOLDS.notificationLeadDays.value} days` },
        { label: 'Audit entries', value: trail.length, icon: 'chart', note: 'appended this session' },
      ]} />

      {doc && (
        <Card style={{ marginBottom: 14, borderColor: '#c7d2fe', background: '#fbfcff' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
                {mode === 'sign' ? 'Electronic signature' : 'Return to originator'}
              </div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: INK }}>
                {doc.documentRef} — {f?.cleanroomName || '—'}
              </h3>
              <p style={{ margin: '5px 0 0', fontSize: 12.5, color: SUB }}>
                {doc.recordType} for filter <Id>{doc.relatedRecordId}</Id>
                {f?.isoClass ? ` · ${f.isoClass}` : ''} · certification due{' '}
                {fmtDate(doc.nextCertDueOn)} (<DueIn days={doc.dueIn} />)
              </p>
            </div>
            <button onClick={() => setSelected(null)} style={styles.close}>Close</button>
          </div>

          {/* The evidence being signed for, on the same screen as the signature.
              A reviewer asked to sign without the test in front of them is
              being asked to sign a row id. */}
          {f?.lastTest && (
            <div style={styles.evidence}>
              <Piece label="Test" value={<Id strong>{f.lastTest.testId}</Id>} />
              <Piece label="Tested" value={<DateCell shifted={f.lastTest.date} original={f.lastTest.testDate} />} />
              <Piece label="Scan points" value={f.lastTest.testPoints} />
              <Piece label="Penetration" value={<Penetration value={f.lastTest.penetration} />} />
              <Piece label="Result" value={<Status>{f.lastTest.result}</Status>} />
              <Piece label="Technician" value={f.lastTest.technicianName} />
              <Piece label="Breaches" value={f.breachCount ? <strong style={{ color: '#b91c1c' }}>{f.breachCount}</strong> : '—'} />
              <Piece label="Record" value={<Status>{f.lastTest.lockStatus}</Status>} />
            </div>
          )}

          {f?.lastTest?.result === 'Fail' && (
            <div style={styles.warn}>
              This filter&apos;s most recent integrity test <strong>failed</strong>. Signing
              approves the certification record as it stands — it does not clear the
              filter. Check the replacement register before approving.
            </div>
          )}

          <div style={styles.tabs}>
            {[['sign', 'Sign and approve'], ['reject', 'Return with a reason']].map(([k, label]) => (
              <button key={k} onClick={() => setMode(k)}
                style={{ ...styles.tab, ...(mode === k ? styles.tabOn : null) }}>{label}</button>
            ))}
          </div>

          {mode === 'sign' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
              <div>
                <Label>Signed by — identity</Label>
                <div style={styles.identity}>
                  <span style={{ ...styles.avatar, background: role.accent }}>{role.initials}</span>
                  <span>
                    <strong style={{ display: 'block', fontSize: 13, color: INK }}>{role.person}</strong>
                    <span style={{ fontSize: 11.5, color: MUTE }}>{role.name}</span>
                  </span>
                </div>
                <Label style={{ marginTop: 12 }}>Timestamp</Label>
                <div style={styles.readonly}>
                  Written by the system at the moment of signing — not editable.
                </div>
              </div>

              <div>
                <Label>Meaning of signature — required</Label>
                <textarea
                  value={meaning}
                  onChange={(e) => setMeaning(e.target.value)}
                  rows={3}
                  placeholder="State what you are approving and in what capacity."
                  style={styles.textarea}
                />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
                  {MEANINGS.map((m, i) => (
                    <button key={m} onClick={() => setMeaning(m)} style={styles.chip}>Wording {i + 1}</button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <Label>Reason for return — required</Label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Say what is missing or wrong, so the next submission can answer it."
                style={styles.textarea}
              />
              <p style={{ margin: '8px 0 0', fontSize: 11.5, color: MUTE, lineHeight: 1.5 }}>
                The record goes back to Created with this reason attached. Nothing
                is deleted — the returned version stays on file.
              </p>
            </div>
          )}

          <div style={styles.submitRow}>
            <span style={{ fontSize: 11.5, lineHeight: 1.5, flex: '1 1 260px', color: allowed ? MUTE : '#b45309' }}>
              {!allowed
                ? `Signed in as ${role.short}. ${why(mode === 'sign' ? 'sign' : 'reject')}`
                : mode === 'sign'
                  ? 'Signing writes an audit entry carrying your name, your role, the wording above and the system timestamp.'
                  : 'Returning writes an audit entry carrying your name, your role and the reason above.'}
            </span>
            <button
              onClick={submit}
              disabled={!allowed || busy || !store.ready || (mode === 'sign' ? !meaning.trim() : !reason.trim())}
              title={allowed ? undefined : why(mode === 'sign' ? 'sign' : 'reject')}
              style={{
                ...styles.submit,
                ...(mode === 'reject' ? styles.submitReject : null),
                opacity: !allowed || busy || !store.ready || (mode === 'sign' ? !meaning.trim() : !reason.trim()) ? 0.5 : 1,
              }}
            >
              {busy ? 'Saving…' : mode === 'sign' ? 'Apply electronic signature' : 'Return to originator'}
            </button>
          </div>
        </Card>
      )}

      <Section
        title={`Awaiting approval (${queue.length})`}
        right={<span style={{ fontSize: 11.5, color: MUTE }}>soonest due first</span>}
      >
        <DataTable
          columns={columns}
          rows={queue}
          pageSize={10}
          empty="Every certification record has been signed."
          onRowClick={(r) => { setSelected(r.documentRef); setMode('sign') }}
        />
      </Section>

      <Section title={`Signed (${signedRows.length})`}>
        <DataTable
          columns={signedColumns}
          rows={signedRows}
          pageSize={8}
          empty="Nothing has been signed yet."
          onRowClick={(r) => router.push(`/portal/hepa/repository/${r.documentRef}`)}
        />
      </Section>

      {trail.length > 0 && (
        <Section title="Audit trail — this session">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {trail.slice(0, 10).map((a) => (
              <div key={a.recordId} style={styles.auditRow}>
                <span style={{ fontSize: 11, color: MUTE, minWidth: 132, fontVariantNumeric: 'tabular-nums' }}>
                  {String(a.at).replace('T', ' ').slice(0, 19)}
                </span>
                <Id strong>{a.documentRef}</Id>
                <strong style={{ fontSize: 12, color: INK }}>{a.action}</strong>
                <span style={{ fontSize: 12, color: SUB }}>{a.actor}{a.actorRole ? ` · ${a.actorRole}` : ''}</span>
                {a.meaning && <span style={{ fontSize: 11.5, color: MUTE, flex: '1 1 200px' }}>&ldquo;{a.meaning}&rdquo;</span>}
              </div>
            ))}
          </div>
          <p style={{ margin: '11px 0 0', paddingTop: 11, borderTop: `1px solid ${LINE}`, fontSize: 11.5, color: MUTE, lineHeight: 1.55 }}>
            Append-only. Nothing on this list can be edited or removed, and every
            entry goes into the audit package on export.
          </p>
        </Section>
      )}
    </div>
  )
}

function Label({ children, style }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5, ...style }}>
      {children}
    </div>
  )
}

function Piece({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: INK, fontWeight: 500 }}>{value ?? '—'}</div>
    </div>
  )
}

const styles = {
  btn: {
    padding: '5px 11px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 7, background: '#fff', color: ACCENT, cursor: 'pointer',
  },
  btnActive: { background: ACCENT, color: '#fff', borderColor: ACCENT },
  close: {
    padding: '5px 11px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 7, background: '#fff', color: SUB, cursor: 'pointer',
  },
  evidence: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(118px,1fr))', gap: '11px 16px',
    padding: '12px 14px', borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 10, background: '#fff', marginBottom: 12,
  },
  warn: {
    padding: '10px 13px', borderStyle: 'solid', borderWidth: 1, borderColor: '#fecaca', background: '#fef2f2', borderRadius: 10,
    fontSize: 12, color: '#7f1d1d', lineHeight: 1.55, marginBottom: 12,
  },
  tabs: { display: 'flex', gap: 6, marginBottom: 13 },
  tab: {
    padding: '6px 13px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 8, background: '#fff', color: SUB, cursor: 'pointer',
  },
  tabOn: { background: ACCENT, color: '#fff', borderColor: ACCENT },
  identity: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
    borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 9, background: '#fff',
  },
  avatar: {
    width: 32, height: 32, borderRadius: '50%', background: ACCENT, color: '#fff',
    display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0,
  },
  readonly: {
    padding: '9px 12px', border: `1px dashed ${LINE}`, borderRadius: 9,
    fontSize: 11.5, color: MUTE, background: '#fff', lineHeight: 1.5,
  },
  textarea: {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
    fontFamily: 'inherit', lineHeight: 1.5, color: INK, borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`,
    borderRadius: 9, outline: 'none', background: '#fff', resize: 'vertical',
  },
  chip: {
    padding: '4px 9px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 999, background: '#fff', color: SUB, cursor: 'pointer',
  },
  submitRow: {
    display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
    marginTop: 14, paddingTop: 13, borderTop: `1px solid ${LINE}`,
  },
  submit: {
    marginLeft: 'auto', padding: '10px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
    border: 'none', borderRadius: 9, background: ACCENT, color: '#fff', cursor: 'pointer',
  },
  submitReject: { background: '#b91c1c' },
  auditRow: {
    display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap',
    padding: '8px 11px', borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 9, background: '#fcfdfe',
  },
}
