'use client'

// Impairments, interim life safety measures, and the Statement of Conditions.
//
// Two things a hospital's life safety programme is judged on that no test
// schedule can answer.
//
// AN IMPAIRMENT is a life safety feature out of service while the building
// stays occupied — a sprinkler riser closed for a corridor renovation, a fire
// alarm panel on bypass while a board is replaced. Patients do not leave, so
// the code's answer is compensating measures: tag the valve, tell the fire
// department, and put a person on a fire watch who signs for every round. The
// measures are the easy part to claim and the hard part to evidence, and the
// fire watch is the one that fails first — not because nobody walked, but
// because nobody signed.
//
// A PFI is a Life Safety Code deficiency the hospital has found itself and
// written down, with the chapter that sets it, a plan, an owner and a date.
// The Statement of Conditions is that list. A surveyor reads it as the
// hospital's own account of what is wrong: a deficiency on the list with a
// plan is a programme working, and the same deficiency found by the surveyor
// and missing from the list is the finding.
//
// Both are built from records the portal already keeps — the fire watch rounds
// are rows, the jobs that fix a deficiency are work orders — so nothing here
// is a status somebody typed over the top of the truth.

import { useCallback, useMemo } from 'react'
import { useRecords, useStore } from './store'
import { useFls } from './fls'
import { ASSETS, DOMAIN, EPOCH, LOCATIONS, USER } from './data'

export const IMPAIRMENT_KIND = 'fls_impairment'
export const WATCH_KIND = 'fls_watch'
export const PFI_KIND = 'fls_pfi'

export const ILSM_ACTIVE = DOMAIN?.key === 'fls'
const D = ILSM_ACTIVE ? DOMAIN : null

const HOUR = 3600000
const DAY = 86400000
const NOW = () => new Date(EPOCH).toISOString()
const time = (iso) => (iso ? new Date(iso).getTime() : 0)
const shift = (iso, ms) => new Date(time(iso) + ms).toISOString()
const hoursBetween = (a, b) => Math.round((time(b) - time(a)) / HOUR)
const daysBetween = (a, b) => Math.round((time(b) - time(a)) / DAY)

// How the seeded rows are matched to their stored copies: a patch to a seeded
// impairment is stored under the seed's own id, which is what useRecords
// compares against.
export const impairmentId = (r) => r.impairment_id || r.recordId
export const pfiId = (r) => r.pfi_id || r.recordId

// How a write addresses a row, which is not the same question.
//
// A row created in the portal has a database recordId of its own (imp_…) and a
// human reference besides (IMP-…). Addressing it by the reference wrote a
// second record instead of updating the first, and the register then showed the
// same impairment twice. The stored id wins wherever there is one; a seeded row
// that has never been touched has none, and its seed id is what its first patch
// is filed under.
const storeId = (r) => String(r.recordId || r.impairment_id || r.pfi_id || '')

/** The measures the code asks for while this kind of system is out of service. */
export const measuresFor = (system) => (D?.ilsmMeasures || []).filter((m) => m.appliesTo.includes(system))

export const SYSTEM_LABEL = Object.fromEntries((D?.systems || []).map((s) => [s.key, s.label]))
export const IMPAIRMENT_CAUSES = ['Construction', 'Planned maintenance', 'Breakdown', 'Utility outage', 'Hot work']

const firstAssetOfKind = (kind) => ASSETS.find((a) => a.asset_type === kind) || null
const locationNamed = (name) => LOCATIONS.find((l) => l.name === name) || null

// The estate's open impairments as the demo opens. Dates are relative to the
// demo's today, so the fire watch on one of them is overdue however long the
// build sits on a shelf.
export const SEEDED_IMPAIRMENTS = (D?.impairments || []).map((imp) => {
  const asset = firstAssetOfKind(imp.assetKind)
  const declared = shift(NOW(), -imp.daysAgo * DAY)
  return {
    impairment_id: imp.key,
    system: imp.system,
    system_label: SYSTEM_LABEL[imp.system] || imp.system,
    asset_id: asset?.asset_id || '',
    asset_name: asset?.asset_name || imp.assetKind,
    asset_code: asset?.asset_code || '',
    asset_type: imp.assetKind,
    site_id: asset?.site_id || '',
    site_name: asset?.site_name || '',
    location_name: asset?.functional_location_name || '',
    reason: imp.reason,
    cause: imp.cause,
    declared_date: declared,
    expected_end: shift(declared, imp.expectedDays * DAY),
    declared_by: imp.declaredBy,
    confirmed: imp.confirmed,
    status: 'Open',
    // Rounds already walked, in hours before now. Underscored so the value
    // never travels into a stored patch — it belongs to the seed, not the row.
    _seededRounds: imp.watchRounds || [],
  }
})

export const SEEDED_PFIS = (D?.pfis || []).map((p) => {
  const loc = locationNamed(p.locationName)
  const discovered = shift(NOW(), -p.daysAgo * DAY)
  return {
    pfi_id: p.key,
    code: p.code,
    title: p.title,
    location_name: p.locationName,
    site_id: loc?.site_id || '',
    discovered_date: discovered,
    target_date: shift(discovered, p.targetDays * DAY),
    ilsm_required: Boolean(p.ilsm),
    owner: p.owner,
    status: 'Open',
    source: 'Self-identified — life safety rounds',
  }
})

/**
 * Every impairment, with what the code asks for beside what the records show.
 *
 * `ready` is the only judgement here, and it is made the same way the testing
 * screen makes its own: each measure the system's impairment calls for is
 * either confirmed on the record or it is not, and a fire watch is current
 * only if the last round was signed inside its interval.
 */
export function useImpairments() {
  const rows = useRecords(IMPAIRMENT_KIND, SEEDED_IMPAIRMENTS, impairmentId)
  const store = useStore()
  const stored = store?.records?.[WATCH_KIND] || []

  return useMemo(() => {
    const now = NOW()
    const items = rows.map((r) => {
      const id = storeId(r)
      const measures = measuresFor(r.system)
      const confirmed = new Set(r.confirmed || [])
      const watchMeasure = measures.find((m) => m.watch) || null

      const seeded = (r._seededRounds || []).map((h, i) => ({
        recordId: `${id}-seed-${i}`,
        impairment_id: id,
        at: shift(now, -h * HOUR),
        by: r.declared_by,
        note: '',
        _seeded: true,
      }))
      const rounds = [...stored.filter((w) => String(w.impairment_id) === id), ...seeded]
        .sort((a, b) => time(b.at) - time(a.at))

      const lastRound = rounds[0] || null
      const sinceLast = lastRound ? hoursBetween(lastRound.at, now) : null
      const every = watchMeasure?.everyHours || 1
      const open = r.status !== 'Closed'
      // Only an open impairment can have a watch falling behind. A closed one's
      // last round is history, and reading it as a live gap would leave the
      // screen shouting about a corridor that has been back in service a week.
      const watchDue = Boolean(watchMeasure) && open && (sinceLast === null || sinceLast >= every)

      const missing = measures.filter((m) => !m.watch && !confirmed.has(m.key))
      const daysOpen = daysBetween(r.declared_date, now)
      const overrun = open && r.expected_end ? daysBetween(r.expected_end, now) : 0

      const gaps = []
      if (watchDue) {
        gaps.push(sinceLast === null
          ? 'Fire watch has no signed round at all'
          : `Fire watch last signed ${sinceLast} ${sinceLast === 1 ? 'hour' : 'hours'} ago — the round is hourly`)
      }
      for (const m of missing) gaps.push(`${m.label} — not confirmed`)
      if (overrun > 0) gaps.push(`Past its expected return to service by ${overrun} ${overrun === 1 ? 'day' : 'days'}`)

      return {
        ...r,
        _id: id,
        measures,
        confirmedKeys: confirmed,
        watchMeasure,
        rounds,
        roundCount: rounds.length,
        lastRound,
        sinceLast,
        watchEveryHours: every,
        watchDue,
        missing,
        daysOpen,
        overrun,
        open,
        ready: open ? !watchDue && !missing.length : true,
        gaps,
      }
    }).sort((a, b) => Number(b.open) - Number(a.open) || time(b.declared_date) - time(a.declared_date))

    const live = items.filter((i) => i.open)
    return {
      items,
      open: live,
      totals: {
        open: live.length,
        watchDue: live.filter((i) => i.watchDue).length,
        measuresMissing: live.reduce((n, i) => n + i.missing.length, 0),
        overrun: live.filter((i) => i.overrun > 0).length,
        ready: live.filter((i) => i.ready).length,
        roundsToday: items.reduce((n, i) => n + i.rounds.filter((w) => hoursBetween(w.at, NOW()) < 24).length, 0),
      },
    }
  }, [rows, stored])
}

/**
 * The Statement of Conditions, and what is not on it yet.
 *
 * `listed` is the SOC itself. `candidates` are the deficiencies the testing
 * screen can already prove — a test overdue, a certificate that expired — that
 * nobody has written into the SOC. That gap is the interesting one: the
 * evidence is in the building and the hospital's own account of itself does
 * not mention it.
 */
export function usePfis() {
  const rows = useRecords(PFI_KIND, SEEDED_PFIS, pfiId)
  const { tests } = useFls()

  return useMemo(() => {
    const now = NOW()
    const listed = rows.map((r) => {
      const open = r.status !== 'Resolved'
      const toTarget = r.target_date ? daysBetween(now, r.target_date) : null
      return {
        ...r,
        _id: storeId(r),
        open,
        daysOpen: daysBetween(r.discovered_date, now),
        daysToTarget: toTarget,
        overdue: open && toTarget !== null && toTarget < 0,
      }
    }).sort((a, b) => Number(b.open) - Number(a.open)
      || (a.daysToTarget ?? 0) - (b.daysToTarget ?? 0))

    const covered = new Set(listed.map((p) => p.test_key).filter(Boolean))
    const candidates = tests
      .filter((t) => !t.ready && !covered.has(t.key))
      .map((t) => ({
        test_key: t.key,
        code: t.standard,
        title: t.gaps[0] ? `${t.label} — ${t.gaps[0].toLowerCase()}` : t.label,
        location_name: t.firstAsset?.functional_location_name || '',
        site_id: t.firstAsset?.site_id || '',
        asset_id: t.firstAsset?.asset_id || '',
        system: t.systemLabel,
        ilsm_required: t.state === 'Overdue',
      }))

    const open = listed.filter((p) => p.open)
    return {
      listed,
      open,
      candidates,
      totals: {
        listed: listed.length,
        open: open.length,
        overdue: open.filter((p) => p.overdue).length,
        ilsm: open.filter((p) => p.ilsm_required).length,
        candidates: candidates.length,
        resolved: listed.length - open.length,
      },
    }
  }, [rows, tests])
}

/** Declare a life safety feature out of service. */
export function useDeclareImpairment() {
  const { create, notify } = useStore()
  return useCallback(async ({ system, asset, reason, cause, expectedDays = 7, confirmed = [] }) => {
    if (!reason?.trim()) { notify('Say what is out of service and why.', 'error'); return null }
    const declared = NOW()
    return create(IMPAIRMENT_KIND, {
      impairment_id: `IMP-${Date.now().toString(36).toUpperCase()}`,
      system,
      system_label: SYSTEM_LABEL[system] || system,
      asset_id: asset?.asset_id || asset?.recordId || '',
      asset_name: asset?.asset_name || '',
      asset_code: asset?.asset_code || '',
      asset_type: asset?.asset_type || '',
      site_id: asset?.site_id || '',
      site_name: asset?.site_name || '',
      location_name: asset?.functional_location_name || '',
      reason: reason.trim(),
      cause,
      declared_date: declared,
      expected_end: shift(declared, Number(expectedDays || 7) * DAY),
      declared_by: USER.name,
      confirmed,
      status: 'Open',
    })
  }, [create, notify])
}

/** Sign for a fire watch round. */
export function useLogWatchRound() {
  const { create, notify } = useStore()
  return useCallback(async ({ impairment, by, note = '' }) => {
    if (!impairment) return null
    const who = (by || '').trim() || USER.name
    const row = await create(WATCH_KIND, {
      impairment_id: String(impairment._id || storeId(impairment)),
      title: `Fire watch — ${impairment.asset_name || impairment.system_label}`,
      asset_id: impairment.asset_id || '',
      site_id: impairment.site_id || '',
      at: NOW(),
      by: who,
      note: String(note).trim(),
    })
    if (row) notify(`Round signed by ${who}.`)
    return row
  }, [create, notify])
}

/** Confirm — or take back — one of the compensating measures. */
export function useSetMeasure() {
  const { update } = useStore()
  return useCallback(async (impairment, key, on) => {
    const current = new Set(impairment.confirmed || [])
    if (on) current.add(key); else current.delete(key)
    return update(IMPAIRMENT_KIND, String(impairment._id || storeId(impairment)), {
      ...stripped(impairment),
      confirmed: [...current],
    })
  }, [update])
}

/** Put the feature back in service. */
export function useCloseImpairment() {
  const { update, notify } = useStore()
  return useCallback(async (impairment, note = '') => {
    const saved = await update(IMPAIRMENT_KIND, String(impairment._id || storeId(impairment)), {
      ...stripped(impairment),
      status: 'Closed',
      closed_date: NOW(),
      closed_by: USER.name,
      close_note: String(note).trim(),
    })
    if (saved) notify(`${impairment.asset_name || impairment.system_label} back in service.`)
    return saved
  }, [update, notify])
}

/** Add a deficiency to the Statement of Conditions. */
export function useAddPfi() {
  const { create, notify } = useStore()
  return useCallback(async ({ code, title, locationName = '', siteId = '', targetDays = 60, ilsm = false, owner = '', testKey = '', assetId = '' }) => {
    if (!title?.trim() || !code) { notify('A deficiency needs its code and what was found.', 'error'); return null }
    const discovered = NOW()
    return create(PFI_KIND, {
      pfi_id: `PFI-${Date.now().toString(36).toUpperCase()}`,
      code,
      title: title.trim(),
      location_name: locationName,
      site_id: siteId,
      asset_id: assetId,
      discovered_date: discovered,
      target_date: shift(discovered, Number(targetDays || 60) * DAY),
      ilsm_required: Boolean(ilsm),
      owner: owner || USER.name,
      status: 'Open',
      // Which test proved it, when it came from one. The SOC then knows not to
      // offer the same deficiency twice.
      test_key: testKey,
      source: testKey ? 'Found by the testing programme' : 'Self-identified',
      logged_by: USER.name,
    })
  }, [create, notify])
}

/** Mark a deficiency put right. */
export function useResolvePfi() {
  const { update, notify } = useStore()
  return useCallback(async (pfi, note = '') => {
    const saved = await update(PFI_KIND, String(pfi._id || storeId(pfi)), {
      ...stripped(pfi),
      status: 'Resolved',
      resolved_date: NOW(),
      resolved_by: USER.name,
      resolution_note: String(note).trim(),
    })
    if (saved) notify('Deficiency marked resolved.')
    return saved
  }, [update, notify])
}

// The record's own values. Everything a screen computed onto the row stays on
// the screen: a Set or a measure list written into the database would be stored
// state that disagrees with the code the next time the pack changes.
function stripped(row) {
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    if (k.startsWith('_')) continue
    if (typeof v === 'function' || v instanceof Set) continue
    if (['measures', 'rounds', 'lastRound', 'watchMeasure', 'missing', 'gaps', 'confirmedKeys'].includes(k)) continue
    out[k] = v
  }
  return out
}
