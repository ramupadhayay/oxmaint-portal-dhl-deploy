'use client'

// Every screen in this portal that is a register over one sheet.
//
// Each is a config, not a component: the list screen and the record page both
// read the same object, so a column added here appears on the table and the
// field it names is available to the page without anyone remembering to change
// two files. `Screens` at the bottom turns each config into the component the
// router mounts.
//
// They live together because each is a column list and nothing more — the
// behaviour they share is in components/Register.jsx. Twenty files of column
// definitions would make the portal look bigger without making any of it
// clearer, and would hide the thing worth seeing: that these screens really are
// the same screen.
//
// The screens that are not registers — the overview, the KPI dashboard, the
// alert workflow — are their own components and are not here.

import Register, { Facts } from '../components/Register'
import { Mono, Wrap, Chips } from '../components/cells'
import { StatusBadge, Priority, PALETTE } from '../lib/kit'
import { INSPECTION_CONFIGS } from '../lib/inspectionConfigs'
import {
  SITES, LOCATIONS, ASSET_CLASSES, MANUFACTURERS, FAILURE_CODES, CRITICALITY,
  SYSTEMS, STAKEHOLDERS, PM_TASKS, ASSET_ROWS, CORRELATION_ROWS,
  READING_ROWS, FEEDS, PM_COMPLIANCE, WEEKLY_HEALTH, BENEFITS, RISKS,
  SITE_READINESS, TECH_PREREQ, listOf, fmtDate, fmtDateTime, toneOf,
} from '../lib/data'
import { FASM_ASSETS } from '../lib/data/fasm'
import { PM_RECORDS, pmSummary } from '../lib/pmData'

const { MUTE, RED, AMBER, INK, SUB } = PALETTE

// Which feed readings are "not normal", and how loud — so the abnormal points
// surface instead of blending into a wall of "Normal" (the DCIM/BMS review: the
// screens must show what is not normal, not just carry it in a column). "Normal
// (post-repair)" and the like read as normal; only genuine deviations count.
// The status text to classify. Most feeds carry it on `status`; DCIM carries its
// signal on `trend` ("Watch - trending down") with an empty status, so read both.
const feedSignal = (r) => String((r && (r.status || r.trend)) || '')
function feedSeverity(r) {
  const s = feedSignal(r).toLowerCase()
  if (!s || s.startsWith('normal') || /stable|adequate|improved|within/.test(s)) return 'normal'
  if (/alarm|critical|fault|trip|fail/.test(s)) return 'alarm'
  if (/info/.test(s)) return 'info'
  return 'warning' // Elevated, Warning, Watch, trending down, and anything else non-normal
}
const FEED_TONE = { alarm: 'red', warning: 'amber', info: 'blue', normal: 'green' }
const FEED_RANK = { alarm: 0, warning: 1, info: 2, normal: 3 }
const feedAbnormal = (r) => { const v = feedSeverity(r); return v === 'alarm' || v === 'warning' }
// Abnormal first, then the rest — a feed screen opens on what needs eyes.
const feedSorted = (rows) => [...rows].sort((a, b) => FEED_RANK[feedSeverity(a)] - FEED_RANK[feedSeverity(b)])

// The not-normal strip the feed screens render above the table (Register's
// `banner` slot). Computed over the site-scoped set so it survives the filter.
function AbnormalBanner(rows) {
  const abnormal = feedSorted(rows.filter((r) => feedAbnormal(r)))
  if (!abnormal.length) return null
  const alarms = abnormal.filter((r) => feedSeverity(r) === 'alarm').length
  return (
    <div style={bannerStyles.wrap}>
      <div style={bannerStyles.head}>
        <span style={bannerStyles.dot} />
        <span style={bannerStyles.title}>{abnormal.length} point{abnormal.length > 1 ? 's' : ''} not normal</span>
        {alarms > 0 && <span style={bannerStyles.alarmTag}>{alarms} in alarm</span>}
      </div>
      <div style={bannerStyles.list}>
        {abnormal.slice(0, 6).map((r) => (
          <div key={r.readingId} style={bannerStyles.item}>
            <StatusBadge tone={FEED_TONE[feedSeverity(r)]}>{feedSignal(r)}</StatusBadge>
            <span style={bannerStyles.point}>{r._point || r.metric || r._system}</span>
            <span style={bannerStyles.meta}>{r._asset || r._site}{r.value != null ? ` · ${r.value} ${r.unit || ''}`.trimEnd() : ''}{r.alertId ? ` · ${r.alertId}` : ''}</span>
          </div>
        ))}
        {abnormal.length > 6 && <div style={bannerStyles.more}>+{abnormal.length - 6} more in the table below</div>}
      </div>
    </div>
  )
}

const bannerStyles = {
  wrap: { marginBottom: 14, padding: '13px 16px', borderRadius: 12, background: '#fff7ed', borderStyle: 'solid', borderWidth: 1, borderColor: '#fed7aa' },
  head: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 },
  dot: { width: 8, height: 8, borderRadius: '50%', background: AMBER },
  title: { fontSize: 13, fontWeight: 800, color: '#9a3412' },
  alarmTag: { fontSize: 10.5, fontWeight: 800, color: '#fff', background: RED, borderRadius: 999, padding: '2px 8px' },
  list: { display: 'flex', flexDirection: 'column', gap: 6 },
  item: { display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
  point: { fontSize: 12.5, fontWeight: 700, color: INK },
  meta: { fontSize: 11.5, color: SUB },
  more: { fontSize: 11, color: MUTE, marginTop: 2 },
}

const pct = (v) => (v == null ? '—' : `${Math.round(Number(v) * 1000) / 10}%`)

// The builders the configs below call. Declared first because CONFIGS calls
// feedConfig while it is being built, and a `const` referenced before its own
// line has run throws rather than reading as undefined — which is what broke
// every register screen when this block sat underneath.
// ── shared column and config builders ────────────────────────────────────

function assetColRender(r) { return <Wrap width={210}>{r._asset || '—'}</Wrap> }
const assetCol = { key: '_asset', label: 'Asset', render: assetColRender }
const valueCol = { key: 'value', label: 'Value', align: 'right', render: (r) => <strong>{r.value}</strong> }
const unitCol = { key: 'unit', label: 'Unit' }
function pointCol(label, width = 200) {
  return { key: '_point', label, render: (r) => <Wrap width={width}>{r._point}</Wrap> }
}

// The five integrated feeds differ only in which columns sit in the middle.
function feedConfig(key, { title, subtitle, rows, extra = [], search }) {
  return {
    [key]: {
      title, subtitle, rows: feedSorted(rows), search, pageSize: 15, banner: AbnormalBanner,
      // Every feed row carries a reading id, so every one of them opens. The
      // point of the record page is the pair it resolves: which asset the
      // reading is from, and which alert — if any — it went on to support.
      idOf: (r) => r.readingId,
      recordTitle: (r) => `${r.readingId} — ${r._point ?? title}`,
      recordSubtitle: (r) => `${r._system} · ${r._asset || r._site} · ${fmtDateTime(r._when)}`,
      facts: (r) => [
        ['System', r._system], ['Point', r._point],
        ['Asset', r._asset || 'Site-level, not asset-specific'],
        ['Site', r._site], ['Recorded', fmtDateTime(r._when)],
        ['Value', r.value != null ? `${r.value} ${r.unit || ''}`.trim() : '—'],
        ['Status', r.status || '—'],
        ['Correlated alert', r.alertId || 'Not linked to an alert'],
      ],
      filters: [{ label: 'Status', field: 'status' }],
      stats: (r) => {
        const notNormal = r.filter((x) => feedAbnormal(x)).length
        const alarms = r.filter((x) => feedSeverity(x) === 'alarm').length
        return [
          { label: 'Readings', value: r.length },
          { label: 'Not normal', value: notNormal, tone: notNormal ? 'amber' : 'green' },
          { label: 'In alarm', value: alarms, tone: alarms ? 'red' : 'green' },
          { label: 'Correlated to an alert', value: r.filter((x) => x.alertId).length, tone: 'blue' },
        ]
      },
      columns: [
        { key: 'readingId', label: 'Reading', render: (r) => <Mono>{r.readingId}</Mono> },
        { key: '_when', label: 'When', render: (r) => fmtDateTime(r._when) },
        { key: '_site', label: 'Site', render: (r) => <Wrap width={170}>{r._site}</Wrap> },
        ...extra,
        { key: 'status', label: 'Status', render: (r) => (r.status ? <StatusBadge tone={FEED_TONE[feedSeverity(r)]}>{r.status}</StatusBadge> : '—'), sortValue: (r) => FEED_RANK[feedSeverity(r)] },
        { key: 'alertId', label: 'Alert', render: (r) => (r.alertId ? <Mono>{r.alertId}</Mono> : '—') },
      ],
    },
  }
}

function checklistConfig({ title, subtitle, rows }) {
  return {
    title, subtitle, rows, scoped: false, pageSize: 20,
    // A checklist item is the one record here with no id of its own — the SOW
    // annexes number them by position and nothing else. Position is therefore
    // the id, which is stable as long as the generated file is: reorder the
    // source and the links move with it, which is the honest behaviour for a
    // list whose only identity is its order.
    idOf: (r) => String(rows.indexOf(r) + 1),
    recordTitle: (r) => r.item,
    recordSubtitle: (r) => `${r.category} · owned by ${r.owner}`,
    facts: (r) => [
      ['Category', r.category], ['Item', r.item],
      ['Applies to', r.appliesTo || 'All PoC sites'],
      ['Owner', r.owner], ['Status', r.status],
    ],
    search: ['item', 'category', 'owner'],
    filters: [{ label: 'Category', field: 'category' }, { label: 'Owner', field: 'owner' }],
    stats: (r) => [
      { label: 'Items', value: r.length },
      { label: 'Not started', value: r.filter((x) => x.status === 'Not Started').length, tone: 'amber' },
      { label: 'Owners', value: new Set(r.map((x) => x.owner)).size },
    ],
    columns: [
      { key: 'category', label: 'Category', render: (r) => <Wrap width={210}>{r.category}</Wrap> },
      { key: 'item', label: 'Checklist item', render: (r) => <Wrap width={380}>{r.item}</Wrap> },
      { key: 'owner', label: 'Owner', render: (r) => <Wrap width={180}>{r.owner}</Wrap> },
      { key: 'status', label: 'Status', render: (r) => <StatusBadge tone={r.status === 'Not Started' ? 'amber' : 'green'}>{r.status}</StatusBadge> },
    ],
  }
}

// ── the configs ──────────────────────────────────────────────────────────
// Keyed by the section slug the router uses, so `/portal/datacenter/assets`
// and `/portal/datacenter/assets/IAD35-CRAH-01` resolve from the same entry.

const BASE_CONFIGS = {
  // ── Sites & assets ─────────────────────────────────────────────────────
  sites: {
    title: 'Site Master',
    subtitle: 'The sites in scope, with the IT load, design PUE and redundancy each runs to.',
    rows: SITES,
    idOf: (s) => s.siteId,
    recordTitle: (s) => `${s.siteId} — ${s.siteName}`,
    recordSubtitle: (s) => `${s.facilityType} · ${s.metro}`,
    search: ['siteId', 'siteName', 'metro', 'country', 'facilityType'],
    filters: [{ label: 'Region', field: 'region' }, { label: 'Power', field: 'powerRedundancy' }],
    stats: (r) => [
      { label: 'Sites', value: r.length },
      { label: 'Regions', value: new Set(r.map((s) => s.region)).size },
      { label: 'Total IT load', value: r.reduce((n, s) => n + (Number(s.itLoadMw) || 0), 0).toFixed(1), unit: 'MW' },
      { label: '2N power', value: r.filter((s) => s.powerRedundancy === '2N').length },
    ],
    columns: [
      { key: 'siteId', label: 'Site', render: (s) => <Mono>{s.siteId}</Mono> },
      { key: 'siteName', label: 'Name', render: (s) => <Wrap>{s.siteName}</Wrap> },
      { key: 'region', label: 'Region' },
      { key: 'metro', label: 'Metro' },
      { key: 'facilityType', label: 'Type', render: (s) => <Wrap width={200}>{s.facilityType}</Wrap> },
      { key: 'powerRedundancy', label: 'Power', render: (s) => <StatusBadge tone={s.powerRedundancy === '2N' ? 'green' : 'blue'}>{s.powerRedundancy}</StatusBadge> },
      { key: 'coolingRedundancy', label: 'Cooling' },
      { key: 'itLoadMw', label: 'IT load', align: 'right', render: (s) => `${s.itLoadMw} MW` },
    ],
    facts: (s) => [
      ['Region', `${s.region} · ${s.country}`],
      ['Metro area', s.metro],
      ['Facility type', s.facilityType],
      ['Design tier', s.designTier],
      ['Power redundancy', s.powerRedundancy],
      ['Cooling redundancy', s.coolingRedundancy],
      ['PoC critical zone', s.pocZone],
      ['IT load', `${s.itLoadMw} MW`],
      // Locale named explicitly. `toLocaleString()` with no argument reads the
      // environment's locale, and the server's is not the browser's — the
      // server rendered "1,200,000" and a browser elsewhere rendered
      // "1.200.000", which React caught as a hydration mismatch on this one
      // record page.
      ['Gross area', `${Number(s.grossAreaSqFt).toLocaleString('en-GB')} sq ft`],
      ['PoC status', <StatusBadge key="s">{s.pocStatus}</StatusBadge>],
    ],
  },

  locations: {
    title: 'Location Hierarchy',
    subtitle: 'Site → Building → Floor → Data Hall. Assets hang off this so they roll up to a physical and redundancy path.',
    rows: LOCATIONS,

    idOf: (l) => l.locationId,
    recordTitle: (l) => l.locationName,
    recordSubtitle: (l) => `${l.locationType} · ${l.locationId}`,
    facts: (l) => [
      ['Location ID', l.locationId], ['Name', l.locationName],
      ['Type', l.locationType], ['Sits inside', l.parentId],
      ['Site', l.siteId],
    ],
    pageSize: 15,
    search: ['locationId', 'locationName', 'locationType'],
    filters: [{ label: 'Type', field: 'locationType' }],
    stats: (r) => [
      { label: 'Locations', value: r.length },
      { label: 'Data halls', value: r.filter((l) => (l.locationType || '').includes('Data Hall')).length },
      { label: 'Types', value: new Set(r.map((l) => l.locationType)).size },
    ],
    columns: [
      { key: 'locationId', label: 'Location ID', render: (l) => <Mono>{l.locationId}</Mono> },
      { key: 'locationName', label: 'Name', render: (l) => <Wrap>{l.locationName}</Wrap> },
      { key: 'locationType', label: 'Type' },
      { key: 'parentId', label: 'Parent', render: (l) => <Mono>{l.parentId}</Mono> },
      { key: 'siteId', label: 'Site', render: (l) => <Mono>{l.siteId}</Mono> },
    ],
  },

  assets: {
    // Named for the product's own module, with the SOW's term kept in the line
    // under it. The heading and the sidebar have to agree, and the sidebar has
    // to read the way Oxmaint reads — but "FASM" is the client's word for this
    // deliverable and dropping it would lose the thread back to SOW 3.3.
    title: 'Assets Master',
    subtitle: 'Every asset in scope, with its class, criticality, monitoring method and data sources. Assets excluded from monitoring stay on the register with the reason why.',
    rows: ASSET_ROWS,
    idOf: (a) => a.assetId,
    recordTitle: (a) => `${a.assetId} — ${a.assetName}`,
    recordSubtitle: (a) => `${a.assetClass} · ${a._site}`,
    search: ['assetId', 'assetName', 'assetClass', 'manufacturer'],
    filters: [
      { label: 'Criticality', field: 'criticality' },
      { label: 'Category', field: '_category' },
      { label: 'Scope', field: 'scopeStatus' },
    ],
    stats: (r) => [
      { label: 'Assets', value: r.length },
      { label: 'In scope', value: r.filter((a) => a._included).length, tone: 'green' },
      { label: 'Excluded', value: r.filter((a) => !a._included).length, tone: 'grey' },
      { label: 'Critical', value: r.filter((a) => a.criticality === 'Critical').length, tone: 'red' },
      { label: 'Classes', value: new Set(r.map((a) => a.assetClass)).size },
    ],
    columns: [
      { key: 'assetId', label: 'Asset ID', render: (a) => <Mono>{a.assetId}</Mono> },
      { key: 'assetName', label: 'Asset', render: (a) => (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}><Wrap width={240}>{a.assetName}</Wrap></div>
          <div style={{ fontSize: 11, color: MUTE }}>{a._site} · {a._location}</div>
        </div>
      ) },
      { key: '_category', label: 'Category' },
      { key: 'criticality', label: 'Criticality', render: (a) => <StatusBadge tone={toneOf(a.criticality)}>{a.criticality}</StatusBadge> },
      { key: '_tier', label: 'Tier' },
      { key: 'failureCodes', label: 'Failure codes', render: (a) => <Chips values={a._failureCodes} /> },
      { key: 'manufacturer', label: 'Manufacturer', render: (a) => <Wrap width={170}>{a.manufacturer}</Wrap> },
      { key: 'scopeStatus', label: 'Scope', render: (a) => <StatusBadge tone={a._included ? 'green' : 'grey'}>{a.scopeStatus}</StatusBadge> },
    ],
    facts: (a) => [
      ['Asset class', a.assetClass],
      ['Category', a._category],
      ['Site', `${a._site}${a._siteZone ? ` · ${a._siteZone}` : ''}`],
      ['Location', a._location],
      ['Criticality', <span key="c"><StatusBadge tone={toneOf(a.criticality)}>{a.criticality}</StatusBadge> {a._tier}</span>],
      ['Response SLA', a._sla],
      ['Manufacturer', a.manufacturer],
      ['Monitoring method', a.monitoringMethod],
      ['Existing data sources', <Chips key="d" values={a._dataSources} />],
      ['Additional sensors', <Chips key="s" values={a._sensors} />],
      ['Failure codes', <Chips key="f" values={a._failureCodes} />],
      ['Maintenance strategy', a._strategy],
      ['Scope', <StatusBadge key="x" tone={a._included ? 'green' : 'grey'}>{a.scopeStatus}</StatusBadge>],
      ['Rationale', a.scopeRationale],
    ],
  },

  'asset-classes': {
    title: 'Asset Classes',
    subtitle: 'The asset classes in scope, with the default criticality, recommended sensing and maintenance strategy for each.',
    rows: ASSET_CLASSES,
    scoped: false,
    pageSize: 20,
    idOf: (c) => c.classId,
    recordTitle: (c) => c.className,
    recordSubtitle: (c) => `${c.category} · ${c.classId}`,
    search: ['classId', 'className', 'category', 'strategy'],
    filters: [{ label: 'Category', field: 'category' }, { label: 'Criticality', field: 'defaultCriticality' }],
    stats: (r) => [
      { label: 'Classes', value: r.length },
      { label: 'Mechanical', value: r.filter((c) => c.category === 'Mechanical').length },
      { label: 'Electrical', value: r.filter((c) => c.category === 'Electrical').length },
      { label: 'Critical by default', value: r.filter((c) => c.defaultCriticality === 'Critical').length, tone: 'red' },
    ],
    columns: [
      { key: 'classId', label: 'Class', render: (c) => <Mono>{c.classId}</Mono> },
      { key: 'className', label: 'Asset class', render: (c) => <Wrap>{c.className}</Wrap> },
      { key: 'category', label: 'Category' },
      { key: 'defaultCriticality', label: 'Default criticality', render: (c) => <StatusBadge tone={toneOf(c.defaultCriticality)}>{c.defaultCriticality}</StatusBadge> },
      { key: 'monitoring', label: 'Monitoring', render: (c) => <Chips values={listOf(c.monitoring)} /> },
    ],
    facts: (c) => [
      ['Class ID', c.classId], ['Category', c.category],
      ['Default criticality', c.defaultCriticality],
      ['Recommended monitoring', <Chips key="m" values={listOf(c.monitoring)} />],
      ['Maintenance strategy', c.strategy],
      ['Representative OEMs', MANUFACTURERS.find((m) => m.classId === c.classId)?.manufacturers],
    ],
  },

  // ── Condition monitoring ───────────────────────────────────────────────
  readings: {
    title: 'Sensor Readings',
    subtitle: 'Vibration, thermal and ultrasound measurements against their alarm thresholds. The rows that crossed a threshold are the ones that raised an alert.',
    rows: READING_ROWS,

    idOf: (r) => r.readingId,
    recordTitle: (r) => `${r.readingId} — ${r.sensorType}`,
    recordSubtitle: (r) => `${r._asset} · ${fmtDateTime(r.timestamp)}`,
    facts: (r) => [
      ['Reading', r.readingId], ['Sensor', r.sensorType],
      ['Asset', r._asset], ['Site', r._site],
      ['Recorded', fmtDateTime(r.timestamp)],
      ['Value', `${r.value} ${r.unit || ''}`.trim()],
      ['Threshold', r.threshold], ['Status', r.status],
      ['Raised alert', r.alertId || 'Below threshold — no alert'],
    ],
    pageSize: 15,
    search: ['readingId', '_asset', 'sensorType', 'status'],
    filters: [{ label: 'Sensor', field: 'sensorType' }, { label: 'Status', field: 'status' }],
    stats: (r) => [
      { label: 'Readings', value: r.length },
      { label: 'In alarm', value: r.filter((x) => /alarm/i.test(x.status || '')).length, tone: 'red' },
      { label: 'Warning', value: r.filter((x) => /warning/i.test(x.status || '')).length, tone: 'amber' },
      { label: 'Raised an alert', value: r.filter((x) => x.alertId).length, tone: 'blue' },
    ],
    columns: [
      { key: 'readingId', label: 'Reading', render: (r) => <Mono>{r.readingId}</Mono> },
      { key: 'timestamp', label: 'When', render: (r) => fmtDateTime(r.timestamp) },
      { key: '_asset', label: 'Asset', render: (r) => <Wrap width={230}>{r._asset}</Wrap> },
      { key: 'sensorType', label: 'Sensor' },
      { key: 'value', label: 'Value', align: 'right', render: (r) => <strong>{r.value}</strong> },
      { key: 'unit', label: 'Unit / baseline', render: (r) => <Wrap width={180}>{r.unit}</Wrap> },
      { key: 'threshold', label: 'Threshold', render: (r) => <Wrap width={170}>{r.threshold}</Wrap> },
      { key: 'status', label: 'Status', render: (r) => <StatusBadge>{r.status}</StatusBadge> },
      { key: 'alertId', label: 'Alert', render: (r) => (r.alertId ? <Mono>{r.alertId}</Mono> : '—') },
    ],
  },

  correlation: {
    title: 'Maintenance Correlation Log',
    subtitle: 'Each alert against what an engineer physically found, and how far ahead of the scheduled PM it was caught. This is the evidence behind the business case.',
    rows: CORRELATION_ROWS,
    idOf: (c) => c.correlationId,
    recordTitle: (c) => `${c.correlationId} — ${c._asset}`,
    recordSubtitle: (c) => `Linked to ${c.alertId}`,
    search: ['correlationId', 'alertId', '_asset', 'finding', 'failureMode'],
    filters: [{ label: 'Confirmed', field: 'confirmed' }],
    stats: (r) => [
      { label: 'Correlations', value: r.length },
      { label: 'Anomaly confirmed', value: r.filter((c) => c.confirmed === 'Yes').length, tone: 'green' },
      { label: 'Not confirmed', value: r.filter((c) => c.confirmed === 'No').length, tone: 'red' },
      { label: 'Pending', value: r.filter((c) => c.confirmed === 'Pending').length, tone: 'amber' },
    ],
    columns: [
      { key: 'correlationId', label: 'ID', render: (c) => <Mono>{c.correlationId}</Mono> },
      { key: 'alertId', label: 'Alert', render: (c) => <Mono>{c.alertId}</Mono> },
      { key: '_asset', label: 'Asset', render: (c) => <Wrap width={220}>{c._asset}</Wrap> },
      { key: 'inspectionDate', label: 'Inspected', render: (c) => fmtDate(c.inspectionDate) },
      { key: 'failureMode', label: 'Failure mode confirmed', render: (c) => <Wrap width={200}>{c.failureMode}</Wrap> },
      { key: 'confirmed', label: 'Confirmed', render: (c) => (
        <StatusBadge tone={c.confirmed === 'Yes' ? 'green' : c.confirmed === 'No' ? 'red' : 'amber'}>{c.confirmed}</StatusBadge>
      ) },
      { key: 'leadTime', label: 'Lead time vs PM', render: (c) => <Wrap width={260}>{c.leadTime}</Wrap> },
    ],
    facts: (c) => [
      ['Linked alert', c.alertId], ['Severity', c._severity],
      ['Inspection date', fmtDate(c.inspectionDate)],
      ['Finding', c.finding],
      ['Confirmed anomaly', c.confirmed],
      ['Failure mode confirmed', c.failureMode],
      ['Detection lead time', c.leadTime],
      ['Optimization insight', c.insight],
    ],
  },

  // ── Integrated sources ─────────────────────────────────────────────────
  systems: {
    title: 'Data Source Systems',
    subtitle: 'The existing platforms this reads from, plus the three sensing technologies it adds — with the protocol each speaks.',
    rows: SYSTEMS,
    scoped: false,
    pageSize: 15,
    idOf: (s) => s.systemId,
    recordTitle: (s) => s.systemName,
    recordSubtitle: (s) => s.systemType,
    search: ['systemId', 'systemName', 'vendor', 'protocol', 'dataPoints'],
    filters: [{ label: 'Type', field: 'systemType' }],
    stats: (r) => [
      { label: 'Systems', value: r.length },
      { label: 'Existing platforms', value: r.filter((s) => /Existing/.test(s.systemType)).length },
      { label: 'New sensing', value: r.filter((s) => !/Existing/.test(s.systemType)).length, tone: 'blue' },
    ],
    columns: [
      { key: 'systemId', label: 'System', render: (s) => <Mono>{s.systemId}</Mono> },
      { key: 'systemName', label: 'Name', render: (s) => <Wrap>{s.systemName}</Wrap> },
      { key: 'systemType', label: 'Type', render: (s) => <Wrap width={180}>{s.systemType}</Wrap> },
      { key: 'protocol', label: 'Protocol', render: (s) => <Chips values={listOf(s.protocol)} /> },
      { key: 'scope', label: 'Scope', render: (s) => <Wrap width={200}>{s.scope}</Wrap> },
    ],
    facts: (s) => [
      ['System ID', s.systemId], ['Type', s.systemType], ['Vendor / platform', s.vendor],
      ['Protocol', s.protocol], ['Typical data points', s.dataPoints],
      ['Scope', s.scope],
    ],
  },

  ...feedConfig('bms', {
    title: 'BMS Telemetry',
    subtitle: 'Building Management System points — supply and return air, humidity, valve position. Existing telemetry the PoC reads rather than replaces.',
    rows: FEEDS.BMS,
    search: ['readingId', 'point', '_asset', '_site'],
    extra: [assetCol, pointCol('Point'), valueCol, unitCol],
  }),

  ...feedConfig('epms', {
    title: 'EPMS Telemetry',
    subtitle: 'Electrical Power Monitoring points. Several rows here precede an alert by minutes — the clearest example of correlation across more than one source.',
    rows: FEEDS.EPMS,
    search: ['readingId', 'point', '_asset', '_site'],
    extra: [assetCol, pointCol('Point'), valueCol, unitCol],
  }),

  ...feedConfig('dcim', {
    title: 'DCIM Metrics',
    subtitle: 'Facility-level capacity and efficiency — PUE, power and cooling headroom — as recorded by each site DCIM platform.',
    rows: FEEDS.DCIM,
    search: ['readingId', 'metric', '_site'],
    extra: [pointCol('Metric', 220), valueCol, unitCol,
      { key: 'trend', label: 'Trend', render: (r) => (feedAbnormal(r) ? <StatusBadge tone={FEED_TONE[feedSeverity(r)]}>{r.trend}</StatusBadge> : <Wrap width={200}>{r.trend}</Wrap>) }],
  }),

  ...feedConfig('oem', {
    title: 'OEM Monitoring',
    subtitle: 'Health scores and diagnostic flags from the manufacturers’ own platforms — Vertiv LIFE, Cummins PowerCommand, MTU ONCall.',
    rows: FEEDS.OEM,
    search: ['readingId', 'platform', 'indicator', '_asset'],
    extra: [assetCol, { key: 'platform', label: 'Platform', render: (r) => <Wrap width={180}>{r.platform}</Wrap> },
      pointCol('Indicator', 190), { key: 'value', label: 'Value', render: (r) => <Wrap width={220}>{r.value}</Wrap> }],
  }),

  ...feedConfig('battery', {
    title: 'Battery Monitoring',
    subtitle: 'Cell-level voltage, internal resistance and state of health across the UPS strings. Rising internal resistance is the early signal here.',
    rows: FEEDS.Battery,
    search: ['readingId', 'cellRef', '_asset'],
    extra: [assetCol, { key: 'cellRef', label: 'String / cell', render: (r) => <Wrap width={160}>{r.cellRef}</Wrap> },
      { key: 'cellVoltage', label: 'Cell V', align: 'right' },
      { key: 'internalResistance', label: 'IR (mΩ)', align: 'right' },
      { key: 'stateOfHealth', label: 'SoH %', align: 'right', render: (r) => <strong>{r.stateOfHealth}</strong> }],
  }),

  // ── Maintenance ────────────────────────────────────────────────────────
  // Work orders are not here. That screen reads the store as well as the
  // workbook — anything raised in the portal has to appear in it — so it is
  // its own component in WorkOrders.jsx. Leaving a config here too would be
  // two descriptions of one screen, which is the drift this file exists to
  // avoid.

  'pm-tasks': {
    title: 'PM Task Library (Baseline)',
    subtitle: 'The existing calendar-based preventive maintenance. None of it is removed or replaced — condition monitoring runs alongside it, not instead of it.',
    rows: PM_TASKS,

    idOf: (t) => t.taskId,
    recordTitle: (t) => t.task,
    recordSubtitle: (t) => `${t.taskId} · ${t.assetClass}`,
    facts: (t) => [
      ['Task', t.task], ['Task ID', t.taskId],
      ['Asset class', t.assetClass], ['Frequency', t.frequency],
      ['Standard', t.standard],

    ],
    scoped: false,
    pageSize: 15,
    search: ['taskId', 'task', 'assetClass', 'standard'],
    filters: [{ label: 'Frequency', field: 'frequency' }],
    stats: (r) => [
      { label: 'PM tasks', value: r.length },
      { label: 'Asset classes covered', value: new Set(r.map((t) => t.assetClass)).size },
      { label: 'Displaced', value: 0, tone: 'green', note: 'baseline preserved' },
    ],
    columns: [
      { key: 'taskId', label: 'Task', render: (t) => <Mono>{t.taskId}</Mono> },
      { key: 'assetClass', label: 'Asset class', render: (t) => <Wrap width={220}>{t.assetClass}</Wrap> },
      { key: 'task', label: 'PM task', render: (t) => <Wrap width={280}>{t.task}</Wrap> },
      { key: 'frequency', label: 'Frequency', render: (t) => <StatusBadge tone="blue">{t.frequency}</StatusBadge> },
      { key: 'standard', label: 'Standard', render: (t) => <Wrap width={180}>{t.standard}</Wrap> },
    ],
  },

  'pm-compliance': {
    title: 'PM Compliance',
    subtitle: 'The baseline preventive maintenance, continuing to run — on-time adherence, schedule variance and next-due. Open a row for the checklist worked, the readings taken and the finding.',
    rows: PM_RECORDS,

    idOf: (c) => c.logId,
    recordTitle: (c) => `${c.logId} — ${c.taskId}`,
    recordSubtitle: (c) => `${c.assetId} · scheduled ${fmtDate(c.scheduledDate)}`,
    facts: (c) => [
      ['Log entry', c.logId], ['Task', c.taskId], ['Asset', c.assetId],
      ['Scheduled', fmtDate(c.scheduledDate)],
      ['Completed', c.completedDate ? fmtDate(c.completedDate) : 'Not yet completed'],
      ['Status', c.status], ['Team', c.team],
    ],
    scoped: false,
    search: ['logId', 'taskId', 'assetId', 'team'],
    filters: [{ label: 'Status', field: 'status' }],
    stats: (r) => {
      const s = pmSummary(r)
      return [
        { label: 'Logged', value: s.total },
        { label: 'On-time adherence', value: s.adherence, unit: '%', tone: s.adherence >= 90 ? 'green' : 'amber', note: `${s.onTime} of ${s.onTime + s.late} completed` },
        { label: 'Completed late', value: s.late, tone: s.late ? 'amber' : 'green' },
        { label: 'Avg variance', value: s.avgVariance, unit: 'd', tone: s.avgVariance <= 1 ? 'green' : 'amber', note: 'scheduled → completed' },
        { label: 'Scheduled ahead', value: s.scheduled, tone: 'blue' },
      ]
    },
    columns: [
      { key: 'logId', label: 'Log', render: (p) => <Mono>{p.logId}</Mono> },
      { key: 'taskId', label: 'PM task', render: (p) => <Wrap width={230}><strong>{p._taskName}</strong> <span style={{ color: MUTE, fontSize: 11 }}>{p._frequency}</span></Wrap> },
      { key: 'assetId', label: 'Asset', render: (p) => <Wrap width={170}>{p._assetName}</Wrap> },
      { key: 'scheduledDate', label: 'Scheduled', render: (p) => fmtDate(p.scheduledDate) },
      { key: 'status', label: 'Status', render: (p) => <StatusBadge tone={p._onTime ? 'green' : p._late ? 'amber' : 'blue'}>{p.status}</StatusBadge>, sortValue: (p) => (p._onTime ? 0 : p._late ? 1 : 2) },
      { key: 'variance', label: 'Variance', align: 'right', render: (p) => (p.varianceDays == null ? '—' : p.varianceDays <= 0 ? <span style={{ color: '#047857' }}>{Math.abs(p.varianceDays)}d early</span> : <span style={{ color: p.varianceDays > 3 ? '#b91c1c' : '#b45309' }}>{p.varianceDays}d late</span>), sortValue: (p) => p.varianceDays ?? -99 },
      { key: 'nextDue', label: 'Next due', render: (p) => fmtDate(p.nextDue) },
    ],
  },


  // ── Reporting ──────────────────────────────────────────────────────────
  'weekly-health': {
    title: 'Weekly Health Report',
    subtitle: 'The reporting cadence — weekly at first, biweekly once it settles. These three percentages feed the technical KPIs.',
    rows: WEEKLY_HEALTH,
    scoped: false,
    idOf: (w) => w.reportId,
    recordTitle: (w) => `${w.reportId} — week ending ${w.weekEnding}`,
    recordSubtitle: (w) => `${w.cadence} · prepared by ${w.preparedBy}`,
    search: ['reportId', 'observations', 'cadence'],
    filters: [{ label: 'Cadence', field: 'cadence' }],
    stats: (r) => [
      { label: 'Reports', value: r.length },
      { label: 'Latest sensor availability', value: pct(r[r.length - 1]?.sensorAvailability), tone: 'green' },
      { label: 'Alerts closed', value: r.reduce((n, w) => n + (Number(w.alertsClosed) || 0), 0) },
      { label: 'WOs raised', value: r.reduce((n, w) => n + (Number(w.workOrdersRaised) || 0), 0) },
    ],
    columns: [
      { key: 'reportId', label: 'Report', render: (w) => <Mono>{w.reportId}</Mono> },
      { key: 'weekEnding', label: 'Week ending', render: (w) => fmtDate(w.weekEnding) },
      { key: 'cadence', label: 'Cadence' },
      { key: 'sensorAvailability', label: 'Sensor avail.', align: 'right', render: (w) => pct(w.sensorAvailability) },
      { key: 'dataReliability', label: 'Data reliab.', align: 'right', render: (w) => pct(w.dataReliability) },
      { key: 'dashboardAvailability', label: 'Dashboard', align: 'right', render: (w) => pct(w.dashboardAvailability) },
      { key: 'openAlerts', label: 'Open', align: 'right' },
      { key: 'workOrdersRaised', label: 'WOs', align: 'right' },
    ],
    facts: (w) => [
      ['Cadence', w.cadence],
      ['Sensor availability', pct(w.sensorAvailability)],
      ['Data acquisition reliability', pct(w.dataReliability)],
      ['Dashboard availability', pct(w.dashboardAvailability)],
      ['Open alerts', w.openAlerts], ['Alerts closed', w.alertsClosed],
      ['Work orders raised', w.workOrdersRaised],
      ['Key observations', w.observations],
      ['Prepared by', w.preparedBy],
    ],
  },

  benefits: {
    title: 'Benefits Realization',
    subtitle: 'The evidence base behind the scale-up decision. Every benefit points back at the correlation and work order that support it.',
    rows: BENEFITS,
    scoped: false,
    idOf: (b) => b.benefitId,
    recordTitle: (b) => `${b.benefitId} — ${b.category}`,
    recordSubtitle: (b) => `Evidence: ${b.evidence}`,
    search: ['benefitId', 'description', 'category', 'impact'],
    filters: [{ label: 'Category', field: 'category' }],
    stats: (r) => [
      { label: 'Benefits recorded', value: r.length },
      { label: 'Categories', value: new Set(r.map((b) => b.category)).size },
      { label: 'Evidence-linked', value: r.filter((b) => b.evidence).length, tone: 'green' },
    ],
    columns: [
      { key: 'benefitId', label: 'ID', render: (b) => <Mono>{b.benefitId}</Mono> },
      { key: 'category', label: 'Category', render: (b) => <StatusBadge tone="blue">{b.category}</StatusBadge> },
      { key: 'description', label: 'Benefit', render: (b) => <Wrap width={330}>{b.description}</Wrap> },
      { key: 'evidence', label: 'Evidence', render: (b) => <Mono>{b.evidence}</Mono> },
      { key: 'impact', label: 'Estimated impact', render: (b) => <Wrap width={280}>{b.impact}</Wrap> },
    ],
    facts: (b) => [
      ['Description', b.description], ['Linked evidence', b.evidence],
      ['Estimated impact', b.impact], ['Basis / assumption', b.basis],
    ],
  },

  // ── Governance & readiness ─────────────────────────────────────────────
  risks: {
    title: 'Risk, Assumption & Dependency Register',
    subtitle: 'Assumptions and dependencies sit here alongside risks, because an unmet dependency behaves exactly like one.',
    rows: RISKS,
    scoped: false,
    pageSize: 15,
    idOf: (r) => r.id,
    recordTitle: (r) => `${r.id} — ${r.category}`,
    recordSubtitle: (r) => `Owner: ${r.owner}`,
    search: ['id', 'description', 'mitigation', 'owner'],
    filters: [{ label: 'Category', field: 'category' }, { label: 'Status', field: 'status' }, { label: 'Owner', field: 'owner' }],
    stats: (r) => [
      { label: 'Entries', value: r.length },
      { label: 'Risks', value: r.filter((x) => x.category === 'Risk').length, tone: 'amber' },
      { label: 'Assumptions', value: r.filter((x) => x.category === 'Assumption').length },
      { label: 'Dependencies', value: r.filter((x) => x.category === 'Dependency').length },
    ],
    columns: [
      { key: 'id', label: 'ID', render: (r) => <Mono>{r.id}</Mono> },
      { key: 'category', label: 'Category', render: (r) => <StatusBadge tone={r.category === 'Risk' ? 'amber' : 'blue'}>{r.category}</StatusBadge> },
      { key: 'description', label: 'Description', render: (r) => <Wrap width={320}>{r.description}</Wrap> },
      { key: 'likelihood', label: 'Likelihood' },
      { key: 'impact', label: 'Impact', render: (r) => <Wrap width={130}>{r.impact}</Wrap> },
      { key: 'owner', label: 'Owner', render: (r) => <Wrap width={170}>{r.owner}</Wrap> },
      { key: 'status', label: 'Status', render: (r) => <StatusBadge>{r.status}</StatusBadge> },
    ],
    facts: (r) => [
      ['Description', r.description], ['Likelihood', r.likelihood], ['Impact', r.impact],
      ['Mitigation / response', r.mitigation], ['Owner', r.owner], ['Status', r.status],
    ],
  },

  'site-readiness': checklistConfig({
    title: 'Site Readiness',
    subtitle: 'What each site must clear before installation — access, permissions, data sources, safety.',
    rows: SITE_READINESS,
  }),

  'tech-prereq': checklistConfig({
    title: 'Technical Prerequisites',
    subtitle: 'Network, cybersecurity and power prerequisites for the sensor gateways. Nothing is installed until these are signed off.',
    rows: TECH_PREREQ,
  }),

  stakeholders: {
    title: 'Stakeholders & RACI',
    subtitle: 'Who owns what, and how often each forum meets.',
    rows: STAKEHOLDERS,

    idOf: (x) => x.role,
    recordTitle: (x) => x.role,
    recordSubtitle: (x) => `${x.raci} · ${x.cadence}`,
    facts: (x) => [
      ['Role', x.role], ['RACI', x.raci],
      ['Review cadence', x.cadence], ['Responsibility', x.responsibility],
    ],
    scoped: false,
    search: ['role', 'responsibility', 'raci'],
    filters: [{ label: 'RACI', field: 'raci' }],
    stats: (r) => [
      { label: 'Stakeholders', value: r.length },
      { label: 'Accountable', value: r.filter((s) => /Accountable/.test(s.raci)).length },
      { label: 'Responsible', value: r.filter((s) => /Responsible/.test(s.raci)).length },
    ],
    columns: [
      { key: 'role', label: 'Role', render: (s) => <Wrap width={230}>{s.role}</Wrap> },
      { key: 'raci', label: 'RACI', render: (s) => <StatusBadge tone="blue">{s.raci}</StatusBadge> },
      { key: 'cadence', label: 'Cadence', render: (s) => <Wrap width={200}>{s.cadence}</Wrap> },
      { key: 'responsibility', label: 'Core responsibility', render: (s) => <Wrap width={380}>{s.responsibility}</Wrap> },
    ],
  },

  // ── Reference ──────────────────────────────────────────────────────────
  'failure-codes': {
    title: 'Failure Codes',
    subtitle: 'The failure modes each sensing technology is being asked to detect. Every alert names one of these.',
    rows: FAILURE_CODES,

    idOf: (f) => f.code,
    recordTitle: (f) => `${f.code} — ${f.mode}`,
    recordSubtitle: (f) => f.technology,
    facts: (f) => [
      ['Code', f.code], ['Failure mode', f.mode],
      ['Detected by', f.technology],
    ],
    scoped: false,
    pageSize: 20,
    search: ['code', 'mode', 'technology'],
    filters: [{ label: 'Technology', field: 'technology' }],
    stats: (r) => [
      { label: 'Failure modes', value: r.length },
      { label: 'Vibration', value: r.filter((f) => f.technology === 'Vibration').length },
      { label: 'Thermal', value: r.filter((f) => f.technology === 'Thermal').length },
      { label: 'Ultrasound', value: r.filter((f) => f.technology === 'Ultrasound').length },
    ],
    columns: [
      { key: 'code', label: 'Code', render: (f) => <Mono>{f.code}</Mono> },
      { key: 'technology', label: 'Technology', render: (f) => <StatusBadge tone="blue">{f.technology}</StatusBadge> },
      { key: 'mode', label: 'Failure mode', render: (f) => <Wrap width={300}>{f.mode}</Wrap> },
    ],
  },

  criticality: {
    title: 'Criticality Matrix',
    subtitle: 'Criticality here is defined by what losing the asset does to the redundancy path, not by a generic high/medium/low — which is what makes the response SLA meaningful.',
    rows: CRITICALITY,

    idOf: (c) => c.rating,
    recordTitle: (c) => `${c.rating} — ${c.tier}`,
    recordSubtitle: (c) => `Response SLA ${c.responseSla}`,
    facts: (c) => [
      ['Rating', c.rating], ['Tier', c.tier],
      ['Redundancy impact', c.redundancyImpact],
      ['Business impact', c.businessImpact],
      ['Response SLA', c.responseSla],
    ],
    scoped: false,
    pageSize: 10,
    search: ['rating', 'tier', 'redundancyImpact', 'businessImpact'],
    stats: (r) => [{ label: 'Ratings', value: r.length }],
    columns: [
      { key: 'rating', label: 'Rating', render: (c) => <StatusBadge tone={toneOf(c.rating)}>{c.rating}</StatusBadge> },
      { key: 'tier', label: 'Tier' },
      { key: 'redundancyImpact', label: 'Redundancy impact', render: (c) => <Wrap width={330}>{c.redundancyImpact}</Wrap> },
      { key: 'businessImpact', label: 'Business impact', render: (c) => <Wrap width={280}>{c.businessImpact}</Wrap> },
      { key: 'responseSla', label: 'Response SLA', render: (c) => <Wrap width={200}>{c.responseSla}</Wrap> },
    ],
  },

  manufacturers: {
    title: 'Manufacturers',
    subtitle: 'Representative OEMs per asset class. The confirmed vendor list is agreed at initiation.',
    rows: MANUFACTURERS,

    idOf: (m) => m.classId,
    recordTitle: (m) => m.className,
    recordSubtitle: (m) => `${m.classId} · ${listOf(m.manufacturers).length} representative makers`,
    facts: (m) => [
      ['Asset class', m.className], ['Class ID', m.classId],
      ['Representative manufacturers', m.manufacturers],
    ],
    scoped: false,
    pageSize: 20,
    search: ['classId', 'className', 'manufacturers'],
    stats: (r) => [{ label: 'Asset classes', value: r.length }],
    columns: [
      { key: 'classId', label: 'Class', render: (m) => <Mono>{m.classId}</Mono> },
      { key: 'className', label: 'Asset class', render: (m) => <Wrap width={260}>{m.className}</Wrap> },
      { key: 'manufacturers', label: 'Representative OEMs', render: (m) => <Chips values={listOf(m.manufacturers)} /> },
    ],
  },
}

// The Inspection module's registers are configs of exactly this shape, written
// in their own file because they are the one group whose rows are generated
// rather than read from a sheet — and that reasoning is long enough to want its
// own module. Merged here so RecordView keeps one place to look up a section.
export const CONFIGS = { ...BASE_CONFIGS, ...INSPECTION_CONFIGS }

/** The row a record page is showing, found by the id in its URL. */
export function findRecord(section, id) {
  const cfg = CONFIGS[section]
  if (!cfg?.idOf) return null
  const hit = cfg.rows.find((r) => String(cfg.idOf(r)) === String(id))
  if (hit) return hit
  // The Assets register is the Final Asset Scope Matrix, whose rows are not in
  // the seeded config — resolve a scope-matrix asset for its detail page too, so
  // a card on the register opens rather than reading "not in the register".
  if (section === 'assets') return FASM_ASSETS.find((r) => String(r.assetId) === String(id)) || null
  return null
}

// ── the components the router mounts ─────────────────────────────────────
//
// Not every config has one. `assets`, `inspection-reports`, `inspection-reminder`
// and `incidents` are the product's own modules and have their own screens in
// the card layout; their configs stay here only because RecordView reads them
// to render one row on its own page.
const screen = (key) => function Screen() { return <Register {...CONFIGS[key]} /> }

export const Sites = screen('sites')
export const Locations = screen('locations')
export const AssetClasses = screen('asset-classes')
export const Readings = screen('readings')
export const Correlation = screen('correlation')
export const Systems = screen('systems')
export const Bms = screen('bms')
export const Epms = screen('epms')
export const Dcim = screen('dcim')
export const Oem = screen('oem')
export const Battery = screen('battery')
export const PmTasks = screen('pm-tasks')
export const PmCompliance = screen('pm-compliance')
export const WeeklyHealth = screen('weekly-health')
export const Benefits = screen('benefits')
export const Risks = screen('risks')
export const SiteReadiness = screen('site-readiness')
export const TechPrereq = screen('tech-prereq')
export const Stakeholders = screen('stakeholders')
export const FailureCodes = screen('failure-codes')
export const Criticality = screen('criticality')
export const Manufacturers = screen('manufacturers')

export { Facts, Mono, Wrap, Chips }
