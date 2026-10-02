'use client'

// The month the planner actually works in.
//
// PM schedules and work orders are both tables elsewhere in this portal, and a
// table answers "what is due" but not "when is it all due" — which is the
// question behind both the PM system review and the resource planning items on
// the customer's list. Eleven schedules and nine open jobs landing in the same
// fortnight is invisible in two sorted lists and obvious on a grid.
//
// Both kinds share one calendar rather than getting one each. A planner does not
// keep two diaries: a technician booked on a rope-dye calibration is not
// available for a breakdown that morning, and that clash only shows when the two
// are drawn on the same day.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Section, StatusBadge } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, Note, Fact } from '../components/cells'
import { useDept } from '../lib/deptStore'
import { workOrders, pmSchedules, hrs } from '../lib/data'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const iso = (d) => d.toISOString().slice(0, 10)
const todayIso = () => new Date().toISOString().slice(0, 10)

export default function Calendar() {
  const router = useRouter()
  const { scope, deptName, dept } = useDept()

  const today = new Date(todayIso())
  const [cursor, setCursor] = useState({ y: today.getUTCFullYear(), m: today.getUTCMonth() })

  const jobs = useMemo(() => scope(workOrders), [scope])
  const pms = useMemo(
    () => (dept === 'all' ? pmSchedules : pmSchedules.filter((p) => p._asset?.locationCode === dept)),
    [dept]
  )

  // Everything with a date, keyed by the day it falls on.
  const byDay = useMemo(() => {
    const m = new Map()
    const push = (day, item) => {
      if (!day) return
      if (!m.has(day)) m.set(day, [])
      m.get(day).push(item)
    }
    jobs.forEach((w) => push(w.dueDate, {
      kind: 'wo', id: w.woNo, title: w.title, sub: w._assetName,
      tone: w._overdue ? 'red' : w._open ? 'blue' : 'green',
      hours: w.aiEstimateHrs, who: w.assignedTo,
      href: `/portal/dna/work-orders/${w.woNo}`,
    }))
    pms.forEach((p) => push(p.nextDue, {
      kind: 'pm', id: p.pmId, title: p.task, sub: p._assetName,
      tone: p._status === 'Overdue' ? 'red' : p._status === 'Due today' ? 'amber' : 'violet',
      hours: p.estimateHrs, who: p.team,
      href: `/portal/dna/pm-schedules/${p.pmId}`,
    }))
    return m
  }, [jobs, pms])

  // The grid: whole weeks, Monday first, padded from the previous and next month
  // so every row has seven cells.
  const grid = useMemo(() => {
    const first = new Date(Date.UTC(cursor.y, cursor.m, 1))
    // getUTCDay is Sunday-first; shift so Monday is column 0.
    const lead = (first.getUTCDay() + 6) % 7
    const start = new Date(first)
    start.setUTCDate(1 - lead)

    const cells = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setUTCDate(start.getUTCDate() + i)
      cells.push({
        date: d,
        day: iso(d),
        inMonth: d.getUTCMonth() === cursor.m,
        isToday: iso(d) === todayIso(),
        items: byDay.get(iso(d)) || [],
      })
    }
    // Drop a trailing week that belongs entirely to the next month.
    return cells.slice(0, cells.slice(35).every((c) => !c.inMonth && !c.items.length) ? 35 : 42)
  }, [cursor, byDay])

  const monthItems = grid.filter((c) => c.inMonth).flatMap((c) => c.items)
  const monthHours = monthItems.reduce((s, i) => s + (i.hours || 0), 0)
  const busiest = [...grid.filter((c) => c.inMonth)].sort((a, b) => b.items.length - a.items.length)[0]

  const step = (n) => setCursor((c) => {
    const d = new Date(Date.UTC(c.y, c.m + n, 1))
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() }
  })

  return (
    <div>
      <PageHeading
        title="Calendar"
        subtitle={`Preventive schedules and work order due dates on one grid, so a week that is carrying too much is visible before it arrives. ${deptName}.`}
        right={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => step(-1)} style={navBtn} title="Previous month">‹</button>
            <button onClick={() => setCursor({ y: today.getUTCFullYear(), m: today.getUTCMonth() })} style={{ ...navBtn, width: 'auto', padding: '0 12px', fontSize: 12 }}>
              Today
            </button>
            <button onClick={() => step(1)} style={navBtn} title="Next month">›</button>
          </div>
        }
      />

      <StatCards items={[
        { label: 'This month', value: monthItems.length, note: `${monthItems.filter((i) => i.kind === 'pm').length} PM · ${monthItems.filter((i) => i.kind === 'wo').length} work orders`, icon: 'list' },
        { label: 'Scheduled hours', value: hrs(monthHours), note: 'Estimated, everything dated', icon: 'clock' },
        { label: 'Past due showing', value: monthItems.filter((i) => i.tone === 'red').length, tone: monthItems.some((i) => i.tone === 'red') ? 'destructive' : 'success' },
        { label: 'Busiest day', value: busiest && busiest.items.length ? String(busiest.date.getUTCDate()) : '—', note: busiest && busiest.items.length ? `${busiest.items.length} items` : 'Nothing clustered' },
        { label: 'Unassigned on the grid', value: monthItems.filter((i) => i.who === 'Unassigned').length, tone: 'warning' },
      ]} />

      <Section title={`${MONTHS[cursor.m]} ${cursor.y}`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1, background: '#e4e9f0', border: '1px solid #e4e9f0', borderRadius: 10, overflow: 'hidden' }}>
          {DOW.map((d) => (
            <div key={d} style={{ background: '#f8fafc', padding: '9px 10px', fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: '#64748b' }}>
              {d}
            </div>
          ))}

          {grid.map((cell) => (
            <div
              key={cell.day}
              style={{
                background: cell.inMonth ? '#fff' : '#fcfdfe',
                minHeight: 108, padding: '7px 8px',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 11.5,
                  fontWeight: cell.isToday ? 800 : 600,
                  color: cell.isToday ? '#fff' : cell.inMonth ? '#0f172a' : '#cbd5e1',
                  background: cell.isToday ? '#15227a' : 'transparent',
                  borderRadius: 999, minWidth: 19, height: 19,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {cell.date.getUTCDate()}
                </span>
                {cell.items.length > 2 && (
                  <span style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 700 }}>{cell.items.length}</span>
                )}
              </div>

              {cell.items.slice(0, 3).map((i) => (
                <button
                  key={i.id}
                  onClick={() => router.push(i.href)}
                  title={`${i.id} — ${i.title} (${i.sub})`}
                  style={{ ...pill, ...TONE[i.tone] }}
                >
                  <span style={{ fontWeight: 800 }}>{i.kind === 'pm' ? 'PM' : 'WO'}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.title}</span>
                </button>
              ))}

              {cell.items.length > 3 && (
                <span style={{ fontSize: 9.5, color: '#94a3b8', paddingLeft: 2 }}>
                  +{cell.items.length - 3} more
                </span>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 13 }}>
          {[['blue', 'Work order, open'], ['green', 'Work order, completed'], ['violet', 'PM scheduled'], ['amber', 'PM due today'], ['red', 'Past due']].map(([t, label]) => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: TONE[t].background, border: `1px solid ${TONE[t].borderColor}` }} />
              {label}
            </span>
          ))}
        </div>
      </Section>

      <Section title="What falls in this month">
        {monthItems.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
            <Fact label="PM schedules" value={monthItems.filter((i) => i.kind === 'pm').length} sub={hrs(monthItems.filter((i) => i.kind === 'pm').reduce((s, i) => s + (i.hours || 0), 0))} />
            <Fact label="Work orders" value={monthItems.filter((i) => i.kind === 'wo').length} sub={hrs(monthItems.filter((i) => i.kind === 'wo').reduce((s, i) => s + (i.hours || 0), 0))} />
            <Fact label="Total hours" value={hrs(monthHours)} sub="Estimated across both" />
            <Fact label="Needs an owner" value={monthItems.filter((i) => i.who === 'Unassigned').length} sub="Work orders with no technician" />
          </div>
        ) : (
          <Note tone="grey">Nothing is dated in this month for the current filter.</Note>
        )}
      </Section>
    </div>
  )
}

const TONE = {
  blue: { background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' },
  green: { background: '#ecfdf5', borderColor: '#a7f3d0', color: '#047857' },
  violet: { background: '#f5f3ff', borderColor: '#ddd6fe', color: '#6d28d9' },
  amber: { background: '#fffbeb', borderColor: '#fde68a', color: '#b45309' },
  red: { background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' },
}

const pill = {
  display: 'flex', alignItems: 'center', gap: 5, width: '100%',
  padding: '3px 6px', borderRadius: 5, border: '1px solid',
  fontSize: 9.5, fontFamily: 'inherit', cursor: 'pointer',
  textAlign: 'left', minWidth: 0,
}

const navBtn = {
  width: 30, height: 30, borderRadius: 8, border: '1px solid #e4e9f0',
  background: '#fff', color: '#15227a', fontSize: 16, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
