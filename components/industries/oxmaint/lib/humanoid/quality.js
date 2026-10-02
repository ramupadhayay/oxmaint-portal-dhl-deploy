// Filler-outfeed quality spec for one synthetic nutrition carton.
// Station frames are what the head camera already sees. Not a live line and
// not a customer's release record. A pass stays on the belt. A fail is a
// wrist-jaw pick into the reject bin.

import { POSES, armCommand, jawCommand, velocityCommand } from './sdk'

export const SPEC = {
  id: 'SPEC-UHT-200',
  product: 'UHT nutrition carton',
  sku: 'UHT-200',
  fill_ml: 200,
  station: 'Filler outfeed',
  reject_bin: 'Reject lane R1',
  checks: [
    { id: 'seal', name: 'Fin seal', pass: 'Continuous fin. No channel, no product weep.' },
    { id: 'fill', name: 'Fill witness', pass: 'Liquid between the min and max lines.' },
    { id: 'cap', name: 'Cap', pass: 'Seated square. Tamper band intact.' },
    { id: 'label', name: 'Label and lot', pass: 'Label present. Lot code readable. SKU UHT-200.' },
    { id: 'foreign', name: 'Window', pass: 'Clear. No dark inclusion.' },
  ],
}

export const UNITS = [
  { id: 'CTN-1901', frame: 'Fin even, fill on the witness, cap square, lot readable, window clear.', fails: [] },
  { id: 'CTN-1902', frame: 'Product weep at the fin. A channel runs to the edge.', fails: ['seal'] },
  { id: 'CTN-1903', frame: 'No label on the face. Lot code is not there.', fails: ['label'] },
  { id: 'CTN-1904', frame: 'Cap cocked. Tamper band split on one side.', fails: ['cap'] },
  { id: 'CTN-1905', frame: 'Fin even, fill on the witness, cap square, lot readable, window clear.', fails: [] },
  { id: 'CTN-1906', frame: 'Liquid sitting below the min line.', fails: ['fill'] },
]

const CHECK_IDS = new Set(SPEC.checks.map((row) => row.id))

function step(label, publish) {
  return { label, publish }
}

function photo(unit) {
  return step(`Photograph ${unit.id}`, {
    camera: 'head',
    action: 'capture',
    unit: unit.id,
    frame: unit.frame,
  })
}

export function passSteps(unit) {
  return [
    photo(unit),
    step('Look at the carton', armCommand(POSES.look, 1)),
    step('Hold. Jaw stays open. Carton stays on the belt.', {
      ...velocityCommand(0, 0, 0, 1),
      jaw: 'open',
      disposition: 'stay on the line',
    }),
  ]
}

export function rejectSteps(unit) {
  return [
    photo(unit),
    step('Look at the carton', armCommand(POSES.look, 1)),
    step('Approach the carton', velocityCommand(0.15, 0, 0, 2)),
    step('Reach with the right arm', armCommand(POSES.reach, 1)),
    step('Close the jaw on the carton', jawCommand('close')),
    step('Lift it off the belt', armCommand(POSES.lift, 1)),
    step(`Carry to ${SPEC.reject_bin}`, velocityCommand(0.2, 0.15, 0, 3)),
    step('Open the jaw. Release into the reject bin.', jawCommand('open')),
    step('Back off the lane', velocityCommand(-0.15, 0, 0, 2)),
    step('Arms home', armCommand(POSES.home, 1)),
  ]
}

export function judgeFails(fails, { id = 'PHOTO', frame = '' } = {}) {
  const clean = [...new Set((fails || []).filter((item) => CHECK_IDS.has(item)))]
  const unit = { id, frame, fails: clean }
  const failed = SPEC.checks.filter((row) => clean.includes(row.id))
  const pass = failed.length === 0
  return {
    unit_id: id,
    frame,
    pass,
    failed: failed.map((row) => ({ id: row.id, name: row.name })),
    disposition: pass ? 'stay on the line' : `jaw pick to ${SPEC.reject_bin}`,
    steps: pass ? passSteps(unit) : rejectSteps(unit),
  }
}

export function judgeUnit(unitId) {
  const unit = UNITS.find((row) => row.id.toLowerCase() === String(unitId || '').trim().toLowerCase())
  if (!unit) return null
  const judged = judgeFails(unit.fails, unit)
  return { ...judged, frame: unit.frame, source: 'station camera' }
}

export function inspectStation(unitId) {
  if (unitId) {
    const one = judgeUnit(unitId)
    if (!one) {
      return {
        ok: false,
        understood: true,
        intent: 'quality_inspection',
        say: `I do not have ${unitId} on this station. The frames here are ${UNITS.map((row) => row.id).join(', ')}.`,
        steps: [],
      }
    }
    return {
      ok: true,
      understood: true,
      intent: 'quality_inspection',
      spec: SPEC.id,
      results: [one],
      say: one.pass
        ? `${one.unit_id} meets ${SPEC.id}. It stays on the line. The jaw stays open.`
        : `${one.unit_id} fails ${one.failed.map((row) => row.name).join(', ')}. I will jaw-pick it into ${SPEC.reject_bin}.`,
      steps: one.steps,
    }
  }
  const results = UNITS.map((unit) => judgeUnit(unit.id))
  const bad = results.filter((row) => !row.pass)
  const steps = results.flatMap((row) => row.steps)
  return {
    ok: true,
    understood: true,
    intent: 'quality_inspection',
    spec: SPEC.id,
    results,
    say: bad.length
      ? `${bad.length} of ${results.length} cartons fail ${SPEC.id}. Good cartons stay on the belt. I jaw-pick ${bad.map((row) => row.unit_id).join(', ')} into ${SPEC.reject_bin}.`
      : `Every carton on the station meets ${SPEC.id}. Nothing comes off the line.`,
    steps,
  }
}
