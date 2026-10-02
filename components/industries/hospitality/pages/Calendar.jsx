'use client'

// A month at a time.
//
// The daily schedule answers today and the rotation board answers the cycle;
// neither answers "can I take Thursday off" or "what does the week before the
// brand audit look like". That is what a calendar is for, and why the load bar
// on each day matters more than the list of what is on it.

import { useMemo, useState } from 'react'
import {
  PageHeading, StatCards, Card, Section, StatusBadge, PALETTE,
} from '../lib/kit'
import {
  SUITES, WORK_ORDERS, INSPECTIONS, ROUNDS, SUITE_PM, SHIFT_MINUTES,
  EPOCH, isOpen, fmtDate,
} from '../lib/data'
import { roundDueToday, roundNextIn } from '../lib/schedule'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, AMBER, RED } = PALETTE

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const dayKey = (d) => d.toISOString().slice(0, 10)

export default function Calendar() {
  const [monthOffset, setMonthOffset] = useState(0)

  const { cells, label, totals } = useMemo(() => {
    const base = new Date(EPOCH)
    base.setDate(1)
    base.setMonth(base.getMonth() + monthOffset)
    const year = base.getFullYear()
    const month = base.getMonth()
    const first = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    // Monday-first, the way a work rota is written.
    const lead = (first.getDay() + 6) % 7

    const todayKey = dayKey(new Date(EPOCH))
    const out = []
    for (let i = 0; i < lead; i++) out.push(null)

    let monthSuites = 0
    let monthMinutes = 0

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      const k = dayKey(date)
      const suites = SUITES.filter((s) => dayKey(new Date(s.next_pm_date)) === k)
      const wos = WORK_ORDERS.filter((w) => isOpen(w) && dayKey(new Date(w.due_date)) === k)
      const insp = INSPECTIONS.filter((x) => dayKey(new Date(x.next_date)) === k)

      // Daily rounds land every day; weekly and monthly ones only on theirs.
      const offset = Math.round((date.getTime() - EPOCH) / 86400000)
      const rounds = ROUNDS.filter((r) => (
        r.every === 'day' || (offset >= 0 && roundNextIn(r) === offset) || (offset === 0 && roundDueToday(r))
      ))

      const minutes =
        suites.length * SUITE_PM.minutes
        + rounds.reduce((n, r) => n + r.minutes, 0)
        + wos.reduce((n, w) => n + Math.round((w.estimated_hours || 1) * 60), 0)

      monthSuites += suites.length
      monthMinutes += minutes

      out.push({ d, key: k, date, suites, wos, insp, rounds, minutes, isToday: k === todayKey })
    }

    return {
      cells: out,
      label: first.toLocaleString('en-GB', { month: 'long', year: 'numeric' }),
      totals: { suites: monthSuites, minutes: monthMinutes, days: daysInMonth },
    }
  }, [monthOffset])

  const inspThisMonth = cells.filter(Boolean).flatMap((c) => c.insp)

  return (
    <div>
      <PageHeading
        title="Calendar"
        subtitle="The month ahead — rotation, rounds, work orders and what gets inspected"
        right={(
          <div style={{ display: 'flex', border: `1px solid ${LINE}`, borderRadius: 9, overflow: 'hidden' }}>
            <NavBtn onClick={() => setMonthOffset(monthOffset - 1)}>‹</NavBtn>
            <button
              onClick={() => setMonthOffset(0)}
              style={{
                padding: '7px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                border: 'none', borderLeft: `1px solid ${LINE}`, borderRight: `1px solid ${LINE}`,
                background: monthOffset === 0 ? '#f8fafc' : '#fff', color: ACCENT, cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}>{label}</button>
            <NavBtn onClick={() => setMonthOffset(monthOffset + 1)}>›</NavBtn>
          </div>
        )}
      />

      <StatCards items={[
        { label: 'Suites due', value: totals.suites, note: 'on the rotation this month' },
        { label: 'Planned work', value: `${Math.round(totals.minutes / 60)}h`, note: 'rotation, rounds and backlog' },
        { label: 'Average day', value: `${Math.round(totals.minutes / totals.days / 60 * 10) / 10}h`, note: `of an ${SHIFT_MINUTES / 60}h shift` },
        { label: 'Inspections', value: inspThisMonth.length, tone: inspThisMonth.length ? 'amber' : undefined, note: inspThisMonth.length ? 'someone else signs these' : 'none this month' },
      ]} />

      <Card style={{ padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 6 }}>
          {DOW.map((d) => (
            <div key={d} style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
          {cells.map((c, i) => {
            if (!c) return <div key={`pad-${i}`} />
            const load = Math.min(1, c.minutes / SHIFT_MINUTES)
            const over = c.minutes > SHIFT_MINUTES
            return (
              <div
                key={c.key}
                title={`${fmtDate(c.date.toISOString())} · ${Math.round(c.minutes / 6) / 10}h planned`}
                style={{
                  minHeight: 84, borderRadius: 9, padding: '6px 7px',
                  border: `1px solid ${c.isToday ? ACCENT : LINE}`,
                  background: c.isToday ? '#f5f7ff' : '#fff',
                  display: 'flex', flexDirection: 'column', gap: 3,
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12, fontWeight: c.isToday ? 800 : 600, color: c.isToday ? ACCENT : INK }}>{c.d}</span>
                  <span style={{ fontSize: 9.5, color: over ? RED : MUTE, fontWeight: over ? 700 : 500 }}>
                    {Math.round(c.minutes / 6) / 10}h
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {c.suites.length > 0 && <Pill tone={ACCENT}>{c.suites.length} suite{c.suites.length === 1 ? '' : 's'}</Pill>}
                  {c.wos.length > 0 && <Pill tone={AMBER}>{c.wos.length} job{c.wos.length === 1 ? '' : 's'}</Pill>}
                  {c.insp.length > 0 && <Pill tone={RED}>{c.insp[0].name.split(' ')[0]}</Pill>}
                </div>

                <div style={{ marginTop: 'auto', height: 3, background: '#f1f5f9', borderRadius: 999 }}>
                  <div style={{ width: `${load * 100}%`, height: '100%', background: over ? RED : load > 0.75 ? AMBER : GREEN, borderRadius: 999 }} />
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {inspThisMonth.length > 0 && (
        <Section title="Inspections this month" right={<span style={{ fontSize: 11.5, color: MUTE }}>Signed by someone outside the department</span>}>
          {inspThisMonth.map((x) => (
            <div key={x.inspection_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 2px', flexWrap: 'wrap' }}>
              <span style={{ flex: '1 1 220px', minWidth: 0, fontSize: 12.5, color: INK }}>{x.name}</span>
              <span style={{ fontSize: 11.5, color: MUTE }}>{x.inspector}</span>
              <StatusBadge tone="amber">{fmtDate(x.next_date)}</StatusBadge>
            </div>
          ))}
        </Section>
      )}
    </div>
  )
}

function Pill({ tone, children }) {
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 700, color: tone,
      background: `${tone}14`, borderRadius: 5, padding: '1px 5px',
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    }}>{children}</span>
  )
}

function NavBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 12px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
      border: 'none', background: '#fff', color: ACCENT, cursor: 'pointer',
    }}>{children}</button>
  )
}
