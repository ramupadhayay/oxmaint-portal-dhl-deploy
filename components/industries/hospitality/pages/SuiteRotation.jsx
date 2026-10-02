'use client'

// Suite Rotation — all 98 suites, and where the cycle has got to.
//
// The board exists because the daily schedule cannot answer "are we keeping
// up". Two suites a day looks fine every single day right up until the quarter
// ends with nineteen never touched, and the only view that catches that is one
// showing every suite at once.
//
// Coverage is measured against where the rotation *should* be today, not
// against the whole cycle. "38% done" on day 34 of 91 reads as failing and is
// in fact one suite ahead; the honest comparison is the one drawn here.

import { useMemo, useState } from 'react'
import {
  PageHeading, StatCards, Section, Card, Drawer, Fields, Toolbar,
  StatusBadge, PALETTE,
} from '../lib/kit'
import { fmtDate, SUITE_PM, CYCLE_DAYS } from '../lib/data'
import { weekAhead } from '../lib/schedule'
import { useSuites, useRotation } from '../lib/live'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, AMBER, RED } = PALETTE

const STATE_STYLE = {
  Overdue: { bg: '#fef2f2', bd: '#fca5a5', fg: '#b91c1c' },
  'Due today': { bg: '#fffbeb', bd: '#fcd34d', fg: '#b45309' },
  'Done this cycle': { bg: '#ecfdf5', bd: '#a7f3d0', fg: '#047857' },
  Scheduled: { bg: '#fff', bd: '#e2e8f0', fg: '#64748b' },
}

const STATE_ORDER = ['Overdue', 'Due today', 'Scheduled', 'Done this cycle']

export default function SuiteRotation() {
  // The live suites, so a PM ticked on the schedule shows here as done rather
  // than the board and the schedule disagreeing about the same suite.
  const SUITES = useSuites()
  const ROTATION = useRotation(SUITES)
  const WEEK_AHEAD = useMemo(() => weekAhead(SUITES), [SUITES])
  const [q, setQ] = useState('')
  const [state, setState] = useState('all')
  const [floor, setFloor] = useState('all')
  const [open, setOpen] = useState(null)

  const shown = useMemo(() => SUITES.filter((s) => {
    if (state !== 'all' && s.state !== state) return false
    if (floor !== 'all' && String(s.floor) !== floor) return false
    if (q && !`${s.suite_number} ${s.suite_type}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
    // SUITES belongs in here. It used to be a module constant, so leaving it
    // out was harmless; now it is a hook result that changes when a PM is
    // recorded, and a memo that does not list it never re-runs — the record
    // reached the store and the board went on drawing the old state.
  }), [SUITES, q, state, floor])

  const floors = [...new Set(SUITES.map((s) => s.floor))].sort()
  const ahead = ROTATION.done - ROTATION.expected

  return (
    <div>
      <PageHeading
        title="Suite Rotation"
        subtitle={`${ROTATION.total} suites on a ${CYCLE_DAYS}-day cycle · day ${ROTATION.cyclePosition} of ${CYCLE_DAYS}`}
      />

      <StatCards items={[
        { label: 'Done this cycle', value: ROTATION.done, unit: `/ ${ROTATION.total}`, tone: 'green' },
        {
          label: 'Against plan',
          value: `${ahead >= 0 ? '+' : ''}${ahead}`,
          note: ahead >= 0 ? `ahead of day ${ROTATION.cyclePosition}` : `behind day ${ROTATION.cyclePosition}`,
          tone: ahead >= 0 ? 'green' : 'amber',
        },
        { label: 'Overdue', value: ROTATION.overdue, note: ROTATION.overdue ? 'carried into the schedule' : 'none slipped', tone: ROTATION.overdue ? 'red' : 'green' },
        { label: 'Due today', value: ROTATION.dueToday, note: `${ROTATION.perDay}/day holds the cycle` },
      ]} />

      {/* Progress against the cycle, with a marker for where today should be.
          The bar alone would say 38%; the marker is what makes 38% mean
          something. */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>Cycle progress</span>
          <span style={{ fontSize: 12, color: SUB }}>
            {ROTATION.coverage}% of suites done · plan says {Math.round((ROTATION.expected / ROTATION.total) * 100)}%
          </span>
        </div>
        <div style={{ position: 'relative', height: 14, background: '#f1f5f9', borderRadius: 999 }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${(ROTATION.done / ROTATION.total) * 100}%`,
            background: GREEN, borderRadius: 999, transition: 'width .3s',
          }} />
          <div
            title={`Plan: ${ROTATION.expected} suites by day ${ROTATION.cyclePosition}`}
            style={{
              position: 'absolute', top: -4, bottom: -4,
              left: `${(ROTATION.expected / ROTATION.total) * 100}%`,
              width: 2, background: INK, borderRadius: 2,
            }} />
        </div>
        <div style={{ fontSize: 11.5, color: MUTE, marginTop: 7 }}>
          The marker is where the rotation should stand on day {ROTATION.cyclePosition} of {CYCLE_DAYS}.
        </div>
      </Card>

      <Toolbar
        search={q}
        onSearch={setQ}
        placeholder="Suite number or type…"
        filters={[
          { label: 'State', value: state, onChange: setState, options: STATE_ORDER },
          { label: 'Floor', value: floor, onChange: setFloor, options: floors.map(String) },
        ]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{shown.length} of {SUITES.length}</span>}
      />

      {floors.map((f) => {
        const onFloor = shown.filter((s) => s.floor === f)
        if (!onFloor.length) return null
        return (
          <Section
            key={f}
            title={`Floor ${f}`}
            right={<span style={{ fontSize: 11.5, color: MUTE }}>{onFloor.length} suites</span>}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))', gap: 7 }}>
              {onFloor.map((s) => {
                const st = STATE_STYLE[s.state] || STATE_STYLE.Scheduled
                return (
                  <button
                    key={s.suite_id}
                    onClick={() => setOpen(s)}
                    title={`${s.suite_type} · ${s.state} · next ${fmtDate(s.next_pm_date)}`}
                    style={{
                      padding: '9px 6px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                      background: st.bg, border: `1px solid ${st.bd}`, color: st.fg,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                      transition: 'transform .12s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'none' }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em' }}>{s.suite_number}</span>
                    <span style={{ fontSize: 9.5, fontWeight: 600, opacity: 0.85 }}>
                      {s.state === 'Overdue' ? `${s.overdue_days}d late`
                        : s.state === 'Due today' ? 'today'
                          : s.state === 'Done this cycle' ? 'done'
                            : `${s.due_in_days}d`}
                    </span>
                  </button>
                )
              })}
            </div>
          </Section>
        )
      })}

      {!shown.length && (
        <Card><p style={{ margin: 0, fontSize: 13, color: MUTE }}>No suites match these filters.</p></Card>
      )}

      <Section title="Next seven days" right={<span style={{ fontSize: 11.5, color: MUTE }}>Suites coming up, and the shift each day carries</span>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 8 }}>
          {WEEK_AHEAD.map((d) => {
            const date = new Date(d.date)
            return (
              <div key={d.offset} style={{
                border: `1px solid ${LINE}`, borderRadius: 10, padding: '10px 8px', textAlign: 'center',
                background: d.offset === 0 ? '#f8fafc' : '#fff',
              }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {d.offset === 0 ? 'Today' : date.toLocaleDateString('en-GB', { weekday: 'short' })}
                </div>
                <div style={{ fontSize: 19, fontWeight: 800, color: INK, marginTop: 3 }}>{d.suites}</div>
                <div style={{ fontSize: 10.5, color: MUTE }}>suite{d.suites === 1 ? '' : 's'}</div>
                <div style={{ fontSize: 10.5, color: SUB, marginTop: 4, fontWeight: 600 }}>
                  {Math.floor(d.minutes / 60)}h{String(d.minutes % 60).padStart(2, '0')}
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open ? `Suite ${open.suite_number}` : ''}
        subtitle={open ? `${open.suite_type} · Floor ${open.floor}` : ''}
        width={460}
      >
        {open && (
          <div>
            <Fields rows={[
              ['State', <StatusBadge key="s" tone={open.state === 'Overdue' ? 'red' : open.state === 'Due today' ? 'amber' : open.state === 'Done this cycle' ? 'green' : 'grey'}>{open.state}</StatusBadge>],
              ['Suite type', open.suite_type],
              ['Pet friendly', open.pet_friendly ? 'Yes' : 'No'],
              ['Rotation slot', `${open.rotation_slot + 1} of ${SUITES.length}`],
              ['Last PM', fmtDate(open.last_pm_date)],
              ['Next due', fmtDate(open.next_pm_date)],
              ['Cycle day', `${open.cycle_day} of ${CYCLE_DAYS}`],
              ['PM length', `${SUITE_PM.minutes} min · ${SUITE_PM.checklist.length} checkpoints`],
            ]} />

            {open.state === 'Overdue' && (
              <p style={{
                margin: '16px 0 0', padding: '10px 12px', borderRadius: 9,
                background: '#fef2f2', border: '1px solid #fecaca',
                fontSize: 12, color: '#b91c1c', lineHeight: 1.5,
              }}>
                Missed its rotation date {open.overdue_days} day{open.overdue_days === 1 ? '' : 's'} ago.
                It is carried at the top of the daily schedule until it is done.
              </p>
            )}

            <h4 style={{ margin: '20px 0 8px', fontSize: 12.5, fontWeight: 700, color: INK }}>PM checklist</h4>
            {['Kitchen', 'HVAC', 'Bathroom', 'Safety', 'Fixtures'].map((group) => {
              const items = SUITE_PM.checklist.filter((c) => c.group === group)
              if (!items.length) return null
              return (
                <div key={group} style={{ marginBottom: 11 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
                    {group} <span style={{ color: '#cbd5e1' }}>{items.length}</span>
                  </div>
                  {items.map((c) => (
                    <div key={c.item} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: SUB, padding: '2px 0' }}>
                      <span style={{ color: MUTE }}>·</span>{c.item}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </Drawer>
    </div>
  )
}
