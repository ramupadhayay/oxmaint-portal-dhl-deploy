'use client'

// Focus Area 2 — SAP integration, the asset half.
//
// The client's ask is written as a negative: no duplicate entry. Their filters
// already exist in SAP as equipment under a functional location, and a
// compliance system that makes a technician type the same identifiers a second
// time has added work rather than removed it.
//
// So this screen is the mapping itself — one row per filter, showing the SAP
// equipment id and functional location it is already known by, and whether that
// mapping is complete. Where an identifier is missing, that is the gap the
// integration has to close, and it is shown rather than hidden.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, DataTable, Toolbar, Card, PALETTE,
} from '../lib/kit'
import { SAP_RECORDS, FILTER_VIEW, CLEANROOMS } from '../lib/data'
import { DateCell, Status, Id } from '../lib/ui'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

const filterOf = (id) => FILTER_VIEW.find((f) => f.filterId === id) || null

const ROWS = SAP_RECORDS.map((s) => {
  const f = filterOf(s.filterId)
  return {
    ...s,
    id: s.filterId,
    cleanroomId: f?.cleanroomId || null,
    cleanroomName: f?.cleanroomName || '—',
    isoClass: f?.isoClass || '—',
    // A mapping is only useful if every identifier the integration needs is
    // there. One missing field is a row that will fail at the boundary, so it
    // is counted as incomplete rather than "mostly mapped".
    complete: Boolean(s.sapEquipmentId && s.sapFunctionalLocation && s.documentRef),
  }
})

export default function SapAssets() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [room, setRoom] = useState('all')
  const [type, setType] = useState('all')

  const rows = useMemo(() => ROWS.filter((r) => {
    if (room !== 'all' && r.cleanroomId !== room) return false
    if (type !== 'all' && r.workOrderType !== type) return false
    if (q) {
      const hay = `${r.filterId} ${r.sapEquipmentId} ${r.sapFunctionalLocation} ${r.sapWorkOrder} ${r.documentRef} ${r.cleanroomName}`
      if (!hay.toLowerCase().includes(q.toLowerCase())) return false
    }
    return true
  }), [q, room, type])

  const columns = [
    { key: 'filterId', label: 'Oxmaint filter', render: (r) => <span><Id strong>{r.filterId}</Id><span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{r.cleanroomName} · {r.isoClass}</span></span> },
    { key: 'sapEquipmentId', label: 'SAP equipment', render: (r) => <Id strong>{r.sapEquipmentId}</Id> },
    { key: 'sapFunctionalLocation', label: 'Functional location', render: (r) => <Id>{r.sapFunctionalLocation}</Id> },
    { key: 'workOrderType', label: 'Order type', render: (r) => <span style={{ fontSize: 12 }}>{r.workOrderType}</span> },
    { key: 'sapWorkOrder', label: 'Work order', render: (r) => <Id>{r.sapWorkOrder}</Id> },
    { key: 'documentRef', label: 'Certification doc', render: (r) => <Id>{r.documentRef}</Id> },
    { key: 'syncStatus', label: 'Sync', render: (r) => <Status>{r.syncStatus}</Status> },
    { key: 'date', label: 'Last sync', render: (r) => <DateCell shifted={r.date} original={r.lastSync} /> },
  ]

  const complete = ROWS.filter((r) => r.complete).length

  return (
    <div>
      <PageHeading
        title="SAP Asset Mapping"
        subtitle="Every HEPA filter against the SAP equipment id and functional location it is already known by — so an identifier is entered once, in the system of record, and read here."
      />


      <StatCards items={[
        { label: 'Filters mapped', value: ROWS.length, icon: 'asset', note: `of ${FILTER_VIEW.length} on the registry` },
        { label: 'Complete mappings', value: complete, icon: 'tick', tone: complete === ROWS.length ? 'green' : 'amber', note: 'equipment, location and document' },
        { label: 'Functional locations', value: new Set(ROWS.map((r) => r.sapFunctionalLocation)).size, icon: 'site', note: 'in the SAP hierarchy' },
        { label: 'Order types', value: new Set(ROWS.map((r) => r.workOrderType)).size, icon: 'wrench', note: 'PM plans behind the tests' },
        { label: 'Unmapped filters', value: FILTER_VIEW.length - ROWS.length, icon: 'alert', tone: FILTER_VIEW.length - ROWS.length ? 'red' : 'green', note: 'would need duplicate entry' },
      ]} />

      <Card style={{ marginBottom: 14, background: '#fcfdfe' }}>
        <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
            <rect x="2" y="4" width="8" height="7" rx="1.5" /><rect x="14" y="13" width="8" height="7" rx="1.5" />
            <path d="M10 7.5h4a2 2 0 0 1 2 2V13" /><path d="M14 16.5h-4a2 2 0 0 1-2-2V11" />
          </svg>
          <p style={{ margin: 0, fontSize: 12, color: SUB, lineHeight: 1.6 }}>
            <strong style={{ color: INK }}>No duplicate entry.</strong> The equipment id
            and functional location are SAP&apos;s, not ours — a filter is created once
            in the asset master and referenced here. The compliance record adds
            what SAP does not hold (the integrity test, the signature, the
            retention clock) and hands back what SAP does (the work order).
          </p>
        </div>
      </Card>

      <Toolbar
        search={q}
        onSearch={setQ}
        placeholder="Filter, equipment id, functional location, work order…"
        filters={[
          { label: 'Cleanroom', value: room, onChange: setRoom, options: CLEANROOMS.map((c) => c.cleanroomId) },
          { label: 'Order type', value: type, onChange: setType, options: [...new Set(ROWS.map((r) => r.workOrderType))] },
        ]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} of {ROWS.length}</span>}
      />

      <DataTable
        columns={columns}
        rows={rows}
        pageSize={14}
        onRowClick={(r) => router.push(`/portal/hepa/filters/${r.filterId}`)}
      />

      <p style={{ fontSize: 11.5, color: MUTE, margin: '12px 2px 0', paddingTop: 12, borderTop: `1px solid ${LINE}`, lineHeight: 1.55 }}>
        A row opens the filter, where the SAP identifiers sit beside the tests,
        readings and certification document they belong to. Sync state and its
        failures are on the <strong style={{ color: INK }}>Sync Monitor</strong>.
      </p>
    </div>
  )
}
