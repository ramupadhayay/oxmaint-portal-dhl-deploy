'use client'

// What people add during a demo, kept.
//
// The workbook is fixed — it is the customer's sample data and nothing here
// edits it. What has to survive a refresh is what somebody *does* in the
// meeting: the asset they register while talking about "unlimited assets", the
// job they raise against it, the person they add to the roster and the order
// they place. Those are the four writable records in this portal, so this store
// is deliberately smaller than the CMMS portal's rather than a copy of it.
//
// It writes through the same /api/oxmaint/records endpoint under its own kind.
// Sharing the endpoint means one persistence path to keep working; not sharing
// the kind means this plant and the other five portals' never appear in each
// other's registers — one collection, several customers, and the pack scope
// cannot tell them apart.
//
// Writes are optimistic. The row appears when the button is pressed and the
// request goes out behind it, because a demo where saving takes a visible second
// reads as a slow product. A failed write rolls the row back and says so, rather
// than leaving it looking saved.
//
// Without a database the portal still works: the API answers persisted:false,
// the registers fall back to the workbook alone, and creating a record reports
// that it was not saved. Nothing here assumes Mongo is reachable.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiUrl } from '@/lib/apiPath'

// Defaulted rather than null: a screen rendered outside the provider — which the
// portal check does for every page — should read as empty and read-only, not
// throw on the destructure.
const NO_STORE = {
  created: [], ready: false, persisted: null, toast: null,
  create: async () => null, notify: () => {},
}

// One factory, two stores. Assets were the only writable record until work
// orders gained a create flow, and a second copy of this file with one string
// changed is how the two drift apart — one gets an optimistic-rollback fix and
// the other quietly does not.
function makeRecordStore(KIND, { createdMessage, createdBy }) {
  const StoreContext = createContext(NO_STORE)

  function Provider({ children }) {
    const [created, setCreated] = useState([])
    const [ready, setReady] = useState(false)
    // Null until the first request answers. "Unknown" is not "offline", and no
    // banner should flash before we know which it is.
    const [persisted, setPersisted] = useState(null)
    const [toast, setToast] = useState(null)

    useEffect(() => {
      let live = true
      ;(async () => {
        try {
          const res = await fetch(apiUrl(`/api/oxmaint/records?kind=${KIND}`))
          const json = await res.json()
          if (!live) return
          setCreated((json.ok && json.records) || [])
          setPersisted(Boolean(json.ok && json.persisted))
        } catch {
          if (live) setPersisted(false)
        } finally {
          if (live) setReady(true)
        }
      })()
      return () => { live = false }
    }, [])

    const notify = useCallback((message, tone = 'ok') => {
      setToast({ message, tone, id: Date.now() })
      setTimeout(() => setToast(null), 3600)
    }, [])

    const create = useCallback(async (data) => {
      const temp = { ...data, recordId: `tmp_${Date.now().toString(36)}`, _pending: true }
      setCreated((p) => [temp, ...p])
      try {
        const res = await fetch(apiUrl('/api/oxmaint/records'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: KIND, data, createdByName: createdBy }),
        })
        const json = await res.json()
        if (!json.ok) throw new Error(json.error || 'Save failed')
        setCreated((p) => p.map((r) => (r.recordId === temp.recordId ? json.record : r)))
        notify(createdMessage)
        return json.record
      } catch (e) {
        setCreated((p) => p.filter((r) => r.recordId !== temp.recordId))
        notify(e.message || 'Could not save.', 'error')
        return null
      }
    }, [notify])

    const value = useMemo(
      () => ({ created, ready, persisted, create, notify, toast }),
      [created, ready, persisted, create, notify, toast]
    )

    return (
      <StoreContext.Provider value={value}>
        {children}
        {toast && <Toast toast={toast} />}
      </StoreContext.Provider>
    )
  }

  return { Provider, useStore: () => useContext(StoreContext) }
}

// The four writable records in this portal.
const assetStore = makeRecordStore('dna_asset', { createdMessage: 'Asset registered.', createdBy: 'DNA portal' })
export const AssetStoreProvider = assetStore.Provider
export const useAssetStore = assetStore.useStore

const workOrderStore = makeRecordStore('dna_work_order', { createdMessage: 'Work order raised.', createdBy: 'DNA portal' })
export const WorkOrderStoreProvider = workOrderStore.Provider
export const useWorkOrderStore = workOrderStore.useStore

const memberStore = makeRecordStore('dna_member', { createdMessage: 'Team member added.', createdBy: 'DNA portal' })
export const MemberStoreProvider = memberStore.Provider
export const useMemberStore = memberStore.useStore

const purchaseOrderStore = makeRecordStore('dna_purchase_order', { createdMessage: 'Purchase order raised.', createdBy: 'DNA portal' })
export const PurchaseOrderStoreProvider = purchaseOrderStore.Provider
export const usePurchaseOrderStore = purchaseOrderStore.useStore

/**
 * The next id in the workbook's own sequence.
 *
 * The register runs AST-1001 to AST-1703 with gaps between the blocks — 1001 for
 * spinning, 1201 for weaving, 1501 for utilities. A new asset continues from the
 * highest number rather than restarting, so it sorts and reads like the
 * twenty-six beside it instead of announcing itself as the one somebody added in
 * a meeting.
 */
export function nextAssetId(existing = []) {
  const highest = existing.reduce((max, a) => {
    const n = Number(String(a.assetId || '').replace(/\D/g, ''))
    return Number.isFinite(n) && n > max ? n : max
  }, 1000)
  return `AST-${highest + 1}`
}

/**
 * The next work order number in the workbook's own sequence.
 *
 * Its jobs run WO-2001 to WO-2015, so a job raised in a demo continues from the
 * highest rather than restarting at 1 — the number a presenter reads out should
 * look like the fifteen above it.
 */
export function nextWorkOrderNo(existing = []) {
  const highest = existing.reduce((max, w) => {
    const n = Number(String(w.woNo || '').replace(/\D/g, ''))
    return Number.isFinite(n) && n > max ? n : max
  }, 2000)
  return `WO-${highest + 1}`
}

/**
 * The next user id on the roster.
 *
 * The workbook runs USR-01 to USR-10 and pads to two digits, so a person added
 * in a demo keeps that shape rather than appearing as USR-11 beside USR-01.
 */
export function nextUserId(existing = []) {
  const highest = existing.reduce((max, u) => {
    const n = Number(String(u.userId || '').replace(/\D/g, ''))
    return Number.isFinite(n) && n > max ? n : max
  }, 0)
  return `USR-${String(highest + 1).padStart(2, '0')}`
}

/**
 * The next purchase order number in the workbook's own sequence.
 *
 * Its orders run PO-3001 to PO-3015, so one raised in a demo continues from the
 * highest rather than restarting — a presenter reading "PO-3016" out loud should
 * sound like the fifteen above it.
 */
export function nextPoNo(existing = []) {
  const highest = existing.reduce((max, p) => {
    const n = Number(String(p.poNo || '').replace(/\D/g, ''))
    return Number.isFinite(n) && n > max ? n : max
  }, 3000)
  return `PO-${highest + 1}`
}

function Toast({ toast }) {
  const bad = toast.tone === 'error'
  return (
    <div style={{
      position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 500,
      padding: '10px 16px', borderRadius: 10, fontSize: 12.5, fontWeight: 600,
      color: '#fff', background: bad ? '#dc2626' : '#0f172a',
      boxShadow: '0 8px 24px rgba(15,23,42,0.25)',
    }}>{toast.message}</div>
  )
}
