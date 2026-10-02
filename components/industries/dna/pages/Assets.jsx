'use client'

// The asset register — 26 machines down the production line.
//
// Ordered by the process rather than by id, because that is how the plant is
// walked: spinning, warping and sizing, weaving, dyeing, FR finishing, general
// finishing, QC testing, utilities, material handling. A register sorted
// alphabetically puts the flame test chamber between the fabric compactor and
// the forklift, which is nobody's mental model of a textile mill.
//
// The coverage column is the one a maintenance manager reads first: eight of
// these carry neither a PM schedule nor a work order. Some of that is
// legitimate — a standby boiler and three QC instruments do sit quiet — but it
// is the question worth arriving at, so the screen surfaces it rather than
// leaving it to be counted by hand.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Section, DataTable, Toolbar, StatusBadge, ActionButton } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, DeptChip, TwoLine, Criticality, Note, Bars } from '../components/cells'
import { useDept } from '../lib/deptStore'
import { useAssetStore } from '../lib/store'
import AddAssetModal from '../components/AddAssetModal'
import { assets, ASSET_CATEGORIES, ASSET_STATUSES, uncoveredAssets, fmtDate, locName } from '../lib/data'

// The order the fabric actually moves through the plant.
const PROCESS_ORDER = [
  'Spinning', 'Warping', 'Sizing', 'Weaving', 'Dyeing', 'FR Finishing',
  'Finishing', 'QC / Testing', 'Utilities', 'Material Handling',
]
const processRank = (c) => {
  const i = PROCESS_ORDER.indexOf(c)
  return i === -1 ? PROCESS_ORDER.length : i
}

const STATUS_TONE = { Running: 'green', Standby: 'blue', Down: 'red' }

export default function Assets() {
  const router = useRouter()
  const { scope, deptName } = useDept()
  const { created, create, persisted } = useAssetStore()
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [criticality, setCriticality] = useState('all')

  // Assets added in the portal are given the derived fields the workbook rows
  // already carry, so every column, filter and count below works on them without
  // a special case. They have no history yet by definition — no work orders, no
  // schedules, no downtime — which is true rather than a gap to paper over.
  const addedRows = useMemo(() => created.map((a) => ({
    ...a,
    _location: null,
    _locationName: locName(a.locationCode),
    _workOrders: 0,
    _openWorkOrders: 0,
    _pmCount: 0,
    _downtimeHrs: 0,
    _parts: 0,
  })), [created])

  const all = useMemo(
    () => [...scope([...addedRows, ...assets])]
      .sort((a, b) => processRank(a.category) - processRank(b.category) || String(a.assetId).localeCompare(String(b.assetId))),
    [scope, addedRows]
  )

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((a) => (
      (category === 'all' || a.category === category) &&
      (status === 'all' || a.status === status) &&
      (criticality === 'all' || a.criticality === criticality) &&
      (!q || [a.assetId, a.name, a.manufacturer, a.model, a.serial, a.category, a._locationName]
        .join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, category, status, criticality])

  const down = all.filter((a) => a.status === 'Down')
  const critical = all.filter((a) => a.criticality === 'High')
  const uncovered = all.filter((a) => !a._pmCount && !a._workOrders)

  return (
    <div>
      <PageHeading
        title="Assets Master"
        subtitle={`${all.length} machines from the spinning floor through to the effluent pump, each with its maintenance and downtime history. ${deptName}.`}
        right={<ActionButton onClick={() => setAdding(true)}>Add asset</ActionButton>}
      />

      <AddAssetModal
        open={adding}
        onClose={() => setAdding(false)}
        onCreate={create}
        created={created}
      />

      <StatCards items={[
        { label: 'Assets', value: all.length, note: `${ASSET_CATEGORIES.length} categories`, icon: 'asset' },
        { label: 'Running', value: all.filter((a) => a.status === 'Running').length, tone: 'success', icon: 'tick' },
        { label: 'Down', value: down.length, tone: down.length ? 'destructive' : 'success', note: down.map((a) => a.name).join(', ') || 'None' },
        { label: 'High criticality', value: critical.length, tone: 'warning', note: 'Line-stopping if lost' },
        { label: 'No PM or work order', value: uncovered.length, tone: uncovered.length ? 'warning' : 'success', note: 'Coverage gap to review' },
      ]} />

      {uncovered.length > 0 && (
        <Note tone="warn">
          <b>{uncovered.length} assets carry neither a PM schedule nor a work order:</b>{' '}
          {uncovered.map((a) => `${a.assetId} ${a.name}`).join(' · ')}. A standby boiler and the QC
          instruments may be deliberate; the rest is worth a decision.
        </Note>
      )}

      <Section title="Register">
        <Toolbar
          search={search} onSearch={setSearch}
          placeholder="Search asset, manufacturer, model or serial…"
          filters={[
            { label: 'Category', value: category, onChange: setCategory, options: ASSET_CATEGORIES },
            { label: 'Status', value: status, onChange: setStatus, options: ASSET_STATUSES },
            { label: 'Criticality', value: criticality, onChange: setCriticality, options: ['High', 'Medium', 'Low'] },
          ]}
        />

        <DataTable
          rows={rows}
          pageSize={15}
          onRowClick={(a) => router.push(`/portal/dna/assets/${a.assetId}`)}
          empty="No assets match these filters."
          columns={[
            { key: 'assetId', label: 'Asset ID', width: 106, render: (a) => <Ref>{a.assetId}</Ref> },
            { key: 'name', label: 'Asset', render: (a) => <TwoLine top={a.name} bottom={`${a.manufacturer} ${a.model}`} /> },
            {
              key: 'category', label: 'Process step', width: 138,
              sortValue: (a) => processRank(a.category),
            },
            { key: 'locationCode', label: 'Dept', width: 76, render: (a) => <DeptChip code={a.locationCode} name={a._locationName} /> },
            { key: 'serial', label: 'Serial', width: 106, render: (a) => <span style={{ fontSize: 11.5, color: '#64748b', fontFamily: 'ui-monospace, monospace' }}>{a.serial}</span> },
            { key: 'installDate', label: 'Installed', width: 116, render: (a) => <span style={{ fontSize: 12 }}>{fmtDate(a.installDate)}</span> },
            { key: 'criticality', label: 'Criticality', width: 108, render: (a) => <Criticality value={a.criticality} /> },
            {
              key: '_pmCount', label: 'Cover', width: 110, align: 'right',
              sortValue: (a) => a._pmCount + a._workOrders,
              render: (a) => (
                a._pmCount || a._workOrders
                  ? <span style={{ fontSize: 11.5, color: '#475569' }}>{a._pmCount} PM · {a._workOrders} WO</span>
                  : <span style={{ fontSize: 11, color: '#b45309', fontWeight: 700 }}>none</span>
              ),
            },
            { key: 'status', label: 'Status', width: 100, render: (a) => <StatusBadge tone={STATUS_TONE[a.status]}>{a.status}</StatusBadge> },
          ]}
        />
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
        <Section title="Assets by process step">
          <Bars
            data={[...ASSET_CATEGORIES]
              .sort((a, b) => processRank(a) - processRank(b))
              .map((c) => ({ name: c, value: all.filter((a) => a.category === c).length }))}
          />
        </Section>
        <Section title="Assets by manufacturer">
          <Bars
            data={[...new Set(all.map((a) => a.manufacturer))]
              .map((m) => ({ name: m, value: all.filter((a) => a.manufacturer === m).length }))
              .sort((a, b) => b.value - a.value)
              .slice(0, 8)}
          />
        </Section>
      </div>
    </div>
  )
}
