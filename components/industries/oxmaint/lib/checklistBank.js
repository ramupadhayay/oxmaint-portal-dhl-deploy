// The procedures this portal already works to.
//
// Two screens need them and for different reasons. The register needs the items
// behind a checklist, because storing a count and calling it a checklist falls
// apart the moment anyone clicks it — you cannot complete a number. The create
// screen needs them as a library, so that when no generation service is
// reachable a draft can still be composed out of steps this site already uses
// rather than out of nothing.

import { CHECKLISTS, DOMAIN } from './data'

const idOf = (c) => c.checklist_id || c.recordId

const DEFAULT_ITEM_BANK = {
  Operations: [
    'Guards in place and secure', 'No abnormal noise or vibration', 'Oil level within sight glass',
    'Air pressure within range', 'No visible leaks', 'Emergency stop tested',
    'Work area clear and clean', 'Warning labels legible', 'Control panel indicators normal',
    'Belt tension and condition', 'Coolant level acceptable', 'Filters within service interval',
    'Drive coupling condition', 'Ventilation unobstructed',
  ],
  Safety: [
    'Fire extinguisher present and in date', 'Escape routes unobstructed', 'PPE available at station',
    'Lockout points identified and labelled', 'Interlocks functional', 'First aid kit stocked',
    'Spill kit present', 'Eye wash station accessible', 'Guard interlock not bypassed',
    'Isolation points accessible', 'Safety signage in place', 'Manual handling aids available',
    'Chemical storage compliant', 'Emergency lighting functional', 'Noise levels within limits',
    'Confined space permit displayed', 'Hot work screens available', 'Fall arrest anchors inspected',
    'Barrier tape and cones stocked', 'Incident reporting board current',
    'Safety briefing recorded', 'Fire alarm call points clear',
  ],
  Maintenance: [
    'Bearing temperature within range', 'Vibration reading logged', 'Lubrication points greased',
    'Fasteners torqued to spec', 'Belt alignment checked', 'Motor current within nameplate',
    'Seals and gaskets inspected', 'Filter differential pressure logged', 'Cooling fan clear of debris',
    'Coupling alignment verified', 'Instrument calibration in date', 'Electrical connections tight',
    'Corrosion inspection complete', 'Wear parts measured', 'Runtime hours recorded',
    'Condition monitoring data uploaded', 'Spares availability confirmed', 'Drawings match as-built',
  ],
  Compliance: [
    'Statutory examination certificate in date', 'Lifting equipment marked with SWL',
    'Pressure vessel inspection current', 'Calibration certificates filed',
    'Operator training records current', 'Risk assessment reviewed',
    'Method statement available', 'Environmental permit conditions met',
    'Waste transfer notes filed', 'Insurance inspection scheduled', 'Register updated',
  ],
}

// A pack's own steps replace the bank, category for category. A ramp checklist
// composed out of sight-glass and swarf checks would be a draft nobody on the
// ramp could walk.
const ITEM_BANK = DOMAIN?.checklistItems || DEFAULT_ITEM_BANK

const itemsFor = (c) => {
  // A checklist written on the create screen carries its real sections, and
  // those are what it is. Only the seeded rows — which carry a count and no
  // steps — are filled in from the bank; reading the bank for a written
  // checklist would show somebody questions they did not write.
  if (Array.isArray(c.sections) && c.sections.length) {
    const out = []
    for (const s of c.sections) {
      for (const it of s.items || []) out.push({ id: it.id, text: it.description || it.text || '' })
      for (const ss of s.subSections || []) {
        for (const it of ss.items || []) out.push({ id: it.id, text: it.description || it.text || '' })
      }
    }
    return out
  }
  const bank = ITEM_BANK[c.category] || ITEM_BANK.Operations
  const n = Math.min(c.items_count || bank.length, bank.length)
  return bank.slice(0, n).map((text, i) => ({ id: `${idOf(c)}_i${i + 1}`, text }))
}

export { ITEM_BANK, itemsFor }

/**
 * The register's checklists in the shape the generator's fallback reads.
 *
 * One section each, because that is honestly what they are here — a flat list
 * of checks under a name. Inventing sub-sections to look richer would put
 * headings in a composed draft that nothing on this register actually uses.
 */
export const TEMPLATES = CHECKLISTS.map((c) => ({
  id: idOf(c),
  name: c.checklist_name,
  what: `${c.category} checklist, walked by ${c.assigned_to}.`,
  standard: c.category,
  category: c.category,
  sections: [{
    id: `${idOf(c)}-s1`,
    name: c.checklist_name,
    items: itemsFor(c).map((it, n) => ({
      id: it.id,
      itemNumber: String(n + 1),
      description: it.text,
      responseType: 'Pass_Fail',
      required: true,
      options: [],
    })),
    subSections: [],
  }],
}))

/**
 * Which category a description falls into.
 *
 * Word matching against the four the register uses, and no guess when nothing
 * matches — the caller falls back to the whole library, which is better than
 * confidently composing a safety checklist out of lubrication steps.
 */
const CATEGORY_WORDS = {
  Safety: ['safety', 'ppe', 'guard', 'lockout', 'fire', 'spill', 'permit', 'hazard', 'emergency', 'confined'],
  Compliance: ['statutory', 'certificate', 'calibration', 'audit', 'permit', 'insurance', 'register', 'training', 'regulation'],
  Maintenance: ['bearing', 'vibration', 'lubrication', 'torque', 'alignment', 'seal', 'motor', 'filter', 'wear', 'condition'],
  Operations: ['walk', 'shift', 'start', 'daily', 'operator', 'clean', 'leak', 'noise', 'panel', 'level'],
}

export function categoryFor(text) {
  const words = String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  let best = null
  let bestScore = 0
  for (const [category, list] of Object.entries(CATEGORY_WORDS)) {
    const score = list.filter((w) => words.includes(w)).length
    if (score > bestScore) { best = category; bestScore = score }
  }
  return best
}
