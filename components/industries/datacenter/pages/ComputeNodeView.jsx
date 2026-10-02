'use client'

// Compute node detail — one GPU server, all the way down.
//
// The drill-down from the fleet table: this node's eight GPUs (NVIDIA DCGM), its
// NVMe drives and DIMMs (Micron), its PSUs and fans (Dell iDRAC), and the
// predictive panel that turns those signals into a remaining-useful-life and a
// failure probability per component — each reading attributed to the vendor feed
// that reports it, and a one-click path to raise the work order. Modelled data,
// labelled as such.

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Section, DataTable, StatusBadge, PALETTE } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { useWorkOrderStore } from '../lib/store'
import { useWorkOrders } from './WorkOrders'
import { nextWorkOrderNumber } from '../lib/data'
import { nodeById, GPU_METRICS, SOURCES } from '../lib/computeTelemetry'

const { SUB, MUTE, INK, LINE, GREEN, AMBER, RED, ACCENT } = PALETTE

// The band mapped to the work-order priority vocabulary (not P1/P2/P3, which the
// create screen does not know) so a raised job carries the right severity.
const PRIORITY = { red: 'Critical', amber: 'High', green: 'Medium' }
const SRC_TONE = {
  green: { color: '#047857', background: '#ecfdf5', borderColor: '#a7f3d0' },
  blue: { color: '#1d4ed8', background: '#eff6ff', borderColor: '#bfdbfe' },
  violet: { color: '#6d28d9', background: '#f5f3ff', borderColor: '#ddd6fe' },
}
const srcPill = (key) => {
  const s = SOURCES[key]
  return <span key={key} style={{ ...styles.src, ...SRC_TONE[s.tone] }} title={s.label}>{s.short}</span>
}

export default function ComputeNodeView() {
  const { id } = useParams()
  const router = useRouter()
  const woStore = useWorkOrderStore()
  const existing = useWorkOrders()
  const [raising, setRaising] = useState(false)
  const [woResult, setWoResult] = useState(null)
  const node = useMemo(() => nodeById.get(decodeURIComponent(id || '')), [id])

  const back = () => router.push('/portal/datacenter/compute-telemetry')

  if (!node) {
    return (
      <div>
        <PageHeading title="Node not found" back={{ label: 'Compute Telemetry', onClick: back }}
          subtitle={`No compute node with reference “${id}”. It may have been decommissioned or the link is stale.`} />
      </div>
    )
  }

  // Raise the work order the predictive finding warrants — a real record through
  // the same store the AI Auditor writes to, carrying the node's own site, the
  // right priority and a condition-based trigger. The create screen has no
  // compute node in its (facility) asset list, so this raises directly rather
  // than dead-ending on that screen's required-asset rule.
  const raise = async () => {
    if (raising || woResult) return
    setRaising(true)
    const p = node.predictive[0]
    const number = nextWorkOrderNumber(existing)
    const rec = await woStore.create({
      workOrderId: number,
      dateRaised: new Date().toISOString().slice(0, 10),
      assetId: node.nodeId,
      siteId: node.siteId,
      triggerSource: 'Condition-Based · Compute Telemetry',
      alertId: null,
      priority: PRIORITY[node.health.band] || 'Medium',
      description: `Compute node ${node.nodeId} (${node.model}, ${node.gpuCount}× ${node.gpuModel})${p ? ` — ${p.component}: ${p.driver}. Predicted RUL ${p.rulDays} days, ${p.failProb}% failure probability (${SOURCES[p.source]?.label || p.source}).` : ` — ${node.health.label} health, review telemetry.`}`,
      action: p ? `Inspect and service ${p.component} on ${node.nodeId}; ${node._site}.` : null,
      assignedTo: 'Site Engineering',
      status: 'Open',
      dateCompleted: null,
      outcome: null,
      feedback: null,
    })
    setRaising(false)
    if (rec) setWoResult({ number })
  }

  const stats = [
    { label: 'GPU utilisation', value: node.gpuUtil, unit: '%', note: `${node.gpuCount}× ${node.gpuModel.replace('NVIDIA ', '')}` },
    { label: 'Peak GPU temp', value: node.peakGpuTemp, unit: '°C', tone: node.peakGpuTemp >= 84 ? 'red' : node.peakGpuTemp >= 78 ? 'amber' : 'green', note: `HBM peak ${node.peakHbmTemp}°C` },
    { label: 'Node power', value: node.nodePowerKw, unit: 'kW', note: `${node.cpuUtil}% CPU · ${node.cpuPkgTemp}°C pkg` },
    { label: 'Inlet → exhaust', value: `${node.inletC}→${node.exhaustC}`, unit: '°C', note: `Δt ${Math.round((node.exhaustC - node.inletC) * 10) / 10}°C` },
    { label: 'GPU DBE / XID', value: node.eccDbeTotal + node.xidCount, tone: (node.eccDbeTotal + node.xidCount) ? 'red' : 'green', note: `${node.eccDbeTotal} uncorrectable · ${node.xidCount} XID` },
    { label: 'Health', value: node.health.label, tone: node.health.band === 'red' ? 'red' : node.health.band === 'amber' ? 'amber' : 'green', note: node.soonestRul != null ? `soonest RUL ${node.soonestRul}d` : 'no predictive finding' },
  ]

  // ECC / XID rows — only GPUs with something to report.
  const errRows = node.gpus.filter((g) => g.eccSbe || g.eccDbe || g.xid || g.rowRemap || g.throttleSec)

  const ssdCols = [
    { key: 'id', label: 'Drive', render: (d) => <span><strong>{d.id}</strong> <span style={{ color: MUTE, fontSize: 11 }}>{d.model}</span></span> },
    { key: 'wearPct', label: 'Media life used', align: 'right', render: (d) => <span style={{ color: d.wearPct >= 90 ? RED : d.wearPct >= 80 ? AMBER : INK, fontWeight: d.wearPct >= 80 ? 700 : 500 }}>{d.wearPct}%</span> },
    { key: 'sparePct', label: 'Spare', align: 'right', render: (d) => `${d.sparePct}%` },
    { key: 'tempC', label: 'Temp', align: 'right', render: (d) => `${d.tempC}°C` },
    { key: 'reallocated', label: 'Reallocated', align: 'right', render: (d) => d.reallocated || '—' },
    { key: 'uncorrErr', label: 'Uncorr err', align: 'right', render: (d) => <span style={{ color: d.uncorrErr ? RED : INK }}>{d.uncorrErr || '—'}</span> },
    { key: 'powerOnHrs', label: 'Power-on', align: 'right', render: (d) => `${(d.powerOnHrs / 1000).toFixed(1)}k h` },
  ]

  return (
    <div>
      <PageHeading
        title={node.nodeId}
        back={{ label: 'Compute Telemetry', onClick: back }}
        subtitle={`${node.model} · ${node.gpuCount}× ${node.gpuModel} · ${node.rackId} · ${node.hall} · ${node._site}`}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusBadge tone={node.health.band === 'red' ? 'red' : node.health.band === 'amber' ? 'amber' : 'green'}>{node.health.label}</StatusBadge>
            {node.predictive.length > 0 && (
              woResult
                ? <button onClick={() => router.push(`/portal/datacenter/work-orders/${encodeURIComponent(woResult.number)}`)} style={styles.woView}>✓ {woResult.number} raised — view →</button>
                : <button onClick={raise} disabled={raising} style={{ ...styles.raise, opacity: raising ? 0.7 : 1, cursor: raising ? 'default' : 'pointer' }}>{raising ? 'Raising…' : `Raise ${PRIORITY[node.health.band]} work order →`}</button>
            )}
          </div>
        }
      />

      <StatCards items={stats} />

      {node.predictive.length > 0 && (
        <Section title="Predictive health" right={<span style={styles.note}>remaining useful life & failure probability · driven by the readings below</span>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 10 }}>
            {node.predictive.map((p) => (
              <div key={p.component} style={styles.predCard}>
                <div style={styles.predHead}>
                  <span style={styles.predComp}>{p.component}</span>
                  {srcPill(p.source)}
                </div>
                <div style={styles.predDriver}>{p.driver}</div>
                <div style={styles.predRul}>
                  <div style={styles.rulTrack}>
                    <div style={{ ...styles.rulFill, width: `${Math.max(4, 100 - Math.min(100, p.rulDays / 1.8))}%`, background: p.rulDays <= 14 ? RED : p.rulDays <= 45 ? AMBER : GREEN }} />
                  </div>
                  <div style={styles.rulNums}>
                    <span><strong style={{ color: p.rulDays <= 14 ? RED : INK, fontSize: 15 }}>{p.rulDays}</strong> days RUL</span>
                    <span style={{ color: p.failProb >= 60 ? RED : p.failProb >= 30 ? AMBER : MUTE, fontWeight: 700 }}>{p.failProb}% fail</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="GPUs" right={<span style={styles.note}>{srcPill('dcgm')} per-GPU utilisation, temperature and power — last 7 samples</span>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10 }}>
          {node.gpus.map((g) => (
            <div key={g.gpuId} style={{ ...styles.gpuCard, borderColor: g._over ? '#fecaca' : LINE, background: g._over ? '#fef2f2' : '#fff' }}>
              <div style={styles.gpuHead}>
                <span style={styles.gpuId}>{g.gpuId}</span>
                {g.xid ? <span style={styles.xidTag}>XID {g.xid.code}</span>
                  : g.eccDbe ? <span style={styles.xidTag}>{g.eccDbe} DBE</span>
                    : g.temp >= 84 ? <span style={styles.hotTag}>throttling</span>
                      : <span style={styles.okTag}>OK</span>}
              </div>
              <div style={styles.gpuStats}>
                <GpuStat label="Util" value={`${g.util}%`} />
                <GpuStat label="Temp" value={`${g.temp}°C`} tone={g.temp >= 84 ? RED : g.temp >= 78 ? AMBER : INK} />
                <GpuStat label="HBM" value={`${g.hbmTemp}°C`} tone={g.hbmTemp >= g._hbmAlarm ? RED : INK} />
                <GpuStat label="Power" value={`${g.power}W`} note={`/${g.powerLimit}`} />
              </div>
              <div style={styles.sparks}>
                {GPU_METRICS.map((m) => (
                  <div key={m.key} style={styles.sparkWrap}>
                    <Spark data={g._spark[m.key]} color={m.color} />
                    <span style={styles.sparkLabel}>{m.label.split(' ')[0].slice(0, 4)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {errRows.length > 0 && (
        <Section title="ECC / XID error log" right={<span style={styles.note}>{srcPill('dcgm')} correctable & uncorrectable ECC, XID faults, row-remap, throttling</span>}>
          <DataTable
            columns={[
              { key: 'gpuId', label: 'GPU', render: (g) => <strong>{g.gpuId}</strong> },
              { key: 'eccSbe', label: 'ECC SBE', align: 'right', render: (g) => g.eccSbe || '—' },
              { key: 'eccDbe', label: 'ECC DBE', align: 'right', render: (g) => <span style={{ color: g.eccDbe ? RED : INK, fontWeight: g.eccDbe ? 700 : 500 }}>{g.eccDbe || '—'}</span> },
              { key: 'xid', label: 'XID', render: (g) => g.xid ? <span style={{ color: RED, fontWeight: 700 }}>{g.xid.code} · {g.xid.label}</span> : '—' },
              { key: 'rowRemap', label: 'Row-remap', align: 'right', render: (g) => g.rowRemap || '—' },
              { key: 'throttleSec', label: 'Throttle', align: 'right', render: (g) => g.throttleSec ? `${g.throttleSec}s` : '—' },
            ]}
            rows={errRows}
            pageSize={8}
            empty="No GPU errors on this node."
          />
        </Section>
      )}

      <div style={styles.two}>
        <Section title="Storage & memory" right={<span style={styles.note}>{srcPill('micron')} NVMe SMART & DIMM ECC</span>} style={{ marginBottom: 0 }}>
          <DataTable columns={ssdCols} rows={node.ssds} pageSize={5} empty="No drives." />
          <div style={styles.dimm}>
            <span style={styles.dimmLabel}>DIMM correctable errors</span>
            <span style={{ ...styles.dimmVal, color: node.dimmEccPerHr >= 30 ? AMBER : INK }}>{node.dimmEccPerHr}/hr</span>
            <span style={styles.dimmNote}>{node.dimmEccPerHr >= 30 ? 'trending toward an uncorrectable event — predictive sparing candidate' : 'within budget'}</span>
          </div>
        </Section>

        <Section title="Power & cooling" right={<span style={styles.note}>{srcPill('idrac')} Dell iDRAC · Redfish</span>} style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {node.psus.map((p) => (
              <div key={p.id} style={styles.psu}>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={styles.psuId}>{p.id} <span style={{ color: MUTE, fontSize: 11 }}>{p.psuCount}× {p.model}</span></span>
                  <span style={styles.psuMeta}>delivering {(p.deliveredW / 1000).toFixed(1)} kW of {(p.ratedW / 1000).toFixed(0)} kW · {p.efficiency}% efficiency</span>
                </span>
                <StatusBadge tone={p._drift ? 'amber' : 'green'}>{p._drift ? 'Efficiency drift' : 'Nominal'}</StatusBadge>
              </div>
            ))}
            <div style={styles.psu}>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={styles.psuId}>Redundancy</span>
                <span style={styles.psuMeta}>3+3 · 18 kW installed · node draws {node.nodePowerKw} kW, under a single 9 kW feed</span>
              </span>
              <StatusBadge tone={node.psuRedundant ? 'green' : 'red'}>{node.psuRedundant ? 'N+1 held' : 'No headroom'}</StatusBadge>
            </div>
            <div style={styles.psu}>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={styles.psuId}>Chassis fans</span>
                <span style={styles.psuMeta}>average {node.fans}% of commanded speed</span>
              </span>
              <StatusBadge tone={node.fans >= 95 ? 'amber' : 'green'}>{node.fans >= 95 ? 'High' : 'Nominal'}</StatusBadge>
            </div>
            <div style={styles.psu}>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={styles.psuId}>CPU envelope</span>
                <span style={styles.psuMeta}>{node.cpuUtil}% util · {node.cpuPkgTemp}°C package</span>
              </span>
              <StatusBadge tone={node.cpuPkgTemp >= 82 ? 'amber' : 'green'}>{node.cpuPkgTemp >= 82 ? 'Warm' : 'Nominal'}</StatusBadge>
            </div>
          </div>
        </Section>
      </div>

      <p style={styles.footNote}>
        Telemetry is modelled for this proof of concept — no live DCGM, Redfish or NVMe polling. In production these are the NVIDIA DCGM, Dell iDRAC (Redfish) and Micron SMART feeds named on each panel.
      </p>
    </div>
  )
}

function GpuStat({ label, value, note, tone }) {
  return (
    <div style={styles.gpuStat}>
      <div style={styles.gpuStatLabel}>{label}</div>
      <div style={{ ...styles.gpuStatValue, color: tone || INK }}>{value}<span style={styles.gpuStatNote}>{note}</span></div>
    </div>
  )
}

// A tiny fixed-viewbox sparkline over the 7 points — scaled to its own min/max.
function Spark({ data, color }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const w = 70
  const h = 22
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / span) * (h - 3) - 1.5}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={h - ((data[data.length - 1] - min) / span) * (h - 3) - 1.5} r="1.9" fill={color} />
    </svg>
  )
}

const styles = {
  note: { fontSize: 11, color: MUTE, display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  two: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 14, marginBottom: 14 },
  raise: { padding: '8px 13px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', color: '#fff', background: '#15227a', border: 'none', borderRadius: 9 },
  woView: { padding: '8px 13px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 9, cursor: 'pointer' },
  src: { display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: 999, border: '1px solid', fontSize: 9.5, fontWeight: 800 },

  predCard: { padding: '11px 13px', border: `1px solid ${LINE}`, borderRadius: 11, background: '#fcfdfe' },
  predHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  predComp: { fontSize: 13, fontWeight: 800, color: INK },
  predDriver: { fontSize: 11.5, color: SUB, marginTop: 3, lineHeight: 1.4 },
  predRul: { marginTop: 9 },
  rulTrack: { height: 8, borderRadius: 999, background: '#eef2f7', overflow: 'hidden' },
  rulFill: { height: '100%', borderRadius: 999 },
  rulNums: { display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 12, color: SUB },

  gpuCard: { padding: '11px 12px', border: '1px solid', borderRadius: 11 },
  gpuHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  gpuId: { fontSize: 13, fontWeight: 800, color: INK },
  xidTag: { fontSize: 9.5, fontWeight: 800, color: '#b91c1c', background: '#fee2e2', borderRadius: 999, padding: '1px 7px', textTransform: 'uppercase' },
  hotTag: { fontSize: 9.5, fontWeight: 800, color: '#b45309', background: '#fef3c7', borderRadius: 999, padding: '1px 7px', textTransform: 'uppercase' },
  okTag: { fontSize: 9.5, fontWeight: 700, color: '#047857', background: '#ecfdf5', borderRadius: 999, padding: '1px 7px' },
  gpuStats: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 9 },
  gpuStat: {},
  gpuStatLabel: { fontSize: 9, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.3 },
  gpuStatValue: { fontSize: 13.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums' },
  gpuStatNote: { fontSize: 10, color: MUTE, fontWeight: 600, marginLeft: 2 },
  sparks: { display: 'flex', gap: 8, borderTop: `1px solid ${LINE}`, paddingTop: 8 },
  sparkWrap: { flex: 1, minWidth: 0 },
  sparkLabel: { display: 'block', fontSize: 9, color: MUTE, fontWeight: 600, marginTop: 2, textTransform: 'uppercase' },

  dimm: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 12, padding: '10px 12px', borderRadius: 9, background: '#f8fafc', border: `1px solid ${LINE}` },
  dimmLabel: { fontSize: 11.5, fontWeight: 700, color: INK },
  dimmVal: { fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' },
  dimmNote: { fontSize: 11, color: MUTE, flex: '1 1 160px' },

  psu: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `1px solid ${LINE}`, borderRadius: 10, background: '#fff' },
  psuId: { display: 'block', fontSize: 12.5, fontWeight: 700, color: INK },
  psuMeta: { display: 'block', fontSize: 11, color: SUB, marginTop: 1 },

  footNote: { marginTop: 4, fontSize: 11.5, color: MUTE, lineHeight: 1.55 },
}
