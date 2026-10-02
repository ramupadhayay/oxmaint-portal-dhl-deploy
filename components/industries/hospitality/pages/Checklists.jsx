'use client'

// The suite PM checklist, and what has been run against it.
//
// Grouped by system rather than listed flat, because that is the order the walk
// happens in — a tech does the kitchen, then the HVAC, then the bathroom, and a
// list that alternates between them sends someone back and forth across a suite
// they are standing in the middle of.
//
// Ticking here writes the same records the daily schedule does, so a checklist
// completed from either screen shows as completed on both.

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Section, Card, StatusBadge, ActionButton, PALETTE,
} from '../lib/kit'
import { useRecords, useStore } from '../lib/store'
import { SUITE_PM, SUITES, USER, fmtDate } from '../lib/data'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN } = PALETTE

const GROUPS = ['Kitchen', 'HVAC', 'Bathroom', 'Safety', 'Fixtures']

const GROUP_NOTE = {
  Kitchen: 'Six checkpoints no limited-service room has — this is the extended-stay difference',
  HVAC: 'The PTAC is the single most common guest complaint on any hotel estate',
  Bathroom: 'Where a small leak becomes a ceiling in the suite below',
  Safety: 'Non-negotiable: a failed detector is a room out of service',
  Fixtures: 'Cheap to fix on a rotation, expensive as a guest complaint',
}

export default function Checklists() {
  const router = useRouter()
  const store = useStore()
  const update = store?.update
  const ready = Boolean(store?.ready)

  // The suite whose PM is being walked. Defaults to the first one due today, so
  // the screen opens on the job rather than on a picker.
  const dueToday = useMemo(() => SUITES.filter((s) => s.state === 'Due today'), [])
  const [suiteNo, setSuiteNo] = useState(() => (dueToday[0] || SUITES[0]).suite_number)
  const suite = useMemo(() => SUITES.find((s) => s.suite_number === suiteNo), [suiteNo])

  const runs = useRecords('hosp_checklist_run', [], (r) => r.recordId)
  const idFor = (item) => `chk_${suiteNo}_${item.replace(/\W+/g, '').slice(0, 24)}`
  const doneSet = useMemo(
    () => new Set(runs.filter((r) => r.done).map((r) => r.recordId)),
    [runs]
  )

  const toggle = useCallback((c) => {
    if (!ready || !update) return
    const id = idFor(c.item)
    update('hosp_checklist_run', id, {
      recordId: id,
      done: !doneSet.has(id),
      suite_number: suiteNo,
      group: c.group,
      title: c.item,
      completed_by: USER.name,
    })
  }, [ready, update, doneSet, suiteNo])

  const doneCount = SUITE_PM.checklist.filter((c) => doneSet.has(idFor(c.item))).length
  const pct = Math.round((doneCount / SUITE_PM.checklist.length) * 100)

  return (
    <div>
      <PageHeading
        title="Checklists"
        subtitle={`The ${SUITE_PM.checklist.length}-point guest suite PM — ${SUITE_PM.minutes} minutes a suite`}
        right={(
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={suiteNo}
            onChange={(e) => setSuiteNo(e.target.value)}
            style={{
              padding: '8px 11px', fontSize: 12.5, border: `1px solid ${LINE}`, borderRadius: 9,
              background: '#fff', color: ACCENT, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
            }}>
            {SUITES.map((s) => (
              <option key={s.suite_id} value={s.suite_number}>
                Suite {s.suite_number}{s.state === 'Due today' ? ' — due today' : s.state === 'Overdue' ? ' — overdue' : ''}
              </option>
            ))}
          </select>
          <ActionButton
            onClick={() => router.push('/portal/hospitality/checklists/new')}
            icon={(
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            )}
          >New checklist</ActionButton>
          </div>
        )}
      />

      <StatCards items={[
        { label: 'Checkpoints', value: SUITE_PM.checklist.length, note: `${GROUPS.length} systems` },
        { label: 'Done', value: doneCount, unit: `/ ${SUITE_PM.checklist.length}`, tone: pct === 100 ? 'green' : undefined, note: `${pct}% of this suite` },
        { label: 'Suite state', value: suite?.state === 'Done this cycle' ? 'Done' : suite?.state || '—', tone: suite?.state === 'Overdue' ? 'red' : suite?.state === 'Due today' ? 'amber' : undefined, note: `last ${fmtDate(suite?.last_pm_date)}` },
        { label: 'Due today', value: dueToday.length, note: 'on the rotation' },
      ]} />

      {GROUPS.map((g) => {
        const items = SUITE_PM.checklist.filter((c) => c.group === g)
        if (!items.length) return null
        const gDone = items.filter((c) => doneSet.has(idFor(c.item))).length
        return (
          <Section
            key={g}
            title={(
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {g}
                <StatusBadge tone={gDone === items.length ? 'green' : 'grey'}>{gDone}/{items.length}</StatusBadge>
              </span>
            )}
            right={<span style={{ fontSize: 11.5, color: MUTE }}>{GROUP_NOTE[g]}</span>}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {items.map((c) => {
                const done = doneSet.has(idFor(c.item))
                return (
                  <div key={c.item} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 2px', borderBottom: `1px solid ${LINE}` }}>
                    <button
                      onClick={() => toggle(c)}
                      disabled={!ready}
                      aria-pressed={done}
                      aria-label={done ? `Mark ${c.item} not done` : `Mark ${c.item} done`}
                      title={ready ? undefined : 'Loading what has already been done…'}
                      style={{
                        width: 19, height: 19, flexShrink: 0, padding: 0, fontFamily: 'inherit',
                        cursor: ready ? 'pointer' : 'progress', opacity: ready ? 1 : 0.45,
                        borderRadius: 5, border: `1.5px solid ${done ? GREEN : '#cbd5e1'}`,
                        background: done ? GREEN : '#fff', color: '#fff', fontSize: 12, lineHeight: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{done ? '✓' : ''}</button>
                    <span style={{ fontSize: 13, color: done ? MUTE : INK, textDecoration: done ? 'line-through' : 'none' }}>
                      {c.item}
                    </span>
                  </div>
                )
              })}
            </div>
          </Section>
        )
      })}

      <Card>
        <p style={{ margin: 0, fontSize: 12, color: MUTE, lineHeight: 1.55 }}>
          Six of the {SUITE_PM.checklist.length} are kitchen appliances. A limited-service room has none of
          them, which is why this checklist is nearly twice the usual length and why the
          rotation is the largest standing commitment on the property.
        </p>
      </Card>
    </div>
  )
}
