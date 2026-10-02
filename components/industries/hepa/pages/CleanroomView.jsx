'use client'

// One cleanroom, and everything protecting it.
//
// The room is the unit a site lead thinks in — "can we run Fill Line 1 on
// Monday" — and answering that means the filters in the ceiling, the state of
// each, and what work is open against them, on one page.

import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Card, Section, Fields, DataTable, PALETTE,
} from '../lib/kit'
import {
  CLEANROOM_VIEW, WORK_ORDERS, TEST_RECORDS, LEAK_RECORDS, THRESHOLDS,
  filterById, workOrderStatus, workOrderPriority,
} from '../lib/data'
import { useDocuments } from '../lib/lifecycle'
import { DateCell, DueIn, Status, Id, Penetration, Differential } from '../lib/ui'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

const ISO_MEANS = {
  'ISO 5': 'Aseptic core — filling and open product. The tightest grade on site.',
  'ISO 7': 'Surrounding support to an aseptic core.',
  'ISO 8': 'Controlled but not aseptic — gowning and material transfer.',
}

export default function CleanroomView({ id }) {
  const router = useRouter()
  const documents = useDocuments()
  const c = CLEANROOM_VIEW.find((x) => x.cleanroomId === id)

  if (!c) {
    return (
      <Card style={{ maxWidth: 560 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: INK }}>No cleanroom with that reference</h1>
        <p style={{ margin: '8px 0 16px', fontSize: 13.5, color: SUB, lineHeight: 1.6 }}>
          <Id>{id}</Id> is not a room this portal holds.
        </p>
        <button onClick={() => router.push('/portal/hepa/cleanrooms')} style={{ ...styles.link, padding: '8px 14px' }}>
          Back to the register
        </button>
      </Card>
    )
  }

  const filterIds = new Set(c.filters.map((f) => f.filterId))
  const orders = WORK_ORDERS
    .filter((w) => w.cleanroomId === c.cleanroomId)
    .map((w) => {
      const doc = documents.find((d) => d.documentRef === w.documentRef) || null
      return {
        ...w,
        id: w.workOrderId,
        status: workOrderStatus(doc),
        priority: workOrderPriority(filterById(w.filterId)),
      }
    })

  const tests = TEST_RECORDS.filter((t) => filterIds.has(t.filterId))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((t) => ({ ...t, id: t.testId }))

  const breaches = LEAK_RECORDS.filter((l) => filterIds.has(l.filterId) && l.breach === 'Breach')
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((l) => ({ ...l, id: l.readingId }))

  const openOrders = orders.filter((w) => w.status !== 'Completed').length
  const clear = !c.concerns && !c.overdue

  return (
    <div>
      <PageHeading
        back={{ label: 'Cleanrooms', onClick: () => router.push('/portal/hepa/cleanrooms') }}
        title={`${c.cleanroomId} — ${c.name}`}
        subtitle={`${c.isoClass} · ${c.filterCount} HEPA filters · ${ISO_MEANS[c.isoClass] || ''}`}
        right={<Status>{clear ? 'Active' : 'Pending Replacement'}</Status>}
      />

      {!clear && (
        <Card style={{ marginBottom: 14, borderColor: '#fecaca', background: '#fef7f7' }}>
          <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2.2"
              strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
            <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.65 }}>
              <strong style={{ color: '#7f1d1d' }}>
                {c.concerns} of {c.filterCount} filters in this room have an open concern
              </strong>
              {c.overdue ? `, and ${c.overdue} ${c.overdue === 1 ? 'certification is' : 'certifications are'} past due` : ''}.
              {c.fails ? ` ${c.fails} integrity ${c.fails === 1 ? 'test has' : 'tests have'} failed here` : ''}
              {c.breaches ? ` and ${c.breaches} pressure ${c.breaches === 1 ? 'reading is' : 'readings are'} over ${THRESHOLDS.pressureDifferential.value} in. wg` : ''}.
            </p>
          </div>
        </Card>
      )}

      <StatCards items={[
        { label: 'Filters', value: c.filterCount, icon: 'asset', note: `${c.isoClass}` },
        { label: 'Of concern', value: c.concerns, icon: 'alert', tone: c.concerns ? 'red' : 'green', note: 'failed test or breach' },
        { label: 'Integrity tests', value: c.tests, icon: 'chart', tone: c.fails ? 'red' : 'green', note: c.fails ? `${c.fails} failed` : 'all passed' },
        { label: 'Readings in breach', value: c.breaches, icon: 'wave', tone: c.breaches ? 'red' : 'green', note: `over ${THRESHOLDS.pressureDifferential.value} in. wg` },
        { label: 'Open work orders', value: openOrders, icon: 'wrench', tone: openOrders ? 'amber' : 'green', note: `${orders.length} in total` },
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(330px,1fr))', gap: 14, marginBottom: 14 }}>
        <Section title="The room" style={{ marginBottom: 0 }}>
          <Fields columns={2} rows={[
            ['Room id', <Id key="a" strong>{c.cleanroomId}</Id>],
            ['Name', c.name],
            ['ISO grade', c.isoClass],
            ['Filters', c.filterCount],
            ['Next certification', <DueIn key="b" days={c.nextDueIn} />],
            ['Overdue certifications', c.overdue || '—'],
          ]} />
          <p style={styles.note}>{ISO_MEANS[c.isoClass]}</p>
        </Section>

        <Section title={`Filters in this room (${c.filters.length})`} style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {c.filters.map((f) => (
              <div key={f.filterId} style={styles.filterRow}
                onClick={() => router.push(`/portal/hepa/filters/${f.filterId}`)}>
                <Id strong>{f.filterId}</Id>
                <span style={{ fontSize: 11, color: MUTE, flex: '1 1 90px', minWidth: 0 }}>{f.testInterval}</span>
                {f.concern
                  ? <Status>{f.concern === 'Failed integrity test' ? 'Fail' : 'Breach'}</Status>
                  : <Status>OK</Status>}
                <span style={{ marginLeft: 'auto', fontSize: 11 }}><DueIn days={f.dueIn} /></span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title={`Work orders (${orders.length})`}>
        <DataTable
          columns={[
            { key: 'workOrderId', label: 'Order', render: (r) => <Id strong>{r.workOrderId}</Id> },
            { key: 'orderClass', label: 'Class' },
            { key: 'workOrderType', label: 'Type', render: (r) => <span style={{ fontSize: 11.5 }}>{String(r.workOrderType).replace(/^PM\d+ - /, '')}</span> },
            { key: 'filterId', label: 'Asset', render: (r) => <Id>{r.filterId}</Id> },
            { key: 'status', label: 'Status', render: (r) => <Status>{r.status}</Status> },
            { key: 'technicianName', label: 'Technician', render: (r) => r.technicianName || <span style={{ color: MUTE }}>—</span> },
            { key: 'dueIn', label: 'Due', render: (r) => <DueIn days={r.dueIn} />, sortValue: (r) => r.dueIn ?? 9999 },
          ]}
          rows={orders}
          pageSize={8}
          empty="No work order against this room."
          onRowClick={(r) => router.push(`/portal/hepa/work-orders/${r.workOrderId}`)}
        />
      </Section>

      <Section title={`Integrity tests (${tests.length})`}>
        <DataTable
          columns={[
            { key: 'testId', label: 'Test', render: (r) => <Id strong>{r.testId}</Id> },
            { key: 'filterId', label: 'Filter', render: (r) => <Id>{r.filterId}</Id> },
            { key: 'date', label: 'Tested', render: (r) => <DateCell shifted={r.date} original={r.testDate} /> },
            { key: 'penetration', label: 'Penetration', align: 'right', render: (r) => <Penetration value={r.penetration} /> },
            { key: 'result', label: 'Result', render: (r) => <Status>{r.result}</Status> },
            { key: 'technicianName', label: 'Technician' },
          ]}
          rows={tests}
          pageSize={8}
          onRowClick={(r) => router.push(`/portal/hepa/tests/${r.testId}`)}
        />
      </Section>

      {breaches.length > 0 && (
        <Section title={`Pressure breaches (${breaches.length})`}>
          <DataTable
            columns={[
              { key: 'readingId', label: 'Reading', render: (r) => <Id strong>{r.readingId}</Id> },
              { key: 'filterId', label: 'Filter', render: (r) => <Id>{r.filterId}</Id> },
              { key: 'date', label: 'Read', render: (r) => <DateCell shifted={r.date} original={r.readingDate} /> },
              { key: 'pressureDifferential', label: 'Differential', align: 'right', render: (r) => <Differential value={r.pressureDifferential} /> },
              { key: 'readingType', label: 'Type' },
              { key: 'technicianId', label: 'Technician', render: (r) => <Id>{r.technicianId}</Id> },
            ]}
            rows={breaches}
            pageSize={8}
            onRowClick={(r) => router.push(`/portal/hepa/filters/${r.filterId}`)}
          />
        </Section>
      )}
    </div>
  )
}

const styles = {
  filterRow: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer',
    padding: '8px 11px', borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 9, background: '#fcfdfe',
  },
  note: {
    margin: '13px 0 0', paddingTop: 11, borderTop: `1px solid ${LINE}`,
    fontSize: 11.5, color: MUTE, lineHeight: 1.55,
  },
  link: {
    padding: '5px 11px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 7, background: '#fff', color: ACCENT, cursor: 'pointer',
  },
}
