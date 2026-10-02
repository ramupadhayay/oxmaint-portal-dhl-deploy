'use client'

// Maintenance requests.
//
// A request is not a small work order — it is somebody noticing something. The
// person who sees a gasket sitting proud does not know whether that needs a
// PM01, a filter change or nothing at all, and making them choose is how you
// stop them reporting it. So the form is short and the triage happens here.
//
// A converted request is not deleted. It keeps the order number it became, so
// the trail from "somebody noticed" to "somebody was sent" stays intact — which
// is the only reason to have requests separate from orders at all.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Card, Section, DataTable, PALETTE, Priority,
} from '../lib/kit'
import { FILTER_VIEW, USER, fmtDate } from '../lib/data'
import { useStore } from '../lib/store'
import {
  useRequests, useCreatedOrders,
  convertRequest, rejectRequest, reviewRequest, nextRequestNumber,
} from '../lib/ops'
import { Status, Id } from '../lib/ui'
import { Action, Glyph, BRAND } from '../lib/productKit'
import { Modal } from '../lib/checklistKit'
import RequestSummary from '../components/RequestSummary'
import CreateRequestForm from '../components/CreateRequestForm'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

export default function Requests() {
  const router = useRouter()
  const store = useStore()
  const requests = useRequests()
  const orders = useCreatedOrders()

  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(null)
  const [triage, setTriage] = useState(null)
  const [reason, setReason] = useState('')
  const [state, setState] = useState('all')
  const [cut, setCut] = useState('total')
  // The product collapses the whole Overview block and remembers it. Read after
  // mount, not in the initialiser: reading storage while computing initial state
  // renders one thing on the server and another on the client.
  const [overview, setOverview] = useState(true)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('mrOverviewExpanded')
      if (raw !== null) setOverview(JSON.parse(raw))
    } catch { /* no storage */ }
  }, [])
  const toggleOverview = () => setOverview((v) => {
    try { window.localStorage.setItem('mrOverviewExpanded', JSON.stringify(!v)) } catch { /* refused */ }
    return !v
  })

  // What each of the product's eight cards counts. Our register's own words map
  // onto its: an Open request is one awaiting attention, and a Converted one is
  // a request that became a work order — which is exactly what its card says.
  const counts = useMemo(() => ({
    total: requests.length,
    pending: requests.filter((r) => r.status === 'Open').length,
    under_review: requests.filter((r) => r.status === 'Under Review').length,
    work_order_created: requests.filter((r) => r.status === 'Converted').length,
    critical: requests.filter((r) => r.urgency === 'Critical').length,
    high: requests.filter((r) => r.urgency === 'High').length,
    medium: requests.filter((r) => r.urgency === 'Medium').length,
    low: requests.filter((r) => r.urgency === 'Low').length,
    // Read by Key Metrics and Quick Insights rather than by a card. Rejected is
    // this register's "cancelled": a request closed with a reason on it.
    rejected: requests.filter((r) => r.status === 'Rejected').length,
    assigned: requests.filter((r) => r.status === 'Under Review' || r.status === 'Converted').length,
  }), [requests])

  // The cut a card applies. Total is the "no cut" card, so clicking the active
  // one clears rather than narrowing to nothing.
  const CUTS = {
    total: () => true,
    pending: (r) => r.status === 'Open',
    under_review: (r) => r.status === 'Under Review',
    work_order_created: (r) => r.status === 'Converted',
    critical: (r) => r.urgency === 'Critical',
    high: (r) => r.urgency === 'High',
    medium: (r) => r.urgency === 'Medium',
    low: (r) => r.urgency === 'Low',
  }

  const rows = useMemo(() => {
    const keep = CUTS[cut] || CUTS.total
    return requests
      .filter((r) => (state === 'all' || r.status === state) && keep(r))
      .map((r) => ({ ...r, id: r.recordId }))
  }, [requests, state, cut])

  // Where an external reporter would land.
  //
  // The path renders on both sides; the origin is filled in after mount. Reading
  // `window.location` during render gave the server a relative URL and the
  // client an absolute one, which is a hydration mismatch — React threw on it
  // and the page recovered silently, which is the worst way to have a bug.
  const [origin, setOrigin] = useState('')
  useEffect(() => { setOrigin(window.location.origin) }, [])
  const qrUrl = `${origin}/portal/hepa/requests/new`

  const openCount = counts.pending
  const converted = counts.work_order_created
  const rejected = requests.filter((r) => r.status === 'Rejected').length

  /**
   * Take a request without deciding on it yet.
   *
   * The product counts Under Review separately, and it is a real state: the
   * person who raised the request learns that somebody has it, which is the
   * whole reason a request register is not just a queue of work orders.
   */
  const doReview = async (r) => {
    setBusy(r.recordId)
    await reviewRequest(store, r)
    setBusy(null)
    setTriage(null)
  }

  const doConvert = async (r) => {
    setBusy(r.recordId)
    const order = await convertRequest(store, r, orders)
    setBusy(null)
    setTriage(null)
    if (order) router.push('/portal/hepa/work-orders')
  }

  const doReject = async (r) => {
    setBusy(r.recordId)
    await rejectRequest(store, r, reason)
    setBusy(null)
    setTriage(null)
    setReason('')
  }

  const columns = [
    { key: 'requestId', label: 'Request', render: (r) => <Id strong>{r.requestId}</Id> },
    // The form asks for a title; the seeded register does not have one and
    // carries what was reported instead. Whichever the row has is the headline,
    // with the description under it either way.
    { key: 'kind', label: 'Reported', sortValue: (r) => r.title || r.kind, render: (r) => <span><strong style={{ fontSize: 12, color: INK }}>{r.title || r.kind}</strong><span style={{ display: 'block', fontSize: 10.5, color: MUTE, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.detail}</span></span> },
    { key: 'filterId', label: 'Where', render: (r) => <span>{r.filterId ? <Id>{r.filterId}</Id> : <span style={{ color: MUTE, fontSize: 11.5 }}>room only</span>}<span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{r.cleanroomName}</span></span> },
    { key: 'urgency', label: 'Urgency', render: (r) => <Priority value={r.urgency} />, sortValue: (r) => ({ Critical: 0, High: 1, Medium: 2, Low: 3 }[r.urgency] ?? 9) },
    { key: 'raisedBy', label: 'Raised by', render: (r) => <span>{r.raisedBy}<span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{String(r.raisedAt).replace('T', ' ').slice(0, 16)}</span></span> },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <span>
          <Status>{r.status === 'Converted' ? 'Work Order Created' : r.status}</Status>
          {r.convertedTo && <span style={{ display: 'block', fontSize: 10, color: MUTE, marginTop: 2 }}>order {r.convertedTo}</span>}
        </span>
      ),
    },
    {
      key: 'act',
      label: '',
      align: 'right',
      sortable: false,
      // Both open the record. Triage needs the filter's actual condition beside
      // the report, and that is on the record page rather than in a strip under
      // the table — a person deciding whether to send somebody should see
      // whether the register agrees with what was reported.
      render: (r) => (
        <button
          onClick={(e) => { e.stopPropagation(); router.push(`/portal/hepa/requests/${r.requestId}`) }}
          style={{ ...styles.rowBtn, ...(r.status === 'Open' ? styles.rowBtnOn : null) }}
        >
          {r.status === 'Open' ? 'Triage' : 'Open'}
        </button>
      ),
    },
  ]

  const inTriage = triage ? requests.find((r) => r.recordId === triage) : null

  return (
    <div>
      <PageHeading
        title="Maintenance Requests"
        subtitle="Manage and track all maintenance requests from your organization"
        right={(
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Action icon="refresh" onClick={() => { setState('all'); setCut('total') }}>Refresh</Action>
            <Action icon="pin" onClick={() => setState('all')}>Select Location</Action>
            <Action icon="download" onClick={() => exportCsv(rows)}>Export</Action>
            <Action icon="up" onClick={() => setOpen(true)}>Bulk Upload</Action>
            <Action icon="plus" primary onClick={() => setOpen(true)}>Create Request</Action>
          </div>
        )}
      />

      {/* The product's Overview: a band you can fold away, with the QR card and
          the eight summary cards inside it. */}
      <button onClick={toggleOverview} style={styles.overviewBar}>
        <Glyph name="chart" size={16} color={BRAND[600]} />
        <strong style={{ fontSize: 14, color: INK }}>Overview</strong>
        <span style={{ fontSize: 12, color: MUTE }}>{requests.length} requests</span>
        <span style={{ marginLeft: 'auto', display: 'flex' }}>
          <Glyph name={overview ? 'up' : 'down'} size={16} color={MUTE} />
        </span>
      </button>

      {overview && (
        <div style={{ marginBottom: 16 }}>
          <RequestSummary
            counts={counts}
            cut={cut}
            onCut={(id) => setCut((prev) => (prev === id ? 'total' : id))}
            qrUrl={qrUrl}
            onConfigure={() => setOpen(true)}
          />
        </div>
      )}

      {/* The product opens this in a dialog rather than pushing the table down
          the page, and the form itself is the same component the QR code's
          landing page renders. */}
      <Modal open={open} title="Create Maintenance Request" onClose={() => setOpen(false)} width={980}>
        <CreateRequestForm
          requests={requests}
          onCancel={() => setOpen(false)}
          onDone={() => setOpen(false)}
        />
      </Modal>

      {inTriage && (
        <Card style={{ marginBottom: 14, borderColor: '#fde68a', background: '#fffdf7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Triage</div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: INK }}>
                {inTriage.requestId} — {inTriage.kind}
              </h3>
              <p style={{ margin: '5px 0 0', fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>
                {inTriage.cleanroomName}{inTriage.filterId ? <> · filter <Id>{inTriage.filterId}</Id></> : ''} ·
                raised by {inTriage.raisedBy} on {fmtDate(String(inTriage.raisedAt).slice(0, 10))}
              </p>
              <p style={{ margin: '8px 0 0', fontSize: 12.5, color: INK, lineHeight: 1.6 }}>
                &ldquo;{inTriage.detail}&rdquo;
              </p>
            </div>
            {inTriage.status === 'Open' && (
              <button onClick={() => doReview(inTriage)} disabled={busy === inTriage.recordId}
                style={{ ...styles.ghost, opacity: busy === inTriage.recordId ? 0.5 : 1 }}>
                {busy === inTriage.recordId ? 'Saving…' : 'Pick up for review'}
              </button>
            )}
            <button onClick={() => setTriage(null)} style={styles.ghost}>Close</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14, paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, marginBottom: 6 }}>Dispatch it</div>
              <p style={{ margin: '0 0 10px', fontSize: 11.5, color: SUB, lineHeight: 1.55 }}>
                Creates a work order against{' '}
                {inTriage.filterId ? <Id>{inTriage.filterId}</Id> : 'the room'} and marks
                this request converted, carrying the order number.
              </p>
              <button
                onClick={() => doConvert(inTriage)}
                disabled={!inTriage.filterId || busy === inTriage.recordId}
                style={{ ...styles.submit, marginLeft: 0, opacity: !inTriage.filterId || busy === inTriage.recordId ? 0.5 : 1 }}>
                {busy === inTriage.recordId ? 'Creating…' : 'Convert to work order'}
              </button>
              {!inTriage.filterId && (
                <p style={{ margin: '8px 0 0', fontSize: 11, color: '#b45309', lineHeight: 1.5 }}>
                  This request names a room but no filter, and an order needs an
                  asset. Raise one from the Work Orders screen and pick the filter.
                </p>
              )}
            </div>

            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, marginBottom: 6 }}>Or close it</div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Why no work is needed. This stays on the record."
                style={{ ...styles.input, resize: 'vertical', marginBottom: 9 }}
              />
              <button
                onClick={() => doReject(inTriage)}
                disabled={!reason.trim() || busy === inTriage.recordId}
                style={{ ...styles.reject, opacity: !reason.trim() || busy === inTriage.recordId ? 0.5 : 1 }}>
                Close with a reason
              </button>
            </div>
          </div>
        </Card>
      )}

      <Section
        title={`Requests (${rows.length})`}
        right={(
          <select value={state} onChange={(e) => setState(e.target.value)} style={{ ...styles.input, width: 'auto' }}>
            <option value="all">All</option>
            <option value="Open">Open</option>
            <option value="Converted">Converted</option>
            <option value="Rejected">Closed</option>
          </select>
        )}
      >
        <DataTable
          columns={columns}
          rows={rows}
          pageSize={12}
          empty={requests.length
            ? 'No request in this state.'
            : 'Nothing has been reported yet. Raise one and it appears here, and survives a reload.'}
          onRowClick={(r) => router.push(`/portal/hepa/requests/${r.requestId}`)}
        />
      </Section>

      <p style={{ fontSize: 11.5, color: MUTE, margin: '2px 2px 0', paddingTop: 12, borderTop: `1px solid ${LINE}`, lineHeight: 1.55 }}>
        A converted request keeps the order number it became rather than being
        removed — that trail is the reason requests and orders are separate
        registers. <button onClick={() => router.push('/portal/hepa/work-orders')} style={styles.inline}>Work orders</button>
        {' '}shows what came of them.
      </p>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  )
}

/**
 * Export.
 *
 * Exports what is on screen. The button sits beside the cards and the filters,
 * and a file that ignored them would carry numbers that do not match the page
 * the reader was looking at when they asked for it.
 */
function exportCsv(rows) {
  const head = ['Reference', 'Raised', 'Cleanroom', 'Filter', 'What was seen', 'Detail', 'Urgency', 'Status', 'Raised by', 'Became']
  // Quote a cell that carries a comma, a quote or a line break. Written with
  // plain string checks rather than a character class: a newline inside a regex
  // literal is a syntax error, and one that reads as an ordinary escape.
  const NL = String.fromCharCode(10)
  const cell = (v) => {
    const t = v == null ? '' : String(v)
    const needsQuotes = t.includes(',') || t.includes('"') || t.includes(NL)
    return needsQuotes ? `"${t.split('"').join('""')}"` : t
  }
  const body = rows.map((r) => [
    r.requestId, r.raisedAt ? String(r.raisedAt).slice(0, 10) : '', r.cleanroomName || '',
    r.filterId || '', r.kind, r.detail, r.urgency, r.status, r.raisedBy, r.convertedTo || '',
  ].map(cell).join(','))

  const blob = new Blob([[head.join(','), ...body].join(NL)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `maintenance-requests-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const styles = {
  overviewBar: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', marginBottom: 14,
    padding: '13px 16px', borderRadius: 11, background: '#fff', cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, fontFamily: 'inherit', textAlign: 'left',
  },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '8px 11px', fontSize: 12.5,
    fontFamily: 'inherit', lineHeight: 1.5, color: INK, borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`,
    borderRadius: 9, outline: 'none', background: '#fff',
  },
  primary: {
    padding: '9px 15px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
    border: 'none', borderRadius: 9, background: ACCENT, color: '#fff', cursor: 'pointer',
  },
  ghost: {
    padding: '5px 11px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 7, background: '#fff', color: SUB, cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  submitRow: {
    display: 'flex', alignItems: 'center', gap: 13, flexWrap: 'wrap',
    marginTop: 13, paddingTop: 12, borderTop: `1px solid ${LINE}`,
  },
  submit: {
    marginLeft: 'auto', padding: '9px 16px', fontSize: 12.5, fontWeight: 700,
    fontFamily: 'inherit', border: 'none', borderRadius: 9, background: ACCENT,
    color: '#fff', cursor: 'pointer',
  },
  reject: {
    padding: '9px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fecaca', borderRadius: 9, background: '#fef2f2',
    color: '#b91c1c', cursor: 'pointer',
  },
  rowBtn: {
    padding: '5px 11px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 7, background: '#fff', color: ACCENT, cursor: 'pointer',
  },
  rowBtnOn: { background: ACCENT, color: '#fff', borderColor: ACCENT },
  inline: {
    padding: 0, border: 'none', background: 'none', color: ACCENT,
    fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline',
  },
}
