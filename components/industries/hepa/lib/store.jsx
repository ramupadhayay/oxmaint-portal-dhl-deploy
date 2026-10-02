'use client'

// The bridge between the workbook and the database.
//
// Two things share one list on every screen: the filters, tests and documents
// that ship in the bundle, and whatever anyone has created or changed since.
// This is the only place that knows how to put them together, so no screen has
// to.
//
// The merge rule is simple and matters: a stored record with the same id as a
// seeded one *replaces* it. That is what lets a seeded work order be closed,
// reassigned or edited without first copying the whole plant into Mongo — the
// database only ever holds the delta.
//
// Writes are optimistic. The row appears the moment the button is pressed and
// the request goes out behind it, because a demo where a save takes a visible
// second reads as a slow product. If the write fails the row is rolled back and
// the caller is told, rather than left looking saved.

import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react'
import { USER } from './data'
import { apiUrl } from '@/lib/apiPath'

// This portal's own record kinds, all prefixed.
//
// The CMMS portal and this one run in the same deployment and share one
// collection, and the API scopes records by the data pack the *server* is
// running — which is the CMMS portal's pack, not this portal's. So the pack
// scope cannot tell these apart, and a work order raised here would surface in
// the CMMS portal's list against an asset it has never heard of.
//
// The FSM portal hit this first and answered it the same way, for the same
// reason its comment gives: two portals show different plants, and a row from
// one appearing in the other's list is a leak between customers rather than a
// merge. A prefix per portal is what keeps the registers apart.
// This portal's own record kinds, all prefixed.
//
// Four portals share one collection and the API scopes rows by the data pack
// the *server* runs, which is the CMMS portal's — so the pack scope cannot tell
// them apart. A prefix per portal is what keeps a HEPA approval out of a hotel's
// register. Same answer the FSM and hospitality portals reached.
const KINDS = [
  // A review decision or an electronic signature against a document. The
  // signature is the record 21 CFR Part 11 is about, so it is stored rather
  // than held in a component's state.
  'hepa_signature',
  // Every creation, routing, review and signature event, appended and never
  // edited — the audit trail the same regulation requires.
  'hepa_audit',
  // A legal hold placed on a record, which overrides its retention expiry.
  'hepa_hold',
  // The SAP gateway's own record of what it confirmed. Written by the API
  // route, not by a screen — the screens read it back through this store so a
  // confirmation posted in one tab is visible in another.
  'hepa_sap_sync',
  // A work order raised in this portal rather than imported from SAP. Its own
  // kind so a created order never masquerades as one of theirs.
  'hepa_work_order',
  // A maintenance request raised from a condition on the register.
  'hepa_request',
  // A completed run of a test or changeover checklist.
  'hepa_checklist_run',
  // An incident raised against a cleanroom, and the investigation that followed
  // it. Listed here rather than only in the API's table because the fetch on
  // page load only asks for the kinds named above — a kind left out is a record
  // that saves, disappears on reload, and looks like a database that dropped it.
  'hepa_incident',
  // A round walked, and a reminder rolled forward. Same kind, as the product
  // stores them — a reminder is the next occurrence of a round, not a different
  // sort of thing.
  'hepa_inspection',
  // A checklist authored in the portal, or a shipped one a site has edited or
  // archived. The shipped eight live in the bundle; this holds what a site did
  // to them.
  'hepa_checklist',
]

// Defaulted rather than null. Twenty-seven pages destructure this hook, so a
// page rendered outside the provider — which the portal smoke test does for
// every page — threw on the destructure rather than rendering read-only.
const NO_STORE = {
  records: {}, ready: false, persisted: null, toast: null,
  create: async () => null, update: async () => null, remove: async () => false,
  notify: () => {}, refresh: async () => {},
}

const StoreContext = createContext(NO_STORE)

export function RecordStoreProvider({ children }) {
  // kind -> records fetched or created this session
  const [records, setRecords] = useState({})
  const [ready, setReady] = useState(false)
  // Null until the first request answers: "unknown" is not the same as
  // "offline", and the banner must not flash before we know.
  const [persisted, setPersisted] = useState(null)
  const [toast, setToast] = useState(null)

  // Pulled out of the effect so it can be called again.
  //
  // Most writes go through create/update here and the state moves optimistically
  // with them. The SAP gateway is the exception: it writes its confirmation
  // server-side, inside the route that posted it, because the confirmation
  // number is generated there and the write has to be idempotent against the
  // database rather than against a component's idea of what exists. So after a
  // post the console asks for the records again rather than guessing what the
  // route wrote.
  const [reloadToken, setReloadToken] = useState(0)
  const refresh = useCallback(async () => {
    setReloadToken((n) => n + 1)
  }, [])

  useEffect(() => {
    let live = true
    const load = async () => {
      try {
        // One request for every kind. Twenty-six parallel fetches on each page
        // load was measurably slower and, on a cold connection, ordered the
        // browser to open more sockets than it has.
        const res = await fetch(apiUrl('/api/oxmaint/records'))
        const json = await res.json()
        if (!live) return

        const byKind = (json.ok && json.byKind) || {}
        const next = {}
        KINDS.forEach((kind) => { next[kind] = byKind[kind] || [] })
        setRecords(next)
        setPersisted(Boolean(json.ok && json.persisted))
      } catch {
        if (live) setPersisted(false)
      } finally {
        if (live) setReady(true)
      }
    }
    load()
    return () => { live = false }
  }, [reloadToken])

  const notify = useCallback((message, tone = 'ok') => {
    setToast({ message, tone, id: Date.now() })
    setTimeout(() => setToast(null), 3600)
  }, [])

  // Create. Returns the record so the caller can open it straight away.
  const create = useCallback(async (kind, data) => {
    const temp = { ...data, recordId: data.recordId || `tmp_${Date.now().toString(36)}`, _pending: true }
    setRecords((p) => ({ ...p, [kind]: [temp, ...(p[kind] || [])] }))

    try {
      const res = await fetch(apiUrl('/api/oxmaint/records'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, data, createdByName: USER.name }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Save failed')

      setRecords((p) => ({
        ...p,
        [kind]: (p[kind] || []).map((r) => (r.recordId === temp.recordId ? json.record : r)),
      }))
      notify('Saved.')
      return json.record
    } catch (e) {
      // Roll the row back rather than leave it looking saved.
      setRecords((p) => ({ ...p, [kind]: (p[kind] || []).filter((r) => r.recordId !== temp.recordId) }))
      notify(e.message || 'Could not save.', 'error')
      return null
    }
  }, [notify])

  // Update — works on seeded records too, see the merge rule above.
  const update = useCallback(async (kind, recordId, patch) => {
    const before = records[kind] || []
    const existing = before.find((r) => r.recordId === recordId)

    setRecords((p) => ({
      ...p,
      [kind]: existing
        ? (p[kind] || []).map((r) => (r.recordId === recordId ? { ...r, ...patch } : r))
        : [{ ...patch, recordId, _pending: true }, ...(p[kind] || [])],
    }))

    try {
      const res = await fetch(apiUrl('/api/oxmaint/records'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, recordId, data: patch }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Save failed')

      setRecords((p) => ({
        ...p,
        [kind]: (p[kind] || []).map((r) => (r.recordId === recordId ? json.record : r)),
      }))
      notify('Updated.')
      return json.record
    } catch (e) {
      setRecords((p) => ({ ...p, [kind]: before }))
      notify(e.message || 'Could not save.', 'error')
      return null
    }
  }, [records, notify])

  const remove = useCallback(async (kind, recordId) => {
    const before = records[kind] || []
    setRecords((p) => ({ ...p, [kind]: (p[kind] || []).filter((r) => r.recordId !== recordId) }))
    try {
      const res = await fetch(apiUrl(`/api/oxmaint/records?kind=${kind}&recordId=${recordId}`), { method: 'DELETE' })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Delete failed')
      notify('Deleted.')
      return true
    } catch (e) {
      setRecords((p) => ({ ...p, [kind]: before }))
      notify(e.message || 'Could not delete.', 'error')
      return false
    }
  }, [records, notify])

  const value = useMemo(() => ({ records, ready, persisted, create, update, remove, notify, toast, refresh }),
    [records, ready, persisted, create, update, remove, notify, toast, refresh])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export const useStore = () => useContext(StoreContext)

/**
 * A screen's list: seeded rows with stored changes applied and new rows on top.
 *
 * `idOf` is passed in because each record type names its own key — a work order
 * has workorder_id, a part has part_id. Normalising them all to `recordId` here
 * rather than in seventeen call sites is what keeps the merge in one place.
 */
export function useRecords(kind, seeded, idOf) {
  const store = useStore()
  const stored = store?.records?.[kind] || []

  return useMemo(() => {
    const byId = new Map(stored.map((r) => [r.recordId, r]))
    const seededIds = new Set(seeded.map(idOf))

    const merged = seeded.map((row) => {
      const patch = byId.get(idOf(row))
      return patch ? { ...row, ...patch } : row
    })
    // Anything stored that is not a change to a seeded row is a new record.
    const created = stored.filter((r) => !seededIds.has(r.recordId))

    return [...created, ...merged]
  }, [stored, seeded, idOf])
}

/**
 * The organisation's own logo, when it has uploaded one.
 *
 * Returns null until the first fetch answers, so the shell shows the product
 * mark rather than flashing a placeholder and then swapping.
 */
export function useOrgBranding() {
  const store = useStore()
  const row = store?.records?.branding?.[0]
  return {
    logoUrl: row?.logo_url || null,
    setLogo: (logo_url, name) => store?.update('branding', 'org_branding', { logo_url, logo_name: name || '' }),
    clearLogo: () => store?.update('branding', 'org_branding', { logo_url: '', logo_name: '' }),
    ready: Boolean(store?.ready),
  }
}
