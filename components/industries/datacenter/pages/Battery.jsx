'use client'

// Battery Monitoring — the UPS strings, cell by cell, and what the portal does
// when a cell starts to go.
//
// The register underneath was a flat list of cell readings. Internal resistance
// is the whole point of this screen: it rises long before a cell fails a
// discharge test, so a string is only worth reading cell-by-cell if a rising
// cell is turned into work. This aggregates the cells into their strings, ranks
// them by the worst cell, draws the condition flow the reading feeds, and lets a
// weak string raise the replacement work order it needs — which then flows into
// inspection and maintenance like any other job.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Section, DataTable, StatusBadge, ActionButton, PALETTE } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { FEEDS, nextWorkOrderNumber } from '../lib/data'
import { useWorkOrderStore } from '../lib/store'
import { useWorkOrders } from './WorkOrders'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, AMBER, RED, BLUE } = PALETTE

// A cell is flagged when its internal resistance has risen well above the ~1.0mΩ
// baseline, or its state of health has dropped — the two early signals.
const IR_WATCH = 1.15
const IR_HIGH = 1.4
const SOH_WATCH = 92
const num = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : null)

// The live pipeline stage a flagged string has reached — shown inline on the
// alert itself, the way a real console shows an in-flight event, not as a
// separate diagram of how the system works.
const PIPELINE = ['IR rising', 'Auditor confirmed', 'Predictive: cell EoL', 'Work order']

// A deterministic "N min ago" so an alert reads as freshly detected without a clock in render.
const dhash = (s) => { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619) } return Math.abs(h) }
const ago = (s) => `${2 + dhash(s) % 26} min ago`

export default function Battery() {
  const router = useRouter()
  const go = (to) => to && router.push(`/portal/datacenter/${to}`)
  const woStore = useWorkOrderStore()
  const existing = useWorkOrders()
  const [raising, setRaising] = useState(null)
  const [raised, setRaised] = useState({})

  // Aggregate the latest reading per cell into the string it belongs to.
  const strings = useMemo(() => {
    const by = new Map()
    for (const r of FEEDS.Battery) {
      const key = r.assetId || r._asset || 'string'
      const ir = num(r.internalResistance)
      const soh = num(r.stateOfHealth)
      const g = by.get(key) || { assetId: r.assetId, asset: r._asset || r.assetId, site: r._site || r.siteId, siteId: r.siteId, cells: 0, worstIR: 0, minSoH: 100, worstCell: null }
      g.cells += 1
      if (ir != null && ir > g.worstIR) { g.worstIR = ir; g.worstCell = r.cellRef }
      if (soh != null && soh < g.minSoH) g.minSoH = soh
      by.set(key, g)
    }
    return [...by.values()].map((g) => ({
      ...g,
      _band: g.worstIR >= IR_HIGH || g.minSoH < 88 ? 'red' : g.worstIR >= IR_WATCH || g.minSoH < SOH_WATCH ? 'amber' : 'green',
    })).sort((a, b) => b.worstIR - a.worstIR)
  }, [])

  const flagged = strings.filter((s) => s._band !== 'green')

  const stats = [
    { label: 'UPS strings', value: strings.length, icon: 'list' },
    { label: 'Cells monitored', value: strings.reduce((n, s) => n + s.cells, 0), note: 'per-cell IR / SoH' },
    { label: 'Cells flagged', value: flagged.length, tone: flagged.length ? 'amber' : 'green', note: 'rising internal resistance' },
    { label: 'Worst cell IR', value: strings[0] ? strings[0].worstIR.toFixed(2) : '—', unit: 'mΩ', tone: strings[0]?._band === 'red' ? 'red' : strings[0]?._band === 'amber' ? 'amber' : undefined, note: '~1.0 mΩ baseline' },
    { label: 'Lowest SoH', value: strings.length ? Math.min(...strings.map((s) => s.minSoH)) : '—', unit: '%', tone: 'blue' },
  ]

  const raiseFor = async (s) => {
    if (raising || raised[s.assetId]) return
    setRaising(s.assetId)
    try {
      const number = nextWorkOrderNumber(existing)
      const rec = await woStore.create({
        workOrderId: number,
        dateRaised: new Date().toISOString().slice(0, 10),
        assetId: s.assetId,
        siteId: s.siteId || null,
        triggerSource: 'Condition-Based · Battery Monitoring',
        alertId: null,
        priority: s._band === 'red' ? 'Critical' : 'High',
        description: `${s.asset}: internal resistance on ${s.worstCell || 'a cell'} has risen to ${s.worstIR.toFixed(2)} mΩ (baseline ~1.0 mΩ), lowest state of health ${s.minSoH}%. Rising IR precedes a failed discharge — inspect the string and hot-swap the affected cell.`,
        action: `Impedance-test the string, confirm the weak cell, and hot-swap it within the maintenance window; verify reserve runtime restored.`,
        assignedTo: 'Battery Vendor',
        status: 'Open', dateCompleted: null, outcome: null, feedback: null,
      })
      if (rec) setRaised((r) => ({ ...r, [s.assetId]: number }))
    } finally { setRaising(null) }
  }

  const rows = FEEDS.Battery.map((r) => {
    const ir = num(r.internalResistance); const soh = num(r.stateOfHealth)
    return { ...r, _band: ir >= IR_HIGH || (soh != null && soh < 88) ? 'red' : ir >= IR_WATCH || (soh != null && soh < SOH_WATCH) ? 'amber' : 'green' }
  }).sort((a, b) => num(b.internalResistance) - num(a.internalResistance))

  const irTone = (b) => (b === 'red' ? RED : b === 'amber' ? '#b45309' : SUB)
  const columns = [
    { key: '_asset', label: 'String', render: (r) => <span style={{ fontWeight: 600, color: INK }}>{r._asset}</span> },
    { key: 'cellRef', label: 'Cell', width: 150, render: (r) => <span style={{ fontSize: 12, color: SUB }}>{r.cellRef}</span> },
    { key: 'cellVoltage', label: 'Cell V', align: 'right', width: 80, render: (r) => `${r.cellVoltage} V` },
    { key: 'internalResistance', label: 'IR', align: 'right', width: 100, render: (r) => <span style={{ color: irTone(r._band), fontWeight: r._band === 'green' ? 400 : 700 }}>{r.internalResistance} mΩ</span> },
    { key: 'stateOfHealth', label: 'SoH', align: 'right', width: 90, render: (r) => <strong style={{ color: r._band === 'red' ? RED : INK }}>{r.stateOfHealth}%</strong> },
    { key: '_flag', label: '', width: 120, sortable: false, render: (r) => (r._band === 'green' ? <span style={{ fontSize: 11, color: '#cbd5e1' }}>Normal</span> : <StatusBadge tone={r._band === 'red' ? 'red' : 'amber'}>{r._band === 'red' ? 'Replace' : 'Watch'}</StatusBadge>) },
  ]

  return (
    <div>
      <PageHeading
        title="Battery Monitoring"
        subtitle="Cell-level voltage, internal resistance and state of health across the UPS strings — and the replacement work a rising cell raises. Internal resistance is the early signal."
      />

      <StatCards items={stats} />

      {flagged.length > 0 && (
        <Section title="Active alerts" right={<span style={styles.live}><span style={styles.pulse} />{flagged.length} open · auto-triaged</span>}>
          <div style={{ display: 'grid', gap: 10 }}>
            {flagged.map((s) => (
              <div key={s.assetId} style={{ ...styles.alert, borderLeft: `3px solid ${s._band === 'red' ? RED : AMBER}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <StatusBadge tone={s._band === 'red' ? 'red' : 'amber'}>{s._band === 'red' ? 'Replace due' : 'Watch'}</StatusBadge>
                      <span style={styles.alertTitle}>{s.asset}</span>
                      <span style={styles.alertMeta}>{s.worstCell} · IR {s.worstIR.toFixed(2)} mΩ · SoH {s.minSoH}%</span>
                      <span style={styles.alertTime}>detected {ago(s.assetId)}</span>
                    </div>
                    <div style={styles.pipe}>
                      {PIPELINE.map((p, i) => (
                        <span key={p} style={styles.pipeItem}>
                          <span style={{ ...styles.pipeDot, background: i < 3 ? GREEN : (s._band === 'red' ? RED : AMBER) }} />
                          <span style={{ ...styles.pipeLabel, color: i < 3 ? SUB : INK, fontWeight: i < 3 ? 500 : 700 }}>{p}{i === 3 ? ' · pending' : ''}</span>
                          {i < PIPELINE.length - 1 && <span style={styles.pipeArrow}>›</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button onClick={() => go('ups-health')} style={styles.link}>UPS health →</button>
                    {raised[s.assetId]
                      ? <ActionButton variant="success" onClick={() => router.push(`/portal/datacenter/work-orders/${encodeURIComponent(raised[s.assetId])}`)}>✓ {raised[s.assetId]} — view</ActionButton>
                      : <ActionButton variant="primary" onClick={() => raiseFor(s)} disabled={raising === s.assetId}>{raising === s.assetId ? 'Raising…' : 'Raise work order'}</ActionButton>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Strings">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
          {strings.map((s) => {
            const c = s._band === 'red' ? RED : s._band === 'amber' ? AMBER : GREEN
            return (
              <div key={s.assetId} style={{ ...styles.card, borderColor: s._band === 'red' ? '#fecaca' : s._band === 'amber' ? '#fde68a' : LINE }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{s.asset}</div>
                    <div style={{ fontSize: 11.5, color: MUTE, marginTop: 2 }}>{s.site} · {s.cells} cells</div>
                  </div>
                  <StatusBadge tone={s._band === 'red' ? 'red' : s._band === 'amber' ? 'amber' : 'green'}>{s._band === 'red' ? 'Replace due' : s._band === 'amber' ? 'Watch' : 'Healthy'}</StatusBadge>
                </div>
                <div style={{ display: 'flex', gap: 18, marginTop: 14 }}>
                  <div><div style={styles.metricK}>Worst cell IR</div><div style={{ ...styles.metricV, color: c }}>{s.worstIR.toFixed(2)} mΩ</div></div>
                  <div><div style={styles.metricK}>Lowest SoH</div><div style={styles.metricV}>{s.minSoH}%</div></div>
                </div>
                {s.worstCell && <div style={{ fontSize: 11, color: MUTE, marginTop: 8 }}>Worst: {s.worstCell}</div>}
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Cell readings" right={<span style={styles.note}>ranked by internal resistance · updated {ago('battery-feed')}</span>}>
        <DataTable columns={columns} rows={rows} pageSize={12} empty="No cell readings." />
      </Section>
    </div>
  )
}

const styles = {
  note: { fontSize: 11.5, color: MUTE },
  live: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#b45309', fontWeight: 600 },
  pulse: { width: 8, height: 8, borderRadius: '50%', background: AMBER, flexShrink: 0, boxShadow: '0 0 0 3px #fffbeb' },
  card: { background: '#fff', border: '1px solid', borderRadius: 12, padding: 16 },
  metricK: { fontSize: 10, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 },
  metricV: { fontSize: 16, fontWeight: 800, color: INK, marginTop: 2, fontVariantNumeric: 'tabular-nums' },
  link: { background: 'none', border: 'none', color: '#15227a', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  alert: { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, padding: '12px 14px 12px 13px' },
  alertTitle: { fontSize: 13, fontWeight: 800, color: INK },
  alertMeta: { fontSize: 11.5, color: SUB, fontVariantNumeric: 'tabular-nums' },
  alertTime: { fontSize: 11, color: MUTE, marginLeft: 'auto' },
  pipe: { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 9 },
  pipeItem: { display: 'inline-flex', alignItems: 'center', gap: 5 },
  pipeDot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  pipeLabel: { fontSize: 11 },
  pipeArrow: { color: '#cbd5e1', fontSize: 12, margin: '0 3px' },
}
