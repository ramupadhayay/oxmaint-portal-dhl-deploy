'use client'

// One work order.
//
// The maintenance half and the compliance half of the same job, on one page:
// what SAP holds about the order, what the technician measured, and where the
// certification record it produced has got to. Closing a work order here means
// that record is locked — so the lifecycle is on the page rather than a link
// away from it.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Card, Section, Fields, DataTable, Priority, PALETTE,
} from '../lib/kit'
import {
  workOrderById, filterById, workOrderStatus, workOrderPriority,
  THRESHOLDS, fmtDate, ORG, USER,
} from '../lib/data'
import { workOrderPdf } from '../lib/workOrderPdf'
import { useStore } from '../lib/store'
import { useDocuments } from '../lib/lifecycle'
import { useCreatedOrders } from '../lib/ops'
import { DateCell, DueIn, Status, Id, Penetration, Derived } from '../lib/ui'
import { Glyph, EmptyPanel, BRAND } from '../lib/productKit'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

const CLASS_MEANS = {
  PM01: 'Corrective — raised because something was found.',
  PM02: 'Replacement — a filter change, with validation either side.',
  PM04: 'Preventive — a scheduled test or check.',
}

export default function WorkOrderView({ id }) {
  const router = useRouter()
  const store = useStore()
  const documents = useDocuments()
  // An order raised in this portal is not in the imported register, so looking
  // only there gave "no work order with that number" for a row the user had
  // just created and could see on the list behind them.
  const created = useCreatedOrders()
  const [printing, setPrinting] = useState(false)
  const [tab, setTab] = useState('overview')
  const w = workOrderById(id) || created.find((o) => String(o.workOrderId) === String(id)) || null

  if (!w) {
    return (
      <Card style={{ maxWidth: 560 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: INK }}>No work order with that number</h1>
        <p style={{ margin: '8px 0 16px', fontSize: 13.5, color: SUB, lineHeight: 1.6 }}>
          <Id>{id}</Id> is not on the order register.
        </p>
        <button onClick={() => router.push('/portal/hepa/work-orders')} style={{ ...styles.link, padding: '8px 14px' }}>
          Back to work orders
        </button>
      </Card>
    )
  }

  const f = filterById(w.filterId)
  const doc = documents.find((d) => d.documentRef === w.documentRef) || null
  // A created order carries its own status and priority; an imported one has
  // them read from the certification record and the asset's condition.
  const status = w.raisedHere ? (w.status || 'Open') : workOrderStatus(doc)
  const priority = w.raisedHere ? (w.priority || 'Medium') : workOrderPriority(f)
  const done = status === 'Completed'

  // The card a technician is handed. Built from the same record the page is
  // rendering, so what is printed cannot drift from what is on screen.
  const download = async () => {
    setPrinting(true)
    try {
      const name = await workOrderPdf(
        { ...w, status, priority },
        { filter: f, document: doc, test: f?.lastTest || null, org: ORG, user: USER },
      )
      store.notify(`${name} saved to your downloads.`)
    } catch (e) {
      store.notify(e?.message || 'Could not build the job card.', 'error')
    } finally {
      setPrinting(false)
    }
  }

  // The product's tabs, with the counts it puts on them. What this register
  // knows about an order is its asset, the tests that asset has been through,
  // the leak readings behind them and the certification it produced — so those
  // are what the tabs hold, under the product's own names.
  const TABS = [
    ['overview', 'Overview', 'doc', null],
    ['asset-info', 'Asset & Location', 'box', null],
    ['tasks', 'Tasks', 'check', (f?.tests || []).length],
    ['materials', 'Materials', 'box', (f?.replacements || []).length],
    ['time', 'Time Tracking', 'clock', null],
    ['attachments', 'Attachments', 'doc', w.documentRef ? 1 : 0],
  ]

  const tests = (f?.tests || [])
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((t) => ({ ...t, id: t.testId }))

  return (
    <div>
      <PageHeading
        back={{ label: 'Work orders', onClick: () => router.push('/portal/hepa/work-orders') }}
        title={`${w.workOrderId} — ${w.cleanroomName}`}
        subtitle={`${w.workOrderType} · filter ${w.filterId} · ${w.isoClass}${w.sapEquipmentId ? ` · equipment ${w.sapEquipmentId}` : ''}${w.raisedHere ? ' · raised in this portal, not yet sent to SAP' : ''}`}
        right={(
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Priority value={priority} />
            <Status>{status}</Status>
            <button onClick={download} disabled={printing} style={{ ...styles.pdf, opacity: printing ? 0.6 : 1 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {printing ? 'Building…' : 'Job card (PDF)'}
            </button>
          </div>
        )}
      />

      {/* The product's detail tabs. Costs is the one left out — this workbook
          carries no money, and an empty cost tab invites somebody to read a
          figure into it. The rest each hold something the register actually
          knows about this order. */}
      <div style={styles.tabRow}>
        {TABS.map(([key, label, icon, count]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ ...styles.tab, ...(tab === key ? styles.tabOn : null) }}>
            <Glyph name={icon} size={14} color={tab === key ? BRAND[600] : MUTE} />
            {label}{count != null ? ` (${count})` : ''}
          </button>
        ))}
      </div>

      <StatCards items={[
        { label: 'Status', value: status, icon: done ? 'tick' : 'clock', tone: done ? 'green' : status === 'Reopened' ? 'red' : 'amber', note: done ? 'certification locked' : 'certification not yet locked' },
        { label: 'Priority', value: priority, icon: 'alert', tone: priority === 'Critical' ? 'red' : priority === 'High' ? 'amber' : undefined, note: f?.concern || 'no open concern on the asset' },
        { label: 'Raised', value: fmtDate(w.raisedOn), icon: 'list', note: `workbook: ${fmtDate(w.raisedOnWorkbook)}` },
        { label: 'Due', value: w.dueIn == null ? '—' : w.dueIn < 0 ? `${Math.abs(w.dueIn)}d ago` : `${w.dueIn}d`, icon: 'clock', tone: w.dueIn == null ? undefined : w.dueIn < 0 ? 'red' : w.dueIn <= THRESHOLDS.notificationLeadDays.value ? 'amber' : 'green', note: fmtDate(w.dueOn) },
        { label: 'SAP sync', value: w.syncStatus.replace(' - Retry Queued', ''), icon: 'wrench', tone: w.syncStatus === 'Synced' ? 'green' : String(w.syncStatus).startsWith('Error') ? 'red' : 'amber', note: `last ${fmtDate(w.raisedOn)}` },
      ]} />

      {tab === 'overview' && (
        <>
      <Card style={{ marginBottom: 14, background: '#fcfdfe' }}>
        <p style={{ margin: 0, fontSize: 12, color: SUB, lineHeight: 1.6 }}>
          <strong style={{ color: INK }}>{w.orderClass}</strong> — {CLASS_MEANS[w.orderClass] || w.workOrderType}
          {' '}The order number, class and equipment id are SAP&apos;s. Whether the job
          is finished is not something SAP holds, so it is read from the
          certification record below <Derived /> — <strong style={{ color: INK }}>Completed</strong>{' '}
          means that record is locked and audit-ready.
        </p>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(330px,1fr))', gap: 14, marginBottom: 14 }}>
        <Section title="The order" style={{ marginBottom: 0 }}>
          <Fields columns={2} rows={[
            ['Order number', <Id key="a" strong>{w.workOrderId}</Id>],
            ['Class', w.orderClass],
            ['Type', String(w.workOrderType).replace(/^PM\d+ - /, '')],
            ['Equipment id', <Id key="b">{w.sapEquipmentId}</Id>],
            ['Functional location', <Id key="c">{w.sapFunctionalLocation}</Id>],
            ['Raised', <DateCell key="d" shifted={w.raisedOn} original={w.raisedOnWorkbook} />],
            ['Technician', w.technicianName ? `${w.technicianName} (${w.technicianId})` : 'unassigned'],
            ['Sync', <Status key="e">{w.syncStatus}</Status>],
          ]} />
        </Section>

        <Section
          title="The certification it produced"
          style={{ marginBottom: 0 }}
          right={doc && (
            <button onClick={() => router.push(`/portal/hepa/repository/${doc.documentRef}`)} style={styles.link}>
              Open record
            </button>
          )}
        >
          {doc ? (
            <>
              <Fields columns={2} rows={[
                ['Reference', <Id key="a" strong>{doc.documentRef}</Id>],
                ['Stage', <Status key="b">{doc.stage}</Status>],
                ['Approval', <Status key="c">{doc.approvalStatus}</Status>],
                ['Signed by', doc.signedBy || 'unsigned'],
                ['Reviewer', doc.reviewer],
                ['Next certification', <span key="d"><DueIn days={doc.dueIn} /></span>],
              ]} />
              {!done && (
                <p style={styles.note}>
                  This order stays open until the record reaches Locked /
                  Audit-Ready. {doc.signedBy ? 'It is signed and ready to lock.' : 'It has not been signed yet.'}
                </p>
              )}
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 12.5, color: MUTE, lineHeight: 1.6 }}>
              No certification record is linked to this order, so there is nothing
              to close it against.
            </p>
          )}
        </Section>
      </div>

      {f && (
        <Section
          title="The asset"
          right={(
            <button onClick={() => router.push(`/portal/hepa/filters/${f.filterId}`)} style={styles.link}>
              Open the filter
            </button>
          )}
        >
          <Fields columns={4} rows={[
            ['Filter', <Id key="a" strong>{f.filterId}</Id>],
            ['Cleanroom', `${f.cleanroomName} (${f.cleanroomId})`],
            ['ISO class', f.isoClass],
            ['Status', <Status key="b">{f.status}</Status>],
            ['Installed', <DateCell key="c" shifted={f.installedOn} original={f.installDate} />],
            ['Test interval', f.testInterval],
            ['Tests on file', `${f.testCount}${f.failCount ? ` — ${f.failCount} failed` : ''}`],
            ['Leak breaches', f.breachCount || '—'],
          ]} />
        </Section>
      )}
        </>
      )}

      {tab !== 'overview' && tab !== 'tasks' && (
        <EmptyPanel title={`Nothing recorded under ${TABS.find(([k]) => k === tab)[1]}.`}>
          The register holds this order&rsquo;s asset, the tests it produced and the
          certification behind it. Anything this tab would carry — labour hours,
          consumed stock, uploaded files — is written where the job is carried
          out, and this order has none of it yet.
        </EmptyPanel>
      )}

      {tab === 'tasks' && tests.length > 0 && (
        <Section title={`Integrity tests on this asset (${tests.length})`}>
          <DataTable
            columns={[
              { key: 'testId', label: 'Test', render: (r) => <Id strong>{r.testId}</Id> },
              { key: 'date', label: 'Tested', render: (r) => <DateCell shifted={r.date} original={r.testDate} /> },
              { key: 'testPoints', label: 'Points', align: 'center' },
              { key: 'penetration', label: 'Penetration', align: 'right', render: (r) => <Penetration value={r.penetration} /> },
              { key: 'result', label: 'Result', render: (r) => <Status>{r.result}</Status> },
              { key: 'technicianName', label: 'Technician' },
              { key: 'lockStatus', label: 'Record', render: (r) => <Status>{r.lockStatus}</Status> },
            ]}
            rows={tests}
            pageSize={8}
            onRowClick={(r) => router.push(`/portal/hepa/tests/${r.testId}`)}
          />
        </Section>
      )}
    </div>
  )
}

const styles = {
  tabRow: {
    display: 'flex', gap: 0, marginBottom: 16, padding: 3, borderRadius: 10,
    background: '#f1f5f9', width: 'fit-content', flexWrap: 'wrap',
  },
  tab: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
    border: 'none', borderRadius: 8, background: 'transparent', color: '#64748b',
  },
  tabOn: { background: '#fff', color: '#15227a', boxShadow: '0 1px 2px rgba(15,23,42,.08)' },
  pdf: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', border: 'none',
    borderRadius: 9, background: '#15227a', color: '#fff', cursor: 'pointer',
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
