'use client'

// The month's preventive-maintenance plan, as a calendar.
//
// "A full month's calendar" was the client's first ask, and the most basic: the
// PM programme is a schedule before it is anything else, so it should read as
// one. Each day carries the PMs it holds — the workbook's own logged and
// scheduled entries on their real dates, plus the recurring occurrences the PM
// cadence projects for the month so the page reads as a plan, not four stray
// jobs — coloured by whether they ran on time, ran late, are scheduled, or are
// projected. A day opens its logged record.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Section, StatusBadge, PALETTE } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { useSite } from '../lib/siteStore'
import { pmForMonth, pmGrid, pmMonthName, PM_MONTHS } from '../lib/pmData'
import { assetById } from '../lib/data'

const { SUB, MUTE, INK, LINE, GREEN, AMBER, RED, ACCENT } = PALETTE

const TONE_BG = { green: { bg: '#ecfdf5', fg: '#047857', dot: GREEN }, amber: { bg: '#fffbeb', fg: '#b45309', dot: AMBER }, blue: { bg: '#eff6ff', fg: '#1d4ed8', dot: '#3b82f6' }, grey: { bg: '#f1f5f9', fg: '#64748b', dot: '#94a3b8' } }
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// First month the workbook's PM log covers — where the calendar opens.
const [FY, FM] = (PM_MONTHS[0] || '2026-09').split('-').map(Number)

export default function PmCalendar() {
  const router = useRouter()
  const { siteId } = useSite()
  const [year, setYear] = useState(FY)
  const [month, setMonth] = useState(FM - 1) // 0-indexed

  // Occurrences for the month, then cut by the site picker (an occurrence's site
  // is its asset's). A row with an unresolved asset stays in scope.
  const inScope = (o) => siteId === 'all' || (assetById.get(o.assetId)?.siteId || null) === siteId || !assetById.get(o.assetId)
  const occ = useMemo(() => pmForMonth(year, month).filter(inScope), [year, month, siteId])
  const grid = useMemo(() => {
    const raw = pmGrid(year, month)
    if (siteId === 'all') return raw
    return raw.map((c) => ({ ...c, items: c.items.filter(inScope) }))
  }, [year, month, siteId])

  const step = (d) => {
    let m = month + d
    let y = year
    if (m < 0) { m = 11; y -= 1 }
    if (m > 11) { m = 0; y += 1 }
    setMonth(m); setYear(y)
  }

  const real = occ.filter((o) => !o.projected)
  const stats = [
    { label: 'PMs this month', value: occ.length, note: `${real.length} logged · ${occ.length - real.length} projected` },
    { label: 'Completed on time', value: occ.filter((o) => o.status === 'Completed On Time').length, tone: 'green' },
    { label: 'Completed late', value: occ.filter((o) => o.status === 'Completed Late').length, tone: occ.some((o) => o.status === 'Completed Late') ? 'amber' : 'green' },
    { label: 'Scheduled ahead', value: occ.filter((o) => o.status === 'Scheduled').length, tone: 'blue' },
  ]

  const openItem = (o) => {
    if (o.logId) router.push(`/portal/datacenter/pm-compliance/${encodeURIComponent(o.logId)}`)
    else if (assetById.get(o.assetId)) router.push(`/portal/datacenter/assets/${encodeURIComponent(o.assetId)}`)
  }

  return (
    <div>
      <PageHeading
        title="PM Calendar"
        wide
        subtitle="The preventive-maintenance programme as a month at a glance — the workbook's logged and scheduled PMs on their real dates, plus the recurring occurrences the PM cadence projects for the month. A day opens its record."
        right={
          <div style={styles.nav}>
            <button onClick={() => step(-1)} style={styles.navBtn} aria-label="Previous month">‹</button>
            <span style={styles.navLabel}>{pmMonthName(month)} {year}</span>
            <button onClick={() => step(1)} style={styles.navBtn} aria-label="Next month">›</button>
          </div>
        }
      />

      <StatCards items={stats} />

      <div style={styles.legend}>
        {[['green', 'On time'], ['amber', 'Late'], ['blue', 'Scheduled'], ['grey', 'Projected (from cadence)']].map(([tone, label]) => (
          <span key={tone} style={styles.legendItem}><span style={{ ...styles.legendDot, background: TONE_BG[tone].dot }} />{label}</span>
        ))}
      </div>

      <Section title={`${pmMonthName(month)} ${year}`} right={<span style={styles.note}>{occ.length} PM{occ.length !== 1 ? 's' : ''} scheduled</span>}>
        <div style={styles.calWrap}>
          <div style={styles.cal}>
            {DOW.map((d) => <div key={d} style={styles.dow}>{d}</div>)}
            {grid.map((c) => (
              <div key={c.key} style={{ ...styles.cell, background: c.day ? '#fff' : '#fafbfc' }}>
                {c.day && <div style={styles.dayNum}>{c.day}</div>}
                <div style={styles.items}>
                  {c.items.slice(0, 3).map((o, i) => {
                    const t = TONE_BG[o.tone] || TONE_BG.grey
                    return (
                      <button key={i} onClick={() => openItem(o)} style={{ ...styles.pill, background: t.bg, color: t.fg, cursor: (o.logId || assetById.get(o.assetId)) ? 'pointer' : 'default' }} title={`${o.task} · ${o.asset} · ${o.status}`}>
                        <span style={{ ...styles.pillDot, background: t.dot }} />
                        <span style={styles.pillText}>{o.asset}</span>
                      </button>
                    )
                  })}
                  {c.items.length > 3 && <div style={styles.more}>+{c.items.length - 3} more</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </div>
  )
}

const styles = {
  nav: { display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, padding: 3 },
  navBtn: { width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', color: ACCENT, fontSize: 19, lineHeight: 1, cursor: 'pointer', fontFamily: 'inherit' },
  navLabel: { fontSize: 13, fontWeight: 800, color: INK, minWidth: 128, textAlign: 'center' },
  legend: { display: 'flex', gap: 16, flexWrap: 'wrap', margin: '4px 0 14px' },
  legendItem: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: SUB },
  legendDot: { width: 9, height: 9, borderRadius: '50%' },
  note: { fontSize: 11, color: MUTE },
  calWrap: { overflowX: 'auto' },
  cal: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(118px, 1fr))', gap: 6, minWidth: 840 },
  dow: { fontSize: 10.5, fontWeight: 800, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 4px 6px' },
  cell: { minHeight: 96, borderRadius: 9, border: `1px solid ${LINE}`, padding: 6, display: 'flex', flexDirection: 'column', gap: 4 },
  dayNum: { fontSize: 11.5, fontWeight: 700, color: SUB, textAlign: 'right' },
  items: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  pill: { display: 'flex', alignItems: 'center', gap: 5, padding: '3px 6px', borderRadius: 6, border: 'none', fontFamily: 'inherit', fontSize: 10.5, fontWeight: 700, textAlign: 'left', width: '100%', minWidth: 0 },
  pillDot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  pillText: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
  more: { fontSize: 9.5, color: MUTE, fontWeight: 600, paddingLeft: 2 },
}
