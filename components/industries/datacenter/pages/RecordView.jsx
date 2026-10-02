'use client'

// One record, on its own page.
//
// This is what replaced the slide-over. A drawer cannot be linked to, cannot be
// printed, loses the back button, and puts a record that may be twenty fields
// long into a 440px column that scrolls independently of the page behind it.
// The product this follows opens a route for a record, and so does this.
//
// The fields come from the same config the list screen reads, so the page and
// the table can never describe a record differently.

import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, Section, ActionButton, StatusBadge, PALETTE } from '../lib/kit'
import { Facts } from '../components/Register'
import { CONFIGS, findRecord } from './registers'
import { SECTION_LABEL } from '../lib/nav'
import {
  ALERT_ROWS, WORK_ORDER_ROWS, CORRELATION_ROWS, READING_ROWS, ALL_FEED_ROWS,
  ASSET_ROWS, SITES, LOCATIONS, ASSET_CLASSES, SYSTEMS, PM_TASKS, PM_COMPLIANCE,
  FAILURE_CODES, RISKS, SITE_READINESS, TECH_PREREQ, listOf, fmtDate, fmtDateTime,
} from '../lib/data'

const { SUB, MUTE, INK, LINE } = PALETTE

export default function RecordView() {
  const { section, id } = useParams()
  const router = useRouter()
  const cfg = CONFIGS[section]
  const record = useMemo(() => findRecord(section, decodeURIComponent(String(id))), [section, id])

  const back = () => router.push(`/portal/datacenter/${section}`)

  if (!cfg || !record) {
    return (
      <div>
        <Breadcrumb section={section} id={id} onBack={back} />
        <Card>
          <div style={{ padding: '30px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>Nothing here with that reference.</div>
            <div style={{ fontSize: 12.5, color: MUTE, margin: '6px 0 14px' }}>
              {decodeURIComponent(String(id))} is not in {SECTION_LABEL[section] || 'this register'}.
            </div>
            <ActionButton onClick={back}>Back to the register</ActionButton>
          </div>
        </Card>
      </div>
    )
  }

  const related = relatedTo(section, record)

  return (
    <div>
      <Breadcrumb section={section} id={cfg.recordTitle?.(record) || id} onBack={back} />

      <div style={styles.header}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={styles.title}>{cfg.recordTitle ? cfg.recordTitle(record) : String(id)}</h1>
          {cfg.recordSubtitle && <p style={styles.subtitle}>{cfg.recordSubtitle(record)}</p>}
        </div>
        <ActionButton onClick={() => window.print()}>Print</ActionButton>
      </div>

      <Section title="Record">
        <Facts items={cfg.facts ? cfg.facts(record) : Object.entries(record).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k, String(v ?? '')])} />
      </Section>

      {related.map((group) => (
        <Section key={group.title} title={group.title}>
          {group.rows.length ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {group.rows.map((r) => (
                <button key={r.key} onClick={() => r.to && router.push(r.to)} style={{ ...styles.link, cursor: r.to ? 'pointer' : 'default' }}>
                  <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{r.label}</div>
                    {r.note && <div style={{ fontSize: 11.5, color: MUTE, marginTop: 2, lineHeight: 1.45 }}>{r.note}</div>}
                  </div>
                  {r.badge && <StatusBadge tone={r.tone}>{r.badge}</StatusBadge>}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: MUTE }}>{group.empty}</div>
          )}
        </Section>
      ))}
    </div>
  )
}

function Breadcrumb({ section, onBack }) {
  return (
    <button onClick={onBack} style={styles.crumb}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M11 18l-6-6 6-6" />
      </svg>
      {SECTION_LABEL[section] || 'Back'}
    </button>
  )
}

/**
 * What else in the PoC touches this record.
 *
 * The value of these workbooks is that everything cross-references, and a
 * record page that shows only its own row throws that away. The joins are all
 * built already in lib/data — an asset carries its site, class, criticality and
 * SLA; an alert carries its work order, its correlation and its lead time — so
 * this file is only about rendering them.
 *
 * A table rather than a chain of ifs, because there are eighteen of them now
 * and the eighteenth `if` is where a section quietly gets forgotten. A section
 * missing from this map renders its fields and nothing else, which is what the
 * whole register did before.
 *
 * Every builder returns groups in the same shape: a title, an `empty` sentence
 * for when nothing matches, and rows carrying an optional `to`. Empty is stated
 * rather than hidden — "no alerts have been raised against this asset" is a
 * fact about the asset, and a section that vanishes says nothing at all.
 */

const sevTone = (s) => (s === 'Critical' ? 'red' : s === 'High' ? 'amber' : 'blue')

const to = {
  asset: (id) => `/portal/datacenter/assets/${id}`,
  alert: (id) => `/portal/datacenter/alerts/${id}`,
  site: (id) => `/portal/datacenter/sites/${id}`,
  location: (id) => `/portal/datacenter/locations/${id}`,
  code: (id) => `/portal/datacenter/failure-codes/${id}`,
  cls: (id) => `/portal/datacenter/asset-classes/${id}`,
  task: (id) => `/portal/datacenter/pm-tasks/${id}`,
  correlation: (id) => `/portal/datacenter/correlation/${id}`,
  workOrder: (id) => `/portal/datacenter/work-orders/${id}`,
}

/** Assets, as a related-record row. Used by six of the builders below. */
const assetRows = (list) => list.map((a) => ({
  key: a.assetId,
  label: `${a.assetId} — ${a.assetName}`,
  note: `${a._site} · ${a._location} · ${a.monitoringMethod}`,
  badge: a.criticality,
  tone: a.criticality === 'Critical' ? 'red' : a.criticality === 'High' ? 'amber' : 'blue',
  to: to.asset(a.assetId),
}))

const alertRows = (list) => list.map((a) => ({
  key: a.alertId,
  label: `${a.alertId} — ${a.description}`,
  note: `${a._asset} · ${a.failureCode} · ${fmtDateTime(a.timestamp)}`,
  badge: a.severity, tone: sevTone(a.severity),
  to: to.alert(a.alertId),
}))

const woRows = (list) => list.map((w) => ({
  key: w.workOrderId,
  label: `${w.workOrderId} — ${w.description}`,
  note: `${w._asset} · ${w.triggerSource} · raised ${fmtDate(w.dateRaised)}`,
  badge: w.status,
  to: to.workOrder(w.workOrderId),
}))

// Systems are named one way on the register and another on an asset row: the
// register says "Building Management System (BMS)", the asset's data-source
// column says "BMS". Mapped once here rather than matched by substring, which
// would quietly make "Battery Monitoring System" a match for "Monitoring".
const SYSTEM_KEYS = {
  'SYS-BMS': ['BMS'],
  'SYS-EPMS': ['EPMS'],
  'SYS-DCIM': ['DCIM'],
  'SYS-OEM': ['OEM Monitoring Platform'],
  'SYS-BAT': ['Battery Monitoring System'],
  'SYS-CMMS': ['CMMS Maintenance History'],
  'SYS-AST': ['Asset Registry Information'],
  'SYS-INC': ['Incident History'],
}
// The three new sensor platforms are not data *sources* on the asset row — they
// are the sensors being fitted, which is a different column.
const SYSTEM_SENSORS = { 'SYS-VIB': 'Vibration', 'SYS-THM': 'Thermal', 'SYS-USN': 'Ultrasound' }

const RELATED = {
  assets: (r) => [
    {
      title: 'Alerts raised against this asset',
      empty: 'No alerts have been raised against this asset.',
      rows: alertRows(ALERT_ROWS.filter((a) => a.assetId === r.assetId)),
    },
    {
      title: 'Work orders',
      empty: 'No work orders raised against this asset.',
      rows: woRows(WORK_ORDER_ROWS.filter((w) => w.assetId === r.assetId)),
    },
    {
      title: 'Preventive maintenance carried out',
      empty: 'No PM log entries against this asset.',
      rows: PM_COMPLIANCE.filter((c) => c.assetId === r.assetId).map((c) => ({
        key: c.logId,
        label: `${c.taskId} — ${PM_TASKS.find((t) => t.taskId === c.taskId)?.task || c.logId}`,
        note: `Scheduled ${fmtDate(c.scheduledDate)} · ${c.team}`,
        badge: c.status, tone: /On Time/.test(c.status) ? 'green' : 'amber',
        to: to.task(c.taskId),
      })),
    },
    {
      title: 'Sensor readings',
      empty: 'No condition monitoring readings recorded for this asset.',
      rows: READING_ROWS.filter((x) => x.assetId === r.assetId).map((x) => ({
        key: x.readingId,
        label: `${x.sensorType} — ${x.value} ${x.unit || ''}`,
        note: `${fmtDateTime(x.timestamp)} · threshold ${x.threshold}`,
        badge: x.status,
        to: `/portal/datacenter/readings/${x.readingId}`,
      })),
    },
    {
      title: 'What the existing systems recorded',
      empty: 'No BMS, EPMS, DCIM, OEM or battery rows name this asset.',
      rows: ALL_FEED_ROWS.filter((x) => x.assetId === r.assetId).map((x) => ({
        key: x.readingId,
        label: `${x._system} — ${x._point}`,
        note: `${fmtDateTime(x._when)}${x.value != null ? ` · ${x.value} ${x.unit || ''}` : ''}`,
        badge: x.status,
      })),
    },
    {
      title: 'Failure modes being watched for',
      empty: 'No failure codes are recorded against this asset.',
      rows: r._failureCodes.map((code) => {
        const f = FAILURE_CODES.find((x) => x.code === code)
        return {
          key: code,
          label: f ? `${code} — ${f.mode}` : code,
          note: f ? `Detected by ${f.technology}` : 'Not in the failure code register',
          to: f ? to.code(code) : null,
        }
      }),
    },
  ],

  sites: (r) => [
    {
      title: 'Assets at this site',
      empty: 'No assets are registered at this site.',
      rows: assetRows(ASSET_ROWS.filter((a) => a.siteId === r.siteId)),
    },
    {
      title: 'Locations',
      empty: 'No location hierarchy recorded for this site.',
      rows: LOCATIONS.filter((l) => l.siteId === r.siteId).map((l) => ({
        key: l.locationId,
        label: `${l.locationId} — ${l.locationName}`,
        note: l.locationType,
        to: to.location(l.locationId),
      })),
    },
    {
      title: 'Alerts at this site',
      empty: 'No alerts raised at this site.',
      rows: alertRows(ALERT_ROWS.filter((a) => a.siteId === r.siteId)),
    },
  ],

  locations: (r) => [
    {
      title: 'Assets here',
      empty: 'No assets are registered at this location.',
      rows: assetRows(ASSET_ROWS.filter((a) => a.locationId === r.locationId)),
    },
    {
      title: 'Locations inside this one',
      empty: 'Nothing sits below this in the hierarchy.',
      rows: LOCATIONS.filter((l) => l.parentId === r.locationId).map((l) => ({
        key: l.locationId,
        label: `${l.locationId} — ${l.locationName}`,
        note: l.locationType,
        to: to.location(l.locationId),
      })),
    },
    {
      title: 'Where this sits',
      empty: 'This is a top-level location.',
      rows: [LOCATIONS.find((l) => l.locationId === r.parentId), SITES.find((x) => x.siteId === r.parentId)]
        .filter(Boolean)
        .map((x) => (x.siteId && !x.locationId
          ? { key: x.siteId, label: `${x.siteId} — ${x.siteName}`, note: `${x.region} · site`, to: to.site(x.siteId) }
          : { key: x.locationId, label: `${x.locationId} — ${x.locationName}`, note: x.locationType, to: to.location(x.locationId) })),
    },
  ],

  'asset-classes': (r) => [
    {
      title: 'Assets of this class',
      empty: 'No assets of this class are on the register.',
      rows: assetRows(ASSET_ROWS.filter((a) => a._classId === r.classId)),
    },
    {
      title: 'Preventive maintenance for this class',
      empty: 'No baseline PM tasks defined for this class.',
      rows: PM_TASKS.filter((t) => t.classId === r.classId).map((t) => ({
        key: t.taskId,
        label: `${t.taskId} — ${t.task}`,
        note: `${t.frequency} · ${t.standard}`,
        badge: t.frequency, tone: 'slate',
        to: to.task(t.taskId),
      })),
    },
    {
      title: 'Failure modes this class is monitored for',
      empty: 'No sensing technology recorded against this class.',
      rows: FAILURE_CODES.filter((f) => listOf(r.monitoring).includes(f.technology)).map((f) => ({
        key: f.code,
        label: `${f.code} — ${f.mode}`,
        note: f.technology,
        to: to.code(f.code),
      })),
    },
  ],

  'failure-codes': (r) => [
    {
      title: 'Assets watched for this failure mode',
      empty: 'No asset on the register carries this code.',
      rows: assetRows(ASSET_ROWS.filter((a) => a._failureCodes.includes(r.code))),
    },
    {
      title: 'Alerts raised under this code',
      empty: 'This failure mode has not fired during the PoC.',
      rows: alertRows(ALERT_ROWS.filter((a) => a.failureCode === r.code)),
    },
  ],

  criticality: (r) => [
    {
      title: `Assets rated ${r.rating}`,
      empty: 'No assets carry this rating.',
      rows: assetRows(ASSET_ROWS.filter((a) => a.criticality === r.rating)),
    },
    {
      title: 'Asset classes that default to this rating',
      empty: 'No class defaults to this rating.',
      rows: ASSET_CLASSES.filter((c) => c.defaultCriticality === r.rating).map((c) => ({
        key: c.classId,
        label: `${c.classId} — ${c.className}`,
        note: `${c.category} · ${c.strategy}`,
        to: to.cls(c.classId),
      })),
    },
  ],

  manufacturers: (r) => {
    const makers = listOf(r.manufacturers)
    return [
      {
        title: 'Equipment on the register from these makers',
        empty: 'Nothing on the register is from one of these manufacturers.',
        rows: assetRows(ASSET_ROWS.filter((a) => makers.some((m) => a.manufacturer === m))),
      },
      {
        title: 'The class these makers supply',
        empty: 'This class is not in the class register.',
        rows: ASSET_CLASSES.filter((c) => c.classId === r.classId).map((c) => ({
          key: c.classId,
          label: `${c.classId} — ${c.className}`,
          note: `${c.category} · monitored by ${c.monitoring}`,
          to: to.cls(c.classId),
        })),
      },
    ]
  },

  systems: (r) => {
    const names = SYSTEM_KEYS[r.systemId] || []
    const sensor = SYSTEM_SENSORS[r.systemId]
    return [
      {
        title: sensor ? `Assets being fitted with ${sensor.toLowerCase()} sensing` : 'Assets this system feeds',
        empty: sensor
          ? 'No asset in scope is having this sensor fitted.'
          : 'No asset on the register lists this system as a data source.',
        rows: assetRows(ASSET_ROWS.filter((a) => (sensor
          ? a._sensors.includes(sensor)
          : names.some((n) => a._dataSources.includes(n))))),
      },
      {
        title: 'What this system recorded',
        empty: sensor
          ? 'Readings from the new sensors sit under Sensor Readings rather than here.'
          : 'No rows from this system are in the PoC extract.',
        rows: ALL_FEED_ROWS.filter((x) => x._system.startsWith(r.systemName.split(' (')[0].split(' ')[0]))
          .slice(0, 12)
          .map((x) => ({
            key: x.readingId,
            label: `${x.readingId} — ${x._point}`,
            note: `${x._asset || x._site} · ${fmtDateTime(x._when)}`,
            badge: x.status,
          })),
      },
    ]
  },

  'pm-tasks': (r) => [
    {
      title: 'Assets this task applies to',
      empty: 'No assets of this class are on the register.',
      rows: assetRows(ASSET_ROWS.filter((a) => a._classId === r.classId)),
    },
    {
      title: 'Times it has been carried out',
      empty: 'No compliance entries logged against this task yet.',
      rows: PM_COMPLIANCE.filter((c) => c.taskId === r.taskId).map((c) => ({
        key: c.logId,
        label: `${c.logId} — ${c.assetId}`,
        note: `Scheduled ${fmtDate(c.scheduledDate)}${c.completedDate ? ` · completed ${fmtDate(c.completedDate)}` : ''} · ${c.team}`,
        badge: c.status, tone: /On Time/.test(c.status) ? 'green' : 'amber',
        to: to.asset(c.assetId),
      })),
    },
  ],

  'pm-compliance': (r) => {
    const task = PM_TASKS.find((t) => t.taskId === r.taskId)
    const asset = ASSET_ROWS.find((a) => a.assetId === r.assetId)
    return [
      {
        title: 'The task',
        empty: 'This task is not in the PM library.',
        rows: task ? [{
          key: task.taskId,
          label: `${task.taskId} — ${task.task}`,
          note: `${task.frequency} · ${task.standard}`,
          to: to.task(task.taskId),
        }] : [],
      },
      {
        title: 'The asset',
        empty: 'This asset is not on the register.',
        rows: asset ? assetRows([asset]) : [],
      },
    ]
  },

  readings: (r) => {
    const asset = ASSET_ROWS.find((a) => a.assetId === r.assetId)
    const alert = r.alertId ? ALERT_ROWS.find((a) => a.alertId === r.alertId) : null
    return [
      {
        title: 'The asset this was measured on',
        empty: 'This reading names an asset that is not on the register.',
        rows: asset ? assetRows([asset]) : [],
      },
      {
        title: 'The alert it raised',
        empty: 'This reading sat inside its threshold — nothing was raised.',
        rows: alert ? alertRows([alert]) : [],
      },
      {
        title: 'Other readings from this asset',
        empty: 'This is the only reading recorded for this asset.',
        rows: READING_ROWS.filter((x) => x.assetId === r.assetId && x.readingId !== r.readingId).map((x) => ({
          key: x.readingId,
          label: `${x.sensorType} — ${x.value} ${x.unit || ''}`,
          note: fmtDateTime(x.timestamp),
          badge: x.status,
          to: `/portal/datacenter/readings/${x.readingId}`,
        })),
      },
    ]
  },

  'work-orders': (r) => {
    const alert = ALERT_ROWS.find((a) => a.alertId === r.alertId)
    const asset = ASSET_ROWS.find((a) => a.assetId === r.assetId)
    return [
      {
        title: 'The alert that raised this',
        empty: 'Raised on a calendar schedule or by an operator, not by an alert.',
        rows: alert ? alertRows([alert]) : [],
      },
      {
        title: 'The asset',
        empty: 'This work order names an asset that is not on the register.',
        rows: asset ? assetRows([asset]) : [],
      },
    ]
  },

  correlation: (r) => {
    const alert = ALERT_ROWS.find((a) => a.alertId === r.alertId)
    const asset = ASSET_ROWS.find((a) => a.assetId === r.assetId)
    return [
      {
        title: 'The alert this confirmed',
        empty: 'The linked alert is not in the register.',
        rows: alert ? alertRows([alert]) : [],
      },
      {
        title: 'The asset it was found on',
        empty: 'This record names an asset that is not on the register.',
        rows: asset ? assetRows([asset]) : [],
      },
    ]
  },

  stakeholders: (r) => [
    {
      title: 'Risks and dependencies this role owns',
      empty: 'Nothing in the risk register is owned by this role.',
      rows: RISKS.filter((x) => x.owner === r.role).map((x) => ({
        key: x.id,
        label: `${x.id} — ${x.description}`,
        note: `${x.category} · ${x.status}`,
        badge: x.category, tone: x.category === 'Risk' ? 'amber' : 'blue',
        to: `/portal/datacenter/risks/${x.id}`,
      })),
    },
    {
      title: 'Readiness items this role owns',
      empty: 'No site readiness or technical prerequisite is assigned to this role.',
      rows: [
        ...SITE_READINESS.map((x, i) => ({ ...x, _to: `/portal/datacenter/site-readiness/${i + 1}` })),
        ...TECH_PREREQ.map((x, i) => ({ ...x, _to: `/portal/datacenter/tech-prereq/${i + 1}` })),
      ].filter((x) => x.owner === r.role).map((x) => ({
        key: x._to,
        label: x.item,
        note: x.category,
        badge: x.status, tone: x.status === 'Not Started' ? 'amber' : 'green',
        to: x._to,
      })),
    },
  ],

  risks: (r) => [
    {
      title: 'Also owned by this role',
      empty: 'This is the only entry against this owner.',
      rows: RISKS.filter((x) => x.owner === r.owner && x.id !== r.id).map((x) => ({
        key: x.id,
        label: `${x.id} — ${x.description}`,
        note: `${x.category} · ${x.status}`,
        badge: x.category, tone: x.category === 'Risk' ? 'amber' : 'blue',
        to: `/portal/datacenter/risks/${x.id}`,
      })),
    },
  ],

  benefits: (r) => {
    const ids = String(r.evidence || '').split('/').map((x) => x.trim()).filter(Boolean)
    return [{
      title: 'Supporting evidence',
      empty: 'No evidence linked.',
      rows: ids.map((ref) => {
        const cor = CORRELATION_ROWS.find((c) => c.correlationId === ref)
        const wo = WORK_ORDER_ROWS.find((w) => w.workOrderId === ref)
        return {
          key: ref,
          label: ref,
          note: cor?.finding || wo?.outcome || 'Referenced record',
          to: cor ? to.correlation(ref) : wo ? to.workOrder(ref) : null,
        }
      }),
    }]
  },
}

// The two checklists share a builder: each item's neighbours are the other
// items its owner is carrying, which is the question a readiness review asks.
const ownerGroup = (rows, base) => (r) => [{
  title: `Also owned by ${r.owner}`,
  empty: 'This is the only item against this owner.',
  rows: rows.map((x, i) => ({ x, i })).filter(({ x }) => x.owner === r.owner && x.item !== r.item).map(({ x, i }) => ({
    key: `${base}-${i}`,
    label: x.item,
    note: x.category,
    badge: x.status, tone: x.status === 'Not Started' ? 'amber' : 'green',
    to: `/portal/datacenter/${base}/${i + 1}`,
  })),
}]

RELATED['site-readiness'] = ownerGroup(SITE_READINESS, 'site-readiness')
RELATED['tech-prereq'] = ownerGroup(TECH_PREREQ, 'tech-prereq')

// The five feed screens all resolve the same pair, so they share one builder
// rather than five copies that drift.
const feedRelated = (r) => {
  const asset = r.assetId ? ASSET_ROWS.find((a) => a.assetId === r.assetId) : null
  const alert = r.alertId ? ALERT_ROWS.find((a) => a.alertId === r.alertId) : null
  return [
    {
      title: 'The asset this came from',
      empty: 'A site-level metric rather than an asset reading.',
      rows: asset ? assetRows([asset]) : [],
    },
    {
      title: 'The alert it supports',
      empty: 'This row is not correlated to an alert.',
      rows: alert ? alertRows([alert]) : [],
    },
  ]
}
;['bms', 'epms', 'dcim', 'oem', 'battery'].forEach((k) => { RELATED[k] = feedRelated })

function relatedTo(section, r) {
  const build = RELATED[section]
  return build ? build(r) : []
}

const styles = {
  crumb: {
    display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12,
    padding: '5px 10px 5px 7px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, color: '#15227a', cursor: 'pointer',
  },
  header: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18, flexWrap: 'wrap' },
  icon: { width: 44, height: 44, borderRadius: 11, background: '#e8ecff', color: '#15227a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  // Matched to PageHeading, which is matched to the product: a record page
  // that opens two sizes smaller than the list it came from reads as a
  // different screen rather than a deeper one.
  title: { margin: 0, fontSize: 28, fontWeight: 700, color: INK, letterSpacing: '-0.02em', lineHeight: 1.15 },
  subtitle: { margin: '6px 0 0', fontSize: 14.5, color: '#475569', lineHeight: 1.55 },
  link: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '10px 12px', background: '#fcfdfe', border: `1px solid ${LINE}`,
    borderRadius: 10, fontFamily: 'inherit',
  },
}
