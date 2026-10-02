'use client'

// What people do in this portal, kept.
//
// The workbooks are fixed — they are the client's illustrative data and nothing
// here edits them. What has to survive a refresh is what someone *does* during
// a demo: the work order they raise off an alert. That is the only writable
// record in this portal, so this store is deliberately smaller than the CMMS
// portal's rather than a copy of it.
//
// It writes through the same /api/oxmaint/records endpoint under its own kind.
// Sharing the endpoint means one persistence path to keep working; not sharing
// the kind means this portal's plant and the CMMS portal's never appear in each
// other's lists.
//
// One factory, two stores. Work orders were the only writable record until the
// Inspection module gained its create flow, and a second copy of this file with
// three strings changed is how the two drift — one gets an optimistic rollback
// fix and the other does not. `makeRecordStore` is the whole store; the two
// exports below are it, bound to their kind.
//
// Writes are optimistic — the row appears when the button is pressed and the
// request goes out behind it, because a demo where saving takes a visible
// second reads as a slow product. A failed write rolls the row back and says
// so, rather than leaving it looking saved.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiUrl } from '@/lib/apiPath'

// Defaulted rather than null: a screen rendered outside the provider — which
// the portal check does for every page — should read as empty and read-only,
// not throw on the destructure.
const NO_STORE = {
  created: [], ready: false, persisted: null, toast: null,
  create: async () => null, update: async () => null, remove: async () => false, notify: () => {},
}

function makeRecordStore(KIND, { createdMessage }) {
  const StoreContext = createContext(NO_STORE)

  function Provider({ children }) {
    const [created, setCreated] = useState([])
    const [ready, setReady] = useState(false)
    // Null until the first request answers. "Unknown" is not "offline", and the
    // banner must not flash before we know which it is.
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
          body: JSON.stringify({ kind: KIND, data, createdByName: 'PoC portal' }),
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

    const update = useCallback(async (recordId, patch) => {
      const before = created
      setCreated((p) => p.map((r) => (r.workOrderId === recordId || r.recordId === recordId ? { ...r, ...patch } : r)))
      try {
        const res = await fetch(apiUrl('/api/oxmaint/records'), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: KIND, recordId, data: patch }),
        })
        const json = await res.json()
        if (!json.ok) throw new Error(json.error || 'Save failed')
        setCreated((p) => p.map((r) => (r.recordId === recordId ? json.record : r)))
        notify('Updated.')
        return json.record
      } catch (e) {
        setCreated(before)
        notify(e.message || 'Could not save.', 'error')
        return null
      }
    }, [created, notify])

    // Remove one record raised in the portal. Only records created here are in
    // the database, so this is how the test rows an operator adds during a demo
    // come back out — the seeded plant has no delete because it was never a row.
    const remove = useCallback(async (recordId) => {
      const before = created
      setCreated((p) => p.filter((r) => r.recordId !== recordId))
      try {
        const res = await fetch(apiUrl(`/api/oxmaint/records?kind=${KIND}&recordId=${encodeURIComponent(recordId)}`), { method: 'DELETE' })
        const json = await res.json()
        if (!json.ok) throw new Error(json.error || 'Delete failed')
        notify('Deleted.')
        return true
      } catch (e) {
        setCreated(before)
        notify(e.message || 'Could not delete.', 'error')
        return false
      }
    }, [created, notify])

    const value = useMemo(
      () => ({ created, ready, persisted, create, update, remove, notify, toast }),
      [created, ready, persisted, create, update, remove, notify, toast])

    return (
      <StoreContext.Provider value={value}>
        {children}
        {toast && <Toast toast={toast} />}
      </StoreContext.Provider>
    )
  }

  return { Provider, useStore: () => useContext(StoreContext) }
}

// The two writable records in this portal.
const workOrders = makeRecordStore('datacenter_work_order', { createdMessage: 'Work order raised.' })
export const WorkOrderStoreProvider = workOrders.Provider
export const useWorkOrderStore = workOrders.useStore

const inspections = makeRecordStore('datacenter_inspection', { createdMessage: 'Inspection created.' })
export const InspectionStoreProvider = inspections.Provider
export const useInspectionStore = inspections.useStore

const checklists = makeRecordStore('datacenter_checklist', { createdMessage: 'Checklist saved.' })
export const ChecklistStoreProvider = checklists.Provider
export const useChecklistStore = checklists.useStore

// The auditor's closed loop writes here: one overlay row per risk, carrying the
// work order it was linked to and the resolution logged against it. Keyed by the
// finding's own recId so a seeded finding can be worked without copying the
// workbook into the database — the API upserts on that id.
const risks = makeRecordStore('datacenter_risk', { createdMessage: 'Risk updated.' })
export const RiskStoreProvider = risks.Provider
export const useRiskStore = risks.useStore

// The Teams and Document-Intelligence modules — a crew added to the roster, a
// document added to the library. Same optimistic create/persist path as the
// rest, under their own kinds.
const teams = makeRecordStore('datacenter_team', { createdMessage: 'Team added.' })
export const TeamStoreProvider = teams.Provider
export const useTeamStore = teams.useStore

const documents = makeRecordStore('datacenter_document', { createdMessage: 'Document added.' })
export const DocumentStoreProvider = documents.Provider
export const useDocumentStore = documents.useStore

// Assets bulk-uploaded into the register. Same optimistic create/persist path;
// its own kind so the register can merge uploads over the seeded scope matrix.
const assets = makeRecordStore('datacenter_asset', { createdMessage: 'Assets uploaded.' })
export const AssetStoreProvider = assets.Provider
export const useAssetStore = assets.useStore

// A correlation logged on the Correlation Analytics screen — an engineer tying
// an alert to what they physically found. Its own kind so it merges over the
// seeded correlation log without touching the workbook.
const correlations = makeRecordStore('datacenter_correlation', { createdMessage: 'Correlation logged.' })
export const CorrelationStoreProvider = correlations.Provider
export const useCorrelationStore = correlations.useStore

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
