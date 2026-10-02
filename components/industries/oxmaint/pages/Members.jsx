'use client'

import { useMemo, useState } from 'react'
import { PageHeader, StatStrip, Toolbar, DataTable, Drawer, Fields, StatusBadge, ActionButton, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useRecords, useStore } from '../lib/store'
import { CreateModal } from '../lib/forms'
import { TECHNICIANS, WORK_ORDERS, ORG, OPEN_STATUS, isPast, hours } from '../lib/data'

const { MUTE, INK } = PALETTE

const idOf = (r) => r.user_id || r.recordId

export default function Members() {
  const { create } = useStore()
  const [creating, setCreating] = useState(false)
  const seededPlusStored = useRecords('member', TECHNICIANS, idOf)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('all')
  const [trade, setTrade] = useState('all')
  const [open, setOpen] = useState(null)

  // A person's workload is the reason to open this screen — who is loaded, who
  // is free, who is carrying the overdue work. Counting it here rather than
  // storing it means it can never drift from the work-order list.
  const people = useMemo(() => seededPlusStored.map((t) => {
    const mine = WORK_ORDERS.filter((w) => w.assigned_to_name === t.name)
    const live = mine.filter((w) => OPEN_STATUS.includes(w.status))
    return {
      ...t,
      assigned: live.length,
      overdue: live.filter((w) => isPast(w.due_date)).length,
      completed: mine.filter((w) => w.status === 'Completed').length,
      hours: mine.reduce((n, w) => n + (w.actual_hours || 0), 0),
    }
  }), [seededPlusStored])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return people.filter((p) => (
      (role === 'all' || p.role === role) &&
      (trade === 'all' || p.trade === trade) &&
      (!q || [p.name, p.email, p.role, p.trade].join(' ').toLowerCase().includes(q))
    ))
  }, [people, search, role, trade])

  const columns = [
    {
      key: 'name', label: 'Member',
      render: (r) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
          <span style={avatar}>{r.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
          <span style={{ fontWeight: 600 }}>{r.name}</span>
        </span>
      ),
    },
    { key: 'role', label: 'Role' },
    { key: 'trade', label: 'Trade' },
    { key: 'email', label: 'Email' },
    { key: 'assigned', label: 'Open WOs', align: 'right', render: (r) => <span style={{ fontWeight: 700 }}>{r.assigned}</span> },
    { key: 'overdue', label: 'Overdue', align: 'right', render: (r) => (r.overdue ? <span style={{ fontWeight: 700, color: '#b91c1c' }}>{r.overdue}</span> : '—') },
    { key: 'completed', label: 'Completed', align: 'right' },
    { key: 'hours', label: 'Hours logged', align: 'right', render: (r) => `${hours(r.hours)} h` },
  ]

  return (
    <div>
      <PageHeader
        icon={sectionIcon('members', '#15227a')}
        title="Members"
        subtitle={`${TECHNICIANS.length} of ${ORG.max_users} seats used`}
        right={<ActionButton onClick={() => setCreating(true)}>Invite member</ActionButton>}
      />

      <StatStrip items={[
        { label: 'Members', value: people.length },
        { label: 'Technicians', value: people.filter((p) => p.role === 'Technician').length },
        { label: 'Supervisors', value: people.filter((p) => p.role === 'Supervisor').length },
        { label: 'Seats available', value: ORG.max_users - people.length, tone: 'green' },
        { label: 'Work assigned', value: people.reduce((n, p) => n + p.assigned, 0) },
      ]} />

      <Toolbar
        search={search} onSearch={setSearch}
        placeholder="Search name, email, role…"
        filters={[
          { label: 'Role', value: role, onChange: setRole, options: ['Technician', 'Supervisor', 'Planner', 'Administrator'] },
          { label: 'Trade', value: trade, onChange: setTrade, options: ['Mechanical', 'Electrical', 'Instrumentation', 'Planning'] },
        ]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} shown</span>}
      />

      <DataTable columns={columns} rows={rows} onRowClick={setOpen} pageSize={10} empty="No members match these filters." />

      <Drawer open={Boolean(open)} onClose={() => setOpen(null)} title={open?.name} subtitle={open?.role}
        icon={sectionIcon('members', '#15227a')}>
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Fields rows={[
              ['Role', open.role],
              ['Trade', open.trade],
              ['Email', open.email],
              ['Open work orders', open.assigned],
              ['Overdue', open.overdue],
              ['Completed', open.completed],
              ['Hours logged', `${hours(open.hours)} h`],
            ]} />
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 }}>Current workload</h4>
              {WORK_ORDERS.filter((w) => w.assigned_to_name === open.name && OPEN_STATUS.includes(w.status)).slice(0, 8).map((w) => (
                <div key={w.workorder_id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: '#15227a', minWidth: 62 }}>{w.work_order_number}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: INK }}>{w.title}</span>
                  <StatusBadge>{isPast(w.due_date) ? 'Overdue' : w.status}</StatusBadge>
                </div>
              )) || null}
              {!open.assigned && <p style={{ margin: 0, fontSize: 12.5, color: MUTE }}>No open work assigned.</p>}
            </div>
          </div>
        )}
      </Drawer>

      <CreateModal kind="member" open={creating} onClose={() => setCreating(false)}
        onSubmit={(values) => create('member', values)} />
    </div>
  )
}

const avatar = {
  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
  background: 'linear-gradient(135deg,#1f2d92,#15227a)', color: '#fff',
  fontSize: 9.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
