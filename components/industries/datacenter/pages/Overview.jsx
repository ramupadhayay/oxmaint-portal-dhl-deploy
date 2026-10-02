'use client'

// The screen the PoC gets judged on.
//
// The question this programme has to answer is narrow: does condition
// monitoring, layered on telemetry these sites already have, catch things the
// calendar PM would have missed — and how far ahead? So the page leads with the
// detections and the lead time they bought, not with a count of assets.
//
// Everything on it that names a record goes to that record. A dashboard whose
// numbers cannot be opened is a picture of a system rather than a way into one:
// the first thing anyone does on seeing "3 findings confirmed" is try to click
// it, and a page that does not answer that teaches them the rest is decoration
// too. So the tiles, the findings, the alerts and the KPI rows are all buttons,
// and each lands on the screen that can be interrogated further.
//
// The excluded assets are counted separately rather than quietly dropped,
// because SOW 3.3 makes the exclusions part of the deliverable: a scope matrix
// that only lists what is in scope is not a scope matrix.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Section, Card, StatusBadge, ActionButton, Donut, PALETTE } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { CREATE_ACTIONS } from '../lib/createActions'
import { StatCards } from '../components/MetricCard'
import { useSite } from '../lib/siteStore'
import { useRiskStore } from '../lib/store'
import { MON_REC_ROWS } from '../lib/monitoring'
import { buildRisks, riskSummary } from '../lib/riskEngine'
import { inventorySummary } from '../lib/reportsData'
import {
  ORG, SITES, ASSET_ROWS, ALERT_ROWS, WORK_ORDER_ROWS, CORRELATION_ROWS,
  KPI_ROWS, WEEKLY_HEALTH, PM_COMPLIANCE, SYSTEMS, fmtDateTime, toneOf,
} from '../lib/data'

const { SUB, MUTE, INK, LINE, GREEN, AMBER, RED, ACCENT } = PALETTE

// The clock the SLA states are judged against — a fixed anchor for the server
// and first client paint (reading the wall clock in render is a hydration
// mismatch), swapped for the real time by an effect so the gauge is live.
const ANCHOR = new Date('2026-08-31T09:00:00')

// The SLA risk gauge's traffic-light bands. Green only when nothing critical is
// exposed; anything past its restore SLA takes it into the red. Defaults for the
// data-center template — a tenant admin sets these against the site contract.
const riskBand = (pct) => (pct <= 0 ? 'green' : pct < 10 ? 'amber' : 'red')

export default function Overview() {
  const { scope, siteName, siteId } = useSite()
  const router = useRouter()
  const go = (to) => router.push(`/portal/datacenter/${to}`)

  const assets = useMemo(() => scope(ASSET_ROWS), [scope])
  const alerts = useMemo(() => scope(ALERT_ROWS), [scope])
  const workOrders = useMemo(() => scope(WORK_ORDER_ROWS), [scope])

  // Correlations carry no site of their own — they hang off an alert — so they
  // are scoped through the alert rather than dropped by a filter that cannot
  // see them.
  const alertIds = useMemo(() => new Set(alerts.map((a) => a.alertId)), [alerts])
  const correlations = useMemo(
    () => (siteId === 'all' ? CORRELATION_ROWS : CORRELATION_ROWS.filter((c) => alertIds.has(c.alertId))),
    [siteId, alertIds])

  const inScope = assets.filter((a) => a._included)
  const excluded = assets.length - inScope.length
  const confirmed = correlations.filter((c) => c.confirmed === 'Yes')
  const conditionWos = workOrders.filter((w) => w._conditionBased)
  const latest = WEEKLY_HEALTH[WEEKLY_HEALTH.length - 1]

  // The risk headline, computed from the same engine the auditor's decision
  // queue uses — so the number the manager reads here and the rows they open
  // there can never disagree. A fixed anchor renders first, then the real clock.
  const [now, setNow] = useState(ANCHOR)
  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  const riskStore = useRiskStore()
  const overlays = useMemo(() => {
    const m = {}
    for (const r of riskStore.created) if (r.recId) m[r.recId] = r
    return m
  }, [riskStore.created])

  const assetIdsInScope = useMemo(() => new Set(assets.map((a) => a.assetId)), [assets])
  const risks = useMemo(() => {
    const all = buildRisks(MON_REC_ROWS, now, overlays)
    return siteId === 'all' ? all : all.filter((r) => assetIdsInScope.has(r.assetId))
  }, [now, overlays, siteId, assetIdsInScope])
  const rs = useMemo(() => riskSummary(risks), [risks])

  // Share of the site's critical assets currently exposed: an open critical risk
  // past its restore SLA, or a critical finding with no work order. This is the
  // headline — uptime commitment in danger now, not a raw work-order count.
  const criticalAssetCount = inScope.filter((a) => a.criticality === 'Critical').length
  const exposedCritical = useMemo(() => new Set(
    risks.filter((r) => r.criticality === 'Critical' && !r._resolved && (r._pastSla || r._orphan)).map((r) => r.assetId)
  ).size, [risks])
  const slaRiskPct = criticalAssetCount ? Math.round((exposedCritical / criticalAssetCount) * 100) : 0
  const band = riskBand(slaRiskPct)

  const riskTiles = [
    { label: 'Critical risks open', value: rs.criticalOpen, tone: rs.criticalOpen ? 'red' : 'green', note: 'Tier-1 assets, unresolved', to: 'recommendations' },
    { label: 'Critical past SLA', value: rs.criticalPastSla, tone: rs.criticalPastSla ? 'red' : 'green', note: 'Beyond restore commitment', to: 'recommendations' },
    { label: 'Critical, no work order', value: rs.orphans, tone: rs.orphans ? 'red' : 'green', note: 'Auditor flagged — needs a P1', to: 'recommendations' },
    { label: 'Escalations firing', value: rs.escalationCount, tone: rs.escalationCount ? 'amber' : 'green', note: 'Past SLA — on-call notified', to: 'recommendations' },
    { label: 'Mean time to resolve', value: rs.mttrHours != null ? rs.mttrHours : '—', unit: rs.mttrHours != null ? 'h' : '', note: `${rs.resolvedCount} resolved · baseline in Reliability`, to: 'recommendations' },
  ]

  const tiles = [
    { label: 'Assets in scope', value: inScope.length, note: excluded ? `${excluded} excluded, with rationale` : 'whole register in scope', to: 'assets' },
    { label: 'Critical rated', value: inScope.filter((a) => a.criticality === 'Critical').length, tone: 'red', note: 'Tier 1 - under 15 min response', to: 'assets' },
    { label: 'Alerts raised', value: alerts.length, note: `${alerts.filter((a) => a._truePositive).length} confirmed true positive`, to: 'alerts' },
    { label: 'Condition-triggered WOs', value: conditionWos.length, note: `of ${workOrders.length} work orders`, to: 'work-orders' },
    { label: 'Findings confirmed', value: confirmed.length, tone: 'green', note: 'anomaly matched on inspection', to: 'correlation' },
  ]

  const severityMix = ['Critical', 'High', 'Medium', 'Low']
    .map((s) => ({ name: s, value: alerts.filter((a) => a.severity === s).length }))
    .filter((d) => d.value)

  return (
    <div>
      <PageHeading
        title={ORG.programme}
        subtitle={`${ORG.name} · ${ORG.siteCount} sites across ${ORG.regions.join(', ')}${siteName !== 'All Sites' ? ` · filtered to ${siteName}` : ''}`}
        right={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* All three, read from the same list the header's New menu reads.
                Offering one of the three here was how a first-time reader
                concluded a work order was the only thing this portal takes. */}
            {CREATE_ACTIONS.map((a, i) => (i === 0
              ? <ActionButton key={a.key} onClick={() => go(a.href.split('/portal/datacenter/')[1])}>{a.label}</ActionButton>
              : <button key={a.key} onClick={() => go(a.href.split('/portal/datacenter/')[1])} style={styles.secondary}>{a.label}</button>
            ))}
            <button onClick={() => go('kpis')} style={styles.secondary}>KPI dashboard</button>
          </div>
        }
      />

      {/* Row A — the risk headline. Lead with how much of the uptime commitment
          is in danger now, then the numbers behind it, each a way into the
          auditor's decision queue. The scope tiles that used to lead stay, one
          row down, as context. */}
      <SlaRiskHero
        pct={slaRiskPct}
        band={band}
        exposed={exposedCritical}
        criticalAssets={criticalAssetCount}
        pastSla={rs.criticalPastSla}
        orphans={rs.orphans}
        onOpen={() => go('recommendations')}
      />

      <StatCards items={riskTiles} onCardClick={go} />

      <div style={styles.demote}>Scope &amp; detection context</div>
      <StatCards items={tiles} onCardClick={go} />

      <style>{`
        .dc-tile, .dc-row { transition: border-color .14s, box-shadow .14s, transform .14s; }
        .dc-tile:hover, .dc-row:hover { border-color: #c3cbe6; box-shadow: 0 4px 14px rgba(15,23,42,0.07); }
        .dc-tile:hover { transform: translateY(-1px); }
        .dc-tile:hover span[data-arrow], .dc-row:hover span[data-arrow] { opacity: 1; transform: translateX(0); }
        .dc-line { transition: background .12s; }
        .dc-line:hover { background: #f5f7fb; }
      `}</style>

      {/* The lead time is the whole argument. It is first under the numbers, in
          the engineers' own words from the correlation log, rather than averaged
          into a single figure that would hide that the findings range from
          18 days to nine months. */}
      <Section
        title="Caught early — before the scheduled PM"
        right={<button onClick={() => go('correlation')} style={styles.viewAll}>Correlation log →</button>}
      >
        <div style={styles.leadIntro}>
          Each row is a real fault the condition-monitoring flagged <strong style={{ color: INK }}>before the calendar PM would have found it</strong>. The green figure is how far ahead it was caught — that lead time is the whole argument for the programme. <span style={{ color: ACCENT, fontWeight: 700 }}>Click any row</span> to open the detection behind it.
        </div>
        {confirmed.length ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {confirmed.map((c) => (
              <button key={c.correlationId} className="dc-row"
                onClick={() => go(`alerts/${encodeURIComponent(c.alertId)}`)}
                style={styles.leadCard}>
                <div style={styles.leadHead}>
                  <span style={styles.leadAsset}>{c._asset}</span>
                  <StatusBadge tone={toneOf(c._severity)}>{c._severity || 'Finding'}</StatusBadge>
                </div>
                <div style={styles.leadFinding}>{c.finding}</div>
                <div style={styles.leadFoot}>
                  <span style={styles.leadPill}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                    </svg>
                    {c.leadTime}
                  </span>
                  <span style={styles.leadMeta}>{c.failureMode} · {c.alertId}</span>
                  <span style={styles.leadOpen}>Open the detection →</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <Empty>No confirmed findings for {siteName}.</Empty>
        )}
      </Section>

      <div style={styles.two}>
        <Section
          title="Alert severity mix"
          right={<button onClick={() => go('alerts')} style={styles.viewAll}>Alert register →</button>}
          style={{ marginBottom: 0 }}
        >
          {severityMix.length
            ? <Donut data={severityMix} colors={[RED, AMBER, ACCENT, '#94a3b8']} />
            : <Empty>No alerts for {siteName}.</Empty>}
        </Section>

        <Section
          title="KPI headline"
          right={<button onClick={() => go('kpis')} style={styles.viewAll}>All KPIs →</button>}
          style={{ marginBottom: 0 }}
        >
          {/* Estate-wide by definition — the workbook computes these across the
              whole PoC, so they are not re-cut by the site picker. */}
          <div style={{ display: 'grid', gap: 2 }}>
            {KPI_ROWS.slice(0, 5).map((k) => (
              <button key={k.kpiId} className="dc-line" onClick={() => go('kpis')} style={styles.kpiRow} title={k._definition || k.kpi}>
                <span style={{ fontSize: 12.5, color: SUB, minWidth: 0, flex: 1, textAlign: 'left' }}>{k.kpi}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: k._favourable ? GREEN : AMBER, fontVariantNumeric: 'tabular-nums' }}>
                  {k._display}
                </span>
                <span style={{ fontSize: 10.5, color: MUTE, width: 74, textAlign: 'right' }}>{k.target}</span>
              </button>
            ))}
          </div>
        </Section>
      </div>

      <div style={styles.two}>
        <Section
          title="Latest alerts"
          right={<button onClick={() => go('alerts')} style={styles.viewAll}>All {alerts.length} →</button>}
          style={{ marginBottom: 0 }}
        >
          {alerts.length ? (
            <div style={{ display: 'grid', gap: 2 }}>
              {[...alerts].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, 5).map((a) => (
                <button key={a.alertId} className="dc-line" onClick={() => go(`alerts/${encodeURIComponent(a.alertId)}`)} style={styles.alertRow}>
                  <StatusBadge tone={toneOf(a.severity)}>{a.severity}</StatusBadge>
                  <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a._asset}
                    </div>
                    <div style={{ fontSize: 11, color: MUTE }}>
                      {a.source} · {a.failureCode}{a._failureMode ? ` · ${a._failureMode}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: MUTE, whiteSpace: 'nowrap' }}>{fmtDateTime(a.timestamp)}</span>
                </button>
              ))}
            </div>
          ) : <Empty>No alerts for {siteName}.</Empty>}
        </Section>

        <Section
          title="Programme health"
          right={<button onClick={() => go('weekly-health')} style={styles.viewAll}>Weekly reports →</button>}
          style={{ marginBottom: 0 }}
        >
          {latest && (
            <div style={{ display: 'grid', gap: 9 }}>
              <Meter label="Sensor availability" value={latest.sensorAvailability} />
              <Meter label="Data acquisition reliability" value={latest.dataReliability} />
              <Meter label="Dashboard availability" value={latest.dashboardAvailability} />
              <div style={{ fontSize: 11.5, color: MUTE, marginTop: 2 }}>
                Week ending {latest.weekEnding} · {latest.cadence} · {WEEKLY_HEALTH.length} reports logged
              </div>
            </div>
          )}
        </Section>
      </div>

      <Section title="Scope at a glance">
        <div style={styles.glance}>
          <Fact label="Sites" value={`${SITES.length} across ${ORG.regions.length} regions`} onClick={() => go('sites')} />
          <Fact label="Integrated systems" value={`${SYSTEMS.length} — BMS, EPMS, DCIM, OEM, battery and CMMS`} onClick={() => go('systems')} />
          <Fact label="Baseline PM" value={`${PM_COMPLIANCE.length} logged, running unchanged`} onClick={() => go('pm-compliance')} />
          <Fact label="Sensing added" value="Vibration, thermal and ultrasound" onClick={() => go('failure-codes')} />
        </div>
      </Section>

      <Section title="Inventory &amp; spares" right={<button onClick={() => go('reports')} style={styles.viewAll}>Cost report →</button>}>
        <InventoryStrip go={go} />
      </Section>
    </div>
  )
}

// The inventory line the spec asks the Overview to carry — not valuation alone,
// but the stockouts and emergency purchases the predictive calendar is credited
// with preventing. Those two are model estimates; the strip says so.
function InventoryStrip({ go }) {
  const inv = inventorySummary()
  return (
    <div style={styles.glance}>
      <Fact label="Carrying value" value={inv.money(inv.value)} onClick={() => go('reports')} />
      <Fact label="Lines low / out" value={`${inv.low} low · ${inv.out} out of ${inv.lines}`} onClick={() => go('reports')} />
      <Fact label="Stockouts avoided" value={`${inv.stockoutsAvoided} — model estimate`} onClick={() => go('reports')} />
      <Fact label="Emergency POs avoided" value={`${inv.emergencyPOsAvoided} — predictive calendar`} onClick={() => go('reports')} />
    </div>
  )
}

function SlaRiskHero({ pct, band, exposed, criticalAssets, pastSla, orphans, onOpen }) {
  const c = band === 'red' ? RED : band === 'amber' ? AMBER : GREEN
  const bg = band === 'red' ? '#fef2f2' : band === 'amber' ? '#fff7ed' : '#f0fdf4'
  const bd = band === 'red' ? '#fecaca' : band === 'amber' ? '#fed7aa' : '#bbf7d0'
  const verdict = band === 'red' ? 'Uptime commitment at risk' : band === 'amber' ? 'Uptime commitment under watch' : 'Uptime commitment holding'
  return (
    <button onClick={onOpen} className="dc-row" style={{ ...styles.hero, background: bg, border: `1px solid ${bd}` }}>
      <div style={styles.heroLeft}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 44, fontWeight: 800, color: c, letterSpacing: '-0.03em', lineHeight: 1 }}>{pct}</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: c }}>%</span>
        </div>
        <div style={{ display: 'grid', gap: 2, textAlign: 'left' }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: c }}>SLA risk</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{verdict}</span>
          <span style={{ fontSize: 11.5, color: SUB }}>of the uptime commitment currently at risk</span>
        </div>
      </div>
      <div style={styles.heroRight}>
        <HeroFact value={`${exposed}/${criticalAssets}`} label="critical assets exposed" />
        <HeroFact value={pastSla} label="past SLA" tone={pastSla ? RED : INK} />
        <HeroFact value={orphans} label="no work order" tone={orphans ? RED : INK} />
        <span data-arrow style={styles.heroArrow}>Open the decision queue →</span>
      </div>
    </button>
  )
}

function HeroFact({ value, label, tone = INK }) {
  return (
    <div style={{ textAlign: 'left' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: tone, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 10.5, color: MUTE, marginTop: 3 }}>{label}</div>
    </div>
  )
}

function Meter({ label, value }) {
  const pct = Math.round((Number(value) || 0) * 1000) / 10
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: SUB }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: INK, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: '#eef2f7', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 95 ? GREEN : pct >= 90 ? ACCENT : AMBER }} />
      </div>
    </div>
  )
}

function Fact({ label, value, onClick }) {
  return (
    <button onClick={onClick} className="dc-row" style={styles.fact}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: INK, marginTop: 3, lineHeight: 1.5, textAlign: 'left' }}>{value}</div>
    </button>
  )
}

function Empty({ children }) {
  return <div style={{ padding: '22px 4px', textAlign: 'center', fontSize: 12.5, color: MUTE }}>{children}</div>
}

const clickable = {
  fontFamily: 'inherit', cursor: 'pointer', background: '#fff',
  border: `1px solid ${LINE}`, borderRadius: 11, width: '100%',
}

const styles = {
  secondary: {
    padding: '8px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 9, color: '#475569', cursor: 'pointer',
  },
  viewAll: {
    padding: '3px 8px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
    background: 'transparent', border: 'none', color: ACCENT, cursor: 'pointer',
  },


  hero: {
    ...clickable, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 18, flexWrap: 'wrap', padding: '16px 20px', marginBottom: 12,
  },
  heroLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  heroRight: { display: 'flex', alignItems: 'center', gap: 26, flexWrap: 'wrap' },
  heroArrow: { fontSize: 11.5, fontWeight: 700, color: ACCENT, opacity: 0, transform: 'translateX(-4px)', transition: 'opacity .14s, transform .14s' },
  demote: { fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.5, margin: '4px 2px 8px' },

  two: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14, marginBottom: 14 },

  leadIntro: { fontSize: 12.5, color: SUB, lineHeight: 1.6, marginBottom: 14, background: '#f8fafc', border: `1px solid ${LINE}`, borderRadius: 9, padding: '10px 13px' },
  leadCard: { ...clickable, padding: '13px 15px', background: '#fff', textAlign: 'left' },
  leadHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 7, flexWrap: 'wrap' },
  leadAsset: { fontSize: 14, fontWeight: 700, color: INK, letterSpacing: '-0.01em', minWidth: 0 },
  leadFinding: { fontSize: 12.5, color: SUB, lineHeight: 1.55, marginBottom: 11 },
  leadFoot: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  leadPill: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', fontSize: 12, fontWeight: 700 },
  leadMeta: { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 11, color: MUTE },
  leadOpen: { marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: ACCENT, whiteSpace: 'nowrap' },

  kpiRow: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '7px 8px', margin: 0, background: 'transparent', border: 'none',
    borderRadius: 8, fontFamily: 'inherit', cursor: 'pointer',
  },
  alertRow: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '8px', background: 'transparent', border: 'none',
    borderBottom: `1px solid ${LINE}`, fontFamily: 'inherit', cursor: 'pointer',
  },

  glance: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 },
  fact: { ...clickable, padding: '11px 13px', background: '#fcfdfe', textAlign: 'left' },
}
