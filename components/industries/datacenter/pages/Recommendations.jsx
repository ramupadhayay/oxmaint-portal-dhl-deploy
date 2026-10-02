'use client'

// The AI Auditor — a closed-loop risk engine, not a findings report.
//
// This screen used to list what each detection recommended and how far the job
// had got. It still does that, but the exit condition has changed (spec §6): a
// finding is not done when it is listed, it is done when a linked work order
// exists and the condition is verified clear. So every row now carries what a
// risk needs and a findings list does not — the priority it inherits from the
// asset's criticality, the SLA deadline derived from the restore time the client
// committed to for that class, the escalation state that moves on its own as the
// clock runs down, and where it is on the path to resolution. A Critical or High
// finding with no work order is an orphan the page will not leave alone: one
// click raises a P1–P2 work order against the asset, stamped from the auditor,
// and the loop is closed. The page leads with what is open, what is past its
// SLA, and whether every serious finding has a path — not with how many issues
// were found.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StatusBadge, PALETTE } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { MON_REC_ROWS, monAssetById } from '../lib/monitoring'
import { useRiskStore } from '../lib/store'
import { buildRisks, riskSummary, slaClock } from '../lib/riskEngine'
import RootCauseDrawer from '../components/RootCauseDrawer'

const { SUB, MUTE, INK, LINE, GREEN, AMBER, RED, ACCENT } = PALETTE

// The clock the SLA states are judged against. A fixed anchor renders on the
// server and the first client paint identically — reading the wall clock during
// render is a hydration mismatch — then an effect swaps in the real time so the
// SLA countdown is live for whoever is watching.
const ANCHOR = new Date('2026-08-31T09:00:00')

const PRIORITY_TONE = { P1: 'red', P2: 'amber', P3: 'blue', P4: 'grey' }

// The data model stores escalation_state and resolution_status as the spec's
// tokens (§6.1); the badges show a manager-readable label for each.
const ESC = {
  none: { label: 'On track', tone: 'blue' },
  warned: { label: 'Warned', tone: 'amber' },
  breached: { label: 'Breached', tone: 'red' },
  paged: { label: 'Paged on-call', tone: 'red' },
}
const RES = {
  open: { label: 'Open — no work order', tone: 'red' },
  wo_linked: { label: 'Work order linked', tone: 'blue' },
  resolved: { label: 'Resolved', tone: 'green' },
  verified_clear: { label: 'Verified clear', tone: 'green' },
}

// Each headline number filters the list to the rows behind it — the spec's rule
// that every number has a path to action, not a dead end.
const FILTERS = {
  'crit-open': (r) => r.criticality === 'Critical' && !r._resolved,
  'crit-sla': (r) => r.criticality === 'Critical' && r._pastSla,
  escalated: (r) => r._pastSla,
  orphans: (r) => r._orphan,
  resolved: (r) => r._resolved,
}
const FILTER_LABEL = {
  'crit-open': 'critical risks open',
  'crit-sla': 'critical risks past SLA',
  escalated: 'risks escalated past SLA',
  orphans: 'orphan findings — no path to resolution',
  resolved: 'resolved risks',
}

export default function Recommendations() {
  const router = useRouter()
  const riskStore = useRiskStore()

  const [now, setNow] = useState(ANCHOR)
  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  const [filter, setFilter] = useState(null)
  // The resolve confirmation/result dialog: { risk, step: 'confirm' | 'done', ... }.
  const [dialog, setDialog] = useState(null)
  // The finding whose root-cause drawer is open, or null.
  const [rootCause, setRootCause] = useState(null)

  // What the portal has recorded against each finding, keyed by the finding's own
  // id, overlaid on the seeded record so a worked risk reads as worked.
  const overlays = useMemo(() => {
    const m = {}
    for (const r of riskStore.created) if (r.recId) m[r.recId] = r
    return m
  }, [riskStore.created])

  const risks = useMemo(() => buildRisks(MON_REC_ROWS, now, overlays), [now, overlays])
  const s = useMemo(() => riskSummary(risks), [risks])

  const shown = filter ? risks.filter(FILTERS[filter]) : risks

  const stats = [
    { label: 'Critical risks open', value: s.criticalOpen, tone: s.criticalOpen ? 'red' : 'green', note: 'Tier-1 assets, unresolved', to: 'crit-open' },
    { label: 'Critical past SLA', value: s.criticalPastSla, tone: s.criticalPastSla ? 'red' : 'green', note: 'Beyond committed restore time', to: 'crit-sla' },
    { label: 'Mean time to resolve', value: s.mttrHours != null ? s.mttrHours : '—', unit: s.mttrHours != null ? 'h' : '', note: `${s.resolvedCount} resolved`, to: 'resolved' },
    { label: 'Escalations firing', value: s.escalationCount, tone: s.escalationCount ? 'amber' : 'green', note: 'Auto-raised on SLA breach', to: 'escalated' },
    { label: 'Close-loop rate', value: s.closeLoopRate, unit: '%', tone: s.closeLoopRate >= 100 ? 'green' : 'amber', note: s.orphans ? `${s.orphans} orphan${s.orphans > 1 ? 's' : ''} to close` : 'Every serious finding has a path', to: 'orphans' },
  ]

  // Upsert the portal's overlay for one finding, keyed by its recId (the API
  // upserts on that id). Guarded against a double-click on a still-saving row.
  const saveOverlay = async (risk, patch) => {
    const existing = riskStore.created.find((r) => r.recId === risk.risk_id)
    if (existing?._pending) { riskStore.notify('Still saving — one moment.'); return null }
    if (existing) return riskStore.update(existing.recordId, patch)
    return riskStore.create({ recordId: risk.risk_id, recId: risk.risk_id, ...patch })
  }

  // The loop's core move, made visible. Rather than raise a work order silently,
  // this opens the Create Work Order screen with the finding's own details
  // already filled in — asset, priority inherited from criticality, the SLA it
  // carries, and the action as the description. The operator sees the P1 being
  // drafted, raises it there, and the finding links to it on save (the `rec`
  // param), so it is no longer an orphan — and the demo shows the work being
  // created rather than a number appearing from nowhere.
  const raiseUrl = (risk) => {
    const p = new URLSearchParams({ asset: risk.assetId, priority: risk.criticality, rec: risk.risk_id, source: 'auditor' })
    if (risk.action) p.set('desc', risk.action)
    if (risk.alertId) p.set('alert', risk.alertId)
    return `/portal/datacenter/work-orders/new?${p.toString()}`
  }

  const viewWorkOrder = (risk) =>
    router.push(`/portal/datacenter/work-orders/${encodeURIComponent(risk.workOrderId)}`)

  // Resolving is confirmed in a dialog and then its result is shown — what
  // closed, when, and how long it took against the SLA — so the action is never
  // an invisible state change the operator has to trust happened.
  const confirmResolve = async () => {
    const risk = dialog?.risk
    if (!risk || dialog.busy) return
    setDialog((d) => ({ ...d, busy: true }))
    const today = new Date().toISOString().slice(0, 10)
    const saved = await saveOverlay(risk, { resolvedAt: today, resolution_status: 'verified_clear' })
    if (saved) {
      riskStore.notify(`${risk.risk_id} resolved and verified clear.`)
      setDialog({ risk, step: 'done', date: today })
    } else {
      setDialog(null)
    }
  }

  return (
    <div>
      <PageHeading
        title="AI Auditor — Risk Engine"
        wide
        subtitle="Every detection as a tracked risk against the site's uptime SLA — priority inherited from the asset's criticality, an SLA clock from the committed restore time, and escalation before the rack goes down. Ranked by business impact; no serious finding without a path to resolution."
      />

      <StatCards items={stats} onCardClick={(to) => setFilter((f) => (f === to ? null : to))} />

      {filter && (
        <div style={styles.filterBar}>
          <span>Showing <strong>{shown.length}</strong> · {FILTER_LABEL[filter]}</span>
          <button onClick={() => setFilter(null)} style={styles.clear}>Clear ✕</button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 14, marginTop: 4 }}>
        {shown.map((r) => {
          const asset = monAssetById.get(r.assetId)
          const clock = slaClock(r, now)
          const esc = ESC[r.escalation_state] || ESC.none
          const res = RES[r.resolution_status] || RES.open
          return (
            <div key={r.risk_id} style={{ ...styles.card, border: `1px solid ${r._orphan ? RED : r._pastSla ? '#fecaca' : LINE}` }}>
              <div style={styles.head}>
                <div style={{ minWidth: 0 }}>
                  <div style={styles.asset}>
                    {r._asset}
                    {r.tier && <span style={styles.tier}>{r.tier}</span>}
                  </div>
                  <div style={styles.meta}>
                    {r.risk_id} · {r.alertId ? `from ${r.alertId}` : 'flagged by AI Auditor'} · detected {r.dateIssued}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                  <StatusBadge tone={PRIORITY_TONE[r.priority] || 'grey'}>{r.priority} · {r.criticality}</StatusBadge>
                  {!r._resolved && <StatusBadge tone={esc.tone}>{esc.label}</StatusBadge>}
                </div>
              </div>

              <div style={styles.action}>{r.action}</div>

              {r.businessImpact && (
                <div style={styles.impact}>
                  <span style={styles.impactLabel}>Business impact</span> {r.businessImpact}
                </div>
              )}

              <div style={styles.detail}>
                <Field label="SLA clock" value={
                  <span style={{ fontWeight: 700, color: clock.tone === 'red' ? RED : clock.tone === 'amber' ? AMBER : clock.tone === 'green' ? GREEN : INK }}>
                    {clock.label}
                  </span>
                } sub={r.slaText} />
                <Field label="Resolution" value={<StatusBadge tone={res.tone}>{res.label}</StatusBadge>} />
                <Field label="Work order" value={
                  r.workOrderId
                    ? <span><strong style={{ color: INK }}>{r.workOrderId}</strong>{r.source ? ` · ${r.source}` : ''}</span>
                    : r._orphan
                      ? <span style={{ color: RED, fontWeight: 700 }}>None — orphan {r.criticality} risk</span>
                      : <span style={styles.pendingText}>Not raised</span>
                } />
                <Field label="Escalates to" value={r.escalatesTo} sub={r._pastSla ? 'Notified — past SLA' : 'On breach'} />
              </div>

              {r._finding && (
                <div style={styles.finding}>
                  <span style={styles.impactLabel}>Technician finding</span> {r._finding}
                  {r.outcome && !/pending/i.test(r.outcome) && (
                    <StatusBadge tone={r._truePositive ? 'green' : r._falsePositive ? 'red' : 'amber'}>{r.outcome}</StatusBadge>
                  )}
                </div>
              )}

              <div style={styles.foot}>
                <button onClick={() => setRootCause(r)} style={styles.rootBtn}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
                  </svg>
                  Why flagged — root cause
                </button>
                {!r.workOrderId && !r._resolved && (
                  <button onClick={() => router.push(raiseUrl(r))} style={styles.primary}>
                    Raise {r.priority} work order →
                  </button>
                )}
                {r.workOrderId && (
                  <button onClick={() => viewWorkOrder(r)} style={styles.woLink}>
                    View {r.workOrderId} →
                  </button>
                )}
                {r.workOrderId && !r._resolved && (
                  <button onClick={() => setDialog({ risk: r, step: 'confirm' })} style={styles.resolve}>
                    Resolve &amp; verify clear
                  </button>
                )}
                {r.alertId && (
                  <button onClick={() => router.push(`/portal/datacenter/detections/${encodeURIComponent(r.alertId)}`)} style={styles.link}>
                    The detection behind it →
                  </button>
                )}
                {asset && (
                  <button onClick={() => router.push(`/portal/datacenter/monitoring/${encodeURIComponent(r.assetId)}`)} style={styles.link}>
                    Open the asset →
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {dialog && (
        <ResolveDialog
          dialog={dialog}
          onConfirm={confirmResolve}
          onView={() => { viewWorkOrder(dialog.risk); setDialog(null) }}
          onClose={() => setDialog(null)}
        />
      )}

      {rootCause && (
        <RootCauseDrawer
          risk={rootCause}
          asset={monAssetById.get(rootCause.assetId)}
          onClose={() => setRootCause(null)}
          onViewDetection={(alertId) => { setRootCause(null); router.push(`/portal/datacenter/detections/${encodeURIComponent(alertId)}`) }}
          onOpenAsset={(assetId) => { setRootCause(null); router.push(`/portal/datacenter/monitoring/${encodeURIComponent(assetId)}`) }}
          onRaise={(r) => { setRootCause(null); router.push(raiseUrl(r)) }}
          onViewWo={(r) => { setRootCause(null); viewWorkOrder(r) }}
        />
      )}
    </div>
  )
}

// The resolve confirmation and its result, in one dialog. Step 'confirm' shows
// what resolving will do; step 'done' shows that it happened and offers the work
// order it closed — so the operator sees the outcome, not just a vanished button.
function ResolveDialog({ dialog, onConfirm, onView, onClose }) {
  const { risk, step, busy, date } = dialog
  const done = step === 'done'
  return (
    <div style={styles.backdrop} onClick={busy ? undefined : onClose}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        {done ? (
          <>
            <div style={styles.tick}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </div>
            <h3 style={styles.dTitle}>Resolved &amp; verified clear</h3>
            <p style={styles.dText}>
              <strong style={{ color: INK }}>{risk.risk_id}</strong> on {risk._asset} is closed. Work order{' '}
              <strong style={{ color: INK }}>{risk.workOrderId}</strong> is marked resolved, the condition verified clear on {date},
              and the resolution time recorded against the {risk.assetClass || 'asset'} class for trend analysis.
            </p>
            <div style={styles.dRow}><span style={styles.dK}>Resolution</span><StatusBadge tone="green">Verified clear</StatusBadge></div>
            <div style={styles.dRow}><span style={styles.dK}>Work order</span><span style={{ fontWeight: 700, color: INK }}>{risk.workOrderId}</span></div>
            <div style={styles.dRow}><span style={styles.dK}>Verified on</span><span style={{ color: INK }}>{date}</span></div>
            <div style={styles.dFoot}>
              <button onClick={onView} style={styles.primary}>View {risk.workOrderId} →</button>
              <button onClick={onClose} style={styles.cancel}>Close</button>
            </div>
          </>
        ) : (
          <>
            <h3 style={styles.dTitle}>Resolve this risk?</h3>
            <p style={styles.dText}>
              This marks work order <strong style={{ color: INK }}>{risk.workOrderId}</strong> on{' '}
              <strong style={{ color: INK }}>{risk._asset}</strong> resolved and the condition <strong style={{ color: INK }}>verified clear</strong>,
              and records the resolution time against the asset class. It is the only state that closes the loop — a listed finding is not a resolved one.
            </p>
            <div style={styles.dRow}><span style={styles.dK}>Risk</span><span style={{ fontWeight: 700, color: INK }}>{risk.risk_id} · {risk.criticality}</span></div>
            <div style={styles.dRow}><span style={styles.dK}>Detected</span><span style={{ color: INK }}>{risk.dateIssued}</span></div>
            <div style={styles.dFoot}>
              <button onClick={onConfirm} disabled={busy} style={{ ...styles.confirm, opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Verifying…' : 'Confirm — verify clear'}
              </button>
              <button onClick={onClose} disabled={busy} style={styles.cancel}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, sub }) {
  return (
    <div>
      <div style={styles.fieldLabel}>{label}</div>
      <div style={styles.fieldValue}>{value}</div>
      {sub && <div style={styles.fieldSub}>{sub}</div>}
    </div>
  )
}

const styles = {
  filterBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    fontSize: 12.5, color: SUB, background: '#f8fafc', border: `1px solid ${LINE}`,
    borderRadius: 9, padding: '8px 13px', marginBottom: 12,
  },
  clear: { fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, color: ACCENT, background: 'none', border: 'none', cursor: 'pointer' },

  card: { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, boxShadow: '0 1px 2px rgba(15,23,42,0.04)' },
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  asset: { fontSize: 15.5, fontWeight: 700, color: INK, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
  tier: { fontSize: 10.5, fontWeight: 700, color: '#475569', background: '#f1f5f9', border: `1px solid ${LINE}`, borderRadius: 999, padding: '1px 8px' },
  meta: { fontSize: 11.5, color: MUTE, marginTop: 3 },
  action: { fontSize: 15, fontWeight: 600, color: INK, lineHeight: 1.5, marginTop: 12 },

  impact: { fontSize: 12, color: SUB, lineHeight: 1.55, marginTop: 10, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 9, padding: '8px 11px' },
  impactLabel: { fontSize: 10, fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: 0.4, marginRight: 7 },

  detail: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${LINE}` },
  fieldLabel: { fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 },
  fieldValue: { fontSize: 12.5, color: INK, marginTop: 5, lineHeight: 1.55 },
  fieldSub: { fontSize: 10.5, color: MUTE, marginTop: 3 },
  pendingText: { color: MUTE },

  finding: { fontSize: 12, color: SUB, lineHeight: 1.55, marginTop: 12, display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' },

  foot: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' },
  rootBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
    background: 'linear-gradient(135deg,#f5f7ff,#eef2ff)', border: '1px solid #d6ddff',
    color: '#15227a', borderRadius: 7, cursor: 'pointer',
  },
  primary: {
    padding: '7px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
    background: '#15227a', border: '1px solid #15227a', color: '#fff', borderRadius: 7, cursor: 'pointer',
  },
  resolve: {
    padding: '7px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
    background: '#fff', border: `1px solid ${GREEN}`, color: '#15803d', borderRadius: 7, cursor: 'pointer',
  },
  woLink: {
    padding: '7px 13px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
    background: '#eef2ff', border: '1px solid #c7d2fe', color: '#15227a', borderRadius: 7, cursor: 'pointer',
  },
  link: {
    padding: '5px 11px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
    background: '#fff', border: `1px solid ${ACCENT}33`, color: ACCENT, borderRadius: 7, cursor: 'pointer',
  },

  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 600, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '9vh 20px' },
  dialog: { width: '100%', maxWidth: 460, background: '#fff', borderRadius: 14, boxShadow: '0 24px 60px rgba(15,23,42,0.3)', padding: 24 },
  tick: { width: 42, height: 42, borderRadius: '50%', background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  dTitle: { margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: INK },
  dText: { margin: '0 0 16px', fontSize: 12.5, color: SUB, lineHeight: 1.6 },
  dRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: `1px solid ${LINE}`, fontSize: 12.5 },
  dK: { fontSize: 11, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 },
  dFoot: { display: 'flex', gap: 9, marginTop: 20 },
  confirm: {
    padding: '9px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
    background: '#15803d', border: '1px solid #15803d', color: '#fff', borderRadius: 9, cursor: 'pointer',
  },
  cancel: {
    padding: '9px 15px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 9, color: '#475569', cursor: 'pointer',
  },
}
