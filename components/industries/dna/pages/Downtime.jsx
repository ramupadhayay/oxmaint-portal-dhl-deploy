'use client'

// Downtime tracking, and the Pareto that makes it worth tracking.
//
// Six events, eighteen hours. Small enough that the table shows all of it and
// large enough to make the point the customer asked about: seven and a half of
// those hours were planned maintenance and ten and a half were not, and it is
// the second number that costs a shift.
//
// Planned and unplanned are separated everywhere rather than summed into one
// availability figure. A mill that took a loom down for a scheduled PM has not
// lost the same thing as one whose loom stopped on a warp fault, and a single
// "18 hours down" headline hides exactly the distinction a maintenance manager
// is trying to shift.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Section, DataTable, Toolbar, StatusBadge } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, DeptChip, TwoLine, Note, Bars, Fact } from '../components/cells'
import { useDept } from '../lib/deptStore'
import { downtime, downtimeBy, downtimeHours, unplannedHours, hrs } from '../lib/data'

export default function Downtime() {
  const router = useRouter()
  const { scope, deptName } = useDept()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')

  const all = useMemo(() => scope(downtime), [scope])
  const categories = [...new Set(downtime.map((d) => d.category))]

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((d) => (
      (category === 'all' || d.category === category) &&
      (!q || [d.logId, d.assetId, d._assetName, d.reason, d.category, d.reportedBy].join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, category])

  const total = Number(all.reduce((s, d) => s + (d.hours || 0), 0).toFixed(1))
  const unplanned = all.filter((d) => !d._planned)
  const unplannedTotal = Number(unplanned.reduce((s, d) => s + (d.hours || 0), 0).toFixed(1))
  const worst = [...all].sort((a, b) => b.hours - a.hours)[0]

  // Hours per asset, so the machine costing the most time is named rather than
  // left for the reader to add up from the log.
  const byAsset = useMemo(() => {
    const m = new Map()
    all.forEach((d) => m.set(d._assetName, (m.get(d._assetName) || 0) + (d.hours || 0)))
    return [...m.entries()].map(([name, value]) => ({ name, value: Number(value.toFixed(1)) })).sort((a, b) => b.value - a.value)
  }, [all])

  return (
    <div>
      <PageHeading
        title="Downtime Log"
        subtitle={`Every stoppage with its cause, duration and who reported it — planned work separated from the rest. ${deptName}.`}
      />

      <StatCards items={[
        { label: 'Events logged', value: all.length, note: `${unplanned.length} unplanned`, icon: 'list' },
        { label: 'Total hours', value: total, unit: 'h', icon: 'clock' },
        { label: 'Unplanned', value: unplannedTotal, unit: 'h', tone: 'warning', note: total ? `${Math.round((unplannedTotal / total) * 100)}% of all downtime` : '' },
        { label: 'Planned', value: Number((total - unplannedTotal).toFixed(1)), unit: 'h', tone: 'success', note: 'Scheduled maintenance' },
        { label: 'Longest single stop', value: worst ? `${worst.hours}` : '—', unit: worst ? 'h' : '', note: worst ? `${worst._assetName} · ${worst.reason}` : '' },
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
        <Section title="Hours by cause" right={<span style={{ fontSize: 11.5, color: '#94a3b8' }}>Pareto — worst first</span>}>
          <Bars data={downtimeBy('reason')} unit=" h" />
        </Section>
        <Section title="Hours by category">
          <Bars data={downtimeBy('category')} unit=" h" colors={['#b45309', '#15227a', '#64748b']} />
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
            <Fact label="Mechanical" value={hrs(downtimeBy('category').find((c) => c.name === 'Mechanical')?.value ?? 0)} sub="Roller wear, belt slip, seal leak" />
            <Fact label="Electrical" value={hrs(downtimeBy('category').find((c) => c.name === 'Electrical')?.value ?? 0)} sub="Sensor fault" />
          </div>
        </Section>
      </div>

      <Section title="Downtime by asset">
        <Bars data={byAsset} unit=" h" />
      </Section>

      <Section title="Event log">
        <Toolbar
          search={search} onSearch={setSearch}
          placeholder="Search asset, reason or reporter…"
          filters={[{ label: 'Category', value: category, onChange: setCategory, options: categories }]}
        />

        <DataTable
          rows={rows}
          pageSize={12}
          onRowClick={(d) => d._asset && router.push(`/portal/dna/assets/${d.assetId}`)}
          empty="No downtime recorded for this filter."
          columns={[
            { key: 'logId', label: 'Log', width: 84, render: (d) => <Ref>{d.logId}</Ref> },
            { key: 'assetId', label: 'Asset', render: (d) => <TwoLine top={d._assetName} bottom={d.assetId} /> },
            { key: 'locationCode', label: 'Dept', width: 76, render: (d) => <DeptChip code={d.locationCode} name={d._locationName} /> },
            { key: 'start', label: 'Started', width: 150, render: (d) => <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{d.start}</span> },
            { key: 'end', label: 'Ended', width: 150, render: (d) => <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{d.end}</span> },
            {
              key: 'hours', label: 'Duration', width: 96, align: 'right',
              render: (d) => <span style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{hrs(d.hours)}</span>,
            },
            { key: 'reason', label: 'Reason', width: 140 },
            {
              key: 'category', label: 'Category', width: 118,
              render: (d) => <StatusBadge tone={d._planned ? 'green' : d.category === 'Electrical' ? 'blue' : 'amber'}>{d.category}</StatusBadge>,
            },
            { key: 'reportedBy', label: 'Reported by', width: 148 },
          ]}
        />
      </Section>

      <Note tone="grey">
        Every stoppage names an asset on the register, so downtime hours can be read against
        that machine&apos;s work orders and PM history rather than sitting in a log of their own.
      </Note>
    </div>
  )
}
