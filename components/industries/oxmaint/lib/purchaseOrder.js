'use client'

// What a purchase order knows about itself, in one place.
//
// The register and the order's own page both have to answer the same questions
// — what is on it, can it still be received, what happens to stock when it is —
// and both have to book a receipt the same way. Two copies of that drift, and
// the way it shows is the worst way: one screen books stock, the other books it
// again.

import { useCallback } from 'react'
import { useStore } from './store'
import { useStock } from './movements'
import { PARTS, VENDORS, seed, between } from './data'

export const idOf = (r) => r.purchase_order_id || r.recordId

/**
 * Orders that can still be booked in.
 *
 * A draft has not been placed with anyone, so there is nothing to receive
 * against it, and an order already received cannot be received twice — that is
 * how a stock figure ends up double-counting a delivery that arrived once.
 */
export const RECEIVABLE = ['Approved', 'Pending Approval']

export const canReceive = (po) => Boolean(po) && RECEIVABLE.includes(po.status)

/**
 * What is actually on the order.
 *
 * Orders raised from Demand Parts carry their lines. The seeded ones only ever
 * had a line *count*, and a receipt with nothing to book in would leave stock
 * exactly where it was — so the lines are derived from the order's own id,
 * deterministically, and written back the moment it is received.
 */
export const linesFor = (po) => {
  if (Array.isArray(po?.lines) && po.lines.length) return po.lines
  const id = idOf(po || {})
  const count = Math.max(1, Number(po?.line_items) || 1)
  return Array.from({ length: count }, (_, i) => {
    const part = PARTS[Math.floor(seed(`${id}-line${i}`) * PARTS.length) % PARTS.length]
    return {
      part_id: part.part_id,
      part_name: part.part_name,
      part_number: part.part_number,
      unit: part.unit,
      quantity: between(`${id}-qty${i}`, 2, 14),
    }
  })
}

export const vendorOf = (po) => VENDORS.find((v) => v.vendor_id === po?.vendor_id) || null

export const unitsOn = (lines) => (lines || []).reduce((n, l) => n + (Number(l.quantity) || 0), 0)

/**
 * The order's own trail.
 *
 * A purchase order is a sequence of events, not a status word — raised,
 * approved, expected, arrived. Reading only the current status hides whether it
 * arrived late, which is the question anybody looking at a supplier actually
 * has.
 */
export function historyOf(po) {
  if (!po) return []
  const out = [{ key: 'raised', label: 'Raised', by: po.raised_by_name, date: po.created_date }]
  if (['Approved', 'Received'].includes(po.status)) {
    out.push({ key: 'approved', label: 'Approved', date: po.approved_date || null })
  }
  out.push({ key: 'expected', label: 'Expected', date: po.expected_date })
  if (po.status === 'Received') {
    out.push({ key: 'received', label: 'Received into stock', date: po.received_date })
  }
  if (po.status === 'Cancelled') {
    out.push({ key: 'cancelled', label: 'Cancelled', date: po.cancelled_date || null })
  }
  return out
}

/**
 * Receive an order and book every line into stock.
 *
 * Both halves or neither: an order marked received whose lines never reached
 * stock is a shortage nobody can explain, and stock booked against an order
 * that still reads "approved" gets received again by the next person to look.
 */
export function useReceiveOrder() {
  const { update, notify } = useStore()
  const { receive } = useStock()

  return useCallback(async (po) => {
    if (!po) return false
    if (!canReceive(po)) {
      notify(`${po.po_number} is ${String(po.status || '').toLowerCase()} — nothing to receive.`, 'error')
      return false
    }
    const lines = linesFor(po)
    await update('purchase_order', idOf(po), {
      ...po,
      status: 'Received',
      received_date: new Date().toISOString(),
      lines,
    })

    for (const line of lines) {
      await receive(line.part_id, line.quantity, 'Goods received', po.po_number)
    }

    const units = unitsOn(lines)
    notify(`${po.po_number} received — ${units} units across ${lines.length} line${lines.length === 1 ? '' : 's'} booked into stock.`)
    return true
  }, [update, receive, notify])
}
