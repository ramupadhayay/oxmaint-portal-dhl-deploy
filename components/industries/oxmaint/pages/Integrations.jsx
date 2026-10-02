'use client'

// The connector map.
//
// What stood here was six cards with a Connect button that did nothing: it
// answered "which systems" and stopped. The argument the product actually makes
// is the flow, not the list — a runtime tag off the broker or a velocity reading
// off a vibration sensor is only worth carrying because of what it becomes,
// which is a dated work order raised before the asset stops. So this screen
// draws source → intelligence → work end to end, and every box on it opens the
// section behind it instead of a dialog that goes nowhere.
//
// The cards are folded into the connected-systems table rather than kept beside
// it. Everything they carried — the note, the record count, the sync date —
// survives in the row and its drawer; what did not survive is the pair of
// buttons that were the only reason a card needed a third of the screen.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeader, Section, StatStrip, DataTable, Drawer, Fields,
  StatusBadge, ActionButton, PALETTE,
} from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { INTEGRATIONS, ASSETS, between, fmtDate, daysUntil } from '../lib/data'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN, BLUE } = PALETTE

// Where each connector's data lands in this portal. Every key below is one the
// section router resolves — a box that navigates to a section this build does
// not have is worse than a box that does not move at all, because the reader
// only finds out after the click.
const FEEDS = {
  int_01: { key: 'work-orders', label: 'Work orders' },
  int_02: { key: 'assets', label: 'Asset master' },
  int_03: { key: 'kpis', label: 'KPIs' },
  int_04: { key: 'purchase-orders', label: 'Purchase orders' },
  int_05: { key: 'my-tasks', label: 'My tasks' },
  int_06: { key: 'members', label: 'Members' },
  int_07: { key: 'ai-auditor', label: 'AI Auditor' },
  int_08: { key: 'inspections', label: 'Inspections' },
  int_09: { key: 'ai-auditor', label: 'AI Auditor' },
  int_10: { key: 'inspections', label: 'Inspections' },
}

// Which plant a source can actually watch, matched on asset_type.
//
// Both packs are covered in one expression because they name the same machine
// differently — a chiller estate has CHW Pumps and Air Handling Units where the
// factory has Pumps and Extruders — and a pack that names its equipment in a way
// neither list anticipates falls back to the critical plant in coverage() below.
// A sensing source reporting "0 assets" reads as a broken integration rather
// than as an unrecognised word, which is the wrong thing to have a customer ask
// about.
const COVERS = {
  int_02: /pump|compressor|chiller|tower|gearbox|conveyor|extruder|press|boiler|handling|cooler|forklift/,
  int_07: /pump|compressor|chiller|tower|gearbox|conveyor|extruder|handling|cooler|purge/,
  int_08: /press|boiler|chiller|compressor|extruder|pump|handling/,
  int_09: /gearbox|hydraulic|compressor|chiller|pump|extruder|forklift/,
  int_10: /compressor|boiler|purge|refrigerant|extruder/,
}

function coverage(sources, assets) {
  const patterns = sources.map((s) => COVERS[s.id]).filter(Boolean)
  if (!patterns.length) return 0
  const matched = assets.filter((a) => patterns.some((re) => re.test(a.asset_type.toLowerCase())))
  return matched.length || assets.filter((a) => a.criticality === 'High').length
}

// Condition monitoring is read off the category rather than a list of ids, so a
// source added to the pack later joins the count without touching this file.
const CONDITION = /condition/i

const GROUPS = [
  { key: 'Enterprise', label: 'Enterprise systems' },
  { key: 'OT Platform', label: 'Plant floor / OT' },
  { key: 'Sensing', label: 'Condition monitoring' },
  { key: 'New', label: 'New sensing (pilot)', isNew: true },
]

const INTELLIGENCE = [
  { label: 'AI Auditor', sub: 'Readings judged against the asset’s own history', to: 'ai-auditor' },
  { label: 'Reliability analysis', sub: 'Failure modes ranked by criticality', to: 'rcm-reliability' },
  { label: 'Performance analytics', sub: 'MTTR, PM compliance, cost per asset', to: 'kpis' },
]

const OUTCOMES = [
  { label: 'Condition-based work orders', sub: 'Raised before the asset stops', to: 'work-orders' },
  { label: 'PM schedules', sub: 'Re-timed on runtime, not the calendar', to: 'pm-schedules' },
  { label: 'Inspections', sub: 'Routed to a technician with the finding attached', to: 'inspections' },
  { label: 'Parts demand', sub: 'Raised against the job before it starts', to: 'demand-parts' },
]

const initials = (name) => name.split(' ').map((w) => w[0]).join('').slice(0, 2)

// The exact date is on the cell's title attribute; the column itself reads
// better in days, because "3 days ago" is the question a reader is asking of a
// sync column and a formatted date makes them do the subtraction.
const syncLabel = (iso) => {
  if (!iso) return 'Never'
  const d = daysUntil(iso)
  if (d === 0) return 'Today'
  if (d === -1) return 'Yesterday'
  return `${Math.abs(d)} days ago`
}

export default function Integrations() {
  const router = useRouter()
  const { scope, siteName } = useSite()
  const [openId, setOpenId] = useState(null)

  const go = (k) => k && router.push('/portal/oxmaint/' + k)

  // The connectors themselves are organisation-level — a broker is not installed
  // per plant — so the site picker does not filter them. What it does filter is
  // the plant a sensing source covers, because "41 assets covered" has to mean
  // 41 assets on the site the header says you are looking at.
  const assets = useMemo(() => scope(ASSETS), [scope])

  const rows = useMemo(() => INTEGRATIONS.map((i) => ({
    ...i,
    // Point counts come from the seeded hash, like every other figure in this
    // demo: a tag count that changes between two openings of the same screen is
    // the one number an integrator will notice.
    _points: i.status === 'Connected' ? between(i.id + 'points', 40, 500) : 0,
    // Coverage is gated on the connection, not just on the asset types matching.
    // A pilot that has not started senses nothing, and a screen that credits it
    // with a hundred assets is the reason nobody trusts the next figure on it.
    _covers: i.status === 'Connected' && COVERS[i.id] ? coverage([i], assets) : 0,
    _feed: FEEDS[i.id],
  })), [assets])

  const stats = useMemo(() => {
    const connected = rows.filter((i) => i.status === 'Connected')
    const idle = rows.filter((i) => i.status !== 'Connected')
    const liveSensing = rows.filter((i) => CONDITION.test(i.category) && i.status === 'Connected')

    return {
      connected,
      idle,
      liveSensing,
      records: connected.reduce((n, i) => n + i.records, 0),
      covered: coverage(liveSensing, assets),
    }
  }, [rows, assets])

  const grouped = useMemo(() => {
    const out = GROUPS.map((g) => ({ ...g, items: rows.filter((i) => i.system_type === g.key) })).filter((g) => g.items.length)
    // A system_type the groups above do not know still has to appear somewhere.
    // Dropping it would hide a connected source from the map while the table
    // below carried on counting it.
    const placed = new Set(out.flatMap((g) => g.items.map((i) => i.id)))
    const rest = rows.filter((i) => !placed.has(i.id))
    return rest.length ? [...out, { key: 'other', label: 'Other sources', items: rest }] : out
  }, [rows])

  const open = rows.find((i) => i.id === openId)

  const columns = [
    { key: 'id', label: 'System', render: (i) => <span style={styles.mono}>{i.id}</span> },
    {
      key: 'name',
      label: 'Name',
      render: (i) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ ...styles.tile, opacity: i.status === 'Connected' ? 1 : 0.45 }}>{initials(i.name)}</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 600, color: INK }}>{i.name}</span>
            <span style={{ display: 'block', fontSize: 11, color: MUTE, marginTop: 1 }}>{i.category}</span>
          </span>
        </span>
      ),
    },
    { key: 'system_type', label: 'Type', render: (i) => <StatusBadge tone={i.system_type === 'New' ? 'blue' : 'grey'}>{i.system_type}</StatusBadge> },
    { key: 'protocol', label: 'Protocol', render: (i) => <span style={{ fontSize: 11.5, color: SUB }}>{i.protocol}</span> },
    {
      key: '_points', label: 'Points', align: 'right',
      render: (i) => (i._points
        ? <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{i._points}</span>
        : <span style={{ color: MUTE }}>—</span>),
    },
    { key: 'status', label: 'Status', render: (i) => <StatusBadge>{i.status}</StatusBadge> },
    {
      key: 'last_sync', label: 'Last sync',
      sortValue: (i) => (i.last_sync ? new Date(i.last_sync).getTime() : 0),
      render: (i) => <span style={{ fontSize: 11.5, color: MUTE }} title={fmtDate(i.last_sync)}>{syncLabel(i.last_sync)}</span>,
    },
    {
      key: '_feed', label: 'Feeds', sortable: false,
      render: (i) => (i._feed
        ? <button onClick={(e) => { e.stopPropagation(); go(i._feed.key) }} style={styles.link}>{i._feed.label} →</button>
        : <span style={{ color: MUTE }}>—</span>),
    },
  ]

  return (
    <div>
      <PageHeader
        icon={sectionIcon('integrations', '#15227a')}
        title="Integrations"
        subtitle="Every system this CMMS reads from, wired through to the work it raises"
        right={stats.connected.length
          ? <span style={styles.live}><span style={styles.dot} />{stats.connected.length} of {INTEGRATIONS.length} connectors live</span>
          : <span style={{ fontSize: 11.5, color: MUTE }}>Nothing connected yet</span>}
      />

      <StatStrip items={[
        { label: 'Connected', value: stats.connected.length, tone: 'green', note: `of ${INTEGRATIONS.length} connectors configured` },
        { label: 'Not connected', value: stats.idle.length, tone: stats.idle.length ? 'amber' : 'green', note: stats.idle.length ? stats.idle.map((i) => i.name).join(' · ') : 'Every connector is live' },
        { label: 'Records flowing', value: stats.records.toLocaleString('en-US'), note: 'Across live connectors' },
        { label: 'Sensing condition', value: stats.liveSensing.length, tone: 'blue', note: `${stats.covered} assets covered at ${siteName}` },
      ]} />

      <Section title="Data pipeline" right={stats.connected.length ? <span style={styles.live}><span style={styles.dot} />{stats.connected.length} sources streaming</span> : null}>
        <div style={styles.pipeline}>
          <div style={styles.col}>
            <div style={styles.colHead}>Sources</div>
            {grouped.map((g) => (
              <div key={g.key} style={styles.group}>
                <div style={styles.groupHead}>{g.label}</div>
                {g.items.map((i) => {
                  const live = i.status === 'Connected'
                  return (
                    <button key={i.id} onClick={() => go(i._feed?.key)}
                      title={i._feed ? `Feeds ${i._feed.label} →` : undefined}
                      style={{
                        ...styles.source,
                        borderColor: g.isNew ? '#bfdbfe' : LINE,
                        background: g.isNew ? '#f5f9ff' : '#fff',
                        opacity: live ? 1 : 0.65,
                        cursor: i._feed ? 'pointer' : 'default',
                      }}>
                      <span style={{ ...styles.dot, background: live ? (g.isNew ? BLUE : GREEN) : MUTE, boxShadow: live ? '0 0 0 3px #ecfdf5' : 'none' }} />
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={styles.sourceName}>{i.name}</span>
                        <span style={styles.sourceSub}>
                          {i.protocol}{i._covers ? ` · ${i._covers} assets` : ''}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          <div style={styles.arrow}>→</div>

          <div style={styles.col}>
            <div style={styles.colHead}>Intelligence layer</div>
            <div style={styles.brain}>
              {INTELLIGENCE.map((n) => (
                <button key={n.label} onClick={() => go(n.to)} style={styles.node} title="Open →">
                  <span style={styles.nodeLabel}>{n.label}</span>
                  <span style={styles.nodeSub}>{n.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={styles.arrow}>→</div>

          <div style={styles.col}>
            <div style={styles.colHead}>Maintenance work</div>
            {OUTCOMES.map((o) => (
              <button key={o.label} onClick={() => go(o.to)} style={{ ...styles.node, borderColor: '#dcfce7', background: '#f6fefb' }} title="Open →">
                <span style={styles.nodeLabel}>{o.label}</span>
                <span style={styles.nodeSub}>{o.sub}</span>
              </button>
            ))}
          </div>
        </div>

        <p style={styles.loop}>
          Nothing on this map ends at a dashboard. A reading that leaves its baseline is judged against the
          asset&rsquo;s own history, and what comes out is a work order with a date, a technician and the parts
          reserved against it — raised while the machine is still running.
        </p>
      </Section>

      <Section title="Connected systems" right={<span style={{ fontSize: 11.5, color: MUTE }}>{stats.records.toLocaleString('en-US')} records synced</span>}>
        <DataTable columns={columns} rows={rows} pageSize={12} onRowClick={(i) => setOpenId(i.id)} empty="No connectors are configured." />
      </Section>

      <Drawer
        open={Boolean(open)} onClose={() => setOpenId(null)}
        title={open?.name}
        subtitle={open ? `${open.category} · ${open.protocol}` : null}
        icon={sectionIcon('integrations', '#15227a')}
        width={480}
        footer={open?._feed ? (
          <ActionButton onClick={() => { setOpenId(null); go(open._feed.key) }}>Open {open._feed.label}</ActionButton>
        ) : null}
      >
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatusBadge>{open.status}</StatusBadge>
              <StatusBadge tone={open.system_type === 'New' ? 'blue' : 'grey'}>{open.system_type}</StatusBadge>
            </div>

            <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.55 }}>{open.note}</p>

            <Fields rows={[
              ['Protocol', open.protocol],
              ['Points streaming', open._points ? open._points.toLocaleString('en-US') : '—'],
              ['Records synced', open.records ? open.records.toLocaleString('en-US') : '—'],
              ['Last sync', open.last_sync ? fmtDate(open.last_sync) : 'Never'],
              ['Feeds', open._feed?.label || '—'],
              open._covers ? ['Plant covered', `${open._covers} assets at ${siteName}`] : null,
            ]} />
          </div>
        )}
      </Drawer>
    </div>
  )
}

const styles = {
  mono: { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 11.5, color: SUB },
  tile: {
    width: 26, height: 26, borderRadius: 7, flexShrink: 0,
    background: '#e8ecff', color: '#15227a', fontSize: 10.5, fontWeight: 800,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  link: { background: 'none', border: 'none', color: '#15227a', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  live: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#047857', fontWeight: 600 },
  dot: { width: 8, height: 8, borderRadius: '50%', background: GREEN, flexShrink: 0, boxShadow: '0 0 0 3px #ecfdf5' },
  pipeline: { display: 'grid', gridTemplateColumns: 'minmax(230px,1.2fr) auto minmax(200px,1fr) auto minmax(210px,1fr)', gap: 12, alignItems: 'start', overflowX: 'auto' },
  col: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 },
  colHead: { fontSize: 12, fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.05em' },
  group: { display: 'flex', flexDirection: 'column', gap: 6 },
  groupHead: { fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.04em' },
  source: { display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderStyle: 'solid', borderWidth: 1, borderRadius: 9, fontFamily: 'inherit', textAlign: 'left', width: '100%' },
  sourceName: { display: 'block', fontSize: 12, fontWeight: 700, color: INK, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sourceSub: { display: 'block', fontSize: 10, color: MUTE, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  arrow: { alignSelf: 'center', color: '#94a3b8', fontSize: 20, fontWeight: 800 },
  brain: { display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 12, background: 'linear-gradient(135deg,#eef1ff,#f8fafc)', border: `1px solid ${ACCENT}22` },
  node: { display: 'block', textAlign: 'left', width: '100%', padding: '10px 12px', borderStyle: 'solid', borderWidth: 1, borderColor: LINE, borderRadius: 9, background: '#fff', fontFamily: 'inherit', cursor: 'pointer' },
  nodeLabel: { display: 'block', fontSize: 12.5, fontWeight: 700, color: INK, lineHeight: 1.3 },
  nodeSub: { display: 'block', fontSize: 10.5, color: MUTE, marginTop: 2, lineHeight: 1.35 },
  loop: { margin: '14px 0 0', fontSize: 12, color: SUB, lineHeight: 1.6, background: '#f8fafc', border: `1px solid ${LINE}`, borderRadius: 10, padding: '11px 14px' },
}
