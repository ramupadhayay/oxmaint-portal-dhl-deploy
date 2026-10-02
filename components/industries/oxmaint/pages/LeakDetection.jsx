'use client'

import { useMemo, useState } from 'react'
import {
  PageHeader, Card, Section, StatStrip, Toolbar, DataTable, Drawer, Fields,
  StatusBadge, ActionButton, Bar, TONES, PALETTE,
} from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { useActions } from '../lib/actions'
import { fmtDate } from '../lib/data'
import { LEAK_RISK, LEAK_FACTORS, BAND_TONE, WINDOW_DAYS, MODULE_ACTIVE } from '../lib/dataChiller'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, AMBER, RED } = PALETTE

const BANDS = ['High', 'Elevated', 'Low', 'Minimal']

export default function LeakDetection() {
  const { scope, siteName } = useSite()
  const { raiseWorkOrder } = useActions()

  const [search, setSearch] = useState('')
  const [band, setBand] = useState('all')
  const [openId, setOpenId] = useState(null)
  // Which machines have had an inspection raised from this screen. Held here
  // rather than read back off the work-order list so the button can go quiet the
  // moment it succeeds, without the drawer waiting on a refetch.
  const [raised, setRaised] = useState({})

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return scope(LEAK_RISK).filter((c) => (
      (band === 'all' || c.leak_band === band)
      && (!q || `${c.asset_name} ${c.asset_code} ${c.site_name} ${c.refrigerant}`.toLowerCase().includes(q))
    ))
  }, [scope, search, band])

  const totals = useMemo(() => {
    const all = scope(LEAK_RISK)
    return {
      scored: all.length,
      high: all.filter((c) => c.leak_band === 'High').length,
      elevated: all.filter((c) => c.leak_band === 'Elevated').length,
      addedLb: all.reduce((n, c) => n + c.added_12m_lb, 0),
      topUps: all.reduce((n, c) => n + c.top_ups_12m, 0),
    }
  }, [scope])

  const open = rows.find((c) => c.asset_id === openId) || null

  if (!MODULE_ACTIVE) return <ModuleOff />

  const raiseInspection = async (c) => {
    const top = [...c.leak_factors]
      .sort((a, b) => b.contribution - a.contribution)
      .filter((f) => f.contribution > 0)
      .slice(0, 3)
      .map((f) => `${f.label.toLowerCase()} (${f.value}, ${f.contribution} of ${f.weight} points)`)

    const record = await raiseWorkOrder({
      title: `Leak inspection — ${c.asset_name} scoring ${c.leak_score} for refrigerant loss`,
      description: `Refrigerant-loss risk score of ${c.leak_score} out of 100 over the last ${WINDOW_DAYS} days on `
        + `${c.asset_name} (${c.asset_code}, ${c.refrigerant}, ${c.nameplate_charge_lb} lb nameplate charge). `
        + `Largest contributors: ${top.length ? top.join('; ') : 'none above zero'}. `
        + 'Electronic leak test of the condenser barrel, tube sheets, flanges and relief piping, and read the purge log '
        + 'before adding any charge. The score is modelled from operating data and is not a refrigerant sensor reading.',
      assetId: c.asset_id,
      type: 'Inspection',
      priority: 'High',
      dueInDays: 3,
      estimatedHours: 3,
      source: 'Leak risk score',
    })
    if (record) setRaised((p) => ({ ...p, [c.asset_id]: record.work_order_number || true }))
  }

  return (
    <div>
      <PageHeader
        icon={sectionIcon('leak-detection', ACCENT)}
        title="Leak Detection"
        subtitle={`Refrigerant-loss risk across ${totals.scored} machines · ${siteName}`}
      />

      <StatStrip items={[
        { label: 'Chillers scored', value: totals.scored, note: `${WINDOW_DAYS} days of operating data each` },
        { label: 'High risk', value: totals.high, tone: totals.high ? 'red' : 'green', note: 'score 65 or above' },
        { label: 'Elevated', value: totals.elevated, tone: totals.elevated ? 'amber' : 'green', note: 'score 40 to 64' },
        { label: 'Refrigerant added', value: totals.addedLb.toLocaleString('en-US'), unit: 'lb', note: `${totals.topUps} top-ups in 12 months` },
        { label: 'Inspections raised', value: Object.keys(raised).length, note: 'from this screen this session' },
      ]} />

      <Card style={{ marginBottom: 14, padding: '14px 16px', background: '#fffbeb', border: `1px solid ${TONES.amber.bd}`, display: 'flex', gap: 11, alignItems: 'flex-start' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={TONES.amber.fg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" />
        </svg>
        <p style={{ margin: 0, fontSize: 12.5, color: '#78350f', lineHeight: 1.6 }}>
          <strong>These scores are modelled, not measured.</strong> Each one is a weighted judgement over
          refrigeration parameters the chiller already reports — no refrigerant sensor or sniffer is involved. A high
          score says the machine is behaving the way a leaking machine behaves and is worth a leak test; it does not
          say a leak has been found. Confirmation is the technician&apos;s, from the inspection this screen raises.
        </p>
      </Card>

      <Section title="How the score is built"
        right={<span style={{ fontSize: 11.5, color: MUTE }}>weights total 100</span>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
          {LEAK_FACTORS.map((f) => (
            <div key={f.key} style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: '11px 13px', background: '#fcfdfe' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>{f.label}</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: ACCENT }}>{f.weight}</span>
              </div>
              <p style={{ margin: '5px 0 0', fontSize: 11.5, color: SUB, lineHeight: 1.5 }}>{f.note}</p>
            </div>
          ))}
        </div>
      </Section>

      <Toolbar
        search={search} onSearch={setSearch}
        placeholder="Search chiller, code, site or refrigerant…"
        filters={[{ label: 'Band', value: band, onChange: setBand, options: BANDS }]}
      />

      <DataTable
        pageSize={12}
        rows={rows}
        onRowClick={(r) => setOpenId(r.asset_id)}
        empty="No chillers match these filters."
        columns={[
          {
            key: 'leak_score',
            label: 'Score',
            align: 'right',
            render: (r) => {
              const t = TONES[BAND_TONE[r.leak_band]]
              return (
                <span style={{
                  display: 'inline-block', minWidth: 40, padding: '3px 9px', borderRadius: 7,
                  fontSize: 13, fontWeight: 800, textAlign: 'center',
                  color: t.fg, background: t.bg, border: `1px solid ${t.bd}`,
                }}>{r.leak_score}</span>
              )
            },
          },
          { key: 'leak_band', label: 'Band', render: (r) => <StatusBadge tone={BAND_TONE[r.leak_band]}>{r.leak_band}</StatusBadge> },
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
          {
            key: 'subcooling',
            label: 'Subcooling',
            align: 'right',
            sortValue: (r) => (r.byKey.subcooling ? r.byKey.subcooling.value : 0),
            render: (r) => <Reading p={r.byKey.subcooling} />,
          },
          {
            key: 'superheat',
            label: 'Superheat',
            align: 'right',
            sortValue: (r) => (r.byKey.superheat ? r.byKey.superheat.value : 0),
            render: (r) => <Reading p={r.byKey.superheat} />,
          },
          { key: 'purge_min_per_day', label: 'Purge', align: 'right', render: (r) => `${r.purge_min_per_day} min/day` },
          { key: 'added_12m_lb', label: 'Added 12m', align: 'right', render: (r) => (r.added_12m_lb ? `${r.added_12m_lb} lb` : '—') },
          {
            key: 'raised',
            label: 'Inspection',
            sortable: false,
            render: (r) => (raised[r.asset_id]
              ? <StatusBadge tone="green">Raised</StatusBadge>
              : <span style={{ color: MUTE }}>—</span>),
          },
        ]} />

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        width={560}
        icon={<><path d="M12 2.69 17.66 8.35a8 8 0 1 1-11.31 0z" /><path d="M12 18v.01M12 12v3" /></>}
        title={open ? open.asset_name : ''}
        subtitle={open ? `${open.asset_code} · ${open.site_name} · leak risk ${open.leak_score} (${open.leak_band})` : ''}
        footer={open && (
          <>
            <ActionButton variant="ghost" onClick={() => setOpenId(null)}>Close</ActionButton>
            {raised[open.asset_id] ? (
              <StatusBadge tone="green">
                {typeof raised[open.asset_id] === 'string' ? `${raised[open.asset_id]} raised` : 'Inspection raised'}
              </StatusBadge>
            ) : (
              <ActionButton onClick={() => raiseInspection(open)}
                icon={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>}>
                Raise leak inspection
              </ActionButton>
            )}
          </>
        )}>
        {open && <Breakdown chiller={open} />}
      </Drawer>
    </div>
  )
}

function Breakdown({ chiller: c }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <div style={{
          width: 74, height: 74, borderRadius: '50%', flexShrink: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: TONES[BAND_TONE[c.leak_band]].fg, background: TONES[BAND_TONE[c.leak_band]].bg,
          border: `2px solid ${TONES[BAND_TONE[c.leak_band]].bd}`,
        }}>
          <span style={{ fontSize: 25, fontWeight: 800, lineHeight: 1 }}>{c.leak_score}</span>
          <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 }}>of 100</span>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>
          A modelled probability that this machine is losing refrigerant, built from the five weighted factors below
          over the last {WINDOW_DAYS} days. It is not a sensor reading. Each factor scores from zero up to its full
          weight, and the total is the sum.
        </p>
      </div>

      <Fields columns={2} rows={[
        ['Refrigerant', c.refrigerant],
        ['Nameplate charge', `${c.nameplate_charge_lb} lb`],
        ['Capacity', `${c.tons} tons at ${c.load_pct}% load`],
        ['Location', c.functional_location_name],
        ['Health index', c.health_index],
        ['Last serviced', fmtDate(c.last_maintenance_date)],
      ]} />

      <h4 style={{ margin: '20px 0 10px', fontSize: 12.5, fontWeight: 700, color: INK }}>Contributing factors</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {c.leak_factors.map((f) => (
          <div key={f.key} style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: '11px 13px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>{f.label}</span>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: f.contribution > 0 ? ACCENT : MUTE, whiteSpace: 'nowrap' }}>
                {f.contribution} <span style={{ fontSize: 11, fontWeight: 600, color: MUTE }}>of {f.weight}</span>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 5px' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: contribColour(f), whiteSpace: 'nowrap', minWidth: 82 }}>{f.value}</span>
              {/* Scaled against the factor's own weight, not against 100 — a bar
                  filled against the total would make the 30-point factor look
                  identical to the 15-point one at the same severity. */}
              <span style={{ flex: 1 }}><Bar pct={(f.contribution / f.weight) * 100} color={contribColour(f)} /></span>
            </div>
            <div style={{ fontSize: 11.5, color: SUB, lineHeight: 1.5 }}>{f.detail}</div>
          </div>
        ))}
      </div>

      <h4 style={{ margin: '20px 0 10px', fontSize: 12.5, fontWeight: 700, color: INK }}>Refrigerant top-ups</h4>
      {c.top_ups.length ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Date', 'Added', 'By', 'Reference', 'Source'].map((h, i) => (
                <th key={h} style={{
                  textAlign: i === 1 ? 'right' : 'left', padding: '8px 10px', fontSize: 10.5, fontWeight: 700,
                  color: SUB, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: `1px solid ${LINE}`,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {c.top_ups.map((t, i) => (
              <tr key={`${t.date}-${i}`} style={{ borderBottom: `1px solid ${LINE}` }}>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{fmtDate(t.date)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{t.pounds} lb</td>
                <td style={{ padding: '8px 10px' }}>{t.technician}</td>
                <td style={{ padding: '8px 10px', color: t.reference === '—' ? MUTE : ACCENT, fontWeight: t.reference === '—' ? 400 : 700 }}>{t.reference}</td>
                <td style={{ padding: '8px 10px', color: SUB }}>{t.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ padding: '18px 0', textAlign: 'center', color: MUTE, fontSize: 12.5 }}>
          No refrigerant recorded against this machine.
        </div>
      )}
      <p style={{ margin: '10px 0 0', fontSize: 11.5, color: MUTE, lineHeight: 1.55 }}>
        Lines marked <em>Work order</em> come from completed refrigerant work on this asset. Lines marked
        <em> Charge log</em> are gas booked against the machine outside a work order.
      </p>
    </div>
  )
}

function Reading({ p }) {
  if (!p) return <span style={{ color: MUTE }}>—</span>
  const colour = p.state === 'Alarm' ? RED : p.state === 'Warning' ? AMBER : GREEN
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      <span style={{ fontWeight: 700, color: colour }}>{p.value}</span>
      <span style={{ fontSize: 10.5, color: MUTE, marginLeft: 4 }}>
        {p.trend >= 0 ? '+' : '-'}{Math.abs(p.trend)}
      </span>
    </span>
  )
}

function ModuleOff() {
  return (
    <Card style={{ textAlign: 'center', padding: '44px 20px' }}>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: INK }}>This module is not switched on here</div>
      <p style={{ margin: '7px auto 0', maxWidth: 470, fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>
        Refrigerant leak detection belongs to refrigeration plant, which the organisation loaded here does not run.
        Use the portal switcher to open one that does.
      </p>
    </Card>
  )
}

const contribColour = (f) => {
  const share = f.weight ? f.contribution / f.weight : 0
  return share >= 0.66 ? RED : share >= 0.33 ? AMBER : share > 0 ? ACCENT : MUTE
}
