'use client'

import { useMemo, useState } from 'react'
import { PageHeader, StatStrip, Card, Section, StatusBadge, Priority, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { WORK_ORDERS, PM_SCHEDULES, OPEN_STATUS, EPOCH, isPast, fmtDate } from '../lib/data'

const { MUTE, SUB, INK, LINE } = PALETTE

const DAY_MS = 86400000
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ── why the columns are minmax(0,1fr) and the chips are blocks ────────────
//
// The grid was `repeat(7,1fr)` and the chips were spans, and between them they
// broke the month view. `1fr` is `minmax(auto,1fr)`, and `auto` means a column
// cannot shrink below its own content — so with `whiteSpace: nowrap` every
// column grew to its longest work order title, the seven of them overflowed the
// card, and Sunday was clipped off the right edge. The ellipsis that was meant
// to stop that never ran: `overflow` and `text-overflow` do nothing on an inline
// box, which a `<span>` is until it is told otherwise.
//
// So the tracks may shrink to nothing and the chip is a block that owns its
// width. The truncation then happens where it was always supposed to.

// Three, then a count — the product's own rule. A cell that grows with its
// content makes every row in the month a different height, which is what turned
// a calendar into a ragged list.
const PER_DAY = 3

export default function Calendar() {
  const { scope, siteName } = useSite()
  const [offset, setOffset] = useState(0)   // months from now
  const [selected, setSelected] = useState(null)

  // Work orders and PM schedules land on the same grid, because the question a
  // planner asks is "what is happening that week", not "what kind of record is
  // it". They stay visually distinct so the answer is still readable.
  const events = useMemo(() => ([
    ...scope(WORK_ORDERS).filter((w) => OPEN_STATUS.includes(w.status)).map((w) => ({
      id: w.workorder_id, date: w.due_date, kind: 'wo',
      title: w.work_order_number + ' · ' + w.title, asset: w.asset_name,
      priority: w.priority, status: w.status, who: w.assigned_to_name,
    })),
    ...scope(PM_SCHEDULES).map((p) => ({
      id: p.schedule_id, date: p.next_due, kind: 'pm',
      title: p.schedule_name, asset: p.asset_name,
      priority: null, status: p.status, who: p.assigned_to_name,
    })),
  ]), [scope])

  const view = useMemo(() => {
    const base = new Date(EPOCH)
    base.setMonth(base.getMonth() + offset)
    const year = base.getFullYear()
    const month = base.getMonth()

    const first = new Date(year, month, 1)
    // Monday-first, which is what a maintenance week runs on.
    const lead = (first.getDay() + 6) % 7
    const start = new Date(year, month, 1 - lead)

    const cells = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getTime() + i * DAY_MS)
      const key = d.toDateString()
      return {
        date: d,
        inMonth: d.getMonth() === month,
        isToday: key === new Date(EPOCH).toDateString(),
        events: events.filter((e) => new Date(e.date).toDateString() === key),
      }
    })

    return { label: base.toLocaleString('en-GB', { month: 'long', year: 'numeric' }), cells, month }
  }, [offset, events])

  const monthEvents = view.cells.filter((c) => c.inMonth).flatMap((c) => c.events)

  return (
    <div>
      <PageHeader
        icon={sectionIcon('calendar', '#15227a')}
        title="Calendar"
        subtitle={`Work orders and preventive maintenance due · ${siteName}`}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NavBtn onClick={() => setOffset((o) => o - 1)}>‹</NavBtn>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: INK, minWidth: 132, textAlign: 'center' }}>{view.label}</span>
            <NavBtn onClick={() => setOffset((o) => o + 1)}>›</NavBtn>
            {offset !== 0 && <button onClick={() => setOffset(0)} style={todayBtn}>Today</button>}
          </div>
        }
      />

      <StatStrip items={[
        { label: 'Due this month', value: monthEvents.length },
        { label: 'Work orders', value: monthEvents.filter((e) => e.kind === 'wo').length, tone: 'amber' },
        { label: 'PM schedules', value: monthEvents.filter((e) => e.kind === 'pm').length, tone: 'blue' },
        { label: 'Overdue', value: monthEvents.filter((e) => isPast(e.date)).length, tone: 'red' },
      ]} />

      <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
        <div style={styles.week}>
          {WEEKDAYS.map((d, i) => (
            <div key={d} style={{ ...styles.weekday, color: i > 4 ? MUTE : SUB }}>{d}</div>
          ))}
        </div>
        <div style={styles.grid}>
          {view.cells.map((c, i) => {
            const overdue = c.events.filter((e) => isPast(e.date)).length
            return (
              <button key={i} onClick={() => c.events.length && setSelected(c)}
                style={{
                  ...styles.cell,
                  background: c.isToday ? '#eef2ff' : c.inMonth ? '#fff' : '#fbfcfe',
                  cursor: c.events.length ? 'pointer' : 'default',
                }}>
                <span style={styles.dayRow}>
                  <span style={{
                    ...styles.dayNo,
                    ...(c.isToday ? styles.dayToday : null),
                    color: c.isToday ? '#fff' : c.inMonth ? INK : '#cbd5e1',
                  }}>{c.date.getDate()}</span>
                  {/* One mark for the whole day rather than a ring on each chip.
                      A cell showing three red borders says "three problems"
                      where the answer a planner wants is "this day is late". */}
                  {overdue > 0 && <span style={styles.late}>{overdue} late</span>}
                </span>

                <span style={styles.chips}>
                  {c.events.slice(0, PER_DAY).map((e) => {
                    const late = isPast(e.date)
                    const tone = e.kind === 'pm' ? TONE.pm : late ? TONE.late : TONE.wo
                    return (
                      <span key={e.id} title={e.title} style={{ ...styles.chip, ...tone }}>
                        <span style={{ ...styles.tick, background: tone.color }} />
                        <span style={styles.chipText}>{e.title}</span>
                      </span>
                    )
                  })}
                  {c.events.length > PER_DAY && (
                    <span style={styles.more}>+{c.events.length - PER_DAY} more</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      {selected && (
        <Section title={fmtDate(selected.date.toISOString())}
          right={<button onClick={() => setSelected(null)} style={todayBtn}>Close</button>}>
          {selected.events.map((e) => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${LINE}` }}>
              <StatusBadge tone={e.kind === 'wo' ? 'amber' : 'blue'}>{e.kind === 'wo' ? 'Work order' : 'PM'}</StatusBadge>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
              <span style={{ fontSize: 11.5, color: SUB }}>{e.asset}</span>
              {e.priority && <Priority value={e.priority} />}
              <span style={{ fontSize: 11.5, color: MUTE, minWidth: 100, textAlign: 'right' }}>{e.who}</span>
            </div>
          ))}
        </Section>
      )}
    </div>
  )
}

function NavBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{
      width: 30, height: 30, borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff',
      color: '#15227a', fontSize: 17, lineHeight: 1, cursor: 'pointer', fontFamily: 'inherit',
    }}>{children}</button>
  )
}

const todayBtn = {
  padding: '6px 11px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
  border: `1px solid ${LINE}`, borderRadius: 8, background: '#fff', color: '#15227a', cursor: 'pointer',
}

// Work orders amber, overdue red, PM blue — the same three the strip above the
// grid counts in, so a chip's colour and a card's number never disagree.
const TONE = {
  wo: { background: '#fffbeb', color: '#b45309' },
  late: { background: '#fef2f2', color: '#b91c1c' },
  pm: { background: '#eff6ff', color: '#1d4ed8' },
}

const styles = {
  week: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    background: '#f8fafc',
    borderBottom: `1px solid ${LINE}`,
  },
  weekday: {
    padding: '9px 10px', fontSize: 10.5, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  // minmax(0,1fr) rather than 1fr: the tracks are allowed to shrink below their
  // content, which is what stops seven columns of long titles overflowing the
  // card and clipping Sunday.
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' },
  cell: {
    // Fixed rather than a minimum, so every row in the month is the same height.
    // Three chips and a count is exactly what fits, which is why that is the cap.
    height: 118,
    display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden',
    padding: '7px 7px 6px', textAlign: 'left', fontFamily: 'inherit', minWidth: 0,
    border: 'none', borderRight: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`,
  },
  dayRow: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 },
  dayNo: {
    fontSize: 11.5, fontWeight: 600, flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 20, height: 20, borderRadius: 999,
  },
  dayToday: { background: '#15227a', fontWeight: 800 },
  late: {
    marginLeft: 'auto', flexShrink: 0, padding: '1px 6px', borderRadius: 999,
    fontSize: 9, fontWeight: 800, color: '#b91c1c', background: '#fef2f2',
  },
  chips: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  chip: {
    display: 'flex', alignItems: 'center', gap: 5, minWidth: 0,
    padding: '2px 6px', borderRadius: 5, fontSize: 9.5, fontWeight: 600,
  },
  tick: { width: 3, height: 10, borderRadius: 2, flexShrink: 0, opacity: 0.75 },
  // A block that owns its width. As an inline span it ignored both of these and
  // pushed the column wider instead of cutting the title off.
  chipText: {
    display: 'block', minWidth: 0, flex: 1,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  more: { fontSize: 9, color: MUTE, fontWeight: 700, paddingLeft: 2 },
}
