'use client'

// Common area tracking — the register a board has never had.
//
// The article's line about this is the sharpest thing on the page it came
// from: most associations "discover what they own when something breaks, and
// they discover its maintenance history when a contractor asks for it and
// nobody can find the records." So the register is the product, and the two
// things layered on it are the ones that turn a list into a management tool.
//
// Condition scoring, which is deliberately not derived from age — a
// well-maintained twelve-year-old roof and a neglected eight-year-old one are
// exactly the distinction scoring exists to make, and deriving it from the
// install date would erase it.
//
// And inspection findings with a state. The article's example is a finding
// sitting in a board member's email because there was nothing to track it to
// resolution; here an open finding is counted, on the board dashboard, until
// somebody closes it.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Card, Section, DataTable, Toolbar, HBars, PALETTE,
} from '../lib/kit'
import { COMMUNITY, COMPONENT_TYPES, INSPECTIONS } from '../lib/community'
import { COMPONENT_VIEW, POSITION, money, moneyShort } from '../lib/reserve'
import { fmtDate } from '../lib/data'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

// Green, amber, red — the board dashboard the article describes. The bands are
// on condition rather than age, because that is what an inspector scored.
const band = (c) => (c.condition <= 2 ? 'red' : c.condition === 3 ? 'amber' : 'green')
const BANDS = {
  red: { label: 'Needs attention', colour: '#dc2626', tint: '#fef2f2', edge: '#fecaca', what: 'Poor or failing. Work needed now.' },
  amber: { label: 'Watch', colour: '#d97706', tint: '#fffbeb', edge: '#fde68a', what: 'Fair. Approaching a service interval.' },
  green: { label: 'Good standing', colour: '#16a34a', tint: '#f0fdf4', edge: '#bbf7d0', what: 'Good or excellent. Nothing outstanding.' },
}

const daysBack = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)

export default function CommonAreas() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')
  const [where, setWhere] = useState('all')
  const [health, setHealth] = useState('all')

  const rows = useMemo(() => COMPONENT_VIEW.filter((c) => {
    if (type !== 'all' && c.typeLabel !== type) return false
    if (where !== 'all' && c.location !== where) return false
    if (health !== 'all' && band(c) !== health) return false
    if (q && !`${c.componentId} ${c.name} ${c.location} ${c.typeLabel}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }).map((c) => ({ ...c, id: c.componentId })), [q, type, where, health])

  const counts = {
    red: COMPONENT_VIEW.filter((c) => band(c) === 'red').length,
    amber: COMPONENT_VIEW.filter((c) => band(c) === 'amber').length,
    green: COMPONENT_VIEW.filter((c) => band(c) === 'green').length,
  }

  const openFindings = INSPECTIONS.filter((i) => i.status !== 'Closed')

  // Which locations carry the risk. A board meeting asks "which building",
  // and the answer is a roll-up rather than a scan of thirty-four rows.
  const byLocation = useMemo(() => {
    const m = new Map()
    for (const c of COMPONENT_VIEW) {
      if (!m.has(c.location)) m.set(c.location, { name: c.location, value: 0, colour: '#dc2626' })
      if (band(c) === 'red') m.get(c.location).value += 1
    }
    return [...m.values()].map((r) => ({ ...r, color: r.colour }))
  }, [])

  const columns = [
    { key: 'componentId', label: 'Component', render: (c) => <span><strong style={{ color: INK, fontSize: 12 }}>{c.name}</strong><span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{c.componentId} · {c.typeLabel}</span></span> },
    { key: 'location', label: 'Where' },
    {
      key: 'condition',
      label: 'Condition',
      render: (c) => {
        const b = BANDS[band(c)]
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <span style={{ ...styles.dot, background: b.colour }} />
            <span style={{ lineHeight: 1.3 }}>
              <strong style={{ fontSize: 12, color: INK }}>{c.conditionLabel}</strong>
              <span style={{ display: 'block', fontSize: 10, color: MUTE }}>{c.condition} of 5</span>
            </span>
          </span>
        )
      },
      sortValue: (c) => c.condition,
    },
    { key: 'age', label: 'Age', align: 'right', render: (c) => <span>{c.age}<span style={{ fontSize: 10.5, color: MUTE }}> / {c.usefulLife} yr</span></span> },
    { key: 'remaining', label: 'Remaining life', align: 'right', render: (c) => (c.overdue ? <strong style={{ color: '#b91c1c' }}>past due</strong> : <span>{c.remaining}<span style={{ fontSize: 10.5, color: MUTE }}> yr</span></span>), sortValue: (c) => (c.overdue ? -1 : c.remaining) },
    { key: 'lastService', label: 'Last service', render: (c) => fmtDate(c.lastService), sortValue: (c) => c.lastService },
    { key: 'replacementCost', label: 'Replacement', align: 'right', render: (c) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{moneyShort(c.replacementCost)}</span> },
    { key: 'priority', label: 'Reserve priority', render: (c) => <span style={styles.priority}>{c.priority}</span> },
  ]

  return (
    <div>
      <PageHeading
        title="Common Areas"
        subtitle={`${COMMUNITY.name} — ${COMPONENT_VIEW.length} tracked components across ${COMMUNITY.buildings} buildings and the grounds, each with its condition, age, service history and replacement cost.`}
      />

      <StatCards items={[
        { label: 'Components tracked', value: COMPONENT_VIEW.length, icon: 'asset', note: `${COMMUNITY.buildings} buildings · ${COMMUNITY.units} units` },
        { label: 'Needs attention', value: counts.red, icon: 'alert', tone: counts.red ? 'red' : 'green', note: 'poor or failing condition' },
        { label: 'On watch', value: counts.amber, icon: 'clock', tone: counts.amber ? 'amber' : 'green', note: 'fair — approaching service' },
        { label: 'Open findings', value: openFindings.length, icon: 'list', tone: openFindings.length ? 'amber' : 'green', note: 'from inspections, not yet closed' },
        { label: 'Replacement value', value: moneyShort(POSITION.replacementTotal), icon: 'chart', note: 'what the association owns' },
      ]} />

      {/* ── the board dashboard ────────────────────────────────────────── */}
      <Section
        title="Community asset health"
        right={<span style={{ fontSize: 11.5, color: MUTE }}>as scored at the last inspection or service</span>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
          {['red', 'amber', 'green'].map((key) => {
            const b = BANDS[key]
            const n = counts[key]
            const share = COMPONENT_VIEW.length ? n / COMPONENT_VIEW.length : 0
            return (
              <div
                key={key}
                role="button"
                tabIndex={0}
                onClick={() => setHealth(health === key ? 'all' : key)}
                onKeyDown={(e) => { if (e.key === 'Enter') setHealth(health === key ? 'all' : key) }}
                style={{
                  ...styles.bandCard,
                  borderColor: health === key ? b.colour : b.edge,
                  background: b.tint,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                  <span style={{ ...styles.dot, background: b.colour }} />
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: INK }}>{b.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 21, fontWeight: 800, color: b.colour, lineHeight: 1 }}>{n}</span>
                </div>
                <div style={styles.bandTrack}>
                  <div style={{ width: `${share * 100}%`, height: '100%', background: b.colour, borderRadius: 999 }} />
                </div>
                <div style={{ fontSize: 10.5, color: SUB, marginTop: 7, lineHeight: 1.45 }}>{b.what}</div>
              </div>
            )
          })}
        </div>
        <p style={styles.note}>
          Click a band to filter the register. Condition is scored by whoever
          inspected or serviced the component, not derived from its age — a
          well-maintained twelve-year-old roof and a neglected eight-year-old one
          are the distinction this exists to make.
        </p>
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14, marginBottom: 14 }}>
        <Section title="Where the risk sits" style={{ marginBottom: 0 }}>
          {byLocation.some((r) => r.value) ? <HBars data={byLocation} /> : (
            <div style={{ padding: '24px 0', textAlign: 'center', color: MUTE, fontSize: 12.5 }}>
              Nothing is in poor or failing condition.
            </div>
          )}
          <p style={styles.note}>
            Components in poor or failing condition, by location. A board meeting
            asks &ldquo;which building&rdquo;, and this is the answer without
            reading {COMPONENT_VIEW.length} rows.
          </p>
        </Section>

        <Section title="Open inspection findings" right={<span style={{ fontSize: 11.5, color: MUTE }}>{openFindings.length}</span>} style={{ marginBottom: 0 }}>
          {openFindings.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {openFindings.map((i) => {
                const c = COMPONENT_VIEW.find((x) => x.componentId === i.componentId)
                return (
                  <div key={i.inspectionId} style={styles.finding}
                    onClick={() => router.push(`/portal/hospitality/common-areas/${i.componentId}`)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ ...styles.severity, ...(i.severity === 'High' ? styles.sevHigh : i.severity === 'Medium' ? styles.sevMed : styles.sevLow) }}>
                        {i.severity}
                      </span>
                      <strong style={{ fontSize: 12, color: INK }}>{c?.name || i.componentId}</strong>
                      <span style={{ marginLeft: 'auto', fontSize: 10.5, color: MUTE }}>
                        {i.type} · {fmtDate(daysBack(i.daysAgo))}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: SUB, lineHeight: 1.5 }}>{i.finding}</div>
                    <div style={{ fontSize: 10.5, color: MUTE, marginTop: 4 }}>
                      {i.by} · open {i.daysAgo} days
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 12.5, color: MUTE }}>Every finding has been closed.</p>
          )}
          <p style={styles.note}>
            A finding stays counted until somebody closes it. The alternative is
            the one the board already has: a note in an email from six months ago.
          </p>
        </Section>
      </div>

      <Toolbar
        search={q}
        onSearch={setQ}
        placeholder="Component, location or type…"
        filters={[
          { label: 'Type', value: type, onChange: setType, options: [...new Set(COMPONENT_VIEW.map((c) => c.typeLabel))] },
          { label: 'Location', value: where, onChange: setWhere, options: [...new Set(COMPONENT_VIEW.map((c) => c.location))] },
          { label: 'Health', value: health, onChange: setHealth, options: ['red', 'amber', 'green'] },
        ]}
        right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{rows.length} of {COMPONENT_VIEW.length}</span>}
      />

      <DataTable
        columns={columns}
        rows={rows}
        pageSize={14}
        empty="No component matches these filters."
        onRowClick={(c) => router.push(`/portal/hospitality/common-areas/${c.componentId}`)}
      />

      <Card style={{ marginTop: 14, background: '#fcfdfe' }}>
        <p style={{ margin: 0, fontSize: 11.5, color: MUTE, lineHeight: 1.6 }}>
          The nine component types, their PM frequencies and their useful lives
          are the reference table from Oxmaint&apos;s own HOA guidance — pool and
          spa, elevators, roofing, asphalt, landscaping and irrigation, common
          HVAC, exterior paint, fire and life safety, and entry gates. Adjust
          them per community for climate, component age and local code.
        </p>
      </Card>
    </div>
  )
}

const styles = {
  dot: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  bandCard: {
    padding: '13px 15px', borderRadius: 11, cursor: 'pointer', userSelect: 'none',
    borderStyle: 'solid', borderWidth: 1,
  },
  bandTrack: { height: 6, background: 'rgba(255,255,255,0.7)', borderRadius: 999, overflow: 'hidden' },
  priority: {
    fontSize: 10.5, fontWeight: 700, color: '#475569', background: '#f1f5f9',
    borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap',
  },
  finding: {
    padding: '10px 12px', borderRadius: 10, background: '#fcfdfe', cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  severity: {
    fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
    borderRadius: 5, padding: '1px 7px', borderStyle: 'solid', borderWidth: 1,
  },
  sevHigh: { color: '#b91c1c', background: '#fef2f2', borderColor: '#fecaca' },
  sevMed: { color: '#b45309', background: '#fffbeb', borderColor: '#fde68a' },
  sevLow: { color: '#475569', background: '#f8fafc', borderColor: '#e2e8f0' },
  note: {
    margin: '14px 0 0', paddingTop: 12, fontSize: 11.5, color: MUTE, lineHeight: 1.6,
    borderTopStyle: 'solid', borderTopWidth: 1, borderTopColor: LINE,
  },
}
