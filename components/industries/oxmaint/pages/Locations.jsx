'use client'

import { useMemo, useState } from 'react'
import { PageHeader, StatStrip, Card, Section, StatusBadge, ActionButton, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { SITES, LOCATIONS, ASSETS, WORK_ORDERS, OPEN_STATUS } from '../lib/data'

const { MUTE, SUB, INK, LINE } = PALETTE

// The functional-location hierarchy, drawn as a tree rather than a table.
//
// A flat list of locations with a parent_id column is technically the same
// information, and it is unreadable — the whole point of a functional location
// is where it sits under something else. Two levels is what this plant has, so
// two levels is what this renders.
export default function Locations() {
  const [expanded, setExpanded] = useState(SITES.map((s) => s.site_id))

  const tree = useMemo(() => SITES.map((site) => {
    const own = LOCATIONS.filter((l) => l.site_id === site.site_id)
    const roots = own.filter((l) => !l.parent_id)
    return {
      ...site,
      assets: ASSETS.filter((a) => a.site_id === site.site_id).length,
      locations: roots.map((r) => ({
        ...r,
        assets: ASSETS.filter((a) => a.functional_location_id === r.functional_location_id).length,
        children: own.filter((l) => l.parent_id === r.functional_location_id).map((c) => ({
          ...c,
          assets: ASSETS.filter((a) => a.functional_location_id === c.functional_location_id).length,
        })),
      })),
    }
  }), [])

  const toggle = (id) => setExpanded((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  return (
    <div>
      <PageHeader
        icon={sectionIcon('locations', '#15227a')}
        title="Locations & Sites"
        subtitle="Functional location hierarchy"
        right={<ActionButton onClick={() => {}}>Add location</ActionButton>}
      />

      <StatStrip items={[
        { label: 'Sites', value: SITES.length },
        { label: 'Functional locations', value: LOCATIONS.length },
        { label: 'Assets placed', value: ASSETS.length },
        { label: 'Open work', value: WORK_ORDERS.filter((w) => OPEN_STATUS.includes(w.status)).length },
      ]} />

      {tree.map((site) => (
        <Card key={site.site_id} style={{ marginBottom: 14, padding: 0, overflow: 'hidden' }}>
          <button onClick={() => toggle(site.site_id)} style={siteRow}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"
              style={{ transform: expanded.includes(site.site_id) ? 'rotate(90deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }}>
              <path d="M9 18l6-6-6-6" />
            </svg>
            <span style={chip}>{site.code}</span>
            <span style={{ minWidth: 0, textAlign: 'left', flex: 1 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: INK }}>{site.site_name}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: MUTE }}>{site.city}, {site.country}</span>
            </span>
            {site.is_default && <StatusBadge tone="blue">Default</StatusBadge>}
            <span style={countPill}>{site.assets} assets</span>
          </button>

          {expanded.includes(site.site_id) && (
            <div style={{ borderTop: `1px solid ${LINE}` }}>
              {site.locations.length ? site.locations.map((loc) => (
                <div key={loc.functional_location_id}>
                  <div style={{ ...locRow, paddingLeft: 44 }}>
                    <span style={dot} />
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: INK }}>{loc.name}</span>
                    <span style={{ fontSize: 11, color: MUTE, fontFamily: 'ui-monospace, monospace' }}>{loc.functional_location_id}</span>
                    <span style={countPill}>{loc.assets} assets</span>
                  </div>
                  {loc.children.map((child) => (
                    <div key={child.functional_location_id} style={{ ...locRow, paddingLeft: 68, background: '#fcfdfe' }}>
                      <span style={{ ...dot, background: '#cbd5e1' }} />
                      <span style={{ flex: 1, fontSize: 12.5, color: SUB }}>{child.name}</span>
                      <span style={{ fontSize: 11, color: MUTE, fontFamily: 'ui-monospace, monospace' }}>{child.functional_location_id}</span>
                      <span style={countPill}>{child.assets} assets</span>
                    </div>
                  ))}
                </div>
              )) : (
                <div style={{ padding: '20px 44px', fontSize: 12.5, color: MUTE }}>No functional locations defined for this site.</div>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

const siteRow = {
  display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '14px 16px',
  background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
}
const locRow = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
  borderTop: '1px solid #f1f5f9',
}
const chip = {
  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
  background: '#e8ecff', color: '#15227a', fontSize: 11, fontWeight: 800,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const dot = { width: 7, height: 7, borderRadius: '50%', background: '#15227a', flexShrink: 0 }
const countPill = {
  fontSize: 10.5, fontWeight: 700, color: '#475569', background: '#f1f5f9',
  padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap',
}
