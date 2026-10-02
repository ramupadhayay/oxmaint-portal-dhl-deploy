'use client'

// Create Inspection Checklist.
//
// A port of the product's create screen (inspection/checklist/(sub-routes)/create).
// Its shape is the point: a sticky header carrying Save Draft and Save, a
// two-thirds column holding Basic Information above the sections builder, and a
// third column holding Settings, a live Summary and the banner that appears
// after a generation run.
//
// The builder is sections → sub-sections → items, and an item is not a line of
// text — it has a response type, and Numeric and Range items carry a unit and an
// acceptable band. That is the part worth porting properly: "Probe held 25 mm
// from the filter face" answered with a tick is a record that proves nothing,
// and the number is what an investigator reads a year later.
//
// ── on generation ─────────────────────────────────────────────────────────
//
// The Generate button, the loader and the banner are the product's, and the
// call behind them is the product's request in lib/generateChecklist.js. What
// the screen will not do is claim a model wrote something a model did not
// write: with no endpoint configured the draft is composed from this site's own
// procedures and the banner says exactly that, in place of the product's
// "Powered by Synapse AI" line. A checklist whose provenance is overstated is
// one a quality lead has to re-derive before they can trust a run against it.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PALETTE } from '../lib/kit'
import PageHeading from '../../datacenter/components/PageHeading'
import { Action, Pill, TONE, Glyph, Z } from '../lib/productKit'
import { Mark, Modal, Panel, Field, TextInput, TextArea, Picker, Toggle, IconButton } from '../lib/checklistKit'
import { SITES, ASSETS, USER, DOMAIN } from '../lib/data'
import { useStore } from '../lib/store'
import { categoryFor } from '../lib/checklistBank'
import { RESPONSE_TYPES, SCORING_METHODS, ASSET_LEVELS, LOCATION_TYPES, codeFor, allItemsOf } from '../lib/checklistSchema'
import { generateChecklist, isConfigured, GENERATOR_NAME } from '../lib/checklistGenerator'

// The worked examples in the empty fields. They were written for a cleanroom,
// and a pack can replace any of them with its own — a filter housing is not
// what a GSE mechanic is about to write a checklist for.
const HINT = DOMAIN?.placeholders || {}

// The four this register files its checklists under.
const CATEGORIES = ['Operations', 'Safety', 'Maintenance', 'Compliance']

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

const LIST = '/portal/oxmaint/checklists'
const DRAFT_KEY = 'ox_checklist_create_draft'
const SEED_KEY = 'ox_checklist_seed'

const NAME_MAX = 100
const WORDS_MAX = 500

const emptyForm = () => ({
  checklistName: '',
  description: '',
  standard: '',
  category: '',
  assetLevel: 'Equipment',
  locationType: 'Room',
  siteId: '',
  assetId: '',
  scoringMethod: 'Pass_Fail',
  passingScore: 80,
})

const emptyItemForm = () => ({
  description: '',
  type: 'Pass_Fail',
  instruction: '',
  unit: '',
  min: '',
  max: '',
  options: [],
  required: true,
  critical: false,
  requiresPhoto: false,
  requiresComment: false,
  requiresSignature: false,
})

// A fixed id, not a stamped one. This section is built during the first render,
// which happens on the server as well as in the browser, and `Date.now()` there
// gives the two renders different ids and React a hydration mismatch. Sections
// added later are stamped, because a click only ever happens in the browser.
const firstSection = () => ([{ id: 'section-1', name: 'General Condition', isExpanded: true, items: [], subSections: [] }])

const wordCount = (s) => s.trim().split(/\s+/).filter(Boolean).length

export default function ChecklistCreate() {
  const router = useRouter()
  const store = useStore()

  const [form, setForm] = useState(emptyForm)
  const [sections, setSections] = useState(firstSection)

  // Set when the screen was opened on an existing checklist. Editing keeps the
  // id, so the library reads the edit over what it was; duplicating drops it,
  // so the copy is a new checklist rather than a second face of the old one.
  const [editing, setEditing] = useState(null)

  const initialised = useRef(false)
  const [hydrated, setHydrated] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState(null)
  const [hasDraft, setHasDraft] = useState(false)

  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const [generating, setGenerating] = useState(false)
  // `generating` is only true while the request is in flight; the result is
  // then revealed item by item, and the banner that records who wrote it is
  // set at the very end. Saving inside that window filed a checklist missing
  // the steps still to land and carrying no provenance, so a second flag
  // covers the whole run and the header's buttons are held against it.
  const [settling, setSettling] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [banner, setBanner] = useState(null)
  const abortRef = useRef(null)
  const bottomRef = useRef(null)

  const [sectionDialog, setSectionDialog] = useState(false)
  const [newSection, setNewSection] = useState({ name: '', siteId: '', assetId: '' })
  const [itemDialog, setItemDialog] = useState(null) // { containerId } | { item }
  const [itemForm, setItemForm] = useState(emptyItemForm)

  const [dragSection, setDragSection] = useState(null)

  const items = useMemo(() => allItemsOf(sections), [sections])
  const requiresPhotos = items.some((i) => i.requiresPhoto || i.responseType === 'Photo')
  const requiresSignature = items.some((i) => i.requiresSignature || i.responseType === 'Signature')

  const words = wordCount(form.description)

  // ── hydration: a seeded checklist first, then a saved draft ──────────────
  //
  // Reading either in a state initialiser would render different markup on the
  // server than in the browser. Done here instead, once, after the first paint.
  //
  // Once, guarded by a ref, because React invokes effects twice in development.
  // The seed is consumed on the first pass, so a second pass found nothing there
  // and fell through to the saved draft — which silently replaced the checklist
  // the author had just asked to edit with whatever they last had open.
  useEffect(() => {
    if (typeof window === 'undefined' || initialised.current) return
    initialised.current = true
    const seedRaw = window.sessionStorage.getItem(SEED_KEY)
    if (seedRaw) {
      window.sessionStorage.removeItem(SEED_KEY)
      try {
        const { mode, checklist } = JSON.parse(seedRaw)
        // An opened checklist replaces whatever was half-written before it. A
        // draft left behind would come back the next time this screen opened
        // empty, in place of the work the author is doing now.
        window.localStorage.removeItem(DRAFT_KEY)
        applySeed(mode, checklist)
        setHydrated(true)
        return
      } catch {
        store?.notify('That checklist could not be opened for editing.', 'error')
      }
    }

    try {
      const raw = window.localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const draft = JSON.parse(raw)
        setForm({ ...emptyForm(), ...draft.form })
        setSections(draft.sections?.length ? draft.sections : firstSection())
        setEditing(draft.editing || null)
        setBanner(draft.banner || null)
        setGenerated(Boolean(draft.generated))
        setHasDraft(true)
        setDraftSavedAt(draft.savedAt || null)
        store?.notify('Checklist draft restored.')
      }
    } catch {
      // A draft that will not parse is a draft worth dropping silently — the
      // author has an empty form, which is where they were headed anyway.
    }
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applySeed = (mode, c) => {
    const dup = mode === 'duplicate'
    setForm({
      ...emptyForm(),
      // The product leaves the name empty on a duplicate, so nobody saves two
      // checklists with one name by pressing Save too quickly.
      checklistName: dup ? '' : c.name || '',
      description: c.description || c.what || '',
      standard: c.standard || '',
      category: c.category || '',
      assetLevel: c.assetLevel || 'Equipment',
      locationType: c.locationType || 'Room',
      siteId: c.siteId || '',
      assetId: c.assetId || '',
      scoringMethod: c.scoringMethod || 'Pass_Fail',
      passingScore: c.passingScore ?? 80,
    })
    setSections((c.sections || []).map((s, i) => ({
      ...s,
      id: s.id || `section-${i + 1}`,
      isExpanded: i === 0,
      items: s.items || [],
      subSections: (s.subSections || []).map((ss) => ({ ...ss, isExpanded: true, items: ss.items || [] })),
    })))
    setEditing(dup ? null : {
      id: c.id, recordId: c.recordId || null, code: c.code,
      createdAt: c.createdAt, author: c.author, source: c.source,
    })
    setBanner(dup ? null : c.generatedBy ? { generated: true, note: `Generated by ${c.generatedBy}.`, sources: c.sources || [] } : null)
    store?.notify(dup ? 'Checklist loaded for duplication.' : 'Checklist loaded for editing.')
  }

  // ── the draft ────────────────────────────────────────────────────────────

  const meaningful = Boolean(form.checklistName.trim() || form.description.trim() || items.length)

  const draftPayload = useCallback(() => ({
    form, sections, editing, banner, generated, savedAt: new Date().toISOString(),
  }), [form, sections, editing, banner, generated])

  // Kept current as the author types, so a closed tab is not a lost afternoon.
  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return
    if (!meaningful) {
      window.localStorage.removeItem(DRAFT_KEY)
      setHasDraft(false)
      setDraftSavedAt(null)
      return
    }
    const payload = draftPayload()
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload))
    setHasDraft(true)
    setDraftSavedAt(payload.savedAt)
  }, [hydrated, meaningful, draftPayload])

  const saveDraft = () => {
    if (!meaningful) {
      store?.notify('Add a name, a description or an item before saving a draft.', 'error')
      return
    }
    const payload = draftPayload()
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload))
    setHasDraft(true)
    setDraftSavedAt(payload.savedAt)
    store?.notify('Checklist draft saved. You can carry on later.')
  }

  const discardDraft = () => {
    window.localStorage.removeItem(DRAFT_KEY)
    setForm(emptyForm())
    setSections(firstSection())
    setEditing(null)
    setBanner(null)
    setGenerated(false)
    setErrors({})
    setHasDraft(false)
    setDraftSavedAt(null)
    store?.notify('Checklist draft discarded.')
  }

  // ── validation ───────────────────────────────────────────────────────────

  const validateBasics = () => {
    const next = {}
    if (!form.checklistName.trim()) next.checklistName = 'Checklist name is required'
    else if (form.checklistName.length > NAME_MAX) next.checklistName = `Checklist name must not exceed ${NAME_MAX} characters`
    if (!form.description.trim()) next.description = 'Description is required'
    else if (words > WORDS_MAX) next.description = `Description must not exceed ${WORDS_MAX} words`
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const clearError = (field) => setErrors((p) => {
    if (!p[field]) return p
    const next = { ...p }
    delete next[field]
    return next
  })

  // ── generation ───────────────────────────────────────────────────────────

  const generate = async () => {
    if (!validateBasics()) return

    setGenerating(true)
    setSettling(true)
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    const result = await generateChecklist(
      { checklistName: form.checklistName, description: form.description },
      abortRef.current.signal,
    )

    setGenerating(false)

    if (!result.ok) {
      setSettling(false)
      if (!result.cancelled) store?.notify(result.error, 'error')
      return
    }
    if (!result.sections.length) {
      setSettling(false)
      store?.notify('No sections came back for that description.', 'error')
      return
    }

    // The product reveals the result section by section and item by item rather
    // than dropping it in whole. That is not decoration: an author watching a
    // list build reads it, and an author handed forty rows at once scrolls past
    // them to the Save button.
    setSections([])
    for (let si = 0; si < result.sections.length; si += 1) {
      const s = result.sections[si]
      // eslint-disable-next-line no-await-in-loop
      await pause(500)
      setSections((prev) => [...prev, { ...s, id: s.id || `section-${si + 1}`, isExpanded: true, items: [], subSections: (s.subSections || []).map((ss) => ({ ...ss, isExpanded: true, items: [] })) }])

      for (let ii = 0; ii < (s.items || []).length; ii += 1) {
        const item = s.items[ii]
        // eslint-disable-next-line no-await-in-loop
        await pause(220)
        setSections((prev) => prev.map((x) => (x.id === (s.id || `section-${si + 1}`) ? { ...x, items: [...x.items, item] } : x)))
      }

      for (const sub of s.subSections || []) {
        for (let ii = 0; ii < (sub.items || []).length; ii += 1) {
          const item = sub.items[ii]
          // eslint-disable-next-line no-await-in-loop
          await pause(220)
          setSections((prev) => prev.map((x) => (x.id === (s.id || `section-${si + 1}`)
            ? { ...x, subSections: x.subSections.map((ss) => (ss.id === sub.id ? { ...ss, items: [...ss.items, item] } : ss)) }
            : x)))
        }
      }
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }

    setBanner({ generated: result.generated, note: result.note, sources: result.sources || [] })
    setGenerated(true)
    setSettling(false)
    if (!form.category) setForm((p) => ({ ...p, category: categoryFor(`${form.checklistName} ${form.description}`) }))
    if (!form.standard && result.sources?.length === 1) setForm((p) => ({ ...p, standard: result.sources[0].standard }))
    store?.notify(result.generated ? 'Checklist generated.' : 'Draft assembled from this site\'s procedures.')
  }

  const cancelGenerate = () => {
    abortRef.current?.abort()
    setGenerating(false)
    setSettling(false)
  }

  // ── sections and items ───────────────────────────────────────────────────

  const patchSection = (id, patch) => setSections((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  const addSection = () => {
    if (!newSection.name.trim()) return
    setSections((p) => [...p, {
      id: `section-${Date.now()}`,
      name: newSection.name.trim(),
      isExpanded: true,
      items: [],
      subSections: [],
      siteId: newSection.siteId || '',
      assetId: newSection.assetId || '',
    }])
    setNewSection({ name: '', siteId: '', assetId: '' })
    setSectionDialog(false)
    store?.notify('Section added.')
  }

  const deleteSection = (id) => {
    if (sections.length <= 1) {
      store?.notify('A checklist needs at least one section.', 'error')
      return
    }
    setSections((p) => p.filter((s) => s.id !== id))
    store?.notify('Section deleted.')
  }

  const addSubSection = (sectionId) => {
    setSections((p) => p.map((s) => (s.id === sectionId
      ? { ...s, isExpanded: true, subSections: [...s.subSections, { id: `subsection-${Date.now()}`, name: '', isExpanded: true, items: [] }] }
      : s)))
  }

  const patchSubSection = (subId, patch) => setSections((p) => p.map((s) => ({
    ...s, subSections: s.subSections.map((ss) => (ss.id === subId ? { ...ss, ...patch } : ss)),
  })))

  const deleteSubSection = (subId) => setSections((p) => p.map((s) => ({
    ...s, subSections: s.subSections.filter((ss) => ss.id !== subId),
  })))

  const openAddItem = (containerId) => {
    setItemForm(emptyItemForm())
    setItemDialog({ containerId })
  }

  const openEditItem = (item) => {
    setItemForm({
      description: item.description,
      type: item.responseType || 'Pass_Fail',
      instruction: item.instruction || '',
      unit: item.unit || '',
      min: item.min || '',
      max: item.max || '',
      options: item.options || [],
      required: item.required !== false,
      critical: Boolean(item.critical),
      requiresPhoto: Boolean(item.requiresPhoto),
      requiresComment: Boolean(item.requiresComment),
      requiresSignature: Boolean(item.requiresSignature),
    })
    setItemDialog({ item })
  }

  const saveItem = () => {
    if (!itemForm.description.trim()) {
      store?.notify('An item needs a description.', 'error')
      return
    }
    if (itemForm.type === 'Selection' && itemForm.options.filter((o) => o.trim()).length === 0) {
      store?.notify('A Selection item needs at least one response option.', 'error')
      return
    }

    const shaped = {
      responseType: itemForm.type,
      description: itemForm.description.trim(),
      instruction: itemForm.instruction.trim(),
      unit: itemForm.unit.trim(),
      min: itemForm.min.trim(),
      max: itemForm.max.trim(),
      options: itemForm.options.map((o) => o.trim()).filter(Boolean),
      required: itemForm.required,
      critical: itemForm.critical,
      requiresPhoto: itemForm.requiresPhoto || itemForm.type === 'Photo',
      requiresComment: itemForm.requiresComment,
      requiresSignature: itemForm.requiresSignature || itemForm.type === 'Signature',
    }

    if (itemDialog.item) {
      const id = itemDialog.item.id
      setSections((p) => p.map((s) => ({
        ...s,
        items: s.items.map((i) => (i.id === id ? { ...i, ...shaped } : i)),
        subSections: s.subSections.map((ss) => ({ ...ss, items: ss.items.map((i) => (i.id === id ? { ...i, ...shaped } : i)) })),
      })))
      store?.notify('Item updated.')
    } else {
      const id = `item-${Date.now()}-${Math.round(Math.random() * 1e6)}`
      const target = itemDialog.containerId
      const item = { id, containerId: target, itemNumber: '', sequence: 0, ...shaped }
      setSections((p) => p.map((s) => {
        if (s.id === target) return { ...s, items: [...s.items, item] }
        if (s.subSections.some((ss) => ss.id === target)) {
          return { ...s, subSections: s.subSections.map((ss) => (ss.id === target ? { ...ss, items: [...ss.items, item] } : ss)) }
        }
        return s
      }))
      store?.notify('Item added.')
    }

    setItemDialog(null)
    setItemForm(emptyItemForm())
  }

  const deleteItem = (id) => {
    setSections((p) => p.map((s) => ({
      ...s,
      items: s.items.filter((i) => i.id !== id),
      subSections: s.subSections.map((ss) => ({ ...ss, items: ss.items.filter((i) => i.id !== id) })),
    })))
    store?.notify('Item deleted.')
  }

  /**
   * Move an item within a container or into another one.
   *
   * A container is a section or a sub-section, and an item's parent is derived
   * purely from where it sits — so moving one across containers is just
   * re-nesting it. Both halves of the move happen in one pass so the target
   * index still means what it meant when the drop landed.
   */
  const moveItem = (fromContainer, toContainer, fromIndex, toIndex) => {
    if (fromContainer === toContainer && fromIndex === toIndex) return
    setSections((prev) => {
      const find = (id) => {
        for (const s of prev) {
          if (s.id === id) return s.items
          const ss = s.subSections.find((x) => x.id === id)
          if (ss) return ss.items
        }
        return null
      }
      const source = find(fromContainer)
      if (!source || fromIndex < 0 || fromIndex >= source.length) return prev
      const dragged = source[fromIndex]

      const rebuild = (list, containerId) => {
        if (fromContainer === toContainer && containerId === fromContainer) {
          const arr = [...list]
          const [row] = arr.splice(fromIndex, 1)
          arr.splice(Math.max(0, Math.min(toIndex, arr.length)), 0, row)
          return arr
        }
        if (containerId === fromContainer) return list.filter((_, i) => i !== fromIndex)
        if (containerId === toContainer) {
          const arr = [...list]
          arr.splice(Math.max(0, Math.min(toIndex, arr.length)), 0, { ...dragged, containerId })
          return arr
        }
        return list
      }

      return prev.map((s) => ({
        ...s,
        items: rebuild(s.items, s.id),
        subSections: s.subSections.map((ss) => ({ ...ss, items: rebuild(ss.items, ss.id) })),
      }))
    })
  }

  const dropIntoContainer = (fromContainer, fromIndex, toContainer) => {
    let length = null
    for (const s of sections) {
      if (s.id === toContainer) { length = s.items.length; break }
      const ss = s.subSections.find((x) => x.id === toContainer)
      if (ss) { length = ss.items.length; break }
    }
    if (length === null) return
    moveItem(fromContainer, toContainer, fromIndex, length)
  }

  const moveSection = (from, to) => {
    if (from === to) return
    setSections((p) => {
      const arr = [...p]
      const [row] = arr.splice(from, 1)
      arr.splice(to, 0, row)
      return arr
    })
  }

  // ── save ─────────────────────────────────────────────────────────────────

  const save = async () => {
    if (saving) return
    if (!validateBasics()) return

    const empty = sections.filter((s) => s.items.length === 0 && s.subSections.every((ss) => ss.items.length === 0))
    if (empty.length) {
      store?.notify(`“${empty[0].name || 'A section'}” has no items. Every section needs at least one.`, 'error')
      return
    }
    const unnamed = sections.some((s) => s.subSections.some((ss) => ss.items.length && !ss.name.trim()))
    if (unnamed) {
      store?.notify('Give every sub-section that holds items a name.', 'error')
      return
    }

    const id = editing?.id || `chk-${slug(form.checklistName)}-${Date.now().toString(36)}`
    const now = new Date().toISOString()
    const room = SITES.find((x) => x.site_id === form.siteId) || null
    const filter = ASSETS.find((a) => a.asset_id === form.assetId) || null

    // Numbered on the way out rather than as they are added, so an item dragged
    // between sections carries the number it has on the page it was saved from.
    let n = 0
    const stamp = (item, containerId, i) => ({
      ...item,
      containerId,
      id: item.id || `${containerId}-i${i + 1}`,
      itemNumber: String((n += 1)),
      sequence: n,
    })

    const payload = {
      recordId: editing?.recordId || `chk_${id}`,
      templateId: id,
      id,
      // The register reads a checklist under its own column names, and the
      // builder writes it under the product's. Both are written rather than one
      // being translated on the way out, because a row that saves cleanly and
      // then cannot be found on the list it came from is the worst of the two
      // failures — it looks like the save silently failed.
      checklist_id: id,
      checklist_name: form.checklistName.trim(),
      assigned_to: USER.name,
      status: 'Active',
      items_count: allItemsOf(sections).length,
      completions_today: 0,
      due_today: 0,
      name: form.checklistName.trim(),
      description: form.description.trim(),
      what: form.description.trim(),
      standard: form.standard.trim() || '—',
      category: form.category || categoryFor(form.checklistName),
      code: editing?.code || codeFor(id),
      assetLevel: form.assetLevel,
      locationType: form.locationType,
      siteId: room?.site_id || '',
      siteName: room?.site_name || '',
      assetId: filter?.asset_id || '',
      scoringMethod: form.scoringMethod,
      passingScore: Number(form.passingScore) || 0,
      version: '1.0',
      author: editing?.author || USER.name,
      createdAt: editing?.createdAt || now,
      modifiedAt: editing ? now : null,
      modifiedBy: editing ? USER.name : null,
      archived: false,
      source: 'org',
      generatedBy: banner?.generated ? GENERATOR_NAME : null,
      sources: banner?.sources?.length ? banner.sources : null,
      sections: sections.map((s, si) => ({
        id: s.id,
        name: s.name,
        sequence: si + 1,
        siteId: s.siteId || '',
        assetId: s.assetId || '',
        items: s.items.map((item, i) => stamp(item, s.id, i)),
        subSections: s.subSections.filter((ss) => ss.items.length).map((ss, ssi) => ({
          id: ss.id,
          name: ss.name,
          sequence: ssi + 1,
          instruction: ss.instruction || '',
          items: ss.items.map((item, i) => stamp(item, ss.id, i)),
        })),
      })),
    }

    setSaving(true)
    const saved = editing?.recordId
      ? await store.update('checklist', editing.recordId, payload)
      : await store.create('checklist', payload)
    setSaving(false)

    if (!saved) return
    window.localStorage.removeItem(DRAFT_KEY)
    store?.notify(editing ? 'Checklist updated.' : 'Checklist created.')
    router.push(LIST)
  }

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {generating && <Loader onCancel={cancelGenerate} configured={isConfigured()} />}

      <PageHeading
        title={editing ? 'Update Inspection Checklist' : 'Create Inspection Checklist'}
        subtitle="Build a comprehensive inspection checklist"
        back={{ label: 'Back', onClick: () => router.push(LIST) }}
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {draftSavedAt && <span style={styles.draftAt}>Draft saved {fmtTime(draftSavedAt)}</span>}
            {/* A link rather than a button, as in the product — discarding is
                not one of the three things this header is asking you to do. */}
            {hasDraft && <button onClick={discardDraft} style={styles.discard}>Discard Draft</button>}
            {/* Both are held while a run is streaming in. The items arrive one
                at a time, so a Save pressed halfway files a checklist missing
                the steps still to land and — because the banner is set at the
                end — records no sign that a model wrote any of it. */}
            <Action onClick={saveDraft} disabled={settling}>Save Draft</Action>
            <Action onClick={() => router.push(LIST)}>Cancel</Action>
            <Action icon="save" primary onClick={save} disabled={saving || settling}>
              {saving ? 'Saving…' : editing ? 'Update Checklist' : 'Save Checklist'}
            </Action>
          </div>
        }
      />

      <div style={styles.columns}>
        <div style={{ minWidth: 0 }}>
          <Panel title="Basic Information" icon="doc"
            right={isConfigured() ? (
              <span style={styles.poweredChip}>
                <Mark name="sparkle" size={12} color="#7c3aed" />
                Powered by <strong style={{ color: INK }}>{GENERATOR_NAME}</strong>
              </span>
            ) : null}>
            <div style={styles.stack}>
              <Field label="Checklist Name" required error={errors.checklistName}
                hint={`${form.checklistName.length}/${NAME_MAX}`}>
                <TextInput value={form.checklistName} maxLength={NAME_MAX} invalid={Boolean(errors.checklistName)}
                  placeholder={HINT.checklistName || 'e.g. Terminal filter housing inspection'}
                  onChange={(e) => { setForm((p) => ({ ...p, checklistName: e.target.value })); clearError('checklistName') }} />
              </Field>

              <Field label="Description" required error={errors.description}
                hint={`${words}/${WORDS_MAX} words`}>
                <TextArea rows={5} value={form.description} invalid={Boolean(errors.description)}
                  placeholder={HINT.checklistPurpose || 'Describe the purpose and scope of this checklist — which rooms or filters it covers, what a technician has to establish, and what a failure means.'}
                  onChange={(e) => { setForm((p) => ({ ...p, description: e.target.value })); clearError('description') }} />
              </Field>

              {/* One row, as the product has it: the two selects side by side
                  with Generate at the end of the same line. It used to be two
                  rows, which pushed everything below it half a field lower than
                  the screen it is meant to match. */}
              <div style={styles.trio}>
                <Field label="Category">
                  <Picker value={form.category} onChange={(v) => setForm((p) => ({ ...p, category: v }))}
                    placeholder={form.checklistName ? `Suggested: ${categoryFor(form.checklistName)}` : 'Select a category'}
                    options={CATEGORIES} />
                </Field>
                <Field label="Scoring Method">
                  <Picker value={form.scoringMethod} onChange={(v) => setForm((p) => ({ ...p, scoringMethod: v }))}
                    options={SCORING_METHODS} />
                </Field>
                <div style={styles.generateSlot}>
                  {!generated && (
                    <GenerateButton
                      onClick={generate}
                      disabled={generating}
                      ready={Boolean(form.checklistName.trim() && form.description.trim())}
                      missing={[
                        !form.checklistName.trim() ? 'Checklist Name' : null,
                        !form.description.trim() ? 'Description' : null,
                      ].filter(Boolean)}
                    />
                  )}
                </div>
              </div>

              <div style={styles.pair}>
                <Field label="Asset Level">
                  <Picker value={form.assetLevel} onChange={(v) => setForm((p) => ({ ...p, assetLevel: v }))} options={ASSET_LEVELS} />
                </Field>
                <Field label="Asset">
                  <Picker value={form.assetId} onChange={(v) => setForm((p) => ({ ...p, assetId: v }))}
                    placeholder="Any asset"
                    options={ASSETS.map((a) => ({ value: a.asset_id, label: `${a.asset_name} — ${a.asset_code}` }))} />
                </Field>
              </div>

              <div style={styles.pair}>
                <Field label="Location Type">
                  <Picker value={form.locationType} onChange={(v) => setForm((p) => ({ ...p, locationType: v }))} options={LOCATION_TYPES} />
                </Field>
                <Field label="Site">
                  <Picker value={form.siteId} onChange={(v) => setForm((p) => ({ ...p, siteId: v }))}
                    placeholder="Any site"
                    options={SITES.map((x) => ({ value: x.site_id, label: x.site_name }))} />
                </Field>
              </div>
            </div>
          </Panel>

          <Panel title="Inspection Sections" icon="list"
            right={<Action icon="clipboard" onClick={() => setSectionDialog(true)}>Add Section</Action>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sections.map((s, si) => (
                <SectionBlock
                  key={s.id}
                  section={s}
                  index={si}
                  dragging={dragSection === si}
                  onDragStart={() => setDragSection(si)}
                  onDragEnd={() => setDragSection(null)}
                  onDropSection={(to) => { moveSection(dragSection, to); setDragSection(null) }}
                  onRename={(name) => patchSection(s.id, { name })}
                  onToggle={() => patchSection(s.id, { isExpanded: !s.isExpanded })}
                  onDelete={() => deleteSection(s.id)}
                  onAddItem={openAddItem}
                  onAddSubSection={() => addSubSection(s.id)}
                  onRenameSub={patchSubSection}
                  onDeleteSub={deleteSubSection}
                  onEditItem={openEditItem}
                  onDeleteItem={deleteItem}
                  onMoveItem={moveItem}
                  onDropIntoContainer={dropIntoContainer}
                />
              ))}
            </div>
          </Panel>

          <div ref={bottomRef} />
        </div>

        <div style={{ minWidth: 0 }}>
          <Panel title="Settings" icon="sliders">
            <div style={styles.stack}>
              {form.scoringMethod !== 'None' && (
                <Field label="Passing Score (%)">
                  <TextInput type="number" min="0" max="100" value={form.passingScore}
                    onChange={(e) => setForm((p) => ({ ...p, passingScore: e.target.value }))} />
                </Field>
              )}
              {/* Not on the product's form, and kept out of the left column so
                  that column matches it field for field. Every checklist here is
                  written to a standard and the library prints it on every card —
                  a column the list shows and the form cannot set reads as broken,
                  so it lives on this side instead. */}
              <Field label="Standard or reference">
                <TextInput value={form.standard} placeholder={HINT.checklistStandard || 'e.g. ISO 14644-3 Annex B'}
                  onChange={(e) => setForm((p) => ({ ...p, standard: e.target.value }))} />
              </Field>
              <DerivedSetting label="Requires Photos" what="At least one item captures a photo" on={requiresPhotos} />
              <DerivedSetting label="Requires Signature" what="At least one item captures a signature" on={requiresSignature} />
            </div>
          </Panel>

          <Panel title="Summary" icon="clipboard">
            {[
              ['Sections', sections.length],
              ['Total Items', items.length],
              ['Required Items', items.filter((i) => i.required !== false).length],
              ['Critical Items', items.filter((i) => i.critical).length],
            ].map(([k, v]) => (
              <div key={k} style={styles.summaryRow}>
                <span style={styles.summaryKey}>{k}</span>
                <span style={{ ...styles.summaryVal, color: k === 'Critical Items' && v > 0 ? '#dc2626' : INK }}>{v}</span>
              </div>
            ))}
          </Panel>

          {banner && <ResultBanner banner={banner} onDismiss={() => setBanner(null)} />}
        </div>
      </div>

      <Modal open={sectionDialog} width={480} title="Add New Section" onClose={() => setSectionDialog(false)}>
        <div style={styles.stack}>
          <Field label="Section Name" required>
            <TextInput value={newSection.name} placeholder={HINT.sectionName || 'e.g. Housing'}
              onChange={(e) => setNewSection((p) => ({ ...p, name: e.target.value }))} />
          </Field>
          <Field label="Site">
            <Picker value={newSection.siteId} onChange={(v) => setNewSection((p) => ({ ...p, siteId: v }))}
              placeholder="Any site"
              options={SITES.map((x) => ({ value: x.site_id, label: x.site_name }))} />
          </Field>
          <Field label="Asset">
            <Picker value={newSection.assetId} onChange={(v) => setNewSection((p) => ({ ...p, assetId: v }))}
              placeholder="Any asset"
              options={ASSETS.map((a) => ({ value: a.asset_id, label: `${a.asset_name} — ${a.asset_code}` }))} />
          </Field>
          <div style={styles.dialogActions}>
            <Action onClick={() => setSectionDialog(false)}>Cancel</Action>
            <Action primary onClick={addSection}>Add Section</Action>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(itemDialog)} width={760}
        title={itemDialog?.item ? 'Edit Inspection Item' : 'Add Inspection Item'}
        onClose={() => setItemDialog(null)}>
        <ItemForm form={itemForm} setForm={setItemForm} isEdit={Boolean(itemDialog?.item)}
          onCancel={() => setItemDialog(null)} onSave={saveItem} />
      </Modal>
    </div>
  )
}

const pause = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'checklist'

const fmtTime = (iso) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** The product's gradient Generate button, with its own shine and its tooltip. */
function GenerateButton({ onClick, disabled, ready, missing }) {
  const [tip, setTip] = useState(false)
  return (
    <span style={{ position: 'relative' }}
      onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)}>
      <button type="button" onClick={() => (ready && !disabled ? onClick() : setTip(true))}
        style={{ ...styles.generate, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'default' : 'pointer' }}>
        <span style={styles.shine} />
        <Mark name="sparkle" size={14} color="#fff" />
        <span style={{ position: 'relative' }}>Generate</span>
      </button>
      {tip && (
        <span style={styles.tooltip}>
          {isConfigured()
            ? `Let ${GENERATOR_NAME} draft this checklist. Give it a name and a description and it will take it from there.`
            : 'Draft this checklist from the site\'s own procedures. Give it a name and a description first — '
              + 'no generation service is configured for this deployment, so the steps come from procedures this site already works to.'}
          {missing.length > 0 && (
            <span style={styles.tooltipMissing}>
              <span style={styles.tooltipMissingHead}>Missing</span>
              {missing.map((m) => <span key={m}>· {m}</span>)}
            </span>
          )}
        </span>
      )}
      <style>{'@keyframes oxShine{from{transform:translateX(-110%)}to{transform:translateX(210%)}}'}</style>
    </span>
  )
}

/** The full-screen loader the product shows while a generation runs. */
function Loader({ onCancel, configured }) {
  return (
    <div style={styles.loaderVeil}>
      <div style={styles.loaderCard}>
        <button onClick={onCancel} aria-label="Cancel generation" style={styles.loaderClose}>
          <Mark name="x" size={15} color={SUB} />
        </button>
        <span style={styles.loaderOrb}><Mark name="brain" size={28} color="#fff" /></span>
        <h3 style={styles.loaderTitle}>{configured ? `${GENERATOR_NAME} Processing` : 'Assembling your checklist'}</h3>
        <p style={styles.loaderSub}>
          {configured ? 'Generating your inspection checklist' : 'Reading this site\'s procedures for matching steps'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '24px 0' }}>
          {/* The product's own three steps, verbatim, with its icons and its
              0.8s stagger — each one brightens in turn rather than all three
              pulsing together, which is what makes it read as progress. */}
          {['Analyzing requirements', 'Building checklist structure', 'Finalizing details'].map((s, i) => (
            <span key={s} style={{ ...styles.loaderStep, animationDelay: `${i * 0.8}s` }}>
              <span style={styles.loaderStepIcon}>
                <Glyph name={['cpu', 'cog', 'zap'][i]} size={16} color="#4a52f5" />
              </span>
              {s}
            </span>
          ))}
        </div>
        <div style={styles.loaderTrack}><span style={styles.loaderBar} /></div>
        <p style={styles.loaderWait}>Please wait while we process your request</p>
        {configured && <p style={styles.loaderFoot}>Powered by {GENERATOR_NAME}</p>}
      </div>
      <style>{'@keyframes oxSlide{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}@keyframes oxPulse{0%,100%{opacity:.4}50%{opacity:1}}@keyframes oxOrb{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}'}</style>
    </div>
  )
}

/**
 * The banner shown after a run.
 *
 * It says which of the two happened. The product's version says "Powered by
 * Synapse AI" unconditionally; this one only says that when a model actually
 * answered, and otherwise names the procedures the steps came from.
 */
function ResultBanner({ banner, onDismiss }) {
  const t = banner.generated ? TONE.violet : TONE.blue
  return (
    <div style={{ ...styles.banner, background: t.bg, borderColor: t.bd }}>
      <Mark name="sparkle" size={17} color={t.fg} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ ...styles.bannerTitle, color: t.fg }}>
          {banner.generated ? 'Checklist Generated Successfully' : 'Draft assembled from site procedures'}
        </span>
        <Pill tone="amber">Review Recommended</Pill>
        <p style={styles.bannerBody}>{banner.note}</p>
        {banner.generated && (
          <p style={styles.bannerBody}>Powered by <strong style={{ color: INK }}>{GENERATOR_NAME}</strong></p>
        )}
        {banner.sources?.length > 0 && (
          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {banner.sources.map((s) => <Pill key={s.id} tone="slate">{s.standard}</Pill>)}
          </span>
        )}
      </span>
      <IconButton icon="x" title="Dismiss" onClick={onDismiss} />
    </div>
  )
}

function DerivedSetting({ label, what, on }) {
  return (
    <div style={styles.derived}>
      <span style={{ minWidth: 0 }}>
        <span style={styles.derivedLabel}>{label}</span>
        <span style={styles.derivedWhat}>{what}</span>
      </span>
      <Pill tone={on ? 'amber' : 'slate'}>{on ? 'Yes' : 'No'}</Pill>
    </div>
  )
}

// ── the builder ────────────────────────────────────────────────────────────

function SectionBlock({
  section, index, dragging, onDragStart, onDragEnd, onDropSection,
  onRename, onToggle, onDelete, onAddItem, onAddSubSection, onRenameSub, onDeleteSub,
  onEditItem, onDeleteItem, onMoveItem, onDropIntoContainer,
}) {
  const room = SITES.find((x) => x.site_id === section.siteId)
  const count = section.items.length + section.subSections.reduce((n, ss) => n + ss.items.length, 0)

  const handleDrop = (e) => {
    const payload = read(e)
    if (!payload) return
    e.preventDefault()
    e.stopPropagation()
    if (payload.kind === 'section') onDropSection(index)
    else if (!e.target.closest('[data-item]')) onDropIntoContainer(payload.containerId, payload.index, section.id)
  }

  return (
    <div data-container={section.id}
      style={{ ...styles.section, opacity: dragging ? 0.5 : 1 }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}>
      <div style={styles.sectionHead}>
        <span draggable onDragStart={(e) => { write(e, { kind: 'section', index }); onDragStart() }} onDragEnd={onDragEnd}
          title="Drag to reorder section" style={styles.grip}>
          <Mark name="grip" size={15} color={MUTE} />
        </span>
        <IconButton icon={section.isExpanded ? 'chevronDown' : 'chevronRight'} title="Expand section" onClick={onToggle} />
        <input value={section.name} onChange={(e) => onRename(e.target.value)}
          aria-label="Section name" placeholder="Enter section name…" style={styles.sectionName} />
        {room && <Pill tone="slate">{room.site_name}</Pill>}
        {section.assetId && <Pill tone="slate">{section.assetId}</Pill>}
        {/* Amber, as the product draws it — the count is the one thing on this
            header that changes as you build, so it is the one thing marked. */}
        <span style={styles.countPill}>{count} item{count === 1 ? '' : 's'}</span>
        <IconButton icon="layers" title="Add sub-section" tone="#7c3aed" onClick={onAddSubSection} />
        <IconButton icon="plus" title="Add item" onClick={() => onAddItem(section.id)} />
        <IconButton icon="trash" title="Delete section" tone="#dc2626" onClick={onDelete} />
      </div>

      {section.isExpanded && (
        <div style={styles.sectionBody}>
          {section.items.length > 1 && (
            <p style={styles.dragHint}>Drag items to reorder them, or to move them between sections.</p>
          )}

          {section.items.map((item, i) => (
            <ItemRow key={item.id} item={item} index={i} containerId={section.id}
              onEdit={() => onEditItem(item)} onDelete={() => onDeleteItem(item.id)} onMove={onMoveItem}
              onAddAfter={onAddItem} />
          ))}

          {!section.items.length && !section.subSections.length && (
            <div style={styles.sectionEmpty}>
              <p style={{ margin: '0 0 10px', fontSize: 12.5, color: MUTE }}>No items in this section</p>
              <Action icon="clipboard" onClick={() => onAddItem(section.id)}>Add First Item</Action>
            </div>
          )}

          {section.subSections.map((ss) => (
            <SubSectionBlock key={ss.id} subSection={ss}
              onRename={(name) => onRenameSub(ss.id, { name })}
              onToggle={() => onRenameSub(ss.id, { isExpanded: !ss.isExpanded })}
              onDelete={() => onDeleteSub(ss.id)}
              onAddItem={onAddItem} onEditItem={onEditItem} onDeleteItem={onDeleteItem}
              onMoveItem={onMoveItem} onDropIntoContainer={onDropIntoContainer} />
          ))}
        </div>
      )}
    </div>
  )
}

function SubSectionBlock({ subSection, onRename, onToggle, onDelete, onAddItem, onEditItem, onDeleteItem, onMoveItem, onDropIntoContainer }) {
  return (
    <div data-container={subSection.id} style={styles.subSection}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const payload = read(e)
        if (!payload || payload.kind !== 'item') return
        if (e.target.closest('[data-item]')) return
        e.preventDefault()
        e.stopPropagation()
        onDropIntoContainer(payload.containerId, payload.index, subSection.id)
      }}>
      <div style={styles.subHead}>
        <Mark name="layers" size={14} color="#7c3aed" />
        <IconButton icon={subSection.isExpanded ? 'chevronDown' : 'chevronRight'} title="Expand sub-section" onClick={onToggle} />
        <input value={subSection.name} onChange={(e) => onRename(e.target.value)}
          aria-label="Sub-section name" placeholder={HINT.subSectionName || 'e.g. Probe and traverse'} style={styles.subName} />
        <Pill tone="slate">{subSection.items.length} item{subSection.items.length === 1 ? '' : 's'}</Pill>
        <IconButton icon="plus" title="Add item" onClick={() => onAddItem(subSection.id)} />
        <IconButton icon="trash" title="Delete sub-section" tone="#dc2626" onClick={onDelete} />
      </div>

      {subSection.isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '11px 12px' }}>
          {subSection.items.map((item, i) => (
            <ItemRow key={item.id} item={item} index={i} containerId={subSection.id}
              onEdit={() => onEditItem(item)} onDelete={() => onDeleteItem(item.id)} onMove={onMoveItem}
              onAddAfter={onAddItem} />
          ))}
          {!subSection.items.length && (
            <div style={styles.sectionEmpty}>
              <p style={{ margin: '0 0 10px', fontSize: 12.5, color: MUTE }}>No items in this sub-section</p>
              <Action icon="clipboard" onClick={() => onAddItem(subSection.id)}>Add First Item</Action>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ItemRow({ item, index, containerId, onEdit, onDelete, onMove, onAddAfter }) {
  const [over, setOver] = useState(false)
  const type = RESPONSE_TYPES.find((r) => r.value === item.responseType) || RESPONSE_TYPES[0]

  return (
    <div data-item={item.id}
      style={{ ...styles.item, borderColor: over ? '#93c5fd' : LINE, background: over ? '#eff6ff' : '#f8fafc' }}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false)
        const payload = read(e)
        if (!payload || payload.kind !== 'item') return
        e.preventDefault()
        e.stopPropagation()
        onMove(payload.containerId, containerId, payload.index, index)
      }}>
      <span draggable onDragStart={(e) => write(e, { kind: 'item', containerId, index, id: item.id })}
        title="Drag to reorder item" style={styles.grip}>
        <Mark name="grip" size={15} color={MUTE} />
      </span>

      {/* The product stacks an item: description, then its badges on their own
          row, then the type and capture line. Ours had the badges out on the
          right beside the buttons, which put "Critical" in the same column as
          Delete and made a generated checklist read differently here than it
          does in the product — the same JSON laid out two ways. */}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={styles.itemText}>{item.description}</span>
        {item.instruction && <span style={styles.itemInstruction}>{item.instruction}</span>}

        {(item.required !== false || item.critical) && (
          <span style={styles.itemBadges}>
            {item.required !== false && <span style={styles.badgeRequired}>Required</span>}
            {item.critical && <span style={styles.badgeCritical}>Critical</span>}
          </span>
        )}

        {/* The capture line the product draws under an item: its response type
            in grey, then whatever it also has to collect, each in its own
            colour. These are not decoration — a technician reads this line to
            know what the item will ask them for before they start. */}
        <span style={styles.itemMeta}>
          <span style={styles.itemFeature}>
            <Mark name={type.icon} size={13} color={MUTE} />{type.label}
          </span>
          {(item.unit || item.min || item.max) && (
            <span>{item.min || '—'} to {item.max || '—'}{item.unit ? ` ${item.unit}` : ''}</span>
          )}
          {item.options?.length > 0 && <span>{item.options.length} options</span>}
          {item.requiresPhoto && (
            <span style={{ ...styles.itemFeature, color: '#2563eb' }}>
              <Mark name="camera" size={13} color="#2563eb" />Photo
            </span>
          )}
          {item.requiresComment && (
            <span style={{ ...styles.itemFeature, color: '#059669' }}>
              <Mark name="doc" size={13} color="#059669" />Comment
            </span>
          )}
          {item.requiresSignature && (
            <span style={{ ...styles.itemFeature, color: '#7c3aed' }}>
              <Mark name="pen" size={13} color="#7c3aed" />Signature
            </span>
          )}
        </span>
      </span>

      <span style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexShrink: 0 }}>
        <IconButton icon="plus" title="Add an item after this one" tone="#7c3aed" onClick={() => onAddAfter(containerId)} />
        <IconButton icon="edit" title="Edit item" tone="#2563eb" onClick={onEdit} />
        <IconButton icon="trash" title="Delete item" tone="#b91c1c" onClick={onDelete} />
      </span>
    </div>
  )
}

/** The dialog an item is written in — the product's ItemForm, field for field. */
function ItemForm({ form, setForm, isEdit, onCancel, onSave }) {
  const needsRange = form.type === 'Numeric' || form.type === 'Range'

  // Selection items start with one empty option so the author has somewhere to
  // type; every other type drops the options it is not going to use.
  useEffect(() => {
    if (form.type === 'Selection' && form.options.length === 0) setForm((p) => ({ ...p, options: [''] }))
    if (form.type !== 'Selection' && form.options.length > 0) setForm((p) => ({ ...p, options: [] }))
  }, [form.type, form.options.length, setForm])

  const setOption = (i, v) => setForm((p) => ({ ...p, options: p.options.map((o, n) => (n === i ? v : o)) }))

  return (
    <div style={styles.stack}>
      <Field label="Inspection Item" required>
        <TextInput value={form.description} placeholder={HINT.itemDescription || 'e.g. Gasket seated evenly along its whole line'}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
      </Field>

      <Field label="Type" required hint={RESPONSE_TYPES.find((r) => r.value === form.type)?.what}>
        <Picker value={form.type} onChange={(v) => setForm((p) => ({ ...p, type: v }))}
          options={RESPONSE_TYPES.map((r) => ({ value: r.value, label: r.label }))} />
      </Field>

      <Field label="Instructions">
        <TextArea rows={3} value={form.instruction} placeholder="What the technician has to do, and what good looks like."
          onChange={(e) => setForm((p) => ({ ...p, instruction: e.target.value }))} />
      </Field>

      {form.type === 'Selection' && (
        <div style={styles.stack}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={styles.groupLabel}>Response Options</span>
            <span style={{ marginLeft: 'auto' }}>
              <Action icon="clipboard" disabled={form.options.length >= 5}
                onClick={() => setForm((p) => ({ ...p, options: [...p.options, ''] }))}>Add Option</Action>
            </span>
          </div>
          {form.options.map((o, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <TextInput value={o} placeholder={`Option ${i + 1}`} onChange={(e) => setOption(i, e.target.value)} />
              <IconButton icon="trash" title="Remove option" tone="#dc2626"
                onClick={() => setForm((p) => ({ ...p, options: p.options.filter((_, n) => n !== i) }))} />
            </div>
          ))}
          <p style={styles.note}>Up to five options. These are the choices a technician picks from.</p>
        </div>
      )}

      {needsRange && (
        <div style={styles.stack}>
          <div style={styles.triple}>
            <Field label="Unit">
              <TextInput value={form.unit} maxLength={20} placeholder={HINT.unit || 'e.g. in. wg, µg/L, N·m'}
                onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} />
            </Field>
            <Field label="Acceptable Min">
              <TextInput value={form.min} placeholder="e.g. 0" onChange={(e) => setForm((p) => ({ ...p, min: e.target.value }))} />
            </Field>
            <Field label="Acceptable Max">
              <TextInput value={form.max} placeholder="e.g. 50" onChange={(e) => setForm((p) => ({ ...p, max: e.target.value }))} />
            </Field>
          </div>
          <p style={{ ...styles.note, color: '#b45309', background: '#fffbeb', borderColor: '#fde68a' }}>
            Anything outside the acceptable band is recorded as out of spec.
          </p>
        </div>
      )}

      <span style={styles.groupLabel}>Item Settings</span>
      <div style={styles.stack}>
        <Toggle label="Required" what="This item must be completed"
          checked={form.required} onChange={(v) => setForm((p) => ({ ...p, required: v }))} />
        <Toggle label="Critical Item" what="Failure here fails the checklist"
          checked={form.critical} onChange={(v) => setForm((p) => ({ ...p, critical: v }))} />
        <Toggle label="Requires Photo" what="A photo has to be captured against this item"
          checked={form.requiresPhoto} onChange={(v) => setForm((p) => ({ ...p, requiresPhoto: v }))} />
        <Toggle label="Requires Comment" what="A written note has to be entered against this item"
          checked={form.requiresComment} onChange={(v) => setForm((p) => ({ ...p, requiresComment: v }))} />
        <Toggle label="Requires Signature" what="The technician signs this item"
          checked={form.requiresSignature} onChange={(v) => setForm((p) => ({ ...p, requiresSignature: v }))} />
      </div>

      <div style={styles.dialogActions}>
        <Action onClick={onCancel}>Cancel</Action>
        <Action icon="check" primary onClick={onSave}>{isEdit ? 'Update Item' : 'Save Item'}</Action>
      </div>
    </div>
  )
}

// Drag payloads travel as JSON on the dataTransfer, the way the product moves
// them. Read defensively — a drag from outside the builder carries something
// else entirely and must not throw on the way past.
const write = (e, payload) => {
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('application/json', JSON.stringify(payload))
}

const read = (e) => {
  try {
    const raw = e.dataTransfer.getData('application/json')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const styles = {
  columns: { display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(280px,1fr)', gap: 18, alignItems: 'start' },
  stack: { display: 'flex', flexDirection: 'column', gap: 13 },
  pair: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 13 },
  triple: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 13 },
  // Two equal selects and then whatever Generate needs. `auto` on the last
  // track rather than a third equal column, so the button keeps its own width
  // and does not stretch across a third of the card.
  trio: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) auto', gap: 13, alignItems: 'end' },
  // Matches the height of a field so the button's baseline sits on the selects'
  // rather than on the labels above them.
  generateSlot: { display: 'flex', alignItems: 'flex-end', minWidth: 0 },
  discard: {
    background: 'none', border: 'none', padding: '8px 4px', cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: ACCENT,
  },
  groupLabel: { fontSize: 12, fontWeight: 700, color: SUB },
  note: {
    margin: 0, padding: '8px 11px', fontSize: 11.5, color: MUTE, lineHeight: 1.5,
    background: '#f8fafc', borderRadius: 8, borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },

  draftAt: { fontSize: 11.5, color: MUTE },

  poweredChip: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px',
    fontSize: 11, fontWeight: 600, color: SUB, background: '#f8fafc',
    borderRadius: 999, borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },

  generate: {
    position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '10px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
    color: '#fff', border: 'none', borderRadius: 9, overflow: 'hidden',
    background: 'linear-gradient(to right,#4a52f5,#f58b00)', whiteSpace: 'nowrap',
  },
  shine: {
    position: 'absolute', inset: 0,
    background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.32),transparent)',
    animation: 'oxShine 2s linear infinite',
  },
  tooltip: {
    position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 30, width: 300,
    display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px',
    fontSize: 11.5, lineHeight: 1.5, color: '#e2e8f0', background: '#0f172a',
    borderRadius: 10, boxShadow: '0 12px 30px rgba(15,23,42,.28)',
  },
  tooltipMissing: { display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 8, borderTop: '1px solid #334155' },
  tooltipMissingHead: { fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: '#94a3b8' },

  loaderVeil: {
    // Above the sidebar and the sticky top bar. See Z in productKit.
    position: 'fixed', inset: 0, zIndex: Z.modal, display: 'grid', placeItems: 'center',
    background: 'rgba(15,23,42,.42)', backdropFilter: 'blur(3px)', padding: 16,
  },
  // The product's card: max-w-md, p-8, rounded-xl, a hairline border over the
  // blur. Sized in the same figures rather than approximated, because this
  // panel is the one screen a reviewer watches for four seconds with nothing
  // else to look at.
  loaderCard: {
    position: 'relative', width: '100%', maxWidth: 448, padding: 32,
    background: 'rgba(255,255,255,.95)', borderRadius: 12, textAlign: 'center',
    boxShadow: '0 25px 50px -12px rgba(15,23,42,.25)',
    borderStyle: 'solid', borderWidth: 1, borderColor: 'rgba(226,232,240,.6)',
  },
  loaderClose: {
    position: 'absolute', top: 12, right: 12, width: 30, height: 30, display: 'grid',
    placeItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
  },
  // primary[600] → primary[700] off the product's own theme, at its 16x16.
  // The portal's navy is primary[900]; using it here made the orb read almost
  // black beside the indigo the product shows.
  loaderOrb: {
    width: 64, height: 64, borderRadius: 999, display: 'grid', placeItems: 'center',
    margin: '0 auto 24px', background: 'linear-gradient(135deg,#4a52f5,#3640d8)',
    boxShadow: '0 20px 25px -5px rgba(21,34,122,.3), 0 10px 10px -5px rgba(21,34,122,.2)',
    animation: 'oxOrb 2s ease-in-out infinite',
  },
  loaderTitle: { margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b', letterSpacing: '-0.01em' },
  loaderSub: { margin: '8px 0 0', fontSize: 14, fontWeight: 500, color: '#475569' },
  loaderStep: {
    display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, fontWeight: 500,
    color: '#475569', textAlign: 'left', animation: 'oxPulse 4s ease-in-out infinite',
  },
  // primary[50] behind primary[600], the product's pairing.
  loaderStepIcon: {
    width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center',
    background: '#f0f2ff', boxShadow: '0 1px 2px rgba(15,23,42,.05)',
  },
  loaderTrack: { height: 6, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' },
  // primary[500] → secondary[500]. The orange half is the product's second
  // brand colour, and it is what makes this bar recognisable at a glance.
  loaderBar: {
    display: 'block', height: '100%', width: '100%', borderRadius: 999,
    background: 'linear-gradient(90deg,#6b73ff,#f58b00)', animation: 'oxSlide 2.5s ease-in-out infinite',
  },
  loaderWait: { margin: '16px 0 0', fontSize: 14, color: '#64748b' },
  loaderFoot: { margin: '4px 0 0', fontSize: 12, color: '#94a3b8' },

  banner: {
    display: 'flex', alignItems: 'flex-start', gap: 11, padding: '13px 14px',
    borderRadius: 12, borderStyle: 'solid', borderWidth: 1, marginBottom: 14,
  },
  bannerTitle: { display: 'inline-block', fontSize: 13, fontWeight: 700, marginRight: 8 },
  bannerBody: { margin: '7px 0 0', fontSize: 12, color: SUB, lineHeight: 1.55 },

  summaryRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' },
  summaryKey: { flex: 1, minWidth: 0, fontSize: 12.5, color: SUB },
  summaryVal: { fontSize: 13.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' },

  derived: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
    borderRadius: 10, borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  derivedLabel: { display: 'block', fontSize: 12.5, fontWeight: 700, color: INK },
  derivedWhat: { display: 'block', fontSize: 11, color: MUTE, marginTop: 2, lineHeight: 1.4 },

  section: {
    borderRadius: 11, background: '#fff', overflow: 'hidden',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  sectionHead: {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    padding: '10px 12px', background: '#f8fafc', borderBottom: `1px solid ${LINE}`,
  },
  sectionName: {
    flex: '1 1 160px', minWidth: 0, padding: '4px 0', fontSize: 13.5, fontWeight: 700,
    color: INK, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'inherit',
  },
  sectionBody: { display: 'flex', flexDirection: 'column', gap: 9, padding: 12 },
  dragHint: {
    margin: 0, padding: '7px 10px', fontSize: 11, color: '#1d4ed8', background: '#eff6ff',
    borderRadius: 8, borderLeft: '2px solid #bfdbfe',
  },
  sectionEmpty: {
    padding: '20px 14px', textAlign: 'center', borderRadius: 10,
    borderStyle: 'dashed', borderWidth: 1, borderColor: '#dbe2ea',
  },

  subSection: {
    borderRadius: 10, background: '#fcfdff', overflow: 'hidden',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  subHead: {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    padding: '8px 11px', background: '#fff', borderBottom: `1px solid ${LINE}`,
  },
  subName: {
    flex: '1 1 140px', minWidth: 0, padding: '5px 8px', fontSize: 12.5, fontWeight: 700,
    color: INK, background: '#fff', borderRadius: 7, outline: 'none', fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },

  item: {
    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 12px',
    borderRadius: 10, borderStyle: 'solid', borderWidth: 1, flexWrap: 'wrap',
  },
  grip: { display: 'flex', padding: 2, cursor: 'grab', flexShrink: 0 },
  // Bigger and heavier than a table cell: on the product's screen the item's
  // words are the thing being written, and everything around them is chrome.
  itemText: { display: 'block', fontSize: 14, fontWeight: 600, color: INK, lineHeight: 1.5 },
  badgeRequired: {
    fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 6,
    color: '#1e40af', background: '#dbeafe',
  },
  // Filled, not outlined. A critical item stops the inspection when it fails,
  // and it is the one badge on this row that changes what happens next.
  badgeCritical: {
    fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 6,
    color: '#fff', background: '#dc2626',
  },
  countPill: {
    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
    color: '#fff', background: '#f59e0b', whiteSpace: 'nowrap',
  },
  itemInstruction: { display: 'block', fontSize: 11.5, color: MUTE, marginTop: 3, lineHeight: 1.5 },
  // Its own row under the description, the way the product stacks them.
  itemBadges: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 },
  itemMeta: { display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 7, fontSize: 11, color: SUB },
  itemFeature: { display: 'inline-flex', alignItems: 'center', gap: 5 },

  dialogActions: { display: 'flex', gap: 9, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 4 },
}
