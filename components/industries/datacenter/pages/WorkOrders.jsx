'use client'

// The work order list.
//
// Its own component rather than a plain config because it is the one screen in
// this portal with records that did not come from the workbook: anything raised
// here is merged in on top of the seeded eight, newest first, and marked so a
// reader can see which is which. A PoC's credibility depends on nobody having
// to wonder whether a row is sample data.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toolbar, DataTable, StatusBadge, Priority, ActionButton, PALETTE } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { useSite } from '../lib/siteStore'
import { useWorkOrderStore } from '../lib/store'
import { WORK_ORDER_ROWS, shapeWorkOrder, fmtDate, ORG } from '../lib/data'
import { REC_WORK_ORDERS } from '../lib/monitoring'
import { workOrderListPdf } from '../lib/workOrderPdf'

const { SUB, MUTE } = PALETTE
const mono = { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 11.5, color: SUB }

/**
 * Seeded rows, the orders the recommendations point at, and anything raised in
 * the portal on top. The recommendation orders are what make "View WO-xxxx" on
 * the auditor open a real record; a seeded or portal-raised order of the same id
 * wins, so nothing is listed twice.
 */
export function useWorkOrders() {
  const { created } = useWorkOrderStore()
  return useMemo(() => {
    const seededIds = new Set(WORK_ORDER_ROWS.map((w) => w.workOrderId))
    const createdIds = new Set(created.map((c) => c.workOrderId))
    const fromRecs = REC_WORK_ORDERS.filter((w) => !seededIds.has(w.workOrderId) && !createdIds.has(w.workOrderId))
    return [...created.map(shapeWorkOrder), ...fromRecs, ...WORK_ORDER_ROWS]
  }, [created])
}

export default function WorkOrders() {
  const { scope, siteName } = useSite()
  const router = useRouter()
  const { persisted, remove } = useWorkOrderStore()
  const all = useWorkOrders()

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState('all')
  const [trigger, setTrigger] = useState('all')
  const [exporting, setExporting] = useState(false)
  const [busy, setBusy] = useState(false)

  // Only a work order raised in this portal can be deleted — it is the only one
  // that is a real database row. Seeded and recommendation-linked orders are
  // sample data with nothing behind them to remove.
  const onDelete = async (w) => {
    if (busy || !w._created) return
    if (!window.confirm(`Delete ${w.workOrderId || 'this work order'}? This removes the record raised in the portal and cannot be undone.`)) return
    setBusy(true)
    try { await remove(w.recordId) } finally { setBusy(false) }
  }

  const rows = useMemo(() => scope(all), [scope, all])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((w) => (
      (status === 'all' || w.status === status) &&
      (priority === 'all' || w.priority === priority) &&
      (trigger === 'all' || w.triggerSource === trigger) &&
      (!q || [w.workOrderId, w._asset, w.description, w.assignedTo].join(' ').toLowerCase().includes(q))
    ))
  }, [rows, query, status, priority, trigger])

  // What the sheet is a list of, in words, printed under its title.
  //
  // The export sends `shown` — the rows after the site picker, the search box
  // and the three selects — and a reader holding a sheet of six rows has no way
  // of knowing whether the register has six or sixty. Without this line the two
  // exports are indistinguishable on paper, and somebody works the wrong list.
  const scopeLine = useMemo(() => {
    const applied = []
    if (siteName !== 'All Sites') applied.push(`site ${siteName}`)
    if (status !== 'all') applied.push(`status ${status}`)
    if (priority !== 'all') applied.push(`priority ${priority}`)
    if (trigger !== 'all') applied.push(`trigger ${trigger}`)
    if (query.trim()) applied.push(`matching "${query.trim()}"`)
    return applied.length
      ? `${shown.length} of ${all.length} work orders - filtered to ${applied.join(', ')}.`
      : `All ${all.length} work orders on the register, unfiltered.`
  }, [siteName, status, priority, trigger, query, shown.length, all.length])

  const exportList = async () => {
    setExporting(true)
    try {
      await workOrderListPdf(shown, { org: ORG, scope: scopeLine, total: all.length })
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    { key: 'workOrderId', label: 'WO', render: (w) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={mono}>{w.workOrderId}</span>
        {w._created && <StatusBadge tone="violet">New</StatusBadge>}
      </span>
    ) },
    { key: 'dateRaised', label: 'Raised', render: (w) => fmtDate(w.dateRaised) },
    { key: '_asset', label: 'Asset', render: (w) => (
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{w._asset}</div>
        <div style={{ fontSize: 11, color: MUTE }}>{w._site}</div>
      </div>
    ) },
    { key: 'triggerSource', label: 'Trigger', render: (w) => (
      <StatusBadge tone={w._conditionBased ? 'blue' : 'grey'}>{w.triggerSource}</StatusBadge>
    ) },
    { key: 'alertId', label: 'Alert', render: (w) => (w.alertId ? <span style={mono}>{w.alertId}</span> : '—') },
    { key: 'priority', label: 'Priority', render: (w) => <Priority value={w.priority} /> },
    { key: 'status', label: 'Status', render: (w) => <StatusBadge>{w.status}</StatusBadge> },
    {
      key: '_act', label: '', align: 'right', sortable: false,
      render: (w) => (w._created ? (
        <span style={{ display: 'inline-flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => router.push(`/portal/datacenter/work-orders/${encodeURIComponent(w.workOrderId)}`)} title="Open / edit work order" style={styles.iconBtn}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" /></svg>
          </button>
          <button onClick={() => onDelete(w)} title="Delete work order" style={styles.del}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6M14 11v6" /></svg>
          </button>
        </span>
      ) : null),
    },
  ]

  return (
    <div>
      <PageHeading
        title="Work Orders"
        subtitle="Condition-based, calendar and reactive work side by side — the comparison the PoC is being measured on. Step 7 feedback is recorded on each."
        right={<ActionButton onClick={() => router.push('/portal/datacenter/work-orders/new')}>New work order</ActionButton>}
      />

      {/* Said once, plainly, rather than discovered when a save fails. */}
      {persisted === false && (
        <div style={styles.readonly}>
          No database is configured, so anything raised here will not be kept. The existing work orders still read normally.
        </div>
      )}

      <StatCards items={[
        { label: 'Work orders', value: shown.length },
        { label: 'Condition-triggered', value: shown.filter((w) => w._conditionBased).length, tone: 'blue' },
        { label: 'Completed', value: shown.filter((w) => w.status === 'Completed').length, tone: 'green' },
        { label: 'Open', value: shown.filter((w) => w.status !== 'Completed').length, tone: 'amber' },
        { label: 'Raised here', value: shown.filter((w) => w._created).length, tone: 'violet' },
      ]} />

      <Toolbar
        search={query} onSearch={setQuery} placeholder="Search work orders, assets, people…"
        filters={[
          { label: 'Status', value: status, options: [...new Set(all.map((w) => w.status).filter(Boolean))], onChange: setStatus },
          { label: 'Priority', value: priority, options: ['Critical', 'High', 'Medium', 'Low'], onChange: setPriority },
          { label: 'Trigger', value: trigger, options: [...new Set(all.map((w) => w.triggerSource).filter(Boolean))], onChange: setTrigger },
        ]}
        right={(
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {siteName !== 'All Sites' && <StatusBadge tone="blue">{siteName}</StatusBadge>}
            {/* In the filter bar rather than the page heading, because what it
                exports is whatever the controls beside it are set to — and the
                count on the button is the count it will print. */}
            <ActionButton variant="ghost" size="sm" onClick={exportList} disabled={exporting || !shown.length}>
              {exporting ? 'Building…' : `Export ${shown.length} (PDF)`}
            </ActionButton>
          </div>
        )}
      />

      <DataTable
        columns={columns}
        rows={shown}
        pageSize={12}
        onRowClick={(w) => router.push(`/portal/datacenter/work-orders/${encodeURIComponent(w.workOrderId)}`)}
        empty="No work orders match these filters."
      />
    </div>
  )
}

const styles = {
  readonly: {
    marginBottom: 14, padding: '10px 14px', borderRadius: 10,
    background: '#fffbeb', border: '1px solid #fde68a',
    color: '#92400e', fontSize: 12.5, lineHeight: 1.5,
  },
  iconBtn: { display: 'inline-flex', padding: 5, border: 'none', background: 'transparent', color: '#15227a', cursor: 'pointer', borderRadius: 6, lineHeight: 0 },
  del: { display: 'inline-flex', padding: 5, border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', borderRadius: 6, lineHeight: 0 },
}
