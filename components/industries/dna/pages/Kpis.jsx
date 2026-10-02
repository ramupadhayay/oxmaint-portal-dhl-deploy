'use client'

// Dashboard > KPIs — the organisation scorecard.
//
// Overview answers "what needs doing today" and Reports answers "how does the
// work break down". This screen answers the third question, which is the one a
// plant manager actually opens a CMMS for: are the numbers moving the right way.
//
// Every card carries how it is calculated, in words, underneath it. That is not
// decoration — a KPI whose formula is not visible is a number people argue about
// rather than act on, and half the value of putting these on a screen is ending
// the argument about what "PM compliance" counts.
//
// Two of them carry a sample size instead of a target, for the same reason the AI
// screen does: MTTR over a handful of repairs and estimate accuracy over six jobs
// are arithmetic, not trends. They are shown because a maintenance manager will
// ask for them, and labelled so nobody leaves the room quoting one as a result.

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Section, StatusBadge } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { Note, Meter, Fact, Bars } from '../components/cells'
import { useDept } from '../lib/deptStore'
import {
  workOrders, assets, pmSchedules, overduePM, pmCompliance, parts,
  partsBelowReorder, inventoryValue, downtimeHours, unplannedHours,
  estimateStats, mttr, users, unassignedWork, money, hrs,
} from '../lib/data'

export default function Kpis() {
  const router = useRouter()
  const { deptName } = useDept()

  const k = useMemo(() => {
    const open = workOrders.filter((w) => w._open)
    const completed = workOrders.filter((w) => w.status === 'Completed')
    const overdue = workOrders.filter((w) => w._overdue)
    const running = assets.filter((a) => a.status === 'Running')
    const down = assets.filter((a) => a.status === 'Down')
    const planned = workOrders.filter((w) => ['Preventive', 'Inspection'].includes(w.type))
    const covered = assets.filter((a) => a._pmCount > 0)
    return {
      availability: assets.length ? Math.round((running.length / assets.length) * 100) : null,
      down: down.length,
      completion: workOrders.length ? Math.round((completed.length / workOrders.length) * 100) : null,
      overdueShare: open.length ? Math.round((overdue.length / open.length) * 100) : 0,
      plannedShare: workOrders.length ? Math.round((planned.length / workOrders.length) * 100) : null,
      pmCoverage: assets.length ? Math.round((covered.length / assets.length) * 100) : null,
      unplannedShare: downtimeHours ? Math.round((unplannedHours / downtimeHours) * 100) : 0,
      wrench: Number(completed.reduce((s, w) => s + (w.actualHrs || 0), 0).toFixed(1)),
      backlogHours: Number(open.reduce((s, w) => s + (w.aiEstimateHrs || 0), 0).toFixed(1)),
      stockCover: parts.length ? Math.round(((parts.length - partsBelowReorder.length) / parts.length) * 100) : null,
      open, completed, overdue, down, covered,
    }
  }, [])

  // Each entry is a card. `target` is only set where a number can honestly be
  // judged against one; the rest carry their sample instead.
  const CARDS = [
    {
      label: 'Asset availability', value: `${k.availability}%`,
      how: 'Assets running, over all assets on the register.',
      detail: `${assets.length - k.down} of ${assets.length} running · ${k.down} down`,
      pct: k.availability, good: k.availability >= 90,
    },
    {
      label: 'PM compliance', value: `${pmCompliance}%`,
      how: 'Schedules not past their next-due date, over all schedules.',
      detail: `${pmSchedules.length - overduePM.length} of ${pmSchedules.length} in date`,
      pct: pmCompliance, good: pmCompliance >= 90,
      to: 'pm-schedules',
    },
    {
      label: 'PM coverage', value: `${k.pmCoverage}%`,
      how: 'Assets carrying at least one PM schedule, over all assets.',
      detail: `${k.covered.length} of ${assets.length} assets scheduled`,
      pct: k.pmCoverage, good: k.pmCoverage >= 70,
      to: 'assets',
    },
    {
      label: 'Work order completion', value: `${k.completion}%`,
      how: 'Completed work orders, over all work orders in the period.',
      detail: `${k.completed.length} of ${workOrders.length} closed`,
      pct: k.completion, good: k.completion >= 40,
      to: 'work-orders',
    },
    {
      label: 'Planned vs reactive', value: `${k.plannedShare}%`,
      how: 'Preventive and inspection work, over all work orders.',
      detail: 'A mill running mostly reactive work is one where the schedule is not holding.',
      pct: k.plannedShare, good: k.plannedShare >= 50,
      to: 'reports',
    },
    {
      label: 'Overdue share of backlog', value: `${k.overdueShare}%`,
      how: 'Open work past its due date, over all open work.',
      detail: `${k.overdue.length} of ${k.open.length} open jobs are late`,
      pct: k.overdueShare, good: k.overdueShare <= 20, invert: true,
      to: 'work-orders',
    },
    {
      label: 'Unplanned downtime', value: `${k.unplannedShare}%`,
      how: 'Unplanned hours, over all downtime hours logged.',
      detail: `${unplannedHours} h unplanned of ${downtimeHours} h total`,
      pct: k.unplannedShare, good: k.unplannedShare <= 50, invert: true,
      to: 'downtime',
    },
    {
      label: 'Stock coverage', value: `${k.stockCover}%`,
      how: 'Catalogue lines above their reorder point, over all lines.',
      detail: `${partsBelowReorder.length} line${partsBelowReorder.length === 1 ? '' : 's'} below · ${money(inventoryValue)} held`,
      pct: k.stockCover, good: partsBelowReorder.length === 0,
      to: 'demand-parts',
    },
  ]

  return (
    <div>
      <PageHeading
        title="KPIs"
        subtitle={`The organisation scorecard, with how every figure is calculated. ${deptName}.`}
      />

      <Note>
        Each card shows its own formula. A KPI whose calculation is not visible is a number
        people argue about instead of acting on — and on a demo dataset it is also the number a
        prospect is most likely to challenge.
      </Note>

      <Section title="Scorecard">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 12 }}>
          {CARDS.map((c) => (
            <div
              key={c.label}
              role={c.to ? 'button' : undefined}
              tabIndex={c.to ? 0 : undefined}
              onClick={c.to ? () => router.push(`/portal/dna/${c.to}`) : undefined}
              onKeyDown={c.to ? (e) => { if (e.key === 'Enter') router.push(`/portal/dna/${c.to}`) } : undefined}
              style={{
                padding: '15px 17px', border: '1px solid #e4e9f0',
                borderLeft: `3px solid ${c.good ? '#047857' : '#b45309'}`,
                borderRadius: 12, background: '#fff', cursor: c.to ? 'pointer' : 'default',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#475569' }}>{c.label}</span>
                <StatusBadge tone={c.good ? 'green' : 'amber'}>{c.good ? 'On track' : 'Watch'}</StatusBadge>
              </div>

              <div style={{ fontSize: 28, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', marginTop: 8, lineHeight: 1 }}>
                {c.value}
              </div>

              <div style={{ marginTop: 10 }}>
                <Meter value={c.pct} max={100} tone={c.good ? '#047857' : '#b45309'} height={7} />
              </div>

              <div style={{ fontSize: 11.5, color: '#334155', marginTop: 9, lineHeight: 1.5 }}>{c.detail}</div>
              <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 6, lineHeight: 1.5, fontStyle: 'italic' }}>{c.how}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Measured, but on a small sample" right={<span style={{ fontSize: 11.5, color: '#94a3b8' }}>read the denominator</span>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10 }}>
          {mttr && (
            <Fact
              label="Mean time to repair"
              value={hrs(mttr.hours)}
              sub={`Over ${mttr.sample} completed corrective and emergency jobs. Meaningful once months of history are behind it, not a fortnight.`}
            />
          )}
          {estimateStats && (
            <>
              <Fact
                label="AI estimate accuracy"
                value={`${estimateStats.exact} of ${estimateStats.sample} exact`}
                sub={`Mean absolute error ${estimateStats.meanAbsError} h. Only completed jobs carry an actual duration.`}
              />
              <Fact
                label="Estimate bias"
                value={`${estimateStats.biasHrs > 0 ? '+' : ''}${estimateStats.biasHrs} h`}
                sub={`${estimateStats.totalActual} h actual against ${estimateStats.totalEstimated} h estimated across the sample.`}
              />
            </>
          )}
          <Fact
            label="Wrench hours booked"
            value={hrs(k.wrench)}
            sub={`Actual time on ${k.completed.length} completed jobs. Labour is not costed — no hourly rate in the source.`}
          />
          <Fact
            label="Open backlog"
            value={hrs(k.backlogHours)}
            sub={`${k.open.length} open jobs, ${unassignedWork.length} of them with no owner yet.`}
          />
        </div>
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14 }}>
        <Section title="Asset status">
          <Bars
            data={[...new Set(assets.map((a) => a.status))].map((s) => ({ name: s, value: assets.filter((a) => a.status === s).length })).sort((a, b) => b.value - a.value)}
            colors={['#047857', '#15227a', '#b91c1c']}
          />
        </Section>
        <Section title="Backlog by team">
          <Bars
            unit=" h"
            data={[...new Set(users.map((u) => u.team))].map((t) => ({
              name: t,
              value: Number(users.filter((u) => u.team === t).reduce((s, u) => s + u._openHours, 0).toFixed(1)),
            })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value)}
          />
        </Section>
      </div>
    </div>
  )
}
