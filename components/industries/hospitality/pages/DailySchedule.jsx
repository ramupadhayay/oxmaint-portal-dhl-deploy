'use client'

// Today's Schedule — the screen the module exists for.
//
// "I need to be able to hand my maint staff a daily schedule." Everything else
// in this portal answers what exists; this answers what one person does today,
// in the order they should do it, and whether it fits in a shift.
//
// Three decisions worth keeping:
//
// The order is not a preference. Catch-up first because an overdue suite is the
// only line here that is already a failure. Rounds next because the compliance
// ones are a dated log an inspector will ask for, and a day they are skipped is
// a hole in it. Rotation after that. The backlog last — it is the only part that
// can honestly be moved, so it is the part shown as movable.
//
// The time budget is the whole argument. A schedule that does not add up is the
// spreadsheet this replaces: it looks complete and quietly hands someone eleven
// hours of work. The bar is the answer to "can this actually be done today".
//
// It prints. The request was to *hand* someone a schedule, and at a property
// with two technicians and no tablets that means paper.

import { useCallback, useMemo, useState } from 'react'
import {
  PageHeading, StatCards, Section, Card, Drawer, Fields,
  StatusBadge, ActionButton, PALETTE,
} from '../lib/kit'
import { useRecords, useStore } from '../lib/store'
import { useSuites, useRotation } from '../lib/live'
import { ORG, USER, fmtDate, SUITE_PM } from '../lib/data'
import { scheduleFor, UPCOMING_COMPLIANCE } from '../lib/schedule'
import { schedulePdf } from '../lib/schedulePdf'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, AMBER, RED } = PALETTE

const TONE_BAR = { red: RED, amber: AMBER, indigo: ACCENT, blue: '#3b82f6' }

const dayKey = (iso) => iso.slice(0, 10)
const idFor = (iso, itemKey) => `sch_${dayKey(iso)}_${itemKey}`
const hhmm = (mins) => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function DailySchedule() {
  // `ready` is false until the store's first fetch answers. Ticking before then
  // is silently lost — the optimistic row goes in, the load that lands after it
  // replaces the whole map, and nothing was written. Measured, not reasoned
  // about: a click 200ms after the checkboxes paint left no row in the database
  // and no error anywhere. A control that does nothing is worse than one that
  // says it is not ready yet, so the boxes wait.
  const store = useStore()
  const update = store?.update
  const ready = Boolean(store?.ready)
  const [offset, setOffset] = useState(0)
  const [openSuite, setOpenSuite] = useState(null)

  // Live suites, so a PM ticked here leaves the catch-up queue and shows as
  // done on the rotation board — rather than drawing a line through one row
  // and changing nothing else.
  const suites = useSuites()
  const ROTATION = useRotation(suites)
  const day = useMemo(() => scheduleFor(offset, suites), [offset, suites])

  // Ticks are records like anything else, so a schedule walked this morning is
  // still walked after a reload and on the next person's screen.
  const ticks = useRecords('hosp_schedule_item', [], (r) => r.recordId)
  const doneSet = useMemo(
    () => new Set(ticks.filter((t) => t.done).map((t) => t.recordId)),
    [ticks]
  )

  // Ticking a line does the thing the line describes, not just the tick.
  //
  // A suite PM records the PM against that suite, which moves its rotation
  // date. A work order line closes the work order. A compliance round writes
  // the log entry an inspector asks for. Without this the tick was cosmetic:
  // the schedule said done and every other screen still said overdue.
  const toggle = useCallback((item) => {
    if (!ready || !update) return
    const id = idFor(day.date, item.key)
    const now = !doneSet.has(id)

    update('hosp_schedule_item', id, {
      recordId: id,
      done: now,
      date: dayKey(day.date),
      item_key: item.key,
      title: item.label,
      minutes: item.minutes,
      completed_by: USER.name,
    })

    if (item.suite) {
      const pmId = `spm_${item.suite.suite_number}_${dayKey(day.date)}`
      update('hosp_suite_pm', pmId, {
        recordId: pmId,
        suite_number: item.suite.suite_number,
        // Cleared rather than deleted when un-ticked, so the rotation goes back
        // to where it was instead of the row lingering as a completion.
        completed_date: now ? day.date : null,
        checkpoints: SUITE_PM.checklist.length,
        title: `Suite ${item.suite.suite_number} — quarterly PM`,
        completed_by: USER.name,
      })
    }

    if (item.workOrder) {
      update('hosp_work_order', item.workOrder.workorder_id, {
        recordId: item.workOrder.workorder_id,
        status: now ? 'Completed' : 'Open',
        completed_date: now ? day.date : null,
        closed_by: USER.name,
      })
    }

    if (item.compliance) {
      const logId = `log_${dayKey(day.date)}_${item.key}`
      update('hosp_compliance_log', logId, {
        recordId: logId,
        round_key: item.key,
        date: dayKey(day.date),
        title: item.label,
        requirement: item.compliance,
        logged_by: USER.name,
        cleared: !now,
      })
    }
  }, [day.date, doneSet, update, ready])

  const doneMinutes = day.groups
    .flatMap((g) => g.items)
    .filter((i) => doneSet.has(idFor(day.date, i.key)))
    .reduce((n, i) => n + i.minutes, 0)

  const doneCount = day.groups
    .flatMap((g) => g.items)
    .filter((i) => doneSet.has(idFor(day.date, i.key))).length

  const complianceCount = day.groups
    .flatMap((g) => g.items)
    .filter((i) => i.compliance).length

  const d = new Date(day.date)
  const when = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : WEEKDAY[d.getDay()]

  return (
    <div>
      {/* The chrome is hidden by the shell's own print rule, and the day picker
          and Print button by `.ox-noprint`. What is left is the schedule, which
          flows and paginates normally — which is the whole reason this is not
          done with `visibility: hidden` any more. */}
      <style>{`
        @media print {
          .ox-sched-group { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <PageHeading
        title="Today's Schedule"
        subtitle={`${when} · ${fmtDate(day.date)} · ${day.technician?.name || 'Unassigned'}`}
        right={(
          <div className="ox-noprint" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', border: `1px solid ${LINE}`, borderRadius: 9, overflow: 'hidden' }}>
              <DayBtn disabled={offset === 0} onClick={() => setOffset(offset - 1)}>‹</DayBtn>
              <button
                onClick={() => setOffset(0)}
                style={{
                  padding: '7px 12px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                  border: 'none', borderLeft: `1px solid ${LINE}`, borderRight: `1px solid ${LINE}`,
                  background: offset === 0 ? '#f8fafc' : '#fff', color: ACCENT, cursor: 'pointer',
                }}>{when}</button>
              <DayBtn disabled={offset >= 6} onClick={() => setOffset(offset + 1)}>›</DayBtn>
            </div>
            {/* A file, not a print dialog. The request was to hand somebody a
                schedule: a PDF can be printed, mailed to the tech who is off
                today, or kept as the record of what the shift was asked to do.
                A print dialog leaves nothing behind and looks like whatever
                the machine's page settings happen to be. */}
            <ActionButton
              onClick={() => schedulePdf(day, { org: ORG, doneSet, idFor })}
              icon={(
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M12 18v-6M9 15l3 3 3-3" />
                </svg>
              )}
            >
              Download PDF
            </ActionButton>
          </div>
        )}
      />

      <StatCards items={[
        { label: 'Items', value: day.itemCount, note: `${doneCount} done` },
        { label: 'Time planned', value: hhmm(day.totalMinutes), note: `of ${hhmm(day.shiftMinutes)} shift`, tone: day.fits ? undefined : 'red' },
        { label: 'Suites due', value: day.groups.find((g) => g.key === 'rotation')?.items.length || 0, note: `${ROTATION.perDay}/day keeps the cycle` },
        { label: 'Compliance', value: complianceCount, note: complianceCount ? 'logged today' : 'none due today', tone: complianceCount ? 'blue' : undefined },
      ]} />

      {/* The time budget. Two bars on one track: what is done, and what is
          planned behind it — so progress and the total read together. */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>Shift budget</span>
          <span style={{ fontSize: 12, color: day.fits ? SUB : RED, fontWeight: day.fits ? 500 : 700 }}>
            {day.fits
              ? `${hhmm(day.shiftMinutes - day.totalMinutes)} spare`
              : `${hhmm(day.totalMinutes - day.shiftMinutes)} over — something has to move`}
          </span>
        </div>
        <div style={{ position: 'relative', height: 12, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', inset: 0, width: `${Math.min(100, (day.totalMinutes / day.shiftMinutes) * 100)}%`,
            background: day.fits ? '#dbeafe' : '#fecaca', transition: 'width .3s',
          }} />
          <div style={{
            position: 'absolute', inset: 0, width: `${Math.min(100, (doneMinutes / day.shiftMinutes) * 100)}%`,
            background: GREEN, borderRadius: 999, transition: 'width .3s',
          }} />
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11.5, color: MUTE }}>
          <Legend colour={GREEN}>Done {hhmm(doneMinutes)}</Legend>
          <Legend colour={day.fits ? '#dbeafe' : '#fecaca'}>Planned {hhmm(day.totalMinutes)}</Legend>
        </div>
      </Card>

      <div id="ox-sched">
        {/* A heading that only appears on paper — the printout has no top bar to
            say whose day it is. The `.ox-printonly` rule lives in the shell, so
            this carries no inline `display: none` of its own: an inline style
            outranks a stylesheet, and the print rule could never turn it back
            on. That is why the block was invisible on paper before. */}
        <div className="ox-printonly">
          <h2 style={{ margin: '0 0 4px', fontSize: 18, color: INK }}>
            Maintenance schedule — {fmtDate(day.date)}
          </h2>
          <p style={{ margin: '0 0 16px', fontSize: 12, color: SUB }}>
            {day.technician?.name || 'Unassigned'} · {hhmm(day.totalMinutes)} planned of {hhmm(day.shiftMinutes)}
          </p>
        </div>

        {day.groups.map((g) => (
          <Section
            key={g.key}
            title={(
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 3, height: 15, borderRadius: 2, background: TONE_BAR[g.tone] || ACCENT }} />
                {g.title}
                <span style={{ fontSize: 11, fontWeight: 600, color: MUTE }}>{g.items.length}</span>
              </span>
            )}
            right={<span style={{ fontSize: 11.5, color: MUTE }}>{g.note}</span>}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {g.items.map((item) => {
                const done = doneSet.has(idFor(day.date, item.key))
                return (
                  <ScheduleRow
                    key={item.key}
                    item={item}
                    done={done}
                    ready={ready}
                    onToggle={() => toggle(item)}
                    onOpen={item.suite ? () => setOpenSuite(item.suite) : null}
                  />
                )
              })}
            </div>
          </Section>
        ))}

        {!day.groups.length && (
          <Card><p style={{ margin: 0, fontSize: 13, color: MUTE }}>Nothing scheduled for this day.</p></Card>
        )}
      </div>

      {UPCOMING_COMPLIANCE.length > 0 && (
        <Section
          title="Compliance rounds not due today"
          right={<span style={{ fontSize: 11.5, color: MUTE }}>So a gap is visible before it becomes one</span>}
          style={{ marginTop: 4 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {UPCOMING_COMPLIANCE.map((r) => (
              <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, color: INK, flex: '1 1 240px', minWidth: 0 }}>{r.label}</span>
                <span style={{ fontSize: 11.5, color: MUTE }}>{r.compliance}</span>
                <StatusBadge tone={r.nextIn <= 1 ? 'amber' : 'grey'}>
                  {r.nextIn === 0 ? 'today' : r.nextIn === 1 ? 'tomorrow' : `in ${r.nextIn} days`}
                </StatusBadge>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Drawer
        open={Boolean(openSuite)}
        onClose={() => setOpenSuite(null)}
        title={openSuite ? `Suite ${openSuite.suite_number}` : ''}
        subtitle={openSuite ? `${openSuite.suite_type} · Floor ${openSuite.floor} · ${SUITE_PM.checklist.length}-point PM` : ''}
        width={480}
      >
        {openSuite && (
          <div>
            <Fields rows={[
              ['Suite type', openSuite.suite_type],
              ['Floor', openSuite.floor],
              ['Pet friendly', openSuite.pet_friendly ? 'Yes' : 'No'],
              ['State', <StatusBadge key="s">{openSuite.state}</StatusBadge>],
              ['Last PM', fmtDate(openSuite.last_pm_date)],
              ['Next due', fmtDate(openSuite.next_pm_date)],
            ]} />

            <h4 style={{ margin: '20px 0 10px', fontSize: 12.5, fontWeight: 700, color: INK }}>
              What the PM covers
            </h4>
            {['Kitchen', 'HVAC', 'Bathroom', 'Safety', 'Fixtures'].map((group) => {
              const items = SUITE_PM.checklist.filter((c) => c.group === group)
              if (!items.length) return null
              return (
                <div key={group} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>
                    {group}
                  </div>
                  {items.map((c) => (
                    <div key={c.item} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: SUB, padding: '3px 0' }}>
                      <span style={{ color: MUTE }}>·</span>{c.item}
                    </div>
                  ))}
                </div>
              )
            })}

            {/* The kitchen is why this list is eighteen points and not ten, and
                why the rotation at this property is heavier than its room count
                suggests. Worth saying on the screen, not only in a comment. */}
            <p style={{ margin: '4px 0 0', fontSize: 11.5, color: MUTE, lineHeight: 1.5 }}>
              Six of the eighteen are kitchen appliances. An extended-stay suite carries
              them where a limited-service room does not, which is what makes this
              rotation the department's largest standing commitment.
            </p>
          </div>
        )}
      </Drawer>
    </div>
  )
}

function ScheduleRow({ item, done, ready, onToggle, onOpen }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 11, padding: '9px 2px',
      borderBottom: `1px solid ${LINE}`,
    }}>
      <button
        onClick={onToggle}
        disabled={!ready}
        aria-pressed={done}
        aria-busy={!ready}
        aria-label={done ? `Mark ${item.label} not done` : `Mark ${item.label} done`}
        title={ready ? undefined : 'Loading what has already been done today…'}
        style={{
          width: 19, height: 19, flexShrink: 0, marginTop: 1,
          cursor: ready ? 'pointer' : 'progress', opacity: ready ? 1 : 0.45,
          borderRadius: 5, border: `1.5px solid ${done ? GREEN : '#cbd5e1'}`,
          background: done ? GREEN : '#fff', color: '#fff', fontSize: 12, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
          fontFamily: 'inherit',
        }}>{done ? '✓' : ''}</button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            onClick={onOpen || undefined}
            style={{
              fontSize: 13, fontWeight: 600, color: done ? MUTE : INK,
              textDecoration: done ? 'line-through' : 'none',
              cursor: onOpen ? 'pointer' : 'default',
            }}>{item.label}</span>
          {item.compliance && <StatusBadge tone="blue">{item.compliance}</StatusBadge>}
          {item.priority === 'Critical' && <StatusBadge tone="red">Critical</StatusBadge>}
        </div>
        <div style={{ fontSize: 11.5, color: MUTE, marginTop: 2 }}>
          {[item.detail, item.why].filter(Boolean).join(' · ')}
        </div>
      </div>

      <span style={{ fontSize: 11.5, color: SUB, fontWeight: 600, whiteSpace: 'nowrap', marginTop: 2 }}>
        {item.minutes}m
      </span>
    </div>
  )
}

function DayBtn({ disabled, onClick, children }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        padding: '7px 11px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
        border: 'none', background: '#fff', color: disabled ? '#cbd5e1' : ACCENT,
        cursor: disabled ? 'default' : 'pointer',
      }}>{children}</button>
  )
}

function Legend({ colour, children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 9, height: 9, borderRadius: 3, background: colour }} />{children}
    </span>
  )
}
