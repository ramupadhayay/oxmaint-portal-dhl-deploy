'use client'

import { useMemo, useState } from 'react'
import { PageHeader, StatStrip, Toolbar, DataTable, Drawer, Fields, StatusBadge, ActionButton, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useRecords, useStore } from '../lib/store'
import { CreateModal } from '../lib/forms'
import { useSite } from '../lib/siteStore'
import { WORK_PERMITS, TECHNICIANS, USER, daysFrom, daysUntil, fmtDate, isPast } from '../lib/data'

const { MUTE, SUB, INK, LINE } = PALETTE

const idOf = (r) => r.permit_id || r.recordId

// A permit past its window that nobody has closed is still authorising work, so
// it is treated as its own state everywhere on this screen even though the
// record still says Active.
const isExpired = (p) => Boolean(p) && p.status === 'Active' && isPast(p.valid_to)

const overdueBy = (iso) => {
  const d = Math.abs(daysUntil(iso))
  return d === 0 ? 'today' : d === 1 ? '1 day ago' : `${d} days ago`
}

const fmtWhen = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${fmtDate(iso)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Why this permit cannot be signed off, or null if it can.
 *
 * A permit to work approved by the person who asked for it is a real safety
 * failure — it is the finding in the incident report, not a validation nicety —
 * so the button is blocked rather than warned about.
 */
const approvalBlock = (p) => {
  if (!p) return null
  if (p.requested_by_name === USER.name) {
    return 'You raised this permit. A permit to work cannot be approved by the person who requested it — someone else has to sign it off.'
  }
  if (p.requested_by_name && p.requested_by_name === p.approver_name) {
    return `${p.requested_by_name} is named as both requester and approver. Nominate a different approver before this permit is signed off.`
  }
  return null
}

export default function WorkPermits() {
  const { scope, siteName } = useSite()
  const { create, update } = useStore()
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [type, setType] = useState('all')
  const [openId, setOpenId] = useState(null)
  const [extendDays, setExtendDays] = useState(2)

  const merged = useRecords('permit', WORK_PERMITS, idOf)
  const all = useMemo(() => scope(merged), [scope, merged])

  // The drawer reads the permit out of the live list rather than holding a
  // snapshot, so approving one swaps the footer actions immediately instead of
  // leaving the approve button on a permit that is already active.
  const open = useMemo(() => merged.find((p) => idOf(p) === openId) || null, [merged, openId])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((p) => (
      (status === 'all' || p.status === status) &&
      (type === 'all' || p.permit_type === type) &&
      (!q || [p.permit_number, p.permit_type, p.asset_name, p.requested_by_name].join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, status, type])

  const expired = isExpired(open)
  const block = open?.status === 'Pending Approval' ? approvalBlock(open) : null

  const approve = () => update('permit', idOf(open), {
    status: 'Active',
    approved_by_name: USER.name,
    approved_at: new Date().toISOString(),
  })

  const reject = () => update('permit', idOf(open), {
    status: 'Rejected',
    rejected_by_name: USER.name,
    rejected_at: new Date().toISOString(),
  })

  const closePermit = () => update('permit', idOf(open), {
    status: 'Closed',
    closed_by_name: USER.name,
    closed_at: new Date().toISOString(),
  })

  const extend = () => update('permit', idOf(open), {
    // Counted from today, not from the old end date: extending an already
    // expired permit by its original window would leave it expired.
    valid_to: daysFrom(extendDays),
    extended_by_name: USER.name,
    extended_at: new Date().toISOString(),
  })

  const columns = [
    {
      key: 'permit_number', label: 'Permit',
      render: (r) => {
        const late = isExpired(r)
        return (
          <span style={{ display: 'inline-flex', alignItems: 'stretch', gap: 8 }}>
            {/* Expired permits have to be findable in a scan of the list, not
                only once a row is opened. */}
            <span style={{ width: 3, minHeight: 17, borderRadius: 2, background: late ? '#b91c1c' : 'transparent' }} />
            <span style={{ fontWeight: 700, color: late ? '#b91c1c' : '#15227a' }}>{r.permit_number}</span>
          </span>
        )
      },
    },
    { key: 'permit_type', label: 'Type' },
    { key: 'asset_name', label: 'Asset' },
    { key: 'work_order_number', label: 'Work order' },
    { key: 'requested_by_name', label: 'Requested by' },
    { key: 'approver_name', label: 'Approver' },
    {
      key: 'valid_to', label: 'Valid until', sortValue: (r) => new Date(r.valid_to).getTime(),
      render: (r) => {
        const late = isExpired(r)
        return <span style={{ whiteSpace: 'nowrap', color: late ? '#b91c1c' : INK, fontWeight: late ? 700 : 500 }}>{fmtDate(r.valid_to)}{late && ' · expired'}</span>
      },
    },
    {
      key: 'status', label: 'Status',
      render: (r) => (
        <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
          <StatusBadge tone={r.status === 'Rejected' ? 'red' : undefined}>{r.status}</StatusBadge>
          {isExpired(r) && <StatusBadge tone="red">Expired</StatusBadge>}
        </span>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        icon={sectionIcon('permits', '#15227a')}
        title="Work Permits"
        subtitle={`Permits to work · ${siteName}`}
        right={<ActionButton onClick={() => setCreating(true)}>Request permit</ActionButton>}
      />

      <StatStrip items={[
        { label: 'Permits', value: all.length },
        { label: 'Awaiting approval', value: all.filter((p) => p.status === 'Pending Approval').length, tone: 'amber' },
        { label: 'Active', value: all.filter((p) => p.status === 'Active').length, tone: 'green' },
        { label: 'Expired but still open', value: all.filter(isExpired).length, tone: 'red' },
        { label: 'Closed', value: all.filter((p) => p.status === 'Closed').length },
      ]} />

      <Toolbar
        search={search} onSearch={setSearch}
        placeholder="Search permit, type, asset, requester…"
        filters={[
          { label: 'Status', value: status, onChange: setStatus, options: ['Pending Approval', 'Active', 'Closed', 'Rejected'] },
          { label: 'Type', value: type, onChange: setType, options: ['Hot Work', 'Confined Space', 'Working at Height', 'Electrical Isolation'] },
        ]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} shown</span>}
      />

      <DataTable columns={columns} rows={rows} onRowClick={(r) => setOpenId(idOf(r))} pageSize={10} empty="No permits match these filters." />

      <Drawer open={Boolean(open)} onClose={() => setOpenId(null)} title={open?.permit_number} subtitle={open?.permit_type}
        icon={sectionIcon('permits', '#15227a')} width={500}
        footer={open && (open.status === 'Pending Approval' || open.status === 'Active') ? (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
            {open.status === 'Pending Approval' && (
              <>
                <ActionButton variant="ghost" onClick={reject}>Reject</ActionButton>
                <ActionButton variant="success" disabled={Boolean(block)} onClick={approve}>Approve</ActionButton>
              </>
            )}
            {open.status === 'Active' && (
              <>
                {expired && <ActionButton variant="subtle" onClick={extend}>Extend {extendDays} {extendDays === 1 ? 'day' : 'days'}</ActionButton>}
                <ActionButton onClick={closePermit}>Close permit</ActionButton>
              </>
            )}
          </div>
        ) : null}>
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatusBadge tone={open.status === 'Rejected' ? 'red' : undefined}>{open.status}</StatusBadge>
              {expired && <StatusBadge tone="red">Expired</StatusBadge>}
            </div>

            {expired && (
              <div style={{ padding: '12px 14px', borderRadius: 11, background: '#fef2f2', border: '1px solid #fecaca' }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#b91c1c' }}>
                  This permit expired {overdueBy(open.valid_to)} and is still open
                </div>
                <p style={{ margin: '5px 0 0', fontSize: 12, color: '#7f1d1d', lineHeight: 1.5 }}>
                  Work under it is no longer authorised. Extend the window if the job is still running, or close the permit.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 11 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: 0.4 }}>Extend by</span>
                  <select value={extendDays} onChange={(e) => setExtendDays(Number(e.target.value))}
                    style={{ ...miniSelect, width: 'auto', border: '1px solid #fecaca', color: '#b91c1c' }}>
                    {[1, 2, 3, 7].map((d) => <option key={d} value={d}>{d} {d === 1 ? 'day' : 'days'}</option>)}
                  </select>
                  <span style={{ fontSize: 11.5, color: '#7f1d1d' }}>new expiry {fmtDate(daysFrom(extendDays))}</span>
                </div>
              </div>
            )}

            {block && (
              <div style={{ padding: '12px 14px', borderRadius: 11, background: '#fffbeb', border: '1px solid #fde68a' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: 0.4 }}>Approval blocked</div>
                <p style={{ margin: '5px 0 0', fontSize: 12.5, color: '#78350f', lineHeight: 1.5 }}>{block}</p>
              </div>
            )}

            {open.status === 'Pending Approval' && (
              <div style={{ padding: 13, borderRadius: 11, background: '#f8fafc', border: `1px solid ${LINE}` }}>
                <label style={miniLabel}>Nominated approver</label>
                <select value={open.approver_name || ''} onChange={(e) => update('permit', idOf(open), { approver_name: e.target.value })} style={miniSelect}>
                  <option value="">Not nominated</option>
                  {TECHNICIANS.map((t) => <option key={t.user_id} value={t.name}>{t.name}</option>)}
                </select>
              </div>
            )}

            <Fields rows={[
              ['Type', open.permit_type],
              ['Asset', open.asset_name],
              ['Work order', open.work_order_number],
              ['Requested by', open.requested_by_name],
              ['Nominated approver', open.approver_name || 'Not nominated'],
              ['Valid from', fmtDate(open.valid_from)],
              ['Valid to', fmtDate(open.valid_to)],
              open.approved_by_name ? ['Approved by', open.approved_by_name] : null,
              open.approved_at ? ['Approved at', fmtWhen(open.approved_at)] : null,
              open.extended_by_name ? ['Extended by', open.extended_by_name] : null,
              open.extended_at ? ['Extended at', fmtWhen(open.extended_at)] : null,
              open.rejected_by_name ? ['Rejected by', open.rejected_by_name] : null,
              open.rejected_at ? ['Rejected at', fmtWhen(open.rejected_at)] : null,
              open.closed_by_name ? ['Closed by', open.closed_by_name] : null,
              open.closed_at ? ['Closed at', fmtWhen(open.closed_at)] : null,
            ]} />

            {open.status === 'Closed' && (
              <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.55 }}>
                This permit is closed. Raise a new one if the work restarts.
              </p>
            )}
          </div>
        )}
      </Drawer>

      <CreateModal kind="permit" open={creating} onClose={() => setCreating(false)}
        onSubmit={(values) => create('permit', values)} />
    </div>
  )
}

const miniLabel = { display: 'block', fontSize: 10, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }
const miniSelect = {
  width: '100%', boxSizing: 'border-box', padding: '7px 9px', fontSize: 12.5, fontWeight: 600,
  border: `1px solid ${LINE}`, borderRadius: 8, background: '#fff', color: '#15227a',
  fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
}
