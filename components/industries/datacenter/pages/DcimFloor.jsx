'use client'

// DCIM floor — what is drawing power, where, and how hot it is getting.
//
// Ported from the electrical portal and rebuilt on this portal's furniture. The
// condition-monitoring screens beside it answer "is this asset healthy"; this one
// answers "is this hall full", which is the other question a data-centre operator
// asks every day.
//
// Fixtures only, no persisted records.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Section, DataTable, StatusBadge, ActionButton, PALETTE } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import MetricCard, { MetricGrid } from '../components/MetricCard'
import { useWorkOrderStore } from '../lib/store'
import { useWorkOrders } from './WorkOrders'
import { nextWorkOrderNumber } from '../lib/data'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, AMBER, RED } = PALETTE

// Four halls. Design is what the room was built to carry; drawn is now.
const HALLS = [
  { id: 'DC1', name: 'Hall DC1 · AI compute', design: 1200, drawn: 794, racks: 12, filled: 11, pue: 1.18, inlet: 22.6, state: 'ok' },
  { id: 'DC2', name: 'Hall DC2 · general compute', design: 900, drawn: 712, racks: 18, filled: 17, pue: 1.31, inlet: 23.4, state: 'watch' },
  { id: 'DC3', name: 'Hall DC3 · storage', design: 600, drawn: 268, racks: 14, filled: 9, pue: 1.27, inlet: 22.1, state: 'ok' },
  { id: 'DC4', name: 'Hall DC4 · fit-out', design: 900, drawn: 0, racks: 16, filled: 0, pue: null, inlet: 20.4, state: 'idle' },
]

const TONE = { ok: 'success', watch: 'warning', idle: 'neutral' }
const LABEL = { ok: 'Within design', watch: 'Approaching design', idle: 'Not energised' }

// Rows are the containment aisles, which is the unit a floor walk is done in.
const AISLES = [
  { aisle: 'DC1 · A1', racks: 6, kw: 548.2, inlet: 22.4, ret: 34.1, dp: 11.7, alarm: null },
  { aisle: 'DC1 · A2', racks: 6, kw: 245.6, inlet: 22.8, ret: 33.2, dp: 10.4, alarm: null },
  { aisle: 'DC2 · B1', racks: 9, kw: 402.7, inlet: 23.1, ret: 36.8, dp: 13.7, alarm: 'Return air 36.8°C — 1.8°C above the aisle target', cool: { unit: 'CRAH-2B (Vertiv Liebert)', assetId: 'DCF-CRAH-2B', siteId: 'DC2' } },
  { aisle: 'DC2 · B2', racks: 9, kw: 309.4, inlet: 23.6, ret: 35.0, dp: 11.4, alarm: null },
  { aisle: 'DC3 · C1', racks: 7, kw: 148.9, inlet: 22.0, ret: 31.6, dp: 9.6, alarm: null },
  { aisle: 'DC3 · C2', racks: 7, kw: 119.3, inlet: 22.2, ret: 31.1, dp: 8.9, alarm: null },
]

const COLUMNS = [
  { key: 'aisle', label: 'Aisle', width: 130 },
  { key: 'racks', label: 'Racks', align: 'right', width: 70 },
  { key: 'kw', label: 'Drawn', align: 'right', width: 100, render: (r) => `${r.kw.toFixed(1)} kW` },
  { key: 'inlet', label: 'Inlet', align: 'right', width: 80, render: (r) => `${r.inlet.toFixed(1)}°C` },
  { key: 'ret', label: 'Return', align: 'right', width: 90, render: (r) => (
    <span style={{ color: r.ret > 36 ? AMBER : SUB, fontWeight: r.ret > 36 ? 700 : 400 }}>{r.ret.toFixed(1)}°C</span>
  ) },
  { key: 'dp', label: 'ΔT', align: 'right', width: 70, render: (r) => `${r.dp.toFixed(1)} K` },
  { key: 'alarm', label: 'Note', render: (r) => r.alarm
    ? <span style={{ color: AMBER, fontSize: 11.5 }}>{r.alarm}</span>
    : <span style={{ color: MUTE, fontSize: 11.5 }}>—</span> },
]

const totalDesign = HALLS.reduce((a, h) => a + h.design, 0)
const totalDrawn = HALLS.reduce((a, h) => a + h.drawn, 0)
const totalRacks = HALLS.reduce((a, h) => a + h.racks, 0)
const filledRacks = HALLS.reduce((a, h) => a + h.filled, 0)

// The live triage state a flagged aisle has reached — shown inline on the alert,
// the way a console shows an in-flight event.
const PIPELINE = ['Return air high', 'Auditor confirmed', 'Work order', 'Inspection']
const dhash = (s) => { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619) } return Math.abs(h) }
const ago = (s) => `${2 + dhash(s) % 26} min ago`

export default function DcimFloor() {
  const router = useRouter()
  const woStore = useWorkOrderStore()
  const existing = useWorkOrders()
  const [raising, setRaising] = useState(null)
  const [raised, setRaised] = useState({})
  const go = (to) => to && router.push(`/portal/datacenter/${to}`)

  // Aisles the floor is flagging — where the automated loop actually fires.
  const attention = AISLES.filter((a) => a.alarm)

  // Raise the work order the AI Auditor would raise off this aisle's condition —
  // a real record, Condition-Based, that then flows into inspection and
  // maintenance like any other job on the register.
  const raiseForAisle = async (a) => {
    if (raising || raised[a.aisle]) return
    setRaising(a.aisle)
    try {
      const number = nextWorkOrderNumber(existing)
      const rec = await woStore.create({
        workOrderId: number,
        dateRaised: new Date().toISOString().slice(0, 10),
        assetId: a.cool?.assetId || `DCF-${a.aisle.replace(/[^A-Za-z0-9]/g, '').slice(-4)}`,
        siteId: a.cool?.siteId || null,
        triggerSource: 'Condition-Based · DCIM Floor',
        alertId: null,
        priority: 'High',
        description: `${a.aisle}: ${a.alarm}. Cooling unit ${a.cool?.unit || 'serving this aisle'} to be inspected — return-air temperature is above the aisle target on the DCIM floor telemetry (drawn ${a.kw.toFixed(0)} kW, ΔT ${a.dp.toFixed(1)} K).`,
        action: `Inspect and service the cooling unit for ${a.aisle}; verify airflow, filter condition and set-points, then confirm return air back within target.`,
        assignedTo: 'Site Engineering',
        status: 'Open', dateCompleted: null, outcome: null, feedback: null,
      })
      if (rec) setRaised((r) => ({ ...r, [a.aisle]: number }))
    } finally { setRaising(null) }
  }

  return (
    <div>
      <PageHeading
        title="DCIM Floor"
        subtitle="Four halls · power drawn against design, and the thermal picture"
      />

      <MetricGrid>
        <MetricCard title="Load on the estate" value={((totalDrawn / totalDesign) * 100).toFixed(0)} unit="%" note={`${totalDrawn.toLocaleString()} kW drawn of ${totalDesign.toLocaleString()} kW installed`} />
        <MetricCard title="Racks energised" value={`${filledRacks}`} unit={`of ${totalRacks}`} note="DC4 is fitted out but not yet energised" />
        <MetricCard title="Best hall PUE" value="1.18" note="DC1 · the 800 VDC hall" variant="success" />
        <MetricCard title="Aisles above target" value="1" note="DC2 · B1 return air 1.8°C over" variant="warning" />
      </MetricGrid>

      {attention.length > 0 && (
        <Section title="Active alerts" right={<span style={styles.live}><span style={styles.pulse} />{attention.length} open · auto-triaged</span>}>
          <div style={{ display: 'grid', gap: 10 }}>
            {attention.map((a) => (
              <div key={a.aisle} style={{ ...styles.alert, borderLeft: `3px solid ${AMBER}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <StatusBadge tone="warning">Return air over target</StatusBadge>
                      <span style={styles.alertTitle}>{a.aisle}</span>
                      <span style={styles.alertMeta}>{a.racks} racks · {a.kw.toFixed(0)} kW · ret {a.ret.toFixed(1)}°C · ΔT {a.dp.toFixed(1)} K</span>
                      <span style={styles.alertTime}>detected {ago(a.aisle)}</span>
                    </div>
                    <div style={styles.pipe}>
                      {PIPELINE.map((p, i) => (
                        <span key={p} style={styles.pipeItem}>
                          <span style={{ ...styles.pipeDot, background: i < 2 ? GREEN : AMBER }} />
                          <span style={{ ...styles.pipeLabel, color: i < 2 ? SUB : INK, fontWeight: i < 2 ? 500 : 700 }}>{p}{i === 2 ? ' · pending' : ''}</span>
                          {i < PIPELINE.length - 1 && <span style={styles.pipeArrow}>›</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button onClick={() => go('monitoring')} style={styles.link}>Monitoring →</button>
                    {raised[a.aisle]
                      ? <ActionButton variant="success" onClick={() => router.push(`/portal/datacenter/work-orders/${encodeURIComponent(raised[a.aisle])}`)}>✓ {raised[a.aisle]} — view</ActionButton>
                      : <ActionButton variant="primary" onClick={() => raiseForAisle(a)} disabled={raising === a.aisle}>{raising === a.aisle ? 'Raising…' : 'Raise work order'}</ActionButton>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Halls">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, alignItems: 'stretch' }}>
          {HALLS.map((h) => {
            const pct = h.design ? (h.drawn / h.design) * 100 : 0
            const tone = h.state === 'watch' ? AMBER : h.state === 'idle' ? MUTE : GREEN
            return (
              <div key={h.id} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{h.name}</div>
                    <div style={{ fontSize: 11.5, color: MUTE, marginTop: 2 }}>{h.filled} of {h.racks} racks energised</div>
                  </div>
                  <StatusBadge tone={TONE[h.state]}>{LABEL[h.state]}</StatusBadge>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: SUB, marginBottom: 5 }}>
                    <span>{h.drawn.toLocaleString()} kW drawn</span>
                    <span style={{ color: MUTE }}>{h.design.toLocaleString()} kW design</span>
                  </div>
                  <div style={{ height: 8, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: tone, borderRadius: 999 }} />
                  </div>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: 14, display: 'flex', gap: 18 }}>
                  <div>
                    <div style={{ fontSize: 10, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>PUE</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: h.pue ? INK : MUTE }}>{h.pue ? h.pue.toFixed(2) : '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Inlet</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>{h.inlet.toFixed(1)}°C</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Headroom</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>{(h.design - h.drawn).toLocaleString()} kW</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Containment aisles" right={<span style={{ fontSize: 11.5, color: MUTE }}>the unit a floor walk is done in</span>}>
        <DataTable columns={COLUMNS} rows={AISLES} pageSize={10} />
      </Section>
    </div>
  )
}

const styles = {
  note: { fontSize: 11.5, color: MUTE },
  live: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#b45309', fontWeight: 600 },
  pulse: { width: 8, height: 8, borderRadius: '50%', background: AMBER, flexShrink: 0, boxShadow: '0 0 0 3px #fffbeb' },
  alert: { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, padding: '12px 14px 12px 13px' },
  alertTitle: { fontSize: 13, fontWeight: 800, color: INK },
  alertMeta: { fontSize: 11.5, color: SUB, fontVariantNumeric: 'tabular-nums' },
  alertTime: { fontSize: 11, color: MUTE, marginLeft: 'auto' },
  pipe: { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 9 },
  pipeItem: { display: 'inline-flex', alignItems: 'center', gap: 5 },
  pipeDot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  pipeLabel: { fontSize: 11 },
  pipeArrow: { color: '#cbd5e1', fontSize: 12, margin: '0 3px' },
  flow: { display: 'flex', alignItems: 'stretch', gap: 6, flexWrap: 'wrap', overflowX: 'auto', paddingBottom: 2 },
  flowItem: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 },
  step: {
    display: 'flex', alignItems: 'center', gap: 9, padding: '10px 13px', minWidth: 170,
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 11, fontFamily: 'inherit', textAlign: 'left',
  },
  stepNum: {
    flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: '#eef2ff', color: ACCENT,
    fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  stepLabel: { display: 'block', fontSize: 12.5, fontWeight: 700, color: INK, lineHeight: 1.3 },
  stepSub: { display: 'block', fontSize: 10.5, color: MUTE, marginTop: 2, lineHeight: 1.35 },
  arrow: { color: '#94a3b8', fontSize: 16, fontWeight: 700, flexShrink: 0 },
  flowNote: { marginTop: 12, fontSize: 12, color: SUB, lineHeight: 1.6, background: '#f8fafc', border: `1px solid ${LINE}`, borderRadius: 10, padding: '10px 13px' },
  attn: {
    display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between',
    padding: '13px 15px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12,
  },
  attnTitle: { fontSize: 13.5, fontWeight: 800, color: INK },
  attnMeta: { fontSize: 11.5, color: SUB },
  attnAlarm: { fontSize: 12.5, color: '#b45309', marginTop: 6, fontWeight: 600 },
  attnNext: { fontSize: 12, color: SUB, marginTop: 5, lineHeight: 1.5 },
  link: { background: 'none', border: 'none', color: '#15227a', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
}
