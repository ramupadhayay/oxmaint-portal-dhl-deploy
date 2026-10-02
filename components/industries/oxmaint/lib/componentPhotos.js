// Component photos for the food-plant walk.
//
// Eight seeded modes. A photo is read for visible cues, then scored against
// these modes only. Belt-loader, conveyor and GSE tyre names are dropped
// before the score, so this screen cannot classify a part as ground equipment.

export const CASES = [
  {
    case_id: 'CHAIN-01',
    component: 'Drive chain',
    caption: 'Broken chain',
    visual_cues: ['elongation', 'cracked side plates', 'seized or missing rollers', 'shiny pin ends'],
    failure_mode: 'Fatigue or overload, with lubrication or alignment upstream',
    next_step: 'Measure elongation, inspect sprocket tooth wear, and review load and lubrication history.',
  },
  {
    case_id: 'COUP-01',
    component: 'Coupling',
    caption: 'Broken coupling',
    visual_cues: ['hub shear', 'cracked elastomer', 'fretting at the bore', 'offset wear'],
    failure_mode: 'Misalignment, overload, or jam',
    next_step: 'Alignment check, last torque event, and inspect the driven shaft.',
  },
  {
    case_id: 'BRG-LUBE-01',
    component: 'Bearing',
    caption: 'Bearing, lubrication failure',
    visual_cues: ['blue discoloration', 'scoring'],
    failure_mode: 'Lubrication failure',
    next_step: 'Check grease type, interval, and temperature history.',
  },
  {
    case_id: 'BRG-ELEC-01',
    component: 'Bearing',
    caption: 'Bearing, electrical erosion',
    visual_cues: ['washboard', 'fluting'],
    failure_mode: 'Electrical erosion',
    next_step: 'Check shaft current, grounding, and the VFD path.',
  },
  {
    case_id: 'BRG-CONT-01',
    component: 'Bearing',
    caption: 'Bearing, contamination',
    visual_cues: ['scratches', 'embedded particles'],
    failure_mode: 'Contamination',
    next_step: 'Check seal condition and the ingress path.',
  },
  {
    case_id: 'BRG-MIS-01',
    component: 'Bearing',
    caption: 'Bearing, misalignment',
    visual_cues: ['uneven wear'],
    failure_mode: 'Misalignment',
    next_step: 'Check shaft alignment and the housing.',
  },
  {
    case_id: 'BRG-FAT-01',
    component: 'Bearing',
    caption: 'Bearing, fatigue or spalling',
    visual_cues: ['pitted raceways'],
    failure_mode: 'Fatigue or spalling',
    next_step: 'Review hours and load, then replace versus monitor.',
  },
  {
    case_id: 'PCB-BURN-01',
    component: 'PCB component',
    caption: 'Burned PCB component',
    visual_cues: ['charring', 'lifted pads', 'heat shadow', 'single device versus a zone'],
    failure_mode: 'Overcurrent, short, or thermal runaway',
    next_step: 'Identify the device and check the upstream supply. Do not re-energize until the cause is bounded.',
  },
]

const BANNED = ['belt-loader', 'belt loader', 'conveyor', 'gse tyre', 'gse tire']
const COLOR = ['blue', 'discolor', 'char', 'shiny', 'heat shadow']
const TEXTURE = ['scoring', 'scratch', 'pitted', 'fretting', 'washboard', 'fluting', 'embedded']
const GEOMETRY = ['elongat', 'cracked', 'shear', 'lifted', 'missing', 'roller', 'plate', 'pad']

const words = (value) => String(value).toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3)

export function cueKey(cues) {
  return [...new Set(cues.flatMap(words))].sort().join('|')
}

export function usableCues(cues) {
  const seen = new Set()
  const out = []
  for (const cue of cues) {
    const clean = String(cue).replace(/\s+/g, ' ').trim()
    const key = clean.toLowerCase()
    if (clean.length < 2 || clean.length > 80 || BANNED.some((label) => key.includes(label)) || seen.has(key)) continue
    seen.add(key)
    out.push(clean)
    if (out.length === 8) break
  }
  return out
}

export function featuresFromCues(cues) {
  const color = []
  const texture = []
  const geometry = []
  const wear = []
  for (const cue of cues) {
    const low = cue.toLowerCase()
    if (COLOR.some((word) => low.includes(word))) color.push(cue)
    else if (TEXTURE.some((word) => low.includes(word))) texture.push(cue)
    else if (GEOMETRY.some((word) => low.includes(word))) geometry.push(cue)
    else wear.push(cue)
  }
  return { color, texture, geometry, wear_pattern: wear }
}

function scoreCase(cues, row) {
  const bag = new Set(cues.flatMap(words))
  const hay = new Set([...row.visual_cues, row.failure_mode, row.component, row.caption].flatMap(words))
  let score = 0
  for (const word of bag) if (hay.has(word)) score += 1
  return score
}

export function matchCues(cues, corrections = []) {
  const key = cueKey(cues)
  const correction = corrections.find((row) => row.cueKey === key && row.disposition === 'correct' && row.to_case_id)
  const scored = CASES
    .map((row) => ({ row, score: scoreCase(cues, row) }))
    .sort((a, b) => b.score - a.score || a.row.case_id.localeCompare(b.row.case_id))
  let top = scored[0]
  if (correction) {
    const forced = scored.find((row) => row.row.case_id === correction.to_case_id)
    if (forced) top = forced
  }
  const rejected = scored
    .filter((row) => row.row.case_id !== top.row.case_id)
    .slice(0, 3)
    .map((row) => ({
      case_id: row.row.case_id,
      failure_mode: row.row.failure_mode,
      why: correction && row.row.case_id === correction.from_case_id
        ? 'Specialist moved this cue set off this mode.'
        : row.score === 0 ? 'No shared cues.' : 'Fewer shared cues than the leading mode.',
    }))
  return {
    mode: top.row,
    score: correction ? top.score : top.score,
    rejected,
    corrected: Boolean(correction),
    correctionNote: correction?.note || null,
  }
}
