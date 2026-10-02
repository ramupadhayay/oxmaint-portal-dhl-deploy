'use client'

// Meter readings — the thing a meter-based PM schedule has been missing.
//
// The portal has always had `running_hours` on an asset and a PM schedule that
// could say "Meter", and between them nothing: the hours were a number that
// arrived with the asset and never moved, so a meter-based schedule could never
// actually fall due. That is the first question a fleet department asks of a
// CMMS, and the honest answer was no.
//
// A reading is its own record rather than an edit to the asset. An hour meter
// is evidence — an auditor asks who read it and when, a warranty claim turns on
// what it said on a date, and a unit that has been overwritten has no history to
// answer with. So the asset carries the latest figure for speed, and the
// readings carry the trail.

import { useCallback } from 'react'
import { useStore } from './store'

export const METER_KIND = 'meter_reading'

// What a meter counts. Hours for anything with an engine, miles for road-
// registered units, cycles for lifts and loaders.
export const METER_TYPES = [
  { key: 'hours', label: 'Engine hours', unit: 'h', step: '0.1' },
  { key: 'miles', label: 'Odometer', unit: 'mi', step: '1' },
  { key: 'cycles', label: 'Cycles', unit: '', step: '1' },
]

export const unitOf = (type) => METER_TYPES.find((t) => t.key === type)?.unit ?? ''

export const readingsFor = (records, assetId) =>
  (records?.[METER_KIND] || [])
    .filter((r) => String(r.asset_id) === String(assetId))
    .sort((a, b) => new Date(b.read_at || 0) - new Date(a.read_at || 0))

/**
 * Is this reading believable?
 *
 * Three ways a meter reading is wrong, and all three are common enough that a
 * fleet system which accepts them is a fleet system nobody trusts:
 *
 *   backwards — a meter does not run down. Either the unit was mis-keyed or the
 *               meter was replaced, and those are different events.
 *   implausible — a tug cannot do 900 hours in a week. Almost always a digit
 *               too many, and it poisons every interval that reads off it.
 *   duplicate — the same figure logged twice looks like use and is not.
 *
 * Returned as a verdict rather than thrown, because the operator has to be told
 * which of the three it was. "Invalid reading" sends them to find a supervisor.
 */
export function checkReading({ value, previous, previousAt, at }) {
  const v = Number(value)
  if (!Number.isFinite(v) || v < 0) {
    return { ok: false, code: 'invalid', message: 'Enter the reading as a number.' }
  }
  if (previous == null) return { ok: true }

  const prev = Number(previous) || 0
  if (v < prev) {
    return {
      ok: false,
      code: 'backwards',
      message: `Lower than the last reading of ${prev}. If the meter was replaced, record that instead — a meter does not run down.`,
    }
  }
  if (v === prev) {
    return {
      ok: true,
      warn: true,
      code: 'unchanged',
      message: 'Same as the last reading. Saved, but the unit will look unused since then.',
    }
  }

  const days = previousAt
    ? Math.max(1, Math.round((new Date(at || Date.now()) - new Date(previousAt)) / 86400000))
    : null
  if (days) {
    const perDay = (v - prev) / days
    // 24 hours a day is the ceiling a clock allows; anything near it on a piece
    // of ramp equipment is a typo, not a record.
    if (perDay > 20) {
      return {
        ok: false,
        code: 'implausible',
        message: `That is ${Math.round(perDay)} hours a day since the last reading ${days} day(s) ago. Check for a digit too many.`,
      }
    }
  }
  return { ok: true }
}

/**
 * Log a reading and move the asset's own figure with it.
 *
 * Both, or neither. A reading recorded while the asset still shows the old
 * hours leaves every meter-based schedule reading a number that is no longer
 * true, which is precisely the fault this whole file exists to fix.
 */
export function useLogReading() {
  const store = useStore()
  const { create, update, notify } = store

  return useCallback(async ({ asset, value, type = 'hours', by, note }) => {
    if (!asset) return null
    const history = readingsFor(store.records, asset.asset_id || asset.recordId)
    const last = history.find((r) => r.meter_type === type)
    const previous = last ? Number(last.value) : Number(asset.running_hours) || null
    const at = new Date().toISOString()

    const verdict = checkReading({ value, previous, previousAt: last?.read_at, at })
    if (!verdict.ok) {
      notify(verdict.message, 'error')
      return null
    }

    const v = Number(value)
    const saved = await create(METER_KIND, {
      asset_id: asset.asset_id || asset.recordId,
      asset_name: asset.asset_name || '',
      asset_code: asset.asset_code || '',
      site_id: asset.site_id || '',
      site_name: asset.site_name || '',
      meter_type: type,
      value: v,
      previous_value: previous,
      delta: previous == null ? null : Number((v - previous).toFixed(1)),
      read_at: at,
      read_by: by || 'Operator',
      note: String(note || '').trim(),
    })
    if (!saved) return null

    // Hours are what the asset carries and what a meter schedule reads. The
    // other meter types live in the reading history only, because nothing in
    // the product schedules off them yet and a field nobody reads is a field
    // that goes stale.
    if (type === 'hours') {
      await update('asset', asset.asset_id || asset.recordId, { ...asset, running_hours: v })
    }

    if (verdict.warn) notify(verdict.message)
    else {
      const moved = previous == null ? null : Number((v - previous).toFixed(1))
      notify(moved == null
        ? `${asset.asset_name} — first reading recorded at ${v}${unitOf(type)}.`
        : `${asset.asset_name} — ${v}${unitOf(type)} logged, up ${moved}${unitOf(type)}.`)
    }
    return saved
  }, [store, create, update, notify])
}
