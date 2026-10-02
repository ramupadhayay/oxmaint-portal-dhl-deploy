// POST /api/hepa/sap/sync — post a confirmation, or retry one the queue rejected.
//
// This is the endpoint worth having a boundary for at all, because three things
// happen here that cannot be faked convincingly in component state.
//
// It refuses to confirm an unsigned certification. A PM04 order exists because
// an integrity test was due; confirming it in SAP says that test is done and
// accepted. If the certification record carries no electronic signature then it
// is not accepted, and posting the confirmation would put SAP a step ahead of
// the evidence. So the gateway reads the signature out of the record store —
// the same one Approvals writes to — and answers 409 if it is not there. That
// is the rule the client's brief is really asking about when it says the two
// systems must not disagree.
//
// It is idempotent. Posting the same confirmation twice returns the first one
// with a replay flag rather than creating a second, because a retry button and
// a flaky network will both do exactly that.
//
// And a failure comes back as a failure. The reason is stated with its SAP
// message code and what to do about it, rather than being swallowed into a
// silent "pending".

import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import OxmaintRecord from '@/lib/models/OxmaintRecord'
import { ACTIVE_KEY } from '@/components/industries/oxmaint/lib/packs'
import {
  sapRows, workOrders, documents, latency, one, sapError, failureFor, GATEWAY,
} from '../_gateway'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LEGACY_PACK = 'chiller'
const packScope = () =>
  ACTIVE_KEY === LEGACY_PACK
    ? { $or: [{ pack: ACTIVE_KEY }, { pack: '' }, { pack: { $exists: false } }] }
    : { pack: ACTIVE_KEY }

// A confirmation number in SAP's shape: ten digits, derived from the order so
// the same order always produces the same one rather than a fresh random on
// every call.
const confirmationNumber = (orderId, attempt) => {
  const base = Number(String(orderId).replace(/\D/g, '')) || 0
  return String(9000000000 + (base % 900000) * 10 + (attempt % 10)).slice(0, 10)
}

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return sapError('ZHEPA/BAD_REQUEST', 'Request body is not valid JSON.', 400)
  }

  // SAP's own identifiers, or ours.
  //
  // A payload shaped the way S/4HANA shapes one carries `Equipment` and
  // `FunctionalLocation` and has never heard of a filter id — so the gateway
  // resolves either. Middleware that only accepts a bespoke field is middleware
  // that cannot be handed a real order, which is the whole thing it is for.
  const { action = 'confirm' } = body || {}
  const filterId = body?.filterId
    || sapRows().find((r) => r.sapEquipmentId === body?.Equipment)?.filterId
    || sapRows().find((r) => r.sapFunctionalLocation === body?.FunctionalLocation)?.filterId
    || null

  if (!filterId) {
    return sapError(
      'ZHEPA/BAD_REQUEST',
      'Identify the unit: filterId, or SAP Equipment, or FunctionalLocation.',
      400,
    )
  }

  const row = sapRows().find((r) => r.filterId === filterId)
  if (!row) return sapError('ZHEPA/NOT_FOUND', `No equipment mapping for ${filterId}.`, 404)

  const order = workOrders().find((w) => w.filterId === filterId) || null

  await latency(320)

  // ── the gate: is the certification signed? ──────────────────────────────
  //
  // Two places a signature can come from and both count. The workbook records
  // some records as already signed off; anything signed since is in the record
  // store. Reading only the store would refuse a confirmation for a record the
  // customer's own file says was approved, which is the gateway disagreeing
  // with the system of record rather than protecting it.
  const seeded = documents().find((d) => d.documentRef === row.documentRef) || null
  let signature = seeded?.signedBy ? { signedBy: seeded.signedBy, source: 'workbook' } : null
  let storeReachable = true

  try {
    await dbConnect()
    const stored = await OxmaintRecord.findOne({
      kind: 'hepa_signature',
      recordId: `sig_${row.documentRef}`,
      deleted: { $ne: true },
      ...packScope(),
    })
    // A signature applied in the portal is the later word, so it wins — and a
    // rejection recorded there withdraws a workbook one.
    if (stored?.data) {
      signature = stored.data.signedBy
        ? { signedBy: stored.data.signedBy, source: 'portal', meaning: stored.data.signatureMeaning }
        : null
    }
  } catch {
    // No database configured. Say so rather than letting the absence of a
    // signature read as a refusal — those are different answers.
    storeReachable = false
  }

  const signed = Boolean(signature?.signedBy)

  if (action === 'confirm' && !signed) {
    return NextResponse.json({
      error: {
        code: 'ZHEPA/NOT_SIGNED',
        message: {
          lang: 'en',
          value: storeReachable
            ? `Certification ${row.documentRef} carries no electronic signature. `
              + 'A confirmation would tell SAP the test is accepted before it has been.'
            : 'The certification record store is unreachable, so the signature could not be verified.',
        },
      },
      remedy: storeReachable
        ? 'Sign the record on Approvals, then post the confirmation.'
        : 'Configure MONGO_URI so signatures can be read.',
      documentRef: row.documentRef,
    }, { status: 409 })
  }

  // ── the queue: does this one currently fail? ────────────────────────────
  const queued = String(row.syncStatus).startsWith('Error')
  if (queued && action !== 'retry') {
    const f = failureFor(filterId)
    return NextResponse.json({
      error: { code: f.code, message: { lang: 'en', value: f.message } },
      remedy: f.fix,
      retryable: true,
      documentRef: row.documentRef,
    }, { status: 502 })
  }

  // ── post it ─────────────────────────────────────────────────────────────
  let replayed = false
  let attempt = 1
  let stored = null

  try {
    await dbConnect()
    const existing = await OxmaintRecord.findOne({
      kind: 'hepa_sap_sync',
      recordId: `sap_${filterId}`,
      deleted: { $ne: true },
      ...packScope(),
    })

    if (existing?.data?.confirmation && action !== 'retry') {
      // Already posted. Hand back the first answer rather than creating a
      // second confirmation against the same order.
      replayed = true
      stored = existing.data
    } else {
      attempt = (existing?.data?.attempts || 0) + 1
      const data = {
        recordId: `sap_${filterId}`,
        filterId,
        documentRef: row.documentRef,
        equipment: row.sapEquipmentId,
        order: order?.workOrderId || null,
        confirmation: confirmationNumber(order?.workOrderId || filterId, attempt),
        confirmedAt: new Date().toISOString(),
        confirmedBy: signature?.signedBy || null,
        signatureSource: signature?.source || null,
        attempts: attempt,
        action,
        previousStatus: row.syncStatus,
        syncStatus: 'Synced',
      }
      const saved = await OxmaintRecord.findOneAndUpdate(
        { kind: 'hepa_sap_sync', recordId: `sap_${filterId}`, ...packScope() },
        {
          $set: {
            kind: 'hepa_sap_sync',
            pack: existing?.pack ?? ACTIVE_KEY,
            recordId: `sap_${filterId}`,
            data,
            title: `SAP confirmation ${data.confirmation}`,
            status: 'Synced',
            deleted: false,
          },
        },
        { upsert: true, returnDocument: 'after' },
      )
      stored = saved.data
    }
  } catch (e) {
    return sapError('ZHEPA/STORE_UNAVAILABLE',
      `The confirmation could not be recorded: ${e.message}`, 503)
  }

  return one({
    MaintenanceOrder: stored.order,
    Equipment: stored.equipment,
    MaintenancePlant: GATEWAY.plant,
    ConfirmationNumber: stored.confirmation,
    ConfirmationText: `HEPA certification ${stored.documentRef} confirmed`,
    ConfirmationDate: String(stored.confirmedAt).slice(0, 10),
    SystemStatus: 'CNF',
    ConfirmedBy: stored.confirmedBy,
    SignatureSource: stored.signatureSource || null,
    Attempt: stored.attempts,
    PreviousStatus: stored.previousStatus,
    _replayed: replayed,
    _oxmaintDocumentRef: stored.documentRef,
    _oxmaintFilterId: stored.filterId,
  }, { type: 'ZHEPA.Confirmation' })
}

// DELETE /api/hepa/sap/sync?filterId= — take a confirmation back out.
//
// Not something SAP would offer, and it says so. It exists because a person
// walking through this screen needs to be able to put it back the way they
// found it.
export async function DELETE(request) {
  const filterId = request.nextUrl.searchParams.get('filterId')
  if (!filterId) return sapError('ZHEPA/BAD_REQUEST', 'filterId is required.', 400)
  try {
    await dbConnect()
    await OxmaintRecord.updateOne(
      { kind: 'hepa_sap_sync', recordId: `sap_${filterId}`, ...packScope() },
      { $set: { deleted: true } },
    )
  } catch (e) {
    return sapError('ZHEPA/STORE_UNAVAILABLE', e.message, 503)
  }
  return NextResponse.json({ d: { filterId, reset: true } })
}
