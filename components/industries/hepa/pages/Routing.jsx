'use client'

// The routing rules.
//
// This screen exists because of one sentence in the client's brief — "routing
// logic is condition-based, not manual triage" — and it is built to be argued
// with rather than admired. Each rule shows the condition it tests, what it is
// matching right now, and which records it would move. Turn one off and the
// next in the chain takes over, and the counts move while you watch.
//
// First match wins, so order is part of the configuration. That is stated on
// the screen rather than left to be discovered: a rule that never fires because
// something above it always matches first is the failure mode of every rule
// engine, and it should be visible from the counts.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Card, Section, DataTable, PALETTE, Priority,
} from '../lib/kit'
import { FILTER_VIEW, THRESHOLDS } from '../lib/data'
import { useStore } from '../lib/store'
import { useDocuments, routeAll, routeByRule } from '../lib/lifecycle'
import { RULES, matchRule, routable, coverage } from '../lib/routing'
import { useRole } from '../lib/roles'
import { Status, Id, DueIn } from '../lib/ui'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

const filterOf = (id) => FILTER_VIEW.find((f) => f.filterId === id) || null

export default function Routing() {
  const router = useRouter()
  const store = useStore()
  const documents = useDocuments()
  const { can, why, role } = useRole()

  const [disabled, setDisabled] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  const [single, setSingle] = useState(null)

  const editable = can('configureRouting')

  const waiting = useMemo(() => routable(documents), [documents])
  const cover = useMemo(() => coverage(waiting, disabled), [waiting, disabled])
  // What each rule would match across *everything*, not just what is waiting —
  // a rule matching nothing on the queue today is not a rule matching nothing.
  const coverAll = useMemo(() => coverage(documents, disabled), [documents, disabled])

  const toggle = (id) => {
    if (!editable) { store.notify(why('configureRouting'), 'error'); return }
    setDisabled((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const applyAll = async () => {
    if (!can('route')) { store.notify(why('route'), 'error'); return }
    setBusy(true)
    await routeAll(store, waiting, (d) => matchRule(d, disabled))
    setBusy(false)
  }

  const applyOne = async (doc) => {
    if (!can('route')) { store.notify(why('route'), 'error'); return }
    setSingle(doc.documentRef)
    await routeByRule(store, doc, matchRule(doc, disabled))
    setSingle(null)
  }

  const rows = waiting.map((d) => {
    const rule = matchRule(d, disabled)
    const f = filterOf(d.relatedRecordId)
    return {
      ...d,
      id: d.documentRef,
      rule,
      cleanroomName: f?.cleanroomName || '—',
      isoClass: f?.isoClass || '—',
      concern: f?.concern || null,
    }
  })

  const columns = [
    { key: 'documentRef', label: 'Record', render: (r) => <Id strong>{r.documentRef}</Id> },
    { key: 'recordType', label: 'Type' },
    { key: 'cleanroomName', label: 'Cleanroom', render: (r) => <span>{r.cleanroomName}<span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{r.isoClass}</span></span> },
    { key: 'concern', label: 'Condition', render: (r) => (r.concern ? <Status>{r.concern === 'Failed integrity test' ? 'Fail' : 'Breach'}</Status> : <span style={{ fontSize: 11.5, color: MUTE }}>clear</span>) },
    {
      key: 'rule',
      label: 'Rule that fires',
      sortable: false,
      render: (r) => (r.rule
        ? <span><strong style={{ fontSize: 12, color: INK }}>{r.rule.name}</strong><span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>on {r.rule.basis}</span></span>
        : <span style={{ color: '#b91c1c', fontSize: 11.5 }}>no rule matches</span>),
    },
    { key: 'to', label: 'Routes to', sortable: false, render: (r) => (r.rule ? <span><strong style={{ fontSize: 12, color: INK }}>{r.rule.to}</strong><span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{r.rule.reviewer}</span></span> : '—') },
    { key: 'urgency', label: 'Urgency', sortable: false, render: (r) => (r.rule ? <Priority value={r.rule.urgency} /> : '—') },
    { key: 'dueIn', label: 'Cert due', render: (r) => <DueIn days={r.dueIn} />, sortValue: (r) => r.dueIn ?? 9999 },
    {
      key: 'act',
      label: '',
      align: 'right',
      sortable: false,
      render: (r) => (
        <button
          disabled={!r.rule || single === r.documentRef || busy}
          onClick={(e) => { e.stopPropagation(); applyOne(r) }}
          title={can('route') ? `Route to ${r.rule?.to}` : why('route')}
          style={{ ...styles.rowBtn, opacity: !r.rule || single === r.documentRef || busy ? 0.5 : 1 }}
        >
          {single === r.documentRef ? 'Routing…' : 'Route'}
        </button>
      ),
    },
  ]

  const unreachable = RULES.filter((r) => !disabled.has(r.id) && coverAll[r.id].length === 0)

  return (
    <div>
      <PageHeading
        title="Routing Rules"
        subtitle="Where a certification record goes when it is raised, decided by what the record says rather than by who happens to be looking at it. First match wins."
        right={(
          <button
            onClick={applyAll}
            disabled={busy || !waiting.length}
            title={can('route') ? undefined : why('route')}
            style={{ ...styles.apply, opacity: busy || !waiting.length ? 0.55 : 1 }}
          >
            {busy ? 'Routing…' : `Route ${waiting.length} waiting`}
          </button>
        )}
      />

      <StatCards items={[
        { label: 'Rules', value: RULES.length, icon: 'list', note: `${disabled.size} switched off` },
        { label: 'Waiting to be routed', value: waiting.length, icon: 'clock', tone: waiting.length ? 'amber' : 'green', note: 'records still at Created' },
        { label: 'Would go to Quality', value: rows.filter((r) => r.rule?.to !== 'Manufacturing Supervisor').length, icon: 'alert', note: 'reviewer or site lead' },
        { label: 'On condition, not triage', value: rows.filter((r) => r.rule && r.rule.id !== 'routine').length, icon: 'chart', note: 'matched by result or cleanroom' },
        { label: 'Unreachable rules', value: unreachable.length, icon: 'tick', tone: unreachable.length ? 'amber' : 'green', note: unreachable.length ? 'matched by an earlier rule' : 'every rule can fire' },
      ]} />

      <Card style={{ marginBottom: 14, background: '#fcfdfe' }}>
        <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
            <path d="M3 6h18M7 12h14M11 18h10" />
          </svg>
          <p style={{ margin: 0, fontSize: 12, color: SUB, lineHeight: 1.6 }}>
            <strong style={{ color: INK }}>First match wins, top to bottom.</strong> A record is
            tested against each rule in order and takes the first that fits, so
            a failed test in an ISO 5 room goes to the Quality Reviewer rather
            than the site lead — the failure rule sits above the cleanroom rule
            because a compromised barrier outranks a room grade. Switch a rule
            off and the counts below move to whichever rule catches those records
            instead.
            {!editable && (
              <> <strong style={{ color: '#b45309' }}>You are viewing as {role.short}</strong>, so the
                toggles are read-only — {why('configureRouting').toLowerCase()}</>
            )}
          </p>
        </div>
      </Card>

      <Section title="The rules, in order">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {RULES.map((rule, i) => {
            const off = disabled.has(rule.id)
            const hereNow = cover[rule.id].length
            const everything = coverAll[rule.id].length
            const shadowed = !off && everything === 0
            return (
              <div key={rule.id} style={{ ...styles.rule, ...(off ? styles.ruleOff : null) }}>
                <span style={{ ...styles.order, ...(off ? styles.orderOff : null) }}>{i + 1}</span>

                <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                    <strong style={{ fontSize: 13, color: off ? MUTE : INK }}>{rule.name}</strong>
                    <span style={styles.basis}>{rule.basis}</span>
                    {shadowed && <span style={styles.shadow}>never fires — an earlier rule catches these</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: SUB, lineHeight: 1.5 }}>{rule.condition}</div>
                  <div style={{ fontSize: 11, color: MUTE, lineHeight: 1.5, marginTop: 4 }}>{rule.why}</div>
                </div>

                <div style={{ minWidth: 130, flexShrink: 0 }}>
                  <div style={styles.miniLabel}>Routes to</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: off ? MUTE : INK }}>{rule.to}</div>
                  <div style={{ fontSize: 10.5, color: MUTE }}>{rule.reviewer}</div>
                  <div style={{ marginTop: 5 }}><Priority value={rule.urgency} /></div>
                </div>

                <div style={{ minWidth: 92, flexShrink: 0, textAlign: 'right' }}>
                  <div style={styles.miniLabel}>Matching</div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: off ? MUTE : hereNow ? ACCENT : SUB, lineHeight: 1 }}>
                    {off ? '—' : hereNow}
                  </div>
                  <div style={{ fontSize: 10, color: MUTE, marginTop: 3 }}>
                    {off ? 'switched off' : `${everything} of all records`}
                  </div>
                </div>

                <button
                  onClick={() => toggle(rule.id)}
                  disabled={!editable}
                  title={editable ? (off ? 'Switch this rule on' : 'Switch this rule off') : why('configureRouting')}
                  style={{ ...styles.toggle, ...(off ? null : styles.toggleOn), opacity: editable ? 1 : 0.45 }}
                >
                  <span style={{ ...styles.knob, ...(off ? null : styles.knobOn) }} />
                </button>
              </div>
            )
          })}
        </div>

        <p style={{ margin: '14px 0 0', paddingTop: 12, borderTop: `1px solid ${LINE}`, fontSize: 11.5, color: MUTE, lineHeight: 1.6 }}>
          The three conditions the brief names are all here: <strong style={{ color: INK }}>result</strong>{' '}
          (a failed scan, a differential over {THRESHOLDS.pressureDifferential.value} in. wg),{' '}
          <strong style={{ color: INK }}>cleanroom</strong> (an ISO 5 aseptic core), and{' '}
          <strong style={{ color: INK }}>record type</strong> (a replacement). The last rule matches
          everything, so no record can fall through without a reviewer.
        </p>
      </Section>

      <Section
        title={`Waiting to be routed (${waiting.length})`}
        right={<span style={{ fontSize: 11.5, color: MUTE }}>each row shows the rule that would move it</span>}
      >
        <DataTable
          columns={columns}
          rows={rows}
          pageSize={10}
          empty="Nothing is sitting at Created. Every record has been routed."
          onRowClick={(r) => router.push(`/portal/hepa/repository/${r.documentRef}`)}
        />
        <p style={{ margin: '12px 0 0', paddingTop: 12, borderTop: `1px solid ${LINE}`, fontSize: 11.5, color: MUTE, lineHeight: 1.6 }}>
          Routing writes an audit entry naming the rule that fired and why, with{' '}
          <strong style={{ color: INK }}>Routing rules</strong> as the actor rather than a person —
          a record that moved on its own has to say what moved it.
        </p>
      </Section>
    </div>
  )
}

const styles = {
  apply: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', border: 'none',
    borderRadius: 9, background: ACCENT, color: '#fff', cursor: 'pointer',
  },
  rule: {
    display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap',
    padding: '13px 15px', borderRadius: 11, background: '#fcfdfe',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  ruleOff: { background: '#f8fafc', borderColor: '#eef1f5' },
  order: {
    width: 22, height: 22, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center',
    fontSize: 11, fontWeight: 800, background: '#eef2ff', color: ACCENT, marginTop: 1,
  },
  orderOff: { background: '#f1f5f9', color: MUTE },
  basis: {
    fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
    color: '#0f766e', background: '#f0fdfa', borderRadius: 5, padding: '1px 6px',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#99f6e4',
  },
  shadow: {
    fontSize: 9.5, fontWeight: 700, color: '#b45309', background: '#fffbeb',
    borderRadius: 5, padding: '1px 6px',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fde68a',
  },
  miniLabel: {
    fontSize: 9.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase',
    letterSpacing: 0.4, marginBottom: 3,
  },
  toggle: {
    width: 38, height: 22, flexShrink: 0, borderRadius: 999, padding: 2,
    background: '#e2e8f0', cursor: 'pointer', border: 'none',
    display: 'flex', alignItems: 'center', transition: 'background .16s',
  },
  toggleOn: { background: ACCENT },
  knob: {
    width: 18, height: 18, borderRadius: '50%', background: '#fff',
    transition: 'transform .16s', boxShadow: '0 1px 3px rgba(15,23,42,0.22)',
  },
  knobOn: { transform: 'translateX(16px)' },
  rowBtn: {
    padding: '5px 11px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
    borderRadius: 7, background: '#fff', color: ACCENT, cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
}
