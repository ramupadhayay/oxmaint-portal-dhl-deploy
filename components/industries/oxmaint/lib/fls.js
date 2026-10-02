'use client'

// Life safety — which tests are due, and whether the record of each can be
// produced.
//
// A surveyor walking a hospital does not test the fire pump. They ask for the
// record that it was tested: when, by whom, and the report or certificate that
// proves it. So every test here is judged on three things, and all three come
// from records the rest of the portal keeps:
//
//   Test record    — when it was last done. Modelled history for the estate,
//                    moved forward only by a work order raised for that test
//                    and completed — not by any job that happens to touch the
//                    same assets.
//   Evidence       — for routine in-house tests, the test log in this system.
//                    For bought-in work, a current report or certificate in the
//                    document register, filed against those assets or naming
//                    the test. Only the register counts: a certificate "on file"
//                    with no file behind it is the finding this screen exists to
//                    prevent.
//   Performed by   — who did it. Modelled for the estate's history, replaced by
//                    whatever labour entry the portal holds — and for work that
//                    is bought in, it has to be the contractor.
//
// Upload a certificate, book a contractor's visit, complete the job — and the
// test's line moves. That is the demonstration, and it is real.

import { useMemo } from 'react'
import { useRecords } from './store'
import { useLabourEntries } from './labour'
import { useAuditTrail } from './audit'
import {
  ASSETS, WORK_ORDERS, DOCUMENTS, DOMAIN, EPOCH, TECHNICIANS, VENDORS,
  seed, between,
} from './data'

export const FLS_ACTIVE = DOMAIN?.key === 'fls'
const D = FLS_ACTIVE ? DOMAIN : null

const DAY = 86400000
const assetIdOf = (a) => a.asset_id || a.recordId
const woIdOf = (w) => w.workorder_id || w.recordId
const docIdOf = (d) => d.document_id || d.recordId

const time = (iso) => (iso ? new Date(iso).getTime() : 0)
const addDays = (iso, n) => new Date(time(iso) + n * DAY).toISOString()
const daysBetween = (a, b) => Math.round((time(b) - time(a)) / DAY)

export const frequencyLabel = (days) => ({
  7: 'Weekly', 30: 'Monthly', 91: 'Quarterly', 182: 'Semiannual', 365: 'Annual',
  1095: 'Every 3 years', 2190: 'Every 6 years', 4380: 'Every 12 years',
})[days] || `Every ${days} days`

// The in-house trade that usually carries each system's routine tests.
const TRADE_FOR = {
  alarm: 'Fire Alarm', suppression: 'Sprinkler & Suppression', power: 'Electrical / Emergency Power',
  egress: 'Doors & Building Features', medgas: 'Medical Gas', nursecall: 'Electrical / Emergency Power',
  portable: 'Life Safety',
}

// The contractor a hospital would call for each bought-in test.
const VENDOR_FOR = {
  alarm: 'Keystone Fire Alarm Services', suppression: 'Summit Fire Protection',
  power: 'Midwest Generator Service', egress: 'Allied Door Inspection Group',
  medgas: 'Precision Medical Gas Certification', nursecall: 'Clearview Nurse Call Systems',
  portable: 'Cardinal Extinguisher Service',
}

const EVIDENCE_CATEGORIES = new Set(['Report', 'Certificate'])

/**
 * Where every test stands, from everything the portal holds.
 *
 * Returns the systems with their tests, a flat list of tests, the survey
 * elements scored against them, and headline counts.
 */
export function useFls() {
  const assets = useRecords('asset', ASSETS, assetIdOf)
  const workOrders = useRecords('work_order', WORK_ORDERS, woIdOf)
  const documents = useRecords('document', DOCUMENTS, docIdOf)
  const labour = useLabourEntries()
  const trail = useAuditTrail()

  return useMemo(() => {
    if (!D) return { systems: [], tests: [], elements: [], totals: {} }
    const now = new Date(EPOCH).toISOString()
    const systemByKey = new Map(D.systems.map((s) => [s.key, s]))

    const tests = D.tests.map((t) => {
      const system = systemByKey.get(t.system)
      const kinds = new Set(t.kinds || system.kinds)
      const covered = assets.filter((a) => kinds.has(a.asset_type))
      const ids = new Set(covered.map((a) => String(assetIdOf(a))))
      const since = addDays(now, -t.every)

      // ── test record ────────────────────────────────────────────────────
      // Modelled history: somewhere inside one and a quarter intervals ago, so a
      // share of the estate is naturally overdue, as a real one is.
      const modelledAgo = between(`fls-last-${t.key}`, 0, Math.max(1, Math.round(t.every * 1.2)))
      let lastDone = addDays(now, -modelledAgo)
      let lastSource = 'history'
      // Only a job raised for this test moves its date. A corrective work order
      // on a smoke detector is not the annual fire alarm inspection, and letting
      // any completed job count would mark a test done that nobody performed —
      // and, for bought-in tests, would drop the contractor off the record.
      const testSource = `Life safety test ${t.label}`
      const completedJobs = workOrders.filter((w) => w.raised_from === testSource
        && ['Completed', 'Closed'].includes(w.status) && w.completed_date)
      for (const r of completedJobs) {
        if (time(r.completed_date) > time(lastDone) && time(r.completed_date) <= time(now) + DAY) {
          lastDone = r.completed_date
          lastSource = r.work_order_number || r.inspection_number || 'record'
        }
      }
      const nextDue = addDays(lastDone, t.every)
      const daysToDue = daysBetween(now, nextDue)
      const soonWindow = t.every <= 30 ? 3 : 30
      const state = daysToDue < 0 ? 'Overdue' : daysToDue <= soonWindow ? 'Due soon' : 'Current'

      // ── documentation ──────────────────────────────────────────────────
      // A pack document names its test; an uploaded one is matched by the asset
      // it is filed against and the kind of evidence the test calls for.
      // In-house routine tests are evidenced by their record here, not by a
      // file: the completed log is what a surveyor is shown for a weekly churn.
      const recordEvidence = t.evidence === 'Record'
      const docs = recordEvidence ? [] : documents
        .filter((d) => (d.test ? d.test === t.key
          : ids.has(String(d.asset_id)) && (d.category === t.evidence || (!d.category && EVIDENCE_CATEGORIES.has(t.evidence)))))
        .sort((a, b) => time(b.created_date) - time(a.created_date))
      const doc = docs[0] || null
      const docIssuedInInterval = doc ? time(doc.created_date) >= time(since) : false
      const docExpired = doc?.valid_until ? time(doc.valid_until) < time(now) : false
      const docCurrent = recordEvidence
        ? state !== 'Overdue'
        : Boolean(doc) && docIssuedInInterval && !docExpired

      // ── performed by ───────────────────────────────────────────────────
      const onTheseAssets = labour.filter((e) => ids.has(String(e.asset_id)) && time(e.work_date) >= time(since))
      const contractorEntry = onTheseAssets.find((e) => e.worker_type === 'Contractor')
      const anyEntry = onTheseAssets[0]
      let performer = null
      if (t.who === 'Contractor' ? contractorEntry : anyEntry) {
        const e = t.who === 'Contractor' ? contractorEntry : anyEntry
        // A contractor entry booked without a named technician falls back to the
        // firm's own name, so the two would read "Summit Fire Protection ·
        // Summit Fire Protection". Name the person only when there is one.
        const firm = e.worker_type === 'Contractor' ? e.vendor_name : e.worker_name
        const person = e.worker_type === 'Contractor' && e.worker_name !== e.vendor_name ? e.worker_name : ''
        performer = {
          name: firm,
          person,
          type: e.worker_type, date: e.work_date, source: e.work_order_number,
        }
      } else if (lastSource === 'history' && seed(`fls-who-${t.key}`) > 0.18) {
        // The estate's modelled history carries a performer most of the time —
        // and not always, because "nobody recorded who did it" is a real finding.
        const tech = TECHNICIANS.find((x) => x.trade === TRADE_FOR[t.system])
        performer = t.who === 'Contractor'
          ? { name: VENDOR_FOR[t.system] || VENDORS[0]?.vendor_name, person: '', type: 'Contractor', date: lastDone, source: 'history' }
          : { name: tech?.name || 'In-house technician', person: '', type: 'In-house', date: lastDone, source: 'history' }
      } else if (lastSource !== 'history') {
        const job = completedJobs.find((w) => w.work_order_number === lastSource)
        if (job?.assigned_to_name && t.who !== 'Contractor') {
          performer = { name: job.assigned_to_name, person: '', type: 'In-house', date: job.completed_date, source: job.work_order_number }
        }
      }

      const trailLines = trail.filter((e) => ids.has(String(e.asset_id)) && time(e.at) >= time(since)).length

      const gaps = []
      if (state === 'Overdue') gaps.push(`Test overdue — was due ${new Date(nextDue).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`)
      if (!recordEvidence) {
        if (!doc) gaps.push(`No ${t.evidence.toLowerCase()} in the document register`)
        else if (docExpired) gaps.push(`${t.evidence} on file has expired`)
        else if (!docIssuedInInterval) gaps.push(`Latest ${t.evidence.toLowerCase()} is older than the ${frequencyLabel(t.every).toLowerCase()} interval`)
      }
      if (!performer) gaps.push(t.who === 'Contractor' ? 'No record of which contractor performed it' : 'No record of who performed it')

      return {
        ...t,
        systemLabel: system.label,
        covered,
        firstAsset: covered[0] || null,
        lastDone, lastSource, nextDue, daysToDue, state,
        doc, docCurrent, docExpired, recordEvidence,
        performer,
        trailLines,
        ready: state !== 'Overdue' && docCurrent && Boolean(performer),
        gaps,
      }
    })

    const byKey = new Map(tests.map((t) => [t.key, t]))
    const elements = (D.surveyElements || []).map((el) => {
      const mine = el.tests.map((k) => byKey.get(k)).filter(Boolean)
      const ready = mine.filter((t) => t.ready).length
      return { ...el, tests: mine, ready, total: mine.length, pct: mine.length ? Math.round((ready / mine.length) * 100) : 100 }
    })

    const systems = D.systems.map((s) => ({
      ...s,
      assets: assets.filter((a) => s.kinds.includes(a.asset_type)),
      tests: tests.filter((t) => t.system === s.key),
    }))

    const readyCount = tests.filter((t) => t.ready).length
    const totals = {
      tests: tests.length,
      current: tests.filter((t) => t.state === 'Current').length,
      dueSoon: tests.filter((t) => t.state === 'Due soon').length,
      overdue: tests.filter((t) => t.state === 'Overdue').length,
      missingDocs: tests.filter((t) => !t.recordEvidence && !t.docCurrent).length,
      missingPerformer: tests.filter((t) => !t.performer).length,
      ready: readyCount,
      readiness: tests.length ? Math.round((readyCount / tests.length) * 100) : 100,
      devices: systems.reduce((n, s) => n + s.assets.length, 0),
    }

    return { systems, tests, elements, totals }
  }, [assets, workOrders, documents, labour, trail])
}
