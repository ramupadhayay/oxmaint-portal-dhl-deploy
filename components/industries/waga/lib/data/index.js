// The joined view of the WAGA compliance dataset.
//
// The workbook is relational on purpose — a requirement names a permit, the
// permit names a site, a parameter names the equipment it limits, a deviation
// names the permit it breached. Screens should read that story rather than
// re-assemble it, so every join lives here and each screen gets rows that
// already know their own context.
//
// Nothing below invents a value. Where a field is derived it is named so it is
// obviously derived (`_site`, `_permit`, `_expiryDays`), because this data is
// read back against permit PDFs and a regulator's deadline. A convenient
// rounding or a filled-in blank would be a defect, not a convenience — and the
// workbook says so in its own README.

import { SITES } from './sites'
import { PERMITS } from './permits'
import { REQUIREMENTS } from './requirements'
import { WORKBOOK_TASKS } from './tasks'
import { PARAMETERS } from './parameters'
import { DEVIATIONS } from './deviations'
import { SAFETY_FIELDS, TRAINING, INCIDENTS } from './safety'
import { README, VERIFICATION } from './provenance'
import { TEAM, DEPARTMENTS } from './team'

export {
  SITES, PERMITS, REQUIREMENTS, WORKBOOK_TASKS, PARAMETERS, DEVIATIONS,
  SAFETY_FIELDS, TRAINING, INCIDENTS, README, VERIFICATION,
  TEAM, DEPARTMENTS,
}

// ── the customer ─────────────────────────────────────────────────────────
// Counted from the data rather than written out again, so the header can never
// disagree with the tables under it.
export const ORG = {
  name: 'WAGA Energy',
  programme: 'Compliance & EHS Trial',
  siteCount: SITES.length,
  permitCount: PERMITS.length,
  requirementCount: REQUIREMENTS.length,
  agencies: [...new Set(PERMITS.map((p) => p.agency).filter(Boolean))],
  states: [...new Set(SITES.map((s) => s.state).filter(Boolean))],
}

// ── lookups ──────────────────────────────────────────────────────────────
const siteById = new Map(SITES.map((s) => [s.siteId, s]))
const permitById = new Map(PERMITS.map((p) => [p.permitId, p]))

export const siteOf = (id) => siteById.get(id) || null
export const permitOf = (id) => permitById.get(id) || null

/** Site code — WBU06 — is what people say out loud, so it is what screens show. */
export const siteCode = (id) => siteById.get(id)?.code || '—'

// ── formatting ───────────────────────────────────────────────────────────
//
// One place, because a blank has to read the same on all eleven screens. The
// workbook is explicit that an empty cell means the source document did not say
// — it is not missing data waiting to be filled in — so it renders as a stated
// absence rather than a dash that could be mistaken for zero.
export const NOT_STATED = 'Not stated in source'

export const fmtDate = (v) => {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return `${String(d.getUTCDate()).padStart(2, '0')} ${d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })} ${d.getUTCFullYear()}`
}

export const TODAY = () => new Date().toISOString().slice(0, 10)

export const daysUntil = (v) => {
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return Math.round((d - new Date(TODAY())) / 86400000)
}

// ── permits, joined ──────────────────────────────────────────────────────
//
// `_expiryDays` is null rather than Infinity for the four permits that carry no
// expiration date. Two of those are genuinely non-expiring Iowa construction
// permits and one is the Chapter 105 permit whose tracker never populated the
// column — three different reasons for the same blank, and none of them is
// "expires very far away". A sort that treats them as a number puts them in a
// position that means something they do not mean.
export const permits = PERMITS.map((p) => ({
  ...p,
  _site: siteOf(p.siteId),
  _siteCode: siteCode(p.siteId),
  _expiryDays: daysUntil(p.expirationDate),
  _requirementCount: REQUIREMENTS.filter((r) => r.permitId === p.permitId).length,
}))

/**
 * A permit with no expiry that genuinely never expires, as opposed to one whose
 * source simply left the column blank.
 *
 * Two of the four undated permits — the Iowa construction permits 24-A-123 and
 * 24-A-124 — are non-expiring, and the workbook says so in as many words
 * ("Non-expiring per WAGA applicability tracker"). The Chapter 105 permit is
 * undated for a different reason (its tracker never populated the column and the
 * work voids in 2029), so it is *not* non-expiring — it is "not stated". This is
 * the one test every screen reads, so the Overview and the Permit register can
 * never label the same permit two different ways again.
 */
export const isNonExpiring = (p) => (
  !p.expirationDate && (
    /non-?expiring/i.test(p.notes || '') ||
    (/construction/i.test(p.permitType || '') && p.agency === 'Iowa DNR')
  )
)

/** How a blank expiry should read: non-expiring where it truly is, else stated absent. */
export const expiryLabel = (p) => (isNonExpiring(p) ? 'Non-expiring' : NOT_STATED)

/**
 * How close a permit is to needing attention.
 *
 * Renewal deadline first where there is one: a Title V permit that runs to 2030
 * still needs its application in by 2029, and the application is the date
 * somebody has to act on.
 */
export const permitHealth = (p) => {
  if (p.status === 'Renewal Submitted') return { tone: 'blue', label: 'Renewal submitted' }
  const watch = p.renewalDeadline || p.expirationDate
  if (!watch) return { tone: 'grey', label: p.expirationDate ? 'Active' : (isNonExpiring(p) ? 'Non-expiring' : 'No expiry stated') }
  const days = daysUntil(watch)
  if (days === null) return { tone: 'grey', label: 'Active' }
  if (days < 0) return { tone: 'red', label: 'Expired' }
  if (days <= 180) return { tone: 'amber', label: `${days} days` }
  return { tone: 'green', label: 'Active' }
}

// ── requirements, joined ─────────────────────────────────────────────────
export const requirements = REQUIREMENTS.map((r) => ({
  ...r,
  _site: siteOf(r.siteId),
  _siteCode: siteCode(r.siteId),
  _permit: permitOf(r.permitId),
  _permitNumber: permitOf(r.permitId)?.permitNumber || '',
}))

export const REQUIREMENT_CATEGORIES = [...new Set(REQUIREMENTS.map((r) => r.category))].filter(Boolean).sort()
export const FREQUENCIES = [...new Set(REQUIREMENTS.map((r) => r.frequency))].filter(Boolean).sort()

// ── parameters, joined ───────────────────────────────────────────────────
export const parameters = PARAMETERS.map((p) => ({
  ...p,
  _site: siteOf(p.siteId),
  _siteCode: siteCode(p.siteId),
  _permit: permitOf(p.permitId),
}))

// ── deviations, joined ───────────────────────────────────────────────────
//
// These are the one part of this dataset that is genuine operational history —
// V-011 confirms both against WAGA's own Deviance Tracker — so they are never
// marked derived and never mixed with generated occurrences.
export const deviations = DEVIATIONS.map((d) => ({
  ...d,
  _site: siteOf(d.siteId),
  _siteCode: siteCode(d.siteId),
  _permit: permitOf(d.permitId),
}))

export const openDeviations = deviations.filter((d) => d.status !== 'Closed')

// ── safety ───────────────────────────────────────────────────────────────
export const safetySections = [...new Set(SAFETY_FIELDS.map((f) => f.section))]

export const safetyBySection = safetySections.map((section) => ({
  section,
  fields: SAFETY_FIELDS.filter((f) => f.section === section),
}))

/** The options column is a semicolon list where it is a list at all. */
export const optionList = (field) =>
  String(field.options || '')
    .split(/;|•/)
    .map((s) => s.trim())
    .filter(Boolean)

// ── incidents ────────────────────────────────────────────────────────────
//
// One placeholder row, and the screen shows its message rather than an empty
// table. V-014: the General Incident Report workbook was never supplied, and
// "Do not populate fake incident data".
export const INCIDENTS_LOADED = INCIDENTS.some((i) => i.incidentId !== 'DEMO-ONLY')
export const incidentNotice = INCIDENTS.find((i) => i.incidentId === 'DEMO-ONLY')?.description || ''
