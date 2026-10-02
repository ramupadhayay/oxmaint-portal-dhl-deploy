'use client'

// Starting a round, and carrying it out.
//
// The product splits this across two screens — /inspection/report/new sets the
// round up, /inspection/report/new/start conducts it — and this portal has one
// route for both, so they are two phases of one page. The wording, the step
// numbering and the order are the product's: pick what is being inspected, pick
// the checklist, fill in the details, then Start Inspection hands over to the
// runner with its timer, its progress card, its collapsible sections and its
// sticky submit bar.
//
// The runner answers items rather than ticking them. A checklist item in the
// product carries a response type, and "Probe held 25 mm from the filter face"
// wants a number where "Gowning poster is the current revision" wants pass or
// fail — flattening both to a tick throws away the only part an investigator
// later reads. So each type gets its own control, the same set the product
// ships.
//
// Nothing is filed part-done. Every required item has to be answered, every
// required comment written and every required signature given before Submit
// will go — a round filed with three items blank is a record saying the
// procedure was followed when nobody knows whether it was, and that record is
// what an inspection reads.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageHeading, PALETTE } from '../lib/kit'
import { Action, Pill, Glyph, SearchBar } from '../lib/productKit'
import { CLEANROOMS, FILTER_VIEW, USER, fmtDate } from '../lib/data'
import { useStore } from '../lib/store'
import {
  INSPECTION_REPORTS, INSPECTORS, ROUND_TYPES, roundById,
} from '../lib/data/inspections'
import { TEMPLATES, templateById, templateForRound, allItems } from '../lib/checklists'

const { INK, SUB, MUTE, LINE } = PALETTE

const today = () => new Date().toISOString().slice(0, 10)

export default function InspectionCreate() {
  const router = useRouter()
  const params = useSearchParams()
  const store = useStore()

  // Started from a row on the register, or started from nothing. The first
  // carries its cleanroom, its checklist and its assignee already, so the setup
  // steps would be three screens of re-typing what the round already says.
  const existingId = params?.get('round') || null
  const existing = useMemo(() => {
    if (!existingId) return null
    const stored = (store?.records?.hepa_inspection || []).find((r) => r.reportId === existingId)
    const seeded = INSPECTION_REPORTS.find((r) => r.reportId === existingId)
    if (!seeded && !stored) return null
    return { ...(seeded || {}), ...(stored || {}) }
  }, [existingId, store?.records])

  const [phase, setPhase] = useState(existingId ? 'conduct' : 'setup')

  const [form, setForm] = useState(() => ({
    filterId: '',
    cleanroomId: CLEANROOMS[0]?.cleanroomId || '',
    checklistId: '',
    inspector: USER.name,
    date: today(),
    durationMinutes: 45,
    temperature: 20,
    humidity: 45,
    notes: '',
  }))

  // A round opened from the register brings its own subject and checklist with
  // it, so the form is seeded from the record rather than left on its defaults.
  //
  // Once, and only once. `existing` is rebuilt whenever the store's records
  // change — which includes every toast — and re-seeding on each of those would
  // wipe what the technician had typed halfway through the round.
  const seeded = useRef(false)
  useEffect(() => {
    if (!existing || seeded.current) return
    seeded.current = true
    setForm((p) => ({
      ...p,
      filterId: existing.filterId || '',
      cleanroomId: existing.cleanroomId || p.cleanroomId,
      checklistId: existing.checklistId || '',
      inspector: existing.assignee || existing.inspector || p.inspector,
      date: existing.date || p.date,
      durationMinutes: existing.plannedMinutes || p.durationMinutes,
      temperature: existing.temperature ?? p.temperature,
      humidity: existing.humidity ?? p.humidity,
      notes: existing.notes || '',
    }))
    setPhase('conduct')
  }, [existing])

  if (existingId && !existing && store?.ready) {
    return (
      <div>
        <PageHeading
          title="Start New Inspection"
          subtitle={`Nothing on the register carries the reference ${existingId}.`}
          back={{ label: 'Back', onClick: () => router.push('/portal/hepa/inspections') }}
        />
      </div>
    )
  }

  const checklist = form.checklistId ? templateById(form.checklistId) : null

  if (phase === 'conduct') {
    return (
      <Conduct
        router={router}
        store={store}
        existing={existing}
        form={form}
        checklist={checklist || (existing ? templateForRound(existing.roundId) : null)}
        onBack={() => (existingId ? router.push(`/portal/hepa/inspections/${existingId}`) : setPhase('setup'))}
      />
    )
  }

  return <Setup router={router} form={form} setForm={setForm} store={store} onStart={() => setPhase('conduct')} />
}

// ── phase one: setting the round up ───────────────────────────────────────

function Setup({ router, form, setForm, store, onStart }) {
  const [library, setLibrary] = useState('specified')
  const [search, setSearch] = useState('')

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const roomFilters = useMemo(
    () => FILTER_VIEW.filter((f) => f.cleanroomId === form.cleanroomId),
    [form.cleanroomId],
  )
  const room = CLEANROOMS.find((c) => c.cleanroomId === form.cleanroomId) || null
  const filter = form.filterId ? FILTER_VIEW.find((f) => f.filterId === form.filterId) : null

  // The site's own checklists — anything authored or edited here — as against
  // the eight that ship with the product. The product draws the same three
  // tabs, and the distinction is the one a quality lead cares about: a
  // checklist their own site wrote is theirs to change.
  const authored = (store?.records?.hepa_checklist || []).filter((c) => !c.archived)

  const libraries = useMemo(() => {
    // Specified: the checklists that fit what was picked. A filter is a piece
    // of equipment and a room is an area, and offering the gowning audit
    // against a terminal filter is how the wrong record gets raised.
    const level = form.filterId ? ['Equipment'] : ['Area', 'Building']
    return {
      specified: TEMPLATES.filter((t) => level.includes(t.assetLevel)),
      org: authored,
      system: TEMPLATES,
    }
  }, [form.filterId, authored])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (libraries[library] || []).filter((t) => (
      !q || [t.name, t.code, t.assetLevel, t.category].filter(Boolean).join(' ').toLowerCase().includes(q)
    ))
  }, [libraries, library, search])

  const chosen = form.checklistId
    ? (TEMPLATES.find((t) => t.id === form.checklistId) || authored.find((t) => t.id === form.checklistId))
    : null

  const ready = Boolean(form.checklistId && form.inspector && form.date)

  return (
    <div>
      <PageHeading
        title="Start New Inspection"
        subtitle="First select what is being inspected, then choose a checklist, and configure inspection details to begin"
        back={{ label: 'Back', onClick: () => router.push('/portal/hepa/inspections') }}
      />

      <Step n={1} title="Select Asset">
        <div style={styles.grid}>
          <Field label="Location">
            <select value={form.cleanroomId}
              onChange={(e) => { set('cleanroomId', e.target.value); set('filterId', ''); set('checklistId', '') }}
              style={styles.input}>
              {CLEANROOMS.map((c) => (
                <option key={c.cleanroomId} value={c.cleanroomId}>{c.cleanroomId} — {c.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Asset">
            <select value={form.filterId}
              onChange={(e) => { set('filterId', e.target.value); set('checklistId', ''); setLibrary('specified') }}
              style={styles.input}>
              <option value="">The whole room</option>
              {roomFilters.map((f) => (
                <option key={f.filterId} value={f.filterId}>
                  {f.filterId}{f.concern ? ` — ${f.concern}` : ''}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {filter ? (
          <div style={{ ...styles.picked, background: '#ecfdf5', borderColor: '#a7f3d0' }}>
            <Glyph name="check" size={16} color="#059669" />
            <span style={{ minWidth: 0 }}>
              <strong style={styles.pickedName}>{filter.filterId}</strong>
              <span style={styles.pickedSub}>
                {filter.model || 'Terminal filter'} · {filter.cleanroomName} · {filter.isoClass}
                {filter.concern ? ` · ${filter.concern}` : ''}
              </span>
            </span>
          </div>
        ) : room ? (
          <div style={{ ...styles.picked, background: '#eff6ff', borderColor: '#bfdbfe' }}>
            <Glyph name="pin" size={16} color="#2563eb" />
            <span style={{ minWidth: 0 }}>
              <strong style={styles.pickedName}>{room.name}</strong>
              <span style={styles.pickedSub}>{room.cleanroomId} · {room.isoClass} · the whole room</span>
            </span>
          </div>
        ) : null}

        <p style={styles.hint}>
          Pick a filter where the round is carried out at a unit, or leave it on the
          whole room where the round walks the space.
        </p>
      </Step>

      <Step n={2} title="Select Inspection Checklist">
        <div style={styles.tabs}>
          {[
            ['specified', 'Specified Checklists', 'box'],
            ['org', 'Organization Checklists', 'doc'],
            ['system', 'Library Checklists', 'list'],
          ].map(([key, label, icon]) => (
            <button key={key} onClick={() => { setLibrary(key); setSearch('') }}
              style={{
                ...styles.tab,
                background: library === key ? '#15227a' : '#fff',
                color: library === key ? '#fff' : SUB,
                borderColor: library === key ? '#15227a' : LINE,
              }}>
              <Glyph name={icon} size={13} color={library === key ? '#fff' : SUB} />
              {label}
            </button>
          ))}
        </div>

        <p style={styles.tabNote}>
          {library === 'specified'
            ? `Checklists that apply to ${form.filterId ? 'a terminal filter' : 'a cleanroom'}.`
            : library === 'org'
              ? 'Checklists this site wrote or edited.'
              : 'The standard checklists that ship with the product.'}
        </p>

        <SearchBar value={search} onChange={setSearch} placeholder="Search by name or code..." />

        <div style={styles.pickList}>
          {shown.length === 0 ? (
            <p style={styles.hint}>
              {library === 'org'
                ? 'No checklists have been written here yet. The library tab carries the standard ones.'
                : 'No checklists match your search.'}
            </p>
          ) : shown.map((t) => {
            const on = form.checklistId === t.id
            return (
              <button key={t.id} onClick={() => set('checklistId', t.id)}
                style={{
                  ...styles.pickRow,
                  borderColor: on ? '#15227a' : '#dbeafe',
                  background: on ? '#eef1ff' : '#f8fafc',
                }}>
                <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                  <strong style={styles.pickedName}>{t.name}</strong>
                  <span style={styles.pickedSub}>
                    Code: {t.code || 'N/A'} · Version: {t.version || '1.0'} · {t.itemCount ?? allItems(t).length} items
                  </span>
                </span>
                <Pill tone="slate">{t.assetLevel || 'Equipment'}</Pill>
                {on && <Glyph name="check" size={17} color="#15227a" />}
              </button>
            )
          })}
        </div>

        {chosen && (
          <div style={{ ...styles.picked, background: '#eff6ff', borderColor: '#bfdbfe', marginTop: 12 }}>
            <Glyph name="check" size={16} color="#2563eb" />
            <span style={{ minWidth: 0 }}>
              <strong style={styles.pickedName}>{chosen.name}</strong>
              <span style={styles.pickedSub}>
                {chosen.standard} · Sections: {chosen.sectionCount ?? chosen.sections?.length ?? 1}
                {' '}· Total Items: {chosen.itemCount ?? allItems(chosen).length}
                {' '}· passing score {chosen.passingScore ?? 100}%
              </span>
              <span style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                {chosen.requiresSignature && <Pill tone="slate">Signature Required</Pill>}
                {chosen.requiresPhotos && <Pill tone="slate">Photos Required</Pill>}
                {chosen.category && <Pill tone="slate">{chosen.category}</Pill>}
              </span>
            </span>
          </div>
        )}
      </Step>

      <Step n={3} title="Inspection Details" dim={!form.checklistId}>
        <div style={styles.grid}>
          <Field label="Inspector">
            <select value={form.inspector} onChange={(e) => set('inspector', e.target.value)} style={styles.input}>
              <option value={USER.name}>{USER.name} — you</option>
              {INSPECTORS.map((t) => (
                <option key={t.technicianId} value={t.name}>{t.name} — {t.department}</option>
              ))}
            </select>
          </Field>
          <Field label="Scheduled Date">
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} style={styles.input} />
          </Field>
        </div>

        <div style={styles.subHead}>Environmental Conditions</div>
        <div style={styles.grid}>
          <Field label="Duration (minutes)">
            <input type="number" min="5" step="5" value={form.durationMinutes}
              onChange={(e) => set('durationMinutes', Number(e.target.value))} style={styles.input} />
          </Field>
          <Field label="Temperature (°C)">
            <input type="number" value={form.temperature}
              onChange={(e) => set('temperature', Number(e.target.value))} style={styles.input} />
          </Field>
          <Field label="Humidity (%)">
            <input type="number" min="0" max="100" value={form.humidity}
              onChange={(e) => set('humidity', Number(e.target.value))} style={styles.input} />
          </Field>
        </div>

        <Field label="Inspection Notes">
          <textarea rows={4} value={form.notes} onChange={(e) => set('notes', e.target.value)}
            placeholder="Any initial notes or special instructions for this round."
            style={{ ...styles.input, resize: 'vertical' }} />
        </Field>
      </Step>

      <div style={styles.warn}>
        <Glyph name="warning" size={17} color="#b45309" />
        <span>
          A checklist, an inspector and a date are required. Everything else can be
          filled in as the round is walked.
        </span>
      </div>

      <div style={styles.footer}>
        <Action onClick={() => router.push('/portal/hepa/inspections')}>Cancel</Action>
        <button onClick={onStart} disabled={!ready}
          style={{ ...styles.primary, opacity: ready ? 1 : 0.5, cursor: ready ? 'pointer' : 'default' }}>
          <Glyph name="play" size={13} color="#fff" />
          Start Inspection
        </button>
      </div>
    </div>
  )
}

function Step({ n, title, dim, children }) {
  return (
    <div style={{ ...styles.step, opacity: dim ? 0.55 : 1 }}>
      <div style={styles.stepHead}>
        <span style={styles.stepNo}>{n}</span>
        <h2 style={styles.stepTitle}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ── phase two: carrying the round out ─────────────────────────────────────

function Conduct({ router, store, existing, form, checklist, onBack }) {
  const [answers, setAnswers] = useState({})
  const [openSections, setOpenSections] = useState(() => new Set())
  const [notes, setNotes] = useState(form.notes || '')
  const [busy, setBusy] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(true)
  const tick = useRef(null)

  // The timer pauses rather than stopping. A technician who steps out of the
  // room mid-round should not have the duration keep counting, and should not
  // have to start over either.
  useEffect(() => {
    if (!running) return undefined
    tick.current = setInterval(() => setElapsed((n) => n + 1), 1000)
    return () => clearInterval(tick.current)
  }, [running])

  const sections = useMemo(() => sectionsOf(checklist), [checklist])
  const items = useMemo(() => sections.flatMap((s) => s.items), [sections])

  // First section open, the rest closed. The product opens none and a
  // technician's first act is always to open the first one; opening none on a
  // three-section checklist reads as a page that failed to load.
  useEffect(() => {
    if (sections.length) setOpenSections(new Set([sections[0].id]))
  }, [checklist])

  const answered = items.filter((i) => isAnswered(answers[i.id], i)).length
  const pct = items.length ? Math.round((answered / items.length) * 100) : 0

  const missing = useMemo(() => outstanding(items, answers), [items, answers])
  const valid = missing.length === 0 && items.length > 0

  const subject = existing || form
  const room = CLEANROOMS.find((c) => c.cleanroomId === (subject.cleanroomId || form.cleanroomId)) || null
  const filterId = subject.filterId || form.filterId || null

  const submit = async () => {
    setBusy(true)
    const payload = fileRound({ existing, form, checklist, sections, items, answers, notes, elapsed, room, filterId, store })
    // Patched under whichever id the store already knows this round by: the
    // database's own for a round raised here, its reference for a seeded row
    // being written to for the first time. Getting that wrong inserts a second
    // row under the same reference, which then wins the merge and blanks the
    // record.
    const saved = existing
      ? await store.update('hepa_inspection', existing.recordId || existing.reportId, payload)
      : await store.create('hepa_inspection', payload)
    setBusy(false)
    if (saved) router.push(`/portal/hepa/inspections/${payload.reportId}`)
  }

  if (!checklist) {
    return (
      <div>
        <PageHeading title="Conduct Inspection"
          subtitle="This round has no checklist behind it, so there is nothing to answer."
          back={{ label: 'Back', onClick: onBack }} />
      </div>
    )
  }

  return (
    <div>
      <PageHeading
        title="Conduct Inspection"
        subtitle="Complete all mandatory items to submit the inspection."
        back={{ label: 'Back', onClick: onBack }}
      />

      <div style={styles.progressCard}>
        <div style={{
          ...styles.timer,
          background: running ? '#ecfdf5' : '#fffbeb',
          borderColor: running ? '#a7f3d0' : '#fde68a',
        }}>
          <Glyph name="clock" size={15} color={running ? '#059669' : '#d97706'} />
          <span style={styles.timerValue}>{clock(elapsed)}</span>
          {!running && <span style={styles.paused}>Paused</span>}
          <span style={{ marginLeft: 'auto' }}>
            <Action icon={running ? 'clock' : 'play'} onClick={() => setRunning((v) => !v)}>
              {running ? 'Pause' : 'Resume'}
            </Action>
          </span>
        </div>

        <div style={styles.progressTop}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: SUB }}>Inspection Progress</span>
          <span style={{ fontSize: 12, color: SUB }}>{answered} of {items.length} items completed</span>
        </div>
        <div style={styles.track}>
          <div style={{
            width: `${pct}%`, height: '100%', borderRadius: 999,
            background: valid ? '#059669' : '#15227a', transition: 'width .2s',
          }} />
        </div>
        <div style={styles.progressBottom}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: MUTE }}>{pct}% Complete</span>
          {!valid && (
            <span style={styles.missing}>
              <Glyph name="warning" size={12} color="#b91c1c" />
              Missing: {missing.join(', ')}
            </span>
          )}
        </div>
      </div>

      <div style={styles.layout}>
        <aside style={styles.aside}>
          <div style={styles.card}>
            <div style={styles.cardHead}>
              <Glyph name="clipboard" size={15} color="#15227a" />
              <h3 style={styles.cardTitle}>{checklist.name}</h3>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {checklist.assetLevel && <Pill tone="slate">{checklist.assetLevel}</Pill>}
              {checklist.requiresSignature && <Pill tone="slate">Signature Required</Pill>}
              {checklist.requiresPhotos && <Pill tone="slate">Photos Required</Pill>}
            </div>
            <div style={styles.countRow}>
              <span style={styles.count}>
                <span style={styles.countLabel}>Sections</span>
                <span style={styles.countValue}>{sections.length}</span>
              </span>
              <span style={styles.count}>
                <span style={styles.countLabel}>Items</span>
                <span style={styles.countValue}>{items.length}</span>
              </span>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardHead}>
              <Glyph name="warning" size={15} color="#d97706" />
              <h3 style={styles.cardTitle}>Inspection Details</h3>
            </div>
            <Detail icon="box" label="Asset">{filterId || 'The whole room'}</Detail>
            <Detail icon="pin" label="Location">{room ? `${room.name} · ${room.isoClass}` : '—'}</Detail>
            <Detail icon="user" label="Inspector">{form.inspector}</Detail>
            <Detail icon="calendar" label="Scheduled Date">{fmtDate(form.date)}</Detail>
            <Detail icon="clock" label="Duration">{form.durationMinutes} min planned</Detail>
            <Detail icon="gauge" label="Temperature">{form.temperature}°C</Detail>
            <Detail icon="gauge" label="Humidity">{form.humidity}%</Detail>
          </div>
        </aside>

        <div style={{ minWidth: 0 }}>
          {sections.map((s, i) => {
            const open = openSections.has(s.id)
            const done = s.items.filter((it) => isAnswered(answers[it.id], it)).length
            return (
              <div key={s.id} style={styles.section}>
                <div style={styles.sectionHead}>
                  <button onClick={() => setOpenSections((p) => {
                    const next = new Set(p)
                    if (next.has(s.id)) next.delete(s.id); else next.add(s.id)
                    return next
                  })} style={styles.chevron} aria-label={open ? 'Collapse section' : 'Expand section'}>
                    <Glyph name={open ? 'up' : 'down'} size={14} color={SUB} />
                  </button>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <strong style={styles.sectionTitle}>Section {i + 1}: {s.name}</strong>
                  </span>
                  <Pill tone={done === s.items.length ? 'green' : 'slate'}>
                    {done} / {s.items.length} items
                  </Pill>
                </div>

                {open && (
                  <div style={styles.sectionBody}>
                    {s.items.map((item) => (
                      <ItemResponse
                        key={item.id}
                        item={item}
                        value={answers[item.id]}
                        onChange={(v) => setAnswers((p) => ({ ...p, [item.id]: { ...(p[item.id] || {}), ...v } }))}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          <div style={styles.card}>
            <div style={styles.cardHead}>
              <Glyph name="doc" size={15} color="#15227a" />
              <h3 style={styles.cardTitle}>Inspection Notes</h3>
            </div>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="What is worth recording about this round as a whole."
              style={{ ...styles.input, resize: 'vertical' }} />
          </div>
        </div>
      </div>

      <div style={styles.submitBar}>
        <span style={{ flex: '1 1 260px', fontSize: 11.5, lineHeight: 1.55, color: valid ? MUTE : '#b45309' }}>
          {valid
            ? `Filing ${items.length} answered items against ${checklist.name}. `
              + `The checklist passes at ${checklist.passingScore ?? 100}%.`
            : `${missing.join(', ')} still outstanding. A round filed part-done says the procedure `
              + 'was followed when nobody knows whether it was.'}
        </span>
        <Action onClick={onBack}>Cancel</Action>
        <button onClick={submit} disabled={!valid || busy || !store?.ready}
          style={{ ...styles.primary, opacity: !valid || busy || !store?.ready ? 0.5 : 1 }}>
          <Glyph name="check" size={13} color="#fff" />
          {busy ? 'Submitting…' : 'Submit Inspection'}
        </button>
      </div>
    </div>
  )
}

function Detail({ icon, label, children }) {
  return (
    <div style={styles.detail}>
      <Glyph name={icon} size={13} color="#94a3b8" />
      <span style={{ minWidth: 0 }}>
        <span style={styles.detailLabel}>{label}</span>
        <span style={styles.detailValue}>{children}</span>
      </span>
    </div>
  )
}

// ── one item ──────────────────────────────────────────────────────────────
//
// The product wraps every response type in the same frame: number, mandatory
// star, Critical badge, a Completed/Pending badge, the description, the
// instruction, the type badges, the control itself, then the comment box where
// one is required. Keeping the frame identical across types is what lets a
// technician scan a checklist rather than read it.

function ItemResponse({ item, value = {}, onChange }) {
  const done = isAnswered(value, item)
  const commentMissing = item.requiresComment && !String(value.comment || '').trim()
  const signatureMissing = item.requiresSignature && !String(value.signature || '').trim()
  const photoMissing = item.requiresPhoto && !String(value.photo || '').trim()
  const criticalFail = item.critical && value.passed === false

  return (
    <div style={{ ...styles.item, borderColor: criticalFail ? '#fecaca' : '#e2e8f0' }}>
      <div style={styles.itemHead}>
        <span style={styles.itemNo}>
          Item {item.itemNumber}
          {item.required && <span style={{ color: '#dc2626' }}> *</span>}
        </span>
        {item.critical && <Pill tone="red">Critical</Pill>}
        <Pill tone={done ? 'green' : 'slate'}>{done ? 'Completed' : 'Pending'}</Pill>
      </div>

      <p style={styles.itemDesc}>{item.description}</p>
      {item.instruction && <p style={styles.itemInstruction}>{item.instruction}</p>}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '9px 0 11px' }}>
        <Pill tone="slate">{item.responseType}</Pill>
        {item.requiresComment && <Pill tone={commentMissing ? 'red' : 'violet'}>Comment Required</Pill>}
        {item.requiresPhoto && <Pill tone={photoMissing ? 'red' : 'green'}>Photo Required</Pill>}
        {item.requiresSignature && <Pill tone={signatureMissing ? 'red' : 'green'}>Signature Required</Pill>}
      </div>

      <Response item={item} value={value} onChange={onChange} />

      {(item.requiresComment || value.comment) && (
        <div style={styles.extra}>
          <div style={styles.fieldLabel}>
            Comments{item.requiresComment ? ' *' : ''}
          </div>
          <textarea rows={2} value={value.comment || ''} onChange={(e) => onChange({ comment: e.target.value })}
            placeholder={item.requiresComment ? 'A comment is required for this item' : 'Anything worth recording'}
            style={{ ...styles.input, resize: 'vertical', borderColor: commentMissing ? '#fecaca' : LINE }} />
        </div>
      )}

      {item.requiresPhoto && (
        <div style={styles.extra}>
          <div style={styles.fieldLabel}>Photo reference *</div>
          <input value={value.photo || ''} onChange={(e) => onChange({ photo: e.target.value })}
            placeholder="The reference of the photograph filed with this record"
            style={{ ...styles.input, borderColor: photoMissing ? '#fecaca' : LINE }} />
        </div>
      )}

      {criticalFail && (
        <div style={styles.criticalFail}>
          <Glyph name="warning" size={14} color="#b91c1c" />
          Critical Item Failed: this round cannot be filed as a pass, and the room stays
          out of use until the finding is closed.
        </div>
      )}
    </div>
  )
}

function Response({ item, value, onChange }) {
  const type = item.responseType

  if (type === 'Pass_Fail') {
    return (
      <div>
        <div style={styles.fieldLabel}>Result</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[[true, 'Pass', '#059669'], [false, 'Fail', '#dc2626']].map(([v, label, colour]) => (
            <button key={label} onClick={() => onChange({ passed: v })}
              style={{
                ...styles.choice,
                background: value.passed === v ? colour : '#fff',
                color: value.passed === v ? '#fff' : SUB,
                borderColor: value.passed === v ? colour : LINE,
              }}>
              <Glyph name={v ? 'check' : 'cross'} size={13} color={value.passed === v ? '#fff' : SUB} />
              {label}
            </button>
          ))}
        </div>
        {value.passed !== undefined && (
          <p style={{ ...styles.itemInstruction, marginTop: 8 }}>
            Status: <strong style={{ color: value.passed ? '#047857' : '#b91c1c' }}>
              {value.passed ? 'PASSED' : 'FAILED'}
            </strong>
          </p>
        )}
      </div>
    )
  }

  if (type === 'Numeric') {
    const { min, max } = bounds(item)
    const n = value.number === '' || value.number == null ? null : Number(value.number)
    const bounded = min != null || max != null
    const within = n == null || !bounded ? null
      : (min == null || n >= min) && (max == null || n <= max)
    return (
      <div>
        <div style={styles.fieldLabel}>Numeric Value</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="number" step="any" value={value.number ?? ''}
            onChange={(e) => onChange({ number: e.target.value })}
            placeholder="Enter numeric value"
            style={{ ...styles.input, borderColor: within === false ? '#fecaca' : LINE }} />
          {item.unit && <Pill tone="slate">{item.unit}</Pill>}
        </div>
        {bounded && (
          <p style={{ ...styles.itemInstruction, marginTop: 7 }}>
            Acceptable Range: <strong>{min ?? '—'} – {max ?? '—'}{item.unit ? ` ${item.unit}` : ''}</strong>
          </p>
        )}
        {within != null && (
          <p style={{ ...styles.verdict, color: within ? '#047857' : '#b91c1c' }}>
            {within ? 'Within acceptable range' : 'Outside acceptable range'}
          </p>
        )}
      </div>
    )
  }

  // A range is two readings, not one. The product asks for both because the
  // step it belongs to records a band — a differential that swung between two
  // values, a count taken at two points — and collapsing that to a single
  // number throws away the half of it that says how far it moved.
  if (type === 'Range') {
    const { min, max } = bounds(item)
    const within = rangeWithin(item, value)
    return (
      <div>
        <div style={styles.fieldLabel}>Range Value</div>
        <div style={{ display: 'flex', gap: 9, alignItems: 'flex-end' }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={styles.smallLabel}>Min</span>
            <input type="number" step="any" value={value.rangeMin ?? ''}
              onChange={(e) => onChange({ rangeMin: e.target.value })}
              placeholder="Min value"
              style={{ ...styles.input, borderColor: within === false ? '#fecaca' : LINE }} />
          </span>
          <span style={{ color: MUTE, paddingBottom: 9 }}>—</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={styles.smallLabel}>Max</span>
            <input type="number" step="any" value={value.rangeMax ?? ''}
              onChange={(e) => onChange({ rangeMax: e.target.value })}
              placeholder="Max value"
              style={{ ...styles.input, borderColor: within === false ? '#fecaca' : LINE }} />
          </span>
          {item.unit && <span style={{ paddingBottom: 7 }}><Pill tone="slate">{item.unit}</Pill></span>}
        </div>
        {(min != null || max != null) && (
          <p style={{ ...styles.itemInstruction, marginTop: 7 }}>
            Acceptable range limits: <strong>{min ?? '—'} – {max ?? '—'}{item.unit ? ` ${item.unit}` : ''}</strong>
          </p>
        )}
        {within != null && (
          <p style={{ ...styles.verdict, color: within ? '#047857' : '#b91c1c' }}>
            {within ? 'Within acceptable range' : 'Outside acceptable range'}
          </p>
        )}
      </div>
    )
  }

  if (type === 'Selection') {
    const options = item.options?.length ? item.options : []
    return (
      <div>
        <div style={styles.fieldLabel}>Select an option:</div>
        {options.length === 0 ? (
          <p style={styles.itemInstruction}>No selection options available</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {options.map((o) => {
              const label = typeof o === 'string' ? o : o.label || o.value
              const on = value.selected === label
              return (
                <button key={label} onClick={() => onChange({ selected: label })}
                  style={{
                    ...styles.choice, justifyContent: 'flex-start',
                    background: on ? '#15227a' : '#fff',
                    color: on ? '#fff' : SUB,
                    borderColor: on ? '#15227a' : LINE,
                  }}>
                  <Glyph name="check" size={13} color={on ? '#fff' : '#cbd5e1'} />
                  {label}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  if (type === 'Signature') {
    return <SignaturePad value={value.signature} onChange={(signature) => onChange({ signature })} />
  }

  if (type === 'Text') {
    return (
      <div>
        <div style={styles.fieldLabel}>Response</div>
        <textarea rows={3} value={value.text || ''} onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Enter your response..." style={{ ...styles.input, resize: 'vertical' }} />
        <p style={{ ...styles.itemInstruction, marginTop: 5 }}>
          {String(value.text || '').length > 0 ? `${value.text.length} characters` : 'No response entered'}
        </p>
      </div>
    )
  }

  return (
    <div style={styles.unsupported}>
      <Glyph name="warning" size={14} color="#b45309" />
      Unsupported response type: {String(type)}
    </div>
  )
}

/**
 * The signature pad.
 *
 * Drawn rather than typed. A typed name is a field anybody could fill in from
 * anywhere; the product asks for a stroke because the point of the signature on
 * an inspection record is that the person who walked the round was there with
 * the device in their hand. The stroke is kept as a data URL on the answer, so
 * it is filed with the round rather than recreated from a name afterwards.
 */
function SignaturePad({ value, onChange }) {
  const canvas = useRef(null)
  const drawing = useRef(false)
  const drew = useRef(false)

  const at = (e) => {
    const r = canvas.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  // Sized to its own box in device pixels, so the stroke is not a blurred,
  // stretched copy of a 300-pixel bitmap on a high-density screen.
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ratio = window.devicePixelRatio || 1
    el.width = el.clientWidth * ratio
    el.height = el.clientHeight * ratio
    const ctx = el.getContext('2d')
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0f172a'
  }, [])

  const start = (e) => {
    e.preventDefault()
    const ctx = canvas.current.getContext('2d')
    const p = at(e)
    drawing.current = true
    drew.current = false
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    canvas.current.setPointerCapture(e.pointerId)
  }

  const move = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvas.current.getContext('2d')
    const p = at(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    drew.current = true
  }

  const stop = () => {
    if (!drawing.current) return
    drawing.current = false
    if (drew.current) onChange(canvas.current.toDataURL('image/png'))
  }

  const clear = () => {
    const el = canvas.current
    el.getContext('2d').clearRect(0, 0, el.width, el.height)
    drew.current = false
    onChange('')
  }

  const has = Boolean(value)

  return (
    <div>
      <div style={styles.fieldLabel}>Signature Required:</div>
      <div style={styles.padWrap}>
        <div style={styles.padTop}>
          <span style={{ fontSize: 11.5, color: SUB, fontWeight: 600 }}>
            {has ? 'Signature captured' : 'Please sign below'}
          </span>
          <button type="button" onClick={clear} disabled={!has}
            style={{ ...styles.clearBtn, opacity: has ? 1 : 0.45, cursor: has ? 'pointer' : 'default' }}>
            Clear
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <canvas ref={canvas} style={styles.pad}
            onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} />
          {!has && <span style={styles.padHint}>Sign here</span>}
        </div>
      </div>
      {has && (
        <p style={{ ...styles.verdict, color: '#047857' }}>Signature captured successfully</p>
      )}
      <p style={styles.itemInstruction}>
        Draw your signature using mouse or touch. It is saved against the round automatically.
      </p>
    </div>
  )
}

// ── the rules ─────────────────────────────────────────────────────────────

/** A checklist item's acceptance limits, as numbers or nothing. */
function bounds(item) {
  const n = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v))
  return { min: n(item.min), max: n(item.max) }
}

/** Whether a range answer sits inside the item's limits. Null until both ends are in. */
function rangeWithin(item, value = {}) {
  const { min, max } = bounds(item)
  if (min == null && max == null) return null
  const lo = value.rangeMin === '' || value.rangeMin == null ? null : Number(value.rangeMin)
  const hi = value.rangeMax === '' || value.rangeMax == null ? null : Number(value.rangeMax)
  if (lo == null && hi == null) return null
  const loOk = lo == null || min == null || lo >= min
  const hiOk = hi == null || max == null || hi <= max
  return loOk && hiOk
}

/** The checklist as sections, whichever shape the library hands over. */
function sectionsOf(checklist) {
  if (!checklist) return []
  const list = checklist.sections || []
  if (list.length) {
    return list.map((s, i) => ({
      id: s.id || `s${i}`,
      name: s.name || `Section ${i + 1}`,
      items: [...(s.items || []), ...(s.subSections || []).flatMap((ss) => ss.items || [])],
    })).filter((s) => s.items.length)
  }
  const flat = allItems(checklist)
  return flat.length ? [{ id: 'all', name: checklist.name || 'Checklist', items: flat }] : []
}

function isAnswered(value = {}, item) {
  switch (item.responseType) {
    case 'Pass_Fail': return value.passed !== undefined
    case 'Numeric': return value.number !== undefined && String(value.number).trim() !== ''
    case 'Range': return String(value.rangeMin ?? '').trim() !== '' && String(value.rangeMax ?? '').trim() !== ''
    case 'Selection': return Boolean(value.selected)
    case 'Signature': return Boolean(String(value.signature || '').trim())
    case 'Text': return Boolean(String(value.text || '').trim())
    default: return false
  }
}

/**
 * What still stands between the technician and filing this round.
 *
 * Phrased as counts by kind rather than as a list of item numbers, because the
 * message sits in a one-line bar and "3 mandatory items, 1 required comment" is
 * read at a glance where thirteen references are not.
 */
function outstanding(items, answers) {
  const out = []
  const n = (list, one, many) => (list.length ? out.push(`${list.length} ${list.length === 1 ? one : many}`) : null)

  n(items.filter((i) => i.required && !isAnswered(answers[i.id], i)), 'mandatory item', 'mandatory items')
  n(items.filter((i) => i.requiresComment && !String(answers[i.id]?.comment || '').trim()), 'required comment', 'required comments')
  n(items.filter((i) => i.requiresPhoto && !String(answers[i.id]?.photo || '').trim()), 'required photo', 'required photos')
  n(items.filter((i) => i.requiresSignature && !String(answers[i.id]?.signature || '').trim()), 'required signature', 'required signatures')

  return out
}

/**
 * Whether one answered item passed.
 *
 * A pass/fail item is what it says. A numeric with bounds passes inside them
 * and fails outside — that is the whole reason the bounds are on the checklist.
 * A text, selection or signature item has no notion of failing; answering it is
 * the evidence, so it scores.
 */
function itemPassed(item, value = {}) {
  if (item.responseType === 'Pass_Fail') return value.passed !== false
  if (item.responseType === 'Numeric') {
    const { min, max } = bounds(item)
    const n = Number(value.number)
    if (Number.isNaN(n)) return false
    return (min == null || n >= min) && (max == null || n <= max)
  }
  if (item.responseType === 'Range') {
    const within = rangeWithin(item, value)
    return within !== false
  }
  return true
}

/**
 * The next reference in the sequence.
 *
 * Continues the register's own numbering rather than starting a private one, so
 * a round raised in the portal sits in the same series as the rounds that were
 * already there. Counts what is stored as well as what is seeded, so two rounds
 * raised in a session do not collide.
 */
function nextReportId(store) {
  const seeded = new Set(INSPECTION_REPORTS.map((r) => r.reportId))
  const created = (store?.records?.hepa_inspection || []).filter((r) => r.reportId && !seeded.has(r.reportId))
  return `INS-${3000 + seeded.size + created.length}`
}

/** Everything the register and the record page need, worked out once. */
function fileRound({ existing, form, checklist, sections, items, answers, notes, elapsed, room, filterId, store }) {
  const round = existing ? roundById(existing.roundId) : ROUND_TYPES.find((t) => t.id === checklist.roundId) || null

  const results = items.map((item) => {
    const value = answers[item.id] || {}
    const passed = itemPassed(item, value)
    return {
      itemNumber: item.itemNumber,
      itemDescription: item.description,
      responseType: item.responseType,
      passFail: passed,
      isWithinSpec: passed,
      requiresAction: !passed,
      priority: !passed ? (item.critical ? 'Critical' : 'High') : 'Low',
      comments: value.comment || null,
      itemScore: passed ? 1 : 0,
      // The answer itself, not only whether it passed. A number without its
      // value is a row that says a reading was taken and not what it read. The
      // signature is the exception: the stroke goes on the round rather than in
      // a results cell, so the cell says one was given.
      responseValue: value.number
        ?? (value.rangeMin != null && value.rangeMax != null ? `${value.rangeMin} – ${value.rangeMax}` : undefined)
        ?? value.text ?? value.selected
        ?? (value.signature ? 'Signature Captured' : undefined)
        ?? (item.responseType === 'Pass_Fail' ? (passed ? 'Pass' : 'Fail') : null),
    }
  })

  const points = results.reduce((n, r) => n + r.itemScore, 0)
  const score = items.length ? Math.round((points / items.length) * 100) : 100
  const failedItems = results.filter((r) => !r.passFail)
  const criticalFailed = items.some((item) => item.critical && !itemPassed(item, answers[item.id] || {}))
  const passing = checklist.passingScore ?? 100

  const result = criticalFailed || score < passing ? 'Fail'
    : (notes.trim() || results.some((r) => r.comments)) ? 'Pass with observations'
      : 'Pass'

  const findings = failedItems.map((r) => (r.comments ? `${r.itemDescription} — ${r.comments}` : r.itemDescription))
  const signature = items.map((i) => answers[i.id]?.signature).find(Boolean) || null

  return {
    reportId: existing ? existing.reportId : nextReportId(store),
    roundId: round?.id || checklist.roundId || checklist.id,
    round: round?.name || checklist.name,
    standard: round?.standard || checklist.standard,
    frequency: round?.every || 'Ad hoc',
    cleanroomId: room?.cleanroomId || form.cleanroomId,
    cleanroomName: room?.name || existing?.cleanroomName || '',
    isoClass: room?.isoClass || existing?.isoClass || '',
    filterId: filterId || null,
    appliesTo: filterId ? 'filter' : 'room',
    date: today(),
    inspector: form.inspector,
    assignee: existing?.assignee || form.inspector,
    // What the timer actually recorded, rounded up to the minute — a round that
    // took fifty seconds is a minute on the record, not nought.
    durationMinutes: Math.max(1, Math.ceil(elapsed / 60)),
    plannedMinutes: form.durationMinutes,
    temperature: form.temperature,
    humidity: form.humidity,
    result,
    score,
    scorePoints: points,
    maxScore: items.length,
    findings,
    findingsCount: findings.length,
    results,
    checklistId: checklist.id,
    checklistName: checklist.name,
    checklistCode: checklist.code || existing?.checklistCode || null,
    checklistSteps: items.length,
    sectionsWalked: sections.length,
    notes: notes.trim() || null,
    recommendedActions: result === 'Fail' ? (existing?.recommendedActions || null) : null,
    followUpRequired: result === 'Fail',
    followUpDate: result === 'Fail' ? addDays(7) : null,
    signatureCaptured: Boolean(signature),
    // The stroke and the name of the person it belongs to. The stroke is the
    // evidence and the name is what a register can be read by, so both are
    // filed rather than one standing in for the other.
    signatureImage: signature,
    signedBy: signature ? form.inspector : null,
    status: result === 'Fail' ? 'Open finding' : 'Completed',
    _walked: true,
    _pending: false,
    _overdue: false,
    _failed: result === 'Fail',
  }
}

const addDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

const clock = (s) => {
  const m = Math.floor(s / 60)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function Field({ label, children }) {
  return (
    <div style={{ minWidth: 0, marginBottom: 11 }}>
      <div style={styles.fieldLabel}>{label}</div>
      {children}
    </div>
  )
}

const styles = {
  step: {
    background: '#fff', borderRadius: 12, padding: '18px 20px', marginBottom: 14,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  stepHead: { display: 'flex', alignItems: 'center', gap: 11, marginBottom: 15 },
  stepNo: {
    width: 28, height: 28, borderRadius: 999, display: 'grid', placeItems: 'center',
    background: '#eef1ff', color: '#15227a', fontSize: 13, fontWeight: 800, flexShrink: 0,
  },
  stepTitle: { margin: 0, fontSize: 16, fontWeight: 700, color: INK },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 },
  fieldLabel: {
    fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase',
    letterSpacing: 0.4, marginBottom: 5,
  },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
    fontFamily: 'inherit', lineHeight: 1.5, color: INK, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, borderRadius: 9, outline: 'none',
  },
  subHead: { fontSize: 13.5, fontWeight: 700, color: INK, margin: '6px 0 10px' },
  hint: { margin: '9px 0 0', fontSize: 11.5, color: MUTE, lineHeight: 1.55 },

  picked: {
    display: 'flex', alignItems: 'flex-start', gap: 11, padding: '13px 15px',
    borderRadius: 10, borderStyle: 'solid', borderWidth: 1, marginTop: 12,
  },
  pickedName: { display: 'block', fontSize: 13.5, fontWeight: 700, color: INK },
  pickedSub: { display: 'block', fontSize: 11.5, color: SUB, marginTop: 3, lineHeight: 1.5 },

  tabs: { display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 10 },
  tab: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
    borderStyle: 'solid', borderWidth: 1, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  tabNote: {
    margin: '0 0 11px', padding: '9px 12px', fontSize: 11.5, color: SUB,
    background: '#f8fafc', borderRadius: 9, lineHeight: 1.5,
  },
  pickList: {
    display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 340, overflowY: 'auto',
    padding: 3,
  },
  pickRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px',
    borderRadius: 10, borderStyle: 'solid', borderWidth: 1,
    cursor: 'pointer', fontFamily: 'inherit', width: '100%',
  },

  warn: {
    display: 'flex', alignItems: 'flex-start', gap: 11, padding: '13px 15px',
    borderRadius: 11, background: '#fffbeb', color: '#92400e', fontSize: 12.5, lineHeight: 1.55,
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fde68a', marginBottom: 14,
  },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' },
  primary: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 17px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
    background: '#15227a', color: '#fff', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
  },

  progressCard: {
    background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 14,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  timer: {
    display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', borderRadius: 9,
    borderStyle: 'solid', borderWidth: 1, marginBottom: 12,
  },
  timerValue: {
    fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 16, fontWeight: 700,
    color: INK, fontVariantNumeric: 'tabular-nums',
  },
  paused: { fontSize: 11, fontWeight: 700, color: '#b45309' },
  progressTop: { display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 7 },
  track: { height: 7, background: '#eef2f7', borderRadius: 999, overflow: 'hidden' },
  progressBottom: { display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 7 },
  missing: {
    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700,
    color: '#b91c1c', background: '#fef2f2', padding: '3px 9px', borderRadius: 7,
  },

  layout: { display: 'grid', gridTemplateColumns: 'minmax(0,280px) minmax(0,1fr)', gap: 14, alignItems: 'start' },
  aside: { position: 'sticky', top: 16, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 },
  card: {
    background: '#fff', borderRadius: 12, padding: '15px 16px', marginBottom: 12,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, minWidth: 0,
  },
  cardHead: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 },
  cardTitle: { margin: 0, fontSize: 14, fontWeight: 700, color: INK, minWidth: 0 },
  countRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 },
  count: { textAlign: 'center', padding: '9px 6px', borderRadius: 9, background: '#f8fafc' },
  countLabel: { display: 'block', fontSize: 10, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 },
  countValue: { display: 'block', fontSize: 17, fontWeight: 800, color: INK, marginTop: 2 },
  detail: { display: 'flex', alignItems: 'flex-start', gap: 9, padding: '6px 0', minWidth: 0 },
  detailLabel: { display: 'block', fontSize: 10, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 },
  detailValue: { display: 'block', fontSize: 12.5, fontWeight: 600, color: INK, marginTop: 1 },

  section: {
    background: '#fff', borderRadius: 12, marginBottom: 12,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, overflow: 'hidden',
  },
  sectionHead: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px',
    borderBottom: `1px solid #f1f5f9`,
  },
  chevron: {
    width: 26, height: 26, display: 'grid', placeItems: 'center', flexShrink: 0,
    background: '#f8fafc', border: 'none', borderRadius: 7, cursor: 'pointer', padding: 0,
  },
  sectionTitle: { fontSize: 13.5, fontWeight: 700, color: INK },
  sectionBody: { padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 11 },

  item: {
    padding: '14px 15px', borderRadius: 11, background: '#fff',
    borderStyle: 'solid', borderWidth: 2,
  },
  itemHead: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  itemNo: { fontSize: 12.5, fontWeight: 800, color: INK },
  itemDesc: { margin: 0, fontSize: 13, color: INK, lineHeight: 1.55 },
  itemInstruction: { margin: '5px 0 0', fontSize: 11.5, color: MUTE, fontStyle: 'italic', lineHeight: 1.5 },
  choice: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 15px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
    borderStyle: 'solid', borderWidth: 1, cursor: 'pointer',
  },
  extra: { marginTop: 12, paddingTop: 11, borderTop: `1px solid ${LINE}` },
  smallLabel: { display: 'block', fontSize: 10.5, color: MUTE, marginBottom: 4 },
  verdict: { margin: '7px 0 0', fontSize: 11.5, fontWeight: 700 },
  padWrap: {
    borderRadius: 10, overflow: 'hidden',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  padTop: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    padding: '8px 11px', background: '#f8fafc', borderBottom: `1px solid ${LINE}`,
  },
  clearBtn: {
    padding: '4px 11px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
    borderRadius: 7, background: '#fff', color: SUB,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  pad: { display: 'block', width: '100%', height: 150, background: '#fff', touchAction: 'none', cursor: 'crosshair' },
  padHint: {
    position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
    fontSize: 12, color: '#cbd5e1', pointerEvents: 'none',
  },
  criticalFail: {
    display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 12, padding: '10px 12px',
    borderRadius: 9, background: '#fef2f2', color: '#b91c1c', fontSize: 11.5, lineHeight: 1.55,
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fecaca',
  },
  unsupported: {
    display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 9,
    background: '#fffbeb', color: '#92400e', fontSize: 12,
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fde68a',
  },

  submitBar: {
    display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap',
    position: 'sticky', bottom: 0, marginTop: 14, padding: '13px 16px', borderRadius: 12,
    background: '#fff', borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
    boxShadow: '0 -6px 18px rgba(15,23,42,.06)',
  },
}
