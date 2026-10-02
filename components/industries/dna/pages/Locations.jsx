'use client'

// The location hierarchy — one site, eleven departments and areas under it.
//
// Drawn as a tree rather than a flat table because the hierarchy is the point:
// "unlimited locations" on the customer's list means a structure they can grow,
// and a list of twelve rows with a Parent column demonstrates a foreign key, not
// a hierarchy.
//
// Each department carries what is actually in it — assets, open work, downtime
// hours — so the tree answers "where is the work" rather than only "what exists".

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Section, StatusBadge } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, TwoLine, Note, Bars, Meter } from '../components/cells'
import { useDept } from '../lib/deptStore'
import { locations, site, departments, assets, workOrders, downtime, ORG, hrs } from '../lib/data'

export default function Locations() {
  const router = useRouter()
  const { setDept } = useDept()

  const rows = useMemo(() => departments.map((d) => {
    const mine = assets.filter((a) => a.locationCode === d.code)
    const wos = workOrders.filter((w) => w.locationCode === d.code)
    const dt = downtime.filter((x) => x.locationCode === d.code)
    return {
      ...d,
      _assets: mine.length,
      _open: wos.filter((w) => w._open).length,
      _overdue: wos.filter((w) => w._overdue).length,
      _downtime: Number(dt.reduce((s, x) => s + (x.hours || 0), 0).toFixed(1)),
      _down: mine.filter((a) => a.status === 'Down').length,
    }
  }), [])

  const maxAssets = Math.max(1, ...rows.map((r) => r._assets))

  // Departments holding no assets are not an error: the maintenance shop is a
  // stores and workshop, and the yard's kit is filed against the yard itself.
  const empty = rows.filter((r) => !r._assets)

  return (
    <div>
      <PageHeading
        title="Locations & Sites"
        subtitle={`${ORG.siteName} — ${site?.description || ''}`}
      />

      <StatCards items={[
        { label: 'Locations', value: locations.length, note: '1 site · 10 departments · 1 area', icon: 'site' },
        { label: 'Departments with assets', value: rows.filter((r) => r._assets).length, note: `of ${rows.length}`, icon: 'asset' },
        { label: 'Busiest', value: [...rows].sort((a, b) => b._open - a._open)[0]?.code.replace('DNA-', '') || '—', note: 'Most open work orders', icon: 'wrench' },
        { label: 'Departments with downtime', value: rows.filter((r) => r._downtime > 0).length, tone: 'warning', icon: 'wave' },
        { label: 'Plant floor area', value: '260,000', unit: 'sq ft', note: 'Single site' },
      ]} />

      <Section title="Plant structure" right={<span style={{ fontSize: 11.5, color: '#94a3b8' }}>select a department to filter the portal</span>}>
        {/* The site row, then its children indented under it. */}
        {site && (
          <div style={{ padding: '13px 15px', border: '1px solid #c7d2fe', background: '#f5f7ff', borderRadius: 11, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                  <Ref>{site.code}</Ref>
                  <StatusBadge tone="blue">{site.type}</StatusBadge>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 6 }}>{site.name}</div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>{site.description}</div>
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>
                {site._children} departments · {assets.length} assets
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gap: 8, paddingLeft: 18, borderLeft: '2px solid #e8ecff', marginLeft: 8 }}>
          {rows.map((d) => (
            <div
              key={d.code}
              role="button"
              tabIndex={0}
              onClick={() => { setDept(d.code); router.push('/portal/dna/assets') }}
              onKeyDown={(e) => { if (e.key === 'Enter') { setDept(d.code); router.push('/portal/dna/assets') } }}
              style={{
                padding: '12px 14px', border: '1px solid #e4e9f0', borderRadius: 10,
                background: '#fff', cursor: 'pointer',
                display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(120px,1fr) auto', gap: 14, alignItems: 'center',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Ref>{d.code}</Ref>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{d.name}</span>
                  {d.type === 'Area' && <StatusBadge tone="grey">Area</StatusBadge>}
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>{d.description}</div>
              </div>

              <div>
                <Meter value={d._assets} max={maxAssets} />
                <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 5 }}>
                  {d._assets} asset{d._assets === 1 ? '' : 's'}
                  {d._down ? <span style={{ color: '#b91c1c', fontWeight: 700 }}> · {d._down} down</span> : null}
                </div>
              </div>

              <div style={{ textAlign: 'right', fontSize: 11.5, color: '#475569', whiteSpace: 'nowrap' }}>
                <div>{d._open} open{d._overdue ? <span style={{ color: '#b91c1c', fontWeight: 700 }}> · {d._overdue} late</span> : null}</div>
                <div style={{ color: '#94a3b8', marginTop: 3 }}>{d._downtime ? `${hrs(d._downtime)} down` : 'no downtime'}</div>
              </div>
            </div>
          ))}
        </div>

        {empty.length > 0 && (
          <Note tone="grey">
            {empty.map((e) => e.name).join(' and ')} hold no assets of their own. That is expected —
            the maintenance shop is a workshop and stores, and the yard&apos;s equipment is filed
            against the yard itself.
          </Note>
        )}
      </Section>

      <Section title="Assets by department">
        <Bars data={rows.filter((r) => r._assets).map((r) => ({ name: r.name, value: r._assets })).sort((a, b) => b.value - a.value)} />
      </Section>
    </div>
  )
}
