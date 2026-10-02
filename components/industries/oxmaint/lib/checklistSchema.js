// What a checklist is, independent of what any one site puts on one.
//
// The response types, the scoring methods, the levels a checklist can be
// pinned at, the code a checklist is known by, and the two ways of reading the
// items off one. None of it is about filters, or chillers, or any particular
// register — which is why it sits here rather than beside a portal's templates.
//
// The pharmaceutical portal's `checklists.js` re-exports every name below, so
// its screens kept the import they already had while both portals' builders
// answer to one definition. Two lists of response types is how one screen ends
// up offering a Range item the other cannot open.

/**
 * The response types the product offers, and the glyph each is drawn with.
 *
 * `icon` names a glyph in productKit where one fits and in checklistKit where
 * the product uses one productKit has no equivalent for (camera, pen).
 */
export const RESPONSE_TYPES = [
  { value: 'Pass_Fail', label: 'Pass/Fail', icon: 'check', what: 'Simple pass or fail response' },
  { value: 'Selection', label: 'Selection', icon: 'list', what: 'Multiple choice selection' },
  { value: 'Text', label: 'Text', icon: 'doc', what: 'Free text input for detailed responses' },
  { value: 'Numeric', label: 'Numeric', icon: 'gauge', what: 'Numeric value input' },
  { value: 'Range', label: 'Range', icon: 'sliders', what: 'Range value input' },
  { value: 'Photo', label: 'Photo', icon: 'camera', what: 'Photo capture requirement' },
  { value: 'Signature', label: 'Signature', icon: 'pen', what: 'Digital signature capture' },
]

export const responseType = (value) =>
  RESPONSE_TYPES.find((r) => r.value === value) || RESPONSE_TYPES[0]

export const SCORING_METHODS = [
  { value: 'Pass_Fail', label: 'Pass/Fail' },
  { value: 'Numeric', label: 'Numeric' },
  { value: 'Weighted', label: 'Weighted' },
  { value: 'None', label: 'None' },
]

export const ASSET_LEVELS = ['Plant', 'Area', 'Equipment', 'Component']

export const LOCATION_TYPES = ['Plant', 'Area', 'Building', 'Floor', 'Room']

export const CATEGORIES = ['Certification', 'Facility', 'Environmental', 'Personnel']

// FNV-1a with the avalanche step — the same hash the inspection registers use,
// keyed the same way, so a checklist's code on the create screen is the code
// the register quotes for it. Two codes for one procedure is what an auditor
// spots.
function seed(str) {
  let h = 2166136261
  for (let i = 0; i < String(str).length; i += 1) {
    h ^= String(str).charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 15
  h = Math.imul(h, 2246822507)
  h ^= h >>> 13
  return (h >>> 0) / 4294967296
}

export const codeFor = (id) => `CHK${String(Math.floor(seed(`${id}code`) * 90000000) + 10000000)}`

/** Every item under a list of sections, whether direct or in a sub-section. */
export function allItemsOf(sections = []) {
  const out = []
  for (const s of sections) {
    out.push(...(s.items || []))
    for (const ss of s.subSections || []) out.push(...(ss.items || []))
  }
  return out
}

/** Every item on a checklist, whichever of the two shapes it is in. */
export function allItems(checklist) {
  if (!checklist) return []
  if (Array.isArray(checklist.sections) && checklist.sections.length) {
    return allItemsOf(checklist.sections)
  }
  // A checklist stored before the sections shape existed, or one handed in as a
  // bare list of strings. Read rather than rejected — a library that drops the
  // rows it does not recognise is worse than one that shows them plainly.
  return (checklist.items || []).map((text, i) =>
    (typeof text === 'string'
      ? { id: `${checklist.id || 'x'}-i${i + 1}`, itemNumber: String(i + 1), description: text, responseType: 'Pass_Fail', required: true, options: [] }
      : text))
}
