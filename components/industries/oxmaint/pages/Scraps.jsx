'use client'

// Scraps — a write-off is a decision about money.
//
// The list on its own tells a storekeeper what has been thrown away. What the
// person who has to sign for it needs is the value, up front and large, and a
// way to say yes or no to it. So the drawer leads with the figure, the footer
// carries the decision, and a refusal has to say why — an unexplained rejection
// is how a scrap note gets raised again next week with the same reason on it.
//
// The decision is written with the same field names the Approvals queue reads,
// so approving here takes the row out of that queue too. Two screens that
// disagree about whether something has been signed off is worse than one screen.

import { useMemo, useState } from 'react'
import {
  PageHeader, StatStrip, Toolbar, DataTable, Drawer, Modal, Fields,
  StatusBadge, ActionButton, PALETTE,
} from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useRecords, useStore } from '../lib/store'
import { CreateModal } from '../lib/forms'
import { useSite } from '../lib/siteStore'
import { SCRAPS, USER, EPOCH, money, fmtDate } from '../lib/data'

const { MUTE, SUB, INK, LINE } = PALETTE

const idOf = (r) => r.scrap_id || r.recordId

// The reference the approvals queue prints for the same record. A scrap note
// called SCR-003 on one screen and scr_003 on another is two records as far as
// anyone reading them is concerned.
const refOf = (s) => String(idOf(s) || '').replace('scr_', 'SCR-').toUpperCase()

const val = (s) => Number(s.value) || 0

// "This month" is the calendar month the demo is being run in, taken from the
// same clock every date in the portal is offset from.
const NOW = new Date(EPOCH)
const inThisMonth = (iso) => {
  if (!iso) return false
  const d = new Date(iso)
  return d.getFullYear() === NOW.getFullYear() && d.getMonth() === NOW.getMonth()
}

export default function Scraps() {
  const { scope, siteName } = useSite()
  const { create, update } = useStore()

  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [openId, setOpenId] = useState(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  const merged = useRecords('scrap', SCRAPS, idOf)
  const all = useMemo(() => scope(merged), [scope, merged])
  const open = useMemo(() => all.find((s) => idOf(s) === openId) || null, [all, openId])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((s) => (
      (status === 'all' || s.status === status) &&
      (!q || [s.part_name, s.reason, s.raised_by_name].join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, status])

  const approvedThisMonth = all
    .filter((s) => s.status === 'Approved' && inThisMonth(s.approval_date || s.created_date))
    .reduce((n, s) => n + val(s), 0)

  const decide = (outcome, note) => update('scrap', openId, {
    status: outcome === 'Approved' ? 'Approved' : 'Denied',
    approval_status: outcome,
    approved_by_name: USER.name,
    approval_date: new Date().toISOString(),
    rejection_reason: note || '',
  })

  const closeReject = () => { setRejecting(false); setReason('') }

  const reject = async () => {
    await decide('Rejected', reason)
    closeReject()
  }

  const columns = [
    { key: 'scrap_id', label: 'Ref', sortValue: refOf, render: (r) => <span style={{ fontWeight: 700, color: '#15227a' }}>{refOf(r)}</span> },
    { key: 'part_name', label: 'Part' },
    { key: 'quantity', label: 'Qty', align: 'right' },
    { key: 'reason', label: 'Reason' },
    { key: 'value', label: 'Write-off', align: 'right', render: (r) => <span style={{ fontWeight: 700, color: '#b91c1c' }}>{money(r.value)}</span> },
    { key: 'raised_by_name', label: 'Raised by' },
    { key: 'created_date', label: 'Date', sortValue: (r) => new Date(r.created_date).getTime(), render: (r) => fmtDate(r.created_date) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge>{r.status}</StatusBadge> },
  ]

  const pending = all.filter((s) => s.status === 'Pending Approval')

  return (
    <div>
      <PageHeader
        icon={sectionIcon('scraps', '#15227a')}
        title="Scraps"
        subtitle={`Parts written off and their value · ${siteName}`}
        right={<ActionButton onClick={() => setCreating(true)}>Record scrap</ActionButton>}
      />

      <StatStrip items={[
        { label: 'Scrap records', value: all.length },
        { label: 'Awaiting approval', value: pending.length, tone: pending.length ? 'amber' : 'green', note: pending.length ? `${money(pending.reduce((n, s) => n + val(s), 0))} held` : 'Nothing waiting' },
        { label: 'Approved this month', value: money(approvedThisMonth), tone: 'red' },
        { label: 'Total written off', value: money(all.reduce((n, s) => n + val(s), 0)), tone: 'red' },
        { label: 'Units scrapped', value: all.reduce((n, s) => n + (Number(s.quantity) || 0), 0) },
      ]} />

      <Toolbar
        search={search} onSearch={setSearch}
        placeholder="Search part, reason, person…"
        filters={[{ label: 'Status', value: status, onChange: setStatus, options: ['Pending Approval', 'Approved', 'Denied'] }]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} shown</span>}
      />

      <DataTable columns={columns} rows={rows} onRowClick={(r) => setOpenId(idOf(r))}
        empty="No scrap records match these filters." />

      <Drawer
        open={Boolean(open)} onClose={() => setOpenId(null)}
        title={open ? refOf(open) : null}
        subtitle={open ? `${open.quantity} × ${open.part_name}` : null}
        icon={sectionIcon('scraps', '#15227a')}
        width={480}
        footer={open && open.status === 'Pending Approval' ? (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <ActionButton variant="danger" onClick={() => setRejecting(true)}>Reject</ActionButton>
            <ActionButton variant="success" onClick={() => decide('Approved')}>Approve write-off</ActionButton>
          </div>
        ) : null}
      >
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ padding: '14px 16px', borderRadius: 11, background: '#fef2f2', border: '1px solid #fecaca' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Value being written off
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#b91c1c', lineHeight: 1.1, margin: '5px 0 3px' }}>
                {money(open.value)}
              </div>
              <div style={{ fontSize: 12, color: SUB }}>
                {open.quantity} × {open.part_name} at {money(val(open) / (Number(open.quantity) || 1))} each
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatusBadge>{open.status}</StatusBadge>
              <StatusBadge tone="grey">{open.reason}</StatusBadge>
            </div>

            <Fields rows={[
              ['Part', open.part_name],
              ['Quantity', open.quantity],
              ['Reason', open.reason],
              ['Value', money(open.value)],
              ['Raised by', open.raised_by_name],
              ['Raised on', fmtDate(open.created_date)],
              open.approved_by_name && ['Decided by', open.approved_by_name],
              open.approval_date && ['Decided on', fmtDate(open.approval_date)],
            ]} />

            {open.rejection_reason && (
              <div style={{ padding: '11px 13px', borderRadius: 9, background: '#fffbeb', border: '1px solid #fde68a' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
                  Rejected because
                </div>
                <p style={{ margin: 0, fontSize: 12.5, color: INK, lineHeight: 1.55 }}>{open.rejection_reason}</p>
              </div>
            )}

            {open.status === 'Pending Approval' && (
              <p style={{ margin: 0, fontSize: 12, color: MUTE, lineHeight: 1.55 }}>
                Approving books {money(open.value)} against the maintenance budget this month and clears the
                row from the approvals queue.
              </p>
            )}
          </div>
        )}
      </Drawer>

      <Modal
        open={rejecting} onClose={closeReject}
        title="Reject write-off"
        subtitle={open ? `${open.quantity} × ${open.part_name} · ${money(open.value)}` : null}
        icon={sectionIcon('scraps', '#15227a')}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <ActionButton variant="ghost" onClick={closeReject}>Cancel</ActionButton>
            <ActionButton variant="danger" disabled={!reason.trim()} onClick={reject}>Reject write-off</ActionButton>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.55 }}>
            The part stays on the books and the person who raised this gets the reason back. Rejecting without
            one only means the same note is raised again next week.
          </p>
          <div>
            <label style={miniLabel}>Why is this being rejected?</label>
            <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Return to the supplier under warranty, or send for repair rather than scrap"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12.5, resize: 'vertical',
                border: `1px solid ${LINE}`, borderRadius: 9, background: '#fff', color: INK,
                fontFamily: 'inherit', outline: 'none',
              }} />
          </div>
        </div>
      </Modal>

      <CreateModal kind="scrap" open={creating} onClose={() => setCreating(false)}
        onSubmit={(values) => create('scrap', values)} />
    </div>
  )
}

const miniLabel = { display: 'block', fontSize: 10, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }
