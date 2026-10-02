'use client'

// The "why was this flagged" panel behind an AI Auditor finding.
//
// Opened from a finding's Root cause button, it answers a reviewer's first
// question in three parts, in the order they ask them: how the platform knew
// (the origin — a predictive detection, a slipped PM, or the auditor's own SLA
// rule), which of the three condition sensors moved and by how far against the
// asset's own line, and why that makes it the priority it is. The content comes
// from rootCauseFor; this only lays it out.

import { rootCauseFor } from '../lib/rootCause'
import { StatusBadge, PALETTE } from '../lib/kit'

const { SUB, MUTE, INK, LINE, GREEN, AMBER, RED, ACCENT } = PALETTE

const SOURCE = {
  predictive: {
    label: 'Predictive detection',
    sub: 'The IoT / condition-monitoring layer',
    fg: '#1d4ed8', bg: '#eff6ff', line: '#bfdbfe',
    icon: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10z" />,
  },
  'pm-slip': {
    label: 'Preventive-maintenance slip',
    sub: 'A scheduled service cycle was missed',
    fg: '#b45309', bg: '#fffbeb', line: '#fde68a',
    icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  },
  audit: {
    label: 'AI Auditor — SLA rule',
    sub: 'A serious asset with no path to resolution',
    fg: '#b91c1c', bg: '#fef2f2', line: '#fecaca',
    icon: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>,
  },
}

export default function RootCauseDrawer({ risk, asset, onClose, onViewDetection, onOpenAsset, onRaise, onViewWo }) {
  if (!risk) return null
  const rc = rootCauseFor(risk, asset)
  const src = SOURCE[rc.source] || SOURCE.audit

  const narrative = rc.source === 'predictive'
    ? `Condition monitoring raised ${rc.alert.alertId} on ${rc.alert.dateRaised} — the detection named ${rc.namedCount} of 3 sensors${rc.overCount ? `, ${rc.overCount} of them over the line` : ' on trend'}${rc.confidence != null ? `, at ${rc.confidence}% model confidence` : ''}${rc.failureMode ? `, on failure mode ${rc.failureMode}` : ''}.`
    : rc.source === 'pm-slip'
      ? `No detection alert sits behind this. The auditor flagged it and its own PM record shows a cycle that slipped${rc.pm?.pausedMonth ? ` — a preventive service was paused in ${rc.pm.pausedMonth}` : rc.pm?.lateMonth ? ` — a preventive service ran late in ${rc.pm.lateMonth}` : ''}, which precedes this failure mode.`
      : `No detection alert and no open work order. The auditor's SLA rule caught it: a ${rc.tier || rc.criticality} asset past its committed restore window with no path to resolution — the orphan the loop exists to close.`

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <aside style={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <style>{`@keyframes rcIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
        <header style={styles.head}>
          <div style={{ minWidth: 0 }}>
            <div style={styles.eyebrow}>Root cause</div>
            <div style={styles.asset}>{risk._asset}</div>
            <div style={styles.sub}>{risk.risk_id} · detected {rc.dateIssued}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusBadge tone={rc.priority === 'P1' ? 'red' : rc.priority === 'P2' ? 'amber' : 'blue'}>{rc.priority} · {rc.criticality}</StatusBadge>
            <button onClick={onClose} style={styles.x} aria-label="Close">✕</button>
          </div>
        </header>

        <div style={styles.body}>
          {/* 1 — how it surfaced */}
          <section style={styles.section}>
            <div style={styles.secLabel}>How this surfaced</div>
            <div style={{ ...styles.sourceCard, background: src.bg, borderColor: src.line }}>
              <span style={{ ...styles.sourceIcon, color: src.fg }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{src.icon}</svg>
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...styles.sourceTitle, color: src.fg }}>{src.label}</div>
                <div style={styles.sourceSub}>{src.sub}</div>
              </div>
            </div>
            <p style={styles.narrative}>{narrative}</p>
            {rc.detectionDesc && <p style={styles.quote}>“{rc.detectionDesc}”</p>}
          </section>

          {/* 2 — sensor evidence */}
          <section style={styles.section}>
            <div style={styles.secLabel}>
              Which sensor moved
              <span style={styles.secNote}>{rc.overCount} of 3 past their line{rc.namedCount ? ` · ${rc.namedCount} named by the detection` : ''} · reading vs this asset’s own threshold</span>
            </div>
            {rc.sensors.length === 0 ? (
              <div style={styles.empty}>No condition-sensor readings on this asset.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rc.sensors.map((s) => {
                  const t = s.reading == null ? { dot: '#cbd5e1', bg: '#fff', line: LINE }
                    : s.over ? { dot: RED, bg: '#fef2f2', line: '#fecaca' }
                      : s.named ? { dot: AMBER, bg: '#fffbeb', line: '#fde68a' }
                        : { dot: GREEN, bg: '#fff', line: LINE }
                  return (
                    <div key={s.key} style={{ ...styles.sensor, borderColor: t.line, background: t.bg }}>
                      <span style={{ ...styles.sensorDot, background: t.dot }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={styles.sensorName}>
                          {s.label}
                          {s.named && <span style={styles.trig}>flagged</span>}
                        </div>
                        <div style={styles.sensorRange}>
                          reading <strong style={{ color: s.over ? RED : INK }}>{s.reading != null ? `${s.reading.toFixed(s.decimals)} ${s.unit}` : '—'}</strong>
                          {' · '}alarm at {s.threshold != null ? `${s.threshold.toFixed(s.decimals)} ${s.unit}` : '—'}
                        </div>
                      </div>
                      <StatusBadge tone={s.reading == null ? 'grey' : s.over ? 'red' : 'green'}>{s.reading == null ? 'Not monitored' : s.over ? 'Over line' : 'In band'}</StatusBadge>
                    </div>
                  )
                })}
                <p style={styles.derivedNote}>A sensor can be named by a trend or acoustic signature while its latest reading is back in band. Thresholds are derived from each asset’s own quiet period (mean +3σ) — per-asset, as the spec requires.</p>
              </div>
            )}
          </section>

          {/* 3 — why this priority */}
          <section style={styles.section}>
            <div style={styles.secLabel}>Why it’s a {rc.priority}</div>
            <div style={styles.grid}>
              <Fact label="Criticality" value={`${rc.criticality}${rc.tier ? ` · ${rc.tier}` : ''}`} />
              <Fact label="Restore SLA" value={rc.slaText || (rc.slaHours ? `${rc.slaHours} h` : '—')} />
              <Fact label="Escalates to" value={rc.escalatesTo || '—'} />
              <Fact label="Priority" value={`${rc.priority} — inherited from criticality`} />
            </div>
            {rc.businessImpact && <p style={styles.impact}><span style={styles.impactLabel}>Business impact</span> {rc.businessImpact}</p>}
            {rc.redundancyImpact && <p style={styles.impact}><span style={styles.impactLabel}>Redundancy</span> {rc.redundancyImpact}</p>}
          </section>

          {/* 4 — maintenance context */}
          {rc.pm && (
            <section style={styles.section}>
              <div style={styles.secLabel}>Maintenance context <span style={styles.modelled}>modelled</span></div>
              <div style={{ ...styles.pmCard, borderColor: rc.pm.slipped ? '#fde68a' : '#a7f3d0', background: rc.pm.slipped ? '#fffbeb' : '#ecfdf5' }}>
                <div style={styles.pmLine}>
                  <span style={styles.pmLabel}>Recent PM</span>
                  <StatusBadge tone={/paused/i.test(rc.pm.recentStatus || '') ? 'red' : /late/i.test(rc.pm.recentStatus || '') ? 'amber' : 'green'}>{rc.pm.recentStatus || '—'}</StatusBadge>
                </div>
                <p style={styles.pmNote}>
                  {rc.pm.slipped
                    ? `A preventive cycle slipped on this asset${rc.pm.pausedMonth ? ` (paused, ${rc.pm.pausedMonth})` : rc.pm.lateMonth ? ` (late, ${rc.pm.lateMonth})` : ''}. A missed service is a common precursor to this failure mode.`
                    : rc.source === 'audit'
                      ? 'PM is on schedule and the readings are in band — this is a governance flag, a critical asset with no open work order, not a maintenance failure. Raising the P1 closes it.'
                      : 'Preventive maintenance is on schedule for this asset — the cause is condition-driven (the detection above), not a missed service.'}
                </p>
              </div>
            </section>
          )}
        </div>

        <footer style={styles.foot}>
          {rc.alert && <button onClick={() => onViewDetection?.(rc.alert.alertId)} style={styles.link}>The detection behind it →</button>}
          <button onClick={() => onOpenAsset?.(risk.assetId)} style={styles.link}>Open the asset →</button>
          {!risk.workOrderId && !risk._resolved && <button onClick={() => onRaise?.(risk)} style={styles.primary}>Raise {rc.priority} work order →</button>}
          {risk.workOrderId && <button onClick={() => onViewWo?.(risk)} style={styles.primary}>View {risk.workOrderId} →</button>}
        </footer>
      </aside>
    </div>
  )
}

function Fact({ label, value }) {
  return (
    <div style={styles.factBox}>
      <div style={styles.factLabel}>{label}</div>
      <div style={styles.factValue}>{value}</div>
    </div>
  )
}

const styles = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 600, display: 'flex', justifyContent: 'flex-end' },
  drawer: {
    width: 'min(500px, 100%)', height: '100%', background: '#fff', display: 'flex', flexDirection: 'column',
    boxShadow: '-12px 0 40px rgba(15,23,42,0.22)', animation: 'rcIn 0.22s cubic-bezier(.22,1,.36,1)',
  },
  head: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
    padding: '18px 20px', borderBottom: `1px solid ${LINE}`, flexShrink: 0,
  },
  eyebrow: { fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: ACCENT },
  asset: { fontSize: 18, fontWeight: 800, color: INK, marginTop: 3, lineHeight: 1.2 },
  sub: { fontSize: 11.5, color: MUTE, marginTop: 3 },
  x: { border: 'none', background: 'none', fontSize: 16, color: MUTE, cursor: 'pointer', fontFamily: 'inherit', padding: 4 },
  body: { flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 22 },
  section: {},
  secLabel: { display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', fontSize: 12.5, fontWeight: 800, color: INK, marginBottom: 10 },
  secNote: { fontSize: 10.5, fontWeight: 500, color: MUTE },
  sourceCard: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid', borderRadius: 12 },
  sourceIcon: { display: 'inline-flex', flexShrink: 0 },
  sourceTitle: { fontSize: 14, fontWeight: 800 },
  sourceSub: { fontSize: 11.5, color: SUB, marginTop: 1 },
  narrative: { margin: '11px 0 0', fontSize: 13, color: INK, lineHeight: 1.6 },
  quote: { margin: '9px 0 0', paddingLeft: 12, borderLeft: `3px solid ${LINE}`, fontSize: 12.5, color: SUB, fontStyle: 'italic', lineHeight: 1.55 },
  empty: { padding: '12px 14px', border: `1px dashed ${LINE}`, borderRadius: 10, fontSize: 12.5, color: MUTE },
  sensor: { display: 'flex', alignItems: 'center', gap: 11, padding: '10px 13px', border: '1px solid', borderRadius: 11 },
  sensorDot: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  sensorName: { fontSize: 13, fontWeight: 700, color: INK, display: 'flex', alignItems: 'center', gap: 7 },
  trig: { fontSize: 9.5, fontWeight: 800, color: '#b45309', background: '#fef3c7', borderRadius: 999, padding: '1px 7px', textTransform: 'uppercase', letterSpacing: '0.04em' },
  sensorRange: { fontSize: 11.5, color: SUB, marginTop: 2, fontVariantNumeric: 'tabular-nums' },
  derivedNote: { margin: '4px 0 0', fontSize: 10.5, color: MUTE, lineHeight: 1.5 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  factBox: { padding: '9px 11px', border: `1px solid ${LINE}`, borderRadius: 10, background: '#fcfdfe' },
  factLabel: { fontSize: 9.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.04em' },
  factValue: { fontSize: 12.5, fontWeight: 700, color: INK, marginTop: 3, lineHeight: 1.35 },
  impact: { margin: '10px 0 0', fontSize: 12.5, color: SUB, lineHeight: 1.55 },
  impactLabel: { fontWeight: 800, color: INK, marginRight: 5 },
  modelled: { fontSize: 9.5, fontWeight: 700, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 999, padding: '1px 7px' },
  pmCard: { padding: '12px 14px', border: '1px solid', borderRadius: 12 },
  pmLine: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  pmLabel: { fontSize: 12, fontWeight: 700, color: INK },
  pmNote: { margin: '9px 0 0', fontSize: 12, color: SUB, lineHeight: 1.55 },
  foot: {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    padding: '14px 20px', borderTop: `1px solid ${LINE}`, flexShrink: 0, background: '#fcfdfe',
  },
  link: { padding: '8px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', color: ACCENT, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 9, cursor: 'pointer' },
  primary: { padding: '9px 14px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', color: '#fff', background: '#15227a', border: 'none', borderRadius: 9, cursor: 'pointer' },
}
