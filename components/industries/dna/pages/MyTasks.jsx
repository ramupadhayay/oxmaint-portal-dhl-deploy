'use client'

// Maintenance > My Tasks — one technician's queue.
//
// The product's user-specific view. In the live platform "my" means the signed-in
// account; this portal has no sign-in, so the technician is picked from the
// roster instead. That is not a workaround to apologise for — it is the better
// demo, because it lets a room see the same plant through four different pairs of
// eyes in ten seconds, which is exactly the point being made about role-based
// views.
//
// Sorted by what is late first, then by what is due soonest. A technician's queue
// is not a register to browse; it is a list to work down.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Section, DataTable, StatusBadge, Priority } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, DeptChip, TwoLine, DueDate, Note, Fact } from '../components/cells'
import { users, workOrders, pmSchedules, unassignedWork, hrs } from '../lib/data'

export default function MyTasks() {
  const router = useRouter()

  // Default to whoever is carrying the most open work — the queue with something
  // in it is the one worth opening on.
  const withWork = users.filter((u) => u._open > 0)
  const [who, setWho] = useState(
    () => [...withWork].sort((a, b) => b._open - a._open)[0]?.name || users[0]?.name || ''
  )

  const me = users.find((u) => u.name === who) || null

  const mine = useMemo(() => workOrders
    .filter((w) => w.assignedTo === who)
    .sort((a, b) => (b._overdue - a._overdue) || ((a._daysToDue ?? 999) - (b._daysToDue ?? 999))), [who])

  const open = mine.filter((w) => w._open)
  const overdue = mine.filter((w) => w._overdue)
  const done = mine.filter((w) => w.status === 'Completed')

  // The schedules that belong to this person's team, so the queue shows planned
  // work alongside the jobs already raised from it.
  const myPm = useMemo(
    () => (me ? pmSchedules.filter((p) => p.team === me.team).sort((a, b) => (a._daysToDue ?? 999) - (b._daysToDue ?? 999)) : []),
    [me]
  )

  return (
    <div>
      <PageHeading
        title="My Tasks"
        subtitle="A single technician's queue — what is assigned to them, what is late, and what their team has scheduled next."
        right={
          <select value={who} onChange={(e) => setWho(e.target.value)} style={picker}>
            {users.map((u) => (
              <option key={u.userId} value={u.name}>
                {u.name} — {u.role}
              </option>
            ))}
          </select>
        }
      />

      {me && (
        <Note tone="grey">
          Viewing as <b>{me.name}</b>, {me.role} on the {me.team} team, {me.shift.toLowerCase()} shift.
          In the live platform this is the signed-in user; here it is a picker, so the same plant
          can be seen through any technician on the roster.
        </Note>
      )}

      <StatCards items={[
        { label: 'Open tasks', value: open.length, note: `${hrs(open.reduce((s, w) => s + (w.aiEstimateHrs || 0), 0))} estimated`, icon: 'wrench' },
        { label: 'Overdue', value: overdue.length, tone: overdue.length ? 'destructive' : 'success', note: overdue.map((w) => w.woNo).join(', ') || 'Nothing late' },
        { label: 'Completed', value: done.length, tone: 'success', note: `${hrs(me?._hoursLogged ?? 0)} booked`, icon: 'tick' },
        { label: 'Team schedules', value: myPm.length, note: me ? me.team : '', icon: 'list' },
        { label: 'Unassigned in the plant', value: unassignedWork.length, tone: unassignedWork.length ? 'warning' : 'success', note: 'Nobody has picked these up' },
      ]} />

      <Section title={`Assigned to ${me ? me.name.split(' ')[0] : 'this technician'}`}>
        <DataTable
          rows={mine}
          pageSize={12}
          onRowClick={(w) => router.push(`/portal/dna/work-orders/${w.woNo}`)}
          empty="Nothing is assigned to this technician."
          columns={[
            { key: 'woNo', label: 'WO', width: 96, render: (w) => <Ref>{w.woNo}</Ref> },
            { key: 'title', label: 'Job', render: (w) => <TwoLine top={w.title} bottom={`${w._assetName} · ${w.type}`} /> },
            { key: 'locationCode', label: 'Dept', width: 76, render: (w) => <DeptChip code={w.locationCode} name={w._locationName} /> },
            { key: 'priority', label: 'Priority', width: 100, render: (w) => <Priority value={w.priority} /> },
            {
              key: 'dueDate', label: 'Due', width: 118,
              sortValue: (w) => w._daysToDue ?? 9999,
              render: (w) => <DueDate value={w.dueDate} days={w._daysToDue} done={!w._open} />,
            },
            {
              key: 'aiEstimateHrs', label: 'Est.', width: 76, align: 'right',
              render: (w) => <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{w.aiEstimateHrs !== null ? hrs(w.aiEstimateHrs) : '—'}</span>,
            },
            { key: 'status', label: 'Status', width: 112, render: (w) => <StatusBadge>{w.status}</StatusBadge> },
          ]}
        />
      </Section>

      {myPm.length > 0 && (
        <Section title={`${me?.team} — scheduled work`}>
          <DataTable
            rows={myPm}
            pageSize={10}
            onRowClick={(p) => router.push(`/portal/dna/pm-schedules/${p.pmId}`)}
            empty=""
            columns={[
              { key: 'pmId', label: 'PM', width: 84, render: (p) => <Ref>{p.pmId}</Ref> },
              { key: 'task', label: 'Task', render: (p) => <TwoLine top={p.task} bottom={p._assetName} /> },
              { key: 'frequency', label: 'Frequency', width: 110 },
              {
                key: 'nextDue', label: 'Next due', width: 120,
                sortValue: (p) => p._daysToDue ?? 9999,
                render: (p) => <DueDate value={p.nextDue} days={p._daysToDue} />,
              },
              { key: 'estimateHrs', label: 'Est.', width: 74, align: 'right', render: (p) => <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{hrs(p.estimateHrs)}</span> },
              {
                key: '_status', label: 'Status', width: 112,
                render: (p) => <StatusBadge tone={p._status === 'Overdue' ? 'red' : p._status === 'Due today' ? 'amber' : p._status === 'Due soon' ? 'blue' : 'green'}>{p._status}</StatusBadge>,
              },
            ]}
          />
        </Section>
      )}

      {unassignedWork.length > 0 && (
        <Section title="Available to pick up" right={<button onClick={() => router.push('/portal/dna/requests')} style={link}>Request queue →</button>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 10 }}>
            {unassignedWork.map((w) => (
              <button
                key={w.woNo}
                onClick={() => router.push(`/portal/dna/work-orders/${w.woNo}`)}
                style={{ padding: '13px 15px', border: '1px solid #e4e9f0', borderLeft: '3px solid #b45309', borderRadius: 11, background: '#fff', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                  <Ref>{w.woNo}</Ref>
                  <Priority value={w.priority} />
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a', marginTop: 6, lineHeight: 1.35 }}>{w.title}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  {w._assetName} · {hrs(w.aiEstimateHrs)} · due {w._daysToDue < 0 ? `${Math.abs(w._daysToDue)} days ago` : `in ${w._daysToDue} days`}
                </div>
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

const picker = {
  padding: '8px 11px', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 600,
  border: '1px solid #e4e9f0', borderRadius: 9, background: '#fff', color: '#15227a',
  outline: 'none', cursor: 'pointer', maxWidth: 280,
}
const link = { background: 'none', border: 'none', color: '#15227a', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }
