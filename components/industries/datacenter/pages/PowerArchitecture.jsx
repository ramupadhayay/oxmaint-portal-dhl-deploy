'use client'

// 800 VDC power architecture — grid to chip.
//
// Ported from the electrical portal on the iFactory platform and rebuilt on this
// portal's furniture rather than pasted across: PageHeading, MetricCard and
// Section, so it reads as the same product as the screens either side of it. The
// original ran on a hardware vendor's brand green as its second accent, which
// made it the only screen in either portal that did not look like the platform.
//
// What it is for: this estate is being converted from a conventional AC
// distribution to 800 VDC, and the case for that is an efficiency and a floor
// space number. The screen shows the conversion chain as it actually runs, so
// the numbers have something behind them.
//
// Values are fixtures, not persisted records — nothing here writes to the store.

import { Section, PALETTE } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import MetricCard, { MetricGrid } from '../components/MetricCard'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, AMBER } = PALETTE
const ACCENT_SOFT = '#3a4a9f'

// One conversion at the head of the hall, then DC the rest of the way. Each
// stage carries what it is rated at and what it is doing now.
const STAGES = [
  { id: 1, label: 'Grid feed', sub: 'Utility intake · 11 kV', value: '11', unit: 'kV', tone: ACCENT },
  { id: 2, label: 'Rectifier', sub: 'AC → 800 VDC · 1.2 MW', value: '1.2', unit: 'MW', tone: ACCENT },
  { id: 3, label: 'Main DC bus', sub: '800 VDC · hall DC1', value: '794', unit: 'kW', tone: ACCENT_SOFT },
  { id: 4, label: 'Rack PDU', sub: '12 racks on the bus', value: '12', unit: 'racks', tone: ACCENT_SOFT },
  { id: 5, label: 'Node', sub: 'GPU node · 700 W each', value: '3.6', unit: 'kW/node', tone: '#7c3aed' },
]

const LINKS = [
  'Step-down · 11 kV → 800 VDC',
  'DC bus · 800 VDC at 992 A',
  'Rack feed · bus → PDU',
  'Node feed · 48 V at the core',
]

// Eight racks on the hall floor. Fixed per-rack figures, not a random walk: this
// renders on the server as well as the client, and a random number would give
// each a different answer and fail hydration.
const RACKS = [
  { id: 'R-C1', nodes: 12, kw: 92.4, inlet: 22.4 },
  { id: 'R-C2', nodes: 12, kw: 88.1, inlet: 22.1 },
  { id: 'R-C3', nodes: 12, kw: 94.7, inlet: 23.0 },
  { id: 'R-C4', nodes: 12, kw: 90.2, inlet: 22.6 },
  { id: 'R-C5', nodes: 12, kw: 86.9, inlet: 21.9 },
  { id: 'R-C6', nodes: 12, kw: 91.5, inlet: 22.8 },
  { id: 'R-C7', nodes: 8, kw: 60.0, inlet: 21.4 },
  { id: 'R-C8', nodes: 0, kw: 0, inlet: 20.8 },
]

const COMPARISON = [
  { k: 'End-to-end conversion efficiency', now: '97.2%', was: '92.0%' },
  { k: 'Rack power density', now: '90 kW', was: '30 kW' },
  { k: 'Floor space per MW', now: '68 m²', was: '110 m²' },
  { k: 'Conversion stages in the path', now: '1', was: '4' },
]

const WHY = [
  { t: 'One conversion, not four', b: 'AC becomes 800 VDC once, at the head of the hall. A conventional build converts again at the UPS, at the PDU and at the node, and pays a loss at each step.', c: ACCENT },
  { t: 'Copper follows current', b: 'At 800 V the same power needs a fraction of the conductor an AC feed does. That is where the floor space is recovered.', c: '#0d9488' },
  { t: 'Fewer parts in the path', b: 'No per-rack transformer or rectifier stage means fewer components between the bus and the node, and fewer things that can fail.', c: ACCENT_SOFT },
]

function rackTone(kw) {
  if (kw === 0) return MUTE
  if (kw > 92) return AMBER
  return ACCENT_SOFT
}

export default function PowerArchitecture() {
  return (
    <div>
      <PageHeading
        title="Power Architecture"
        subtitle="800 VDC distribution · grid to chip · hall DC1"
      />

      <MetricGrid>
        <MetricCard title="Conversion efficiency" value="97.2" unit="%" note="against 92.0% on the AC architecture it replaces" variant="success" />
        <MetricCard title="Rack density" value="90" unit="kW" note="a conventional air-cooled rack carries 30 kW" />
        <MetricCard title="Floor space per MW" value="68" unit="m²" note="110 m² for an equivalent AC build" />
        <MetricCard title="Conversion stages" value="1" note="AC to DC once, at the head of the hall" />
      </MetricGrid>

      <Section title="Grid → chip" right={<span style={{ fontSize: 11.5, color: MUTE }}>hall DC1 · live</span>}>
        {/* Stages read left to right; the link under each says what carries the
            power to the next one, which is the part a reader asks about. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, alignItems: 'stretch' }}>
          {STAGES.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderTop: `3px solid ${s.tone}`, borderRadius: 12, padding: 16, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: MUTE }}>Stage {s.id}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginTop: 4, lineHeight: 1.3 }}>{s.label}</div>
                <div style={{ fontSize: 11.5, color: SUB, marginTop: 3, lineHeight: 1.45 }}>{s.sub}</div>
                <div style={{ marginTop: 'auto', paddingTop: 12, display: 'flex', alignItems: 'baseline', gap: 5 }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: s.tone, lineHeight: 1 }}>{s.value}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: MUTE }}>{s.unit}</span>
                </div>
              </div>
              {/* The last stage has no link under it. Rendering nothing there let
                  its card absorb the leftover height and stand taller than the
                  four beside it, so the row gets a spacer instead. */}
              <div style={{ fontSize: 10.5, color: SUB, textAlign: 'center', marginTop: 8, lineHeight: 1.4, minHeight: 15 }}>
                {LINKS[i] ? `↓ ${LINKS[i]}` : ''}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Hall floor" right={<span style={{ fontSize: 11.5, color: MUTE }}>8 racks · draw and inlet temperature</span>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
          {RACKS.map((r) => {
            const tone = rackTone(r.kw)
            const fill = Math.min(100, (r.kw / 100) * 100)
            return (
              <div key={r.id} style={{ background: r.kw ? '#fff' : '#f8fafc', border: `1px solid ${LINE}`, borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: INK }}>{r.id}</div>
                <div style={{ height: 64, background: '#f1f5f9', borderRadius: 4, position: 'relative', margin: '8px 0', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${fill}%`, background: tone, opacity: r.kw ? 0.85 : 0 }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 800, color: tone }}>{r.kw ? r.kw.toFixed(1) : '—'}<span style={{ fontSize: 10, fontWeight: 600, color: MUTE }}> kW</span></div>
                <div style={{ fontSize: 10, color: MUTE, marginTop: 2 }}>{r.nodes ? `${r.nodes} nodes` : 'empty'} · {r.inlet.toFixed(1)}°C</div>
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Against the AC build it replaces">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
          {COMPARISON.map((c) => (
            <div key={c.k} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11.5, color: SUB, lineHeight: 1.4 }}>{c.k}</div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: GREEN }}>{c.now}</span>
                <span style={{ fontSize: 12, color: MUTE, textDecoration: 'line-through' }}>{c.was}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Where the gain comes from">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14, alignItems: 'stretch' }}>
          {WHY.map((w) => (
            <div key={w.t} style={{ background: '#fff', border: `1px solid ${LINE}`, borderLeft: `3px solid ${w.c}`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{w.t}</div>
              <p style={{ margin: '6px 0 0', fontSize: 11.5, color: SUB, lineHeight: 1.55 }}>{w.b}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
