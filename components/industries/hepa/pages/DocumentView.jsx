'use client'

// One certification document, in full.
//
// This is where the three focus areas meet on a single page: the document
// itself (storage), its position in the workflow and its signature (lifecycle),
// and the SAP work order it corresponds to (integration). If a client only
// looks at one screen in this portal, it should be this one.
//
// The lifecycle actions are here as well as on the board, because the person
// who opens a record to read it is usually the person who then has to act on
// it, and sending them to a different screen to press the button is friction
// invented by the software.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Card, Section, Fields, DataTable, PALETTE,
} from '../lib/kit'
import { filterById, THRESHOLDS, fmtDate, daysFromToday } from '../lib/data'
import { useStore } from '../lib/store'
import {
  useDocuments, useAuditTrail, actionsFor, advanceStage, LIFECYCLE_STAGES, stageIndex,
} from '../lib/lifecycle'
import { DateCell, DueIn, Status, Id, Penetration, Derived } from '../lib/ui'
import { useRole } from '../lib/roles'
import FailureChain from '../components/FailureChain'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

export default function DocumentView({ id }) {
  const router = useRouter()
  const store = useStore()
  const documents = useDocuments()
  const doc = documents.find((d) => d.documentRef === id)
  const trail = useAuditTrail(id)
  const { can, why } = useRole()
  const [busy, setBusy] = useState(false)
  // What the last move on this page changed, so the page can say so rather
  // than silently redrawing one stage further along. Cleared when the record
  // is navigated away from, because it is about this action, not this record.
  const [lastMove, setLastMove] = useState(null)

  if (!doc) {
    return (
      <Card style={{ maxWidth: 560 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: INK }}>No document with that reference</h1>
        <p style={{ margin: '8px 0 16px', fontSize: 13.5, color: SUB, lineHeight: 1.6 }}>
          <Id>{id}</Id> is not in the certification repository.
        </p>
        <button onClick={() => router.push('/portal/hepa/repository')} style={{ ...styles.link, padding: '8px 14px' }}>
          Back to the repository
        </button>
      </Card>
    )
  }

  const f = filterById(doc.relatedRecordId)
  const acts = actionsFor(doc)
  const here = stageIndex(doc.stage)
  const nextStage = LIFECYCLE_STAGES[here + 1] || null
  const retentionIn = daysFromToday(doc.retentionExpiryOn)

  const move = async (to) => {
    if (!can('route')) { store.notify(why('route'), 'error'); return }
    const from = doc.stage
    setBusy(true)
    const saved = await advanceStage(store, doc, to)
    setBusy(false)
    if (saved) setLastMove({ from, to, at: new Date().toISOString() })
  }

  return (
    <div>
      <PageHeading
        back={{ label: 'Repository', onClick: () => router.push('/portal/hepa/repository') }}
        title={`${doc.documentRef} — ${f?.cleanroomName || doc.relatedRecordId}`}
        subtitle={`${doc.recordType} for filter ${doc.relatedRecordId}${f ? ` · ${f.isoClass}` : ''} · reviewer ${doc.reviewer}`}
        right={(
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Status>{doc.stage}</Status>
            <Status>{doc.approvalStatus}</Status>
          </div>
        )}
      />


      <StatCards items={[
        { label: 'Lifecycle stage', value: `${here + 1} of ${LIFECYCLE_STAGES.length}`, icon: 'list', note: doc.stage },
        { label: 'Signature', value: doc.signedBy ? 'Signed' : 'Unsigned', icon: doc.signedBy ? 'tick' : 'clock', tone: doc.signedBy ? 'green' : 'amber', note: doc.signedBy || 'awaiting a reviewer' },
        { label: 'Certification due', value: doc.dueIn == null ? '—' : doc.dueIn < 0 ? `${Math.abs(doc.dueIn)}d ago` : `${doc.dueIn}d`, icon: 'alert', tone: doc.dueIn == null ? undefined : doc.dueIn < 0 ? 'red' : doc.dueIn <= THRESHOLDS.notificationLeadDays.value ? 'amber' : 'green', note: fmtDate(doc.nextCertDueOn) },
        { label: 'Retention', value: retentionIn == null ? '—' : `${Math.round(retentionIn / 365)}y`, icon: 'asset', note: `expires ${fmtDate(doc.retentionExpiryOn)}` },
        { label: 'Audit entries', value: (doc.auditEntries || 0) + trail.length, icon: 'chart', note: trail.length ? `${trail.length} added here` : 'on the workbook record' },
      ]} />

      {/* The lifecycle, as a headline rather than a row of boxes.

          The boxes were five equal cards and the eye had to read all five to
          find out which one it was on. A record has one current stage and one
          next one, and those are the two facts — so they lead, at a size you
          can read from across a desk, and the five-step track sits under them
          as context.

          The glass panel is a tint over the accent rather than a flat fill:
          the stage tone shows through it, so a locked record and one still in
          review do not look alike before a word has been read. */}
      <div style={styles.glassWrap}>
        <style>{`
          @keyframes hepaGlassIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
          .hepa-glass-step { transition: background .2s ease, border-color .2s ease; }
        `}</style>

        <span style={{ ...styles.glassOrb, background: TONE[doc.stage]?.glow || 'rgba(21,34,122,0.20)' }} />
        <span style={{ ...styles.glassOrbB, background: TONE[doc.stage]?.glow || 'rgba(21,34,122,0.14)' }} />

        <div style={styles.glassInner}>
          <div style={styles.glassHead}>
            <div style={{ minWidth: 0 }}>
              <div style={styles.glassEyebrow}>
                Stage {here + 1} of {LIFECYCLE_STAGES.length}
              </div>
              <h2 style={styles.glassTitle}>{doc.stage}</h2>
              <p style={styles.glassSub}>{STAGE_MEANS[doc.stage]}</p>
            </div>

            <div style={styles.glassNext}>
              <div style={styles.glassNextLabel}>{nextStage ? 'Next' : 'Final stage'}</div>
              <div style={styles.glassNextValue}>{nextStage || 'Audit-ready'}</div>
              {acts.length > 0 && (
                <div style={styles.glassActions}>
                  {acts.map((a) => (a.signature ? (
                    <button
                      key={a.key}
                      onClick={() => router.push('/portal/hepa/approvals')}
                      title="Sign on Approvals"
                      style={{ ...styles.arrowBtn, ...styles.arrowBtnPrimary }}
                    >
                      <span style={styles.arrowLabel}>Sign</span>
                      <Chevron />
                    </button>
                  ) : (
                    <button
                      key={a.key}
                      disabled={busy || !store.ready || !can('route')}
                      onClick={() => move(a.to)}
                      title={can('route') ? a.label : why('route')}
                      style={{
                        ...styles.arrowBtn,
                        ...styles.arrowBtnPrimary,
                        opacity: busy || !store.ready || !can('route') ? 0.5 : 1,
                      }}
                    >
                      <span style={styles.arrowLabel}>{busy ? 'Saving' : a.label.replace(/^Route for /, 'Route to ').replace(/^Open /, 'Open ')}</span>
                      <Chevron spinning={busy} />
                    </button>
                  )))}
                </div>
              )}
            </div>
          </div>

          {/* The five steps, as a track. Chevrons between them rather than
              gaps, so the direction is in the shape. */}
          <div style={styles.stepsRow}>
            {LIFECYCLE_STAGES.map((stage, i) => (
              <div key={stage} style={styles.stepCell}>
                <div
                  className="hepa-glass-step"
                  style={{
                    ...styles.step,
                    ...(i < here ? styles.stepPast : i === here ? styles.stepNow : styles.stepAhead),
                  }}
                >
                  <span style={{ ...styles.stepDot, ...(i < here ? styles.dotDone : i === here ? styles.dotHere : styles.dotAhead) }}>
                    {i < here ? <Tick /> : i + 1}
                  </span>
                  {/* Colour set per state rather than inherited. Inherited, the
                      label took the page's default near-black, which is legible
                      on the white pill the current stage wears and almost
                      invisible on the four translucent ones over navy. */}
                  <span style={{
                    ...styles.stepLabel,
                    color: i === here ? INK : i < here ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.74)',
                    fontWeight: i === here ? 700 : 600,
                  }}>{stage}</span>
                </div>
                {i < LIFECYCLE_STAGES.length - 1 && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke={i < here ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.34)'}
                    strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={styles.stepArrow}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </div>
            ))}
          </div>

          <div style={styles.glassFoot}>
            Every move writes an audit entry naming who made it and where it came
            from. Locking is refused on an unsigned record.
          </div>
        </div>
      </div>

      {/* What the last move changed. Shown under the track rather than as a
          toast, because a toast is gone in three seconds and the question it
          answers — "did that do anything, and what" — outlives it. */}
      {lastMove && (
        <Card style={{ marginBottom: 14, borderColor: '#bbf7d0', background: '#f6fdf9' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <span style={styles.movedTick}>
              <Tick size={13} colour="#fff" />
            </span>
            <div style={{ minWidth: 0, flex: '1 1 300px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#065f46', marginBottom: 7 }}>
                Moved on — this record is now at {lastMove.to}
              </div>

              <div style={styles.movedRow}>
                <span style={styles.movedFrom}>{lastMove.from}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"
                  strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
                <span style={styles.movedTo}>{lastMove.to}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '9px 18px', marginTop: 12 }}>
                <Changed label="Stage" before={lastMove.from} after={lastMove.to} />
                <Changed label="Routed to" before={doc.routedToRole} after={doc.routedToRole} same />
                <Changed
                  label="Audit trail"
                  before={plural(trail.length - 1, 'entry', 'entries')}
                  after={plural(trail.length, 'entry', 'entries')}
                />
                <Changed
                  label="Can lock?"
                  before={lastMove.to === 'Approved - Signed' ? 'no — unsigned' : 'not yet'}
                  after={doc.approvalStatus === 'Approved' ? 'yes — signed' : 'not until signed'}
                />
              </div>

              <p style={{ margin: '11px 0 0', fontSize: 11.5, color: '#047857', lineHeight: 1.55 }}>
                Written at {String(lastMove.at).replace('T', ' ').slice(0, 19)}. It is
                on the audit trail below and in any package exported from now on.
              </p>
            </div>
            <button onClick={() => setLastMove(null)} style={styles.movedClose}>Dismiss</button>
          </div>
        </Card>
      )}

      {doc.approvalStatus === 'Rejected' && doc.rejectionReason && (
        <Card style={{ marginBottom: 14, borderColor: '#fecaca', background: '#fef7f7' }}>
          <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>
            <strong style={{ color: '#7f1d1d' }}>Returned by {doc.rejectedBy}:</strong>{' '}
            &ldquo;{doc.rejectionReason}&rdquo;
          </p>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(330px,1fr))', gap: 14, marginBottom: 14 }}>
        <Section title="The document" style={{ marginBottom: 0 }}>
          <Fields columns={2} rows={[
            ['Reference', <Id key="a" strong>{doc.documentRef}</Id>],
            ['Documents', doc.recordType],
            ['Related record', <Id key="b">{doc.relatedRecordId}</Id>],
            ['Routed to', doc.routedToRole],
            ['Reviewer', doc.reviewer],
            ['Approval', <Status key="c">{doc.approvalStatus}</Status>],
            ['Next certification', <span key="d"><DateCell shifted={doc.nextCertDueOn} original={doc.nextCertDue} /></span>],
            ['Lead', <DueIn key="e" days={doc.dueIn} />],
            ['Retention expiry', <DateCell key="f" shifted={doc.retentionExpiryOn} original={doc.retentionExpiry} />],
            ['Notification', <span key="g"><Status>{doc.notification}</Status>{doc.notificationDerived ? <Derived /> : null}</span>],
          ]} />
          <p style={styles.note}>
            The workbook&apos;s own notification status for this record read
            &ldquo;{doc.notificationStatus}&rdquo;, computed on the day the file was
            written. The status above is recomputed on the anchored calendar.
          </p>
        </Section>

        <Section title="Electronic signature" style={{ marginBottom: 0 }}>
          {doc.signedBy ? (
            <>
              <Fields columns={1} rows={[
                ['Signed by — identity', <span key="a"><strong style={{ color: INK }}>{doc.signedBy}</strong>{doc.signatureRole ? ` — ${doc.signatureRole}` : ''}</span>],
                ['Meaning of signature', doc.signatureMeaning
                  || <span style={{ color: MUTE }}>Recorded in the workbook without a stated meaning.</span>],
                ['Timestamp', doc.signatureMeaning
                  ? <span key="b" style={{ fontVariantNumeric: 'tabular-nums' }}>{String(doc.signedAt).replace('T', ' ').slice(0, 19)} — written by the system</span>
                  : <DateCell key="c" shifted={doc.signedOn} original={String(doc.signedAt || '').slice(0, 10)} />],
              ]} />
              <p style={styles.note}>
                Identity, meaning and timestamp — the three parts 21 CFR Part 11
                requires. The timestamp is written by the system rather than
                offered to the signer.
              </p>
            </>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.65 }}>
                No signature against this record yet. It cannot reach the locked,
                audit-ready stage until one is applied, and it goes into an audit
                package marked unsigned rather than being quietly left out.
              </p>
              <button onClick={() => router.push('/portal/hepa/approvals')} style={{ ...styles.btn, ...styles.btnPrimary, marginTop: 13 }}>
                Review and sign
              </button>
            </>
          )}
        </Section>
      </div>

      {/* Above the evidence, because the chain is what a reader wants after
          seeing the result and before reading the audit trail. */}
      {f && <FailureChain filter={f} />}

      {f && (
        <Section
          title="Evidence — the filter and its most recent test"
          right={(
            <button onClick={() => router.push(`/portal/hepa/filters/${f.filterId}`)} style={styles.link}>
              Open the filter
            </button>
          )}
        >
          <Fields columns={4} rows={[
            ['Filter', <Id key="a" strong>{f.filterId}</Id>],
            ['Cleanroom', `${f.cleanroomName} (${f.cleanroomId})`],
            ['ISO class', f.isoClass],
            ['Status', <Status key="b">{f.status}</Status>],
            ['Last test', f.lastTest ? <Id key="c">{f.lastTest.testId}</Id> : '—'],
            ['Tested', f.lastTest ? <DateCell key="d" shifted={f.lastTest.date} original={f.lastTest.testDate} /> : '—'],
            ['Penetration', f.lastTest ? <Penetration key="e" value={f.lastTest.penetration} /> : '—'],
            ['Result', f.lastTest ? <Status key="f">{f.lastTest.result}</Status> : '—'],
            ['Tests on file', f.testCount],
            ['Failed', f.failCount || '—'],
            ['Leak breaches', f.breachCount || '—'],
            ['SAP work order', f.sap ? <Id key="g">{f.sap.sapWorkOrder}</Id> : '—'],
          ]} />
        </Section>
      )}

      <Section title={`Audit trail (${trail.length})`}>
        {trail.length ? (
          <DataTable
            columns={[
              { key: 'at', label: 'When', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11.5 }}>{String(r.at).replace('T', ' ').slice(0, 19)}</span> },
              { key: 'action', label: 'Action', render: (r) => <strong style={{ color: INK }}>{r.action}</strong> },
              { key: 'actor', label: 'Actor', render: (r) => <span>{r.actor}<span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{r.actorRole}</span></span> },
              { key: 'from', label: 'From', render: (r) => r.from || '—' },
              { key: 'to', label: 'To', render: (r) => r.to || '—' },
              { key: 'meaning', label: 'Meaning / reason', render: (r) => <span style={{ fontSize: 11.5, color: SUB }}>{r.meaning || '—'}</span> },
            ]}
            rows={trail.map((r) => ({ ...r, id: r.recordId }))}
            pageSize={10}
          />
        ) : (
          <p style={{ margin: 0, fontSize: 12.5, color: MUTE, lineHeight: 1.6 }}>
            The workbook records {doc.auditEntries} audit entries against this
            document without their detail. Anything done here — routing, signing,
            a legal hold — appends a full entry to this list and to the exported
            audit package.
          </p>
        )}
        <p style={styles.note}>
          Append-only. No entry on this list can be edited or removed, which is
          what the locked stage rests on.
        </p>
      </Section>
    </div>
  )
}

// "1 entries" is the tell that a number was pasted into a sentence rather than
// written into one, and this panel is read closely — it is the thing a person
// checks when they want to know whether the button did anything.
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

function Chevron({ spinning }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
      strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: spinning ? 0.5 : 1 }}>
      <path d="M5 12h13M12 5l7 7-7 7" />
    </svg>
  )
}

function Tick({ size = 11, colour = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth="3.6"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

// One field, before and after. `same` marks the ones the move did not touch,
// which are worth showing precisely because a person checking what changed
// wants to see what did not.
function Changed({ label, before, after, same }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 }}>
        {label}
      </div>
      {same ? (
        <div style={{ fontSize: 11.5, color: '#047857' }}>{after} <span style={{ color: '#6ee7b7' }}>· unchanged</span></div>
      ) : (
        <div style={{ fontSize: 11.5, color: '#065f46', lineHeight: 1.4 }}>
          <span style={{ textDecoration: 'line-through', opacity: 0.55 }}>{before}</span>
          {' → '}
          <strong>{after}</strong>
        </div>
      )}
    </div>
  )
}

// What each stage actually means, and the light the panel takes at it.
const STAGE_MEANS = {
  'Created': 'Raised against a test or a replacement. Nobody has been asked to look at it yet.',
  'Routed for Review': 'With the reviewer the routing rules chose. Not yet opened.',
  'Under Review': 'Being checked. This stage ends with a signature or a rejection, not a nudge.',
  'Approved - Signed': 'Signed with an identity, a stated meaning and a system timestamp.',
  'Locked / Audit-Ready': 'Unmodifiable. This is what the audit package claims about it.',
}

const TONE = {
  'Created': { glow: 'rgba(148,163,184,0.55)' },
  'Routed for Review': { glow: 'rgba(37,99,235,0.55)' },
  'Under Review': { glow: 'rgba(217,119,6,0.55)' },
  'Approved - Signed': { glow: 'rgba(22,163,74,0.55)' },
  'Locked / Audit-Ready': { glow: 'rgba(21,34,122,0.6)' },
}

const styles = {
  // ── the glass panel ────────────────────────────────────────────────────
  glassWrap: {
    position: 'relative', overflow: 'hidden', borderRadius: 16, marginBottom: 14,
    background: 'linear-gradient(135deg,#141c4f 0%,#1c2a6b 52%,#15227a 100%)',
    borderStyle: 'solid', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    boxShadow: '0 14px 40px rgba(15,23,42,0.22)',
    animation: 'hepaGlassIn .28s ease',
  },
  // Two blurred orbs behind the frosted layer. This is what makes it glass
  // rather than a gradient: the panel has something to be in front of.
  glassOrb: {
    position: 'absolute', top: -70, right: -30, width: 240, height: 240,
    borderRadius: '50%', filter: 'blur(58px)', pointerEvents: 'none',
  },
  glassOrbB: {
    position: 'absolute', bottom: -110, left: '32%', width: 260, height: 200,
    borderRadius: '50%', filter: 'blur(64px)', pointerEvents: 'none', opacity: 0.75,
  },
  glassInner: {
    position: 'relative', padding: '20px 22px 18px',
    background: 'rgba(255,255,255,0.06)',
    backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
  },
  glassHead: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: 20, flexWrap: 'wrap', marginBottom: 20,
  },
  glassEyebrow: {
    fontSize: 10, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)', marginBottom: 6,
  },
  glassTitle: {
    margin: 0, fontSize: 26, fontWeight: 800, color: '#fff',
    letterSpacing: '-0.02em', lineHeight: 1.12,
  },
  glassSub: {
    margin: '7px 0 0', fontSize: 12.5, color: 'rgba(255,255,255,0.72)',
    lineHeight: 1.55, maxWidth: 460,
  },
  glassNext: { minWidth: 190, flexShrink: 0, textAlign: 'right' },
  glassNextLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)', marginBottom: 4,
  },
  glassNextValue: {
    fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.94)', lineHeight: 1.3,
  },
  glassActions: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 11, flexWrap: 'wrap' },
  arrowBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', borderRadius: 10,
    cursor: 'pointer', whiteSpace: 'nowrap',
    borderStyle: 'solid', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    background: 'rgba(255,255,255,0.14)', color: '#fff',
    backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
  },
  arrowBtnPrimary: { background: 'rgba(255,255,255,0.94)', color: '#15227a', borderColor: 'transparent' },
  arrowLabel: { minWidth: 0 },

  stepsRow: { display: 'flex', alignItems: 'stretch', flexWrap: 'wrap', gap: 2 },
  stepCell: { display: 'flex', alignItems: 'center', gap: 2, flex: '1 1 132px', minWidth: 0 },
  step: {
    flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8,
    padding: '9px 11px', borderRadius: 10,
    borderStyle: 'solid', borderWidth: 1, borderColor: 'transparent',
  },
  stepPast: { background: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.22)' },
  stepNow: { background: 'rgba(255,255,255,0.96)', borderColor: 'transparent' },
  stepAhead: { background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.16)' },
  stepDot: {
    width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
    fontSize: 10, fontWeight: 800,
  },
  dotDone: { background: 'rgba(255,255,255,0.9)', color: '#15227a' },
  dotHere: { background: '#15227a', color: '#fff' },
  dotAhead: { background: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.88)' },
  stepLabel: { fontSize: 11, lineHeight: 1.28, minWidth: 0 },
  stepArrow: { flexShrink: 0 },
  glassFoot: {
    marginTop: 16, paddingTop: 13, fontSize: 11, lineHeight: 1.55,
    color: 'rgba(255,255,255,0.72)',
    borderTopStyle: 'solid', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)',
  },

  // ── what the last move changed ─────────────────────────────────────────
  movedTick: {
    width: 26, height: 26, borderRadius: '50%', background: '#16a34a', flexShrink: 0,
    display: 'grid', placeItems: 'center', marginTop: 1,
  },
  movedRow: { display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
  movedFrom: {
    fontSize: 11.5, fontWeight: 600, color: '#047857', background: '#fff',
    borderRadius: 7, padding: '4px 10px', textDecoration: 'line-through', opacity: 0.7,
    borderStyle: 'solid', borderWidth: 1, borderColor: '#bbf7d0',
  },
  movedTo: {
    fontSize: 11.5, fontWeight: 800, color: '#fff', background: '#16a34a',
    borderRadius: 7, padding: '4px 10px',
  },
  movedClose: {
    padding: '5px 11px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
    borderRadius: 7, background: '#fff', color: '#047857', cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#bbf7d0',
    alignSelf: 'flex-start',
  },

  track: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  step: {
    flex: '1 1 130px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 8,
    padding: '9px 11px', borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 9, background: '#fcfdfe',
  },
  stepDone: { background: '#f6f7fd', borderColor: '#c7d2fe' },
  stepDot: {
    width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
    fontSize: 10.5, fontWeight: 700, background: '#f1f5f9', color: MUTE,
  },
  dotDone: { background: '#16a34a', color: '#fff' },
  dotHere: { background: ACCENT, color: '#fff' },
  stepLabel: { fontSize: 11.5, lineHeight: 1.3, minWidth: 0 },
  actions: {
    display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 14, paddingTop: 13,
    borderTop: `1px solid ${LINE}`,
  },
  btn: {
    padding: '8px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 8, background: '#fff', color: ACCENT, cursor: 'pointer',
  },
  btnPrimary: { background: ACCENT, color: '#fff', borderColor: ACCENT },
  rejected: {
    marginTop: 13, padding: '10px 13px', borderStyle: 'solid', borderWidth: 1, borderColor: '#fecaca', background: '#fef2f2',
    borderRadius: 9, fontSize: 12, color: SUB, lineHeight: 1.6,
  },
  note: {
    margin: '13px 0 0', paddingTop: 11, borderTop: `1px solid ${LINE}`,
    fontSize: 11.5, color: MUTE, lineHeight: 1.55,
  },
  link: {
    padding: '5px 11px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 7, background: '#fff', color: ACCENT, cursor: 'pointer',
  },
}
