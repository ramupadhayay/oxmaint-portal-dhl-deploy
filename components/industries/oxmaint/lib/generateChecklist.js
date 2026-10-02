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
// arriving as the *string* "true" or "false". `generate` below keeps that
// request and that response exactly, so pointing this at the real endpoint is a
// matter of setting one environment variable.
//
// ── when no endpoint is configured ────────────────────────────────────────
//
// It composes instead, from the site's own eight procedures, and says so. That
// is not a stand-in for the model: a cleanroom checklist made of invented steps
// is worse than no checklist, because the steps whose omission makes a result
// meaningless are exactly the ones an auditor asks the technician to walk
// through, and a plausible-sounding step that is not one of them passes a
// review and fails an inspection.
//
// So the composed draft is always traceable to a procedure this site already
// works to, the screen names which ones it drew from, and nothing composed is
// ever labelled as generated. `generated` on the result is the field the UI
// reads to decide what it is allowed to claim.

import { RESPONSE_TYPES } from './checklistSchema'

// The procedures to compose a draft from when no endpoint is configured, and
// the rule for which category a description falls into. Both belong to the
// portal asking for the checklist — a cleanroom's procedures are not a chiller
// hall's — so they are handed in rather than imported. A caller with neither
// gets the endpoint path and, without one, an honest refusal.
const NO_LIBRARY = { templates: [], categoryFor: () => null }

// Configuration, read the way the product reads it.
//
// The product builds this URL as `${config.api.n8nUrl}/webhook/generate_checklist`,
// so the base is what a deployment sets and the path is ours to know. The full
// URL can still be given directly, which is what a different generator behind a
// different path would need.
//
// Where neither is set, `isConfigured()` is false, the screen composes from the
// site's own procedures, and it says so rather than claiming a model answered.
const N8N_BASE = (process.env.NEXT_PUBLIC_N8N_URL || '').replace(/\/+$/, '')
const WEBHOOK_PATH = '/webhook/generate_checklist'

const ENDPOINT = process.env.NEXT_PUBLIC_OXMAINT_CHECKLIST_AI_URL
  || (N8N_BASE ? `${N8N_BASE}${WEBHOOK_PATH}` : '')

// Base64 of `user:password`, and deliberately not defaulted.
//
// The product ships its webhook credential as a literal in client code, which
// means it reaches every browser that loads the page and can be read out of the
// bundle. Copying that here would put the same secret in this repository. So it
// comes from the environment or the header is not sent at all — a webhook that
// needs Basic auth will answer 401 until somebody sets it, which is a better
// failure than a credential in git history.
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
 * Generate a checklist's sections from a name and a description.
 *
 * @param request { checklistName, description, length? }
 * @param signal  an AbortSignal, so the loader's Cancel actually cancels
 * @param library { templates, categoryFor } — the portal's own procedures, used
 *                only when no endpoint is configured
 * @returns { ok, generated, sections, sources, note, error }
 *          `generated` is true only when a model produced the steps.
 */
export async function generateChecklist(request, signal, library) {
  const checklistName = String(request?.checklistName || '').trim()
  const description = String(request?.description || '').trim()

  const nameError = validateChecklistName(checklistName)
  if (nameError) return { ok: false, error: nameError }
  const descriptionError = validateChecklistDescription(description)
  if (descriptionError) return { ok: false, error: descriptionError }

  if (!isConfigured()) {
    const lib = library && library.templates?.length ? library : NO_LIBRARY
    if (!lib.templates.length) {
      return {
        ok: false,
        error: 'No generator is configured and this portal has no procedure library to compose from.',
      }
    }
    return composeFromLibrary(checklistName, description, request?.length, lib)
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
    // where the portal has a procedure library, fall back to composing from it
    // rather than dead-ending. The note says plainly what happened.
    const lib = library && library.templates?.length ? library : NO_LIBRARY
    if (lib.templates.length) {
      const composed = composeFromLibrary(checklistName, description, request?.length, lib)
      if (composed.sections?.length) {
        return {
          ...composed,
          note: `The ${GENERATOR_NAME} generation service did not respond (${e?.message || 'no answer'}). This draft `
            + 'was composed instead from this portal’s own procedure library — review and adjust before use, or '
            + 'retry once the service is back.',
        }
      }
    }
    return { ok: false, error: e?.message || 'Failed to generate checklist. Check the connection and try again.' }
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
    items: (section.items || []).map((item, i) => readItem(item, id, i)),
    subSections: (section.sub_sections || section.subSections || []).map((sub, ssi) => {
      const subId = `${id}-ss${ssi + 1}`
      return {
        id: subId,
        name: sub.sub_section_name || sub.name || `Sub-section ${ssi + 1}`,
        sequence: Number(sub.sequence) || ssi + 1,
        instruction: sub.inspection_instruction || '',
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
    description: item.item_description || '',
    responseType: type,
    instruction: item.inspection_instruction || '',
    unit: item.unit || '',
    min: item.acceptable_min_value || rangeMin || '',
    max: item.acceptable_max_value || rangeMax || '',
    options: item.selection_options ? String(item.selection_options).split(',').map((o) => o.trim()).filter(Boolean) : [],
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
  'need', 'should', 'must', 'make', 'sure', 'create', 'build', 'one',
])

const tokens = (s) => String(s).toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/)
  .filter((w) => w.length > 2 && !STOP.has(w))

/**
 * Assemble a draft out of the site's own procedures.
 *
 * Scores every step in the library against the description — a step scores for
 * each distinctive word it shares, and more when its own procedure is a strong
 * match, so a step about clamp torque belongs in a housing checklist even when
 * the author never wrote "torque".
 *
 * Steps keep the order and the grouping their own procedure puts them in.
 * Ranking by score alone shuffles them, and a checklist whose steps are out of
 * sequence is not a checklist — "photometer zeroed" after "scan complete" is a
 * procedure nobody can follow.
 */
function composeFromLibrary(checklistName, description, wantedLength, library) {
  const { templates: TEMPLATES, categoryFor } = library
  const text = `${checklistName} ${description}`
  const wanted = tokens(text)
  const length = Math.min(24, Math.max(5, wantedLength || 12))

  const scoreByTemplate = new Map()

  for (const t of TEMPLATES) {
    const templateHits = tokens(`${t.name} ${t.what} ${t.standard}`).filter((w) => wanted.includes(w)).length
    let total = 0
    const hits = new Set()
    for (const item of allOf(t)) {
      const n = tokens(item.description).filter((w) => wanted.includes(w)).length
      const score = n * 3 + templateHits * 2
      if (score > 0) {
        total += score
        hits.add(item.id)
      }
    }
    if (total > 0) scoreByTemplate.set(t.id, { template: t, score: total, hits })
  }

  // Nothing matched: fall back to the procedures in the same category rather
  // than returning an empty draft. An author whose description shares no
  // vocabulary with the library still gets somewhere to start.
  let ranked = [...scoreByTemplate.values()].sort((a, b) => b.score - a.score)
  if (!ranked.length) {
    const category = categoryFor(text)
    const near = TEMPLATES.filter((t) => t.category === category)
    const pool = near.length ? near : TEMPLATES
    ranked = pool.map((t) => ({ template: t, score: 1, hits: new Set(allOf(t).map((i) => i.id)) }))
  }

  const sections = []
  const used = []
  let taken = 0

  // Takes the matching items out of a container while there is room left in the
  // draft, so a long procedure contributes its opening steps rather than being
  // dropped whole once the budget is reached.
  const keep = (list, hits) => {
    const out = []
    for (const item of list || []) {
      if (taken >= length) break
      if (!hits.has(item.id)) continue
      out.push(item)
      taken += 1
    }
    return out
  }

  for (const group of ranked) {
    if (taken >= length) break
    let contributed = false

    for (const s of group.template.sections) {
      if (taken >= length) break
      const items = keep(s.items, group.hits)
      const subSections = (s.subSections || [])
        .map((ss) => ({ ...ss, items: keep(ss.items, group.hits) }))
        .filter((ss) => ss.items.length)
      if (!items.length && !subSections.length) continue
      contributed = true
      sections.push({ ...s, name: `${group.template.name} — ${s.name}`, items, subSections })
    }

    if (contributed) {
      used.push({ id: group.template.id, name: group.template.name, standard: group.template.standard })
    }
  }

  return {
    ok: true,
    generated: false,
    configured: false,
    sections: renumber(sections),
    sources: used,
    note: 'No generation service is configured for this deployment, so this draft was assembled from '
      + `${used.length} of this site's own procedure${used.length === 1 ? '' : 's'}: `
      + `${used.map((s) => s.name).join(', ')}. Every step is one this site already works to. `
      + 'Edit, regroup or remove them before you save.',
  }
}

const allOf = (t) => [
  ...t.sections.flatMap((s) => s.items),
  ...t.sections.flatMap((s) => (s.subSections || []).flatMap((ss) => ss.items)),
]

/** Fresh ids and item numbers, so a composed draft is a new checklist rather than a view of eight old ones. */
function renumber(sections) {
  let n = 0
  return sections.map((s, si) => {
    const id = `gen-s${si + 1}`
    const stamp = (item, containerId, i) => ({
      ...item,
      id: `${containerId}-i${i + 1}`,
      containerId,
      itemNumber: String((n += 1)),
      sequence: n,
    })
    return {
      id,
      name: s.name,
      sequence: si + 1,
      items: s.items.map((item, i) => stamp(item, id, i)),
      subSections: (s.subSections || []).map((ss, ssi) => {
        const subId = `${id}-ss${ssi + 1}`
        return {
          id: subId,
          name: ss.name,
          sequence: ssi + 1,
          instruction: ss.instruction || '',
          items: ss.items.map((item, i) => stamp(item, subId, i)),
        }
      }),
    }
  })
}
