/**
 * Supervisor waterfall over the voice register.
 * Reads existing shop statuses; writes are session overlays for this process.
 */

import {
  WATERFALL_HONESTY,
  WATERFALL_NEXT,
  WATERFALL_STAGES,
  computeWaterfall,
  matchesWaterfall,
  normalizeWaterfallStage,
  patchForWaterfallAdvance,
  waterfallStageOf,
} from '../../components/industries/oxmaint/lib/packs/dhl-gse-data/voiceWaterfall'
import { applyWorkOrderOverlay } from './session.js'
import { filterByWindow, monthWindow, summarizeWo, weekWindow } from './slices.js'

const DAY_ALIASES = {
  sun: 'Sunday', sunday: 'Sunday',
  mon: 'Monday', monday: 'Monday',
  tue: 'Tuesday', tues: 'Tuesday', tuesday: 'Tuesday',
  wed: 'Wednesday', weds: 'Wednesday', wednesday: 'Wednesday',
  thu: 'Thursday', thur: 'Thursday', thurs: 'Thursday', thursday: 'Thursday',
  fri: 'Friday', friday: 'Friday',
  sat: 'Saturday', saturday: 'Saturday',
}

function scoped(reg, period, now) {
  const key = String(period || 'week').toLowerCase()
  if (key === 'month' || key === 'this_month' || key === 'monthly') {
    return { label: 'this_month', items: filterByWindow(reg.workOrders, monthWindow(now)) }
  }
  return { label: 'this_week', items: filterByWindow(reg.workOrders, weekWindow(now)) }
}

function card(w) {
  return {
    ...summarizeWo(w),
    waterfall: waterfallStageOf(w),
    origin: w.origin || (w.dhl_type === 'Preventive' ? 'plan' : 'notification'),
    planned_start: w.planned_start,
    planned_finish: w.planned_finish,
    scope_variation: Boolean(w.scope_variation),
    variation_note: w.variation_note || '',
    archived: Boolean(w.archived),
    planning: w.planning || null,
  }
}

export function getWaterfallPipeline(reg, { period = 'week', now } = {}) {
  const { label, items } = scoped(reg, period, now || Date.now())
  const report = computeWaterfall(items)
  const month = computeWaterfall(filterByWindow(reg.workOrders, monthWindow(now || Date.now())))
  return {
    ok: true,
    honesty: WATERFALL_HONESTY,
    period: label,
    stages: report.stages,
    highlights: report.highlights,
    manpower: report.manpower,
    month_stages: month.stages,
    glossary: WATERFALL_STAGES,
    how_to_read: report.how_to_read,
  }
}

export function listWaterfallStage(reg, { stage, period = 'week', now, limit = 12 } = {}) {
  const { label, items } = scoped(reg, period, now || Date.now())
  const key = normalizeWaterfallStage(stage)
  const hit = items.filter((w) => matchesWaterfall(w, key))
  return {
    ok: true,
    honesty: WATERFALL_HONESTY,
    period: label,
    stage: key,
    count: hit.length,
    planned: hit.filter((w) => w.origin === 'plan' || w.dhl_type === 'Preventive').length,
    unplanned: hit.filter((w) => w.origin !== 'plan' && w.dhl_type !== 'Preventive').length,
    items: hit.slice(0, Math.min(50, Number(limit) || 12)).map(card),
  }
}

export function getManpowerPlan(reg, { day, period = 'week', now } = {}) {
  const { label, items } = scoped(reg, period, now || Date.now())
  const report = computeWaterfall(items)
  const wanted = DAY_ALIASES[String(day || '').trim().toLowerCase()] || null
  const days = wanted
    ? report.manpower.by_day.filter((d) => d.day === wanted)
    : report.manpower.by_day
  const crew = items.filter((w) => {
    const stage = waterfallStageOf(w)
    if (stage !== 'manpower' && stage !== 'in_flow' && stage !== 'review') return false
    if (!wanted) return true
    const stamp = w.planned_start || w.created_date
    const name = stamp ? new Date(Date.parse(stamp)).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) : ''
    return name === wanted
  })
  return {
    ok: true,
    honesty: WATERFALL_HONESTY,
    period: label,
    day: wanted || 'week',
    by_day: days,
    jobs: crew.slice(0, 20).map(card),
    how_to_read: report.manpower.how_to_read,
  }
}

export function assignWorkOrder(wo, { tech_id, tech_name, planned_start, planned_finish } = {}) {
  if (!wo) return { ok: false, error: 'Name the work order to assign (WO-V26-#####).' }
  const start = planned_start || wo.planned_start || wo.created_date
  const patch = {
    assigned_to_id: tech_id || wo.assigned_to_id,
    assigned_to_name: tech_name || wo.assigned_to_name,
    planned_start: start,
    planned_finish: planned_finish || wo.planned_finish,
    waterfall: 'manpower',
    dhl_status: wo.dhl_status === 'Parts Hold' ? wo.dhl_status : 'Assigned',
    status: wo.dhl_status === 'Parts Hold' ? wo.status : 'Open',
  }
  applyWorkOrderOverlay(wo.work_order_number || wo.workorder_id, patch)
  return {
    ok: true,
    honesty: WATERFALL_HONESTY,
    work_order: wo.work_order_number,
    waterfall: 'manpower',
    assigned_to: patch.assigned_to_name || patch.assigned_to_id,
    planned_start: patch.planned_start,
    how_to_read: 'Crew and planned start are locked for this call. Not a live roster write.',
  }
}

export function flagScopeVariation(wo, { note } = {}) {
  if (!wo) return { ok: false, error: 'Name the work order that ran past the plan.' }
  const patch = {
    scope_variation: true,
    variation_note: note || wo.variation_note || 'Actual activities exceeded the planned scope.',
    actual_hours: Number(((wo.actual_hours || wo.estimated_hours || 2) * 1.2).toFixed(2)),
  }
  applyWorkOrderOverlay(wo.work_order_number || wo.workorder_id, patch)
  return {
    ok: true,
    honesty: WATERFALL_HONESTY,
    work_order: wo.work_order_number,
    scope_variation: true,
    variation_note: patch.variation_note,
  }
}

export function advanceWaterfall(wo, { to } = {}) {
  if (!wo) return { ok: false, error: 'Name the work order to advance.' }
  const from = waterfallStageOf(wo)
  const { dest, patch } = patchForWaterfallAdvance(from, to || WATERFALL_NEXT[from])
  if (dest === from && !to) {
    return { ok: false, error: `No next waterfall step after ${from}.`, stage: from }
  }
  if (dest === 'manpower' && !patch.planned_start) {
    patch.planned_start = wo.planned_start || wo.created_date
  }
  if (dest === 'archived') {
    patch.archived = true
    patch.archived_at = new Date().toISOString()
  }
  applyWorkOrderOverlay(wo.work_order_number || wo.workorder_id, patch)
  return {
    ok: true,
    honesty: WATERFALL_HONESTY,
    work_order: wo.work_order_number,
    from,
    to: dest,
    shop_status: patch.dhl_status,
    how_to_read: `Moved ${wo.work_order_number} ${from} → ${dest} for this call. Shop status is still ${patch.dhl_status}.`,
  }
}

export function closeTechnicalReview(wo) {
  if (!wo) return { ok: false, error: 'Name the work order to close.' }
  const stage = waterfallStageOf(wo)
  if (stage !== 'review' && wo.dhl_status !== 'QA Review') {
    return {
      ok: false,
      error: `${wo.work_order_number} is not waiting on technical close (it is ${stage}).`,
      hint: 'Ask list_waterfall_stage stage=review.',
    }
  }
  return advanceWaterfall(wo, { to: 'completed' })
}

export function archiveWorkOrder(wo) {
  if (!wo) return { ok: false, error: 'Name the work order to archive.' }
  const stage = waterfallStageOf(wo)
  if (stage !== 'completed' && wo.dhl_status !== 'Closed') {
    return { ok: false, error: `Archive is for completed jobs. ${wo.work_order_number} is ${stage}.` }
  }
  return advanceWaterfall(wo, { to: 'archived' })
}

export { WATERFALL_HONESTY, WATERFALL_STAGES, waterfallStageOf, card as waterfallCard }
