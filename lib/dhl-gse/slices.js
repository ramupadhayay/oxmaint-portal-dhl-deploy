import { matchesStage, VOICE_VOLUME } from '../../components/industries/oxmaint/lib/packs/dhl-gse-data/voiceVolume'

const DAY = 86400000

export function windowBounds(now, days) {
  const end = now
  const start = now - days * DAY
  return { start, end, days }
}

export function inCreatedWindow(wo, start, end) {
  const t = Date.parse(wo.created_date)
  if (!Number.isFinite(t)) return false
  return t >= start && t <= end
}

export function weekWindow(now) {
  return windowBounds(now, VOICE_VOLUME.weekDays)
}

export function monthWindow(now) {
  return windowBounds(now, VOICE_VOLUME.monthDays)
}

export function filterByWindow(workOrders, { start, end, days } = {}) {
  // Tagged projection slices stay exact even if the demo clock or date-shift
  // moves. Counts for "this week" / "this month" must not depend on wall time.
  if (days === VOICE_VOLUME.weekDays) {
    const tagged = (workOrders || []).filter((w) => w.voice_week)
    if (tagged.length) return tagged
  }
  if (days === VOICE_VOLUME.monthDays) {
    const tagged = (workOrders || []).filter((w) => w.voice_volume)
    if (tagged.length) return tagged
  }
  return (workOrders || []).filter((w) => inCreatedWindow(w, start, end))
}

export function filterByStage(workOrders, stage) {
  return workOrders.filter((w) => matchesStage(w, stage))
}

export function stageMix(workOrders) {
  const mix = {
    open: 0,
    assigned: 0,
    in_progress: 0,
    parts_hold: 0,
    deferred: 0,
    completed: 0,
    p1_aog: 0,
    total: workOrders.length,
  }
  for (const w of workOrders) {
    const dhlStatus = w.dhl_status || ''
    const dhlPriority = w.dhl_priority || ''
    const status = w.status || ''
    if (/^P1/i.test(dhlPriority)) mix.p1_aog += 1
    if (dhlStatus === 'Assigned') mix.assigned += 1
    if (dhlStatus === 'Parts Hold' || /parts hold/i.test(status)) mix.parts_hold += 1
    else if (/^P4/i.test(dhlPriority) || /deferred/i.test(dhlPriority)) mix.deferred += 1
    else if (dhlStatus === 'Closed' || status === 'Completed') mix.completed += 1
    else if (dhlStatus === 'In Progress' || dhlStatus === 'QA Review' || status === 'In Progress') {
      mix.in_progress += 1
    } else mix.open += 1
  }
  return mix
}

export function summarizeWo(w) {
  return {
    work_order: w.work_order_number || w.workorder_id,
    title: w.title,
    status: w.status,
    dhl_status: w.dhl_status,
    priority: w.priority,
    dhl_priority: w.dhl_priority,
    type: w.dhl_type || w.work_order_type,
    asset_id: w.asset_id,
    asset_name: w.asset_name,
    location: w.location_name,
    assigned_to: w.assigned_to_name,
    assigned_to_id: w.assigned_to_id,
    shift: w.shift,
    created: w.created_date,
    system: w.system,
    parts_needed: Array.isArray(w.parts_needed) ? w.parts_needed : [],
    synthetic: Boolean(w.synthetic || w.voice_volume),
  }
}

export function woSummaryText(w) {
  return [
    w.work_order_number || w.workorder_id,
    w.title,
    w.dhl_status || w.status,
    w.dhl_priority || w.priority,
    w.asset_name,
    w.asset_id,
    w.location_name,
    w.system,
    w.failure_code,
    w.assigned_to_name,
  ].filter(Boolean).join(' ')
}
