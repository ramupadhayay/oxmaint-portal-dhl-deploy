// GET /api/hepa/sap/work-orders — the maintenance orders.
//
// Filterable by order class (PM01/PM02/PM04) and by the equipment it hangs off,
// which is how a planner queries IW39. The system status is computed the same
// way the Work Orders screen computes it — from the certification record the job
// produced — and then written as an SAP status code, because that is what SAP
// would carry rather than our word for it.

import {
  workOrders, documents, orderOf, latency, many, one, sapError,
} from '../_gateway'
import { workOrderStatus } from '@/components/industries/hepa/lib/data/index.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  const { searchParams } = request.nextUrl
  const order = searchParams.get('order')
  const orderType = searchParams.get('orderType')
  const equipment = searchParams.get('equipment')

  await latency(240)

  const docs = documents()
  const statusOf = (w) => workOrderStatus(docs.find((d) => d.documentRef === w.documentRef) || null)

  const rows = workOrders()

  if (order) {
    const w = rows.find((x) => x.workOrderId === order)
    if (!w) return sapError('ZHEPA/NOT_FOUND', `No maintenance order ${order}.`, 404)
    return one(orderOf(w, statusOf(w)), { type: 'ZHEPA.MaintenanceOrder' })
  }

  const filtered = rows.filter((w) => {
    if (orderType && w.orderClass !== orderType) return false
    if (equipment && w.sapEquipmentId !== equipment) return false
    return true
  })

  return many(filtered.map((w) => orderOf(w, statusOf(w))), 'ZHEPA.MaintenanceOrder')
}
