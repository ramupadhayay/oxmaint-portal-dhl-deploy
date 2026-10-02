'use client'

// Synapse AI — the assistant, answering from the compliance records themselves.
//
// The live product drives this through an n8n webhook on a host that only
// exists inside their infrastructure, so lifting it verbatim would put a
// permanently failing fetch in the console and a chat window that never
// replies. The interesting half was never the transport.
//
// So it answers locally, off the same arrays the screens are rendering. That
// makes the answers genuinely true — ask how many certifications are overdue
// and the number is the number on the Overview, because it is the same filter
// over the same records — and it keeps working in a room with no internet,
// which is where these get shown.
//
// Two rules from the rest of the portal hold here as well. A workbook figure is
// quoted as the workbook's, and anything worked out against today says so. An
// assistant that rounds off the provenance is the one that gets a number
// questioned in the room.

import { useMemo, useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { OxmaintMark } from './Logo'
import {
  FILTER_VIEW, TEST_RECORDS, LEAK_RECORDS, REPLACEMENT_RECORDS, SAP_RECORDS,
  CLEANROOMS, HEADLINE, THRESHOLDS, ORG, fmtDate, pct,
} from '../lib/data'
import { useDocuments } from '../lib/lifecycle'

const ACCENT = '#15227a'

// The questions a site quality lead asks, which are not a maintenance
// planner's. "What is overdue" means a certification here, not a work order,
// and "what is blocked" means a room that cannot be released.
const SUGGESTIONS = [
  'What needs attention?',
  'What is overdue?',
  'Which filters failed?',
  'Anything blocked?',
  'How is audit readiness?',
  'Any SAP errors?',
]

// Intent matching by keyword. Not a language model and it does not pretend to
// be one — it recognises the questions this role actually asks and answers
// those exactly, rather than answering everything approximately.
function answer(question, d) {
  const q = question.toLowerCase()
  const has = (...words) => words.some((w) => q.includes(w))

  // A named filter, test or document beats every topic below it: someone who
  // types HF-2004 wants that filter, not a summary that happens to mention it.
  const ref = q.match(/\b(hf-\d+|dt-\d+|lr-\d+|rp-\d+|doc-hf-\d+)\b/i)
  if (ref) {
    const key = ref[0].toUpperCase()
    const f = d.filters.find((x) => x.filterId === key)
    if (f) {
      return {
        text: `${f.filterId} is in ${f.cleanroomName} (${f.isoClass}), installed ${fmtDate(f.installedOn)} and tested ${String(f.testInterval).toLowerCase()}.\n\n`
          + `${f.testCount} integrity tests on file${f.failCount ? `, ${f.failCount} of them failed` : ', all passed'}. `
          + `Last penetration ${f.lastTest ? f.lastTest.penetration : '—'} against a maximum of ${THRESHOLDS.penetration.value}. `
          + `${f.breachCount ? `${f.breachCount} pressure readings in breach.` : 'No pressure readings in breach.'}\n\n`
          + (f.concern ? `Current concern: ${f.concern}.` : 'No open concern.')
          + (f.dueIn != null ? ` Certification ${f.dueIn < 0 ? `was due ${Math.abs(f.dueIn)} days ago` : `is due in ${f.dueIn} days`}.` : ''),
        go: `filters/${f.filterId}`,
        label: 'Open the filter',
      }
    }
    const t = d.tests.find((x) => x.testId === key)
    if (t) {
      return {
        text: `${t.testId} was a DOP/PAO scan of ${t.filterId} on ${fmtDate(t.date)} across ${t.testPoints} points.\n\n`
          + `Penetration ${t.penetration} against a maximum of ${THRESHOLDS.penetration.value} — ${t.result}. `
          + `Taken by ${t.technicianName}. The record is ${t.lockStatus.toLowerCase()}.`,
        go: `tests/${t.testId}`,
        label: 'Open the test',
      }
    }
    const doc = d.docs.find((x) => x.documentRef === key)
    if (doc) {
      return {
        text: `${doc.documentRef} documents ${doc.recordType.toLowerCase()} for ${doc.relatedRecordId}.\n\n`
          + `It is at ${doc.stage}, ${doc.signedBy ? `signed by ${doc.signedBy}` : 'unsigned'}, reviewer ${doc.reviewer}. `
          + `Certification ${doc.dueIn == null ? 'date not set' : doc.dueIn < 0 ? `was due ${Math.abs(doc.dueIn)} days ago` : `is due in ${doc.dueIn} days`}.`,
        go: `repository/${doc.documentRef}`,
        label: 'Open the record',
      }
    }
    return { text: `I have nothing on file under ${key}. Filter ids look like HF-2001, tests like DT-3001 and documents like DOC-HF-2001.` }
  }

  if (has('overdue', 'late', 'past due', 'escalat')) {
    const late = d.docs.filter((x) => x.notification === 'Overdue - Escalate')
      .sort((a, b) => (a.dueIn ?? 0) - (b.dueIn ?? 0))
    return {
      text: late.length
        ? `${late.length} certifications are past their due date and escalate to the site quality manager.\n\n`
          + `The furthest gone is ${late[0].documentRef} on ${d.roomOf(late[0].relatedRecordId)} — filter ${late[0].relatedRecordId}, due ${Math.abs(late[0].dueIn)} days ago and still at ${late[0].stage}.`
        : 'Nothing is past its certification date.',
      go: 'notifications',
      label: 'Open notifications',
    }
  }

  if (has('due soon', 'coming up', 'upcoming', 'next due', 'this week')) {
    const soon = d.docs.filter((x) => x.notification === 'Due soon - Notify')
      .sort((a, b) => (a.dueIn ?? 0) - (b.dueIn ?? 0))
    return {
      text: soon.length
        ? `${soon.length} certification${soon.length === 1 ? ' is' : 's are'} inside the ${THRESHOLDS.notificationLeadDays.value}-day lead time.\n\n`
          + soon.slice(0, 3).map((x) => `${x.documentRef} — filter ${x.relatedRecordId} in ${d.roomOf(x.relatedRecordId)}, due in ${x.dueIn} days.`).join('\n')
        : `Nothing falls inside the ${THRESHOLDS.notificationLeadDays.value}-day lead time. ${d.docs.filter((x) => x.notification === 'Scheduled').length} certifications are scheduled further out.`,
      go: 'notifications',
      label: 'Open notifications',
    }
  }

  if (has('fail', 'failed', 'integrity', 'penetration', 'dop', 'pao')) {
    const fails = d.tests.filter((t) => t.result === 'Fail')
    const worst = [...fails].sort((a, b) => b.penetration - a.penetration)[0]
    return {
      text: `${fails.length} of ${d.tests.length} integrity tests failed — a pass rate of ${pct(HEADLINE.passRate)}, which is the figure on the workbook's own dashboard.\n\n`
        + (worst ? `The highest reading is ${worst.testId} on ${worst.filterId} at ${worst.penetration}, against a maximum of ${THRESHOLDS.penetration.value}. Taken by ${worst.technicianName} on ${fmtDate(worst.date)}.` : ''),
      go: 'tests',
      label: 'Open the test register',
    }
  }

  if (has('leak', 'pressure', 'differential', 'breach')) {
    const breaches = d.leaks.filter((l) => l.breach === 'Breach')
    const byFilter = new Map()
    for (const l of breaches) byFilter.set(l.filterId, (byFilter.get(l.filterId) || 0) + 1)
    const top = [...byFilter.entries()].sort((a, b) => b[1] - a[1])[0]
    return {
      text: `${breaches.length} of ${d.leaks.length} pressure differential readings are over ${THRESHOLDS.pressureDifferential.value} in. wg, across ${byFilter.size} filters.\n\n`
        + (top ? `${top[0]} in ${d.roomOf(top[0])} accounts for ${top[1]} of them. A breach says the filter is loading, not that the barrier has failed — check its integrity test before condemning it.` : ''),
      go: 'leaks',
      label: 'Open leak detection',
    }
  }

  if (has('blocked', 'replacement', 'replaced', 'serial', 'supplier', 'custody')) {
    const blocked = REPLACEMENT_RECORDS.filter((r) => r.blocked)
    const recertified = REPLACEMENT_RECORDS.filter((r) => r.recertified)
    return {
      text: blocked.length
        ? `${blocked.length} replacement${blocked.length === 1 ? ' is' : 's are'} blocked.\n\n`
          + blocked.map((r) => `${r.replacementId} — filter ${r.filterId} in ${d.roomOf(r.filterId)}. New filter ${r.newSerial} from ${r.supplier} is installed, but ${r.awaitingPostTest ? 'no post-installation integrity test is on file for it' : `post-installation test ${r.postValidationTestId} did not pass`}, so the room is not released.`).join('\n\n')
          + `\n\n${recertified.length} of ${REPLACEMENT_RECORDS.length} replacements are fully re-certified.`
        : `Nothing is blocked. All ${REPLACEMENT_RECORDS.length} replacements on file are re-certified.`,
      go: 'replacements',
      label: 'Open replacements',
    }
  }

  if (has('sap', 'sync', 'integration', 'work order', 'equipment')) {
    const errors = SAP_RECORDS.filter((s) => String(s.syncStatus).startsWith('Error'))
    const pending = SAP_RECORDS.filter((s) => s.syncStatus === 'Pending')
    return {
      text: `${SAP_RECORDS.length} filters are mapped to SAP equipment ids and functional locations, so nothing is entered twice.\n\n`
        + `${errors.length} mappings failed at the boundary and are in the retry queue; ${pending.length} more are queued for the next run. `
        + `A sync failure leaves the compliance record untouched — what is unconfirmed is the SAP work order.`
        + (errors.length ? `\n\nIn the queue: ${errors.map((e) => `${e.filterId} (order ${e.sapWorkOrder})`).join(', ')}.` : ''),
      go: 'sap-sync',
      label: 'Open the sync monitor',
    }
  }

  if (has('approval', 'sign', 'signature', 'unsigned', 'review', 'part 11')) {
    const waiting = d.docs.filter((x) => x.approvalStatus !== 'Approved')
    const signed = d.docs.filter((x) => x.approvalStatus === 'Approved')
    return {
      text: `${waiting.length} certification records are waiting on a signature and ${signed.length} are signed.\n\n`
        + `A signature here carries the three parts 21 CFR Part 11 requires: who signed, what they meant by signing, and a timestamp the system writes rather than the signer. `
        + `Nothing reaches the locked, audit-ready stage without one.`,
      go: 'approvals',
      label: 'Open approvals',
    }
  }

  if (has('lifecycle', 'stage', 'locked', 'audit-ready', 'workflow')) {
    const locked = d.docs.filter((x) => x.stage === 'Locked / Audit-Ready')
    return {
      text: `${d.docs.length} certification documents are in the workflow. ${locked.length} have reached Locked / Audit-Ready, which is the stage the audit package claims as final.\n\n`
        + `The stages run: Created, Routed for Review, Under Review, Approved - Signed, Locked / Audit-Ready. A record only moves forward, except by a recorded rejection.`,
      go: 'lifecycle',
      label: 'Open the board',
    }
  }

  if (has('audit', 'readiness', 'inspection', 'fda', 'gmp', 'export')) {
    return {
      text: `Audit readiness is ${pct(HEADLINE.auditReadiness)}, which is the workbook's own figure from its Compliance Dashboard sheet.\n\n`
        + `${d.docs.filter((x) => x.signedBy).length} of ${d.docs.length} records are signed and ${d.docs.filter((x) => x.stage === 'Locked / Audit-Ready').length} are locked. `
        + `The export builds a package scoped by cleanroom, stage and date range — and it shows its own gaps before it leaves, rather than dropping unsigned records quietly.`,
      go: 'audit-export',
      label: 'Open audit export',
    }
  }

  if (has('retention', 'hold', 'legal', 'keep', 'destroy')) {
    return {
      text: `Every certification record has a retention expiry from the workbook, and a legal hold can be placed on top of it.\n\n`
        + `A hold stops the retention clock rather than extending it, so a held record shows no expiry at all. Placing and lifting one are both audit-trail events with a named actor and a timestamp.`,
      go: 'retention',
      label: 'Open retention',
    }
  }

  if (has('cleanroom', 'room', 'iso', 'where', 'how many filters')) {
    return {
      text: `${FILTER_VIEW.length} filters across ${CLEANROOMS.length} cleanrooms:\n\n`
        + CLEANROOMS.map((c) => `${c.cleanroomId} — ${c.name} (${c.isoClass}): ${c.filterCount} filters`).join('\n'),
      go: 'filters',
      label: 'Open the registry',
    }
  }

  if (has('attention', 'today', 'priority', 'what should', 'worst', 'urgent')) {
    const concern = d.filters.filter((f) => f.concern)
    const overdue = d.docs.filter((x) => x.notification === 'Overdue - Escalate').length
    const blocked = REPLACEMENT_RECORDS.filter((x) => x.blocked).length
    return {
      text: `${concern.length} filters have an open concern, ${overdue} certifications are overdue and ${blocked} replacement${blocked === 1 ? ' is' : 's are'} blocked.\n\n`
        + `In order: a failed integrity test outranks a pressure breach, because penetration over threshold means the barrier itself is compromised where a differential says it is loading.`
        + (concern[0] ? `\n\nStart with ${concern[0].filterId} in ${concern[0].cleanroomName} — ${concern[0].concern.toLowerCase()}.` : ''),
      go: 'overview',
      label: 'Open the overview',
    }
  }

  return {
    text: `I can answer from the records on these screens — filters, integrity tests, leak readings, replacements, certification documents, approvals, retention and the SAP mapping.\n\n`
      + `Ask about an area, or name a record: HF-2001, DT-3001, DOC-HF-2001.`,
  }
}

export default function SynapseChat({ open: openProp, onOpen, onClose }) {
  const router = useRouter()

  // Controlled when the header drives it, self-managed when it is not.
  //
  // Both directions have to reach the parent. The hospitality portal's first
  // version only reported closing, so the header could open the chat but the
  // floating launcher — which asks for the opposite of the current state —
  // asked to open and nothing happened. A controlled component that swallows
  // half its own events is worse than an uncontrolled one, so this takes both
  // callbacks from the start.
  const [openSelf, setOpenSelf] = useState(false)
  const controlled = openProp !== undefined
  const open = controlled ? openProp : openSelf
  const setOpen = (v) => {
    const next = typeof v === 'function' ? v(open) : v
    if (!controlled) { setOpenSelf(next); return }
    if (next) onOpen?.()
    else onClose?.()
  }

  const [input, setInput] = useState('')
  const [thread, setThread] = useState([])
  const [thinking, setThinking] = useState(false)
  const endRef = useRef(null)

  // Through the lifecycle hook rather than the static records, so a document
  // signed on Approvals is signed as far as the assistant is concerned too.
  const docs = useDocuments()

  const d = useMemo(() => {
    const room = new Map(FILTER_VIEW.map((f) => [f.filterId, f.cleanroomName]))
    return {
      filters: FILTER_VIEW,
      tests: TEST_RECORDS,
      leaks: LEAK_RECORDS,
      docs,
      roomOf: (id) => room.get(id) || 'an unmapped cleanroom',
    }
  }, [docs])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [thread, thinking])

  const ask = (text) => {
    const q = String(text || input).trim()
    if (!q) return
    setInput('')
    setThread((p) => [...p, { role: 'user', text: q }])
    setThinking(true)
    // A beat before answering. An instant reply to a question that takes a
    // person a minute reads as canned, which is what this is trying not to be.
    setTimeout(() => {
      setThread((p) => [...p, { role: 'ai', ...answer(q, d) }])
      setThinking(false)
    }, 450)
  }

  return (
    <>
      {/* The launcher carries the bull, reversed out of the navy, which is what
          the live product uses — a generic chat glyph would be the one thing on
          the screen that does not look like Oxmaint. */}
      <button onClick={() => setOpen((v) => !v)} title="Synapse AI" style={launcher}>
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        ) : (
          <OxmaintMark size={28} tone="light" />
        )}
      </button>

      {open && (
        <div style={panel}>
          <div style={head}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <OxmaintMark size={22} tone="light" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Synapse AI</div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.72)' }}>Reading {ORG.site} · on-prem</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={closeBtn}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <div style={body}>
            {thread.length === 0 && (
              <div style={{ padding: '6px 2px 12px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 12.5, color: '#0f172a', fontWeight: 700 }}>
                  Ask about the compliance register.
                </p>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.55 }}>
                  Every answer is counted from the records on these screens, so it
                  matches what you see. Name a filter, a test or a document and it
                  will open that record.
                </p>
              </div>
            )}

            {thread.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 9 }}>
                <div style={m.role === 'user' ? bubbleUser : bubbleAI}>
                  <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>
                  {m.go && (
                    <button onClick={() => { setOpen(false); router.push('/portal/hepa/' + m.go) }} style={goBtn}>
                      {m.label} →
                    </button>
                  )}
                </div>
              </div>
            ))}

            {thinking && (
              <div style={{ display: 'flex', gap: 4, padding: '6px 2px' }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{
                    width: 6, height: 6, borderRadius: '50%', background: '#cbd5e1',
                    animation: `oxPulse 1s ${i * 0.15}s infinite`,
                  }} />
                ))}
                <style>{'@keyframes oxPulse{0%,100%{opacity:.3}50%{opacity:1}}'}</style>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div style={{ padding: '0 12px 8px', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {SUGGESTIONS.slice(0, thread.length ? 3 : 6).map((s) => (
              <button key={s} onClick={() => ask(s)} style={chip}>{s}</button>
            ))}
          </div>

          <div style={foot}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') ask() }}
              placeholder="Ask Synapse AI…"
              style={field}
            />
            <button onClick={() => ask()} disabled={!input.trim()} style={{ ...send, opacity: input.trim() ? 1 : 0.4 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4z" /></svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}

const launcher = {
  position: 'fixed', right: 20, bottom: 20, width: 50, height: 50, borderRadius: '50%',
  background: ACCENT, border: 'none', cursor: 'pointer', zIndex: 60,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 8px 26px rgba(21,34,122,0.34)',
}
const panel = {
  position: 'fixed', right: 20, bottom: 80, width: 372, maxWidth: 'calc(100vw - 40px)',
  height: 520, maxHeight: 'calc(100vh - 120px)', background: '#fff',
  borderStyle: 'solid', borderWidth: 1, borderColor: '#e4e9f0', borderRadius: 15, zIndex: 60,
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
  boxShadow: '0 22px 60px rgba(15,23,42,0.20)',
}
const head = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '11px 13px', background: ACCENT, flexShrink: 0,
}
const closeBtn = {
  width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(255,255,255,0.16)', border: 'none', borderRadius: 7, cursor: 'pointer',
}
const body = { flex: 1, overflowY: 'auto', padding: '12px 12px 4px' }
const bubbleBase = { maxWidth: '86%', padding: '9px 12px', fontSize: 12.5, lineHeight: 1.55, borderRadius: 12 }
const bubbleUser = { ...bubbleBase, background: ACCENT, color: '#fff', borderBottomRightRadius: 4 }
const bubbleAI = { ...bubbleBase, background: '#f4f6fb', color: '#0f172a', borderBottomLeftRadius: 4, borderStyle: 'solid', borderWidth: 1, borderColor: '#e8ecf1' }
const goBtn = {
  display: 'block', marginTop: 8, padding: '5px 10px', fontSize: 11.5, fontWeight: 700,
  fontFamily: 'inherit', background: '#fff', borderStyle: 'solid', borderWidth: 1, borderColor: '#d7dce8',
  borderRadius: 7, color: ACCENT, cursor: 'pointer',
}
const chip = {
  padding: '4px 9px', fontSize: 11, fontFamily: 'inherit', background: '#f4f6fb',
  borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 999, color: '#475569', cursor: 'pointer',
}
const foot = { display: 'flex', gap: 7, padding: '9px 12px 12px', borderTop: '1px solid #e8ecf1', flexShrink: 0 }
const field = {
  flex: 1, minWidth: 0, padding: '8px 11px', fontSize: 12.5, fontFamily: 'inherit',
  borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 9, outline: 'none', color: '#0f172a',
}
const send = {
  width: 34, height: 34, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: ACCENT, border: 'none', borderRadius: 9, cursor: 'pointer',
}
