'use client'

// The Asset Intelligence Connector — not a list of systems, but the wiring
// diagram of the platform: every source it reads from, the intelligence layer it
// feeds, and the operational work that comes out the other side.
//
// The register underneath answered "which systems" and stopped there. The point
// of the connector is the flow: an existing BMS or a new vibration sensor is only
// worth listing because of what its reading becomes — a correlation, an alert, a
// condition-based work order, an inspection. This screen draws that end to end
// and lets a reader step from any source straight to its live feed and from the
// intelligence layer to the work it raises.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Section, DataTable, StatusBadge, PALETTE } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { SYSTEMS, listOf } from '../lib/data'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, AMBER, BLUE } = PALETTE

// deterministic per-system status/sync — no clock, no random
const hash = (s) => { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619) } return Math.abs(h) }

// Where each source's own live data lives in the portal, so a source in the
// diagram is one click from the feed it streams.
const ROUTE = {
  'SYS-BMS': 'bms', 'SYS-EPMS': 'epms', 'SYS-DCIM': 'dcim-floor', 'SYS-OEM': 'oem',
  'SYS-BAT': 'battery', 'SYS-CMMS': 'work-orders', 'SYS-AST': 'assets', 'SYS-INC': 'incidents',
  'SYS-VIB': 'monitoring', 'SYS-THM': 'monitoring', 'SYS-USN': 'monitoring',
}

const GROUPS = [
  { key: 'ot', label: 'Existing OT platforms', match: (s) => /OT Platform/.test(s.systemType) },
  { key: 'vendor', label: 'Vendor / OEM platforms', match: (s) => /Vendor/.test(s.systemType) },
  { key: 'ent', label: 'Enterprise systems', match: (s) => /Enterprise/.test(s.systemType) },
  { key: 'new', label: 'New sensing (PoC)', match: (s) => /New/.test(s.systemType), isNew: true },
]

const INTELLIGENCE = [
  { label: 'Correlation engine', sub: 'One reading against another, across sources', to: 'correlation' },
  { label: 'AI Auditor', sub: 'Condition-based, not a bare threshold', to: 'trend' },
  { label: 'Predictive models', sub: 'Remaining useful life, failure probability', to: 'recommendations' },
]
const OUTCOMES = [
  { label: 'Monitoring feeds', sub: 'Live, per asset', to: 'monitoring' },
  { label: 'Alerts', sub: 'Reviewed, severity-graded', to: 'alerts' },
  { label: 'Condition-based work orders', sub: 'Raised automatically', to: 'work-orders' },
  { label: 'Inspections', sub: 'Conducted, closed the loop', to: 'inspection-reports' },
]

const shortName = (s) => s.systemName.replace(/\s*\(.*\)\s*$/, '').replace(/ System.*| Platform.*| Information| History| Monitoring.*/, '').trim() || s.systemName

export default function Systems() {
  const router = useRouter()
  const go = (to) => to && router.push(`/portal/datacenter/${to}`)
  const [open, setOpen] = useState(null)

  const total = SYSTEMS.length
  const existing = SYSTEMS.filter((s) => !/New/.test(s.systemType)).length
  const sensing = SYSTEMS.filter((s) => /New/.test(s.systemType)).length
  const protocols = [...new Set(SYSTEMS.flatMap((s) => listOf(s.protocol)))].length

  const stats = [
    { label: 'Systems connected', value: total, icon: 'list' },
    { label: 'Existing platforms', value: existing, note: 'Read, not replaced' },
    { label: 'New sensing', value: sensing, tone: 'blue', note: 'Vibration · thermal · ultrasound' },
    { label: 'Protocols spoken', value: protocols, note: 'BACnet · Modbus · API · wireless' },
    { label: 'Integration', value: '100%', tone: 'green', note: 'All sources mapped' },
  ]

  const rows = SYSTEMS.map((s) => ({
    ...s,
    _points: 40 + hash(s.systemId) % 460,
    _status: 'Connected',
    _sync: /New/.test(s.systemType) ? `${1 + hash(s.systemId + 'q') % 15} min ago` : `${1 + hash(s.systemId) % 9} min ago`,
    _route: ROUTE[s.systemId],
  }))

  const columns = [
    { key: 'systemId', label: 'System', width: 100, render: (s) => <span style={styles.mono}>{s.systemId}</span> },
    { key: 'systemName', label: 'Name', render: (s) => <span style={{ fontWeight: 600, color: INK }}>{shortName(s)}</span> },
    { key: 'systemType', label: 'Type', width: 190, render: (s) => <StatusBadge tone={/New/.test(s.systemType) ? 'blue' : 'grey'}>{s.systemType}</StatusBadge> },
    { key: 'protocol', label: 'Protocol', width: 170, render: (s) => <span style={{ fontSize: 11.5, color: SUB }}>{s.protocol}</span> },
    { key: '_points', label: 'Points', align: 'right', width: 80, render: (s) => <span style={{ fontVariantNumeric: 'tabular-nums', color: INK, fontWeight: 600 }}>{s._points}</span> },
    { key: '_status', label: 'Status', width: 120, render: (s) => <span style={styles.live}><span style={styles.dot} />Connected</span> },
    { key: '_sync', label: 'Last sync', width: 100, render: (s) => <span style={{ fontSize: 11.5, color: MUTE }}>{s._sync}</span> },
    { key: '_route', label: '', width: 90, sortable: false, render: (s) => (s._route ? <button onClick={(e) => { e.stopPropagation(); go(s._route) }} style={styles.link}>Feed →</button> : null) },
  ]

  return (
    <div>
      <PageHeading
        title="Asset Intelligence Connector"
        subtitle="Every platform this reads from and every sensor it adds — wired through the intelligence layer to the work it raises. Step from any source to its live feed."
      />

      <StatCards items={stats} />

      <Section title="Data pipeline" right={<span style={styles.live}><span style={styles.dot} />live · {total} sources streaming</span>}>
        <div style={styles.arch}>
          {/* sources */}
          <div style={styles.col}>
            <div style={styles.colHead}>Sources</div>
            {GROUPS.map((g) => {
              const items = SYSTEMS.filter(g.match)
              if (!items.length) return null
              return (
                <div key={g.key} style={styles.group}>
                  <div style={styles.groupHead}>{g.label}</div>
                  {items.map((s) => (
                    <button key={s.systemId} onClick={() => go(ROUTE[s.systemId])} title={ROUTE[s.systemId] ? 'Open live feed →' : undefined}
                      style={{ ...styles.src, borderColor: g.isNew ? '#bfdbfe' : LINE, background: g.isNew ? '#f5f9ff' : '#fff', cursor: ROUTE[s.systemId] ? 'pointer' : 'default' }}>
                      <span style={{ ...styles.dot, background: g.isNew ? BLUE : GREEN }} />
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={styles.srcName}>{shortName(s)}</span>
                        <span style={styles.srcProto}>{s.protocol}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )
            })}
          </div>

          <div style={styles.flowArrow}>→</div>

          {/* intelligence */}
          <div style={styles.col}>
            <div style={styles.colHead}>AI intelligence layer</div>
            <div style={styles.brain}>
              {INTELLIGENCE.map((n) => (
                <button key={n.label} onClick={() => go(n.to)} style={styles.node} title="Open →">
                  <span style={styles.nodeLabel}>{n.label}</span>
                  <span style={styles.nodeSub}>{n.sub}</span>
                </button>
              ))}
            </div>
            <div style={styles.live}><span style={styles.dot} />intelligence layer active</div>
          </div>

          <div style={styles.flowArrow}>→</div>

          {/* outcomes */}
          <div style={styles.col}>
            <div style={styles.colHead}>Operational work</div>
            {OUTCOMES.map((o) => (
              <button key={o.label} onClick={() => go(o.to)} style={{ ...styles.node, borderColor: '#dcfce7', background: '#f6fefb' }} title="Open →">
                <span style={styles.nodeLabel}>{o.label}</span>
                <span style={styles.nodeSub}>{o.sub}</span>
              </button>
            ))}
          </div>
        </div>

      </Section>

      <Section title="Connected systems" right={<span style={styles.live}><span style={styles.dot} />{total} live</span>}>
        <DataTable columns={columns} rows={rows} pageSize={15} onRowClick={(s) => go(s._route)} empty="No systems." />
      </Section>
    </div>
  )
}

const styles = {
  note: { fontSize: 11.5, color: MUTE },
  mono: { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 11.5, color: SUB },
  live: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#047857', fontWeight: 600 },
  dot: { width: 8, height: 8, borderRadius: '50%', background: GREEN, flexShrink: 0, boxShadow: '0 0 0 3px #ecfdf5' },
  link: { background: 'none', border: 'none', color: '#15227a', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  arch: { display: 'grid', gridTemplateColumns: 'minmax(220px,1.2fr) auto minmax(200px,1fr) auto minmax(200px,1fr)', gap: 12, alignItems: 'start', overflowX: 'auto' },
  col: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 },
  colHead: { fontSize: 12, fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.05em' },
  group: { display: 'flex', flexDirection: 'column', gap: 6 },
  groupHead: { fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.04em' },
  src: { display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', border: '1px solid', borderRadius: 9, fontFamily: 'inherit', textAlign: 'left', width: '100%' },
  srcName: { display: 'block', fontSize: 12, fontWeight: 700, color: INK, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  srcProto: { display: 'block', fontSize: 10, color: MUTE, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  flowArrow: { alignSelf: 'center', color: '#94a3b8', fontSize: 20, fontWeight: 800 },
  brain: { display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 12, background: 'linear-gradient(135deg,#eef1ff,#f8fafc)', border: `1px solid ${ACCENT}22` },
  node: { display: 'block', textAlign: 'left', width: '100%', padding: '10px 12px', border: `1px solid ${LINE}`, borderRadius: 9, background: '#fff', fontFamily: 'inherit', cursor: 'pointer' },
  nodeLabel: { display: 'block', fontSize: 12.5, fontWeight: 700, color: INK, lineHeight: 1.3 },
  nodeSub: { display: 'block', fontSize: 10.5, color: MUTE, marginTop: 2, lineHeight: 1.35 },
  brainNote: { fontSize: 11, color: SUB, lineHeight: 1.5, padding: '0 2px' },
  loopNote: { marginTop: 14, fontSize: 12, color: SUB, lineHeight: 1.6, background: '#f8fafc', border: `1px solid ${LINE}`, borderRadius: 10, padding: '11px 14px' },
}
