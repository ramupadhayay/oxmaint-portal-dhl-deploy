'use client'

// What a failed integrity test is supposed to set off, and whether it did.
//
// A DOP/PAO scan measuring above the acceptance criterion is not a reading to
// file — it says the barrier is compromised, and four things have to follow: the
// housing gets inspected, the re-test gets booked, corrective work gets raised,
// and the certification stops being usable until all three close.
//
// Every one of those already exists somewhere in this portal. What did not exist
// was anything that showed them as one chain, so a reader could see the test at
// the top and the work order at the bottom and know that nothing in between had
// been skipped. A gap here is the thing an auditor finds: not a missing record,
// but a failure nobody carried forward.
//
// This derives the chain rather than storing it. A stored chain drifts — a work
// order closed in SAP or an inspection walked in the portal would leave a status
// field saying something that is no longer true.

import { FILTER_VIEW, THRESHOLDS, WORK_ORDERS } from './data'
import { INSPECTION_REPORTS, INSPECTION_REMINDERS } from './data/inspections'

/** A filter is in escalation when its most recent test did not pass. */
export const hasFailed = (f) => f?.lastTest?.result === 'Fail'

/**
 * The chain for one filter.
 *
 * Each step reports what satisfies it, or nothing — and the caller decides
 * whether to offer the action that would close it. Steps are returned even when
 * the filter has not failed, so a passing filter renders as a chain with nothing
 * outstanding rather than as an empty panel.
 *
 * @param filter    a row from FILTER_VIEW
 * @param records   the store's records, so work done in the portal counts
 */
export function chainFor(filter, records = {}) {
  if (!filter) return null

  const failed = hasFailed(filter)
  const storedInspections = records.hepa_inspection || []
  const storedOrders = records.hepa_work_order || []

  // ── 1. the test ────────────────────────────────────────────────────────
  const test = filter.lastTest || null
  const limit = THRESHOLDS?.penetration?.value
  const step1 = {
    key: 'test',
    title: 'Integrity test failed',
    done: true,
    ref: test?.testId || null,
    detail: test
      ? `${test.penetration} penetration against a maximum of ${limit ?? '—'}, measured on ${test.date}.`
      : 'No test on file for this filter.',
    tone: failed ? 'red' : 'slate',
  }

  // ── 2. the inspection ──────────────────────────────────────────────────
  //
  // A housing and seal inspection is the round that establishes whether the
  // seal line or the media is the cause. A round already on the register counts
  // and so does one raised here — but only a round walked AFTER the test failed can establish why it failed. A
  // quarterly housing inspection that passed three weeks earlier is evidence
  // about a different day, and counting it would let the chain report itself
  // satisfied by a record that predates the problem — which is exactly the kind
  // of gap this panel exists to expose.
  const failedOn = test?.date || ''
  const seededInspection = INSPECTION_REPORTS.find(
    (r) => r.filterId === filter.filterId
      && r.roundId === 'housing'
      && (!failed || String(r.date) >= String(failedOn)),
  ) || null
  const raisedInspection = storedInspections.find(
    (r) => r.filterId === filter.filterId && r.fromFailure === filter.filterId,
  ) || null
  const inspection = raisedInspection || seededInspection

  const step2 = {
    key: 'inspection',
    title: 'Housing inspection raised',
    done: Boolean(inspection),
    ref: inspection?.reportId || null,
    href: inspection ? `/portal/hepa/inspections/${inspection.reportId}` : null,
    detail: inspection
      ? `${inspection.round} — ${inspection.status}${inspection.result ? `, ${inspection.result}` : ', not yet walked'}.`
      : 'Nothing has looked at the housing since the test failed. The cause is still unestablished.',
    action: inspection ? null : 'raise-inspection',
  }

  // ── 3. the reminder ────────────────────────────────────────────────────
  // And the booked round has to be ahead of the failure, not behind it.
  const reminder = INSPECTION_REMINDERS.find(
    (r) => r.filterId === filter.filterId
      && r.roundId === 'housing'
      && (!failed || String(r.dueDate) >= String(failedOn)),
  ) || null

  const step3 = {
    key: 'reminder',
    title: 'Re-test booked',
    done: Boolean(reminder),
    ref: reminder?.reminderId || null,
    href: reminder ? `/portal/hepa/inspection-reminder/${reminder.reminderId}` : null,
    detail: reminder
      ? `${reminder.round} due ${reminder.dueDate}${reminder._overdue ? ' — overdue' : ''}, assigned to ${reminder.assignedTo}.`
      : 'No round is booked against this filter, so nothing will come back to it.',
    tone: reminder?._overdue ? 'amber' : 'slate',
    action: reminder ? null : 'book-reminder',
  }

  // ── 4. the work order ──────────────────────────────────────────────────
  //
  // Two routes, and the portal supports both. SAP may already carry an order
  // against the equipment — that is the integration doing its job and no second
  // order should be raised beside it. Otherwise one is raised here, from the
  // inspection's findings, and pushed out through the gateway.
  const fromSap = filter.sap?.sapWorkOrder
    ? { id: filter.sap.sapWorkOrder, route: 'SAP integration' }
    : null

  const seededOrder = WORK_ORDERS.find((w) => w.filterId === filter.filterId) || null
  const raisedOrder = storedOrders.find((w) => w.filterId === filter.filterId) || null
  const local = raisedOrder || seededOrder
  const fromPortal = local
    ? { id: local.workOrderId, route: raisedOrder ? 'Raised in this portal' : 'Inspection checklist', status: local.status }
    : null

  const order = fromSap || fromPortal

  const step4 = {
    key: 'work-order',
    title: 'Corrective work raised',
    done: Boolean(order),
    ref: order?.id || null,
    href: fromPortal && !fromSap ? `/portal/hepa/work-orders/${fromPortal.id}` : null,
    detail: order
      ? `${order.id} — ${order.route}${order.status ? `, ${order.status}` : ''}.`
      : 'The finding has produced no job. A failed test with nothing raised off it is the case an auditor asks about.',
    tone: order ? 'slate' : 'red',
    action: order ? null : 'raise-work-order',
    routes: order ? null : ['checklist', 'sap'],
  }

  const steps = [step1, step2, step3, step4]
  const outstanding = steps.filter((s) => !s.done)

  return {
    filterId: filter.filterId,
    failed,
    steps,
    outstanding,
    complete: outstanding.length === 0,
    // The sentence the panel leads with. Written here so the record page and
    // the filter page cannot describe the same chain two different ways.
    summary: !failed
      ? 'This filter’s most recent test passed. Nothing is outstanding against it.'
      : outstanding.length === 0
        ? 'Every step this failure required has been carried out.'
        : `${outstanding.length} of the ${steps.length} steps this failure requires ${outstanding.length === 1 ? 'is' : 'are'} still open.`,
  }
}

/** Every filter currently in escalation, for the screens that count them. */
export const FAILING = FILTER_VIEW.filter(hasFailed)
