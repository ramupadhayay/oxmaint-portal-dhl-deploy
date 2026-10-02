'use client'

// Capacity planner — how many more nodes this hall takes before something trips.
//
// Ported from the electrical portal on the iFactory platform. The cascade
// simulation and the Monte-Carlo headroom distribution came across as they were;
// what changed is the furniture. It renders on this portal's kit rather than the
// other portal's components, and on the platform palette rather than a hardware
// vendor's brand green.
//
// Fixtures only — nothing here writes to the record store.

import { useState, useEffect } from 'react'
import { Section, PALETTE } from '../lib/kit'
import PageHeading from '../components/PageHeading'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, AMBER, RED } = PALETTE
const ACCENT_SOFT = '#3a4a9f'

const ROWS = [
  { id: 'A', site: 'Hall DC1', baseLoad: 408, capacity: 600, racks: 8, ups: 'A-bank', cooling: 'CRAH-1', reserve: 42.4 },
  { id: 'B', site: 'Hall DC1', baseLoad: 444, capacity: 600, racks: 8, ups: 'B-bank', cooling: 'CRAH-2', reserve: 38.4 },
  { id: 'C', site: 'Hall DC1', baseLoad: 412, capacity: 600, racks: 8, ups: 'C-bank', cooling: 'CRAH-3', reserve: 38.4 },
  { id: 'D', site: 'Hall DC1', baseLoad: 312, capacity: 600, racks: 8, ups: 'D-bank', cooling: 'CRAH-4', reserve: 41.2 },
]

const NODE_TYPES = [
  { id: 'h100', label: 'NVIDIA H100', kw: 3.6, sub: '700 W TDP per GPU · 8 GPUs/node' },
  { id: 'b200', label: 'NVIDIA B200', kw: 5.4, sub: '1000 W TDP per GPU · 8 GPUs/node' },
  { id: 'a100', label: 'NVIDIA A100', kw: 2.4, sub: '400 W TDP per GPU · 8 GPUs/node' },
  { id: 'cpu', label: 'CPU compute node', kw: 0.85, sub: 'dual-socket Xeon · standard rack U' },
]

// Run a Monte Carlo cascade for the proposed addition
function simulateCascade(row, nodeType, count) {
  const nodes = NODE_TYPES.find((n) => n.id === nodeType)
  const addedKw = nodes.kw * count
  const newLoad = row.baseLoad + addedKw
  const newPct = (newLoad / row.capacity) * 100
  // Simple Monte-Carlo: mean = newPct, sigma = 1.4
  const p10 = Math.max(0, newPct - 1.8)
  const p50 = newPct
  const p90 = newPct + 1.6
  const breachProbability = newPct > 78 ? Math.min(99, (newPct - 78) * 12 + 0.5) : Math.max(0.1, (newPct - 70) * 0.2)
  // Cooling: each H100 adds ~0.4°C, each kW adds ~0.11°C per CRAH
  const newDelta = 6.4 + addedKw * 0.029
  // UPS reserve degrades linearly
  const newReserve = row.reserve - (addedKw / row.capacity) * row.reserve * 0.03
  // Per-circuit headroom
  const headroom = Math.max(0, 100 - newPct)
  const safe = newPct < 80 && newDelta < 8 && newReserve > 30 && breachProbability < 5
  return {
    addedKw, newLoad, newPct, p10, p50, p90, breachProbability, newDelta, newReserve, headroom, safe, nodes,
  }
}

function StagePill({ label, value, unit, status, sub }) {
  const c = status === 'ok' ? GREEN : status === 'watch' ? AMBER : RED
  return (
    <div style={{ background: '#fff', border: `1px solid ${c}40`, borderTop: `3px solid ${c}`, borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: c, lineHeight: 1, marginTop: 4 }}>
        {Number.isInteger(value) ? value : Number(value).toFixed(1)}
        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginLeft: 4 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{sub}</div>
    </div>
  )
}

// Probability distribution viz
function MCDistribution({ p10, p50, p90, threshold = 80 }) {
  const w = 600, h = 80
  const min = Math.max(0, p10 - 4), max = Math.min(100, Math.max(p90 + 4, threshold + 2))
  const x = (v) => ((v - min) / (max - min)) * w
  // Bell curve approximation
  const sigma = (p90 - p10) / 2.56
  const points = Array.from({ length: 60 }, (_, i) => {
    const v = min + (i / 59) * (max - min)
    const z = (v - p50) / sigma
    return Math.exp(-0.5 * z * z)
  })
  const pmax = Math.max(...points)
  const pts = points.map((y, i) => `${(i / 59) * w},${h - (y / pmax) * (h - 12) - 6}`).join(' ')
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="mc-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.4" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill="url(#mc-grad)" />
      <polyline points={pts} fill="none" stroke={ACCENT} strokeWidth="2" />
      {/* Threshold marker */}
      <line x1={x(threshold)} y1="0" x2={x(threshold)} y2={h} stroke={RED} strokeWidth="1.5" strokeDasharray="4,3" />
      <text x={x(threshold) + 3} y="12" fontSize="10" fill={RED} fontWeight="700">SLA · {threshold}%</text>
      {/* P10/P50/P90 markers */}
      <line x1={x(p10)} y1={h - 12} x2={x(p10)} y2={h - 6} stroke={GREEN} strokeWidth="2" />
      <line x1={x(p50)} y1={h - 16} x2={x(p50)} y2={h - 6} stroke={ACCENT} strokeWidth="2" />
      <line x1={x(p90)} y1={h - 12} x2={x(p90)} y2={h - 6} stroke={AMBER} strokeWidth="2" />
    </svg>
  )
}

export default function CapacityPlanner() {
  const [rowId, setRowId] = useState('C')
  const [nodeType, setNodeType] = useState('h100')
  const [count, setCount] = useState(3)
  const [simAnimating, setSimAnimating] = useState(false)
  // The button used to hand its payload to the other portal's agent modal. That
  // component does not exist here, and the port left the call inert — the button
  // built a full reservation and threw it away. It opens a confirmation now.
  const [pending, setPending] = useState(null)
  const [reserved, setReserved] = useState(null)

  const row = ROWS.find((r) => r.id === rowId)
  const result = simulateCascade(row, nodeType, count)

  // Re-run sim animation whenever inputs change
  useEffect(() => {
    setSimAnimating(true)
    const t = setTimeout(() => setSimAnimating(false), 800)
    return () => clearTimeout(t)
  }, [rowId, nodeType, count])

  const reserveStatus = result.newReserve > 30 ? 'ok' : result.newReserve > 20 ? 'watch' : 'critical'
  const coolingStatus = result.newDelta < 8 ? 'ok' : result.newDelta < 9 ? 'watch' : 'critical'
  const headroomStatus = result.headroom > 20 ? 'ok' : result.headroom > 10 ? 'watch' : 'critical'
  const breachStatus = result.breachProbability < 2 ? 'ok' : result.breachProbability < 5 ? 'watch' : 'critical'

  return (
    <div>
      <PageHeading
        title="Capacity Planner"
        subtitle="What-if on hall DC1 · cascade through UPS reserve, cooling delta and circuit headroom"
      />

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_SOFT} 100%)`, color: '#fff', borderRadius: 14, padding: '24px 28px', marginBottom: 20, position: 'relative' }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>Capacity Planner · Live What-If</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.9, maxWidth: 700 }}>
          Add hardware and watch the cascade run through UPS reserve, cooling delta and per-circuit headroom. Ten thousand Monte Carlo runs behind every answer, returned in about 24 seconds.
        </p>
      </div>

      {/* Input form */}
      <div style={{ background: '#fff', border: '1px solid #e8ecf1', borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>Plan a deployment</h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16, alignItems: 'flex-end' }}>
          {/* Row picker */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, display: 'block' }}>TARGET ROW</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {ROWS.map((r) => {
                const sel = rowId === r.id
                const pct = (r.baseLoad / r.capacity) * 100
                return (
                  <button key={r.id} onClick={() => setRowId(r.id)} style={{
                    padding: '8px 6px', cursor: 'pointer',
                    background: sel ? `${ACCENT}10` : '#f8fafc',
                    border: sel ? `2px solid ${ACCENT}` : '1px solid #e2e8f0',
                    borderRadius: 8, textAlign: 'left',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: sel ? ACCENT : '#1e293b' }}>Row {r.id}</div>
                    <div style={{ fontSize: 9, color: '#94a3b8' }}>{r.baseLoad} kW · {pct.toFixed(0)}%</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Node type */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, display: 'block' }}>HARDWARE</label>
            <select value={nodeType} onChange={(e) => setNodeType(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, background: '#f8fafc', color: '#1e293b', cursor: 'pointer' }}>
              {NODE_TYPES.map((n) => (
                <option key={n.id} value={n.id}>{n.label} · {n.kw} kW/node</option>
              ))}
            </select>
          </div>

          {/* Count input */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, display: 'block' }}>HOW MANY</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setCount((c) => Math.max(1, c - 1))} style={{ width: 36, padding: 8, fontSize: 14, fontWeight: 700, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer' }}>−</button>
              <input type="number" value={count} onChange={(e) => setCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))} style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontWeight: 800, color: ACCENT, textAlign: 'center', background: '#f8fafc' }} />
              <button onClick={() => setCount((c) => Math.min(50, c + 1))} style={{ width: 36, padding: 8, fontSize: 14, fontWeight: 700, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer' }}>+</button>
            </div>
          </div>
        </div>

        {/* Sim status */}
        <div style={{ marginTop: 14, padding: '10px 14px', background: simAnimating ? `${ACCENT}10` : `${result.safe ? GREEN : RED}10`, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {simAnimating ? (
              <>
                <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${ACCENT}`, borderTopColor: 'transparent', animation: 'simSpin 0.7s linear infinite' }} />
                <span style={{ fontSize: 12, color: ACCENT, fontWeight: 700 }}>Running 10,000 Monte Carlo scenarios…</span>
              </>
            ) : (
              <>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: result.safe ? GREEN : RED, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: result.safe ? '#166534' : '#991b1b', fontWeight: 700 }}>
                  {result.safe ? `SAFE to deploy · breach probability ${result.breachProbability.toFixed(1)}%` : `RISK · breach probability ${result.breachProbability.toFixed(1)}% · review constraints`}
                </span>
              </>
            )}
          </div>
          <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>+{result.addedKw.toFixed(1)} kW · {count} × {result.nodes.label}</span>
        </div>
        <style>{`@keyframes simSpin { to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* Cascade visualization */}
      <div style={{ background: '#fff', border: '1px solid #e8ecf1', borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Cascade Through Power Stages — Row {row.id}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>Live impact across UPS reserve · cooling delta · circuit headroom · Monte-Carlo probability</p>
          </div>
        </div>

        {/* 4 stage outcome pills */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
          <StagePill label="New rack load" value={result.newPct} unit="%" status={headroomStatus} sub={`+${result.addedKw.toFixed(1)} kW · was ${((row.baseLoad / row.capacity) * 100).toFixed(0)}%`} />
          <StagePill label={`UPS-${row.ups} reserve`} value={result.newReserve} unit=" min" status={reserveStatus} sub={`Δ ${(result.newReserve - row.reserve).toFixed(1)} min · target > 30 min`} />
          <StagePill label="Cooling Δ supply→return" value={result.newDelta} unit="°C" status={coolingStatus} sub={`${row.cooling} fan: 78% → ${(78 + result.addedKw * 0.5).toFixed(0)}%`} />
          <StagePill label="Breach probability" value={result.breachProbability} unit="%" status={breachStatus} sub="P(load > 80% threshold)" />
        </div>

        {/* MC distribution */}
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <h4 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1e293b' }}>Monte Carlo · 10K Scenario Distribution</h4>
            <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
              <span style={{ color: GREEN, fontWeight: 700 }}>P10 · {result.p10.toFixed(1)}%</span>
              <span style={{ color: ACCENT, fontWeight: 700 }}>P50 · {result.p50.toFixed(1)}%</span>
              <span style={{ color: AMBER, fontWeight: 700 }}>P90 · {result.p90.toFixed(1)}%</span>
            </div>
          </div>
          <MCDistribution p10={result.p10} p50={result.p50} p90={result.p90} />
        </div>

        {/* Apply button */}
        <div style={{ marginTop: 16, padding: 14, background: result.safe ? '#f0fdf4' : '#fef2f2', border: `1px solid ${result.safe ? GREEN : RED}30`, borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: result.safe ? '#166534' : '#991b1b', marginBottom: 2 }}>
              {result.safe ? `Deployment recommended · capacity available` : `Deployment NOT recommended · constraints breached`}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              {result.safe
                ? `Reserve PDU outlet on R-${row.id}${count} · auto-draft ENG ticket · flag procurement for cold-aisle expansion`
                : `Recommend reducing count to ${Math.max(1, count - 2)}, or distributing across Row D (52% loaded)`}
            </div>
          </div>
          <button disabled={!result.safe} onClick={() => setPending({
            title: `Reserve capacity for ${count}× ${result.nodes.label} in Row ${row.id}`,
            confidence: 100 - Math.round(result.breachProbability),
            impact: `+${result.addedKw.toFixed(1)} kW reserved · ENG ticket drafted · BMS lock applied · capacity guaranteed for Q3`,
            piTags: [
              { tag: `DC1_ROW_${row.id}_LOAD`, value: row.baseLoad.toString(), unit: 'kW' },
              { tag: `DC1_ROW_${row.id}_HEADROOM`, value: ((row.capacity - row.baseLoad) / row.capacity * 100).toFixed(1), unit: '%' },
              { tag: `DC1_UPS_${row.ups.replace('-bank', '')}_RESERVE`, value: row.reserve.toString(), unit: 'min' },
              { tag: `DC1_${row.cooling}_DELTA`, value: '6.4', unit: '°C' },
            ],
            cmmsRef: `ENG-DC1-Row${row.id}-${result.nodes.id.toUpperCase()}-x${count}`,
            verifyTag: `DC1_ROW_${row.id}_LOAD`,
            afterTags: [
              { tag: `DC1_ROW_${row.id}_LOAD`, value: result.newLoad.toFixed(1), unit: 'kW', delta: `+${result.addedKw.toFixed(1)}`, deltaNeutral: true },
              { tag: `DC1_ROW_${row.id}_HEADROOM`, value: result.headroom.toFixed(1), unit: '%', delta: `${result.safe ? '-' : '+'}${result.addedKw.toFixed(1)}`, deltaGood: result.safe },
              { tag: `DC1_UPS_${row.ups.replace('-bank', '')}_RESERVE`, value: result.newReserve.toFixed(1), unit: 'min', delta: `${(result.newReserve - row.reserve).toFixed(1)}`, deltaNeutral: true },
            ],
          })} style={{
            padding: '10px 18px', fontSize: 13, fontWeight: 700, color: '#fff',
            background: result.safe ? ACCENT : '#cbd5e1', border: 'none', borderRadius: 8,
            cursor: result.safe ? 'pointer' : 'not-allowed',
          }}>
            Reserve Capacity →
          </button>
        </div>
      </div>

      {reserved && (
        <div style={{ marginTop: 16, background: '#fff', border: `1px solid ${LINE}`, borderLeft: `3px solid ${GREEN}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>Capacity reserved</div>
          <div style={{ fontSize: 11.5, color: SUB, marginTop: 4, lineHeight: 1.55 }}>
            {reserved.title} · reference {reserved.cmmsRef}. {reserved.impact}
          </div>
          <button onClick={() => setReserved(null)}
            style={{ marginTop: 10, padding: '7px 14px', fontSize: 12, fontWeight: 600, color: SUB, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, cursor: 'pointer' }}>
            Release
          </button>
        </div>
      )}

      {/* Sample scenarios */}
      <div style={{ background: '#fff', border: '1px solid #e8ecf1', borderRadius: 14, padding: 18 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>Quick Scenarios</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
          {[
            { row: 'C', node: 'h100', n: 3, label: '+3 H100 in Row C', tip: 'The doc\'s signature example' },
            { row: 'D', node: 'h100', n: 8, label: '+8 H100 in Row D', tip: 'Headroom-rich row' },
            { row: 'C', node: 'b200', n: 4, label: '+4 B200 in Row C', tip: 'Higher-density GPU stress test' },
            { row: 'B', node: 'h100', n: 6, label: '+6 H100 in Row B', tip: 'Will it breach? (already 74%)' },
          ].map((s) => (
            <button key={s.label} onClick={() => { setRowId(s.row); setNodeType(s.node); setCount(s.n) }} style={{ background: '#f8fafc', borderWidth: '1px', borderStyle: 'solid', borderColor: '#e2e8f0', borderRadius: 10, padding: 12, textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.background = `${ACCENT}10` }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>{s.tip}</div>
            </button>
          ))}
        </div>
      </div>


      {pending && (
        <div role="dialog" aria-modal="true" onClick={() => setPending(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 60 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 14, width: 'min(680px, 100%)', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(15,23,42,0.28)' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${LINE}` }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>{pending.title}</div>
              <div style={{ fontSize: 11.5, color: MUTE, marginTop: 3 }}>Reference {pending.cmmsRef}</div>
            </div>

            <div style={{ padding: '18px 22px' }}>
              <div style={{ fontSize: 12, color: SUB, lineHeight: 1.6 }}>{pending.impact}</div>

              <div style={{ marginTop: 16, fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTE }}>What changes</div>
              <div style={{ marginTop: 8, border: `1px solid ${LINE}`, borderRadius: 10, overflow: 'hidden' }}>
                {pending.afterTags.map((t, i) => (
                  <div key={t.tag} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: i ? `1px solid ${LINE}` : 'none' }}>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5, color: SUB, minWidth: 0 }}>{t.tag}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: INK, whiteSpace: 'nowrap' }}>
                      {t.value} {t.unit}
                      {t.delta && <span style={{ fontSize: 11, fontWeight: 600, color: t.deltaNeutral ? SUB : t.deltaGood ? GREEN : AMBER, marginLeft: 6 }}>{t.delta}</span>}
                    </span>
                  </div>
                ))}
              </div>

              <p style={{ margin: '14px 0 0', fontSize: 11.5, color: SUB, lineHeight: 1.55 }}>
                Reserving holds the capacity against this row so a later plan cannot
                spend it twice. It does not energise anything — the work still goes
                through its own change record.
              </p>
            </div>

            <div style={{ padding: '14px 22px', borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setPending(null)}
                style={{ padding: '9px 16px', fontSize: 12.5, fontWeight: 600, color: SUB, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => { setReserved(pending); setPending(null) }}
                style={{ padding: '9px 18px', fontSize: 12.5, fontWeight: 700, color: '#fff', background: ACCENT, border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                Confirm reservation
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
