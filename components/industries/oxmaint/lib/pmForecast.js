'use client'

// What is coming, week by week.
//
// The PM register answers "what is due now". A planner's week is the other
// question: what lands in the next three months, whether the shop can absorb it,
// and what has to move. That cannot be read off `next_due` alone, because half
// these schedules fall due on hours — a tug at 1,800 hours a year reaches its
// 250-hour service in seven weeks, and no date on the record says so.
//
// So a meter schedule is projected: hours remaining ÷ hours a day, from the
// unit's own usage. Where that usage is not known the schedule is listed as
// unscheduled rather than given an invented date — a forecast that quietly
// guesses is worse than one that says which rows it could not place.
//
// A dual-trigger schedule lands on whichever side gets there first, and the row
// says which, because "the hours arrived early" is the planner's signal that a
// unit is being worked harder than the plan assumed.

import { useMemo } from 'react'
import { EPOCH, ASSETS, TECHNICIANS, OPEN_STATUS } from './data'
import { useStore } from './store'
import { dueState, live, hasMeterTrigger, hasTimeTrigger, idOf } from './pmSchedule'

const DAY = 86400000
export const HORIZON_DAYS = 90
export const WEEKS = Math.round(HORIZON_DAYS / 7)

/** Monday of the week a date falls in, at midnight. */
export function weekStart(ms) {
  const d = new Date(ms)
  d.setUTCHours(0, 0, 0, 0)
  const back = (d.getUTCDay() + 6) % 7
  return d.getTime() - back * DAY
}

/**
 * How many hours a day this unit runs.
 *
 * The pack's own figure first — DHL's fleet snapshot carries typical hours per
 * year by equipment type. Otherwise from readings logged in the portal: two
 * readings are a rate, and a rate measured here beats an assumption. Null when
 * there is neither, and the caller says so on screen.
 */
export function hoursPerDay(asset, readings) {
  const perYear = Number(asset?.hours_per_year)
  if (perYear > 0) return perYear / 365

  const id = asset?.asset_id || asset?.recordId
  const mine = (readings || [])
    .filter((r) => String(r.asset_id) === String(id) && r.meter_type === 'hours' && Number(r.value) > 0 && r.read_at)
    .sort((a, b) => String(a.read_at).localeCompare(String(b.read_at)))
  if (mine.length < 2) return null
  const first = mine[0]
  const last = mine[mine.length - 1]
  const days = (new Date(last.read_at).getTime() - new Date(first.read_at).getTime()) / DAY
  const hours = Number(last.value) - Number(first.value)
  if (!(days >= 1) || !(hours > 0)) return null
  return hours / days
}

/**
 * When one schedule next falls due, and on which trigger.
 *
 * Returns `at` (a timestamp) plus the reason it is unplaceable when it is one:
 * a meter schedule on a unit whose usage nobody knows, or one whose meter has
 * never been read.
 */
export function forecastOne(p, assets, readings) {
  const state = dueState(p, assets)
  if (!state) return null
  const asset = assets.find((a) => (a.asset_id || a.recordId) === p.asset_id) || null

  let timeAt = null
  if (hasTimeTrigger(p) && p.next_due) timeAt = new Date(p.next_due).getTime()

  let meterAt = null
  let meterNote = null
  let perDay = null
  if (hasMeterTrigger(p)) {
    const m = state.byMeter
    perDay = hoursPerDay(asset, readings)
    if (!m || m.unknown) meterNote = 'meter never read'
    else if (m.due) meterAt = EPOCH
    else if (!(perDay > 0)) meterNote = 'usage not known'
    else meterAt = EPOCH + Math.round((m.hoursRemaining / perDay)) * DAY
  }

  const candidates = [
    timeAt != null ? { at: timeAt, by: 'time' } : null,
    meterAt != null ? { at: meterAt, by: 'meter' } : null,
  ].filter(Boolean).sort((a, b) => a.at - b.at)

  const first = candidates[0] || null
  return {
    schedule: p,
    asset,
    state,
    perDay,
    at: first?.at ?? null,
    by: first?.by ?? null,
    // Both sides land in the same week: worth saying, because the unit is
    // running exactly to plan and the pair can be done as one visit.
    both: candidates.length === 2 && Math.abs(candidates[0].at - candidates[1].at) < 7 * DAY,
    timeAt,
    meterAt,
    meterNote,
    overdue: Boolean(state.due),
    // How far past its date, where it has one — the size of the lateness is
    // what a planner triages on, not the fact of it.
    lateDays: timeAt != null && timeAt < EPOCH ? Math.round((EPOCH - timeAt) / DAY) : 0,
    hours: Number(p.estimated_hours) || 0,
  }
}

/**
 * The whole forecast: thirteen weeks, what falls in each, and what could not be
 * placed. Reads the live register through `assets` so a reading logged a minute
 * ago moves the week a service lands in.
 */
export function useForecast(schedules, assets, { techs, hoursPerTech } = {}) {
  const store = useStore()
  const readings = store?.records?.meter_reading
  const workOrders = store?.records?.work_order

  return useMemo(() => {
    const rows = (schedules || [])
      .filter(live)
      .map((p) => forecastOne(p, assets || ASSETS, readings))
      .filter(Boolean)

    // A schedule that already has an open job raised from it is planned work,
    // not forecast work — counting it twice is how a week looks full of jobs
    // the shop has already started.
    const raised = new Set(
      (workOrders || [])
        .filter((w) => w.raised_from_id && OPEN_STATUS.includes(w.status))
        .map((w) => String(w.raised_from_id)),
    )
    rows.forEach((r) => { r.jobOpen = raised.has(String(idOf(r.schedule))) })

    const start = weekStart(EPOCH)
    const weeks = Array.from({ length: WEEKS }, (_, i) => ({
      index: i,
      start: start + i * 7 * DAY,
      end: start + (i + 1) * 7 * DAY - 1,
      rows: [],
      hours: 0,
    }))

    const lateness = (r) => {
      const over = r.state?.byMeter && !r.state.byMeter.unknown && r.state.byMeter.hoursRemaining < 0
        ? -r.state.byMeter.hoursRemaining / (r.state.byMeter.interval || 250)
        : 0
      const days = r.timeAt != null ? (EPOCH - r.timeAt) / DAY : 0
      return Math.max(over, days / 30)
    }
    const overdue = []
    const unplaced = []
    const beyond = []
    rows.forEach((r) => {
      if (r.overdue) { overdue.push(r); return }
      if (r.at == null) { unplaced.push(r); return }
      const i = Math.floor((weekStart(r.at) - start) / (7 * DAY))
      if (i < 0) { overdue.push(r); return }
      if (i >= WEEKS) { beyond.push(r); return }
      weeks[i].rows.push(r)
      weeks[i].hours += r.hours
    })
    overdue.sort((a, b) => lateness(b) - lateness(a))
    weeks.forEach((w) => {
      w.rows.sort((a, b) => a.at - b.at)
      w.hours = Math.round(w.hours * 10) / 10
    })

    // What the shop can take in a week. The planner sets both numbers, because
    // only they know how much of the crew is on this work.
    const crew = Number(techs) || TECHNICIANS.filter((t) => t.role === 'Technician' || t.role === 'Supervisor').length || 1
    const perWeek = (Number(hoursPerTech) || 40) * crew
    weeks.forEach((w) => {
      w.capacity = perWeek
      w.load = perWeek > 0 ? w.hours / perWeek : 0
    })

    const within = (days) => rows.filter((r) => !r.overdue && r.at != null && r.at <= EPOCH + days * DAY)
    return {
      rows, weeks, overdue, unplaced, beyond, crew, perWeek,
      due7: within(7),
      due30: within(30),
      due90: within(HORIZON_DAYS),
      hours30: Math.round(within(30).reduce((n, r) => n + r.hours, 0) * 10) / 10,
      meterLed: rows.filter((r) => r.by === 'meter' && !r.overdue).length,
    }
  }, [schedules, assets, readings, workOrders, techs, hoursPerTech])
}
