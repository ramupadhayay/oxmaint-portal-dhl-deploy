'use client'

// Actions that cross module boundaries.
//
// Four screens now raise a work order: a PM schedule generating its next job, a
// failed inspection raising the corrective work, an approved maintenance
// request becoming real work, and an asset marked down. If each built the
// record itself there would be four slightly different work orders in the
// system — one missing a site, one with a number in a different format, one
// that never appears under the site filter — and the bug would only show up on
// whichever screen someone happened to open.
//
// So the shape is defined once, here, and the callers only say why.

import { useCallback } from 'react'
import { useStore } from './store'
import { ASSETS, TECHNICIANS, USER, WORK_ORDERS, daysFrom, OPEN_STATUS } from './data'

const nextNumber = (existing) => {
  // Continue the register's own numbering rather than starting a second scheme.
  // A pack whose jobs read WO-2026-00875 gets WO-2026-00876; one whose jobs read
  // WO-2683 gets WO-2684. A job raised here that is numbered unlike every job
  // beside it announces itself as the demo's, which is the one thing a work
  // order number should never do.
  const numbers = existing.map((w) => String(w.work_order_number || '')).filter(Boolean)
  const dated = numbers.filter((s) => /^WO-\d{4}-\d+$/.test(s))
  if (dated.length) {
    const year = dated.reduce((y, s) => Math.max(y, Number(s.slice(3, 7))), 0)
    const width = dated[0].split('-')[2].length
    const highest = dated
      .filter((s) => Number(s.slice(3, 7)) === year)
      .reduce((max, s) => Math.max(max, Number(s.split('-')[2])), 0)
    return `WO-${year}-${String(highest + 1).padStart(width, '0')}`
  }
  const highest = numbers.reduce((max, s) => {
    const n = Number(s.replace(/\D/g, ''))
    return Number.isFinite(n) && n > max ? n : max
  }, 2683)
  return `WO-${highest + 1}`
}

/** The technician best placed to pick a job up: right trade, least loaded. */
export function suggestAssignee(trade, openWork = WORK_ORDERS) {
  const live = openWork.filter((w) => OPEN_STATUS.includes(w.status))
  const load = (name) => live.filter((w) => w.assigned_to_name === name).length
  const pool = TECHNICIANS.filter((t) => t.role !== 'Administrator' && (!trade || t.trade === trade))
  const from = pool.length ? pool : TECHNICIANS.filter((t) => t.role !== 'Administrator')
  return [...from].sort((a, b) => load(a.name) - load(b.name))[0]?.name || ''
}

export function useActions() {
  const store = useStore()
  const existing = store?.records?.work_order || []

  /**
   * Raise a work order from somewhere else in the product.
   *
   * `source` is kept on the record so the work order can say what created it —
   * a generated job with no explanation is the thing maintenance planners
   * distrust most about automated CMMS.
   */
  const raiseWorkOrder = useCallback(async ({
    title, description, assetId, type = 'Corrective', priority = 'Medium',
    dueInDays = 7, assignedTo, estimatedHours = 2, source, sourceId, asset: given,
  }) => {
    // Assets created in the portal are not in the seeded array, so look there
    // too — otherwise a work order raised against a new asset arrives with no
    // name and no site, and never appears under the site filter.
    const stored = store?.records?.asset || []
    const asset = given
      || ASSETS.find((a) => a.asset_id === assetId)
      || stored.find((a) => (a.asset_id || a.recordId) === assetId)
    const number = nextNumber([...existing, ...WORK_ORDERS])

    return store?.create('work_order', {
      work_order_number: number,
      title,
      description: description || `${title} on ${asset?.asset_name || 'the asset'}.`,
      status: 'Open',
      priority,
      work_order_type: type,
      asset_id: assetId || '',
      asset_name: asset?.asset_name || '—',
      asset_code: asset?.asset_code || '',
      site_id: asset?.site_id || '',
      site_name: asset?.site_name || '',
      location_name: asset?.functional_location_name || '',
      assigned_to_name: assignedTo || suggestAssignee(null, [...existing, ...WORK_ORDERS]),
      created_by_name: USER.name,
      created_date: daysFrom(0),
      due_date: daysFrom(dueInDays),
      completed_date: null,
      estimated_hours: estimatedHours,
      actual_hours: null,
      downtime_hours: 0,
      total_cost: 0,
      raised_from: source || '',
      // The id of whatever raised it, when the caller knows one. `raised_from`
      // is a sentence for a reader and stops matching the moment that thing is
      // renamed; this is what a record page joins on.
      raised_from_id: sourceId ? String(sourceId) : '',
    })
  }, [store, existing])

  return { raiseWorkOrder, suggestAssignee }
}
