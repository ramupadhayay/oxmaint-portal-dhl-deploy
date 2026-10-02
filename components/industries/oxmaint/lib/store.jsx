'use client'

// The bridge between the seeded plant and the database.
//
// Two things share one list on every screen: the 126 assets and 84 work orders
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

import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast as sonnerToast } from 'sonner'
import { USER, PACK_KEY } from './data'
import { apiUrl } from '@/lib/apiPath'

// Every write says which organisation this tab was built for.
//
// The bundle's pack is fixed at build time, but the server's can change under
// an open tab — the portal switcher restarts the dev server on another pack,
// and a tab left open on the old one keeps saving. The records API scopes by
// the pack the *server* runs, so that tab's saves landed in the wrong
// organisation: a DHL pushback tractor overwrote AbbVie's first asset, and a
// DHL breakdown work order appeared in the chiller plant. The server refuses a
// write whose pack does not match its own; this header is how it can tell.
const WRITE_HEADERS = { 'Content-Type': 'application/json', 'x-ox-pack': PACK_KEY }

const KINDS = [
  'work_order', 'asset', 'part', 'request', 'pm_schedule', 'inspection', 'checklist',
  'checklist_run', 'incident', 'rca', 'permit', 'purchase_order', 'vendor',
  'scrap', 'logbook', 'document', 'member', 'team', 'shutdown',
  // Branding is a record like any other, so an uploaded logo survives a reload
  // and is the same for everyone — which is the only reason to upload it.
  'branding',
  // Which modules the organisation has switched off.
  'visibility',
  // What people actually did: stock taken or received, a lubrication route
  // walked, an operator round read. These are the records that make the demo a
  // product rather than a slideshow, so they have to outlive the tab.
  'stock_movement', 'lube_run', 'lube_point', 'logbook_run', 'logbook_route',
  // Proof a technician attached when finishing a job — the photograph, the
  // signed form, the reading. Its rows carry bytes, and the bulk load projects
  // them away: `data.fileB64` is in BLOB_FIELDS in app/api/oxmaint/records, so
  // `records.attachment` arrives as metadata only — enough to count files
  // against a work order — and a payload is pulled by id when somebody opens
  // one.
  'attachment',
  // What was done about a vision detection: the job raised, and who was listed
  // to be told. Recorded rather than delivered — this build has no mail or SMS
  // gateway, and the record says so in its own `delivery` field.
  'vision_escalation',
  // An automation rule built in the Workflow Designer, and the paused/active
  // state of the seeded ones. Both go here: a rule switched off has to stay off
  // after a reload, which is the whole point of switching it off.
  'workflow',
  // Hour-meter and odometer readings. Missing from this list since the GSE
  // module shipped, so a reading was saved and then vanished from the history
  // on the next reload — the record was there, the store just never asked.
  'meter_reading',
  // The audit trail. Written only by the records API, beside the write it
  // describes; the store reads it and appends the line each write sends back.
  'audit_event',
  // Time booked against a work order, in-house or by a contractor.
  'labour_entry',
  // A life safety feature out of service, and the compensating measures in
  // force while it is. Its own kind rather than a flag on the asset: an
  // impairment has its own dates, its own declarer and its own fire watch, and
  // the same valve can be impaired again next year.
  'fls_impairment',
  // One signed fire watch round. A row per round because the signature and its
  // time are the evidence — a counter on the impairment would prove nothing.
  'fls_watch',
  // A Plan for Improvement: one Life Safety Code deficiency on the Statement of
  // Conditions, with its plan, owner and target date.
  'fls_pfi',
  // A warranty claim raised against a vendor, and a decision recorded on one
  // already filed; one stores cycle count, its lines and who approved it.
  'warranty_claim', 'cycle_count',
]

// ── what a seeded record looked like before its first edit ─────────────────
//
// A seeded row has no database copy, so the first edit to it is the first row
// the server ever sees — and an audit line for it would read "every field
// changed from nothing". useRecords registers the seeded list for its kind as
// each screen renders, and update() sends the row it finds there as `before`.
//
// Registered by useRecords rather than passed by callers on purpose. A value
// every caller has to remember to pass is a value some caller will not pass.
const SEEDED = new Map()

const seededRow = (kind, recordId) => {
  const reg = SEEDED.get(kind)
  if (!reg) return null
  return reg.rows.find((r) => String(reg.idOf(r)) === String(recordId)) || null
}

// Values only — the merge flags a screen adds are not part of the record.
const plain = (row) => {
  if (!row) return null
  const out = {}
  for (const [k, v] of Object.entries(row)) if (!k.startsWith('_')) out[k] = v
  return out
}

// Defaulted rather than null. Twenty-seven pages destructure this hook, so a
// page rendered outside the provider — which the portal smoke test does for
// every page — threw on the destructure rather than rendering read-only.
const NO_STORE = {
  records: {}, ready: false, persisted: null, toast: null,
  create: async () => null, update: async () => null, remove: async () => false,
  notify: () => {}, loadAttachment: async () => null, loadBlob: async () => null,
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
  }, [])

  /**
   * Every message this portal raises goes through here, and now out through the
   * product's own notification line — sonner, top centre, coloured by kind.
   *
   * The tones already in use across the screens are 'ok' and 'error'; 'warning'
   * and 'info' are mapped too so a caller can reach for them without having to
   * come back and wire anything. `toast` state is still set because SaveToast
   * and anything else reading it from the store keeps working unchanged.
   */
  const notify = useCallback((message, tone = 'ok') => {
    setToast({ message, tone, id: Date.now() })
    setTimeout(() => setToast(null), 3600)
    // Aliased on import: this component already has a `toast` of its own from
    // useState, and an unaliased import would be shadowed by it — every call
    // here would land on the state value instead of the library.
    if (tone === 'error') sonnerToast.error(message)
    else if (tone === 'warning' || tone === 'warn') sonnerToast.warning(message)
    else if (tone === 'info') sonnerToast.info(message)
    else sonnerToast.success(message)
  }, [])

  // The audit line a write returns goes straight into the trail, so the
  // History panel beside the record shows the change the moment it is saved
  // rather than after a reload.
  const takeAudit = useCallback((json) => {
    if (!json?.audit) return
    setRecords((p) => ({ ...p, audit_event: [json.audit, ...(p.audit_event || [])] }))
  }, [])

  // Create. Returns the record so the caller can open it straight away.
  const create = useCallback(async (kind, data) => {
    const temp = { ...data, recordId: data.recordId || `tmp_${Date.now().toString(36)}`, _pending: true }
    setRecords((p) => ({ ...p, [kind]: [temp, ...(p[kind] || [])] }))

    try {
      const res = await fetch(apiUrl('/api/oxmaint/records'), {
        method: 'POST',
        headers: WRITE_HEADERS,
        body: JSON.stringify({ kind, data, createdByName: USER.name, actor: USER.name }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Save failed')

      setRecords((p) => ({
        ...p,
        [kind]: (p[kind] || []).map((r) => (r.recordId === temp.recordId ? json.record : r)),
      }))
      takeAudit(json)
      notify('Saved.')
      return json.record
    } catch (e) {
      // Roll the row back rather than leave it looking saved.
      setRecords((p) => ({ ...p, [kind]: (p[kind] || []).filter((r) => r.recordId !== temp.recordId) }))
      notify(e.message || 'Could not save.', 'error')
      return null
    }
  }, [notify, takeAudit])

  // Update — works on seeded records too, see the merge rule above.
  const update = useCallback(async (kind, recordId, patch) => {
    const before = records[kind] || []
    const existing = before.find((r) => r.recordId === recordId)
    // Always sent when the record is a seeded one. The server lays its stored
    // copy over it, so the stored values win — but a stored copy that only ever
    // received `{ status }` has no priority or title of its own, and without the
    // seeded row underneath, the next edit to those reads as a change from blank.
    const seededBefore = plain(seededRow(kind, recordId))

    setRecords((p) => ({
      ...p,
      [kind]: existing
        ? (p[kind] || []).map((r) => (r.recordId === recordId ? { ...r, ...patch } : r))
        : [{ ...patch, recordId, _pending: true }, ...(p[kind] || [])],
    }))

    try {
      const res = await fetch(apiUrl('/api/oxmaint/records'), {
        method: 'PATCH',
        headers: WRITE_HEADERS,
        body: JSON.stringify({ kind, recordId, data: patch, before: seededBefore, actor: USER.name }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Save failed')

      setRecords((p) => ({
        ...p,
        [kind]: (p[kind] || []).map((r) => (r.recordId === recordId ? json.record : r)),
      }))
      takeAudit(json)
      notify('Updated.')
      return json.record
    } catch (e) {
      setRecords((p) => ({ ...p, [kind]: before }))
      notify(e.message || 'Could not save.', 'error')
      return null
    }
  }, [records, notify, takeAudit])

  const remove = useCallback(async (kind, recordId) => {
    const before = records[kind] || []
    setRecords((p) => ({ ...p, [kind]: (p[kind] || []).filter((r) => r.recordId !== recordId) }))
    try {
      const res = await fetch(apiUrl(`/api/oxmaint/records?kind=${kind}&recordId=${recordId}`), {
        method: 'DELETE',
        // A DELETE has no body, so who did it travels as a header. Encoded,
        // because a header value must be ASCII and a person's name need not be.
        headers: { 'x-ox-pack': PACK_KEY, 'x-ox-actor': encodeURIComponent(USER.name) },
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Delete failed')
      takeAudit(json)
      notify('Deleted.')
      return true
    } catch (e) {
      setRecords((p) => ({ ...p, [kind]: before }))
      notify(e.message || 'Could not delete.', 'error')
      return false
    }
  }, [records, notify, takeAudit])

  /**
   * Fetch one attachment's bytes, by record id.
   *
   * Deliberately outside `records`. That map is what every screen re-renders
   * against, so a payload written into it would re-render the whole portal and
   * stay resident for the session — the cost the API's bulk exclusion exists to
   * avoid. The bytes live in a ref instead: the same file opened twice is
   * fetched once, and nothing re-renders when it lands.
   */
  const blobs = useRef(new Map())
  // Any kind whose rows carry a file: an attachment on a work order, and now a
  // document in the library. The bulk load strips `fileB64` for every kind, so
  // the one fetch-by-id path serves both.
  const loadBlob = useCallback(async (kind, recordId) => {
    if (!kind || !recordId) return null
    const key = `${kind}:${recordId}`
    const hit = blobs.current.get(key)
    if (hit) return hit
    try {
      const res = await fetch(apiUrl(`/api/oxmaint/records?kind=${encodeURIComponent(kind)}&recordId=${encodeURIComponent(recordId)}`))
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Could not open that file.')
      const row = json.records?.[0] || null
      if (!row?.fileB64) throw new Error('That file is no longer held in the portal.')
      blobs.current.set(key, row)
      return row
    } catch (e) {
      notify(e.message || 'Could not open that file.', 'error')
      return null
    }
  }, [notify])
  const loadAttachment = useCallback((recordId) => loadBlob('attachment', recordId), [loadBlob])

  const value = useMemo(() => ({ records, ready, persisted, create, update, remove, notify, toast, loadAttachment, loadBlob }),
    [records, ready, persisted, create, update, remove, notify, toast, loadAttachment, loadBlob])

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
  // Idempotent, and cheap: the same array reference each render.
  if (seeded?.length && SEEDED.get(kind)?.rows !== seeded) SEEDED.set(kind, { rows: seeded, idOf })

  return useMemo(() => {
    const byId = new Map(stored.map((r) => [r.recordId, r]))
    const seededIds = new Set(seeded.map(idOf))

    const merged = seeded.map((row) => {
      const patch = byId.get(idOf(row))
      return patch ? { ...row, ...patch } : row
    })
    // Anything stored that is not a change to a seeded row is a new record, and
    // it says so on the row. A screen that offers delete has to know which rows
    // it raised itself: a seeded row has no record behind it to remove, and
    // offering the action anyway is a button that cannot work.
    const created = stored
      .filter((r) => !seededIds.has(r.recordId))
      .map((r) => ({ ...r, _created: true }))

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
