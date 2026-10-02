'use client'

// The PM calendar — "PM System Review" on the customer's list.
//
// Thirteen schedules across six frequency types, and the frequencies are not all
// calendar-based: the compressor runs on "500 hrs", a meter interval rather than
// a date. It still carries a next-due date in the sheet, so it appears on the
// calendar like the rest, but the frequency column says what actually drives it.
// Flattening that to "Monthly" would misstate how the schedule is triggered.
//
// Compliance is the share of schedules not past their date. With thirteen rows a
// single overdue schedule moves it eight points, so the count is shown beside
// the percentage — a bare "92%" invites a question the number alone cannot
// answer.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Section, DataTable, Toolbar, StatusBadge } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, DeptChip, TwoLine, DueDate, Note, Bars } from '../components/cells'
import { useDept } from '../lib/deptStore'
import { pmSchedules, overduePM, pmCompliance, PM_FREQUENCIES, PM_TEAMS, hrs } from '../lib/data'

const STATUS_TONE = { Overdue: 'red', 'Due today': 'amber', 'Due soon': 'blue', Scheduled: 'green' }

export default function PmSchedules() {
  const router = useRouter()
  const { deptName, dept } = useDept()
  const [search, setSearch] = useState('')
  const [frequency, setFrequency] = useState('all')
  const [team, setTeam] = useState('all')

  // PM rows name an asset, not a department, so scoping goes through the asset.
  const all = useMemo(
    () => (dept === 'all' ? pmSchedules : pmSchedules.filter((p) => p._asset?.locationCode === dept)),
    [dept]
  )

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((p) => (
      (frequency === 'all' || p.frequency === frequency) &&
      (team === 'all' || p.team === team) &&
      (!q || [p.pmId, p.task, p._assetName, p.assetId, p.checklist, p.team].join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, frequency, team])

  const late = all.filter((p) => p._status === 'Overdue')
  const soon = all.filter((p) => p._status === 'Due soon' || p._status === 'Due today')
  const load = all.reduce((s, p) => s + (p.estimateHrs || 0), 0)

  return (
    <div>
      <PageHeading
        title="PM Schedules"
        subtitle={`Recurring preventive maintenance — what is due, what is late, and the checklist each one carries. ${deptName}.`}
      />

      <StatCards items={[
        { label: 'Schedules', value: all.length, note: `${PM_FREQUENCIES.length} frequency types`, icon: 'list' },
        { label: 'Compliance', value: `${pmCompliance}%`, tone: pmCompliance >= 90 ? 'success' : 'warning', note: `${overduePM.length} of ${pmSchedules.length} past due`, icon: 'tick' },
        { label: 'Overdue', value: late.length, tone: late.length ? 'destructive' : 'success', note: late.map((p) => p.pmId).join(', ') || 'Everything in date' },
        { label: 'Due within 7 days', value: soon.length, tone: soon.length ? 'warning' : undefined, icon: 'clock' },
        { label: 'Cycle workload', value: hrs(load), note: 'One pass of every schedule' },
      ]} />

      {late.length > 0 && (
        <Note tone="warn">
          <b>{late.length} schedule{late.length === 1 ? '' : 's'} past due.</b>{' '}
          {late.map((p) => `${p.pmId} — ${p.task} (${Math.abs(p._daysToDue)} days)`).join(' · ')}
        </Note>
      )}

      <Section title="Schedule register">
        <Toolbar
          search={search} onSearch={setSearch}
          placeholder="Search task, asset, team or checklist…"
          filters={[
            { label: 'Frequency', value: frequency, onChange: setFrequency, options: PM_FREQUENCIES },
            { label: 'Team', value: team, onChange: setTeam, options: PM_TEAMS },
          ]}
        />

        <DataTable
          rows={rows}
          pageSize={15}
          onRowClick={(p) => router.push(`/portal/dna/pm-schedules/${p.pmId}`)}
          empty="No schedules match these filters."
          columns={[
            { key: 'pmId', label: 'PM', width: 84, render: (p) => <Ref>{p.pmId}</Ref> },
            { key: 'task', label: 'Task', render: (p) => <TwoLine top={p.task} bottom={p.checklist} /> },
            {
              key: 'assetId', label: 'Asset', width: 190,
              render: (p) => <TwoLine top={p._assetName} bottom={p.assetId} />,
            },
            {
              key: 'locationCode', label: 'Dept', width: 76,
              sortValue: (p) => p._asset?.locationCode || '',
              render: (p) => <DeptChip code={p._asset?.locationCode} name={p._locationName} />,
            },
            { key: 'frequency', label: 'Frequency', width: 106 },
            { key: 'lastDone', label: 'Last done', width: 118, render: (p) => <DueDate value={p.lastDone} days={null} done /> },
            {
              key: 'nextDue', label: 'Next due', width: 120,
              sortValue: (p) => p._daysToDue ?? 9999,
              render: (p) => <DueDate value={p.nextDue} days={p._daysToDue} />,
            },
            {
              key: 'estimateHrs', label: 'Est.', width: 72, align: 'right',
              render: (p) => <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{hrs(p.estimateHrs)}</span>,
            },
            { key: 'team', label: 'Team', width: 168 },
            { key: '_status', label: 'Status', width: 112, render: (p) => <StatusBadge tone={STATUS_TONE[p._status]}>{p._status}</StatusBadge> },
          ]}
        />
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
        <Section title="Schedules by frequency">
          <Bars data={PM_FREQUENCIES.map((f) => ({ name: f, value: all.filter((p) => p.frequency === f).length })).sort((a, b) => b.value - a.value)} />
        </Section>
        <Section title="Cycle hours by team">
          <Bars
            unit=" h"
            data={PM_TEAMS.map((t) => ({
              name: t,
              value: Number(all.filter((p) => p.team === t).reduce((s, p) => s + (p.estimateHrs || 0), 0).toFixed(1)),
            })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value)}
          />
        </Section>
      </div>
    </div>
  )
}
