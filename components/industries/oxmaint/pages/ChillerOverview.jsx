'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader, Card, Section, StatStrip, Donut, StatusBadge, Bar, StatusDot, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { DOMAIN, fmtDate } from '../lib/data'
import { CHILLERS, CHILLER_ALERTS, PARAMS, WINDOW_DAYS, stateTotals } from '../lib/dataChiller'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, AMBER, RED } = PALETTE

const SEV_TONE = { Critical: 'red', High: 'amber', Medium: 'blue' }

export default function ChillerOverview() {
  const router = useRouter()
  const { scope, siteName } = useSite()

  const d = useMemo(() => {
    const chillers = scope(CHILLERS)
    const alerts = scope(CHILLER_ALERTS)
    const tons = chillers.reduce((n, c) => n + c.tons, 0)

    // Tonnage-weighted, because the electricity bill is. An unweighted mean lets
    // a 250-ton machine move the headline as far as a 1,400-ton one.
    const w = (get) => (tons ? Number((chillers.reduce((n, c) => n + get(c) * c.tons, 0) / tons).toFixed(2)) : 0)
    const copNow = w((c) => c.cop_now)
    const baseline = w((c) => c.cop_design)

    return {
      chillers, alerts, copNow, baseline,
      drift: baseline ? Number((((baseline - copNow) / baseline) * 100).toFixed(1)) : 0,
      atRisk: chillers.filter((c) => c.leak_band === 'High' || c.leak_band === 'Elevated').length,
      high: chillers.filter((c) => c.leak_band === 'High').length,
      topScore: chillers.reduce((n, c) => Math.max(n, c.leak_score), 0),
      openAlerts: alerts.filter((a) => !a.work_order_raised).length,
      addedLb: chillers.reduce((n, c) => n + c.added_12m_lb, 0),
      avgHealth: chillers.length ? Math.round(chillers.reduce((n, c) => n + c.health_index, 0) / chillers.length) : 0,
      poorHealth: chillers.filter((c) => c.health_index < 70).length,
      ranking: [...chillers].sort((a, b) => a.health_index - b.health_index).slice(0, 8),
      recent: alerts.slice(0, 6),
    }
  }, [scope])

  // The pack decides whether this module exists. Rendering a note rather than
  // throwing means the route survives a pack swap instead of white-screening.
  if (DOMAIN?.key !== 'chiller') return <ModuleOff />

  const go = (k) => router.push('/portal/oxmaint/' + k)

  return (
    <div>
      <PageHeader
        icon={sectionIcon('chiller', ACCENT)}
        title={DOMAIN.label}
        subtitle={`${d.chillers.length} refrigerant-carrying machines · ${DOMAIN.subtitle} · ${siteName}`}
        right={<span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: SUB, fontWeight: 600 }}>
          <StatusDot color={GREEN} pulse />Monitoring
        </span>}
      />

      <StatStrip items={[
        { label: 'Chillers monitored', value: d.chillers.length, note: `${PARAMS.length} parameters each, ${WINDOW_DAYS}-day history` },
        { label: 'At leak risk', value: d.atRisk, tone: d.atRisk ? 'red' : 'green', note: `modelled score 40 or above · ${d.high} high` },
        { label: 'Efficiency drift', value: d.drift, unit: '%', tone: d.drift >= 5 ? 'amber' : 'green', note: `COP ${d.copNow} against ${d.baseline} commissioned` },
        { label: 'Alerts open', value: d.openAlerts, tone: d.openAlerts ? 'amber' : 'green', note: `${d.alerts.length} raised, ${d.alerts.length - d.openAlerts} on a work order` },
        { label: 'Refrigerant added', value: d.addedLb.toLocaleString('en-US'), unit: 'lb', note: 'last 12 months across the fleet' },
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(232px,1fr))', gap: 14, marginBottom: 14 }}>
        <ThemeCard
          title="24/7 monitoring" value={d.chillers.length * PARAMS.length} unit="parameters"
          body="Refrigeration, thermal, electrical and operating points read continuously from the controllers and the BMS."
          action="Condition monitoring" onClick={() => go('chiller-monitor')} tint={ACCENT} />
        <ThemeCard
          title="Asset health" value={d.avgHealth} unit="mean index"
          body={`${d.poorHealth} machine${d.poorHealth === 1 ? '' : 's'} below 70, ranked by what is currently out of band.`}
          action="Condition monitoring" onClick={() => go('chiller-monitor')} tint={GREEN} />
        <ThemeCard
          title="Leak risk" value={d.topScore} unit="highest score"
          body="Refrigerant-loss probability from correlated movement in subcooling, superheat and suction pressure."
          action="Leak detection" onClick={() => go('leak-detection')} tint={RED} />
        <ThemeCard
          title="Energy" value={d.copNow} unit="fleet COP"
          body={`${d.drift}% below the commissioning baseline at matched load, weighted by tonnage.`}
          action="Efficiency and energy" onClick={() => go('chiller-efficiency')} tint={AMBER} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(340px, 100%),1fr))', gap: 14, marginBottom: 14 }}>
        <Section title="Fleet health ranking"
          right={<span style={{ fontSize: 11.5, color: MUTE }}>worst first</span>}>
          {d.ranking.length ? d.ranking.map((c, i) => (
            <button key={c.asset_id} onClick={() => go('chiller-monitor')} style={rowBtn}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: MUTE, width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
              <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.asset_name} · {c.asset_code}
                </span>
                <span style={{ display: 'block', fontSize: 11, color: MUTE, margin: '2px 0 4px' }}>
                  {c.site_name} · {c.refrigerant} · {c.tons} tons
                </span>
                <Bar pct={c.health_index} color={healthColour(c.health_index)} />
              </span>
              <span style={{ flexShrink: 0, textAlign: 'right', minWidth: 76 }}>
                <span style={{ display: 'block', fontSize: 16, fontWeight: 800, color: healthColour(c.health_index), lineHeight: 1.1 }}>{c.health_index}</span>
                <span style={{ display: 'block', fontSize: 10.5, color: MUTE, marginTop: 2 }}>
                  {c.alarms} alarm · {c.warnings} warn
                </span>
              </span>
            </button>
          )) : <Empty>No chillers in scope at {siteName}.</Empty>}
        </Section>

        <Section title="Parameter states"
          right={<span style={{ fontSize: 11.5, color: MUTE }}>latest reading per parameter</span>}>
          <Donut data={stateTotals(d.chillers)} colors={[GREEN, AMBER, RED]} />
          <p style={{ margin: '14px 0 0', paddingTop: 12, borderTop: `1px solid ${LINE}`, fontSize: 11.5, color: SUB, lineHeight: 1.55 }}>
            Each machine contributes {PARAMS.length} readings, judged against the operating ranges in the pack
            rather than against a single fleet setpoint. Warning and alarm bands are one-sided: subcooling is
            judged on the way down, superheat on the way up.
          </p>
        </Section>
      </div>

      <Section title="Recent predictive alerts"
        right={<button onClick={() => go('leak-detection')} style={linkBtn}>Leak detection →</button>}>
        {d.recent.length ? d.recent.map((a) => (
          <button key={a.alert_id}
            onClick={() => go(a.rule === 'refrigerant-loss' ? 'leak-detection' : a.rule === 'efficiency-drift' ? 'chiller-efficiency' : 'chiller-monitor')}
            style={{ ...rowBtn, alignItems: 'flex-start' }}>
            <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <StatusBadge tone={SEV_TONE[a.severity]}>{a.severity}</StatusBadge>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{a.cause}</span>
              </span>
              <span style={{ display: 'block', fontSize: 11.5, color: SUB, marginTop: 4 }}>
                {a.asset_name} · {a.asset_code} · {a.site_name}
              </span>
              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
                {a.parameters.map((p) => (
                  <span key={p.key} style={{
                    fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 6,
                    color: stateColour(p.state), background: '#f8fafc', border: `1px solid ${LINE}`,
                  }}>{p.label} {p.value}{p.unit ? ` ${p.unit}` : ''}</span>
                ))}
              </span>
            </span>
            <span style={{ flexShrink: 0, textAlign: 'right', minWidth: 116 }}>
              <span style={{ display: 'block', fontSize: 11.5, color: SUB }}>{fmtDate(a.detected_date)}</span>
              <span style={{ display: 'block', marginTop: 5 }}>
                {a.work_order_raised
                  ? <StatusBadge tone="green">{a.work_order_number}</StatusBadge>
                  : <StatusBadge tone="grey">No work order</StatusBadge>}
              </span>
            </span>
          </button>
        )) : <Empty>No alerts at {siteName}.</Empty>}
      </Section>
    </div>
  )
}

function ThemeCard({ title, value, unit, body, action, onClick, tint }) {
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '21px 18px 18px', boxShadow: `inset 0 3px 0 ${tint}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 27, fontWeight: 800, color: INK, lineHeight: 1 }}>{value}</span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: SUB }}>{unit}</span>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: SUB, lineHeight: 1.5, flex: 1 }}>{body}</p>
      <button onClick={onClick} style={{ ...linkBtn, textAlign: 'left', padding: 0 }}>{action} →</button>
    </Card>
  )
}

function ModuleOff() {
  return (
    <Card style={{ textAlign: 'center', padding: '44px 20px' }}>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: INK }}>This module is not switched on here</div>
      <p style={{ margin: '7px auto 0', maxWidth: 470, fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>
        Chiller condition monitoring belongs to refrigeration plant, which the organisation loaded here does not run.
        Use the portal switcher to open one that does.
      </p>
    </Card>
  )
}

function Empty({ children }) {
  return <div style={{ padding: '26px 0', textAlign: 'center', color: MUTE, fontSize: 12.5 }}>{children}</div>
}

const healthColour = (v) => (v >= 75 ? GREEN : v >= 55 ? AMBER : RED)
const stateColour = (s) => ({ Normal: GREEN, Warning: AMBER, Alarm: RED }[s] || SUB)

const rowBtn = {
  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
  padding: '10px 4px', background: 'none', border: 'none', borderBottom: `1px solid ${LINE}`,
  cursor: 'pointer', fontFamily: 'inherit',
}

const linkBtn = { background: 'none', border: 'none', color: ACCENT, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
