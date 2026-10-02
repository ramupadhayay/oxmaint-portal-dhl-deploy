'use client'

// The record store this portal writes through.
//
// WAGA started life read-only — it rendered the verified workbook and nothing
// wrote back. The trial the portal was sold on needs three things the workbook
// cannot supply on its own: a filing calendar you can actually complete against,
// a permit vault whose renewals move, and an audit trail of who did what. All
// three are transactions, so the portal grows the same persistence spine the
// other portals here use rather than a second one that would drift.
//
// One collection backs every portal in this deployment, and the API scopes rows
// by the data pack the *server* runs — the CMMS portal's — so the pack scope
// cannot tell a WAGA filing from a chiller work order. Every kind below is
// prefixed for exactly that reason, the same answer the HEPA and hospitality
// portals reached.
//
// The workbook stays the source of truth for what is *required*; this store only
// records what was *done* about it. A generated occurrence is still generated; a
// filing record says somebody completed that occurrence, and the two never merge
// into a claim the workbook did not make.

import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiUrl } from '@/lib/apiPath'

// The acting user, as a role rather than a person. The workbook's own tasks are
// assigned to "QHSE / Site Ops" and "Environmental", so a completion recorded
// here reads in the same terms the client's trackers already use — nothing about
// a named individual is invented into the record.
export const USER = { name: 'QHSE / Site Ops', role: 'Compliance' }

const KINDS = [
  // A generated calendar occurrence marked done: when it was filed, by whom, and
  // the reference to the evidence held for it. The "live filing calendar" is this
  // record laid over the derived schedule.
  'waga_filing',
  // A compliance obligation added by the client against a permit. Imported
  // requirements remain read-only; these rows are the portal's editable overlay.
  'waga_requirement',
  // A deviation raised in the portal, or a workbook one moved along its CAPA
  // path (Open → Corrective Action → Closed).
  'waga_deviation',
  // A monitoring reading logged against a permit limit. A reading over the limit
  // is what raises a deviation, so the two screens are tied through this kind.
  'waga_reading',
  // A permit limit written in the portal. The workbook's limits were read off
  // the permit documents and stay read-only; this is how a site the workbook
  // does not cover gets limits at all, and it is badged as entered here rather
  // than mixed in with the verified ones.
  'waga_parameter',
  // A renewal event against a permit — application submitted, authorization
  // received — so the vault shows movement the workbook's static status cannot.
  'waga_permit_event',
  // An incident reported in the portal. The workbook ships only a placeholder
  // schema for these (the source file was never supplied), so every real one is
  // created here.
  'waga_incident',
  // A pre-task safety assessment (JSA) filled and submitted for a job.
  'waga_jsa',
  // A lockout/tagout or permit-to-work record, opened and closed out.
  'waga_loto',
  // A training completion recorded against a person and a course.
  'waga_training',
  // A person on the WAGA team with access to this trial — name, email and
  // department. Seeded from the client's own roster; more can be added here.
  // Login credentials are provisioned separately, so a member added here is a
  // directory entry until an account is issued for it.
  'waga_member',
  // The append-only trail. Every write above also appends one row here, and
  // nothing edits or deletes them — because "audit trail" is one of the three
  // things the portal was sold on, and an audit you can rewrite is not one.
  'waga_audit',
  // A site added in the portal, on top of the two the workbook carries.
  //
  // The workbook stays the source of truth for the sites it names; this is how
  // the estate grows between imports — and it is what makes the country level
  // above sites usable, because a filter over one country is a filter with
  // nothing to compare. A site added here is badged as added rather than
  // silently mixed in with the verified ones.
  'waga_site',
  // Evidence the client attached to a completed task — the actual file, held in
  // the portal rather than only referenced.
  //
  // The one kind here whose rows carry bytes. They arrive on the ordinary load
  // like any other record — but without the payload: the API projects
  // `data.fileB64` off the grouped response (BLOB_FIELDS in
  // app/api/oxmaint/records/route.js). So a screen knows a filing has two files
  // and what they are called for free, and the bytes are pulled one at a time by
  // `loadAttachment` when somebody actually opens one.
  'waga_attachment',
]

// Every page reaches this through `const store = useStore()` and then calls
// `store.something(...)`, so a method absent here is a TypeError rather than a
// no-op — and the portal smoke test renders each page outside the provider.
const NO_STORE = {
  records: {}, ready: false, persisted: null, toast: null,
  create: async () => null, update: async () => null, remove: async () => false,
  log: async () => null, notify: () => {}, refresh: async () => {},
  loadAttachment: async () => null,
}

const StoreContext = createContext(NO_STORE)

/**
 * Read a JSON reply, or say what actually came back.
 *
 * Behind IIS and ARR an upload that exceeds the front-end's own request limit is
 * answered with an HTML error page, not JSON. `res.json()` then throws a
 * SyntaxError whose message is "Unexpected token '<'…" — and because the store
 * surfaces `e.message`, that string is what the user reads instead of anything
 * about the file they just picked.
 */
async function readJson(res) {
  const type = res.headers.get('content-type') || ''
  if (type.includes('application/json')) {
    try {
      return await res.json()
    } catch {
      return { ok: false, error: 'The server sent a reply this screen could not read.' }
    }
  }
  if (res.status === 413) {
    return { ok: false, error: 'The server refused the upload as too large. Try a smaller file.' }
  }
  return {
    ok: false,
    error: res.ok
      ? 'The server sent a reply this screen could not read.'
      : `The server refused the request (${res.status}).`,
  }
}

export function RecordStoreProvider({ children }) {
  const [records, setRecords] = useState({})
  const [ready, setReady] = useState(false)
  // Null until the first request answers: "unknown" is not "offline", and the
  // banner must not flash before we know which it is.
  const [persisted, setPersisted] = useState(null)
  const [toast, setToast] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  const refresh = useCallback(async () => { setReloadToken((n) => n + 1) }, [])

  useEffect(() => {
    let live = true
    const load = async () => {
      try {
        // One request for every kind, grouped — see the CMMS store for why a
        // fetch per kind was measurably worse on a cold connection.
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

  const create = useCallback(async (kind, data) => {
    // Same reasoning as the reply below: the optimistic copy holds the
    // metadata, never the payload.
    const temp = {
      ...data, fileB64: data.fileB64 ? '' : undefined,
      recordId: data.recordId || `tmp_${Date.now().toString(36)}`, _pending: true,
    }
    setRecords((p) => ({ ...p, [kind]: [temp, ...(p[kind] || [])] }))
    try {
      const res = await fetch(apiUrl('/api/oxmaint/records'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, data, createdByName: USER.name }),
      })
      const json = await readJson(res)
      if (!json.ok) throw new Error(json.error || 'Save failed')
      // The optimistic row carried the file so the screen could show it
      // immediately; neither it nor the server's reply belongs in the store.
      // `records` is what every consumer re-renders against, and a few megabytes
      // parked there would undo the whole reason the API keeps them out of the
      // bulk load. The row that lands is the metadata; the bytes are refetched
      // by id if anyone opens the file.
      const light = json.record?.fileB64 ? { ...json.record, fileB64: '' } : json.record
      setRecords((p) => ({
        ...p,
        [kind]: (p[kind] || []).map((r) => (r.recordId === temp.recordId ? light : r)),
      }))
      return light
    } catch (e) {
      setRecords((p) => ({ ...p, [kind]: (p[kind] || []).filter((r) => r.recordId !== temp.recordId) }))
      notify(e.message || 'Could not save.', 'error')
      return null
    }
  }, [notify])

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
      const json = await readJson(res)
      if (!json.ok) throw new Error(json.error || 'Save failed')
      setRecords((p) => ({
        ...p,
        [kind]: (p[kind] || []).map((r) => (r.recordId === recordId ? json.record : r)),
      }))
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
      const json = await readJson(res)
      if (!json.ok) throw new Error(json.error || 'Delete failed')
      return true
    } catch (e) {
      setRecords((p) => ({ ...p, [kind]: before }))
      notify(e.message || 'Could not delete.', 'error')
      return false
    }
  }, [records, notify])

  /**
   * Append one row to the audit trail.
   *
   * Its own method rather than a plain create so no call site forgets the shape,
   * and so the trail is written the same way every screen: an action verb, the
   * subject it acted on, the actor, and the moment. Nothing ever updates or
   * removes a `waga_audit` row — the store exposes no path to.
   */
  // `siteId` is what lets a screen's own history follow the site filter. A line
  // written without one is organisation-wide and shows under every scope, which
  // is the right answer for the handful of records that genuinely are — a team
  // member added, for one — and the honest answer for lines written before the
  // trail carried it.
  const log = useCallback((action, subject, detail = '', siteId = '') => (
    create('waga_audit', {
      action, subject, detail, siteId, actor: USER.name, at: new Date().toISOString(),
    })
  ), [create])

  /**
   * Fetch one attachment's bytes, by record id.
   *
   * Deliberately outside `records`. That map is what every screen re-renders
   * against, so a payload written into it would re-render the whole portal and
   * stay resident for the session — the exact cost the API's bulk exclusion
   * exists to avoid. This keeps the bytes in a ref instead: the same file opened
   * twice is fetched once, and nothing re-renders when it lands.
   */
  const blobs = useRef(new Map())
  const loadAttachment = useCallback(async (recordId) => {
    if (!recordId) return null
    const hit = blobs.current.get(recordId)
    if (hit) return hit
    try {
      const res = await fetch(apiUrl(`/api/oxmaint/records?kind=waga_attachment&recordId=${encodeURIComponent(recordId)}`))
      const json = await readJson(res)
      if (!json.ok) throw new Error(json.error || 'Could not open that file.')
      const row = json.records?.[0] || null
      if (!row) throw new Error('That file is no longer held in the portal.')
      blobs.current.set(recordId, row)
      return row
    } catch (e) {
      notify(e.message || 'Could not open that file.', 'error')
      return null
    }
  }, [notify])

  const value = useMemo(
    () => ({ records, ready, persisted, create, update, remove, log, notify, toast, refresh, loadAttachment }),
    [records, ready, persisted, create, update, remove, log, notify, toast, refresh, loadAttachment],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export const useStore = () => useContext(StoreContext)

/**
 * A screen's list: seeded workbook rows with stored changes applied, new records
 * on top. `idOf` names each row's own key so the merge lives here rather than at
 * every call site.
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
    const created = stored.filter((r) => !seededIds.has(r.recordId))
    return [...created, ...merged]
  }, [stored, seeded, idOf])
}

/** Just the rows created in the portal for a kind, newest first. */
export function useCreated(kind) {
  const store = useStore()
  const stored = store?.records?.[kind] || []
  return useMemo(
    () => [...stored].sort((a, b) => String(b._createdAt || '').localeCompare(String(a._createdAt || ''))),
    [stored],
  )
}
