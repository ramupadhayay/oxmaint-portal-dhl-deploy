'use client'

// One work order, on its own page.
//
// Closeable, like the list is. A record page that could only be read would make
// the link worth sending and then useless to the person it was sent to — and the
// whole argument for these pages is that a job can be handed over as a URL.
//
// The status write is keyed by the seeded work order's own id, so closing a
// seeded job replaces it in the merge rather than adding a second copy beside
// it. That is the rule the store is built on; see the comment at the top of
// lib/store.jsx.

import { useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Section, Card, Fields,
  StatusBadge, Priority, ActionButton, PALETTE,
} from '../lib/kit'
import { useStore } from '../lib/store'
import { useWorkOrders } from '../lib/live'
import { USER, OPEN_STATUS, ASSETS, fmtDate, isPast, daysUntil, money } from '../lib/data'

const { ACCENT, INK, SUB, MUTE, RED } = PALETTE

const idOf = (w) => w.workorder_id || w.recordId

export default function WorkOrderView({ section, id }) {
  const router = useRouter()
  const workOrders = useWorkOrders()
  const { update, ready } = useStore()

  // Matched on the record id, and on the number as well because WO-4137 is what
  // gets read down a phone and typed into the address bar.
  const wo = useMemo(
    () => workOrders.find((w) => idOf(w) === String(id) || w.work_order_number === String(id)) || null,
    [workOrders, id]
  )

  const setStatus = useCallback((next) => {
    if (!wo || !ready || !update) return
    update('hosp_work_order', idOf(wo), {
      recordId: idOf(wo),
      status: next,
      completed_date: next === 'Completed' ? new Date().toISOString() : null,
      closed_by: USER.name,
    })
  }, [wo, ready, update])

  // A job raised in the portal arrives from a fetch, so on the first render it
  // is simply not here yet. "Nothing with that reference" in that moment is a
  // lie the page corrects a beat later — and the first thing anybody following a
  // shared link would read.
  if (!wo && !ready) {
    return (
      <Card style={{ maxWidth: 560 }}>
        <div style={{ padding: '30px 6px', textAlign: 'center', fontSize: 12.5, color: MUTE }}>
          Looking for {String(id)}…
        </div>
      </Card>
    )
  }

  if (!wo) return <NotHere reference={id} router={router} />

  const live = OPEN_STATUS.includes(wo.status)
  const late = live && isPast(wo.due_date)
  const dueDays = daysUntil(wo.due_date)
  const ageDays = Math.abs(daysUntil(wo.created_date))
  const asset = ASSETS.find((a) => a.asset_id === wo.asset_id) || null

  return (
    <div>
      <PageHeading
        title={wo.work_order_number || 'Work order'}
        subtitle={wo.title}
        back={{ label: 'Work Orders', onClick: () => router.push('/portal/hospitality/work-orders') }}
        right={live ? (
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Both wait on the store's first fetch. A click before it lands is
                dropped when that load replaces the record map — no row written,
                no error raised, and the button looked like it worked. */}
            <ActionButton onClick={() => setStatus('Completed')} disabled={!ready}>
              Mark complete
            </ActionButton>
            {wo.status === 'Open' && (
              <ActionButton variant="ghost" onClick={() => setStatus('In Progress')} disabled={!ready}>
                Start
              </ActionButton>
            )}
          </div>
        ) : (
          <StatusBadge>{wo.status}</StatusBadge>
        )}
      />

      <StatCards items={[
        {
          label: late ? 'Late by' : live ? 'Due in' : 'Closed',
          value: live ? Math.abs(dueDays) : wo.completed_date ? fmtDate(wo.completed_date) : '—',
          unit: live ? 'days' : '',
          tone: late ? 'red' : live ? (dueDays <= 2 ? 'amber' : 'green') : 'green',
          note: live ? fmtDate(wo.due_date) : `due ${fmtDate(wo.due_date)}`,
        },
        {
          label: 'Priority',
          value: wo.priority,
          tone: wo.priority === 'Critical' ? 'red' : wo.priority === 'High' ? 'amber' : 'blue',
          note: wo.work_order_type,
        },
        {
          label: 'Hours',
          value: wo.actual_hours ?? wo.estimated_hours,
          unit: 'h',
          note: wo.actual_hours ? `estimated ${wo.estimated_hours} h` : 'estimated',
        },
        {
          label: 'Cost',
          value: money(wo.total_cost),
          note: `raised ${ageDays} day${ageDays === 1 ? '' : 's'} ago`,
        },
      ]} />

      {wo.description && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13.5, color: INK, lineHeight: 1.6 }}>{wo.description}</div>
        </Card>
      )}

      {late && (
        <Card style={{ marginBottom: 14, background: '#fef2f2', borderColor: '#fecaca' }}>
          <div style={{ fontSize: 12.5, color: '#b91c1c', lineHeight: 1.55 }}>
            Past its due date by {Math.abs(dueDays)} day{Math.abs(dueDays) === 1 ? '' : 's'}.
            {wo.suite_number
              ? ` Suite ${wo.suite_number} is a room the front desk can still sell, so a fault left open here is one a guest meets.`
              : ' Plant work carried past its date is the property’s exposure rather than one room’s.'}
          </div>
        </Card>
      )}

      <div style={styles.two}>
        <Section title="The job" style={{ marginBottom: 0 }}>
          <Fields rows={[
            ['Status', <StatusBadge key="s">{wo.status}</StatusBadge>],
            ['Priority', <Priority key="p" value={wo.priority} />],
            ['Type', wo.work_order_type],
            ['Assigned to', wo.assigned_to_name],
            ['Raised by', wo.created_by_name],
            ['Raised', fmtDate(wo.created_date)],
            ['Due', <span key="d" style={{ color: late ? RED : INK, fontWeight: late ? 700 : 500 }}>{fmtDate(wo.due_date)}</span>],
            ['Completed', wo.completed_date ? fmtDate(wo.completed_date) : 'Not yet'],
            wo.closed_by ? ['Closed by', wo.closed_by] : null,
            ['Estimated', `${wo.estimated_hours} h`],
            ['Actual', wo.actual_hours ? `${wo.actual_hours} h` : '—'],
            ['Cost', money(wo.total_cost)],
          ]} />
        </Section>

        <Section title="Against what" style={{ marginBottom: 0 }}>
          <Fields rows={[
            ['Asset', wo.asset_name],
            ['Suite', wo.suite_number || 'Back of house'],
            ['Location', wo.location_name],
            asset ? ['Criticality', <StatusBadge key="c" tone={asset.criticality === 'High' ? 'red' : asset.criticality === 'Medium' ? 'amber' : 'grey'}>{asset.criticality}</StatusBadge>] : null,
            asset ? ['Asset status', <StatusBadge key="a">{asset.status}</StatusBadge>] : null,
            asset ? ['Health', `${asset.health_score}%`] : null,
          ]} />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            {asset && (
              <button onClick={() => router.push(`/portal/hospitality/assets/${asset.asset_id}`)} style={styles.linkBtn}>
                Open the asset →
              </button>
            )}
            {wo.suite_number && (
              <button onClick={() => router.push(`/portal/hospitality/suites/${wo.suite_number}`)} style={styles.linkBtn}>
                Open Suite {wo.suite_number} →
              </button>
            )}
          </div>

          {!asset && (
            <p style={{ margin: '14px 0 0', fontSize: 11.5, color: MUTE, lineHeight: 1.55 }}>
              Raised against a location rather than a registered asset — which is what a
              request converted from the front desk looks like before anybody has been up
              to see which appliance it is.
            </p>
          )}
        </Section>
      </div>
    </div>
  )
}

function NotHere({ reference, router }) {
  return (
    <Card style={{ maxWidth: 560 }}>
      <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: INK }}>Nothing here with that reference</h1>
      <p style={{ margin: '8px 0 0', fontSize: 13, color: SUB, lineHeight: 1.6 }}>
        <code style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{String(reference)}</code> is not
        a work order in this backlog.
      </p>
      <div style={{ marginTop: 16 }}>
        <ActionButton onClick={() => router.push('/portal/hospitality/work-orders')}>Back to the work orders</ActionButton>
      </div>
    </Card>
  )
}

const styles = {
  two: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14, marginBottom: 14, alignItems: 'start' },
  linkBtn: {
    padding: '5px 11px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
    background: '#fff', border: `1px solid ${ACCENT}33`, color: ACCENT, borderRadius: 7, cursor: 'pointer',
  },
}
