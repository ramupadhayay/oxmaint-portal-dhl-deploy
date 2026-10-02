'use client'

// GPU cluster power — what the compute is drawing, and what is left on the
// circuit before another node cannot be added.
//
// Ported from the electrical portal on the iFactory platform, where it was a
// config entry rendered by a generic module page. Carried across as a real
// screen on this portal's kit, with the same clusters, tags and readings.
//
// Fixtures only — nothing here writes to the record store.

import { Section, DataTable, StatusBadge, PALETTE } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import MetricCard, { MetricGrid } from '../components/MetricCard'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, AMBER, RED } = PALETTE

const CLUSTERS = [
  {
    name: 'Cluster A · 64 nodes', tag: 'DC1_GPU_A', state: 'ok',
    power: 232, util: 88, inlet: 22.4, headroom: 'Healthy',
    trend: [220, 224, 228, 232, 230, 234, 232],
  },
  {
    name: 'Cluster B · 64 nodes', tag: 'DC1_GPU_B', state: 'ok',
    power: 224, util: 84, inlet: 23.1, headroom: 'Healthy',
    trend: [218, 220, 224, 226, 228, 226, 224],
  },
  {
    name: 'Cluster C · 56 nodes, mixed', tag: 'DC1_GPU_C', state: 'watch',
    power: 344, util: 91, inlet: 24.2, headroom: '10.8 kW left — three more nodes',
    trend: [320, 326, 330, 334, 338, 342, 344],
  },
]

const TONE = { ok: 'success', watch: 'warning', critical: 'danger' }
const LABEL = { ok: 'Within circuit', watch: 'Approaching circuit limit', critical: 'Over' }

// A seven-point trace of the cluster's draw. Drawn from the numbers above rather
// than generated, so the line and the figure beside it cannot disagree.
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
  { key: 'name', label: 'Cluster', width: 220 },
  { key: 'tag', label: 'Tag', width: 130, render: (r) => <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5, color: SUB }}>{r.tag}</span> },
  { key: 'power', label: 'Draw', align: 'right', width: 100, render: (r) => `${r.power} kW` },
  { key: 'util', label: 'Utilisation', align: 'right', width: 110, render: (r) => `${r.util}%` },
  { key: 'inlet', label: 'Inlet', align: 'right', width: 90, render: (r) => `${r.inlet.toFixed(1)}°C` },
  { key: 'headroom', label: 'Circuit headroom', render: (r) => (
    <span style={{ color: r.state === 'watch' ? AMBER : SUB, fontSize: 11.5 }}>{r.headroom}</span>
  ) },
]

const totalPower = CLUSTERS.reduce((a, c) => a + c.power, 0)
const totalNodes = 184

export default function GpuClusterPower() {
  return (
    <div>
      <PageHeading
        title="GPU Cluster Power"
        subtitle="Rack-level draw · per-circuit headroom · cooling correlation"
      />

      <MetricGrid>
        <MetricCard title="Nodes online" value={`${totalNodes}`} note="across three clusters in hall DC1" />
        <MetricCard title="Cluster draw" value={(totalPower / 1000).toFixed(2)} unit="MW" note="peak inference and training combined" />
        <MetricCard title="Draw per node" value="3.6" unit="kW" note="sustained average across the fleet" variant="success" />
        <MetricCard title="Cooling capacity used" value="78" unit="%" note="CRAH and CDU across the hall" variant="warning" />
      </MetricGrid>

      <Section title="Clusters" right={<span style={{ fontSize: 11.5, color: MUTE }}>draw over the last seven readings</span>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, alignItems: 'stretch' }}>
          {CLUSTERS.map((c) => {
            const tone = c.state === 'watch' ? AMBER : GREEN
            return (
              <div key={c.tag} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: MUTE, marginTop: 2, fontFamily: 'ui-monospace, monospace' }}>{c.tag}</div>
                  </div>
                  <StatusBadge tone={TONE[c.state]}>{LABEL[c.state]}</StatusBadge>
                </div>

                <div style={{ marginTop: 14 }}><Spark data={c.trend} color={tone} /></div>

                <div style={{ marginTop: 'auto', paddingTop: 14, display: 'flex', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 10, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Draw</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: tone }}>{c.power}<span style={{ fontSize: 11, color: MUTE, fontWeight: 600 }}> kW</span></div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Utilisation</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: INK }}>{c.util}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Inlet</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: INK }}>{c.inlet.toFixed(1)}°C</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Circuit headroom" right={<span style={{ fontSize: 11.5, color: MUTE }}>what limits the next node</span>}>
        <DataTable columns={COLUMNS} rows={CLUSTERS} pageSize={10} />
        <p style={{ margin: '12px 0 0', fontSize: 11.5, color: SUB, lineHeight: 1.55 }}>
          Cluster C is the one to watch. It runs a mixed generation, so its per-node
          draw is higher than the two clusters beside it, and at 344 kW it has 10.8 kW
          left on the circuit — three more nodes, not the eight the rack space suggests.
        </p>
      </Section>
    </div>
  )
}
