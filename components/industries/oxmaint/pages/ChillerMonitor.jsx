'use client'

import { useMemo, useState } from 'react'
import {
  PageHeader, Card, Section, Toolbar, DataTable, StatusBadge, Sparkline, Fields, PALETTE,
} from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { DOMAIN, fmtDate } from '../lib/data'
import { CHILLERS, PARAMS, WINDOW_DAYS, STATE_TONE, BAND_TONE } from '../lib/dataChiller'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, AMBER, RED } = PALETTE

const STATE_COLOUR = { Normal: GREEN, Warning: AMBER, Alarm: RED }

// The plotted band is clamped to the range the 90 samples actually cover. A
// normal band drawn outside it renders against the edge of the sparkline, where
// it reads as a missing axis rather than as a limit.
const bandFor = (p) => {
  const lo = Math.min(...p.series)
  const hi = Math.max(...p.series)
  if (p.normal[1] < lo || p.normal[0] > hi) return undefined
  return { low: Math.max(lo, p.normal[0]), high: Math.min(hi, p.normal[1]) }
}

const signed = (v, unit) => `${v >= 0 ? '+' : '-'}${Math.abs(v)}${unit ? ` ${unit}` : ''}`

export default function ChillerMonitor() {
  const { scope, siteName } = useSite()
  const [search, setSearch] = useState('')
  const [state, setState] = useState('all')
  const [pickedId, setPickedId] = useState(null)

  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return scope(CHILLERS).filter((c) => (
      (state === 'all' || c.worst_state === state)
      && (!q || `${c.asset_name} ${c.asset_code} ${c.asset_type} ${c.site_name} ${c.refrigerant}`.toLowerCase().includes(q))
    ))
  }, [scope, search, state])

  // Falling back to the head of the list rather than holding the id means the
  // detail panel is never blank after a site change drops the selected machine.
  const sel = list.find((c) => c.asset_id === pickedId) || list[0] || null

  if (DOMAIN?.key !== 'chiller') return <ModuleOff />

  return (
    <div>
      <PageHeader
        icon={sectionIcon('chiller-monitor', ACCENT)}
        title="Condition Monitoring"
        subtitle={`${list.length} chillers · ${PARAMS.length} parameters over ${WINDOW_DAYS} days · ${siteName}`}
      />

      <Toolbar
        search={search} onSearch={setSearch}
        placeholder="Search chiller, code, site or refrigerant…"
        filters={[{ label: 'State', value: state, onChange: setState, options: ['Normal', 'Warning', 'Alarm'] }]}
      />

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 14 }}>
        <Card style={{ flex: '1 1 250px', minWidth: 240, maxWidth: 320, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '11px 14px', borderBottom: `1px solid ${LINE}`, fontSize: 11, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Select a chiller
          </div>
          <div style={{ maxHeight: 560, overflowY: 'auto' }}>
            {list.map((c) => {
              const on = sel && c.asset_id === sel.asset_id
              return (
                <button key={c.asset_id} onClick={() => setPickedId(c.asset_id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left',
                    padding: '9px 13px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    // The selected marker and the row rule are drawn as inset shadows rather
                    // than borders: a changing borderLeftColor beside a border shorthand is
                    // the style conflict React warns about on every re-render.
                    boxShadow: `inset 0 -1px 0 ${LINE}, inset 3px 0 0 ${on ? ACCENT : 'transparent'}`,
                    background: on ? '#f5f7ff' : 'none',
                  }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATE_COLOUR[c.worst_state], flexShrink: 0 }} />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: on ? 700 : 600, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.asset_name}
                    </span>
                    <span style={{ display: 'block', fontSize: 10.5, color: MUTE, marginTop: 1 }}>{c.asset_code} · {c.site_name}</span>
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: c.leak_score >= 65 ? RED : c.leak_score >= 40 ? AMBER : MUTE, flexShrink: 0 }}>
                    {c.leak_score}
                  </span>
                </button>
              )
            })}
            {!list.length && (
              <div style={{ padding: '30px 14px', textAlign: 'center', color: MUTE, fontSize: 12.5 }}>
                No chillers match these filters.
              </div>
            )}
          </div>
        </Card>

        <div style={{ flex: '1 1 460px', minWidth: 320 }}>
          {sel ? <Detail chiller={sel} /> : (
            <Card style={{ textAlign: 'center', color: MUTE, fontSize: 12.5, padding: '40px 0' }}>
              Nothing selected at {siteName}.
            </Card>
          )}
        </div>
      </div>

      <Section title="All chillers"
        right={<span style={{ fontSize: 11.5, color: MUTE }}>select a row to load it above</span>}>
        <DataTable
          pageSize={12}
          rows={list}
          onRowClick={(r) => setPickedId(r.asset_id)}
          empty="No chillers match these filters."
          columns={[
            {
              key: 'asset_name',
              label: 'Chiller',
              render: (r) => (
                <span>
                  <span style={{ display: 'block', fontWeight: 700, color: ACCENT }}>{r.asset_name}</span>
                  <span style={{ display: 'block', fontSize: 11, color: MUTE }}>{r.asset_code} · {r.asset_type}</span>
                </span>
              ),
            },
            { key: 'site_name', label: 'Site' },
            { key: 'refrigerant', label: 'Refrigerant' },
            { key: 'tons', label: 'Tons', align: 'right' },
            {
              key: 'states',
              label: 'Parameters',
              sortable: false,
              render: (r) => (
                <span style={{ display: 'flex', gap: 4 }}>
                  {r.parameters.map((p) => (
                    <span key={p.key}
                      title={`${p.label}: ${p.value}${p.unit ? ` ${p.unit}` : ''} — ${p.state}`}
                      style={{ width: 9, height: 9, borderRadius: 3, background: STATE_COLOUR[p.state], flexShrink: 0 }} />
                  ))}
                </span>
              ),
            },
            { key: 'warnings', label: 'Warn', align: 'right', render: (r) => <span style={{ color: r.warnings ? AMBER : MUTE, fontWeight: 700 }}>{r.warnings}</span> },
            { key: 'alarms', label: 'Alarm', align: 'right', render: (r) => <span style={{ color: r.alarms ? RED : MUTE, fontWeight: 700 }}>{r.alarms}</span> },
            { key: 'starts_per_day', label: 'Starts/day', align: 'right', render: (r) => <span style={{ color: STATE_COLOUR[r.cycling_state], fontWeight: 700 }}>{r.starts_per_day}</span> },
            { key: 'leak_score', label: 'Leak score', align: 'right', render: (r) => <StatusBadge tone={BAND_TONE[r.leak_band]}>{r.leak_score}</StatusBadge> },
            { key: 'worst_state', label: 'State', render: (r) => <StatusBadge tone={STATE_TONE[r.worst_state]}>{r.worst_state}</StatusBadge> },
          ]} />
      </Section>
    </div>
  )
}

function Detail({ chiller: c }) {
  return (
    <div>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 13, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: INK }}>{c.asset_name}</div>
            <div style={{ fontSize: 11.5, color: MUTE, marginTop: 2 }}>
              {c.asset_code} · {c.functional_location_name} · {c.site_name}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <StatusBadge tone={STATE_TONE[c.worst_state]}>{c.worst_state}</StatusBadge>
            <StatusBadge tone={BAND_TONE[c.leak_band]}>Leak risk {c.leak_score}</StatusBadge>
            <StatusBadge>{c.status}</StatusBadge>
          </div>
        </div>
        <Fields columns={4} rows={[
          ['Type', c.asset_type],
          ['Manufacturer', `${c.manufacturer} ${c.model}`],
          ['Refrigerant', c.refrigerant],
          ['Nameplate', `${c.tons} tons · ${c.nameplate_charge_lb} lb charge`],
          ['Load now', `${c.load_pct}%`],
          ['kW per ton', c.kw_per_ton],
          ['Health index', c.health_index],
          ['Last serviced', fmtDate(c.last_maintenance_date)],
        ]} />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 12, marginBottom: 14 }}>
        {c.parameters.map((p) => (
          <Card key={p.key} style={{ padding: '17px 14px 14px', boxShadow: `inset 0 3px 0 ${STATE_COLOUR[p.state]}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.35 }}>{p.label}</span>
              <StatusBadge tone={STATE_TONE[p.state]}>{p.state}</StatusBadge>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, margin: '7px 0 3px' }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: STATE_COLOUR[p.state], lineHeight: 1 }}>{p.value}</span>
              {p.unit && <span style={{ fontSize: 12, fontWeight: 600, color: SUB }}>{p.unit}</span>}
            </div>
            <div style={{ fontSize: 11, color: MUTE }}>
              normal {p.normal[0]}–{p.normal[1]}{p.unit ? ` ${p.unit}` : ''} · {signed(p.trend, p.unit)} over {WINDOW_DAYS} days
            </div>
            <div style={{ margin: '10px 0 8px' }}>
              <Sparkline data={p.series} color={STATE_COLOUR[p.state]} w={214} h={44} band={bandFor(p)} />
            </div>
            <p style={{ margin: 0, paddingTop: 9, borderTop: `1px solid ${LINE}`, fontSize: 11.5, color: SUB, lineHeight: 1.5 }}>
              {p.meaning}
            </p>
            <div style={{ fontSize: 10.5, color: MUTE, marginTop: 6 }}>Source: {p.source}</div>
          </Card>
        ))}
      </div>

      <Section title="Compressor runtime and cycling"
        right={<StatusBadge tone={STATE_TONE[c.cycling_state]}>{c.cycling_state}</StatusBadge>}>
        <Fields columns={3} rows={[
          ['Runtime, last 30 days', `${c.runtime_hours_30d} h`],
          ['Starts per day', c.starts_per_day],
          ['Mean run length', `${c.avg_run_minutes} min`],
          ['Purge unit runtime', `${c.purge_min_per_day} min/day`],
          ['Compressor current', `${c.byKey.compressor_current ? c.byKey.compressor_current.value : '—'} A`],
          ['Running hours, life', c.running_hours.toLocaleString('en-US')],
        ]} />
        <p style={{ margin: '13px 0 0', paddingTop: 12, borderTop: `1px solid ${LINE}`, fontSize: 11.5, color: SUB, lineHeight: 1.55 }}>
          Cycling is read next to the leak score rather than on its own. A machine short of charge satisfies its
          setpoint early and stops, so it starts more often — short-cycling and falling subcooling on the same
          chiller are one finding, not two. Current is read with runtime for the opposite reason: fouling raises it
          and a low charge lowers it, so on its own it can sit in band while both faults are present.
        </p>
      </Section>
    </div>
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
