'use client'

// The vocabulary the checklist builder writes in.
//
// Lifted from the product's create screen, which the compliance portal ported
// first — same response types, same scoring methods, same shape of item — so a
// checklist authored in one portal reads like a checklist authored in the
// other. Where the two differ is scope: that portal scopes a checklist to a
// cleanroom and a filter, and this one scopes it to an asset class, a site and
// a location, because that is what this estate is organised by.
//
// A response type is the part worth getting right. "Bearing temperature within
// limits" answered with a tick is a record that proves nothing; the number is
// what an investigator reads a year later. So Numeric and Range carry a unit
// and an acceptable band, and anything outside it is out of spec.

import { ASSET_CLASSES, ASSETS_IN_SCOPE, SITES } from './data'

export const RESPONSE_TYPES = [
  { value: 'Pass_Fail', label: 'Pass/Fail', icon: 'check', what: 'Simple pass or fail response' },
  { value: 'Selection', label: 'Selection', icon: 'list', what: 'Multiple choice selection' },
  { value: 'Text', label: 'Text', icon: 'file', what: 'Free text input for detailed responses' },
  { value: 'Numeric', label: 'Numeric', icon: 'gauge', what: 'Numeric value input' },
  { value: 'Range', label: 'Range', icon: 'sliders', what: 'Reading against an acceptable band' },
  { value: 'Photo', label: 'Photo', icon: 'camera', what: 'Photo capture requirement' },
  { value: 'Signature', label: 'Signature', icon: 'pen', what: 'Digital signature capture' },
]

export const responseType = (value) =>
  RESPONSE_TYPES.find((r) => r.value === value) || RESPONSE_TYPES[0]

/**
 * What happens when an item fails.
 *
 * The generator sends one of these against every item it writes, and until now
 * every one was discarded. It matters here more than it would elsewhere: this
 * portal's whole SOW 7.2 story is a finding becoming a work order, and
 * `Generate_WO` is the model saying which failures are that kind. Carrying it
 * means the round tells the technician what a failure sets off before they
 * record one.
 *
 * Nothing acts on it automatically. A demo that silently raises work orders
 * while somebody works through a checklist produces records nobody asked for,
 * and the register is the thing being demonstrated.
 */
export const FAILURE_ACTIONS = [
  { value: 'Continue', label: 'Carry on', what: 'Note it and finish the round' },
  { value: 'Generate_WO', label: 'Raise a work order', what: 'The failure becomes a job' },
  { value: 'Stop_Inspection', label: 'Stop the inspection', what: 'The round cannot continue' },
]

export const failureAction = (value) =>
  FAILURE_ACTIONS.find((f) => f.value === value) || FAILURE_ACTIONS[0]

export const SCORING_METHODS = [
  { value: 'Pass_Fail', label: 'Pass/Fail' },
  { value: 'Numeric', label: 'Numeric' },
  { value: 'Weighted', label: 'Weighted' },
  { value: 'None', label: 'None' },
]

// The product's asset levels, cut to the three this estate holds equipment at.
// Line and Station are in the product's list and nothing in this register sits
// at either, and an option that can never be right is one somebody picks.
export const SCOPE_LEVELS = ['Site', 'Data Hall', 'Equipment']

export const LOCATION_TYPES = ['Campus', 'Building', 'Floor', 'Data Hall']

/** Asset classes with equipment behind them — a checklist scoped to an empty class can never be run. */
export const RUNNABLE_CLASSES = [...new Set(ASSETS_IN_SCOPE.map((a) => a.assetClass))].sort()

export const CATEGORIES = [...new Set(ASSET_CLASSES.map((c) => c.category).filter(Boolean))].sort()

export const FREQUENCIES = ['Weekly', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual']

export const SITE_OPTIONS = SITES.map((s) => ({ value: s.siteId, label: `${s.siteId} — ${s.siteName}` }))

/**
 * The category a checklist most likely belongs to, from the classes it names.
 *
 * The register already knows a CRAH is mechanical plant, so an author who has
 * chosen classes has effectively chosen a category. Suggested rather than
 * imposed: an author who sets one themselves means it.
 */
export function categoryFor(classes = []) {
  const hit = ASSET_CLASSES.find((c) => classes.includes(c.className))
  return hit?.category || CATEGORIES[0] || 'Mechanical'
}

/** The default criticality the register carries for a class. */
export const criticalityOfClass = (className) =>
  ASSET_CLASSES.find((c) => c.className === className)?.defaultCriticality || null

/** A stable, readable code for a checklist, the way the library numbers them. */
export const codeFor = (name, category) => {
  const initials = String(name || '')
    .split(/\s+/).filter(Boolean).slice(0, 3)
    .map((w) => w[0]).join('').toUpperCase()
  return `CHK-${String(category || 'GEN').slice(0, 3).toUpperCase()}-${initials || 'NEW'}`
}

export const slug = (s) => String(s).toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'checklist'

/** Every item in a checklist, sections and sub-sections alike, in reading order. */
export function allItemsOf(sections = []) {
  return sections.flatMap((s) => [
    ...(s.items || []),
    ...(s.subSections || []).flatMap((ss) => ss.items || []),
  ])
}

/**
 * The response type a PM task is most likely written in.
 *
 * A guess, and a shallow one — it reads the wording. It is here rather than in
 * the create screen because the generator and the screen both need it, and two
 * copies of a heuristic is how the drafted checklist and the hand-built one end
 * up disagreeing about what "Megger test" is.
 */
export function typeForTask(task = '') {
  if (/\b(measure|reading|temperature|pressure|current|resistance|vibration|thickness|level|dp|delta)\b/i.test(task)) return 'Range'
  if (/\b(thermograph|thermal scan|photo|imag)/i.test(task)) return 'Photo'
  if (/\b(clean|replace|top up|lubricat|tighten|calibrat|test|exercise|change|drain)\b/i.test(task)) return 'Pass_Fail'
  return 'Pass_Fail'
}
