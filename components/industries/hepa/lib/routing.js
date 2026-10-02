'use client'

// Condition-based routing.
//
// The brief is specific about this and about why it matters:
//
//   "Configurable routing to the correct reviewer/approver based on record
//    type, cleanroom, or result (e.g., a Fail routes to Quality automatically)"
//
//   "...showing routing logic is condition-based, not manual triage."
//
// The second line is the requirement. A person pressing a button that says
// "route for review" is manual triage wearing a workflow's clothes: it depends
// on somebody noticing the record, reading the result, and knowing where a
// failure is supposed to go. The failure that matters is the one raised at
// 3am by a technician who does not know that ISO 5 rooms go to the site lead.
//
// So the rules are data, evaluated against the record. First match wins, which
// is why order is part of the configuration and is shown on the screen. Every
// automatic routing writes an audit entry naming the rule that fired — a record
// that moved on its own has to say what moved it.

import { FILTER_VIEW, THRESHOLDS, USER } from './data'

/**
 * The rules, in the order they are tried.
 *
 * Each is a plain predicate over the document and the filter it is about, so
 * the screen can show what each one matches right now rather than describing
 * it. The three conditions the brief names — record type, cleanroom, result —
 * are all represented.
 */
export const RULES = [
  {
    id: 'failed-test',
    name: 'Failed integrity test',
    condition: 'Result — the filter\'s most recent DOP/PAO test did not meet the acceptance criterion',
    basis: 'result',
    to: 'Quality Reviewer',
    reviewer: 'L. Nguyen',
    urgency: 'Critical',
    why: 'Penetration above the threshold means the barrier is compromised. It does not wait for somebody to notice.',
    match: (doc, f) => f?.lastTest?.result === 'Fail',
  },
  {
    id: 'iso5',
    name: 'Aseptic core',
    condition: 'Cleanroom — the record is against an ISO 5 room, where product is open',
    basis: 'cleanroom',
    to: 'Site Quality Lead',
    reviewer: 'A. Petrov',
    urgency: 'High',
    why: 'An ISO 5 fill line is the tightest grade on site. Its records go to the site lead regardless of what they say.',
    match: (doc, f) => f?.isoClass === 'ISO 5',
  },
  {
    id: 'breach',
    name: 'Pressure differential breach',
    condition: `Result — a reading above ${THRESHOLDS.pressureDifferential.value} in. wg on this filter`,
    basis: 'result',
    to: 'Quality Reviewer',
    reviewer: 'D. Castillo',
    urgency: 'High',
    why: 'A breach says the filter is loading. It needs a reviewer, not the same urgency as a failed scan.',
    match: (doc, f) => (f?.breachCount || 0) > 0,
  },
  {
    id: 'replacement',
    name: 'Replacement record',
    condition: 'Record type — a filter changeover, which needs its post-installation test verified',
    basis: 'record type',
    to: 'Site Quality Lead',
    reviewer: 'A. Petrov',
    urgency: 'High',
    why: 'A replacement is not complete until somebody has checked the chain of custody either side of it.',
    match: (doc) => doc.recordType === 'Replacement',
  },
  {
    id: 'routine',
    name: 'Routine record',
    condition: 'Everything else — a passing test or a clean leak round',
    basis: 'default',
    to: 'Manufacturing Supervisor',
    reviewer: 'D. Okonkwo',
    urgency: 'Medium',
    why: 'A clean record still needs review, but it does not need a quality escalation to get one.',
    match: () => true,
  },
]

export const ruleById = (id) => RULES.find((r) => r.id === id) || null

const filterFor = (doc) => FILTER_VIEW.find((f) => f.filterId === doc.relatedRecordId) || null

/**
 * Which rule this record falls under. First match wins.
 *
 * `disabled` is the set of rule ids switched off on the routing screen, so a
 * rule can be taken out of the chain and the next one takes over — which is
 * what "configurable" has to mean if it means anything.
 */
export function matchRule(doc, disabled = new Set()) {
  const f = filterFor(doc)
  for (const rule of RULES) {
    if (disabled.has(rule.id)) continue
    if (rule.match(doc, f)) return rule
  }
  return null
}

/** Records the rules would move: anything still sitting at Created. */
export const routable = (docs) => docs.filter((d) => d.stage === 'Created')

/** What each rule is matching across a set of records, for the screen. */
export function coverage(docs, disabled = new Set()) {
  const counts = Object.fromEntries(RULES.map((r) => [r.id, []]))
  for (const d of docs) {
    const rule = matchRule(d, disabled)
    if (rule) counts[rule.id].push(d)
  }
  return counts
}
