'use client'

// The property, by area.
//
// A hotel's functional locations are floors and back-of-house plant rooms, not
// production lines. What each one is worth knowing for is how much of the
// estate and how much of the open work sits in it — a floor with three open
// jobs and a mechanical room with three are not the same problem.

import { useMemo } from 'react'
import { PageHeading, StatCards, Section, Card, HBars, StatusBadge, PALETTE } from '../lib/kit'
import { LOCATIONS, ASSETS, WORK_ORDERS, SUITES, SITE, isOpen } from '../lib/data'

const { ACCENT, INK, SUB, MUTE, LINE, RED } = PALETTE

export default function Locations() {
  const rows = useMemo(() => LOCATIONS.map((l) => {
    // Floors carry their suites' assets; the named plant rooms carry their own.
    const floorMatch = /Floor (\d)/.exec(l.name)
    const assets = floorMatch
      ? ASSETS.filter((a) => a.location_name === `Floor ${floorMatch[1]}`)
      : ASSETS.filter((a) => a.location_name === l.name)
    const open = floorMatch
      ? WORK_ORDERS.filter((w) => isOpen(w) && w.location_name === `Floor ${floorMatch[1]}`)
      : WORK_ORDERS.filter((w) => isOpen(w) && w.location_name === l.name)
    const suites = floorMatch ? SUITES.filter((s) => String(s.floor) === floorMatch[1]) : []
    return { ...l, assets: assets.length, open: open.length, suites: suites.length, down: assets.filter((a) => a.status === 'Down').length }
  }), [])

  const parents = rows.filter((r) => !r.parent_id)
  const childrenOf = (id) => rows.filter((r) => r.parent_id === id)

  const bars = rows
    .filter((r) => r.open > 0)
    .map((r) => ({ name: r.name.replace(/ — .*/, ''), value: r.open }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7)

  return (
    <div>
      <PageHeading
        title="Locations"
        subtitle={`${SITE.site_name} — ${LOCATIONS.length} areas, guest floors and back of house`}
      />

      <StatCards items={[
        { label: 'Areas', value: LOCATIONS.length, note: `${parents.length} top level` },
        { label: 'Guest floors', value: rows.filter((r) => /Floor \d/.test(r.name)).length, note: `${SUITES.length} suites` },
        { label: 'Assets placed', value: rows.reduce((n, r) => n + r.assets, 0), note: 'across the property' },
        { label: 'Open work', value: rows.reduce((n, r) => n + r.open, 0), note: 'by location' },
      ]} />

      {parents.map((p) => {
        const kids = childrenOf(p.functional_location_id)
        return (
          <Section
            key={p.functional_location_id}
            title={p.name}
            right={<span style={{ fontSize: 11.5, color: MUTE }}>{kids.length ? `${kids.length} areas` : `${p.assets} assets`}</span>}
          >
            {kids.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
                {kids.map((k) => <LocCard key={k.functional_location_id} loc={k} />)}
              </div>
            ) : (
              <LocRow loc={p} />
            )}
          </Section>
        )
      })}

      {bars.length > 0 && (
        <Section title="Where the open work is" right={<span style={{ fontSize: 11.5, color: MUTE }}>Open jobs by area</span>}>
          <HBars data={bars} />
        </Section>
      )}
    </div>
  )
}

function LocCard({ loc }) {
  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: '11px 13px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{loc.name}</div>
      <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11.5, color: SUB }}>
        {loc.suites > 0 && <span><strong style={{ color: INK }}>{loc.suites}</strong> suites</span>}
        <span><strong style={{ color: INK }}>{loc.assets}</strong> assets</span>
        <span style={{ color: loc.open ? '#b45309' : SUB }}><strong>{loc.open}</strong> open</span>
        {loc.down > 0 && <StatusBadge tone="red">{loc.down} down</StatusBadge>}
      </div>
    </div>
  )
}

function LocRow({ loc }) {
  return (
    <div style={{ display: 'flex', gap: 16, fontSize: 12.5, color: SUB, flexWrap: 'wrap' }}>
      <span><strong style={{ color: INK }}>{loc.assets}</strong> assets</span>
      <span style={{ color: loc.open ? '#b45309' : SUB }}><strong>{loc.open}</strong> open work orders</span>
      {loc.down > 0 && <StatusBadge tone="red">{loc.down} down</StatusBadge>}
    </div>
  )
}
