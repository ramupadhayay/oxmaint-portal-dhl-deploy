'use client'

import { useMemo, useState } from 'react'
import {
  PageHeader, Card, Section, StatStrip, Toolbar, DataTable, BarPairs, HBars,
  StatusBadge, PALETTE,
} from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { ORG, money } from '../lib/data'
import {
  CHILLERS, COP_TREND, ENERGY_ASSUMPTIONS, STATE_TONE,
  driftCost, copDriftPct, MODULE_ACTIVE,
} from '../lib/dataChiller'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, AMBER, RED } = PALETTE

const driftColour = (pct) => (pct >= 12 ? RED : pct >= 6 ? AMBER : GREEN)

export default function ChillerEfficiency() {
  const { scope, siteName } = useSite()
  const [search, setSearch] = useState('')

  const d = useMemo(() => {
    const chillers = scope(CHILLERS)
    const tons = chillers.reduce((n, c) => n + c.tons, 0)
    const w = (get) => (tons ? Number((chillers.reduce((n, c) => n + get(c) * c.tons, 0) / tons).toFixed(2)) : 0)
    const copNow = w((c) => c.cop_now)
    const baseline = w((c) => c.cop_design)

    // The 12 months are re-weighted from the site rows rather than averaged, so
    // a site with three machines cannot pull the fleet line as hard as one with
    // fourteen just by appearing in the list.
    const byMonth = new Map()
    scope(COP_TREND).forEach((r) => {
      const g = byMonth.get(r.month_index) || { month: r.month, month_index: r.month_index, tons: 0, cop: 0, base: 0 }
      g.tons += r.tons
      g.cop += r.cop * r.tons
      g.base += r.baseline * r.tons
      byMonth.set(r.month_index, g)
    })
    const trend = [...byMonth.values()]
      .sort((a, b) => a.month_index - b.month_index)
      .map((g) => ({
        month: g.month,
        cop: g.tons ? Number((g.cop / g.tons).toFixed(2)) : 0,
        baseline: g.tons ? Number((g.base / g.tons).toFixed(2)) : 0,
      }))

    const ranked = [...chillers].sort((a, b) => copDriftPct(b) - copDriftPct(a))

    return {
      chillers, tons, copNow, baseline, trend, ranked,
      drifted: ranked.filter((c) => copDriftPct(c) > 0),
      drift: baseline ? Number((((baseline - copNow) / baseline) * 100).toFixed(1)) : 0,
      worst: ranked[0] || null,
      costYear: chillers.reduce((n, c) => n + driftCost(c).cost_year, 0),
      kwhYear: chillers.reduce((n, c) => n + driftCost(c).kwh_year, 0),
      drifting: chillers.filter((c) => copDriftPct(c) >= 6).length,
    }
  }, [scope])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return d.ranked.filter((c) => (
      !q || `${c.asset_name} ${c.asset_code} ${c.site_name} ${c.manufacturer}`.toLowerCase().includes(q)
    ))
  }, [d.ranked, search])

  if (!MODULE_ACTIVE) return <ModuleOff />

  const tariff = `${ORG.currency_symbol}${ENERGY_ASSUMPTIONS.tariff_per_kwh.toFixed(2)}/kWh`

  return (
    <div>
      <PageHeader
        icon={sectionIcon('chiller-efficiency', ACCENT)}
        title="Efficiency and Energy"
        subtitle={`${d.chillers.length} chillers · ${d.tons.toLocaleString('en-US')} tons installed · ${siteName}`}
      />

      <StatStrip items={[
        { label: 'Fleet COP', value: d.copNow, note: 'weighted by tonnage, latest reading' },
        { label: 'Drift vs baseline', value: d.drift, unit: '%', tone: d.drift >= 6 ? 'amber' : 'green', note: `against ${d.baseline} at commissioning` },
        { label: 'Worst performer', value: d.worst ? d.worst.asset_code : '—', tone: 'red', note: d.worst ? `${d.worst.asset_name} · ${copDriftPct(d.worst)}% from its baseline` : 'nothing in scope' },
        { label: 'Cost of drift', value: money(d.costYear), tone: 'amber', note: 'estimated, per year — assumptions below' },
        { label: 'Machines drifting', value: d.drifting, tone: d.drifting ? 'amber' : 'green', note: '6% or more below their own baseline' },
      ]} />

      <Card style={{ marginBottom: 14, padding: '14px 16px', background: '#f8fafc', display: 'flex', gap: 11, alignItems: 'flex-start' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" />
        </svg>
        <div>
          <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>
            <strong style={{ color: INK }}>The cost of drift is an estimate, not a metered figure.</strong> Each machine is
            compared with its own commissioning COP, not with a fleet target. The extra kilowatts per ton are multiplied
            by its tonnage and current load, then by the two assumptions below. Change either and the number changes —
            they are shown here rather than buried so the figure can be argued with.
          </p>
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginTop: 10, paddingTop: 10, borderTop: `1px solid ${LINE}` }}>
            <Assumption label="Electricity tariff" value={tariff} />
            <Assumption label="Chiller running hours" value={`${ENERGY_ASSUMPTIONS.hours_per_year.toLocaleString('en-US')} h/year`} />
            <Assumption label="Refrigeration constant" value={`${ENERGY_ASSUMPTIONS.kw_per_ton_of_refrigeration} kW per ton`} />
            <Assumption label="Estimated energy penalty" value={`${d.kwhYear.toLocaleString('en-US')} kWh/year`} />
          </div>
        </div>
      </Card>

      <Section title="COP by month against the commissioning baseline"
        right={<span style={{ fontSize: 11.5, color: MUTE }}>tonnage-weighted, last 12 months</span>}>
        {d.trend.length ? (
          <BarPairs
            data={d.trend}
            keys={['cop', 'baseline']}
            labels={['COP achieved', 'Commissioning baseline']}
            colors={[ACCENT, GREEN]}
            height={210} />
        ) : <Empty>No efficiency history at {siteName}.</Empty>}
        <p style={{ margin: '13px 0 0', paddingTop: 12, borderTop: `1px solid ${LINE}`, fontSize: 11.5, color: SUB, lineHeight: 1.55 }}>
          The baseline is each machine&apos;s own accepted performance, averaged across the fleet in scope. Comparing a
          chiller with a published catalogue figure instead would flag every older machine on the site and none of the
          ones that have actually changed.
        </p>
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(330px, 100%),1fr))', gap: 14, marginBottom: 14 }}>
        <Section title="Drift by chiller"
          right={<span style={{ fontSize: 11.5, color: MUTE }}>worst twelve</span>}>
          {/* Machines at or above their baseline are left off rather than charted
              at zero: a negative drift has no bar length to draw, and a chiller
              running better than commissioned is not what this chart is asking. */}
          {d.drifted.length ? (
            <HBars unit="%" data={d.drifted.slice(0, 12).map((c) => ({
              name: c.asset_code,
              value: copDriftPct(c),
              color: driftColour(copDriftPct(c)),
            }))} />
          ) : <Empty>No chiller at {siteName} is below its commissioning baseline.</Empty>}
        </Section>

        <Section title="Where the drift is costing most"
          right={<span style={{ fontSize: 11.5, color: MUTE }}>estimated {ORG.currency_symbol} thousand per year</span>}>
          {d.drifted.length ? (
            // Thousands rather than whole units: HBars prints the raw value beside
            // the bar, and a column of six-figure numbers with no symbol reads as
            // hours or kWh as easily as it reads as money.
            <HBars unit="k" data={[...d.drifted]
              .sort((a, b) => driftCost(b).cost_year - driftCost(a).cost_year)
              .slice(0, 12)
              .map((c) => ({ name: c.asset_code, value: Math.round(driftCost(c).cost_year / 1000), color: AMBER }))} />
          ) : <Empty>No measurable energy penalty at {siteName}.</Empty>}
          <p style={{ margin: '13px 0 0', paddingTop: 12, borderTop: `1px solid ${LINE}`, fontSize: 11.5, color: SUB, lineHeight: 1.55 }}>
            Estimated at {tariff} and {ENERGY_ASSUMPTIONS.hours_per_year.toLocaleString('en-US')} running hours.
            A large machine drifting a little can cost more than a small one drifting a lot, which is why the two
            charts do not rank the same.
          </p>
        </Section>
      </div>

      <Toolbar
        search={search} onSearch={setSearch}
        placeholder="Search chiller, code, site or manufacturer…"
      />

      <DataTable
        pageSize={12}
        rows={rows}
        empty="No chillers match this search."
        columns={[
          {
            key: 'asset_name',
            label: 'Chiller',
            render: (r) => (
              <span>
                <span style={{ display: 'block', fontWeight: 700, color: ACCENT }}>{r.asset_name}</span>
                <span style={{ display: 'block', fontSize: 11, color: MUTE }}>{r.asset_code} · {r.manufacturer} {r.model}</span>
              </span>
            ),
          },
          { key: 'site_name', label: 'Site' },
          { key: 'tons', label: 'Tons', align: 'right' },
          { key: 'load_pct', label: 'Load', align: 'right', render: (r) => `${r.load_pct}%` },
          {
            key: 'approach',
            label: 'Approach',
            align: 'right',
            sortValue: (r) => (r.byKey.approach ? r.byKey.approach.value : 0),
            render: (r) => {
              const p = r.byKey.approach
              if (!p) return <span style={{ color: MUTE }}>—</span>
              return <span style={{ fontWeight: 700, color: p.state === 'Alarm' ? RED : p.state === 'Warning' ? AMBER : INK }}>{p.value} °F</span>
            },
          },
          { key: 'cop_design', label: 'COP commissioned', align: 'right' },
          {
            key: 'cop_now',
            label: 'COP now',
            align: 'right',
            render: (r) => {
              const state = r.byKey.cop ? r.byKey.cop.state : 'Normal'
              return <span style={{ fontWeight: 800, color: state === 'Alarm' ? RED : state === 'Warning' ? AMBER : GREEN }}>{r.cop_now}</span>
            },
          },
          {
            key: 'drift',
            label: 'Drift',
            align: 'right',
            sortValue: (r) => copDriftPct(r),
            render: (r) => <span style={{ fontWeight: 700, color: driftColour(copDriftPct(r)) }}>{copDriftPct(r)}%</span>,
          },
          { key: 'kw_per_ton', label: 'kW/ton', align: 'right', render: (r) => `${r.kw_per_ton} (was ${r.kw_per_ton_design})` },
          {
            key: 'cost',
            label: 'Est. cost/year',
            align: 'right',
            sortValue: (r) => driftCost(r).cost_year,
            render: (r) => {
              const cost = driftCost(r).cost_year
              return cost ? <span style={{ fontWeight: 700 }}>{money(cost)}</span> : <span style={{ color: MUTE }}>—</span>
            },
          },
          {
            key: 'cop_state',
            label: 'State',
            sortValue: (r) => (r.byKey.cop ? r.byKey.cop.state : 'Normal'),
            render: (r) => {
              const state = r.byKey.cop ? r.byKey.cop.state : 'Normal'
              return <StatusBadge tone={STATE_TONE[state]}>{state}</StatusBadge>
            },
          },
        ]} />
    </div>
  )
}

function Assumption({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginTop: 2 }}>{value}</div>
    </div>
  )
}

function Empty({ children }) {
  return <div style={{ padding: '26px 0', textAlign: 'center', color: MUTE, fontSize: 12.5 }}>{children}</div>
}

function ModuleOff() {
  return (
    <Card style={{ textAlign: 'center', padding: '44px 20px' }}>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: INK }}>This module is not switched on here</div>
      <p style={{ margin: '7px auto 0', maxWidth: 470, fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>
        Chiller efficiency analysis belongs to refrigeration plant, which the organisation loaded here does not run. Use the portal switcher to open one that does.
      </p>
    </Card>
  )
}
