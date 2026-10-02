'use client'

// Raising a request — the front desk's screen, not the engineer's.
//
// Everything else in this portal is filled in by somebody who works in the
// department. This one is filled in by whoever is standing at the desk with a
// guest in front of them, and it is timed against that guest's patience. So the
// order of the fields is the order the conversation actually happens in: who is
// telling us, what they said, which suite, how bad.
//
// Source is first and it is not a dropdown. In the seeded register, priority
// follows the source rather than being chosen separately — a guest at the desk
// is High, a housekeeping note found on turn is not — and that rule is worth
// keeping visible rather than burying it behind a select the desk clerk will
// leave on its default. Choosing "front desk" raises the priority in front of
// them and says why; they can still override it, and once they do the source
// buttons stop moving it.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Section, Card, Fields,
  StatusBadge, Priority, ActionButton, PALETTE,
} from '../lib/kit'
import { useStore } from '../lib/store'
import { USER, SUITES, LOCATIONS, PLANT_ASSETS, fmtDate } from '../lib/data'

const { ACCENT, INK, SUB, MUTE, LINE, RED } = PALETTE

// The four the property actually raises from, in the order they raise them.
// `defaultPriority` is the seeded rule made explicit: guest-reported faults sit
// a band above everything else because somebody is waiting in the building.
const SOURCES = [
  {
    value: 'Front desk — guest',
    short: 'Front desk',
    defaultPriority: 'High',
    note: 'A guest is in the building, waiting for an answer',
  },
  {
    value: 'Housekeeping',
    short: 'Housekeeping',
    defaultPriority: 'Medium',
    note: 'Found on turn, before the next arrival walks in',
  },
  {
    value: 'Breakfast attendant',
    short: 'Breakfast',
    defaultPriority: 'Medium',
    note: 'Waffle irons, warmers, coffee — needed by 06:30',
  },
  {
    value: 'Night audit',
    short: 'Night audit',
    defaultPriority: 'Low',
    note: 'Found overnight, nobody on the floor until morning',
  },
]

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low']

const isGuest = (source) => String(source).startsWith('Front desk')

// Public areas, for a request that is not in a suite.
//
// LOCATIONS is filtered to this site, and the pack files "Public Areas &
// Fitness" and "Exterior & Grounds" under the sister properties — so that
// filter alone loses the lobby, the fitness room and the elevator, which are
// exactly what the front desk reports when it is not a room. The plant register
// knows where its assets stand, so the two are unioned. Level-2 entries are
// dropped: those are the per-floor suite ranges, and a request in a suite goes
// down the suite branch instead.
const PUBLIC_AREAS = [...new Set([
  ...LOCATIONS.filter((l) => l.level === 1).map((l) => l.name),
  ...PLANT_ASSETS.map((a) => a.location_name),
])].sort()

// Not a sequence. A running number would have to come from a count of what is
// already stored, and two people raising from the desk in the same minute would
// both read the same count and both write REQ-926. A wide band above the seeded
// range collides far less often than that race does, and the number is a
// reference to quote to a guest rather than a position in a ledger.
const nextNumber = () => `REQ-${1200 + Math.floor(Math.random() * 700)}`

export default function RequestCreate({ section = 'requests' }) {
  const router = useRouter()
  const store = useStore()
  const create = store?.create
  // False until the store's first fetch answers. A write before then is
  // silently lost — the optimistic row goes in and the load that lands after it
  // replaces the whole map — so every submit control on this page waits for it.
  // See the note at the top of DailySchedule.jsx; it was measured, not reasoned
  // about.
  const ready = Boolean(store?.ready)

  const [source, setSource] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [where, setWhere] = useState('suite')
  const [suiteNo, setSuiteNo] = useState('')
  const [area, setArea] = useState('')
  const [priority, setPriority] = useState('Medium')
  // Once the clerk has picked a priority by hand, the source buttons stop
  // overwriting it. A control that silently undoes what you just set is the
  // reason people stop trusting the rest of the form.
  const [priorityTouched, setPriorityTouched] = useState(false)
  const [showProblems, setShowProblems] = useState(false)
  const [saving, setSaving] = useState(false)

  const suite = useMemo(() => SUITES.find((s) => s.suite_number === suiteNo) || null, [suiteNo])
  const guest = isGuest(source)

  const chooseSource = (s) => {
    setSource(s.value)
    if (!priorityTouched) setPriority(s.defaultPriority)
  }

  // Said out loud rather than swallowed. A submit that does nothing is the
  // worst outcome on a form somebody is filling in with a guest watching.
  const problems = useMemo(() => {
    const out = []
    if (!source) out.push('who is reporting it')
    if (!title.trim()) out.push('what was reported')
    if (where === 'suite' && !suiteNo) out.push('which suite')
    if (where === 'area' && !area) out.push('which part of the property')
    return out
  }, [source, title, where, suiteNo, area])

  const submit = async () => {
    if (problems.length) { setShowProblems(true); return }
    if (!ready || !create || saving) return
    setSaving(true)

    const inSuite = where === 'suite'
    const record = await create('hosp_request', {
      request_number: nextNumber(),
      title: title.trim(),
      source,
      priority,
      suite_number: inSuite ? suiteNo : null,
      // Suite assets carry `Floor n` as their location, so a suite request is
      // filed the same way — otherwise the same fault reads under two different
      // location names depending on which screen raised it.
      location_name: inSuite ? `Floor ${suite?.floor}` : area,
      // The seeded register puts the source in `raised_by`, because the person
      // is the desk rather than a named individual. Kept, so new rows group
      // with the old ones in the Source filter.
      raised_by: source,
      raised_date: new Date().toISOString(),
      status: 'Open',
      description: description.trim(),
      logged_by: USER.name,
    })

    if (!record) { setSaving(false); return }
    // Back to the queue rather than to the new record: the desk raises these in
    // twos and threes, and what they need to see next is that it joined the
    // waiting list, not a detail page of what they just typed.
    router.push(`/portal/hospitality/${section}`)
  }

  return (
    <div>
      <PageHeading
        title="Raise a request"
        subtitle="What the desk, housekeeping or breakfast has just been told — before anyone decides it is a work order"
        back={{ label: 'Requests', onClick: () => router.push(`/portal/hospitality/${section}`) }}
      />

      <Section
        title="Who is reporting it"
        right={<span style={{ fontSize: 11.5, color: MUTE }}>Sets the starting urgency</span>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }}>
          {SOURCES.map((s) => {
            const on = source === s.value
            return (
              <button
                key={s.value}
                onClick={() => chooseSource(s)}
                style={{
                  textAlign: 'left', padding: '12px 13px', fontFamily: 'inherit', cursor: 'pointer',
                  borderRadius: 11, background: on ? '#f5f7ff' : '#fff',
                  border: `1.5px solid ${on ? ACCENT : LINE}`,
                }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 700, color: on ? ACCENT : INK }}>{s.short}</div>
                <div style={{ fontSize: 11.5, color: SUB, marginTop: 4, lineHeight: 1.45 }}>{s.note}</div>
              </button>
            )
          })}
        </div>

        {guest && (
          <p style={{
            margin: '13px 0 0', padding: '10px 12px', borderRadius: 9,
            background: '#fef2f2', border: '1px solid #fecaca',
            fontSize: 12, color: '#b91c1c', lineHeight: 1.55,
          }}>
            Guest-reported, so this starts at <strong>{priorityTouched ? priority : 'High'}</strong>.
            Somebody is in the building waiting on it, and these are the ones that become reviews
            if they sit in the queue overnight.
          </p>
        )}
      </Section>

      <Section title="What was reported">
        <label style={styles.label} htmlFor="req-title">In their words</label>
        <input
          id="req-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Guest reports the AC not cooling"
          style={styles.input}
        />

        <label style={{ ...styles.label, marginTop: 15 }} htmlFor="req-desc">
          Anything else worth knowing
        </label>
        <textarea
          id="req-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Since check-in yesterday. Guest is happy to have someone in the suite while they are out."
          style={{ ...styles.input, resize: 'vertical', lineHeight: 1.55 }}
        />
        <p style={{ margin: '7px 0 0', fontSize: 11.5, color: MUTE, lineHeight: 1.5 }}>
          Optional, and worth ten seconds: whether the guest is in the room decides whether the
          tech can go straight up or has to wait for a turn.
        </p>
      </Section>

      <Section title="Where">
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {[['suite', 'In a suite'], ['area', 'Somewhere else on the property']].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setWhere(v)}
              style={{
                padding: '7px 13px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
                cursor: 'pointer', borderRadius: 999,
                background: where === v ? ACCENT : '#fff',
                color: where === v ? '#fff' : SUB,
                border: `1px solid ${where === v ? ACCENT : LINE}`,
              }}
            >{label}</button>
          ))}
        </div>

        {where === 'suite' ? (
          <>
            <label style={styles.label} htmlFor="req-suite">Suite</label>
            <select
              id="req-suite"
              value={suiteNo}
              onChange={(e) => setSuiteNo(e.target.value)}
              style={{ ...styles.input, cursor: 'pointer', maxWidth: 360 }}
            >
              <option value="">Choose a suite…</option>
              {SUITES.map((s) => (
                <option key={s.suite_id} value={s.suite_number}>
                  Suite {s.suite_number} — floor {s.floor}, {s.suite_type}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <label style={styles.label} htmlFor="req-area">Part of the property</label>
            <select
              id="req-area"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              style={{ ...styles.input, cursor: 'pointer', maxWidth: 360 }}
            >
              <option value="">Choose a location…</option>
              {PUBLIC_AREAS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </>
        )}
      </Section>

      {/* Only once a suite is named, and not decoration: whether the room is
          occupied tonight is what decides if this can be walked up to now or
          has to wait for the guest to go out, and an overdue PM on the same
          suite is often the reason the fault is there at all. */}
      {suite && (
        <StatCards items={[
          {
            label: 'Suite',
            value: suite.suite_number,
            note: `${suite.suite_type}, floor ${suite.floor}${suite.pet_friendly ? ', pet friendly' : ''}`,
          },
          {
            label: 'Occupied tonight',
            value: suite.occupied ? 'Yes' : 'No',
            tone: suite.occupied ? 'amber' : 'green',
            note: suite.occupied ? 'access has to be arranged' : 'vacant — a job can run long',
          },
          {
            label: 'PM state',
            value: suite.state === 'Done this cycle' ? 'Done' : suite.state,
            tone: suite.state === 'Overdue' ? 'red' : suite.state === 'Due today' ? 'amber' : undefined,
            note: `last walked ${fmtDate(suite.last_pm_date)}`,
          },
          {
            label: 'Next on rotation',
            value: suite.due_in_days < 0 ? `${suite.overdue_days}d late` : `${suite.due_in_days}d`,
            tone: suite.due_in_days < 0 ? 'red' : undefined,
            note: fmtDate(suite.next_pm_date),
          },
        ]} />
      )}

      <Section
        title="How urgent"
        right={<span style={{ fontSize: 11.5, color: MUTE }}>
          {priorityTouched ? 'Set by hand' : 'Following the source'}
        </span>}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PRIORITIES.map((p) => {
            const on = priority === p
            return (
              <button
                key={p}
                onClick={() => { setPriority(p); setPriorityTouched(true) }}
                style={{
                  padding: '8px 14px', fontFamily: 'inherit', cursor: 'pointer', borderRadius: 9,
                  background: on ? '#f5f7ff' : '#fff',
                  border: `1.5px solid ${on ? ACCENT : LINE}`,
                }}
              ><Priority value={p} /></button>
            )
          })}
        </div>
        {guest && priority === 'Low' && (
          <p style={{ margin: '12px 0 0', fontSize: 12, color: '#b45309', lineHeight: 1.5 }}>
            Low, from a guest standing at the desk. That is allowed — but it will sit below
            housekeeping's notes in the triage queue, so say in the description why it can wait.
          </p>
        )}
      </Section>

      <Card>
        <h3 style={{ margin: '0 0 13px', fontSize: 13.5, fontWeight: 700, color: INK }}>
          What gets raised
        </h3>
        <Fields rows={[
          ['Source', source ? <StatusBadge key="s" tone={guest ? 'red' : 'grey'}>{source}</StatusBadge> : '—'],
          ['Reported', title.trim() || '—'],
          ['Suite', where === 'suite' ? (suiteNo || '—') : '—'],
          ['Location', where === 'suite' ? (suite ? `Floor ${suite.floor}` : '—') : (area || '—')],
          ['Priority', <Priority key="p" value={priority} />],
          ['Status', <StatusBadge key="st">Open</StatusBadge>],
        ]} />

        {showProblems && problems.length > 0 && (
          <p style={{
            margin: '16px 0 0', padding: '10px 12px', borderRadius: 9,
            background: '#fef2f2', border: `1px solid #fecaca`,
            fontSize: 12.5, color: RED, lineHeight: 1.55,
          }}>
            Still missing: {problems.join(', ')}.
          </p>
        )}

        <div style={{ display: 'flex', gap: 9, marginTop: 18, flexWrap: 'wrap' }}>
          <ActionButton onClick={submit} disabled={!ready || saving}>
            {saving ? 'Raising…' : 'Raise request'}
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
}
