'use client'

// One request, on its own page.
//
// A request is not a small work order. What it carries that a work order does
// not is who said it and how it arrived: the front desk relaying a guest means
// somebody is in the building waiting, and housekeeping's note found on a turn
// does not. That distinction is the reason this register exists at all, so it is
// the first thing on the page rather than a field halfway down.
//
// Read-only, deliberately. Triage happens on the list, where the whole queue is
// visible and you can see which one to take first; putting a second copy of the
// convert-and-raise write here is how the two would come to disagree about what
// converting means.

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Section, Card, Fields,
  StatusBadge, Priority, ActionButton, PALETTE,
} from '../lib/kit'
import { useRecords, useStore } from '../lib/store'
import { useWorkOrders } from '../lib/live'
import { convertRequest, rejectRequest } from '../lib/triage'
import { REQUESTS, fmtDate, daysUntil } from '../lib/data'

const { ACCENT, INK, SUB, MUTE } = PALETTE

const idOf = (r) => r.request_id || r.recordId
const isGuest = (r) => String(r.source).startsWith('Front desk')

const statusTone = (s) => (s === 'Converted' ? 'green' : s === 'Open' ? 'amber' : 'grey')

export default function RequestView({ section, id }) {
  const router = useRouter()
  const store = useStore()
  const ready = Boolean(store?.ready)
  const [working, setWorking] = useState(false)
  const requests = useRecords('hosp_request', REQUESTS, idOf)
  const workOrders = useWorkOrders()

  // Triage happens here, on the page that shows who is waiting and for how
  // long, rather than on the queue — deciding whether a job is worth raising is
  // easier next to the context than in a row. Both writes come from
  // lib/triage.js so this and any other caller stay one implementation.
  const raise = useCallback(async (r) => {
    if (!ready || working) return
    setWorking(true)
    try { await convertRequest(r, { create: store?.create, update: store?.update, ready }) }
    finally { setWorking(false) }
  }, [ready, working, store])

  const decline = useCallback((r) => {
    if (!ready || working) return
    rejectRequest(r, { update: store?.update, ready })
  }, [ready, working, store])

  const req = useMemo(
    () => requests.find((r) => idOf(r) === String(id) || r.request_number === String(id)) || null,
    [requests, id]
  )

  // The work order it became, resolved from the number the conversion wrote.
  // A reference a person has to go and look up by hand is the same as no
  // reference — the point of recording the link is that it can be followed.
  const wo = useMemo(
    () => (req?.work_order_number
      ? workOrders.find((w) => w.work_order_number === req.work_order_number) || null
      : null),
    [workOrders, req]
  )

  if (!req && !ready) {
    return (
      <Card style={{ maxWidth: 560 }}>
        <div style={{ padding: '30px 6px', textAlign: 'center', fontSize: 12.5, color: MUTE }}>
          Looking for {String(id)}…
        </div>
      </Card>
    )
  }

  if (!req) return <NotHere reference={id} router={router} />

  const guest = isGuest(req)
  const waitingDays = Math.abs(daysUntil(req.raised_date))
  const waiting = req.status === 'Open'

  return (
    <div>
      <PageHeading
        title={req.request_number || 'Request'}
        subtitle={req.title}
        back={{ label: 'Requests', onClick: () => router.push('/portal/hospitality/requests') }}
        right={(
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <StatusBadge tone={statusTone(req.status)}>{req.status}</StatusBadge>
            {req.status === 'Open' && (
              <>
                {/* Disabled until the store has answered: a write sent before
                    its first fetch lands is replaced by that fetch and lost
                    with no error anywhere. */}
                <ActionButton onClick={() => raise(req)} disabled={!ready || working}>
                  {working ? 'Raising…' : 'Raise work order'}
                </ActionButton>
                <ActionButton variant="secondary" onClick={() => decline(req)} disabled={!ready || working}>
                  Reject
                </ActionButton>
              </>
            )}
          </div>
        )}
      />

      <StatCards items={[
        {
          label: 'Reported by',
          value: guest ? 'A guest' : req.source.split(' ')[0],
          tone: guest ? 'red' : undefined,
          note: req.source,
        },
        {
          label: waiting ? 'Waiting' : 'Took',
          value: waitingDays,
          unit: waitingDays === 1 ? 'day' : 'days',
          tone: waiting && guest ? 'red' : waiting ? 'amber' : 'green',
          note: `raised ${fmtDate(req.raised_date)}`,
        },
        {
          label: 'Priority',
          value: req.priority,
          tone: req.priority === 'Critical' ? 'red' : req.priority === 'High' ? 'amber' : 'blue',
          note: guest ? 'set by the source — a guest is waiting' : 'routine',
        },
        {
          label: 'Where',
          value: req.suite_number ? `Suite ${req.suite_number}` : 'Back of house',
          note: req.location_name,
        },
      ]} />

      {/* The one thing this page exists to say. A guest-reported fault that has
          sat untriaged is not a queue position, it is a person in a room with a
          problem, and it is the class of fault that turns into a review. */}
      {guest && waiting && (
        <Card style={{ marginBottom: 14, background: '#fef2f2', borderColor: '#fecaca' }}>
          <div style={{ fontSize: 13, color: '#b91c1c', lineHeight: 1.6 }}>
            <strong>Somebody is in the building waiting.</strong> Reported at the front desk
            by a guest {waitingDays} day{waitingDays === 1 ? '' : 's'} ago and still not
            triaged{req.suite_number ? `, in Suite ${req.suite_number}` : ''}. Guest-reported
            faults are the ones that become reviews.
          </div>
        </Card>
      )}

      <div style={styles.two}>
        <Section title="What was reported" style={{ marginBottom: 0 }}>
          <Fields rows={[
            ['Status', <StatusBadge key="s" tone={statusTone(req.status)}>{req.status}</StatusBadge>],
            ['Source', <StatusBadge key="src" tone={guest ? 'red' : 'grey'}>{req.source}</StatusBadge>],
            ['Priority', <Priority key="p" value={req.priority} />],
            ['Suite', req.suite_number || '—'],
            ['Location', req.location_name],
            ['Raised', fmtDate(req.raised_date)],
            req.converted_by ? ['Converted by', req.converted_by] : null,
            req.closed_by ? ['Closed by', req.closed_by] : null,
          ]} />

          <p style={{ margin: '14px 0 0', fontSize: 11.5, color: MUTE, lineHeight: 1.55 }}>
            {guest
              ? 'Front desk requests are relayed while the guest is standing there, which is why their priority follows the source rather than being judged separately.'
              : 'Found in the course of the day rather than reported by a guest — real work, but not work with somebody waiting on it.'}
          </p>
        </Section>

        <Section title="What it became" style={{ marginBottom: 0 }}>
          {wo ? (
            <div>
              <Fields rows={[
                ['Work order', <span key="n" style={styles.mono}>{wo.work_order_number}</span>],
                ['Job', wo.title],
                ['Status', <StatusBadge key="s">{wo.status}</StatusBadge>],
                ['Assigned to', wo.assigned_to_name],
                ['Due', fmtDate(wo.due_date)],
                ['Completed', wo.completed_date ? fmtDate(wo.completed_date) : 'Not yet'],
              ]} />
              <button
                onClick={() => router.push(`/portal/hospitality/work-orders/${wo.workorder_id || wo.recordId}`)}
                style={styles.linkBtn}
              >
                Open the work order →
              </button>
            </div>
          ) : req.work_order_number ? (
            <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.55 }}>
              Converted to <span style={styles.mono}>{req.work_order_number}</span>, which is not in the
              backlog this portal is showing. A converted request whose work order cannot be found is
              worth saying plainly rather than showing an empty panel.
            </p>
          ) : (
            <div>
              <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.55 }}>
                {waiting
                  ? 'Not yet triaged. Converting it raises the work order and records the link in one action — a request marked converted with no job behind it is the gap that loses a guest complaint.'
                  : `Closed without a work order behind it (${req.status.toLowerCase()}).`}
              </p>
              {waiting && (
                <button onClick={() => router.push('/portal/hospitality/requests')} style={styles.linkBtn}>
                  Triage it on the queue →
                </button>
              )}
            </div>
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
        a request in this register.
      </p>
      <div style={{ marginTop: 16 }}>
        <ActionButton onClick={() => router.push('/portal/hospitality/requests')}>Back to the requests</ActionButton>
      </div>
    </Card>
  )
}

const styles = {
  two: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14, marginBottom: 14, alignItems: 'start' },
  mono: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, color: SUB },
  linkBtn: {
    marginTop: 14, padding: '5px 11px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
    background: '#fff', border: `1px solid ${ACCENT}33`, color: ACCENT, borderRadius: 7, cursor: 'pointer',
  },
}
