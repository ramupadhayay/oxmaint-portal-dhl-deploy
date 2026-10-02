'use client'

// What has actually been done, applied to what was planned.
//
// data.js generates the property as it stands with nothing done to it. The
// records say what someone has since ticked, closed or logged. Neither is the
// truth on its own, and every screen needs the same combination of the two —
// so it lives here rather than being reassembled per screen and drifting.
//
// This is the difference between a schedule and a picture of one. Ticking
// "Suite 104 — quarterly PM" used to draw a line through the text and stop
// there: the rotation board still showed 104 overdue, tomorrow still carried it
// as catch-up, and the tick meant nothing outside the row it was in. A PM that
// was done is done everywhere.

import { useMemo } from 'react'
import { useRecords } from './store'
import {
  SUITES, WORK_ORDERS, CYCLE_DAYS, CYCLE_POSITION, EPOCH, OPEN_STATUS, daysFrom,
} from './data'

const dayOf = (iso) => Math.round((new Date(iso).getTime() - EPOCH) / 86400000)

// Hoisted, not written inline at the call site. `useRecords` memoises on its
// arguments, and a fresh `[]` and a fresh arrow on every render mean it
// recomputes on every render and hands back a new array each time — which then
// invalidates every memo downstream of it.
const NONE = []
const byRecordId = (r) => r.recordId

/**
 * The suites, with any PM completed through the portal applied.
 *
 * A completion moves the suite's last PM to the day it was done and its next
 * one a full cycle on, which is what takes it out of Overdue and off the
 * catch-up queue — the same arithmetic data.js does, run again with a newer
 * date rather than a second rule that could disagree with it.
 */
export function useSuites() {
  const pms = useRecords('hosp_suite_pm', NONE, byRecordId)

  return useMemo(() => {
    const doneOn = new Map()
    pms.forEach((r) => {
      if (!r.suite_number || !r.completed_date) return
      const prev = doneOn.get(r.suite_number)
      if (!prev || new Date(r.completed_date) > new Date(prev)) doneOn.set(r.suite_number, r.completed_date)
    })
    if (!doneOn.size) return SUITES

    return SUITES.map((s) => {
      const done = doneOn.get(s.suite_number)
      if (!done) return s
      const lastOffset = dayOf(done)
      const dueOffset = lastOffset + CYCLE_DAYS
      return {
        ...s,
        last_pm_date: done,
        next_pm_date: daysFrom(dueOffset),
        due_in_days: dueOffset,
        overdue_days: 0,
        state: dueOffset === 0 ? 'Due today' : 'Done this cycle',
        completed_here: true,
        // Done *today*, and what it was before it was done.
        //
        // Both are needed to keep the line on today's schedule after it has
        // been ticked. A suite stops being overdue the moment its PM is
        // recorded, so filtering on the current state made the row vanish under
        // the cursor — the person loses their place and any way to undo it. The
        // original state is what says which group it belongs in, so a ticked
        // suite stays where it was rather than appearing in both.
        completed_today: lastOffset === 0,
        origin_state: s.state,
        // Kept so the row does not move when it is ticked. Catch-up sorts by
        // how late a suite is, and completing one takes that to zero — so the
        // line jumped down the list under the cursor of the person who had just
        // ticked it.
        origin_overdue_days: s.overdue_days,
      }
    })
  }, [pms])
}

/** Coverage over the live suites, not the generated ones. */
export function useRotation(suites) {
  return useMemo(() => {
    const total = suites.length
    const done = suites.filter((s) => s.state === 'Done this cycle').length
    const overdue = suites.filter((s) => s.state === 'Overdue').length
    const dueToday = suites.filter((s) => s.state === 'Due today').length
    return {
      total,
      done,
      overdue,
      dueToday,
      ahead: total - done - overdue - dueToday,
      expected: Math.round((CYCLE_POSITION / CYCLE_DAYS) * total),
      coverage: total ? Math.round((done / total) * 1000) / 10 : 0,
      cyclePosition: CYCLE_POSITION,
      cycleDays: CYCLE_DAYS,
      perDay: total ? Math.round((total / CYCLE_DAYS) * 10) / 10 : 0,
    }
  }, [suites])
}

/** Work orders with any status change applied — the same merge, for the backlog. */
export function useWorkOrders() {
  const merged = useRecords('hosp_work_order', WORK_ORDERS, (w) => w.workorder_id || w.recordId)
  return merged
}

export const isOpenWO = (w) => OPEN_STATUS.includes(w.status)
