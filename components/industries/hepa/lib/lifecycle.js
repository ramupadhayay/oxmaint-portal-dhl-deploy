'use client'

// The certification document lifecycle — Focus Area 3 of the client's brief.
//
// Three screens act on the same records: the board moves them between stages,
// Approvals signs them, and the record page shows one in full. So the rules live
// here rather than in three copies that drift — the hospitality portal learned
// this the same way with its triage helpers.
//
// Two things this file is strict about, because 21 CFR Part 11 is strict about
// them.
//
// A signature carries three parts: who signed, what they meant by signing, and
// when. A tick box that only records "approved" is not a signature under that
// rule, so `sign` refuses without a meaning.
//
// And the audit trail is append-only. Every action below writes a `hepa_audit`
// record and none of them ever update one. A trail that can be edited is not
// evidence, and the whole point of the locked stage is that the record behind it
// cannot be quietly revised.

import { useMemo } from 'react'
import { DOCUMENT_RECORDS, LIFECYCLE_STAGES, USER } from './data'
import { useStore } from './store'

export { LIFECYCLE_STAGES }

// A document's workflow state is one stored record, keyed by the document.
// Seeded rows come from the workbook and this is the delta on top — the same
// merge rule the store is built around.
export const stateIdFor = (documentRef) => `sig_${documentRef}`

const auditId = (documentRef, what) => `aud_${what}_${documentRef}_${Date.now().toString(36)}`

export const stageIndex = (stage) => LIFECYCLE_STAGES.indexOf(stage)
export const nextStage = (stage) => LIFECYCLE_STAGES[stageIndex(stage) + 1] || null

/**
 * What a stage can do next.
 *
 * The gate that matters is the last one: nothing reaches Locked / Audit-Ready
 * without a signature against it, because that stage is what the audit package
 * claims when it says a record is final.
 */
export function actionsFor(doc) {
  const stage = doc.stage
  switch (stage) {
    case 'Created':
      return [{ key: 'route', label: 'Route for review', to: 'Routed for Review' }]
    case 'Routed for Review':
      return [{ key: 'open', label: 'Open review', to: 'Under Review' }]
    case 'Under Review':
      // Signing is not a stage move with a label on it — it goes through
      // `sign`, which is the only path that records a meaning.
      return [{ key: 'sign', label: 'Sign and approve', signature: true }]
    case 'Approved - Signed':
      return [{ key: 'lock', label: 'Lock as audit-ready', to: 'Locked / Audit-Ready', requiresSignature: true }]
    default:
      return []
  }
}

/** The documents every lifecycle screen reads: the workbook's, with stored changes on top. */
export function useDocuments() {
  const store = useStore()
  const stored = store?.records?.hepa_signature || []

  return useMemo(() => {
    const byId = new Map(stored.map((r) => [r.recordId, r]))
    return DOCUMENT_RECORDS.map((d) => {
      const patch = byId.get(stateIdFor(d.documentRef))
      if (!patch) return d
      // recordId is the store's key, not the document's — merging it in would
      // put `sig_DOC-HF-2001` on a row that is DOC-HF-2001.
      const { recordId, _pending, ...rest } = patch
      return { ...d, ...rest, _pending }
    })
  }, [stored])
}

/** The append-only trail, newest first. */
export function useAuditTrail(documentRef) {
  const store = useStore()
  const rows = store?.records?.hepa_audit || []
  return useMemo(() => rows
    .filter((r) => !documentRef || r.documentRef === documentRef)
    .sort((a, b) => String(b.at).localeCompare(String(a.at))), [rows, documentRef])
}

// The one place a stored workflow record is written. Everything below goes
// through it, so a stage can never move without the trail entry beside it.
async function writeState(store, doc, patch, audit) {
  const id = stateIdFor(doc.documentRef)
  const saved = await store.update('hepa_signature', id, {
    documentRef: doc.documentRef,
    relatedRecordId: doc.relatedRecordId,
    ...patch,
  })
  if (!saved) return null

  await store.create('hepa_audit', {
    recordId: auditId(doc.documentRef, audit.what),
    documentRef: doc.documentRef,
    relatedRecordId: doc.relatedRecordId,
    action: audit.action,
    actor: audit.actor || USER.name,
    actorRole: audit.actorRole || USER.role,
    at: audit.at,
    meaning: audit.meaning || null,
    from: doc.stage,
    to: patch.stage || doc.stage,
  })
  return saved
}

/** Move a document one stage along. Refuses the locked stage without a signature. */
export async function advanceStage(store, doc, to) {
  if (to === 'Locked / Audit-Ready' && doc.approvalStatus !== 'Approved') {
    store.notify('A record cannot be locked as audit-ready until it is signed.', 'error')
    return null
  }
  const at = new Date().toISOString()
  const saved = await writeState(store, doc, { stage: to }, {
    what: 'stage',
    action: to === 'Locked / Audit-Ready' ? 'Locked as audit-ready' : `Moved to ${to}`,
    at,
  })
  if (saved) store.notify(to === 'Locked / Audit-Ready' ? 'Record locked. It is now audit-ready.' : `Moved to ${to}.`)
  return saved
}

/**
 * The electronic signature.
 *
 * Identity, meaning and timestamp — the three parts the regulation names — and
 * none of them optional. The signer's name and role come from the session, the
 * meaning is typed by the person signing, and the timestamp is written here
 * rather than accepted from the caller.
 */
export async function signDocument(store, doc, { meaning, signer = USER.name, role = USER.role } = {}) {
  if (!meaning || !String(meaning).trim()) {
    store.notify('A signature needs a stated meaning. Say what you are approving.', 'error')
    return null
  }
  const at = new Date().toISOString()
  const saved = await writeState(store, doc, {
    stage: 'Approved - Signed',
    approvalStatus: 'Approved',
    signedBy: signer,
    signedAt: at,
    signatureMeaning: String(meaning).trim(),
    signatureRole: role,
  }, {
    what: 'sign',
    action: 'Electronic signature applied',
    actor: signer,
    actorRole: role,
    at,
    meaning: String(meaning).trim(),
  })
  if (saved) store.notify(`Signed by ${signer}. The record is approved.`)
  return saved
}

/**
 * Route a record by rule rather than by hand.
 *
 * The difference from `advanceStage(doc, 'Routed for Review')` is not the stage
 * — it is that the reviewer and the role are decided by the record's own
 * condition, and the audit entry names the rule that decided them. A trail
 * saying "moved to Routed for Review" cannot answer "why did this go to the
 * site lead"; one saying "routed automatically by rule Aseptic core" can.
 */
export async function routeByRule(store, doc, rule) {
  if (!rule) {
    store.notify('No routing rule matches this record.', 'error')
    return null
  }
  const at = new Date().toISOString()

  const saved = await writeState(store, doc, {
    stage: 'Routed for Review',
    routedToRole: rule.to,
    reviewer: rule.reviewer,
    routedBy: 'rule',
    routedRule: rule.id,
    routedRuleName: rule.name,
    routedUrgency: rule.urgency,
    routedAt: at,
  }, {
    what: 'route',
    action: `Routed automatically to ${rule.to}`,
    actor: 'Routing rules',
    actorRole: 'System',
    at,
    meaning: `Rule "${rule.name}" matched on ${rule.basis}. ${rule.why}`,
  })

  return saved
}

/**
 * Apply the rules to everything eligible.
 *
 * Sequential rather than parallel on purpose: each write is a separate record
 * and a separate audit entry, and firing eighteen of them at once against the
 * store's optimistic queue produced a list that settled in a different order
 * than it was written in.
 */
export async function routeAll(store, docs, matchFor) {
  const results = []
  for (const doc of docs) {
    const rule = matchFor(doc)
    if (!rule) continue
    const saved = await routeByRule(store, doc, rule)
    if (saved) results.push({ doc, rule })
  }
  if (results.length) {
    store.notify(`${results.length} records routed by rule. The trail names which rule moved each one.`)
  } else {
    store.notify('Nothing was waiting to be routed.', 'error')
  }
  return results
}

/**
 * Move a record one stage in either direction.
 *
 * Forward is the ordinary case and goes through `advanceStage`, gate and all.
 *
 * Backward is the one that needs care, and it is why this is a function rather
 * than the board calling advanceStage with a lower index. Moving a record back
 * out of Approved - Signed means the signature no longer stands — so it is
 * withdrawn rather than left on a record that has returned to review. Leaving
 * it in place would produce exactly the thing 21 CFR Part 11 exists to prevent:
 * a document showing an approval for a version nobody has approved.
 *
 * Nothing is deleted either way. The withdrawal is an audit entry naming who
 * did it, beside the signature entry it withdraws.
 */
export async function moveStage(store, doc, direction) {
  const i = stageIndex(doc.stage)
  const to = LIFECYCLE_STAGES[i + (direction === 'back' ? -1 : 1)]

  if (!to) {
    store.notify(direction === 'back'
      ? 'This record is at the first stage.'
      : 'This record is at the last stage.', 'error')
    return null
  }

  if (direction !== 'back') return advanceStage(store, doc, to)

  // Going back out of a signed stage withdraws the signature.
  const withdrawing = doc.approvalStatus === 'Approved'
  const at = new Date().toISOString()

  const saved = await writeState(store, doc, {
    stage: to,
    ...(withdrawing ? {
      approvalStatus: 'Pending',
      signedBy: null,
      signedAt: null,
      signatureMeaning: null,
      withdrawnFrom: doc.stage,
      withdrawnBy: USER.name,
      withdrawnAt: at,
    } : {}),
  }, {
    what: 'back',
    action: withdrawing ? 'Signature withdrawn and returned to review' : `Moved back to ${to}`,
    at,
    meaning: withdrawing
      ? `Returned from ${doc.stage}; the electronic signature no longer stands against this record.`
      : null,
  })

  if (saved) {
    store.notify(withdrawing
      ? 'Moved back. The signature has been withdrawn and the record needs signing again.'
      : `Moved back to ${to}.`)
  }
  return saved
}

/**
 * A rejection.
 *
 * Sends the record back to Created rather than deleting anything: the rejected
 * version stays on file with the reason against it, which is what makes the
 * next submission reviewable.
 */
export async function rejectDocument(store, doc, { reason, reviewer = USER.name, role = USER.role } = {}) {
  if (!reason || !String(reason).trim()) {
    store.notify('A rejection needs a reason on the record.', 'error')
    return null
  }
  const at = new Date().toISOString()
  const saved = await writeState(store, doc, {
    stage: 'Created',
    approvalStatus: 'Rejected',
    signedBy: null,
    signedAt: null,
    rejectionReason: String(reason).trim(),
    rejectedBy: reviewer,
    rejectedAt: at,
  }, {
    what: 'reject',
    action: 'Rejected in review',
    actor: reviewer,
    actorRole: role,
    at,
    meaning: String(reason).trim(),
  })
  if (saved) store.notify('Returned to the originator with the reason on the record.')
  return saved
}
