'use client'

// One request, and what came of it.
//
// A request is the shortest record in this portal — somebody saw something and
// said so. What makes it worth its own page is everything it is *next to*: the
// filter it names, that filter's actual condition, the rule that would route it
// if it became a record, and the order it turned into if somebody dispatched it.
//
// So this page answers the question a triager has, which is not "what does the
// request say" — they can read that on the register — but "is it right, and
// what happens if I act on it". The condition of the filter is on the page, and
// it either backs the report up or it does not.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Card, Section, Fields, DataTable, PALETTE, Priority,
} from '../lib/kit'
import {
  FILTER_VIEW, WORK_ORDERS, THRESHOLDS, fmtDate, daysFromToday,
} from '../lib/data'
import { useStore } from '../lib/store'
import {
  useRequests, useCreatedOrders, requestById, convertRequest, rejectRequest,
} from '../lib/ops'
import { useRole } from '../lib/roles'
import { matchRule } from '../lib/routing'
import { DateCell, DueIn, Status, Id, Penetration, Differential } from '../lib/ui'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

export default function RequestView({ id }) {
  const router = useRouter()
  const store = useStore()
  const requests = useRequests()
  const orders = useCreatedOrders()
  const { can, why, role } = useRole()

  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const r = requestById(requests, id)

  if (!r) {
    return (
      <Card style={{ maxWidth: 560 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: INK }}>No request with that reference</h1>
        <p style={{ margin: '8px 0 16px', fontSize: 13.5, color: SUB, lineHeight: 1.6 }}>
          <Id>{id}</Id> is not on the request register.
        </p>
        <button onClick={() => router.push('/portal/hepa/requests')} style={{ ...styles.link, padding: '8px 14px' }}>
          Back to requests
        </button>
      </Card>
    )
  }

  const f = FILTER_VIEW.find((x) => x.filterId === r.filterId) || null
  const doc = f?.document || null
  const rule = doc ? matchRule(doc) : null
  const order = r.convertedTo
    ? (WORK_ORDERS.find((w) => w.workOrderId === r.convertedTo)
      || orders.find((w) => String(w.workOrderId) === String(r.convertedTo))
      || null)
    : null

  const open = r.status === 'Open'
  const age = Math.abs(daysFromToday(String(r.raisedAt).slice(0, 10)) ?? 0)
  const mayTriage = can('triage')

  // Does the register back the report up? This is the question the page exists
  // to answer, so it is computed rather than left to the reader.
  const corroboration = !f ? null
    : f.concern === 'Failed integrity test' ? { ok: true, text: `The registry agrees: ${f.filterId} failed its most recent integrity test.` }
      : f.breachCount ? { ok: true, text: `The registry agrees: ${f.breachCount} pressure ${f.breachCount === 1 ? 'reading is' : 'readings are'} over ${THRESHOLDS.pressureDifferential.value} in. wg on this filter.` }
        : f.dueIn != null && f.dueIn < 0 ? { ok: true, text: `The registry shows its certification ${Math.abs(f.dueIn)} days past due.` }
          : { ok: false, text: 'The registry shows nothing outstanding on this filter — its last test passed and no reading is in breach. Worth a look before dispatching anyone.' }

  const doConvert = async () => {
    if (!mayTriage) { store.notify(why('triage'), 'error'); return }
    setBusy(true)
    const made = await convertRequest(store, r, orders)
    setBusy(false)
    if (made) router.push(`/portal/hepa/work-orders/${made.workOrderId}`)
  }

  const doReject = async () => {
    if (!mayTriage) { store.notify(why('triage'), 'error'); return }
    setBusy(true)
    await rejectRequest(store, r, reason)
    setBusy(false)
    setReason('')
  }

  return (
    <div>
      <PageHeading
        back={{ label: 'Requests', onClick: () => router.push('/portal/hepa/requests') }}
        title={`${r.requestId} — ${r.kind}`}
        subtitle={`${r.cleanroomName}${r.filterId ? ` · filter ${r.filterId}` : ' · no filter named'}${f ? ` · ${f.isoClass}` : ''} · raised by ${r.raisedBy}`}
        right={(
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Priority value={r.urgency} />
            <Status>{r.status === 'Converted' ? 'Approved' : r.status === 'Rejected' ? 'Rejected' : 'Open'}</Status>
          </div>
        )}
      />

      <StatCards items={[
        { label: 'Status', value: r.status === 'Converted' ? 'Dispatched' : r.status === 'Rejected' ? 'Closed' : 'Open', icon: open ? 'clock' : 'tick', tone: open ? 'amber' : 'green', note: open ? 'waiting on triage' : r.convertedTo ? `order ${r.convertedTo}` : 'reason on the record' },
        { label: 'Urgency', value: r.urgency, icon: 'alert', tone: r.urgency === 'Critical' ? 'red' : r.urgency === 'High' ? 'amber' : undefined, note: 'as reported' },
        { label: 'Raised', value: age === 0 ? 'today' : `${age}d ago`, icon: 'list', note: fmtDate(String(r.raisedAt).slice(0, 10)) },
        { label: 'Reported by', value: r.raisedBy, icon: 'people', note: r.raisedRole || 'on site' },
        { label: 'Filter condition', value: f ? (f.concern || 'Clear') : '—', icon: 'chart', tone: f?.concern ? 'red' : f ? 'green' : undefined, note: f ? `${f.testCount} tests, ${f.breachCount} breaches` : 'no filter named' },
      ]} />

      {/* ── what was reported ──────────────────────────────────────────── */}
      <Section title="What was reported">
        <blockquote style={styles.quote}>
          {r.detail}
        </blockquote>
        <Fields columns={3} rows={[
          ['Reference', <Id key="a" strong>{r.requestId}</Id>],
          ['Kind', r.kind],
          ['Urgency', <Priority key="b" value={r.urgency} />],
          ['Raised by', `${r.raisedBy}${r.raisedRole ? ` — ${r.raisedRole}` : ''}`],
          ['Raised', <DateCell key="c" shifted={String(r.raisedAt).slice(0, 10)} />],
          ['Location', r.filterId ? <span key="d">{r.cleanroomName} · <Id>{r.filterId}</Id></span> : `${r.cleanroomName} — no filter named`],
        ]} />
      </Section>

      {/* ── does the data back it up ───────────────────────────────────── */}
      {corroboration && (
        <Card style={{
          marginBottom: 14,
          borderColor: corroboration.ok ? '#fecaca' : '#fde68a',
          background: corroboration.ok ? '#fef7f7' : '#fffbf5',
        }}>
          <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke={corroboration.ok ? '#b91c1c' : '#b45309'} strokeWidth="2.2"
              strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
            <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.65 }}>
              <strong style={{ color: corroboration.ok ? '#7f1d1d' : '#7c2d12' }}>
                {corroboration.ok ? 'Corroborated by the register.' : 'Not corroborated.'}
              </strong>{' '}
              {corroboration.text}
            </p>
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(330px,1fr))', gap: 14, marginBottom: 14 }}>
        {/* ── the filter it is about ──────────────────────────────────── */}
        {f ? (
          <Section
            title="The filter"
            style={{ marginBottom: 0 }}
            right={(
              <button onClick={() => router.push(`/portal/hepa/filters/${f.filterId}`)} style={styles.link}>
                Open record
              </button>
            )}
          >
            <Fields columns={2} rows={[
              ['Filter', <Id key="a" strong>{f.filterId}</Id>],
              ['Cleanroom', `${f.cleanroomName} (${f.cleanroomId})`],
              ['ISO class', f.isoClass],
              ['Status', <Status key="b">{f.status}</Status>],
              ['Last test', f.lastTest ? <span key="c"><Id>{f.lastTest.testId}</Id> <Status>{f.lastTest.result}</Status></span> : '—'],
              ['Penetration', f.lastTest ? <Penetration key="d" value={f.lastTest.penetration} /> : '—'],
              ['Highest differential', f.leaks.length ? <Differential key="e" value={Math.max(...f.leaks.map((l) => l.pressureDifferential || 0))} /> : '—'],
              ['Certification due', <DueIn key="f" days={f.dueIn} />],
            ]} />
          </Section>
        ) : (
          <Section title="No filter named" style={{ marginBottom: 0 }}>
            <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.65 }}>
              This request describes a condition in <strong style={{ color: INK }}>{r.cleanroomName}</strong>{' '}
              without naming a filter, which is the honest thing for whoever raised
              it to have done — they could not tell which unit it was.
            </p>
            <p style={{ margin: '10px 0 0', fontSize: 12.5, color: SUB, lineHeight: 1.65 }}>
              It cannot be converted straight to a work order, because an order
              needs an asset. Somebody has to look at the room first and raise the
              order against whichever filter it turns out to be.
            </p>
            <button onClick={() => router.push(`/portal/hepa/cleanrooms/${r.cleanroomId}`)} style={{ ...styles.link, marginTop: 12, padding: '7px 13px' }}>
              Open the cleanroom
            </button>
          </Section>
        )}

        {/* ── what happens if it is dispatched ────────────────────────── */}
        <Section title={order ? 'What it became' : 'If it is dispatched'} style={{ marginBottom: 0 }}>
          {order ? (
            <>
              <Fields columns={2} rows={[
                ['Work order', <Id key="a" strong>{order.workOrderId}</Id>],
                ['Class', order.orderClass],
                ['Type', String(order.workOrderType).replace(/^PM\d+\w* - /, '')],
                ['Converted by', r.convertedBy || '—'],
                ['Converted', r.convertedAt ? <DateCell key="b" shifted={String(r.convertedAt).slice(0, 10)} /> : '—'],
                ['Technician', order.technicianName || 'unassigned'],
              ]} />
              <button onClick={() => router.push(`/portal/hepa/work-orders/${order.workOrderId}`)}
                style={{ ...styles.link, marginTop: 12, padding: '7px 13px' }}>
                Open the work order
              </button>
            </>
          ) : r.status === 'Rejected' ? (
            <>
              <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.65 }}>
                Closed without work. The reason is on the record, and the request
                itself was kept rather than deleted — a report that turned out to
                need nothing is still evidence that somebody looked.
              </p>
              <div style={styles.rejected}>
                <strong style={{ color: '#7f1d1d' }}>{r.rejectedBy}:</strong> &ldquo;{r.rejectionReason}&rdquo;
                {r.rejectedAt && (
                  <span style={{ display: 'block', fontSize: 11, color: MUTE, marginTop: 5 }}>
                    {fmtDate(String(r.rejectedAt).slice(0, 10))}
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.65 }}>
                Converting raises a work order against{' '}
                {f ? <Id>{f.filterId}</Id> : 'the filter'}, carrying this request&apos;s
                urgency and wording, and marks this record converted with the
                order number on it.
              </p>
              {rule && (
                <div style={styles.rulePreview}>
                  <div style={styles.ruleLabel}>The certification would route to</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{rule.to}</div>
                  <div style={{ fontSize: 11, color: MUTE, marginTop: 2 }}>
                    by rule &ldquo;{rule.name}&rdquo;, on {rule.basis}
                  </div>
                </div>
              )}
            </>
          )}
        </Section>
      </div>

      {/* ── triage ─────────────────────────────────────────────────────── */}
      {open && (
        <Section title="Triage">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, marginBottom: 6 }}>Dispatch it</div>
              <p style={{ margin: '0 0 11px', fontSize: 11.5, color: SUB, lineHeight: 1.55 }}>
                {f
                  ? 'Raises a work order and opens it. This request keeps the order number.'
                  : 'Not available — this request names a room rather than a filter, and an order needs an asset.'}
              </p>
              <button
                onClick={doConvert}
                disabled={!f || busy || !mayTriage || !store.ready}
                title={mayTriage ? undefined : why('triage')}
                style={{ ...styles.primary, opacity: !f || busy || !mayTriage || !store.ready ? 0.5 : 1 }}
              >
                {busy ? 'Creating…' : 'Convert to work order'}
              </button>
            </div>

            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, marginBottom: 6 }}>Or close it</div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Why no work is needed. This stays on the record."
                style={styles.textarea}
              />
              <button
                onClick={doReject}
                disabled={!reason.trim() || busy || !mayTriage || !store.ready}
                title={mayTriage ? undefined : why('triage')}
                style={{ ...styles.reject, marginTop: 9, opacity: !reason.trim() || busy || !mayTriage || !store.ready ? 0.5 : 1 }}
              >
                Close with a reason
              </button>
            </div>
          </div>

          {!mayTriage && (
            <p style={{ margin: '13px 0 0', paddingTop: 12, borderTop: `1px solid ${LINE}`, fontSize: 11.5, color: '#b45309', lineHeight: 1.55 }}>
              Signed in as {role.short}. {why('triage')}
            </p>
          )}
        </Section>
      )}

      {/* ── the rest of the room ───────────────────────────────────────── */}
      {f && f.leaks.length > 0 && (
        <Section title={`Recent readings on ${f.filterId}`}>
          <DataTable
            columns={[
              { key: 'readingId', label: 'Reading', render: (x) => <Id strong>{x.readingId}</Id> },
              { key: 'date', label: 'Read', render: (x) => <DateCell shifted={x.date} original={x.readingDate} /> },
              { key: 'pressureDifferential', label: 'Differential', align: 'right', render: (x) => <Differential value={x.pressureDifferential} /> },
              { key: 'readingType', label: 'Type' },
              { key: 'technicianId', label: 'Technician', render: (x) => <Id>{x.technicianId}</Id> },
              { key: 'breach', label: 'Against threshold', render: (x) => <Status>{x.breach}</Status> },
            ]}
            rows={[...f.leaks].sort((a, b) => String(b.date).localeCompare(String(a.date))).map((l) => ({ ...l, id: l.readingId }))}
            pageSize={6}
          />
        </Section>
      )}
    </div>
  )
}

const styles = {
  quote: {
    margin: '0 0 15px', padding: '13px 16px', borderRadius: 10, background: '#fcfdfe',
    fontSize: 13.5, color: INK, lineHeight: 1.65, fontStyle: 'italic',
    borderLeftStyle: 'solid', borderLeftWidth: 3, borderLeftColor: ACCENT,
  },
  rulePreview: {
    marginTop: 12, padding: '11px 13px', borderRadius: 10, background: '#f0fdfa',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#99f6e4',
  },
  ruleLabel: {
    fontSize: 9.5, fontWeight: 700, color: '#0f766e', textTransform: 'uppercase',
    letterSpacing: 0.4, marginBottom: 4,
  },
  rejected: {
    marginTop: 12, padding: '11px 13px', borderRadius: 10, background: '#fef7f7',
    fontSize: 12, color: SUB, lineHeight: 1.6,
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fecaca',
  },
  textarea: {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
    fontFamily: 'inherit', lineHeight: 1.5, color: INK, borderRadius: 9,
    outline: 'none', background: '#fff', resize: 'vertical',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  primary: {
    padding: '9px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
    border: 'none', borderRadius: 9, background: ACCENT, color: '#fff', cursor: 'pointer',
  },
  reject: {
    padding: '9px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
    borderRadius: 9, background: '#fef2f2', color: '#b91c1c', cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fecaca',
  },
  link: {
    padding: '5px 11px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
    borderRadius: 7, background: '#fff', color: ACCENT, cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
}
