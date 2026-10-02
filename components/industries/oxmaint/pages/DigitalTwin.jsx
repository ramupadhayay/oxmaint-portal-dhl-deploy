'use client'

import { useMemo } from 'react'
import {
  PageHeader, Card, Section, StatStrip, DataTable, StatusBadge, Sparkline,
  StatusDot, Priority, PALETTE,
} from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { ASSETS, daysUntil, fmtDate, between } from '../lib/data'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, AMBER, RED } = PALETTE

const CRIT_RANK = { High: 0, Medium: 1, Low: 2 }
const STATE_TONE = { Alarm: RED, Watch: AMBER, Normal: GREEN }
const STATE_BADGE = { Alarm: 'red', Watch: 'amber', Normal: 'green' }

const stateOf = (value, warn, alarm) => (value >= alarm ? 'Alarm' : value >= warn ? 'Watch' : 'Normal')

// A trace, not a random walk. Each point is a hash of the tag key and its
// index, so the same asset draws the same curve on every load — a chart that
// redraws differently each time cannot be pointed at during a demo.
const trace = (key, base, amp, drift, points = 20) => Array.from({ length: points }, (_, i) => (
  Number((base - drift * ((points - 1 - i) / (points - 1)) + between(`${key}-${i}`, -amp, amp, 2)).toFixed(2))
))

export default function DigitalTwin() {
  const { scope, siteName } = useSite()

  const d = useMemo(() => {
    const assets = scope(ASSETS)

    // Only the critical assets get a twin, and they are sampled across the
    // health range rather than taken from the bottom of it. Eight machines all
    // in the worst condition put every tag on Watch at once, and a wall where
    // nothing is ever green gives an operator no reference for what normal
    // looks like. Where a site has fewer than eight critical assets the pool
    // widens by criticality so the screen is never empty.
    const critical = assets.filter((a) => a.criticality === 'High')
    const pool = (critical.length >= 8 ? critical : [...assets])
      .sort((a, b) => (CRIT_RANK[a.criticality] - CRIT_RANK[b.criticality]) || (a.health_score - b.health_score))
    const step = Math.max(1, Math.floor(pool.length / 8))
    const chosen = pool.filter((_, i) => i % step === 0).slice(0, 8)

    const twins = chosen.map((a) => {
      const k = a.asset_id
      const wear = 100 - a.health_score
      const daysSinceService = Math.abs(daysUntil(a.last_maintenance_date))
      const dailyHours = between(k + 'dh', 8, 22)

      const tempBase = Number((42 + wear * 0.72 + between(k + 'tj', -2, 2, 1)).toFixed(1))
      const vibBase = Number((1.0 + wear * 0.11 + between(k + 'vj', -0.2, 0.2, 2)).toFixed(2))
      const rated = between(k + 'rate', 34, 96)
      const current = Number((rated * (0.62 + wear / 170)).toFixed(1))
      const hoursSinceService = daysSinceService * dailyHours

      const tags = [
        {
          tag: `${a.asset_code}.TE01`, name: 'Bearing temperature', value: tempBase, unit: '°C',
          warn: 66, alarm: 76,
          series: trace(k + 'temp', tempBase, 1.4, wear * 0.14),
        },
        {
          tag: `${a.asset_code}.VE01`, name: 'Vibration RMS', value: vibBase, unit: 'mm/s',
          warn: 4.5, alarm: 7.1,
          series: trace(k + 'vib', vibBase, 0.22, wear * 0.02),
        },
        {
          tag: `${a.asset_code}.II01`, name: 'Motor current', value: current, unit: 'A',
          warn: Number((rated * 0.85).toFixed(1)), alarm: rated,
          series: trace(k + 'amp', current, 1.8, wear * 0.05),
        },
        {
          tag: `${a.asset_code}.RH01`, name: 'Hours since service', value: hoursSinceService, unit: 'h',
          warn: 1200, alarm: 1600,
          series: trace(k + 'run', hoursSinceService, 12, hoursSinceService * 0.35),
        },
      ].map((t) => {
        // The warning line is only drawn when it falls inside the plotted range.
        // A baseline outside it renders off the top or bottom of the sparkline,
        // where it reads as a missing axis rather than as a limit.
        const lo = Math.min(...t.series)
        const hi = Math.max(...t.series)
        return {
          ...t,
          state: stateOf(t.value, t.warn, t.alarm),
          baseline: t.warn >= lo && t.warn <= hi ? t.warn : undefined,
          asset_name: a.asset_name,
          asset_code: a.asset_code,
          site_name: a.site_name,
          updated_s: between(t.tag + 'u', 2, 48),
        }
      })

      const worst = tags.some((t) => t.state === 'Alarm') ? 'Alarm'
        : tags.some((t) => t.state === 'Watch') ? 'Watch' : 'Normal'

      return { asset: a, tags, worst, daily_hours: dailyHours, days_since_service: daysSinceService }
    })

    const allTags = twins.flatMap((t) => t.tags)

    return {
      twins,
      allTags,
      alarms: allTags.filter((t) => t.state === 'Alarm').length,
      watches: allTags.filter((t) => t.state === 'Watch').length,
      avgHealth: chosen.length ? Math.round(chosen.reduce((n, a) => n + a.health_score, 0) / chosen.length) : 0,
    }
  }, [scope])

  return (
    <div>
      <PageHeader
        icon={sectionIcon('digital-twin', '#15227a')}
        title="Digital Twin"
        subtitle={`${d.twins.length} modelled assets · ${d.allTags.length} tags · ${siteName}`}
        right={<span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: SUB, fontWeight: 600 }}>
          <StatusDot color={GREEN} pulse />Streaming
        </span>}
      />

      <StatStrip items={[
        { label: 'Twins live', value: d.twins.length, note: 'critical assets across the health range' },
        { label: 'Tags streaming', value: d.allTags.length, note: 'four per modelled asset' },
        { label: 'Tags in alarm', value: d.alarms, tone: d.alarms ? 'red' : 'green', note: 'above the alarm limit' },
        { label: 'Tags on watch', value: d.watches, tone: d.watches ? 'amber' : 'green', note: 'above the warning limit' },
        { label: 'Average health', value: d.avgHealth, unit: '%', note: 'across the modelled assets' },
      ]} />

      <Card style={{ marginBottom: 14, padding: '13px 16px', background: '#f8fafc', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ marginTop: 1 }}>{sectionIcon('digital-twin', ACCENT)}</div>
        <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.55 }}>
          The readings on this screen are simulated. Each one is derived from the asset
          record — its health score, criticality and time since the last service — so a machine in poor
          condition reads hot and rough and a healthy one does not, and the same asset draws the same
          trace every time this page is opened. On a live installation these tags come from the plant
          historian through the IoT connector.
        </p>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(370px, 100%),1fr))', gap: 14, marginBottom: 14 }}>
        {d.twins.map((t) => <TwinCard key={t.asset.asset_id} twin={t} />)}
      </div>

      {!d.twins.length && (
        <Card style={{ textAlign: 'center', color: MUTE, fontSize: 12.5, padding: '30px 0' }}>
          No assets in scope at {siteName}.
        </Card>
      )}

      <Section title="Tag list" right={<span style={{ fontSize: 11.5, color: MUTE }}>limits are per tag, not per asset</span>}>
        <DataTable
          pageSize={12}
          rows={d.allTags}
          empty="No tags streaming."
          columns={[
            { key: 'tag', label: 'Tag', render: (r) => <span style={{ fontWeight: 700, color: ACCENT, whiteSpace: 'nowrap' }}>{r.tag}</span> },
            { key: 'name', label: 'Measurement' },
            { key: 'asset_name', label: 'Asset', render: (r) => (
              <span>
                <span style={{ display: 'block', fontWeight: 600 }}>{r.asset_name}</span>
                <span style={{ display: 'block', fontSize: 11, color: MUTE }}>{r.site_name}</span>
              </span>
            ) },
            { key: 'value', label: 'Value', align: 'right', render: (r) => (
              <span style={{ fontWeight: 800, color: STATE_TONE[r.state] }}>{r.value} {r.unit}</span>
            ) },
            { key: 'warn', label: 'Warn', align: 'right', render: (r) => `${r.warn} ${r.unit}` },
            { key: 'alarm', label: 'Alarm', align: 'right', render: (r) => `${r.alarm} ${r.unit}` },
            { key: 'state', label: 'State', render: (r) => <StatusBadge tone={STATE_BADGE[r.state]}>{r.state}</StatusBadge> },
            { key: 'updated_s', label: 'Updated', align: 'right', render: (r) => <span style={{ color: SUB, whiteSpace: 'nowrap' }}>{r.updated_s}s ago</span> },
          ]} />
      </Section>
    </div>
  )
}

function TwinCard({ twin }) {
  const a = twin.asset
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{a.asset_name}</div>
          <div style={{ fontSize: 11.5, color: MUTE, marginTop: 2 }}>
            {a.asset_code} · {a.functional_location_name} · {a.site_name}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
          <StatusBadge tone={STATE_BADGE[twin.worst]}>{twin.worst}</StatusBadge>
          <Priority value={a.criticality} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {twin.tags.map((t) => (
          <div key={t.tag} style={{
            border: `1px solid ${LINE}`, borderRadius: 10, padding: '9px 11px', background: '#fcfdfe',
            borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: STATE_TONE[t.state],
          }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.35 }}>{t.name}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 3 }}>
              <span style={{ fontSize: 19, fontWeight: 800, color: STATE_TONE[t.state], lineHeight: 1 }}>{t.value}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: SUB }}>{t.unit}</span>
            </div>
            <div style={{ fontSize: 10.5, color: MUTE, marginTop: 3 }}>warn {t.warn} · alarm {t.alarm}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', paddingTop: 11, borderTop: `1px solid ${LINE}` }}>
        {twin.tags.slice(0, 2).map((t) => (
          <div key={t.tag} style={{ flex: '1 1 140px', minWidth: 140 }}>
            <div style={{ fontSize: 10.5, color: MUTE, marginBottom: 3 }}>{t.name} · last 20 samples</div>
            <Sparkline data={t.series} color={STATE_TONE[t.state]} w={160} h={38} baseline={t.baseline} />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 11, paddingTop: 10, borderTop: `1px solid ${LINE}`, fontSize: 11.5, color: SUB, flexWrap: 'wrap' }}>
        <span>Health <strong style={{ color: INK }}>{a.health_score}%</strong></span>
        <span>Runtime <strong style={{ color: INK }}>{a.running_hours.toLocaleString('en-US')} h</strong></span>
        <span>Serviced <strong style={{ color: INK }}>{fmtDate(a.last_maintenance_date)}</strong></span>
      </div>
    </Card>
  )
}
