'use client'

// One common area component.
//
// The article's test for this page is a specific question: "when was the pool
// heater last serviced?" and "what was the last inspection finding on Building
// C's roof?" — answered in ten seconds rather than a ten-email thread. So the
// service history and the findings are on the page, not a link away from it.
//
// The other half is the reserve position for this one component, because a
// board looking at a failing pool heater immediately asks the second question:
// what does replacing it cost, and is it funded. Those numbers are the same
// ones the forecast is built from, so the page cannot disagree with the chart.

import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Card, Section, Fields, PALETTE,
} from '../lib/kit'
import { COMMUNITY, INSPECTIONS, PM_PLAN, VENDORS, COMPONENT_TYPES } from '../lib/community'
import {
  COMPONENT_VIEW, POSITION, INFLATION, THIS_YEAR, money, pct,
} from '../lib/reserve'
import { fmtDate } from '../lib/data'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

const CONDITION = {
  1: { label: 'Failing', colour: '#b91c1c', tint: '#fef2f2', edge: '#fecaca' },
  2: { label: 'Poor', colour: '#c2410c', tint: '#fff7ed', edge: '#fed7aa' },
  3: { label: 'Fair', colour: '#b45309', tint: '#fffbeb', edge: '#fde68a' },
  4: { label: 'Good', colour: '#047857', tint: '#f0fdf4', edge: '#bbf7d0' },
  5: { label: 'Excellent', colour: '#047857', tint: '#f0fdf4', edge: '#bbf7d0' },
}

const daysBack = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)

export default function ComponentView({ id }) {
  const router = useRouter()
  const c = COMPONENT_VIEW.find((x) => x.componentId === id)

  if (!c) {
    return (
      <Card style={{ maxWidth: 560 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: INK }}>No component with that reference</h1>
        <p style={{ margin: '8px 0 16px', fontSize: 13.5, color: SUB, lineHeight: 1.6 }}>
          {id} is not on the common area register.
        </p>
        <button onClick={() => router.push('/portal/hospitality/common-areas')} style={{ ...styles.link, padding: '8px 14px' }}>
          Back to common areas
        </button>
      </Card>
    )
  }

  const cond = CONDITION[c.condition] || CONDITION[3]
  const type = COMPONENT_TYPES[c.type] || {}
  const findings = INSPECTIONS.filter((i) => i.componentId === c.componentId)
    .sort((a, b) => a.daysAgo - b.daysAgo)
  const plans = PM_PLAN.filter((p) => p.components.includes(c.componentId))
  const lifeUsed = Math.min(1, c.age / c.usefulLife)
  const shareOfReserve = POSITION.replacementTotal ? c.replacementCost / POSITION.replacementTotal : 0

  return (
    <div>
      <PageHeading
        back={{ label: 'Common areas', onClick: () => router.push('/portal/hospitality/common-areas') }}
        title={c.name}
        subtitle={`${COMMUNITY.short} · ${c.location} · ${c.typeLabel} · installed ${c.installed}`}
        right={(
          <span style={{ ...styles.condChip, color: cond.colour, background: cond.tint, borderColor: cond.edge }}>
            {cond.label} — {c.condition} of 5
          </span>
        )}
      />

      <StatCards items={[
        { label: 'Condition', value: cond.label, icon: c.condition <= 2 ? 'alert' : 'tick', tone: c.condition <= 2 ? 'red' : c.condition === 3 ? 'amber' : 'green', note: `scored ${c.condition} of 5` },
        { label: 'Age', value: `${c.age} yr`, icon: 'clock', note: `of a ${c.usefulLife}-year life` },
        { label: 'Remaining life', value: c.overdue ? 'Past due' : `${c.remaining} yr`, icon: 'list', tone: c.overdue ? 'red' : c.remaining <= 3 ? 'amber' : 'green', note: `replacement due ${c.dueYear}` },
        { label: 'Replacement cost', value: money(c.replacementCost), icon: 'chart', note: `${money(c.futureCost)} when due` },
        { label: 'Last serviced', value: fmtDate(c.lastService), icon: 'wrench', note: plans.length ? `${plans.length} PM plans cover it` : 'no PM plan covers it' },
      ]} />

      {c.note && (
        <Card style={{ marginBottom: 14, borderColor: cond.edge, background: cond.tint }}>
          <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={cond.colour} strokeWidth="2.2"
              strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
            <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.65 }}>{c.note}</p>
          </div>
        </Card>
      )}

      {/* ── life used ──────────────────────────────────────────────────── */}
      <Section title="Where it is in its life">
        <div style={styles.lifeTrack}>
          <div style={{
            width: `${lifeUsed * 100}%`, height: '100%', borderRadius: 999,
            background: c.overdue ? '#dc2626' : c.remaining <= 3 ? '#d97706' : ACCENT,
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: MUTE, marginTop: 7 }}>
          <span>Installed {c.installed}</span>
          <span style={{ fontWeight: 700, color: INK }}>{pct(lifeUsed)} of its life used</span>
          <span>Due {c.dueYear}</span>
        </div>
        <p style={styles.note}>
          Of its {money(c.replacementCost)} replacement cost,{' '}
          <strong style={{ color: INK }}>{money(c.accrued)}</strong> should already be sitting in the
          reserve account for it. It needs <strong style={{ color: INK }}>{money(c.annualShare)}</strong> a
          year to fund itself over its life, which is {pct(c.annualShare / POSITION.annualRequirement)} of
          the association&apos;s whole annual requirement.
        </p>
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14, marginBottom: 14 }}>
        <Section title="The component" style={{ marginBottom: 0 }}>
          <Fields columns={2} rows={[
            ['Reference', c.componentId],
            ['Type', c.typeLabel],
            ['Location', c.location],
            ['Installed', String(c.installed)],
            ['Useful life', `${c.usefulLife} years`],
            ['Replacement due', String(c.dueYear)],
            ['Reserve priority', c.priority],
            ['Share of the estate', pct(shareOfReserve)],
          ]} />
        </Section>

        <Section
          title="Reserve position"
          style={{ marginBottom: 0 }}
          right={(
            <button onClick={() => router.push('/portal/hospitality/reserve')} style={styles.link}>
              Open the forecast
            </button>
          )}
        >
          <Fields columns={2} rows={[
            ['Cost today', money(c.replacementCost)],
            ['Cost when due', money(c.futureCost)],
            ['Accrued to date', money(c.accrued)],
            ['Annual share', money(c.annualShare)],
            ['Inflation applied', `${INFLATION * 100}% a year`],
            ['Years to replacement', c.overdue ? 'past due' : String(c.dueYear - THIS_YEAR)],
          ]} />
          <p style={styles.note}>
            These are the same numbers the {COMMUNITY.short} forecast is built
            from, so this page and the chart cannot disagree.
          </p>
        </Section>
      </div>

      {/* ── the maintenance that keeps it alive ────────────────────────── */}
      <Section title={`Maintenance plans (${plans.length})`}>
        {plans.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {plans.map((p) => {
              const vendor = VENDORS.find((v) => v.vendorId === p.vendor)
              return (
                <div key={p.planId} style={styles.planRow}
                  onClick={() => router.push('/portal/hospitality/vendor-pm')}>
                  <span style={{ minWidth: 0, flex: '1 1 200px' }}>
                    <strong style={{ fontSize: 12, color: INK }}>{p.title}</strong>
                    <span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{p.planId} · {p.season}</span>
                  </span>
                  <span style={styles.freq}>{p.every}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11.5, color: SUB, whiteSpace: 'nowrap' }}>
                    {vendor ? vendor.name : 'In-house'}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 12.5, color: '#b45309', lineHeight: 1.6 }}>
            No recurring plan covers this component. It is being maintained
            reactively, which is how a deferred seal coat becomes a repave.
          </p>
        )}
        <p style={styles.note}>
          The reference frequency for {c.typeLabel.toLowerCase()} is{' '}
          <strong style={{ color: INK }}>{type.pm}</strong> — {type.tasks}
        </p>
      </Section>

      {/* ── what inspections found ─────────────────────────────────────── */}
      <Section title={`Inspection and service history (${findings.length})`}>
        {findings.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {findings.map((i) => (
              <div key={i.inspectionId} style={{
                ...styles.finding,
                borderColor: i.status === 'Closed' ? LINE : i.severity === 'High' ? '#fecaca' : '#fde68a',
                background: i.status === 'Closed' ? '#fcfdfe' : i.severity === 'High' ? '#fef7f7' : '#fffbf5',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                  <span style={{
                    ...styles.status,
                    color: i.status === 'Closed' ? '#047857' : i.status === 'In progress' ? '#2563eb' : '#b45309',
                    borderColor: i.status === 'Closed' ? '#bbf7d0' : i.status === 'In progress' ? '#bfdbfe' : '#fde68a',
                  }}>{i.status}</span>
                  <strong style={{ fontSize: 12, color: INK }}>{i.type}</strong>
                  <span style={{ marginLeft: 'auto', fontSize: 10.5, color: MUTE }}>
                    {i.by} · {fmtDate(daysBack(i.daysAgo))}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: SUB, lineHeight: 1.6 }}>{i.finding}</div>
                {i.status !== 'Closed' && (
                  <div style={{ fontSize: 10.5, color: '#b45309', marginTop: 5, fontWeight: 600 }}>
                    Open {i.daysAgo} days
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 12.5, color: MUTE, lineHeight: 1.6 }}>
            Nothing recorded against this component yet beyond its last service
            on {fmtDate(c.lastService)}.
          </p>
        )}
        <p style={styles.note}>
          This is the record that answers a homeowner asking why a repair was
          deferred, and the one a board needs when a contractor asks for the
          maintenance history.
        </p>
      </Section>
    </div>
  )
}

const styles = {
  condChip: {
    fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: '4px 12px',
    borderStyle: 'solid', borderWidth: 1, whiteSpace: 'nowrap',
  },
  lifeTrack: { height: 12, background: '#eef1f5', borderRadius: 999, overflow: 'hidden' },
  planRow: {
    display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap', cursor: 'pointer',
    padding: '9px 12px', borderRadius: 9, background: '#fcfdfe',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  freq: {
    fontSize: 10.5, fontWeight: 700, color: '#475569', background: '#f1f5f9',
    borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap',
  },
  finding: { padding: '11px 13px', borderRadius: 10, borderStyle: 'solid', borderWidth: 1 },
  status: {
    fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
    background: '#fff', borderRadius: 5, padding: '1px 7px',
    borderStyle: 'solid', borderWidth: 1,
  },
  link: {
    padding: '5px 11px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
    borderRadius: 7, background: '#fff', color: ACCENT, cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  note: {
    margin: '14px 0 0', paddingTop: 12, fontSize: 11.5, color: MUTE, lineHeight: 1.6,
    borderTopStyle: 'solid', borderTopWidth: 1, borderTopColor: LINE,
  },
}
