'use client'

// One person's queue.
//
// Grouped by when rather than by what, because that is the only ordering that
// tells someone where to start. It also picks up work that has fallen through
// the middle: a job nobody took and is now late belongs to whoever is running
// the shift, and if this screen does not surface it, no screen does.

import { useCallback, useMemo, useState } from 'react'
import {
  PageHeading, StatCards, Section, Card, Drawer, Fields,
  StatusBadge, Priority, ActionButton, PALETTE,
} from '../lib/kit'
import { useRecords, useStore } from '../lib/store'
import { WORK_ORDERS, OPEN_STATUS, USER, CREW, EPOCH, fmtDate, isPast, daysUntil } from '../lib/data'
import { technicianForDay } from '../lib/schedule'

const { ACCENT, INK, SUB, MUTE, LINE, RED } = PALETTE

const idOf = (w) => w.workorder_id || w.recordId
const byDue = (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()

export default function MyTasks() {
  const store = useStore()
  const update = store?.update
  const ready = Boolean(store?.ready)
  const [who, setWho] = useState(() => technicianForDay(0)?.name || CREW[0]?.name || USER.name)
  const [openId, setOpenId] = useState(null)

  const merged = useRecords('hosp_work_order', WORK_ORDERS, idOf)

  const mine = useMemo(() => merged.filter((w) => (
    w.assigned_to_name === who || (!w.assigned_to_name && isPast(w.due_date))
  )), [merged, who])

  const live = useMemo(() => mine.filter((w) => OPEN_STATUS.includes(w.status)), [mine])

  const groups = useMemo(() => {
    const overdue = [], week = [], later = []
    live.forEach((w) => {
      if (isPast(w.due_date)) overdue.push(w)
      else if (daysUntil(w.due_date) <= 7) week.push(w)
      else later.push(w)
    })
    return [
      { key: 'overdue', title: 'Overdue', tone: 'red', note: 'Already late', items: overdue.sort(byDue) },
      { key: 'week', title: 'This week', tone: 'amber', note: 'Due in the next seven days', items: week.sort(byDue) },
      { key: 'later', title: 'Later', tone: 'grey', note: 'Beyond the week', items: later.sort(byDue) },
    ].filter((g) => g.items.length)
  }, [live])

  const open = useMemo(() => merged.find((w) => idOf(w) === openId) || null, [merged, openId])

  const closedThisMonth = useMemo(() => {
    const now = new Date(EPOCH)
    return mine.filter((w) => {
      if (!w.completed_date) return false
      const d = new Date(w.completed_date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
  }, [mine])

  const complete = useCallback((w) => {
    if (!ready || !update) return
    update('hosp_work_order', idOf(w), {
      recordId: idOf(w),
      status: 'Completed',
      completed_date: new Date().toISOString(),
      closed_by: who,
    })
    setOpenId(null)
  }, [ready, update, who])

  const hours = live.reduce((n, w) => n + (w.estimated_hours || 0), 0)

  return (
    <div>
      <PageHeading
        title="My Tasks"
        subtitle="Assigned work, plus anything late that nobody picked up"
        right={(
          <select
            value={who}
            onChange={(e) => setWho(e.target.value)}
            style={{
              padding: '8px 11px', fontSize: 12.5, border: `1px solid ${LINE}`, borderRadius: 9,
              background: '#fff', color: ACCENT, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
            }}>
            {CREW.map((t) => <option key={t.user_id} value={t.name}>{t.name} — {t.trade}</option>)}
          </select>
        )}
      />

      <StatCards items={[
        { label: 'Open', value: live.length, note: `${Math.round(hours * 10) / 10} h estimated` },
        { label: 'Overdue', value: live.filter((w) => isPast(w.due_date)).length, tone: live.some((w) => isPast(w.due_date)) ? 'red' : 'green', note: 'past the due date' },
        { label: 'Critical', value: live.filter((w) => w.priority === 'Critical').length, tone: 'red', note: 'open and critical' },
        { label: 'Closed this month', value: closedThisMonth, tone: 'green', note: 'by this person' },
      ]} />

      {groups.map((g) => (
        <Section
          key={g.key}
          title={(
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {g.title}
              <StatusBadge tone={g.tone}>{g.items.length}</StatusBadge>
            </span>
          )}
          right={<span style={{ fontSize: 11.5, color: MUTE }}>{g.note}</span>}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {g.items.map((w) => (
              <div
                key={idOf(w)}
                onClick={() => setOpenId(idOf(w))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, padding: '9px 2px',
                  borderBottom: `1px solid ${LINE}`, cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, color: ACCENT, fontWeight: 700, flexShrink: 0 }}>
                  {w.work_order_number}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {w.title}
                </span>
                <Priority value={w.priority} />
                <span style={{ fontSize: 11.5, color: isPast(w.due_date) ? RED : MUTE, fontWeight: isPast(w.due_date) ? 700 : 500, whiteSpace: 'nowrap' }}>
                  {fmtDate(w.due_date)}
                </span>
              </div>
            ))}
          </div>
        </Section>
      ))}

      {!groups.length && (
        <Card><p style={{ margin: 0, fontSize: 13, color: MUTE }}>Nothing open for {who}.</p></Card>
      )}

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        title={open?.work_order_number || ''}
        subtitle={open?.title || ''}
        width={470}
        footer={open && OPEN_STATUS.includes(open.status)
          ? <ActionButton onClick={() => complete(open)} disabled={!ready}>Mark complete</ActionButton>
          : null}
      >
        {open && (
          <Fields rows={[
            ['Status', <StatusBadge key="s">{open.status}</StatusBadge>],
            ['Priority', <Priority key="p" value={open.priority} />],
            ['Asset', open.asset_name],
            ['Suite', open.suite_number || '—'],
            ['Location', open.location_name],
            ['Due', fmtDate(open.due_date)],
            ['Estimated', `${open.estimated_hours} h`],
          ]} />
        )}
      </Drawer>
    </div>
  )
}
