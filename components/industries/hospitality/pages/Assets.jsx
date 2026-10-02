'use client'

// The asset register.
//
// Split in the filter rather than in the data, because a hotel's estate really
// is two things: plant, which the whole property depends on and there is one of
// each, and in-suite equipment, which there are ninety-eight of each. A single
// undifferentiated list of six hundred rows buries the eleven that matter.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, DataTable, Toolbar, StatusBadge, PALETTE,
} from '../lib/kit'
import { ASSETS, PLANT_ASSETS, SUITE_ASSETS, WORK_ORDERS, fmtDate } from '../lib/data'

const { ACCENT, INK, SUB, MUTE } = PALETTE

const SCOPE = ['Plant', 'In suite']

export default function Assets() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [scope, setScope] = useState('all')
  const [type, setType] = useState('all')

  const rows = useMemo(() => ASSETS.filter((a) => {
    if (scope === 'Plant' && a.in_suite) return false
    if (scope === 'In suite' && !a.in_suite) return false
    if (type !== 'all' && a.asset_type !== type) return false
    if (q && !`${a.asset_name} ${a.asset_code} ${a.asset_type} ${a.location_name}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }).map((a) => ({ ...a, id: a.asset_id })), [q, scope, type])

  const types = [...new Set(ASSETS.map((a) => a.asset_type))].sort()
  const down = ASSETS.filter((a) => a.status === 'Down').length

  const columns = [
    { key: 'asset_name', label: 'Asset', render: (r) => <strong style={{ color: INK }}>{r.asset_name}</strong> },
    { key: 'asset_code', label: 'Code', render: (r) => <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5, color: SUB }}>{r.asset_code}</span> },
    { key: 'asset_type', label: 'Type' },
    { key: 'location_name', label: 'Location' },
    { key: 'criticality', label: 'Criticality', render: (r) => <StatusBadge tone={r.criticality === 'High' ? 'red' : r.criticality === 'Medium' ? 'amber' : 'grey'}>{r.criticality}</StatusBadge> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge>{r.status}</StatusBadge> },
    { key: 'health_score', label: 'Health', align: 'right', render: (r) => `${r.health_score}%` },
  ]

  const wosFor = (id) => WORK_ORDERS.filter((w) => w.asset_id === id)

  return (
    <div>
      <PageHeading
        title="Assets"
        subtitle={`${ASSETS.length} assets — ${PLANT_ASSETS.length} plant, ${SUITE_ASSETS.length} in the suites`}
      />

      <StatCards items={[
        { label: 'Total assets', value: ASSETS.length, note: `${types.length} types` },
        { label: 'Plant', value: PLANT_ASSETS.length, note: 'the property depends on these' },
        { label: 'In suite', value: SUITE_ASSETS.length, note: '6 per suite, kitchen included' },
        { label: 'Down', value: down, tone: down ? 'red' : 'green', note: down ? 'needs a work order' : 'all running' },
      ]} />

      <Toolbar
        search={q}
        onSearch={setQ}
        placeholder="Asset, code, type or location…"
        filters={[
          { label: 'Scope', value: scope, onChange: setScope, options: SCOPE },
          { label: 'Type', value: type, onChange: setType, options: types },
        ]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} of {ASSETS.length}</span>}
      />

      <DataTable columns={columns} rows={rows} pageSize={14} onRowClick={(r) => router.push(`/portal/hospitality/assets/${r.asset_id}`)} />

    </div>
  )
}
