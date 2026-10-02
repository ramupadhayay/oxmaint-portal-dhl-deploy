/**
 * Process-local overlays for the DHL voice call.
 * Store updates (parts received) mutate a named WO for this process only.
 */

const overlays = new Map()

export function resetVoiceOverlays() {
  overlays.clear()
}

export function applyWorkOrderOverlay(id, patch) {
  const key = String(id || '')
  if (!key) return null
  const prev = overlays.get(key) || {}
  const next = { ...prev, ...patch }
  if (patch.parts_needed && prev.parts_needed) {
    next.parts_needed = patch.parts_needed
  }
  overlays.set(key, next)
  return next
}

export function overlayWorkOrders(workOrders) {
  if (!overlays.size) return workOrders || []
  return (workOrders || []).map((w) => {
    const id = w.work_order_number || w.workorder_id
    const patch = overlays.get(id)
    if (!patch) return w
    return { ...w, ...patch }
  })
}

export function getOverlay(id) {
  return overlays.get(String(id || '')) || null
}
