'use client'

// Filter replacements — the chain of custody.
//
// This is the screen the brief's "blocked" case lives on. A replacement is not
// finished when the new filter is in the frame: it is finished when a
// post-installation integrity test has passed against it. The workbook writes
// the unfinished state as "Blocked - awaiting validation" — the new filter is
// in, the post-test is not, and the room is not released.
//
// Note the phrase, not the word. Four screens in this portal matched the string
// "Blocked" and every one of them quietly counted zero beside a dashboard
// reading 1. The predicate now lives in lib/data/index.js as `blocked`, and
// nothing here compares the status text itself.
//
// So every row carries four links out: the old serial, the new serial, the
// supplier's certificate, and the two tests either side of the change.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, DataTable, Toolbar, Card, PALETTE,
} from '../lib/kit'
import { REPLACEMENT_RECORDS, FILTER_VIEW, TEST_RECORDS, HEADLINE } from '../lib/data'
import { DateCell, Status, Id, Penetration } from '../lib/ui'

const { INK, SUB, MUTE, LINE } = PALETTE

const roomOf = (filterId) => FILTER_VIEW.find((f) => f.filterId === filterId)?.cleanroomName || '—'
const testOf = (id) => TEST_RECORDS.find((t) => t.testId === id) || null

export default function Replacements() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [state, setState] = useState('all')
  const [supplier, setSupplier] = useState('all')

  const rows = useMemo(() => REPLACEMENT_RECORDS.filter((r) => {
    if (state !== 'all' && r.recertStatus !== state) return false
    if (supplier !== 'all' && r.supplier !== supplier) return false
    if (q && !`${r.replacementId} ${r.filterId} ${r.oldSerial} ${r.newSerial} ${r.supplier} ${r.supplierCert}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }).map((r) => ({ ...r, id: r.replacementId })), [q, state, supplier])

  const columns = [
    { key: 'replacementId', label: 'Change', render: (r) => <Id strong>{r.replacementId}</Id> },
    { key: 'filterId', label: 'Filter', render: (r) => <span><Id>{r.filterId}</Id><span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{roomOf(r.filterId)}</span></span> },
    {
      key: 'newSerial',
      label: 'Serial',
      render: (r) => (
        <span style={{ lineHeight: 1.35 }}>
          <span style={{ fontSize: 10.5, color: MUTE, textDecoration: 'line-through' }}>{r.oldSerial}</span>
          <span style={{ display: 'block' }}><Id strong>{r.newSerial}</Id></span>
        </span>
      ),
    },
    { key: 'supplier', label: 'Supplier', render: (r) => <span>{r.supplier}<span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{r.supplierCert}</span></span> },
    { key: 'date', label: 'Installed', render: (r) => <DateCell shifted={r.date} original={r.installationDate} /> },
    { key: 'preValidationTestId', label: 'Pre-test', render: (r) => <ValidationCell id={r.preValidationTestId} /> },
    { key: 'postValidationTestId', label: 'Post-test', render: (r) => <ValidationCell id={r.postValidationTestId} /> },
    { key: 'recertStatus', label: 'Re-certification', render: (r) => <Status>{r.recertStatus}</Status> },
  ]

  const blocked = REPLACEMENT_RECORDS.filter((r) => r.blocked)

  return (
    <div>
      <PageHeading
        title="Replacements"
        subtitle="Old serial to new serial, with the supplier certificate and the integrity tests either side of the change. A replacement is only complete once the post-installation test has passed."
      />


      <StatCards items={[
        { label: 'Replacement events', value: HEADLINE.replacements, icon: 'wrench', note: 'on the workbook register' },
        { label: 'Re-certified', value: REPLACEMENT_RECORDS.filter((r) => r.recertified).length, icon: 'tick', tone: 'green', note: 'post-test passed' },
        { label: 'Awaiting validation', value: blocked.length, icon: 'clock', tone: blocked.length ? 'amber' : 'green', note: 'new filter in, not released' },
        { label: 'Blocked', value: HEADLINE.blockedReplacements, icon: 'alert', tone: HEADLINE.blockedReplacements ? 'red' : 'green', note: 'workbook dashboard' },
        { label: 'Suppliers', value: new Set(REPLACEMENT_RECORDS.map((r) => r.supplier)).size, icon: 'people', note: 'certificates on file' },
      ]} />

      {blocked.length > 0 && (
        <Card style={{ marginBottom: 14, borderColor: '#fecaca', background: '#fef7f7' }}>
          <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2.2"
              strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#7f1d1d', marginBottom: 4 }}>
                {blocked.length === 1 ? 'One replacement is blocked' : `${blocked.length} replacements are blocked`}
              </div>
              <div style={{ fontSize: 12, color: SUB, lineHeight: 1.55 }}>
                {blocked.map((r) => (
                  <div key={r.replacementId} style={{ marginBottom: 2 }}>
                    <strong style={{ color: INK }}>{r.filterId}</strong> in {roomOf(r.filterId)} — new filter{' '}
                    <Id>{r.newSerial}</Id> is installed, but{' '}
                    {r.awaitingPostTest
                      ? 'no post-installation integrity test is on file for it'
                      : <>post-installation test <Id>{r.postValidationTestId}</Id> did not pass</>}
                    . The room is not released.
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      <Toolbar
        search={q}
        onSearch={setQ}
        placeholder="Change id, filter, serial, supplier or certificate…"
        filters={[
          { label: 'Status', value: state, onChange: setState, options: [...new Set(REPLACEMENT_RECORDS.map((r) => r.recertStatus))] },
          { label: 'Supplier', value: supplier, onChange: setSupplier, options: [...new Set(REPLACEMENT_RECORDS.map((r) => r.supplier))] },
        ]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} of {REPLACEMENT_RECORDS.length}</span>}
      />

      <DataTable
        columns={columns}
        rows={rows}
        pageSize={12}
        onRowClick={(r) => router.push(`/portal/hepa/replacements/${r.replacementId}`)}
      />

      <p style={{ fontSize: 11.5, color: MUTE, margin: '12px 2px 0', paddingTop: 12, borderTop: `1px solid ${LINE}`, lineHeight: 1.55 }}>
        Chain of custody: old serial → new serial → supplier certificate →
        post-installation integrity test. Each link is a record on this portal,
        and the row opens all four together. The last link is what completes it:
        a filter in the frame is not a certified filter.
      </p>
    </div>
  )
}

function ValidationCell({ id }) {
  const t = testOf(id)
  if (!id) return <span style={{ color: MUTE }}>—</span>
  return (
    <span style={{ lineHeight: 1.35 }}>
      <Id>{id}</Id>
      <span style={{ display: 'block', fontSize: 10.5 }}>
        {t ? <><Status>{t.result}</Status> <Penetration value={t.penetration} /></> : <span style={{ color: MUTE }}>not on register</span>}
      </span>
    </span>
  )
}
