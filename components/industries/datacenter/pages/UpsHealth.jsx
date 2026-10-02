'use client'

// UPS health — state of health per unit, reserve runtime under the load it is
// actually carrying, and which battery modules are due to come out.
//
// Ported from the electrical portal on the iFactory platform, where it was a
// config entry rendered by a generic module page. Carried across as a real
// screen on this portal's kit, with the same units, tags and readings.
//
// Reserve is stated at present load rather than at nameplate, because that is
// the number an operator plans a hot-swap window around; nameplate runtime on a
// half-loaded string reads high and is not what you get on the day.
//
// Fixtures only — nothing here writes to the record store.

import { Section, DataTable, StatusBadge, PALETTE } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import MetricCard, { MetricGrid } from '../components/MetricCard'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, AMBER, RED } = PALETTE

const UNITS = [
  {
    name: 'UPS-A12 cluster · hall DC1', tag: 'DC1_UPS_A12', state: 'critical',
    soh: 91, reserve: 18.4, flagged: 6, due: 'Module 3B — 18 days',
    trend: [91, 89, 86, 82, 78, 72, 64],
    note: 'Module 3B is falling faster than the string around it. At this rate it drops under the reserve floor in 18 days, so the swap window wants booking now rather than at the next quarterly.',
  },
  {
    name: 'BladeUPS array-C · hall DC2', tag: 'DC2_BLADE_C', state: 'ok',
    soh: 96, reserve: 24.2, flagged: 0, due: '—',
    trend: [94, 94, 95, 95, 95, 95, 96],
    note: 'Flat and healthy. Nothing scheduled.',
  },
  {
    name: 'UPS-B04 cluster · hall DC2', tag: 'DC2_UPS_B04', state: 'watch',
    soh: 93, reserve: 21.6, flagged: 4, due: 'Modules 1A, 2C — 47 days',
    trend: [96, 96, 95, 95, 94, 94, 93],
    note: 'Drifting down slowly and evenly, which reads as age rather than a fault. Two modules are flagged and both fall inside the next planned window.',
  },
  {
    name: 'UPS-C09 cluster · hall DC3', tag: 'DC3_UPS_C09', state: 'ok',
    soh: 97, reserve: 26.8, flagged: 0, due: '—',
    trend: [97, 97, 97, 96, 97, 97, 97],
    note: 'Newest string on the estate. Nothing scheduled.',
  },
]

const TONE = { ok: 'success', watch: 'warning', critical: 'danger' }
const LABEL = { ok: 'Healthy', watch: 'Ageing', critical: 'Swap due' }

function Spark({ data, color }) {
  const lo = Math.min(...data), hi = Math.max(...data)
  const span = hi - lo || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - lo) / span) * 24}`).join(' ')
  return (
    <svg width="100%" height="32" viewBox="0 0 100 32" preserveAspectRatio="none" style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

const COLUMNS = [
  { key: 'name', label: 'Unit', width: 230 },
  { key: 'tag', label: 'Tag', width: 130, render: (r) => <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5, color: SUB }}>{r.tag}</span> },
  { key: 'soh', label: 'State of health', align: 'right', width: 130, render: (r) => (
    <span style={{ fontWeight: 700, color: r.soh < 92 ? AMBER : INK }}>{r.soh}%</span>
  ) },
  { key: 'reserve', label: 'Reserve at load', align: 'right', width: 130, render: (r) => `${r.reserve.toFixed(1)} min` },
  { key: 'flagged', label: 'Cells flagged', align: 'right', width: 110, render: (r) => (
    r.flagged ? <span style={{ color: r.flagged > 4 ? RED : AMBER, fontWeight: 700 }}>{r.flagged}</span> : <span style={{ color: MUTE }}>—</span>
  ) },
  { key: 'due', label: 'Swap due', render: (r) => (
    <span style={{ fontSize: 11.5, color: r.due === '—' ? MUTE : SUB }}>{r.due}</span>
  ) },
]

const flaggedTotal = UNITS.reduce((a, u) => a + u.flagged, 0)
const minReserve = Math.min(...UNITS.map((u) => u.reserve))

export default function UpsHealth() {
  return (
    <div>
      <PageHeading
        title="UPS Health"
        subtitle="Per-cell state of health · reserve runtime at present load · swap windows"
      />

      <MetricGrid>
        <MetricCard title="UPS clusters" value={`${UNITS.length}`} note="across three energised halls" />
        <MetricCard title="Lowest reserve" value={minReserve.toFixed(1)} unit="min" note="UPS-A12 · at the load it carries now" variant="warning" />
        <MetricCard title="Cells flagged" value={`${flaggedTotal}`} note="across 184 battery modules" variant="warning" />
        <MetricCard title="Swap windows booked" value="4" note="in the next 30 days" />
      </MetricGrid>

      <Section title="Clusters" right={<span style={{ fontSize: 11.5, color: MUTE }}>state of health over the last seven readings</span>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 12, alignItems: 'stretch' }}>
          {UNITS.map((u) => {
            const tone = u.state === 'critical' ? RED : u.state === 'watch' ? AMBER : GREEN
            return (
              <div key={u.tag} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: MUTE, marginTop: 2, fontFamily: 'ui-monospace, monospace' }}>{u.tag}</div>
                  </div>
                  <StatusBadge tone={TONE[u.state]}>{LABEL[u.state]}</StatusBadge>
                </div>

                <div style={{ marginTop: 14 }}><Spark data={u.trend} color={tone} /></div>

                <div style={{ paddingTop: 14, display: 'flex', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 10, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>SoH</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: tone }}>{u.soh}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Reserve</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: INK }}>{u.reserve.toFixed(1)}<span style={{ fontSize: 11, color: MUTE, fontWeight: 600 }}> min</span></div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Flagged</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: u.flagged ? tone : MUTE }}>{u.flagged || '—'}</div>
                  </div>
                </div>

                <p style={{ margin: '12px 0 0', paddingTop: 12, borderTop: `1px solid ${LINE}`, fontSize: 11.5, color: SUB, lineHeight: 1.55, marginTop: 'auto' }}>{u.note}</p>
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Swap schedule">
        <DataTable columns={COLUMNS} rows={UNITS} pageSize={10} />
      </Section>
    </div>
  )
}
