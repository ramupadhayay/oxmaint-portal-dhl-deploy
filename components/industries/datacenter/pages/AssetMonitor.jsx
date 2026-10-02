'use client'

// Screen 2.2 — the deep dive on one asset, and the screen the spec says the
// demo spends most of its time on.
//
// It has to tell the asset's whole current story in one view: what the three
// sensors read now, where the health score is and which way it is going, what
// is wrong if anything, and what to do about it.
//
// The alert banner and the recommendation are rendered only when there is an
// open alert, per the spec's explicit instruction — "hidden entirely for
// healthy assets, do not show an empty/placeholder alert box". A grey box
// saying "no active alerts" on a healthy asset is the demo telling the client
// their equipment is a place where alerts are missing.

import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, Section, ActionButton, StatusBadge, PALETTE } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import SensorCard from '../components/SensorCard'
import TrendChart from '../components/TrendChart'
import { Facts } from '../components/Register'
import {
  monAssetById, MON_ASSET_ROWS, SENSORS, sensorByKey, baselineFor,
  confidenceStory, MON_WINDOW,
} from '../lib/monitoring'

const { SUB, MUTE, INK, LINE, GREEN, AMBER, RED, ACCENT } = PALETTE

const URGENCY = { High: 'red', Medium: 'amber', Low: 'blue' }

export default function AssetMonitor() {
  const { id } = useParams()
  const router = useRouter()
  const assetId = decodeURIComponent(String(id))
  const asset = monAssetById.get(assetId)

  const back = () => router.push('/portal/datacenter/monitoring')

  const health = useMemo(() => (asset?._health || []).map((h) => ({ date: h.date, value: h.score })), [asset])

  if (!asset) {
    return (
      <div>
        <PageHeading title="Asset not monitored" back={{ label: 'Asset Condition Overview', onClick: back }}
          subtitle={`${assetId} is not one of the assets with condition monitoring in this PoC.`} />
        <Card>
          <div style={{ padding: '26px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 12.5, color: MUTE, marginBottom: 14 }}>
              Monitoring covers {MON_ASSET_ROWS.length} assets: {MON_ASSET_ROWS.map((a) => a.assetId).join(', ')}.
            </div>
            <ActionButton onClick={back}>Back to the overview</ActionButton>
          </div>
        </Card>
      </div>
    )
  }

  const alert = asset._openAlert || asset._lastAlert
  const open = Boolean(asset._openAlert)
  const rec = alert?._recommendation
  const story = alert ? confidenceStory(alert) : null

  const trendTone = asset._trend === 'declining' ? RED : asset._trend === 'rising' ? GREEN : SUB
  const bandTone = asset._band === 'green' ? GREEN : asset._band === 'amber' ? AMBER : RED

  return (
    <div>
      <PageHeading
        back={{ label: 'Asset Condition Overview', onClick: back }}
        title={asset.assetName}
        subtitle={`${asset.assetId} · ${asset.assetClass} · ${asset.location} · ${asset.criticality} criticality`}
        right={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ActionButton onClick={() => router.push(`/portal/datacenter/trend?asset=${encodeURIComponent(asset.assetId)}`)}>
              Open trends
            </ActionButton>
            <button onClick={() => router.push(`/portal/datacenter/assets/${encodeURIComponent(asset.assetId)}`)} style={styles.secondary}>
              Asset record
            </button>
          </div>
        }
      />

      {/* Only when something is actually open. */}
      {open && alert && (
        <div style={styles.banner}>
          <div style={styles.bannerHead}>
            <StatusBadge tone={alert.severity === 'Critical' ? 'red' : 'amber'}>{alert.severity}</StatusBadge>
            <span style={styles.code}>{alert.failureCode}</span>
            <span style={styles.bannerMeta}>{alert.alertId} · raised {alert.dateRaised}</span>
            {story && (
              <span style={styles.confirmed}>
                confirmed by {story.agreeing} of {story.of} sensors
              </span>
            )}
          </div>
          <div style={styles.bannerText}>{alert.description}</div>
          <div style={styles.bannerFoot}>
            <span style={styles.confidence}>
              Confidence <strong>{alert.confidence}%</strong>
              {story && <span style={styles.confidenceWas}> — {story.before}% on the first sensor alone</span>}
            </span>
            <button onClick={() => router.push(`/portal/datacenter/detections/${encodeURIComponent(alert.alertId)}`)} style={styles.bannerLink}>
              Why the system believes this →
            </button>
          </div>
        </div>
      )}

      <div style={styles.top}>
        <div style={styles.healthCard}>
          <div style={styles.healthLabel}>Health score</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
            <span style={{ ...styles.healthValue, color: bandTone }}>{asset._score ?? '—'}</span>
            <span style={{ ...styles.healthTrend, color: trendTone }}>
              {asset._trend === 'declining' ? '↓' : asset._trend === 'rising' ? '↑' : '→'} {asset._trend}
              {asset._delta != null && asset._delta !== 0 && ` ${asset._delta > 0 ? '+' : ''}${asset._delta}`}
            </span>
          </div>
          <div style={styles.healthNote}>against the score seven days earlier</div>
          <div style={{ marginTop: 12 }}>
            <TrendChart data={health} color={bandTone} height={150} decimals={0} />
          </div>
        </div>

        <div style={styles.sensorGrid}>
          {SENSORS.map((s) => (
            <SensorCard
              key={s.key}
              sensor={s}
              value={asset._latest?.[s.key]}
              status={asset._latest?.[s.statusKey]}
              baseline={baselineFor(asset.assetId, s.key)}
              series={asset._readings.map((r) => r[s.key])}
              onClick={() => router.push(`/portal/datacenter/trend?asset=${encodeURIComponent(asset.assetId)}&sensor=${s.key}`)}
            />
          ))}
        </div>
      </div>

      {/* Only alongside an active alert, again per the spec. */}
      {open && rec && (
        <Section title="Recommended action">
          <div style={styles.rec}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 8 }}>
              <StatusBadge tone={URGENCY[rec.urgency] || 'grey'}>{rec.urgency} urgency</StatusBadge>
              <span style={styles.recMeta}>{rec.recId} · issued {rec.dateIssued}</span>
            </div>
            <div style={styles.recText}>{rec.action}</div>
            <div style={styles.recFoot}>
              <span>Work order <strong style={{ color: INK }}>{rec.workOrderId}</strong> — {rec.woStatus}</span>
              <button onClick={() => router.push(`/portal/datacenter/recommendations`)} style={styles.recLink}>
                Open the work order →
              </button>
            </div>
          </div>
        </Section>
      )}

      <Section title="Asset">
        <Facts items={[
          ['Asset ID', asset.assetId],
          ['Class', asset.assetClass],
          ['Site', asset.siteId],
          ['Location', asset.location],
          // The two workbooks disagree on this for two of the three assets —
          // the monitoring sheet says Critical where the Final Asset Scope
          // Matrix says High. Both are client data and neither is ours to
          // correct, so the difference is shown rather than hidden behind
          // whichever source happened to load first. Silently picking one is
          // how a portal ends up stating two different criticalities for the
          // same asset on two different screens.
          ['Criticality', asset._register && asset._register.criticality !== asset.criticality
            ? (
              <span>
                {asset.criticality}
                <span style={styles.disagree}>
                  asset register records {asset._register.criticality}
                </span>
              </span>
            )
            : asset.criticality],
          ['Manufacturer', asset.manufacturer],
          ['Monitoring', asset._monitoring.join(' · ')],
          ['Installed', asset.installDate],
          ['Current status', <StatusBadge key="s">{asset.status}</StatusBadge>],
          ['Readings held', `${asset._readings.length} days (${MON_WINDOW.from} → ${MON_WINDOW.to})`],
        ]} />
      </Section>
    </div>
  )
}

const styles = {
  secondary: {
    padding: '8px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 9, color: '#475569', cursor: 'pointer',
  },

  banner: { border: '1px solid #fecaca', background: '#fef2f2', borderRadius: 13, padding: '15px 17px', marginBottom: 16 },
  bannerHead: { display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
  code: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, fontWeight: 700, color: '#b91c1c', background: '#fff', border: '1px solid #fecaca', borderRadius: 6, padding: '2px 7px' },
  bannerMeta: { fontSize: 11.5, color: '#9f1239' },
  confirmed: { fontSize: 10.5, fontWeight: 800, color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 999, padding: '2px 9px' },
  bannerText: { fontSize: 13.5, color: INK, lineHeight: 1.55, marginTop: 9 },
  bannerFoot: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 11 },
  confidence: { fontSize: 12.5, color: SUB },
  confidenceWas: { color: MUTE },
  bannerLink: {
    padding: '5px 11px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
    background: '#fff', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 7, cursor: 'pointer',
  },

  top: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.15fr)', gap: 16, marginBottom: 16, alignItems: 'start' },
  healthCard: { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, boxShadow: '0 1px 2px rgba(15,23,42,0.04)' },
  healthLabel: { fontSize: 11, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 },
  healthValue: { fontSize: 42, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' },
  healthTrend: { fontSize: 13, fontWeight: 700 },
  healthNote: { fontSize: 11.5, color: MUTE, marginTop: 6 },

  sensorGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 },
  disagree: {
    display: 'inline-block', marginLeft: 8, padding: '1px 8px',
    fontSize: 10.5, fontWeight: 700, color: '#b45309',
    background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 999,
  },

  rec: { border: `1px solid ${LINE}`, borderRadius: 12, padding: '14px 16px', background: '#fcfdfe' },
  recMeta: { fontSize: 11.5, color: MUTE },
  recText: { fontSize: 14.5, fontWeight: 600, color: INK, lineHeight: 1.5 },
  recFoot: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 12, fontSize: 12.5, color: SUB },
  recLink: {
    padding: '5px 11px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
    background: '#fff', border: `1px solid ${ACCENT}33`, color: ACCENT, borderRadius: 7, cursor: 'pointer',
  },
}
