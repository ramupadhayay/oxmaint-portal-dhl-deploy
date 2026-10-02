'use client'

// The certification document lifecycle board.
//
// Five columns, in the order the client's brief names them: created, routed for
// review, under review, approved and signed, locked and audit-ready. A record
// moves left to right and never back except by rejection, which is a recorded
// act rather than an undo.
//
// The board is where the workflow is *visible*; Approvals is where it is
// signed. Both read and write the same records through lib/lifecycle, so a
// document signed on one screen has moved on the other before the page is even
// reloaded.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeading, StatCards, Card, PALETTE } from '../lib/kit'
import { FILTER_VIEW, THRESHOLDS } from '../lib/data'
import { useStore } from '../lib/store'
import {
  useDocuments, LIFECYCLE_STAGES, actionsFor, advanceStage, moveStage, stageIndex,
} from '../lib/lifecycle'
import { DueIn, Status, Id, Derived } from '../lib/ui'
import { useRole } from '../lib/roles'
import { matchRule } from '../lib/routing'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

const roomOf = (id) => FILTER_VIEW.find((f) => f.filterId === id)?.cleanroomName || '—'

// Each column carries its own accent, so the board reads as a progression
// rather than five identical grey lists.
const COLUMN = {
  'Created': { dot: '#94a3b8', bg: '#f8fafc' },
  'Routed for Review': { dot: '#2563eb', bg: '#f5f9ff' },
  'Under Review': { dot: '#d97706', bg: '#fffbf5' },
  'Approved - Signed': { dot: '#16a34a', bg: '#f6fdf9' },
  'Locked / Audit-Ready': { dot: '#15227a', bg: '#f6f7fd' },
}

export default function Lifecycle() {
  const router = useRouter()
  const store = useStore()
  const documents = useDocuments()
  const { can, why } = useRole()
  const [busy, setBusy] = useState(null)
  const [room, setRoom] = useState('all')
  // Which card has its stepper open. One at a time: a board with a control
  // showing on every card is a board of controls rather than of records.
  const [openCard, setOpenCard] = useState(null)

  const rows = useMemo(
    () => documents.filter((d) => room === 'all' || roomOf(d.relatedRecordId) === room),
    [documents, room],
  )

  const byStage = useMemo(() => {
    const m = new Map(LIFECYCLE_STAGES.map((s) => [s, []]))
    for (const d of rows) {
      // A stage the board does not know about would drop the record silently,
      // so anything unrecognised is shown at the start rather than nowhere.
      const key = m.has(d.stage) ? d.stage : LIFECYCLE_STAGES[0]
      m.get(key).push(d)
    }
    return m
  }, [rows])

  const move = async (doc, to) => {
    if (!can('route')) { store.notify(why('route'), 'error'); return }
    setBusy(doc.documentRef)
    await advanceStage(store, doc, to)
    setBusy(null)
  }

  // The stepper. Forward is the ordinary path; back withdraws a signature if
  // there is one, which lib/lifecycle handles and says so in the toast.
  const step = async (doc, direction) => {
    if (!can('route')) { store.notify(why('route'), 'error'); return }
    setBusy(doc.documentRef)
    await moveStage(store, doc, direction)
    setBusy(null)
  }

  const rooms = [...new Set(FILTER_VIEW.map((f) => f.cleanroomName))]
  const locked = documents.filter((d) => d.stage === 'Locked / Audit-Ready').length
  const signed = documents.filter((d) => d.approvalStatus === 'Approved').length
  const rejected = documents.filter((d) => d.approvalStatus === 'Rejected').length

  return (
    <div>
      <PageHeading
        title="Certification Lifecycle"
        subtitle="Every HEPA certification document from creation through review and electronic signature to a locked, audit-ready record. A stage only moves forward, and only the signed reach the last one."
        right={(
          <select value={room} onChange={(e) => setRoom(e.target.value)} style={styles.select}>
            <option value="all">All cleanrooms</option>
            {rooms.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
      />


      <StatCards items={[
        { label: 'Documents in workflow', value: documents.length, icon: 'list', note: `${rows.length} in view` },
        { label: 'Signed', value: signed, icon: 'tick', tone: 'green', note: 'with an electronic signature' },
        { label: 'Awaiting signature', value: documents.length - signed - rejected, icon: 'clock', tone: 'amber', note: 'before the review stage ends' },
        { label: 'Locked / audit-ready', value: locked, icon: 'asset', note: 'final and unmodifiable' },
        { label: 'Returned in review', value: rejected, icon: 'alert', tone: rejected ? 'red' : undefined, note: 'reason on the record' },
      ]} />

      {!store.ready && (
        <p style={{ fontSize: 11.5, color: MUTE, margin: '0 2px 10px' }}>Loading stored workflow state…</p>
      )}

      <div style={styles.board}>
        {LIFECYCLE_STAGES.map((stage, i) => {
          const items = byStage.get(stage) || []
          const c = COLUMN[stage]
          return (
            <div key={stage} style={{ ...styles.column, background: c.bg }}>
              <div style={styles.columnHead}>
                <span style={{ ...styles.dot, background: c.dot }} />
                <span style={styles.columnTitle}>{stage}</span>
                <span style={styles.count}>{items.length}</span>
              </div>
              <div style={styles.stageNote}>{STAGE_NOTE[stage]}</div>

              <div style={styles.stack}>
                {items.map((d) => {
                  const acts = actionsFor(d)
                  return (
                    <Card
                      key={d.documentRef}
                      style={{ ...styles.card, opacity: d._pending ? 0.6 : 1 }}
                    >
                      {/* Clicking the card opens its stepper rather than
                          navigating away — moving a record is what a person is
                          on this board to do, and losing the board to a record
                          page after every move is the wrong trade. The
                          reference itself still opens the record. */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setOpenCard(openCard === d.documentRef ? null : d.documentRef)}
                        onKeyDown={(e) => { if (e.key === 'Enter') setOpenCard(openCard === d.documentRef ? null : d.documentRef) }}
                        style={{ cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/portal/hepa/repository/${d.documentRef}`) }}
                            title="Open the record"
                            style={styles.refBtn}
                          >
                            <Id strong>{d.documentRef}</Id>
                          </button>
                          {d.approvalStatus === 'Rejected' && <Status>Rejected</Status>}
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8"
                            strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                            style={{ marginLeft: 'auto', flexShrink: 0, transform: openCard === d.documentRef ? 'rotate(180deg)' : 'none', transition: 'transform .16s' }}>
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>
                        <div style={{ fontSize: 12, color: INK, fontWeight: 600, marginBottom: 2 }}>
                          {roomOf(d.relatedRecordId)}
                        </div>
                        <div style={{ fontSize: 11, color: MUTE, marginBottom: 7 }}>
                          {d.recordType} · <Id>{d.relatedRecordId}</Id>
                        </div>

                        <div style={styles.meta}>
                          <span>{d.signedBy ? `Signed by ${d.signedBy}` : `Reviewer: ${d.reviewer}`}</span>
                          <span style={{ marginLeft: 'auto' }}><DueIn days={d.dueIn} /></span>
                        </div>

                        {/* Where the rules would send it, before anybody
                            presses anything. A board that only offers "route
                            for review" is manual triage with a button on it. */}
                        {d.stage === 'Created' && (() => {
                          const rule = matchRule(d)
                          return rule ? (
                            <div style={styles.willRoute}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0f766e"
                                strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <path d="M5 12h14M13 6l6 6-6 6" />
                              </svg>
                              <span style={{ minWidth: 0 }}>
                                <strong>{rule.to}</strong>
                                <span style={{ display: 'block', color: '#64748b' }}>rule: {rule.name}</span>
                              </span>
                            </div>
                          ) : null
                        })()}
                      </div>

                      {acts.length > 0 && (
                        <div style={styles.actions}>
                          {acts.map((a) => (a.signature ? (
                            <button
                              key={a.key}
                              onClick={() => router.push('/portal/hepa/approvals')}
                              style={{ ...styles.btn, ...styles.btnPrimary }}
                            >
                              Sign on Approvals
                            </button>
                          ) : (
                            <button
                              key={a.key}
                              disabled={busy === d.documentRef || !store.ready}
                              onClick={() => move(d, a.to)}
                              style={{ ...styles.btn, opacity: busy === d.documentRef || !store.ready ? 0.5 : 1 }}
                            >
                              {busy === d.documentRef ? 'Saving…' : a.label}
                            </button>
                          )))}
                        </div>
                      )}

                      {openCard === d.documentRef && (
                        <Stepper
                          doc={d}
                          busy={busy === d.documentRef || !store.ready}
                          onStep={(dir) => step(d, dir)}
                        />
                      )}
                    </Card>
                  )
                })}

                {!items.length && (
                  <div style={styles.empty}>
                    {i === 0 ? 'Nothing waiting to be routed.' : 'Nothing at this stage.'}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p style={{ fontSize: 11.5, color: SUB, margin: '14px 2px 0', paddingTop: 12, borderTop: `1px solid ${LINE}`, lineHeight: 1.6 }}>
        Moving a record writes an entry to the append-only audit trail with the
        actor, the stage it came from and the stage it went to. Locking is
        refused on anything unsigned. Certification due dates are shown on the
        anchored calendar <Derived /> — a record inside{' '}
        {THRESHOLDS.notificationLeadDays.value} days of its due date is the one to
        move first.
      </p>
    </div>
  )
}

/**
 * Move this record one stage either way.
 *
 * Forward is disabled where the workflow refuses it — nothing reaches the
 * locked stage unsigned, and the review stage ends with a signature rather than
 * a nudge, so the button says where to go instead of failing on press. A
 * control that looks available and then refuses is worse than one that explains
 * itself.
 */
function Stepper({ doc, busy, onStep }) {
  const i = stageIndex(doc.stage)
  const prev = LIFECYCLE_STAGES[i - 1] || null
  const next = LIFECYCLE_STAGES[i + 1] || null

  const needsSignature = doc.stage === 'Under Review' && doc.approvalStatus !== 'Approved'
  const lockUnsigned = next === 'Locked / Audit-Ready' && doc.approvalStatus !== 'Approved'
  const forwardBlocked = !next || needsSignature || lockUnsigned
  const withdrawing = doc.approvalStatus === 'Approved' && prev

  return (
    <div style={styles.stepper}>
      <div style={styles.stepperRow}>
        <button
          disabled={!prev || busy}
          onClick={() => onStep('back')}
          title={prev ? `Move back to ${prev}` : 'Already at the first stage'}
          style={{ ...styles.stepBtn, opacity: !prev || busy ? 0.35 : 1 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <span style={styles.stepperNow}>
          <span style={styles.stepperCount}>{i + 1} of {LIFECYCLE_STAGES.length}</span>
          <span style={styles.stepperStage}>{doc.stage}</span>
        </span>

        <button
          disabled={forwardBlocked || busy}
          onClick={() => onStep('next')}
          title={next ? `Move on to ${next}` : 'Already at the last stage'}
          style={{ ...styles.stepBtn, ...(forwardBlocked ? null : styles.stepBtnOn), opacity: forwardBlocked || busy ? 0.35 : 1 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      <div style={styles.stepperNote}>
        {busy ? 'Saving…'
          : needsSignature ? 'Review ends with a signature — use Sign on Approvals.'
            : lockUnsigned ? 'Cannot lock an unsigned record.'
              : withdrawing ? 'Moving back withdraws the signature.'
                : next ? `Next: ${next}.`
                  : 'Final stage. This is what the audit package claims.'}
      </div>
    </div>
  )
}

const STAGE_NOTE = {
  'Created': 'Raised against a test or a replacement.',
  'Routed for Review': 'With the quality reviewer, not yet opened.',
  'Under Review': 'Being checked. Signature or rejection ends this stage.',
  'Approved - Signed': 'Signed with an identity, a meaning and a timestamp.',
  'Locked / Audit-Ready': 'Unmodifiable. This is what the audit package claims.',
}

const styles = {
  board: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(232px,1fr))',
    gap: 12, alignItems: 'start',
  },
  column: {
    borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 12, padding: 11, minWidth: 0,
  },
  columnHead: { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  columnTitle: { fontSize: 11.5, fontWeight: 700, color: INK, letterSpacing: 0.1, minWidth: 0 },
  count: {
    marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: SUB,
    background: '#fff', borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 999, padding: '1px 7px',
  },
  stageNote: { fontSize: 10.5, color: MUTE, lineHeight: 1.45, marginBottom: 10 },
  stack: { display: 'flex', flexDirection: 'column', gap: 9 },
  card: { padding: 11, marginBottom: 0 },
  meta: {
    display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: MUTE,
    paddingTop: 7, borderTop: `1px solid ${LINE}`,
  },
  actions: { display: 'flex', gap: 6, marginTop: 9 },
  willRoute: {
    display: 'flex', alignItems: 'center', gap: 6, marginTop: 7,
    padding: '5px 8px', borderRadius: 7, background: '#f0fdfa',
    fontSize: 9.5, color: '#0f766e', lineHeight: 1.35,
    borderStyle: 'solid', borderWidth: 1, borderColor: '#99f6e4',
  },
  refBtn: {
    padding: 0, border: 'none', background: 'none', cursor: 'pointer',
    fontFamily: 'inherit', textAlign: 'left', minWidth: 0,
  },
  stepper: { marginTop: 9, paddingTop: 9, borderTop: `1px solid ${LINE}` },
  stepperRow: { display: 'flex', alignItems: 'center', gap: 7 },
  stepBtn: {
    width: 26, height: 26, flexShrink: 0, display: 'grid', placeItems: 'center',
    borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 7, background: '#fff',
    color: ACCENT, cursor: 'pointer', padding: 0,
  },
  stepBtnOn: { background: ACCENT, color: '#fff', borderColor: ACCENT },
  stepperNow: { flex: 1, minWidth: 0, textAlign: 'center' },
  stepperCount: {
    display: 'block', fontSize: 9, fontWeight: 700, color: MUTE,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  stepperStage: {
    display: 'block', fontSize: 10.5, fontWeight: 700, color: INK,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  stepperNote: { marginTop: 6, fontSize: 9.5, color: MUTE, lineHeight: 1.4, textAlign: 'center' },
  btn: {
    flex: 1, padding: '6px 9px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 7, background: '#fff', color: ACCENT, cursor: 'pointer',
  },
  btnPrimary: { background: ACCENT, color: '#fff', borderColor: ACCENT },
  empty: {
    padding: '18px 8px', textAlign: 'center', fontSize: 11, color: MUTE,
    border: `1px dashed ${LINE}`, borderRadius: 9, background: '#fff',
  },
  select: {
    padding: '8px 11px', fontSize: 12.5, fontFamily: 'inherit', borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`,
    borderRadius: 9, background: '#fff', color: INK, cursor: 'pointer', outline: 'none',
  },
}
