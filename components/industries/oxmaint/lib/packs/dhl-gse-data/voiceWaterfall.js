/**
 * Monthly waterfall on the CVG voice register.
 *
 * Stages are a supervisor reading of the statuses the shop already uses —
 * Assigned, Parts Hold, In Progress, QA Review, Closed — plus origin,
 * planned start/finish, scope variation, and archive. Not a second status set.
 * Synthetic Oxmaint AI projection, not live airline data.
 */

export const WATERFALL_HONESTY =
  'Synthetic Oxmaint AI projection of the monthly work-order waterfall — not live airline or production SAP data.'

export const WATERFALL_STAGES = [
  {
    key: 'planning',
    label: 'Planning originated',
    shop_status: 'Assigned',
    how_to_read:
      'Job is raised from the PM plan or from an unplanned notification. Planning component is on file; kit and crew start are not locked.',
  },
  {
    key: 'parts_ready',
    label: 'Parts ready',
    shop_status: 'Assigned',
    how_to_read: 'All components reserved / kit complete. Waiting on a crew slot.',
  },
  {
    key: 'parts_short',
    label: 'Parts short',
    shop_status: 'Parts Hold',
    how_to_read: 'Short or on-order lines. Raise or follow a PR → PO → GR on the SAP MM demo mirror.',
  },
  {
    key: 'manpower',
    label: 'Manpower planned',
    shop_status: 'Assigned',
    how_to_read: 'Assignee plus planned start and finish. On the week capacity board.',
  },
  {
    key: 'in_flow',
    label: 'In flow',
    shop_status: 'In Progress',
    how_to_read: 'Open on the floor. Includes Deferred (P4) and jobs with scope variation.',
  },
  {
    key: 'review',
    label: 'Technical / supervisor review',
    shop_status: 'QA Review',
    how_to_read: 'Work done, waiting on the supervisor technical close.',
  },
  {
    key: 'completed',
    label: 'Completed',
    shop_status: 'Closed',
    how_to_read: 'Closed this period, not yet archived.',
  },
  {
    key: 'archived',
    label: 'Archived',
    shop_status: 'Closed',
    how_to_read: 'Fully done, archived flag and date on the record.',
  },
]

const KEYS = new Set(WATERFALL_STAGES.map((s) => s.key))

export function normalizeWaterfallStage(raw) {
  const key = String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (KEYS.has(key)) return key
  if (key === 'planned' || key === 'still_in_planning' || key === 'planning_originated') return 'planning'
  if (key === 'kit_complete' || key === 'parts_complete' || key === 'ready_for_crew') return 'parts_ready'
  if (key === 'parts_hold' || key === 'need_pr' || key === 'waiting_on_material' || key === 'short') return 'parts_short'
  if (key === 'manpower_planned' || key === 'crew_planned' || key === 'assigned') return 'manpower'
  if (key === 'in_progress' || key === 'progress' || key === 'on_the_floor') return 'in_flow'
  if (key === 'deferred' || key === 'p4') return 'deferred'
  if (key === 'qa_review' || key === 'technical_review' || key === 'supervisor_close' || key === 'awaiting_review') return 'review'
  if (key === 'closed' || key === 'done') return 'completed'
  if (key === 'variation' || key === 'scope_variation') return 'variation'
  return key
}

export function waterfallStageOf(wo = {}) {
  if (wo.waterfall || wo.Waterfall) {
    const stored = normalizeWaterfallStage(wo.waterfall || wo.Waterfall)
    if (KEYS.has(stored)) return stored
  }
  const status = wo.dhl_status || wo.Status || ''
  const archived = wo.archived || wo.Archived === 'Yes'
  if (status === 'Closed' || wo.status === 'Completed') return archived ? 'archived' : 'completed'
  if (status === 'QA Review') return 'review'
  if (status === 'Parts Hold') return 'parts_short'
  if (status === 'In Progress') return 'in_flow'
  if (status === 'Assigned') {
    if (wo.planned_start || wo.PlannedStart) return 'manpower'
    const parts = wo.parts_needed || wo.PartsNeeded || []
    const ready = parts.length && parts.every((p) => p.status === 'reserved' || p.status === 'needed' || p.status === 'planned' || p.status === 'received')
    const short = parts.some((p) => p.status === 'short' || p.status === 'on_order')
    if (short) return 'parts_short'
    if (ready) return 'parts_ready'
    return 'planning'
  }
  return 'planning'
}

export function matchesWaterfall(wo, stage) {
  const key = normalizeWaterfallStage(stage)
  if (!key || key === 'all') return true
  if (key === 'deferred' || key === 'p4') {
    return /^P4/i.test(wo.dhl_priority || wo.Priority || '')
  }
  if (key === 'variation' || key === 'scope_variation') {
    return Boolean(wo.scope_variation || wo.ScopeVariation === 'Yes')
  }
  if (key === 'need_pr') {
    const short = waterfallStageOf(wo) === 'parts_short'
    const pr = wo.procurement?.pr || wo.Procurement?.pr
    return short && !pr
  }
  return waterfallStageOf(wo) === key
}

function originOf(row) {
  const type = row.Type || row.dhl_type || row.work_order_type
  if (type === 'Preventive' || type === 'Preventive') return 'plan'
  return 'notification'
}

export function applyWaterfallSignals(out) {
  for (let i = 0; i < out.length; i += 1) {
    const row = out[i]
    const origin = row.Type === 'Preventive' ? 'plan' : 'notification'
    row.Origin = origin
    row.ScopeVariation = 'No'
    row.VariationNote = ''
    row.Archived = 'No'
    row.ArchivedAt = ''
    row.PlannedStart = ''
    row.PlannedFinish = ''

    const activities = [
      {
        code: origin === 'plan' ? 'PM-PLAN' : 'NOTIF',
        name: origin === 'plan' ? 'Lock PM scope from the plan' : 'Raise from notification / defect',
        planned_hours: row.EstHours,
      },
    ]

    if (row.Status === 'Assigned') {
      if (i < 10) {
        row.Waterfall = 'manpower'
        row.PlannedStart = row.CreatedAt
        row.PlannedFinish = row.ClosedAt || row.CreatedAt
      } else if (i < 22) {
        row.Waterfall = 'planning'
      } else {
        row.Waterfall = 'parts_ready'
      }
    } else if (row.Status === 'Parts Hold') {
      row.Waterfall = 'parts_short'
    } else if (row.Status === 'In Progress') {
      row.Waterfall = 'in_flow'
      row.PlannedStart = row.CreatedAt
      row.PlannedFinish = row.ClosedAt || row.CreatedAt
      if (i % 5 === 0) {
        row.ScopeVariation = 'Yes'
        row.VariationNote = 'Actual activities ran past the plan — extra op and hours overrun.'
        row.LaborHours = Number((Number(row.EstHours || 2) * 1.35).toFixed(2))
        activities.push({
          code: 'VAR',
          name: 'Added inspection / extra component after open',
          planned_hours: 0.8,
        })
        if ((row.PartsNeeded || []).length) {
          row.PartsNeeded = [
            ...row.PartsNeeded,
            {
              sku: 'GRS-MP2',
              name: 'Multipurpose lithium grease (tube)',
              qty: 1,
              status: 'needed',
              reserved: true,
              plant: 'CVG1',
              storage_location: '0001',
              sap_material: '4000000009',
              added_in_variation: true,
            },
          ]
        }
      }
    } else if (row.Status === 'QA Review') {
      row.Waterfall = 'review'
      row.PlannedStart = row.CreatedAt
      row.PlannedFinish = row.ClosedAt || row.CreatedAt
    } else if (row.Status === 'Closed') {
      const recent = row._voiceWeek && i % 4 === 0
      row.Waterfall = recent ? 'completed' : 'archived'
      row.Archived = recent ? 'No' : 'Yes'
      row.ArchivedAt = recent ? '' : (row.ClosedAt || row.CreatedAt)
      if (row._voiceWeek && i % 11 === 0) {
        row.ScopeVariation = 'Yes'
        row.VariationNote = 'Closed with extra labour against the planned hours.'
        row.LaborHours = Number((Number(row.EstHours || 2) * 1.25).toFixed(2))
      }
    } else {
      row.Waterfall = 'planning'
    }

    row.Planning = {
      origin,
      plan_id: origin === 'plan' ? (row.TemplateID || `PLAN-V-${row.WorkOrderID}`) : null,
      notification: row.SAPNotif,
      activities,
    }
  }
}

function plannedUnplanned(items) {
  let planned = 0
  let unplanned = 0
  for (const w of items) {
    const origin = w.origin || w.Origin || originOf(w)
    if (origin === 'plan') planned += 1
    else unplanned += 1
  }
  return { planned, unplanned }
}

function weekdayOf(iso) {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  return new Date(t).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
}

export function computeWaterfall(workOrders = []) {
  const items = workOrders || []
  const byStage = {}
  for (const s of WATERFALL_STAGES) byStage[s.key] = []
  const variation = []
  const deferred = []
  const needPr = []
  for (const w of items) {
    const stage = waterfallStageOf(w)
    if (byStage[stage]) byStage[stage].push(w)
    if (w.scope_variation || w.ScopeVariation === 'Yes') variation.push(w)
    if (/^P4/i.test(w.dhl_priority || w.Priority || '')) deferred.push(w)
    const short = stage === 'parts_short'
    const pr = w.procurement?.pr || w.Procurement?.pr
    if (short && !pr) needPr.push(w)
  }

  const stages = WATERFALL_STAGES.map((s) => {
    const list = byStage[s.key] || []
    const split = plannedUnplanned(list)
    return {
      key: s.key,
      label: s.label,
      shop_status: s.shop_status,
      count: list.length,
      planned: split.planned,
      unplanned: split.unplanned,
      how_to_read: s.how_to_read,
    }
  })

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const byDay = new Map(days.map((d) => [d, { day: d, jobs: 0, hours: 0 }]))
  for (const w of items) {
    const stage = waterfallStageOf(w)
    if (stage !== 'manpower' && stage !== 'in_flow' && stage !== 'review') continue
    const day = weekdayOf(w.planned_start || w.PlannedStart || w.created_date || w.CreatedAt)
    if (!day || !byDay.has(day)) continue
    const row = byDay.get(day)
    row.jobs += 1
    row.hours += Number(w.estimated_hours || w.EstHours || 0)
  }

  return {
    honesty: WATERFALL_HONESTY,
    stages,
    highlights: {
      need_pr: needPr.length,
      variation: variation.length,
      review: (byStage.review || []).length,
      deferred: deferred.length,
      parts_short: (byStage.parts_short || []).length,
      parts_ready: (byStage.parts_ready || []).length,
      planning: (byStage.planning || []).length,
      manpower: (byStage.manpower || []).length,
    },
    manpower: {
      by_day: days.map((d) => {
        const row = byDay.get(d)
        return { day: d, jobs: row.jobs, hours: Math.round(row.hours * 10) / 10 }
      }),
      how_to_read:
        'Jobs in manpower planned, in flow, or review, grouped by planned start weekday. Synthetic capacity hint, not a live roster.',
    },
    glossary: WATERFALL_STAGES,
    how_to_read:
      'Six-step shop waterfall on the existing statuses. Planning / parts-ready / manpower are Assigned with different locks. Parts short is Parts Hold. In flow is In Progress (Deferred is P4 inside it). Review is QA Review. Completed vs archived splits Closed.',
  }
}

export const WATERFALL_NEXT = {
  planning: 'parts_ready',
  parts_ready: 'manpower',
  parts_short: 'parts_ready',
  manpower: 'in_flow',
  in_flow: 'review',
  review: 'completed',
  completed: 'archived',
}

export function patchForWaterfallAdvance(from, to) {
  const dest = normalizeWaterfallStage(to || WATERFALL_NEXT[from] || from)
  const patch = { waterfall: dest }
  if (dest === 'planning') {
    patch.dhl_status = 'Assigned'
    patch.status = 'Open'
    patch.planned_start = null
  } else if (dest === 'parts_ready') {
    patch.dhl_status = 'Assigned'
    patch.status = 'Open'
  } else if (dest === 'parts_short') {
    patch.dhl_status = 'Parts Hold'
    patch.status = 'On Hold'
  } else if (dest === 'manpower') {
    patch.dhl_status = 'Assigned'
    patch.status = 'Open'
  } else if (dest === 'in_flow') {
    patch.dhl_status = 'In Progress'
    patch.status = 'In Progress'
  } else if (dest === 'review') {
    patch.dhl_status = 'QA Review'
    patch.status = 'In Progress'
  } else if (dest === 'completed') {
    patch.dhl_status = 'Closed'
    patch.status = 'Completed'
    patch.archived = false
  } else if (dest === 'archived') {
    patch.dhl_status = 'Closed'
    patch.status = 'Completed'
    patch.archived = true
    patch.archived_at = new Date().toISOString()
  }
  return { dest, patch }
}
