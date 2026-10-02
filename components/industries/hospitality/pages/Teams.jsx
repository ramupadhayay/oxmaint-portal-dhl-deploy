'use client'

// Who does what.
//
// Four rows, and only one of them is the maintenance department. That is the
// point: at a 98-suite property most of the work is *found* by housekeeping and
// *reported* by the front desk, and the two technicians are downstream of both.
// A team screen that listed only engineering would describe a third of how the
// property actually runs.

import { useMemo } from 'react'
import {
  PageHeading, StatCards, Section, Card, DataTable, StatusBadge, PALETTE,
} from '../lib/kit'
import { TEAMS, TECHNICIANS, CREW, WORK_ORDERS, REQUESTS, OPEN_STATUS } from '../lib/data'

const { ACCENT, INK, SUB, MUTE, LINE } = PALETTE

export default function Teams() {
  const load = useMemo(() => {
    const m = {}
    WORK_ORDERS.filter((w) => OPEN_STATUS.includes(w.status)).forEach((w) => {
      m[w.assigned_to_name] = (m[w.assigned_to_name] || 0) + 1
    })
    return m
  }, [])

  const people = TECHNICIANS.map((t) => ({
    ...t,
    id: t.user_id,
    open: load[t.name] || 0,
  }))

  const columns = [
    { key: 'name', label: 'Name', render: (r) => <strong style={{ color: INK }}>{r.name}</strong> },
    { key: 'role', label: 'Role', render: (r) => <StatusBadge tone={r.role === 'Supervisor' ? 'blue' : r.role === 'Planner' ? 'violet' : 'grey'}>{r.role}</StatusBadge> },
    { key: 'trade', label: 'Trade' },
    { key: 'email', label: 'Email', render: (r) => <span style={{ fontSize: 12, color: SUB }}>{r.email}</span> },
    { key: 'open', label: 'Open jobs', align: 'center', render: (r) => (r.open ? <strong style={{ color: INK }}>{r.open}</strong> : '—') },
  ]

  const guestRequests = REQUESTS.filter((r) => String(r.source).startsWith('Front desk')).length
  const hkRequests = REQUESTS.filter((r) => r.source === 'Housekeeping').length

  return (
    <div>
      <PageHeading
        title="Teams"
        subtitle="Engineering, and the departments that feed it work"
      />

      <StatCards items={[
        { label: 'Technicians', value: CREW.length, note: 'on the rota' },
        { label: 'People listed', value: TECHNICIANS.length, note: 'across all teams' },
        { label: 'From the front desk', value: guestRequests, note: 'guest-reported requests' },
        { label: 'From housekeeping', value: hkRequests, note: 'found on turn' },
      ]} />

      <Section title="Teams" right={<span style={{ fontSize: 11.5, color: MUTE }}>Who covers what</span>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10 }}>
          {TEAMS.map((t) => (
            <div key={t.team_id} style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{t.team_name}</span>
                <span style={{ fontSize: 11, color: MUTE }}>{t.members} people</span>
              </div>
              <div style={{ fontSize: 11.5, color: SUB, marginTop: 5 }}>Lead · {t.lead_name}</div>
              <div style={{ fontSize: 11.5, color: MUTE, marginTop: 6, lineHeight: 1.45 }}>{t.covers}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="People" right={<span style={{ fontSize: 11.5, color: MUTE }}>Open jobs shows current load</span>}>
        <DataTable columns={columns} rows={people} pageSize={10} />
      </Section>

      <Card>
        <p style={{ margin: 0, fontSize: 11.5, color: MUTE, lineHeight: 1.55 }}>
          The engineering roster here is two technicians and a supervisor, which is what a
          property of this size runs. The names are the demo&rsquo;s own and are shared with the
          other portals on this deployment rather than being anyone at this hotel.
        </p>
      </Card>
    </div>
  )
}
