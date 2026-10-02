'use client'

// Create Inspection Checklist.
//
// The same screen the compliance portal carries, on this estate's data. Its
// shape is the point: a header carrying Save Draft and Save, a two-thirds
// column holding Basic Information above the sections builder, and a third
// column holding Settings, a live Summary and the banner that appears after a
// generation run.
//
// The builder is sections → sub-sections → items, and an item is not a line of
// text — it has a response type, and Numeric and Range items carry a unit and an
// acceptable band. That is the part worth porting properly: "Bearing
// temperature within limits" answered with a tick is a record that proves
// nothing, and the number is what an investigator reads a year later.
//
// ── on generation ─────────────────────────────────────────────────────────
//
// The Generate button, the loader and the banner are the product's, and the
// call behind them is the product's request in lib/generateChecklist.js. What
// the screen will not do is claim a model wrote something a model did not
// write: with no endpoint configured the draft is composed from the client's own
// PM task library and the banner says exactly that, in place of the product's
// "Powered by Synapse AI" line. SOW 2.2 puts that library out of scope for
// change, so its twenty-five tasks are what a site engineer is actually held to
// — an invented step passes a review and fails an audit.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeading from '../components/PageHeading'
import { ProductStyles } from '../components/product'
import { Modal as Dialog, PALETTE } from '../lib/kit'
import {
  Mark, Panel, Field, TextInput, TextArea, Picker, Toggle, IconButton, Action, Pill, TONE,
} from '../lib/checklistKit'
import { useChecklistStore } from '../lib/store'
import { PM_TASKS } from '../lib/data'
import {
  RESPONSE_TYPES, SCORING_METHODS, SCOPE_LEVELS, RUNNABLE_CLASSES, CATEGORIES,
  FREQUENCIES, SITE_OPTIONS, FAILURE_ACTIONS, failureAction,
  categoryFor, criticalityOfClass, codeFor, slug, allItemsOf,
} from '../lib/checklistBuilder'
import { generateChecklist, isConfigured, GENERATOR_NAME } from '../lib/generateChecklist'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

const LIST = '/portal/datacenter/checklists'
const DRAFT_KEY = 'datacenter_checklist_create_draft'
const SEED_KEY = 'datacenter_checklist_seed'

const NAME_MAX = 100
const WORDS_MAX = 500

const emptyForm = () => ({
  checklistName: '',
  description: '',
  standard: '',
  category: '',
  frequency: 'Monthly',
  scopeLevel: 'Equipment',
  classes: [],
  siteId: '',
  scoringMethod: 'Pass_Fail',
  passingScore: 80,
})

const emptyItemForm = () => ({
  text: '',
  type: 'Pass_Fail',
  instruction: '',
  unit: '',
  min: '',
  max: '',
  expectedValue: '',
  failureAction: 'Continue',
  weight: '',
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
const firstSection = () => ([{
  id: 'section-1', name: 'General Condition', isExpanded: true, assetClass: '', items: [], subSections: [],
}])

const stampId = (p) => `${p}-${Date.now()}-${Math.round(Math.random() * 1e6)}`

export default function ChecklistCreate() {
  const router = useRouter()
  const store = useChecklistStore()

  const [form, setForm] = useState(emptyForm)
  const [sections, setSections] = useState(firstSection)

  // Set when the screen was opened on an existing checklist. Editing keeps the
  // id, so the list reads the edit over what it was; duplicating drops it, so
  // the copy is a new checklist rather than a second face of the old one.
  const [editing, setEditing] = useState(null)

  const [hydrated, setHydrated] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState(null)
  const [hasDraft, setHasDraft] = useState(false)

  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [banner, setBanner] = useState(null)
  const abortRef = useRef(null)

  const [sectionDialog, setSectionDialog] = useState(false)
  const [newSection, setNewSection] = useState({ name: '', assetClass: '' })
  const [itemDialog, setItemDialog] = useState(null) // { containerId } | { item }
  const [itemForm, setItemForm] = useState(emptyItemForm)

  const [dragSection, setDragSection] = useState(null)
  const seeded = useRef(false)
  const bottomRef = useRef(null)

  const items = useMemo(() => allItemsOf(sections), [sections])
  const words = form.description.trim() ? form.description.trim().split(/\s+/).length : 0
  const requiresPhotos = items.some((i) => i.requiresPhoto)
  const requiresSignature = items.some((i) => i.requiresSignature)

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
    if (seeded.current) return
    seeded.current = true

    let seed = null
    try {
      const raw = window.sessionStorage.getItem(SEED_KEY)
      if (raw) {
        seed = JSON.parse(raw)
        window.sessionStorage.removeItem(SEED_KEY)
      }
    } catch { /* a malformed seed is no seed */ }

    if (seed?.checklist) {
      const c = seed.checklist
      setForm({
        checklistName: seed.mode === 'duplicate' ? `${c.name} (copy)` : c.name || '',
        description: c.description || '',
        standard: c.standard || '',
        category: c.category || '',
        frequency: c.frequency || 'Monthly',
        scopeLevel: c.scopeLevel || 'Equipment',
        classes: c.classes || [],
        siteId: c.siteId || '',
        scoringMethod: c.scoringMethod || 'Pass_Fail',
        passingScore: c.passingScore ?? 80,
      })
      setSections((c.sections || []).length ? (c.sections || []).map(readStoredSection) : firstSection())
      if (seed.mode === 'edit') setEditing(c)
      setHydrated(true)
      return
    }

    try {
      const raw = window.localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const d = JSON.parse(raw)
        if (d?.form) setForm({ ...emptyForm(), ...d.form })
        if (Array.isArray(d?.sections) && d.sections.length) setSections(d.sections)
        if (d?.savedAt) setDraftSavedAt(d.savedAt)
        setHasDraft(true)
      }
    } catch { /* a malformed draft is no draft */ }
    setHydrated(true)
  }, [])

  // ── the draft ────────────────────────────────────────────────────────────
  //
  // Kept current as the author types, so a closed tab is not a lost afternoon.
  // Not written while editing an existing checklist: that draft would come back
  // the next time somebody opened the blank form and quietly overwrite it.
  useEffect(() => {
    if (!hydrated || editing) return
    const blank = !form.checklistName.trim() && !form.description.trim() && !items.length
    if (blank) return
    const t = setTimeout(() => {
      try {
        const savedAt = new Date().toISOString()
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, sections, savedAt }))
        setHasDraft(true)
      } catch { /* storage full or blocked — the form still works */ }
    }, 900)
    return () => clearTimeout(t)
  }, [form, sections, items.length, hydrated, editing])

  const saveDraft = () => {
    try {
      const savedAt = new Date().toISOString()
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, sections, savedAt }))
      setDraftSavedAt(savedAt)
      setHasDraft(true)
      store?.notify('Draft saved.')
    } catch {
      store?.notify('Could not save the draft in this browser.', 'error')
    }
  }

  const discardDraft = () => {
    try { window.localStorage.removeItem(DRAFT_KEY) } catch { /* nothing to remove */ }
    setHasDraft(false)
    setDraftSavedAt(null)
    setForm(emptyForm())
    setSections(firstSection())
    setBanner(null)
    setGenerated(false)
    store?.notify('Draft discarded.')
  }

  // ── validation ───────────────────────────────────────────────────────────

  const clearError = (k) => setErrors((p) => (p[k] ? { ...p, [k]: null } : p))

  const validate = () => {
    const next = {}
    if (!form.checklistName.trim()) next.checklistName = 'Give the checklist a name.'
    if (!form.description.trim()) next.description = 'Say what this checklist is for.'
    if (!form.classes.length) next.classes = 'Name at least one asset class, or it can never be run.'
    if (!items.length) next.items = 'A checklist needs at least one item.'
    setErrors(next)
    return next
  }

  // ── generation ───────────────────────────────────────────────────────────

  const cancelGenerate = () => {
    abortRef.current?.abort()
    setGenerating(false)
  }

  const generate = useCallback(async () => {
    const controller = new AbortController()
    abortRef.current = controller
    setGenerating(true)
    setBanner(null)

    const result = await generateChecklist({
      checklistName: form.checklistName,
      description: form.description,
      classes: form.classes,
    }, controller.signal)

    setGenerating(false)
    abortRef.current = null

    if (result.cancelled) return
    if (!result.ok) {
      store?.notify(result.error || 'Could not draft the checklist.', 'error')
      return
    }
    if (!result.sections?.length) {
      store?.notify('Nothing in the PM library matched that description.', 'error')
      return
    }

    // The product reveals the result section by section and item by item rather
    // than dropping it in whole. That is not decoration: an author watching a
    // list build reads it, and an author handed forty rows at once scrolls past
    // them to the Save button.
    setSections([])
    for (let si = 0; si < result.sections.length; si += 1) {
      const sec = result.sections[si]
      const id = sec.id || `section-${si + 1}`
      // eslint-disable-next-line no-await-in-loop
      await pause(500)
      setSections((prev) => [...prev, {
        ...sec, id, isExpanded: true, items: [],
        subSections: (sec.subSections || []).map((ss) => ({ ...ss, isExpanded: true, items: [] })),
      }])

      for (let ii = 0; ii < (sec.items || []).length; ii += 1) {
        const item = sec.items[ii]
        // eslint-disable-next-line no-await-in-loop
        await pause(220)
        setSections((prev) => prev.map((x) => (x.id === id ? { ...x, items: [...x.items, item] } : x)))
      }

      for (const sub of sec.subSections || []) {
        for (let ii = 0; ii < (sub.items || []).length; ii += 1) {
          const item = sub.items[ii]
          // eslint-disable-next-line no-await-in-loop
          await pause(220)
          setSections((prev) => prev.map((x) => (x.id === id
            ? { ...x, subSections: x.subSections.map((ss) => (ss.id === sub.id ? { ...ss, items: [...ss.items, item] } : ss)) }
            : x)))
        }
      }
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }

    setGenerated(true)
    setBanner({ generated: result.generated, note: result.note, sources: result.sources })

    // Adopt the classes and category the draft was actually built from. A
    // generated checklist carries the asset class on each section, so ticking
    // the class chips again by hand should not be a precondition for saving —
    // an empty Asset Classes field is the commonest reason a freshly generated
    // checklist silently fails to save.
    setForm((p) => {
      const fromSections = [...new Set(result.sections.map((x) => x.assetClass).filter(Boolean))]
      const next = { ...p }
      if (!p.classes.length && fromSections.length) next.classes = fromSections
      if (!p.category) next.category = categoryFor(fromSections.length ? fromSections : p.classes)
      return next
    })
    // Drawn from one class, so that class's standard is this checklist's. Only
    // from one: a draft spanning three classes has three standards behind it
    // and picking the first would put the wrong one on the record.
    if (!form.standard && result.sources?.length === 1) {
      setForm((p) => ({ ...p, standard: result.sources[0].standard }))
    }
  }, [form.checklistName, form.description, form.classes, form.category, form.standard, store])

  // ── sections ─────────────────────────────────────────────────────────────

  const patchSection = (id, patch) =>
    setSections((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  const addSection = () => {
    const name = newSection.name.trim()
    if (!name) { store?.notify('A section needs a name.', 'error'); return }
    setSections((p) => [...p, {
      id: stampId('section'), name, assetClass: newSection.assetClass,
      isExpanded: true, items: [], subSections: [],
    }])
    setNewSection({ name: '', assetClass: '' })
    setSectionDialog(false)
    store?.notify('Section added.')
  }

  const deleteSection = (id) => {
    setSections((p) => (p.length === 1 ? p : p.filter((s) => s.id !== id)))
    if (sections.length === 1) store?.notify('A checklist needs at least one section.', 'error')
  }

  const moveSection = (from, to) => {
    if (from == null || to == null || from === to) return
    setSections((p) => {
      const next = [...p]
      const [row] = next.splice(from, 1)
      next.splice(to, 0, row)
      return next
    })
  }

  const addSubSection = (sectionId) => setSections((p) => p.map((s) => (s.id === sectionId
    ? { ...s, subSections: [...s.subSections, { id: stampId('sub'), name: 'Sub-section', instruction: '', isExpanded: true, items: [] }] }
    : s)))

  const patchSubSection = (subId, patch) => setSections((p) => p.map((s) => ({
    ...s, subSections: s.subSections.map((ss) => (ss.id === subId ? { ...ss, ...patch } : ss)),
  })))

  const deleteSubSection = (subId) => setSections((p) => p.map((s) => ({
    ...s, subSections: s.subSections.filter((ss) => ss.id !== subId),
  })))

  // ── items ────────────────────────────────────────────────────────────────

  const openAddItem = (containerId) => {
    setItemForm(emptyItemForm())
    setItemDialog({ containerId })
  }

  const openEditItem = (item) => {
    setItemForm({
      text: item.text || '',
      type: item.responseType || 'Pass_Fail',
      instruction: item.instruction || '',
      unit: item.unit || '',
      min: item.min || '',
      max: item.max || '',
      expectedValue: item.expectedValue || '',
      failureAction: item.failureAction || 'Continue',
      weight: item.weight || '',
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
    if (!itemForm.text.trim()) {
      store?.notify('An item needs a description.', 'error')
      return
    }
    if (itemForm.type === 'Selection' && itemForm.options.filter((o) => o.trim()).length === 0) {
      store?.notify('A Selection item needs at least one response option.', 'error')
      return
    }

    const shaped = {
      responseType: itemForm.type,
      text: itemForm.text.trim(),
      instruction: itemForm.instruction.trim(),
      unit: itemForm.unit.trim(),
      min: itemForm.min.trim(),
      max: itemForm.max.trim(),
      expectedValue: itemForm.expectedValue.trim(),
      failureAction: itemForm.failureAction,
      weight: itemForm.weight.trim(),
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
      const target = itemDialog.containerId
      const item = { id: stampId('item'), containerId: target, itemNumber: '', sequence: 0, ...shaped }
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
    clearError('items')
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
   * index is read against the list as it will be, not as it was.
   */
  const moveItem = (fromContainer, toContainer, fromIndex, toIndex) => {
    setSections((p) => {
      let moving = null
      const lift = (list, containerId) => {
        if (containerId !== fromContainer) return list
        const next = [...list]
        moving = next.splice(fromIndex, 1)[0]
        return next
      }
      const drop = (list, containerId) => {
        if (containerId !== toContainer || !moving) return list
        const next = [...list]
        next.splice(Math.min(toIndex, next.length), 0, { ...moving, containerId })
        return next
      }
      const lifted = p.map((s) => ({
        ...s,
        items: lift(s.items, s.id),
        subSections: s.subSections.map((ss) => ({ ...ss, items: lift(ss.items, ss.id) })),
      }))
      if (!moving) return p
      return lifted.map((s) => ({
        ...s,
        items: drop(s.items, s.id),
        subSections: s.subSections.map((ss) => ({ ...ss, items: drop(ss.items, ss.id) })),
      }))
    })
  }

  const dropIntoContainer = (fromContainer, fromIndex, toContainer) =>
    moveItem(fromContainer, toContainer, fromIndex, Number.MAX_SAFE_INTEGER)

  // ── classes ──────────────────────────────────────────────────────────────

  // Picking a class also sets the category, until the author sets one
  // themselves. The register already knows a CRAH is mechanical plant, and a
  // checklist filed under the wrong category is a checklist nobody finds.
  const pickClass = (className) => {
    setForm((f) => {
      const on = f.classes.includes(className)
      const classes = on ? f.classes.filter((x) => x !== className) : [...f.classes, className]
      return { ...f, classes, category: f.category || categoryFor(classes) }
    })
    clearError('classes')
  }

  const libraryCount = useMemo(
    () => PM_TASKS.filter((t) => form.classes.includes(t.assetClass)).length,
    [form.classes])

  // ── save ─────────────────────────────────────────────────────────────────

  const save = async () => {
    const errs = validate()
    if (Object.keys(errs).length) {
      // A Save that silently does nothing reads as broken — the failing field is
      // often below the fold (Asset Classes especially). Say what is missing and
      // bring the top of the form, where those fields live, back into view.
      const label = { checklistName: 'a name', description: 'a description', classes: 'an asset class', items: 'an item' }
      store?.notify(`Not saved yet — still needs ${Object.keys(errs).map((k) => label[k]).join(', ')}.`, 'error')
      if (errs.items) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      else window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const category = form.category || categoryFor(form.classes)
    const id = editing?.checklistId || `CHK-${slug(form.checklistName).toUpperCase().slice(0, 14)}`
    const today = new Date().toISOString().slice(0, 10)

    let n = 0
    const stamp = (item, containerId, i) => ({
      ...item,
      itemId: item.id,
      containerId,
      itemNumber: String((n += 1)),
      sequence: n,
      // Written alongside the item's own value so an item drafted from the
      // library keeps the standard it was worked to, and one typed by hand
      // falls back to the checklist's.
      standard: item.standard || form.standard.trim() || null,
      frequency: item.frequency || form.frequency,
      _i: i,
    })

    const payload = {
      checklistId: id,
      code: editing?.code || codeFor(form.checklistName, category),
      name: form.checklistName.trim(),
      description: form.description.trim(),
      standard: form.standard.trim() || null,
      category,
      frequency: form.frequency,
      scopeLevel: form.scopeLevel,
      classes: form.classes,
      siteId: form.siteId || null,
      scoringMethod: form.scoringMethod,
      passingScore: Number(form.passingScore) || 0,
      version: editing ? `${Number(editing.version || 1) + 1}` : '1',
      createdOn: editing?.createdOn || today,
      modifiedOn: editing ? today : null,
      generatedBy: banner?.generated ? GENERATOR_NAME : null,
      sources: banner?.sources?.length ? banner.sources : null,
      sections: sections
        .map((s, si) => ({
          id: s.id,
          name: s.name.trim() || `Section ${si + 1}`,
          sequence: si + 1,
          assetClass: s.assetClass || '',
          items: s.items.map((item, i) => stamp(item, s.id, i)),
          subSections: s.subSections.filter((ss) => ss.items.length).map((ss, ssi) => ({
            id: ss.id,
            name: ss.name.trim() || `Sub-section ${ssi + 1}`,
            sequence: ssi + 1,
            instruction: ss.instruction || '',
            items: ss.items.map((item, i) => stamp(item, ss.id, i)),
          })),
        }))
        .filter((s) => s.items.length || s.subSections.length),
    }

    setSaving(true)
    const saved = editing?.recordId
      ? await store.update(editing.recordId, payload)
      : await store.create(payload)
    setSaving(false)

    if (!saved) return
    try { window.localStorage.removeItem(DRAFT_KEY) } catch { /* nothing to remove */ }
    router.push(LIST)
  }

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div>
      <ProductStyles />
      {generating && <Loader onCancel={cancelGenerate} configured={isConfigured()} />}

      <PageHeading
        back={{ label: 'Back', onClick: () => router.push(LIST) }}
        title={editing ? 'Update Inspection Checklist' : 'Create Inspection Checklist'}
        subtitle="Build a comprehensive inspection checklist"
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {draftSavedAt && <span style={styles.draftAt}>Draft saved {fmtTime(draftSavedAt)}</span>}
            {/* A link rather than a button, as in the product — discarding is
                not one of the three things this header is asking you to do. */}
            {hasDraft && !editing && <button onClick={discardDraft} style={styles.discard}>Discard Draft</button>}
            {!editing && <Action onClick={saveDraft}>Save Draft</Action>}
            <Action onClick={() => router.push(LIST)}>Cancel</Action>
            <Action icon="save" primary onClick={save} disabled={saving}>
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
                  placeholder="e.g. CRAH quarterly mechanical round"
                  onChange={(e) => { setForm((p) => ({ ...p, checklistName: e.target.value })); clearError('checklistName') }} />
              </Field>

              <Field label="Description" required error={errors.description}
                hint={`${words}/${WORDS_MAX} words`}>
                <TextArea rows={5} value={form.description} invalid={Boolean(errors.description)}
                  placeholder="Describe the purpose and scope — which plant it covers, what a technician has to establish on each pass, and what a failure means for the hall."
                  onChange={(e) => { setForm((p) => ({ ...p, description: e.target.value })); clearError('description') }} />
              </Field>

              {/* One row, as the product has it: the two selects side by side
                  with Generate at the end of the same line. Splitting it in two
                  pushed every field below half a row down — invisible on its own
                  and obvious the moment the two screens sit side by side. */}
              <div style={styles.trio}>
                <Field label="Category">
                  <Picker value={form.category} onChange={(v) => setForm((p) => ({ ...p, category: v }))}
                    placeholder={form.classes.length ? `Suggested: ${categoryFor(form.classes)}` : 'Select a category'}
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
                <Field label="Scope Level">
                  <Picker value={form.scopeLevel} onChange={(v) => setForm((p) => ({ ...p, scopeLevel: v }))} options={SCOPE_LEVELS} />
                </Field>
                <Field label="Frequency">
                  <Picker value={form.frequency} onChange={(v) => setForm((p) => ({ ...p, frequency: v }))} options={FREQUENCIES} />
                </Field>
              </div>

              <Field label="Site">
                <Picker value={form.siteId} onChange={(v) => setForm((p) => ({ ...p, siteId: v }))}
                  placeholder="Any PoC site" options={SITE_OPTIONS} />
              </Field>

              <Field label="Asset Classes" required error={errors.classes}
                hint={form.classes.length ? `${libraryCount} library tasks available` : ''}>
                <div style={styles.classes}>
                  {RUNNABLE_CLASSES.map((c) => {
                    const on = form.classes.includes(c)
                    return (
                      <button key={c} type="button" onClick={() => pickClass(c)}
                        style={{
                          ...styles.classChip,
                          borderColor: on ? ACCENT : LINE,
                          background: on ? '#eef2ff' : '#fff',
                          color: on ? ACCENT : SUB,
                        }}>
                        {on && <Mark name="check" size={12} color={ACCENT} />}
                        {c}
                        {criticalityOfClass(c) === 'Critical' && <span style={{ color: '#dc2626' }}>•</span>}
                      </button>
                    )
                  })}
                </div>
              </Field>
            </div>
          </Panel>

          <Panel title="Inspection Sections" icon="list"
            right={<Action icon="clipboard" onClick={() => setSectionDialog(true)}>Add Section</Action>}>
            {errors.items && <p style={styles.formError}>{errors.items}</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sections.map((s, si) => (
                <SectionBlock
                  key={s.id}
                  section={s}
                  index={si}
                  dragging={dragSection === si}
                  onDragStart={() => setDragSection(si)}
                  onDragEnd={() => setDragSection(null)}
                  onDropSection={(target) => { moveSection(dragSection, target); setDragSection(null) }}
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
              {/* Not on the product's form, and kept out of the left column so
                  that column matches it field for field. Every task in this
                  client's PM library is written to a standard and the list
                  prints it on every row — a column the list shows and the form
                  cannot set reads as broken, so it lives on this side. */}
              <Field label="Standard or reference">
                <TextInput value={form.standard} placeholder="e.g. ASHRAE TC 9.9, NFPA 110"
                  onChange={(e) => setForm((p) => ({ ...p, standard: e.target.value }))} />
              </Field>
              {form.scoringMethod !== 'None' && (
                <Field label="Passing Score (%)">
                  <TextInput type="number" min="0" max="100" value={form.passingScore}
                    onChange={(e) => setForm((p) => ({ ...p, passingScore: e.target.value }))} />
                </Field>
              )}
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
              ['Asset Classes', form.classes.length],
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

      <Dialog open={sectionDialog} width={480} title="Add New Section" onClose={() => setSectionDialog(false)}>
        <div style={styles.stack}>
          <Field label="Section Name" required>
            <TextInput value={newSection.name} placeholder="e.g. Filter bank"
              onChange={(e) => setNewSection((p) => ({ ...p, name: e.target.value }))} />
          </Field>
          <Field label="Asset Class" hint="Optional — narrows the section to one class">
            <Picker value={newSection.assetClass} onChange={(v) => setNewSection((p) => ({ ...p, assetClass: v }))}
              placeholder="Any class this checklist covers" options={RUNNABLE_CLASSES} />
          </Field>
          <div style={styles.dialogActions}>
            <Action onClick={() => setSectionDialog(false)}>Cancel</Action>
            <Action primary onClick={addSection}>Add Section</Action>
          </div>
        </div>
      </Dialog>

      <Dialog open={Boolean(itemDialog)} width={760}
        title={itemDialog?.item ? 'Edit Inspection Item' : 'Add Inspection Item'}
        onClose={() => setItemDialog(null)}>
        <ItemForm form={itemForm} setForm={setItemForm} isEdit={Boolean(itemDialog?.item)}
          onCancel={() => setItemDialog(null)} onSave={saveItem} />
      </Dialog>
    </div>
  )
}

/** A stored section, read back for editing. Older records carry no sub-sections. */
function readStoredSection(s, i) {
  return {
    id: s.id || `section-${i + 1}`,
    name: s.name || `Section ${i + 1}`,
    assetClass: s.assetClass || '',
    isExpanded: true,
    items: (s.items || []).map((it, n) => ({ ...it, id: it.id || it.itemId || `s${i}-i${n}`, options: it.options || [] })),
    subSections: (s.subSections || []).map((ss, n) => ({
      ...ss,
      id: ss.id || `s${i}-ss${n}`,
      isExpanded: true,
      items: (ss.items || []).map((it, m) => ({ ...it, id: it.id || it.itemId || `s${i}-ss${n}-i${m}`, options: it.options || [] })),
    })),
  }
}

const pause = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

// Locale named explicitly, the way the registers name theirs. It only renders
// after a draft has been saved, so it never reaches the server today — but an
// unpinned `toLocaleString` formats in whichever locale the browser is set to,
// and the day it does render on both sides that is a hydration mismatch that
// only appears on someone else's machine.
const fmtTime = (iso) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
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
            : 'Draft this checklist from the client\'s own PM task library. Give it a name and a description first — '
              + 'no generation service is configured for this deployment, so every line comes from a task this estate '
              + 'already maintains to.'}
          {missing.length > 0 && (
            <span style={styles.tooltipMissing}>
              <span style={styles.tooltipMissingHead}>Missing</span>
              {missing.map((m) => <span key={m}>· {m}</span>)}
            </span>
          )}
        </span>
      )}
      <style>{'@keyframes dcShine{from{transform:translateX(-110%)}to{transform:translateX(210%)}}'}</style>
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
          {configured ? 'Generating your inspection checklist' : 'Reading the client\'s PM library for matching tasks'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '24px 0' }}>
          {/* The product's own three steps, verbatim, with its icons and its
              0.8s stagger — each one brightens in turn rather than all three
              pulsing together, which is what makes it read as progress. */}
          {['Analyzing requirements', 'Building checklist structure', 'Finalizing details'].map((s, i) => (
            <span key={s} style={{ ...styles.loaderStep, animationDelay: `${i * 0.8}s` }}>
              <span style={styles.loaderStepIcon}>
                <Mark name={['cpu', 'cog', 'zap'][i]} size={16} color="#4a52f5" />
              </span>
              {s}
            </span>
          ))}
        </div>
        <div style={styles.loaderTrack}><span style={styles.loaderBar} /></div>
        <p style={styles.loaderWait}>Please wait while we process your request</p>
        {configured && <p style={styles.loaderFoot}>Powered by {GENERATOR_NAME}</p>}
      </div>
      <style>{'@keyframes dcSlide{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}@keyframes dcPulse{0%,100%{opacity:.4}50%{opacity:1}}@keyframes dcOrb{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}'}</style>
    </div>
  )
}

/**
 * The banner shown after a run.
 *
 * It says which of the two happened. The product's version says "Powered by
 * Synapse AI" unconditionally; this one only says that when a model actually
 * answered, and otherwise names the asset classes the tasks came from.
 */
function ResultBanner({ banner, onDismiss }) {
  const t = banner.generated ? TONE.violet : TONE.blue
  return (
    <div style={{ ...styles.banner, background: t.bg, borderColor: t.bd }}>
      <Mark name="sparkle" size={17} color={t.fg} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ ...styles.bannerTitle, color: t.fg }}>
          {banner.generated ? 'Checklist Generated Successfully' : 'Draft assembled from the PM library'}
        </span>
        <Pill tone="amber">Review Recommended</Pill>
        <p style={styles.bannerBody}>{banner.note}</p>
        {banner.generated && (
          <p style={styles.bannerBody}>Powered by <strong style={{ color: INK }}>{GENERATOR_NAME}</strong></p>
        )}
        {banner.sources?.length > 0 && (
          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {banner.sources.map((s) => <Pill key={s.id} tone="slate">{s.name}</Pill>)}
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
        {section.assetClass && <Pill tone="slate">{section.assetClass}</Pill>}
        <Pill tone="slate">{count} item{count === 1 ? '' : 's'}</Pill>
        <IconButton icon="layers" title="Add sub-section" tone="#7c3aed" onClick={onAddSubSection} />
        <IconButton icon="plus" title="Add item" onClick={() => onAddItem(section.id)} />
        <IconButton icon="trash" title="Delete section" tone="#b91c1c" onClick={onDelete} />
      </div>

      {section.isExpanded && (
        <div style={styles.sectionBody}>
          {section.items.length > 1 && (
            <p style={styles.dragHint}>Drag items to reorder them, or to move them between sections.</p>
          )}

          {section.items.map((item, i) => (
            <ItemRow key={item.id} item={item} index={i} containerId={section.id}
              onEdit={() => onEditItem(item)} onDelete={() => onDeleteItem(item.id)} onMove={onMoveItem} />
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
          aria-label="Sub-section name" placeholder="e.g. Belt and drive" style={styles.subName} />
        <Pill tone="slate">{subSection.items.length} item{subSection.items.length === 1 ? '' : 's'}</Pill>
        <IconButton icon="plus" title="Add item" onClick={() => onAddItem(subSection.id)} />
        <IconButton icon="trash" title="Delete sub-section" tone="#b91c1c" onClick={onDelete} />
      </div>

      {subSection.isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '11px 12px' }}>
          {subSection.items.map((item, i) => (
            <ItemRow key={item.id} item={item} index={i} containerId={subSection.id}
              onEdit={() => onEditItem(item)} onDelete={() => onDeleteItem(item.id)} onMove={onMoveItem} />
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

function ItemRow({ item, index, containerId, onEdit, onDelete, onMove }) {
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
          row, then the type and capture line. Badges out on the right put
          "Critical" in the same column as Delete, which makes the same JSON
          read differently here than it does in the product. */}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={styles.itemText}>{item.text}</span>
        {item.instruction && <span style={styles.itemInstruction}>{item.instruction}</span>}

        {(item.required !== false || item.critical) && (
          <span style={styles.itemBadges}>
            {item.required !== false && <Pill tone="slate">Required</Pill>}
            {item.critical && <Pill tone="red">Critical</Pill>}
          </span>
        )}

        <span style={styles.itemMeta}>
          <span style={styles.itemFeature}>
            <Mark name={type.icon} size={12} color={SUB} />{type.label}
          </span>
          {(item.unit || item.min || item.max) && (
            <span>{item.min || '—'} to {item.max || '—'}{item.unit ? ` ${item.unit}` : ''}</span>
          )}
          {item.expectedValue && <span>expects {item.expectedValue}</span>}
          {item.options?.length > 0 && <span>{item.options.length} options</span>}
          {item.failureAction && item.failureAction !== 'Continue' && (
            <span style={{ ...styles.itemFeature, color: TONE.amber.fg }}>
              {failureAction(item.failureAction).label}
            </span>
          )}
          {item.requiresPhoto && <span style={styles.itemFeature}><Mark name="camera" size={12} color={SUB} />Photo</span>}
          {item.requiresComment && <span style={styles.itemFeature}><Mark name="doc" size={12} color={SUB} />Comment</span>}
          {item.requiresSignature && <span style={styles.itemFeature}><Mark name="pen" size={12} color={SUB} />Signature</span>}
        </span>
      </span>

      <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
        <IconButton icon="edit" title="Edit item" onClick={onEdit} />
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
        <TextInput value={form.text} placeholder="e.g. Filter differential pressure within the design band"
          onChange={(e) => setForm((p) => ({ ...p, text: e.target.value }))} />
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
              <IconButton icon="trash" title="Remove option" tone="#b91c1c"
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
              <TextInput value={form.unit} maxLength={20} placeholder="e.g. Pa, degC, mm/s RMS"
                onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} />
            </Field>
            <Field label="Acceptable Min">
              <TextInput value={form.min} placeholder="e.g. 0" onChange={(e) => setForm((p) => ({ ...p, min: e.target.value }))} />
            </Field>
            <Field label="Acceptable Max">
              <TextInput value={form.max} placeholder="e.g. 4.5" onChange={(e) => setForm((p) => ({ ...p, max: e.target.value }))} />
            </Field>
          </div>
          <p style={{ ...styles.note, color: '#b45309', background: '#fffbeb', borderColor: '#fde68a' }}>
            Anything outside the acceptable band is recorded as out of spec.
          </p>
        </div>
      )}

      <div style={styles.pair}>
        <Field label="Expected value" hint="What a pass looks like">
          <TextInput value={form.expectedValue} maxLength={60}
            placeholder={needsRange ? 'e.g. 45' : 'e.g. PASS, Good Condition'}
            onChange={(e) => setForm((p) => ({ ...p, expectedValue: e.target.value }))} />
        </Field>
        <Field label="Weight" hint="Weighted scoring only">
          <TextInput type="number" min="0" value={form.weight} placeholder="e.g. 8"
            onChange={(e) => setForm((p) => ({ ...p, weight: e.target.value }))} />
        </Field>
      </div>

      <Field label="If this item fails" hint={failureAction(form.failureAction).what}>
        <Picker value={form.failureAction} onChange={(v) => setForm((p) => ({ ...p, failureAction: v }))}
          options={FAILURE_ACTIONS.map((f) => ({ value: f.value, label: f.label }))} />
        <span style={{ display: 'block', fontSize: 10.5, color: MUTE, marginTop: 5, lineHeight: 1.5 }}>
          Recorded against the item and shown to whoever runs the round. Nothing is raised
          automatically — the round is what produces the record.
        </span>
      </Field>

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
  formError: { margin: '0 0 12px', fontSize: 12, fontWeight: 600, color: '#dc2626' },
  draftAt: { fontSize: 11.5, color: MUTE },
  dialogActions: { display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 4 },

  classes: { display: 'flex', flexWrap: 'wrap', gap: 7 },
  classChip: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px',
    fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit', borderRadius: 999,
    borderStyle: 'solid', borderWidth: 1, cursor: 'pointer', textAlign: 'left',
  },

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
    animation: 'dcShine 2.6s linear infinite',
  },
  tooltip: {
    position: 'absolute', bottom: 'calc(100% + 9px)', right: 0, width: 268, zIndex: 20,
    display: 'block', padding: '10px 12px', fontSize: 11.5, lineHeight: 1.5,
    color: '#e2e8f0', background: '#0f172a', borderRadius: 9,
    boxShadow: '0 10px 26px rgba(15,23,42,.28)',
  },
  tooltipMissing: { display: 'flex', flexWrap: 'wrap', gap: '2px 8px', marginTop: 7, color: '#fca5a5' },
  tooltipMissingHead: { fontWeight: 700 },

  loaderVeil: {
    position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(15,23,42,.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  loaderCard: {
    position: 'relative', width: '100%', maxWidth: 400, background: '#fff',
    borderRadius: 16, padding: '30px 28px 24px', textAlign: 'center',
    boxShadow: '0 24px 60px rgba(15,23,42,.3)',
  },
  loaderClose: {
    position: 'absolute', top: 12, right: 12, width: 28, height: 28, padding: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, cursor: 'pointer',
  },
  loaderOrb: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 62, height: 62, borderRadius: 999, marginBottom: 14,
    background: 'linear-gradient(135deg,#4a52f5,#7c3aed)', animation: 'dcOrb 2s ease-in-out infinite',
  },
  loaderTitle: { margin: 0, fontSize: 17, fontWeight: 700, color: INK },
  loaderSub: { margin: '6px 0 0', fontSize: 12.5, color: MUTE },
  loaderStep: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
    fontSize: 12.5, fontWeight: 600, color: INK, textAlign: 'left',
    background: '#f8fafc', borderRadius: 10, animation: 'dcPulse 2.4s ease-in-out infinite',
  },
  loaderStepIcon: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 8, background: '#eef2ff', flexShrink: 0,
  },
  loaderTrack: { height: 4, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' },
  loaderBar: {
    display: 'block', width: '40%', height: '100%', borderRadius: 999,
    background: 'linear-gradient(to right,#4a52f5,#f58b00)', animation: 'dcSlide 1.5s ease-in-out infinite',
  },
  loaderWait: { margin: '12px 0 0', fontSize: 11.5, color: MUTE },
  loaderFoot: { margin: '4px 0 0', fontSize: 11, color: '#7c3aed', fontWeight: 600 },

  banner: {
    display: 'flex', gap: 11, padding: '14px 15px', borderRadius: 12,
    borderStyle: 'solid', borderWidth: 1, marginBottom: 14,
  },
  bannerTitle: { fontSize: 13, fontWeight: 700, marginRight: 8 },
  bannerBody: { margin: '7px 0 0', fontSize: 11.5, color: SUB, lineHeight: 1.55 },

  derived: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, borderRadius: 10,
  },
  derivedLabel: { display: 'block', fontSize: 12.5, fontWeight: 700, color: INK },
  derivedWhat: { display: 'block', fontSize: 11, color: MUTE, marginTop: 2, lineHeight: 1.4 },

  summaryRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '9px 0', borderBottom: `1px solid ${LINE}`,
  },
  summaryKey: { fontSize: 12, color: SUB, fontWeight: 600 },
  summaryVal: { fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' },

  section: {
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, borderRadius: 12,
    background: '#fff', overflow: 'hidden',
  },
  sectionHead: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
    background: '#f8fafc', borderBottom: `1px solid ${LINE}`, flexWrap: 'wrap',
  },
  sectionName: {
    flex: 1, minWidth: 130, padding: '5px 8px', fontSize: 13, fontWeight: 700,
    color: INK, background: 'transparent', border: '1px solid transparent',
    borderRadius: 7, fontFamily: 'inherit', outline: 'none',
  },
  sectionBody: { display: 'flex', flexDirection: 'column', gap: 8, padding: 12 },
  sectionEmpty: {
    padding: '18px 12px', textAlign: 'center', borderRadius: 10,
    borderStyle: 'dashed', borderWidth: 1, borderColor: LINE,
  },
  dragHint: { margin: 0, fontSize: 11, color: MUTE },

  subSection: {
    borderStyle: 'solid', borderWidth: 1, borderColor: '#ddd6fe', borderRadius: 10,
    background: '#fdfdff', overflow: 'hidden',
  },
  subHead: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px',
    background: '#f5f3ff', borderBottom: '1px solid #ede9fe', flexWrap: 'wrap',
  },
  subName: {
    flex: 1, minWidth: 120, padding: '4px 7px', fontSize: 12.5, fontWeight: 700,
    color: INK, background: 'transparent', border: '1px solid transparent',
    borderRadius: 7, fontFamily: 'inherit', outline: 'none',
  },

  item: {
    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 11px',
    borderStyle: 'solid', borderWidth: 1, borderRadius: 10,
  },
  itemText: { display: 'block', fontSize: 12.5, fontWeight: 600, color: INK, lineHeight: 1.45 },
  itemInstruction: { display: 'block', fontSize: 11, color: MUTE, marginTop: 3, lineHeight: 1.45 },
  // Its own row under the description, the way the product stacks them.
  itemBadges: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 },
  itemMeta: {
    display: 'flex', flexWrap: 'wrap', gap: '2px 12px', marginTop: 7,
    fontSize: 10.5, color: SUB, fontWeight: 600,
  },
  itemFeature: { display: 'inline-flex', alignItems: 'center', gap: 5 },
  grip: { display: 'inline-flex', cursor: 'grab', paddingTop: 2, flexShrink: 0 },
}
