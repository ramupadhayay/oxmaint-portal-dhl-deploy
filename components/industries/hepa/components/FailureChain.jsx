'use client'

// What the failed test set off, drawn as the chain it is.
//
// Four steps, in the order they have to happen: the test that failed, the
// inspection that establishes why, the round that brings somebody back, and the
// work that fixes it. Each one shows what satisfies it and links to that record.
//
// A step nobody has done is not hidden. It is the point of the panel — an
// auditor's question is never "where is the record" but "what did this failure
// produce", and a gap in the middle of a chain is the answer they are looking
// for. So an open step says what is missing and offers the one action that
// would close it.
//
// The work order offers two routes because the portal genuinely has two: an
// order raised off the inspection's findings, or one that already exists in SAP
// against the same equipment. Raising a second order beside an SAP one would be
// the integration failing in the most expensive way, so the panel checks.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PALETTE } from '../lib/kit'
import { Glyph, Pill, TONE, BRAND } from '../lib/productKit'
import { chainFor } from '../lib/escalation'
import { useStore } from '../lib/store'
import { createWorkOrder } from '../lib/ops'
import { USER } from '../lib/data'

const { INK, SUB, MUTE, LINE } = PALETTE

const ICON = {
  test: 'cross',
  inspection: 'clipboard',
  reminder: 'clock',
  'work-order': 'wrench',
}

export default function FailureChain({ filter }) {
  const router = useRouter()
  const store = useStore()
  const [busy, setBusy] = useState(null)
  const [route, setRoute] = useState('checklist')

  const chain = chainFor(filter, store?.records || {})
  if (!chain || !chain.failed) return null

  const raiseInspection = async () => {
    setBusy('raise-inspection')
    const number = 3000 + (store?.records?.hepa_inspection?.length || 0) + 900
    const record = await store.create('hepa_inspection', {
      reportId: `INS-${number}`,
      roundId: 'housing',
      round: 'Filter housing and seal inspection',
      standard: 'ISO 14644-3 Annex B',
      frequency: 'Quarterly',
      cleanroomId: filter.cleanroomId,
      cleanroomName: filter.cleanroomName,
      isoClass: filter.isoClass,
      filterId: filter.filterId,
      appliesTo: 'filter',
      date: new Date().toISOString().slice(0, 10),
      assignee: USER.name,
      status: 'Scheduled',
      result: null,
      score: null,
      findings: [],
      findingsCount: 0,
      // What this round came from. Without it the chain cannot tell an
      // inspection raised off this failure from one that was already due.
      fromFailure: filter.filterId,
      notes: `Raised from the failed integrity test ${filter.lastTest?.testId} on ${filter.filterId}.`,
      _walked: false,
      _pending: true,
      _overdue: false,
    })
    setBusy(null)
    if (record) store.notify(`Housing inspection raised against ${filter.filterId}.`)
  }

  const raiseWorkOrder = async () => {
    setBusy('raise-work-order')
    const existing = store?.records?.hepa_work_order || []
    const record = await createWorkOrder(store, {
      filterId: filter.filterId,
      orderType: 'PM01',
      description: route === 'sap'
        ? `Filter ${filter.filterId} failed its integrity test at ${filter.lastTest?.penetration} penetration. Raised for SAP to plan against the equipment master.`
        : `Filter ${filter.filterId} failed its integrity test at ${filter.lastTest?.penetration} penetration. Raised from the housing inspection findings.`,
      priority: 'Critical',
      fromInspection: chain.steps[1].ref || null,
    }, existing)
    setBusy(null)
    if (record) {
      store.notify(route === 'sap'
        ? `${record.workOrderId} raised and queued for the SAP gateway.`
        : `${record.workOrderId} raised from the inspection findings.`)
    }
  }

  const act = (which) => {
    if (which === 'raise-inspection') return raiseInspection()
    if (which === 'raise-work-order') return raiseWorkOrder()
    // A reminder is a round on a schedule rather than a record somebody writes,
    // so the honest action is to open the register where it is set.
    return router.push('/portal/hepa/inspection-reminder')
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.head}>
        <span style={styles.headTile}>
          <Glyph name="warning" size={17} color={TONE.red.fg} />
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <h3 style={styles.title}>What this failure set off</h3>
          <p style={styles.summary}>{chain.summary}</p>
        </span>
        <Pill tone={chain.complete ? 'slate' : 'red'}>
          {chain.steps.length - chain.outstanding.length} of {chain.steps.length} done
        </Pill>
      </div>

      <ol style={styles.list}>
        {chain.steps.map((s, i) => {
          const last = i === chain.steps.length - 1
          return (
            <li key={s.key} style={styles.step}>
              <span style={styles.rail}>
                <span style={{
                  ...styles.node,
                  background: s.done ? BRAND[600] : '#fff',
                  borderColor: s.done ? BRAND[600] : (s.tone === 'red' ? TONE.red.bd : LINE),
                }}>
                  {s.done
                    ? <Glyph name="check" size={13} color="#fff" width={2.6} />
                    : <Glyph name={ICON[s.key]} size={12} color={s.tone === 'red' ? TONE.red.fg : MUTE} />}
                </span>
                {!last && <span style={{ ...styles.line, background: s.done ? BRAND[100] : LINE }} />}
              </span>

              <span style={styles.stepBody}>
                <span style={styles.stepTop}>
                  <span style={{ ...styles.stepTitle, color: s.done ? INK : SUB }}>{s.title}</span>
                  {s.ref && (
                    s.href ? (
                      <button onClick={() => router.push(s.href)} style={styles.ref}>{s.ref}</button>
                    ) : <span style={{ ...styles.ref, cursor: 'default' }}>{s.ref}</span>
                  )}
                  {!s.done && <Pill tone={s.tone === 'red' ? 'red' : 'amber'}>Open</Pill>}
                </span>

                <span style={styles.stepDetail}>{s.detail}</span>

                {s.action && (
                  <span style={styles.actions}>
                    {s.routes && (
                      <span style={styles.routes}>
                        {[['checklist', 'From the inspection checklist'], ['sap', 'Through SAP']].map(([key, label]) => (
                          <button key={key} onClick={() => setRoute(key)}
                            style={{ ...styles.route, ...(route === key ? styles.routeOn : null) }}>
                            {label}
                          </button>
                        ))}
                      </span>
                    )}
                    <button onClick={() => act(s.action)} disabled={busy === s.action || !store?.ready}
                      style={{ ...styles.do, opacity: busy === s.action || !store?.ready ? 0.55 : 1 }}>
                      {busy === s.action ? 'Working…' : LABEL[s.action]}
                    </button>
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ol>

      <p style={styles.foot}>
        The chain is read from the register each time rather than stored. A work
        order closed in SAP, or a round walked in the portal, changes what this
        panel says without anybody updating it — a stored status would go on
        claiming something that had stopped being true.
      </p>
    </div>
  )
}

const LABEL = {
  'raise-inspection': 'Raise the inspection',
  'book-reminder': 'Open the reminder register',
  'raise-work-order': 'Raise the work order',
}

const styles = {
  wrap: {
    background: '#fff', borderRadius: 12, padding: '18px 20px', marginBottom: 14,
    borderStyle: 'solid', borderWidth: 1, borderColor: TONE.red.bd,
  },
  head: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  headTile: {
    width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', flexShrink: 0,
    background: TONE.red.bg, borderStyle: 'solid', borderWidth: 1, borderColor: TONE.red.bd,
  },
  title: { margin: 0, fontSize: 15, fontWeight: 700, color: INK },
  summary: { margin: '4px 0 0', fontSize: 12.5, color: SUB, lineHeight: 1.55 },

  list: { listStyle: 'none', margin: 0, padding: 0 },
  step: { display: 'flex', gap: 13, minWidth: 0 },
  rail: { display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 },
  node: {
    width: 24, height: 24, borderRadius: 999, display: 'grid', placeItems: 'center',
    borderStyle: 'solid', borderWidth: 1.5, flexShrink: 0,
  },
  // Fills whatever height the step's body takes, so the chain reads as one line
  // through the panel rather than as four disconnected dots.
  line: { width: 2, flex: 1, minHeight: 14, borderRadius: 2 },

  stepBody: { minWidth: 0, flex: 1, paddingBottom: 16 },
  stepTop: { display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
  stepTitle: { fontSize: 13, fontWeight: 700 },
  ref: {
    background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 11.5, fontWeight: 700, color: BRAND[600], fontVariantNumeric: 'tabular-nums',
  },
  stepDetail: { display: 'block', fontSize: 12, color: SUB, lineHeight: 1.6, marginTop: 4 },

  actions: { display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginTop: 10 },
  routes: {
    display: 'inline-flex', padding: 3, borderRadius: 9, background: '#f1f5f9', gap: 0, flexWrap: 'wrap',
  },
  route: {
    padding: '5px 11px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
    border: 'none', borderRadius: 7, background: 'transparent', color: MUTE, cursor: 'pointer',
  },
  routeOn: { background: '#fff', color: BRAND[900], boxShadow: '0 1px 2px rgba(15,23,42,.08)' },
  do: {
    padding: '8px 15px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
    border: 'none', borderRadius: 9, background: BRAND[900], color: '#fff', cursor: 'pointer',
  },

  foot: {
    margin: '4px 0 0', paddingTop: 13, fontSize: 11.5, color: MUTE, lineHeight: 1.6,
    borderTopStyle: 'solid', borderTopWidth: 1, borderTopColor: LINE,
  },
}
