'use client'

// The landing screen.
//
// Ordered by what someone opening this at seven in the morning needs, which is
// not a chart. Today's shift first — the department's actual plan — then whether
// the rotation is keeping up, then the backlog and the estate behind both.
//
// The compliance tile is deliberately loud when something due today has not
// been logged. Everything else on this page can slip a day; that one cannot.

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Section, Card, Donut, HBars, StatusBadge, PALETTE,
} from '../lib/kit'
import { useRecords } from '../lib/store'
import {
  ORG, SUITES, SUITE_COUNT, ASSETS, WORK_ORDERS, OPEN_STATUS, ROUNDS,
  fmtDate, isPast,
} from '../lib/data'
import { ROTATION, TODAY_SCHEDULE, roundDueToday } from '../lib/schedule'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, RED } = PALETTE

const hhmm = (m) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`

export default function Overview() {
  const router = useRouter()
  const go = (s) => router.push(`/portal/hospitality/${s}`)

  const logs = useRecords('hosp_compliance_log', [], (r) => r.recordId)
  const loggedToday = useMemo(() => {
    const t = new Date().toISOString().slice(0, 10)
    return new Set(logs.filter((l) => l.date === t).map((l) => l.round_key))
  }, [logs])

  const complianceDue = ROUNDS.filter((r) => r.compliance && roundDueToday(r))
  const complianceGap = complianceDue.filter((r) => !loggedToday.has(r.key)).length

  const live = WORK_ORDERS.filter((w) => OPEN_STATUS.includes(w.status))
  const overdue = live.filter((w) => isPast(w.due_date))
  const down = ASSETS.filter((a) => a.status === 'Down')

  const woMix = ['Open', 'In Progress', 'On Hold'].map((s) => ({
    name: s, value: WORK_ORDERS.filter((w) => w.status === s).length,
  })).filter((d) => d.value)

  const byLocation = useMemo(() => {
    const m = {}
    live.forEach((w) => { m[w.location_name] = (m[w.location_name] || 0) + 1 })
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6)
  }, [live])

  return (
    <div>
      <PageHeading
        title="Overview"
        subtitle={`${ORG.organization_name} · ${SUITE_COUNT} suites · ${ORG.city}, ${ORG.country === 'United States' ? 'DE' : ORG.country}`}
      />

      <StatCards items={[
        { label: "Today's shift", value: hhmm(TODAY_SCHEDULE.totalMinutes), note: `${TODAY_SCHEDULE.itemCount} items`, tone: TODAY_SCHEDULE.fits ? undefined : 'red' },
        { label: 'Open work orders', value: live.length, note: `${overdue.length} overdue`, tone: overdue.length ? 'amber' : undefined },
        { label: 'Rotation', value: `${ROTATION.done}/${ROTATION.total}`, note: `day ${ROTATION.cyclePosition} of ${ROTATION.cycleDays}`, tone: ROTATION.done >= ROTATION.expected ? 'green' : 'amber' },
        {
          label: 'Compliance',
          value: complianceGap || 'Clear',
          tone: complianceGap ? 'red' : 'green',
          note: complianceGap ? 'due today, not logged' : 'today is logged',
        },
      ]} />

      <Section
        title="Today"
        right={<LinkBtn onClick={() => go('daily-schedule')}>Open the schedule →</LinkBtn>}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13, color: SUB }}>
            {fmtDate(TODAY_SCHEDULE.date)} · {TODAY_SCHEDULE.technician?.name || 'Unassigned'}
          </span>
          <span style={{ fontSize: 12, color: TODAY_SCHEDULE.fits ? SUB : RED, fontWeight: TODAY_SCHEDULE.fits ? 500 : 700 }}>
            {TODAY_SCHEDULE.fits
              ? `${hhmm(TODAY_SCHEDULE.shiftMinutes - TODAY_SCHEDULE.totalMinutes)} spare`
              : `${hhmm(TODAY_SCHEDULE.totalMinutes - TODAY_SCHEDULE.shiftMinutes)} over`}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          {TODAY_SCHEDULE.groups.map((g) => (
            <div key={g.key} style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: '11px 13px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 }}>{g.title}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: INK, marginTop: 4 }}>{g.items.length}</div>
              <div style={{ fontSize: 11, color: MUTE }}>
                {hhmm(g.items.reduce((n, i) => n + i.minutes, 0))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {complianceGap > 0 && (
        <Card style={{ marginBottom: 14, borderColor: '#fecaca', background: '#fff7f7' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusBadge tone="red">{complianceGap} not logged</StatusBadge>
            <span style={{ fontSize: 12.5, color: '#b91c1c', flex: '1 1 260px' }}>
              {complianceDue.filter((r) => !loggedToday.has(r.key)).map((r) => r.label).join(' · ')}
            </span>
            <LinkBtn onClick={() => go('compliance')}>Log it →</LinkBtn>
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
        <Section
          title="Suite rotation"
          right={<LinkBtn onClick={() => go('suite-rotation')}>Board →</LinkBtn>}
        >
          <div style={{ position: 'relative', height: 14, background: '#f1f5f9', borderRadius: 999, marginBottom: 9 }}>
            <div style={{ position: 'absolute', inset: 0, width: `${(ROTATION.done / ROTATION.total) * 100}%`, background: GREEN, borderRadius: 999 }} />
            <div style={{ position: 'absolute', top: -4, bottom: -4, left: `${(ROTATION.expected / ROTATION.total) * 100}%`, width: 2, background: INK, borderRadius: 2 }} />
          </div>
          <p style={{ margin: 0, fontSize: 12, color: SUB, lineHeight: 1.55 }}>
            {ROTATION.done} of {ROTATION.total} done this cycle; the plan says {ROTATION.expected} by
            day {ROTATION.cyclePosition}. {ROTATION.overdue
              ? `${ROTATION.overdue} suite${ROTATION.overdue === 1 ? '' : 's'} slipped and ${ROTATION.overdue === 1 ? 'is' : 'are'} carried on the schedule.`
              : 'Nothing has slipped.'}
          </p>
        </Section>

        <Section title="Open work" right={<LinkBtn onClick={() => go('work-orders')}>All →</LinkBtn>}>
          {woMix.length ? <Donut data={woMix} size={140} thickness={22} /> : <p style={{ margin: 0, fontSize: 12.5, color: MUTE }}>Nothing open.</p>}
        </Section>

        <Section title="Where the work is" right={<span style={{ fontSize: 11.5, color: MUTE }}>Open jobs by location</span>}>
          {byLocation.length ? <HBars data={byLocation} /> : <p style={{ margin: 0, fontSize: 12.5, color: MUTE }}>Nothing open.</p>}
        </Section>

        <Section title="Estate" right={<LinkBtn onClick={() => go('assets')}>Assets →</LinkBtn>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 12.5 }}>
            <Row label="Assets tracked" value={ASSETS.length} />
            <Row label="In the suites" value={ASSETS.filter((a) => a.in_suite).length} />
            <Row label="Plant" value={ASSETS.filter((a) => !a.in_suite).length} />
            <Row label="Down" value={down.length} tone={down.length ? RED : GREEN} />
            <Row label="Suites occupied" value={`${SUITES.filter((s) => s.occupied).length} / ${SUITE_COUNT}`} />
          </div>
        </Section>
      </div>

      <Card style={{ marginTop: 14 }}>
        <p style={{ margin: 0, fontSize: 11.5, color: MUTE, lineHeight: 1.55 }}>
          Modelled from the property&rsquo;s public details and industry-standard maintenance
          intervals. It is a faithful picture of how a 98-suite extended-stay hotel runs,
          not a copy of this one&rsquo;s records.
        </p>
      </Card>
    </div>
  )
}

function Row({ label, value, tone }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ color: SUB }}>{label}</span>
      <span style={{ fontWeight: 700, color: tone || INK }}>{value}</span>
    </div>
  )
}

function LinkBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
      fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, color: ACCENT,
    }}>{children}</button>
  )
}
