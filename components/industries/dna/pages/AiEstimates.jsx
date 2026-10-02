'use client'

// AI task time estimates against what the job actually took.
//
// This is the item on the customer's list with no equivalent anywhere else in
// the product, and it is also the one most easily oversold. Six of the fifteen
// work orders are complete enough to compare — only a finished job has an actual
// duration — so every accuracy figure on this screen carries its denominator.
//
// "50% exact" over six rows is a true statement and a weak one. Shown without
// the six, it is the number that gets challenged in the room and takes the rest
// of the demo's credibility with it. Shown with it, the honest read is available
// straight away: the model is close on routine work and missed the two jobs
// where the fault turned out to be worse than reported.
//
// Over and under are both amber. An estimate that came in an hour short is the
// same miss in the other direction, and colouring it green would teach a reader
// that under-running is free — it is not, it is a technician idle or a schedule
// built on a number that does not hold.

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Section, DataTable, StatusBadge } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, TwoLine, Variance, Meter, Note, Fact, Bars } from '../components/cells'
import { workOrders, estimated, estimateStats, hrs } from '../lib/data'

export default function AiEstimates() {
  const router = useRouter()

  const pending = workOrders.filter((w) => w.aiEstimateHrs !== null && w.actualHrs === null)
  const noEstimate = workOrders.filter((w) => w.aiEstimateHrs === null)

  // The widest bar on the chart, so estimate and actual share one scale.
  const maxHrs = Math.max(1, ...estimated.flatMap((w) => [w.aiEstimateHrs, w.actualHrs]))

  const byType = useMemo(() => {
    const types = [...new Set(estimated.map((w) => w.type))]
    return types.map((t) => {
      const rows = estimated.filter((w) => w.type === t)
      const err = rows.reduce((s, w) => s + Math.abs(w._variance), 0) / rows.length
      return { name: `${t} (${rows.length})`, value: Number(err.toFixed(2)) }
    }).sort((a, b) => b.value - a.value)
  }, [])

  if (!estimateStats) {
    return (
      <div>
        <PageHeading title="AI Time Estimates" subtitle="Estimated duration against actual." />
        <Note tone="grey">No completed work order carries both an estimate and an actual duration.</Note>
      </div>
    )
  }

  const s = estimateStats

  return (
    <div>
      <PageHeading
        title="AI Time Estimates"
        subtitle="What the model predicted a job would take, against what it took. Every figure here is measured over completed work orders only."
      />

      <StatCards items={[
        { label: 'Comparable jobs', value: `${s.sample} of ${s.ofTotal}`, note: 'Only completed jobs have an actual', icon: 'list' },
        { label: 'Mean absolute error', value: `${s.meanAbsError}`, unit: 'h', tone: s.meanAbsError <= 0.5 ? 'success' : 'warning', note: 'Average miss, either direction' },
        { label: 'Exact', value: `${s.exact} of ${s.sample}`, tone: 'success', note: 'Estimate matched the actual' },
        { label: 'Over / under', value: `${s.over} / ${s.under}`, tone: 'warning', note: 'Ran long / came in short' },
        { label: 'Total bias', value: `${s.biasHrs > 0 ? '+' : ''}${s.biasHrs}`, unit: 'h', note: `${s.totalActual} h actual vs ${s.totalEstimated} h estimated` },
      ]} />

      <Note>
        <b>Read the denominator first.</b> {s.sample} of the {s.ofTotal} work orders in this dataset
        are complete, so that is the whole comparison set. {pending.length} more carry an estimate and
        are still running; {noEstimate.length} carry no estimate at all.
      </Note>

      <Section title="Estimate against actual" right={<span style={{ fontSize: 11.5, color: '#94a3b8' }}>completed jobs, oldest first</span>}>
        <div style={{ display: 'grid', gap: 14 }}>
          {estimated.map((w) => (
            <div
              key={w.woNo}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/portal/dna/work-orders/${w.woNo}`)}
              onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/portal/dna/work-orders/${w.woNo}`) }}
              style={{ padding: '13px 15px', border: '1px solid #e4e9f0', borderRadius: 11, background: '#fff', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <div style={{ display: 'flex', gap: 9, alignItems: 'baseline', minWidth: 0 }}>
                  <Ref>{w.woNo}</Ref>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{w.title}</span>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <StatusBadge tone="grey">{w.type}</StatusBadge>
                  <Variance hours={w._variance} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 58px', gap: 10, alignItems: 'center', marginTop: 11 }}>
                <span style={label}>AI est.</span>
                <Meter value={w.aiEstimateHrs} max={maxHrs} tone="#94a3b8" height={10} />
                <span style={figure}>{hrs(w.aiEstimateHrs)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 58px', gap: 10, alignItems: 'center', marginTop: 6 }}>
                <span style={label}>Actual</span>
                <Meter
                  value={w.actualHrs}
                  max={maxHrs}
                  tone={w._variance === 0 ? '#047857' : '#b45309'}
                  height={10}
                />
                <span style={figure}>{hrs(w.actualHrs)}</span>
              </div>

              {w._variance !== 0 && (
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 9, lineHeight: 1.5 }}>
                  {w.description}
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
        <Section title="Mean error by work type">
          <Bars data={byType} unit=" h" colors={['#b45309', '#15227a', '#64748b']} />
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 10, lineHeight: 1.55 }}>
            Counts in brackets. With one or two jobs per type these are indicative, not a
            per-type accuracy claim.
          </p>
        </Section>

        <Section title="Where the estimates stand">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
            <Fact label="Compared" value={s.sample} sub="Completed, both figures present" />
            <Fact label="Still running" value={pending.length} sub="Estimate set, no actual yet" />
            <Fact label="No estimate" value={noEstimate.length} sub="Nothing to compare" />
          </div>
          <Note tone="grey">
            The two jobs that ran long — the rope dye roller and the effluent pump seal — were both
            corrective work where the fault was worse than the report suggested. That is the
            pattern worth discussing: the model is close on planned work and optimistic on
            faults it cannot see until the machine is open.
          </Note>
        </Section>
      </div>
    </div>
  )
}

const label = { fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#94a3b8' }
const figure = { fontSize: 12, fontWeight: 700, color: '#0f172a', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
