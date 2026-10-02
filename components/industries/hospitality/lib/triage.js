// Turning a request into a work order.
//
// Lives here rather than on a screen because two screens now do it — the queue
// and the request's own page — and two copies of a write that raises a work
// order *and* marks the request converted would eventually disagree about one
// of the two. A request marked converted with no job behind it is the gap that
// loses a guest complaint, and it is exactly the gap a second implementation
// drifts into.

import { CREW, USER } from './data'

/** How long a job of this priority gets before it is late. */
const DUE_DAYS = { Critical: 1, High: 2, Medium: 3, Low: 7 }

const idOf = (r) => r.request_id || r.recordId

/**
 * Raise the work order and mark the request converted, in that order.
 *
 * The order matters: if the create fails the request is left open and somebody
 * tries again, which is recoverable. Marked converted first, a failed create
 * would leave a request that says it was handled and a job that never existed.
 *
 * @returns the work order number, or null if it could not be written
 */
export async function convertRequest(r, { create, update, ready }) {
  if (!ready || !create || !update || !r) return null

  const number = `WO-${9000 + Math.floor(Math.random() * 900)}`
  const days = DUE_DAYS[r.priority] ?? 3

  const wo = await create('hosp_work_order', {
    work_order_number: number,
    // The seeded rows carry the suite in the title, so one raised here reads
    // like the ones beside it rather than announcing itself as new.
    title: r.suite_number ? `Suite ${r.suite_number} — ${r.title}` : r.title,
    description: `Raised from ${r.request_number} (${r.source}).`,
    status: 'Open',
    priority: r.priority,
    work_order_type: 'Guest request',
    asset_name: r.suite_number ? `Suite ${r.suite_number}` : r.location_name,
    suite_number: r.suite_number || null,
    location_name: r.location_name,
    assigned_to_name: CREW[0]?.name || USER.name,
    created_by_name: USER.name,
    created_date: new Date().toISOString(),
    due_date: new Date(Date.now() + 86400000 * days).toISOString(),
    estimated_hours: 1,
    total_cost: 0,
  })
  if (!wo) return null

  update('hosp_request', idOf(r), {
    recordId: idOf(r),
    status: 'Converted',
    work_order_number: number,
    converted_by: USER.name,
  })

  return number
}

export function rejectRequest(r, { update, ready }) {
  if (!ready || !update || !r) return false
  update('hosp_request', idOf(r), {
    recordId: idOf(r),
    status: 'Rejected',
    closed_by: USER.name,
  })
  return true
}
