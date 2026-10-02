'use client'

// Checklist generation — the seam a model gets wired into.
//
// The product's own service (inspection/checklist/.../_services/generateChecklist.ts)
// does one thing: POST `{ checklist_name, checklist_description }` to a
// generation webhook behind basic auth, wait up to two minutes, and read back
//
//   [ { output: { sections: [ { section_name, sequence, items: [ … ] } ] } } ]
//
// tolerating a bare object and a missing `output` wrapper, with every item flag
// arriving as the *string* "true" or "false". `generateChecklist` below keeps
// that request and that response exactly, so pointing this at the real endpoint
// is a matter of setting one environment variable. It is the same file the
// compliance portal carries, because it is the same contract.
//
// ── when no endpoint is configured ────────────────────────────────────────
//
// It composes instead, from the client's own PM task library, and says so. That
// is not a stand-in for the model: SOW 2.2 puts the existing calendar-based
// maintenance out of scope for change, so a checklist for this estate made of
// invented steps is worse than no checklist — the steps a site engineer will
// actually be held to are the twenty-five in the library, and a plausible
// invented one passes a review and fails an audit.
//
// So every composed line is a task the client already wrote down, the screen
// names which classes it drew from, and nothing composed is ever labelled as
// generated. `generated` on the result is the field the UI reads to decide what
// it is allowed to claim.

import { PM_TASKS, ASSET_CLASSES } from './data'
import { RESPONSE_TYPES, typeForTask, categoryFor } from './checklistBuilder'

// Configuration, read the way the product reads it. The product builds this URL
// as `${config.api.n8nUrl}/webhook/generate_checklist`, so the base is what a
// deployment sets and the path is ours to know. The full URL can still be given
// directly, which is what a different generator behind a different path needs.
const N8N_BASE = (process.env.NEXT_PUBLIC_N8N_URL || '').replace(/\/+$/, '')
const WEBHOOK_PATH = '/webhook/generate_checklist'

const ENDPOINT = process.env.NEXT_PUBLIC_OXMAINT_CHECKLIST_AI_URL
  || (N8N_BASE ? `${N8N_BASE}${WEBHOOK_PATH}` : '')

// Base64 of `user:password`, and deliberately not defaulted. The product ships
// its webhook credential as a literal in client code, which means it reaches
// every browser that loads the page. Copying that would put the same secret in
// this repository, so it comes from the environment or the header is not sent —
// a 401 is a better failure than a credential in git history.
const AUTH = process.env.NEXT_PUBLIC_OXMAINT_CHECKLIST_AI_AUTH || ''

const TIMEOUT_MS = 120000

export const isConfigured = () => Boolean(ENDPOINT)

export const GENERATOR_NAME = 'Synapse AI'

// ── validation, as the product validates ──────────────────────────────────

export function validateChecklistName(name) {
  if (!name || typeof name !== 'string' || !name.trim()) return 'Checklist name is required.'
  if (name.length > 200) return 'Checklist name is too long. Maximum 200 characters allowed.'
  return null
}

export function validateChecklistDescription(description) {
  if (!description || typeof description !== 'string' || !description.trim()) {
    return 'Checklist description is required.'
  }
  if (description.length > 1000) {
    return 'Checklist description is too long. Maximum 1000 characters allowed.'
  }
  return null
}

// ── the one call ──────────────────────────────────────────────────────────

/**
 * Draft a checklist's sections from a name and a description.
 *
 * @param request { checklistName, description, classes?, length? }
 * @param signal  an AbortSignal, so the loader's Cancel actually cancels
 * @returns { ok, generated, sections, sources, note, error }
 *          `generated` is true only when a model produced the steps.
 */
export async function generateChecklist(request, signal) {
  const checklistName = String(request?.checklistName || '').trim()
  const description = String(request?.description || '').trim()

  const nameError = validateChecklistName(checklistName)
  if (nameError) return { ok: false, error: nameError }
  const descriptionError = validateChecklistDescription(description)
  if (descriptionError) return { ok: false, error: descriptionError }

  if (!isConfigured()) {
    return composeFromLibrary(checklistName, description, request?.classes, request?.length)
  }

  try {
    const sections = await callEndpoint({ checklist_name: checklistName, checklist_description: description }, signal)
    return {
      ok: true,
      generated: true,
      sections,
      sources: [],
      // The product's own banner copy, verbatim.
      note: 'Your checklist has been created based on your requirements. Please review and validate '
        + 'all items to ensure they align with your operational standards and safety protocols before '
        + 'implementation.',
    }
  } catch (e) {
    if (e?.name === 'AbortError') return { ok: false, cancelled: true, error: 'Checklist generation cancelled' }
    // The generation service is configured but did not answer usefully — down,
    // empty-bodied, unreachable, or in a shape this screen cannot read. That is
    // an external service changing under us, not a fault in the request, so
    // rather than a dead end we fall back to the same PM-library composition
    // used when no endpoint is set. Checklist creation keeps working when the
    // service does not, and the note says plainly what happened and that nothing
    // was invented.
    const composed = composeFromLibrary(checklistName, description, request?.classes, request?.length)
    if (!composed.sections?.length) {
      return { ok: false, error: e?.message || 'Failed to generate checklist. Check the connection and try again.' }
    }
    return {
      ...composed,
      note: `The ${GENERATOR_NAME} generation service did not respond (${e?.message || 'no answer'}). This draft `
        + 'was composed instead from this client’s own PM library, so nothing here was invented — every '
        + 'line is a task the client already maintains to, each carrying the standard it is worked to. Review and '
        + 'adjust before use, or retry once the service is back.',
    }
  }
}

/**
 * The request the product makes, unchanged.
 *
 * Kept in one function so the endpoint, the auth scheme and the response
 * tolerances all live together — the shape of what comes back is the part that
 * changes when a different model is put behind the webhook.
 */
async function callEndpoint(body, signal) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const onAbort = () => controller.abort()
  if (signal) signal.addEventListener('abort', onAbort)

  let res
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(AUTH ? { Authorization: `Basic ${AUTH}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (e) {
    clearTimeout(timer)
    if (signal) signal.removeEventListener('abort', onAbort)
    if (e?.name === 'AbortError' && signal?.aborted) throw e
    if (e?.name === 'AbortError') throw new Error('Request timed out. The checklist generation is taking too long.')
    throw new Error('Could not reach the checklist generation service.')
  }
  clearTimeout(timer)
  if (signal) signal.removeEventListener('abort', onAbort)

  if (!res.ok) throw new Error(statusMessage(res.status))

  // n8n answers with an array, but has been seen to answer with a bare object
  // and to drop the `output` wrapper. It has also been seen — when its workflow
  // is deactivated, restarting, or set to respond immediately — to answer 200
  // with an empty body. Reading that with res.json() throws a raw browser
  // "Unexpected end of JSON input", so read the text first: an empty or
  // non-JSON answer becomes a clear error the caller can fall back on, not a
  // DOMException surfaced to the user.
  const raw = await res.text()
  if (!raw.trim()) throw new Error('The checklist generation service returned an empty response.')
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('The checklist generation service answered in a format this screen cannot read.')
  }
  if (data && typeof data === 'object' && !Array.isArray(data) && (data.output || data.sections)) {
    data = [data]
  }
  const first = Array.isArray(data) ? data[0] : null
  const sections = first?.output?.sections || first?.sections
  if (!Array.isArray(sections) || !sections.length) {
    throw new Error('The checklist generation service answered in a format this screen cannot read.')
  }

  return sections.map(readSection)
}

function statusMessage(status) {
  if (status === 401) return 'Authentication failed for the checklist generation service.'
  if (status === 403) return 'Not authorised to use the checklist generation service.'
  if (status === 404) return 'Checklist generation service not found.'
  if (status >= 500) return 'The checklist generation service is unavailable. Try again later.'
  return 'The checklist generation service rejected the request.'
}

// Every flag arrives as the string "true" or "false" — comparing the raw value
// would make "false" truthy and mark every item critical.
const flag = (v) => v === true || v === 'true'

const TYPE_BY_VALUE = new Map(RESPONSE_TYPES.map((t) => [t.value.toUpperCase(), t.value]))

const readType = (raw) => TYPE_BY_VALUE.get(String(raw || '').toUpperCase().replace(/[\s/]+/g, '_')) || 'Pass_Fail'

function readSection(section, si) {
  const id = `gen-s${si + 1}`
  return {
    id,
    name: section.section_name || section.name || `Section ${si + 1}`,
    sequence: Number(section.sequence) || si + 1,
    isExpanded: true,
    assetClass: '',
    items: (section.items || []).map((item, i) => readItem(item, id, i)),
    subSections: (section.sub_sections || section.subSections || []).map((sub, ssi) => {
      const subId = `${id}-ss${ssi + 1}`
      return {
        id: subId,
        name: sub.sub_section_name || sub.name || `Sub-section ${ssi + 1}`,
        sequence: Number(sub.sequence) || ssi + 1,
        instruction: sub.inspection_instruction || '',
        isExpanded: true,
        items: (sub.items || []).map((item, i) => readItem(item, subId, i)),
      }
    }),
  }
}

function readItem(item, containerId, i) {
  const range = String(item.acceptable_range || '')
  const [rangeMin, rangeMax] = range.includes('-') ? range.split('-').map((s) => s.trim()) : ['', '']
  const type = readType(item.response_type)

  return {
    id: `${containerId}-i${i + 1}`,
    containerId,
    itemNumber: String(item.item_number || i + 1),
    sequence: Number(item.sequence) || i + 1,
    text: item.item_description || '',
    responseType: type,
    instruction: item.inspection_instruction || '',
    unit: item.unit || '',
    min: item.acceptable_min_value || rangeMin || '',
    max: item.acceptable_max_value || rangeMax || '',
    options: item.selection_options ? String(item.selection_options).split(',').map((o) => o.trim()).filter(Boolean) : [],
    // Three the model sends against every item and the screens used to drop.
    // Expected value is the target the band is drawn around; failure action is
    // what a failure sets off, which in this portal means a work order; weight
    // is what the Weighted scoring method scores with, and a scoring method
    // with no weights behind it is a setting that does nothing.
    expectedValue: String(item.expected_value ?? '').trim(),
    failureAction: String(item.failure_action || 'Continue').trim(),
    weight: String(item.weight ?? '').trim(),
    critical: flag(item.is_critical),
    required: item.mandatory_item === undefined ? true : flag(item.mandatory_item),
    requiresPhoto: flag(item.requires_photo) || type === 'Photo',
    requiresComment: flag(item.requires_comment),
    requiresSignature: flag(item.requires_signature) || type === 'Signature',
  }
}

// ── composition, for when no endpoint is configured ────────────────────────

// Words that appear in almost every step and therefore separate nothing.
const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'with',
  'is', 'are', 'be', 'been', 'it', 'its', 'this', 'that', 'from', 'by', 'as',
  'not', 'no', 'any', 'all', 'each', 'per', 'before', 'after', 'against',
  'checklist', 'check', 'checked', 'step', 'steps', 'run', 'i', 'we', 'want',
  'need', 'should', 'must', 'make', 'sure', 'create', 'build', 'one', 'unit',
  'checks', 'checking', 'inspect', 'inspection', 'routine', 'round', 'system',
])

const tokens = (s) => String(s).toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/)
  .filter((w) => w.length > 2 && !STOP.has(w))

/**
 * Assemble a draft out of the client's own PM task library.
 *
 * Tasks are grouped by the asset class they belong to, and each group is scored
 * against the description — a task scores for every distinctive word it shares,
 * and more when its own class is a strong match, so "bearing temperature" pulls
 * in the pump tasks even when the author never wrote "pump".
 *
 * A class the author has already named wins outright. Naming a class is a
 * stronger statement of intent than any wording, and the checklist can only be
 * run against the classes it names — so drafting steps for a class outside that
 * list produces items no technician on that round will ever see. Other classes
 * top the draft up only when the named ones cannot fill it, which is the case
 * where a short library is the reason rather than a wrong guess.
 *
 * Within a class, tasks keep the order the library puts them in. Ranking by
 * score alone shuffles them, and a round whose steps are out of sequence is not
 * a round — "record delta-P" before "replace filter" reads as an oversight.
 */
function composeFromLibrary(checklistName, description, classes = [], wantedLength) {
  const text = `${checklistName} ${description}`
  const wanted = tokens(text)
  const length = Math.min(24, Math.max(5, wantedLength || 12))
  const named = new Set(classes || [])

  // Below this many items a draft is not worth handing over, so classes the
  // author did not name are allowed to top it up.
  const FLOOR = 5

  const byClass = new Map()
  for (const t of PM_TASKS) {
    if (!byClass.has(t.assetClass)) byClass.set(t.assetClass, [])
    byClass.get(t.assetClass).push(t)
  }

  let ranked = []
  for (const [className, tasks] of byClass) {
    const classHits = tokens(className).filter((w) => wanted.includes(w)).length
    const hits = new Set()
    let total = named.has(className) ? 50 : 0

    for (const t of tasks) {
      const n = tokens(`${t.task} ${t.standard}`).filter((w) => wanted.includes(w)).length
      const score = n * 3 + classHits * 2
      if (named.has(className) || score > 0) {
        total += score
        hits.add(t.taskId)
      }
    }
    if (total > 0) ranked.push({ className, tasks, score: total, hits })
  }

  ranked.sort((a, b) => b.score - a.score)

  // Named classes first, and on their own where they can carry the draft.
  if (named.size) {
    const mine = ranked.filter((g) => named.has(g.className))
    const carried = mine.reduce((n, g) => n + g.hits.size, 0)
    ranked = carried >= FLOOR ? mine : [...mine, ...ranked.filter((g) => !named.has(g.className))]
  }

  // Nothing matched: fall back to the classes in the same category rather than
  // returning an empty draft. An author whose description shares no vocabulary
  // with the library still gets somewhere to start.
  let pool = ranked
  if (!pool.length) {
    const category = categoryFor(classes.length ? classes : [])
    const near = [...byClass.entries()].filter(([c]) => (
      ASSET_CLASSES.find((x) => x.className === c)?.category === category
    ))
    pool = (near.length ? near : [...byClass.entries()]).map(([className, tasks]) => ({
      className, tasks, score: 1, hits: new Set(tasks.map((t) => t.taskId)),
    }))
  }

  const sections = []
  const used = []
  let taken = 0

  for (const group of pool) {
    if (taken >= length) break
    const items = []
    for (const t of group.tasks) {
      if (taken >= length) break
      if (!group.hits.has(t.taskId)) continue
      const id = `gen-${t.taskId}`
      items.push({
        id,
        containerId: `gen-${group.className}`,
        itemNumber: String(items.length + 1),
        sequence: items.length + 1,
        text: t.task,
        responseType: typeForTask(t.task),
        // The standard is the instruction. It is the sentence that tells a
        // technician what good looks like, and dropping it would leave an
        // item whose acceptance criteria live only in somebody's head.
        instruction: t.standard ? `Carried out to ${t.standard}. Library frequency: ${t.frequency}.` : '',
        unit: '', min: '', max: '', options: [],
        expectedValue: '',
        // The library says what to do when a task fails only through its
        // criticality, so that is what this reads. Nothing is invented.
        failureAction: ASSET_CLASSES.find((c) => c.className === group.className)?.defaultCriticality === 'Critical'
          ? 'Generate_WO' : 'Continue',
        weight: '',
        required: true,
        critical: ASSET_CLASSES.find((c) => c.className === group.className)?.defaultCriticality === 'Critical',
        requiresPhoto: false,
        requiresComment: false,
        requiresSignature: false,
        standard: t.standard || '',
        frequency: t.frequency || '',
      })
      taken += 1
    }
    if (!items.length) continue

    sections.push({
      id: `gen-${sections.length + 1}`,
      name: group.className,
      sequence: sections.length + 1,
      isExpanded: true,
      assetClass: group.className,
      items,
      subSections: [],
    })
    used.push({
      id: group.className,
      name: group.className,
      standard: [...new Set(group.tasks.map((t) => t.standard).filter(Boolean))].slice(0, 2).join(', ') || group.className,
    })
  }

  return {
    ok: true,
    generated: false,
    sections,
    sources: used,
    note: `Drafted from ${taken} task${taken === 1 ? '' : 's'} in this client's own PM library, across `
      + `${used.length} asset class${used.length === 1 ? '' : 'es'}. No generation service is configured for this `
      + 'deployment, so nothing here was invented — every line is a task the client already maintains to, and '
      + 'each carries the standard it is worked to. Review and adjust before use.',
  }
}
