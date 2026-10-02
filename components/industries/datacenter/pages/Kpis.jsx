'use client'

// The SOW Section 8 KPIs, on the product's dashboard furniture.
//
// This screen used to be a grid of plain bordered boxes — an id chip, a title,
// a number, a bar. Next to Oxmaint's own KPI dashboard it read as a different
// and much plainer product. It now uses the same metric card the product does,
// and the same shape of page: cards across the top, then charted breakdowns
// under section headings that say what they are.
//
// The values are still carried from the workbook rather than recomputed. The
// workbook computes them with its own formulas and the client reads those
// numbers; recalculating would eventually disagree with their copy by a
// rounding, and on a contractual KPI that is a defect.
//
// No card here claims a month-on-month trend. The product's dashboard shows
// "+5.2% vs last month" because it has last month; this PoC has one workbook
// and no previous period, and inventing a delta under a number that has never
// moved would undermine every real figure beside it. Where there is something
// honest to say — the target, what it was computed from — that is what the
// footer line says instead.

import { Section, StatusBadge, Donut, HBars, PALETTE } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import MetricCard, { MetricGrid } from '../components/MetricCard'
import { KPI_ROWS, WEEKLY_HEALTH, ALERT_ROWS, ASSETS_IN_SCOPE } from '../lib/data'

const { SUB, MUTE, INK, LINE, GREEN, AMBER, RED, ACCENT } = PALETTE

// One glyph per KPI group, so a card is recognisable before it is read.
const ICONS = {
  availability: <><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></>,
  accuracy: <><path d="m9 11 3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
  alert: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  gauge: <><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /><path d="M13.4 10.6 19 5" /><path d="M20.5 16a9 9 0 1 0-17 0" /></>,
}

const glyph = (name) => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {ICONS[name] || ICONS.gauge}
  </svg>
)

// Which glyph and which colour a KPI wears, by what it measures.
function faceOf(k) {
  const s = `${k.kpiId} ${k.kpi}`.toLowerCase()
  if (/false positive/.test(s)) return ['alert', k._favourable ? 'success' : 'destructive']
  if (/accuracy|validat/.test(s)) return ['accuracy', k._favourable ? 'success' : 'warning']
  if (/availab|reliab|uptime/.test(s)) return ['availability', k._favourable ? 'success' : 'warning']
  if (/time|response|lead/.test(s)) return ['clock', k._favourable ? 'success' : 'warning']
  return ['gauge', k._favourable ? 'success' : 'warning']
}

export default function Kpis() {
  const technical = KPI_ROWS.filter((k) => k.group === 'Technical')
  const operational = KPI_ROWS.filter((k) => k.group === 'Operational')
  const favourable = KPI_ROWS.filter((k) => k._favourable).length
  const latest = WEEKLY_HEALTH[WEEKLY_HEALTH.length - 1]

  const pct = (v) => (v == null ? '—' : `${Math.round(Number(v) * 1000) / 10}`)

  // The reporting record: what the weekly health log has actually recorded.
  const headline = [
    {
      title: 'Sensor availability', value: pct(latest?.sensorAvailability), unit: '%',
      icon: glyph('availability'), variant: 'success',
      note: `Week ending ${latest?.weekEnding || '—'}`,
    },
    {
      title: 'Data acquisition reliability', value: pct(latest?.dataReliability), unit: '%',
      icon: glyph('gauge'), variant: 'success',
      note: 'Target ~90-100%',
    },
    {
      title: 'Dashboard availability', value: pct(latest?.dashboardAvailability), unit: '%',
      icon: glyph('clock'), variant: 'success',
      note: 'Target ~90-100%',
    },
    {
      title: 'KPIs at or better than target', value: `${favourable}`, unit: `of ${KPI_ROWS.length}`,
      icon: glyph('accuracy'), variant: favourable === KPI_ROWS.length ? 'success' : 'warning',
      note: `${technical.length} technical · ${operational.length} operational`,
    },
  ]

  // Where the alerts landed, which is what the accuracy KPIs are computed over.
  const classification = ['True Positive', 'False Positive', 'Pending']
    .map((name) => ({ name, value: ALERT_ROWS.filter((a) => a.classification === name).length }))
    .filter((d) => d.value)

  // Coverage by category — the estate the KPIs are measured across.
  const byCategory = [...new Set(ASSETS_IN_SCOPE.map((a) => a._category).filter(Boolean))]
    .map((name) => ({ name, value: ASSETS_IN_SCOPE.filter((a) => a._category === name).length }))
    .sort((a, b) => b.value - a.value)

  return (
    <div>
      <PageHeading
        title="KPI Dashboard"
        subtitle="Technical and operational performance across the estate. These figures are estate-wide and are not re-cut by the site filter."
      />

      <MetricGrid>
        {headline.map((m) => <MetricCard key={m.title} {...m} />)}
      </MetricGrid>

      <Section title="Technical KPIs" right={<span style={styles.count}>{technical.length}</span>}>
        <KpiCards rows={technical} />
      </Section>

      <Section title="Operational KPIs" right={<span style={styles.count}>{operational.length}</span>}>
        <KpiCards rows={operational} />
      </Section>

      <div style={styles.two}>
        <Section title="Alert classification" style={{ marginBottom: 0 }}>
          <p style={styles.sectionNote}>What the engineering reviews concluded — the basis for Alert Accuracy and False Positive Rate.</p>
          {classification.length
            ? <Donut data={classification} colors={[GREEN, RED, AMBER]} />
            : <p style={styles.empty}>No alerts classified yet.</p>}
        </Section>

        <Section title="Monitored assets by category" style={{ marginBottom: 0 }}>
          <p style={styles.sectionNote}>The estate these KPIs are measured across, by asset category.</p>
          <HBars data={byCategory} color={ACCENT} />
        </Section>
      </div>
    </div>
  )
}

// The KPI itself: the number, its target, and where it came from. Kept as its
// own card rather than a MetricCard because a KPI carries two things a stat
// does not — a contractual target and a definition — and dropping either is
// what turns a KPI back into a number.
function KpiCards({ rows }) {
  return (
    <div style={styles.kpiGrid}>
      {rows.map((k) => {
        const [icon, variant] = faceOf(k)
        const tone = variant === 'success' ? GREEN : variant === 'destructive' ? RED : AMBER
        return (
          <div key={k.kpiId} style={styles.kpiCard}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ ...styles.kpiChip, color: tone, background: `${tone}14`, borderColor: `${tone}33` }}>
                {glyph(icon)}
              </div>
              <StatusBadge tone={k._favourable ? 'green' : 'amber'}>{k.statusVsTarget}</StatusBadge>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={styles.kpiTitle}>{k.kpi}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <span style={{ ...styles.kpiValue, color: tone }}>{k._display}</span>
                {k._unit && <span style={styles.kpiUnit}>{k._unit}</span>}
                <span style={styles.kpiTarget}>target {k.target}</span>
              </div>

              {/* Only a percentage sits on a 0-100 track. A count of five early
                  detections has no such scale, and a bar under it would invent
                  a ceiling the client never set. */}
              {k._percent != null && (
                <div style={styles.track}>
                  <div style={{ width: `${Math.min(100, k._percent)}%`, height: '100%', background: tone, borderRadius: 999 }} />
                </div>
              )}

              {k._definition && <div style={styles.kpiDef}>{k._definition}</div>}
            </div>

            <div style={styles.kpiFrom}>
              <span style={styles.kpiId}>{k.kpiId}</span>
              from {k.computedFrom}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const styles = {
  two: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 16, marginBottom: 16 },
  count: { fontSize: 11.5, fontWeight: 700, color: SUB, background: '#f1f5f9', borderRadius: 999, padding: '3px 9px' },
  sectionNote: { margin: '-4px 0 14px', fontSize: 12.5, color: MUTE, lineHeight: 1.5 },
  empty: { fontSize: 12.5, color: MUTE, margin: 0 },

  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(288px,1fr))', gap: 14 },
  kpiCard: {
    display: 'flex', flexDirection: 'column',
    border: `1px solid ${LINE}`, borderRadius: 14, padding: 17, background: '#fff',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
  },
  kpiChip: {
    width: 40, height: 40, borderRadius: 11, border: '1px solid',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  kpiTitle: { fontSize: 14, fontWeight: 700, color: INK, lineHeight: 1.3 },
  kpiValue: { fontSize: 30, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' },
  kpiUnit: { fontSize: 13, fontWeight: 600, color: SUB },
  kpiTarget: { fontSize: 12, color: MUTE },
  track: { height: 6, borderRadius: 999, background: '#eef2f7', overflow: 'hidden', marginTop: 12 },
  kpiDef: { fontSize: 12, color: SUB, marginTop: 12, lineHeight: 1.5 },
  kpiFrom: {
    display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap',
    fontSize: 11, color: MUTE, marginTop: 'auto', paddingTop: 14, lineHeight: 1.45,
  },
  kpiId: {
    fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 10.5, fontWeight: 700,
    color: ACCENT, background: '#eef2ff', borderRadius: 5, padding: '2px 6px',
  },
}
