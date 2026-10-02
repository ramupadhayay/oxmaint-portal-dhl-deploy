'use client'

// What a PM schedule knows about itself, in one place.
//
// The register and the schedule's own page both have to answer the same
// questions — is this thing live, was it already generated today, where does it
// fall due next — and both have to raise a work order the same way. Held on two
// screens, those answers drift: the list calls a paused schedule overdue, the
// page does not, and a compliance figure ends up arguing with the record it was
// counted from.
//
// So the rules live here and the screens read them.

import { useCallback } from 'react'
import { useActions } from './actions'
import { useStore, useRecords } from './store'
import { ASSETS, EPOCH, daysFrom, daysUntil, fmtDate, isPast } from './data'

export const idOf = (r) => r.schedule_id || r.recordId

const idOfAsset = (a) => a.asset_id || a.recordId

/**
 * The asset register as it stands now, not as it was seeded.
 *
 * `dueState` takes an `assets` argument for exactly this, and every screen was
 * leaving it out — so a meter reading logged in the portal updated the asset
 * and moved the Meters screen, while PM went on reading the seeded hours and
 * the meter-based schedule it was supposed to trigger never fell due.
 *
 * A hook rather than a smarter default, because the live register lives in
 * React context and `dueState` is a plain function with no way to reach it.
 */
export const usePmAssets = () => useRecords('asset', ASSETS, idOfAsset)

/**
 * A paused schedule cannot be overdue — it is not promising anything.
 *
 * Counting it as overdue is how a compliance figure ends up arguing with
 * itself: the schedule says "held", the dashboard says "late", and the planner
 * is left to work out which one is lying.
 */
export const live = (p) => p.status !== 'Paused'

/**
 * Overdue on either trigger.
 *
 * The old test read the calendar alone, which on a dual-trigger schedule is
 * half the question — a tug 200 hours past its 1000-hour service was reported
 * as on time because its annual date had not arrived.
 */
export const isOverdue = (p, assets) => {
  if (!live(p)) return false
  const state = dueState(p, assets)
  return Boolean(state?.due)
}

const sameDay = (a, b) =>
  Boolean(a) && Boolean(b) && new Date(a).toDateString() === new Date(b).toDateString()

export const generatedToday = (r) => sameDay(r.last_generated, EPOCH)

/**
 * Roll a schedule forward from today, not from the due date it missed.
 *
 * A schedule six weeks overdue that rolls from its old due date comes back
 * still overdue, and the button that rolled it looks like it did nothing.
 */
export const rollForward = (value, unit) => {
  const d = new Date(EPOCH)
  const n = Math.max(1, Number(value) || 1)
  if (unit === 'Weeks') d.setDate(d.getDate() + n * 7)
  else d.setMonth(d.getMonth() + n)
  return d.toISOString()
}

const timeLabel = (p) =>
  `every ${p.frequency_value} ${String(p.frequency_unit || '').toLowerCase()}`

/**
 * The interval, written the way a planner says it.
 *
 * "1000 hours or 12 months, whichever falls first" is one sentence in a fleet
 * department and was two impossible fields in this product. Now it is one
 * schedule, and this is how it reads back.
 */
export const frequencyLabel = (p) => {
  const t = String(p?.frequency_type || 'Time')
  if (t === 'Meter') return `Every ${Number(p.meter_interval) || 250} hours`
  if (t === 'Both') return `Every ${Number(p.meter_interval) || 250} hours or ${timeLabel(p).replace('every ', '')}, whichever first`
  return `Every ${p.frequency_value} ${String(p.frequency_unit || '').toLowerCase()}`
}

export const hasMeterTrigger = (p) => ['Meter', 'Both'].includes(String(p?.frequency_type || ''))
export const hasTimeTrigger = (p) => ['Time', 'Both'].includes(String(p?.frequency_type || 'Time'))

/**
 * Where a schedule stands, on both of its triggers.
 *
 * A dual-trigger schedule is due when *either* side falls, so the answer is the
 * nearer of the two and it has to say which one it was. A planner who is told
 * "due" without being told whether the hours or the calendar got there cannot
 * tell whether the unit is being worked harder than planned — which is the
 * whole reason to run both.
 *
 * `assets` lets a caller pass the live register, so hours logged in the portal
 * count immediately rather than after a reload.
 */
export function dueState(p, assets = ASSETS) {
  if (!p) return null
  const type = String(p.frequency_type || 'Time')
  const out = { type, byTime: null, byMeter: null }

  if (hasTimeTrigger(p)) {
    const days = daysUntil(p.next_due)
    out.byTime = { days, due: days <= 0, label: fmtDate(p.next_due) }
  }

  if (hasMeterTrigger(p)) {
    const asset = assets.find((a) => (a.asset_id || a.recordId) === p.asset_id)
    const hours = Number(asset?.running_hours)
    const interval = Number(p.meter_interval) || 250
    const since = Number.isFinite(hours) ? hours - (Number(p.meter_at_last) || 0) : null
    out.byMeter = since == null
      ? { unknown: true, interval }
      : {
        interval,
        hoursSince: Math.max(0, Math.round(since)),
        hoursRemaining: Math.round(interval - since),
        due: since >= interval,
        // No reading, no countdown. A meter schedule whose asset has not been
        // read is not "fine" — it is unknown, and saying so is the difference
        // between a gap you can see and one you cannot.
        current: Number.isFinite(hours) ? Math.round(hours) : null,
      }
  }

  // Which side gets there first. Time is in days, meter is in hours, so they
  // are compared on the only axis they share: whether each has already fallen.
  const timeDue = Boolean(out.byTime?.due)
  const meterDue = Boolean(out.byMeter?.due)
  out.due = timeDue || meterDue
  out.firstBy = meterDue && !timeDue ? 'meter'
    : timeDue && !meterDue ? 'time'
      : timeDue && meterDue ? 'both'
        : null
  return out
}

/**
 * The work orders this schedule raised.
 *
 * Matched on the id the generator stamps, and on the sentence it writes for a
 * reader — because rows raised before the id was recorded only carry the
 * sentence, and dropping them would make a schedule that has run for months
 * look like it had never run at all.
 */
export function raisedBy(schedule, workOrders) {
  if (!schedule) return []
  const id = String(idOf(schedule))
  const phrase = `PM schedule ${schedule.schedule_name}`
  return (workOrders || [])
    .filter((w) => String(w.raised_from_id || '') === id || w.raised_from === phrase)
    .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0))
}

/**
 * Raise the work order a schedule is due for, and roll the schedule on.
 *
 * Both halves or neither: a job raised against a schedule that still says it is
 * due gets raised again by the next person to look at it.
 */
export function usePmGenerate() {
  const { update, notify } = useStore()
  const { raiseWorkOrder } = useActions()

  return useCallback(async (row) => {
    if (!row) return null
    if (generatedToday(row)) {
      notify(`${row.schedule_name} was already generated today — nothing raised.`, 'error')
      return null
    }
    const overdue = isPast(row.next_due)
    const wo = await raiseWorkOrder({
      title: row.schedule_name,
      description: `${row.schedule_name} for ${row.asset_name} (${row.asset_code}), generated from the preventive schedule.`,
      assetId: row.asset_id,
      type: 'Preventive',
      priority: overdue ? 'High' : 'Medium',
      // An overdue schedule is already late, so the job it raises is due now
      // rather than on a date that has been and gone.
      dueInDays: overdue ? 1 : Math.max(1, daysUntil(row.next_due)),
      assignedTo: row.assigned_to_name,
      estimatedHours: row.estimated_hours,
      source: `PM schedule ${row.schedule_name}`,
      // The sentence is for a reader; this is for the join. Without it the
      // schedule's own page can only find its jobs by matching prose, which
      // stops matching the moment somebody renames the schedule.
      sourceId: idOf(row),
    })
    if (!wo) return null

    const next = rollForward(row.frequency_value, row.frequency_unit)
    const patch = { last_generated: daysFrom(0), next_due: next }
    // The meter side rolls with the calendar side. Rolling only the date on a
    // dual-trigger schedule leaves it instantly due again on hours, and the
    // button looks like it did half its job — which it would have.
    if (hasMeterTrigger(row)) {
      const asset = ASSETS.find((a) => (a.asset_id || a.recordId) === row.asset_id)
      const hours = Number(asset?.running_hours)
      if (Number.isFinite(hours)) patch.meter_at_last = Math.round(hours)
    }
    await update('pm_schedule', idOf(row), patch)
    notify(`${wo.work_order_number} raised — ${row.schedule_name} next due ${fmtDate(next)}.`)
    return wo
  }, [raiseWorkOrder, update, notify])
}
