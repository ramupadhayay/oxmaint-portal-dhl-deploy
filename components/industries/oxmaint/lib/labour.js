'use client'

// Labour — who worked on a job, for how long, and what it cost.
//
// The Labour screen used to be a table computed once from the seeded work
// orders, so time booked in the portal never reached it. Worse, a job completed
// from its own page lost the logged minutes on the way: the execution screen
// sent them and the page's status handler took one argument. Both are fixed
// around one record: a labour entry, written every time time is booked.
//
// Contractors are first-class rather than a note on a job. In a hospital's life
// safety programme, and in most facilities, a large share of the regulated
// work — sprinkler certification, generator load banks, fire door surveys — is
// done by outside firms, and "who performed this test" is the question a
// surveyor asks. A labour record that only knows employees cannot answer it.

import { useCallback, useMemo } from 'react'
import { useStore } from './store'
import { ASSETS, DOMAIN, EPOCH, TECHNICIANS, VENDORS, USER, PLANNER_NAME, seed, between } from './data'
import { LABOUR } from './dataOps'

export const LABOUR_KIND = 'labour_entry'
export const WORKER_TYPES = ['In-house', 'Contractor']

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

/** An in-house technician's rate, from the labour register. */
export const inHouseRate = (name) =>
  LABOUR.find((l) => l.name === name)?.hourly_rate ?? 35

/**
 * A contractor's hourly rate.
 *
 * Seeded per vendor so the same firm always bills the same rate, and pitched
 * where specialist service contractors actually sit — two to four times an
 * in-house rate. A contractor cheaper than the staff would be the first thing
 * anyone who has paid one noticed.
 */
export const contractorRate = (vendorName) =>
  between(`rate-${vendorName || 'contractor'}`, 85, 145)

export const TECHNICIAN_NAMES = TECHNICIANS
  .filter((t) => t.role !== 'Administrator')
  .map((t) => t.name)

export const VENDOR_NAMES = VENDORS.map((v) => v.vendor_name)

/**
 * The contractor visits the pack arrives with.
 *
 * Certified testing is bought in, so on a build nobody has clicked yet the
 * Contractors table was empty and every test's "performed by" was a modelled
 * guess. These are the visits behind the estate's own history — the firm, their
 * technician, the hours, the service report number — filed against the first
 * asset of the kind the test is run on, which is the same asset the pack's
 * evidence documents are filed against.
 *
 * They carry `_seeded`, and the Labour screen counts only what was booked in
 * the portal as booked there. A seeded row that claimed to be one would make
 * "booked here" a number nobody could reconcile against the entries beside it.
 */
const SEEDED_VISITS = (DOMAIN?.contractorVisits || []).map((v, i) => {
  const asset = ASSETS.find((a) => a.asset_type === v.assetKind) || null
  const hours = round2(v.hours)
  const rate = v.rate ?? contractorRate(v.vendor)
  return {
    recordId: `lab-seed-${i + 1}`,
    work_order_id: '',
    work_order_number: v.workOrder || '',
    title: `${v.workOrder || 'Visit'} — ${v.vendor}`,
    work_order_title: v.title || '',
    asset_id: asset?.asset_id || '',
    asset_name: asset?.asset_name || v.assetKind || '',
    site_id: asset?.site_id || '',
    worker_type: 'Contractor',
    worker_name: v.technician || '',
    vendor_name: v.vendor,
    trade: 'Contractor',
    hours,
    rate,
    cost: round2(hours * rate),
    work_date: new Date(EPOCH - v.daysAgo * 86400000).toISOString().slice(0, 10),
    note: v.report ? `Service report ${v.report}` : '',
    entered_by: PLANNER_NAME,
    _seeded: true,
  }
})

/** Entries, newest first — for one work order when one is named. */
export function useLabourEntries(workOrderId) {
  const store = useStore()
  const rows = store?.records?.[LABOUR_KIND]
  return useMemo(() => [...(rows || []), ...SEEDED_VISITS]
    .filter((r) => !workOrderId || String(r.work_order_id) === String(workOrderId)
      || (r.work_order_number && r.work_order_number === String(workOrderId)))
    .sort((a, b) => String(b.work_date || '').localeCompare(String(a.work_date || ''))
      || String(b._createdAt || '').localeCompare(String(a._createdAt || ''))),
  [rows, workOrderId])
}

/**
 * Book time against a work order, and move the job's own totals with it.
 *
 * Both, or it is not booked. An entry the job does not reflect leaves the Time
 * tab and the Labour screen disagreeing about the same hours; a job total with
 * no entry behind it is a number nobody can say who produced.
 */
export function useLogLabour() {
  const { create, update, notify } = useStore()

  return useCallback(async ({
    wo, workOrderRecordId, workerType = 'In-house', workerName = '', vendorName = '',
    trade = '', hours, rate, workDate, note = '', silent = false,
  }) => {
    const h = round2(hours)
    if (!wo || !(h > 0)) {
      notify('Enter the hours worked — more than zero.', 'error')
      return null
    }
    const contractor = workerType === 'Contractor'
    if (contractor && !vendorName) {
      notify('Choose the contractor who did the work.', 'error')
      return null
    }
    if (!contractor && !workerName) {
      notify('Choose the technician who did the work.', 'error')
      return null
    }

    const r = round2(rate ?? (contractor ? contractorRate(vendorName) : inHouseRate(workerName)))
    const cost = round2(h * r)
    const entry = await create(LABOUR_KIND, {
      work_order_id: String(workOrderRecordId || wo.workorder_id || wo.recordId),
      work_order_number: wo.work_order_number || '',
      title: `${wo.work_order_number || 'Job'} — ${contractor ? vendorName : workerName}`,
      work_order_title: wo.title || '',
      asset_id: wo.asset_id || '',
      asset_name: wo.asset_name || '',
      site_id: wo.site_id || '',
      worker_type: contractor ? 'Contractor' : 'In-house',
      worker_name: contractor ? (workerName || vendorName) : workerName,
      vendor_name: contractor ? vendorName : '',
      trade: trade || (contractor ? 'Contractor' : (TECHNICIANS.find((t) => t.name === workerName)?.trade || '')),
      hours: h,
      rate: r,
      cost,
      work_date: (workDate || new Date().toISOString()).slice(0, 10),
      note: String(note || '').trim(),
      entered_by: USER.name,
    })
    if (!entry) return null

    const saved = await update('work_order', String(workOrderRecordId || wo.workorder_id || wo.recordId), {
      ...wo,
      actual_hours: round2((Number(wo.actual_hours) || 0) + h),
      labour_cost: round2((Number(wo.labour_cost) || 0) + cost),
    })
    if (saved && !silent) {
      notify(`${h} h booked to ${wo.work_order_number} — ${contractor ? vendorName : workerName}.`)
    }
    return entry
  }, [create, update, notify])
}

/**
 * The register, by person and by firm, from what has actually been booked.
 *
 * Seeded history is kept underneath so a fresh portal does not open on an empty
 * labour report, but it is only the starting point: every entry booked here is
 * added to the right row, and a contractor exists on this screen only because
 * time was booked to them.
 */
export function labourRollup(seededRows, entries) {
  const people = new Map(seededRows.map((r) => [r.name, { ...r, entries: 0 }]))
  const firms = new Map()

  for (const e of entries) {
    if (e.worker_type === 'Contractor') {
      const f = firms.get(e.vendor_name) || {
        vendor_name: e.vendor_name, hours: 0, cost: 0, jobs: new Set(), entries: 0, site_id: e.site_id,
      }
      f.hours = round2(f.hours + (Number(e.hours) || 0))
      f.cost = round2(f.cost + (Number(e.cost) || 0))
      f.jobs.add(e.work_order_number)
      f.entries += 1
      firms.set(e.vendor_name, f)
      continue
    }
    const tech = TECHNICIANS.find((t) => t.name === e.worker_name)
    const p = people.get(e.worker_name) || {
      labour_id: `live-${e.worker_name}`, name: e.worker_name, role: tech?.role || 'Technician',
      trade: e.trade || tech?.trade || '', hourly_rate: e.rate, hours_logged: 0, jobs_completed: 0,
      cost: 0, utilisation: 0, site_id: e.site_id, entries: 0,
    }
    p.hours_logged = round2(p.hours_logged + (Number(e.hours) || 0))
    p.cost = round2(p.cost + (Number(e.cost) || 0))
    p.entries += 1
    people.set(e.worker_name, p)
  }

  return {
    people: [...people.values()],
    firms: [...firms.values()].map((f) => ({ ...f, jobs: f.jobs.size })),
  }
}
