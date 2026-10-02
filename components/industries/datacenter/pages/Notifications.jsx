'use client'

// The Notifications screen — the whole feed the header bell shows the top of.
//
// One place an operator can stand and see everything raised across the estate
// that wants a decision: the AI Auditor's SLA risks and the condition
// monitoring's anomaly alerts, on one timeline, attention-first. Every row keeps
// the link back to the record it came from, so the screen is a routing surface,
// not a second copy of the data.
//
// Arriving from the bell carries a `?focus=` — the row that was clicked is
// ringed and scrolled to, so opening a specific notification lands on it rather
// than at the top of a long list.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PALETTE } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { useSite } from '../lib/siteStore'
import { useRiskStore } from '../lib/store'
import { buildNotifications } from '../lib/notifications'

const { SUB, MUTE, INK, LINE, GREEN, AMBER, RED, BLUE, ACCENT } = PALETTE

const TONES = {
  red: { fg: RED, bg: '#fef2f2', line: '#fecaca' },
  amber: { fg: '#b45309', bg: '#fffbeb', line: '#fde68a' },
  blue: { fg: '#1d4ed8', bg: '#eff6ff', line: '#bfdbfe' },
  green: { fg: '#047857', bg: '#ecfdf5', line: '#a7f3d0' },
  grey: { fg: SUB, bg: '#f8fafc', line: LINE },
}
const toneOf = (t) => TONES[t] || TONES.grey

// The dot colour reads severity at a glance before the words are read.
const SEV_DOT = { Critical: RED, High: AMBER, Warning: AMBER, Medium: BLUE, Low: MUTE }

export default function Notifications() {
  const router = useRouter()
  const { scope, siteName } = useSite()
  const riskStore = useRiskStore()
  const params = useSearchParams()
  const focusId = params?.get('focus') || null

  const overlays = useMemo(() => {
    const m = {}
    for (const r of riskStore.created) if (r.recId) m[r.recId] = r
    return m
  }, [riskStore.created])

  const { items, unread, escalated, openAlerts } = useMemo(
    () => buildNotifications({ scope, overlays }), [scope, overlays])

  const attention = items.filter((n) => n.attention)
  const earlier = items.filter((n) => !n.attention)

  const stats = [
    { label: 'Needs attention', value: unread, tone: unread ? 'red' : 'green', note: 'Unresolved and awaiting action' },
    { label: 'SLA escalations', value: escalated, tone: escalated ? 'amber' : 'green', note: 'Risks past their restore SLA' },
    { label: 'Open alerts', value: openAlerts, tone: openAlerts ? 'blue' : 'green', note: 'Anomalies in engineering review' },
    { label: 'In the feed', value: items.length, note: 'Risks and alerts, all sites' },
  ]

  // Ring and scroll to the row the bell handed us. Runs once the list is on the
  // page; a missing id (already resolved, or a stale link) simply does nothing.
  const rowRefs = useRef({})
  const [ring, setRing] = useState(focusId)
  useEffect(() => {
    setRing(focusId)
    if (!focusId) return undefined
    const el = rowRefs.current[focusId]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // The ring fades after a moment so the page settles into a plain list.
    const t = setTimeout(() => setRing(null), 2600)
    return () => clearTimeout(t)
  }, [focusId])

  const open = (n) => router.push(n.href)

  return (
    <div>
      <PageHeading
        title="Notifications"
        subtitle="Everything raised across the estate that wants a decision — the AI Auditor's SLA risks and the condition monitoring's anomaly alerts, newest and most urgent first. Open a row to go straight to its record."
        right={siteName !== 'All Sites'
          ? <span style={styles.siteChip}>{siteName}</span>
          : null}
      />

      <StatCards items={stats} />

      <Group
        title="Needs attention"
        count={attention.length}
        rows={attention}
        empty="Nothing open — every risk has a path and no alert is awaiting review."
        rowRefs={rowRefs} ring={ring} onOpen={open}
      />

      {earlier.length > 0 && (
        <Group
          title="Earlier"
          count={earlier.length}
          rows={earlier}
          rowRefs={rowRefs} ring={ring} onOpen={open}
          muted
        />
      )}
    </div>
  )
}

function Group({ title, count, rows, empty, rowRefs, ring, onOpen, muted }) {
  return (
    <section style={{ marginTop: 22 }}>
      <div style={styles.groupHead}>
        <span style={{ ...styles.groupTitle, color: muted ? MUTE : INK }}>{title}</span>
        <span style={styles.groupCount}>{count}</span>
      </div>
      {rows.length === 0 ? (
        <div style={styles.emptyBox}>{empty}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((n) => (
            <Row key={n.id} n={n}
              refCb={(el) => { rowRefs.current[n.id] = el }}
              ringed={ring === n.id}
              onOpen={onOpen} muted={muted} />
          ))}
        </div>
      )}
    </section>
  )
}

function Row({ n, refCb, ringed, onOpen, muted }) {
  const tone = toneOf(n.tone)
  return (
    <div
      ref={refCb}
      onClick={() => onOpen(n)}
      style={{
        ...styles.row,
        opacity: muted ? 0.82 : 1,
        borderColor: ringed ? ACCENT : LINE,
        boxShadow: ringed ? `0 0 0 3px ${ACCENT}22` : 'none',
      }}
    >
      <span style={{ ...styles.dot, background: SEV_DOT[n.severity] || MUTE }} />

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={styles.rowTop}>
          <span style={styles.channel}>{n.channel}</span>
          <span style={{ ...styles.badge, color: tone.fg, background: tone.bg, borderColor: tone.line }}>{n.badge}</span>
          {n.priority && <span style={styles.prio}>{n.priority}</span>}
        </div>
        <div style={styles.headline}>{n.headline}</div>
        <div style={styles.detail}>{n.detail}</div>
        <div style={styles.meta}>
          {n.site ? <span>{n.site}</span> : null}
          {n.site && n.whenText !== '—' ? <span style={styles.dotSep}>·</span> : null}
          {n.whenText !== '—' ? <span>{n.whenText}</span> : null}
        </div>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onOpen(n) }}
        style={styles.cta}
        title={n.cta}
      >
        {n.cta}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  )
}

const styles = {
  siteChip: {
    display: 'inline-flex', alignItems: 'center', padding: '5px 11px', borderRadius: 999,
    background: '#eef2ff', color: ACCENT, fontSize: 12, fontWeight: 700,
  },
  groupHead: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 },
  groupTitle: { fontSize: 13, fontWeight: 800, letterSpacing: '0.01em' },
  groupCount: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 22, height: 20,
    padding: '0 7px', borderRadius: 999, background: '#eef2ff', color: ACCENT, fontSize: 11.5, fontWeight: 800,
  },
  emptyBox: {
    padding: '18px 16px', borderRadius: 12, border: `1px dashed ${LINE}`,
    background: '#fff', color: MUTE, fontSize: 13, fontWeight: 500,
  },
  row: {
    display: 'flex', alignItems: 'flex-start', gap: 13, padding: '14px 16px',
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, cursor: 'pointer',
    transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
  },
  dot: { width: 9, height: 9, borderRadius: '50%', marginTop: 6, flexShrink: 0 },
  rowTop: { display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 },
  channel: {
    fontSize: 10.5, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: MUTE,
  },
  badge: {
    display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999,
    border: '1px solid', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap',
  },
  prio: {
    display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 6,
    background: '#0f172a', color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: '0.02em',
  },
  headline: { fontSize: 14.5, fontWeight: 700, color: INK, lineHeight: 1.3 },
  detail: { fontSize: 12.5, color: SUB, lineHeight: 1.5, marginTop: 2 },
  meta: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11.5, color: MUTE, fontWeight: 600 },
  dotSep: { color: '#cbd5e1' },
  cta: {
    display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, alignSelf: 'center',
    padding: '7px 12px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
    color: ACCENT, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 9, cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
}
