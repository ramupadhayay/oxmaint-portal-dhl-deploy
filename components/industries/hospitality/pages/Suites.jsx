'use client'

// The suite register.
//
// The rotation board answers "are we keeping up" at a glance; this answers
// "tell me about 214" — the list a person searches, sorts and filters. Both
// read the same suites, so a suite that is overdue on one is overdue on both.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, DataTable, Toolbar, StatusBadge, PALETTE,
} from '../lib/kit'
import { SUITE_ASSETS, SUITE_PM, fmtDate } from '../lib/data'
import { useSuites } from '../lib/live'

const { ACCENT, INK, SUB, MUTE } = PALETTE

const stateTone = (s) => (
  s === 'Overdue' ? 'red' : s === 'Due today' ? 'amber' : s === 'Done this cycle' ? 'green' : 'grey'
)

export default function Suites() {
  const router = useRouter()
  const SUITES = useSuites()
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')
  const [floor, setFloor] = useState('all')

  const rows = useMemo(() => SUITES.filter((s) => {
    if (type !== 'all' && s.suite_type !== type) return false
    if (floor !== 'all' && String(s.floor) !== floor) return false
    if (q && !`${s.suite_number} ${s.suite_type}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
    // See SuiteRotation: SUITES is a hook result now, so it has to be a
    // dependency or this list keeps drawing the state it first rendered.
  }).map((s) => ({ ...s, id: s.suite_id })), [SUITES, q, type, floor])

  const types = [...new Set(SUITES.map((s) => s.suite_type))]
  const floors = [...new Set(SUITES.map((s) => s.floor))].sort().map(String)
  const occupied = SUITES.filter((s) => s.occupied).length

  const columns = [
    { key: 'suite_number', label: 'Suite', render: (r) => <strong style={{ color: INK }}>{r.suite_number}</strong> },
    { key: 'suite_type', label: 'Type' },
    { key: 'floor', label: 'Floor', align: 'center' },
    { key: 'occupied', label: 'Status', render: (r) => <StatusBadge tone={r.occupied ? 'blue' : 'grey'}>{r.occupied ? 'Occupied' : 'Vacant'}</StatusBadge> },
    { key: 'pet_friendly', label: 'Pets', align: 'center', render: (r) => (r.pet_friendly ? 'Yes' : '—') },
    { key: 'last_pm_date', label: 'Last PM', render: (r) => fmtDate(r.last_pm_date), sortValue: (r) => new Date(r.last_pm_date).getTime() },
    { key: 'next_pm_date', label: 'Next due', render: (r) => fmtDate(r.next_pm_date), sortValue: (r) => new Date(r.next_pm_date).getTime() },
    { key: 'state', label: 'Rotation', render: (r) => <StatusBadge tone={stateTone(r.state)}>{r.state}</StatusBadge> },
  ]

  const assetsFor = (n) => SUITE_ASSETS.filter((a) => a.suite_number === n)

  return (
    <div>
      <PageHeading
        title="Suites"
        subtitle={`${SUITES.length} suites across ${floors.length} floors — every one with a full kitchen`}
      />

      <StatCards items={[
        { label: 'Suites', value: SUITES.length, note: `${types.length} types` },
        { label: 'Occupied', value: occupied, note: `${Math.round((occupied / SUITES.length) * 100)}% of the house` },
        { label: 'Pet friendly', value: SUITES.filter((s) => s.pet_friendly).length, note: 'up to 2 per suite' },
        { label: 'Overdue PM', value: SUITES.filter((s) => s.state === 'Overdue').length, tone: SUITES.some((s) => s.state === 'Overdue') ? 'red' : 'green', note: 'carried on the schedule' },
      ]} />

      <Toolbar
        search={q}
        onSearch={setQ}
        placeholder="Suite number or type…"
        filters={[
          { label: 'Type', value: type, onChange: setType, options: types },
          { label: 'Floor', value: floor, onChange: setFloor, options: floors },
        ]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} of {SUITES.length}</span>}
      />

      <DataTable columns={columns} rows={rows} pageSize={14} onRowClick={(r) => router.push(`/portal/hospitality/suites/${r.suite_number}`)} />

    </div>
  )
}
