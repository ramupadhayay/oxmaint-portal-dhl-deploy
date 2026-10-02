'use client'

// Resource planning — the roster, and what each person is actually carrying.
//
// The workbook gives ten people with a department, a team, a shift and a skill
// list. What it does not give is a capacity model, so this screen does not
// invent one: there is no "82% utilised" here, because that number would need an
// available-hours figure nobody supplied.
//
// What it shows instead is countable and true — open jobs per technician, the
// estimated hours behind them, and which shift the work falls on. Five open work
// orders have no owner at all, and that is the number a planner acts on first.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Section, DataTable, Toolbar, StatusBadge, ActionButton } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, DeptChip, TwoLine, Meter, Note, Bars, Fact } from '../components/cells'
import { useDept } from '../lib/deptStore'
import { useMemberStore } from '../lib/store'
import AddMemberModal from '../components/AddMemberModal'
import { users, TEAMS, SHIFTS, unassignedWork, workOrders, hrs, locName } from '../lib/data'

export default function Resources() {
  const router = useRouter()
  const { scope, deptName } = useDept()
  const { created, create } = useMemberStore()
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  const [team, setTeam] = useState('all')
  const [shift, setShift] = useState('all')

  // People added in the portal, given the derived fields the workbook rows carry
  // so every column, filter and chart below works on them without a special
  // case. A new starter has no work assigned yet — that is true rather than a
  // gap, and zero-filling it would make the workload bar claim they are idle
  // when in fact nothing has been given to them.
  const addedRows = useMemo(() => created.map((u) => ({
    ...u,
    skills: Array.isArray(u.skills) ? u.skills : String(u.skills || '').split(',').map((x) => x.trim()).filter(Boolean),
    _departmentName: locName(u.department),
    _assigned: 0,
    _open: 0,
    _completed: 0,
    _hoursLogged: 0,
    _openHours: 0,
  })), [created])

  const all = useMemo(() => scope([...addedRows, ...users]), [scope, addedRows])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((u) => (
      (team === 'all' || u.team === team) &&
      (shift === 'all' || u.shift === shift) &&
      (!q || [u.userId, u.name, u.role, u.team, u._departmentName, ...u.skills].join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, team, shift])

  const maxOpen = Math.max(1, ...all.map((u) => u._open))
  const technicians = all.filter((u) => /technician/i.test(u.role))
  const busiest = [...all].sort((a, b) => b._openHours - a._openHours)[0]

  // Every distinct skill in the roster, with how many people hold it. A skill
  // one person holds is a single point of failure, and it is worth seeing.
  const skills = useMemo(() => {
    const m = new Map()
    all.forEach((u) => u.skills.forEach((s) => m.set(s, (m.get(s) || 0) + 1)))
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [all])

  return (
    <div>
      <PageHeading
        title="Team"
        subtitle={`Who is on shift, what they are skilled on, and how much open work each is carrying. ${deptName}.`}
        right={<ActionButton onClick={() => setAdding(true)}>Add team member</ActionButton>}
      />

      <AddMemberModal
        open={adding}
        onClose={() => setAdding(false)}
        onCreate={create}
        created={created}
      />

      <StatCards items={[
        { label: 'People', value: all.length, note: `${technicians.length} technicians`, icon: 'people' },
        { label: 'Teams', value: TEAMS.length, note: `${SHIFTS.length} shift patterns` },
        { label: 'Unassigned work', value: unassignedWork.length, tone: unassignedWork.length ? 'warning' : 'success', note: 'No owner yet', icon: 'clock' },
        { label: 'Busiest', value: busiest ? busiest.name.split(' ')[0] : '—', note: busiest ? `${hrs(busiest._openHours)} of open work` : '', icon: 'wrench' },
        { label: 'Open hours on the roster', value: hrs(all.reduce((s, u) => s + u._openHours, 0)), note: 'Estimated, assigned only' },
      ]} />

      {unassignedWork.length > 0 && (
        <Note tone="warn">
          <b>{unassignedWork.length} open work orders have no owner.</b>{' '}
          {unassignedWork.map((w) => `${w.woNo} ${w.title}`).join(' · ')} — these are the rows a
          planner assigns first, and they carry {hrs(unassignedWork.reduce((s, w) => s + (w.aiEstimateHrs || 0), 0))} of estimated work.
        </Note>
      )}

      <Section title="Roster">
        <Toolbar
          search={search} onSearch={setSearch}
          placeholder="Search name, role, team or skill…"
          filters={[
            { label: 'Team', value: team, onChange: setTeam, options: [...new Set([...TEAMS, ...all.map((u) => u.team)])].filter(Boolean).sort() },
            { label: 'Shift', value: shift, onChange: setShift, options: SHIFTS },
          ]}
        />

        <DataTable
          rows={rows}
          pageSize={12}
          empty="Nobody matches these filters."
          columns={[
            { key: 'userId', label: 'ID', width: 76, render: (u) => <Ref>{u.userId}</Ref> },
            { key: 'name', label: 'Name', width: 170, render: (u) => <TwoLine top={u.name} bottom={u.role} /> },
            { key: 'department', label: 'Dept', width: 76, render: (u) => <DeptChip code={u.department} name={u._departmentName} /> },
            { key: 'team', label: 'Team', width: 180 },
            { key: 'shift', label: 'Shift', width: 148, render: (u) => <StatusBadge tone={/Day/.test(u.shift) ? 'green' : /Evening/.test(u.shift) ? 'blue' : 'grey'}>{u.shift}</StatusBadge> },
            {
              key: 'skills', label: 'Skills',
              sortable: false,
              render: (u) => (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {u.skills.map((s) => <span key={s} style={chip}>{s}</span>)}
                </div>
              ),
            },
            {
              key: '_open', label: 'Open work', width: 138, align: 'right',
              sortValue: (u) => u._openHours,
              render: (u) => (
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {u._open}
                    <span style={{ fontWeight: 500, color: '#94a3b8' }}> · {hrs(u._openHours)}</span>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <Meter value={u._open} max={maxOpen} tone={u._open ? '#15227a' : '#cbd5e1'} height={5} />
                  </div>
                </div>
              ),
            },
            {
              key: '_completed', label: 'Done', width: 86, align: 'right',
              render: (u) => <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{u._completed}{u._hoursLogged ? ` · ${u._hoursLogged}h` : ''}</span>,
            },
          ]}
        />
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
        <Section title="Open work by person">
          <Bars data={all.filter((u) => u._open).map((u) => ({ name: u.name, value: u._open })).sort((a, b) => b.value - a.value)} />
          <Note tone="grey">
            No utilisation percentage is shown. The workbook gives shifts but no available-hours
            figure, and a capacity number without one would be invented.
          </Note>
        </Section>

        <Section title="Skill coverage" right={<span style={{ fontSize: 11.5, color: '#94a3b8' }}>people holding each skill</span>}>
          <Bars data={skills.slice(0, 10)} />
          {skills.some((s) => s.value === 1) && (
            <Note tone="warn">
              {skills.filter((s) => s.value === 1).length} skills are held by one person only —
              a single point of cover if they are off shift.
            </Note>
          )}
        </Section>
      </div>

      <Section title="Cover by shift">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
          {SHIFTS.map((s) => {
            const on = all.filter((u) => u.shift === s)
            return (
              <Fact
                key={s}
                label={s}
                value={`${on.length} ${on.length === 1 ? 'person' : 'people'}`}
                sub={on.map((u) => u.name.split(' ')[0]).join(', ')}
              />
            )
          })}
        </div>
      </Section>
    </div>
  )
}

const chip = {
  padding: '2px 7px', borderRadius: 999, background: '#f1f5f9',
  border: '1px solid #e2e8f0', color: '#475569', fontSize: 10.5, fontWeight: 600,
  whiteSpace: 'nowrap',
}
