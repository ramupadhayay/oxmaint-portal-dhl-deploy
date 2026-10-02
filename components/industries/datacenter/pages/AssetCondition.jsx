'use client'

// Screen 2.1 — the landing screen for the monitoring demo.
//
// Its job is breadth: every monitored asset at a glance, before anyone drills
// into one. The spec's note is "keep it fast and uncluttered", so it is a card
// per asset and nothing else — no filters that filter three rows, no chart that
// summarises what the three cards already say.
//
// Status is taken from the latest alert's severity rather than the health score
// alone, which the spec calls out: a fresh low-severity alert has to read
// differently from a critical one, and a score cannot say that on its own.
//
// ── three doors into one screen ───────────────────────────────────────────
//
// The module architecture splits asset health in two — Power Asset Health for
// the electrical classes and Mechanical Asset Health for the rest — and keeps
// an Asset Health Center above both. They are the same view of the same
// readings over a different slice of the estate, so they are one component with
// a preset rather than three screens that drift apart. The heading and the
// counts follow the slice, so a reader on Mechanical is never shown a number
// that includes a transformer.

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Section, StatusBadge, PALETTE } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import SourceNote from '../components/SourceNote'
import { StatCards } from '../components/MetricCard'
import { MON_ASSET_ROWS, MON_WINDOW, SENSORS } from '../lib/monitoring'

const { SUB, MUTE, INK, LINE, GREEN, AMBER, RED, ACCENT } = PALETTE

const BAND = {
  green: { fg: '#047857', bg: '#ecfdf5', border: '#a7f3d0', bar: GREEN },
  amber: { fg: '#b45309', bg: '#fffbeb', border: '#fde68a', bar: AMBER },
  red: { fg: '#b91c1c', bg: '#fef2f2', border: '#fecaca', bar: RED },
  grey: { fg: '#475569', bg: '#f8fafc', border: '#e2e8f0', bar: '#94a3b8' },
}

const TREND = {
  rising: { glyph: '↑', label: 'improving', color: GREEN },
  declining: { glyph: '↓', label: 'declining', color: RED },
  stable: { glyph: '→', label: 'stable', color: '#64748b' },
}

// Which slice each door opens on, and what it is called there.
const VIEWS = {
  'power-health': {
    category: 'Electrical',
    title: 'Power Asset Health',
    what: 'the UPS systems, switchgear, transformers, PDUs, static switches and generator sets under monitoring',
  },
  'mechanical-health': {
    category: 'Mechanical',
    title: 'Mechanical Asset Health',
    what: 'the CRAH and CRAC units, chillers, condensers, cooling towers, pumps and air handlers under monitoring',
  },
  monitoring: {
    category: null,
    title: 'Asset Health Center',
    what: 'every asset under continuous vibration, thermal and ultrasound monitoring',
  },
}

export default function AssetCondition() {
  const router = useRouter()
  const { section } = useParams()
  const view = VIEWS[section] || VIEWS.monitoring

  const [sort, setSort] = useState('score')
  const [site, setSite] = useState('all')
  const [cls, setCls] = useState('all')

  // The slice this door opens on. Everything below counts over it, so the stat
  // strip on Mechanical never includes an electrical asset.
  const scoped = useMemo(
    () => (view.category
      ? MON_ASSET_ROWS.filter((a) => a._register?._category === view.category)
      : MON_ASSET_ROWS),
    [view.category])

  // SOW 2.1 asks for a site/region filter, and today every monitored asset is
  // in one data hall at one site. A select with a single option is a control
  // that advertises it has nothing to do, so each filter appears only once
  // there is more than one value to choose between. The spec is satisfied the
  // moment the monitoring set spans two sites; until then the screen is not
  // pretending.
  const sites = useMemo(() => [...new Set(scoped.map((a) => a.siteId).filter(Boolean))], [scoped])
  const classes = useMemo(() => [...new Set(scoped.map((a) => a.assetClass).filter(Boolean))], [scoped])

  const assets = useMemo(() => {
    const rows = scoped
      .filter((a) => site === 'all' || a.siteId === site)
      .filter((a) => cls === 'all' || a.assetClass === cls)
    if (sort === 'score') return [...rows].sort((a, b) => (a._score ?? 999) - (b._score ?? 999))
    if (sort === 'name') return [...rows].sort((a, b) => a.assetName.localeCompare(b.assetName))
    return [...rows].sort((a, b) => String(b._lastAlert?.dateRaised || '').localeCompare(String(a._lastAlert?.dateRaised || '')))
  }, [scoped, sort, site, cls])

  // Counted over the slice rather than read off the estate-wide summary, which
  // would put the same four numbers on all three doors.
  const healthy = scoped.filter((a) => (a._score ?? 0) >= 85).length
  const openAlerts = scoped.filter((a) => a._openAlert).length
  const alerts = scoped.reduce((n, a) => n + (a._alerts?.length || 0), 0)

  const stats = [
    { label: 'Monitored assets', value: scoped.length, note: `${MON_WINDOW.days} days of readings` },
    { label: 'Healthy', value: healthy, tone: 'green', note: 'score 85 or above' },
    { label: 'Open alerts', value: openAlerts, tone: openAlerts ? 'amber' : 'green', note: `${alerts} raised in total` },
    { label: 'Sensors per asset', value: SENSORS.length, note: 'vibration, thermal, ultrasound' },
  ]

  return (
    <div>
      <PageHeading
        title={view.title}
        subtitle={`${view.what.charAt(0).toUpperCase()}${view.what.slice(1)}. ${MON_WINDOW.from} to ${MON_WINDOW.to}.`}
        right={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {sites.length > 1 && (
              <label style={styles.sortWrap}>
                <span style={styles.sortLabel}>Site</span>
                <select value={site} onChange={(e) => setSite(e.target.value)} style={styles.sort}>
                  <option value="all">All sites ({sites.length})</option>
                  {sites.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </label>
            )}
            {classes.length > 1 && (
              <label style={styles.sortWrap}>
                <span style={styles.sortLabel}>Class</span>
                <select value={cls} onChange={(e) => setCls(e.target.value)} style={styles.sort}>
                  <option value="all">All classes</option>
                  {classes.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </label>
            )}
            <label style={styles.sortWrap}>
              <span style={styles.sortLabel}>Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)} style={styles.sort}>
                <option value="score">Health score, worst first</option>
                <option value="alert">Most recent alert</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>
        }
      />

      <SourceNote
        client={MON_ASSET_ROWS.filter((r) => !r._gapFill).length}
        added={MON_ASSET_ROWS.filter((r) => r._gapFill).length}
        what="assets"
        extra="Both are on this list and read the same way."
      />

      <StatCards items={stats} />

      <div style={styles.grid}>
        {assets.map((a) => {
          const band = BAND[a._band]
          const trend = TREND[a._trend]
          return (
            <button key={a.assetId} className="dc-asset" style={styles.card}
              onClick={() => router.push(`/portal/datacenter/monitoring/${encodeURIComponent(a.assetId)}`)}>
              <div style={{ ...styles.accent, background: band.bar }} />

              <div style={styles.cardHead}>
                <div style={{ minWidth: 0 }}>
                  <div style={styles.assetName}>{a.assetName}</div>
                  <div style={styles.assetMeta}>{a.assetId} · {a.location}</div>
                </div>
                <div style={{ ...styles.score, color: band.fg, background: band.bg, borderColor: band.border }}>
                  {a._score ?? '—'}
                </div>
              </div>

              <div style={styles.badges}>
                <StatusBadge tone={a._band === 'green' ? 'green' : a._band === 'amber' ? 'amber' : 'red'}>
                  {a._status}
                </StatusBadge>
                <span style={{ ...styles.trend, color: trend.color }}>
                  {trend.glyph} {trend.label}
                  {a._delta != null && a._delta !== 0 && <span style={styles.delta}>{a._delta > 0 ? '+' : ''}{a._delta} in 7d</span>}
                </span>
              </div>

              <div style={styles.sensors}>
                {SENSORS.map((s) => {
                  const v = a._latest?.[s.key]
                  return (
                    <div key={s.key} style={styles.sensor}>
                      <span style={styles.sensorLabel}>{s.label}</span>
                      <span style={styles.sensorValue}>
                        {typeof v === 'number' ? v.toFixed(s.decimals) : '—'}
                        <span style={styles.sensorUnit}> {s.unit}</span>
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* "None" said out loud rather than left blank, per the spec —
                  a clean history is a result, and an empty cell looks like
                  missing data. */}
              <div style={styles.foot}>
                {a._lastAlert ? (
                  <>Last alert <strong style={{ color: INK }}>{a._lastAlert.alertId}</strong> · {a._lastAlert.dateRaised}</>
                ) : (
                  <>No alerts raised in this window</>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <style>{`
        .dc-asset { transition: transform .2s cubic-bezier(.22,1,.36,1), box-shadow .2s, border-color .2s; }
        .dc-asset:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(15,23,42,0.10); border-color: #c3cbe6; }
      `}</style>
    </div>
  )
}

const styles = {
  sortWrap: { display: 'flex', alignItems: 'center', gap: 8 },
  sortLabel: { fontSize: 11, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 },
  sort: {
    padding: '8px 11px', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 600,
    border: `1px solid ${LINE}`, borderRadius: 9, background: '#fff', color: INK, outline: 'none', cursor: 'pointer',
  },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(330px,1fr))', gap: 16 },
  card: {
    position: 'relative', overflow: 'hidden', display: 'block', width: '100%',
    textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer',
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14,
    padding: '18px 18px 16px', boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
  },
  accent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },

  cardHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  assetName: { fontSize: 15.5, fontWeight: 700, color: INK, letterSpacing: '-0.01em' },
  assetMeta: { fontSize: 11.5, color: MUTE, marginTop: 3 },
  score: {
    minWidth: 52, height: 52, borderRadius: 13, border: '1px solid',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 21, fontWeight: 800, flexShrink: 0, fontVariantNumeric: 'tabular-nums',
  },

  badges: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12 },
  trend: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600 },
  delta: { fontSize: 11, color: MUTE, fontWeight: 500 },

  sensors: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 14 },
  sensor: { background: '#f8fafc', border: `1px solid ${LINE}`, borderRadius: 9, padding: '8px 9px', minWidth: 0 },
  sensorLabel: { display: 'block', fontSize: 9.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.3 },
  sensorValue: { display: 'block', fontSize: 14, fontWeight: 700, color: INK, marginTop: 3, fontVariantNumeric: 'tabular-nums' },
  sensorUnit: { fontSize: 10.5, fontWeight: 600, color: MUTE },

  foot: { fontSize: 11.5, color: MUTE, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${LINE}` },
}
