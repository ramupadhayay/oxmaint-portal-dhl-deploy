'use client'

// Retention, and the legal hold that overrides it.
//
// The regulation the client is judged against keeps HEPA certification records
// for a defined period and forbids destroying anything under investigation.
// Those are two different rules and a portal that shows only the first is the
// one that deletes the record an inspector asked for.
//
// So a document here has a retention expiry from the workbook, and a hold that
// can be placed on top of it. A held record shows no expiry at all — not a
// later one — because a hold does not extend a clock, it stops it.
//
// The hold is a real record: `hepa_hold` in the shared store, written the
// moment the button is pressed, and it survives a reload. Placing and lifting
// one both append to the audit trail, since who stopped a retention clock is
// exactly the sort of thing an inspection asks about.

import { useMemo, useState } from 'react'
import {
  PageHeading, StatCards, DataTable, Toolbar, Card, Section, PALETTE,
} from '../lib/kit'
import { DOCUMENT_RECORDS, FILTER_VIEW, USER, fmtDate, daysFromToday } from '../lib/data'
import { useStore } from '../lib/store'
import { DateCell, Status, Id } from '../lib/ui'
import { useRole } from '../lib/roles'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

const YEAR = 365.25

const roomOf = (id) => FILTER_VIEW.find((f) => f.filterId === id)?.cleanroomName || '—'

export default function Retention() {
  const { records, create, update, notify, ready } = useStore()
  const { can, why, role } = useRole()
  const mayHold = can('hold')
  const holds = records?.hepa_hold || []
  const [q, setQ] = useState('')
  const [state, setState] = useState('all')
  const [busy, setBusy] = useState(null)

  // A hold is keyed by the document it is on. Only the newest matters — lifting
  // and replacing one leaves both rows behind, and the later word is the one in
  // force.
  const holdOf = useMemo(() => {
    const m = new Map()
    for (const h of holds) {
      const prev = m.get(h.documentRef)
      if (!prev || String(h.placedAt) > String(prev.placedAt)) m.set(h.documentRef, h)
    }
    return m
  }, [holds])

  const rows = useMemo(() => DOCUMENT_RECORDS.map((d) => {
    const hold = holdOf.get(d.documentRef)
    const held = Boolean(hold && hold.active !== false)
    const expiresIn = daysFromToday(d.retentionExpiryOn)
    return {
      ...d,
      id: d.documentRef,
      cleanroomName: roomOf(d.relatedRecordId),
      hold: held ? hold : null,
      held,
      expiresIn,
      // Held records are never "expiring". That is the whole point of a hold,
      // and a screen that sorts one into the expiry list is the screen that
      // gets it destroyed.
      state: held ? 'On legal hold' : expiresIn == null ? 'No expiry set' : expiresIn < 0 ? 'Past retention' : 'Retained',
      years: d.retentionExpiry ? Math.round(((new Date(`${d.retentionExpiry}T00:00:00Z`) - new Date(`${d.nextCertDue}T00:00:00Z`)) / 86400000) / YEAR) : null,
    }
  }).filter((d) => {
    if (state !== 'all' && d.state !== state) return false
    if (q && !`${d.documentRef} ${d.relatedRecordId} ${d.cleanroomName} ${d.recordType}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }), [holdOf, q, state])

  const all = useMemo(() => DOCUMENT_RECORDS.map((d) => ({
    held: Boolean(holdOf.get(d.documentRef) && holdOf.get(d.documentRef).active !== false),
    expiresIn: daysFromToday(d.retentionExpiryOn),
  })), [holdOf])

  const heldCount = all.filter((d) => d.held).length
  const pastRetention = all.filter((d) => !d.held && d.expiresIn != null && d.expiresIn < 0).length

  const place = async (row) => {
    if (!mayHold) { notify(why('hold'), 'error'); return }
    setBusy(row.documentRef)
    const now = new Date().toISOString()
    const existing = holdOf.get(row.documentRef)
    const payload = {
      documentRef: row.documentRef,
      relatedRecordId: row.relatedRecordId,
      reason: 'Placed from the retention register',
      placedBy: USER.name,
      placedAt: now,
      active: true,
    }
    // Re-placing a hold that was lifted updates the record it already has
    // rather than stacking a second one under the same id.
    const saved = existing
      ? await update('hepa_hold', existing.recordId, payload)
      : await create('hepa_hold', { ...payload, recordId: `hold_${row.documentRef}` })
    if (saved) {
      await create('hepa_audit', {
        recordId: `aud_hold_${row.documentRef}_${Date.now().toString(36)}`,
        documentRef: row.documentRef,
        action: 'Legal hold placed',
        actor: USER.name,
        actorRole: USER.role,
        at: now,
        meaning: 'Record preserved beyond its retention period pending investigation.',
      })
      notify('Legal hold placed. Retention is suspended for this record.')
    }
    setBusy(null)
  }

  const lift = async (row) => {
    if (!mayHold) { notify(why('hold'), 'error'); return }
    setBusy(row.documentRef)
    const now = new Date().toISOString()
    const saved = await update('hepa_hold', row.hold.recordId, {
      active: false, liftedBy: USER.name, liftedAt: now,
    })
    if (saved) {
      await create('hepa_audit', {
        recordId: `aud_lift_${row.documentRef}_${Date.now().toString(36)}`,
        documentRef: row.documentRef,
        action: 'Legal hold lifted',
        actor: USER.name,
        actorRole: USER.role,
        at: now,
        meaning: 'Investigation closed; the retention period resumes.',
      })
      notify('Hold lifted. The retention clock resumes.')
    }
    setBusy(null)
  }

  const columns = [
    { key: 'documentRef', label: 'Document', render: (r) => <Id strong>{r.documentRef}</Id> },
    { key: 'relatedRecordId', label: 'Filter', render: (r) => <span><Id>{r.relatedRecordId}</Id><span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{r.cleanroomName}</span></span> },
    { key: 'recordType', label: 'Record type' },
    { key: 'retentionExpiryOn', label: 'Retention expiry', render: (r) => (r.held
      ? <span style={{ color: MUTE, fontStyle: 'italic' }}>suspended</span>
      : <DateCell shifted={r.retentionExpiryOn} original={r.retentionExpiry} />), sortValue: (r) => r.retentionExpiryOn || '' },
    { key: 'years', label: 'Period', align: 'right', render: (r) => (r.years ? <span>{r.years}<span style={{ fontSize: 10.5, color: MUTE }}> yrs</span></span> : '—') },
    { key: 'state', label: 'Status', render: (r) => <Status>{r.state === 'On legal hold' ? 'Blocked' : r.state === 'Past retention' ? 'Pending' : 'Active'}</Status>, sortValue: (r) => r.state },
    {
      key: 'hold',
      label: 'Legal hold',
      sortable: false,
      render: (r) => (r.held ? (
        <span style={{ lineHeight: 1.35 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c' }}>Held</span>
          <span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{r.hold.placedBy} · {fmtDate(String(r.hold.placedAt).slice(0, 10))}</span>
        </span>
      ) : <span style={{ color: MUTE }}>—</span>),
    },
    {
      key: 'act',
      label: '',
      align: 'right',
      sortable: false,
      render: (r) => (
        <button
          disabled={!ready || !mayHold || busy === r.documentRef}
          title={mayHold ? undefined : why('hold')}
          onClick={(e) => { e.stopPropagation(); (r.held ? lift : place)(r) }}
          style={{ ...styles.act, ...(r.held ? styles.actLift : null), opacity: !ready || !mayHold || busy === r.documentRef ? 0.5 : 1 }}
        >
          {busy === r.documentRef ? 'Saving…' : r.held ? 'Lift hold' : 'Place hold'}
        </button>
      ),
    },
  ]

  return (
    <div>
      <PageHeading
        title="Retention"
        subtitle="How long each certification record is kept, and which records are preserved beyond that period by a legal hold."
      />


      <StatCards items={[
        { label: 'Records under retention', value: DOCUMENT_RECORDS.length, icon: 'list', note: 'certification documents' },
        { label: 'On legal hold', value: heldCount, icon: 'alert', tone: heldCount ? 'amber' : undefined, note: 'retention suspended' },
        { label: 'Past retention', value: pastRetention, icon: 'clock', tone: pastRetention ? 'amber' : 'green', note: 'eligible for disposition' },
        { label: 'Longest period', value: Math.max(...DOCUMENT_RECORDS.map((d) => (d.retentionExpiry ? new Date(`${d.retentionExpiry}T00:00:00Z`).getUTCFullYear() : 0))), icon: 'chart', note: 'expiry year on file' },
      ]} />

      <Card style={{ marginBottom: 14, background: '#fcfdfe' }}>
        <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2"
            strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}>
            <rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          <p style={{ margin: 0, fontSize: 12, color: SUB, lineHeight: 1.6 }}>
            {!mayHold && (
              <><strong style={{ color: '#b45309' }}>Signed in as {role.short} — {why('hold').toLowerCase()}</strong>{' '}</>
            )}
            A hold <strong style={{ color: INK }}>stops</strong> the retention clock rather than
            extending it, so a held record shows no expiry date at all. Placing
            and lifting a hold are both audit-trail events with a named actor and
            a timestamp — the record of who suspended retention is itself part of
            the evidence.
          </p>
        </div>
      </Card>

      <Toolbar
        search={q}
        onSearch={setQ}
        placeholder="Document, filter, cleanroom or record type…"
        filters={[{ label: 'Status', value: state, onChange: setState, options: ['Retained', 'Past retention', 'On legal hold', 'No expiry set'] }]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} of {DOCUMENT_RECORDS.length}</span>}
      />

      <DataTable columns={columns} rows={rows} pageSize={12} />

      {heldCount > 0 && (
        <Section title="Records currently held" style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {rows.filter((r) => r.held).map((r) => (
              <div key={r.documentRef} style={styles.holdRow}>
                <Id strong>{r.documentRef}</Id>
                <span style={{ color: SUB, fontSize: 12 }}>{r.cleanroomName} · {r.recordType}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11.5, color: MUTE }}>
                  held by {r.hold.placedBy} on {fmtDate(String(r.hold.placedAt).slice(0, 10))}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

const styles = {
  act: {
    padding: '5px 10px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 7, background: '#fff', color: ACCENT,
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  actLift: { color: '#b91c1c', borderColor: '#fecaca', background: '#fef2f2' },
  holdRow: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    padding: '9px 12px', borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 9, background: '#fcfdfe',
  },
}
