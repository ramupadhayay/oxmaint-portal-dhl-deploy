'use client'

// The compliance log — the half of the schedule somebody else asks to see.
//
// Pool chemistry is a Delaware public-pool requirement, fire extinguishers are
// NFPA 10, emergency lighting is life safety, and a Marriott QA audit asks for
// all three. None of it is optional and none of it is interesting, which is
// exactly why it gets skipped on a busy day and why a gap only surfaces when an
// inspector is standing in the lobby.
//
// So the screen leads with the gap, not the history: what is due today and not
// yet logged, then how many days each has been running unbroken.
//
// Nothing here is a legal record. It is a demo of what the log would look like —
// the readings below are entered by whoever is using it, and the streaks are
// counted from those entries only.

import { useCallback, useMemo, useState } from 'react'
import {
  PageHeading, StatCards, Section, Card, DataTable,
  StatusBadge, ActionButton, PALETTE,
} from '../lib/kit'
import { useRecords, useStore } from '../lib/store'
import { ROUNDS, USER, fmtDate } from '../lib/data'
import { roundDueToday, roundNextIn } from '../lib/schedule'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, RED } = PALETTE

const COMPLIANCE_ROUNDS = ROUNDS.filter((r) => r.compliance)
const todayKey = () => new Date().toISOString().slice(0, 10)

export default function Compliance() {
  const store = useStore()
  const update = store?.update
  const ready = Boolean(store?.ready)
  const [ph, setPh] = useState('7.4')
  const [cl, setCl] = useState('2.0')

  const logs = useRecords('hosp_compliance_log', [], (r) => r.recordId)

  const loggedToday = useMemo(() => {
    const t = todayKey()
    return new Set(logs.filter((l) => l.date === t).map((l) => l.round_key))
  }, [logs])

  const logIt = useCallback((r, extra = {}) => {
    if (!ready || !update) return
    const id = `log_${todayKey()}_${r.key}`
    update('hosp_compliance_log', id, {
      recordId: id,
      round_key: r.key,
      date: todayKey(),
      title: r.label,
      requirement: r.compliance,
      logged_by: USER.name,
      logged_at: new Date().toISOString(),
      ...extra,
    })
  }, [ready, update])

  const dueNotLogged = COMPLIANCE_ROUNDS.filter((r) => roundDueToday(r) && !loggedToday.has(r.key))

  const rows = useMemo(() => [...logs]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((l) => ({ ...l, id: l.recordId })), [logs])

  const columns = [
    { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
    { key: 'title', label: 'Check', render: (r) => <span style={{ color: INK }}>{r.title}</span> },
    { key: 'requirement', label: 'Requirement', render: (r) => <StatusBadge tone="blue">{r.requirement}</StatusBadge> },
    {
      key: 'reading',
      label: 'Reading',
      render: (r) => (r.ph ? <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5 }}>pH {r.ph} · Cl {r.chlorine} ppm</span> : '—'),
    },
    { key: 'logged_by', label: 'By' },
  ]

  return (
    <div>
      <PageHeading
        title="Compliance Log"
        subtitle="Pool chemistry, life safety and the records an inspector asks for"
      />

      <StatCards items={[
        { label: 'Tracked checks', value: COMPLIANCE_ROUNDS.length, note: 'carry an external requirement' },
        { label: 'Due today', value: COMPLIANCE_ROUNDS.filter(roundDueToday).length, note: 'on the schedule now' },
        {
          label: 'Not yet logged',
          value: dueNotLogged.length,
          tone: dueNotLogged.length ? 'red' : 'green',
          note: dueNotLogged.length ? 'gap in today’s record' : 'today is complete',
        },
        { label: 'Entries', value: logs.length, note: 'logged in this demo' },
      ]} />

      <Section
        title="Due today"
        right={<span style={{ fontSize: 11.5, color: MUTE }}>A day these are missed is a hole in the log</span>}
      >
        {COMPLIANCE_ROUNDS.filter(roundDueToday).length === 0 && (
          <p style={{ margin: 0, fontSize: 12.5, color: MUTE }}>None of the tracked checks fall today.</p>
        )}
        {COMPLIANCE_ROUNDS.filter(roundDueToday).map((r) => {
          const done = loggedToday.has(r.key)
          return (
            <div key={r.key} style={{ borderBottom: `1px solid ${LINE}`, padding: '11px 2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ flex: '1 1 220px', minWidth: 0, fontSize: 13, fontWeight: 600, color: done ? MUTE : INK }}>
                  {r.label}
                </span>
                <StatusBadge tone="blue">{r.compliance}</StatusBadge>
                {done
                  ? <StatusBadge tone="green">Logged</StatusBadge>
                  : <StatusBadge tone="red">Not logged</StatusBadge>}
              </div>

              {/* The pool is the one that takes a reading rather than a tick. A
                  log that only says "checked" answers nothing an inspector asked. */}
              {r.key === 'pool' ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 9, flexWrap: 'wrap' }}>
                  <Num label="pH" value={ph} onChange={setPh} />
                  <Num label="Chlorine ppm" value={cl} onChange={setCl} />
                  <ActionButton size="sm" disabled={!ready || done} onClick={() => logIt(r, { ph, chlorine: cl })}>
                    {done ? 'Logged' : 'Log reading'}
                  </ActionButton>
                  <span style={{ fontSize: 11.5, color: MUTE }}>
                    Normal: pH 7.2–7.8 · chlorine 1–4 ppm
                  </span>
                </div>
              ) : (
                <div style={{ marginTop: 9 }}>
                  <ActionButton size="sm" variant="secondary" disabled={!ready || done} onClick={() => logIt(r)}>
                    {done ? 'Logged' : 'Log as done'}
                  </ActionButton>
                </div>
              )}
            </div>
          )
        })}
      </Section>

      <Section title="Coming up" right={<span style={{ fontSize: 11.5, color: MUTE }}>So a gap is visible before it becomes one</span>}>
        {COMPLIANCE_ROUNDS.filter((r) => !roundDueToday(r)).map((r) => (
          <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 2px', flexWrap: 'wrap' }}>
            <span style={{ flex: '1 1 220px', minWidth: 0, fontSize: 12.5, color: INK }}>{r.label}</span>
            <span style={{ fontSize: 11.5, color: MUTE }}>{r.compliance}</span>
            <StatusBadge tone={roundNextIn(r) <= 1 ? 'amber' : 'grey'}>
              {roundNextIn(r) === 1 ? 'tomorrow' : `in ${roundNextIn(r)} days`}
            </StatusBadge>
          </div>
        ))}
      </Section>

      <Section title="Log" right={<span style={{ fontSize: 11.5, color: MUTE }}>{logs.length} entries</span>}>
        {logs.length
          ? <DataTable columns={columns} rows={rows} pageSize={10} empty="Nothing logged yet." />
          : (
            <p style={{ margin: 0, fontSize: 12.5, color: MUTE, lineHeight: 1.55 }}>
              Nothing logged yet. Entries made above appear here and survive a reload —
              which is the whole point of a log, and the thing a clipboard by the pool
              gate cannot do when the inspector wants six months of it.
            </p>
          )}
      </Section>

      <Card>
        <p style={{ margin: 0, fontSize: 11.5, color: MUTE, lineHeight: 1.55 }}>
          Demonstration only. Nothing recorded here is a legal record, and the
          requirements named beside each check are the ones a property of this type
          is generally subject to — the property&rsquo;s own obligations should be
          confirmed against its permits before this is relied on.
        </p>
      </Card>
    </div>
  )
}

function Num({ label, value, onChange }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: SUB }}>
      {label}
      <input
        type="number" step="0.1" value={value} onChange={(e) => onChange(e.target.value)}
        style={{
          width: 72, padding: '6px 8px', fontSize: 12.5, fontFamily: 'inherit',
          border: `1px solid ${LINE}`, borderRadius: 8, outline: 'none', color: INK,
        }}
      />
    </label>
  )
}
