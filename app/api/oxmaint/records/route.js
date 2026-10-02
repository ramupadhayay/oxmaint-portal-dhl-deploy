// Persistence for the Oxmaint CMMS portal.
//
// The seeded plant — 126 assets, 84 work orders — stays in the client bundle:
// it is fixed, it is the same for everyone, and putting it in a database would
// buy nothing but a round trip. What lands here is what a user *does*: the work
// order they raise, the checklist they complete, the status they change. Those
// have to survive a refresh and be there for the next person, which is the only
// thing localStorage cannot do.
//
// If MONGO_URI is not set the route says so rather than pretending. The portal
// treats that as "read-only" and keeps working on seeded data — a missing
// connection string should not take a running demo down.

import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import OxmaintRecord from '@/lib/models/OxmaintRecord'
import { ACTIVE_KEY } from '@/components/industries/oxmaint/lib/packs'
import { verifyWagaToken } from '@/lib/wagaAuth'
import { verifyAdminToken } from '@/lib/adminAuth'

// WAGA's records belong to a client with a sign-in, and this route answered
// anyone who asked for them.
//
// The WAGA portal is behind a login — proxy.js sees to that — but this endpoint
// is not in proxy's matcher and checked nothing, so the team roster with names,
// emails and departments, every filing, permit renewal and the audit trail
// could be read with a plain GET, and a compliance record could be written into
// the client's register by anyone who could send a POST. The other portals'
// records are illustrative and stay open; `waga_` kinds need a WAGA sign-in or
// a console admin, the same two people proxy.js lets into the portal.
const WAGA_KIND = /^waga_/
const mayTouchWaga = (request) => Boolean(
  verifyWagaToken(request.cookies.get('waga_token')?.value)
  || verifyAdminToken(request.cookies.get('admin_token')?.value),
)
const WAGA_SIGN_IN = 'Sign in to the WAGA portal to read or change its records.'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ok = (data) => NextResponse.json({ ok: true, ...data })
const fail = (error, status = 200) => NextResponse.json({ ok: false, error }, { status })

// Which customer's records this deployment may see.
//
// Taken from the pack the server itself is running, not from anything the
// client sends — a scope the caller can name is a scope the caller can widen.
// Both halves read the same `NEXT_PUBLIC_OXMAINT_PACK`, so a deployment cannot
// end up serving one pack's screens against another pack's records.
//
// Records written before the field existed carry no pack. The only default back
// then was 'chiller', so that demo — and only that one — still sees them.
const LEGACY_PACK = 'chiller'
const packScope = () =>
  ACTIVE_KEY === LEGACY_PACK
    ? { $or: [{ pack: ACTIVE_KEY }, { pack: '' }, { pack: { $exists: false } }] }
    : { pack: ACTIVE_KEY }

// A write from a tab built for a different organisation than this server runs.
//
// The scope above is the server's pack, which is right — but it is not the
// tab's. A tab stays on the bundle it loaded, so after the portal switcher
// moves the server to another pack, an open tab from the old one saves into the
// new one's records. That happened: a DHL tab overwrote AbbVie's ast_0001 with a
// pushback tractor and raised a DHL breakdown work order in the chiller plant.
//
// The CMMS store sends the pack its bundle was built with. A mismatch is refused
// before anything is read or written. A request that sends no pack is let
// through unchanged: five other portals and the probe scripts write here too,
// and none of them has a pack to send.
const packOfTab = (request) => request.headers.get('x-ox-pack') || ''
const wrongPack = (request) => {
  const sent = packOfTab(request)
  return sent && sent !== ACTIVE_KEY
    ? fail(
      `This tab is showing a different organisation (${sent}) from the one the server is now running (${ACTIVE_KEY}). `
      + 'Reload the page before saving — nothing was changed.',
      409,
    )
    : null
}

// Prefixes match the seeded ids, so a record created in the portal reads like
// the ones beside it rather than announcing itself as new.
const PREFIX = {
  work_order: 'wo', asset: 'ast', part: 'prt', request: 'req', pm_schedule: 'pms',
  inspection: 'ins', checklist: 'chk', checklist_run: 'chr', incident: 'inc', permit: 'pmt',
  purchase_order: 'po', vendor: 'ven', scrap: 'scr', logbook: 'log',
  document: 'doc', member: 'usr', team: 'tm', shutdown: 'sd',
  // Proof attached to a work order by the technician who finished it.
  attachment: 'att',
  // The response to a vision detection: the job raised and who was informed.
  vision_escalation: 'vesc',
  // An automation rule from the Workflow Designer.
  workflow: 'wf',
  stock_movement: 'mov', lube_run: 'lrn', lube_point: 'lub', logbook_run: 'lgr',
  // An hour-meter or odometer reading against an asset. Its own record rather
  // than an edit to the asset, because a reading is evidence: an audit asks who
  // read it and when, and a warranty claim turns on what it said on a date.
  meter_reading: 'mtr',
  // One line of the audit trail: who changed which record, when, and what each
  // changed field was before and after. Written by this route alongside the
  // write it describes — never by a screen — so a change cannot happen without
  // its entry. Refused on POST, PATCH and DELETE from outside: append-only.
  audit_event: 'aev',
  // Time booked against a work order, by an in-house technician or a contractor.
  labour_entry: 'lab',
  // A life safety feature out of service, one signed fire watch round, and a
  // Life Safety Code deficiency on the Statement of Conditions.
  fls_impairment: 'imp', fls_watch: 'fwr', fls_pfi: 'pfi',
  // A warranty claim against a vendor, and one stores cycle count with its lines.
  warranty_claim: 'wcl', cycle_count: 'cnt',

  // The FSM PoC portal. Its work orders are numbered WO-1001 upward in the
  // client workbook, so a record created there continues that sequence and is
  // given its own kind rather than sharing `work_order` — the two portals show
  // different plants and a row from one appearing in the other's list would be
  // a data leak between customers, not a merge.
  datacenter_work_order: 'dcwo',
  // Inspections started from that portal's Inspection module. Same reasoning as
  // the work orders: its own kind, so the two portals' registers never mix.
  datacenter_inspection: 'dcins',
  // Checklists authored in that portal's Inspection module.
  datacenter_checklist: 'dcchk',
  // The AI Auditor's closed loop: one overlay row per risk (keyed by the
  // finding's recId), carrying the work order it auto-raised and the resolution
  // logged against it — so a finding always has a recorded path to resolution.
  datacenter_risk: 'dcrisk',
  // The Teams and Document-Intelligence modules: a crew added to the roster and
  // a document added to the estate's library. Their own kinds so this portal's
  // people and files never mix into the CMMS portal's.
  datacenter_team: 'dctm',
  datacenter_document: 'dcdoc',
  // Assets bulk-uploaded into the register. Its own kind so an uploaded asset
  // continues this estate's scope matrix without mixing into another portal's.
  datacenter_asset: 'dcast',

  // The Hospitality portal. Same reasoning again, and a second reason of its
  // own: the pack scope is taken from the pack the *server* runs, which is the
  // CMMS portal's, so it cannot tell this portal's rows from that one's. The
  // prefix is what keeps a hotel's work order out of a chiller estate's list.
  hosp_work_order: 'hwo',
  hosp_request: 'hreq',
  hosp_suite_pm: 'hspm',
  hosp_schedule_item: 'hsch',
  hosp_checklist_run: 'hchr',
  hosp_compliance_log: 'hlog',
  hosp_visibility: 'hvis',
  // The community association side of that portal.
  hosp_community_wo: 'cawo',
  hosp_component_log: 'calog',

  // The DNA Technical Fabrics portal. Its own kinds for the same reason as the
  // rest: one collection, several portals, and the pack scope is taken from the
  // pack the *server* runs — which is the CMMS portal's — so it cannot tell one
  // portal's rows from another's. The prefix continues that workbook's own
  // sequence, AST-1001 upward, so an asset added in a demo reads like the
  // twenty-six beside it rather than announcing itself as new.
  dna_asset: 'dnaast',
  // Work orders raised in that portal. Its workbook numbers them WO-2001 upward,
  // so a job raised in a demo continues that sequence.
  dna_work_order: 'dnawo',
  // People added to that portal's roster, USR-01 upward in its workbook.
  dna_member: 'dnausr',
  // Purchase orders raised in that portal, PO-3001 upward in its workbook.
  dna_purchase_order: 'dnapo',

  // The HEPA compliance portal. Its own kinds for the same reason as the rest —
  // one collection, several portals, and the pack scope cannot tell them apart.
  //
  // A signature against a certification document, an entry in the append-only
  // audit trail, and a legal hold that suspends a retention period.
  hepa_signature: 'hsig',
  hepa_audit: 'haud',
  hepa_hold: 'hhld',
  // Written by the SAP gateway rather than by a screen: the confirmation it
  // posted, so a retry is idempotent and a reload does not lose it.
  hepa_sap_sync: 'hsap',
  // Raised in the portal rather than imported from SAP. Its own kind so a
  // created order never masquerades as one of theirs, and its number continues
  // the workbook's own 40005000 sequence.
  hepa_work_order: 'hwo2',
  hepa_request: 'hreq2',
  hepa_checklist_run: 'hclr',
  // The Inspection module. Rounds walked, reminders rolled forward, incidents
  // raised, and checklists authored in the portal. Their own kinds for the same
  // reason as the rest — one collection, several portals, and the pack scope is
  // the CMMS portal's, so nothing else keeps a cleanroom round out of a chiller
  // estate's register.
  hepa_inspection: 'hins',
  hepa_incident: 'hinc',
  hepa_checklist: 'hchk',

  // The WAGA Energy compliance portal. Its own kinds for the same reason as the
  // rest — one collection, several portals, and the pack scope cannot tell them
  // apart. The workbook is read-only reference; these are the transactions the
  // portal records against it.
  //
  // A filing marked done against a generated occurrence (the "live filing
  // calendar"); a deviation raised or worked; a parameter reading logged; a
  // renewal event against a permit; the safety module's JSA, LOTO and training
  // records; an incident reported; and the append-only audit trail every one of
  // those writes a row to — because "audit trail" is one of the three things the
  // portal was sold on.
  waga_filing: 'wgf',
  waga_requirement: 'wgrq',
  waga_deviation: 'wgd',
  waga_reading: 'wgr',
  waga_parameter: 'wgpar',
  waga_permit_event: 'wgp',
  waga_incident: 'wginc',
  waga_jsa: 'wgj',
  waga_loto: 'wgl',
  waga_training: 'wgt',
  waga_audit: 'wga',
  // Evidence held in the portal: the file a client attaches to a completed
  // compliance task. The only kind here whose rows carry bytes, which is why it
  // is named again in BLOB_KINDS below and kept out of the bulk response.
  waga_attachment: 'wgatt',
  // A site added in the portal, beside the two the workbook carries.
  waga_site: 'wgs',
  // The roster. Missing until now, so a person added in the portal was filed
  // under a generic `rec_…` id and the Team screen printed that beside the
  // workbook's own `USR-…` references.
  waga_member: 'wgm',
}

/*
  Bytes never ride the bulk response.

  `GET /api/oxmaint/records` with no kind returns every kind at once, and four
  portals call it bare on every page load. A single 1 MB attachment is worth
  roughly three thousand ordinary rows, so one uploaded PDF would be paid for by
  every screen in every portal until the row aged out of the newest 4000.

  The fix is a projection, not an exclusion. Dropping the attachment kind from
  the query altogether was the first attempt and it was wrong: the screens need
  the metadata — an attachment's name, type, size and which filing it belongs to
  — to draw "2 files" against a filed row without fetching anything. Take the
  rows away and that count survives only until the page is reloaded. So the rows
  come back and the payload does not; the bytes are pulled one record at a time,
  by id, when somebody actually opens a file.

  `data.logo_url` is here for the same reason and is the older offender: it is a
  base64 PNG written by the CMMS portal's logo upload, and it has been shipping
  to WAGA, HEPA and hospitality on every page load since that card was built,
  for each of them to drop on the floor.
*/
const BLOB_FIELDS = ['-data.fileB64', '-data.logo_url']

// 8 MB of base64, which is a shade under 6 MB of file. The BSON document ceiling
// is 16 MB and the metadata rides alongside, so this leaves generous headroom.
const MAX_B64 = 8 * 1024 * 1024

const newId = (kind) =>
  `${PREFIX[kind] || 'rec'}_${Date.now().toString(36).slice(-5)}${Math.floor(Math.random() * 46656).toString(36).padStart(3, '0')}`

const shape = (doc) => ({
  ...(doc.data || {}),
  recordId: doc.recordId,
  kind: doc.kind,
  _createdAt: doc.createdAt,
  _persisted: true,
})

export async function GET(request) {
  const kind = request.nextUrl.searchParams.get('kind')
  // Naming one record is how a blob is read: the screen already holds the
  // metadata from an ordinary row, and asks for the payload only when somebody
  // opens the file.
  const recordId = request.nextUrl.searchParams.get('recordId')
  if (kind && WAGA_KIND.test(kind) && !mayTouchWaga(request)) return fail(WAGA_SIGN_IN, 401)

  try {
    await dbConnect()
  } catch {
    // Not an error the user caused, and not one that should empty the screen.
    return ok(kind ? { records: [], persisted: false } : { byKind: {}, persisted: false })
  }

  try {
    // Without a `kind` this returns everything, grouped.
    //
    // The portal has twenty-six record kinds and the shell needs all of them
    // before it can render a list, so asking per kind meant twenty-six round
    // trips on every page load. One query and a group-by is the same data at a
    // twenty-sixth of the cost.
    if (!kind) {
      const rows = await OxmaintRecord
        .find({ deleted: false, ...packScope() })
        .select(BLOB_FIELDS.join(' '))
        .sort({ createdAt: -1 })
        .limit(4000)
        .lean()

      // A caller without a WAGA or console sign-in gets every portal's records
      // except WAGA's. The CMMS and the other demo portals load this same
      // response and have never needed those rows.
      const wagaOk = mayTouchWaga(request)
      const byKind = {}
      rows.forEach((r) => {
        if (!wagaOk && WAGA_KIND.test(r.kind)) return
        byKind[r.kind] = byKind[r.kind] || []
        if (byKind[r.kind].length < 500) byKind[r.kind].push(shape(r))
      })
      return ok({ byKind, persisted: true })
    }

    const rows = await OxmaintRecord
      .find({ kind, deleted: false, ...(recordId ? { recordId } : {}), ...packScope() })
      .sort({ createdAt: -1 })
      .limit(recordId ? 1 : 500)
      .lean()
    return ok({ records: rows.map(shape), persisted: true })
  } catch (e) {
    return fail(e.message)
  }
}

/**
 * Refuse an oversized body before it is read.
 *
 * App Router route handlers have no body-size limit of their own — the
 * `bodyParser` and `bodySizeLimit` settings are Pages-router and Server-Actions
 * respectively, and neither applies here. `await request.json()` therefore pulls
 * the whole upload into the heap before any check on its contents can run, and
 * the process this deploys to restarts at 1 GB. So the header is what gets
 * checked, and it gets checked first.
 *
 * A client that sends no Content-Length is let through: the size is caught again
 * on the parsed payload, which is late but not fatal for a body small enough to
 * have arrived chunked.
 */
const tooBig = (request) => {
  const len = Number(request.headers.get('content-length') || 0)
  return Number.isFinite(len) && len > MAX_B64 + 65536
}

const OVERSIZE = 'That file is larger than the 6 MB the portal holds for evidence. '
  + 'Attach a smaller file, or record it as an evidence reference instead.'

// What goes back to the caller after a write. The stored row is returned so the
// screen can replace its optimistic copy — but not the payload: the store keeps
// every record in React state, and putting megabytes back in through the reply
// would undo the exclusion the bulk response was given.
const shapeReply = (doc) => {
  const r = shape(doc)
  if (r.fileB64) return { ...r, fileB64: '', _blobHeld: true }
  return r
}

/*
  THE AUDIT TRAIL

  Every create, update and delete the CMMS store makes writes one audit_event
  here, in the same request, after the write it describes has landed. It lives
  in the route rather than in the screens because a screen can forget — a
  parameter documented and never passed is exactly how the meter trigger shipped
  broken — and this cannot: there is no path to a record that does not pass
  through these three handlers.

  Scoped to the CMMS store by the `x-ox-pack` header it sends. The other portals
  write here too and keep their own trails (HEPA's is signed and stage-gated),
  and a second, unsigned trail of their writes would be a record nobody asked
  for arguing with one they did.

  `before` is the stored document where there is one. A seeded record has none —
  its first edit is its first row — so the store sends the seeded values it was
  showing, and those are used only when the database has nothing.

  The payload is never copied. A file's bytes and a logo are left out; an audit
  line that carries the evidence is a second copy of the evidence.
*/
const AUDIT_KIND = 'audit_event'
const AUDIT_SKIP = new Set(['recordId', 'fileB64', 'logo_url', 'kind'])
const AUDIT_MAX_CHANGES = 24

const auditable = (request, kind) =>
  kind !== AUDIT_KIND && Boolean(packOfTab(request))

const ENTITY_LABEL = {
  work_order: 'Work Order', asset: 'Asset', part: 'Part', request: 'Request',
  pm_schedule: 'PM Schedule', inspection: 'Inspection', checklist: 'Checklist',
  checklist_run: 'Checklist Run', incident: 'Incident', rca: 'Root Cause Analysis',
  permit: 'Work Permit', purchase_order: 'Purchase Order', vendor: 'Vendor',
  scrap: 'Scrap', logbook: 'Logbook', document: 'Document', member: 'User',
  team: 'Team', shutdown: 'Shutdown', attachment: 'Attachment',
  labour_entry: 'Labour', meter_reading: 'Meter Reading', stock_movement: 'Stock',
  workflow: 'Workflow', branding: 'Branding', visibility: 'Modules',
  fls_impairment: 'Impairment', fls_watch: 'Fire Watch Round',
  fls_pfi: 'Plan for Improvement',
  warranty_claim: 'Warranty Claim', cycle_count: 'Cycle Count',
}

// The name a person would use for the record, in the order a reader looks for
// it. A trail that says "rec_8f2k updated" is a trail nobody can follow back.
const referenceOf = (d = {}, recordId) => String(
  d.work_order_number || d.inspection_number || d.po_number || d.permit_number
  || d.incident_number || d.request_number || d.impairment_id || d.pfi_id
  || d.schedule_name || d.asset_code
  || d.document_name || d.part_number || d.title || d.asset_name || d.name
  || recordId || '',
)

const flat = (v) => {
  if (v === null || v === undefined || v === '') return ''
  const t = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return t.length > 120 ? `${t.slice(0, 117)}…` : t
}

/**
 * Field-by-field difference, blobs and bookkeeping left out.
 *
 * Only the fields the write actually sent are compared. A status change sends
 * `{ status }`; against a seeded row's full `before`, a union of keys would
 * report every other field as wiped, and the trail would claim somebody blanked
 * a work order they only closed.
 */
function diff(before = {}, after = {}, sent = null) {
  const keys = sent
    ? new Set(sent)
    : new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
  const out = []
  for (const k of keys) {
    if (AUDIT_SKIP.has(k) || k.startsWith('_')) continue
    const a = flat(before?.[k])
    const b = flat(after?.[k])
    if (a === b) continue
    out.push({ field: k, from: a, to: b })
  }
  return out.slice(0, AUDIT_MAX_CHANGES)
}

async function writeAudit(request, { kind, recordId, action, before, after, actor, sent }) {
  if (!auditable(request, kind)) return null
  const changes = action === 'updated' ? diff(before, after, sent) : []
  // An update that changed nothing is not an event. Saving an untouched form
  // should not put a line in front of an auditor.
  if (action === 'updated' && changes.length === 0) return null

  const statusChange = changes.find((c) => c.field === 'status')
  // What the record is, not just what this write carried. A status change on a
  // seeded work order sends `{ status }`; naming it from that alone put its id
  // in the trail instead of its number, and dropped the asset it belongs to.
  const subject = { ...(before || {}), ...(after || {}) }
  const data = {
    at: new Date().toISOString(),
    actor_name: actor || 'Unknown user',
    entity: ENTITY_LABEL[kind] || kind,
    entity_kind: kind,
    record_id: recordId,
    reference: referenceOf(subject, recordId),
    action: statusChange ? 'status changed' : action,
    detail: statusChange
      ? `${statusChange.from || '—'} → ${statusChange.to || '—'}`
      : action === 'updated'
        ? changes.map((c) => c.field.replace(/_/g, ' ')).slice(0, 4).join(', ')
          + (changes.length > 4 ? ` +${changes.length - 4} more` : '')
        : '—',
    changes,
    site_id: subject.site_id || '',
    // The asset the change concerns, when the record names one — what lets an
    // asset's page show the trail of its inspections and jobs as well as its own.
    asset_id: kind === 'asset' ? recordId : (subject.asset_id || ''),
  }

  try {
    const doc = await OxmaintRecord.create({
      kind: AUDIT_KIND,
      pack: ACTIVE_KEY,
      recordId: newId(AUDIT_KIND),
      siteId: data.site_id,
      status: data.action,
      priority: '',
      title: `${data.entity} ${data.reference}`,
      data,
      createdByName: data.actor_name,
    })
    return shape(doc)
  } catch {
    // The write it describes has already landed and is not undone for this.
    // Losing a trail line is bad; refusing a save that succeeded would be worse,
    // and would not bring the line back.
    return null
  }
}

const APPEND_ONLY = 'The audit trail is append-only. An entry cannot be written, edited or removed from here.'

export async function POST(request) {
  const refused = wrongPack(request)
  if (refused) return refused
  if (tooBig(request)) return fail(OVERSIZE)

  let body
  try {
    body = await request.json()
  } catch {
    return fail('Bad JSON body')
  }

  const { kind, data = {}, createdByName = '', actor = '' } = body
  if (!kind) return fail('kind is required')
  if (WAGA_KIND.test(kind) && !mayTouchWaga(request)) return fail(WAGA_SIGN_IN, 401)
  if (kind === AUDIT_KIND) return fail(APPEND_ONLY, 403)
  if (typeof data.fileB64 === 'string' && data.fileB64.length > MAX_B64) return fail(OVERSIZE)

  try {
    await dbConnect()
  } catch {
    return fail('No database configured — this record was not saved.')
  }

  const recordId = data.recordId || newId(kind)

  const fields = {
    kind,
    pack: ACTIVE_KEY,
    recordId,
    siteId: data.site_id || '',
    status: data.status || '',
    priority: data.priority || '',
    title: data.title || data.asset_name || data.part_name || data.schedule_name || '',
    data: { ...data, recordId },
    createdByName,
  }

  try {
    // A deleted row still holds its id.
    //
    // Deletion here is a soft delete — the row stays with `deleted: true` — and
    // the compound index on {pack, recordId} does not care about that flag. So
    // creating a record whose id had been deleted threw a raw duplicate-key
    // error from the driver, which the portal then showed to the user as a
    // toast full of MongoDB internals. It is reachable in ordinary use: delete
    // a work order, raise another, and the next number in sequence is the one
    // just freed.
    //
    // A deleted row is revived rather than collided with. A *live* one still
    // conflicts, because two records sharing an id is a real error and quietly
    // overwriting the first would lose it.
    const existing = await OxmaintRecord.findOne({ kind, recordId, ...packScope() })

    if (existing && existing.deleted) {
      const doc = await OxmaintRecord.findOneAndUpdate(
        { _id: existing._id },
        { $set: { ...fields, pack: existing.pack ?? ACTIVE_KEY, deleted: false } },
        { returnDocument: 'after' },
      )
      const audit = await writeAudit(request, {
        kind, recordId, action: 'created', after: doc.data, actor: actor || createdByName,
      })
      return ok({ record: shapeReply(doc), audit })
    }

    if (existing) {
      return fail(`A record already exists with the id ${recordId}.`)
    }

    const doc = await OxmaintRecord.create(fields)
    const audit = await writeAudit(request, {
      kind, recordId, action: 'created', after: doc.data, actor: actor || createdByName,
    })
    return ok({ record: shapeReply(doc), audit })
  } catch (e) {
    return fail(e.message)
  }
}

// Status changes and edits. Records the portal seeded are not in the database,
// so an edit to one is stored as a new row carrying the seeded id — the client
// merges by id and the edit wins, which is what makes a seeded work order
// closeable without copying the whole plant into Mongo first.
export async function PATCH(request) {
  const refused = wrongPack(request)
  if (refused) return refused
  if (tooBig(request)) return fail(OVERSIZE)

  let body
  try {
    body = await request.json()
  } catch {
    return fail('Bad JSON body')
  }

  const { kind, recordId, data = {}, before: seededBefore = null, actor = '' } = body
  if (!kind || !recordId) return fail('kind and recordId are required')
  if (WAGA_KIND.test(kind) && !mayTouchWaga(request)) return fail(WAGA_SIGN_IN, 401)
  if (kind === AUDIT_KIND) return fail(APPEND_ONLY, 403)
  if (typeof data.fileB64 === 'string' && data.fileB64.length > MAX_B64) return fail(OVERSIZE)

  try {
    await dbConnect()
  } catch {
    return fail('No database configured — this change was not saved.')
  }

  try {
    // Scoped, so closing a seeded work order in one demo cannot reach into
    // another pack's row that happens to carry the same seeded id — the ids are
    // generated per pack and collide by design.
    const existing = await OxmaintRecord.findOne({ kind, recordId, ...packScope() })

    // A deleted row's fields must not merge into the next update.
    //
    // Deletion is soft, so the row is still there with `deleted: true`, and this
    // used to merge its data before applying the patch — which meant deleting a
    // record and then updating something that reused the id brought the old
    // fields back under the new one. It was reachable and it was silent: a
    // certification whose signature had been deleted came back signed the next
    // time its stage moved, because `signedBy` was still sitting in the row this
    // merged from. A record showing an approval nobody gave is precisely what
    // this portal exists to prevent.
    //
    // So a deleted row is patched as if it were new. A live one merges, which is
    // what makes a partial update a partial update.
    const base = existing && !existing.deleted ? existing.data || {} : {}
    const merged = { ...base, ...data, recordId }

    const doc = await OxmaintRecord.findOneAndUpdate(
      { kind, recordId, ...packScope() },
      {
        $set: {
          kind,
          pack: existing?.pack ?? ACTIVE_KEY,
          recordId,
          data: merged,
          siteId: merged.site_id || '',
          status: merged.status || '',
          priority: merged.priority || '',
          title: merged.title || merged.asset_name || merged.part_name || merged.schedule_name || '',
          deleted: false,
        },
      },
      { upsert: true, returnDocument: 'after' }
    )
    // The database's copy when it has one; the seeded values the tab was
    // showing when it does not. Never the other way round — a client's idea of
    // "before" is only trusted where there is nothing better.
    // Seeded values underneath, the stored copy on top. The stored copy wins
    // where it has a field; where it does not — a record whose first write was
    // just `{ status }` — the seeded value is still the true "before", and
    // without it the next edit reads as a change from nothing.
    const priorData = {
      ...(seededBefore || {}),
      ...(existing && !existing.deleted ? existing.data || {} : {}),
    }
    const audit = await writeAudit(request, {
      kind, recordId, action: 'updated', before: priorData, after: doc.data, actor,
      sent: Object.keys(data),
    })
    return ok({ record: shapeReply(doc), audit })
  } catch (e) {
    return fail(e.message)
  }
}

export async function DELETE(request) {
  const refused = wrongPack(request)
  if (refused) return refused
  const { searchParams } = request.nextUrl
  const kind = searchParams.get('kind')
  const recordId = searchParams.get('recordId')
  if (!kind || !recordId) return fail('kind and recordId are required')
  if (kind === AUDIT_KIND) return fail(APPEND_ONLY, 403)
  if (WAGA_KIND.test(kind) && !mayTouchWaga(request)) return fail(WAGA_SIGN_IN, 401)

  try {
    await dbConnect()
  } catch {
    return fail('No database configured — nothing was deleted.')
  }

  try {
    const existing = await OxmaintRecord.findOne({ kind, recordId, deleted: false, ...packScope() })
    await OxmaintRecord.updateOne({ kind, recordId, ...packScope() }, { $set: { deleted: true } })
    const audit = existing
      ? await writeAudit(request, {
        kind, recordId, action: 'deleted', before: existing.data,
        actor: decodeURIComponent(request.headers.get('x-ox-actor') || ''),
      })
      : null
    return ok({ recordId, audit })
  } catch (e) {
    return fail(e.message)
  }
}
