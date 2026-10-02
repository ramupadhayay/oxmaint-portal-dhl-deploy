'use client'

// Screen 2.6 — the accuracy proof, and the one the spec says the client's
// Go/No-Go decision leans on.
//
// Its dev note sets the tone precisely: "even with only 2-3 closed records,
// present this as a running log, not a one-off case study — frame the UI as
// something that accumulates over the 12-month PoC." So the page is a log with
// a running total at the top, and it says plainly how many records that total
// rests on rather than letting two closed jobs pass for a track record.
//
// Only closed records count. A job still under review has no outcome, and
// counting it either way would move a contractual KPI on evidence that does not
// exist yet — which is exactly the sort of number that does not survive the
// meeting where it is questioned.

import { useRouter } from 'next/navigation'
import { Section, StatusBadge, PALETTE } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { MON_REC_ROWS, MON_ACCURACY, monAlertById } from '../lib/monitoring'

const { SUB, MUTE, INK, LINE, GREEN, AMBER, RED, ACCENT } = PALETTE

// The SOW targets these are measured against, and which direction is good.
const TARGETS = [
  {
    key: 'accuracy', label: 'Alert accuracy', target: '~70-80%',
    value: MON_ACCURACY.accuracy, band: [70, 80], good: 'high',
    // The fraction beside the percentage, because "100%" and "1 of 1" are the
    // same fact and only one of them is honest about how much it rests on.
    fraction: `${MON_ACCURACY.truePositives} of ${MON_ACCURACY.closed}`,
    note: 'detections confirmed on inspection',
  },
  {
    key: 'falsePositiveRate', label: 'False positive rate', target: '~10-20%',
    value: MON_ACCURACY.falsePositiveRate, band: [10, 20], good: 'low',
    fraction: `${MON_ACCURACY.falsePositives} of ${MON_ACCURACY.closed}`,
    note: 'detections the inspection did not confirm',
  },
]

export default function Outcomes() {
  const router = useRouter()

  const closed = MON_REC_ROWS.filter((r) => r._closed)
  const pending = MON_REC_ROWS.filter((r) => !r._closed)

  const stats = [
    { label: 'Closed records', value: MON_ACCURACY.closed, note: 'outcome logged by a technician' },
    { label: 'Confirmed', value: MON_ACCURACY.truePositives, tone: 'green', note: 'true positives' },
    { label: 'Not confirmed', value: MON_ACCURACY.falsePositives, tone: MON_ACCURACY.falsePositives ? 'red' : 'green', note: 'false positives' },
    { label: 'Awaiting outcome', value: MON_ACCURACY.pending, tone: 'amber', note: 'not counted either way' },
  ]

  return (
    <div>
      <PageHeading
        title="Outcome Log"
        subtitle="What the analytics predicted against what the technician found. A running record over the PoC, not a case study — every closed detection lands here."
      />

      <StatCards items={stats} />

      <Section title="Against target">
        <div style={styles.targets}>
          {/* `key` pulled out of the spread rather than left in it. React reads
              `key` off the element, not the props, so spreading an object that
              happens to carry one hands the component a prop it must not
              receive — and React logs it as an error in the console. */}
          {TARGETS.map(({ key, ...t }) => <Target key={key} {...t} n={MON_ACCURACY.closed} />)}
        </div>

        {/* The honest caveat, on the screen rather than in a footnote. With
            two closed records each one moves the figure by fifty points, and a
            reader who works that out for themselves trusts the rest less. */}
        <p style={styles.caveat}>
          Computed over {MON_ACCURACY.closed} closed record{MON_ACCURACY.closed === 1 ? '' : 's'}. At this sample size a
          single outcome moves each figure by {MON_ACCURACY.closed ? Math.round(100 / MON_ACCURACY.closed) : 0} points —
          these read as a direction of travel, not a settled rate. The PoC runs for twelve months and this log
          accumulates over all of it.
        </p>
      </Section>

      <Section title={`Log — ${closed.length} closed`}>
        {closed.length ? (
          <div style={styles.log}>
            {closed.map((r) => {
              const alert = monAlertById.get(r.alertId)
              return (
                <div key={r.recId} style={styles.entry}>
                  <div style={styles.entryHead}>
                    <span style={styles.date}>{r.dateClosed || r.dateIssued}</span>
                    <span style={styles.entryAsset}>{r._asset}</span>
                    {alert && <span style={styles.code}>{alert.failureCode}</span>}
                    <StatusBadge tone={r._truePositive ? 'green' : r._falsePositive ? 'red' : 'amber'}>{r.outcome}</StatusBadge>
                  </div>

                  <div style={styles.compare}>
                    <div style={styles.side}>
                      <div style={styles.sideLabel}>Predicted</div>
                      <div style={styles.sideText}>{alert?.description || r.action}</div>
                      {alert && (
                        <div style={styles.sideMeta}>
                          {alert.confidence}% confidence · confirmed by {alert._agreeing} of 3 sensors
                        </div>
                      )}
                    </div>
                    <div style={styles.arrow}>→</div>
                    <div style={styles.side}>
                      <div style={styles.sideLabel}>Technician found</div>
                      <div style={styles.sideText}>{r._finding}</div>
                      <div style={styles.sideMeta}>{r.workOrderId} · {r.woStatus}</div>
                    </div>
                  </div>

                  <button onClick={() => router.push(`/portal/datacenter/detections/${encodeURIComponent(r.alertId)}`)} style={styles.link}>
                    Open the detection →
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <p style={styles.empty}>No detection has been closed out yet.</p>
        )}
      </Section>

      {pending.length > 0 && (
        <Section title={`Open — ${pending.length} awaiting an outcome`}>
          <p style={styles.pendingNote}>
            These are excluded from the figures above until a technician logs what they found.
          </p>
          <div style={styles.log}>
            {pending.map((r) => (
              <div key={r.recId} style={{ ...styles.entry, background: '#fcfdfe' }}>
                <div style={styles.entryHead}>
                  <span style={styles.date}>{r.dateIssued}</span>
                  <span style={styles.entryAsset}>{r._asset}</span>
                  <StatusBadge tone="amber">{r.woStatus}</StatusBadge>
                </div>
                <div style={styles.sideText}>{r.action}</div>
                <button onClick={() => router.push(`/portal/datacenter/detections/${encodeURIComponent(r.alertId)}`)} style={styles.link}>
                  Open the detection →
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function Target({ label, target, value, band, good, note, fraction, n }) {
  const [lo, hi] = band
  const on = value != null && (good === 'high' ? value >= lo : value <= hi)
  const tone = value == null ? MUTE : on ? GREEN : AMBER

  // The target is a range, so it is drawn as one — a single line would say the
  // client asked for a number they did not ask for.
  const scaleMax = 100
  const left = (lo / scaleMax) * 100
  const width = ((hi - lo) / scaleMax) * 100

  return (
    <div style={styles.target}>
      <div style={styles.targetHead}>
        <span style={styles.targetLabel}>{label}</span>
        <StatusBadge tone={value == null ? 'grey' : on ? 'green' : 'amber'}>
          {value == null ? 'No data' : on ? 'Within target' : 'Outside target'}
        </StatusBadge>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 8 }}>
        <span style={{ ...styles.targetValue, color: tone }}>{value == null ? '—' : `${value}%`}</span>
        {fraction && <span style={styles.targetFraction}>{fraction}</span>}
        <span style={styles.targetTarget}>target {target}</span>
      </div>

      <div style={styles.scale}>
        <div style={{ ...styles.scaleBand, left: `${left}%`, width: `${width}%` }} />
        {value != null && (
          <div style={{ ...styles.scaleMark, left: `${Math.min(100, Math.max(0, value))}%`, background: tone }} />
        )}
      </div>
      <div style={styles.scaleEnds}><span>0%</span><span>100%</span></div>

      <div style={styles.targetNote}>{note} · over {n} closed record{n === 1 ? '' : 's'}</div>
    </div>
  )
}

const styles = {
  targets: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 },
  target: { border: `1px solid ${LINE}`, borderRadius: 12, padding: 16, background: '#fff' },
  targetHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  targetLabel: { fontSize: 13.5, fontWeight: 700, color: INK },
  targetValue: { fontSize: 32, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' },
  targetFraction: { fontSize: 13, fontWeight: 700, color: SUB },
  targetTarget: { fontSize: 12, color: MUTE },
  scale: { position: 'relative', height: 8, borderRadius: 999, background: '#eef2f7', marginTop: 14 },
  scaleBand: { position: 'absolute', top: 0, bottom: 0, background: 'rgba(22,163,74,0.22)', borderRadius: 999 },
  scaleMark: { position: 'absolute', top: -3, width: 3, height: 14, borderRadius: 2, transform: 'translateX(-1.5px)' },
  scaleEnds: { display: 'flex', justifyContent: 'space-between', fontSize: 10, color: MUTE, marginTop: 5 },
  targetNote: { fontSize: 11.5, color: MUTE, marginTop: 10, lineHeight: 1.45 },

  caveat: { margin: '16px 0 0', fontSize: 12, color: SUB, lineHeight: 1.6, maxWidth: 720 },

  log: { display: 'grid', gap: 12 },
  entry: { border: `1px solid ${LINE}`, borderRadius: 12, padding: '14px 16px', background: '#fff' },
  entryHead: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  date: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5, color: MUTE },
  entryAsset: { fontSize: 14, fontWeight: 700, color: INK },
  code: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, fontWeight: 700, color: ACCENT, background: '#eef2ff', borderRadius: 5, padding: '2px 6px' },

  compare: { display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 12 },
  side: { flex: '1 1 240px', minWidth: 0 },
  sideLabel: { fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 },
  sideText: { fontSize: 12.5, color: INK, marginTop: 5, lineHeight: 1.55 },
  sideMeta: { fontSize: 11.5, color: MUTE, marginTop: 5 },
  arrow: { fontSize: 16, color: MUTE, paddingTop: 18 },

  link: {
    display: 'inline-block', marginTop: 12,
    padding: '5px 11px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
    background: '#fff', border: `1px solid ${ACCENT}33`, color: ACCENT, borderRadius: 7, cursor: 'pointer',
  },
  pendingNote: { margin: '-4px 0 14px', fontSize: 12.5, color: MUTE, lineHeight: 1.5 },
  empty: { fontSize: 12.5, color: MUTE, margin: 0 },
}
