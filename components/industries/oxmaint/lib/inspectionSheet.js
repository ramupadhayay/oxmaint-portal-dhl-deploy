// What an inspection asks for on a particular machine.
//
// The item bank in inspectionItems.jsx asks a technician to agree with a
// sentence, which is the right shape for a walk-round and the wrong shape for a
// condition survey: "bearing running hot" stays an opinion until somebody
// writes 84 C beside a limit of 75. A register that never records the number
// cannot show the trend that would have caught the failure a month earlier, and
// cannot tell a supervisor which of two failed lines to send somebody to first.
//
// So a line here can carry a reading with its unit and the band it has to sit
// inside, and can be marked critical — the failures that are not a note for
// next month.
//
// Which lines apply is a property of the machine rather than of the round:
// vibration at the drive end means something on a pump and nothing on a
// refrigerant monitor. The buckets below cover both shipped packs, and anything
// they do not recognise falls through to a general set, so a new pack gets a
// sensible sheet on the day it is added rather than an empty one.

import { ASSETS, seed } from './data'

// ── the lines ────────────────────────────────────────────────────────────
//
// `ok` and `bad` are the two readings the reconstruction below draws from — a
// value the machine sits at when it is well, and one it sits at when the line
// is the reason the round failed. They are never shown as measurements in their
// own right; only a run or a reconstruction turns them into one.
const BUCKETS = [
  {
    key: 'rot',
    label: 'Rotating plant',
    match: ['pump', 'compressor', 'fan', 'blower', 'motor', 'gearbox', 'drive', 'agitator', 'mixer', 'turbine'],
    lines: [
      { text: 'General condition, guarding and no visible leaks', type: 'pass' },
      { text: 'Vibration velocity at the drive-end bearing', type: 'reading', unit: 'mm/s', limit: '<= 4.5', ok: 2.6, bad: 7.2, critical: true },
      { text: 'Bearing temperature, non-drive end', type: 'reading', unit: 'C', limit: '<= 75', ok: 54, bad: 91 },
      { text: 'Running current against the nameplate rating', type: 'reading', unit: 'A', limit: '<= 42', ok: 31, bad: 48 },
      { text: 'Lubricant level and condition at the sight glass', type: 'pass' },
      { text: 'Shaft seal dry, no weeping at the gland', type: 'pass' },
      { text: 'Coupling guard refitted and alignment marks intact', type: 'pass', critical: true },
      { text: 'Baseplate, holding-down bolts and anti-vibration mounts', type: 'pass' },
      { text: 'Housekeeping and labelling at the machine', type: 'done' },
    ],
  },
  {
    key: 'hyd',
    label: 'Hydraulic plant',
    match: ['hydraulic', 'press', 'ram', 'punch', 'baler', 'shear'],
    lines: [
      { text: 'Guards, light curtain and two-hand control proved', type: 'pass', critical: true },
      { text: 'System pressure at full stroke', type: 'reading', unit: 'bar', limit: '160-190', ok: 176, bad: 128, critical: true },
      { text: 'Hydraulic oil temperature in the tank', type: 'reading', unit: 'C', limit: '<= 60', ok: 46, bad: 72 },
      { text: 'Return filter differential pressure', type: 'reading', unit: 'bar', limit: '<= 2.0', ok: 0.8, bad: 2.9 },
      { text: 'Oil level and condition, no water or aeration', type: 'pass' },
      { text: 'Hoses, fittings and cylinder rods free of weeping', type: 'pass' },
      { text: 'Ram creep checked against the holding valve', type: 'pass' },
      { text: 'Tooling clamped and platen bolts torqued', type: 'done' },
    ],
  },
  {
    key: 'conv',
    label: 'Material handling',
    match: ['conveyor', 'belt', 'elevator', 'stacker', 'crane', 'hoist', 'material handling'],
    lines: [
      { text: 'Guards, edge protection and pull-wire in place', type: 'pass', critical: true },
      { text: 'Emergency pull-wire tested along the full run', type: 'done', critical: true },
      { text: 'Belt run-off from centre at the tail drum', type: 'reading', unit: 'mm', limit: '<= 15', ok: 6, bad: 27 },
      { text: 'Drive motor current under normal load', type: 'reading', unit: 'A', limit: '<= 28', ok: 19, bad: 34 },
      { text: 'Bearing temperature at the drive drum', type: 'reading', unit: 'C', limit: '<= 70', ok: 48, bad: 86 },
      { text: 'Gearbox oil level and output seal dry', type: 'pass' },
      { text: 'Idlers and rollers turning freely, none seized', type: 'pass' },
      { text: 'Spillage cleared and the walkway alongside kept clear', type: 'done' },
    ],
  },
  {
    key: 'mob',
    label: 'Mobile plant',
    match: ['forklift', 'lift truck', 'telehandler', 'loader', 'vehicle', 'lift'],
    lines: [
      { text: 'Walk-round: tyres, forks, mast and carriage', type: 'pass' },
      { text: 'Mast chain stretch measured against the datum', type: 'reading', unit: '%', limit: '<= 3', ok: 1.2, bad: 4.3, critical: true },
      { text: 'Hydraulic oil level and no leak at the lift ram', type: 'pass' },
      { text: 'Lift, tilt and reach through full travel', type: 'pass' },
      { text: 'Service brake tested and parking brake holds', type: 'pass', critical: true },
      { text: 'Fuel or charge level at the start of the shift', type: 'reading', unit: '%', limit: '>= 40', ok: 78, bad: 21 },
      { text: 'Horn, lights, beacon and mirrors working', type: 'pass' },
      { text: 'Operator daily check sheet completed and signed', type: 'done' },
    ],
  },
  {
    key: 'heat',
    label: 'Heat transfer plant',
    match: ['chiller', 'cooling', 'cooler', 'tower', 'boiler', 'condenser', 'evaporator', 'air handling', 'ahu', 'exchanger', 'radiator', 'coil', 'calorifier'],
    lines: [
      { text: 'General condition, mountings and no visible leaks', type: 'pass' },
      { text: 'Differential pressure across the filter bank', type: 'reading', unit: 'Pa', limit: '<= 250', ok: 168, bad: 320 },
      { text: 'Approach temperature across the bundle', type: 'reading', unit: 'C', limit: '<= 3.5', ok: 2.2, bad: 5.6, critical: true },
      { text: 'Supply and return water temperature', type: 'reading', unit: 'C', limit: '6-12', ok: 8.4, bad: 15.1 },
      { text: 'Vibration at running speed on the drive', type: 'reading', unit: 'mm/s', limit: '<= 4.5', ok: 2.4, bad: 6.6 },
      { text: 'Tubes, coil face and fill clean and free of fouling', type: 'pass' },
      { text: 'Condensate drain clear and trap primed', type: 'pass' },
      { text: 'Controls, set-points and alarms reading normal', type: 'pass', critical: true },
      { text: 'Water treatment dosing checked and sample drawn', type: 'done' },
    ],
  },
  {
    key: 'proc',
    label: 'Process plant',
    match: ['extrud', 'purge', 'oven', 'furnace', 'reactor', 'granulator', 'moulding', 'injection', 'mill', 'dryer'],
    lines: [
      { text: 'Process temperature deviation from set-point', type: 'reading', unit: 'C', limit: '<= 5', ok: 1.8, bad: 9.6 },
      { text: 'Drive or pump load against the rated duty', type: 'reading', unit: '%', limit: '<= 85', ok: 62, bad: 96 },
      { text: 'Discharge pressure at the process connection', type: 'reading', unit: 'bar', limit: '<= 12', ok: 8.4, bad: 15.6, critical: true },
      { text: 'Heaters, elements and thermocouples intact and secured', type: 'pass', critical: true },
      { text: 'Cooling water flow through the jacket', type: 'reading', unit: 'l/min', limit: '>= 8', ok: 14, bad: 5 },
      { text: 'Vent, vacuum and drain lines clear of blockage', type: 'pass' },
      { text: 'Running hours logged and compared with the last round', type: 'pass' },
      { text: 'Start-up and shutdown record completed', type: 'done' },
    ],
  },
  {
    key: 'instr',
    label: 'Instrumentation',
    match: ['monitor', 'sensor', 'transmitter', 'analyser', 'analyzer', 'detector', 'gauge', 'meter', 'instrument', 'controller'],
    lines: [
      { text: 'Enclosure, mounting and cable glands sound', type: 'pass' },
      { text: 'Indicated value against the reference instrument', type: 'reading', unit: '% err', limit: '<= 1.0', ok: 0.3, bad: 2.2, critical: true },
      { text: 'Zero and span checked at the transmitter', type: 'reading', unit: '% span', limit: '<= 0.5', ok: 0.2, bad: 1.4 },
      { text: 'Sensing line, filter or sample cell clean', type: 'pass' },
      { text: 'Alarm set-points match the schedule', type: 'pass', critical: true },
      { text: 'Loop signal proved through to the control system', type: 'pass' },
      { text: 'Calibration certificate in date and the record updated', type: 'done' },
    ],
  },
]

const GENERAL = {
  key: 'gen',
  label: 'General plant',
  lines: [
    { text: 'General visual condition and mounting', type: 'pass' },
    { text: 'Key operating parameter within its normal band', type: 'reading', unit: '%', limit: '<= 85', ok: 54, bad: 93 },
    { text: 'Fixings, connections and guarding secure', type: 'pass' },
    { text: 'No leaks, unusual noise or overheating', type: 'pass' },
    { text: 'Functional check through a normal cycle', type: 'pass', critical: true },
    { text: 'Housekeeping, access and labelling', type: 'done' },
  ],
}

// Every line in the file, by its text.
//
// The reconstruction is handed the lines it has to answer, and the two numbers
// behind a reading are not on them — a sheet that has been signed should not
// carry the value the code expected to see. Looking them up by text rather than
// by re-deriving the machine's bucket means a caller that composes a sheet some
// other way still gets its readings; wording is what identifies a line, and two
// lines that read the same are the same measurement.
const BANDS = new Map([...BUCKETS.flatMap((b) => b.lines), ...GENERAL.lines].map((l) => [l.text, l]))

/**
 * The bucket a machine belongs to.
 *
 * Order is load-bearing and not alphabetical. "Compressor" contains "press", so
 * rotating plant has to be tested before hydraulic or an air compressor gets a
 * platen and a light curtain; "Condenser Water Pump" contains "condenser", so
 * rotating has to be tested before heat transfer or a pump gets a tube bundle.
 * Anything unmatched gets the general set rather than nothing — a sheet with no
 * lines on it is the one outcome a technician cannot work with.
 */
function bucketFor(assetType = '') {
  const t = String(assetType).toLowerCase()
  return BUCKETS.find((b) => b.match.some((k) => t.includes(k))) || GENERAL
}

/** The raw lines for a machine — text, type, unit, limit, critical. */
export const sheetLines = (assetType) => bucketFor(assetType).lines

/** How many condition lines a machine adds to a round. */
export const conditionCount = (assetType) => (assetType ? sheetLines(assetType).length : 0)

const RESPONSE_TYPE = { reading: 'Reading', done: 'Done / not done', pass: 'Pass / fail' }

/**
 * The asset type behind a record.
 *
 * An inspection stores the asset it was raised against, not what kind of thing
 * it is, so the type is read off the register. A record written by the runner
 * carries `asset_type` itself; falling back to the name works because a name is
 * "<kind> 07", and matching is on substrings either way.
 */
export function assetTypeFor(record = {}) {
  if (record.asset_type) return record.asset_type
  const asset = ASSETS.find((a) => a.asset_id === record.asset_id)
  return asset?.asset_type || record.asset_name || ''
}

/**
 * The blank condition sheet for a machine, in the shape the runner answers.
 *
 * Ids carry the bucket key because the runner lets a technician change the
 * asset mid-round. Without it, line three of a pump sheet and line three of a
 * chiller sheet would share an id, and switching between them would inherit an
 * answer given to a different question.
 */
export function inspectionTemplate(assetType, key = 'cond') {
  const bucket = bucketFor(assetType)
  const group = assetType ? `Condition — ${assetType}` : 'Asset condition'
  return bucket.lines.map((l, i) => ({
    id: `${key}_${bucket.key}${i + 1}`,
    text: l.text,
    type: l.type,
    unit: l.unit || '',
    limit: l.limit || '',
    critical: Boolean(l.critical),
    responseType: RESPONSE_TYPE[l.type] || RESPONSE_TYPE.pass,
    group,
  }))
}

/**
 * Whether a reading sits inside its limit.
 *
 * Returns null rather than false when the limit is not something arithmetic can
 * judge — "within band" is a sentence, and reporting a technician's reading as
 * out of limit because the code could not parse the limit would be worse than
 * saying nothing.
 */
export function withinLimit(limit, value) {
  // An empty field is not a reading of nought. Number('') is 0, so without this
  // a line whose limit is ">= 40" would report itself outside its band before
  // the technician had typed anything into it.
  if (value === null || value === undefined || String(value).trim() === '') return null
  const v = Number(value)
  if (!Number.isFinite(v)) return null
  const l = String(limit || '').trim()
  let m = l.match(/^<=?\s*(-?[\d.]+)$/)
  if (m) return v <= Number(m[1])
  m = l.match(/^>=?\s*(-?[\d.]+)$/)
  if (m) return v >= Number(m[1])
  m = l.match(/^([\d.]+)\s*-\s*([\d.]+)$/)
  if (m) return v >= Number(m[1]) && v <= Number(m[2])
  return null
}

/** What a verdict is called on this line — "done" lines are not passed, they are done. */
export function verdictLabel(item = {}) {
  if (item.response === 'fail') return item.type === 'done' ? 'Not done' : 'Fail'
  if (item.response === 'na') return 'N/A'
  if (item.response === 'pass') return item.type === 'done' ? 'Done' : 'Pass'
  return 'Not answered'
}

/**
 * Grade an answered sheet.
 *
 * The one copy of the rule. The runner scores a live round with it and the
 * reconstruction below is built to be read by it, so a sheet and the record
 * over it can never come out with two different words for one state — which is
 * what would happen the first time somebody fixed a rounding rule in one place.
 *
 * N/A is left out of the score rather than counted as a pass: a guard that is
 * not fitted to this machine is not evidence that it is sound.
 */
export function gradeSheet(items = [], note = '') {
  const scored = items.filter((i) => i.response !== 'na')
  const passed = scored.filter((i) => i.response === 'pass').length
  const failed = items.filter((i) => i.response === 'fail').length
  return {
    items_total: items.length,
    items_passed: passed,
    items_failed: failed,
    items_na: items.length - scored.length,
    score: scored.length ? Math.round((passed / scored.length) * 100) : 100,
    result: failed ? 'Fail' : String(note).trim() ? 'Pass with observations' : 'Pass',
  }
}

/**
 * A filled sheet for a report the portal did not record.
 *
 * The forty seeded reports carry a result, a score and a count of findings, and
 * no answers — so an old inspection reads as a bare percentage with nothing
 * behind it. This rebuilds a sheet that is consistent with what the record does
 * say: a report that failed has as many failed lines as it has findings, one
 * with observations has the same lines sitting at the edge of their band, and a
 * clean pass passes throughout.
 *
 * It is deterministic — same report, same sheet, on every machine — and every
 * line comes back marked `_reconstructed` so the screen showing it can say the
 * lines were rebuilt rather than signed. Nothing here is written back to the
 * record; the score on the record stays the score the round recorded.
 */
export function inspectionSheet(record, lines) {
  if (!record) return []
  const all = lines?.length ? lines : inspectionTemplate(assetTypeFor(record))
  if (!all.length) return []

  const key = record.inspection_number || record.inspection_id || 'INS'
  const failed = record.result === 'Fail'
  // A report that failed always shows at least one failed line, whatever its
  // count of findings says — a sheet on which everything passed, under the word
  // Fail, is the sort of thing an auditor stops the demonstration for.
  const flagged = Math.min(all.length - 1, Math.max(failed ? 1 : 0, Number(record.findings_count) || 0))

  // Which lines carry the finding. Seeded, so the sheet does not shuffle
  // between renders, and weighted so the housekeeping line is the last thing a
  // round fails on rather than the first.
  const order = all.map((_, i) => i).sort((a, b) => (
    (all[a].type === 'done' ? 1 : 0) - (all[b].type === 'done' ? 1 : 0)
    || seed(`${key}:o${a}`) - seed(`${key}:o${b}`)
  ))
  const flaggedSet = new Set(order.slice(0, flagged))

  return all.map((l, i) => {
    const off = flaggedSet.has(i)
    const line = {
      id: l.id || `${key}_L${i + 1}`,
      text: l.text,
      type: l.type || 'pass',
      unit: l.unit || '',
      limit: l.limit || '',
      critical: Boolean(l.critical),
      responseType: l.responseType || RESPONSE_TYPE[l.type] || RESPONSE_TYPE.pass,
      group: l.group || '',
      response: off && failed ? 'fail' : 'pass',
      reading: null,
      value: null,
      note: null,
      _reconstructed: true,
    }

    if (line.type === 'reading') {
      const band = BANDS.get(l.text)
      const ok = Number(band?.ok)
      const bad = Number(band?.bad)
      if (Number.isFinite(ok)) {
        // A healthy reading is never the same twice across forty reports, but it
        // is the same every time this one is opened.
        const jitter = (seed(`${key}:v${i}`) - 0.5) * Math.abs(ok) * 0.08
        let val = ok + jitter
        if (off && Number.isFinite(bad)) {
          // A report that failed reads the failing number. One that passed with
          // observations must not: a value over its limit under the word "Pass"
          // is a contradiction on the face of the record, so the observation
          // walks back from the failing value until the limit accepts it — the
          // edge of the band, which is what an observation is.
          val = bad
          if (!failed) {
            for (let t = 9; t >= 1; t -= 1) {
              const probe = ok + (bad - ok) * (t / 10)
              if (withinLimit(line.limit, probe) !== false) { val = probe; break }
            }
          }
        }
        line.reading = Math.round(val * 10) / 10
        line.value = `${line.reading}${line.unit ? ` ${line.unit}` : ''}`
      }
    }

    if (off) {
      line.note = failed
        ? line.type === 'reading'
          ? 'Outside the limit at the time of the round.'
          : 'Did not meet the acceptance criterion.'
        : line.type === 'reading'
          ? 'At the edge of the band — trending, no action this cycle.'
          : 'Minor observation, corrected at the point of inspection.'
    }

    return line
  })
}
