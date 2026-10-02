'use client'

// Compute Telemetry — the fleet overview.
//
// The device-level companion to the GPU Cluster Power screen (which stops at the
// cluster aggregate): every GPU server node in the estate, vendor-attributed, in
// one table, with the roll-ups an operator leads with and the predictive at-risk
// list that turns a reading into a work order. Numbers are modelled per this
// portal's rule — no live DCGM/Redfish/NVMe polling — and labelled as such.

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Section, DataTable, StatusBadge, Donut, PALETTE } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { useSite } from '../lib/siteStore'
import {
  COMPUTE_NODES, COMPUTE_RACKS, fleetSummary, siteRollup, atRiskNodes, fleetRows, SOURCES,
} from '../lib/computeTelemetry'

const { SUB, MUTE, INK, LINE, GREEN, AMBER, RED, ACCENT, BLUE } = PALETTE

const BAND = { green: GREEN, amber: AMBER, red: RED }
const bandTone = (b) => (b === 'red' ? 'red' : b === 'amber' ? 'amber' : 'green')

export default function ComputeTelemetry() {
  const { scope, siteName } = useSite()
  const router = useRouter()

  const nodes = useMemo(() => scope(COMPUTE_NODES), [scope])
  const racks = useMemo(() => scope(COMPUTE_RACKS), [scope])
  const s = useMemo(() => fleetSummary(nodes), [nodes])
  const sites = useMemo(() => siteRollup(nodes), [nodes])
  const atRisk = useMemo(() => atRiskNodes(nodes, 5), [nodes])
  const rows = useMemo(() => fleetRows(nodes), [nodes])

  const open = (nodeId) => router.push(`/portal/datacenter/compute-telemetry/${encodeURIComponent(nodeId)}`)

  const stats = [
    { label: 'Compute nodes', value: s.nodes, note: `${s.gpuCount} GPUs · ${sites.length} site${sites.length !== 1 ? 's' : ''}`, icon: 'chart' },
    { label: 'Fleet GPU utilisation', value: s.avgUtil, unit: '%', tone: s.avgUtil >= 60 ? 'green' : 'amber', note: 'SM activity · NVIDIA DCGM' },
    { label: 'Fleet draw', value: s.drawKw, unit: 'kW', note: `${s.drawMw} MW across the fleet` },
    { label: 'Avg rack inlet', value: s.avgInlet, unit: '°C', tone: s.avgInlet > 27 ? 'amber' : 'green', note: 'ASHRAE A1 recommended 18–27' },
    { label: 'AI infra health score', value: s.healthScore, unit: '/100', tone: s.healthScore >= 85 ? 'green' : s.healthScore >= 70 ? 'amber' : 'red', note: `${s.critical} critical · ${s.warning} warning` },
    { label: 'At risk', value: s.atRisk, tone: s.atRisk ? 'amber' : 'green', note: 'nodes with a predictive finding' },
  ]

  const healthMix = [
    { name: 'Healthy', value: s.healthy },
    { name: 'Warning', value: s.warning },
    { name: 'Critical', value: s.critical },
  ]

  const columns = [
    { key: 'nodeId', label: 'Node', render: (r) => (
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: INK }}>{r.nodeId}</div>
        <div style={{ fontSize: 11, color: MUTE }}>{r.rackId} · {r.hall}</div>
      </div>
    ), sortValue: (r) => r.nodeId },
    { key: 'gpuModel', label: 'GPUs', render: (r) => <span><strong>{r.gpuCount}×</strong> {r.gpuModel.replace('NVIDIA ', '')}</span> },
    { key: 'gpuUtil', label: 'GPU util', align: 'right', render: (r) => `${r.gpuUtil}%`, sortValue: (r) => r.gpuUtil },
    { key: 'peakGpuTemp', label: 'Peak GPU', align: 'right', render: (r) => <span style={{ color: r.peakGpuTemp >= 84 ? RED : r.peakGpuTemp >= 78 ? AMBER : INK, fontWeight: r.peakGpuTemp >= 84 ? 700 : 500 }}>{r.peakGpuTemp}°C</span>, sortValue: (r) => r.peakGpuTemp },
    { key: 'nodePowerKw', label: 'Power', align: 'right', render: (r) => `${r.nodePowerKw} kW`, sortValue: (r) => r.nodePowerKw },
    { key: 'inletC', label: 'Inlet', align: 'right', render: (r) => `${r.inletC}°C`, sortValue: (r) => r.inletC },
    { key: 'band', label: 'Health', render: (r) => <StatusBadge tone={bandTone(r.band)}>{r.health}</StatusBadge>, sortValue: (r) => ({ red: 0, amber: 1, green: 2 }[r.band]) },
    { key: 'sources', label: 'Telemetry', render: () => <SourceBadges /> },
  ]

  return (
    <div>
      <PageHeading
        title="Compute Telemetry"
        wide
        subtitle="Per-device telemetry for the GPU compute estate — every server node, GPU, rack PDU and NVMe drive, sourced from NVIDIA DCGM, Dell iDRAC (Redfish) and Micron. The layer the facility BMS and electrical modules do not reach. Figures are modelled for this proof of concept."
        right={<span style={styles.sourceStrip}><SourceBadges labelled /></span>}
      />

      <StatCards items={stats} />

      {nodes.length === 0 ? (
        <div style={styles.empty}>
          No compute telemetry at {siteName}. Dense GPU compute is monitored at <strong>{sites.length ? sites.map((x) => x.siteId).join(', ') : 'FRA15 (Frankfurt) and IAD35 (Ashburn)'}</strong> — clear the site filter to see the fleet.
        </div>
      ) : (
        <>
          <div style={styles.two}>
            <Section title="Fleet health" style={{ marginBottom: 0 }}>
              <Donut data={healthMix} colors={[GREEN, AMBER, RED]} />
              <div style={styles.siteStrip}>
                {sites.map((st) => (
                  <div key={st.siteId} style={styles.siteChip}>
                    <div style={styles.siteId}>{st.siteId}</div>
                    <div style={styles.siteMeta}>{st.nodes} nodes · {st.gpus} GPUs · PUE {st.pue}</div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Predictive — at risk" right={<span style={styles.secNote}>soonest remaining useful life first</span>} style={{ marginBottom: 0 }}>
              {atRisk.length === 0 ? (
                <div style={styles.calm}>No predictive findings open — every component is inside its life and error budget.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {atRisk.map((n) => {
                    const p = n.predictive[0]
                    return (
                      <button key={n.nodeId} onClick={() => open(n.nodeId)} style={styles.riskRow}>
                        <span style={{ ...styles.riskDot, background: BAND[n.health.band] }} />
                        <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                          <span style={styles.riskNode}>{n.nodeId}</span>
                          <span style={styles.riskDriver}>{p.component} — {p.driver}</span>
                        </span>
                        <span style={styles.riskRul}>
                          <strong style={{ color: p.rulDays <= 14 ? RED : p.rulDays <= 45 ? AMBER : INK }}>{p.rulDays}d</strong>
                          <span style={styles.riskFail}>{p.failProb}% fail</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </Section>
          </div>

          <Section title="GPU server fleet" right={<span style={styles.secNote}>{rows.length} nodes · click a node for its GPUs, drives and predictive health</span>}>
            <DataTable
              columns={columns}
              rows={rows}
              pageSize={12}
              onRowClick={(r) => open(r.nodeId)}
              empty="No nodes at this site."
            />
          </Section>

          <Section title="Racks — power density & thermal" right={<span style={styles.secNote}>rack draw vs breaker design · Δt inlet→exhaust · PDU phase balance</span>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {racks.map((r) => (
                <div key={r.rackId} style={styles.rackRow}>
                  <div style={styles.rackHead}>
                    <span style={styles.rackId}>{r.rackId}</span>
                    <span style={styles.rackMeta}>{r.hall} · {r.row} · {r.nodeCount} nodes · {r.gpuCount} GPUs</span>
                  </div>
                  <div style={styles.rackBars}>
                    <div style={styles.densityWrap}>
                      <div style={styles.densityLabel}>
                        <span>Power density</span>
                        <span style={{ fontWeight: 700, color: r._band === 'red' ? RED : r._band === 'amber' ? AMBER : INK }}>{r.drawKw} / {r.designKw} kW · {r.pctOfDesign}%</span>
                      </div>
                      <div style={styles.track}>
                        <div style={{ ...styles.fill, width: `${Math.min(100, r.pctOfDesign)}%`, background: BAND[r._band] }} />
                        <div style={styles.limit} title="breaker design limit" />
                      </div>
                      <div style={styles.phaseLine}>
                        {r.phases.map((ph) => (
                          <span key={ph.phase} style={styles.phase}>
                            <span style={styles.phaseTag}>{ph.phase}</span> {ph.pctOfRating}%
                          </span>
                        ))}
                        <span style={{ ...styles.phase, color: r.phaseImbalancePct > 15 ? AMBER : MUTE }}>imbalance {r.phaseImbalancePct}%</span>
                      </div>
                    </div>
                    <div style={styles.thermal}>
                      <Fact label="Inlet" value={`${r.inletC}°C`} />
                      <Fact label="Exhaust" value={`${r.exhaustC}°C`} />
                      <Fact label="Δt" value={`${r.deltaT}°C`} tone={r.deltaT > 16 ? AMBER : undefined} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

// The three vendor feeds, as attribution pills. `labelled` shows the full name.
function SourceBadges({ labelled }) {
  return (
    <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
      {Object.values(SOURCES).map((src) => (
        <span key={src.key} style={{ ...styles.srcPill, ...SRC_TONE[src.tone] }} title={src.label}>
          {labelled ? src.label : src.short}
        </span>
      ))}
    </span>
  )
}

function Fact({ label, value, tone }) {
  return (
    <div style={styles.factBox}>
      <div style={styles.factLabel}>{label}</div>
      <div style={{ ...styles.factValue, color: tone || INK }}>{value}</div>
    </div>
  )
}

const SRC_TONE = {
  green: { color: '#047857', background: '#ecfdf5', borderColor: '#a7f3d0' },
  blue: { color: '#1d4ed8', background: '#eff6ff', borderColor: '#bfdbfe' },
  violet: { color: '#6d28d9', background: '#f5f3ff', borderColor: '#ddd6fe' },
}

const styles = {
  two: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 14, marginBottom: 14, marginTop: 4 },
  secNote: { fontSize: 11, color: MUTE },
  sourceStrip: { display: 'inline-flex', alignItems: 'center' },
  srcPill: { display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 999, border: '1px solid', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' },
  empty: { marginTop: 14, padding: '18px 20px', borderRadius: 12, border: `1px dashed ${LINE}`, background: '#fff', color: SUB, fontSize: 13, lineHeight: 1.6 },
  calm: { padding: '14px 16px', borderRadius: 10, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: 12.5, lineHeight: 1.5 },

  siteStrip: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: `1px solid ${LINE}` },
  siteChip: { flex: '1 1 140px', padding: '9px 11px', borderRadius: 9, background: '#f8fafc', border: `1px solid ${LINE}` },
  siteId: { fontSize: 12.5, fontWeight: 800, color: ACCENT },
  siteMeta: { fontSize: 10.5, color: MUTE, marginTop: 2 },

  riskRow: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 11px', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' },
  riskDot: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  riskNode: { display: 'block', fontSize: 12.5, fontWeight: 700, color: INK },
  riskDriver: { display: 'block', fontSize: 11, color: SUB, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  riskRul: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, fontSize: 13 },
  riskFail: { fontSize: 10, color: MUTE, fontWeight: 600 },

  rackRow: { padding: '12px 14px', border: `1px solid ${LINE}`, borderRadius: 12, background: '#fcfdfe' },
  rackHead: { display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 },
  rackId: { fontSize: 13, fontWeight: 800, color: INK },
  rackMeta: { fontSize: 11, color: MUTE },
  rackBars: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 16, alignItems: 'center' },
  densityWrap: { minWidth: 0 },
  densityLabel: { display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: SUB, marginBottom: 5 },
  track: { position: 'relative', height: 12, borderRadius: 999, background: '#eef2f7', overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999 },
  limit: { position: 'absolute', top: -2, bottom: -2, right: 0, width: 2, background: '#0f172a' },
  phaseLine: { display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 7, fontSize: 11, color: SUB },
  phase: { display: 'inline-flex', alignItems: 'center', gap: 4, fontVariantNumeric: 'tabular-nums' },
  phaseTag: { fontSize: 9.5, fontWeight: 800, color: MUTE, background: '#eef2f7', borderRadius: 5, padding: '1px 5px' },
  thermal: { display: 'flex', gap: 8 },
  factBox: { padding: '6px 10px', borderRadius: 8, background: '#fff', border: `1px solid ${LINE}`, textAlign: 'center', minWidth: 58 },
  factLabel: { fontSize: 9, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 },
  factValue: { fontSize: 13, fontWeight: 800, marginTop: 2, fontVariantNumeric: 'tabular-nums' },
}
