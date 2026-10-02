'use client'

// Building a checklist.
//
// The one thing that decides whether a checklist ever exists is how it starts.
// Eighteen lines typed from a blank page is a job that gets put off until the
// week it is needed and then written from memory in five minutes, which is how
// a property ends up with two checklists that disagree. So the default here is
// not blank: it is a copy of the 18-point suite PM, already grouped, ready to
// have four lines deleted and two added. Blank is available and is the second
// button.
//
// Grouped by system rather than listed flat, for the same reason Checklists.jsx
// groups it: that is the order the walk happens in. A tech does the kitchen,
// then the PTAC, then the bathroom — a list that alternates sends someone back
// and forth across a suite they are standing in the middle of. The arrows move
// a line within its own system only, because moving a line out of its group
// silently breaks that order and nobody would see it happen.
//
// What is saved is a template, not a run. It goes in the same kind as the ticks
// the daily schedule writes — `hosp_checklist_run` — so the id has to be one a
// tick can never produce; see `templateId` below.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Section, Card, Fields,
  StatusBadge, ActionButton, PALETTE,
} from '../lib/kit'
import { useStore } from '../lib/store'
import { USER, SUITE_PM, ROUNDS } from '../lib/data'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, RED } = PALETTE

// The five systems the suite PM walks, in walk order, then the places the
// standing rounds go. Both come from the pack rather than being typed here, so
// a checklist written for the pool uses the same words as the round that
// already covers it and the two group together on any screen that sorts by it.
const SUITE_GROUPS = [...new Set(SUITE_PM.checklist.map((c) => c.group))]
const ROUND_GROUPS = [...new Set(ROUNDS.map((r) => r.location))].filter((g) => !SUITE_GROUPS.includes(g))
const GROUPS = [...SUITE_GROUPS, ...ROUND_GROUPS]

// Derived, and labelled as derived wherever it is shown. The property has one
// measured figure for this — 45 minutes over 18 checkpoints on the suite PM —
// so a longer or shorter list is scaled from that rather than guessed at.
const MINUTES_PER_ITEM = SUITE_PM.minutes / SUITE_PM.checklist.length

let seq = 0
const newRow = (group, item = '') => ({ rowId: `r${++seq}`, group, item })

const fromSuitePm = () => SUITE_PM.checklist.map((c) => newRow(c.group, c.item))

// A tick written by the daily schedule or the Checklists screen is
// `chk_<suite>_<slug>`, and both live in this kind. A template saved under an
// id one of those could produce would mark a real checkpoint done on a real
// suite, silently, on a screen nobody was looking at. The prefix and the
// timestamp keep the two apart for good.
const templateId = (title) =>
  `chktpl_${title.toLowerCase().replace(/\W+/g, '').slice(0, 24) || 'untitled'}_${Date.now().toString(36)}`

export default function ChecklistCreate({ section = 'checklists' }) {
  const router = useRouter()
  const store = useStore()
  const create = store?.create
  // The store's first fetch has to answer before a write, or the record is lost
  // with no error anywhere — the optimistic row goes in and the load that lands
  // after it replaces the whole map. The full account is at the top of
  // DailySchedule.jsx. Every submit control here waits on it.
  const ready = Boolean(store?.ready)

  const [title, setTitle] = useState('')
  // Starts as a copy of the suite PM. See the note at the top: a blank page is
  // how a checklist never gets written.
  const [items, setItems] = useState(fromSuitePm)
  const [startedBlank, setStartedBlank] = useState(false)
  const [addGroup, setAddGroup] = useState(GROUPS[0])
  const [addText, setAddText] = useState('')
  const [showProblems, setShowProblems] = useState(false)
  const [saving, setSaving] = useState(false)

  const used = useMemo(() => GROUPS.filter((g) => items.some((i) => i.group === g)), [items])
  const filled = useMemo(() => items.filter((i) => i.item.trim()), [items])
  const blanks = items.length - filled.length
  const minutes = Math.round(filled.length * MINUTES_PER_ITEM)
  const kitchen = filled.filter((i) => i.group === 'Kitchen').length

  const duplicates = useMemo(() => {
    const seen = new Set()
    const dupes = new Set()
    filled.forEach((i) => {
      const k = i.item.trim().toLowerCase()
      if (seen.has(k)) dupes.add(k)
      seen.add(k)
    })
    return dupes
  }, [filled])

  const setText = (rowId, item) =>
    setItems((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, item } : r)))

  const setGroup = (rowId, group) =>
    setItems((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, group } : r)))

  const removeRow = (rowId) => setItems((prev) => prev.filter((r) => r.rowId !== rowId))

  // Within the group only. Swapping with the neighbouring flat index would move
  // a line into another system whenever it sat at a group boundary, which reads
  // as the list rearranging itself.
  const move = (rowId, dir) => setItems((prev) => {
    const i = prev.findIndex((r) => r.rowId === rowId)
    if (i < 0) return prev
    const siblings = prev.map((r, idx) => ({ r, idx })).filter((o) => o.r.group === prev[i].group)
    const at = siblings.findIndex((o) => o.idx === i)
    const target = siblings[at + dir]
    if (!target) return prev
    const next = [...prev]
    next[i] = prev[target.idx]
    next[target.idx] = prev[i]
    return next
  })

  const addRow = () => {
    const text = addText.trim()
    if (!text) return
    setItems((prev) => [...prev, newRow(addGroup, text)])
    setAddText('')
  }

  const problems = useMemo(() => {
    const out = []
    if (!title.trim()) out.push('a name for the checklist')
    if (!filled.length) out.push('at least one checkpoint')
    if (blanks) out.push(`${blanks} empty line${blanks === 1 ? '' : 's'} to fill in or delete`)
    return out
  }, [title, filled.length, blanks])

  const submit = async () => {
    if (problems.length) { setShowProblems(true); return }
    if (!ready || !create || saving) return
    setSaving(true)

    const record = await create('hosp_checklist_run', {
      recordId: templateId(title.trim()),
      title: title.trim(),
      items: filled.map((i) => ({ group: i.group, item: i.item.trim() })),
      // Singular, because that is the shape the register stores. A checklist
      // that covers one system says so; one that crosses several says that
      // instead of naming whichever happened to come first.
      group: used.length === 1 ? used[0] : 'Multi-system',
      created_by: USER.name,
      created_date: new Date().toISOString(),
      // Marks it as a template rather than a tick. The screens that count
      // completed checkpoints filter on `done`, which a template has not got,
      // so it is already invisible to them — this is for anything reading the
      // register directly.
      is_template: true,
      minutes_estimate: minutes,
    })

    if (!record) { setSaving(false); return }
    router.push(`/portal/hospitality/${section}`)
  }

  return (
    <div>
      <PageHeading
        title="Build a checklist"
        subtitle="Named checkpoints grouped by system, in the order the walk happens"
        back={{ label: 'Checklists', onClick: () => router.push(`/portal/hospitality/${section}`) }}
      />

      <StatCards items={[
        { label: 'Checkpoints', value: filled.length, note: blanks ? `${blanks} line${blanks === 1 ? '' : 's'} still empty` : 'all lines named' },
        { label: 'Systems covered', value: used.length, note: used.join(', ') || 'nothing yet' },
        { label: 'Estimated time', value: minutes, unit: 'min', note: `derived at ${MINUTES_PER_ITEM.toFixed(1)} min a point, from the suite PM` },
        { label: 'Kitchen points', value: kitchen, note: 'the extended-stay difference' },
      ]} />

      <Section title="What this checklist is">
        <label style={styles.label} htmlFor="chk-title">Name</label>
        <input
          id="chk-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Guest suite PM — kitchen-heavy variant"
          style={{ ...styles.input, maxWidth: 520 }}
        />

        <label style={{ ...styles.label, marginTop: 16 }}>Start from</label>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <button
            onClick={() => { setItems(fromSuitePm()); setStartedBlank(false) }}
            style={{ ...styles.chip, ...(startedBlank ? null : styles.chipOn) }}
          >
            Copy the {SUITE_PM.checklist.length}-point suite PM
          </button>
          <button
            onClick={() => { setItems([]); setStartedBlank(true) }}
            style={{ ...styles.chip, ...(startedBlank ? styles.chipOn : null) }}
          >
            Start blank
          </button>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 11.5, color: MUTE, lineHeight: 1.55, maxWidth: 640 }}>
          Copying replaces whatever is below, so pick this first. Nearly every checklist this
          property needs is the suite PM with four lines cut and two added — starting from it is
          the difference between a checklist that exists and one that is always about to be
          written.
        </p>
      </Section>

      {GROUPS.map((g) => {
        const rows = items.filter((r) => r.group === g)
        if (!rows.length) return null
        return (
          <Section
            key={g}
            title={(
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {g}
                <StatusBadge tone="grey">{rows.length}</StatusBadge>
              </span>
            )}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {rows.map((r, i) => {
                const dupe = r.item.trim() && duplicates.has(r.item.trim().toLowerCase())
                return (
                  <div key={r.rowId} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 0', borderBottom: `1px solid ${LINE}`, flexWrap: 'wrap',
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button
                        onClick={() => move(r.rowId, -1)}
                        disabled={i === 0}
                        aria-label={`Move ${r.item || 'this line'} up`}
                        style={{ ...styles.nudge, opacity: i === 0 ? 0.3 : 1 }}
                      >▲</button>
                      <button
                        onClick={() => move(r.rowId, 1)}
                        disabled={i === rows.length - 1}
                        aria-label={`Move ${r.item || 'this line'} down`}
                        style={{ ...styles.nudge, opacity: i === rows.length - 1 ? 0.3 : 1 }}
                      >▼</button>
                    </div>

                    <input
                      value={r.item}
                      onChange={(e) => setText(r.rowId, e.target.value)}
                      placeholder="What the tech checks, and what good looks like"
                      aria-label={`Checkpoint ${i + 1} in ${g}`}
                      style={{
                        ...styles.input, flex: '1 1 300px', minWidth: 200,
                        borderColor: dupe ? '#fdba74' : LINE,
                      }}
                    />

                    <select
                      value={r.group}
                      onChange={(e) => setGroup(r.rowId, e.target.value)}
                      aria-label={`System for checkpoint ${i + 1}`}
                      style={{ ...styles.input, width: 'auto', minWidth: 150, cursor: 'pointer', fontSize: 12 }}
                    >
                      {GROUPS.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>

                    <button
                      onClick={() => removeRow(r.rowId)}
                      aria-label={`Remove ${r.item || 'this line'}`}
                      style={styles.remove}
                    >Remove</button>
                  </div>
                )
              })}
            </div>
          </Section>
        )
      })}

      <Section title="Add a checkpoint">
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 320px', minWidth: 220 }}>
            <label style={styles.label} htmlFor="chk-add">Checkpoint</label>
            <input
              id="chk-add"
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addRow() }}
              placeholder="Dryer vent — lint clear from trap to roof cap"
              style={styles.input}
            />
          </div>
          <div>
            <label style={styles.label} htmlFor="chk-add-group">System</label>
            <select
              id="chk-add-group"
              value={addGroup}
              onChange={(e) => setAddGroup(e.target.value)}
              style={{ ...styles.input, minWidth: 190, cursor: 'pointer' }}
            >
              {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <ActionButton variant="ghost" onClick={addRow}>Add</ActionButton>
        </div>
        {duplicates.size > 0 && (
          <p style={{ margin: '12px 0 0', fontSize: 12, color: '#b45309', lineHeight: 1.5 }}>
            {duplicates.size} checkpoint{duplicates.size === 1 ? ' is' : 's are'} written twice.
            A tech ticking the same line in two places is how a checklist stops being believed.
          </p>
        )}
      </Section>

      <Card>
        <h3 style={{ margin: '0 0 13px', fontSize: 13.5, fontWeight: 700, color: INK }}>
          What gets saved
        </h3>
        <Fields rows={[
          ['Name', title.trim() || '—'],
          ['Checkpoints', filled.length || '—'],
          ['Systems', used.length ? used.join(', ') : '—'],
          ['Filed under', <StatusBadge key="g" tone={used.length === 1 ? 'grey' : 'violet'}>
            {used.length === 1 ? used[0] : 'Multi-system'}
          </StatusBadge>],
          ['Estimated time', filled.length ? `${minutes} min (derived)` : '—'],
          ['Written by', USER.name],
        ]} />

        {showProblems && problems.length > 0 && (
          <p style={{
            margin: '16px 0 0', padding: '10px 12px', borderRadius: 9,
            background: '#fef2f2', border: '1px solid #fecaca',
            fontSize: 12.5, color: RED, lineHeight: 1.55,
          }}>
            Still missing: {problems.join(', ')}.
          </p>
        )}

        {!showProblems && filled.length >= SUITE_PM.checklist.length && (
          <p style={{ margin: '16px 0 0', fontSize: 12, color: GREEN, lineHeight: 1.5 }}>
            {filled.length} checkpoints — at least as thorough as the standing suite PM.
          </p>
        )}

        <div style={{ display: 'flex', gap: 9, marginTop: 18, flexWrap: 'wrap' }}>
          <ActionButton onClick={submit} disabled={!ready || saving}>
            {saving ? 'Saving…' : 'Save checklist'}
          </ActionButton>
          <ActionButton
            variant="ghost"
            onClick={() => router.push(`/portal/hospitality/${section}`)}
            disabled={saving}
          >Cancel</ActionButton>
          {!ready && (
            <span style={{ alignSelf: 'center', fontSize: 11.5, color: MUTE }}>
              Loading the register…
            </span>
          )}
        </div>
      </Card>
    </div>
  )
}

const styles = {
  label: {
    display: 'block', fontSize: 10.5, fontWeight: 700, color: MUTE,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5,
  },
  input: {
    width: '100%', padding: '9px 11px', fontSize: 13, fontFamily: 'inherit',
    color: INK, background: '#fff', border: `1px solid ${LINE}`,
    borderRadius: 9, outline: 'none',
  },
  chip: {
    padding: '8px 14px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
    cursor: 'pointer', borderRadius: 999, background: '#fff', color: SUB,
    border: `1px solid ${LINE}`,
  },
  chipOn: { background: ACCENT, color: '#fff', border: `1px solid ${ACCENT}` },
  nudge: {
    width: 22, height: 15, padding: 0, fontSize: 8, lineHeight: 1, fontFamily: 'inherit',
    cursor: 'pointer', borderRadius: 4, border: `1px solid ${LINE}`,
    background: '#fff', color: SUB,
  },
  remove: {
    padding: '6px 11px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
    cursor: 'pointer', borderRadius: 8, border: `1px solid ${LINE}`,
    background: '#fff', color: SUB,
  },
}
