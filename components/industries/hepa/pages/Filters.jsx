'use client'

// The filter asset registry.
//
// Everything else in this portal hangs off a row here — the tests are of a
// filter, the leak readings are at a filter, the certification document is for
// a filter and the SAP equipment id is the same filter's. So this is the screen
// that has to be searchable by all of them, and the row opens the whole history.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeading, StatCards, DataTable, Toolbar, PALETTE } from '../lib/kit'
import { FILTER_VIEW, CLEANROOMS, HEADLINE, THRESHOLDS } from '../lib/data'
import { DateCell, DueIn, Status, Id, Penetration, Derived } from '../lib/ui'

const { INK, MUTE } = PALETTE

export default function Filters() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [room, setRoom] = useState('all')
  const [iso, setIso] = useState('all')
  const [state, setState] = useState('all')

  const rows = useMemo(() => FILTER_VIEW.filter((f) => {
    if (room !== 'all' && f.cleanroomId !== room) return false
    if (iso !== 'all' && f.isoClass !== iso) return false
    if (state !== 'all' && f.status !== state) return false
    if (q) {
      // Searchable by every identifier a person might have in hand: the filter
      // id off the label, the QR code off the frame, the SAP equipment number
      // out of the CMMS, or just the room they are standing in.
      const hay = `${f.filterId} ${f.qrCode} ${f.cleanroomId} ${f.cleanroomName} ${f.sap?.sapEquipmentId || ''} ${f.sap?.sapFunctionalLocation || ''}`
      if (!hay.toLowerCase().includes(q.toLowerCase())) return false
    }
    return true
  }).map((f) => ({ ...f, id: f.filterId })), [q, room, iso, state])

  const columns = [
    { key: 'filterId', label: 'Filter', render: (r) => <Id strong>{r.filterId}</Id> },
    { key: 'qrCode', label: 'QR', render: (r) => <Id>{r.qrCode}</Id> },
    {
      key: 'cleanroomName',
      label: 'Cleanroom',
      render: (r) => (
        <span>
          <strong style={{ color: INK }}>{r.cleanroomName}</strong>
          <span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{r.cleanroomId} · {r.isoClass}</span>
        </span>
      ),
    },
    { key: 'installedOn', label: 'Installed', render: (r) => <DateCell shifted={r.installedOn} original={r.installDate} /> },
    { key: 'ageDays', label: 'Age', align: 'right', render: (r) => <span>{r.ageDays}<span style={{ fontSize: 10.5, color: MUTE }}> d</span></span> },
    { key: 'testInterval', label: 'Interval' },
    { key: 'penetration', label: 'Last penetration', align: 'right', render: (r) => <Penetration value={r.lastTest?.penetration} />, sortValue: (r) => r.lastTest?.penetration ?? -1 },
    { key: 'testCount', label: 'Tests', align: 'center', render: (r) => (r.failCount ? <span><strong style={{ color: '#b91c1c' }}>{r.failCount}</strong><span style={{ color: MUTE }}> / {r.testCount}</span></span> : <span style={{ color: MUTE }}>0 / {r.testCount}</span>) },
    { key: 'breachCount', label: 'Breaches', align: 'center', render: (r) => (r.breachCount ? <strong style={{ color: '#b91c1c' }}>{r.breachCount}</strong> : <span style={{ color: MUTE }}>—</span>) },
    { key: 'dueIn', label: 'Cert due', render: (r) => <DueIn days={r.dueIn} />, sortValue: (r) => r.dueIn ?? 9999 },
    { key: 'status', label: 'Status', render: (r) => <Status>{r.status}</Status> },
  ]

  const flagged = FILTER_VIEW.filter((f) => f.concern).length
  const dueSoon = FILTER_VIEW.filter((f) => f.dueIn != null && f.dueIn >= 0 && f.dueIn <= THRESHOLDS.notificationLeadDays.value).length

  return (
    <div>
      <PageHeading
        title="Filter Registry"
        subtitle={`Every HEPA filter on site with its cleanroom, ISO class, install date, QR label and test interval — and the SAP equipment it maps to.`}
      />


      <StatCards items={[
        { label: 'Registered filters', value: HEADLINE.filters, icon: 'asset', note: `${CLEANROOMS.length} cleanrooms` },
        { label: 'Flagged or pending', value: HEADLINE.flagged, icon: 'alert', tone: HEADLINE.flagged ? 'amber' : 'green', note: 'per the workbook dashboard' },
        { label: 'Of concern now', value: flagged, icon: 'clock', tone: flagged ? 'red' : 'green', note: 'failed test or pressure breach' },
        { label: 'Cert due soon', value: dueSoon, icon: 'list', tone: dueSoon ? 'amber' : 'green', note: `within ${THRESHOLDS.notificationLeadDays.value} days` },
        { label: 'Mapped to SAP', value: FILTER_VIEW.filter((f) => f.sap).length, icon: 'wrench', note: 'equipment id and location' },
      ]} />

      <Toolbar
        search={q}
        onSearch={setQ}
        placeholder="Filter id, QR code, cleanroom or SAP equipment…"
        filters={[
          { label: 'Cleanroom', value: room, onChange: setRoom, options: CLEANROOMS.map((c) => c.cleanroomId) },
          { label: 'ISO class', value: iso, onChange: setIso, options: [...new Set(FILTER_VIEW.map((f) => f.isoClass))] },
          { label: 'Status', value: state, onChange: setState, options: [...new Set(FILTER_VIEW.map((f) => f.status))] },
        ]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} of {FILTER_VIEW.length}</span>}
      />

      <DataTable
        columns={columns}
        rows={rows}
        pageSize={14}
        onRowClick={(r) => router.push(`/portal/hepa/filters/${r.filterId}`)}
      />

      <p style={{ fontSize: 11.5, color: MUTE, margin: '12px 2px 0', lineHeight: 1.55 }}>
        Test and breach counts are tallies of the workbook&apos;s own rows. &ldquo;Cert
        due&rdquo; is measured against the anchored calendar <Derived /> — the underlying
        interval is unchanged.
      </p>
    </div>
  )
}
